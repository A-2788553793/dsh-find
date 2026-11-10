/**
 * Host half of the `dsh-find` bundle.
 *
 * Exposes one same-origin HTTP route that performs a **purely local** full-text
 * search across every session log known to `ctx.sessionQuery`. No model call is
 * made, so a search never spends a token.
 *
 * Every hit carries a `channel`:
 *   - `thinking`     → the text lived in a reasoning block (the model's chain of thought)
 *   - `conversation` → the text lived in a user message, an assistant reply, or a tool result
 *
 * The Client half (`client.js`) owns the Ctrl+F palette and the jump-to-hit
 * behaviour; it talks to this route with `fetch`.
 */

const ROUTE_PREFIX = '/dsh-find';

const DEFAULTS = {
  maxChars: 420,
  perSession: 3,
  total: 150,
  concurrency: 8,
  maxEvents: 400,
};

const SEARCHABLE_EVENT_TYPES = ['user/message', 'assistant/message', 'tool/result'];

/* ------------------------------------------------------------------ utils */

function normalizePath(value) {
  if (typeof value !== 'string' || value.length === 0) return '';
  return value.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function clampInt(raw, fallback, min, max) {
  const parsed = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function countOccurrences(haystack, needle) {
  if (needle.length === 0) return 0;
  let count = 0;
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(needle, from);
    if (at < 0) return count;
    count += 1;
    from = at + needle.length;
  }
}

function paragraphBounds(text, index) {
  const before = text.lastIndexOf('\n\n', index);
  const after = text.indexOf('\n\n', index);
  return [before < 0 ? 0 : before + 2, after < 0 ? text.length : after];
}

/**
 * Cut the paragraph that contains the match. A paragraph that exceeds
 * `maxChars` keeps a window centred on the match, aligned to line breaks.
 */
function buildSnippet(text, query, maxChars) {
  const haystack = text.toLowerCase();
  const needle = query.toLowerCase();
  const index = haystack.indexOf(needle);
  if (index < 0) return null;

  let [start, end] = paragraphBounds(text, index);
  if (end - start > maxChars) {
    const half = Math.max(0, Math.floor((maxChars - query.length) / 2));
    start = Math.max(0, index - half);
    end = Math.min(text.length, start + maxChars);
    start = Math.max(0, end - maxChars);
    const lineStart = text.lastIndexOf('\n', index);
    if (lineStart >= start && lineStart < index) start = lineStart + 1;
    const lineEnd = text.indexOf('\n', Math.min(text.length, end));
    if (lineEnd > index && lineEnd <= end + 200) end = Math.min(text.length, lineEnd);
  }

  return {
    snippet: text.slice(start, end),
    offset: index - start,
    clippedStart: start > 0,
    clippedEnd: end < text.length,
    occurrences: countOccurrences(haystack, needle),
  };
}

async function mapLimit(items, limit, run) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = new Array(Math.max(1, Math.min(limit, items.length))).fill(null).map(async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await run(items[index], index);
    }
  });
  await Promise.all(workers);
  return results;
}

function sendJson(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': String(byteLength(text)),
  });
  res.end(text);
}

function byteLength(text) {
  return Buffer.byteLength(text);
}

/* ----------------------------------------------------------------- blocks */

/**
 * Pull the searchable text blocks out of one session event.
 * A block is either the chain of thought (`reasoning`) or plain conversation
 * text (`text`) — tool call arguments are deliberately skipped.
 */
function extractBlocks(event) {
  const data = event === null || typeof event !== 'object' ? null : event.data;
  if (data === null || typeof data !== 'object') return [];

  const blocks = [];
  const push = (content, role) => {
    if (!Array.isArray(content)) return;
    for (const block of content) {
      if (block === null || typeof block !== 'object') continue;
      const text = typeof block.text === 'string' ? block.text : null;
      if (text === null || text.length === 0) continue;
      if (block.type === 'reasoning') {
        blocks.push({ channel: 'thinking', role, text });
      } else if (block.type === 'text') {
        blocks.push({ channel: 'conversation', role, text });
      }
    }
  };

  if (Array.isArray(data.content)) {
    /* user/message stores the message itself in `data` */
    push(data.content, data.role ?? null);
  }
  if (data.message !== null && typeof data.message === 'object') {
    /* assistant/message and tool/result store the message under `data.message` */
    push(data.message.content, data.message.role ?? null);
  }

  return blocks;
}

/* ----------------------------------------------------------------- search */

async function runSearch(ctx, query, options, signal) {
  const sessionQuery = ctx.get('sessionQuery');
  const registry = ctx.get('workspaceRegistry');
  if (sessionQuery === undefined || sessionQuery === null) {
    throw new Error('sessionQuery service is unavailable');
  }

  const startedAt = Date.now();

  const workspaces = (() => {
    try {
      return registry === undefined || registry === null ? [] : registry.list();
    } catch (err) {
      return [];
    }
  })();

  const workspaceByPath = new Map();
  const workspaceOrder = new Map();
  workspaces.forEach((workspace, index) => {
    const key = normalizePath(workspace.path);
    if (key.length > 0) workspaceByPath.set(key, workspace);
    workspaceOrder.set(workspace.id, index);
  });

  /* The registry keeps the archive set globally. Archived conversations stay
     searchable, but the UI cannot open them, so mark every hit and sort those
     conversations to the very end. */
  const archivedIds = (() => {
    try {
      const ids = registry?.archivedSessionIds;
      if (ids === undefined || ids === null) return new Set();
      return new Set(Array.from(ids, (id) => String(id)));
    } catch (err) {
      return new Set();
    }
  })();

  const records = await sessionQuery.listSessions(signal);
  const targets = records.filter((record) => {
    const header = record.header;
    if (header === undefined || typeof header.id !== 'string') return false;
    if (header.origin === 'subagent') return false;
    return true;
  });

  const filters = [
    { kind: 'text', text: query },
    { kind: 'type', values: SEARCHABLE_EVENT_TYPES },
  ];

  let thinkingTruncated = false;
  let conversationTruncated = false;

  const scanned = await mapLimit(targets, options.concurrency, async (record) => {
    if (signal?.aborted) return null;

    let documents;
    try {
      documents = await sessionQuery.filterEvents(record.header.id, filters);
    } catch (err) {
      return null;
    }
    if (!Array.isArray(documents) || documents.length === 0) return null;

    let events;
    try {
      const snapshot = await sessionQuery.readSession(record.header.id);
      events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    } catch (err) {
      events = [];
    }

    /* Fall back to the indexed documents when the raw log cannot be replayed:
       the channel is then unknown and the hit is shown as conversation text. */
    if (events.length === 0) {
      const hits = [];
      for (const document of documents) {
        if (typeof document.text !== 'string') continue;
        const built = buildSnippet(document.text, query, options.maxChars);
        if (built === null) continue;
        if (hits.length >= options.perSession) break;
        hits.push({ seq: document.seq, type: document.type, role: null, channel: 'conversation', ...built });
      }
      if (hits.length === 0) return null;
      return { record, hits, occurrences: sumOccurrences(hits) };
    }

    const wanted = new Map();
    for (const document of documents) wanted.set(document.seq, document.type);

    const seen = new Set();
    const hits = [];
    const perChannel = { thinking: 0, conversation: 0 };

    for (const event of events) {
      if (hits.length >= options.maxEvents) break;
      if (event === null || typeof event !== 'object') continue;
      const type = wanted.get(event.seq);
      if (type === undefined && !SEARCHABLE_EVENT_TYPES.includes(event.type)) continue;
      if (!SEARCHABLE_EVENT_TYPES.includes(event.type)) continue;
      const key = `${event.seq}:${event.type}`;
      if (seen.has(key)) continue;

      const blocks = extractBlocks(event);
      if (blocks.length === 0) continue;

      for (const block of blocks) {
        if (block.channel === 'thinking' && perChannel.thinking >= options.perSession) continue;
        if (block.channel === 'conversation' && perChannel.conversation >= options.perSession) continue;
        const built = buildSnippet(block.text, query, options.maxChars);
        if (built === null) continue;
        seen.add(key);
        perChannel[block.channel] += 1;
        hits.push({
          seq: event.seq,
          type: event.type,
          role: block.role,
          channel: block.channel,
          ...built,
        });
      }
    }

    if (hits.length === 0) return null;
    return { record, hits, occurrences: sumOccurrences(hits) };
  });

  const matched = scanned.filter((entry) => entry !== null);

  try {
    const observations = await sessionQuery.readTitleSnapshots(
      matched.map((entry) => entry.record.header.id),
      signal,
    );
    const titles = new Map();
    for (const observation of observations) {
      if (observation.status === 'fulfilled' && observation.value.title !== undefined) {
        titles.set(observation.sessionId, observation.value.title.title);
      }
    }
    for (const entry of matched) {
      const title = titles.get(entry.record.header.id);
      if (typeof title === 'string' && title.length > 0) entry.title = title;
    }
  } catch (err) {
    /* titles are a nicety; a failure here must not fail the search */
  }

  matched.sort((left, right) => {
    const leftArchived = archivedIds.has(String(left.record.header.id)) ? 1 : 0;
    const rightArchived = archivedIds.has(String(right.record.header.id)) ? 1 : 0;
    if (leftArchived !== rightArchived) return leftArchived - rightArchived;
    const leftWorkspace = workspaceByPath.get(normalizePath(left.record.header.cwd)) ?? null;
    const rightWorkspace = workspaceByPath.get(normalizePath(right.record.header.cwd)) ?? null;
    const leftOrder =
      leftWorkspace === null
        ? Number.MAX_SAFE_INTEGER
        : (workspaceOrder.get(leftWorkspace.id) ?? Number.MAX_SAFE_INTEGER);
    const rightOrder =
      rightWorkspace === null
        ? Number.MAX_SAFE_INTEGER
        : (workspaceOrder.get(rightWorkspace.id) ?? Number.MAX_SAFE_INTEGER);
    if (leftOrder !== rightOrder) return leftOrder - rightOrder;
    return (right.record.header.createdAt ?? 0) - (left.record.header.createdAt ?? 0);
  });

  const flat = [];
  const counts = { thinking: 0, conversation: 0 };

  for (const entry of matched) {
    const header = entry.record.header;
    const workspace = workspaceByPath.get(normalizePath(header.cwd)) ?? null;
    for (const hit of entry.hits) {
      const channel = hit.channel === 'thinking' ? 'thinking' : 'conversation';
      if (counts[channel] >= options.total) {
        if (channel === 'thinking') thinkingTruncated = true;
        else conversationTruncated = true;
        continue;
      }
      counts[channel] += 1;
      flat.push({
        sessionId: header.id,
        title: entry.title ?? null,
        workspaceId: workspace === null ? null : workspace.id,
        workspaceTitle: workspace === null ? null : workspace.title,
        workspacePath: workspace === null ? (header.cwd ?? null) : workspace.path,
        cwd: header.cwd ?? null,
        live: entry.record.live === true,
        archived: archivedIds.has(String(header.id)),
        createdAt: header.createdAt,
        ...hit,
      });
    }
  }

  return {
    query,
    tookMs: Date.now() - startedAt,
    sessionsScanned: targets.length,
    sessionsMatched: matched.length,
    counts,
    truncated: thinkingTruncated || conversationTruncated,
    truncatedChannels: {
      thinking: thinkingTruncated,
      conversation: conversationTruncated,
    },
    archivedHits: flat.reduce((total, hit) => (hit.archived === true ? total + 1 : total), 0),
    totalHits: flat.length,
    hits: flat,
  };
}

function sumOccurrences(hits) {
  let total = 0;
  for (const hit of hits) total += hit.occurrences ?? 0;
  return total;
}

/* ----------------------------------------------------------------- pending */

/**
 * The last `/find-text` request. A command runs in the Host half, but the panel
 * lives in the page, so the two halves meet through a long-polled handshake:
 * the command publishes one request here, and every connected page picks it up.
 */
let pendingRequest = { seq: 0, query: null, at: 0 };
const pendingWaiters = new Set();

function publishFind(query) {
  pendingRequest = { seq: pendingRequest.seq + 1, query, at: Date.now() };
  for (const waiter of Array.from(pendingWaiters)) {
    try {
      waiter();
    } catch (err) {
      /* a broken waiter must not block the publish */
    }
  }
}

function waitForPending(since, timeoutMs, signal) {
  return new Promise((resolve) => {
    if (pendingRequest.seq > since) {
      resolve();
      return;
    }
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      pendingWaiters.delete(check);
      clearTimeout(timer);
      if (signal !== undefined) signal.removeEventListener('abort', settle);
      resolve();
    };
    const check = () => {
      if (pendingRequest.seq > since) settle();
    };
    pendingWaiters.add(check);
    const timer = setTimeout(settle, timeoutMs);
    if (signal !== undefined) signal.addEventListener('abort', settle, { once: true });
  });
}

/** A request older than this is not replayed to a freshly loaded page. */
const PENDING_FRESH_MS = 60_000;

function replyPending(res) {
  const fresh = Date.now() - pendingRequest.at < PENDING_FRESH_MS;
  sendJson(res, 200, {
    seq: pendingRequest.seq,
    query: fresh ? pendingRequest.query : null,
  });
}

function handleFindCommand(invocation) {
  const raw = String(invocation?.rawInput ?? '').trim();
  const stripped = raw.replace(/^\/?find-text\b\s*/i, '').trim();
  const query = (stripped.length > 0 ? stripped : raw).slice(0, 200);
  if (query.length === 0) {
    return { kind: 'error', text: '用法：/find-text <要查找的文字>' };
  }
  publishFind(query);
  return { kind: 'success', text: '正在打开查找窗口：' + query };
}

function registerFindCommand(ctx) {
  const attach = (scope, registry) => {
    if (registry === undefined || registry === null || typeof registry.register !== 'function') return;
    const register = () => {
      const dispose = registry.register({
        name: 'find-text',
        description: '在本机全部工作区、全部对话中查找文本，并打开查找窗口',
        input: { hint: '要查找的文字' },
        handler: handleFindCommand,
      });
      return () => {
        if (typeof dispose === 'function') dispose();
      };
    };
    try {
      if (typeof scope?.effect === 'function') {
        scope.effect(register, 'dsh-find: find-text command');
      } else {
        register();
      }
    } catch (err) {
      console.warn('[dsh-find] failed to register the find-text command', err);
    }
  };

  if (typeof ctx.inject === 'function') {
    ctx.inject(['commands'], (sub) => {
      const registry = sub.commands ?? (typeof sub.get === 'function' ? sub.get('commands') : undefined);
      attach(sub, registry);
    });
    return;
  }

  attach(ctx, typeof ctx.get === 'function' ? ctx.get('commands') : ctx.commands);
}

/* ------------------------------------------------------------------- route */

function readParams(req) {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');
    return url.searchParams;
  } catch (err) {
    return new URLSearchParams();
  }
}

async function handleRequest(ctx, req, res) {
  const params = readParams(req);
  const path = (req.url ?? '').split('?')[0];

  if (path === `${ROUTE_PREFIX}/health`) {
    sendJson(res, 200, { ok: true, route: ROUTE_PREFIX, version: 3 });
    return;
  }

  if (path === `${ROUTE_PREFIX}/pending`) {
    const since = clampInt(params.get('since'), 0, 0, 1_000_000_000);
    if (pendingRequest.seq > since) {
      replyPending(res);
      return;
    }
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    await waitForPending(since, 20_000, controller.signal);
    if (res.writableEnded || res.destroyed) return;
    replyPending(res);
    return;
  }

  if (path !== `${ROUTE_PREFIX}/search`) {
    sendJson(res, 404, { error: 'not-found', path });
    return;
  }

  const rawQuery = (params.get('q') ?? '').trim();
  if (rawQuery.length === 0) {
    sendJson(res, 200, emptyPayload());
    return;
  }
  if (rawQuery.length > 200) {
    sendJson(res, 400, { error: 'query-too-long', max: 200 });
    return;
  }

  const options = {
    maxChars: clampInt(params.get('maxChars'), DEFAULTS.maxChars, 120, 2000),
    perSession: clampInt(params.get('perSession'), DEFAULTS.perSession, 1, 12),
    total: clampInt(params.get('total'), DEFAULTS.total, 1, 400),
    concurrency: DEFAULTS.concurrency,
    maxEvents: DEFAULTS.maxEvents,
  };

  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  try {
    const payload = await runSearch(ctx, rawQuery, options, controller.signal);
    sendJson(res, 200, payload);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: 'search-failed', message });
  }
}

function emptyPayload() {
  return {
    query: '',
    tookMs: 0,
    sessionsScanned: 0,
    sessionsMatched: 0,
    counts: { thinking: 0, conversation: 0 },
    truncated: false,
    truncatedChannels: { thinking: false, conversation: false },
    totalHits: 0,
    hits: [],
  };
}

/* ------------------------------------------------------------------- apply */

export function apply(ctx) {
  try {
    registerFindCommand(ctx);
  } catch (err) {
    console.warn('[dsh-find] command registration failed', err);
  }

  const route = {
    kind: 'prefix',
    path: ROUTE_PREFIX,
    handler: (req, res) => {
      handleRequest(ctx, req, res).catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        try {
          sendJson(res, 500, { error: 'handler-crashed', message });
        } catch (nested) {
          /* the socket is already gone */
        }
      });
    },
  };

  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (sub) => {
      const server = sub.webServer;
      if (server === undefined || server === null) return;
      try {
        if (typeof sub.effect === 'function') {
          sub.effect(() => {
            const dispose = server.register(route);
            return () => {
              if (typeof dispose === 'function') dispose();
            };
          }, 'dsh-find: search route');
        } else {
          server.register(route);
        }
      } catch (err) {
        console.warn('[dsh-find] failed to register the search route', err);
      }
    });
    return;
  }

  if (ctx.webServer !== undefined && ctx.webServer !== null) {
    ctx.webServer.register(route);
  }
}
