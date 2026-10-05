(function(){
'use strict';
var active=false,token='',autopilot=false,timer=0,currentVideo='A01';
var state={initialized:false,pace:0,depth:0,force:0,intensity:0,entrySpeedS:3,cycleTimeS:3,pattern:'steady',cadence:0,startedAt:0};
function $(id){return document.getElementById(id)}
function clamp(v){v=Number(v)||0;return Math.max(0,Math.min(1,v))}
function text(id,v){var e=$(id);if(e)e.textContent=String(v)}
function line(v){text('vr-line',v);text('diag-line',v)}
function paceFromCycle(sec){sec=Math.max(.7,Math.min(10,Number(sec)||3));return clamp((5-sec)/4.3)}
function restore(){
  try{var s=JSON.parse(sessionStorage.getItem('nocturne.vr.session.v070')||'{}');if(s&&s.initialized){state.initialized=true;state.pace=clamp(s.pace);state.depth=clamp(s.depth);state.force=clamp(s.force);state.intensity=clamp(s.intensity);state.entrySpeedS=Number(s.entrySpeedS)||3;state.cycleTimeS=Number(s.cycleTimeS)||3;state.pattern=s.pattern||'steady';state.cadence=Number(s.cadence)||Math.round(state.pace*100);state.startedAt=Number(s.startedAt)||Date.now()}}catch(e){}
  sync();
}
function save(){
  try{sessionStorage.setItem('nocturne.vr.session.v070',JSON.stringify(state))}catch(e){}
  try{localStorage.setItem('nocturne.telemetry.v1',JSON.stringify({pace:state.pace,depth:state.depth,force:state.force,intensity:state.intensity,pattern:state.pattern,cadence:state.cadence,updatedAt:Date.now()}))}catch(e){}
}
function sync(){
  text('pace',state.initialized?Math.round(state.pace*100):0);text('depth',state.initialized?Math.round(state.depth*100):0);
  text('force',state.initialized?Math.round(state.force*100):0);text('energy',state.initialized?Math.round(state.intensity*100):0);
  text('diag-session',state.initialized?'READY':'ZERO');text('vr-video-state',currentVideo);
}
function openSetup(){var d=$('vr-session-dialog');if(d){try{if(!d.open)d.showModal()}catch(e){d.setAttribute('open','')}}}
function commit(){
  var entry=Math.max(.5,Math.min(10,Number($('vr-entry-speed')&&$('vr-entry-speed').value)||3));
  var depth=Math.max(0,Math.min(100,Number($('vr-start-depth')&&$('vr-start-depth').value)||50))/100;
  var cycle=Math.max(.7,Math.min(10,Number($('vr-stroke-speed')&&$('vr-stroke-speed').value)||3));
  state={initialized:true,pace:paceFromCycle(cycle),depth:depth,force:0,intensity:.2,entrySpeedS:entry,cycleTimeS:cycle,pattern:'steady',cadence:Math.round(paceFromCycle(cycle)*100),startedAt:Date.now()};
  save();sync();line('Session initialized · entry '+entry.toFixed(1)+'s · depth '+Math.round(depth*100)+'% · stroke '+cycle.toFixed(1)+'s.');
  try{window.dispatchEvent(new CustomEvent('nocturne:vr-session-configured',{detail:state}))}catch(e){}
}
function getToken(){
  if(token)return Promise.resolve(token);
  return fetch('/v1/director/status').then(function(r){return r.json()}).then(function(d){token=d.sessionToken||'';return token});
}
function applyDirector(q){
  if(Number.isFinite(q.paceTarget))state.pace=clamp(q.paceTarget);
  else if(Number(q.paceDelta))state.pace=clamp(state.pace+Number(q.paceDelta));
  if(Number.isFinite(q.depthTarget))state.depth=clamp(q.depthTarget);
  else if(Number(q.depthDelta))state.depth=clamp(state.depth+Number(q.depthDelta));
  if(Number.isFinite(q.forceTarget))state.force=clamp(q.forceTarget);
  else if(Number(q.forceDelta))state.force=clamp(state.force+Number(q.forceDelta));
  if(Number.isFinite(q.intensityTarget))state.intensity=clamp(q.intensityTarget);
  else if(Number(q.intensityDelta))state.intensity=clamp(state.intensity+Number(q.intensityDelta));
  if(q.pattern&&q.pattern!=='keep')state.pattern=q.pattern;
  state.cycleTimeS=Math.max(.7,Math.min(10,5-state.pace*4.3));state.cadence=Math.round(state.pace*100);
  if(q.videoState&&q.videoState!=='keep'){currentVideo=String(q.videoState);try{localStorage.setItem('nocturne.vr.video-state.v1',currentVideo)}catch(e){}try{window.dispatchEvent(new CustomEvent('nocturne:vr-video-state',{detail:{id:currentVideo,reason:'compat'}}))}catch(e){}}
  save();sync();
}
function director(prompt){
  if(!state.initialized){openSetup();line('Initialize the session first.');return Promise.resolve()}
  line('Anna is thinking…');
  return getToken().then(function(t){return fetch('/v1/director/respond',{method:'POST',headers:{'content-type':'application/json','x-nocturne-session':t},body:JSON.stringify({text:prompt,context:{mode:'vr-live',chart:{pace:state.pace,depth:state.depth,force:state.force,intensity:state.intensity,rhythm:state.pattern,videoState:currentVideo,autopilot:autopilot},about:'Nocturne VR compatibility runtime. Choose one coherent available Anna visual state and preserve current context.'}})})})
  .then(function(r){return r.json()}).then(function(d){var q=d.director||{};applyDirector(q);line(q.speech||'Applied.')}).catch(function(e){line('VR chat error · '+String(e&&e.message||e).slice(0,80))});
}
function autoTick(){if(!autopilot||!state.initialized)return;director('Continue the immersive experience. Make one coherent modest adjustment and choose the best visual state.')}
function bind(){
  var setup=$('session-setup');if(setup)setup.addEventListener('click',openSetup);
  var form=$('vr-session-form');if(form)form.addEventListener('submit',function(e){if(e.submitter&&e.submitter.value==='cancel')return;commit()});
  var send=$('vr-send'),input=$('vr-message');if(send)send.addEventListener('click',function(){director(input&&input.value||'').then(function(){if(input)input.value=''})});
  if(input)input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();director(input.value).then(function(){input.value=''})}});
  var auto=$('vr-auto');if(auto)auto.addEventListener('click',function(){if(!state.initialized){openSetup();return}autopilot=!autopilot;auto.textContent=autopilot?'AUTOPILOT ON':'AUTOPILOT OFF';auto.setAttribute('aria-pressed',String(autopilot));try{localStorage.setItem('nocturne.vr.autopilot.v1',autopilot?'on':'off')}catch(e){}if(autopilot)autoTick()});
}
function activate(reason){
  if(active||window.__NOCTURNE_VR_MODULE_READY__)return;active=true;window.__NOCTURNE_VR_MODULE_READY__='compat';restore();bind();clearInterval(timer);timer=setInterval(autoTick,12000);
  line('VR compatibility runtime active · '+(reason||'full module unavailable')+'.');
  if(!state.initialized)setTimeout(openSetup,250);
}
window.__NOCTURNE_ACTIVATE_VR_RECOVERY__=activate;
window.addEventListener('error',function(e){if(!window.__NOCTURNE_VR_MODULE_READY__)activate((e&&e.message)||'runtime error')});
window.addEventListener('unhandledrejection',function(e){if(!window.__NOCTURNE_VR_MODULE_READY__)activate((e&&e.reason&&e.reason.message)||'promise error')});
document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){if(!window.__NOCTURNE_VR_MODULE_READY__)activate('startup timeout')},1800)});
})();