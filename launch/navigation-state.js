/** Per-tab UI state only. Does not change Anna's relationship or grant permissions. */
const PREFIX = 'nocturne.navigation.v1.';
const MAX_AGE = 12 * 60 * 60 * 1000;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function screenKey(pathname = location.pathname) {
  const p = pathname.replace(/\/+$/, '') || '/';
  return p === '/' || p === '/experience' ? 'home' : p.slice(1);
}
export function readNavigationState(key, storage, now = Date.now()) {
  try {
    const raw = (storage || globalThis.sessionStorage).getItem(PREFIX + key);
    if (!raw || raw.length > 100000) return null;
    const item = JSON.parse(raw);
    if (!isRecord(item) || !isRecord(item.value) || !Number.isFinite(item.at) || !Number.isFinite(now) || now < item.at || now - item.at > MAX_AGE) return null;
    return item.value;
  } catch { return null; }
}
export function writeNavigationState(key, value, storage, now = Date.now()) {
  try {
    if (!isRecord(value) || !Number.isFinite(now)) return false;
    const store = storage || globalThis.sessionStorage;
    const json = JSON.stringify({ at: now, value });
    if (json.length > 100000) return false;
    store.setItem(PREFIX + key, json);
    return true;
  } catch { return false; }
}
/** Show setup once per screen in this tab. Reopen remains available from More. */
export function rememberSetupDialog(dialog, key, onRestore = () => {}) {
  if (!dialog) return false;
  const form = dialog.querySelector('form');
  if (!form) return false;
  const fields = () => [...form.querySelectorAll('input[id], select[id], textarea[id]')]
    .filter(el => !['password', 'file', 'hidden'].includes(el.type));
  const saved = readNavigationState('setup.' + key);
  const show = () => { if (!dialog.open) dialog.showModal ? dialog.showModal() : dialog.setAttribute('open', ''); };
  form.addEventListener('submit', e => {
    if (e.defaultPrevented || ['cancel', 'later'].includes(e.submitter?.value)) return;
    const values = Object.fromEntries(fields().map(el => [el.id, el.type === 'checkbox' ? el.checked : el.value]));
    writeNavigationState('setup.' + key, values);
  });
  window.addEventListener('nocturne:setup', e => { if (!e.detail?.screen || e.detail.screen === key) show(); });
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    for (const el of fields()) {
      if (!Object.hasOwn(saved, el.id)) continue;
      if (el.type === 'checkbox') el.checked = saved[el.id] === true;
      else if (typeof saved[el.id] === 'string') el.value = saved[el.id];
    }
    onRestore();
    return true;
  }
  show();
  return false;
}
