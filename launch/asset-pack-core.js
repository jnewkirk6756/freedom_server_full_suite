import {listClips,getClip,saveClip,storageEstimate} from './video-state-core.js';

export const ASSET_PACK_VERSION='NOCTURNE-ASSET-PACK-0.77.2';
export const SHELL_CACHE='nocturne-shell-0772';
export const SHELL_ASSETS=[
  '/',
  '/live/',
  '/vr/',
  '/experience.css?v=0772',
  '/live-embodied.css?v=0772',
  '/experience-mobile-safe.js?v=0772',
  '/video-state-core.js?v=0772',
  '/asset-pack-core.js?v=0772',
  '/anna-avatar-runtime.js?v=0772',
  '/vr.js?v=0772',
  '/vr-fallback.js?v=0772',
  '/vr.css?v=0772',
  '/navigation.css?v=0772',
  '/navigation.js?v=0772',
  '/session-core.js?v=0772',
  '/app.webmanifest?v=0772'
];

function errText(error){return String(error&&error.message||error||'Unknown error').slice(0,180)}
function asArray(value){return Array.isArray(value)?value:[]}

export async function requestPersistentStorage(){
  try{
    if(!navigator.storage||typeof navigator.storage.persist!=='function')return{supported:false,persisted:false};
    const persisted=await navigator.storage.persist();
    return{supported:true,persisted:Boolean(persisted)};
  }catch(error){return{supported:false,persisted:false,error:errText(error)}}
}

export async function installServiceWorker(){
  if(!('serviceWorker'in navigator))return{supported:false,registered:false};
  try{
    const reg=await navigator.serviceWorker.register('/nocturne-sw.js?v=0772',{scope:'/'});
    return{supported:true,registered:true,scope:reg.scope};
  }catch(error){return{supported:true,registered:false,error:errText(error)}}
}

export async function cacheShell({onProgress=function(){}}={}){
  if(!('caches'in window))return{cached:[],failed:[{path:'shell',error:'Cache Storage unavailable'}]};
  const cache=await caches.open(SHELL_CACHE),cached=[],failed=[];
  for(let i=0;i<SHELL_ASSETS.length;i++){
    const path=SHELL_ASSETS[i];onProgress({stage:'shell',index:i+1,total:SHELL_ASSETS.length,percent:Math.round((i/SHELL_ASSETS.length)*25),label:'Caching '+path});
    try{
      const response=await fetch(path,{cache:'reload',credentials:'same-origin'});
      if(!response.ok)throw Error('HTTP '+response.status);
      await cache.put(path,response.clone());cached.push(path);
    }catch(error){failed.push({path,error:errText(error)})}
  }
  return{cached,failed};
}

export async function fetchAssetManifest(){
  const response=await fetch('/v1/assets/manifest?v=0772',{cache:'no-store',credentials:'same-origin'});
  if(!response.ok)throw Error('Asset manifest HTTP '+response.status);
  const data=await response.json();
  const states=asArray(data&&data.states);
  return{...data,states};
}

async function downloadMediaPack({onProgress=function(){}}={}){
  const manifest=await fetchAssetManifest(),states=asArray(manifest.states),done=[],skipped=[],failed=[];
  if(!states.length)return{done,skipped,failed:[{id:'manifest',error:'Cloud asset pack is empty.'}],manifest};
  for(let i=0;i<states.length;i++){
    const remote=states[i]||{},id=String(remote.id||'').toUpperCase();
    if(!id)continue;
    const percent=25+Math.round(((i+1)/states.length)*70);
    onProgress({stage:'media',index:i+1,total:states.length,percent,label:'Downloading '+id+' · '+(i+1)+'/'+states.length});
    try{
      const local=await getClip(id).catch(function(){return null});
      if(local&&remote.sha256&&local.cloudSha===remote.sha256&&local.blob&&local.blob.size){skipped.push(id);continue}
      const url='/media/'+encodeURIComponent(id)+'.mp4?asset='+encodeURIComponent(remote.sha256||String(remote.updatedAt||'0772'));
      const response=await fetch(url,{cache:'reload',credentials:'same-origin'});
      if(!response.ok)throw Error('HTTP '+response.status);
      const blob=await response.blob();
      if(!blob.size)throw Error('Downloaded file is empty');
      const file=typeof File==='function'?new File([blob],remote.fileName||id+'.mp4',{type:remote.mime||blob.type||'video/mp4'}):blob;
      await saveClip(id,file,{fileName:remote.fileName||id+'.mp4',duration:Number(remote.duration)||0,width:Number(remote.width)||0,height:Number(remote.height)||0,mime:remote.mime||blob.type||'video/mp4',source:'device-pack',cloudSha:remote.sha256||null,syncedAt:Date.now()});
      done.push(id);
    }catch(error){failed.push({id,error:errText(error)})}
  }
  return{done,skipped,failed,manifest};
}

export async function assetStatus(){
  const local=asArray(await listClips().catch(function(){return[]})),estimate=await storageEstimate();
  let manifest={states:[]};try{manifest=await fetchAssetManifest()}catch{}
  const remote=asArray(manifest.states),localBytes=local.reduce((n,x)=>n+(Number(x&&x.size)||0),0),remoteBytes=remote.reduce((n,x)=>n+(Number(x&&x.size)||0),0);
  const hdLocal=local.filter(x=>(Number(x&&x.width)>=512&&Number(x&&x.height)>=720)||Number(x&&x.size)>=500000).length;
  const hdRemote=remote.filter(x=>(Number(x&&x.width)>=512&&Number(x&&x.height)>=720)||Number(x&&x.size)>=500000).length;
  let persisted=false;try{persisted=Boolean(await navigator.storage?.persisted?.())}catch{}
  return{version:ASSET_PACK_VERSION,local:{clips:local.length,bytes:localBytes,hdClips:hdLocal},remote:{clips:remote.length,bytes:remoteBytes,hdClips:hdRemote},storage:{usage:Number(estimate.usage)||0,quota:Number(estimate.quota)||0,persisted},vrCompatible:true,model3DInstalled:false,ready:local.length>0};
}

export async function downloadAssets({onProgress=function(){}}={}){
  const persistence=await requestPersistentStorage();onProgress({stage:'storage',percent:2,label:persistence.persisted?'Persistent storage enabled':'Preparing device storage…'});
  const shell=await cacheShell({onProgress});
  onProgress({stage:'manifest',percent:25,label:'Reading Nocturne asset manifest…'});
  const media=await downloadMediaPack({onProgress});
  const sw=await installServiceWorker();
  const status=await assetStatus();
  onProgress({stage:'done',percent:100,label:'Device asset pack ready.'});
  try{localStorage.setItem('nocturne.asset-pack.v1',JSON.stringify({version:ASSET_PACK_VERSION,downloadedAt:Date.now(),status,failed:media.failed}))}catch{}
  window.dispatchEvent(new CustomEvent('nocturne:asset-pack-ready',{detail:{status,media,shell,persistence,sw}}));
  return{ok:media.failed.length===0,status,media,shell,persistence,sw};
}

export async function assetPackSummary(){
  const status=await assetStatus(),mb=function(n){return(Number(n||0)/1048576).toFixed(1)};
  return{...status,label:status.local.clips+' clips · '+mb(status.local.bytes)+' MB on device',detail:status.local.hdClips>0?status.local.hdClips+' HD clips local':'Local pack contains preview media only'};
}
