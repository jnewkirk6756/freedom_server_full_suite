import {DEVICE_VERSION,MATERIALS,TEXTURES,SHAPES,FINISHES,DEVICE_KEY,emptyLibrary,readLibrary,writeLibrary,saveDevice,selectedDevice,mergeLibrary,parseLibrary,newId,toMm,fromMm,clamp,advanceClock} from './device-core.js';
import {mountGeometry} from './device-view.js';
const $=id=>document.getElementById(id),node=(tag,text='')=>{const n=document.createElement(tag);n.textContent=text;return n;};
let library=emptyLibrary(),editId=null,unit='in',clock={phase:0,running:false,cycles:0,elapsed:0,last:null},started=false,readFailed=false;
function message(text,error=false){$('device-message').textContent=text;$('device-message').classList.toggle('error',error);}
try{library=readLibrary();unit=library.unit;}catch(e){readFailed=true;message('Library unavailable: '+e.message+'. Existing stored data was not changed.',true);}
const preview=mountGeometry($('device-preview'),{waveCanvas:$('preview-wave'),library,onDeviceChange:()=>{stop();started=false;clock.phase=0;}});
for(const [id,values]of [['device-material',MATERIALS],['device-texture',TEXTURES],['device-shape',SHAPES],['device-finish',FINISHES]])for(const text of values){const o=node('option',text);o.value=text;$(id).append(o);}
$('units').value=unit;
function stop(){clock.running=false;clock.last=null;$('preview-play').textContent='Play preview';}
function commit(next){
  if(readFailed)throw Error('Library could not be read; save is disabled to protect existing data.');
  const saved=writeLibrary({...next,unit},globalThis.localStorage,library.revision);library=saved;
  window.dispatchEvent(new Event('nocturne:devices-changed'));renderLibrary();return saved;
}
function renderLibrary(){
  const list=$('device-list');list.replaceChildren();$('device-count').textContent=library.devices.length+' saved';
  for(const d of library.devices){
    const card=node('article');card.className='device-card'+(d.id===library.activeId?' active':'');
    const swatch=node('i');swatch.className='device-swatch';swatch.style.backgroundColor=d.color;
    const title=node('h3',d.name),details=node('p',`${Number(fromMm(d.lengthMm,unit).toFixed(3))} × ${Number(fromMm(d.widthMm,unit).toFixed(3))} ${unit} · ${d.material}\n${d.texture} · ${d.finish}`);details.style.whiteSpace='pre-line';
    const actions=node('div');actions.className='card-actions';
    for(const [label,act]of [[d.id===library.activeId?'Active':'Use',()=>{commit({...library,activeId:d.id});message('Active tool: '+d.name);}],['Edit',()=>openEditor(d)],['Duplicate',()=>openEditor({...d,id:newId(),name:(d.name+' copy').slice(0,60)})],['Delete',()=>{if(confirm('Delete saved tool “'+d.name+'”?')){const devices=library.devices.filter(x=>x.id!==d.id);commit({...library,devices,activeId:library.activeId===d.id?null:library.activeId});message('Tool deleted. Session data was not changed.');}}]]){
      const b=node('button',label);b.type='button';b.disabled=label==='Active';b.onclick=()=>{try{act();}catch(e){message(e.message,true);}};actions.append(b);
    }
    card.append(swatch,title,details,actions);list.append(card);
  }
  if(!library.devices.length)list.append(node('p','No saved tools yet. Add your own measurements; the preview will stay unmeasured until you do.'));
  for(const caption of document.querySelectorAll('.unit-caption'))caption.textContent=unit;
}
function openEditor(d=null){
  stop();editId=d?.id||null;$('device-form').reset();$('device-editor').hidden=false;$('editor-title').textContent=d?'Edit tool':'New tool';
  $('device-name').value=d?.name||'';
  for(const [field,key] of [['length','lengthMm'],['width','widthMm'],['travel','travelMm']])$('device-'+field).value=d?String(Number(fromMm(d[key],unit).toFixed(5))):'';
  for(const [key,fallback]of [['color','#b58aee'],['material','Other / unspecified'],['texture','Smooth'],['shape','Cylinder'],['finish','Matte'],['notes','']])$('device-'+key).value=d?.[key]||fallback;
  $('device-editor').scrollIntoView({behavior:'smooth',block:'start'});$('device-name').focus({preventScroll:true});
}
$('new-device').onclick=()=>openEditor();$('cancel-device').onclick=()=>{$('device-editor').hidden=true;editId=null;};
$('device-form').onsubmit=e=>{e.preventDefault();try{
  const input={id:editId||newId(),name:$('device-name').value,lengthMm:toMm($('device-length').value,unit),widthMm:toMm($('device-width').value,unit),travelMm:toMm($('device-travel').value,unit)};
  for(const key of ['color','material','texture','shape','finish','notes'])input[key]=$('device-'+key).value;
  commit(saveDevice(library,input));$('device-editor').hidden=true;editId=null;message('Tool saved locally. Use its Use button to make it active.');
}catch(err){message(err.message,true);}};
$('units').onchange=()=>{const next=$('units').value;for(const key of ['length','width','travel']){const el=$('device-'+key);if(el.value!=='')el.value=String(Number(fromMm(toMm(el.value,unit),next).toFixed(5)));}unit=next;try{commit({...library,unit});message('Display units changed to '+(unit==='in'?'inches':'millimeters')+'. Saved dimensions are preserved.');}catch(e){message(e.message,true);}renderLibrary();};
$('export-devices').onclick=()=>{try{const raw=JSON.stringify(library,null,2),url=URL.createObjectURL(new Blob([raw],{type:'application/json'})),a=node('a');a.href=url;a.download='nocturne-devices.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);message('Export contains tool profiles only, not conversations.');}catch(e){message(e.message,true);}};
$('import-devices').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>100000)throw Error('Import limit is 100 KB.');const source=parseLibrary(await file.text());if(confirm('Add '+source.devices.length+' tool profiles? Existing profiles will be kept.')){commit(mergeLibrary(library,source));message('Profiles imported; existing profiles preserved.');}}catch(err){message('Import rejected: '+err.message,true);}finally{e.target.value='';}};
$('preview-play').onclick=()=>{clock.running=!clock.running;clock.last=null;if(clock.running)started=true;$('preview-play').textContent=clock.running?'Pause preview':'Play preview';};
$('preview-reset').onclick=()=>{stop();started=false;clock.phase=0;clock.elapsed=0;clock.cycles=0;preview.reset();};
for(const id of ['preview-target','preview-period','preview-pitch','preview-yaw'])$(id).addEventListener('input',()=>{stop();started=false;clock.phase=0;preview.reset();});
window.addEventListener('storage',e=>{if(e.key!==DEVICE_KEY)return;try{library=readLibrary();unit=library.unit;$('units').value=unit;stop();renderLibrary();message('Library updated in another tab. Unsaved edits were not submitted.');}catch(err){message(err.message,true);}});
const pause=()=>{stop();};document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();});window.addEventListener('pagehide',pause);window.addEventListener('nocturne:suspend',pause);
function frame(t){const period=clamp($('preview-period').value,.5,30);clock=advanceClock(clock,t,period);preview.update({phase:clock.phase,running:clock.running,started,target:clamp(Number($('preview-target').value)/100),period,pitch:clamp($('preview-pitch').value,-60,60),yaw:clamp($('preview-yaw').value,-60,60)});requestAnimationFrame(frame);}
renderLibrary();requestAnimationFrame(frame);window.__NOCTURNE_DEVICES_READY__=DEVICE_VERSION;
