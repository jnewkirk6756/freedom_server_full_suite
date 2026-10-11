/** Bundled still portraits. Manual choice only, independent of local expression packs. */
(function (g) {
  'use strict';
  if (g.NocturneNeutralPortrait) return;
  const key = 'nocturne.builtin-portrait.v1';
  const assets = Object.freeze({
    calm: Object.freeze({url: '/portraits/neutral-20261011.webp', width: 944, height: 1667, label: 'Calm'}),
    friendly: Object.freeze({url: '/portraits/friendly-20261011.webp', width: 944, height: 1666, label: 'Friendly'})
  });
  let selected = 'calm';
  try { const saved = g.localStorage.getItem(key); if (Object.hasOwn(assets, saved)) selected = saved; } catch {}
  const pending = new Map(); // At most two bounded images; never loads the unchosen variant.
  function report(code) {
    try { g.NocturneRuntimeDiagnostics?.reportPortrait(code); } catch {}
  }
  function load(id = selected) {
    if (!Object.hasOwn(assets, id)) return Promise.resolve(null);
    if (pending.has(id)) return pending.get(id);
    const promise = new Promise(resolve => {
      const image = new Image();
      let settled = false;
      const finish = ready => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        image.onload = image.onerror = null;
        resolve(ready ? image : null);
      };
      // A stalled request or decoder never takes away the existing basic image.
      const timer = setTimeout(() => finish(false), 12000);
      image.decoding = 'async';
      image.fetchPriority = 'high';
      image.onload = async () => {
        try {
          if (!image.naturalWidth || !image.naturalHeight) return finish(false);
          if (typeof image.decode === 'function') await image.decode();
          finish(true);
        } catch { finish(false); }
      };
      image.onerror = () => finish(false);
      image.src = assets[id].url;
    });
    pending.set(id, promise);
    // An explicit later selection can recover after a timeout or offline failure.
    promise.then(image => { if (!image && pending.get(id) === promise) pending.delete(id); });
    return promise;
  }
  async function refresh() {
    const id = selected, image = await load(id);
    if (id !== selected) return false;
    report(image ? 'ready' : 'unavailable');
    if (!image) return false;
    const target = g.document.getElementById('anna-poster');
    if (target?.isConnected && target.hasAttribute('data-neutral-portrait')) {
      // Preserve visibility and layering: the user's imported grids still win.
      target.src = assets[id].url;
      target.width = assets[id].width;
      target.height = assets[id].height;
      target.dataset.portrait = id;
      target.alt = 'Fictional adult avatar, ' + assets[id].label.toLowerCase() + ' portrait';
    }
    g.dispatchEvent(new CustomEvent('nocturne:portrait-ready', {detail: {id, image}}));
    return true;
  }
  function choose(id) {
    if (!Object.hasOwn(assets, id)) return Promise.resolve(false);
    selected = id;
    try { g.localStorage.setItem(key, id); } catch {}
    return refresh();
  }
  g.NocturneNeutralPortrait = Object.freeze({assets, load, choose, selected: () => selected});
  const picker = g.document.getElementById('neutral-portrait-select');
  if (picker) {
    picker.value = selected;
    picker.addEventListener('change', () => choose(picker.value));
  }
  refresh();
})(window);
