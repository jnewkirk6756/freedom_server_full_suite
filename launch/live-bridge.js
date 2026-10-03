/** Staging controls test is a preview permission, never a change to Anna's state. */
const clamp=v=>Math.max(0,Math.min(1,Number.isFinite(Number(v))?Number(v):0));
export const BRIDGE_VERSION='NOCTURNE-LIVE-BRIDGE-0.64.1';
export const LIVE_TEST_KEY='nocturne.live.controls-test.v1';
const TEST_TTL=2*60*60*1000;
const TEST_HOSTS=new Set(['aurelia-staging.onrender.com','localhost','127.0.0.1','[::1]']);
export function liveTestState({location=globalThis.location,storage,now=Date.now()}={}){
  const available=!!location&&TEST_HOSTS.has(location.hostname)&&/^\/live\/?$/.test(location.pathname);
  if(!available)return{available:false,requested:false,active:false};
  try{
    const raw=(storage||globalThis.sessionStorage).getItem(LIVE_TEST_KEY);
    if(!raw)return{available:true,requested:false,active:false};
    const value=JSON.parse(raw),valid=value?.version===1&&Number.isFinite(value.startedAt)&&Number.isFinite(value.expiresAt)&&value.expiresAt-value.startedAt===TEST_TTL;
    return{available:true,requested:true,active:valid&&now>=value.startedAt&&now<value.expiresAt,expiresAt:valid?value.expiresAt:null};
  }catch{return{available:true,requested:true,active:false};}
}
export const isLiveTestMode=()=>liveTestState().active;
// Keep outputs suppressed after expiry until the user explicitly exits the test.
export const testOutputSuppressed=()=>liveTestState().requested;
export function setLiveTestMode(enabled,options={}){
  const state=liveTestState(options);if(!state.available)return false;
  try{
    const storage=options.storage||globalThis.sessionStorage,now=options.now??Date.now();
    if(enabled)storage.setItem(LIVE_TEST_KEY,JSON.stringify({version:1,startedAt:now,expiresAt:now+TEST_TTL}));
    else storage.removeItem(LIVE_TEST_KEY);
    return true;
  }catch{return false;}
}
function object(value){return value&&typeof value==='object'&&!Array.isArray(value)?value:{};}
export function loadAnnaState(){let psyche={},memory={};try{psyche=object(JSON.parse(localStorage.getItem('nocturne.anna.psyche.v056')||'{}'));}catch{}try{memory=object(JSON.parse(localStorage.getItem('nocturne.anna.memory.v057')||'{}'));}catch{}return{psyche,memory};}
export function livePermission(){
  const{psyche}=loadAnnaState(),r=object(psyche.relationship),m=object(psyche.mood),test=liveTestState();
  const willingness=clamp(r.willingness??0),normalAllowed=willingness>=.52;
  return{allowed:test.requested?test.active:normalAllowed,normalAllowed,testMode:test.active,willingness,irritation:clamp(m.irritation),heat:clamp(r.heat),trust:clamp(r.trust),comfort:clamp(r.comfort)};
}
export function directorBias(){const s=livePermission();return{initiative:clamp(.28+s.willingness*.48-s.irritation*.3),intensityCeiling:clamp(.35+s.willingness*.45+s.heat*.2),hapticScale:testOutputSuppressed()?0:clamp(.35+s.comfort*.3+s.willingness*.35),allowed:s.allowed,testMode:s.testMode};}
export function publishBridge(telemetry={}){const b={...directorBias(),telemetry,at:Date.now()};if(!testOutputSuppressed())localStorage.setItem('nocturne.live.bridge.v059',JSON.stringify(b));return b;}
/** Deterministic controls-only commands; no provider, persona or relationship writes. */
export function testControlCommand(text,telemetry={}){
  const t=String(text||'').trim().toLowerCase().replace(/[.!]+$/,'');
  const out={...telemetry};let key=null,delta=0;
  if(/^(go )?faster$/.test(t)){key='pace';delta=.05;}
  else if(/^(go )?slower$/.test(t)){key='pace';delta=-.05;}
  else if(/^(more|increase intensity)$/.test(t)){key='intensity';delta=.05;}
  else if(/^(ease|ease the intensity|reduce intensity)$/.test(t)){key='intensity';delta=-.05;}
  if(key){out[key]=clamp(clamp(out[key])+delta);return{telemetry:out,changed:true,message:'Test '+(key==='pace'?'speed setting':'energy setting')+': '+Math.round(out[key]*100)+'%. Use Start Live to run; Hold to pause.'};}
  return{telemetry:out,changed:false,message:'Controls-only test. Use Start Live, Hold, Advanced and pattern buttons. Anna chat remains available here; Test Mode only intercepts deterministic control commands.'};
}
export function installLiveTestMode(live){
  if(typeof document==='undefined'||!liveTestState().available||document.getElementById('live-test-controls'))return;
  const $=id=>document.getElementById(id),anchor=$('live-state')||$('control-rail');if(!anchor)return;
  const panel=document.createElement('section');panel.id='live-test-controls';panel.setAttribute('aria-label','Staging Live controls test');
  panel.style.cssText='position:relative;z-index:3;margin:12px 0;padding:14px;border:1px solid #755497;border-radius:16px;background:#140d20;color:#eee5f6;text-align:left';
  const title=document.createElement('strong');title.textContent='LIVE CONTROLS TEST';title.style.cssText='display:block;font:600 12px system-ui;letter-spacing:.08em';
  const detail=document.createElement('p');detail.style.cssText='font:12px/1.5 system-ui;margin:8px 0 12px';detail.setAttribute('role','status');
  const toggle=document.createElement('button');toggle.type='button';toggle.id='live-test-toggle';toggle.style.cssText='min-height:44px;padding:10px 14px;font:600 14px system-ui;border:1px solid #b58aee;border-radius:12px;background:#30203f;color:white';
  const home=document.createElement('a');home.href='/';home.textContent='Back to Home';home.style.cssText='display:inline-block;margin-left:14px;color:#d5b8f5;font:13px system-ui';
  panel.append(title,detail,toggle,home);anchor.after(panel);
  const line=text=>{if($('last-line'))$('last-line').textContent=text;};
  const halt=()=>{if(live.running)$('live-start')?.click();live.running=false;try{navigator.vibrate?.(0);}catch{}};
  let wasActive=isLiveTestMode();
  function render(){const s=liveTestState();toggle.textContent=s.requested?'Exit Test Mode':'Enable Test Mode';toggle.setAttribute('aria-pressed',String(s.active));detail.textContent=s.active?'TEST MODE ON · Relationship lock bypassed for this preview only. Anna’s saved state is unchanged. Physical hardware output is off; Anna chat and Autopilot remain available. Start remains manual.':s.requested?'Test expired or unavailable. Motion is paused. Exit Test Mode, then enable it again to continue.':'Test the Live controls without building relationship scores first. Test Mode does not alter Anna or start motion automatically.';panel.dataset.active=String(s.active);}
  function change(){
    if($('send')?.disabled){line('Wait for the current request to finish before changing test mode.');return;}
    halt();const enable=!liveTestState().requested;
    if(!setLiveTestMode(enable)){line('Test Mode could not be saved in this browser tab. No relationship data was changed.');return;}
    if(enable&&$('auto-mode')?.textContent?.includes('AUTO ON'))$('auto-mode').click();
    if(enable&&$('setup')?.open)$('setup').close();
    wasActive=isLiveTestMode();render();
    line(enable?'Controls test ready. Tap Start Live. Anna’s relationship state has not been changed.':'Test Mode off. Live is paused; normal relationship rules are restored.');
  }
  toggle.addEventListener('click',change);
  $('live-start')?.addEventListener('click',()=>queueMicrotask(()=>{if(isLiveTestMode())line(live.running?'Live controls test running. Hardware output is off; Anna chat remains available.':'Live controls test paused. Use Start Live to resume.');}));
  const setupForm=$('setup')?.querySelector('form');
  if(setupForm){const entry=document.createElement('button');entry.type='button';entry.id='setup-controls-test';entry.textContent='Use Live controls test';entry.style.cssText=toggle.style.cssText;entry.style.marginTop='12px';entry.addEventListener('click',()=>{if(isLiveTestMode())$('setup').close();else change();});setupForm.prepend(entry);}
  function localCommand(text){
    if(!isLiveTestMode()){halt();line('Controls test expired. Exit and enable Test Mode again.');return;}
    const out=testControlCommand(text,live.telemetry);Object.assign(live.telemetry,out.telemetry);
    for(const[id,key]of[['wr-pace','pace'],['wr-depth','depth'],['wr-force','force'],['wr-energy','intensity']])if($(id))$(id).textContent=String(Math.round(clamp(live.telemetry[key])*100));
    line(out.message);try{window.dispatchEvent(new CustomEvent('nocturne:local-command',{detail:{text:String(text||''),telemetry:{...live.telemetry}}}))}catch{}if($('message'))$('message').value='';
  }
  function intercept(e){
    if(!testOutputSuppressed())return;
    const target=e.target?.closest?.('[data-command],#change');if(!target)return;
    e.preventDefault();e.stopImmediatePropagation();
    localCommand(target.dataset.command||($('message')?.value||''));
  }
  document.addEventListener('click',intercept,{capture:true});
  document.addEventListener('touchend',intercept,{capture:true,passive:false});
  
  if(wasActive){halt();if($('setup')?.open)$('setup').close();line('Controls test restored, paused. Tap Start Live when ready.');}
  render();
  const timer=setInterval(()=>{const active=isLiveTestMode();if(wasActive&&!active)halt();wasActive=active;render();},1000);
  window.addEventListener('pagehide',()=>{halt();clearInterval(timer);},{once:true});
}
