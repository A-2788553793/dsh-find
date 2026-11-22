import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('./client.js', import.meta.url), 'utf8');
const event = { preventDefault() {}, stopPropagation() {}, clientX: 30, clientY: 30 };
const tree = (...ids) => ({ workspaces: [{ workspaceId: 'workspace', sessions: ids.map((sessionId) => ({ sessionId })) }] });
const item = (sessionId, id) => ({ sessionId, id, name: id, kind: 'image', speaker: 'user', url: '/mock/' + id });
const flush = () => new Promise(setImmediate);

// Mount the actual slot with a small React facade and a fetch that deliberately
// delivers late responses even when aborted, so identity checks are exercised.
function mount({ IntersectionObserver, viewport = {}, storage, settings = false } = {}) {
  const requests = [];
  const fileTimers = new Map();
  const retryTimers = new Map();
  const revoked = [];
  let notifications = 0;
  let timerId = 0;
  let activeFiles = 0;
  let peakFiles = 0;
  const setTimer = (run, delay) => {
    const id = ++timerId;
    if (delay === 16) fileTimers.set(id, run);
    if ([250, 700, 1600].includes(delay)) retryTimers.set(id, run);
    return id;
  };
  const hooks = [];
  const effects = [];
  let hook = 0;
  let palette;
  let settingsSection;
  let plugin;
  let keydown;
  function useMemo(factory, deps) {
    const i = hook++;
    const previous = hooks[i];
    if (previous?.deps.length === deps.length && deps.every((value, index) => Object.is(value, previous.deps[index]))) {
      return previous.value;
    }
    const value = factory();
    hooks[i] = { deps, value };
    return value;
  }
  const react = {
    Fragment: Symbol('Fragment'),
    createElement: (type, props, ...children) => ({ type, props: props || {}, children }),
    useMemo,
    useState(initial) {
      const box = useMemo(() => ({ value: initial }), []);
      return [box.value, (value) => { notifications++; box.value = value; }];
    },
    useEffect(fn, deps) {
      useMemo(() => { effects.push(fn); }, deps);
    },
    useRef: (initial) => useMemo(() => ({ current: initial }), []),
  };
  const fetch = (path, options = {}) => {
    if (path === '/dsh-find/settings' && !settings) return Promise.resolve({ ok: false });
    const url = new URL(path, 'http://test.local');
    return new Promise((resolve, reject) => {
      const key = url.pathname.slice('/dsh-find'.length);
      const isFile = key === '/files/session';
      if (isFile) peakFiles = Math.max(peakFiles, ++activeFiles);
      requests.push({
        key, options, id: url.searchParams.get('id'), signal: options.signal,
        resolve: (value) => { if (isFile) activeFiles--; resolve(value); },
        reject: (error) => { if (isFile) activeFiles--; reject(error); },
      });
    });
  };
  runInNewContext(source, {
    window: { __ModuleLoader__: { load: ({ factory }) => { plugin = factory(() => react); } }, localStorage: storage, innerWidth: 1200, innerHeight: 800, IntersectionObserver, setTimeout: setTimer, ...viewport },
    document: { addEventListener(name, listen) { if (name === 'keydown') keydown = listen; } },
    URL: { createObjectURL: (blob) => 'blob:' + blob.id, revokeObjectURL: (url) => revoked.push(url) },
    navigator: { language: 'en' }, fetch, AbortController, URLSearchParams, console, setTimeout: setTimer, clearTimeout: (id) => { fileTimers.delete(id); retryTimers.delete(id); },
  }, { filename: 'client.js' });
  plugin.apply({
    get() {},
    effect(fn, name) { if (name === 'dsh-find: ctrl+f capture') fn(); },
    slots: { inject: (name, fn) => fn(), register: ({ name }, component) => { if (name === 'shell.overlay') palette = component; if (name === 'settings.section') settingsSection = component; } },
  });
  function render() {
    hook = 0;
    const root = palette();
    for (const fn of effects.splice(0)) fn();
    return root;
  }
  render();
  keydown({ ...event, ctrlKey: true, key: 'f' });
  const find = (select) => nodes(render()).find(select);
  const byClass = (name) => (node) => node.props.className?.split(' ').includes(name);
  const byText = (type, label) => (node) => node.type === type && node.children.includes(label);
  const click = (select) => {
    const node = find(select);
    assert.ok(node, 'expected clickable element');
    assert.notEqual(node.props.disabled, true);
    node.props.onClick(event);
  };
  return {
    render, requests, find, click, byClass, retryTimers, revoked,
    open: () => keydown({ ...event, ctrlKey: true, key: 'f' }),
    settingsPanel() {
      hook = 2000;
      const root = settingsSection();
      for (const fn of effects.splice(0)) fn();
      return root;
    },
    advanceRetries() {
      for (const [id, run] of [...retryTimers]) { retryTimers.delete(id); run(); }
    },
    renderGrid(type, props, index) {
      hook = 1000 + index * 10;
      return type(props);
    },
    filePanel: () => {
      const panel = find((node) => node.type.name === 'FilesPanel');
      return panel.type(panel.props);
    },
    fileMetrics: () => ({ notifications, activeFiles, peakFiles, timers: fileTimers.size }),
    publishFiles: () => {
      for (const [id, run] of [...fileTimers]) {
        fileTimers.delete(id);
        run();
      }
    },
    button: (label) => click(byText('button', label)),
    tab: (label) => click((node) => node.props.role === 'tab' && node.children.includes(label)),
    workspace: () => click(byClass('dsh-find-ws-head')),
    row: (id) => click((node) => byClass('dsh-find-session-row')(node) && node.props.title === id),
    state: (id) => {
      const row = find((node) => byClass('dsh-find-session-row')(node) && node.props.title === id);
      return nodes(row).find(byClass('dsh-find-session-state'))?.props['data-status'];
    },
    take(key, id = null) {
      const index = requests.findIndex((request) => request.key === key && request.id === id);
      assert.notEqual(index, -1, 'missing request: ' + key + ' ' + id);
      return requests.splice(index, 1)[0];
    },
    close: () => keydown({ ...event, key: 'Escape' }),
  };
}

function* walk(node) {
  if (Array.isArray(node)) {
    for (const child of node) yield* walk(child);
  } else if (node && typeof node === 'object') {
    yield node;
    if (node.type.name === 'MediaGrid') return yield* walk(node.type(node.props));
    for (const child of node.children || []) yield* walk(child);
  }
}
const nodes = (root) => [...walk(root)];
async function respond(request, data) {
  request.resolve({ ok: true, json: async () => data });
  await flush();
}
async function startMedia(ui, ...ids) {
  ui.tab('Images/Videos');
  await respond(ui.take('/media/tree'), tree(...ids));
}
async function startBatch(ui) {
  ui.button('Expand all');
  await flush();
  return ui.take('/media');
}

test('only the visible tab derives data and creates text hits; returning preserves order and filters', async () => {
  const ui = mount();
  const hit = (sessionId, channel, speaker, archived = false) => ({
    sessionId, channel, speaker, archived, workspaceTitle: 'Workspace', title: sessionId, seq: 1, snippet: 'keyword ' + sessionId, occurrences: 1,
  });
  const hits = [hit('archived', 'conversation', 'user', true), hit('thinking', 'thinking', 'assistant'), hit('message', 'conversation', 'user')];
  let textReads = 0;
  let mediaReads = 0;
  ui.find(ui.byClass('dsh-find-input')).props.onChange({ target: { value: 'keyword' } });
  ui.button('Find');
  await respond(ui.take('/search'), { get hits() { textReads++; return hits; }, totalHits: 3 });
  const highlights = () => nodes(ui.render()).filter((node) => node.type.name === 'Highlighted');
  assert.equal(filterControls(ui, 'Text').archive.props.checked, true);
  filterControls(ui, 'Text').archive.props.onChange({ target: { checked: false } });
  assert.deepEqual(highlights().map((node) => node.props.text), ['keyword thinking', 'keyword message', 'keyword archived']);
  const renderedHighlight = highlights()[0].type(highlights()[0].props);
  assert.ok(nodes(renderedHighlight).some((node) => node.type === 'mark' && node.children.includes('keyword')));
  ui.click((node) => node.props['data-speaker'] === 'user' && node.type === 'button');
  assert.deepEqual(highlights().map((node) => node.props.text), ['keyword thinking']);
  await startMedia(ui, 'image');
  const batch = await startBatch(ui);
  const media = { ...item('image', 'image.png'), get speaker() { mediaReads++; return 'user'; } };
  await respond(batch, { truncated: false, items: [media] });
  assert.ok(ui.find(ui.byClass('dsh-find-tile')));
  ui.tab('Files');
  textReads = mediaReads = 0;
  await respond(ui.take('/files/tree'), { workspaces: [] });
  assert.equal(highlights().length, 0);
  assert.equal(textReads, 0);
  assert.equal(mediaReads, 0);
  ui.tab('Text');
  assert.deepEqual(highlights().map((node) => node.props.text), ['keyword thinking']);
  textReads = mediaReads = 0;
  ui.close();
  assert.equal(ui.render(), null);
  assert.equal(textReads, 0);
  assert.equal(mediaReads, 0);
});

test('truncated batch shows partial rows, keeps missing rows unread, and both can load fully', async () => {
  const ui = mount();
  await startMedia(ui, 'partial', 'missing', 'complete');
  ui.workspace();
  ui.row('complete');
  await respond(ui.take('/media/session', 'complete'), { items: [item('complete', 'kept.png')] });
  const batch = await startBatch(ui);
  await respond(batch, { truncated: true, items: [item('partial', 'first.png'), item('complete', 'older.png')] });
  assert.equal(ui.state('partial'), 'partial');
  assert.equal(ui.state('missing'), 'idle');
  assert.equal(ui.state('complete'), 'ready');
  assert.ok(ui.find((node) => node.props.title === 'kept.png'));
  assert.equal(ui.find((node) => node.props.title === 'older.png'), undefined);
  ui.row('partial');
  await respond(ui.take('/media/session', 'partial'), { items: [item('partial', 'first.png'), item('partial', 'second.png')] });
  ui.row('missing');
  await respond(ui.take('/media/session', 'missing'), { items: [] });
  assert.equal(ui.state('partial'), 'ready');
  assert.equal(ui.state('missing'), 'ready');
  assert.ok(ui.find((node) => node.props.title === 'second.png'));
  ui.row('partial');
  assert.equal(ui.find((node) => node.props.title === 'second.png'), undefined);
  ui.row('partial');
  assert.ok(ui.find((node) => node.props.title === 'second.png'));
  assert.equal(ui.requests.length, 0);
});

test('folding stops batch expansion without discarding manual loads or reopening a row', async () => {
  const ui = mount();
  await startMedia(ui, 'manual', 'batch');
  ui.workspace();
  ui.row('manual');
  const single = ui.take('/media/session', 'manual');
  const batch = await startBatch(ui);
  ui.button('Collapse all');
  assert.equal(batch.signal.aborted, true);
  assert.equal(single.signal.aborted, false);
  await respond(batch, { truncated: false, items: [item('batch', 'old.png')] });
  await respond(single, { items: [item('manual', 'manual.png')] });
  assert.equal(ui.find(ui.byClass('dsh-find-session-row')), undefined);
  ui.workspace();
  assert.equal(ui.state('batch'), 'idle');
  assert.equal(ui.state('manual'), 'ready');
  assert.equal(ui.find(ui.byClass('dsh-find-tile')), undefined);
  ui.row('manual');
  assert.ok(ui.find((node) => node.props.title === 'manual.png'));
  assert.equal(ui.requests.length, 0);
});

test('refresh aborts old reads and late batch/session JSON cannot replace new results', async () => {
  const ui = mount();
  await startMedia(ui, 'same', 'new');
  ui.workspace();
  ui.row('same');
  const oldSingle = ui.take('/media/session', 'same');
  const oldBatch = await startBatch(ui);
  let finishJson;
  oldSingle.resolve({ ok: true, json: () => new Promise((resolve) => { finishJson = resolve; }) });
  await flush();
  ui.button('Rescan');
  assert.equal(oldBatch.signal.aborted, true);
  assert.equal(oldSingle.signal.aborted, true);
  await respond(ui.take('/media/tree'), tree('same', 'new'));
  ui.workspace();
  ui.row('same');
  await respond(ui.take('/media/session', 'same'), { items: [item('same', 'fresh.png')] });
  finishJson({ items: [item('same', 'stale-single.png')] });
  await respond(oldBatch, { truncated: false, items: [item('new', 'stale-batch.png')] });
  assert.ok(ui.find((node) => node.props.title === 'fresh.png'));
  assert.equal(ui.find((node) => node.props.title?.startsWith('stale-')), undefined);
  assert.equal(ui.state('new'), 'idle');
});

test('expand while tree is loading shares that request; a failure clears busy and can retry', async () => {
  const ui = mount();
  ui.tab('Images/Videos');
  const pending = ui.take('/media/tree');
  ui.button('Expand all');
  assert.equal(ui.requests.length, 0);
  pending.reject(new Error('mock network error'));
  await flush();
  assert.ok(ui.find(ui.byClass('dsh-find-error')));
  ui.button('Expand all');
  await respond(ui.take('/media/tree'), tree('empty', 'picture'));
  await respond(ui.take('/media'), { truncated: false, items: [item('picture', 'visible.png')] });
  assert.equal(ui.state('empty'), 'ready');
  assert.ok(ui.find((node) => node.props.title === 'visible.png'));
});

test('folding while the outline is pending prevents a later batch scan', async () => {
  const ui = mount();
  ui.tab('Images/Videos');
  const pending = ui.take('/media/tree');
  ui.button('Expand all');
  ui.button('Collapse all');
  assert.equal(pending.signal.aborted, false);
  await respond(pending, tree('still-folded'));
  assert.equal(ui.requests.length, 0);
  assert.equal(ui.find(ui.byClass('dsh-find-session-row')), undefined);
  const batch = await startBatch(ui);
  await respond(batch, { truncated: false, items: [] });
  assert.equal(ui.state('still-folded'), 'ready');
});

test('newer manual reads and deletes win over in-flight batch results', async () => {
  const ui = mount();
  await startMedia(ui, 'deleteFrom', 'manual', 'other');
  ui.workspace();
  ui.row('deleteFrom');
  const gone = item('deleteFrom', 'gone.png');
  await respond(ui.take('/media/session', 'deleteFrom'), { items: [gone] });
  const batch = await startBatch(ui);
  ui.row('manual');
  const manual = ui.take('/media/session', 'manual');
  ui.find((node) => node.props.title === 'gone.png').props.onContextMenu(event);
  ui.button('Delete');
  ui.button('Confirm delete');
  await respond(ui.take('/media/delete', 'gone.png'), { ok: true });
  await respond(batch, { truncated: false, items: [gone, { ...gone, sessionId: 'other' }, item('manual', 'old.png')] });
  assert.equal(ui.state('manual'), 'loading');
  await respond(manual, { items: [{ ...gone, sessionId: 'manual' }, item('manual', 'fresh.png')] });
  assert.ok(ui.find((node) => node.props.title === 'fresh.png'));
  assert.equal(ui.find((node) => node.props.title === 'gone.png' || node.props.title === 'old.png'), undefined);
});

const filePanelClick = (ui, select) => {
  const button = nodes(ui.filePanel()).find((node) => node.type === 'button' && select(node));
  assert.ok(button, 'expected file panel button');
  assert.notEqual(button.props.disabled, true);
  button.props.onClick(event);
};
const fileButton = (ui, label) => filePanelClick(ui, (node) => node.children.includes(label));
const fileRow = (ui, id) => filePanelClick(ui, (node) =>
  ui.byClass('dsh-find-session-row')(node) && nodes(node).some((child) =>
    ui.byClass('dsh-find-session-title')(child) && child.children.includes(id)));
const fileWorkspace = (ui) => filePanelClick(ui, ui.byClass('dsh-find-ws-head'));
const fileState = (ui, id) => ui.find((node) => node.type.name === 'FilesPanel').props.files.sessions.get(id);
const filePayload = (id) => ({ items: [
  { id, name: id + '.txt', speaker: 'user', kind: 'file', canReveal: true },
], truncated: false });

async function startFiles(ui, ...ids) {
  ui.tab('Files');
  await respond(ui.take('/files/tree'), tree(...ids));
}

test('file bulk load shares four slots with manual reads and retries, with manual priority', async () => {
  const ui = mount();
  await startFiles(ui, ...Array.from({ length: 10 }, (_, i) => 's' + i));
  fileWorkspace(ui);
  fileRow(ui, 's0');
  const initial = ui.take('/files/session', 's0');
  fileButton(ui, 'Expand all');
  assert.deepEqual(ui.requests.map(({ id }) => id), ['s1', 's2', 's3']);
  fileRow(ui, 's9');
  fileRow(ui, 's9');
  assert.equal(ui.fileMetrics().activeFiles, 4);
  initial.reject(new Error('mock failed file read'));
  await flush();
  assert.equal(ui.requests.at(-1).id, 's9');
  ui.publishFiles();
  assert.equal(fileState(ui, 's0').status, 'error');
  fileButton(ui, 'Retry');
  assert.equal(ui.requests.length, 4);
  await respond(ui.take('/files/session', 's1'), filePayload('s1'));
  assert.equal(ui.requests.at(-1).id, 's0');
  fileButton(ui, 'Collapse all');
  for (const request of ui.requests.splice(0)) request.resolve({ ok: true, json: async () => filePayload(request.id) });
  await flush();
  ui.publishFiles();
  assert.equal(ui.requests.length, 0);
  assert.equal(fileState(ui, 's0').status, 'ready');
  assert.equal(fileState(ui, 's9').status, 'ready');
  assert.equal(fileState(ui, 's4'), undefined);
  assert.equal(ui.fileMetrics().peakFiles, 4);
});

test('file rescan aborts old reads and shares their slots until they settle', async () => {
  const ui = mount();
  await startFiles(ui, 'same', 'old1', 'old2', 'old3', 'old4');
  fileButton(ui, 'Expand all');
  const old = ui.requests.splice(0);
  assert.equal(old.length, 4);
  fileButton(ui, 'Rescan');
  assert.ok(old.every((request) => request.signal.aborted));
  await respond(ui.take('/files/tree'), tree('same'));
  fileWorkspace(ui);
  fileRow(ui, 'same');
  assert.equal(ui.requests.length, 0);
  await respond(old.shift(), filePayload('stale'));
  await respond(ui.take('/files/session', 'same'), filePayload('fresh'));
  for (const request of old) request.resolve({ ok: true, json: async () => filePayload('stale') });
  await flush();
  ui.publishFiles();
  assert.equal(fileState(ui, 'same').items[0].id, 'fresh');
  assert.equal(fileState(ui, 'old1'), undefined);
  assert.equal(ui.requests.length, 0);
  assert.equal(ui.fileMetrics().peakFiles, 4);
});

test('1,000 file reads publish one snapshot per group instead of per request', async () => {
  const ui = mount();
  const ids = Array.from({ length: 1000 }, (_, i) => 's' + i);
  await startFiles(ui, ...ids);
  const before = ui.fileMetrics().notifications;
  fileButton(ui, 'Expand all');
  let loaded = 0;
  const readIds = [];
  while (loaded < ids.length) {
    const group = ui.requests.splice(0);
    assert.equal(group.length, 4);
    for (const request of group) {
      readIds.push(request.id);
      request.resolve({ ok: true, json: async () => filePayload(request.id) });
    }
    await flush();
    assert.equal(ui.fileMetrics().timers, 1);
    ui.publishFiles();
    loaded += group.length;
  }
  assert.deepEqual(readIds, ids);
  assert.equal(ui.fileMetrics().peakFiles, 4);
  assert.equal(ui.fileMetrics().notifications - before, 251);
  assert.equal(fileState(ui, 's0').status, 'ready');
  assert.equal(fileState(ui, 's999').status, 'ready');
});

test('video tiles share a scroller observer, defer src, and retain immediate playback on click', async () => {
  const observers = [];
  class IntersectionObserver {
    constructor(notify, options) {
      this.notify = (target, isIntersecting) => notify([{ target, isIntersecting }]);
      this.options = options;
      this.targets = new Set();
      observers.push(this);
    }
    observe(target) { this.targets.add(target); }
    unobserve(target) { this.targets.delete(target); }
  }
  const ui = mount({ IntersectionObserver });
  await startMedia(ui, 'videos');
  const batch = await startBatch(ui);
  await respond(batch, { truncated: false, items: ['first', 'second', 'third'].map((id) => ({
    ...item('videos', id), kind: 'video',
  })) });
  const thumbnails = nodes(ui.render()).filter((node) => node.type.name === 'VideoThumbnail');
  const root = {};
  const videos = thumbnails.map(({ type, props }) => {
    const element = type(props);
    assert.equal(element.props.src, undefined);
    const attrs = new Map();
    const video = {
      attrs,
      closest: (selector) => { assert.equal(selector, '.dsh-find-media-body'); return root; },
      setAttribute: (key, value) => attrs.set(key, value),
      hasAttribute: (key) => attrs.has(key),
      removeAttribute: (key) => attrs.delete(key),
      load: () => { video.unloaded = true; },
    };
    element.props.ref(video);
    return { video, ref: element.props.ref };
  });
  assert.equal(videos.length, 3);
  assert.equal(observers.length, 1);
  const [observer] = observers;
  const [first, second, third] = videos;
  assert.equal(observer.options.root, root);
  assert.ok(videos.every(({ video }) => !video.attrs.has('src')));
  observer.notify(first.video, true);
  observer.notify(second.video, false);
  assert.equal(first.video.attrs.get('src'), '/mock/first');
  assert.equal(second.video.attrs.has('src'), false);
  ui.click((node) => ui.byClass('dsh-find-tile')(node) && node.props.title === 'second');
  const preview = ui.find(ui.byClass('dsh-find-preview-media'));
  assert.equal(preview.props.src, '/mock/second');
  assert.equal(preview.props.controls, true);
  assert.equal(preview.props.autoPlay, true);
  third.ref(null);
  observer.notify(third.video, true);
  assert.equal(observer.targets.has(third.video), false);
  assert.equal(third.video.attrs.has('src'), false);
  first.ref(null);
  assert.equal(first.video.attrs.has('src'), false);
  assert.equal(first.video.unloaded, true);
});

test('image requests prioritize onscreen tiles, recover from busy, and preserve original previews', async () => {
  let notify;
  const targets = new Set();
  class IntersectionObserver {
    constructor(callback, options) {
      assert.equal(options.rootMargin, '160px 0px');
      notify = (entries) => callback(entries);
    }
    observe(node) { targets.add(node); }
    unobserve(node) { targets.delete(node); }
  }
  const ui = mount({ IntersectionObserver });
  await startMedia(ui, 'images');
  const ids = ['prefetch', 'att:abc', 'file:E:/图片/白 云.png', 'visible-c', 'visible-d', 'visible-e', 'far'];
  await respond(await startBatch(ui), { items: ids.map((id) => item('images', id)) });
  const root = { getBoundingClientRect: () => ({ top: 50 }), clientTop: 0, clientHeight: 640 };
  const images = nodes(ui.render()).filter((node) => node.type.name === 'ImageThumbnail').map(({ type, props }, i) => {
    const { props: img } = type(props);
    assert.equal(img.src, undefined);
    assert.equal(img.decoding, 'async');
    const attrs = new Map();
    const top = i === 0 ? 760 : i === 6 ? 1500 : 70;
    const node = { closest: () => root, getBoundingClientRect: () => ({ top, bottom: top + 100 }),
      setAttribute: (key, value) => attrs.set(key, value), removeAttribute: (key) => attrs.delete(key) };
    img.ref(node);
    return { node, attrs, img };
  });
  notify(images.map(({ node }, i) => ({ target: node, isIntersecting: i !== 6 })));
  await flush();
  const thumbnail = '/media/thumbnail';
  assert.deepEqual(ui.requests.map(r => r.id), ids.slice(1, 5));
  const busy = ui.take(thumbnail, ids[1]);
  busy.resolve({ ok: false, status: 503, json: async () => ({ error: 'thumbnail-busy' }) });
  await flush();
  assert.equal(ui.retryTimers.size, 1);
  assert.equal(ui.requests.at(-1).id, ids[5]);
  const missing = ui.take(thumbnail, ids[2]);
  missing.resolve({ ok: false, status: 404 });
  await flush();
  assert.equal(ui.retryTimers.size, 1);
  assert.equal(ui.requests.at(-1).id, ids[0]);
  const removed = ui.take(thumbnail, ids[3]);
  images[3].img.ref(null);
  assert.equal(removed.signal.aborted, true);
  removed.resolve({ ok: true, blob: async () => ({ id: 'removed' }) });
  await flush();
  assert.equal(images[3].attrs.has('src'), false);
  const leaving = ui.take(thumbnail, ids[4]);
  notify([{ target: images[4].node, isIntersecting: false }]);
  assert.equal(leaving.signal.aborted, true);
  notify([{ target: images[4].node, isIntersecting: true }]);
  leaving.resolve({ ok: true, blob: async () => ({ id: 'left' }) });
  await flush();
  assert.equal(images[4].attrs.has('src'), false);
  const returned = ui.take(thumbnail, ids[4]);
  assert.equal(returned.signal.aborted, false);
  returned.resolve({ ok: false, status: 503, json: async () => ({ error: 'thumbnail-decoder-unavailable' }) });
  await flush();
  assert.equal(ui.retryTimers.size, 1);
  ui.advanceRetries();
  await flush();
  const recovered = ui.take(thumbnail, ids[1]);
  recovered.resolve({ ok: true, blob: async () => ({ id: 'recovered' }) });
  await flush();
  assert.equal(images[1].attrs.get('src'), 'blob:recovered');
  images[1].img.onLoad({ currentTarget: images[1].node });
  assert.equal(images[1].attrs.has('data-ready'), true);
  for (let retry = 0; retry <= 3; retry++) {
    const transient = ui.take(thumbnail, ids[5]);
    transient.resolve({ ok: false, status: 504 });
    await flush();
    assert.equal(ui.retryTimers.size, retry < 3 ? 1 : 0);
    ui.advanceRetries();
    await flush();
  }
  ui.click((node) => ui.byClass('dsh-find-tile')(node) && node.props.title === ids[2]);
  assert.equal(ui.find(ui.byClass('dsh-find-preview-media')).props.src, '/mock/' + ids[2]);
  for (const { img } of images) img.ref(null);
  assert.deepEqual(ui.revoked, ['blob:recovered']);
  assert.equal(targets.size, 0);
  assert.equal(ui.retryTimers.size, 0);
});

test('media row window keeps fixed space, mounts successive groups, resizes, and opens originals', async () => {
  let frame;
  let scroll;
  let disconnects = 0;
  let resize;
  let offset = 0;
  let width = 544;
  const root = {
    clientTop: 0, clientHeight: 200,
    getBoundingClientRect: () => ({ top: 40 }),
    addEventListener(name, listener) { assert.equal(name, 'scroll'); scroll = listener; },
    removeEventListener(name, listener) { assert.equal(listener, scroll); scroll = undefined; },
  };
  const ui = mount({ viewport: {
    ResizeObserver: class {
      constructor(callback) { assert.equal(resize, undefined); resize = callback; }
      observe() {} unobserve() {} disconnect() { disconnects++; }
    },
    requestAnimationFrame(callback) { assert.equal(frame, undefined); frame = callback; return 1; },
    cancelAnimationFrame() { frame = undefined; },
  } });
  await startMedia(ui, 'first', 'second');
  await respond(await startBatch(ui), { items: [
    ...Array.from({length: 400}, (_, i) => item('first', 'a' + i)),
    ...Array.from({length: 400}, (_, i) => item('second', 'b' + i)),
  ] });
  // Isolate component hook slots, just as React gives each mounted grid its own state.
  const groups = ui.render().children;
  const raw = [];
  function collect(node) {
    if (Array.isArray(node)) return node.forEach(collect);
    if (!node || typeof node !== 'object') return;
    if (node.type.name === 'MediaGrid') raw.push(node);
    else collect(node.children);
  }
  collect(groups);
  assert.equal(raw.length, 2);
  const before = raw.map(({ type, props }, i) => ui.renderGrid(type, props, i));
  assert.ok(before.every(grid => grid.children.flat().length === 0));
  const nodes = [0, 10300].map(top => ({
    closest: () => root, get clientWidth() { return width; },
    getBoundingClientRect: () => ({ top: 40 + top - offset }),
  }));
  before.forEach((grid, index) => grid.props.ref(nodes[index]));
  const flushFrame = () => { const callback = frame; frame = undefined; callback(); };
  const read = (index) => ui.renderGrid(raw[index].type, raw[index].props, index);
  const titles = (grid) => grid.children.flat().map(tile => tile.props.title);
  flushFrame();
  const height = read(0).props.style.height;
  assert.ok(titles(read(0)).includes('a0'));
  assert.ok(titles(read(0)).length < 30);
  assert.deepEqual(titles(read(1)), []);
  offset = 5000;
  scroll(); scroll(); flushFrame();
  assert.ok(titles(read(0)).some(title => title === 'a200'));
  assert.equal(titles(read(0)).includes('a0'), false);
  assert.equal(read(0).props.style.height, height);
  read(0).children.flat()[0].props.onClick();
  assert.equal(ui.find(ui.byClass('dsh-find-preview-media')).props.src, '/mock/' + titles(read(0))[0]);
  offset = 10310;
  scroll(); flushFrame();
  assert.ok(titles(read(1)).includes('b0'));
  width = 414;
  resize(); flushFrame();
  assert.match(read(1).props.style.gridTemplateColumns, /repeat\(3,/);
  assert.ok(read(1).props.style.height > height);
  before.forEach(grid => grid.props.ref(null));
  assert.equal(disconnects, 1);
  assert.equal(scroll, undefined);
  assert.equal(frame, undefined);
});


test('archive and speaker filters remain independent across all three tabs', () => {
  const ui = mount();
  const tabs = ['Text', 'Images/Videos', 'Files'];
  const expected = tabs.map((_, i) => ({ archived: true, speakers: Object.fromEntries(
    (i === 0 ? ['user', 'assistant', 'tool', 'system'] : ['user', 'assistant']).map(key => [key, true]),
  ) }));
  const view = (i) => {
    ui.tab(tabs[i]);
    return nodes(i === 2 ? ui.filePanel() : ui.render());
  };
  const archive = (all) => {
    const label = all.find(node => node.type === 'label' && nodes(node).some(child => child.children?.includes('Hide archived')));
    return nodes(label).find(node => node.type === 'input');
  };
  const chip = (all, key) => all.find(node => node.type === 'button' && node.props['data-speaker'] === key);
  const verify = () => {
    for (let i = 0; i < tabs.length; i++) {
      const all = view(i);
      assert.equal(archive(all).props.checked, expected[i].archived, tabs[i] + ' archive');
      for (const [key, enabled] of Object.entries(expected[i].speakers)) {
        assert.equal(chip(all, key).props['data-on'], String(enabled), tabs[i] + ' ' + key);
      }
    }
  };
  verify();
  for (const enabled of [false, true]) {
    for (let i = 0; i < tabs.length; i++) {
      archive(view(i)).props.onChange({ target: { checked: enabled } });
      expected[i].archived = enabled;
      verify();
    }
  }
  for (let round = 0; round < 2; round++) {
    for (let i = 0; i < tabs.length; i++) {
      for (const key of Object.keys(expected[i].speakers)) {
        chip(view(i), key).props.onClick(event);
        expected[i].speakers[key] = !expected[i].speakers[key];
        verify();
      }
    }
  }
});


test('media archive filter updates items and sessions independently of text filter', async () => {
  const ui = mount();
  const archive = () => ui.find(node => node.type === 'input' && node.props.type === 'checkbox');
  archive().props.onChange({ target: { checked: true } });
  ui.tab('Images/Videos');
  archive().props.onChange({ target: { checked: false } });
  const data = tree('active', 'archived');
  data.workspaces[0].sessions[1].archived = true;
  await respond(ui.take('/media/tree'), data);
  await respond(await startBatch(ui), { truncated: false, items: [
    item('active', 'active.png'), { ...item('archived', 'archived.png'), archived: true },
  ] });
  const tiles = () => nodes(ui.render()).filter(ui.byClass('dsh-find-tile')).map(node => node.props.title);
  const rows = () => nodes(ui.render()).filter(ui.byClass('dsh-find-session-row'));
  assert.equal(archive().props.checked, false);
  assert.deepEqual(tiles(), ['active.png', 'archived.png']);
  assert.equal(rows().length, 2);
  archive().props.onChange({ target: { checked: true } });
  assert.deepEqual(tiles(), ['active.png']);
  assert.equal(rows().length, 1);
  archive().props.onChange({ target: { checked: false } });
  assert.deepEqual(tiles(), ['active.png', 'archived.png']);
  ui.tab('Text');
  assert.equal(archive().props.checked, true);
});


const filterStorageKey = 'dsh-find.filters.v1';
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
function filterControls(ui, tab) {
  ui.tab(tab);
  const all = nodes(tab === 'Files' ? ui.filePanel() : ui.render());
  const label = all.find(node => node.type === 'label' && nodes(node).some(child => child.children?.includes('Hide archived')));
  return {
    archive: nodes(label).find(node => node.type === 'input'),
    speaker: key => all.find(node => node.type === 'button' && node.props['data-speaker'] === key),
  };
}
// Existing saved preferences deliberately differ from the first-install defaults.
const savedFilters = () => Object.fromEntries(['text', 'media', 'files'].map(tab => [tab, {
  hideArchived: false,
  ...(tab === 'files' ? { hideMedia: false } : {}),
  speakers: Object.fromEntries((tab === 'text' ? ['user', 'assistant', 'tool', 'system'] : ['user', 'assistant']).map(key => [key, true])),
}]));

test('all tab preferences restore independently in a fresh client and remember re-enabled buttons', async () => {
  const storage = memoryStorage();
  const first = mount({ storage });
  for (const [tab, speaker] of [['Text', 'tool'], ['Images/Videos', 'user'], ['Files', 'assistant']]) {
    const controls = filterControls(first, tab);
    controls.archive.props.onChange({ target: { checked: tab !== 'Images/Videos' } });
    controls.speaker(speaker).props.onClick(event);
  }
  await flush();
  const second = mount({ storage });
  for (const [tab, disabled] of [['Text', 'tool'], ['Images/Videos', 'user'], ['Files', 'assistant']]) {
    const controls = filterControls(second, tab);
    assert.equal(controls.archive.props.checked, tab !== 'Images/Videos');
    for (const speaker of tab === 'Text' ? ['user', 'assistant', 'tool', 'system'] : ['user', 'assistant']) {
      assert.equal(controls.speaker(speaker).props['data-on'], String(speaker !== disabled), tab + ' ' + speaker);
    }
    controls.archive.props.onChange({ target: { checked: false } });
    controls.speaker(disabled).props.onClick(event);
  }
  const third = mount({ storage });
  for (const tab of ['Text', 'Images/Videos', 'Files']) {
    const controls = filterControls(third, tab);
    assert.equal(controls.archive.props.checked, false);
    for (const speaker of tab === 'Text' ? ['user', 'assistant', 'tool', 'system'] : ['user', 'assistant']) {
      assert.equal(controls.speaker(speaker).props['data-on'], 'true');
    }
  }
});

test('Host settings restore without browser storage and do not trigger a redundant save', async () => {
  const ui = mount({ settings: true });
  const filters = savedFilters();
  filters.text.hideArchived = true;
  filters.media.speakers.user = false;
  filters.files.speakers.assistant = false;
  await respond(ui.take('/settings'), { ok: true, saved: true, theme: 'dark', filters });
  assert.equal(filterControls(ui, 'Text').archive.props.checked, true);
  assert.equal(filterControls(ui, 'Images/Videos').speaker('user').props['data-on'], 'false');
  assert.equal(filterControls(ui, 'Files').speaker('assistant').props['data-on'], 'false');
  assert.equal(ui.requests.some(request => request.key === '/settings'), false);
});

test('late Host load preserves fresh clicks and rapid changes save serially', async () => {
  const storage = memoryStorage();
  const ui = mount({ storage, settings: true });
  filterControls(ui, 'Text').speaker('user').props.onClick(event);
  const filters = savedFilters();
  filters.files.hideArchived = true;
  await respond(ui.take('/settings'), { ok: true, saved: true, theme: 'auto', filters });
  assert.equal(filterControls(ui, 'Text').speaker('user').props['data-on'], 'false');
  assert.equal(filterControls(ui, 'Files').archive.props.checked, true);
  const first = ui.take('/settings');
  assert.deepEqual(JSON.parse(first.options.body), { filters: { text: { speakers: { user: false } } } });
  assert.equal(first.options.keepalive, true);
  filterControls(ui, 'Text').speaker('user').props.onClick(event);
  filterControls(ui, 'Images/Videos').archive.props.onChange({ target: { checked: true } });
  assert.equal(ui.requests.some(request => request.key === '/settings'), false);
  const mirrored = JSON.parse(storage.getItem(filterStorageKey));
  assert.deepEqual(mirrored.pending, { text: { speakers: { user: true } }, media: { hideArchived: true } });
  await respond(first, { ok: true, filters });
  const second = ui.take('/settings');
  assert.deepEqual(JSON.parse(second.options.body), { filters: mirrored.pending });
  await respond(second, { ok: true, filters });
  assert.deepEqual(JSON.parse(storage.getItem(filterStorageKey)).pending, {});
  assert.equal(filterControls(ui, 'Text').speaker('user').props['data-on'], 'true');
  assert.equal(filterControls(ui, 'Images/Videos').archive.props.checked, true);
});

test('closing during a save keeps both in-flight and later changes for the next client', async () => {
  const storage = memoryStorage();
  const ui = mount({ storage, settings: true });
  const filters = savedFilters();
  await respond(ui.take('/settings'), { ok: true, saved: true, theme: 'auto', filters });
  filterControls(ui, 'Text').speaker('system').props.onClick(event);
  const first = ui.take('/settings');
  filterControls(ui, 'Files').archive.props.onChange({ target: { checked: true } });
  const expected = { text: { speakers: { system: false } }, files: { hideArchived: true } };
  assert.deepEqual(JSON.parse(storage.getItem(filterStorageKey)).pending, expected);
  const reopened = mount({ storage, settings: true });
  await respond(reopened.take('/settings'), { ok: true, saved: true, theme: 'auto', filters });
  assert.deepEqual(JSON.parse(reopened.take('/settings').options.body), { filters: expected });
  assert.equal(filterControls(reopened, 'Text').speaker('system').props['data-on'], 'false');
  assert.equal(filterControls(reopened, 'Files').archive.props.checked, true);
  first.resolve({ ok: false, json: async () => ({ ok: false }) });
  await flush();
  assert.deepEqual(JSON.parse(storage.getItem(filterStorageKey)).pending, expected);
});

test('corrupt or blocked local storage leaves defaults and an older Host never receives filter writes', async () => {
  for (const storage of [memoryStorage({ [filterStorageKey]: '{bad json' }), {
    getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); },
  }]) {
    const ui = mount({ storage, settings: true });
    await respond(ui.take('/settings'), { ok: true, saved: true, theme: 'auto' });
    assert.equal(filterControls(ui, 'Text').archive.props.checked, true);
    filterControls(ui, 'Text').speaker('user').props.onClick(event);
    assert.equal(ui.requests.some(request => request.key === '/settings'), false);
    assert.equal(filterControls(ui, 'Images/Videos').speaker('user').props['data-on'], 'true');
  }
});


test('failed Host save survives a restart and retries without resetting other tabs', async () => {
  const storage = memoryStorage();
  const filters = savedFilters();
  filters.media.speakers.assistant = false;
  const ui = mount({ storage, settings: true });
  await respond(ui.take('/settings'), { ok: true, saved: true, theme: 'auto', filters });
  filterControls(ui, 'Text').archive.props.onChange({ target: { checked: true } });
  const failed = ui.take('/settings');
  failed.resolve({ ok: false, json: async () => ({ ok: false }) });
  await flush();
  const reopened = mount({ storage, settings: true });
  await respond(reopened.take('/settings'), { ok: true, saved: true, theme: 'auto', filters });
  assert.equal(filterControls(reopened, 'Text').archive.props.checked, true);
  assert.equal(filterControls(reopened, 'Images/Videos').speaker('assistant').props['data-on'], 'false');
  const retry = reopened.take('/settings');
  assert.deepEqual(JSON.parse(retry.options.body), { filters: { text: { hideArchived: true } } });
  await respond(retry, { ok: true, filters });
  assert.deepEqual(JSON.parse(storage.getItem(filterStorageKey)).pending, {});
});


test('settings page and palette share one load and cannot replay stale filters after a save', async () => {
  const ui = mount({ storage: memoryStorage(), settings: true });
  ui.settingsPanel();
  ui.close();
  ui.open();
  assert.equal(ui.requests.filter(request => request.key === '/settings').length, 1);
  await respond(ui.take('/settings'), { ok: true, saved: true, theme: 'auto', filters: savedFilters() });
  filterControls(ui, 'Text').speaker('user').props.onClick(event);
  await respond(ui.take('/settings'), { ok: true, filters: savedFilters() });
  ui.settingsPanel();
  ui.close();
  ui.open();
  await flush();
  assert.equal(ui.requests.some(request => request.key === '/settings'), false);
  assert.equal(filterControls(ui, 'Text').speaker('user').props['data-on'], 'false');
});

test('reopening retries a failed initial load without losing choices made while offline', async () => {
  const ui = mount({ storage: memoryStorage(), settings: true });
  ui.take('/settings').reject(new Error('offline'));
  await flush();
  filterControls(ui, 'Text').archive.props.onChange({ target: { checked: false } });
  ui.close();
  ui.open();
  const staleFilters = savedFilters();
  staleFilters.text.hideArchived = true;
  await respond(ui.take('/settings'), { ok: true, saved: true, theme: 'auto', filters: staleFilters });
  assert.equal(filterControls(ui, 'Text').archive.props.checked, false);
  const save = ui.take('/settings');
  assert.deepEqual(JSON.parse(save.options.body), { filters: { text: { hideArchived: false } } });
  await respond(save, { ok: true, filters: savedFilters() });
});


test('Host load retry does not restore stale local values when local writes fail', async () => {
  const storage = { getItem: key => key === filterStorageKey ? JSON.stringify({ filters: savedFilters(), pending: {} }) : null,
    setItem() { throw new Error('quota'); } };
  const ui = mount({ storage, settings: true });
  ui.take('/settings').reject(new Error('offline'));
  await flush();
  filterControls(ui, 'Text').speaker('tool').props.onClick(event);
  ui.close();
  ui.open();
  await respond(ui.take('/settings'), { ok: true, saved: true, theme: 'auto', filters: savedFilters() });
  assert.equal(filterControls(ui, 'Text').speaker('tool').props['data-on'], 'false');
  const save = ui.take('/settings');
  assert.deepEqual(JSON.parse(save.options.body), { filters: { text: { speakers: { tool: false } } } });
  await respond(save, { ok: true, filters: savedFilters() });
});

test('reopening retries a failed POST even when the successful settings load is cached', async () => {
  const ui = mount({ storage: memoryStorage(), settings: true });
  await respond(ui.take('/settings'), { ok: true, saved: true, theme: 'auto', filters: savedFilters() });
  filterControls(ui, 'Files').archive.props.onChange({ target: { checked: true } });
  ui.take('/settings').reject(new Error('offline'));
  await flush();
  ui.close();
  ui.open();
  await flush();
  const retry = ui.take('/settings');
  assert.equal(retry.options.method, 'POST');
  assert.deepEqual(JSON.parse(retry.options.body), { filters: { files: { hideArchived: true } } });
  await respond(retry, { ok: true, filters: savedFilters() });
  assert.equal(filterControls(ui, 'Files').archive.props.checked, true);
});


test('file hide-media preference restores locally and from Host without changing other filters', async () => {
  const storage = memoryStorage();
  const hideMedia = (ui) => {
    ui.tab('Files');
    const label = nodes(ui.filePanel()).find(node => node.type === 'label' && nodes(node).some(child => child.children?.includes('Hide Images/Videos')));
    return nodes(label).find(node => node.type === 'input');
  };
  const ui = mount({ storage, settings: true });
  // An explicitly saved false must override the new checked default.
  await respond(ui.take('/settings'), { ok: true, saved: true, theme: 'auto', filters: savedFilters() });
  assert.equal(hideMedia(ui).props.checked, false);
  hideMedia(ui).props.onChange({ target: { checked: true } });
  const save = ui.take('/settings');
  assert.deepEqual(JSON.parse(save.options.body), { filters: { files: { hideMedia: true } } });
  const filters = savedFilters();
  filters.files.hideMedia = true;
  await respond(save, { ok: true, filters });
  const localReload = mount({ storage });
  assert.equal(hideMedia(localReload).props.checked, true);
  const hostReload = mount({ settings: true });
  await respond(hostReload.take('/settings'), { ok: true, saved: true, theme: 'auto', filters });
  assert.equal(hideMedia(hostReload).props.checked, true);
  for (const tab of ['Text', 'Images/Videos', 'Files']) {
    const controls = filterControls(hostReload, tab);
    assert.equal(controls.archive.props.checked, false);
    assert.equal(controls.speaker('user').props['data-on'], 'true');
    assert.equal(controls.speaker('assistant').props['data-on'], 'true');
  }
  hideMedia(localReload).props.onChange({ target: { checked: false } });
  assert.equal(hideMedia(mount({ storage })).props.checked, false);
  hideMedia(hostReload).props.onChange({ target: { checked: false } });
  const reset = hostReload.take('/settings');
  assert.deepEqual(JSON.parse(reset.options.body), { filters: { files: { hideMedia: false } } });
  filters.files.hideMedia = false;
  await respond(reset, { ok: true, filters });
});


test('first install checks all hide filters before and after settings load', async () => {
  const ui = mount({ storage: memoryStorage(), settings: true });
  const verify = () => {
    for (const tab of ['Text', 'Images/Videos', 'Files']) {
      assert.equal(filterControls(ui, tab).archive.props.checked, true, tab);
    }
    const label = nodes(ui.filePanel()).find(node => node.type === 'label' && nodes(node).some(child => child.children?.includes('Hide Images/Videos')));
    assert.equal(nodes(label).find(node => node.type === 'input').props.checked, true);
  };
  verify();
  const filters = savedFilters();
  for (const row of Object.values(filters)) row.hideArchived = true;
  filters.files.hideMedia = true;
  await respond(ui.take('/settings'), { ok: true, saved: false, theme: 'auto', filters });
  verify();
  assert.equal(ui.requests.some(request => request.key === '/settings'), false);
});

test('saved unchecked filters override defaults in local storage and Host settings', async () => {
  const filters = savedFilters();
  const storage = memoryStorage({ [filterStorageKey]: JSON.stringify({ filters, pending: {} }) });
  const local = mount({ storage });
  const host = mount({ settings: true });
  await respond(host.take('/settings'), { ok: true, saved: true, theme: 'auto', filters });
  for (const ui of [local, host]) {
    for (const tab of ['Text', 'Images/Videos', 'Files']) {
      assert.equal(filterControls(ui, tab).archive.props.checked, false, tab);
    }
    const label = nodes(ui.filePanel()).find(node => node.type === 'label' && nodes(node).some(child => child.children?.includes('Hide Images/Videos')));
    assert.equal(nodes(label).find(node => node.type === 'input').props.checked, false);
  }
});
