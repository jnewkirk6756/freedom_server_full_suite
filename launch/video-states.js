import{VIDEO_STATES,PRIMARY_VIDEO_STATE_IDS,ALTERNATE_VIDEO_STATE_IDS,stateById,extractStateId,listClips,getClip,saveClip,deleteClip,clipMetadata,storageEstimate,ensureMediaSession,cloudManifest,publishAllLocal,syncCloudToLocal}from'./video-state-core.js';
const $=id=>document.getElementById(id),fmtMB=n=>(Number(n||0)/1048576).toFixed(n>104857600?0:1)+' MB';
let clips=[],previewUrl=null,busy=false,cloudStates=[];
function message(t){$('vs-message').textContent=t}
function tarText(bytes,start,length){let end=start;while(end<start+length&&bytes[end])end++;return new TextDecoder().decode(bytes.subarray(start,end)).trim()}
async function unpackMediaPack(file){
  const bytes=new Uint8Array(await file.arrayBuffer()),out=[];let offset=0,manifest=null;
  while(offset+512<=bytes.length){
    const name=tarText(bytes,offset,100);if(!name)break;
    const sizeRaw=tarText(bytes,offset+124,12).replace(/\0/g,'').trim(),size=parseInt(sizeRaw||'0',8)||0,type=tarText(bytes,offset+156,1);
    const dataStart=offset+512,dataEnd=dataStart+size;
    if(dataEnd>bytes.length)throw Error('Media pack is truncated.');
    if(type!=='5'){
      if(name==='manifest.json'){try{manifest=JSON.parse(new TextDecoder().decode(bytes.subarray(dataStart,dataEnd)))}catch{}}
      else if(/\.(mp4|mov|webm)$/i.test(name)){
        const mime=/\.webm$/i.test(name)?'video/webm':/\.mov$/i.test(name)?'video/quicktime':'video/mp4';
        out.push(new File([bytes.slice(dataStart,dataEnd)],name.split('/').pop(),{type:mime,lastModified:file.lastModified||Date.now()}));
      }
    }
    offset=dataStart+Math.ceil(size/512)*512;
  }
  if(manifest&&manifest.format!=='nocturne-media-pack')throw Error('This TAR is not a Nocturne media pack.');
  return{files:out,manifest};
}
async function expandImportFiles(files){
  const out=[];let packs=0;
  for(const file of files){
    if(/\.tar$/i.test(file.name)){const pack=await unpackMediaPack(file);out.push(...pack.files);packs++;}
    else out.push(file);
  }
  return{files:out,packs};
}
async function refresh(){
  clips=await listClips();let cloud={states:[],usedBytes:0,capacityBytes:25*1024*1024,connected:false};try{const s=await ensureMediaSession();if(s.status.connected){cloud=await cloudManifest();cloud.connected=true}}catch{}cloudStates=cloud.states||[];const byId=new Map(clips.map(x=>[x.id,x])),cloudById=new Map(cloudStates.map(x=>[x.id,x])),readyPrimary=clips.filter(x=>PRIMARY_VIDEO_STATE_IDS.includes(x.id)).length,readyAlt=clips.filter(x=>ALTERNATE_VIDEO_STATE_IDS.includes(x.id)).length,ready=clips.length,flags=clips.reduce((n,x)=>n+(x.warnings?.length||0),0),est=await storageEstimate();
  $('vs-ready').textContent=readyPrimary+' / '+PRIMARY_VIDEO_STATE_IDS.length;$('vs-count').textContent=ready+' loaded · '+readyAlt+' alt';$('vs-quality').textContent=flags?flags+' flag'+(flags===1?'':'s'):'CLEAR';$('vs-storage').textContent=est.usage?fmtMB(est.usage):'LOCAL';$('vs-cloud').textContent=cloud.connected?(cloudStates.length+' · '+fmtMB(cloud.usedBytes||0)+' / '+fmtMB(cloud.capacityBytes||0)):'OFFLINE';
  const grid=$('vs-grid');grid.replaceChildren();
  for(const s of VIDEO_STATES){
    const row=byId.get(s.id),remote=cloudById.get(s.id),card=document.createElement('article');card.className='vs-card'+(row?' loaded':'')+(remote?' cloud':'');
    const head=document.createElement('div');head.className='vs-card-head';
    const ident=document.createElement('div');ident.className='vs-card-id';ident.innerHTML='<b>'+s.id+' · '+s.name+'</b><span>'+s.category.toUpperCase()+' · TARGET '+s.duration+'s</span>';
    const badge=document.createElement('span');badge.className='vs-status';badge.textContent=row?(remote?'LOCAL + CLOUD':'LOCAL'):remote?'CLOUD':'EMPTY';head.append(ident,badge);
    const desc=document.createElement('p');desc.textContent=s.description;
    const meta=document.createElement('div');meta.className='vs-meta';
    const m=(label,value)=>{const x=document.createElement('span');x.innerHTML=label+'<b>'+value+'</b>';return x};
    meta.append(m('FILE',row?.fileName||remote?.fileName||'—'),m('VIDEO',row?(row.width+'×'+row.height+' · '+row.duration.toFixed(1)+'s'):remote?(remote.width+'×'+remote.height+' · '+Number(remote.duration||0).toFixed(1)+'s'):'—'));
    const warn=document.createElement('div');warn.className='vs-warnings';for(const w of row?.warnings||[]){const x=document.createElement('small');x.textContent='⚠ '+w;warn.append(x);}
    const actions=document.createElement('div');actions.className='vs-card-actions';
    const label=document.createElement('label');label.className='file-button';label.textContent=row?'REPLACE':'ADD CLIP';const input=document.createElement('input');input.type='file';input.accept='video/*,.mp4,.mov,.webm';input.hidden=true;input.onchange=async()=>{const file=input.files?.[0];if(file)await importOne(s.id,file);input.value='';};label.append(input);actions.append(label);
    if(row||remote){const test=document.createElement('a');test.href='/live/?state='+encodeURIComponent(s.id)+'&v=0680';test.textContent='TEST LIVE';test.className='test-live';actions.append(test);}if(row){
      const preview=document.createElement('button');preview.type='button';preview.textContent='PREVIEW';preview.onclick=()=>showPreview(s.id);
      const del=document.createElement('button');del.type='button';del.textContent='DELETE';del.className='danger';del.onclick=async()=>{if(confirm('Delete '+s.id+' from this device?')){await deleteClip(s.id);message(s.id+' deleted.');await refresh();}};
      actions.append(preview,del);
    }
    card.append(head,desc,meta,warn,actions);grid.append(card);
  }
}
async function importOne(id,file){
  if(busy)return;busy=true;try{message('Reading '+file.name+'…');const meta=await clipMetadata(file);await saveClip(id,file,meta);message(id+' imported · '+meta.width+'×'+meta.height+' · '+meta.duration.toFixed(1)+'s');await refresh();}catch(e){message('Import failed: '+e.message)}finally{busy=false}
}
function chooseBulk(files){
  const existing=new Set(clips.map(x=>x.id)),result=[],unnamed=[],seen=new Set();
  for(const file of files){const id=extractStateId(file.name);if(id&&!seen.has(id)){result.push({id,file,source:'filename'});seen.add(id);}else unnamed.push(file);}
  const open=PRIMARY_VIDEO_STATE_IDS.filter(id=>!seen.has(id)&&!existing.has(id));unnamed.forEach((file,i)=>{if(open[i])result.push({id:open[i],file,source:'order'});});
  return{result,overflow:unnamed.slice(open.length)};
}
$('vs-stack').onchange=async e=>{
  const selected=[...(e.target.files||[])];e.target.value='';if(!selected.length||busy)return;
  busy=true;
  try{
    message('Reading media selection…');
    const expanded=await expandImportFiles(selected),files=expanded.files,plan=chooseBulk(files);
    if(!plan.result.length){message('No importable clips found.');return}
    const explicit=plan.result.filter(x=>x.source==='filename').length,ordered=plan.result.length-explicit,packNote=expanded.packs?(' · '+expanded.packs+' media pack'+(expanded.packs===1?'':'s')):'';
    if(!confirm('Import '+plan.result.length+' clips'+packNote+'? '+explicit+' matched by state filename; '+ordered+' assigned to the next empty slots.'))return;
    let done=0,errors=0;
    for(const item of plan.result){try{message('Importing '+item.id+' · '+item.file.name+'…');const meta=await clipMetadata(item.file);await saveClip(item.id,item.file,meta);done++;}catch{errors++;}}
    message('Import complete · '+done+' loaded'+(expanded.packs?' from pack':'')+(errors?' · '+errors+' failed':'')+(plan.overflow.length?' · '+plan.overflow.length+' unmatched':'')+'.');
  }catch(e2){message('Import failed: '+e2.message)}
  finally{busy=false;await refresh();}
};
async function showPreview(id){
  const row=await getClip(id);if(!row?.blob)return;const state=stateById(id);if(previewUrl)URL.revokeObjectURL(previewUrl);previewUrl=URL.createObjectURL(row.blob);const v=$('vs-preview-video');v.src=previewUrl;v.currentTime=0;$('vs-preview-title').textContent=id+' · '+state.name;$('vs-preview-meta').textContent=row.fileName+' · '+row.width+'×'+row.height+' · '+row.duration.toFixed(1)+'s · '+fmtMB(row.size);$('vs-preview').hidden=false;try{await v.play()}catch{}$('vs-preview').scrollIntoView({behavior:'smooth',block:'center'});
}
$('vs-preview-close').onclick=()=>{const v=$('vs-preview-video');try{v.pause();v.removeAttribute('src');v.load()}catch{}if(previewUrl){URL.revokeObjectURL(previewUrl);previewUrl=null}$('vs-preview').hidden=true;};
$('vs-publish').onclick=async()=>{if(busy)return;if(!clips.length){message('Import at least one clip locally first.');return}if(!confirm('Publish '+clips.length+' local clip'+(clips.length===1?'':'s')+' to the shared staging cache?'))return;busy=true;try{const out=await publishAllLocal({onProgress:id=>message('Publishing '+id+'…')});message('Publish complete · '+out.done.length+' synced'+(out.failed.length?' · '+out.failed.length+' failed':'')+'.');}catch(e){message('Publish failed: '+e.message)}finally{busy=false;await refresh();}};
$('vs-sync').onclick=async()=>{if(busy)return;busy=true;try{const out=await syncCloudToLocal({onProgress:id=>message('Syncing '+id+'…')});message('Sync complete · '+out.done.length+' downloaded · '+out.skipped.length+' already current'+(out.failed.length?' · '+out.failed.length+' failed':'')+'.');}catch(e){message('Sync failed: '+e.message)}finally{busy=false;await refresh();}};
$('vs-persist').onclick=async()=>{try{const ok=await navigator.storage?.persist?.();message(ok?'Browser granted persistent local media storage.':'Persistent storage was not granted; clips still remain in normal browser storage.');}catch{message('Persistent storage request is unavailable in this browser.')}};
$('vs-export').onclick=async()=>{const rows=await listClips(),manifest={version:'0.68.0',exportedAt:new Date().toISOString(),states:VIDEO_STATES.map(s=>({...s,clip:rows.find(x=>x.id===s.id)||null}))},url=URL.createObjectURL(new Blob([JSON.stringify(manifest,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='nocturne-video-state-manifest.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);message('Metadata manifest exported. Video files remain local.')};
window.addEventListener('pagehide',()=>{if(previewUrl)URL.revokeObjectURL(previewUrl)});
refresh().catch(e=>message('Video library unavailable: '+e.message));