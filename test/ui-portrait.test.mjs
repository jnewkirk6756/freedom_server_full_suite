import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../launch/neutral-portrait.js',import.meta.url),'utf8');
const vr=readFileSync(new URL('../launch/vr-fallback.js',import.meta.url),'utf8');
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
const flush=()=>new Promise(resolve=>setImmediate(resolve));
function boot({saved=null,storageBlocked=false}={}){
 const images=[],writes=[],reports=[],events=[],timers=new Map(),listeners=new Map();let timerId=0;
 const poster={src:'data:image/jpeg;base64,existing',isConnected:true,dataset:{},style:{opacity:'0'},hasAttribute:key=>key==='data-neutral-portrait'};
 const picker={value:'',addEventListener:(name,fn)=>listeners.set(name,fn)};
 const context={Image:class{naturalWidth=944;naturalHeight=1667;gate=defer();constructor(){images.push(this)}decode(){return this.gate.promise}},
  localStorage:{getItem(){if(storageBlocked)throw Error('blocked');return saved},setItem:(key,value)=>{if(storageBlocked)throw Error('blocked');writes.push([key,value])}},
  document:{getElementById:id=>id==='anna-poster'?poster:id==='neutral-portrait-select'?picker:null},
  NocturneRuntimeDiagnostics:{reportPortrait:code=>reports.push(code)},
  setTimeout:fn=>{timers.set(++timerId,fn);return timerId},clearTimeout:id=>timers.delete(id),
  dispatchEvent:event=>events.push(event),CustomEvent:class{constructor(type,opts){this.type=type;this.detail=opts.detail}}};
 context.window=context;vm.runInNewContext(source,context);
 return{api:context.NocturneNeutralPortrait,images,writes,reports,events,timers,poster,picker,listeners,context};
}
async function ready(image){image.onload();image.gate.resolve();await flush()}
test('fresh browser loads only calm; swaps only after decode without touching existing preferences',async()=>{
 const h=boot();assert.equal(h.images.length,1);assert.equal(h.images[0].src,'/portraits/neutral-20261011.webp');
 h.images[0].onload();await flush();assert.match(h.poster.src,/^data:/);assert.deepEqual(h.reports,[]);
 h.images[0].gate.resolve();await flush();assert.equal(h.poster.dataset.portrait,'calm');assert.equal(h.poster.width,944);assert.equal(h.poster.height,1667);assert.equal(h.poster.style.opacity,'0');assert.deepEqual(h.writes,[]);assert.equal(h.reports.at(-1),'ready');assert.equal(h.events.at(-1).detail.image,h.images[0]);assert.equal(h.timers.size,0);
});
test('saved friendly choice loads only that image and is independent of IndexedDB',async()=>{
 const h=boot({saved:'friendly'});assert.equal(h.picker.value,'friendly');assert.equal(h.images.length,1);assert.match(h.images[0].src,/friendly/);await ready(h.images[0]);assert.equal(h.poster.height,1666);assert.deepEqual(h.writes,[]);assert.doesNotMatch(source,/indexedDB|NocturneFacePack|telemetry|setExpression|face-state/);
});
test('missing, corrupt and stalled image keeps the embedded poster and settles once',async()=>{
 for(const failure of ['error','decode','dimensions','timeout']){
  const h=boot(),image=h.images[0];
  if(failure==='error')image.onerror();
  if(failure==='decode'){image.onload();image.gate.reject(Error('decode failed'));}
  if(failure==='dimensions'){image.naturalWidth=0;image.onload();}
  if(failure==='timeout'){const onload=image.onload;h.timers.values().next().value();onload();image.gate.resolve();}
  await flush();assert.match(h.poster.src,/^data:/,failure);assert.equal(h.reports.at(-1),'unavailable',failure);assert.equal(h.events.length,0);assert.equal(h.timers.size,0);assert.deepEqual(h.writes,[]);
 }
});
test('manual choice discards stale decode and writes only its own preference',async()=>{
 const h=boot();const first=h.images[0];const chosen=h.api.choose('friendly');await ready(h.images[1]);await chosen;await ready(first);
 assert.equal(h.poster.dataset.portrait,'friendly');assert.equal(h.events.length,1);assert.deepEqual(h.writes,[['nocturne.builtin-portrait.v1','friendly']]);assert.equal(h.api.selected(),'friendly');
 assert.equal(await h.api.choose('https://example.invalid/image'),false);assert.equal(h.images.length,2);
});
test('repeated choices share bounded loads; blocked storage and removed target stay safe',async()=>{
 const h=boot({storageBlocked:true});assert.equal(h.api.load(),h.api.load());h.poster.isConnected=false;await ready(h.images[0]);assert.match(h.poster.src,/^data:/);
 const next=h.api.choose('friendly');await ready(h.images[1]);assert.equal(await next,true);assert.equal(h.images.length,2);assert.deepEqual(h.writes,[]);
});
test('loader installs once and has no remote, provider, local pack or destructive operations',()=>{
 const h=boot(),api=h.api;vm.runInNewContext(source,h.context);assert.equal(h.context.NocturneNeutralPortrait,api);assert.equal(h.images.length,1);
 assert.doesNotMatch(source,/https?:|fetch\(|removeItem|\.clear\(|indexedDB|NocturneSession/);
});
function section(start,end){return vr.slice(vr.indexOf(start),vr.indexOf(end,vr.indexOf(start)))}
function vrHarness({gridReady=false,dpr=1}={}){
 const calls=[],ctx={setTransform:(...args)=>calls.push(['transform',...args]),fillRect(){},drawImage:(...args)=>calls.push(['draw',...args])};
 const canvas={width:360,height:600};let uploads=0;
 const context=vm.createContext({devicePixelRatio:dpr,annaCanvas:canvas,annaCtx:ctx,annaPoster:{naturalWidth:120,naturalHeight:212},annaPosterReady:false,annaFaceReady:gridReady,annaFaceError:'missing',annaTexReady:true,lastMenu:7,annaTex:{},annaTexW:360,annaTexH:600,annaLastUpload:0,ensureAnnaCanvas:()=>canvas,
 gl:{bindTexture(){},pixelStorei(){},texImage2D(){uploads++}}});
 vm.runInContext(section('function posterAvailable','annaPoster.onload')+'\n'+section('function drawAnnaFallback','async function loadAnnaFaceState')+'\n'+section('function updateAnnaTexture','function annaPlaneGeometry'),context);
 return{context,canvas,calls,get uploads(){return uploads}};
}
test('late decoded VR portrait refreshes once, resets DPR transform, and bounds its backing size',()=>{
 for(const dpr of [1,2,3]){
  const h=vrHarness({dpr}),image={naturalWidth:944,naturalHeight:1667};h.context.posterAvailable(image);assert.equal(h.context.annaTexReady,false);assert.deepEqual([h.canvas.width,h.canvas.height],[720,1200]);assert.deepEqual(h.calls[0],['transform',1,0,0,1,0,0]);
  h.context.updateAnnaTexture(100);assert.equal(h.uploads,1);const draws=h.calls.filter(c=>c[0]==='draw').length;
  h.context.updateAnnaTexture(110);assert.equal(h.uploads,1);assert.equal(h.calls.filter(c=>c[0]==='draw').length,draws);
 }
});
test('a local grid that wins the load race stays on screen when the portrait finishes',()=>{
 const h=vrHarness({gridReady:true});h.context.posterAvailable({naturalWidth:944,naturalHeight:1667});assert.equal(h.calls.length,0);assert.equal(h.context.annaTexReady,true);assert.equal(h.context.annaFaceReady,true);assert.deepEqual([h.canvas.width,h.canvas.height],[360,600]);
});
test('explicit reselection retries a failed image while preserving successful deduplication',async()=>{
 const h=boot();h.images[0].onerror();await flush();const retried=h.api.choose('calm');assert.equal(h.images.length,2);await ready(h.images[1]);assert.equal(await retried,true);await h.api.choose('calm');assert.equal(h.images.length,2);assert.equal(h.poster.dataset.portrait,'calm');
});
