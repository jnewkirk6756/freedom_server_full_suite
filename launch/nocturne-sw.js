const VERSION='nocturne-sw-0.84.0';
const SHELL='nocturne-shell-0840';
const CORE=[
  '/',
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
  '/navigation.css?v=0840',
  '/navigation.js?v=0840',
  '/session-core.js?v=0840',
  '/app.webmanifest?v=0840'
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
