const VERSION='nocturne-sw-0.84.1-portrait1';
const SHELL='nocturne-shell-0841-portrait1';
const CORE=[
  '/',
  '/anna-home.js?v=0840',
  '/anna-home.css?v=0840',
  '/anna-psyche.js?v=0840',
  '/anna-memory.js?v=0840',
  '/anna-presence.js?v=0840',
  '/anna-grounding.js?v=0840',
  '/anna-experience.js?v=0840',
  '/video-state-player.js?v=0840',
  '/video-state.css?v=0840',
  '/nocturne-icon.svg?v=0840',
  '/neutral-portrait.js?v=20261011',
  '/neutral-portrait.css?v=20261011',
  '/portraits/friendly-20261011.webp',
  '/portraits/neutral-20261011.webp',
  '/live/',
  '/vr/',
  '/experience.css?v=0840',
  '/live-embodied.css?v=0840',
  '/experience-mobile-safe.js?v=0840',
  '/video-state-core.js?v=0840',
  '/asset-pack-core.js?v=0840',
  '/vr-pattern-core.js?v=0840',
  '/voice-core.js?v=0840',
  '/face-pack-core.js?v=0840',
  '/anna-avatar-runtime.js?v=0840',
  '/vr.js?v=0840',
  '/vr-fallback.js?v=0840',
  '/vr.css?v=0840',
  '/ui-shell.css?v=0841',
  '/ui-shell-core.js?v=0841',
  '/ui-shell.js?v=0841',
  '/viewer-core.js?v=0841',
  '/xr-session-core.js?v=0841',
  '/model-viewer/',
  '/model-viewer.js?v=0841',
  '/model-viewer.css?v=0841',
  '/navigation.css?v=0841',
  '/navigation.js?v=0841',
  '/navigation-state.js?v=0840',
  '/runtime-diagnostics.js?v=0841diag1',
  '/browser-storage.js?v=0840',
  '/session-core.js?v=0840',
  '/app.webmanifest?v=0840'
];
// v is the shell's build cache-buster. Keep functional query parameters distinct.
function cacheKey(request){
  const url=new URL(typeof request==='string'?request:request.url,location.origin);
  url.searchParams.delete('v');
  url.hash='';
  return new Request(url.href,{headers:typeof request==='string'?undefined:request.headers});
}
function isPrivate(response){
  return /(?:^|,)\s*private(?:\s|=|,|$)/i.test(response.headers.get('cache-control')||'');
}
let privateMode=false;
async function disableOffline(){
  privateMode=true;
  try{
    const names=await caches.keys();
    await Promise.all(names.filter(name=>name.startsWith('nocturne-shell-')).map(name=>caches.delete(name)));
  }catch{}
}
async function remember(request,response){
  if(isPrivate(response)||response.status===401||response.status===403){
    await disableOffline();
    return;
  }
  if(privateMode||!response.ok||response.status===206)return;
  try{
    const cache=await caches.open(SHELL);
    if(!privateMode)await cache.put(cacheKey(request),response.clone());
  }catch{} // A full or unavailable cache must not break a successful request.
}
async function fallback(request,navigation){
  if(privateMode)return undefined;
  try{
    const cache=await caches.open(SHELL);
    const response=(await cache.match(cacheKey(request)))||(navigation?await cache.match(cacheKey('/')):undefined);
    return privateMode?undefined:response;
  }catch{return undefined;}
}
async function networkFirst(request,navigation){
  let response;
  try{response=await fetch(request,{cache:'no-cache'});}catch{}
  if(response){
    await remember(request,response);
    // Authentication failures and missing routes must remain visible. Private
    // responses must never be replaced by a previously cached public document.
    if(response.status<500||isPrivate(response))return response;
  }
  return (await fallback(request,navigation))||response||Response.error();
}
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    for(const url of CORE){
      try{await remember(url,await fetch(url,{cache:'reload'}));}catch{}
    }
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    try{
      const keys=await caches.keys();
      await Promise.all(keys.filter(k=>k.startsWith('nocturne-shell-')&&k!==SHELL).map(k=>caches.delete(k)));
    }catch{}
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(url.origin!==location.origin)return;
  if(req.headers.has('authorization')){event.waitUntil(disableOffline());return;}
  if(req.method!=='GET'||/^\/(?:api|v1|media)(?:\/|$)/.test(url.pathname))return;
  if(req.cache==='no-store'||req.headers.has('range'))return;
  const navigation=req.mode==='navigate';
  if(navigation||['/portraits/neutral-20261011.webp','/portraits/friendly-20261011.webp'].includes(url.pathname)||url.pathname==='/nocturne-icon.svg'||/\.(?:js|css|webmanifest|json)$/i.test(url.pathname)){
    event.respondWith(networkFirst(req,navigation));
  }
});
