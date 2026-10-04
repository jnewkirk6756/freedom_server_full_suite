/** Observe the existing session object: no independent motion clock and no device commands. */
import {mountGeometry} from './device-view.js';
import {clamp} from './device-core.js';
export function attachGeometry(live) {
  if(typeof window==='undefined'||!/^\/live\/?$/.test(window.location.pathname))return live;
  queueMicrotask(()=>installGeometry(live));return live;
}
export function installGeometry(live) {
  const root=document.getElementById('trajectory'),oldWave=document.getElementById('waveform');
  if(!root||document.getElementById('device-trajectory')||!oldWave)return;
  const css=document.createElement('link');css.rel='stylesheet';css.href='/devices.css?v=0641';document.head.append(css);
  // Preserve legacy nodes used by the session module, but remove their decorative display.
  for(const child of [...root.children]){child.hidden=true;child.style.setProperty('display','none','important');}
  oldWave.hidden=true;oldWave.style.setProperty('display','none','important');
  const wave=document.createElement('canvas');wave.id='device-waveform';wave.style.cssText='display:block;width:100%;height:170px';wave.setAttribute('role','img');wave.setAttribute('aria-label','Calculated displacement and current phase');oldWave.after(wave);
  root.style.setProperty('display','none','important');
  const target=document.createElement('section');target.id='device-trajectory';root.before(target);
  const legacyVisibility=document.getElementById('setup-trajectory')?.closest('label');if(legacyVisibility){legacyVisibility.hidden=true;legacyVisibility.style.display='none';}
  let started=live.phase>0||live.cycle>0,custom=[],yaw=0,stopped=false,previousPhase=live.phase,previousTime=null,observedPeriod=null;
  try{yaw=clamp(JSON.parse(sessionStorage.getItem('nocturne.geometry.v1')||'{}').yaw??0,-60,60);}catch{}
  const halt=()=>{if(live.running)document.getElementById('live-start')?.click();try{navigator.vibrate?.(0);}catch{};};
  const geometry=mountGeometry(target,{waveCanvas:wave,onDeviceChange:()=>{halt();started=false;live.phase=0;geometry.reset();}});
  const row=document.createElement('div');row.className='dg-views';row.style.marginTop='10px';
  const label=document.createElement('label');label.textContent='Side angle ° ';label.style.cssText='font:12px system-ui;color:#c7afd9';
  const yawInput=document.createElement('input');yawInput.type='number';yawInput.min='-60';yawInput.max='60';yawInput.step='1';yawInput.value=String(yaw);yawInput.setAttribute('aria-label','Side angle degrees');yawInput.style.cssText='width:75px;background:#130b20;color:#eadcf6;border:1px solid #4a315f;border-radius:8px;padding:8px;font:14px system-ui';
  yawInput.addEventListener('change',()=>{halt();yaw=clamp(yawInput.value,-60,60);yawInput.value=String(yaw);try{sessionStorage.setItem('nocturne.geometry.v1',JSON.stringify({yaw}));}catch{}});label.append(yawInput);row.append(label);target.append(row);
  const legacyTool=document.getElementById('ct-tool');if(legacyTool){const label=legacyTool.closest('label');if(label){label.hidden=true;label.style.display='none';}const note=document.createElement('p');note.textContent='Profile and color come from Devices. Up/down angle uses the approach-angle field; Side angle is available on the geometry panel.';note.style.cssText='font:12px/1.5 system-ui;color:#baa5cc';legacyTool.closest('form')?.append(note);}
  const updateCustom=()=>{try{const chart=JSON.parse(localStorage.getItem('nocturne.chart.v1')||'{}');custom=Array.isArray(chart.recordedPattern)?chart.recordedPattern.slice(0,256):[];}catch{custom=[];}};updateCustom();
  document.getElementById('pattern-dialog')?.addEventListener('close',updateCustom);
  const hold=document.getElementById('hold');for(const type of ['click','touchend'])hold?.addEventListener(type,e=>{e.preventDefault();e.stopImmediatePropagation();halt();const line=document.getElementById('last-line');if(line)line.textContent='Paused. Position held; use Start Live to resume.';},{capture:true,passive:false});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)halt();});window.addEventListener('pagehide',()=>{stopped=true;halt();});
  function render(timestamp){
    if(stopped)return;if(live.running)started=true;
    const pitch=parseFloat(document.getElementById('traj-angle')?.textContent)||0;
    const pattern=document.getElementById('ls-pattern')?.textContent?.trim().toLowerCase();
    // Derive rate from the existing phase, never advance it here.
    const elapsed=previousTime===null?0:(timestamp-previousTime)/1000;
    const step=(live.phase-previousPhase+1)%1;
    if(live.running&&elapsed>0&&elapsed<.2&&step>0&&step<.2)observedPeriod=elapsed/step;
    const period=observedPeriod||1.1+(1-clamp(live.telemetry.pace))*2.7;
    previousTime=timestamp;previousPhase=live.phase;
    const profile=document.getElementById('traj-tool')?.textContent?.trim().toLowerCase()||'white';geometry.update({phase:live.phase,target:clamp(live.telemetry.depth),period,running:live.running,started,pitch,yaw,profile,custom:pattern==='custom'?custom:[]});
    requestAnimationFrame(render);
  }
  window.addEventListener('pageshow',()=>{if(stopped){stopped=false;previousTime=null;requestAnimationFrame(render);}});
  requestAnimationFrame(render);window.__NOCTURNE_GEOMETRY_READY__='0.64.1';
}
