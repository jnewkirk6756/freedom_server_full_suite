import {VERSION,PREFIX,STATES,FRAMES,POSES,safeParse,inspectStorage,clipMeta,chooseClip,recordPlay,safeCheckpoint} from './reliability-core.js';
import {LoopDeck} from './player-deck.js';
import {LIMIT,readBlob,writeBlob,removeBlob,checksum,inspectVideo,downloadBlob} from './player-storage.js';
import {xrSupport,XRTheater} from './xr-theater.js';
const $=id=>document.getElementById(id),saved=inspectStorage(localStorage);if(!saved.ok)throw Error('INVALID_STATE');
const w=saved.values,media=w.media,avatars=w.avatars.length?w.avatars:w.avatar?[w.avatar]:[];
let chosen=avatars.find(a=>a.id===w.playerCheckpoint?.avatarId)||avatars.find(a=>a.id===w.avatar?.id)||avatars[0]||null;
let checkpoint=safeCheckpoint(w.playerCheckpoint),report={history:[],recent:[],plays:0,repeats:0},unavailable=[],operation=false,activePose='center',playing=false,editItem=null,editBlob=null,editUrl=null,epoch=0,lastSave=0,xr=null;
const errors=[];
const messages={NO_COMPATIBLE_CLIP:'No reviewed clip matches this view and pose. Import a matching clip or change the director settings.',BRIDGE_REQUIRED:'That pose change needs a reviewed bridge clip. Playback is holding instead of jumping between poses.',FILE_TOO_LARGE:'Choose a non-empty video up to 64 MB. No partial import was saved.',INVALID_DURATION:'Use a video between 0.2 and 120 seconds.',RESOLUTION_LIMIT:'This beta accepts videos up to 4K. A 720p or 1080p device copy is recommended.',MEDIA_TIMEOUT:'This clip did not load in time. The previous clip is preserved; try another file.',MEDIA_DECODE_FAILED:'This browser could not decode the video. Try an H.264 MP4 or VP9 WebM.',STORAGE_BLOCKED:'Storage is blocked by another tab. Close other app tabs, then retry.',STORAGE_FULL:'The browser could not save the media. Export existing work before freeing space.',STORAGE_UNAVAILABLE:'Browser media storage is unavailable. Your existing data was not cleared.',SWITCH_BUSY:'A clip is already loading. Wait, or press Pause to cancel.',UNSUPPORTED_FILE:'Use a supported MP4, WebM or MOV file.',NOT_REVIEWED:'Review this clip before adding it to the runtime.',MISSING_FILE:'This clip’s metadata exists, but its video is missing on this device. Use Locate to reattach the file.',WRONG_FILE:'That file does not match the saved checksum. The original record was not replaced.',CANCELLED:'Loading cancelled. Playback is paused.'};
function note(text){$('status-note').textContent=text;}
function fail(error){const code=error.name==='NotAllowedError'?'AUTOPLAY_BLOCKED':messages[error.message]?error.message:'OPERATION_FAILED';errors.push({code,at:new Date().toISOString()});if(errors.length>20)errors.shift();note(code==='AUTOPLAY_BLOCKED'?'Playback needs your permission. Tap Play again.':messages[code]||'The operation could not finish. Your saved data has not been cleared.');}
function settings(){return{avatarId:chosen?.id,state:$('state').value,frame:$('frame').value,pose:$('pose').value};}
function persistMedia(){localStorage.setItem(PREFIX+'media',JSON.stringify(media));}
function snapshot(force=false){if(!chosen||(!force&&Date.now()-lastSave<2000))return;lastSave=Date.now();const v=deck.current();try{checkpoint={version:1,...settings(),clipId:deck.currentId,time:v?.currentTime||0,wasPlaying:!!v&&!v.paused,updatedAt:new Date().toISOString()};localStorage.setItem(PREFIX+'playerCheckpoint',JSON.stringify(checkpoint));$('saved').textContent=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false});}catch{note('Session checkpoint could not be saved. Export workspace data before clearing storage.');}}
const deck=new LoopDeck($('deck-a'),$('deck-b'),{onState:state=>{$('player-status').textContent=state.toUpperCase();playing=state==='playing';}});
function updateMetrics(){$('plays').textContent=report.plays;$('unique').textContent=new Set(report.history).size;$('repeats').textContent=report.repeats;}
function pause(){epoch++;deck.pause();snapshot(true);note('Paused. Session settings are saved on this device.');}
async function play(next=false,explicit=null){
 if(operation||deck.busy)return;
 if(!chosen)return note('Create a character in the workspace first.');
 const s=settings(),selection=explicit?{clip:clipMeta(explicit),reason:'EXPLICIT'}:chooseClip(media,{...s,currentPose:deck.current()?activePose:s.pose,recent:report.recent,unavailable});
 if(!selection.clip)return note(messages[selection.reason]||'No matching clip.');
 const clip=selection.clip,item=media.find(m=>m.id===clip.id);
 if(clip.avatarId!==chosen.id||!clip.reviewed)return note(messages.NOT_REVIEWED);
 if(!next&&deck.currentId===clip.id){try{await deck.resume();snapshot(true);}catch(e){fail(e);}return;}
 operation=true;const token=epoch;
 try{const blob=await readBlob(clip.id);if(token!==epoch)return;if(!blob){unavailable.push(clip.id);throw Error('MISSING_FILE');}
  const time=!next&&checkpoint?.clipId===clip.id?checkpoint.time:0;
  await deck.switchTo(clip.id,blob,{time,loop:clip.family!=='transition'});
  if(token!==epoch){deck.pause();return;}
  if(clip.family!=='transition')activePose=clip.endPose;
  report=recordPlay(report,clip.id);updateMetrics();$('empty-stage').hidden=true;$('clip-name').textContent=item.name||'Performance clip';snapshot(true);
  note(selection.reason==='NEUTRAL_FALLBACK'?'No exact state clip is available. Playing the reviewed neutral fallback.':selection.reason==='BRIDGE'?'Playing the compatible pose bridge.':'Playing a reviewed local clip. No provider or AI request was made.');
 }catch(e){fail(e);}finally{operation=false;}
}
function disposeReview(){const v=$('review-video');v.pause();v.removeAttribute('src');v.load();if(editUrl)URL.revokeObjectURL(editUrl);editUrl=null;editBlob=null;}
function closeEditor(){disposeReview();$('clip-editor').close();}
async function edit(item,blob=null){
 pause();await deck.reset(); // Release decoders before opening a separate review video.
 editItem=item;editBlob=blob||await readBlob(item.id);
 const m=clipMeta(item);$('edit-filename').textContent=item.name||'Clip';$('edit-frame').value=m.frame;$('edit-family').value=m.family;$('edit-start').value=m.startPose;$('edit-end').value=m.endPose;$('edit-state').value=STATES.includes(m.state)?m.state:STATES[0];$('edit-reviewed').checked=m.reviewed;$('edit-rights').checked=!!item.player?.rightsConfirmedAt;$('edit-error').textContent='';
 if(editBlob){editUrl=URL.createObjectURL(editBlob);$('review-video').src=editUrl;}
 $('clip-editor').showModal();
}
function library(){
 const rows=$('library-rows');rows.replaceChildren();const owned=media.filter(x=>x.avatarId===chosen?.id),query=$('search').value.toLowerCase();$('library-count').textContent=owned.length+' clips · '+owned.filter(c=>clipMeta(c).reviewed).length+' reviewed';
 const filtered=owned.filter(x=>(x.name||'').toLowerCase().includes(query));
 if(!filtered.length){const p=document.createElement('p');p.className='small';p.textContent=owned.length?'No clips match this search.':'No clips for this character yet. Import a clip to start. Existing unassigned media remains untouched in your workspace.';rows.append(p);}
 for(const clip of filtered){const m=clipMeta(clip),row=document.createElement('div');row.className='clip-row';const badge=document.createElement('div');badge.className='clip-icon';badge.textContent=m.family==='transition'?'↗':'▷';const name=document.createElement('div'),strong=document.createElement('strong'),small=document.createElement('small');strong.textContent=clip.name||'Clip';small.textContent=`${m.frame} · ${m.startPose} → ${m.endPose} · ${m.state.replaceAll('_',' ')}${m.duration?' · '+m.duration.toFixed(1)+'s':''}`;name.append(strong,small);const status=document.createElement('span');status.className='chip'+(m.reviewed?' ok':'');status.textContent=m.reviewed?'REVIEWED':'REVIEW NEEDED';const actions=document.createElement('div');actions.className='clip-actions';
  const action=(label,fn)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>Promise.resolve(fn()).catch(fail);actions.append(b);};
  action('Play',()=>{pause();$('frame').value=m.frame;$('pose').value=m.startPose;$('state').value=STATES.includes(m.state)?m.state:STATES[0];activePose=m.startPose;return play(true,clip);});
  action('Review',()=>edit(clip));action('Save file',async()=>{const b=await readBlob(clip.id);if(!b)throw Error('MISSING_FILE');downloadBlob(b,clip.name||'aurelia-clip.mp4');});
  action('Locate',()=>{locateId=clip.id;$('file').click();});row.append(badge,name,status,actions);rows.append(row);
 }
}
async function selectCharacter(){pause();const old=chosen?.id;chosen=avatars.find(a=>a.id===$('avatar').value)||null;if(old!==chosen?.id){await deck.reset();$('progress').style.width='0%';unavailable=[];report={history:[],recent:[],plays:0,repeats:0};activePose=$('pose').value;updateMetrics();$('empty-stage').hidden=false;$('clip-name').textContent='No clip selected';}library();}
for(const a of avatars){const o=document.createElement('option');o.value=a.id;o.textContent=a.name;$('avatar').append(o);}if(!avatars.length){const o=document.createElement('option');o.textContent='Create a character in Workspace';$('avatar').append(o);$('import').disabled=true;}
if(chosen)$('avatar').value=chosen.id;
$('avatar').onchange=selectCharacter;
for(const id of ['frame','pose','state'])$(id).onchange=()=>{pause();note('Director settings changed. Press Play to find a compatible reviewed clip.');};
$('search').oninput=library;$('play').onclick=()=>play();$('pause').onclick=pause;$('next').onclick=()=>play(true);
$('fullscreen').onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if($('stage').requestFullscreen)await $('stage').requestFullscreen();else if(deck.current()?.webkitEnterFullscreen)deck.current().webkitEnterFullscreen();else note('Fullscreen is not supported in this browser.');}catch(e){fail(e);}};
$('close-editor').onclick=closeEditor;$('clip-editor').addEventListener('cancel',disposeReview);
$('edit-form').onsubmit=async e=>{
 e.preventDefault();if(!chosen||!editItem)return;const owner=editItem.avatarId;
 if(owner!==chosen.id)return closeEditor();
 if($('edit-family').value==='performance'&&$('edit-start').value!==$('edit-end').value){$('edit-error').textContent='A loop must start and end in the same pose. Choose Bridge transition for different poses.';return;}
 const form=e.target,btn=form.querySelector('[type=submit]');btn.disabled=true;
 try{
  const next={...editItem,family:$('edit-family').value,state:$('edit-state').value,player:{...editItem.player,frame:$('edit-frame').value,startPose:$('edit-start').value,endPose:$('edit-end').value,state:$('edit-state').value,reviewed:$('edit-reviewed').checked,rightsConfirmedAt:new Date().toISOString()}};
  const i=media.findIndex(m=>m.id===next.id),isNew=i<0;
  if(isNew){if(!editBlob)throw Error('MISSING_FILE');await writeBlob(next.id,editBlob);media.push(next);}else media[i]=next;
  try{persistMedia();}catch(error){if(isNew){media.pop();await removeBlob(next.id);}else media[i]=editItem;throw error;}
  closeEditor();library();note(next.player.reviewed?'Reviewed clip saved. It can now be selected by the director.':'Clip saved, but excluded from runtime until reviewed.');
 }catch(error){$('edit-error').textContent=messages[error.message]||'Could not save this clip. Check browser storage.';}finally{btn.disabled=false;}
};
let locateId=null;
$('import').onclick=()=>{locateId=null;$('file').click();};
$('file').onchange=async()=>{
 const file=$('file').files?.[0];$('file').value='';if(!file||!chosen||operation)return;operation=true;const owner=chosen.id,locate=locateId;
 try{note('Checking the clip on this device…');const meta=await inspectVideo(file),hash=await checksum(file);if(owner!==chosen?.id)return;
  if(locate){const item=media.find(m=>m.id===locate&&m.avatarId===owner);if(!item)throw Error('MISSING_FILE');if(!item.sha256)throw Error('WRONG_FILE');if(item.sha256!==hash)throw Error('WRONG_FILE');await writeBlob(item.id,file);unavailable=unavailable.filter(id=>id!==item.id);note('Original media file reattached. The character and clip ID did not change.');return;}
  if(media.some(m=>m.avatarId===owner&&m.sha256===hash))return note('This exact file is already attached to this character.');
  const total=media.reduce((n,m)=>n+(Number(m.bytes)||0),0);if(total+file.size>256*1024*1024)throw Error('STORAGE_FULL');
  const item={id:'media_'+crypto.randomUUID(),avatarId:owner,name:file.name.slice(0,180),bytes:file.size,sha256:hash,state:'idle_neutral',family:'performance',...meta,player:{...meta,frame:'portrait',startPose:'center',endPose:'center',reviewed:false}};
  await edit(item,file);
 }catch(error){fail(error);}finally{operation=false;}
};
for(const v of deck.videos){v.addEventListener('timeupdate',()=>{if(v!==deck.current())return;$('progress').style.width=(v.duration?v.currentTime/v.duration*100:0)+'%';snapshot();if($('auto-next').checked&&!v.paused&&!operation&&!deck.busy&&v.loop&&v.duration-v.currentTime<.55){const selection=chooseClip(media,{...settings(),currentPose:activePose,recent:report.recent,unavailable});if(selection.clip&&selection.clip.id!==deck.currentId)play(true);}});v.addEventListener('ended',()=>{if(v!==deck.current())return;const item=media.find(m=>m.id===deck.currentId);if(item&&item.family==='transition'){activePose=clipMeta(item).endPose;play(true);}});v.addEventListener('error',()=>{if(v===deck.current()&&!deck.busy){playing=false;fail(Error('MEDIA_DECODE_FAILED'));}});}
if(checkpoint&&avatars.some(a=>a.id===checkpoint.avatarId)){$('recovery-banner').hidden=false;$('recover-copy').textContent=checkpoint.wasPlaying?'A previous playback session did not finish cleanly. Restore its settings; playback will remain paused.':'A saved session is available. Restore its view and clip position without auto-playing.';$('restore-session').onclick=()=>{const cp=checkpoint;chosen=avatars.find(a=>a.id===cp.avatarId);$('avatar').value=chosen.id;$('state').value=cp.state;$('frame').value=cp.frame;$('pose').value=cp.pose;activePose=cp.pose;$('recovery-banner').hidden=true;library();note('Session settings restored. Press Play when ready.');};}
$('storage-permission').onclick=async()=>{try{const yes=await navigator.storage?.persist?.();$('storage-state').textContent=yes?'Browser granted persistent storage. Independent backups are still needed.':'Browser did not grant persistent storage. Keep independent copies of your files.';}catch{note('Persistent storage permission is unavailable.');}};
$('diagnostics').onclick=()=>{const payload={version:VERSION,at:new Date().toISOString(),scope:'device-local-loop-player',aiConnected:false,privateDataIncluded:false,viewport:{width:innerWidth,height:innerHeight},secureContext:isSecureContext,xrSupported:$('vr').dataset.support==='true',counts:{avatars:avatars.length,clips:media.length,plays:report.plays},errors};downloadBlob(new Blob([JSON.stringify(payload,null,2)],{type:'application/json'}),'AURELIA-DIAGNOSTICS-0.18.json');note('Diagnostics exported. No names, profiles, chat text, media or credentials are included.');};
$('vr').onclick=async()=>{if(!deck.current())return note('Play a reviewed clip before entering the VR theater.');if($('vr').dataset.support!=='true')return;try{xr=new XRTheater(()=>deck.current(),()=>{xr=null;pause();$('vr').textContent='Enter VR theater';});await xr.enter();note('WebXR theater open. Controller select toggles playback; use the headset system control to exit. This is a flat video screen, not a 3D avatar.');}catch(error){note('The headset did not start a VR session. You can still use the browser player.');}};
xrSupport().then(ok=>{$('vr').disabled=!ok;$('vr').dataset.support=String(ok);$('vr').textContent=ok?'Enter VR theater':'VR unavailable here';}).catch(()=>{});
document.addEventListener('visibilitychange',()=>{if(document.hidden){pause();xr?.end();}});window.addEventListener('pagehide',()=>{pause();xr?.end();deck.close();disposeReview();});
library();
