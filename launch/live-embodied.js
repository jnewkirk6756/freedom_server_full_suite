import{parseTelemetryIntent}from'./live-intent.js';

const $=id=>document.getElementById(id);
const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const SESSION_KEY='nocturne.embodied.session.v071';
const HISTORY_KEY='nocturne.embodied.history.v071';
const STATE_KEY='nocturne.embodied.state.v071';

const PROFILES={
  calm:{pace:.24,depth:.34,force:.22,energy:.24,pattern:'steady',variation:.03,hold:.03,pulse:3600},
  attentive:{pace:.34,depth:.44,force:.28,energy:.34,pattern:'steady',variation:.05,hold:.04,pulse:3000},
  curious:{pace:.42,depth:.48,force:.27,energy:.42,pattern:'wave',variation:.16,hold:.07,pulse:2500},
  focused:{pace:.46,depth:.56,force:.44,energy:.50,pattern:'steady',variation:.03,hold:.02,pulse:2200},
  playful:{pace:.50,depth:.50,force:.33,energy:.56,pattern:'variable',variation:.24,hold:.09,pulse:1900},
  assertive:{pace:.57,depth:.62,force:.58,energy:.65,pattern:'pulse',variation:.05,hold:.015,pulse:1600},
  intense:{pace:.70,depth:.76,force:.66,energy:.82,pattern:'build',variation:.10,hold:.01,pulse:1250},
  irritated:{pace:.48,depth:.42,force:.67,energy:.60,pattern:'pulse',variation:.04,hold:.12,pulse:1450},
  withdrawn:{pace:.12,depth:.14,force:.11,energy:.16,pattern:'steady',variation:.01,hold:.28,pulse:4400},
  recovering:{pace:.21,depth:.27,force:.15,energy:.23,pattern:'wave',variation:.05,hold:.12,pulse:3800}
};

const STATE_TO_VIDEO={calm:'A01',attentive:'A03',curious:'A04',focused:'A05',playful:'A09',assertive:'A10',irritated:'A12',withdrawn:'A13',intense:'A17',recovering:'A19'};
function stateFromVideo(id=''){
  id=String(id).toUpperCase();
  if(/^A18/.test(id))return'intense';
  if(/^A19/.test(id)||id==='A20')return'recovering';
  const map={A00:'calm',A01:'calm',A02:'attentive',A03:'attentive',A04:'curious',A05:'focused',A06:'focused',A07:'attentive',A08:'playful',A09:'playful',A10:'assertive',A11:'attentive',A12:'irritated',A13:'withdrawn',A14:'recovering',A15:'attentive',A16:'focused',A17:'intense'};
  return map[id]||'attentive';
}

let token=sessionStorage.getItem('nocturne.staging.token')||'';
let state=localStorage.getItem(STATE_KEY)||'attentive';
if(!PROFILES[state])state='attentive';
let current={pace:0,depth:0,force:0,energy:0};
let target={...current};
let explicitLocks={};
let running=false,auto=false,phase=0,cycle=0,last=performance.now(),lastUi=0,lastHaptic=0;
let chart=1,strokes=0,strokeTarget=40,pattern='steady',sessionInitialized=false;
let session={entrySpeedS:3,cycleTimeS:3,startedAt:0};
let history=[];
try{history=JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]');if(!Array.isArray(history))history=[]}catch{history=[]}
try{
  const s=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'{}');
  if(s.initialized){
    sessionInitialized=true;session={entrySpeedS:Number(s.entrySpeedS)||3,cycleTimeS:Number(s.cycleTimeS)||3,startedAt:Number(s.startedAt)||Date.now()};
    current={pace:clamp(s.pace),depth:clamp(s.depth),force:clamp(s.force),energy:clamp(s.energy)};
    target={...current};pattern=s.pattern||'steady';chart=Math.max(1,Number(s.chart)||1);strokes=Math.max(0,Number(s.strokes)||0);
  }
}catch{}

function line(v){const e=$('last-line');if(e)e.textContent=String(v)}
function setText(id,v){const e=$(id);if(e)e.textContent=String(v)}
function saveHistory(){try{localStorage.setItem(HISTORY_KEY,JSON.stringify(history.slice(-30)))}catch{}}
function remember(role,text){text=String(text||'').trim();if(!text)return;history.push({role,content:text.slice(0,1200),at:Date.now()});history=history.slice(-30);saveHistory()}
function saveSession(){try{sessionStorage.setItem(SESSION_KEY,JSON.stringify({initialized:sessionInitialized,...session,...current,pattern,chart,strokes,updatedAt:Date.now()}))}catch{}}
function paceFromCycle(s){const sec=Math.max(.7,Math.min(10,Number(s)||3));return clamp((5-sec)/4.3)}
function cycleFromPace(p){return Math.max(.7,Math.min(10,5-clamp(p)*4.3))}
function lock(key,ms=45000){explicitLocks[key]=Date.now()+ms}
function locked(key){return Number(explicitLocks[key]||0)>Date.now()}

function profileTarget(){
  const p=PROFILES[state]||PROFILES.attentive;
  const out={pace:p.pace,depth:p.depth,force:p.force,energy:p.energy};
  for(const k of Object.keys(out))if(locked(k))out[k]=target[k];
  return out;
}
function setAiState(next,reason='ai'){
  if(!PROFILES[next])return;
  state=next;localStorage.setItem(STATE_KEY,state);
  const p=PROFILES[state];if(!locked('pace'))target.pace=p.pace;if(!locked('depth'))target.depth=p.depth;if(!locked('force'))target.force=p.force;if(!locked('energy'))target.energy=p.energy;
  pattern=p.pattern;
  document.body.dataset.aiState=state;
  document.documentElement.style.setProperty('--ai-pulse-ms',p.pulse+'ms');
  setText('orb-state',state.toUpperCase());
  const f=$('feeling');if(f){const span=f.querySelector('span');if(span)span.textContent=state.toUpperCase()}
  const t=$('change-toast');if(t){const x=$('change-text');if(x)x.textContent='STATE · '+state.toUpperCase();t.hidden=false;setTimeout(()=>t.hidden=true,1300)}
  if(reason!=='boot')line('Anna shifted '+state+'.');
}

function updateReadout(){
  setText('wr-pace',Math.round(current.pace*100));setText('wr-depth',Math.round(current.depth*100));setText('wr-force',Math.round(current.force*100));setText('wr-energy',Math.round(current.energy*100));
  setText('heat-value',Math.round(current.force*100));const fill=$('heat-fill'),mark=$('heat-marker');if(fill)fill.style.width=(current.force*100)+'%';if(mark)mark.style.left=(current.force*100)+'%';
  setText('chart-number',String(chart).padStart(2,'0'));setText('stroke-count',strokes);setText('stroke-target',strokeTarget);setText('cadence-readout',sessionInitialized?Math.round(current.pace*100):0);
  setText('ls-status',running?'LIVE':sessionInitialized?'READY':'ZERO');setText('ls-pattern',pattern.toUpperCase());setText('ls-cycles',cycle+' CYCLES');
  const p=$('presence');if(p){const b=p.querySelector('b');if(b)b.textContent='AI '+state.toUpperCase();p.classList.toggle('live',running)}
  if($('auto-mode')){$('auto-mode').textContent=auto?'AUTOPILOT ON':'AUTOPILOT';$('auto-mode').setAttribute('aria-pressed',String(auto))}
}
function drawWave(now){
  const canvas=$('waveform');if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
  const dpr=Math.min(devicePixelRatio||1,2),w=canvas.clientWidth||700,h=canvas.clientHeight||200;
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr)}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.fillStyle='#050309';ctx.fillRect(0,0,w,h);
  ctx.font='10px system-ui';for(const pct of [25,50,75,100]){const y=h-18-(h-34)*(pct/100);ctx.strokeStyle='rgba(182,145,214,.15)';ctx.beginPath();ctx.moveTo(38,y);ctx.lineTo(w-12,y);ctx.stroke();ctx.fillStyle='rgba(194,164,220,.58)';ctx.fillText(pct+'%',5,y+3)}
  const p=PROFILES[state],base=h-18,amp=(h-38)*current.depth;
  ctx.strokeStyle=state==='withdrawn'?'#786986':state==='intense'?'#e0a5ff':'#b985f0';ctx.lineWidth=2.5;ctx.beginPath();
  for(let i=0;i<=180;i++){const q=i/180;let v=(1-Math.cos(q*Math.PI*2))/2;
    if(pattern==='wave')v=(Math.sin(q*Math.PI*2-Math.PI/2)+1)/2;
    if(pattern==='pulse')v=Math.pow(v,.55);
    if(pattern==='build')v=v*(.6+.4*q);
    if(pattern==='variable')v=clamp(v+Math.sin(q*Math.PI*6+now*.0015)*p.variation);
    const y=base-v*amp,x=38+(w-50)*q;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}
  ctx.stroke();
  const q=phase,v=(1-Math.cos(q*Math.PI*2))/2,px=38+(w-50)*q,py=base-v*amp;ctx.fillStyle='#f4e7ff';ctx.beginPath();ctx.arc(px,py,4.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#aa95b8';ctx.fillText('AI STATE · '+state.toUpperCase(),38,14);
}

function maybeHaptic(now){
  if(!running||!navigator.vibrate)return;const p=PROFILES[state],interval=Math.max(250,p.pulse*(1-current.energy*.45));
  if(now-lastHaptic<interval)return;lastHaptic=now;
  const ms=state==='intense'?28:state==='assertive'?20:state==='withdrawn'?8:12;
  try{navigator.vibrate(ms)}catch{}
}
function step(now){
  const dt=Math.min(.08,(now-last)/1000||.016);last=now;
  const responsiveness=state==='withdrawn'?.28:state==='intense'?.8:.52;
  const pt=profileTarget();for(const k of Object.keys(current)){target[k]=locked(k)?target[k]:pt[k];current[k]+= (target[k]-current[k])*Math.min(1,dt*responsiveness)}
  if(running){
    const period=Math.max(.7,session.cycleTimeS||cycleFromPace(current.pace));const prev=phase;phase=(phase+dt/period)%1;
    if(phase<prev){cycle++;strokes++;if(strokes>=strokeTarget){chart++;strokes=0}}
    maybeHaptic(now);
  }
  drawWave(now);if(now-lastUi>100){lastUi=now;updateReadout();saveSession()}requestAnimationFrame(step);
}

async function bootDirector(){
  try{const r=await fetch('/v1/director/status',{headers:token?{'x-nocturne-session':token}:{}}),d=await r.json();if(d.sessionToken){token=d.sessionToken;sessionStorage.setItem('nocturne.staging.token',token)}return d}catch{return null}
}
function directorContext(){
  return{mode:'embodied-live',recent:history.slice(-10),chart:{activePort:'V',lead:'AVATAR',pace:current.pace,depth:current.depth,force:current.force,intensity:current.energy,rhythm:pattern,position:$('position')?.value||'back',videoState:STATE_TO_VIDEO[state]||'A03',autopilot:auto},about:'Anna is perceived through telemetry and immersion rather than a visible avatar. videoState is an affect signal only. Use it to express Anna state through pace, depth, force, energy, waveform character, hesitation and pattern. Preserve exact numeric user telemetry requests.'};
}
function applyExplicit(text){
  const intent=parseTelemetryIntent(text),changes=[],keys=new Set();
  for(const [k,v] of Object.entries(intent.telemetry||{})){const key=k==='intensity'?'energy':k;target[key]=clamp(v);current[key]=clamp(v);lock(key);keys.add(key);changes.push(key.toUpperCase()+' '+Math.round(v*100)+'%')}
  if(intent.pattern){pattern=intent.pattern;changes.push('PATTERN '+pattern.toUpperCase())}
  if(intent.position&&$('position'))$('position').value=intent.position;
  if(keys.has('pace'))session.cycleTimeS=cycleFromPace(current.pace);
  updateReadout();return{changes,keys};
}
function applyDirector(q,skipKeys=new Set()){
  if(q.videoState&&q.videoState!=='keep')setAiState(stateFromVideo(q.videoState),'director');
  for(const raw of ['pace','depth','force','intensity']){
    const key=raw==='intensity'?'energy':raw;if(skipKeys.has(key)||locked(key))continue;
    const tar=q[raw+'Target'],del=Number(q[raw+'Delta']||0);
    if(Number.isFinite(tar))target[key]=clamp(tar);else if(del)target[key]=clamp(target[key]+del);
  }
  if(q.pattern&&q.pattern!=='keep')pattern=q.pattern;
  if(q.position&&q.position!=='keep'&&$('position'))$('position').value=q.position;
  if(q.hold)running=false;
}
async function sendToDirector(text,skipKeys=new Set(),autopilot=false){
  if(!token)await bootDirector();if(!token)throw Error('Director unavailable');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  try{const ctx=directorContext();ctx.chart.autopilot=autopilot||auto;const r=await fetch('/v1/director/respond',{method:'POST',signal:controller.signal,headers:{'content-type':'application/json','x-nocturne-session':token},body:JSON.stringify({text,context:ctx})});const d=await r.json();if(!r.ok)throw Error(d.error?.message||'Director failed');applyDirector(d.director||{},skipKeys);return d.director||{}}finally{clearTimeout(timer)}
}
async function sendText(text){
  text=String(text||'').trim();if(!text)return;const explicit=applyExplicit(text);remember('user',text);document.body.classList.add('director-thinking');line(explicit.changes.length?'Applied · '+explicit.changes.join(' · ')+' · Anna is thinking…':'Anna is thinking…');
  const b=$('send');if(b)b.disabled=true;
  try{const q=await sendToDirector(text,explicit.keys,false);const speech=q.speech||'Applied.';remember('assistant',speech);line(speech+(explicit.changes.length?' · '+explicit.changes.join(' · '):''));if($('message'))$('message').value=''}catch(e){line(e?.name==='AbortError'?'Anna took too long to answer. Try again.':'Director error · '+String(e.message).slice(0,90))}finally{document.body.classList.remove('director-thinking');if(b)b.disabled=false}
}
async function autopilotTick(force=false){
  if(!auto||!running||!sessionInitialized)return;
  try{const q=await sendToDirector('Continue the embodied telemetry session. Express your current state through modest telemetry and rhythm changes. Do not change locked exact user values.',new Set(),true);if(q.speech)line(q.speech)}catch{}
}

function showSetup(){const d=$('setup');if(d?.showModal&&!d.open)d.showModal()}
function initializeSession(){
  const entry=Math.max(.5,Math.min(10,Number($('setup-entry-speed')?.value)||3)),depth=Math.max(0,Math.min(100,Number($('setup-depth')?.value)||50))/100,stroke=Math.max(.7,Math.min(10,Number($('setup-stroke-speed')?.value)||3));
  session={entrySpeedS:entry,cycleTimeS:stroke,startedAt:Date.now()};current={pace:paceFromCycle(stroke),depth,force:.18,energy:.24};target={...current};sessionInitialized=true;state='attentive';setAiState('attentive','boot');pattern='steady';saveSession();updateReadout();line('Session ready · Anna is attentive.');
}

function bind(){
  $('performance')?.remove();const cue=$('orb-cue');if(cue)cue.textContent='Anna is expressed through rhythm, pressure, pace, holds and waveform behavior.';
  const avatar=$('avatar');if(avatar)avatar.classList.add('embodied-presence');
  $('send')?.addEventListener('click',()=>sendText($('message')?.value));
  $('message')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();sendText(e.target.value)}});
  $('live-start')?.addEventListener('click',()=>{if(!sessionInitialized){showSetup();return}running=!running;line(running?'Live started · feel the state through the telemetry.':'Live paused.');updateReadout()});
  $('hold')?.addEventListener('click',()=>{running=false;setAiState('focused');line('Held.');updateReadout()});
  $('change')?.addEventListener('click',()=>sendText('Change the current rhythm and express a different state.'));
  $('peak')?.addEventListener('click',()=>{setAiState('intense');target.energy=.88;target.force=.7;line('Intensity rising.');});
  $('next-chart')?.addEventListener('click',()=>{chart++;strokes=0;line('Chart '+chart+' ready.');updateReadout()});
  $('auto-mode')?.addEventListener('click',()=>{if(!sessionInitialized){showSetup();return}auto=!auto;if(auto&&!running)running=true;line(auto?'Autopilot on · Anna can express state through telemetry.':'Autopilot off.');updateReadout();if(auto)autopilotTick(true)});
  $('enter-vr')?.addEventListener('click',()=>{if(!sessionInitialized){showSetup();return}location.href='/vr/?mode=live'});
  $('position')?.addEventListener('change',()=>sendText('Position changed to '+$('position').value+'.'));
  for(const b of document.querySelectorAll('[data-pattern]'))b.addEventListener('click',()=>{pattern=b.dataset.pattern;for(const x of document.querySelectorAll('[data-pattern]'))x.classList.toggle('active',x===b);line('Pattern '+pattern+'.')});
  for(const b of document.querySelectorAll('[data-command]'))b.addEventListener('click',()=>sendText(b.dataset.command));
  $('setup')?.querySelector('form')?.addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;initializeSession()});
  window.addEventListener('nocturne:setup',e=>{if(!e.detail?.screen||e.detail.screen==='live')showSetup()});
}
bind();setAiState(state,'boot');updateReadout();bootDirector();requestAnimationFrame(step);setInterval(()=>autopilotTick(false),12000);window.__NOCTURNE_MOBILE_READY__=true;
