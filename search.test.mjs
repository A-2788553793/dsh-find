import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { apply } from './index.js';

const query = 'needle';
const workspaces = [
  { id: 'a', path: 'E:/A', title: 'Workspace A' },
  { id: 'b', path: 'E:/B', title: 'Workspace B' },
];
const session = (id, cwd = 'E:/A', createdAt = 1) => ({ header: { id, cwd, createdAt } });
const user = (seq, text = query) => ({
  seq, type: 'user/message', data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] },
});
const assistant = (seq, ...blocks) => ({
  seq, type: 'assistant/message', data: { message: { role: 'assistant', content: blocks.map(([type, text]) => ({ type, text })) } },
});
const candidate = (seq = 1, text = query) => ({ seq, type: 'user/message', text });
const title = (sessionId, text) => ({ status: 'fulfilled', sessionId, value: { title: { title: text } } });

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function mount(overrides = {}, archivedSessionIds = []) {
  const services = {
    workspaceRegistry: { list: () => workspaces, archivedSessionIds },
    sessionQuery: {
      listSessions: async () => [session('only')],
      filterEvents: async () => [candidate()],
      readSession: async () => ({ events: [user(1)] }),
      readTitleSnapshots: async () => [],
      ...overrides,
    },
  };
  let route;
  apply({ get: (key) => services[key], webServer: { register: (value) => { route = value; } } });
  assert.equal(route.path, '/dsh-find');
  return (params = {}) => {
    const response = deferred();
    const writes = [];
    const res = new EventEmitter();
    res.writableEnded = false;
    res.destroyed = false;
    res.writeHead = (status) => { writes.push('head'); res.statusCode = status; };
    res.end = (body) => {
      writes.push('end');
      res.writableEnded = true;
      response.resolve({ status: res.statusCode, body: JSON.parse(body) });
    };
    const args = new URLSearchParams({ q: query, ...params });
    route.handler({ url: '/dsh-find/search?' + args, method: 'GET' }, res);
    return {
      response: response.promise,
      writes,
      disconnect() { res.destroyed = true; res.emit('close'); },
    };
  };
}

for (const stage of ['listSessions', 'filterEvents', 'readSession', 'readTitleSnapshots']) {
  test('client disconnect while ' + stage + ' is in flight stops subsequent search work and responses', async () => {
    const records = Array.from({ length: 10 }, (_, id) => session('session-' + id));
    const gate = deferred();
    const started = deferred();
    const calls = [];
    let signal;
    let visitedEvents = 0;
    const event = { ...user(1), get seq() { visitedEvents += 1; return 1; } };
    const request = mount({
      listSessions: (receivedSignal) => {
        calls.push(['listSessions']);
        signal = receivedSignal;
        if (stage !== 'listSessions') return records;
        started.resolve();
        return gate.promise;
      },
      filterEvents: (...args) => {
        calls.push(['filterEvents', ...args]);
        if (stage !== 'filterEvents') return [candidate()];
        if (calls.length === 9) started.resolve();
        return gate.promise;
      },
      readSession: (...args) => {
        calls.push(['readSession', ...args]);
        if (stage !== 'readSession') return { events: [user(1)] };
        if (calls.filter(([name]) => name === 'readSession').length === 8) started.resolve();
        return gate.promise;
      },
      readTitleSnapshots: (ids, receivedSignal) => {
        calls.push(['readTitleSnapshots', ids, receivedSignal]);
        if (stage !== 'readTitleSnapshots') return [];
        started.resolve();
        return gate.promise;
      },
    })();
    await started.promise;
    const callsBeforeDisconnect = calls.slice();
    request.disconnect();
    assert.ok(signal instanceof AbortSignal);
    assert.equal(signal.aborted, true);
    if (stage === 'listSessions') gate.resolve(records); // Even a service that returns after cancellation must stop the pipeline.
    if (stage === 'filterEvents') gate.resolve([candidate()]);
    if (stage === 'readSession') gate.resolve({ events: [event] });
    if (stage === 'readTitleSnapshots') gate.reject(signal.reason);
    await setImmediate(); // Drain the route's promise continuations after the in-flight work settles.
    assert.deepEqual(calls, callsBeforeDisconnect);
    assert.deepEqual(request.writes, []);
    assert.equal(visitedEvents, 0);
    for (const [name, ...args] of calls) {
      if (name === 'filterEvents') assert.deepEqual(args, [args[0], [
        { kind: 'text', text: query },
        { kind: 'type', values: ['user/message', 'assistant/message', 'tool/result'] },
      ]]);
      if (name === 'readSession') assert.equal(args.length, 1);
      if (name === 'readTitleSnapshots') assert.equal(args[1], signal);
    }
  });
}

test('raw event traversal stops only when both per-session channels are full', async () => {
  let visitedTail = 0;
  const tail = { ...user(4), get seq() { visitedTail += 1; return 4; } };
  const request = mount({
    readSession: async () => ({ events: [user(1), user(2), assistant(3, ['reasoning', query]), tail] }),
  })({ perSession: 1 });
  const { status, body } = await request.response;
  assert.equal(status, 200);
  // The raw reasoning event does not appear in candidate seqs; it still contributes a hit.
  assert.deepEqual(body.hits.map(({ seq, channel }) => [seq, channel]), [[1, 'conversation'], [3, 'thinking']]);
  assert.deepEqual(body.counts, { thinking: 1, conversation: 1 });
  assert.deepEqual(body.truncatedChannels, { thinking: false, conversation: false });
  assert.equal(visitedTail, 0);
});

test('sorts and applies both global caps before batching titles for retained sessions', async () => {
  const titleRequests = [];
  const records = [
    session('archived', 'E:/A', 100), session('orphan', 'E:/other', 100),
    session('a-old', 'E:/A', 1), session('b-new', 'E:/B', 20), session('a-new', 'e:\\a', 2),
    session('b-old', 'E:/B', 10), { header: { id: 'subagent', origin: 'subagent' } }, session('miss'),
  ];
  const events = {
    'a-new': [assistant(1, ['text', 'needle needle'], ['reasoning', query]), user(2), assistant(3, ['reasoning', query])],
    'a-old': [assistant(1, ['reasoning', query])],
    'b-new': [assistant(1, ['reasoning', query], ['text', query])],
    orphan: [user(1)],
    archived: [assistant(1, ['reasoning', query], ['text', query])],
  };
  const start = mount({
    listSessions: async () => records,
    filterEvents: async (id) => id === 'miss' ? [] : [candidate()],
    readSession: async (id) => {
      if (!events[id]) throw new Error('Raw log unavailable');
      return { events: events[id] };
    },
    readTitleSnapshots: async (ids) => {
      titleRequests.push(ids);
      return ids.flatMap((id) => {
        if (id === 'a-old') return [{ status: 'rejected', sessionId: id, reason: new Error('Title unavailable') }];
        if (id === 'b-new') return [title(id, '')];
        if (id === 'b-old') return [{ status: 'fulfilled', sessionId: id, value: {} }];
        return [title(id, 'Title for ' + id)];
      });
    },
  }, ['archived']);
  const describeHits = (hits) => hits.map(({ sessionId, seq, channel, title }) => [sessionId, seq, channel, title]);
  const kept = [
    ['a-new', 1, 'conversation', 'Title for a-new'], ['a-new', 1, 'thinking', 'Title for a-new'],
    ['a-new', 2, 'conversation', 'Title for a-new'], ['a-new', 3, 'thinking', 'Title for a-new'],
    ['a-old', 1, 'thinking', null], ['b-new', 1, 'thinking', null], ['b-new', 1, 'conversation', null],
    ['b-old', 1, 'conversation', null],
  ];
  const small = await start({ total: 4, perSession: 2 }).response;
  assert.equal(small.status, 200);
  assert.deepEqual(describeHits(small.body.hits), kept);
  assert.equal(small.body.hits[0].occurrences, 2);
  assert.equal(small.body.hits[0].workspaceId, 'a');
  assert.equal(small.body.hits.at(-1).speaker, 'user'); // Indexed-document fallback for b-old.
  assert.equal(small.body.sessionsScanned, 7);
  assert.equal(small.body.sessionsMatched, 6);
  assert.equal(small.body.totalHits, 8);
  assert.equal(small.body.archivedHits, 0);
  assert.equal(small.body.truncated, true);
  assert.deepEqual(small.body.counts, { thinking: 4, conversation: 4 });
  assert.deepEqual(small.body.truncatedChannels, { thinking: true, conversation: true });
  assert.deepEqual(titleRequests, [['a-new', 'a-old', 'b-new', 'b-old']]);

  const oneChannel = await start({ total: 5, perSession: 2 }).response;
  assert.equal(oneChannel.status, 200);
  assert.deepEqual(oneChannel.body.counts, { thinking: 5, conversation: 5 });
  assert.deepEqual(oneChannel.body.truncatedChannels, { thinking: false, conversation: true });
  assert.deepEqual(describeHits(oneChannel.body.hits).at(-1), ['archived', 1, 'thinking', 'Title for archived']);
  assert.equal(oneChannel.body.archivedHits, 1);
  assert.deepEqual(titleRequests[1], ['a-new', 'a-old', 'b-new', 'b-old', 'orphan', 'archived']);

  const full = await start({ total: 20, perSession: 2 }).response;
  assert.equal(full.status, 200);
  assert.deepEqual(describeHits(full.body.hits), [...kept,
    ['orphan', 1, 'conversation', 'Title for orphan'], ['archived', 1, 'thinking', 'Title for archived'],
    ['archived', 1, 'conversation', 'Title for archived'],
  ]);
  assert.equal(full.body.truncated, false);
  assert.equal(full.body.archivedHits, 2);
  assert.deepEqual(full.body.counts, { thinking: 5, conversation: 6 });
  assert.deepEqual(titleRequests[2], ['a-new', 'a-old', 'b-new', 'b-old', 'orphan', 'archived']);
});

test('a title batch failure falls back to null, and an empty result skips the batch', async () => {
  let titleReads = 0;
  const readTitleSnapshots = async () => { titleReads += 1; throw new Error('Titles unavailable'); };
  const hit = await mount({ readTitleSnapshots })().response;
  assert.equal(hit.status, 200);
  assert.equal(hit.body.hits[0].title, null);
  const miss = await mount({ filterEvents: async () => [], readTitleSnapshots })().response;
  assert.equal(miss.status, 200);
  assert.deepEqual(miss.body.hits, []);
  assert.equal(titleReads, 1);
});

test('locations retain real message identities and original content indices across event types', async () => {
  const userEvent = {
    seq: 10, type: 'user/message', data: {
      id: 'user-id', role: 'user', source: { kind: 'user' },
      content: [
        { type: 'image', attachment: {} }, null, { type: 'text', text: '' },
        { type: 'file', text: query }, { type: 'text', text: 'prefix\n\nsecond NeEdLe needle' },
      ],
    },
  };
  const assistantEvent = {
    seq: 20, type: 'assistant/message', data: {
      turn: 7, step: 2, stream: [], message: {
        id: 'assistant-id', role: 'assistant', source: { kind: 'model', provider: 'test', model: 'test' },
        content: [
          { type: 'text', text: 'no match' }, { type: 'tool-call', id: 'call-id', name: 'test', arguments: query },
          { type: 'reasoning', text: 'why NEEDLE' }, { type: 'image', attachment: {} },
          { type: 'text', text: 'answer needle' }, { type: 'text', text: 'needle again needle' },
        ],
      },
    },
  };
  const toolEvent = {
    seq: 30, type: 'tool/result', data: {
      turn: 7, step: 2, message: {
        id: 'tool-message-id', role: 'tool', toolCallId: 'call-id', source: { kind: 'tool', callId: 'call-id' },
        content: [{ type: 'image', attachment: {} }, { type: 'text', text: 'result NEEDLE' }],
      },
    },
  };
  const { status, body } = await mount({
    filterEvents: async () => [candidate(10), candidate(20), candidate(30)],
    readSession: async () => ({ events: [userEvent, assistantEvent, assistantEvent, toolEvent] }),
  })({ perSession: 20 }).response;
  assert.equal(status, 200);
  assert.deepEqual(body.hits.map(({ seq, type, channel, role, speaker, snippet, offset, occurrences, location }) => ({
    seq, type, channel, role, speaker, snippet, offset, occurrences, location,
  })), [
    { seq: 10, type: 'user/message', channel: 'conversation', role: 'user', speaker: 'user',
      snippet: 'second NeEdLe needle', offset: 7, occurrences: 2,
      location: { messageId: 'user-id', contentIndex: 4, matchOffset: 15 } },
    { seq: 20, type: 'assistant/message', channel: 'thinking', role: 'assistant', speaker: 'assistant',
      snippet: 'why NEEDLE', offset: 4, occurrences: 1,
      location: { messageId: 'assistant-id', turn: 7, step: 2, contentIndex: 2, matchOffset: 4 } },
    { seq: 20, type: 'assistant/message', channel: 'conversation', role: 'assistant', speaker: 'assistant',
      snippet: 'answer needle', offset: 7, occurrences: 1,
      location: { messageId: 'assistant-id', turn: 7, step: 2, contentIndex: 4, matchOffset: 7 } },
    { seq: 20, type: 'assistant/message', channel: 'conversation', role: 'assistant', speaker: 'assistant',
      snippet: 'needle again needle', offset: 0, occurrences: 2,
      location: { messageId: 'assistant-id', turn: 7, step: 2, contentIndex: 5, matchOffset: 0 } },
    { seq: 30, type: 'tool/result', channel: 'conversation', role: 'tool', speaker: 'tool',
      snippet: 'result NEEDLE', offset: 7, occurrences: 1,
      location: { messageId: 'tool-message-id', turn: 7, step: 2, callId: 'call-id', contentIndex: 1, matchOffset: 7 } },
  ]);
  assert.deepEqual(body.counts, { thinking: 1, conversation: 4 });
  assert.equal(body.totalHits, 5);
  assert.ok(body.hits.every(({ clippedStart, clippedEnd }) => clippedEnd === false));
  assert.equal(body.hits[0].clippedStart, true);
});

test('locations omit absent identity fields and preserve zero turn and step without inferring user context', async () => {
  const direct = user(1);
  const nested = assistant(2, ['text', query]);
  nested.data.turn = 0;
  nested.data.step = 0;
  const tool = {
    seq: 3, type: 'tool/result', data: {
      turn: 0, step: 0,
      message: { role: 'tool', source: { kind: 'tool', callId: 'source-call-id' }, content: [{ type: 'text', text: query }] },
    },
  };
  const { body } = await mount({ readSession: async () => ({ events: [direct, nested, tool] }) })().response;
  assert.deepEqual(body.hits.map(({ location }) => location), [
    { contentIndex: 0, matchOffset: 0 },
    { turn: 0, step: 0, contentIndex: 0, matchOffset: 0 },
    { turn: 0, step: 0, callId: 'source-call-id', contentIndex: 0, matchOffset: 0 },
  ]);
});

for (const raw of [[], null]) {
  test('document-only fallback has a document-relative offset but no invented message location: ' + JSON.stringify(raw), async () => {
    const text = 'prefix\n\nsecond NEEDLE needle';
    const { status, body } = await mount({
      filterEvents: async () => [candidate(41, text)],
      readSession: async () => { if (raw === null) throw new Error('Raw log unavailable'); return { events: raw }; },
    })().response;
    assert.equal(status, 200);
    assert.deepEqual(body.hits[0].location, { matchOffset: 15 });
    assert.equal(body.hits[0].seq, 41);
    assert.equal(body.hits[0].type, 'user/message');
    assert.equal(body.hits[0].snippet, 'second NEEDLE needle');
    assert.equal(body.hits[0].offset, 7);
    assert.equal(body.hits[0].occurrences, 2);
    assert.equal(body.hits[0].role, null);
  });
}

test('location match offsets use original UTF-16 text without changing existing Unicode snippet semantics', async () => {
  const text = '\u0130\u{1f600} needle';
  for (const fallback of [false, true]) {
    const { body } = await mount({
      filterEvents: async () => [candidate(1, text)],
      readSession: async () => ({ events: fallback ? [] : [user(1, text)] }),
    })().response;
    assert.equal(body.hits[0].location.matchOffset, 4);
    assert.equal(body.hits[0].offset, 5); // Existing lowercase-expanded snippet indexing is intentionally unchanged.
    assert.equal(body.hits[0].snippet, text);
    assert.equal(body.hits[0].occurrences, 1);
  }
});

test('an ordinary search failure still sends the existing HTTP error', async () => {
  const request = mount({ listSessions: async () => { throw new Error('Listing failed'); } })();
  assert.deepEqual(await request.response, { status: 500, body: { error: 'search-failed', message: 'Listing failed' } });
});
