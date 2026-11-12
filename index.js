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

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import { extname, join } from 'node:path';

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

/**
 * Which side of the conversation a hit came from.
 * `user/message` carries system, plugin and scheduler injections too, so only
 * `source.kind === 'user'` counts as something the user actually typed.
 */
function speakerOf(eventType, data) {
  if (eventType === 'user/message') {
    const source = data !== null && typeof data === 'object' ? data.source : null;
    const kind = source !== null && typeof source === 'object' ? source.kind : null;
    if (typeof kind !== 'string' || kind.length === 0) return 'user';
    return kind === 'user' ? 'user' : 'system';
  }
  if (eventType === 'assistant/message') return 'assistant';
  if (eventType === 'tool/result') return 'tool';
  return null;
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
        hits.push({
          seq: document.seq,
          type: document.type,
          role: null,
          speaker: speakerOf(document.type, null),
          channel: 'conversation',
          ...built,
        });
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
          speaker: speakerOf(event.type, event.data),
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
 * What the command/tool registration actually achieved. Exposed on /health so a
 * silent no-op ("I typed the command and nothing happened") can be diagnosed
 * without restarting anything.
 */
const registrationStatus = { commands: [], commandErrors: [], tool: null, toolErrors: [], runs: [] };

/** Remember the last few command invocations, so a silent no-op is observable. */
function noteRun(name, args) {
  registrationStatus.runs.push({ name, args: String(args ?? '').slice(0, 80), at: new Date().toISOString() });
  if (registrationStatus.runs.length > 5) registrationStatus.runs.shift();
}

/**
 * The last `/find-text-ui` request. A command runs in the Host half, but the panel
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
  noteRun('find-text-ui', invocation?.rawInput);
  const raw = String(invocation?.rawInput ?? '').trim();
  const stripped = raw.replace(/^\/?find-text-ui\b\s*/i, '').trim();
  const query = (stripped.length > 0 ? stripped : raw).slice(0, 200);
  if (query.length === 0) {
    return { kind: 'error', text: '用法：/find-text-ui <要查找的文字>' };
  }
  publishFind(query);
  return { kind: 'success', text: '正在打开查找窗口：' + query };
}

function registerFindCommand(ctx) {
  const attach = (scope, registry) => {
    if (registry === undefined || registry === null || typeof registry.register !== 'function') return;
    const register = () => {
      /* One command only: it hands the query to the page and the panel does the
         searching. Agents use the `find_text` tool when they want the text. */
      const disposers = [];
      disposers.push(
        registry.register({
          name: 'find-text-ui',
          description: '在本机全部工作区、全部对话中查找文本，并打开查找窗口',
          input: { hint: '要查找的文字（输入后按回车执行）' },
          handler: handleFindCommand,
        }),
      );
      registrationStatus.commands = ['find-text-ui'];
      return () => {
        for (const dispose of disposers) {
          if (typeof dispose === 'function') dispose();
        }
      };
    };
    try {
      if (typeof scope?.effect === 'function') {
        scope.effect(register, 'dsh-find: find-text-ui command');
      } else {
        register();
      }
    } catch (err) {
      registrationStatus.commandErrors.push(String(err?.message ?? err));
      console.warn('[dsh-find] failed to register the find-text-ui command', err);
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

/* ------------------------------------------------------------ text report */

/**
 * The search index is also useful without any UI: an agent tool and a slash
 * command both answer "where does this text appear?" as plain text, so a reply
 * can quote the result without a round trip through the panel.
 *
 * Reports are deliberately compact — a chat bubble has to stay readable — so
 * the snippet budget is smaller than the panel's default.
 */
const REPORT_DEFAULTS = { maxChars: 220, perSession: 2, total: 40 };

const SPEAKER_NAMES = { user: '用户', assistant: 'AI', tool: '工具', system: '系统' };
const CHANNEL_NAMES = { thinking: '思考', conversation: '对话' };

function flattenExcerpt(text) {
  return String(text ?? '').replace(/\s+/g, ' ').trim();
}

function formatSeconds(tookMs) {
  return (Math.max(0, Number(tookMs) || 0) / 1000).toFixed(1);
}

function formatSearchReport(payload) {
  const hits = Array.isArray(payload?.hits) ? payload.hits : [];
  const query = String(payload?.query ?? '');
  const scanned = Number(payload?.sessionsScanned ?? 0);
  if (hits.length === 0) {
    return `没有找到「${query}」。扫描了 ${scanned} 个对话，用时 ${formatSeconds(payload?.tookMs)} 秒。`;
  }

  const sessions = new Set(hits.map((hit) => String(hit.sessionId))).size;
  const truncated =
    payload?.truncated === true ||
    payload?.truncatedChannels?.thinking === true ||
    payload?.truncatedChannels?.conversation === true;
  /* Keep the first line short: the command card shows the whole text on one
     shimmering line until it is expanded, so a long first line is unreadable. */
  const lines = [
    `找到 ${hits.length} 处「${query}」，涉及 ${sessions} 个对话。`,
    `扫描 ${scanned} 个对话，用时 ${formatSeconds(payload?.tookMs)} 秒${truncated ? '；结果已按上限截断' : ''}。`,
    '',
  ];

  /* Group by workspace, then by conversation, so the reader sees the same
     shape as the panel: workspace card → conversation → excerpt. */
  const groups = new Map();
  for (const hit of hits) {
    const workspace = String(hit.workspaceTitle ?? '未归属工作区');
    if (!groups.has(workspace)) groups.set(workspace, new Map());
    const bySession = groups.get(workspace);
    const sessionId = String(hit.sessionId);
    if (!bySession.has(sessionId)) {
      bySession.set(sessionId, {
        title: String(hit.title ?? '无标题对话'),
        archived: hit.archived === true,
        hits: [],
      });
    }
    bySession.get(sessionId).hits.push(hit);
  }

  let index = 0;
  for (const [workspace, bySession] of groups) {
    lines.push(`■ 工作区「${workspace}」`);
    for (const session of bySession.values()) {
      const badge = session.archived ? '，已归档（界面里打不开）' : '';
      lines.push(`  · 对话「${session.title}」（${sumOccurrences(session.hits)} 处${badge}）`);
      for (const hit of session.hits) {
        index += 1;
        const channel = CHANNEL_NAMES[hit.channel] ?? '对话';
        const speaker = SPEAKER_NAMES[hit.speaker] ?? 'AI';
        const seq = hit.seq === undefined ? '' : `，seq ${hit.seq}`;
        const lead = hit.clippedStart === true ? '…' : '';
        const tail = hit.clippedEnd === true ? '…' : '';
        lines.push(`    ${index}) [${channel}·${speaker}${seq}] ${lead}${flattenExcerpt(hit.snippet)}${tail}`);
      }
    }
    lines.push('');
  }
  lines.push('要看上下文或点开命中位置，用 /find-text-ui 或 Ctrl+F 打开窗口。');
  return lines.join('\n');
}

function reportOptions(args) {
  return {
    ...DEFAULTS,
    maxChars: clampInt(args?.maxChars, REPORT_DEFAULTS.maxChars, 120, 2000),
    perSession: clampInt(args?.perSession, REPORT_DEFAULTS.perSession, 1, 12),
    total: clampInt(args?.total, REPORT_DEFAULTS.total, 1, 200),
  };
}

function findTextTool(ctx) {
  return {
    name: 'find_text',
    description: [
      'Search every workspace and every conversation on this machine for a piece of text, entirely',
      'locally (no network, no model calls, no token cost for the search itself). Use it whenever the',
      'user asks where something was said or written before — "查找/找一下 xxx", "哪次对话里提过 xxx",',
      '"我之前说过 xxx 吗", "which conversation mentioned xxx".',
      '',
      'It returns a grouped text report: workspace → conversation → each matching excerpt, with the',
      'channel (思考链 / 对话文本), the speaker (用户 / AI / 工具 / 系统), the log sequence number, and',
      'whether the conversation is archived. Quote that report back to the user; if they want to jump to',
      'the spot or preview images, tell them to open the panel with Ctrl+F or /find-text-ui.',
      '',
      'Searches both the reasoning (思考链) and the visible messages of every conversation, including',
      'tool output. Archived conversations are searched too and sorted last.',
    ].join('\n'),
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: '要查找的文字，1–200 字符，区分大小写不敏感（内部按小写比较）。',
      },
      maxChars: {
        type: 'number',
        description: '每条命中片段最多保留多少字符（120–2000，默认 220）。',
      },
      perSession: {
        type: 'number',
        description: '每个对话每栏（思考链 / 对话文本）最多保留几条（1–12，默认 2）。',
      },
      total: {
        type: 'number',
        description: '总共最多返回多少条命中（1–200，默认 40）。',
      },
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['text'],
        properties: {
          text: { type: 'string', description: 'Markdown 文本报告：按工作区、对话分组的命中片段。' },
        },
      },
      render(args, value) {
        return [{ type: 'text', text: value.text }];
      },
    },
    timeoutMs: 120_000,
    isConcurrencySafe() {
      return true;
    },
    async execute(args) {
      const query = String(args?.query ?? '').trim().slice(0, 200);
      if (query.length === 0) {
        return { text: '没有给出要查找的文字：请传入 query。' };
      }
      const payload = await runSearch(ctx, query, reportOptions(args), undefined);
      return { text: formatSearchReport(payload) };
    },
  };
}

function registerFindTool(ctx) {
  const attach = (scope, registry) => {
    if (registry === undefined || registry === null || typeof registry.register !== 'function') return;
    const register = () => {
      const dispose = registry.register(findTextTool(ctx));
      registrationStatus.tool = 'find_text';
      return () => {
        if (typeof dispose === 'function') dispose();
      };
    };
    try {
      if (typeof scope?.effect === 'function') {
        scope.effect(register, 'dsh-find: find-text tool');
      } else {
        register();
      }
    } catch (err) {
      registrationStatus.toolErrors.push(String(err?.message ?? err));
      console.warn('[dsh-find] failed to register the find-text tool', err);
    }
  };

  if (typeof ctx.inject === 'function') {
    ctx.inject(['tools'], (sub) => {
      attach(sub, sub.tools ?? (typeof sub.get === 'function' ? sub.get('tools') : undefined));
    });
    return;
  }

  attach(ctx, typeof ctx.get === 'function' ? ctx.get('tools') : ctx.tools);
}

/* ------------------------------------------------------------------ media */

/**
 * The media tab answers a different question than search: which pictures and
 * clips live in this conversation, and did the user supply them or did the
 * assistant produce them.
 *
 * Attachments arrive as `image` blocks that point at a content-addressed object
 * under `$DSH_HOME/attachments/v1/objects`. Videos never become blocks — they
 * only appear as local paths inside message text.
 */
const MEDIA_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
};

const MEDIA_DEFAULTS = { total: 400, concurrency: 6, maxBytes: 600 * 1024 * 1024 };
const ATTACHMENT_OBJECTS = ['attachments', 'v1', 'objects'];

/* A Windows absolute path ending in a media extension. Paths usually arrive
   markdown-escaped (`E:////dir////clip.mp4`), so separator runs collapse. The
   lookbehind rejects URL fragments such as `https:/host/a.png`, whose `s:` is
   not a drive letter. */
const MEDIA_PATH_RE =
  /(?<![A-Za-z0-9])[A-Za-z]:[\\/][^\s"'`<>|?*()[\]{}\u0000-\u001f，。；：、（）【】《》]*?\.(?:png|jpe?g|webp|gif|bmp|mp4|webm|mov|m4v|mkv|avi)/gi;

function isVideoType(mediaType) {
  return typeof mediaType === 'string' && mediaType.startsWith('video/');
}

function cleanMediaPath(raw) {
  return raw.replace(/[\\/]{2,}/g, '/').replace(/[.,;:]+$/, '');
}

function dshHome() {
  const fromEnv = process.env.DSH_HOME;
  if (typeof fromEnv === 'string' && fromEnv.length > 0) return fromEnv;
  return join(os.homedir(), '.dsh');
}

function mediaFromAttachment(block) {
  const attachment = block === null || typeof block !== 'object' ? null : block.attachment;
  if (attachment === null || typeof attachment !== 'object') return null;
  const rawId = typeof attachment.attachmentId === 'string' ? attachment.attachmentId : '';
  const hex = (rawId.startsWith('sha256:') ? rawId.slice(7) : rawId).toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) return null;
  const mediaType = typeof attachment.mediaType === 'string' ? attachment.mediaType : '';
  const name =
    typeof attachment.name === 'string' && attachment.name.length > 0 ? attachment.name : hex.slice(0, 12);
  return {
    id: 'att:' + hex,
    source: 'attachment',
    kind: isVideoType(mediaType) ? 'video' : 'image',
    name,
    mediaType,
    bytes: Number.isFinite(attachment.bytes) ? attachment.bytes : null,
    width: Number.isFinite(attachment.width) ? attachment.width : null,
    height: Number.isFinite(attachment.height) ? attachment.height : null,
    url: ROUTE_PREFIX + '/media/attachment?sha=' + hex,
  };
}

function mediaFromPath(raw) {
  const target = cleanMediaPath(raw);
  if (!/^[A-Za-z]:\//.test(target)) return null;
  const mediaType = MEDIA_TYPES[extname(target).toLowerCase()];
  if (mediaType === undefined) return null;
  let stat;
  try {
    stat = fs.statSync(target);
  } catch (err) {
    return null;
  }
  if (!stat.isFile() || stat.size > MEDIA_DEFAULTS.maxBytes) return null;
  const segments = target.split('/');
  return {
    id: 'file:' + target,
    source: 'file',
    kind: isVideoType(mediaType) ? 'video' : 'image',
    name: segments[segments.length - 1] ?? target,
    path: target,
    mediaType,
    bytes: stat.size,
    width: null,
    height: null,
    url: ROUTE_PREFIX + '/media/file?path=' + encodeURIComponent(target),
  };
}

/* The Client may only act on media it was actually shown, so every served item
   is remembered by id. Absolute paths never travel back from the browser — the
   reveal/delete routes resolve the id here instead. */
const mediaIndex = new Map();

function rememberMedia(item) {
  if (item === null || typeof item !== 'object' || typeof item.id !== 'string') return;
  if (item.source === 'attachment') {
    mediaIndex.set(item.id, { source: 'attachment', hex: item.id.slice(4) });
    return;
  }
  if (item.source === 'file' && typeof item.path === 'string') {
    mediaIndex.set(item.id, { source: 'file', path: item.path });
  }
}

function revealInExplorer(target, select) {
  const args = select ? [`/select,${target}`] : [target];
  const child = spawn('explorer.exe', args, { detached: true, stdio: 'ignore' });
  child.on('error', () => {
    /* Explorer is missing or refused; nothing else to do. */
  });
  child.unref();
}

function contentBlocksOf(event) {
  const data = event === null || typeof event !== 'object' ? null : event.data;
  if (data === null || typeof data !== 'object') return null;
  if (Array.isArray(data.content)) return data.content;
  const message = data.message;
  if (message !== null && typeof message === 'object' && Array.isArray(message.content)) {
    return message.content;
  }
  return null;
}

async function runMedia(ctx, options, signal) {
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

  const scanned = await mapLimit(targets, options.concurrency, async (record) => {
    if (signal?.aborted) return null;

    let events;
    try {
      const snapshot = await sessionQuery.readSession(record.header.id);
      events = Array.isArray(snapshot?.events) ? snapshot.events : [];
    } catch (err) {
      return null;
    }

    const items = new Map();

    for (const event of events) {
      if (event === null || typeof event !== 'object') continue;
      if (!SEARCHABLE_EVENT_TYPES.includes(event.type)) continue;
      const blocks = contentBlocksOf(event);
      if (blocks === null) continue;
      const speaker = speakerOf(event.type, event.data) === 'user' ? 'user' : 'assistant';

      for (const block of blocks) {
        if (block === null || typeof block !== 'object') continue;

        if (block.type === 'image') {
          const item = mediaFromAttachment(block);
          if (item === null) continue;
          const existing = items.get(item.id);
          if (existing !== undefined) {
            if (existing.speaker !== 'user' && speaker === 'user') existing.speaker = 'user';
            continue;
          }
          items.set(item.id, { ...item, speaker, seq: event.seq, type: event.type });
          continue;
        }

        /* Path mentions count for every message kind — a tool result is where
           most produced videos and screenshots get reported. */
        if (block.type !== 'text' || typeof block.text !== 'string') continue;
        const matches = block.text.match(MEDIA_PATH_RE);
        if (matches === null) continue;
        for (const raw of matches) {
          const item = mediaFromPath(raw);
          if (item === null) continue;
          const existing = items.get(item.id);
          if (existing !== undefined) {
            /* One file mentioned by both sides belongs to the human. */
            if (existing.speaker !== 'user' && speaker === 'user') existing.speaker = 'user';
            continue;
          }
          items.set(item.id, { ...item, speaker, seq: event.seq, type: event.type });
        }
      }
    }

    if (items.size === 0) return null;
    return { record, items: Array.from(items.values()) };
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
    /* titles are a nicety */
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

  const items = [];
  for (const entry of matched) {
    const header = entry.record.header;
    const workspace = workspaceByPath.get(normalizePath(header.cwd)) ?? null;
    for (const item of entry.items) {
      items.push({
        sessionId: header.id,
        title: entry.title ?? null,
        workspaceId: workspace === null ? null : workspace.id,
        workspaceTitle: workspace === null ? null : workspace.title,
        workspacePath: workspace === null ? (header.cwd ?? null) : workspace.path,
        cwd: header.cwd ?? null,
        live: entry.record.live === true,
        archived: archivedIds.has(String(header.id)),
        createdAt: header.createdAt,
        ...item,
      });
    }
  }

  const kept = items.slice(0, options.total);
  for (const item of kept) rememberMedia(item);

  return {
    tookMs: Date.now() - startedAt,
    sessionsScanned: targets.length,
    sessionsMatched: matched.length,
    total: kept.length,
    truncated: items.length > kept.length,
    counts: {
      user: kept.reduce((total, item) => (item.speaker === 'user' ? total + 1 : total), 0),
      assistant: kept.reduce((total, item) => (item.speaker === 'assistant' ? total + 1 : total), 0),
      image: kept.reduce((total, item) => (item.kind === 'image' ? total + 1 : total), 0),
      video: kept.reduce((total, item) => (item.kind === 'video' ? total + 1 : total), 0),
    },
    items: kept,
  };
}

/* --- per-session media ---------------------------------------------------- */

/** Shared lookups every media entry point needs. */
function sessionLookup(ctx) {
  const sessionQuery = ctx.get('sessionQuery');
  const registry = ctx.get('workspaceRegistry');
  if (sessionQuery === undefined || sessionQuery === null) {
    throw new Error('sessionQuery service is unavailable');
  }
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
  const archivedIds = (() => {
    try {
      const ids = registry?.archivedSessionIds;
      if (ids === undefined || ids === null) return new Set();
      return new Set(Array.from(ids, (id) => String(id)));
    } catch (err) {
      return new Set();
    }
  })();
  return { sessionQuery, registry, workspaces, workspaceByPath, workspaceOrder, archivedIds };
}

function collectMediaFromEvents(events) {
  const items = new Map();
  for (const event of events) {
    if (event === null || typeof event !== 'object') continue;
    if (!SEARCHABLE_EVENT_TYPES.includes(event.type)) continue;
    const blocks = contentBlocksOf(event);
    if (blocks === null) continue;
    const speaker = speakerOf(event.type, event.data) === 'user' ? 'user' : 'assistant';

    for (const block of blocks) {
      if (block === null || typeof block !== 'object') continue;

      if (block.type === 'image') {
        const item = mediaFromAttachment(block);
        if (item === null) continue;
        const existing = items.get(item.id);
        if (existing !== undefined) {
          if (existing.speaker !== 'user' && speaker === 'user') existing.speaker = 'user';
          continue;
        }
        items.set(item.id, { ...item, speaker, seq: event.seq, type: event.type });
        continue;
      }

      if (block.type !== 'text' || typeof block.text !== 'string') continue;
      const matches = block.text.match(MEDIA_PATH_RE);
      if (matches === null) continue;
      for (const raw of matches) {
        const item = mediaFromPath(raw);
        if (item === null) continue;
        const existing = items.get(item.id);
        if (existing !== undefined) {
          if (existing.speaker !== 'user' && speaker === 'user') existing.speaker = 'user';
          continue;
        }
        items.set(item.id, { ...item, speaker, seq: event.seq, type: event.type });
      }
    }
  }
  return items;
}

async function readTitles(sessionQuery, sessionIds, signal) {
  const titles = new Map();
  try {
    const observations = await sessionQuery.readTitleSnapshots(sessionIds, signal);
    for (const observation of observations) {
      if (observation.status === 'fulfilled' && observation.value.title !== undefined) {
        titles.set(observation.sessionId, observation.value.title.title);
      }
    }
  } catch (err) {
    /* titles are a nicety */
  }
  return titles;
}

/**
 * The lazy media page opens with a plain outline — workspaces, then their
 * conversations — and only some conversations are ever read. Building the
 * outline must not touch a single session log, or opening the tab would be as
 * slow as the full scan.
 */
async function buildMediaTree(ctx, signal) {
  const { sessionQuery, workspaces, workspaceByPath, workspaceOrder, archivedIds } = sessionLookup(ctx);
  const startedAt = Date.now();
  const records = await sessionQuery.listSessions(signal);
  const targets = records.filter((record) => {
    const header = record.header;
    if (header === undefined || typeof header.id !== 'string') return false;
    if (header.origin === 'subagent') return false;
    return true;
  });

  const titles = await readTitles(sessionQuery, targets.map((record) => record.header.id), signal);

  const groups = new Map();
  for (const workspace of workspaces) {
    groups.set(workspace.id, {
      workspaceId: workspace.id,
      workspaceTitle: workspace.title,
      workspacePath: workspace.path,
      order: workspaceOrder.get(workspace.id) ?? Number.MAX_SAFE_INTEGER,
      sessions: [],
    });
  }

  for (const record of targets) {
    const header = record.header;
    const workspace = workspaceByPath.get(normalizePath(header.cwd)) ?? null;
    const key = workspace === null ? '__unowned__' : workspace.id;
    let group = groups.get(key);
    if (group === undefined) {
      group = { workspaceId: null, workspaceTitle: null, workspacePath: null, order: Number.MAX_SAFE_INTEGER, sessions: [] };
      groups.set(key, group);
    }
    group.sessions.push({
      sessionId: header.id,
      title: titles.get(header.id) ?? null,
      archived: archivedIds.has(String(header.id)),
      live: record.live === true,
      createdAt: header.createdAt ?? 0,
      cwd: header.cwd ?? null,
    });
  }

  const ordered = Array.from(groups.values())
    .filter((group) => group.sessions.length > 0)
    .sort((left, right) => left.order - right.order);

  for (const group of ordered) {
    group.sessions.sort((left, right) => {
      if (left.archived !== right.archived) return left.archived ? 1 : -1;
      return (right.createdAt ?? 0) - (left.createdAt ?? 0);
    });
  }

  return {
    tookMs: Date.now() - startedAt,
    sessions: targets.length,
    workspaces: ordered.map((group) => ({
      workspaceId: group.workspaceId,
      workspaceTitle: group.workspaceTitle,
      workspacePath: group.workspacePath,
      total: group.sessions.length,
      sessions: group.sessions,
    })),
  };
}

/** Reads exactly one conversation; this is what a click on it triggers. */
async function runMediaSession(ctx, sessionId, signal) {
  const { sessionQuery, workspaceByPath, archivedIds } = sessionLookup(ctx);
  const startedAt = Date.now();

  let snapshot;
  try {
    snapshot = await sessionQuery.readSession(sessionId);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error('session unreadable: ' + message);
  }
  const events = Array.isArray(snapshot?.events) ? snapshot.events : [];
  const header = snapshot?.session ?? { id: sessionId };
  const items = Array.from(collectMediaFromEvents(events).values());

  const workspace = workspaceByPath.get(normalizePath(header.cwd)) ?? null;
  const titles = await readTitles(sessionQuery, [sessionId], signal);
  const enriched = items.map((item) => ({
    sessionId: header.id ?? sessionId,
    title: titles.get(sessionId) ?? null,
    workspaceId: workspace === null ? null : workspace.id,
    workspaceTitle: workspace === null ? null : workspace.title,
    workspacePath: workspace === null ? (header.cwd ?? null) : workspace.path,
    cwd: header.cwd ?? null,
    live: false,
    archived: archivedIds.has(String(sessionId)),
    createdAt: header.createdAt ?? 0,
    ...item,
  }));
  for (const item of enriched) rememberMedia(item);

  return {
    tookMs: Date.now() - startedAt,
    sessionId,
    title: titles.get(sessionId) ?? null,
    archived: archivedIds.has(String(sessionId)),
    total: enriched.length,
    counts: {
      user: enriched.reduce((total, item) => (item.speaker === 'user' ? total + 1 : total), 0),
      assistant: enriched.reduce((total, item) => (item.speaker === 'assistant' ? total + 1 : total), 0),
      image: enriched.reduce((total, item) => (item.kind === 'image' ? total + 1 : total), 0),
      video: enriched.reduce((total, item) => (item.kind === 'video' ? total + 1 : total), 0),
    },
    items: enriched,
  };
}

function sniffImageType(target) {
  let handle = null;
  try {
    handle = fs.openSync(target, 'r');
    const head = Buffer.alloc(12);
    const read = fs.readSync(handle, head, 0, 12, 0);
    if (read >= 8 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
      return 'image/png';
    }
    if (read >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) return 'image/jpeg';
    if (read >= 12 && head.toString('ascii', 0, 4) === 'RIFF' && head.toString('ascii', 8, 12) === 'WEBP') {
      return 'image/webp';
    }
    if (read >= 3 && head.toString('ascii', 0, 3) === 'GIF') return 'image/gif';
    if (read >= 2 && head[0] === 0x42 && head[1] === 0x4d) return 'image/bmp';
    return 'application/octet-stream';
  } catch (err) {
    return 'application/octet-stream';
  } finally {
    if (handle !== null) {
      try {
        fs.closeSync(handle);
      } catch (err) {
        /* already closed */
      }
    }
  }
}

function streamFile(res, target, mediaType) {
  let stat;
  try {
    stat = fs.statSync(target);
  } catch (err) {
    sendJson(res, 404, { error: 'not-found' });
    return;
  }
  if (!stat.isFile()) {
    sendJson(res, 404, { error: 'not-found' });
    return;
  }
  if (stat.size > MEDIA_DEFAULTS.maxBytes) {
    sendJson(res, 413, { error: 'too-large', max: MEDIA_DEFAULTS.maxBytes });
    return;
  }
  res.writeHead(200, {
    'content-type': mediaType,
    'content-length': String(stat.size),
    'cache-control': 'private, max-age=600',
  });
  const stream = fs.createReadStream(target);
  stream.on('error', () => {
    try {
      res.destroy();
    } catch (nested) {
      /* the socket is already gone */
    }
  });
  stream.pipe(res);
}

function serveAttachment(res, req) {
  const hex = (readParams(req).get('sha') ?? '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(hex)) {
    sendJson(res, 400, { error: 'bad-id' });
    return;
  }
  const target = join(dshHome(), ...ATTACHMENT_OBJECTS, hex.slice(0, 2), hex);
  streamFile(res, target, sniffImageType(target));
}

function serveMediaFile(res, req) {
  const target = readParams(req).get('path') ?? '';
  const mediaType = MEDIA_TYPES[extname(target).toLowerCase()];
  if (mediaType === undefined) {
    sendJson(res, 415, { error: 'unsupported-media' });
    return;
  }
  streamFile(res, target, mediaType);
}

function serveMediaReveal(res, req) {
  const id = readParams(req).get('id') ?? '';
  const entry = mediaIndex.get(id);
  if (entry === undefined) {
    sendJson(res, 404, { error: 'unknown-media' });
    return;
  }
  try {
    if (entry.source === 'attachment') {
      const folder = join(dshHome(), ...ATTACHMENT_OBJECTS, entry.hex.slice(0, 2));
      if (!fs.existsSync(folder)) {
        sendJson(res, 404, { error: 'not-found' });
        return;
      }
      revealInExplorer(folder, false);
    } else {
      if (!fs.existsSync(entry.path)) {
        sendJson(res, 404, { error: 'not-found' });
        return;
      }
      revealInExplorer(entry.path.replace(/\//g, '\\'), true);
    }
    sendJson(res, 200, { ok: true, id });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: 'reveal-failed', message });
  }
}

function serveMediaDelete(res, req) {
  if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
    sendJson(res, 405, { error: 'method-not-allowed' });
    return;
  }
  const id = readParams(req).get('id') ?? '';
  const entry = mediaIndex.get(id);
  if (entry === undefined) {
    sendJson(res, 404, { error: 'unknown-media' });
    return;
  }
  /* An attachment is part of the session log itself: removing it would leave a
     conversation whose images can never render again. */
  if (entry.source === 'attachment') {
    sendJson(res, 403, { error: 'attachment-protected' });
    return;
  }
  try {
    fs.unlinkSync(entry.path);
  } catch (err) {
    const code = err !== null && typeof err === 'object' ? err.code : undefined;
    if (code === 'ENOENT') {
      mediaIndex.delete(id);
      sendJson(res, 404, { error: 'not-found' });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    sendJson(res, 500, { error: 'delete-failed', message });
    return;
  }
  mediaIndex.delete(id);
  sendJson(res, 200, { ok: true, id });
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
    sendJson(res, 200, {
      ok: true,
      route: ROUTE_PREFIX,
      version: 7,
      commands: registrationStatus.commands,
      commandErrors: registrationStatus.commandErrors,
      tool: registrationStatus.tool,
      toolErrors: registrationStatus.toolErrors,
      runs: registrationStatus.runs,
    });
    return;
  }

  if (path === `${ROUTE_PREFIX}/media`) {
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      const payload = await runMedia(
        ctx,
        { total: clampInt(params.get('total'), MEDIA_DEFAULTS.total, 1, 2000), concurrency: MEDIA_DEFAULTS.concurrency },
        controller.signal,
      );
      sendJson(res, 200, payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: 'media-failed', message });
    }
    return;
  }

  if (path === `${ROUTE_PREFIX}/media/tree`) {
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      sendJson(res, 200, await buildMediaTree(ctx, controller.signal));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: 'media-tree-failed', message });
    }
    return;
  }

  if (path === `${ROUTE_PREFIX}/media/session`) {
    const sessionId = params.get('id') ?? '';
    if (sessionId.length === 0) {
      sendJson(res, 400, { error: 'bad-id' });
      return;
    }
    const controller = new AbortController();
    res.on('close', () => {
      if (!res.writableEnded) controller.abort();
    });
    try {
      sendJson(res, 200, await runMediaSession(ctx, sessionId, controller.signal));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      sendJson(res, 500, { error: 'media-session-failed', message });
    }
    return;
  }

  if (path === `${ROUTE_PREFIX}/media/attachment`) {
    serveAttachment(res, req);
    return;
  }

  if (path === `${ROUTE_PREFIX}/media/file`) {
    serveMediaFile(res, req);
    return;
  }

  if (path === `${ROUTE_PREFIX}/media/reveal`) {
    serveMediaReveal(res, req);
    return;
  }

  if (path === `${ROUTE_PREFIX}/media/delete`) {
    serveMediaDelete(res, req);
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

  try {
    registerFindTool(ctx);
  } catch (err) {
    console.warn('[dsh-find] tool registration failed', err);
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
