import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../launch/browser-storage.js',import.meta.url),'utf8');
function memory(seed={}){const data=new Map(Object.entries(seed));return {get length(){return data.size;},key:i=>[...data.keys()][i]??null,getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k),clear:()=>data.clear()};}
function boot({local=memory(),session=memory(),blocked=false}={}){
 const nodes=new Map(),listeners=[];const context={document:{readyState:'complete',body:{prepend:n=>nodes.set(n.id,n)},getElementById:id=>nodes.get(id),createElement:()=>({style:{},setAttribute(){}}),addEventListener:(_,fn)=>listeners.push(fn)}};context.window=context;
 for(const [name,value] of [['localStorage',local],['sessionStorage',session]])Object.defineProperty(context,name,{configurable:true,get(){if(blocked)throw Error('blocked');return value;}});
 vm.runInNewContext(source,context);return{context,nodes};
}
test('healthy browser storage is preserved and writes remain persistent',()=>{
 const native=memory({existing:'keep'}),{context,nodes}=boot({local:native});
 assert.equal(context.localStorage.getItem('existing'),'keep');context.localStorage.setItem('draft','saved');assert.equal(native.getItem('draft'),'saved');assert.equal(context.localStorage.length,2);assert.equal(nodes.size,0);
});
test('blocked storage getters do not crash startup and get a visible warning',()=>{
 const {context,nodes}=boot({blocked:true});context.sessionStorage.setItem('draft','hello');assert.equal(context.sessionStorage.getItem('draft'),'hello');assert.match(nodes.get('nocturne-storage-warning').textContent,/only last on this page/);
 assert.equal(context.localStorage.getItem('missing'),null);
});
test('quota failure preserves old values and keeps new changes in memory',()=>{
 const native=memory({old:'valuable'});native.setItem=()=>{throw Error('quota');};const {context,nodes}=boot({local:native});
 context.localStorage.setItem('draft','new');assert.equal(context.localStorage.getItem('draft'),'new');assert.equal(context.localStorage.getItem('old'),'valuable');assert.equal(native.getItem('old'),'valuable');assert.equal(native.getItem('draft'),null);assert.equal(nodes.size,1);
});
test('read and delete failures degrade without losing unrelated saved data',()=>{
 const native=memory({old:'keep',remove:'x'});native.removeItem=()=>{throw Error('blocked');};const {context}=boot({local:native});
 context.localStorage.removeItem('remove');assert.equal(context.localStorage.getItem('remove'),null);assert.equal(native.getItem('remove'),'x');assert.equal(context.localStorage.getItem('old'),'keep');assert.equal(context.localStorage.length,1);
});
test('per-page fallback is never falsely reported as persisted after reload',()=>{
 const first=boot({blocked:true});first.context.localStorage.setItem('draft','temporary');const second=boot({blocked:true});assert.equal(second.context.localStorage.getItem('draft'),null);
});
test('adapter installs only once and does not reset data',()=>{
 const {context}=boot();context.sessionStorage.setItem('draft','keep');const store=context.sessionStorage;vm.runInNewContext(source,context);assert.equal(context.sessionStorage,store);assert.equal(context.sessionStorage.getItem('draft'),'keep');
});
