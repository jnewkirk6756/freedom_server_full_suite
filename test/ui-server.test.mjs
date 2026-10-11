import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {fileURLToPath} from 'node:url';
async function start(t,extra={}){
 const child=spawn(process.execPath,['launch/server.mjs'],{cwd:fileURLToPath(new URL('..',import.meta.url)),env:{PATH:process.env.PATH,HOST:'127.0.0.1',PORT:'0',...extra},stdio:['ignore','pipe','pipe']});
 t.after(async()=>{if(child.exitCode===null){const ended=once(child,'exit');child.kill();await ended}});
 return new Promise((resolve,reject)=>{let text='';const timer=setTimeout(()=>reject(Error('Server did not start')),5000);child.stdout.on('data',data=>{text+=data;const match=text.match(/BOUND_PORT=(\d+)/);if(match){clearTimeout(timer);resolve('http://127.0.0.1:'+match[1])}});child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited early'))})});
}
test('neutral Model Studio route serves its complete local asset graph with shared navigation',async t=>{
 const url=await start(t),response=await fetch(url+'/model-viewer/');assert.equal(response.status,200);const html=await response.text();
 assert.match(html,/id="model-canvas"/);assert.match(html,/href="\/model-viewer\/" aria-current="page"/);assert.equal((html.match(/id="nocturne-navigation"/g)||[]).length,1);
 const assets=[...html.matchAll(/(?:src|href)="(\/[^"<>]+\.(?:js|css)(?:\?[^"<>]*)?)"/g)].map(match=>match[1]);
 for(const asset of assets){const r=await fetch(url+asset);assert.equal(r.status,200,asset);assert.ok((await r.text()).length>10,asset);}
 assert.doesNotMatch(html,/https:\/\//);
});
test('new viewer and utilities remain behind the existing hosted access boundary',async t=>{
 const url=await start(t,{HOST:'0.0.0.0'});
 for(const path of ['/model-viewer/','/viewer-core.js','/xr-session-core.js','/ui-shell.js']){const response=await fetch(url+path);assert.equal(response.status,503,path);assert.equal((await response.json()).error.code,'PRIVATE_ACCESS_NOT_CONFIGURED');}
});
test('served pages identify their deployed build before any screen script runs',async t=>{
 const url=await start(t,{RENDER_GIT_COMMIT:'5d032f72478f044f4a7cac583a76c48f9f6eaf13'});
 for(const path of ['/','/experience/','/live/','/vr/','/model-viewer/']){
  const html=await (await fetch(url+path)).text();
  assert.match(html,/Build 0\.84\.1-diag\.1 · 5d032f7/,path);
  assert.equal((html.match(/id="nocturne-runtime-status"/g)||[]).length,1,path);
  assert.match(html,/<head[^>]*><script src="\/runtime-diagnostics\.js\?v=0841diag1"><\/script>/,path);
 }
 const script=await fetch(url+'/runtime-diagnostics.js?v=0841diag1');assert.equal(script.status,200);assert.match(await script.text(),/NocturneRuntimeDiagnostics/);
});

test('bundled portrait assets are exact binary WebP files with GET/HEAD and a fixed allowlist',async t=>{
 const url=await start(t);
 for(const name of ['neutral','friendly']){
  const path='/portraits/'+name+'-20261011.webp',response=await fetch(url+path),data=Buffer.from(await response.arrayBuffer());
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');assert.equal(data.subarray(0,4).toString(),'RIFF');assert.equal(data.subarray(8,12).toString(),'WEBP');assert.ok(data.length>100000&&data.length<350000);
  const head=await fetch(url+path,{method:'HEAD'});assert.equal(head.status,200);assert.equal((await head.arrayBuffer()).byteLength,0);
 }
 assert.equal((await fetch(url+'/portraits/not-allowlisted.webp')).status,404);
 for(const path of ['/live/','/vr/']){const html=await (await fetch(url+path)).text();assert.match(html,/neutral-portrait.js/);assert.equal((html.match(/id="neutral-portrait-select"/g)||[]).length,1);assert.match(html,/Your imported images take priority/);}
});
test('both new portraits and loader preserve hosted denial and authenticated private responses',async t=>{
 const password='public-test-fixture-not-a-secret',url=await start(t,{NOCTURNE_ACCESS_PASSWORD:password});
 const headers={authorization:'Basic '+Buffer.from('owner:'+password).toString('base64')};
 for(const path of ['/neutral-portrait.js','/neutral-portrait.css','/portraits/neutral-20261011.webp','/portraits/friendly-20261011.webp']){
  const denied=await fetch(url+path);assert.equal(denied.status,401);assert.equal(denied.headers.get('cache-control'),'private, no-store');
  const allowed=await fetch(url+path,{headers});assert.equal(allowed.status,200);assert.equal(allowed.headers.get('cache-control'),'private, no-store');
 }
});
