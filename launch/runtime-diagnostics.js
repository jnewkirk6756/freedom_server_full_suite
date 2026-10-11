/** Local diagnostics only: never stores, sends or displays exception contents. */
(function (g) {
  'use strict';
  if (g.NocturneRuntimeDiagnostics) return;
  const messages = {
    'missing-assets': 'Local image assets are missing on this browser. The display may keep its fallback image.',
    'storage-unavailable': 'Local image storage could not be read. The display may keep its fallback image.',
    'storage-blocked': 'Local image storage is blocked by another open page. The display may keep its fallback image.',
    'decode-failed': 'A saved local image could not be decoded. The display may keep its fallback image.',
    'portrait-unavailable': 'The new built-in portrait could not load. Your existing display was kept.',
    'script-failed': 'A page script failed. Some controls may not respond. Share this build ID if the problem repeats.',
    'operation-failed': 'A page operation failed unexpectedly. Share this build ID if controls stop responding.'
  };
  let assetProblem = '', runtimeProblem = '', portraitProblem = '', portraitReady = false;
  function render() {
    const node = g.document.getElementById('nocturne-runtime-message');
    if (!node) return;
    // An empty optional local pack is expected on a new device. Never suppress
    // storage, decoder or runtime failures just because the built-in image works.
    const visibleAsset = assetProblem === 'missing-assets' && portraitReady ? '' : assetProblem;
    const parts = [runtimeProblem, portraitProblem, visibleAsset].filter(Boolean);
    node.textContent = parts.map(code => messages[code]).join(' ');
    node.hidden = parts.length === 0;
    node.dataset.status = parts.join(' ');
    const caption = g.document.getElementById('nocturne-navigation-state');
    if (caption) caption.textContent = parts.length ? 'Issue' : 'More';
  }
  function reportAsset(code) {
    let next;
    if (code === 'ready') next = '';
    else if (['missing-assets', 'storage-unavailable', 'storage-blocked', 'decode-failed'].includes(code)) next = code;
    else return;
    if (next === assetProblem) return;
    assetProblem = next;
    render();
  }
  function reportPortrait(code) {
    if (!['ready', 'unavailable'].includes(code)) return;
    // Failed variant switches retain the last successfully decoded portrait.
    if (code === 'ready') portraitReady = true;
    portraitProblem = code === 'ready' ? '' : 'portrait-unavailable';
    render();
  }
  g.NocturneRuntimeDiagnostics = Object.freeze({ reportAsset, reportPortrait });
  g.addEventListener('error', event => {
    // Ignore ordinary media errors; their loaders provide the specific asset status.
    if (event.target && event.target !== g && event.target.tagName !== 'SCRIPT') return;
    runtimeProblem = 'script-failed'; render();
  }, true);
  g.addEventListener('unhandledrejection', () => { runtimeProblem = 'operation-failed'; render(); });
  g.document.addEventListener('DOMContentLoaded', render, { once: true });
})(window);
