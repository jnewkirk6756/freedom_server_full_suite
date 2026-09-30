import {waitFor} from './player-deck.js';
import {IDB_NAMES} from './reliability-core.js';
export const LIMIT=64*1024*1024;
export async function openMedia(name,create=false){return new Promise((resolve,reject)=>{
 let settled=false;const req=indexedDB.open(name,create?2:undefined),timer=setTimeout(()=>{settled=true;reject(Error('STORAGE_BLOCKED'));},5000);
 const fail=()=>{clearTimeout(timer);if(!settled){settled=true;reject(Error('STORAGE_UNAVAILABLE'));}};
 req.onupgradeneeded=()=>{if(!create){req.transaction.abort();return;}for(const store of ['clips','photos'])if(!req.result.objectStoreNames.contains(store))req.result.createObjectStore(store,{keyPath:'id'});};
 req.onerror=fail;req.onblocked=fail;req.onsuccess=()=>{clearTimeout(timer);if(settled){req.result.close();return;}settled=true;req.result.onversionchange=()=>req.result.close();resolve(req.result);};
});}
export async function readBlob(id){for(const name of IDB_NAMES){let db;try{db=await openMedia(name);if(!db.objectStoreNames.contains('clips'))continue;const record=await new Promise((res,rej)=>{const tx=db.transaction('clips','readonly'),r=tx.objectStore('clips').get(id);r.onsuccess=()=>res(r.result);r.onerror=()=>rej(Error('STORAGE_READ_FAILED'));});if(record?.blob instanceof Blob)return record.blob;}catch{}finally{db?.close();}}return null;}
export async function writeBlob(id,blob){const db=await openMedia(IDB_NAMES[0],true);try{await new Promise((resolve,reject)=>{const tx=db.transaction('clips','readwrite');tx.objectStore('clips').put({id,blob});tx.oncomplete=resolve;tx.onabort=tx.onerror=()=>reject(Error('STORAGE_FULL'));});}finally{db.close();}}
export async function removeBlob(id){for(const name of IDB_NAMES){let db;try{db=await openMedia(name);if(db.objectStoreNames.contains('clips'))await new Promise((resolve,reject)=>{const tx=db.transaction('clips','readwrite');tx.objectStore('clips').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(Error('STORAGE_WRITE_FAILED'));});}catch{}finally{db?.close();}}}
export async function checksum(blob){if(blob.size>LIMIT)throw Error('FILE_TOO_LARGE');return [...new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export async function inspectVideo(file,{timeoutMs=10000}={}){
 if(!(file instanceof Blob)||!file.size||file.size>LIMIT)throw Error('FILE_TOO_LARGE');
 if(!['video/mp4','video/webm','video/quicktime'].includes(file.type))throw Error('UNSUPPORTED_FILE');
 const v=document.createElement('video'),url=URL.createObjectURL(file),controller=new AbortController();v.muted=true;v.playsInline=true;v.preload='auto';
 try{
  const ready=waitFor(v,'loadeddata',controller.signal,timeoutMs,()=>v.readyState>=2);v.src=url;v.load();await ready;
  if(!Number.isFinite(v.duration)||v.duration<.2||v.duration>120)throw Error('INVALID_DURATION');
  if(!v.videoWidth||v.videoWidth*v.videoHeight>3840*2160)throw Error('RESOLUTION_LIMIT');
  return{duration:v.duration,width:v.videoWidth,height:v.videoHeight};
 }finally{controller.abort();v.pause();v.removeAttribute('src');v.load();URL.revokeObjectURL(url);}
}
export function downloadBlob(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}
