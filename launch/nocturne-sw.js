const VERSION='nocturne-sw-0.80.0';
const SHELL='nocturne-shell-0800';
const CORE=[
  '/',
  '/live/',
  '/vr/',
  '/experience.css?v=0800',
  '/live-embodied.css?v=0800',
  '/experience-mobile-safe.js?v=0800',
  '/video-state-core.js?v=0800',
  '/asset-pack-core.js?v=0800',
  '/anna-avatar-runtime.js?v=0800',
  '/vr.js?v=0800',
  '/vr-fallback.js?v=0800',
  '/vr.css?v=0800',
  '/navigation.css?v=0800',
  '/navigation.js?v=0800',
  '/session-core.js?v=0800',
  '/app.webmanifest?v=0800'
];
self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(SHELL);
    for(const url of CORE){try{const r=await fetch(url,{cache:'reload'});if(r.ok)await cache.put(url,r.clone())}catch{}}
    await self.skipWaiting();
  })());
});
self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>k.startsWith('nocturne-shell-')&&k!==SHELL).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch',event=>{
  const req=event.request,url=new URL(req.url);
  if(url.origin!==location.origin)return;
  if(url.pathname.startsWith('/v1/')||url.pathname.startsWith('/media/'))return;
  if(req.method!=='GET')return;
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req);
        const cache=await caches.open(SHELL);cache.put(req,fresh.clone()).catch(()=>{});
        return fresh;
      }catch{
        return (await caches.match(req))||(await caches.match('/'))||Response.error();
      }
    })());
    return;
  }
  if(/\.(?:js|css|webmanifest|json)$/i.test(url.pathname)){
    event.respondWith((async()=>{
      const cached=await caches.match(req);
      const refresh=fetch(req).then(async r=>{if(r.ok){const cache=await caches.open(SHELL);await cache.put(req,r.clone())}return r}).catch(()=>null);
      return cached||(await refresh)||Response.error();
    })());
  }
});
