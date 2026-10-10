import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const context = vm.createContext({});
vm.runInContext(readFileSync(new URL('../launch/viewer-core.js', import.meta.url), 'utf8'), context);
const core = context.NocturneViewerCore;
const close = (actual, expected, tolerance = 1e-6) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} differs from ${expected}`);
const plain = value => JSON.parse(JSON.stringify(value));

function validateMesh(mesh) {
  assert.equal(mesh.positions.length % 3, 0);
  assert.equal(mesh.positions.length, mesh.normals.length);
  assert.equal(mesh.indices.length % 3, 0);
  for (const value of [...mesh.positions, ...mesh.normals]) assert.ok(Number.isFinite(value));
  for (let i = 0; i < mesh.normals.length; i += 3) close(Math.hypot(...mesh.normals.slice(i, i + 3)), 1);
  for (const index of mesh.indices) assert.ok(index >= 0 && index < mesh.positions.length / 3);
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const [a, b, c] = [...mesh.indices.slice(i, i + 3)].map(index => [...mesh.positions.slice(index * 3, index * 3 + 3)]);
    const u = b.map((v, j) => v - a[j]), v = c.map((n, j) => n - a[j]);
    const normal = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    assert.ok(Math.hypot(...normal) > 1e-8, 'triangle has area');
    const center = a.map((n, j) => (n + b[j] + c[j]) / 3);
    assert.ok(normal.reduce((sum, n, j) => sum + n * center[j], 0) > 0, 'triangle winding points outward');
  }
}

test('neutral cube has indexed, outward flat normals and 12 triangles', () => {
  const mesh = core.cubeGeometry(); validateMesh(mesh);
  assert.equal(mesh.positions.length / 3, 24); assert.equal(mesh.indices.length, 36);
});
test('neutral prism has indexed, outward flat normals and 8 triangles', () => {
  const mesh = core.prismGeometry(); validateMesh(mesh);
  assert.equal(mesh.positions.length / 3, 18); assert.equal(mesh.indices.length, 24);
});
for (const tier of ['low', 'balanced', 'high']) test(`sphere ${tier} normals, winding, counts and indices are valid`, () => {
  const { segments, rings } = core.QUALITY[tier], mesh = core.createGeometry('sphere', tier); validateMesh(mesh);
  assert.equal(mesh.positions.length / 3, (segments + 1) * (rings + 1));
  assert.equal(mesh.indices.length, 6 * segments * (rings - 1));
  for (let i = 0; i < mesh.positions.length; i++) close(mesh.positions[i], mesh.normals[i] * 1.1);
});
test('geometry handles unknown names and hostile resolutions with finite bounded geometry', () => {
  assert.equal(core.createGeometry('unknown').indices.length, 36);
  const mesh = core.sphereGeometry(Infinity, NaN); validateMesh(mesh);
  assert.ok(mesh.positions.length <= 65 * 49 * 3);
});
test('all surface materials use finite, bounded light parameters', () => {
  for (const material of Object.values(core.MATERIALS)) {
    for (const value of [...material.color, material.ambient, material.diffuse, material.specular]) assert.ok(Number.isFinite(value) && value >= 0 && value <= 1);
    assert.ok(Number.isFinite(material.shininess) && material.shininess >= 1 && material.shininess <= 128);
    assert.ok(Object.isFrozen(material));
  }
  assert.ok(core.MATERIALS.matte.specular < core.MATERIALS.satin.specular);
  assert.ok(core.MATERIALS.satin.specular < core.MATERIALS.gloss.specular);
});
test('transform updates are immutable, bounded and resettable', () => {
  const start = core.createTransform(), snapshot = plain(start);
  let value = core.moveTransform(start, { x: 100, y: -100, z: 100 });
  assert.deepEqual(plain(value.position), { x: core.LIMITS.x, y: -core.LIMITS.y, z: core.LIMITS.z });
  value = core.scaleTransform(value, 100); assert.equal(value.scale, core.LIMITS.maxScale);
  value = core.scaleTransform(value, 0.001); assert.equal(value.scale, core.LIMITS.minScale);
  value = core.rotateTransform(value, { x: 1000, y: -1000, z: 300 });
  for (const rotation of Object.values(value.rotation)) assert.ok(rotation >= -Math.PI && rotation <= Math.PI);
  assert.deepEqual(plain(start), snapshot);
  assert.deepEqual(plain(core.resetTransform()), snapshot);
  assert.notEqual(core.resetTransform().position, start.position);
});
test('invalid display inputs never produce nonfinite transforms or matrices', () => {
  for (const value of [undefined, null, {}, { position: { x: Infinity, y: NaN }, rotation: { x: Infinity, y: 'oops' }, scale: Infinity }]) {
    const transform = core.normalizeTransform(value);
    for (const number of [...Object.values(transform.position), ...Object.values(transform.rotation), transform.scale, ...core.modelMatrix(value), ...core.perspectiveMatrix(NaN)]) assert.ok(Number.isFinite(number));
  }
});
test('model matrix preserves uniform scale and translation with orthogonal normal axes', () => {
  const state = core.normalizeTransform({ position: { x: 1, y: -0.5, z: 0.2 }, rotation: { x: 0.3, y: -0.7, z: 0.2 }, scale: 1.5 });
  const matrix = core.modelMatrix(state);
  const axes = [0, 4, 8].map(i => [...matrix.slice(i, i + 3)]);
  for (const axis of axes) close(Math.hypot(...axis), state.scale);
  close(axes[0].reduce((sum, n, i) => sum + n * axes[1][i], 0), 0);
  close(matrix[12], 1); close(matrix[13], -0.5); close(matrix[14], 0.2); close(matrix[15], 1);
});
test('controller deadzone ignores drift and normalizes active axes', () => {
  for (const axis of [0, 0.149, -0.15, NaN, Infinity, undefined]) assert.equal(core.controllerAxis(axis), 0);
  close(core.controllerAxis(0.575), 0.5); close(core.controllerAxis(-0.575), -0.5);
  assert.equal(core.controllerAxis(5), 1); assert.equal(core.controllerAxis(-5), -1);
});
test('controller transforms are equivalent at 60, 72, 90 and 120 Hz', () => {
  const states = [60, 72, 90, 120].map(rate => {
    let state = core.createTransform();
    for (let i = 0; i < rate; i++) state = core.updateControllerTransform(state, { moveX: 0.4, moveY: -0.4, moveZ: 0.3, rotateX: 0.5, rotateY: -0.5, rotateZ: 0.7, scale: 0.6 }, 1 / rate);
    return state;
  });
  for (const state of states.slice(1)) {
    for (const group of ['position', 'rotation']) for (const axis of ['x', 'y', 'z']) close(state[group][axis], states[0][group][axis], 1e-10);
    close(state.scale, states[0].scale, 1e-10);
  }
});
test('controller updates bound long frames and ignore negative/nonfinite elapsed times', () => {
  const start = core.createTransform(), axes = { moveX: 1, rotateY: 1, scale: 1 };
  const long = core.updateControllerTransform(start, axes, 10), bounded = core.updateControllerTransform(start, axes, 0.05);
  assert.deepEqual(plain(long), plain(bounded));
  for (const dt of [-1, Infinity, NaN, undefined]) {
    const unchanged = core.updateControllerTransform(start, axes, dt);
    close(unchanged.position.x, start.position.x); close(unchanged.rotation.y, start.rotation.y); close(unchanged.scale, start.scale);
  }
});
test('timestamp helper rejects missing, first, invalid and backward frames and caps recovery jumps', () => {
  for (const [a, b] of [[undefined, 100], [null, 100], [100, undefined], [NaN, 100], [100, Infinity], [200, 100], [-1, 100]]) assert.equal(core.frameDelta(a, b), 0);
  close(core.frameDelta(0, 1000 / 90), 1 / 90);
  assert.equal(core.frameDelta(100, 10100), 0.05);
  assert.equal(core.frameDelta(100, 200, 0.025), 0.025);
});
test('pixel budgets honor all quality tiers and cap extreme viewports', () => {
  for (const [tier, maxDpr] of [['low', 1], ['balanced', 1.5], ['high', 2]]) {
    const size = core.viewportSize(320, 480, 4, tier);
    assert.equal(size.dpr, maxDpr); assert.equal(size.width, 320 * maxDpr); assert.equal(size.height, 480 * maxDpr);
  }
  for (const input of [[Infinity, NaN, -1], [20000, 12000, 8], [0, 0, 0]]) {
    const size = core.viewportSize(...input);
    assert.ok(size.width >= 1 && size.width <= 4096); assert.ok(size.height >= 1 && size.height <= 4096);
    assert.ok(Number.isFinite(size.dpr));
  }
});

// A deterministic DOM/WebGL boundary verifies lifecycle behavior without pretending
// to validate raster output. Real-browser and hardware checks remain separate.
function createViewerHarness({ webgl = true, reducedMotion = false, sharedReducedMotion = false, shaderFailure = false, storageSeed = {}, blockedStorage = false, quotaFailure = false } = {}) {
  class Target {
    constructor() { this.listeners = new Map(); this.dataset = {}; this.attributes = {}; this.hidden = false; this.disabled = false; this.checked = false; this.value = ''; this.textContent = ''; this.classes = new Set(); this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name) }; }
    addEventListener(name, fn) { const list = this.listeners.get(name) || []; list.push(fn); this.listeners.set(name, list); }
    dispatch(name, properties = {}) { const event = { target: this, preventDefault() { this.defaultPrevented = true; }, ...properties }; for (const fn of this.listeners.get(name) || []) fn(event); return event; }
    setAttribute(name, value) { this.attributes[name] = value; }
  }
  const source = readFileSync(new URL('../launch/model-viewer.html', import.meta.url), 'utf8');
  const elements = new Map([...source.matchAll(/\bid="([^"]+)"/g)].map(match => [match[1], new Target()]));
  const makeButtons = (key, values) => values.map(value => { const element = new Target(); element.dataset[key] = value; return element; });
  const groups = { '[data-viewer-mode]': makeButtons('viewerMode', ['rotate', 'move', 'scale']), '[data-viewer-shape]': makeButtons('viewerShape', ['cube', 'sphere', 'prism']), '[data-viewer-material]': makeButtons('viewerMaterial', ['matte', 'satin', 'gloss']), '[data-nudge]': makeButtons('nudge', ['left', 'down', 'up', 'right', 'rotate-left', 'rotate-right', 'tilt-up', 'tilt-down']) };
  elements.get('model-viewer').querySelectorAll = selector => groups[selector] || [...groups['[data-viewer-mode]'], ...groups['[data-nudge]'], ...['model-scale', 'reset-model', 'auto-rotate'].map(id => elements.get(id))];
  const document = new Target(); document.hidden = false; document.documentElement = { dataset: { nocturneMotion: sharedReducedMotion ? 'reduce' : 'system' } }; document.getElementById = id => elements.get(id);
  document.body = { prepend: element => elements.set(element.id, element) };
  document.createElement = () => { const element = new Target(); element.style = {}; return element; };
  const canvas = elements.get('model-canvas'), stage = elements.get('viewer-stage');
  canvas.width = 300; canvas.height = 150; canvas.focus = () => { document.activeElement = canvas; };
  const captured = new Set(); canvas.setPointerCapture = id => captured.add(id); canvas.hasPointerCapture = id => captured.has(id); canvas.releasePointerCapture = id => captured.delete(id);
  stage.clientWidth = 640; stage.clientHeight = 480; stage.getBoundingClientRect = () => ({ width: stage.clientWidth, height: stage.clientHeight });
  const calls = { draws: 0, buffers: 0, programs: 0, deletedShaders: 0, deletedBuffers: 0 }, gl = {};
  let lost = false;
  for (const [i, constant] of ['VERTEX_SHADER', 'FRAGMENT_SHADER', 'COMPILE_STATUS', 'LINK_STATUS', 'ARRAY_BUFFER', 'ELEMENT_ARRAY_BUFFER', 'STATIC_DRAW', 'COLOR_BUFFER_BIT', 'DEPTH_BUFFER_BIT', 'DEPTH_TEST', 'CULL_FACE', 'BACK', 'FLOAT', 'TRIANGLES', 'UNSIGNED_SHORT'].entries()) gl[constant] = i + 1;
  for (const method of ['shaderSource', 'compileShader', 'attachShader', 'linkProgram', 'deleteProgram', 'bindBuffer', 'bufferData', 'viewport', 'clearColor', 'clear', 'enable', 'cullFace', 'useProgram', 'enableVertexAttribArray', 'vertexAttribPointer', 'uniformMatrix4fv', 'uniform3fv', 'uniform3f', 'uniform4f']) gl[method] = () => {};
  gl.createShader = type => ({ type }); gl.getShaderParameter = () => !shaderFailure; gl.getProgramParameter = () => true;
  gl.createBuffer = () => ({ id: ++calls.buffers }); gl.createProgram = () => ({ id: ++calls.programs });
  gl.getAttribLocation = () => 1; gl.getUniformLocation = () => ({}); gl.isContextLost = () => lost;
  gl.drawElements = () => { calls.draws++; }; gl.deleteShader = () => { calls.deletedShaders++; }; gl.deleteBuffer = () => { calls.deletedBuffers++; };
  canvas.getContext = () => webgl ? gl : null;
  const motion = new Target(); motion.matches = reducedMotion;
  const window = new Target(); window.matchMedia = () => motion; window.innerWidth = 1024; window.devicePixelRatio = 3;
  window.document = document;
  const nativeData = new Map(Object.entries(storageSeed));
  function nativeStorage(data) { return { get length() { return data.size; }, key: i => [...data.keys()][i] ?? null, getItem: key => data.get(key) ?? null, setItem: (key, value) => { if (quotaFailure) throw Error('quota'); data.set(key, value); }, removeItem: key => data.delete(key), clear: () => data.clear() }; }
  for (const [name, data] of [['localStorage', nativeData], ['sessionStorage', new Map()]]) Object.defineProperty(window, name, { configurable: true, get() { if (blockedStorage) throw Error('blocked'); return nativeStorage(data); } });
  const frames = new Map(); let frameNumber = 0;
  const sandbox = { window, document, navigator: { hardwareConcurrency: 8 }, requestAnimationFrame: fn => { const id = ++frameNumber; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id), ResizeObserver: class { observe() {} } };
  vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../launch/browser-storage.js', import.meta.url), 'utf8'), sandbox);
  vm.runInContext(readFileSync(new URL('../launch/viewer-core.js', import.meta.url), 'utf8'), sandbox);
  vm.runInContext(readFileSync(new URL('../launch/model-viewer.js', import.meta.url), 'utf8'), sandbox);
  return {
    elements, groups, window, document, canvas, stage, motion, calls, frames, nativeData,
    state: () => plain(window.NocturneModelViewer.getState()),
    tick(time) { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(fn => fn(time)); },
    setLost(value) { lost = value; },
    button(group, key, value) { return groups[group].find(button => button.dataset[key] === value); }
  };
}

test('viewer renders on demand and exposes working material, shape, keyboard and reset controls', () => {
  const app = createViewerHarness();
  assert.equal(app.state().contextState, 'ready');
  assert.equal(app.frames.size, 1); app.tick(0); assert.equal(app.calls.draws, 1); assert.equal(app.frames.size, 0);
  app.button('[data-viewer-shape]', 'viewerShape', 'sphere').dispatch('click');
  app.button('[data-viewer-material]', 'viewerMaterial', 'gloss').dispatch('click');
  assert.equal(app.state().shape, 'sphere'); assert.equal(app.state().material, 'gloss');
  const initial = app.state().transform;
  const event = app.canvas.dispatch('keydown', { key: 'ArrowRight' });
  assert.equal(event.defaultPrevented, true); assert.ok(app.state().transform.rotation.y > initial.rotation.y);
  app.canvas.dispatch('keydown', { key: 'ArrowLeft', shiftKey: true }); assert.ok(app.state().transform.position.x < 0);
  app.canvas.dispatch('keydown', { key: '+' }); assert.ok(app.state().transform.scale > 1);
  app.canvas.dispatch('keydown', { key: 'r' }); assert.deepEqual(app.state().transform, plain(core.normalizeTransform(core.resetTransform())));
  assert.equal(app.state().shape, 'sphere'); assert.equal(app.state().material, 'gloss');
});
test('pointer drag, pinch and cancellation retain bounded view state without stuck pointers', () => {
  const app = createViewerHarness(); app.tick(0);
  app.canvas.dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', clientX: 100, clientY: 100 });
  app.canvas.dispatch('pointermove', { pointerId: 1, clientX: 125, clientY: 110 });
  assert.notEqual(app.state().transform.rotation.y, core.createTransform().rotation.y);
  app.canvas.dispatch('pointerdown', { pointerId: 2, pointerType: 'touch', clientX: 175, clientY: 110 });
  app.canvas.dispatch('pointermove', { pointerId: 2, clientX: 225, clientY: 110 });
  assert.ok(app.state().transform.scale > 1); assert.ok(app.state().transform.scale <= core.LIMITS.maxScale);
  app.canvas.dispatch('pointercancel', { pointerId: 1 }); app.canvas.dispatch('lostpointercapture', { pointerId: 2 });
  assert.equal(app.state().activePointers, 0);
  const state = app.state().transform;
  app.canvas.dispatch('pointermove', { pointerId: 1, clientX: 500, clientY: 500 }); assert.deepEqual(app.state().transform, state);
  app.canvas.dispatch('pointerdown', { pointerId: 3, pointerType: 'mouse', button: 2, clientX: 0, clientY: 0 }); assert.equal(app.state().activePointers, 0);
});
test('context loss pauses drawing and restoration rebuilds resources while preserving choices', () => {
  const app = createViewerHarness(); app.tick(0);
  app.canvas.dispatch('keydown', { key: '+' });
  app.button('[data-viewer-shape]', 'viewerShape', 'prism').dispatch('click');
  const before = app.state(), buffers = app.calls.buffers;
  app.setLost(true); const event = app.canvas.dispatch('webglcontextlost');
  assert.equal(event.defaultPrevented, true); assert.equal(app.state().contextState, 'lost'); assert.equal(app.frames.size, 0);
  assert.equal(app.elements.get('viewer-unavailable').hidden, false);
  assert.equal(app.elements.get('model-scale').disabled, true);
  app.setLost(false); app.canvas.dispatch('webglcontextrestored'); app.tick(10000);
  assert.equal(app.state().contextState, 'ready'); assert.equal(app.state().recoveredCount, 1);
  assert.deepEqual(app.state().transform, before.transform); assert.equal(app.state().shape, 'prism');
  assert.equal(app.calls.buffers, buffers + 3); assert.equal(app.elements.get('viewer-unavailable').hidden, true);
});
test('system and shared reduced-motion preferences prevent autonomous rotation', () => {
  for (const settings of [{ reducedMotion: true }, { sharedReducedMotion: true }]) {
    const app = createViewerHarness(settings); app.tick(0);
    assert.equal(app.elements.get('auto-rotate').disabled, true);
    app.elements.get('auto-rotate').checked = true; app.elements.get('auto-rotate').dispatch('change'); app.tick(100);
    assert.equal(app.state().autoRotate, false); assert.equal(app.frames.size, 0);
  }
  const app = createViewerHarness(); app.tick(0);
  app.elements.get('auto-rotate').checked = true; app.elements.get('auto-rotate').dispatch('change'); app.tick(1); app.tick(1001);
  close(app.state().transform.rotation.y - core.createTransform().rotation.y, 0.05 * 0.22);
  app.document.documentElement.dataset.nocturneMotion = 'reduce'; app.window.dispatch('nocturne:display-preferences', { detail: { reduceMotion: true } }); app.tick(1100);
  assert.equal(app.state().autoRotate, false); assert.equal(app.frames.size, 0);
});
test('hidden/pagehide pause and pageshow resumes without a giant animation step', () => {
  const app = createViewerHarness(); app.tick(0);
  app.elements.get('auto-rotate').checked = true; app.elements.get('auto-rotate').dispatch('change'); app.tick(100);
  app.document.hidden = true; app.document.dispatch('visibilitychange'); assert.equal(app.frames.size, 0);
  const before = app.state().transform.rotation.y;
  app.document.hidden = false; app.document.dispatch('visibilitychange'); app.tick(30000); close(app.state().transform.rotation.y, before);
  app.window.dispatch('pagehide'); assert.equal(app.frames.size, 0);
  app.window.dispatch('pageshow'); app.tick(60000); close(app.state().transform.rotation.y, before);
});
test('quality switches reallocate a bounded viewport and WebGL failure is visibly recoverable', () => {
  const app = createViewerHarness();
  assert.equal(app.state().canvasWidth, 960);
  app.elements.get('viewer-quality').value = 'low'; app.elements.get('viewer-quality').dispatch('change');
  assert.equal(app.state().quality, 'low'); assert.equal(app.state().canvasWidth, 640);
  app.stage.clientWidth = 320; app.stage.clientHeight = 300; app.window.dispatch('resize');
  assert.equal(app.state().canvasWidth, 320); assert.equal(app.state().canvasHeight, 300);
  for (const settings of [{ webgl: false }, { shaderFailure: true }]) {
    const failed = createViewerHarness(settings);
    assert.equal(failed.state().contextState, 'unavailable'); assert.equal(failed.frames.size, 0);
    assert.equal(failed.elements.get('viewer-unavailable').hidden, false); assert.equal(failed.elements.get('retry-renderer').hidden, false);
    assert.ok(failed.elements.get('viewer-status').textContent.length > 20);
    failed.elements.get('retry-renderer').dispatch('click'); assert.equal(failed.state().contextState, 'unavailable');
  }
});

const preferenceKey = 'nocturne.model-viewer.preferences.v1';
test('viewer restores versioned neutral choices, never transforms or autonomous motion', () => {
  const saved = { version: 1, shape: 'sphere', material: 'gloss', quality: 'high', autoRotate: true, transform: { scale: 1.8 } };
  const app = createViewerHarness({ storageSeed: { [preferenceKey]: JSON.stringify(saved) } });
  assert.equal(app.state().shape, 'sphere'); assert.equal(app.state().material, 'gloss'); assert.equal(app.state().quality, 'high');
  assert.equal(app.state().qualityPreference, 'high'); assert.equal(app.elements.get('viewer-quality').value, 'high');
  assert.equal(app.button('[data-viewer-shape]', 'viewerShape', 'sphere').attributes['aria-pressed'], 'true');
  assert.equal(app.button('[data-viewer-material]', 'viewerMaterial', 'gloss').attributes['aria-pressed'], 'true');
  assert.equal(app.state().autoRotate, false); assert.equal(app.state().transform.scale, 1);
  app.button('[data-viewer-shape]', 'viewerShape', 'prism').dispatch('click');
  app.elements.get('viewer-quality').value = 'low'; app.elements.get('viewer-quality').dispatch('change');
  assert.deepEqual(JSON.parse(app.nativeData.get(preferenceKey)), { version: 1, shape: 'prism', material: 'gloss', quality: 'low' });
  const reloaded = createViewerHarness({ storageSeed: Object.fromEntries(app.nativeData) });
  assert.equal(reloaded.state().shape, 'prism'); assert.equal(reloaded.state().quality, 'low');
});
test('malformed, oversized and unknown viewer preferences safely fall back without erasing saved data', () => {
  for (const raw of ['{broken', 'null', '[]', JSON.stringify({ version: 2, shape: 'sphere', material: 'gloss', quality: 'high' }), JSON.stringify({ version: 1, shape: 'unknown', material: ['gloss'], quality: '<script>' }), ' '.repeat(513) + '{"version":1}']) {
    const app = createViewerHarness({ storageSeed: { [preferenceKey]: raw } });
    assert.equal(app.state().contextState, 'ready'); assert.equal(app.state().shape, 'cube'); assert.equal(app.state().material, 'satin'); assert.equal(app.state().qualityPreference, 'auto');
    assert.equal(app.nativeData.get(preferenceKey), raw, 'startup does not rewrite or delete saved data');
  }
  assert.deepEqual(plain(core.normalizePreferences({ version: 1, shape: 'sphere', material: 'invalid', quality: 'low' })), { version: 1, shape: 'sphere', material: 'satin', quality: 'low' });
});
test('blocked or full storage retains working controls and a visible temporary-storage warning', () => {
  for (const settings of [{ blockedStorage: true }, { quotaFailure: true }]) {
    const app = createViewerHarness({ ...settings, storageSeed: { unrelated: 'preserve' } });
    app.button('[data-viewer-shape]', 'viewerShape', 'prism').dispatch('click');
    app.button('[data-viewer-material]', 'viewerMaterial', 'matte').dispatch('click');
    assert.equal(app.state().contextState, 'ready'); assert.equal(app.state().shape, 'prism'); assert.equal(app.state().material, 'matte');
    assert.match(app.elements.get('nocturne-storage-warning').textContent, /only last on this page/);
    assert.equal(app.nativeData.get('unrelated'), 'preserve'); assert.equal(app.nativeData.has(preferenceKey), false);
    assert.deepEqual(JSON.parse(app.window.NocturneStorage.local.getItem(preferenceKey)), { version: 1, shape: 'prism', material: 'matte', quality: 'auto' });
  }
});
