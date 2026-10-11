/* Neutral display geometry and transforms. No application state or network access. */
(function (root) {
  'use strict';
  const TAU = Math.PI * 2;
  const LIMITS = Object.freeze({ x: 1.5, y: 1.25, z: 1, minScale: 0.35, maxScale: 1.8, maxDeltaSeconds: 0.05, deadzone: 0.15 });
  const MATERIALS = Object.freeze({
    matte: Object.freeze({ color: Object.freeze([0.49, 0.36, 0.78]), ambient: 0.24, diffuse: 0.8, specular: 0.06, shininess: 8 }),
    satin: Object.freeze({ color: Object.freeze([0.49, 0.36, 0.78]), ambient: 0.2, diffuse: 0.76, specular: 0.36, shininess: 42 }),
    gloss: Object.freeze({ color: Object.freeze([0.49, 0.36, 0.78]), ambient: 0.18, diffuse: 0.68, specular: 0.85, shininess: 100 })
  });
  const QUALITY = Object.freeze({
    low: Object.freeze({ dpr: 1, segments: 16, rings: 12 }),
    balanced: Object.freeze({ dpr: 1.5, segments: 28, rings: 20 }),
    high: Object.freeze({ dpr: 2, segments: 48, rings: 32 })
  });
  function finite(value, fallback = 0) { const number = Number(value); return Number.isFinite(number) ? number : fallback; }
  function clamp(value, min, max) { return Math.max(min, Math.min(max, finite(value, min))); }
  function wrapAngle(value) { return ((finite(value) + Math.PI) % TAU + TAU) % TAU - Math.PI; }
  function createTransform() { return { position: { x: 0, y: 0, z: 0 }, rotation: { x: -0.18, y: 0.55, z: 0 }, scale: 1 }; }
  function normalizeTransform(value) {
    const initial = createTransform(), input = value || {};
    return {
      position: { x: clamp(finite(input.position?.x), -LIMITS.x, LIMITS.x), y: clamp(finite(input.position?.y), -LIMITS.y, LIMITS.y), z: clamp(finite(input.position?.z), -LIMITS.z, LIMITS.z) },
      rotation: { x: wrapAngle(finite(input.rotation?.x, initial.rotation.x)), y: wrapAngle(finite(input.rotation?.y, initial.rotation.y)), z: wrapAngle(input.rotation?.z) },
      scale: clamp(finite(input.scale, 1), LIMITS.minScale, LIMITS.maxScale)
    };
  }
  function moveTransform(value, delta = {}) {
    const next = normalizeTransform(value);
    for (const axis of ['x', 'y', 'z']) next.position[axis] += finite(delta[axis]);
    return normalizeTransform(next);
  }
  function rotateTransform(value, delta = {}) {
    const next = normalizeTransform(value);
    for (const axis of ['x', 'y', 'z']) next.rotation[axis] += finite(delta[axis]);
    return normalizeTransform(next);
  }
  function scaleTransform(value, factor) {
    const next = normalizeTransform(value);
    next.scale *= clamp(finite(factor, 1), 0.01, 100);
    return normalizeTransform(next);
  }
  function axisWithDeadzone(value, threshold = LIMITS.deadzone) {
    const axis = clamp(finite(value), -1, 1), deadzone = clamp(threshold, 0, 0.95);
    return Math.abs(axis) <= deadzone ? 0 : Math.sign(axis) * (Math.abs(axis) - deadzone) / (1 - deadzone);
  }
  function boundedDelta(seconds) { return clamp(finite(seconds), 0, LIMITS.maxDeltaSeconds); }
  function frameDelta(previousTimestamp, currentTimestamp, maxSeconds = LIMITS.maxDeltaSeconds) {
    if (typeof previousTimestamp !== 'number' || typeof currentTimestamp !== 'number' || !Number.isFinite(previousTimestamp) || !Number.isFinite(currentTimestamp) || previousTimestamp < 0 || currentTimestamp < previousTimestamp) return 0;
    return Math.min((currentTimestamp - previousTimestamp) / 1000, clamp(maxSeconds, 0, LIMITS.maxDeltaSeconds));
  }
  function updateControllerTransform(value, axes = {}, dtSeconds = 0) {
    const dt = boundedDelta(dtSeconds), next = normalizeTransform(value);
    for (const axis of ['x', 'y', 'z']) {
      const name = axis.toUpperCase();
      next.position[axis] += axisWithDeadzone(axes['move' + name]) * 0.8 * dt;
      next.rotation[axis] += axisWithDeadzone(axes['rotate' + name]) * 1.2 * dt;
    }
    next.scale *= Math.exp(axisWithDeadzone(axes.scale) * 0.65 * dt);
    return normalizeTransform(next);
  }
  function multiply4(a, b) {
    const out = new Float32Array(16);
    for (let col = 0; col < 4; col++) for (let row = 0; row < 4; row++) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += a[k * 4 + row] * b[col * 4 + k];
      out[col * 4 + row] = sum;
    }
    return out;
  }
  function modelMatrix(value) {
    const t = normalizeTransform(value), { x, y, z } = t.rotation;
    const sx = Math.sin(x), cx = Math.cos(x), sy = Math.sin(y), cy = Math.cos(y), sz = Math.sin(z), cz = Math.cos(z);
    const rx = [1, 0, 0, 0, 0, cx, sx, 0, 0, -sx, cx, 0, 0, 0, 0, 1];
    const ry = [cy, 0, -sy, 0, 0, 1, 0, 0, sy, 0, cy, 0, 0, 0, 0, 1];
    const rz = [cz, sz, 0, 0, -sz, cz, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
    const out = multiply4(rz, multiply4(ry, rx));
    for (let i = 0; i < 12; i++) out[i] *= t.scale;
    out[12] = t.position.x; out[13] = t.position.y; out[14] = t.position.z;
    return out;
  }
  function perspectiveMatrix(aspect, distance = 6.5) {
    const ratio = clamp(finite(aspect, 1), 0.1, 10), f = 1 / Math.tan(Math.PI / 8), near = 0.1, far = 100;
    const projection = new Float32Array([f / ratio, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0]);
    const view = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -clamp(distance, 2, 50), 1]);
    return multiply4(projection, view);
  }
  function flatMesh(faces) {
    const positions = [], normals = [], indices = [];
    for (const face of faces) {
      const a = face[0], b = face[1], c = face[2], u = b.map((v, i) => v - a[i]), v = c.map((n, i) => n - a[i]);
      const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const length = Math.hypot(...n), start = positions.length / 3;
      for (const vertex of face) { positions.push(...vertex); normals.push(...n.map(component => component / length)); }
      for (let i = 1; i < face.length - 1; i++) indices.push(start, start + i, start + i + 1);
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
  }
  function cubeGeometry() {
    const n = -0.85, p = 0.85;
    return flatMesh([
      [[n, n, p], [p, n, p], [p, p, p], [n, p, p]], [[p, n, n], [n, n, n], [n, p, n], [p, p, n]],
      [[p, n, p], [p, n, n], [p, p, n], [p, p, p]], [[n, n, n], [n, n, p], [n, p, p], [n, p, n]],
      [[n, p, p], [p, p, p], [p, p, n], [n, p, n]], [[n, n, n], [p, n, n], [p, n, p], [n, n, p]]
    ]);
  }
  function prismGeometry() {
    const a = [-1, -0.75], b = [1, -0.75], c = [0, 1];
    const point = (p, z) => [p[0], p[1], z];
    return flatMesh([
      [point(a, 0.75), point(b, 0.75), point(c, 0.75)], [point(c, -0.75), point(b, -0.75), point(a, -0.75)],
      [point(a, -0.75), point(b, -0.75), point(b, 0.75), point(a, 0.75)],
      [point(b, -0.75), point(c, -0.75), point(c, 0.75), point(b, 0.75)],
      [point(c, -0.75), point(a, -0.75), point(a, 0.75), point(c, 0.75)]
    ]);
  }
  function sphereGeometry(segments = 28, rings = 20) {
    segments = Math.round(clamp(segments, 8, 64)); rings = Math.round(clamp(rings, 6, 48));
    const positions = [], normals = [], indices = [];
    for (let row = 0; row <= rings; row++) for (let col = 0; col <= segments; col++) {
      const theta = row * Math.PI / rings, phi = col * TAU / segments;
      const n = [Math.sin(theta) * Math.cos(phi), Math.cos(theta), Math.sin(theta) * Math.sin(phi)];
      normals.push(...n); positions.push(...n.map(v => v * 1.1));
    }
    for (let row = 0; row < rings; row++) for (let col = 0; col < segments; col++) {
      const a = row * (segments + 1) + col, b = a + segments + 1;
      if (row !== 0) indices.push(a, a + 1, b);
      if (row !== rings - 1) indices.push(a + 1, b + 1, b);
    }
    return { positions: new Float32Array(positions), normals: new Float32Array(normals), indices: new Uint16Array(indices) };
  }
  function createGeometry(name, quality = 'balanced') {
    const tier = QUALITY[quality] || QUALITY.balanced;
    return name === 'sphere' ? sphereGeometry(tier.segments, tier.rings) : name === 'prism' ? prismGeometry() : cubeGeometry();
  }
  function viewportSize(width, height, dpr = 1, quality = 'balanced') {
    const tier = QUALITY[quality] || QUALITY.balanced, ratio = clamp(dpr, 1, tier.dpr);
    // Both dimensions have a hard ceiling even on unusually large displays.
    const w = clamp(width, 1, 8192), h = clamp(height, 1, 8192), fit = Math.min(ratio, 4096 / w, 4096 / h);
    return { width: Math.max(1, Math.round(w * fit)), height: Math.max(1, Math.round(h * fit)), dpr: fit };
  }
  function normalizePreferences(value) {
    const saved = value && typeof value === 'object' && !Array.isArray(value) && value.version === 1 ? value : {};
    return { version: 1, shape: ['cube', 'sphere', 'prism'].includes(saved.shape) ? saved.shape : 'cube', material: ['matte', 'satin', 'gloss'].includes(saved.material) ? saved.material : 'satin', quality: ['auto', 'low', 'balanced', 'high'].includes(saved.quality) ? saved.quality : 'auto' };
  }
  root.NocturneViewerCore = Object.freeze({ LIMITS, MATERIALS, QUALITY, finite, clamp, wrapAngle, createTransform, resetTransform: createTransform, normalizeTransform, moveTransform, rotateTransform, scaleTransform, axisWithDeadzone, controllerAxis: axisWithDeadzone, boundedDelta, frameDelta, updateControllerTransform, multiply4, modelMatrix, perspectiveMatrix, cubeGeometry, sphereGeometry, prismGeometry, createGeometry, viewportSize, normalizePreferences });
})(typeof window !== 'undefined' ? window : globalThis);
