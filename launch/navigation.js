import { screenKey, readNavigationState, writeNavigationState } from './navigation-state.js';
const menu = document.getElementById('nocturne-screen-menu');
const key = screenKey();
let initialized = false;
function saveUI() {
  if (!initialized) return;
  const input = document.getElementById('message');
  const line = document.getElementById(key === 'home' ? 'anna-line' : 'last-line');
  writeNavigationState('screen.' + key, {
    draft: input && 'value' in input ? input.value.slice(0, 2400) : '',
    line: line?.textContent?.slice(0, 4000) || '', scrollY: window.scrollY
  });
}
function suspend() {
  window.dispatchEvent(new CustomEvent('nocturne:suspend'));
  saveUI();
  try { window.speechSynthesis?.cancel(); } catch {}
  try { navigator.vibrate?.(0); } catch {}
}
function initialize() {
  const saved = readNavigationState('screen.' + key);
  const input = document.getElementById('message');
  const line = document.getElementById(key === 'home' ? 'anna-line' : 'last-line');
  if (saved) {
    if (input && 'value' in input && typeof saved.draft === 'string') input.value = saved.draft;
    if (line && typeof saved.line === 'string' && saved.line) line.textContent = saved.line;
    if (Number.isFinite(saved.scrollY)) requestAnimationFrame(() => scrollTo(0, saved.scrollY));
  }
  initialized = true;
  if (input && 'value' in input) input.addEventListener('input', saveUI);
  if (line) new MutationObserver(saveUI).observe(line, { childList: true, characterData: true, subtree: true });
  const requested = new URL(location.href).searchParams.get('panel');
  const openRequested = () => {
    if (requested === 'settings') document.getElementById('settings')?.click();
    if (requested === 'setup') window.dispatchEvent(new CustomEvent('nocturne:setup', { detail: { screen: key } }));
  };
  const boot = document.querySelector('#boot[open], #setup[open]');
  if (boot && requested === 'settings') boot.addEventListener('close', openRequested, { once: true });
  else openRequested();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
else initialize();
document.getElementById('nocturne-edit-setup')?.addEventListener('click', () => {
  if (menu) menu.open = false;
  if (document.getElementById('boot') || document.getElementById('setup')) {
    window.dispatchEvent(new CustomEvent('nocturne:setup', { detail: { screen: key } }));
  } else location.assign('/experience/?panel=setup');
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && menu?.open) { menu.open = false; menu.querySelector('summary')?.focus(); }
});
document.addEventListener('click', e => {
  if (menu?.open && !menu.contains(e.target)) menu.open = false;
  const a = e.target.closest?.('a[href]');
  if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === '_blank' || a.hasAttribute('download')) return;
  const url = new URL(a.href, location.href);
  if (url.origin !== location.origin) return;
  if (url.pathname === location.pathname && url.search === location.search && url.hash) return;
  suspend();
});
window.addEventListener('pagehide', suspend);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') suspend(); });
window.addEventListener('pageshow', e => { if(e.persisted){ location.reload(); return; } if(menu) menu.open=false; });
