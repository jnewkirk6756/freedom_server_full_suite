/** Nocturne V0.66 local video-state library. Large media stays in IndexedDB. */
export const VIDEO_STATE_VERSION='0.66.0';
export const VIDEO_DB_NAME='nocturne-video-states-v1';
export const VIDEO_DB_STORE='clips';
export const VIDEO_ANCHOR_SECONDS=.7;
export const VIDEO_STATES=[
  ['A00','UNIVERSAL ANCHOR',6,'bridge','Canonical neutral calibration / bridge state.'],
  ['A01','IDLE NEUTRAL',8,'idle','Default resting / available state.'],
  ['A02','IDLE WARM',8,'idle','Warm familiar resting state.'],
  ['A03','LISTEN ATTENTIVE',7,'social','Active attentive listening.'],
  ['A04','LISTEN CURIOUS',7,'social','Curious listening response.'],
  ['A05','THINK ANALYTICAL',7,'cognitive','Reasoning and analytical processing.'],
  ['A06','EVALUATE SKEPTICAL',7,'cognitive','Measured skepticism / evidence checking.'],
  ['A07','ACKNOWLEDGE CALM',6,'social','Silent acknowledgement.'],
  ['A08','WARM AMUSED',7,'social','Light natural amusement.'],
  ['A09','PLAYFUL',7,'social','Controlled playful energy.'],
  ['A10','FOCUSED DIRECT',7,'cognitive','Precise decisive assistant state.'],
  ['A11','CONCERNED',7,'emotional','Care or caution.'],
  ['A12','IRRITATED CONTAINED',7,'emotional','Controlled irritation.'],
  ['A13','HURT WITHDRAWN',7,'emotional','Quiet disappointment / withdrawal.'],
  ['A14','RECONNECT WARM',7,'emotional','Relief and reconnection.'],
  ['A15','BUILD 1 ENGAGED',7,'build','First engagement build.'],
  ['A16','BUILD 2 INTENSE',7,'build','Middle intensity build.'],
  ['A17','BUILD 3 HIGH',7,'build','High pre-peak intensity.'],
  ['A18','PEAK HIGH INTENSITY',6,'peak','Brief controlled peak state.'],
  ['A19','RECOVERY SETTLE',7,'recovery','Post-peak recovery.'],
  ['A20','RESET NEUTRAL',6,'recovery','Return to baseline neutral.']
].map(([id,name,duration,category,description])=>({id,name,duration,category,description}));

export const VIDEO_STATE_IDS=VIDEO_STATES.map(s=>s.id);
export const stateById=id=>VIDEO_STATES.find(s=>s.id===String(id||'').toUpperCase())||null;
export function extractStateId(name=''){
  const m=String(name).toUpperCase().match(/(?:^|[^A-Z0-9])(A(?:0[0-9]|1[0-9]|20))(?:[^A-Z0-9]|$)/);
  return m&&stateById(m[1])?m[1]:null;
}
export function metadataWarnings(meta,state){
  const out=[],expected=state?.duration||0,d=Number(meta?.duration)||0,w=Number(meta?.width)||0,h=Number(meta?.height)||0;
  if(d&&expected&&Math.abs(d-expected)>1.5)out.push(`Duration ${d.toFixed(1)}s; target is about ${expected}s.`);
  if(w&&w<720)out.push(`Resolution is ${w}×${h}; 720px+ width is preferred when available.`);
  if(w&&h){const ratio=w/h,target=9/16;if(Math.abs(ratio-target)>.05)out.push('Aspect ratio is not close to vertical 9:16.');}
  return out;
}
export function orderedAssignments(files=[],existingIds=[]){
  const assigned=[],used=new Set(existingIds),unmatched=[];
  for(const file of files){const id=extractStateId(file?.name||'');if(id&&!used.has(id)){assigned.push({id,file,source:'filename'});used.add(id);}else unmatched.push(file);}
  const open=VIDEO_STATE_IDS.filter(id=>!used.has(id));
  unmatched.forEach((file,i)=>{if(open[i]){assigned.push({id:open[i],file,source:'order'});used.add(open[i]);}});
  return{assigned,overflow:unmatched.slice(open.length)};
}
function openDB(){
  if(typeof indexedDB==='undefined')return Promise.reject(Error('IndexedDB is unavailable in this browser.'));
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(VIDEO_DB_NAME,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(VIDEO_DB_STORE))db.createObjectStore(VIDEO_DB_STORE,{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||Error('Video database could not open.'));
  });
}
async function tx(mode,fn){
  const db=await openDB();
  try{return await new Promise((resolve,reject)=>{
    const t=db.transaction(VIDEO_DB_STORE,mode),store=t.objectStore(VIDEO_DB_STORE);
    let value;try{value=fn(store,t);}catch(e){reject(e);return;}
    t.oncomplete=()=>resolve(value);t.onerror=()=>reject(t.error||Error('Video database transaction failed.'));t.onabort=()=>reject(t.error||Error('Video database transaction aborted.'));
  });}finally{db.close();}
}
export async function saveClip(id,file,meta={}){
  const state=stateById(id);if(!state)throw Error('Unknown video state.');
  if(!(file instanceof Blob))throw Error('Choose a video file.');
  if(file.size>250*1024*1024)throw Error('Each clip must be 250 MB or smaller for this local beta.');
  const row={id:state.id,blob:file,fileName:String(file.name||meta.fileName||state.id+'.mp4').slice(0,180),size:file.size,type:file.type||'video/mp4',duration:Number(meta.duration)||0,width:Number(meta.width)||0,height:Number(meta.height)||0,importedAt:Date.now(),warnings:metadataWarnings(meta,state)};
  await tx('readwrite',store=>store.put(row));return{...row,blob:undefined};
}
export async function getClip(id){
  const state=stateById(id);if(!state)return null;
  const db=await openDB();
  try{return await new Promise((resolve,reject)=>{const r=db.transaction(VIDEO_DB_STORE,'readonly').objectStore(VIDEO_DB_STORE).get(state.id);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(r.error);});}finally{db.close();}
}
export async function deleteClip(id){const state=stateById(id);if(!state)return;await tx('readwrite',store=>store.delete(state.id));}
export async function listClips(){
  const db=await openDB();
  try{
    const rows=await new Promise((resolve,reject)=>{const r=db.transaction(VIDEO_DB_STORE,'readonly').objectStore(VIDEO_DB_STORE).getAll();r.onsuccess=()=>resolve(r.result||[]);r.onerror=()=>reject(r.error);});
    return rows.map(({blob,...rest})=>rest).sort((a,b)=>a.id.localeCompare(b.id));
  }finally{db.close();}
}
export async function clipMetadata(file){
  if(!(file instanceof Blob))throw Error('Choose a video file.');
  const url=URL.createObjectURL(file),video=document.createElement('video');video.preload='metadata';video.muted=true;video.playsInline=true;
  try{
    const meta=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Video metadata timed out.')),12000);video.onloadedmetadata=()=>{clearTimeout(timer);resolve({duration:video.duration||0,width:video.videoWidth||0,height:video.videoHeight||0});};video.onerror=()=>{clearTimeout(timer);reject(Error('This video could not be read.'));};video.src=url;});
    return meta;
  }finally{video.removeAttribute('src');try{video.load();}catch{}URL.revokeObjectURL(url);}
}
export async function storageEstimate(){
  try{const e=await navigator.storage?.estimate?.();return{usage:Number(e?.usage)||0,quota:Number(e?.quota)||0};}catch{return{usage:0,quota:0};}
}
