import{getClipSynced,stateById,VIDEO_ANCHOR_SECONDS}from'./video-state-core.js';
const wait=(video,event='loadeddata',ms=12000)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('Video load timed out.'));},ms),ok=()=>{cleanup();resolve();},bad=()=>{cleanup();reject(Error('Video state could not load.'));},cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,ok);video.removeEventListener('error',bad);};video.addEventListener(event,ok,{once:true});video.addEventListener('error',bad,{once:true});});
export function createVideoStatePlayer({host,primary=null,statusEl=null,fallback=null,onState=()=>{}}={}){
  if(!host)return{init:async()=>false,request:async()=>false,current:()=>null,destroy:()=>{}};
  const first=primary||host.querySelector('video')||document.createElement('video'),second=document.createElement('video'),videos=[first,second];
  host.classList.add('video-state-stage');
  videos.forEach((v,i)=>{v.classList.add('video-state-layer');v.dataset.videoLayer=String(i);v.muted=true;v.playsInline=true;v.loop=true;v.preload='auto';v.setAttribute('aria-hidden','true');if(!v.parentNode)host.prepend(v);});
  let active=0,currentId=null,pending=null,destroyed=false,raf=0,transitionTimer=0,urls=[null,null],requestSeq=0;
  function label(id,extra=''){const s=stateById(id);if(statusEl)statusEl.textContent=s?(s.id+(extra?' · '+extra:'')):String(extra||'READY');}
  function revoke(i){if(urls[i]){URL.revokeObjectURL(urls[i]);urls[i]=null;}}
  function showFallback(show,text=''){if(fallback)fallback.hidden=!show;if(show&&text){const cue=fallback.querySelector?.('#orb-cue,[data-video-cue],span');if(cue)cue.textContent=text;}}
  async function loadInto(i,id,seq){
    const row=await getClipSynced(id);if(!row?.blob)return null;
    if(seq!==requestSeq||destroyed)return null;
    const v=videos[i];revoke(i);const url=URL.createObjectURL(row.blob);urls[i]=url;v.src=url;v.load();await wait(v,'loadeddata');if(seq!==requestSeq||destroyed)return null;
    try{v.currentTime=0;}catch{}return row;
  }
  async function activateInitial(id){
    const seq=++requestSeq,row=await loadInto(active,id,seq);if(!row){label(id,'MISSING');showFallback(true,'Import '+id+' in Video States.');return false;}
    const v=videos[active];v.classList.add('active');v.style.opacity='1';showFallback(false);currentId=id;label(id,'LIVE');try{await v.play();}catch{}onState({id,state:stateById(id),reason:'initial'});window.dispatchEvent(new CustomEvent('nocturne:video-state',{detail:{id,reason:'initial'}}));return true;
  }
  function readyForAnchor(){
    const v=videos[active];if(!currentId||v.paused||!Number.isFinite(v.duration)||!v.duration)return true;
    const remain=v.duration-v.currentTime;return v.currentTime<=.22||remain<=VIDEO_ANCHOR_SECONDS+.12;
  }
  async function swap(reason='anchor'){
    if(!pending||destroyed)return false;
    const p=pending;pending=null;const from=active,to=1-active,old=videos[from],next=videos[to];
    try{next.currentTime=0;}catch{}next.classList.add('active');next.style.opacity='0';try{await next.play();}catch{}
    requestAnimationFrame(()=>{next.style.opacity='1';old.style.opacity='0';});
    clearTimeout(transitionTimer);transitionTimer=setTimeout(()=>{old.classList.remove('active');try{old.pause();old.currentTime=0;}catch{}revoke(from);},220);
    active=to;currentId=p.id;label(p.id,'LIVE');showFallback(false);onState({id:p.id,state:stateById(p.id),reason});window.dispatchEvent(new CustomEvent('nocturne:video-state',{detail:{id:p.id,reason}}));return true;
  }
  function monitor(){
    if(destroyed)return;
    if(pending){const age=performance.now()-pending.at;if(readyForAnchor())swap('anchor');else if(age>5500)swap('timed');}
    raf=requestAnimationFrame(monitor);
  }
  async function request(id,{immediate=false}={}){
    const state=stateById(id);if(!state)return false;if(id===currentId&&!pending)return true;
    const seq=++requestSeq,to=1-active;label(id,'LOADING');
    let row;try{row=await loadInto(to,id,seq);}catch(e){label(id,'ERROR');showFallback(!currentId,'Could not load '+id+'.');return false;}
    if(!row){label(id,'MISSING');showFallback(!currentId,'Import '+id+' in Video States.');return false;}
    pending={id,at:performance.now(),seq};if(immediate||!currentId||readyForAnchor())await swap(immediate?'immediate':'anchor');return true;
  }
  async function init(defaultId='A01'){const ok=await activateInitial(defaultId);raf=requestAnimationFrame(monitor);return ok;}
  function destroy(){destroyed=true;cancelAnimationFrame(raf);clearTimeout(transitionTimer);videos.forEach((v,i)=>{try{v.pause();v.removeAttribute('src');v.load();}catch{}revoke(i);});}
  return{init,request,current:()=>currentId,pending:()=>pending?.id||null,destroy};
}
