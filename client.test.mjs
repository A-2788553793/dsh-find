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
function mount({ IntersectionObserver } = {}) {
  const requests = [];
  const fileTimers = new Map();
  let notifications = 0;
  let timerId = 0;
  let activeFiles = 0;
  let peakFiles = 0;
  const setTimer = (run, delay) => {
    const id = ++timerId;
    if (delay === 16) fileTimers.set(id, run);
    return id;
  };
  const hooks = [];
  const effects = [];
  let hook = 0;
  let palette;
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
    if (path === '/dsh-find/settings') return Promise.resolve({ ok: false });
    const url = new URL(path, 'http://test.local');
    return new Promise((resolve, reject) => {
      const key = url.pathname.slice('/dsh-find'.length);
      const isFile = key === '/files/session';
      if (isFile) peakFiles = Math.max(peakFiles, ++activeFiles);
      requests.push({
        key, id: url.searchParams.get('id'), signal: options.signal,
        resolve: (value) => { if (isFile) activeFiles--; resolve(value); },
        reject: (error) => { if (isFile) activeFiles--; reject(error); },
      });
    });
  };
  runInNewContext(source, {
    window: { __ModuleLoader__: { load: ({ factory }) => { plugin = factory(() => react); } }, innerWidth: 1200, innerHeight: 800, IntersectionObserver, setTimeout: setTimer },
    document: { addEventListener(name, listen) { if (name === 'keydown') keydown = listen; } },
    navigator: { language: 'en' }, fetch, AbortController, URLSearchParams, console, setTimeout: setTimer, clearTimeout: (id) => fileTimers.delete(id),
  }, { filename: 'client.js' });
  plugin.apply({
    get() {},
    effect(fn, name) { if (name === 'dsh-find: ctrl+f capture') fn(); },
    slots: { inject: (name, fn) => fn(), register: ({ name }, component) => { if (name === 'shell.overlay') palette = component; } },
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
    render, requests, find, click, byClass,
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

test('image tiles load only nearby thumbnails and open the original even after a thumbnail fails', async () => {
  let notify;
  const targets = new Set();
  class IntersectionObserver {
    constructor(callback, options) {
      assert.equal(options.rootMargin, '160px 0px');
      notify = (target, isIntersecting) => callback([{ target, isIntersecting }]);
    }
    observe(node) { targets.add(node); }
    unobserve(node) { targets.delete(node); }
  }
  const ui = mount({ IntersectionObserver });
  await startMedia(ui, 'images');
  const batch = await startBatch(ui);
  const ids = ['att:abc', 'file:E:/图片/白 云.png', 'never mounted'];
  await respond(batch, { items: ids.map((id) => item('images', id)) });
  const root = {};
  const images = nodes(ui.render()).filter((node) => node.type.name === 'ImageThumbnail').map(({ type, props }) => {
    const { props: img } = type(props);
    assert.equal(img.src, undefined);
    assert.equal(img.decoding, 'async');
    const attrs = new Map();
    const node = {
      closest: () => root,
      hasAttribute: (key) => attrs.has(key),
      setAttribute: (key, value) => attrs.set(key, value),
      removeAttribute: (key) => attrs.delete(key),
    };
    img.ref(node);
    return { node, attrs, img };
  });
  assert.equal(images.length, ids.length);
  assert.equal(targets.size, ids.length);
  const [near, far, removed] = images;
  notify(near.node, true);
  notify(far.node, false);
  assert.equal(near.attrs.get('src'), '/dsh-find/media/thumbnail?id=' + encodeURIComponent(ids[0]));
  assert.equal(far.attrs.has('src'), false);
  near.img.onLoad({ currentTarget: near.node });
  assert.equal(near.attrs.has('data-ready'), true);
  near.img.onError({ currentTarget: near.node });
  assert.equal(near.attrs.has('data-ready'), false);
  assert.equal(near.attrs.get('src'), '/dsh-find/media/thumbnail?id=' + encodeURIComponent(ids[0]));
  ui.click((node) => ui.byClass('dsh-find-tile')(node) && node.props.title === ids[0]);
  assert.equal(ui.find(ui.byClass('dsh-find-preview-media')).props.src, '/mock/' + ids[0]);
  removed.img.ref(null);
  notify(removed.node, true);
  assert.equal(targets.has(removed.node), false);
  assert.equal(removed.attrs.has('src'), false);
  notify(far.node, true);
  assert.equal(far.attrs.get('src'), '/dsh-find/media/thumbnail?id=' + encodeURIComponent(ids[1]));
});
