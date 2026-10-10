/** Shared, server-rendered navigation, independent of individual screen runtimes. */
export const NAVIGATION_VERSION = '0.84.1';
const homePaths = new Set(['/', '/experience']);
const tools = [
  ['/video-states/', 'Video states'], ['/world/', 'Spatial world'], ['/player/', 'Media player'],
  ['/matrix/', 'Master Chart'], ['/nps/', 'Character lab'],
  ['/commission/', 'Character studio'], ['/director/', 'Director diagnostics'],
  ['/video-router/', 'Video tools'], ['/photo-space/', 'Photo environments'],
  ['/travel/', 'House explorer'], ['/venice-setup/', 'Provider setup'],
  ['/app/', 'Classic workspace'], ['/launcher/', 'Project launcher']
];
const icons = {
  home: '<path d="m3 10 9-7 9 7v10H3zM9 20v-7h6v7"/>',
  live: '<path d="M2 12h4l3-7 5 14 3-7h5"/>',
  devices: '<rect x="7" y="3" width="10" height="18" rx="3"/><path d="M10 7h4m-4 4h4m-4 4h4"/>',
  vr: '<rect x="2" y="6" width="20" height="12" rx="4"/><path d="M2 12h5l3 3h4l3-3h5"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
};
const icon = name => `<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">${icons[name]}</svg>`;
export function withNavigation(body, url = '/') {
  let html = String(body);
  if (html.includes('id="nocturne-navigation"') || !/<\/body>/i.test(html)) return html;
  const path = new URL(url, 'http://nocturne.local').pathname.replace(/\/+$/, '') || '/';
  const active = homePaths.has(path) ? 'home' : path === '/live' ? 'live' : path === '/devices' ? 'devices' : path === '/vr' ? 'vr' : 'more';
  const build='0841';const fresh=href=>href+(href.includes('?')?'&':'?')+'v='+build;const tab = (id, href, label) => `<a href="${fresh(href)}" data-screen="${id}"${active === id ? ' aria-current="page"' : ''}>${icon(id)}<span>${label}</span></a>`;
  const menu = tools.map(([href, label]) => `<a data-screen-link href="${href}"${path + '/' === href ? ' aria-current="page"' : ''}>${label}<span aria-hidden="true">&#8599;</span></a>`).join('');
  const nav = `<div id="nocturne-nav-spacer" aria-hidden="true"></div>
<nav id="nocturne-navigation" aria-label="Nocturne screens" style="grid-template-columns:repeat(5,minmax(0,1fr))">
${tab('home', '/', 'Home')}${tab('live', '/live/', 'Live')}${tab('devices', '/devices/', 'Devices')}${tab('vr', '/vr/', 'VR')}
<details id="nocturne-screen-menu"><summary aria-controls="nocturne-menu-content" aria-expanded="false"${active === 'more' ? ' data-active="true"' : ''}>${icon('more')}<span>More</span></summary>
<div id="nocturne-menu-content" class="nocturne-menu-panel" role="region" aria-label="More screens and settings"><div class="nocturne-menu-heading"><b>NOCTURNE</b><button id="nocturne-close-menu" type="button" aria-label="Close screen menu">Close</button></div>
<label for="nocturne-screen-filter">Find a screen</label><input id="nocturne-screen-filter" type="search" placeholder="Search screens" autocomplete="off">
<a data-screen-link href="/model-viewer/"${path==='/model-viewer'?' aria-current="page"':''}>Model viewer<span aria-hidden="true">&#8599;</span></a>
<button id="nocturne-display-preferences" type="button">Display preferences<span aria-hidden="true">&#9881;</span></button>
<a data-screen-link href="/experience/?panel=settings">Anna settings<span aria-hidden="true">&#8599;</span></a>
<button id="nocturne-edit-setup" type="button">Session setup<span aria-hidden="true">&#9881;</span></button>
<details class="nocturne-tools"><summary>Creative &amp; developer tools</summary>${menu}</details><p id="nocturne-menu-empty" role="status" hidden>No matching screens.</p>
<p>State is saved on this device. Switching screens does not unlock Live.</p><small>Navigation ${NAVIGATION_VERSION}</small></div></details></nav>`;
  html = html.replace(/<\/head>/i, `<link rel="stylesheet" href="/navigation.css?v=0841"><link rel="stylesheet" href="/ui-shell.css?v=0841"><script defer src="/ui-shell-core.js?v=0841"></script><script defer src="/ui-shell.js?v=0841"></script><script src="/browser-storage.js?v=0840"></script><script defer src="/session-core.js?v=0840"></script><script type="module" src="/navigation.js?v=0841"></script></head>`);
  html=html.replace(/<body([^>]*)>/i, `<body$1 data-nocturne-screen="${active==='more'?(tools.find(([href])=>href===path+'/')?path.slice(1):'more'):active}">`);
  return html.replace(/<\/body>/i, nav + '</body>');
}
