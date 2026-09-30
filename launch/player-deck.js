/** Two bounded media elements. Failed/cancelled switches never become successful selections. */
export class LoopDeck {
 constructor(a,b,{timeoutMs=12000,fadeMs=240,onState=()=>{}}={}){
  this.videos=[a,b];this.active=-1;this.urls=[null,null];this.timeoutMs=timeoutMs;this.fadeMs=fadeMs;this.onState=onState;this.generation=0;this.busy=false;this.controller=null;this.currentId=null;this.disposed=false;this.settled=Promise.resolve();this.resetting=false;
  for(const v of this.videos){v.muted=true;v.playsInline=true;v.loop=true;v.preload='metadata';v.style.opacity='0';}
 }
 current(){return this.videos[this.active]||null;}
 release(i){const v=this.videos[i];v.pause();v.removeAttribute('src');v.load();v.style.opacity='0';if(this.urls[i])URL.revokeObjectURL(this.urls[i]);this.urls[i]=null;}
 async switchTo(id,blob,{time=0,loop=true}={}){
  if(this.disposed||this.resetting)throw Error('PLAYER_CLOSED');
  if(this.busy)throw Error('SWITCH_BUSY');
  const epoch=++this.generation;this.busy=true;this.settled=new Promise(resolve=>{this.resolveSettled=resolve;});this.controller=new AbortController();const signal=this.controller.signal,slot=this.active===0?1:0,v=this.videos[slot];
  const old=this.active;this.onState('loading');
  try{
   this.release(slot);this.urls[slot]=URL.createObjectURL(blob);v.loop=loop;
   const ready=waitFor(v,'loadeddata',signal,this.timeoutMs,()=>v.readyState>=2);
   v.src=this.urls[slot];v.load();await ready;
   if(!Number.isFinite(v.duration)||v.duration<=0||v.duration>120)throw Error('INVALID_DURATION');
   if(v.videoWidth*v.videoHeight>3840*2160)throw Error('RESOLUTION_LIMIT');
   v.currentTime=Math.min(Math.max(0,time),Math.max(0,v.duration-.05));
   await bounded(v.play(),signal,this.timeoutMs);
   if(epoch!==this.generation||this.disposed)throw Error('CANCELLED');
   const fade=matchMedia('(prefers-reduced-motion: reduce)').matches?0:this.fadeMs;
   v.style.transition=`opacity ${fade}ms linear`;v.style.opacity='1';
   if(old>=0){this.videos[old].style.transition=`opacity ${fade}ms linear`;this.videos[old].style.opacity='0';}
   await bounded(new Promise(r=>setTimeout(r,fade)),signal,this.timeoutMs);
   if(epoch!==this.generation)throw Error('CANCELLED');
   if(old>=0)this.release(old);
   this.active=slot;this.currentId=id;this.onState('playing');return{duration:v.duration,width:v.videoWidth,height:v.videoHeight};
  }catch(error){this.release(slot);if(old>=0)this.videos[old].style.opacity='1';this.onState(error.name==='NotAllowedError'?'tap-to-play':error.message==='CANCELLED'?'paused':'error');throw error;}
  finally{this.busy=false;this.controller=null;this.resolveSettled?.();}
 }
 async resume(){const v=this.current();if(!v)throw Error('NO_CLIP');await v.play();this.onState('playing');}
 pause(){this.generation++;this.controller?.abort();for(const v of this.videos)v.pause();this.onState('paused');}
 async reset(){this.resetting=true;this.pause();await this.settled;for(let i=0;i<2;i++)this.release(i);this.active=-1;this.currentId=null;this.disposed=false;this.resetting=false;}
 close(){this.pause();this.disposed=true;for(let i=0;i<2;i++)this.release(i);this.active=-1;this.currentId=null;}
}
export function bounded(promise,signal,ms){return new Promise((resolve,reject)=>{
 let done=false;const finish=(fn,x)=>{if(done)return;done=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);fn(x);};
 const abort=()=>finish(reject,Error('CANCELLED'));const timer=setTimeout(()=>finish(reject,Error('MEDIA_TIMEOUT')),ms);
 if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(x=>finish(resolve,x),e=>finish(reject,e));
});}
export function waitFor(v,type,signal,ms,ready=()=>false){
 if(ready())return Promise.resolve();
 return new Promise((resolve,reject)=>{const cleanup=()=>{clearTimeout(timer);v.removeEventListener(type,ok);v.removeEventListener('error',fail);signal?.removeEventListener('abort',abort);};const ok=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('MEDIA_DECODE_FAILED'));},abort=()=>{cleanup();reject(Error('CANCELLED'));};const timer=setTimeout(()=>{cleanup();reject(Error('MEDIA_TIMEOUT'));},ms);v.addEventListener(type,ok,{once:true});v.addEventListener('error',fail,{once:true});if(signal?.aborted)return abort();signal?.addEventListener('abort',abort,{once:true});});
}
