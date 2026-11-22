import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { apply } from './index.js';

function defaultFilters() {
  return {
    text: { hideArchived: false, speakers: { user: true, assistant: true, tool: true, system: true } },
    media: { hideArchived: false, speakers: { user: true, assistant: true } },
    files: { hideArchived: false, hideMedia: false, speakers: { user: true, assistant: true } },
  };
}

function mount(applyPlugin = apply) {
  let route;
  applyPlugin({ get: () => undefined, webServer: { register: (value) => { route = value; } } });
  return (method = 'GET', body, raw = false) => new Promise((resolve) => {
    const req = new EventEmitter();
    req.url = '/dsh-find/settings';
    req.method = method;
    const res = new EventEmitter();
    res.writeHead = (status) => { res.statusCode = status; };
    res.end = (text) => resolve({ status: res.statusCode, body: JSON.parse(text) });
    route.handler(req, res);
    if (method === 'POST') {
      req.emit('data', Buffer.from(raw ? body : JSON.stringify(body)));
      req.emit('end');
    }
  });
}

async function fixture(t) {
  const home = await mkdtemp(join(tmpdir(), 'dsh-find-settings-'));
  const oldHome = process.env.DSH_HOME;
  process.env.DSH_HOME = home;
  t.after(async () => {
    if (oldHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = oldHome;
    await rm(home, { recursive: true, force: true });
  });
  return { file: join(home, 'storages', 'dsh-find', 'settings.json'), request: mount() };
}

test('GET always advertises normalized filters without writing defaults', async (t) => {
  const { file, request } = await fixture(t);
  assert.deepEqual(await request(), {
    status: 200, body: { ok: true, saved: false, theme: 'auto', filters: defaultFilters() },
  });
  await assert.rejects(readFile(file), { code: 'ENOENT' });
});

test('filters persist in the existing file and survive a fresh module load', async (t) => {
  const { file, request } = await fixture(t);
  const filters = defaultFilters();
  filters.text = { hideArchived: true, speakers: { user: false, assistant: false, tool: false, system: false } };
  filters.media.speakers.assistant = false;
  filters.files.hideArchived = true;
  filters.files.speakers.user = false;
  filters.files.hideMedia = true;
  assert.deepEqual(await request('POST', { filters }), { status: 200, body: { ok: true, theme: 'auto', filters } });
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { theme: 'auto', filters });
  const fresh = await import('./index.js?settings-persistence-test');
  assert.deepEqual(await mount(fresh.apply)(), { status: 200, body: { ok: true, saved: true, theme: 'auto', filters } });
});

test('partial updates merge tabs and speakers independently and preserve theme', async (t) => {
  const { request } = await fixture(t);
  await request('POST', { theme: 'dark' });
  const filters = defaultFilters();
  filters.text.hideArchived = true;
  filters.text.speakers.user = false;
  filters.text.speakers.tool = false;
  assert.deepEqual((await request('POST', { filters: { text: { hideArchived: true, speakers: { user: false, tool: false } } } })).body,
    { ok: true, theme: 'dark', filters });
  filters.media.speakers.user = false;
  filters.files.hideArchived = true;
  assert.deepEqual((await request('POST', { filters: { media: { speakers: { user: false } }, files: { hideArchived: true } } })).body,
    { ok: true, theme: 'dark', filters });
  filters.text.speakers.user = true;
  filters.files.hideArchived = false;
  assert.deepEqual((await request('POST', { theme: 'light', filters: { text: { speakers: { user: true } }, files: { hideArchived: false } } })).body,
    { ok: true, theme: 'light', filters });
  assert.deepEqual((await request('POST', { theme: 'auto' })).body, { ok: true, theme: 'auto', filters });
  assert.deepEqual((await request()).body, { ok: true, saved: true, theme: 'auto', filters });
});

test('invalid filter patches and unknown keys cannot reset or leak into settings', async (t) => {
  const { file, request } = await fixture(t);
  const filters = defaultFilters();
  filters.text.hideArchived = true;
  filters.text.speakers.user = false;
  await request('POST', { theme: 'dark', filters });
  for (const value of [null, [], 0, 'false', {}]) {
    for (const patch of [value, { filters: value }, { filters: { text: value } },
      { filters: { text: { hideArchived: value, speakers: value } } },
      { filters: { text: { speakers: { user: value } } } }]) {
      assert.deepEqual((await request('POST', patch)).body, { ok: true, theme: 'dark', filters });
    }
  }
  const patch = JSON.parse('{"unknown":true,"__proto__":{"polluted":true},"filters":{"other":{"hideArchived":true},"text":{"unknown":false,"speakers":{"other":false}},"media":{"speakers":{"tool":false,"system":false}},"files":{"speakers":{"tool":false}}}}');
  assert.deepEqual((await request('POST', patch)).body, { ok: true, theme: 'dark', filters });
  assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { theme: 'dark', filters });
  assert.equal({}.polluted, undefined);
});

test('legacy and invalid files receive safe defaults without being rewritten by GET', async (t) => {
  const { file, request } = await fixture(t);
  await mkdir(dirname(file), { recursive: true });
  for (const text of ['{', 'null', '[]', 'true', '42', '"invalid"', '{"theme":"invalid","filters":[]}']) {
    await writeFile(file, text);
    assert.deepEqual((await request()).body, { ok: true, saved: true, theme: 'auto', filters: defaultFilters() });
    assert.equal(await readFile(file, 'utf8'), text);
  }
  await writeFile(file, JSON.stringify({ theme: 'light' }));
  assert.deepEqual((await request()).body, { ok: true, saved: true, theme: 'light', filters: defaultFilters() });
  await writeFile(file, JSON.stringify({ theme: 'dark', filters: {
    text: { hideArchived: 'true', speakers: { user: false, assistant: null, tool: 0, system: true } },
    media: null, files: { hideArchived: true, speakers: [] }, unknown: { hideArchived: true },
  } }));
  const filters = defaultFilters();
  filters.text.speakers.user = false;
  filters.files.hideArchived = true;
  assert.deepEqual((await request()).body, { ok: true, saved: true, theme: 'dark', filters });
});

test('malformed and oversized POST bodies return 400 without changing storage', async (t) => {
  const { file, request } = await fixture(t);
  await request('POST', { theme: 'dark', filters: { media: { hideArchived: true } } });
  const before = await readFile(file, 'utf8');
  for (const text of ['{', JSON.stringify({ padding: 'x'.repeat(8193) })]) {
    const result = await request('POST', text, true);
    assert.equal(result.status, 400);
    assert.equal(result.body.error, 'bad-body');
    assert.equal(await readFile(file, 'utf8'), before);
  }
});


test('hideMedia is file-only, merges independently, and persists both boolean values', async (t) => {
  const { file, request } = await fixture(t);
  const filters = defaultFilters();
  filters.text.hideArchived = true;
  filters.files.speakers.assistant = false;
  await request('POST', { theme: 'dark', filters });
  for (const enabled of [true, false]) {
    filters.files.hideMedia = enabled;
    const result = await request('POST', { filters: { files: { hideMedia: enabled }, text: { hideMedia: true }, media: { hideMedia: true } } });
    assert.deepEqual(result.body, { ok: true, theme: 'dark', filters });
    for (const invalid of [null, 'true', 1, {}, []]) {
      assert.deepEqual((await request('POST', { filters: { files: { hideMedia: invalid } } })).body, { ok: true, theme: 'dark', filters });
    }
    await request('POST', { theme: 'dark' });
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { theme: 'dark', filters });
    assert.deepEqual((await mount()()).body.filters, filters);
  }
});
