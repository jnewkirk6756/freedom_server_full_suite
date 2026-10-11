import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {withRuntimeDiagnostics, DIAGNOSTICS_VERSION} from '../launch/runtime-diagnostics.mjs';
import {withNavigation} from '../launch/navigation.mjs';
const source=readFileSync(new URL('../launch/runtime-diagnostics.js',import.meta.url),'utf8');
const imageSource=readFileSync(new URL('../launch/face-pack-core.js',import.meta.url),'utf8');

function boot({loading=false}={}) {
 const listeners=new Map(),dom=new Map(),node={hidden:true,textContent:'',dataset:{}},caption={textContent:'More'};
 const context={document:{getElementById:id=>loading?null:id==='nocturne-runtime-message'?node:caption,addEventListener:(name,fn)=>dom.set(name,fn)},addEventListener:(name,fn)=>listeners.set(name,fn)};
 context.window=context;vm.createContext(context);vm.runInContext(source,context);
 return {context,global:vm.runInContext('window',context),node,caption,listeners,report:context.NocturneRuntimeDiagnostics.reportAsset,loaded(){loading=false;dom.get('DOMContentLoaded')();}};
}
test('build label is server-rendered, escaped and present before runtime initialization',()=>{
 const html=withNavigation('<html><head><meta charset="utf-8"><script src="/page.js"></script></head><body class="page"><main>Page</main></body></html>');
 const result=withRuntimeDiagnostics(html,{commit:'5d032f72478f044f4a7cac583a76c48f9f6eaf13'});
 assert.match(result,new RegExp('Build '+DIAGNOSTICS_VERSION.replaceAll('.','\\.')+' · 5d032f7'));
 assert.ok(result.indexOf('/runtime-diagnostics.js')<result.indexOf('/page.js'));
 assert.match(result,/<summary[^>]*><span id="nocturne-build-label"/);assert.doesNotMatch(result,/<aside/);assert.equal(withRuntimeDiagnostics(result),result);
 assert.match(result,/<div id="nocturne-runtime-status"[^>]*><small>Build/);
 const untrusted=withRuntimeDiagnostics(html,{commit:'<img src=x onerror=alert(1)>'});
 assert.match(untrusted,/build ID unavailable/);assert.doesNotMatch(untrusted,/onerror=/);
 assert.equal(withRuntimeDiagnostics('not an HTML page'),'not an HTML page');
});
test('missing assets, storage failure and decoder failure have separate visible messages',()=>{
 const h=boot();
 for(const [code,text] of [['missing-assets',/missing on this browser/],['storage-unavailable',/could not be read/],['storage-blocked',/blocked by another open page/],['decode-failed',/could not be decoded/]]){
  h.report(code);assert.equal(h.node.hidden,false);assert.equal(h.node.dataset.status,code);assert.match(h.node.textContent,text);assert.equal(h.caption.textContent,'Issue');
 }
 h.report('ready');assert.equal(h.node.hidden,true);assert.equal(h.node.textContent,'');assert.equal(h.caption.textContent,'More');
});
test('pre-DOM failures are retained and never reveal error contents',()=>{
 const h=boot({loading:true});h.listeners.get('error')({message:'secret token=private',target:h.global});h.loaded();
 assert.match(h.node.textContent,/page script failed/);assert.doesNotMatch(h.node.textContent,/secret|token|private/);
 h.report('missing-assets');h.report('ready');assert.match(h.node.textContent,/page script failed/);assert.equal(h.node.hidden,false);
});
test('unhandled rejection is visible without swallowing the event or exposing its reason',()=>{
 const h=boot();let prevented=false;h.listeners.get('unhandledrejection')({reason:'private chat content',preventDefault(){prevented=true}});
 assert.match(h.node.textContent,/operation failed/);assert.doesNotMatch(h.node.textContent,/private chat/);assert.equal(prevented,false);
});
test('media failures are not misreported as script crashes and unknown statuses are ignored',()=>{
 const h=boot();h.listeners.get('error')({target:{tagName:'IMG'}});h.report('<script>');assert.equal(h.node.hidden,true);
 h.listeners.get('error')({target:{tagName:'SCRIPT'}});assert.match(h.node.textContent,/page script failed/);
});
test('diagnostics initializes once and has no outbound or persistence operations',()=>{
 const h=boot(),api=h.context.NocturneRuntimeDiagnostics;vm.runInNewContext(source,h.context);assert.equal(h.context.NocturneRuntimeDiagnostics,api);
 assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB)\b/);
});

function images({rows=[],openError=null,openAsyncError=false,openBlocked=false,requestError=null,decodeError=null,prepareError=false,transactionError=null,reportThrows=false}={}) {
 const statuses=[],reads=[],writes=[],failure=Error('synthetic storage failure');
 const request=result=>{const q={result,error:failure};queueMicrotask(()=>requestError?q.onerror():q.onsuccess());return q};
 const db={close(){},transaction(store,mode){
  reads.push(mode);if(transactionError)throw failure;assert.equal(mode,'readonly');
  return{objectStore(){return{get:index=>request(rows.find(row=>row.index===index)),getAll:()=>request(rows),put:()=>writes.push('put'),clear:()=>writes.push('clear')}}};
 }};
 const context={devicePixelRatio:1,URL:{createObjectURL:()=> {if(prepareError)throw Error('synthetic image preparation failure');return 'blob:neutral-test'}},indexedDB:{open(){
  if(openError)throw failure;const q={result:db,error:failure};
  queueMicrotask(()=>{if(openBlocked)q.onblocked();openAsyncError?q.onerror():q.onsuccess()});return q;
 }},Image:class{naturalWidth=500;naturalHeight=200;set src(value){queueMicrotask(()=>decodeError?this.onerror(Error('synthetic decode failure')):this.onload())}},NocturneRuntimeDiagnostics:{reportAsset(code){statuses.push(code);if(reportThrows)throw Error('diagnostic rendering failed')}}};
 context.window=context;vm.runInNewContext(imageSource,context);
 const canvas={clientWidth:200,clientHeight:200,dataset:{},getContext:()=>({setTransform(){},clearRect(){},drawImage(){}})};
 return{core:context.NocturneFacePack,statuses,reads,writes,canvas,failure};
}
test('empty image storage preserves false return and reports missing assets',async()=>{
 const h=images();assert.equal(await h.core.drawState(h.canvas,'calm'),false);assert.deepEqual(h.statuses,['missing-assets']);assert.deepEqual(h.writes,[]);
});
test('unavailable database access preserves the original rejection and reports storage failure',async()=>{
 for(const options of [{openError:true},{openAsyncError:true},{requestError:true},{transactionError:true}]){const h=images(options);await assert.rejects(h.core.drawState(h.canvas,'calm'),error=>error===h.failure);assert.ok(h.statuses.includes('storage-unavailable'));assert.deepEqual(h.writes,[]);}
});
test('image decode rejection is distinguished without replacing or deleting saved assets',async()=>{
 const h=images({rows:[{index:1,blob:{size:1}}],decodeError:true});await assert.rejects(h.core.drawState(h.canvas,'calm'),/synthetic decode failure/);assert.deepEqual(h.statuses,['decode-failed']);assert.deepEqual(h.writes,[]);
});
test('synchronous image preparation failure is diagnosed and rethrown',async()=>{
 const h=images({rows:[{index:1,blob:{size:1}}],prepareError:true});await assert.rejects(h.core.drawState(h.canvas,'calm'),/synthetic image preparation failure/);assert.deepEqual(h.statuses,['decode-failed']);assert.deepEqual(h.writes,[]);
});
test('blocked database warning clears only after the existing load successfully draws',async()=>{
 const h=images({rows:[{index:1,blob:{size:1}}],openBlocked:true});await h.core.drawState(h.canvas,'calm');assert.ok(h.statuses.includes('storage-blocked'));assert.equal(h.statuses.at(-1),'ready');assert.deepEqual(h.writes,[]);
});
test('successful neutral drawing and selection survive broken diagnostics unchanged',async()=>{
 const h=images({rows:[{index:1,blob:{size:1}}],reportThrows:true}),selected=h.core.state('calm');
 assert.equal(await h.core.drawState(h.canvas,selected),selected);assert.equal(h.canvas.dataset.faceState,selected.id);assert.deepEqual(h.statuses,['ready']);assert.deepEqual(h.writes,[]);
});

test('a loaded built-in portrait makes an empty optional local pack non-fatal in either load order',()=>{
 for(const order of ['portrait-first','pack-first']){
  const h=boot();if(order==='portrait-first')h.context.NocturneRuntimeDiagnostics.reportPortrait('ready');
  h.report('missing-assets');h.context.NocturneRuntimeDiagnostics.reportPortrait('ready');
  assert.equal(h.node.hidden,true);assert.equal(h.caption.textContent,'More');
 }
});
test('portrait success never suppresses local storage, decoder or script errors',()=>{
 const h=boot();h.context.NocturneRuntimeDiagnostics.reportPortrait('ready');
 for(const code of ['storage-unavailable','storage-blocked','decode-failed']){h.report(code);assert.equal(h.node.hidden,false);assert.equal(h.node.dataset.status,code);}
 h.listeners.get('error')({target:h.global});h.report('missing-assets');h.context.NocturneRuntimeDiagnostics.reportPortrait('ready');assert.match(h.node.textContent,/page script failed/);
});
test('portrait failures keep useful feedback until an explicit successful retry',()=>{
 const h=boot();h.context.NocturneRuntimeDiagnostics.reportPortrait('unavailable');assert.match(h.node.textContent,/existing display was kept/);h.context.NocturneRuntimeDiagnostics.reportPortrait('bogus');assert.equal(h.node.hidden,false);h.context.NocturneRuntimeDiagnostics.reportPortrait('ready');assert.equal(h.node.hidden,true);
});

test('failed manual variant change does not call an optional pack missing when a portrait remains visible',()=>{
 const h=boot();h.report('missing-assets');h.context.NocturneRuntimeDiagnostics.reportPortrait('ready');h.context.NocturneRuntimeDiagnostics.reportPortrait('unavailable');assert.equal(h.node.dataset.status,'portrait-unavailable');assert.doesNotMatch(h.node.textContent,/Local image assets/);
});
