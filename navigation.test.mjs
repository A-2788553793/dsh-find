import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

// Protocol-level tests, not a browser/visual substitute. Expose internals only
// in this VM copy; the shipped module has no test API or dependency on a DOM lib.
const source = readFileSync(new URL('./client.js', import.meta.url), 'utf8').replace(
  "      inject: ['slots'],",
  "      test: { jumpToHit, nodeOwnsHit, hitAnchors, textLanding, cancelJump, setStore, getStore }, inject: ['slots'],",
);
function harness({ nativeHighlight = true, brokenHighlight = false } = {}) {
  let api, now = 0, serial = 0, nav = new AbortController(), active = '', unsubscribed = 0;
  const timers = new Map(), listeners = new Map(), cleanups = [], opened = [], loaded = [], anchors = [], roots = new Map();
  const snapshots = new Map(), records = new Map(), gates = new Map();
  const setTimer = (fn, delay) => { const id = ++serial; timers.set(id, { fn, at: now + delay }); return id; };
  const clearTimer = id => timers.delete(id);
  const highlights = new Map(), styles = [];
  const document = {
    head: { appendChild(style) { styles.push(style); } },
    createElement(tag) { assert.equal(tag, 'style'); return { textContent: '', remove() { styles.splice(styles.indexOf(this), 1); } }; },
    createRange() { return {
      setStart(node, offset) { this.startContainer = node; this.startOffset = offset; },
      setEnd(node, offset) { this.endContainer = node; this.endOffset = offset; },
    }; },
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    querySelectorAll(selector) { assert.equal(selector, '[data-conversation-content][data-conversation-session]'); return [...roots.values()].filter(r => r.session === active); },
    createTreeWalker(anchor) { let i = 0; return { nextNode: () => anchor.texts?.[i++] || null }; },
  };
  const services = {
    uiWorkspace: { openSession(id) { nav.abort(); active = id; opened.push(id); } },
    layout: { beginNavigation() { nav.abort(); nav = new AbortController(); return nav.signal; } },
    sessions: { using: async (id, options, run) => run({ ready: Promise.resolve(), binding: {
      id, session: { loadThrough: async seq => { loaded.push([id, seq]); if (gates.has(id)) await gates.get(id); } },
      eventSource: { getSnapshot: () => ({ entries: records.get(id) || [] }) },
    } }) },
    uiConversation: { binding(binding) { return { target(name) {
      assert.equal(name, 'chat'); return { subscribe: () => () => unsubscribed++, getSnapshot: () => snapshots.get(binding.id) };
    } }; } },
  };
  runInNewContext(source, {
    window: { __ModuleLoader__: { load: ({ factory }) => { api = factory(() => ({})); } }, getComputedStyle: () => ({ display: 'block', visibility: 'visible' }), setTimeout: setTimer,
      CSS: nativeHighlight ? { highlights } : {},
      Highlight: class { constructor(range) { if (brokenHighlight) throw new Error('unavailable'); this.range = range; } } },
    document, navigator: { language: 'en' }, AbortController, Event,
    WheelEvent: class extends Event { constructor(type, options) { super(type, options); this.deltaY = options.deltaY; } },
    NodeFilter: { SHOW_TEXT: 4 }, Date: { now: () => now }, setTimeout: setTimer, clearTimeout: clearTimer,
    fetch: async () => ({ ok: false }), console: { warn() {} },
  });
  api.apply({ get: key => services[key], effect(fn, name) { if (['dsh-find: jump lifecycle', 'dsh-find: jump styles'].includes(name)) cleanups.push(fn()); }, slots: { inject() {} } });
  api.test.setStore({ open: true, searched: 'needle' });
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
  return {
    ...api.test, document, anchors, roots, records, snapshots, gates, opened, loaded, timers, listeners, highlights, styles,
    get unsubscribed() { return unsubscribed; },
    async advance(ms) { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn(); } await flush(); },
    flush, cancelNavigation() { nav.abort(); },
    intent(type, key) { for (const fn of [...(listeners.get(type) || [])]) fn({ type, key, isTrusted: true }); },
    dispose() { for (const cleanup of cleanups) cleanup(); },
  };
}
function element(attrs = {}, parent = null) {
  const e = {
    parentElement: parent, isConnected: true, events: [], scrolls: [], classes: new Set(), texts: [],
    getAttribute: name => attrs[name] ?? null, hasAttribute: name => attrs[name] !== undefined,
    getClientRects: () => [{}],
    closest(selector) { if (selector === 'button,script,style,[aria-hidden="true"]') return null; const name = selector.slice(1, -1); return e.hasAttribute(name) ? e : parent?.closest(selector) || null; },
    dispatchEvent(event) { e.events.push(event.type); if (e.reveal) e.reveal(event); return true; },
    scrollIntoView(options) { e.scrolls.push(options); },
    classList: { add: name => e.classes.add(name), remove: name => e.classes.delete(name) },
  };
  return e;
}
function fixture(h, { session = 's', seq = 20, key = 'message-key', text = 'old needle text', channel = 'conversation', type = 'assistant/message', folded = false } = {}) {
  let root = h.roots.get(session);
  if (!root) {
    root = element({ 'data-conversation-content': '', 'data-conversation-session': session, 'data-content-phase': 'active' });
    root.session = session; root.querySelectorAll = () => h.anchors.filter(a => a.session === session); h.roots.set(session, root);
  }
  const scroller = element({ 'data-conversation-scroll': '' }, root);
  const inner = channel === 'thinking' ? element({ 'data-step-process-body': '' }, scroller) : scroller;
  const anchor = element({ 'data-chat-node-key': key, 'data-chat-group-part': channel === 'thinking' ? 'reasoning' : 'response' }, inner); anchor.querySelectorAll = () => []; anchor.session = session;
  const paragraph = element({}, anchor);
  anchor.texts = [{ nodeValue: text, parentElement: paragraph }];
  if (folded) { let hidden = true; paragraph.getClientRects = () => hidden ? [] : [{}]; paragraph.reveal = () => { hidden = false; }; }
  h.anchors.push(anchor);
  h.records.set(session, [{ type: 'event', event: { seq, type, data: { turn: 1, step: 2, message: { id: key, content: [{ type: channel === 'thinking' ? 'reasoning' : 'text', text }] } } } }]);
  h.snapshots.set(session, { nodes: new Map([[key, { key, anchorSeq: 3, data: { finalNode: { seq } } }]]) });
  const hit = { sessionId: session, seq, type, channel, location: { messageId: key, contentIndex: 0, matchOffset: text.indexOf('needle') } };
  return { hit, anchor, paragraph, scroller, inner };
}

test('precise text is highlighted for exactly three seconds after the palette closes', async () => {
  const h = harness(), f = fixture(h);
  const work = h.jumpToHit(f.hit); await h.flush(); await h.advance(160); await h.advance(160); await work;
  assert.equal(h.getStore().open, false);
  const highlight = h.highlights.get('dsh-find-hit');
  assert.ok(highlight); assert.equal(highlight.priority, 1);
  assert.equal(highlight.range.startContainer, f.anchor.texts[0]); assert.equal(highlight.range.startOffset, 4);
  assert.equal(highlight.range.endContainer, f.anchor.texts[0]); assert.equal(highlight.range.endOffset, 10);
  assert.equal(f.paragraph.classes.size, 0);
  assert.equal(h.styles.length, 1); assert.match(h.styles[0].textContent, /::highlight\(dsh-find-hit\)/);
  await h.advance(2999); assert.equal(h.highlights.get('dsh-find-hit'), highlight);
  await h.advance(1); assert.equal(h.highlights.size, 0); assert.equal(h.timers.size, 0);
  h.dispose(); assert.equal(h.styles.length, 0);
});

test('a new jump clears the previous highlight before its next load finishes', async () => {
  const h = harness(), a = fixture(h, { session: 'a' }), b = fixture(h, { session: 'b' });
  const first = h.jumpToHit(a.hit); await h.flush(); await h.advance(160); await h.advance(160); await first;
  assert.equal(h.highlights.size, 1);
  let release; h.gates.set('b', new Promise(resolve => { release = resolve; }));
  const next = h.jumpToHit(b.hit); await h.flush(); assert.equal(h.highlights.size, 0);
  release(); await h.flush(); await h.advance(160); await h.advance(160); await next;
  assert.equal(h.highlights.size, 1);
  await h.advance(2680); assert.equal(h.highlights.size, 1); // past the old deadline
  await h.advance(320); assert.equal(h.highlights.size, 0); h.dispose();
});

test('disposal clears the highlight, style and timer without deleting another owner', async () => {
  const h = harness(), f = fixture(h);
  const work = h.jumpToHit(f.hit); await h.flush(); await h.advance(160); await h.advance(160); await work;
  const replacement = {}; h.highlights.set('dsh-find-hit', replacement);
  h.dispose(); assert.equal(h.highlights.get('dsh-find-hit'), replacement);
  assert.equal(h.styles.length, 0); assert.equal(h.timers.size, 0);
  const other = harness(), target = fixture(other);
  const second = other.jumpToHit(target.hit); await other.flush(); await other.advance(160); await other.advance(160); await second;
  other.dispose(); assert.equal(other.highlights.size, 0); assert.equal(other.styles.length, 0); assert.equal(other.timers.size, 0);
});

test('unsupported or failing highlight APIs keep a readable locator and honest notice', async () => {
  for (const mode of ['unsupported', 'throws', 'no-range']) {
    const h = harness({ nativeHighlight: mode !== 'unsupported', brokenHighlight: mode === 'throws' }), f = fixture(h);
    if (mode === 'no-range') h.document.createRange = undefined;
    const work = h.jumpToHit(f.hit); await h.flush(); await h.advance(160); await h.advance(160); await work;
    assert.equal(h.highlights.size, 0); assert.ok(f.anchor.classes.has('dsh-find-flash'));
    assert.equal(f.paragraph.classes.size, 0);
    assert.match(h.getStore().jumpNotice, /Located the original message/);
    await h.advance(3000); assert.equal(f.anchor.classes.size, 0); h.dispose();
  }
});

test('a range never paints excluded controls or hidden text between matching spans', async () => {
  for (const excluded of ['button', 'script', 'style', 'aria-hidden']) {
    const h = harness(), f = fixture(h, { text: 'needle' });
    const control = element({}, f.anchor); control.closest = selector => selector.includes(excluded) ? control : null;
    f.anchor.texts = [
      { nodeValue: 'nee', parentElement: f.paragraph },
      { nodeValue: 'copy', parentElement: control },
      { nodeValue: 'dle', parentElement: f.paragraph },
    ];
    const landing = h.textLanding(f.anchor, 'needle', 'needle', 0);
    assert.ok(landing); assert.equal(landing.range, null);
    const work = h.jumpToHit(f.hit); await h.flush(); await h.advance(160); await h.advance(160); await work;
    assert.equal(h.highlights.size, 0); assert.ok(f.anchor.classes.has('dsh-find-flash'));
    assert.equal(f.paragraph.classes.size, 0); assert.equal(control.classes.size, 0);
    assert.match(h.getStore().jumpNotice, /Located the original message/);
    await h.advance(3000); assert.equal(f.anchor.classes.size, 0); h.dispose();
  }
});

test('Unicode expansion, emoji and node boundaries produce exact UTF-16 range endpoints', () => {
  const h = harness(), a = element();
  const first = { nodeValue: '😀İ', parentElement: a }, second = { nodeValue: '尾', parentElement: a };
  a.texts = [first, second];
  const expanded = h.textLanding(a, 'i\u0307', '😀İ尾', 2);
  assert.equal(expanded.range.startContainer, first); assert.equal(expanded.range.startOffset, 2);
  assert.equal(expanded.range.endContainer, first); assert.equal(expanded.range.endOffset, 3);
  const emoji = h.textLanding(a, '😀', '😀İ尾', 0);
  assert.equal(emoji.range.startOffset, 0); assert.equal(emoji.range.endOffset, 2);
  const tail = h.textLanding(a, '尾', '😀İ尾', 3);
  assert.equal(tail.range.startContainer, second); assert.equal(tail.range.startOffset, 0); assert.equal(tail.range.endOffset, 1);
  const across = h.textLanding(a, 'İ尾', '😀İ尾', 2);
  assert.equal(across.range.startContainer, first); assert.equal(across.range.endContainer, second);
  h.dispose();
});

test('the opaque highlight pair stays high-contrast independent of the host or palette theme', () => {
  const h = harness(), css = h.styles[0].textContent;
  assert.match(css, /background-color:#ffe066;color:#1b1b1b;text-shadow:none/);
  const luminance = color => {
    const parts = color.match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
    return parts[0] * .2126 + parts[1] * .7152 + parts[2] * .0722;
  };
  assert.ok((luminance('ffe066') + .05) / (luminance('1b1b1b') + .05) > 13);
  h.dispose();
});

test('loads the original seq and scopes repeated text to its actual Chat node', async () => {
  const h = harness(), f = fixture(h);
  const wrong = element({ 'data-chat-node-key': 'other' }); wrong.session = 's'; wrong.texts = [{ nodeValue: 'needle', parentElement: wrong }]; h.anchors.unshift(wrong);
  const work = h.jumpToHit(f.hit); await h.flush(); await h.advance(160); await h.advance(160); await work;
  assert.deepEqual(h.loaded, [['s', 20]]);
  assert.equal(f.paragraph.scrolls.length, 1); assert.equal(wrong.scrolls.length, 0);
  assert.deepEqual(f.scroller.events, ['scroll', 'scrollend']);
  assert.equal(h.getStore().jumpNotice, ''); assert.equal(h.unsubscribed, 1);
  h.dispose(); assert.equal(f.paragraph.classes.size, 0);
});

test('node mapping uses final/result seq, not the assistant start anchor', () => {
  const h = harness();
  assert.equal(h.nodeOwnsHit({ anchorSeq: 20, data: { finalNode: { seq: 30 } } }, { seq: 20 }), false);
  assert.equal(h.nodeOwnsHit({ data: { root: { subCalls: [{ seq: 45 }] } } }, { seq: 45 }), true);
});

test('folded reasoning is revealed and inner scroll is committed before outer', async () => {
  const h = harness(), f = fixture(h, { channel: 'thinking', folded: true });
  const work = h.jumpToHit(f.hit); await h.flush(); await h.advance(160); await h.advance(160); await h.advance(80); await work;
  assert.equal(f.paragraph.scrolls.length, 1);
  assert.deepEqual(f.inner.events, ['wheel', 'scroll', 'scrollend']);
  assert.deepEqual(f.scroller.events, ['scroll', 'scrollend']); h.dispose();
});

test('latest click wins even if the previous load ignores cancellation', async () => {
  const h = harness(), a = fixture(h, { session: 'a' }), b = fixture(h, { session: 'b', key: 'b-key' });
  let release; h.gates.set('a', new Promise(resolve => { release = resolve; }));
  const first = h.jumpToHit(a.hit); await h.flush(); const second = h.jumpToHit(b.hit); await h.flush();
  await h.advance(160); await h.advance(160); await second; release(); await first; await h.flush();
  assert.equal(a.paragraph.scrolls.length, 0); assert.equal(b.paragraph.scrolls.length, 1); h.dispose();
});

test('navigation, trusted manual input and disposal cancel pending work', async () => {
  for (const cancel of [h => h.cancelNavigation(), h => h.intent('wheel'), h => h.intent('touchstart'), h => h.intent('keydown', ' '), h => h.intent('pointerdown'), h => h.intent('keydown', 'Escape'), h => h.dispose()]) {
    const h = harness(), f = fixture(h); const work = h.jumpToHit(f.hit); await h.flush(); cancel(h); await work; await h.advance(500);
    assert.equal(f.paragraph.scrolls.length, 0); assert.equal(h.unsubscribed, 1);
    assert.equal(h.getStore().jumpNotice, ''); assert.equal(h.timers.size, 0);
  }
});

test('archive and record identity failures do not scroll unrelated text', async () => {
  const h = harness(), f = fixture(h);
  await h.jumpToHit({ ...f.hit, archived: true }); assert.equal(h.opened.length, 0);
  const work = h.jumpToHit({ ...f.hit, location: { messageId: 'wrong' } }); await work;
  assert.match(h.getStore().jumpNotice, /Could not locate/); assert.equal(f.paragraph.scrolls.length, 0); assert.equal(h.unsubscribed, 1); h.dispose();
});

test('source context disambiguates repeated text and inline text is searchable', () => {
  const h = harness(), a = element(), p = element({}, a), q = element({}, a);
  a.texts = [{ nodeValue: 'first needle A ', parentElement: p }, { nodeValue: 'second nee', parentElement: q }, { nodeValue: 'dle B', parentElement: q }];
  const landing = h.textLanding(a, 'needle', 'second needle B', 7);
  assert.equal(landing.element, q);
  assert.equal(landing.range.startContainer, a.texts[1]); assert.equal(landing.range.startOffset, 7);
  assert.equal(landing.range.endContainer, a.texts[2]); assert.equal(landing.range.endOffset, 3);
  a.texts = [{ nodeValue: 'needle needle', parentElement: p }];
  assert.equal(h.textLanding(a, 'needle', undefined, undefined), null);
});

test('Unicode lowercase expansion selects the original text node', () => {
  const h = harness(), a = element(), prefix = element({}, a), match = element({}, a), tail = element({}, a);
  const text = 'İ'.repeat(7) + 'needle' + 'tail';
  a.texts = [{ nodeValue: 'İ'.repeat(7), parentElement: prefix }, { nodeValue: 'needle', parentElement: match }, { nodeValue: 'tail', parentElement: tail }];
  assert.equal(h.textLanding(a, 'needle', text, 7).element, match);
});

test('a unique word in the wrong content block is not an exact landing', () => {
  const h = harness(), a = element(); a.texts = [{ nodeValue: 'unrelated needle text', parentElement: a }];
  assert.equal(h.textLanding(a, 'needle', '[needle](https://example.test)', 1), null);
});

test('session roots and channel groups isolate reused node keys', () => {
  const h = harness(), a = fixture(h, { session: 'a' }), b = fixture(h, { session: 'b' });
  h.document.querySelectorAll = () => [...h.roots.values()];
  assert.deepEqual(Array.from(h.hitAnchors(h.snapshots.get('a'), a.hit)), [a.anchor]);
  assert.equal(h.hitAnchors(h.snapshots.get('a'), { ...a.hit, channel: 'thinking' }).length, 0);
  const duplicate = element({ 'data-conversation-content': '', 'data-conversation-session': 'a', 'data-content-phase': 'active' });
  h.roots.set('duplicate', duplicate);
  assert.equal(h.hitAnchors(h.snapshots.get('a'), a.hit).length, 0);
  assert.equal(b.paragraph.scrolls.length, 0);
});

test('an unambiguous collapsed reasoning row opens once before exact landing', async () => {
  const h = harness(), f = fixture(h, { channel: 'thinking' });
  let expanded = false, clicks = 0;
  const row = element(); row.hasAttribute = name => name === 'data-expanded' && expanded;
  row.querySelector = selector => {
    assert.equal(selector, '[data-disclosure-row][role="button"][aria-expanded="false"]');
    return { click() { clicks++; expanded = true; } };
  };
  f.anchor.querySelectorAll = () => [row];
  const work = h.jumpToHit(f.hit); await h.flush(); await h.advance(160); await h.advance(160); await h.advance(80); await work;
  assert.equal(clicks, 1); assert.equal(f.paragraph.scrolls.length, 1); h.dispose();
});

test('a collapsed summary and tool group use honest message-only fallback', async () => {
  for (const channel of ['thinking', 'tool']) {
    const h = harness(), f = fixture(h, channel === 'tool' ? { type: 'tool/result' } : { channel });
    if (channel === 'thinking') {
      const row = element(); row.querySelector = () => null; f.anchor.querySelectorAll = () => [row];
    }
    const work = h.jumpToHit(f.hit); await h.flush(); await h.advance(160); await h.advance(160); await h.advance(900); await work;
    assert.equal(f.paragraph.scrolls.length, 0); assert.equal(f.anchor.scrolls.length, 1);
    assert.match(h.getStore().jumpNotice, /Located the original message/); h.dispose();
  }
});

test('multiple matching anchors settle independently instead of resetting each other', async () => {
  const h = harness(), f = fixture(h);
  const second = element({ 'data-chat-node-key': 'message-key', 'data-chat-group-part': 'response' }, f.scroller);
  second.session = 's'; second.querySelectorAll = () => []; second.texts = f.anchor.texts; h.anchors.push(second);
  const work = h.jumpToHit(f.hit); await h.flush(); await h.advance(160); await h.advance(160); await work;
  assert.equal(f.paragraph.scrolls.length, 1); h.dispose();
});

test('a hidden target block cannot be replaced by another block containing its whole text', async () => {
  const h = harness(), f = fixture(h, { text: 'needle' });
  h.records.get('s')[0].event.data.message.content.push({ type: 'text', text: 'prefix needle suffix' });
  f.anchor.texts = [{ nodeValue: 'prefix needle suffix', parentElement: f.paragraph }];
  const work = h.jumpToHit(f.hit); await h.flush(); await h.advance(160); await h.advance(160); await h.advance(900); await work;
  assert.equal(f.paragraph.scrolls.length, 0); assert.equal(f.anchor.scrolls.length, 1);
  assert.match(h.getStore().jumpNotice, /Located the original message/); h.dispose();
});

test('fallback does not retain a detached anchor across React remounts', async () => {
  const h = harness(), f = fixture(h); f.anchor.texts = [];
  const work = h.jumpToHit(f.hit); await h.flush(); await h.advance(160); await h.advance(160);
  f.anchor.isConnected = false;
  const next = element({ 'data-chat-node-key': 'message-key', 'data-chat-group-part': 'response' }, f.scroller);
  next.session = 's'; next.querySelectorAll = () => []; h.anchors.push(next);
  await h.advance(900); await h.advance(160); await work;
  assert.equal(f.anchor.scrolls.length, 0); assert.equal(next.scrolls.length, 1); h.dispose();
});

test('message-only fallback is explicit and timeout is reported', async () => {
  const h = harness(), f = fixture(h); f.anchor.texts = [];
  const work = h.jumpToHit(f.hit); await h.flush(); await h.advance(160); await h.advance(160); await h.advance(900); await work;
  assert.equal(f.anchor.scrolls.length, 1); assert.match(h.getStore().jumpNotice, /Located the original message/); h.dispose();
  const pending = harness(), g = fixture(pending); pending.gates.set('s', new Promise(() => {}));
  const stalled = pending.jumpToHit(g.hit); await pending.flush(); await pending.advance(12000); await stalled;
  assert.match(pending.getStore().jumpNotice, /Could not locate/); pending.dispose();
});
