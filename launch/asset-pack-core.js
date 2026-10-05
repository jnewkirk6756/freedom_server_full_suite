import {listClips,cloudManifest,syncCloudToLocal,storageEstimate} from './video-state-core.js';

export const ASSET_PACK_VERSION='NOCTURNE-ASSET-PACK-0.77.0';
export const SHELL_CACHE='nocturne-shell-0770';
export const SHELL_ASSETS=[
  '/',
  '/live/',
  '/vr/',
  '/experience.css?v=0770',
  '/live-embodied.css?v=0770',
  '/experience-mobile-safe.js?v=0770',
  '/video-state-core.js?v=0770',
  '/asset-pack-core.js?v=0770',
  '/anna-avatar-runtime.js?v=0770',
  '/vr.js?v=0770',
  '/vr-fallback.js?v=0770',
  '/vr.css?v=0770',
  '/navigation.css?v=0770',
  '/navigation.js?v=0770',
  '/session-core.js?v=0770',
  '/app.webmanifest?v=0770'
];

export async function requestPersistentStorage(){
  try{
    if(!navigator.storage?.persist)return{supported:false,persisted:false};
    const persisted=await navigator.storage.persist();
    return{supported:true,persisted:Boolean(persisted)};
  }catch{return{supported:false,persisted:false}}
}

export async function installServiceWorker(){
  if(!('serviceWorker'in navigator))return{supported:false,registered:false};
  try{
    const reg=await navigator.serviceWorker.register('/nocturne-sw.js?v=0770',{scope:'/'});
    return{supported:true,registered:true,scope:reg.scope};
  }catch(error){return{supported:true,registered:false,error:String(error?.message||error)}}
}

export async function cacheShell({onProgress=()=>{}}={}){
  if(!('caches'in window))return{cached:[],failed:[{path:'shell',error:'Cache Storage unavailable'}]};
  const cache=await caches.open(SHELL_CACHE),cached=[],failed=[];
  for(let i=0;i<SHELL_ASSETS.length;i++){
    const path=SHELL_ASSETS[i];onProgress({stage:'shell',index:i+1,total:SHELL_ASSETS.length,label:path});
    try{
      const r=await fetch(path,{cache:'reload',credentials:'same-origin'});
      if(!r.ok)throw Error('HTTP '+r.status);
      await cache.put(path,r.clone());cached.push(path);
    }catch(error){failed.push({path,error:String(error?.message||error)})}
  }
  return{cached,failed};
}

export async function assetStatus(){
  const local=await listClips().catch(()=>[]),remote=await cloudManifest().catch(()=>({states:[]})),estimate=await storageEstimate();
  const localBytes=local.reduce((n,x)=>n+(Number(x.size)||0),0);
  const hdLocal=local.filter(x=>Number(x.width)>=512&&Number(x.height)>=720||Number(x.size)>=500000).length;
  const remoteStates=Array.isArray(remote.states)?remote.states:[];
  const remoteBytes=remoteStates.reduce((n,x)=>n+(Number(x.size)||0),0);
  const hdRemote=remoteStates.filter(x=>Number(x.width)>=512&&Number(x.height)>=720||Number(x.size)>=500000).length;
  const persisted=await navigator.storage?.persisted?.().catch?.(()=>false)??false;
  return{
    version:ASSET_PACK_VERSION,
    local:{clips:local.length,bytes:localBytes,hdClips:hdLocal},
    remote:{clips:remoteStates.length,bytes:remoteBytes,hdClips:hdRemote},
    storage:{usage:Number(estimate.usage)||0,quota:Number(estimate.quota)||0,persisted:Boolean(persisted)},
    vrCompatible:true,
    model3DInstalled:false,
    ready:local.length>0
  };
}

export async function downloadAssets({onProgress=()=>{}}={}){
  const persistence=await requestPersistentStorage();onProgress({stage:'storage',label:persistence.persisted?'Persistent storage enabled':'Using browser-managed storage'});
  const shell=await cacheShell({onProgress});
  onProgress({stage:'media',label:'Reading shared Anna media manifest…'});
  const media=await syncCloudToLocal({onProgress:id=>onProgress({stage:'media',label:'Downloading '+id})});
  const sw=await installServiceWorker();
  const status=await assetStatus();
  try{localStorage.setItem('nocturne.asset-pack.v1',JSON.stringify({version:ASSET_PACK_VERSION,downloadedAt:Date.now(),status}))}catch{}
  window.dispatchEvent(new CustomEvent('nocturne:asset-pack-ready',{detail:{status,media,shell,persistence,sw}}));
  return{ok:true,status,media,shell,persistence,sw};
}

export async function assetPackSummary(){
  const status=await assetStatus();
  const mb=n=>(Number(n||0)/1048576).toFixed(1);
  return{
    ...status,
    label:status.local.clips+' clips · '+mb(status.local.bytes)+' MB on device',
    detail:status.local.hdClips>0?status.local.hdClips+' HD clips local':'Local pack contains preview media only'
  };
}
