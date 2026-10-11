/** Keep the UI usable when browser storage is blocked or full. Never clears user data. */
(function (g) {
  'use strict';
  if (g.NocturneStorage) return;
  const unavailable = new Set();
  function warn(name) {
    unavailable.add(name);
    const show = () => {
      if (!g.document?.body) return;
      let note = g.document.getElementById('nocturne-storage-warning');
      if (!note) {
        note = g.document.createElement('div');
        note.id = 'nocturne-storage-warning';
        note.setAttribute('role', 'status');
        note.style.cssText = 'position:relative;z-index:10001;padding:12px 16px;background:#38291b;color:#ffe2b6;font:14px/1.4 system-ui';
        g.document.body.prepend(note);
      }
      note.textContent = 'Browser storage is unavailable or full. New changes may only last on this page. Existing saved data has not been cleared.';
    };
    if (g.document?.readyState === 'loading') g.document.addEventListener('DOMContentLoaded', show, { once: true });
    else show();
  }
  function wrap(name) {
    let native = null, cleared = false;
    const changes = new Map();
    try { native = g[name]; } catch { warn(name); }
    const keys = () => {
      const result = new Set();
      if (!cleared && native) {
        try { for (let i = 0; i < native.length; i++) { const key = native.key(i); if (key !== null) result.add(key); } }
        catch { warn(name); }
      }
      for (const [key, value] of changes) value === null ? result.delete(key) : result.add(key);
      return [...result];
    };
    const store = {
      get length() { return keys().length; },
      key(index) { return keys()[Number(index)] ?? null; },
      getItem(key) {
        key = String(key);
        if (changes.has(key)) return changes.get(key);
        if (cleared) return null;
        try { return native?.getItem(key) ?? null; } catch { warn(name); return null; }
      },
      setItem(key, value) {
        key = String(key); value = String(value);
        changes.set(key, value);
        try { if (!native) throw Error('unavailable'); native.setItem(key, value); if (!cleared) changes.delete(key); }
        catch { warn(name); }
      },
      removeItem(key) {
        key = String(key); changes.set(key, null);
        try { if (!native) throw Error('unavailable'); native.removeItem(key); changes.delete(key); }
        catch { warn(name); }
      },
      clear() {
        changes.clear(); cleared = true;
        try { if (!native) throw Error('unavailable'); native.clear(); cleared = false; }
        catch { warn(name); }
      }
    };
    try { Object.defineProperty(g, name, { configurable: true, enumerable: true, get: () => store }); }
    catch { warn(name); }
    return store;
  }
  g.NocturneStorage = { local: wrap('localStorage'), session: wrap('sessionStorage'), unavailable };
})(window);
