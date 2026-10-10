/* Standalone neutral model preview. Intentionally independent of application runtimes. */
(function () {
  'use strict';
  const core = window.NocturneViewerCore, $ = id => document.getElementById(id);
  const root = $('model-viewer'), canvas = $('model-canvas'), stage = $('viewer-stage');
  if (!root || !canvas || !core) return;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const reduceMotion = () => motionQuery.matches || document.documentElement.dataset.nocturneMotion === 'reduce';
  const descriptions = { matte: 'Quiet, diffuse light. An even, low-reflection surface.', satin: 'Soft highlights. A balanced, gently reflective surface.', gloss: 'Bright, focused highlights. A polished, reflective surface.' };
  const shapeNames = { cube: '01 / CUBE', sphere: '02 / SPHERE', prism: '03 / PRISM' };
  const PREFERENCE_KEY = 'nocturne.model-viewer.preferences.v1';
  const savedChoices = readPreferences();
  let transform = core.createTransform(), shape = savedChoices.shape, material = savedChoices.material, mode = 'rotate', qualityPreference = savedChoices.quality;
  let quality = 'balanced', gl = null, resources = null, frameId = 0, lastTime = null, autoRotate = false, stopped = false, needsDraw = true;
  let contextState = 'starting', recoveredCount = 0, lastAnnouncement = '', lastGesture = null;
  const pointers = new Map();

  function readPreferences() {
    try {
      const raw = window.NocturneStorage?.local.getItem(PREFERENCE_KEY);
      if (typeof raw === 'string' && raw.length <= 512) return core.normalizePreferences(JSON.parse(raw));
    } catch {}
    return core.normalizePreferences(null);
  }
  function savePreferences() {
    // Choices only: no transform, motion, account data or application state.
    const saved = core.normalizePreferences({ version: 1, shape, material, quality: qualityPreference });
    try { window.NocturneStorage?.local.setItem(PREFERENCE_KEY, JSON.stringify(saved)); } catch {}
  }

  const VERTEX_SHADER = 'attribute vec3 aPosition;attribute vec3 aNormal;uniform mat4 uModel;uniform mat4 uViewProjection;varying vec3 vNormal;varying vec3 vPosition;void main(){vec4 world=uModel*vec4(aPosition,1.0);vPosition=world.xyz;vNormal=normalize(mat3(uModel)*aNormal);gl_Position=uViewProjection*world;}';
  // Uniform scaling makes the model's upper-left 3x3 sufficient for its normals.
  const FRAGMENT_SHADER = 'precision mediump float;varying vec3 vNormal;varying vec3 vPosition;uniform vec3 uColor;uniform vec3 uEye;uniform vec4 uFinish;void main(){vec3 N=normalize(vNormal);vec3 L=normalize(vec3(-3.0,4.0,5.0)-vPosition);vec3 F=normalize(vec3(4.0,0.5,1.5)-vPosition);vec3 V=normalize(uEye-vPosition);vec3 H=normalize(L+V);float diffuse=max(dot(N,L),0.0);float fill=max(dot(N,F),0.0)*0.17;float spec=diffuse>0.0?pow(max(dot(N,H),0.0),uFinish.w)*uFinish.z:0.0;float rim=pow(1.0-max(dot(N,V),0.0),3.0)*0.12;vec3 color=uColor*(uFinish.x+diffuse*uFinish.y+fill)+vec3(0.92,0.84,1.0)*spec+vec3(0.32,0.23,0.48)*rim;gl_FragColor=vec4(pow(clamp(color,0.0,1.0),vec3(0.88)),1.0);}';

  function announce(message) {
    if (message === lastAnnouncement) return;
    lastAnnouncement = message;
    $('viewer-status').textContent = message;
  }
  function chooseQuality() {
    if (qualityPreference !== 'auto') return qualityPreference;
    return (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || window.innerWidth < 600 ? 'low' : 'balanced';
  }
  function stateMessage() {
    return shape[0].toUpperCase() + shape.slice(1) + ' · ' + material + ' finish. ' + (autoRotate ? 'Slow rotation on.' : 'Ready to explore.');
  }
  function syncTransform() {
    $('model-scale').value = String(Math.round(transform.scale * 100));
    $('model-scale-output').textContent = Math.round(transform.scale * 100) + '%';
    $('transform-readout').textContent = 'X ' + transform.position.x.toFixed(2) + ' · Y ' + transform.position.y.toFixed(2) + ' · Z ' + transform.position.z.toFixed(2);
    canvas.dataset.scale = String(transform.scale);
  }
  function setTransform(next) { transform = core.normalizeTransform(next); syncTransform(); invalidate(); }
  function setControlsEnabled(enabled) {
    root.querySelectorAll('[data-viewer-mode], [data-nudge], #model-scale, #reset-model, #auto-rotate').forEach(button => { button.disabled = !enabled; });
    $('auto-rotate').disabled = !enabled || reduceMotion();
    canvas.setAttribute('aria-disabled', String(!enabled));
  }
  function setContextState(state, message) {
    contextState = state;
    root.dataset.contextState = state;
    const ready = state === 'ready';
    $('viewer-unavailable').hidden = ready;
    setControlsEnabled(ready);
    if (!ready) {
      $('unavailable-title').textContent = state === 'lost' ? 'Graphics interrupted' : state === 'starting' ? 'Preparing preview' : 'Preview unavailable';
      $('unavailable-message').textContent = message;
      $('retry-renderer').hidden = state === 'lost' || state === 'starting';
      $('render-quality').textContent = state === 'lost' ? 'CONTEXT LOST' : state === 'starting' ? 'INITIALIZING' : 'WEBGL UNAVAILABLE';
    }
    if (message) announce(message);
  }
  function createShader(type, source) {
    const shader = gl.createShader(type);
    if (!shader) throw new Error('Could not allocate a shader.');
    gl.shaderSource(shader, source); gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('The browser could not compile the preview shader.'); }
    return shader;
  }
  function releaseResources() {
    if (!resources || !gl) return;
    for (const buffer of [resources.position, resources.normal, resources.index]) if (buffer) gl.deleteBuffer(buffer);
    if (resources.program) gl.deleteProgram(resources.program);
    resources = null;
  }
  function initializeResources() {
    const allocated = [], shaders = [];
    let program;
    try {
      shaders.push(createShader(gl.VERTEX_SHADER, VERTEX_SHADER));
      shaders.push(createShader(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
      program = gl.createProgram();
      if (!program) throw new Error('Could not allocate the preview program.');
      for (const shader of shaders) gl.attachShader(program, shader);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('The browser could not link the preview program.');
      for (let i = 0; i < 3; i++) { const buffer = gl.createBuffer(); if (!buffer) throw new Error('Could not allocate geometry.'); allocated.push(buffer); }
      resources = { program, position: allocated[0], normal: allocated[1], index: allocated[2], count: 0, attributes: { position: gl.getAttribLocation(program, 'aPosition'), normal: gl.getAttribLocation(program, 'aNormal') }, uniforms: {} };
      for (const name of ['uModel', 'uViewProjection', 'uColor', 'uEye', 'uFinish']) resources.uniforms[name] = gl.getUniformLocation(program, name);
      uploadGeometry();
    } catch (error) {
      for (const buffer of allocated) gl.deleteBuffer(buffer);
      if (program) gl.deleteProgram(program);
      resources = null;
      throw error;
    } finally { for (const shader of shaders) gl.deleteShader(shader); }
  }
  function uploadGeometry() {
    if (!resources || !gl || gl.isContextLost()) return;
    const geometry = core.createGeometry(shape, quality);
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.position); gl.bufferData(gl.ARRAY_BUFFER, geometry.positions, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, resources.normal); gl.bufferData(gl.ARRAY_BUFFER, geometry.normals, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, resources.index); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geometry.indices, gl.STATIC_DRAW);
    resources.count = geometry.indices.length;
    root.dataset.triangles = String(geometry.indices.length / 3);
  }
  function resize() {
    const nextQuality = chooseQuality(), changed = nextQuality !== quality;
    quality = nextQuality;
    const rect = stage.getBoundingClientRect(), dimensions = core.viewportSize(rect.width, rect.height, window.devicePixelRatio || 1, quality);
    if (canvas.width !== dimensions.width || canvas.height !== dimensions.height) { canvas.width = dimensions.width; canvas.height = dimensions.height; needsDraw = true; }
    if (changed) uploadGeometry();
    if (contextState === 'ready') $('render-quality').textContent = quality.toUpperCase() + ' · ' + dimensions.width + ' × ' + dimensions.height;
    root.dataset.quality = quality;
    invalidate();
  }
  function initialize() {
    if (contextState === 'lost' || stopped) return;
    setContextState('starting', 'Preparing the local preview…');
    try {
      gl = gl || canvas.getContext('webgl', { alpha: true, antialias: true, depth: true, preserveDrawingBuffer: false, powerPreference: 'low-power' });
      if (!gl) throw new Error('WebGL is unavailable in this browser. Try a WebGL-enabled browser or check graphics acceleration.');
      releaseResources(); quality = chooseQuality(); initializeResources();
      setContextState('ready', recoveredCount ? 'Graphics restored. Your model and view were preserved.' : stateMessage());
      resize(); syncTransform(); invalidate();
    } catch (error) {
      cancelFrame();
      releaseResources();
      setContextState('unavailable', error.message || 'The graphics preview could not start. Try again.');
    }
  }
  function draw() {
    if (!gl || !resources || gl.isContextLost()) return;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
    gl.useProgram(resources.program);
    for (const [buffer, attribute] of [[resources.position, resources.attributes.position], [resources.normal, resources.attributes.normal]]) {
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.enableVertexAttribArray(attribute); gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 0, 0);
    }
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, resources.index);
    const aspect = canvas.width / canvas.height, distance = Math.max(6.5, 5.6 / aspect), finish = core.MATERIALS[material];
    gl.uniformMatrix4fv(resources.uniforms.uModel, false, core.modelMatrix(transform));
    gl.uniformMatrix4fv(resources.uniforms.uViewProjection, false, core.perspectiveMatrix(aspect, distance));
    gl.uniform3fv(resources.uniforms.uColor, finish.color);
    gl.uniform3f(resources.uniforms.uEye, 0, 0, distance);
    gl.uniform4f(resources.uniforms.uFinish, finish.ambient, finish.diffuse, finish.specular, finish.shininess);
    gl.drawElements(gl.TRIANGLES, resources.count, gl.UNSIGNED_SHORT, 0);
    needsDraw = false;
    root.dataset.rendered = 'true';
  }
  function frame(time) {
    frameId = 0;
    if (stopped || document.hidden || contextState !== 'ready') { lastTime = null; return; }
    const dt = core.frameDelta(lastTime, time); lastTime = time;
    if (autoRotate && !reduceMotion() && pointers.size === 0) { transform = core.rotateTransform(transform, { y: dt * 0.22 }); needsDraw = true; }
    try { if (needsDraw) draw(); }
    catch { cancelFrame(); setContextState('unavailable', 'The preview was interrupted. Your adjustments are preserved. Try again.'); return; }
    if (autoRotate && !reduceMotion()) scheduleFrame();
  }
  function scheduleFrame() { if (!frameId && !stopped && !document.hidden && contextState === 'ready') frameId = requestAnimationFrame(frame); }
  function invalidate() { needsDraw = true; scheduleFrame(); }
  function cancelFrame() { if (frameId) cancelAnimationFrame(frameId); frameId = 0; lastTime = null; }
  function stopMotion() { autoRotate = false; $('auto-rotate').checked = false; cancelFrame(); invalidate(); }
  function reset() { stopMotion(); setTransform(core.resetTransform()); announce('View reset. Position centered, scale 100%, slow rotation off.'); }
  function setMode(next) {
    if (!['rotate', 'move', 'scale'].includes(next)) return;
    mode = next;
    root.querySelectorAll('[data-viewer-mode]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.viewerMode === mode)));
    $('stage-caption').textContent = 'DRAG TO ' + mode.toUpperCase();
    announce('Drag mode: ' + mode + '.');
  }
  function chooseShape(next, persist = true) {
    if (!Object.hasOwn(shapeNames, next)) return;
    shape = next;
    root.querySelectorAll('[data-viewer-shape]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.viewerShape === shape)));
    $('model-name').textContent = shapeNames[shape];
    canvas.setAttribute('aria-label', 'Interactive neutral ' + shape + ' model. Use arrow keys to rotate.');
    root.dataset.shape = shape;
    if (persist) savePreferences();
    uploadGeometry(); invalidate(); if (contextState === 'ready') announce(stateMessage());
  }
  function chooseMaterial(next, persist = true) {
    if (!Object.hasOwn(core.MATERIALS, next)) return;
    material = next;
    root.querySelectorAll('[data-viewer-material]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.viewerMaterial === material)));
    $('material-description').textContent = descriptions[material]; root.dataset.material = material;
    if (persist) savePreferences();
    invalidate(); if (contextState === 'ready') announce(stateMessage());
  }
  function nudge(action) {
    const move = { left: { x: -0.1 }, right: { x: 0.1 }, up: { y: 0.1 }, down: { y: -0.1 } };
    const rotate = { 'rotate-left': { y: -0.12 }, 'rotate-right': { y: 0.12 }, 'tilt-up': { x: -0.12 }, 'tilt-down': { x: 0.12 } };
    stopMotion();
    if (move[action]) { setTransform(core.moveTransform(transform, move[action])); announce('Position: X ' + transform.position.x.toFixed(2) + ', Y ' + transform.position.y.toFixed(2) + '.'); }
    if (rotate[action]) { setTransform(core.rotateTransform(transform, rotate[action])); announce('Rotation adjusted.'); }
  }
  root.querySelectorAll('[data-viewer-mode]').forEach(button => button.addEventListener('click', () => setMode(button.dataset.viewerMode)));
  root.querySelectorAll('[data-viewer-shape]').forEach(button => button.addEventListener('click', () => chooseShape(button.dataset.viewerShape)));
  root.querySelectorAll('[data-viewer-material]').forEach(button => button.addEventListener('click', () => chooseMaterial(button.dataset.viewerMaterial)));
  root.querySelectorAll('[data-nudge]').forEach(button => button.addEventListener('click', () => nudge(button.dataset.nudge)));
  $('reset-model').addEventListener('click', reset);
  $('retry-renderer').addEventListener('click', initialize);
  $('model-scale').addEventListener('input', event => { stopMotion(); setTransform({ ...transform, scale: Number(event.target.value) / 100 }); });
  $('model-scale').addEventListener('change', () => announce('Scale ' + Math.round(transform.scale * 100) + '%.'));
  $('viewer-quality').addEventListener('change', event => { qualityPreference = core.normalizePreferences({ version: 1, quality: event.target.value }).quality; savePreferences(); resize(); if (contextState === 'ready') announce('Render quality: ' + quality + '.'); });
  $('auto-rotate').addEventListener('change', event => { autoRotate = event.target.checked && !reduceMotion(); event.target.checked = autoRotate; lastTime = null; invalidate(); announce(stateMessage()); });
  canvas.addEventListener('keydown', event => {
    if (contextState !== 'ready' || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase(), arrow = { arrowleft: 'left', arrowright: 'right', arrowup: 'up', arrowdown: 'down' }[key];
    if (!arrow && !['+', '=', '-', '_', 'r', 'home'].includes(key)) return;
    event.preventDefault();
    if (key === 'r' || key === 'home') { reset(); return; }
    stopMotion();
    if (arrow) nudge(event.shiftKey ? arrow : ({ left: 'rotate-left', right: 'rotate-right', up: 'tilt-up', down: 'tilt-down' })[arrow]);
    else { setTransform(core.scaleTransform(transform, key === '+' || key === '=' ? 1.08 : 1 / 1.08)); announce('Scale ' + Math.round(transform.scale * 100) + '%.'); }
  });
  function gesture() {
    const points = [...pointers.values()];
    if (points.length >= 2) { const [a, b] = points; return { count: 2, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) }; }
    return points.length ? { count: 1, ...points[0] } : null;
  }
  canvas.addEventListener('pointerdown', event => {
    if (contextState !== 'ready' || (event.pointerType === 'mouse' && event.button !== 0)) return;
    if (pointers.size >= 2) return;
    event.preventDefault(); canvas.focus({ preventScroll: true }); stopMotion();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { canvas.setPointerCapture(event.pointerId); } catch {}
    lastGesture = gesture(); canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', event => {
    if (!pointers.has(event.pointerId) || contextState !== 'ready') return;
    event.preventDefault(); pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const current = gesture(), previous = lastGesture; lastGesture = current;
    if (!current || !previous || current.count !== previous.count) return;
    const dx = current.x - previous.x, dy = current.y - previous.y, units = 4 / Math.max(180, Math.min(stage.clientWidth, stage.clientHeight));
    if (current.count === 2) {
      let next = core.moveTransform(transform, { x: dx * units, y: -dy * units });
      if (previous.distance > 8 && current.distance > 8) next = core.scaleTransform(next, current.distance / previous.distance);
      setTransform(next);
    } else if (mode === 'move') setTransform(core.moveTransform(transform, { x: dx * units, y: -dy * units }));
    else if (mode === 'scale') setTransform(core.scaleTransform(transform, Math.exp(-dy * 0.008)));
    else setTransform(core.rotateTransform(transform, { x: dy * 0.008, y: dx * 0.008 }));
  });
  function endPointer(event) {
    if (!pointers.has(event.pointerId)) return;
    pointers.delete(event.pointerId);
    try { if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId); } catch {}
    lastGesture = gesture();
    if (!pointers.size) { canvas.classList.remove('is-dragging'); announce('View adjusted. Scale ' + Math.round(transform.scale * 100) + '%.'); }
  }
  for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(name, endPointer);
  function clearPointers() { for (const id of [...pointers.keys()]) endPointer({ pointerId: id }); lastGesture = null; }
  canvas.addEventListener('wheel', event => {
    if (contextState !== 'ready' || document.activeElement !== canvas || event.ctrlKey || event.metaKey) return;
    event.preventDefault(); stopMotion();
    const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? stage.clientHeight : 1);
    setTransform(core.scaleTransform(transform, Math.exp(-core.clamp(pixels, -150, 150) * 0.002)));
  }, { passive: false });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault(); clearPointers(); cancelFrame(); resources = null;
    setContextState('lost', 'Graphics connection lost. Waiting for the browser to restore it; your adjustments are preserved.');
  });
  canvas.addEventListener('webglcontextrestored', () => { recoveredCount++; contextState = 'starting'; initialize(); });
  function syncMotionPreference() {
    if (reduceMotion()) stopMotion();
    $('auto-rotate').disabled = reduceMotion() || contextState !== 'ready';
    $('motion-note').textContent = reduceMotion() ? 'Reduced motion is enabled. Slow rotation is off.' : 'Off by default. Turn on to inspect every side.';
  }
  if (motionQuery.addEventListener) motionQuery.addEventListener('change', syncMotionPreference);
  else motionQuery.addListener?.(syncMotionPreference);
  window.addEventListener('nocturne:display-preferences', syncMotionPreference);
  window.addEventListener('resize', resize);
  window.addEventListener('blur', clearPointers);
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(resize) : null;
  observer?.observe(stage);
  document.addEventListener('visibilitychange', () => { if (document.hidden) { clearPointers(); cancelFrame(); } else { lastTime = null; resize(); invalidate(); } });
  window.addEventListener('pagehide', () => { stopped = true; clearPointers(); cancelFrame(); });
  window.addEventListener('pageshow', () => { stopped = false; lastTime = null; resize(); invalidate(); });
  // Read-only inspection hook for browser QA; all controls use the same core functions.
  window.NocturneModelViewer = Object.freeze({ getState: () => ({ transform: core.normalizeTransform(transform), shape, material, mode, quality, qualityPreference, contextState, autoRotate, activePointers: pointers.size, recoveredCount, canvasWidth: canvas.width, canvasHeight: canvas.height }) });
  chooseShape(shape, false); chooseMaterial(material, false); $('viewer-quality').value = qualityPreference;
  syncTransform(); syncMotionPreference(); initialize();
})();
