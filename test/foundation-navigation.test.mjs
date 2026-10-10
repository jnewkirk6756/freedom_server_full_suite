import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { readNavigationState, writeNavigationState, screenKey, rememberSetupDialog } from '../launch/navigation-state.js';

const source = (await readFile(new URL('../launch/navigation.js', import.meta.url), 'utf8')).replace(/^import[^\n]+\n/, '');
const prefix = 'nocturne.navigation.v1.';
function storage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}
function target(properties = {}) {
  const listeners = new Map();
  return Object.assign({
    addEventListener(type, handler, options = {}) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push({ handler, once: options.once });
    },
    dispatch(type, details = {}) {
      for (const listener of [...(listeners.get(type) || [])]) {
        if (listener.once) listeners.set(type, listeners.get(type).filter(item => item !== listener));
        listener.handler({ type, ...details });
      }
    }
  }, properties);
}
function page({ store = storage(), href = 'https://nocturne.test/', loading = false, withBoot = false, missingUI = false } = {}) {
  const location = new URL(href), events = [], observers = [], scrolls = [];
  const state = { reloads: 0, settingsClicks: 0, focus: 0, speechStops: 0, vibrationStops: 0, assignments: [] };
  location.reload = () => { state.reloads++; };
  location.assign = path => state.assignments.push(path);
  const menu = target({ open: false, contains: item => item === menu,
    querySelector: () => ({ focus: () => { state.focus++; } }) });
  const input = target({ value: '' }), line = target({ textContent: 'initial line' });
  const boot = target({ open: withBoot });
  const elements = new Map([
    ['nocturne-screen-menu', menu], ['nocturne-edit-setup', target()],
    ['settings', { click: () => { state.settingsClicks++; } }]
  ]);
  if (!missingUI) { elements.set('message', input); elements.set('anna-line', line); elements.set('last-line', line); }
  if (withBoot) elements.set('boot', boot);
  const document = target({ readyState: loading ? 'loading' : 'complete', visibilityState: 'visible',
    getElementById: id => elements.get(id) || null,
    querySelector: () => boot.open ? boot : null
  });
  const window = target({ scrollY: 0, speechSynthesis: { cancel: () => { state.speechStops++; } },
    dispatchEvent(event) { events.push(event); this.dispatch(event.type, event); }
  });
  const context = vm.createContext({ window, document, location, URL,
    navigator: { vibrate: () => { state.vibrationStops++; } },
    CustomEvent: class { constructor(type, properties = {}) { this.type = type; Object.assign(this, properties); } },
    MutationObserver: class { constructor(callback) { this.callback = callback; } observe(node, options) { observers.push({ node, options, callback: this.callback }); } },
    requestAnimationFrame: callback => callback(), scrollTo: (...args) => scrolls.push(args),
    screenKey: pathname => screenKey(pathname ?? location.pathname),
    readNavigationState: key => readNavigationState(key, store, 10000),
    writeNavigationState: (key, value) => writeNavigationState(key, value, store, 10000)
  });
  vm.runInContext(source, context);
  return { store, window, document, elements, menu, input, line, boot, events, observers, scrolls, state,
    click(href, options = {}) {
      const anchor = { href, target: options.target || '', hasAttribute: name => name === 'download' && Boolean(options.download) };
      document.dispatch('click', { button: 0, target: { closest: () => anchor }, ...options, ...(typeof options.target === 'string' ? { target: { closest: () => anchor } } : {}) });
    }
  };
}

test('stored snapshots reject primitives, arrays, malformed records, invalid clocks and oversized data', () => {
  const s = storage();
  for (const value of [null, false, 42, 'draft', [], { at: 10000 }, { at: '10000', value: {} }, { at: 10000, value: [] }, { at: 10000, value: 'draft' }]) {
    s.setItem(prefix + 'screen.home', JSON.stringify(value));
    assert.equal(readNavigationState('screen.home', s, 10000), null);
  }
  assert.equal(writeNavigationState('screen.home', { draft: 'x'.repeat(100000) }, s, 10000), false);
  s.setItem(prefix + 'screen.home', JSON.stringify({ at: 10000, value: { draft: 'x'.repeat(100000) } }));
  assert.equal(readNavigationState('screen.home', s, 10000), null);
  for (const value of [null, 42, false, 'draft', []]) assert.equal(writeNavigationState('x', value, s, 10000), false);
  assert.equal(writeNavigationState('x', {}, s, NaN), false);
  writeNavigationState('x', {}, s, 10000);
  assert.equal(readNavigationState('x', s, NaN), null);
});

test('snapshots expire after twelve hours and reject future timestamps', () => {
  const s = storage();
  writeNavigationState('x', { draft: 'hello' }, s, 10000);
  assert.deepEqual(readNavigationState('x', s, 10000 + 12 * 3600000), { draft: 'hello' });
  assert.equal(readNavigationState('x', s, 10000 + 12 * 3600000 + 1), null);
  assert.equal(readNavigationState('x', s, 9999), null);
});

test('initialization restores bounded text and non-negative finite scroll positions', () => {
  const s = storage();
  writeNavigationState('screen.home', { draft: 'd'.repeat(3000), line: 'l'.repeat(5000), scrollY: 140 }, s, 10000);
  const h = page({ store: s });
  assert.equal(h.input.value.length, 2400);
  assert.equal(h.line.textContent.length, 4000);
  assert.deepEqual(h.scrolls, [[0, 140]]);
  assert.equal(h.observers.length, 1);
  for (const scrollY of [-1, '140', null]) {
    writeNavigationState('screen.home', { draft: 'saved', scrollY }, s, 10000);
    assert.deepEqual(page({ store: s }).scrolls, []);
  }
});

test('malformed stored fields and blocked storage cannot break page initialization', () => {
  const s = storage();
  writeNavigationState('screen.home', { draft: 42, line: {}, scrollY: 'bad' }, s, 10000);
  const h = page({ store: s });
  assert.equal(h.input.value, '');
  assert.equal(h.line.textContent, 'initial line');
  const blocked = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  const blockedPage = page({ store: blocked });
  assert.doesNotThrow(() => blockedPage.input.dispatch('input'));
  assert.doesNotThrow(() => page({ missingUI: true }).window.dispatch('pagehide'));
});

test('loading documents restore once after DOMContentLoaded and do not overwrite snapshots early', () => {
  const s = storage();
  writeNavigationState('screen.home', { draft: 'saved' }, s, 10000);
  const h = page({ store: s, loading: true });
  h.window.dispatch('pagehide');
  assert.equal(readNavigationState('screen.home', s, 10000).draft, 'saved');
  assert.equal(h.input.value, '');
  h.document.dispatch('DOMContentLoaded');
  assert.equal(h.input.value, 'saved');
  h.document.dispatch('DOMContentLoaded');
  assert.equal(h.observers.length, 1);
});

test('input, line mutation and pagehide persist UI state under the shared Home alias', () => {
  const h = page({ href: 'https://nocturne.test/experience/' });
  h.input.value = 'unfinished draft';
  h.window.scrollY = 88;
  h.input.dispatch('input');
  assert.deepEqual(readNavigationState('screen.home', h.store, 10000), { draft: 'unfinished draft', line: 'initial line', scrollY: 88 });
  h.line.textContent = 'updated line';
  h.observers[0].callback();
  assert.equal(readNavigationState('screen.home', h.store, 10000).line, 'updated line');
  h.input.value = 'd'.repeat(3000);
  h.line.textContent = 'l'.repeat(5000);
  h.window.dispatch('pagehide');
  const saved = readNavigationState('screen.home', h.store, 10000);
  assert.equal(saved.draft.length, 2400);
  assert.equal(saved.line.length, 4000);
  assert.deepEqual([...h.store.data.keys()], [prefix + 'screen.home']);
});

test('same-origin screen transitions save first; modified, external and fragment-only clicks do not suspend', () => {
  const h = page();
  for (const [href, options] of [
    ['https://other.test/', {}], ['/#section', {}], ['/world/', { ctrlKey: true }],
    ['/world/', { metaKey: true }], ['/world/', { shiftKey: true }], ['/world/', { altKey: true }],
    ['/world/', { button: 1 }], ['/world/', { defaultPrevented: true }],
    ['/world/', { target: '_blank' }], ['/world/', { download: true }]
  ]) h.click(href, options);
  assert.equal(h.events.length, 0);
  h.input.value = 'saved before navigation';
  h.click('/world/');
  assert.deepEqual(h.events.map(event => event.type), ['nocturne:suspend']);
  assert.equal(readNavigationState('screen.home', h.store, 10000).draft, 'saved before navigation');
});

test('hidden-page suspension saves UI and never dispatches a resume or permission event', () => {
  const h = page();
  h.input.value = 'background draft';
  h.document.visibilityState = 'hidden';
  h.document.dispatch('visibilitychange');
  assert.equal(readNavigationState('screen.home', h.store, 10000).draft, 'background draft');
  h.document.visibilityState = 'visible';
  h.document.dispatch('visibilitychange');
  assert.deepEqual(h.events.map(event => event.type), ['nocturne:suspend']);
});

test('BFCache restoration retains deliberate runtime reload and restores saved UI on the new page', () => {
  const h = page();
  h.input.value = 'draft before Back';
  h.line.textContent = 'saved line';
  h.window.scrollY = 210;
  h.window.dispatch('pagehide');
  h.window.dispatch('pageshow', { persisted: true });
  assert.equal(h.state.reloads, 1);
  const restored = page({ store: h.store });
  assert.equal(restored.input.value, 'draft before Back');
  assert.equal(restored.line.textContent, 'saved line');
  assert.deepEqual(restored.scrolls, [[0, 210]]);
  restored.menu.open = true;
  restored.window.dispatch('pageshow', { persisted: false });
  assert.equal(restored.menu.open, false);
  assert.equal(restored.state.reloads, 0);
});

test('Escape and outside clicks close More without breaking keyboard focus', () => {
  const h = page();
  h.menu.open = true;
  h.document.dispatch('keydown', { key: 'Escape' });
  assert.equal(h.menu.open, false);
  assert.equal(h.state.focus, 1);
  h.menu.open = true;
  h.document.dispatch('click', { target: {} });
  assert.equal(h.menu.open, false);
});

test('requested settings wait for initial setup to close and open only once', () => {
  const h = page({ href: 'https://nocturne.test/?panel=settings', withBoot: true });
  assert.equal(h.state.settingsClicks, 0);
  h.boot.open = false;
  h.boot.dispatch('close');
  h.boot.dispatch('close');
  assert.equal(h.state.settingsClicks, 1);
  assert.equal(page({ href: 'https://nocturne.test/?panel=settings' }).state.settingsClicks, 1);
});

test('setup remains explicitly reopenable with a route fallback on screens without a dialog', () => {
  const h = page({ withBoot: true });
  h.menu.open = true;
  h.elements.get('nocturne-edit-setup').dispatch('click');
  assert.equal(h.menu.open, false);
  assert.deepEqual(h.events.map(event => [event.type, event.detail?.screen]), [['nocturne:setup', 'home']]);
  const other = page({ href: 'https://nocturne.test/world/' });
  other.elements.get('nocturne-edit-setup').dispatch('click');
  assert.deepEqual(other.state.assignments, ['/experience/?panel=setup']);
});

test('setup cancellation saves nothing and sensitive form controls are excluded', () => {
  const previous = { window: globalThis.window, storage: globalThis.sessionStorage };
  const s = storage(), w = target();
  const fields = [
    { id: 'label', type: 'text', value: 'chosen label' }, { id: 'option', type: 'checkbox', checked: true },
    { id: 'secret', type: 'password', value: 'test-only' }, { id: 'upload', type: 'file', value: 'test-only' },
    { id: 'hidden', type: 'hidden', value: 'test-only' }
  ];
  const form = target({ querySelectorAll: () => fields });
  let opens = 0;
  const dialog = { open: false, querySelector: () => form, showModal() { this.open = true; opens++; } };
  try {
    globalThis.window = w;
    globalThis.sessionStorage = s;
    assert.equal(rememberSetupDialog(dialog, 'home'), false);
    assert.equal(opens, 1);
    form.dispatch('submit', { submitter: { value: 'cancel' } });
    form.dispatch('submit', { submitter: { value: 'later' } });
    form.dispatch('submit', { defaultPrevented: true });
    assert.equal(s.data.size, 0);
    form.dispatch('submit', { submitter: { value: 'continue' } });
    assert.deepEqual(readNavigationState('setup.home', s), { label: 'chosen label', option: true });
    dialog.open = false;
    w.dispatch('nocturne:setup', { detail: { screen: 'other' } });
    assert.equal(opens, 1);
    w.dispatch('nocturne:setup', { detail: { screen: 'home' } });
    assert.equal(opens, 2);
  } finally {
    if (previous.window === undefined) delete globalThis.window; else globalThis.window = previous.window;
    if (previous.storage === undefined) delete globalThis.sessionStorage; else globalThis.sessionStorage = previous.storage;
  }
});
