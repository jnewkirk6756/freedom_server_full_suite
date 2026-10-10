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
