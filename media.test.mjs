import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createServer, request as httpRequest } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { setImmediate } from 'node:timers/promises';
import { apply } from './index.js';

const prefix = '/dsh-find/media';
const project = 'E:/media-fixture';
const file = (name) => project + '/' + name;
const hex = 'a'.repeat(64);
const text = (...paths) => ({ type: 'text', text: paths.join(' ') });
const image = (name) => ({ type: 'image', attachment: {
  attachmentId: 'sha256:' + hex, mediaType: 'image/png', name, bytes: 4, width: 2, height: 2,
} });
const assistant = (seq, ...content) => ({ type: 'assistant/message', seq, data: { message: { content } } });
const user = (seq, ...content) => ({ type: 'user/message', seq, data: { source: { kind: 'user' }, content } });
const session = (id, createdAt, events, cwd = project, origin) => ({
  header: { id, cwd, createdAt, origin }, live: false, events,
});

async function mount(t, sessions = []) {
  let route;
  const reads = [];
  const titleReads = [];
  const services = {
    sessionQuery: {
      listSessions: async () => sessions.map(({ header, live }) => ({ header, live })),
      readSession: async (id) => {
        reads.push(id);
        const entry = sessions.find(({ header }) => header.id === id);
        if (!entry?.events) throw new Error('unreadable fixture');
        return { session: entry.header, events: entry.events };
      },
      readTitleSnapshots: async (ids) => {
        titleReads.push(ids);
        return ids.map((sessionId) => ({ status: 'fulfilled', sessionId, value: { title: { title: 'Title ' + sessionId } } }));
      },
    },
    workspaceRegistry: {
      archivedSessionIds: ['archived'],
      list: () => [{ id: 'project', title: 'Project', path: project }],
    },
  };
  apply({ get: (key) => services[key], webServer: { register: (value) => { route = value; } } });
  assert.equal(route.path, '/dsh-find');
  const server = createServer(route.handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  }));
  const url = 'http://127.0.0.1:' + server.address().port;
  const request = (path = '', headers, method = 'GET') => new Promise((resolve, reject) => {
    httpRequest(url + prefix + path, { headers, method, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks) }));
      res.on('error', reject);
    }).on('error', reject).end();
  });
  return { url, request, reads, titleReads, server };
}

async function json(request, path) {
  const { status, body } = await request(path);
  assert.equal(status, 200);
  return JSON.parse(body);
}

test('aggregate stat pool deduplicates across sessions and keeps session and item order', { timeout: 5000 }, async (t) => {
  const shared = file('shared.mp4');
  const missing = file('missing.png');
  const restricted = file('restricted.png');
  const directory = file('directory.png');
  const oversized = file('oversized.mp4');
  const clips = Array.from({ length: 12 }, (_, i) => file('clip-' + i + '.mp4'));
  const { request, reads, titleReads } = await mount(t, [
    session('old', 1, [assistant(1, text(shared, ...clips.slice(0, 6), missing, directory))]),
    session('archived', 9, [user(3, text(shared))]),
    session('other-workspace', 8, [assistant(2, text(shared))], 'E:/other-fixture'),
    session('new', 2, [
      assistant(10, text('E:////media-fixture////shared.mp4'), image('original.png'), text(...clips.slice(6), shared, oversized)),
      user(11, image('alias.png'), text(shared, shared, missing, restricted)),
    ]),
    session('empty', 3, [assistant(1, text(missing, restricted, directory, oversized))]),
    session('unreadable', 4, null),
    session('subagent', 5, [assistant(1, text(file('subagent.mp4')))], project, 'subagent'),
  ]);
  const calls = new Map();
  const completed = [];
  let active = 0;
  let peak = 0;
  let releaseShared;
  const waitForLaterCompletion = new Promise((resolve) => { releaseShared = resolve; });
  const syncStat = t.mock.method(fs, 'statSync', () => { throw new Error('unexpected synchronous stat'); });
  t.mock.method(fs.promises, 'stat', async (path) => {
    calls.set(path, (calls.get(path) ?? 0) + 1);
    peak = Math.max(peak, ++active);
    try {
      if (path === shared) await waitForLaterCompletion;
      else await setImmediate();
      if (path === missing || path === restricted) throw Object.assign(new Error('unavailable'), {
        code: path === missing ? 'ENOENT' : 'EACCES',
      });
      return { isFile: () => path !== directory, size: path === oversized ? 600 * 1024 * 1024 + 1 : 17 };
    } finally {
      --active;
      completed.push(path);
      if (path === clips[0]) releaseShared();
    }
  });
  const payload = await json(request);
  assert.equal(syncStat.mock.callCount(), 0);
  assert.equal(peak, 6);
  assert.ok(completed.indexOf(clips[0]) < completed.indexOf(shared));
  assert.deepEqual([...calls].sort(), [shared, missing, restricted, directory, oversized, ...clips]
    .map((path) => [path, 1]).sort());
  assert.equal(payload.sessionsScanned, 6);
  assert.equal(payload.sessionsMatched, 4);
  assert.equal(payload.truncated, false);
  assert.deepEqual(payload.counts, { user: 3, assistant: 14, image: 1, video: 16 });
  assert.deepEqual(reads, ['old', 'archived', 'other-workspace', 'new', 'empty', 'unreadable']);
  assert.deepEqual(titleReads, [['old', 'archived', 'other-workspace', 'new']]);
  assert.deepEqual(payload.items.map(({ sessionId, id }) => [sessionId, id]), [
    ['new', 'file:' + shared], ['new', 'att:' + hex], ...clips.slice(6).map((path) => ['new', 'file:' + path]),
    ['old', 'file:' + shared], ...clips.slice(0, 6).map((path) => ['old', 'file:' + path]),
    ['other-workspace', 'file:' + shared], ['archived', 'file:' + shared],
  ]);
  const [first, attachment] = payload.items;
  assert.deepEqual([first.path, first.speaker, first.seq, first.type, first.bytes, first.title, first.url],
    [shared, 'user', 10, 'assistant/message', 17, 'Title new', prefix + '/file?path=' + encodeURIComponent(shared)]);
  assert.deepEqual([attachment.name, attachment.speaker, attachment.seq, attachment.bytes], ['original.png', 'user', 10, 4]);
  assert.equal(payload.items.find(({ sessionId }) => sessionId === 'old').speaker, 'assistant');
  assert.equal(payload.items.at(-1).archived, true);

  const limited = await json(request, '?total=1');
  assert.deepEqual(limited.items, [first]);
  assert.equal(limited.sessionsMatched, 4);
  assert.equal(limited.truncated, true);
  assert.ok([...calls.values()].every((count) => count === 2), 'each request checks availability anew');
});

test('session media stats each unique path once and retains first mentions and missing-file rules', { timeout: 5000 }, async (t) => {
  const zero = file('zero.mp4');
  const missing = file('gone.gif');
  const { request, reads } = await mount(t, [session('one', 1, [
    assistant(12, text(zero, missing, zero), image('first.png')),
    user(13, text(missing, zero), image('later.png')),
  ])]);
  const stat = t.mock.method(fs.promises, 'stat', async (path) => {
    if (path === missing) throw Object.assign(new Error('gone'), { code: 'ENOENT' });
    return { isFile: () => true, size: 0 };
  });
  const payload = await json(request, '/session?id=one');
  assert.deepEqual(reads, ['one']);
  assert.deepEqual(stat.mock.calls.map(({ arguments: args }) => args), [[zero], [missing]]);
  assert.deepEqual(payload.items.map(({ id, speaker, seq, bytes }) => [id, speaker, seq, bytes]), [
    ['file:' + zero, 'user', 12, 0], ['att:' + hex, 'user', 12, 4],
  ]);
  assert.deepEqual(payload.counts, { user: 2, assistant: 0, image: 1, video: 1 });
  const unreadable = await request('/session?id=absent');
  assert.equal(unreadable.status, 500);
  assert.equal(JSON.parse(unreadable.body).error, 'media-session-failed');
});

test('a disconnected aggregate request does not schedule further stats or titles', { timeout: 5000 }, async (t) => {
  const paths = Array.from({ length: 10 }, (_, i) => file('queued-' + i + '.mp4'));
  const { url, server, titleReads } = await mount(t, [session('one', 1, [assistant(1, text(...paths))])]);
  let started;
  const poolStarted = new Promise((resolve) => { started = resolve; });
  const pending = [];
  const stat = t.mock.method(fs.promises, 'stat', () => new Promise((resolve) => {
    pending.push(resolve);
    if (pending.length === 6) started();
  }));
  let serverResponse;
  const closed = new Promise((resolve) => {
    server.once('request', (_req, res) => {
      serverResponse = res;
      res.once('close', resolve);
    });
  });
  const req = httpRequest(url + prefix, { agent: false });
  req.on('error', () => {}); // Destroying before headers produces a client-side hangup.
  req.end();
  await poolStarted;
  req.destroy();
  await closed;
  for (const finish of pending) finish({ isFile: () => true, size: 10 });
  await setImmediate();
  assert.deepEqual(stat.mock.calls.map(({ arguments: args }) => args[0]), paths.slice(0, 6));
  assert.deepEqual(titleReads, []);
  assert.equal(serverResponse.headersSent, false);
});

async function tempDir(t) {
  const dir = await fs.promises.mkdtemp(join(tmpdir(), 'dsh-find-media-test-'));
  t.after(() => fs.promises.rm(dir, { recursive: true, force: true }));
  return dir;
}

const previewPath = (target) => '/file?path=' + encodeURIComponent(target);

function checkPartial(response, type, data, start, end) {
  assert.equal(response.status, 206);
  assert.equal(response.headers['content-type'], type);
  assert.equal(response.headers['content-length'], String(end - start + 1));
  assert.equal(response.headers['content-range'], 'bytes ' + start + '-' + end + '/' + data.length);
  assert.equal(response.headers['accept-ranges'], 'bytes');
  assert.equal(response.headers['cache-control'], 'private, max-age=600');
  assert.deepEqual(response.body, data.subarray(start, end + 1));
}

test('file preview serves unchanged full content and single closed, open-ended and suffix ranges', { timeout: 5000 }, async (t) => {
  const dir = await tempDir(t);
  const target = join(dir, 'fixture.mp4');
  const data = Buffer.from('0123456789');
  await fs.promises.writeFile(target, data);
  const { request } = await mount(t);
  const path = previewPath(target);
  const full = await request(path);
  assert.equal(full.status, 200);
  assert.equal(full.headers['content-type'], 'video/mp4');
  assert.equal(full.headers['content-length'], '10');
  assert.equal(full.headers['cache-control'], 'private, max-age=600');
  assert.equal(full.headers['accept-ranges'], 'bytes');
  assert.equal(full.headers['content-range'], undefined);
  assert.deepEqual(full.body, data);
  for (const [range, start, end] of [
    ['bytes=0-0', 0, 0], ['bytes=2-5', 2, 5], ['bytes=7-', 7, 9], ['bytes=-3', 7, 9], ['Bytes=-500', 0, 9],
    ['bytes=7-99999999999999999999999999999', 7, 9],
  ]) checkPartial(await request(path, { range }), 'video/mp4', data, start, end);
  for (const range of ['bytes=10-', 'bytes=7-6', 'bytes=-0', 'bytes=-', 'bytes=x-y', 'bytes=0-1,5-9', 'bytes=99999999999999999999999-']) {
    const response = await request(path, { range });
    assert.equal(response.status, 416, range);
    assert.equal(response.headers['accept-ranges'], 'bytes');
    assert.equal(response.headers['content-range'], 'bytes */10');
    assert.equal(response.headers['content-length'], '0');
    assert.equal(response.body.length, 0);
  }
  assert.deepEqual((await request(path, { range: 'other=0-1' })).body, data);
  const ifRange = await request(path, { range: 'bytes=0-1', 'if-range': '"unknown"' });
  assert.equal(ifRange.status, 200);
  assert.deepEqual(ifRange.body, data);
  const head = await request(path, { range: 'bytes=2-5' }, 'HEAD');
  assert.equal(head.status, 200);
  assert.equal(head.headers['content-length'], '10');
  assert.equal(head.body.length, 0);

  const empty = join(dir, 'empty.mp4');
  await fs.promises.writeFile(empty, '');
  const fullEmpty = await request(previewPath(empty));
  assert.equal(fullEmpty.status, 200);
  assert.equal(fullEmpty.headers['content-length'], '0');
  assert.equal(fullEmpty.body.length, 0);
  const emptyRange = await request(previewPath(empty), { range: 'bytes=0-' });
  assert.equal(emptyRange.status, 416);
  assert.equal(emptyRange.headers['content-range'], 'bytes */0');
  assert.equal((await request(previewPath(join(dir, 'missing.mp4')), { range: 'bytes=0-' })).status, 404);
  assert.equal((await request(previewPath(join(dir, 'unsupported.txt')), { range: 'bytes=0-' })).status, 415);

  const stat = t.mock.method(fs.promises, 'stat', async () => ({ isFile: () => true, size: 600 * 1024 * 1024 + 1 }));
  const oversized = await request(path, { range: 'bytes=0-0' });
  assert.equal(oversized.status, 413);
  assert.equal(JSON.parse(oversized.body).error, 'too-large');
  assert.equal(stat.mock.callCount(), 1);
});

test('attachment preview sniffs the original bytes even when its served range excludes the signature', { timeout: 5000 }, async (t) => {
  const dir = await tempDir(t);
  const prior = process.env.DSH_HOME;
  process.env.DSH_HOME = dir;
  t.after(() => {
    if (prior === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = prior;
  });
  const bucket = join(dir, 'attachments', 'v1', 'objects', 'aa');
  await fs.promises.mkdir(bucket, { recursive: true });
  const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 13, 10, 26, 10, 1, 2, 3, 4]);
  await fs.promises.writeFile(join(bucket, hex), data);
  const { request } = await mount(t, [session('one', 1, [user(1, image('valid.png'))])]);
  const listed = (await json(request, '/session?id=one')).items[0];
  const path = listed.url.slice(prefix.length);
  const full = await request(path);
  assert.equal(full.status, 200);
  assert.equal(full.headers['content-type'], 'image/png');
  assert.deepEqual(full.body, data);
  checkPartial(await request(path, { range: 'bytes=-2' }), 'image/png', data, 10, 11);
  assert.equal((await request('/attachment?sha=invalid', { range: 'bytes=0-' })).status, 400);
  assert.equal((await request('/attachment?sha=' + 'b'.repeat(64), { range: 'bytes=0-' })).status, 404);
});

test('disconnecting from a partial response destroys its still-open source stream', { timeout: 5000 }, async (t) => {
  const dir = await tempDir(t);
  const target = join(dir, 'in-flight.mp4');
  await fs.promises.writeFile(target, Buffer.alloc(64));
  const { url } = await mount(t);
  let didRead = false;
  const source = new Readable({
    read() {
      if (didRead) return;
      didRead = true;
      this.push(Buffer.alloc(4));
      // Keep the response open until the client disconnects, never emit EOF.
    },
  });
  const createStream = t.mock.method(fs, 'createReadStream', () => source);
  const closed = new Promise((resolve) => source.once('close', resolve));
  const partial = await new Promise((resolve, reject) => {
    httpRequest(url + prefix + previewPath(target), { headers: { range: 'bytes=4-31' }, agent: false }, (res) => {
      res.on('error', reject);
      res.once('data', (chunk) => {
        resolve({ status: res.statusCode, bytes: chunk.length });
        res.destroy();
      });
    }).on('error', reject).end();
  });
  await closed;
  assert.deepEqual(partial, { status: 206, bytes: 4 });
  assert.equal(source.destroyed, true);
  assert.deepEqual(createStream.mock.calls.map(({ arguments: args }) => args), [[target, { start: 4, end: 31 }]]);
});
