import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { syncBuiltinESMExports } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import test from 'node:test';
import { apply } from './index.js';

const home = 'E:/project';
const missingPath = 'E:/dsh-find-test-missing-95cfe486e9/file.docx';
const firstHash = 'a'.repeat(64);
const secondHash = 'b'.repeat(64);
const attachment = (type, name, hex, mediaType) => ({ type, attachment: { name, attachmentId: 'sha256:' + hex, mediaType } });
const presented = (...paths) => ({ type: 'deliverables/presented', data: { files: paths.map((path) => ({ path })) } });

function mount(events, attachments) {
  let route;
  const reads = [];
  const header = { id: 'session', cwd: home, createdAt: 1 };
  const services = {
    attachments,
    sessionQuery: {
      listSessions: async () => [{ header, live: false }],
      readSession: async (id) => {
        reads.push(id);
        if (id !== header.id) throw new Error('unreadable');
        return { session: header, events };
      },
      readTitleSnapshots: async () => [{ status: 'fulfilled', sessionId: header.id, value: { title: { title: 'Conversation' } } }],
    },
    workspaceRegistry: {
      archivedSessionIds: ['session'],
      list: () => [{ id: 'project', path: home, title: 'Project' }],
    },
  };
  apply({ get: (key) => services[key], webServer: { register: (value) => { route = value; } } });
  const request = (path, method = 'GET', headers = {}) => new Promise((resolve) => {
    const res = new EventEmitter();
    res.writeHead = (status) => { res.statusCode = status; };
    res.end = (body) => resolve({ status: res.statusCode, body: JSON.parse(body) });
    route.handler({ url: '/dsh-find/files/' + path, method, headers }, res);
  });
  return { request, reads };
}

test('file tree returns workspace/session metadata without reading conversation contents', async () => {
  const { request, reads } = mount([]);
  const tree = await request('tree');
  assert.equal(tree.status, 200);
  const group = tree.body.workspaces[0];
  assert.equal(group.workspaceTitle, 'Project');
  assert.equal(group.sessions[0].title, 'Conversation');
  assert.equal(group.sessions[0].archived, true);
  assert.deepEqual(reads, []);
  assert.deepEqual(await request('session?id=session'), { status: 200, body: { items: [], truncated: false } });
  assert.deepEqual(reads, ['session']);
});

test('file session returns actual user uploads and AI output records, including media', async () => {
  const { request } = mount([
    { type: 'user/message', data: { source: { kind: 'user' }, content: [
      attachment('file', 'user.zip', firstHash), attachment('file', 'alias.zip', firstHash),
      attachment('file', 'user.zip', firstHash), attachment('image', 'user.unknown', secondHash),
      attachment('file', 'uploaded.noext', 'c'.repeat(64), 'video/mp4'),
      { type: 'text', text: 'See E:/out/mention.pdf' },
    ] } },
    { type: 'user/message', data: { source: { kind: 'system' }, content: [attachment('file', 'system.zip', 'd'.repeat(64))] } },
    { type: 'assistant/message', data: { message: { content: [{ type: 'text', text: '/out/unverified.mp4' },
      attachment('image', 'user.unknown', secondHash), attachment('image', 'output.png', 'e'.repeat(64))] } } },
    { type: 'tool/call', data: { name: 'write', callId: 'create' } },
    { type: 'tool/result', data: { message: { toolCallId: 'create' }, meta: { operation: 'create', path: 'E:/out/Draft.docx' } } },
    { type: 'tool/call', data: { name: 'write', callId: 'update' } },
    { type: 'tool/result', data: { message: { toolCallId: 'update' }, meta: { operation: 'update', path: 'E:/out/update.docx' } } },
    { type: 'tool/ptc-dispatch', data: { name: 'write', isError: false, meta: { operation: 'create', path: '/out/nested.txt' } } },
    { type: 'tool/ptc-dispatch', data: { name: 'write', isError: true, meta: { operation: 'create', path: '/out/failed.txt' } } },
    presented('e:/out/draft.docx', '/out/final.MP4', '/out/first/same.pdf', '/out/second/same.pdf', '/out/relative/from/root', 'skip.txt'),
  ]);
  const { status, body } = await request('session?id=session');
  assert.equal(status, 200);
  assert.equal(body.truncated, false);
  assert.deepEqual(body.items.map(({ name, speaker, kind }) => [name, speaker, kind]), [
    ['alias.zip', 'user', 'file'], ['draft.docx', 'assistant', 'file'], ['final.MP4', 'assistant', 'video'],
    ['nested.txt', 'assistant', 'file'],
    ['output.png', 'assistant', 'image'], ['root', 'assistant', 'file'], ['same.pdf', 'assistant', 'file'],
    ['same.pdf', 'assistant', 'file'], ['uploaded.noext', 'user', 'video'], ['user.unknown', 'user', 'image'], ['user.zip', 'user', 'file'],
  ]);
  assert.ok(body.items.every((item) => /^[0-9a-f]{64}$/.test(item.id) && !('path' in item)));
  assert.equal(new Set(body.items.map((item) => item.id)).size, body.items.length);
});

test('known generation tools contribute results, while read tools and failures do not', async () => {
  const { request } = mount([
    { type: 'tool/call', data: { name: 'draw_image', callId: 'draw' } },
    { type: 'tool/result', data: { meta: { path: '/out/drawn.png' }, message: { toolCallId: 'draw',
      content: [attachment('image', 'preview.png', firstHash)] } } },
    { type: 'tool/ptc-dispatch', data: { name: 'video_storyboard', isError: false,
      content: [attachment('image', 'sheet.png', secondHash)] } },
    { type: 'tool/ptc-dispatch', data: { name: 'read_image', isError: false,
      content: [attachment('image', 'read.png', firstHash)] } },
    { type: 'tool/ptc-dispatch', data: { name: 'draw_image', isError: true, meta: { path: '/out/failed.png' } } },
    presented('/out/drawn.png'),
  ]);
  const { body } = await request('session?id=session');
  assert.deepEqual(body.items.map(({ name, speaker, kind }) => [name, speaker, kind]), [
    ['drawn.png', 'assistant', 'image'], ['sheet.png', 'assistant', 'image'],
  ]);
});

test('file reveal requires POST and only accepts issued IDs, not client paths', async () => {
  const { request } = mount([presented(missingPath)]);
  assert.equal((await request('reveal?id=anything')).status, 405);
  assert.equal((await request('reveal?id=' + encodeURIComponent(missingPath), 'POST')).status, 404);
  assert.equal((await request('reveal?id=' + '0'.repeat(64), 'POST')).body.error, 'unknown-file');
  assert.equal((await request('session')).status, 400);
  assert.equal((await request('session?id=unknown')).body.error, 'files-session-failed');
  const item = (await request('session?id=session')).body.items[0];
  if (process.platform === 'win32') {
    assert.equal(item.canReveal, true);
    assert.deepEqual(await request('reveal?id=' + item.id, 'POST'), { status: 404, body: { error: 'not-found' } });
  } else assert.equal(item.canReveal, false);
  assert.equal((await request('reveal?id=' + item.id, 'POST', { 'sec-fetch-site': 'cross-site' })).status, 403);
});

test('Windows reveal selects ordinary files and opens attachment directories', { skip: process.platform !== 'win32' }, async (t) => {
  const root = await mkdtemp(join(tmpdir(), 'dsh-find-reveal-'));
  const attachmentDir = join(root, '附件,=');
  const report = join(root, 'AI 报告, v=1.txt');
  const upload = join(attachmentDir, 'user.pdf');
  await mkdir(attachmentDir);
  await Promise.all([writeFile(report, ''), writeFile(upload, '')]);
  const commands = [];
  const mock = t.mock.method(childProcess, 'spawn', (command, args) => {
    commands.push([command, args]);
    const child = new EventEmitter();
    child.unref = () => {};
    queueMicrotask(() => child.emit('spawn'));
    return child;
  });
  syncBuiltinESMExports();
  try {
    const { request } = mount([
      presented(report),
      { type: 'user/message', data: { source: { kind: 'user' }, content: [attachment('file', 'user.pdf', firstHash)] } },
    ], { fileHostPath: () => upload });
    const { body } = await request('session?id=session');
    for (const item of body.items) {
      assert.equal(item.canReveal, true);
      assert.deepEqual(await request('reveal?id=' + item.id, 'POST'), { status: 200, body: { ok: true } });
    }
    const rootUrl = pathToFileURL(root + '/').href;
    assert.deepEqual(commands, [
      ['explorer.exe', ['/select,' + rootUrl + 'AI%20报告%2C%20v%3D1.txt']],
      ['explorer.exe', [rootUrl + '附件%2C%3D']],
    ]);
  } finally {
    mock.mock.restore();
    syncBuiltinESMExports();
    await rm(root, { recursive: true });
  }
});
