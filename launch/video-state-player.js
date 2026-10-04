import{getClipSynced,stateById,VIDEO_ANCHOR_SECONDS,familyCandidates,playbackMode,transitionAfterState,initialFallbackCandidates,semanticFallbackCandidates,baseStateId}from'./video-state-core.js';
const wait=(video,event='loadeddata',ms=12000)=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>{cleanup();reject(Error('Video load timed out.'));},ms),ok=()=>{cleanup();resolve();},bad=()=>{cleanup();reject(Error('Video state could not load.'));},cleanup=()=>{clearTimeout(timer);video.removeEventListener(event,ok);video.removeEventListener('error',bad);};video.addEventListener(event,ok,{once:true});video.addEventListener('error',bad,{once:true});});
export function createVideoStatePlayer({host,primary=null,statusEl=null,fallback=null,onState=()=>{}}={}){
  if(!host)return{init:async()=>false,request:async()=>false,current:()=>null,family:()=>null,pending:()=>null,history:()=>[],destroy:()=>{}};
  const first=primary||host.querySelector('video')||document.createElement('video'),second=document.createElement('video'),videos=[first,second];
  host.classList.add('video-state-stage');
  videos.forEach((v,i)=>{v.classList.add('video-state-layer');v.dataset.videoLayer=String(i);v.muted=true;v.playsInline=true;v.preload='auto';v.setAttribute('aria-hidden','true');if(!v.parentNode)host.prepend(v);});
  let active=0,currentId=null,currentBase=null,pending=null,destroyed=false,raf=0,transitionTimer=0,urls=[null,null],requestSeq=0,recent=[];
  function label(id,extra=''){const s=stateById(id);if(statusEl)statusEl.textContent=s?(s.id+(extra?' · '+extra:'')):String(extra||'READY');}
  function revoke(i){if(urls[i]){URL.revokeObjectURL(urls[i]);urls[i]=null;}}
  function showFallback(show,text=''){if(fallback)fallback.hidden=!show;if(show&&text){const cue=fallback.querySelector?.('#orb-cue,[data-video-cue],span');if(cue)cue.textContent=text;}}
  function applyMediaSizing(row,id){
    const w=Number(row?.width)||0,h=Number(row?.height)||0,dpr=Math.max(1,Math.min(3,window.devicePixelRatio||1));
    if(w&&h){
      const nativeCss=Math.max(112,Math.min(172,w/dpr*1.35));
      host.style.setProperty('--anna-video-ratio',String(w/h));
      host.style.setProperty('--anna-video-width',nativeCss.toFixed(0)+'px');
      host.dataset.videoResolution=w+'x'+h;
    }
    host.dataset.videoState=id||'';
  }
  function configureVideo(v,id){const mode=playbackMode(id);v.loop=mode==='loop';v.dataset.state=id;v.dataset.playbackMode=mode;}
  async function loadInto(i,id,seq){
    const row=await getClipSynced(id);if(!row?.blob)return null;
    if(seq!==requestSeq||destroyed)return null;
    const v=videos[i];revoke(i);const url=URL.createObjectURL(row.blob);urls[i]=url;v.src=url;configureVideo(v,id);v.load();await wait(v,'loadeddata');if(seq!==requestSeq||destroyed)return null;
    try{v.currentTime=0;}catch{}applyMediaSizing(row,id);return row;
  }
  function candidatesFor(id,{initial=false,neutralFallback=false,rotate=false}={}){
    const state=stateById(id);if(!state)return[];
    let out=state.baseId?[state.id,baseStateId(state.id),...familyCandidates(state.id,recent)]:familyCandidates(state.id,recent);
    if(rotate&&!state.baseId&&out.length>1)out=[...out.slice(1),out[0]];
    out=[...out,...semanticFallbackCandidates(id),...initialFallbackCandidates(id)];
    if(neutralFallback)out=[...out,'A00','A02','A01'];
    return [...new Set(out)].filter(x=>stateById(x));
  }
  async function findLoad(i,ids,seq){
    for(const id of ids){try{const row=await loadInto(i,id,seq);if(row)return{id,row};}catch{}}
    return null;
  }
  async function activateInitial(id){
    const seq=++requestSeq,found=await findLoad(active,candidatesFor(id,{initial:true}),seq);
    if(!found){label(id,'MISSING');showFallback(true,'Import a video state in Video States.');return false;}
    const v=videos[active];v.classList.add('active');v.style.opacity='1';showFallback(false);currentId=found.id;currentBase=baseStateId(found.id);recent.push(found.id);host.dataset.videoState=found.id;host.dataset.videoFamily=currentBase||'';label(found.id,'LIVE');try{await v.play();}catch{}onState({id:found.id,state:stateById(found.id),family:currentBase,reason:'initial'});window.dispatchEvent(new CustomEvent('nocturne:video-state',{detail:{id:found.id,family:currentBase,reason:'initial'}}));return true;
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
    active=to;currentId=p.id;currentBase=baseStateId(p.id);recent.push(p.id);recent=recent.slice(-12);host.dataset.videoState=p.id;host.dataset.videoFamily=currentBase||'';label(p.id,'LIVE');showFallback(false);onState({id:p.id,state:stateById(p.id),family:currentBase,reason});window.dispatchEvent(new CustomEvent('nocturne:video-state',{detail:{id:p.id,family:currentBase,reason}}));return true;
  }
  function monitor(){
    if(destroyed)return;
    if(pending){const age=performance.now()-pending.at,v=videos[active],gate=Number(pending.notBefore)||0;if(gate&&Number.isFinite(v.currentTime)&&v.currentTime<gate){}else if(readyForAnchor())swap('anchor');else if(age>5500&&!gate)swap('timed');}
    raf=requestAnimationFrame(monitor);
  }
  async function request(id,{immediate=false,neutralFallback=false,rotate=false,deferUntilEnd=false}={}){
    const state=stateById(id);if(!state)return false;
    const requestedBase=baseStateId(state.id);
    if(!state.baseId&&!rotate&&requestedBase===currentBase&&!pending)return true;
    if(state.baseId&&state.id===currentId&&!pending)return true;
    const seq=++requestSeq,to=1-active;label(state.id,'LOADING');
    const found=await findLoad(to,candidatesFor(state.id,{neutralFallback,rotate}),seq);
    if(!found){label(state.id,'MISSING');showFallback(!currentId,'Import '+state.id+' in Video States.');return false;}
    const v=videos[active],gate=deferUntilEnd&&Number.isFinite(v.duration)&&v.duration?Math.max(.2,v.duration-VIDEO_ANCHOR_SECONDS-.08):0;pending={id:found.id,at:performance.now(),seq,notBefore:gate};if(immediate||!currentId||(!deferUntilEnd&&readyForAnchor()))await swap(immediate?'immediate':'anchor');return true;
  }
  async function armAutoNext(){const next=transitionAfterState(currentId);if(!next||destroyed||pending)return;await request(next,{neutralFallback:true,deferUntilEnd:true});}
  videos.forEach((v,i)=>{v.addEventListener('play',()=>{if(i===active&&playbackMode(currentId)==='oneshot')setTimeout(()=>armAutoNext(),80)});v.addEventListener('ended',async()=>{
    if(destroyed||i!==active||!currentId)return;
    const next=transitionAfterState(currentId);
    if(next){const ok=await request(next,{immediate:true,neutralFallback:true});if(ok)return;}
    try{v.currentTime=0;await v.play();}catch{}
  });});
  async function init(defaultId='A01'){const ok=await activateInitial(defaultId);raf=requestAnimationFrame(monitor);return ok;}
  function destroy(){destroyed=true;cancelAnimationFrame(raf);clearTimeout(transitionTimer);videos.forEach((v,i)=>{try{v.pause();v.removeAttribute('src');v.load();}catch{}revoke(i);});}
  return{init,request,current:()=>currentId,family:()=>currentBase,pending:()=>pending?.id||null,history:()=>[...recent],destroy};
}
