(function(){
'use strict';
var recoveryActive=false,token='',running=false,raf=0,last=0,phase=0,chart=1,autopilot=false,autoTimer=0,mediaToken='',videoUrl='';
var state={pace:0,depth:0,force:0,intensity:0,entrySpeedS:3,cycleTimeS:3,initialized:false,pattern:'steady'};
function $(id){return document.getElementById(id)}
function clamp(v){v=Number(v)||0;return Math.max(0,Math.min(1,v))}
function line(t){var e=$('last-line');if(e)e.textContent=t}
function setText(id,t){var e=$(id);if(e)e.textContent=String(t)}
function sync(){
  setText('wr-pace',Math.round(state.pace*100));setText('wr-depth',Math.round(state.depth*100));
  setText('wr-force',Math.round(state.force*100));setText('wr-energy',Math.round(state.intensity*100));
  setText('heat-value',Math.round(state.force*100));setText('cadence-readout',Math.round(state.pace*100));
  setText('chart-number',String(chart).padStart?String(chart).padStart(2,'0'):('0'+chart).slice(-2));
  var fill=$('heat-fill'),mark=$('heat-marker');if(fill)fill.style.width=(state.force*100)+'%';if(mark)mark.style.left=(state.force*100)+'%';
  var status=$('ls-status');if(status){status.textContent=running?'LIVE':state.initialized?'READY':'IDLE';status.className=running?'live':''}
}
function save(){
  try{sessionStorage.setItem('nocturne.mobile.session.v0701',JSON.stringify({
    initialized:state.initialized,entrySpeedS:state.entrySpeedS,cycleTimeS:state.cycleTimeS,
    pace:state.pace,depth:state.depth,force:state.force,intensity:state.intensity,
    cadence:Math.round(state.pace*100),pattern:state.pattern,startedAt:Date.now()
  }))}catch(e){}
  try{localStorage.setItem('nocturne.telemetry.v1',JSON.stringify({
    pace:state.pace,depth:state.depth,force:state.force,intensity:state.intensity,
    cadence:Math.round(state.pace*100),pattern:state.pattern,updatedAt:Date.now()
  }))}catch(e){}
}
function paceFromCycle(sec){sec=Math.max(.7,Math.min(10,Number(sec)||3));return clamp((5-sec)/4.3)}
function restore(){
  try{var s=JSON.parse(sessionStorage.getItem('nocturne.mobile.session.v0701')||'{}');if(s&&s.initialized){
    state.initialized=true;state.entrySpeedS=Number(s.entrySpeedS)||3;state.cycleTimeS=Number(s.cycleTimeS)||3;
    state.pace=clamp(s.pace);state.depth=clamp(s.depth);state.force=clamp(s.force);state.intensity=clamp(s.intensity);state.pattern=s.pattern||'steady';
  }}catch(e){}
  sync();
}
function openSetup(){var d=$('setup');if(d){try{if(!d.open)d.showModal()}catch(e){d.setAttribute('open','')}}}
function applySetup(){
  var entry=$('setup-entry-speed'),depth=$('setup-depth'),stroke=$('setup-stroke-speed');
  var es=Math.max(.5,Math.min(10,Number(entry&&entry.value)||3));
  var dp=Math.max(0,Math.min(100,Number(depth&&depth.value)||50))/100;
  var ss=Math.max(.7,Math.min(10,Number(stroke&&stroke.value)||3));
  state.initialized=true;state.entrySpeedS=es;state.cycleTimeS=ss;state.pace=paceFromCycle(ss);state.depth=dp;state.force=0;state.intensity=.2;state.pattern='steady';
  save();sync();line('Session ready · entry '+es.toFixed(1)+'s · depth '+Math.round(dp*100)+'% · stroke '+ss.toFixed(1)+'s.');
}
function draw(now){
  if(!recoveryActive)return;var c=$('waveform');if(c&&c.getContext){
    var rect=c.getBoundingClientRect(),dpr=Math.min(window.devicePixelRatio||1,2),w=Math.max(20,rect.width),h=Math.max(20,rect.height);
    if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
    var x=c.getContext('2d');x.setTransform(dpr,0,0,dpr,0,0);x.clearRect(0,0,w,h);x.fillStyle='#050309';x.fillRect(0,0,w,h);
    x.strokeStyle='rgba(190,145,240,.16)';x.lineWidth=1;[.25,.5,.75,1].forEach(function(p){var y=h-(p*h*.82)-8;x.beginPath();x.moveTo(20,y);x.lineTo(w-10,y);x.stroke();x.fillStyle='#826d93';x.font='10px system-ui';x.fillText(Math.round(p*100)+'%',2,y+3)});
    if(running&&state.initialized){
      var dt=Math.min(80,now-(last||now));last=now;var period=Math.max(700,state.cycleTimeS*1000);phase=(phase+dt/period)%1;
      x.strokeStyle='#c291f4';x.lineWidth=3;x.beginPath();
      for(var i=0;i<=100;i++){var q=i/100,y=h-10-((1-Math.cos(q*Math.PI*2))/2)*state.depth*(h*.8),px=20+q*(w-30);if(i)x.lineTo(px,y);else x.moveTo(px,y)}x.stroke();
      var ay=h-10-((1-Math.cos(phase*Math.PI*2))/2)*state.depth*(h*.8),ax=20+phase*(w-30);x.fillStyle='#fff';x.beginPath();x.arc(ax,ay,4,0,Math.PI*2);x.fill();
    }
  }
  raf=requestAnimationFrame(draw);
}
function startToggle(){
  if(!state.initialized){openSetup();line('Initialize Entry Speed, Depth and Stroke Speed first.');return}
  running=!running;last=0;var b=$('live-start');if(b)b.textContent=running?'PAUSE LIVE':'START LIVE';sync();line(running?'Live running in compatibility mode.':'Live paused.');
}
function setPattern(name){state.pattern=name;var all=document.querySelectorAll('[data-pattern]');for(var i=0;i<all.length;i++)all[i].classList.toggle('active',all[i].getAttribute('data-pattern')===name);setText('ls-pattern',name.toUpperCase());save()}
function localIntent(text){
  var t=String(text||'').toLowerCase(),m;
  m=t.match(/(?:depth).*?(\d{1,3})/);if(m)state.depth=clamp(Number(m[1])/100);
  m=t.match(/(?:pace|speed).*?(\d{1,3})/);if(m)state.pace=clamp(Number(m[1])/100);
  m=t.match(/force.*?(\d{1,3})/);if(m)state.force=clamp(Number(m[1])/100);
  m=t.match(/(?:energy|intensity).*?(\d{1,3})/);if(m)state.intensity=clamp(Number(m[1])/100);
  if(/faster/.test(t))state.pace=clamp(state.pace+.05);if(/slower/.test(t))state.pace=clamp(state.pace-.05);
  if(/\bmore\b|increase intensity/.test(t))state.intensity=clamp(state.intensity+.05);if(/\bease\b|reduce intensity/.test(t))state.intensity=clamp(state.intensity-.05);
  sync();save();
}
function getDirectorToken(){
  if(token)return Promise.resolve(token);
  return fetch('/v1/director/status').then(function(r){return r.json()}).then(function(d){token=d.sessionToken||'';return token});
}
function chooseVideo(id){
  id=String(id||'A01');return getMediaToken().then(function(t){return fetch('/v1/media/'+encodeURIComponent(id),{headers:{'x-nocturne-session':t}})}).then(function(r){if(!r.ok&&id!=='A01')return chooseVideo('A01');if(!r.ok)throw new Error('video');return r.blob()}).then(function(blob){
    if(videoUrl)URL.revokeObjectURL(videoUrl);videoUrl=URL.createObjectURL(blob);var v=$('performance');if(v){v.src=videoUrl;v.muted=true;v.playsInline=true;v.loop=true;v.style.display='block';return v.play().catch(function(){})}
  }).catch(function(){});
}
function getMediaToken(){
  if(mediaToken)return Promise.resolve(mediaToken);
  return fetch('/v1/media/status').then(function(r){return r.json()}).then(function(d){mediaToken=d.sessionToken||'';return mediaToken});
}
function send(text){
  text=String(text||'').trim();if(!text)return;localIntent(text);line('Message received · Anna is thinking…');var sendBtn=$('send');if(sendBtn)sendBtn.disabled=true;
  getDirectorToken().then(function(t){return fetch('/v1/director/respond',{method:'POST',headers:{'content-type':'application/json','x-nocturne-session':t},body:JSON.stringify({text:text,context:{mode:'live',chart:{pace:state.pace,depth:state.depth,force:state.force,intensity:state.intensity,rhythm:state.pattern,videoState:'A01',autopilot:autopilot}}})})})
  .then(function(r){return r.json()}).then(function(d){var q=d.director||{};if(Number.isFinite(q.paceTarget))state.pace=clamp(q.paceTarget);if(Number.isFinite(q.depthTarget))state.depth=clamp(q.depthTarget);if(Number.isFinite(q.forceTarget))state.force=clamp(q.forceTarget);if(Number.isFinite(q.intensityTarget))state.intensity=clamp(q.intensityTarget);if(q.pattern&&q.pattern!=='keep')setPattern(q.pattern);if(q.videoState&&q.videoState!=='keep')chooseVideo(q.videoState);sync();save();line(q.speech||'Applied.');var i=$('message');if(i)i.value=''})
  .catch(function(e){line('Chat error · '+String(e&&e.message||e).slice(0,80))}).then(function(){if(sendBtn)sendBtn.disabled=false});
}
function autoTick(){if(!autopilot||!running||!state.initialized)return;send('Continue the live session. Make one coherent adjustment and choose the best available visual state.')}
function bind(){
  var b=$('live-start');if(b)b.addEventListener('click',startToggle);
  var s=$('send');if(s)s.addEventListener('click',function(){send($('message')&&$('message').value)});
  var input=$('message');if(input)input.addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();send(input.value)}});
  var qs=document.querySelectorAll('[data-command]');for(var i=0;i<qs.length;i++)qs[i].addEventListener('click',function(e){e.preventDefault();send(this.getAttribute('data-command'))});
  var ps=document.querySelectorAll('[data-pattern]');for(var j=0;j<ps.length;j++)ps[j].addEventListener('click',function(e){e.preventDefault();setPattern(this.getAttribute('data-pattern'))});
  var hold=$('hold');if(hold)hold.addEventListener('click',function(){running=false;sync();line('Held / paused.');var x=$('live-start');if(x)x.textContent='START LIVE'});
  var next=$('next-chart');if(next)next.addEventListener('click',function(){chart++;phase=0;setText('chart-number',String(chart).padStart?String(chart).padStart(2,'0'):('0'+chart).slice(-2));line('Chart '+chart+' ready.')});
  var auto=$('auto-mode');if(auto)auto.addEventListener('click',function(){if(!state.initialized){openSetup();return}autopilot=!autopilot;auto.textContent=autopilot?'AUTOPILOT ON':'AUTOPILOT';auto.setAttribute('aria-pressed',String(autopilot));if(autopilot&&!running)startToggle();if(autopilot)autoTick()});
  var evr=$('enter-vr');if(evr)evr.addEventListener('click',function(){location.href='/vr/?mode=live&v=0702'});
  var setup=$('setup'),form=setup&&setup.querySelector('form');if(form)form.addEventListener('submit',function(e){if(e.submitter&&e.submitter.value==='cancel')return;applySetup()});
}
function activate(reason){
  if(recoveryActive||window.__NOCTURNE_MOBILE_READY__)return;recoveryActive=true;window.__NOCTURNE_MOBILE_READY__='compat';
  document.documentElement.dataset.liveBoot='compat';restore();bind();chooseVideo('A01');cancelAnimationFrame(raf);raf=requestAnimationFrame(draw);clearInterval(autoTimer);autoTimer=setInterval(autoTick,12000);
  line('Compatibility runtime active · '+(reason||'full runtime unavailable')+'.');
}
window.__NOCTURNE_ACTIVATE_LIVE_RECOVERY__=activate;
window.addEventListener('error',function(e){if(!window.__NOCTURNE_MOBILE_READY__)activate((e&&e.message)||'runtime error')});
window.addEventListener('unhandledrejection',function(e){if(!window.__NOCTURNE_MOBILE_READY__)activate((e&&e.reason&&e.reason.message)||'promise error')});
document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){if(!window.__NOCTURNE_MOBILE_READY__)activate('startup timeout')},1800)});
})();