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
function mount() {
  const requests = [];
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
      return [box.value, (value) => { box.value = value; }];
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
      requests.push({ key: url.pathname.slice('/dsh-find'.length), id: url.searchParams.get('id'), signal: options.signal, resolve, reject });
    });
  };
  runInNewContext(source, {
    window: { __ModuleLoader__: { load: ({ factory }) => { plugin = factory(() => react); } }, innerWidth: 1200, innerHeight: 800, setTimeout() {} },
    document: { addEventListener(name, listen) { if (name === 'keydown') keydown = listen; } },
    navigator: { language: 'en' }, fetch, AbortController, URLSearchParams, console, setTimeout() {}, clearTimeout() {},
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
