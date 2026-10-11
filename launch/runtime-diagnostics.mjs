/** A public build label and local-only failure reporting. No telemetry or asset changes. */
export const DIAGNOSTICS_VERSION = '0.84.1-diag.1';
export function withRuntimeDiagnostics(body, { commit = null } = {}) {
  let html = String(body);
  if (html.includes('id="nocturne-runtime-status"') || !/<head\b[^>]*>/i.test(html) || !html.includes('id="nocturne-screen-menu"')) return html;
  const revision = typeof commit === 'string' && /^[a-f0-9]{40}$/i.test(commit) ? commit.slice(0, 7) : 'build ID unavailable';
  // Run before screen scripts so their parse, loading and startup errors are observable.
  html = html.replace(/<head\b[^>]*>/i, '$&<script src="/runtime-diagnostics.js?v=0841diag1"></script>');
  // Use the existing navigation icon slot and scrollable panel. Do not overlay
  // fixed screen headers or add to the height of the navigation's touch targets.
  const shortRevision = revision === 'build ID unavailable' ? 'diag.1' : revision;
  const label = `<span id="nocturne-build-label" aria-label="Build ${DIAGNOSTICS_VERSION}, ${revision}" style="display:block;height:21px;font:9px/10px system-ui;text-align:center;letter-spacing:0">Build<br>${shortRevision}</span><span id="nocturne-navigation-state">More</span>`;
  html = html.replace(/(<details id="nocturne-screen-menu"><summary\b[^>]*>)[\s\S]*?(<\/summary>)/, '$1' + label + '$2');
  const panel = `<div id="nocturne-runtime-status" aria-label="Build and runtime status"><small>Build ${DIAGNOSTICS_VERSION} · ${revision}</small><p id="nocturne-runtime-message" role="status" hidden></p></div>`;
  return html.replace('<label for="nocturne-screen-filter">', panel + '<label for="nocturne-screen-filter">');
}
