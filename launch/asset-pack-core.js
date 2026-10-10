import {listClips,getClip,saveClip,storageEstimate} from './video-state-core.js';

export const ASSET_PACK_VERSION='NOCTURNE-ASSET-PACK-0.84.0';
export const SHELL_CACHE='nocturne-shell-0841-diag1';
export const SHELL_ASSETS=[
  '/',
  '/anna-home.js?v=0840',
  '/anna-home.css?v=0840',
  '/anna-psyche.js?v=0840',
  '/anna-memory.js?v=0840',
  '/anna-presence.js?v=0840',
  '/anna-grounding.js?v=0840',
  '/anna-experience.js?v=0840',
  '/video-state-player.js?v=0840',
  '/video-state.css?v=0840',
  '/nocturne-icon.svg?v=0840',
  '/live/',
  '/vr/',
  '/experience.css?v=0840',
  '/live-embodied.css?v=0840',
  '/experience-mobile-safe.js?v=0840',
  '/video-state-core.js?v=0840',
  '/asset-pack-core.js?v=0840',
  '/vr-pattern-core.js?v=0840',
  '/voice-core.js?v=0840',
  '/face-pack-core.js?v=0840',
  '/anna-avatar-runtime.js?v=0840',
  '/vr.js?v=0840',
  '/vr-fallback.js?v=0840',
  '/vr.css?v=0840',
  '/ui-shell.css?v=0841',
  '/ui-shell-core.js?v=0841',
  '/ui-shell.js?v=0841',
  '/viewer-core.js?v=0841',
  '/xr-session-core.js?v=0841',
  '/model-viewer/',
  '/model-viewer.js?v=0841',
  '/model-viewer.css?v=0841',
  '/navigation.css?v=0841',
  '/navigation.js?v=0841',
  '/navigation-state.js?v=0840',
  '/runtime-diagnostics.js?v=0841diag1',
  '/browser-storage.js?v=0840',
  '/session-core.js?v=0840',
  '/app.webmanifest?v=0840'
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
    const reg=await navigator.serviceWorker.register('/nocturne-sw.js?v=0840',{scope:'/'});
    return{supported:true,registered:true,scope:reg.scope};
  }catch(error){return{supported:true,registered:false,error:errText(error)}}
}

// Keep shell cache keys in sync with nocturne-sw.js. Other query parameters
// retain their meaning; only the shell build cache-buster is discarded.
function shellCacheKey(path){
  const url=new URL(path,location.origin);
  url.searchParams.delete('v');url.hash='';
  return new Request(url.href);
}
let privateShellMode=false;
async function disableShellCaching(){
  privateShellMode=true;
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('nocturne-shell-')).map(name=>caches.delete(name)));
}
export async function cacheShell({onProgress=function(){}}={}){
  const privateError='Offline shell caching is disabled for authenticated deployments.';
  if(privateShellMode)return{cached:[],failed:[{path:'shell',error:privateError}]};
  if(!('caches'in window))return{cached:[],failed:[{path:'shell',error:'Cache Storage unavailable'}]};
  let cache;
  try{cache=await caches.open(SHELL_CACHE)}catch(error){return{cached:[],failed:[{path:'shell',error:errText(error)}]}}
  const cached=[],failed=[];
  for(let i=0;i<SHELL_ASSETS.length;i++){
    const path=SHELL_ASSETS[i];onProgress({stage:'shell',index:i+1,total:SHELL_ASSETS.length,percent:Math.round((i/SHELL_ASSETS.length)*25),label:'Caching '+path});
    try{
      const response=await fetch(path,{cache:'reload',credentials:'same-origin'});
      if(/(?:^|,)\s*private(?:\s|=|,|$)/i.test(response.headers.get('cache-control')||'')||response.status===401||response.status===403){
        try{await disableShellCaching()}catch(error){failed.push({path:'shell',error:errText(error)})}
        return{cached:[],failed:[...failed,{path,error:privateError}]};
      }
      if(privateShellMode)return{cached:[],failed:[...failed,{path,error:privateError}]};
      if(!response.ok||response.status===206)throw Error('HTTP '+response.status);
      await cache.put(shellCacheKey(path),response.clone());cached.push(path);
    }catch(error){failed.push({path,error:errText(error)})}
  }
  return{cached,failed};
}

export async function fetchAssetManifest(){
  const response=await fetch('/v1/assets/manifest?v=0840',{cache:'no-store',credentials:'same-origin'});
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
      const url='/media/'+encodeURIComponent(id)+'.mp4?asset='+encodeURIComponent(remote.sha256||String(remote.updatedAt||'0840'));
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
