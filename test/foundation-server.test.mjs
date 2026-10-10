import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function start(t,extra={}) {
 const child=spawn(process.execPath,['launch/server.mjs'],{cwd:root,env:{PATH:process.env.PATH,HOST:'127.0.0.1',PORT:'0',NODE_ENV:'test',...extra},stdio:['ignore','pipe','pipe']});
 let output='';child.stdout.on('data',d=>output+=d);child.stderr.on('data',d=>output+=d);
 t.after(async()=>{if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}});
 const url=await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Startup timed out: '+output)),5000);
  child.once('exit',code=>{clearTimeout(timeout);reject(Error('Server exited '+code+': '+output));});
  child.stdout.on('data',()=>{const m=output.match(/BOUND_PORT=(\d+)/);if(m){clearTimeout(timeout);resolve('http://127.0.0.1:'+m[1]);}});
 });
 return {url,output:()=>output};
}
test('credential-free local startup has no automatic provider or cache self-tests',async t=>{
 const s=await start(t);const r=await fetch(s.url+'/');assert.equal(r.status,200);assert.match(await r.text(),/NOCTURNE/);
 await new Promise(r=>setTimeout(r,600));assert.doesNotMatch(s.output(),/NOCTURNE_SELF_TEST|MEDIA_SYNC/);
 for(const route of ['/v1/director/status','/v1/media/status','/media/A01.mp4']){const r=await fetch(s.url+route);assert.equal(r.status,503);assert.equal((await r.json()).error.code,'PRIVATE_ACCESS_NOT_CONFIGURED');}
 const health=await fetch(s.url+'/v1/health');assert.equal(health.status,200);assert.equal((await health.json()).ok,true);
});
test('all documented screen routes and first-party assets are served locally',async t=>{
 const s=await start(t);const routes=['/','/experience/','/live/','/devices/','/vr/','/world/','/player/','/matrix/','/nps/','/commission/','/director/','/video-router/','/photo-space/','/travel/','/venice-setup/','/app/','/launcher/'];
 const assets=new Set();
 for(const route of routes){const r=await fetch(s.url+route);assert.equal(r.status,200,route);const html=await r.text();assert.equal((html.match(/id="nocturne-navigation"/g)||[]).length,1,route);for(const m of html.matchAll(/(?:src|href)="(\/[^"<>]+\.(?:js|css|webmanifest|svg)(?:\?[^"<>]*)?)"/g))assets.add(m[1]);}
 for(const asset of assets){const r=await fetch(s.url+asset);assert.equal(r.status,200,asset);assert.ok((await r.arrayBuffer()).byteLength>0,asset);}
 const head=await fetch(s.url+'/navigation.js',{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
 assert.equal((await fetch(s.url+'/does-not-exist')).status,404);
 assert.equal((await fetch(s.url+'/materials/oak.webp')).status,200);
});
test('public binding without owner configuration is locked and health stays available',async t=>{
 const s=await start(t,{HOST:'0.0.0.0'});
 assert.equal((await fetch(s.url+'/')).status,503);assert.equal((await fetch(s.url+'/v1/health')).status,200);
});
test('authenticated deployment gates static and backend access and shared writes',async t=>{
 const password='public-test-fixture-not-a-secret';const s=await start(t,{NOCTURNE_ACCESS_PASSWORD:password});
 const denied=await fetch(s.url+'/');assert.equal(denied.status,401);assert.match(denied.headers.get('www-authenticate'),/^Basic/);assert.equal(denied.headers.get('cache-control'),'private, no-store');
 const headers={authorization:'Basic '+Buffer.from('owner:'+password).toString('base64')};
 const html=await fetch(s.url+'/',{headers});assert.equal(html.status,200);assert.equal(html.headers.get('cache-control'),'private, no-store');assert.doesNotMatch(await html.text(),/public-test-fixture-not-a-secret/);
 for(const method of ['PUT','DELETE']){const r=await fetch(s.url+'/v1/media/A01',{method,headers});assert.equal(r.status,403);assert.equal((await r.json()).error.code,'SHARED_MEDIA_WRITES_DISABLED');}
 const cross=await fetch(s.url+'/v1/example',{method:'POST',headers:{...headers,origin:'https://evil.invalid'}});assert.equal(cross.status,403);
});
