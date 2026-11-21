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

test('an ordinary search failure still sends the existing HTTP error', async () => {
  const request = mount({ listSessions: async () => { throw new Error('Listing failed'); } })();
  assert.deepEqual(await request.response, { status: 500, body: { error: 'search-failed', message: 'Listing failed' } });
});
