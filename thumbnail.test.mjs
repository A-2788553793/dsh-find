import assert from 'node:assert/strict';
import cp from 'node:child_process';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { syncBuiltinESMExports } from 'node:module';
import os from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { deflateSync } from 'node:zlib';
import { apply } from './index.js';

const prefix = '/dsh-find/media';
const pngSignature = Buffer.from('89504e470d0a1a0a', 'hex');
function pngChunk(kind, data) {
  const bytes = Buffer.concat([Buffer.from(kind), data]);
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  const header = Buffer.alloc(4);
  header.writeUInt32BE(data.length);
  const footer = Buffer.alloc(4);
  footer.writeUInt32BE(~crc >>> 0);
  return Buffer.concat([header, bytes, footer]);
}

function png(width, height, red, alpha) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const pixels = Buffer.alloc((1 + 4 * width) * height);
  for (let y = 0; y < height; y++) pixels.fill(Buffer.from([red, 0, 0, alpha]), y * (1 + 4 * width) + 1, (y + 1) * (1 + 4 * width));
  return Buffer.concat([pngSignature, pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(pixels)), pngChunk('IEND', Buffer.alloc(0))]);
}

async function mount(t) {
  const home = await fs.promises.mkdtemp(join(os.tmpdir(), 'dsh-thumbnail-'));
  const oldHome = process.env.DSH_HOME;
  const oldPath = process.env.PATH;
  process.env.DSH_HOME = home;
  t.after(async () => {
    if (oldHome === undefined) delete process.env.DSH_HOME;
    else process.env.DSH_HOME = oldHome;
    if (oldPath === undefined) delete process.env.PATH;
    else process.env.PATH = oldPath;
    await fs.promises.rm(home, { recursive: true, force: true });
  });
  const content = [];
  const input = async (key, bytes, mediaType = 'image/png') => {
    const hex = key.toString(16).padStart(64, '0');
    const id = 'att:' + hex;
    const dir = join(home, 'attachments', 'v1', 'objects', hex.slice(0, 2));
    const target = join(dir, hex);
    await fs.promises.mkdir(dir, { recursive: true });
    if (bytes !== undefined) await fs.promises.writeFile(target, bytes);
    content.push({ type: 'image', attachment: { attachmentId: hex, mediaType } });
    return { id, target };
  };
  let route;
  const sessionQuery = {
    readSession: async () => ({ events: [{ type: 'user/message', seq: 1, data: { content } }] }),
    readTitleSnapshots: async () => [],
  };
  apply({ get: (key) => key === 'sessionQuery' ? sessionQuery : undefined,
    webServer: { register: (value) => { route = value; } } });
  const server = createServer(route.handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const req = (path, options) => fetch('http://127.0.0.1:' + server.address().port + prefix + path, options);
  const thumb = (id, extra = '', options) => req('/thumbnail?id=' + encodeURIComponent(id) + extra, options);
  const show = async () => {
    const result = await req('/session?id=synthetic');
    assert.equal(result.status, 200);
    return (await result.json()).items;
  };
  return { home, content, input, req, thumb, show };
}

async function expectError(response, status, code) {
  assert.equal(response.status, status);
  assert.ok(response.headers.get('content-type').startsWith('application/json'));
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.deepEqual(await response.json(), { error: code });
}

function ffmpeg(args, input) {
  return cp.spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', ...args], {
    input, windowsHide: true, timeout: 5000, maxBuffer: 2 * 1024 * 1024,
  });
}

async function expectPng(response, width, height) {
  assert.equal(response.status, 200, response.ok ? '' : await response.clone().text());
  assert.equal(response.headers.get('content-type'), 'image/png');
  assert.equal(response.headers.get('cache-control'), 'no-store');
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(Number(response.headers.get('content-length')), bytes.length);
  assert.ok(bytes.length <= 512 * 1024);
  assert.deepEqual(bytes.subarray(0, 8), pngSignature);
  assert.equal(bytes.readUInt32BE(16), width);
  assert.equal(bytes.readUInt32BE(20), height);
  assert.equal(bytes[25], 6, 'RGBA PNG');
  return bytes;
}

test('thumbnail authorizes only displayed images and fails closed without FFmpeg', { timeout: 15000 }, async (t) => {
  const { input, req, thumb, show } = await mount(t);
  const source = await input(1, png(16, 16, 255, 100));
  const video = await input(2, png(16, 16, 255, 100), 'video/mp4');
  const missing = await input(3);
  const indirect = await input(4, Buffer.from('ffconcat version 1.0\nfile ' + source.target));
  const oversized = await input(5, Buffer.alloc(0));
  await fs.promises.truncate(oversized.target, 24 * 1024 * 1024 + 1);
  await expectError(await thumb(source.id), 404, 'unknown-media');
  await expectError(await req('/thumbnail?path=' + encodeURIComponent(source.target)), 400, 'bad-id');
  assert.equal((await show()).length, 5);
  await expectError(await thumb(source.id, '&path=' + encodeURIComponent(source.target)), 400, 'bad-id');
  await expectError(await thumb(source.id, '&id=' + encodeURIComponent(source.id)), 400, 'bad-id');
  const wrongMethod = await thumb(source.id, '', { method: 'POST' });
  assert.equal(wrongMethod.headers.get('allow'), 'GET');
  await expectError(wrongMethod, 405, 'method-not-allowed');
  await expectError(await thumb(video.id), 415, 'unsupported-image');
  await expectError(await thumb(missing.id), 404, 'not-found');
  await expectError(await thumb(indirect.id), 415, 'unsupported-image');
  await expectError(await thumb(oversized.id), 413, 'thumbnail-source-too-large');
  process.env.PATH = '';
  await expectError(await thumb(source.id), 503, 'thumbnail-decoder-unavailable');
});

test('real PNG output scales, retains alpha, merges requests and invalidates on replacement', { timeout: 20000 }, async (t) => {
  if (ffmpeg(['-version']).status !== 0) return t.skip('FFmpeg not on PATH');
  const { home, input, show, thumb, content } = await mount(t);
  const original = png(640, 400, 255, 100);
  const source = await input(10, original);
  const broken = await input(11, pngSignature);
  const tall = await input(12, png(1, 640, 255, 100));
  const overPixels = await input(13, png(4200, 4000, 255, 100));
  const pathTarget = join(home, 'indexed image.png');
  const canListPath = process.platform === 'win32' && !/\s/.test(home);
  if (canListPath) {
    const target = pathTarget.replace('indexed image.png', 'indexed.png');
    await fs.promises.writeFile(target, original);
    content.push({ type: 'text', text: target.replace(/\\/g, '/') });
  }
  const items = await show();
  const spawn = cp.spawn;
  const decoder = t.mock.method(cp, 'spawn', (...args) => spawn(...args));
  syncBuiltinESMExports();
  t.after(() => { decoder.mock.restore(); syncBuiltinESMExports(); });
  const results = await Promise.all(Array.from({ length: 8 }, () => thumb(source.id)));
  const [first, ...rest] = await Promise.all(results.map((response) => expectPng(response, 320, 200)));
  for (const bytes of rest) assert.deepEqual(bytes, first);
  assert.equal(decoder.mock.callCount(), 1);
  assert.notDeepEqual(first, original);
  const decoded = ffmpeg(['-f', 'png_pipe', '-i', 'pipe:0', '-frames:v', '1', '-pix_fmt', 'rgba', '-f', 'rawvideo', 'pipe:1'], first);
  assert.equal(decoded.status, 0, decoded.stderr.toString());
  assert.deepEqual([...decoded.stdout.subarray(0, 4)], [255, 0, 0, 100]);
  await expectPng(await thumb(source.id), 320, 200);
  assert.equal(decoder.mock.callCount(), 1, 'cache hit did not launch FFmpeg');
  await fs.promises.writeFile(source.target, png(640, 400, 0, 100));
  assert.notDeepEqual(await expectPng(await thumb(source.id), 320, 200), first);
  assert.equal(decoder.mock.callCount(), 2);
  await fs.promises.unlink(source.target);
  await expectError(await thumb(source.id), 404, 'not-found');
  await expectError(await thumb(broken.id), 422, 'thumbnail-decode-failed');
  await expectError(await thumb(overPixels.id), 422, 'thumbnail-decode-failed');
  await expectPng(await thumb(tall.id), 1, 320);
  if (canListPath) {
    const item = items.find(({ source }) => source === 'file');
    assert.ok(item);
    await expectPng(await thumb(item.id), 320, 200);
  }
});

test('distinct IDs share two active slots and a bounded waiting queue', { timeout: 10000 }, async (t) => {
  const { input, show, thumb } = await mount(t);
  const images = await Promise.all(Array.from({ length: 27 }, (_, i) => input(30 + i, Buffer.from('not an image'))));
  await show();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const realStat = fs.promises.lstat;
  let peak = 0;
  let active = 0;
  t.mock.method(fs.promises, 'lstat', async (...args) => {
    peak = Math.max(peak, ++active);
    try {
      await gate;
      return await realStat(...args);
    } finally {
      active -= 1;
    }
  });
  const requests = images.map(({ id }) => thumb(id));
  try {
    await expectError(await Promise.race(requests), 503, 'thumbnail-busy');
    assert.equal(peak, 2);
  } finally {
    release();
  }
  const results = await Promise.all(requests);
  assert.equal(results.filter((response) => response.status === 503).length, 1);
  assert.equal(results.filter((response) => response.status === 415).length, 26);
  assert.equal(peak, 2);
});

test('supports static JPEG, WebP, GIF and BMP as actual PNG thumbnails', { timeout: 20000 }, async (t) => {
  if (ffmpeg(['-version']).status !== 0) return t.skip('FFmpeg not on PATH');
  const { input, show, thumb } = await mount(t);
  const source = png(640, 400, 220, 100);
  const inputs = [];
  for (const [i, codec, format, mime] of [
    [20, 'mjpeg', 'image2pipe', 'image/jpeg'], [21, 'libwebp', 'webp', 'image/webp'],
    [22, 'gif', 'gif', 'image/gif'], [23, 'bmp', 'image2pipe', 'image/bmp'],
  ]) {
    const fixture = ffmpeg(['-f', 'png_pipe', '-i', 'pipe:0', '-frames:v', '1', '-threads', '1', '-c:v', codec, '-f', format, 'pipe:1'], source);
    if (fixture.status !== 0 && codec === 'libwebp' && /Unknown encoder|not found/i.test(fixture.stderr.toString())) {
      t.diagnostic('Skipping WebP fixture generation because this FFmpeg lacks libwebp');
      continue;
    }
    assert.equal(fixture.status, 0, fixture.stderr.toString());
    inputs.push(await input(i, fixture.stdout, mime));
  }
  await show();
  for (const { id } of inputs) await expectPng(await thumb(id), 320, 200);
});
