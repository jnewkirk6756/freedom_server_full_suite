/** Nocturne V0.67 video-state library. Local IndexedDB + shared staging sync cache. */
export const VIDEO_STATE_VERSION='0.70.2';
export const VIDEO_DB_NAME='nocturne-video-states-v1';
export const VIDEO_DB_STORE='clips';
export const VIDEO_ANCHOR_SECONDS=.7;
export const VIDEO_STATES=[
  ['A00','UNIVERSAL ANCHOR',6,'bridge','Canonical neutral calibration / bridge state.'],
  ['A01','IDLE NEUTRAL',10,'idle','Default resting / available state; preferred canonical idle loop.'],
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
VIDEO_STATES.push(
  {id:'A16B',name:'BUILD 2 INTENSE ALT',duration:8,category:'build-alt',description:'Alternate middle-intensity build; smoother escalation.',baseId:'A16',transitionProfile:'build'},
  {id:'A17B',name:'BUILD 3 HIGH ALT',duration:8,category:'build-alt',description:'Alternate high-build state; preferred transition A16 → A17B → A18/A18B/A18C.',baseId:'A17',transitionProfile:'build'},
  {id:'A18B',name:'PEAK HIGH INTENSITY ALT',duration:8,category:'peak-alt',description:'Alternate peak burst; preferred transition A17 → A18B → A19.',baseId:'A18',transitionProfile:'burst'},
  {id:'A18C',name:'PEAK EXTREME ALT',duration:8,category:'peak-alt',description:'Highest-amplitude alternate peak; route into A19 recovery.',baseId:'A18',transitionProfile:'burst-extreme'},
  {id:'A18D',name:'PEAK CONTROLLED ALT',duration:8,category:'peak-alt',description:'Controlled alternate peak with a cleaner return toward neutral.',baseId:'A18',transitionProfile:'burst-controlled'},
  {id:'A18E',name:'PEAK EXTREME OPEN ALT',duration:8,category:'peak-alt',description:'High-amplitude open-mouth peak; use sparingly and route into recovery.',baseId:'A18',transitionProfile:'burst-extreme-open'},
  {id:'A19B',name:'RECOVERY SETTLE ALT',duration:8,category:'recovery-alt',description:'Alternate recovery state with closed-eye release and warmer finish.',baseId:'A19',transitionProfile:'recovery'},
  {id:'A18F',name:'PEAK MAX INTENSITY ALT',duration:8,category:'peak-alt',description:'Maximum-amplitude alternate peak; route directly into recovery.',baseId:'A18',transitionProfile:'burst-max'},
  {id:'A19C',name:'RECOVERY NEUTRAL ALT',duration:8,category:'recovery-alt',description:'Calmer recovery variant that settles from closed eyes into direct neutral eye contact.',baseId:'A19',transitionProfile:'recovery-neutral'}
);

export const VIDEO_STATE_IDS=VIDEO_STATES.map(s=>s.id);
export const PRIMARY_VIDEO_STATE_IDS=Array.from({length:21},(_,i)=>'A'+String(i).padStart(2,'0'));
export const ALTERNATE_VIDEO_STATE_IDS=VIDEO_STATE_IDS.filter(id=>!PRIMARY_VIDEO_STATE_IDS.includes(id));
export const stateById=id=>VIDEO_STATES.find(s=>s.id===String(id||'').toUpperCase())||null;
export function baseStateId(id){const s=stateById(id);return s?.baseId||s?.id||null;}
export function familyCandidates(id,recent=[]){
  const s=stateById(id);if(!s)return[];
  const base=baseStateId(s.id),family=VIDEO_STATES.filter(x=>(x.baseId||x.id)===base).map(x=>x.id);
  if(s.baseId)return [s.id,base,...family.filter(x=>x!==s.id&&x!==base)];
  const recentSet=new Set((recent||[]).slice(-5));
  const alternates=family.filter(x=>x!==base);
  const fresh=alternates.filter(x=>!recentSet.has(x)),used=alternates.filter(x=>recentSet.has(x));
  return [base,...fresh,...used];
}
export function playbackMode(id){
  const base=baseStateId(id);
  return ['A18','A19','A20'].includes(base)?'oneshot':'loop';
}
export function transitionAfterState(id){
  const s=stateById(id);if(!s)return null;
  const direct={A18B:'A19B',A18C:'A19B',A18D:'A19',A18E:'A19B',A18F:'A19C',A19B:'A20',A19C:'A20'};
  if(direct[s.id])return direct[s.id];
  const base=baseStateId(s.id);
  if(base==='A18')return'A19';
  if(base==='A19')return'A20';
  if(base==='A20')return'A01';
  return null;
}
export function initialFallbackCandidates(id){
  const base=baseStateId(id)||'A01';
  const map={A00:['A01','A02'],A01:['A02','A00'],A02:['A01','A00'],A03:['A01','A02'],A04:['A02','A01'],A05:['A01','A00'],A06:['A01','A00'],A07:['A01','A02'],A08:['A02','A01'],A09:['A02','A01'],A10:['A01','A00'],A11:['A01','A02'],A12:['A01','A00'],A13:['A01','A00'],A14:['A02','A01'],A15:['A16','A17','A02','A01'],A16:['A16B','A17','A01'],A17:['A17B','A16','A01'],A18:['A17','A16','A01'],A19:['A19B','A19C','A20','A01'],A20:['A01','A00']};
  return [...new Set([...(map[base]||[]),'A01','A00'])].filter(x=>x!==id&&stateById(x));
}
export function stateRoute(id){
  const s=stateById(id);if(!s)return null;
  return{id:s.id,baseId:baseStateId(s.id),mode:playbackMode(s.id),autoNext:transitionAfterState(s.id),family:familyCandidates(s.id)};
}
export function extractStateId(name=''){
  const m=String(name).toUpperCase().match(/(?:^|[^A-Z0-9])(A(?:0[0-9]|1[0-9]|20)(?:[A-Z])?)(?:[^A-Z0-9]|$)/);
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
  const open=PRIMARY_VIDEO_STATE_IDS.filter(id=>!used.has(id));
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
  const row={id:state.id,blob:file,fileName:String(file.name||meta.fileName||state.id+'.mp4').slice(0,180),size:file.size,type:file.type||meta.mime||'video/mp4',duration:Number(meta.duration)||0,width:Number(meta.width)||0,height:Number(meta.height)||0,importedAt:Date.now(),source:meta.source||'local',cloudSha:meta.cloudSha||null,syncedAt:Number(meta.syncedAt)||0,warnings:metadataWarnings(meta,state)};
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

const MEDIA_TOKEN_KEY='nocturne.media.session.v067';
export async function ensureMediaSession(){
  let token=sessionStorage.getItem(MEDIA_TOKEN_KEY)||'';
  const headers=token?{'x-nocturne-session':token}:{};
  const r=await fetch('/v1/media/status',{headers});if(!r.ok)throw Error('Media sync status unavailable.');
  const d=await r.json();if(d.sessionToken){token=d.sessionToken;sessionStorage.setItem(MEDIA_TOKEN_KEY,token)}
  return{token,status:d};
}
export async function cloudManifest(){
  const {token,status}=await ensureMediaSession();if(!status.connected)return{...status,states:[]};
  const r=await fetch('/v1/media/manifest',{headers:{'x-nocturne-session':token}});if(!r.ok)throw Error('Cloud media manifest unavailable.');
  return await r.json();
}
export async function fetchCloudClip(id){
  const state=stateById(id);if(!state)return null;const {token,status}=await ensureMediaSession();if(!status.connected)return null;
  const manifest=await cloudManifest(),remote=(manifest.states||[]).find(x=>x.id===state.id);if(!remote)return null;
  const local=await getClip(state.id);if(local&&local.cloudSha&&local.cloudSha===remote.sha256)return local;
  const r=await fetch('/v1/media/'+state.id,{headers:{'x-nocturne-session':token}});if(r.status===404)return null;if(!r.ok)throw Error('Cloud clip download failed.');
  const blob=await r.blob(),file=typeof File==='function'?new File([blob],remote.fileName||state.id+'.mp4',{type:remote.mime||blob.type||'video/mp4'}):blob;
  await saveClip(state.id,file,{fileName:remote.fileName,duration:remote.duration,width:remote.width,height:remote.height,mime:remote.mime,source:'cloud',cloudSha:remote.sha256,syncedAt:Date.now()});
  return await getClip(state.id);
}
export async function getClipSynced(id){return await getClip(id)||await fetchCloudClip(id);}
export async function publishClipToCloud(id){
  const state=stateById(id);if(!state)throw Error('Unknown video state.');const local=await getClip(state.id);if(!local?.blob)throw Error('Import this clip locally first.');
  if(local.blob.size>8*1024*1024)throw Error('Cloud staging clips must be 8 MB or smaller.');
  const {token,status}=await ensureMediaSession();if(!status.connected)throw Error('Shared media cache is unavailable.');
  const r=await fetch('/v1/media/'+state.id,{method:'PUT',headers:{'x-nocturne-session':token,'content-type':local.type||'video/mp4','x-nocturne-filename':encodeURIComponent(local.fileName||state.id+'.mp4'),'x-nocturne-duration':String(local.duration||0),'x-nocturne-width':String(local.width||0),'x-nocturne-height':String(local.height||0)},body:local.blob});
  const d=await r.json();if(!r.ok)throw Error(d.error?.message||'Cloud publish failed.');
  const row=d.state||{};await saveClip(state.id,local.blob,{fileName:local.fileName,duration:local.duration,width:local.width,height:local.height,mime:local.type,source:'cloud',cloudSha:row.sha256||null,syncedAt:Date.now()});
  return row;
}
export async function publishAllLocal({onProgress=()=>{}}={}){
  const rows=await listClips(),manifest=await cloudManifest(),remote=new Map((manifest.states||[]).map(x=>[x.id,x])),capacity=Number(manifest.capacityBytes)||25*1024*1024,current=Number(manifest.usedBytes)||0;
  const replaced=rows.reduce((n,x)=>n+(Number(remote.get(x.id)?.size)||0),0),incoming=rows.reduce((n,x)=>n+(Number(x.size)||0),0),projected=current-replaced+incoming;
  if(projected>capacity)throw Error('This local library would use '+(projected/1048576).toFixed(1)+' MB of a '+(capacity/1048576).toFixed(0)+' MB shared cache. Import the V0.68 sync-optimized media pack first.');
  const done=[],failed=[];for(const row of rows){try{onProgress(row.id);done.push(await publishClipToCloud(row.id));}catch(e){failed.push({id:row.id,error:e.message});}}return{done,failed,projectedBytes:projected,capacityBytes:capacity};
}
export async function syncCloudToLocal({onProgress=()=>{}}={}){
  const m=await cloudManifest(),local=await listClips(),byId=new Map(local.map(x=>[x.id,x])),done=[],skipped=[],failed=[];
  for(const remote of m.states||[]){const here=byId.get(remote.id);if(here?.cloudSha===remote.sha256){skipped.push(remote.id);continue;}try{onProgress(remote.id);const row=await fetchCloudClip(remote.id);if(row)done.push(remote.id);}catch(e){failed.push({id:remote.id,error:e.message});}}
  return{done,skipped,failed,manifest:m};
}
export async function cloudDelete(id){
  const state=stateById(id);if(!state)return false;const {token}=await ensureMediaSession(),r=await fetch('/v1/media/'+state.id,{method:'DELETE',headers:{'x-nocturne-session':token}});if(!r.ok)return false;return true;
}
