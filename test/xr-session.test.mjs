import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx=vm.createContext({});
vm.runInContext(readFileSync(new URL('../launch/xr-session-core.js',import.meta.url),'utf8'),ctx);
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return{promise,resolve,reject}};
class Session extends EventTarget {
  calls=0;fail=false;
  async end(){this.calls++;if(this.fail)throw Error('End rejected');this.dispatchEvent(new Event('end'));}
}
const setup=(overrides={})=>{
  const session=new Session(),events=[];
  const core=ctx.NocturneXRSession.create({request:async()=>session,prepare:async()=>{},started:()=>events.push('start'),stopped:reason=>events.push('stop:'+reason),failed:(e,phase)=>events.push('error:'+phase),...overrides});
  return {core,session,events};
};
test('XR starts, exits and re-enters with one cleanup per session',async()=>{
  const h=setup();assert.equal(await h.core.start(),true);assert.equal(h.core.status().state,'active');
  assert.equal(await h.core.start(),false);assert.equal(await h.core.stop(),true);assert.equal(h.session.calls,1);
  assert.deepEqual(h.events,['start','stop:exit']);assert.equal(h.core.status().state,'idle');
  assert.equal(await h.core.start(),true);await h.core.stop();assert.equal(h.session.calls,2);
});
test('repeated entry while a browser permission request is pending requests once',async()=>{
  const pending=deferred();let calls=0;const h=setup({request:()=>{calls++;return pending.promise}});
  const start=h.core.start();assert.equal(await h.core.start(),false);pending.resolve(h.session);
  assert.equal(await start,true);assert.equal(calls,1);await h.core.stop();
});
test('page exit cancels a pending request and closes the late session',async()=>{
  const pending=deferred();const h=setup({request:()=>pending.promise});const start=h.core.start();
  const stop=h.core.stop('pagehide');assert.equal(h.core.status().state,'cancelling');assert.equal(await h.core.start(),false);
  pending.resolve(h.session);assert.equal(await stop,true);assert.equal(await start,false);assert.equal(h.session.calls,1);assert.equal(h.core.status().state,'idle');assert.equal(h.events.includes('start'),false);
});
test('session end during async reference-space setup cannot start a stale frame loop',async()=>{
  const pending=deferred(),ready=deferred();let current;const h=setup({prepare:async(s,isCurrent)=>{current=isCurrent;ready.resolve();await pending.promise}});
  const start=h.core.start();await ready.promise;h.session.dispatchEvent(new Event('end'));
  assert.equal(current(),false);pending.resolve();assert.equal(await start,false);assert.equal(h.core.status().state,'idle');assert.equal(h.events.includes('start'),false);
});
test('setup failure ends the granted session and allows retry',async()=>{
  const h=setup({prepare:async()=>{throw Error('Reference space missing')}});assert.equal(await h.core.start(),false);
  assert.equal(h.session.calls,1);assert.equal(h.core.status().session,null);assert.deepEqual(h.events,['error:start','stop:setup-failed']);
});
test('failed end retains the session and exposes an actionable retry',async()=>{
  const h=setup();await h.core.start();h.session.fail=true;assert.equal(await h.core.stop(),false);
  assert.equal(h.core.status().state,'error');assert.equal(h.core.status().session,h.session);assert.equal(await h.core.start(),false);
  h.session.fail=false;assert.equal(await h.core.stop(),true);assert.equal(h.core.status().state,'idle');assert.equal(h.session.calls,2);
});
test('concurrent exits share the in-flight end operation',async()=>{
  const h=setup(),pending=deferred();h.session.end=()=>{h.session.calls++;return pending.promise};await h.core.start();
  const a=h.core.stop(),b=h.core.stop();await Promise.resolve();assert.equal(h.session.calls,1);pending.resolve();assert.equal(await a,true);assert.equal(await b,true);assert.equal(h.events.filter(x=>x.startsWith('stop:')).length,1);
});
test('request rejection returns to idle without a false session-ended notification',async()=>{
  const h=setup({request:async()=>{throw Error('Permission denied')}});assert.equal(await h.core.start(),false);
  assert.equal(h.core.status().state,'idle');assert.deepEqual(h.events,['error:request']);
});
test('cancelled permission rejection leaves no stale busy state or error',async()=>{
  const pending=deferred(),h=setup({request:()=>pending.promise}),start=h.core.start();const stop=h.core.stop();pending.reject(Error('Denied'));
  assert.equal(await stop,true);assert.equal(await start,false);assert.equal(h.core.status().state,'idle');assert.deepEqual(h.events,[]);
});


test('synchronous end failure remains retryable',async()=>{
 const h=setup();await h.core.start();let calls=0;h.session.end=()=>{calls++;throw Error('Sync failure')};
 assert.equal(await h.core.stop(),false);assert.equal(await h.core.stop(),false);assert.equal(calls,2);
 h.session.end=async()=>{calls++};assert.equal(await h.core.stop(),true);assert.equal(calls,3);
});

test('late setup completion from an ended session cannot replace a new active session',async()=>{
 const first=new Session(),second=new Session(),pending=deferred(),ready=deferred(),started=[];
 let requests=0;
 const h=setup({request:async()=>++requests===1?first:second,prepare:async target=>{if(target===first){ready.resolve();await pending.promise}},started:target=>started.push(target)});
 const entering=h.core.start();await ready.promise;first.dispatchEvent(new Event('end'));
 assert.equal(await h.core.start(),true);assert.equal(h.core.status().session,second);
 pending.resolve();assert.equal(await entering,false);assert.deepEqual(started,[second]);
 assert.equal(h.core.status().state,'active');await h.core.stop();assert.equal(second.calls,1);
});

test('late setup rejection from an ended session does not tear down its replacement',async()=>{
 const first=new Session(),second=new Session(),pending=deferred(),ready=deferred();let requests=0;
 const h=setup({request:async()=>++requests===1?first:second,prepare:async target=>{if(target===first){ready.resolve();await pending.promise}}});
 const entering=h.core.start();await ready.promise;first.dispatchEvent(new Event('end'));await h.core.start();
 pending.reject(Error('Old reference-space failure'));assert.equal(await entering,false);
 assert.equal(h.core.status().session,second);assert.equal(h.core.status().state,'active');assert.equal(second.calls,0);
 assert.equal(h.events.some(event=>event.startsWith('error:')),false);await h.core.stop();
});
