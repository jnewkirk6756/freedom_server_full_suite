/** Aurelia 0.18: deterministic clip routing and non-destructive local recovery. */
export const VERSION='0.18.0';
export const PREFIX='aurelia.preview.';
export const STATES=['idle_neutral','listen_engaged','speak_calm','think_reflective','react_pleased'];
export const FRAMES=['portrait','full-body','wide'];
export const POSES=['center','seated','standing'];
export const IDB_NAMES=['aurelia-preview-media-v010','aurelia-preview-media-v08'];
export const EMPTY={account:null,avatar:null,avatars:[],creator:null,messages:[],memories:[],media:[],about:null,aboutPhotos:[],threads:{},memoryByAvatar:{},playerCheckpoint:null,playerSettings:{},world:{}};
export function safeParse(text){return JSON.parse(text,(key,value)=>{if(['__proto__','prototype','constructor'].includes(key))throw Error('UNSAFE_KEY');return value;});}
export function validValue(key,v){
 const field=key.replace(PREFIX,'');
 if(['avatars','messages','memories','media','aboutPhotos'].includes(field)){
  if(!Array.isArray(v))return false;
  if(field==='avatars')return v.length<=4&&v.every(a=>a&&typeof a.id==='string'&&typeof a.name==='string'&&Number.isInteger(a.age)&&a.age>=18);
  if(field==='media')return v.every(a=>a&&typeof a.id==='string');
  return true;
 }
 if(['threads','memoryByAvatar','playerSettings','world'].includes(field))return v!==null&&typeof v==='object'&&!Array.isArray(v);
 if(['avatar','account','creator','about','playerCheckpoint'].includes(field))return v===null||(typeof v==='object'&&!Array.isArray(v));
 return true;
}
export function inspectStorage(storage){
 const values={},issues=[];
 try{for(const [field,fallback] of Object.entries(EMPTY)){
  const key=PREFIX+field,raw=storage.getItem(key);
  if(raw===null){values[field]=structuredClone(fallback);continue;}
  try{const v=safeParse(raw);if(!validValue(key,v))throw Error('INVALID_SHAPE');values[field]=v;}
  catch{issues.push({key,code:'INVALID_SAVED_STATE'});}
 }}catch{return{ok:false,values:{},issues:[{code:'STORAGE_UNAVAILABLE'}]};}
 return {ok:issues.length===0,values,issues};
}
export function previewSnapshot(storage){const checked=inspectStorage(storage);if(!checked.ok)throw Error('CORRUPT_STATE');const local={};for(const f of Object.keys(EMPTY)){const k=PREFIX+f,v=storage.getItem(k);if(v!==null)local[k]=v;}return{version:VERSION,createdAt:new Date().toISOString(),local};}
export function restoreSnapshot(storage,snapshot){
 if(!snapshot?.local||typeof snapshot.local!=='object')throw Error('INVALID_CHECKPOINT');
 for(const [k,v] of Object.entries(snapshot.local))if(!Object.hasOwn(EMPTY,k.replace(PREFIX,''))||!k.startsWith(PREFIX)||typeof v!=='string'||!validValue(k,safeParse(v)))throw Error('INVALID_CHECKPOINT');
 const before={};for(const f of Object.keys(EMPTY)){const k=PREFIX+f;before[k]=storage.getItem(k);}
 // A recovery copy must succeed before touching original keys.
 storage.setItem('aurelia.recovery.quarantine',JSON.stringify({createdAt:new Date().toISOString(),local:before}));
 try{for(const k of Object.keys(before)){if(Object.hasOwn(snapshot.local,k))storage.setItem(k,snapshot.local[k]);else storage.removeItem(k);}}
 catch(error){for(const [k,v] of Object.entries(before)){try{if(v===null)storage.removeItem(k);else storage.setItem(k,v);}catch{}}throw error;}
}
export function clipMeta(clip){
 const m=clip.player||{};
 return {id:clip.id,avatarId:clip.avatarId,state:m.state||clip.state||'idle_neutral',family:clip.family||'performance',frame:FRAMES.includes(m.frame)?m.frame:'portrait',startPose:POSES.includes(m.startPose)?m.startPose:'center',endPose:POSES.includes(m.endPose)?m.endPose:'center',reviewed:m.reviewed===true,duration:Number(m.duration||clip.duration||0),width:Number(m.width||clip.width||0),height:Number(m.height||clip.height||0)};
}
export function chooseClip(clips,{avatarId,state='idle_neutral',frame='portrait',pose='center',currentPose=pose,recent=[],unavailable=[]}={}){
 const owned=clips.map(clipMeta).filter(c=>c.avatarId===avatarId&&c.reviewed&&!unavailable.includes(c.id)&&c.frame===frame);
 // No substitute framing/pose or another person's media. Transition only through an approved bridge.
 if(pose!==currentPose){const bridges=owned.filter(c=>c.family==='transition'&&c.startPose===currentPose&&c.endPose===pose);if(!bridges.length)return{clip:null,reason:'BRIDGE_REQUIRED'};return{clip:pick(bridges,recent),reason:'BRIDGE'};}
 const compatible=owned.filter(c=>c.family==='performance'&&c.startPose===pose&&c.endPose===pose);
 const exact=compatible.filter(c=>c.state===state),neutral=compatible.filter(c=>c.state==='idle_neutral');
 const pool=exact.length?exact:neutral;
 if(!pool.length)return{clip:null,reason:'NO_COMPATIBLE_CLIP'};
 return{clip:pick(pool,recent),reason:exact.length?'EXACT_STATE':'NEUTRAL_FALLBACK',variants:pool.length};
}
function pick(pool,recent){const fresh=pool.filter(c=>!recent.includes(c.id));const options=fresh.length?fresh:pool.filter(c=>c.id!==recent[0]);return [...(options.length?options:pool)].sort((a,b)=>recent.indexOf(b.id)-recent.indexOf(a.id)||a.id.localeCompare(b.id))[0];}
export function recordPlay(report,id,now=Date.now()){
 const history=[...(report.history||[]),id].slice(-256),recent=[id,...(report.recent||[]).filter(x=>x!==id)].slice(0,8);
 return{plays:(report.plays||0)+1,repeats:(report.repeats||0)+(report.history?.at(-1)===id?1:0),history,recent,lastPlayedAt:now};
}
export function safeCheckpoint(input){
 if(!input||typeof input!=='object')return null;
 return {version:1,avatarId:typeof input.avatarId==='string'?input.avatarId:null,clipId:typeof input.clipId==='string'?input.clipId:null,state:STATES.includes(input.state)?input.state:STATES[0],frame:FRAMES.includes(input.frame)?input.frame:FRAMES[0],pose:POSES.includes(input.pose)?input.pose:POSES[0],time:Number.isFinite(input.time)?Math.max(0,Math.min(120,input.time)):0,wasPlaying:input.wasPlaying===true,updatedAt:typeof input.updatedAt==='string'?input.updatedAt:null};
}
