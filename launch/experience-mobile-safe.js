(function(){
'use strict';
var $=function(id){return document.getElementById(id)}, clamp=function(v){v=Number(v)||0;return Math.max(0,Math.min(1,v))};
var SESSION_KEY='nocturne.mobile.session.v0702', TOKEN_KEY='nocturne.staging.token';
var state={running:false,initialized:false,pace:0,depth:0,force:0,intensity:0,entrySpeedS:3,cycleTimeS:3,pattern:'steady',phase:0,cycle:0,chart:1,strokes:0,target:40,auto:false,videoState:'A01',startedAt:0,lastTs:0};
var token=sessionStorage.getItem(TOKEN_KEY)||'', videoUrl='', autoTimer=0, directorBusy=false, lastAuto=0;

function line(t){var e=$('last-line');if(e)e.textContent=String(t||'')}
function status(t,on){var e=$('presence');if(!e)return;var b=e.querySelector('b');if(b)b.textContent=t;e.classList.toggle('live',!!on)}
function save(){
  try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(state));localStorage.setItem('nocturne.telemetry.v1',JSON.stringify({pace:state.pace,depth:state.depth,force:state.force,intensity:state.intensity,pattern:state.pattern,cadence:Math.round(state.pace*100),videoState:state.videoState,updatedAt:Date.now()}))}catch(e){}
}
function restore(){
  try{var s=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(s&&s.initialized){Object.assign(state,s);state.running=false;state.lastTs=0}}catch(e){}
}
function paceFromCycle(sec){sec=Math.max(.7,Math.min(10,Number(sec)||3));return clamp((5-sec)/4.3)}
function sync(){
  var vals={ 'wr-pace':state.pace,'wr-depth':state.depth,'wr-force':state.force,'wr-energy':state.intensity };
  Object.keys(vals).forEach(function(id){var e=$(id);if(e)e.textContent=Math.round(vals[id]*100)});
  var h=$('heat-value');if(h)h.textContent=Math.round(state.force*100);
  var hf=$('heat-fill');if(hf)hf.style.width=(state.force*100)+'%';
  var hm=$('heat-marker');if(hm)hm.style.left=(state.force*100)+'%';
  var td=$('traj-depth');if(td)td.textContent=Math.round(state.depth*100)+'%';
  var cn=$('chart-number');if(cn)cn.textContent=String(state.chart).padStart(2,'0');
  var sc=$('stroke-count');if(sc)sc.textContent=state.strokes;
  var st=$('stroke-target');if(st)st.textContent=state.target;
  var cr=$('cadence-readout');if(cr)cr.textContent=Math.round(state.pace*100);
  var ls=$('ls-status');if(ls){ls.textContent=state.running?'LIVE':state.initialized?'READY':'IDLE';ls.classList.toggle('live',state.running)}
  var lp=$('ls-pattern');if(lp)lp.textContent=state.pattern.toUpperCase();
  var lc=$('ls-cycles');if(lc)lc.textContent=state.cycle+' CYCLES';
  var ab=$('auto-mode');if(ab){ab.textContent=state.auto?'AUTOPILOT ON':'AUTOPILOT';ab.setAttribute('aria-pressed',String(state.auto))}
  var sb=$('live-start');if(sb)sb.textContent=state.running?'PAUSE LIVE':'START LIVE';
  document.querySelectorAll('[data-pattern]').forEach(function(b){b.classList.toggle('active',b.dataset.pattern===state.pattern)});
}
function showSetup(){
  var d=$('setup');if(d&&d.showModal&&!d.open)d.showModal();
}
function initializeFromSetup(){
  var entry=Math.max(.5,Math.min(10,Number($('setup-entry-speed')&&$('setup-entry-speed').value)||3));
  var depth=Math.max(0,Math.min(100,Number($('setup-depth')&&$('setup-depth').value)||50))/100;
  var cycle=Math.max(.7,Math.min(10,Number($('setup-stroke-speed')&&$('setup-stroke-speed').value)||3));
  state.entrySpeedS=entry;state.depth=depth;state.cycleTimeS=cycle;state.pace=paceFromCycle(cycle);state.force=0;state.intensity=.2;state.pattern='steady';state.phase=0;state.cycle=0;state.strokes=0;state.startedAt=0;state.initialized=true;state.running=false;
  save();sync();line('Session ready · entry '+entry.toFixed(1)+'s · depth '+Math.round(depth*100)+'% · stroke '+cycle.toFixed(1)+'s.');
}
function toggleLive(){
  if(!state.initialized){showSetup();line('Set Entry Speed, Depth and Stroke Speed first.');return}
  state.running=!state.running;if(state.running&&!state.startedAt)state.startedAt=Date.now();save();sync();line(state.running?'Live started.':'Live paused.');
}
function setPattern(p){if(['steady','wave','pulse','build','variable'].indexOf(p)<0)return;state.pattern=p;save();sync();line('Pattern · '+p.toUpperCase())}
function quick(cmd){
  if(!state.initialized){showSetup();return}
  if(cmd==='faster'){state.cycleTimeS=Math.max(.7,state.cycleTimeS-.3);state.pace=paceFromCycle(state.cycleTimeS)}
  if(cmd==='slower'){state.cycleTimeS=Math.min(10,state.cycleTimeS+.3);state.pace=paceFromCycle(state.cycleTimeS)}
  if(cmd==='more')state.intensity=clamp(state.intensity+.1);
  if(cmd==='ease')state.intensity=clamp(state.intensity-.1);
  save();sync();line(cmd.toUpperCase()+' applied.');
}
function explicitTelemetry(text){
  var t=String(text||'').toLowerCase().replace(/percent/g,'%'), changed=[];
  [['depth','depth'],['pace','(?:pace|speed)'],['force','force'],['intensity','(?:energy|intensity)']].forEach(function(spec){
    var re=new RegExp('(?:set|make|put)?\\s*(?:the\\s+)?'+spec[1]+'\\s*(?:at|to|=|of)?\\s*(\\d{1,3})\\s*%?');
    var m=t.match(re);if(!m)return;var v=Math.max(0,Math.min(100,Number(m[1])))/100;state[spec[0]]=v;if(spec[0]==='pace')state.cycleTimeS=Math.max(.7,Math.min(10,5-v*4.3));changed.push(spec[0]+' '+Math.round(v*100)+'%');
  });
  var pm=t.match(/(?:use|switch to|change to|set)\s+(?:the\s+)?(steady|wave|pulse|build|variable)/);if(pm){state.pattern=pm[1];changed.push('pattern '+pm[1])}
  if(changed.length){state.initialized=true;save();sync()}
  return changed;
}
async function bootDirector(){
  try{var r=await fetch('/v1/director/status',{headers:token?{'x-nocturne-session':token}:{}}),d=await r.json();if(d.sessionToken){token=d.sessionToken;sessionStorage.setItem(TOKEN_KEY,token)}status(d.openAIConfigured?'AI LIVE':'FALLBACK',true);return d}catch(e){status('OFFLINE');return null}
}
async function loadVideo(id){
  id=String(id||'A01').toUpperCase();if(!/^A(?:0[0-9]|1[0-9]|20)(?:[A-Z])?$/.test(id))id='A01';
  var v=$('performance');if(!v)return false;
  var os=$('orb-state'),empty=$('empty'),cue=$('orb-cue'),requested=id;
  if(os)os.textContent=id+' · LOADING';if(cue)cue.textContent='Loading Anna from the server…';
  return await new Promise(function(resolve){
    var settled=false,timer=setTimeout(function(){if(settled)return;settled=true;if(requested!=='A01'){loadVideo('A01').then(resolve);return}if(os)os.textContent='A01 · VIDEO ERROR';if(cue)cue.textContent='Anna media did not decode in this browser.';resolve(false)},10000);
    function done(ok){if(settled)return;settled=true;clearTimeout(timer);resolve(ok)}
    v.onloadeddata=function(){state.videoState=requested;v.muted=true;v.playsInline=true;v.loop=true;if(os)os.textContent=requested+' · LIVE';if(empty)empty.hidden=true;save();try{var p=v.play();if(p&&p.catch)p.catch(function(){})}catch(e){}done(true)};
    v.onerror=function(){if(requested!=='A01'){clearTimeout(timer);settled=true;loadVideo('A01').then(resolve);return}if(os)os.textContent='A01 · VIDEO ERROR';if(cue)cue.textContent='Anna media could not load.';done(false)};
    v.pause();v.removeAttribute('src');v.load();v.src='/media/'+encodeURIComponent(requested)+'.mp4?v=0706';v.load();try{var p=v.play();if(p&&p.catch)p.catch(function(){})}catch(e){}
  });
}
function applyDirector(q){
  if(!q)return;
  ['pace','depth','force','intensity'].forEach(function(k){
    var target=q[k+'Target'],delta=Number(q[k+'Delta']||0);
    if(Number.isFinite(target))state[k]=clamp(target);else if(delta)state[k]=clamp(state[k]+delta);
  });
  if(Number.isFinite(q.paceTarget)||Number(q.paceDelta||0))state.cycleTimeS=Math.max(.7,Math.min(10,5-state.pace*4.3));
  if(q.pattern&&q.pattern!=='keep')setPattern(q.pattern);
  if(q.videoState&&q.videoState!=='keep')loadVideo(q.videoState);
  if(q.hold)state.running=false;
  save();sync();
}
async function director(text,auto){
  if(directorBusy)return null;directorBusy=true;
  try{
    if(!token)await bootDirector();
    var context={mode:'live',recent:[],chart:{activePort:'V',lead:'AVATAR',pace:state.pace,depth:state.depth,force:state.force,intensity:state.intensity,rhythm:state.pattern,position:'keep',videoState:state.videoState,autopilot:!!auto,entrySpeedS:state.entrySpeedS,cycleTimeS:state.cycleTimeS},about:'Nocturne mobile Live. Apply exact numeric telemetry requests exactly. Keep continuity. Choose an available Anna video state when useful.'};
    var r=await fetch('/v1/director/respond',{method:'POST',headers:{'content-type':'application/json','x-nocturne-session':token||''},body:JSON.stringify({text:text,context:context})}),d=await r.json();if(!r.ok)throw new Error((d.error&&d.error.message)||'Director failed');applyDirector(d.director||{});return d.director||{};
  }finally{directorBusy=false}
}
async function send(){
  var input=$('message'),text=input?input.value.trim():'';if(!text)return;
  var explicit=explicitTelemetry(text);line(explicit.length?'Applied · '+explicit.join(' · ')+' · Anna is thinking…':'Message received · Anna is thinking…');
  document.body.classList.add('director-thinking');var b=$('send');if(b)b.disabled=true;
  try{var q=await director(text,false);line((q&&q.speech)||'Applied.');if(input)input.value=''}catch(e){line('Director error · '+String(e.message||e).slice(0,120))}finally{document.body.classList.remove('director-thinking');if(b)b.disabled=false}
}
function routeVr(){
  if(!state.initialized){showSetup();return}
  try{sessionStorage.setItem('nocturne.vr.session.v070',JSON.stringify({initialized:true,pace:state.pace,depth:state.depth,force:state.force,intensity:state.intensity,entrySpeedS:state.entrySpeedS,cycleTimeS:state.cycleTimeS,cadence:Math.round(state.pace*100),pattern:state.pattern,startedAt:state.startedAt||Date.now()}));localStorage.setItem('nocturne.vr.video-state.v1',state.videoState)}catch(e){}
  location.href='/vr/?mode=live';
}
function draw(ts){
  var c=$('waveform'),ctx=c&&c.getContext&&c.getContext('2d');if(ctx){
    var w=c.clientWidth||600,h=c.clientHeight||180,dpr=Math.min(window.devicePixelRatio||1,2);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(183,145,220,.17)';ctx.lineWidth=1;
    [0,.25,.5,.75,1].forEach(function(p){var y=h-(p*h);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();if(p>0){ctx.fillStyle='rgba(190,165,210,.55)';ctx.font='10px system-ui';ctx.fillText(Math.round(p*100)+'%',5,y+12)}});
    var y0=h-10,amp=(h-20)*state.depth,period=Math.max(700,state.cycleTimeS*1000),phase=state.running?(ts%period)/period:state.phase;
    if(state.running){if(!state.lastTs)state.lastTs=ts;var prev=state.phase;state.phase=(state.phase+(ts-state.lastTs)/period)%1;state.lastTs=ts;if(state.phase<prev){state.cycle++;state.strokes++;sync();}phase=state.phase}else state.lastTs=0;
    ctx.strokeStyle='#c597f1';ctx.lineWidth=3;ctx.beginPath();
    for(var i=0;i<=120;i++){var q=i/120,v=(1-Math.cos(q*Math.PI*2))/2;if(state.pattern==='pulse')v=Math.pow(v,.45);else if(state.pattern==='build')v=v*(.35+.65*q);else if(state.pattern==='variable')v=clamp(v*(.75+.25*Math.sin(q*Math.PI*6)));var x=q*w,y=y0-amp*v;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();
    var active=(1-Math.cos(phase*Math.PI*2))/2,px=phase*w,py=y0-amp*active;ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();
  }
  requestAnimationFrame(draw);
}
function bind(id,fn){var e=$(id);if(!e)return;e.addEventListener('click',function(ev){ev.preventDefault();fn(ev)});e.style.touchAction='manipulation'}
function advancedOpen(){
  var d=$('telemetry-dialog');if(!d||!d.showModal)return;
  [['ct-pace','pace'],['ct-depth','depth'],['ct-force','force'],['ct-energy','intensity']].forEach(function(x){if($(x[0]))$(x[0]).value=Math.round(state[x[1]]*100)});if($('ct-pattern'))$('ct-pattern').value=state.pattern;if($('ct-cadence'))$('ct-cadence').value=Math.round(state.pace*100);if($('ct-strokes'))$('ct-strokes').value=state.target;d.showModal();
}
function install(){
  restore();sync();status('CONNECTING');bootDirector().then(function(){loadVideo(state.videoState||'A01')});
  bind('live-start',toggleLive);bind('send',send);bind('enter-vr',routeVr);bind('hold',function(){state.running=false;sync();line('Held / paused.')});
  bind('change',function(){setPattern(state.pattern==='steady'?'wave':'steady');director('Change the current pattern.',false).catch(function(){})});
  bind('peak',function(){loadVideo('A18');line('Peak state selected.')});
  bind('next-chart',function(){state.chart++;state.strokes=0;state.phase=0;sync();save();line('Chart '+state.chart+' ready.')});
  bind('auto-mode',function(){if(!state.initialized){showSetup();return}state.auto=!state.auto;if(state.auto&&!state.running)state.running=true;sync();save();line(state.auto?'Autopilot on.':'Autopilot off.');if(state.auto)director('Continue the Live session with a coherent next adjustment.',true).catch(function(){})});
  bind('custom-telemetry',advancedOpen);
  document.querySelectorAll('[data-command]').forEach(function(b){b.onclick=function(e){e.preventDefault();var t=b.textContent.trim().toLowerCase();quick(t==='faster'?'faster':t==='slower'?'slower':t==='more'?'more':'ease')}});
  document.querySelectorAll('[data-pattern]').forEach(function(b){b.onclick=function(e){e.preventDefault();setPattern(b.dataset.pattern)}});
  if($('position'))$('position').onchange=function(){line('Position · '+$('position').selectedOptions[0].textContent)};
  var setupForm=$('setup')&&$('setup').querySelector('form');if(setupForm)setupForm.addEventListener('submit',function(e){if(e.submitter&&e.submitter.value==='cancel')return;initializeFromSetup()});
  var td=$('telemetry-dialog')&&$('telemetry-dialog').querySelector('form');if(td)td.addEventListener('submit',function(e){if(e.submitter&&e.submitter.value==='cancel')return;[['ct-pace','pace'],['ct-depth','depth'],['ct-force','force'],['ct-energy','intensity']].forEach(function(x){if($(x[0]))state[x[1]]=clamp(Number($(x[0]).value)/100)});if($('ct-pattern'))state.pattern=$('ct-pattern').value;state.initialized=true;state.cycleTimeS=Math.max(.7,Math.min(10,5-state.pace*4.3));save();sync();line('Advanced telemetry applied.')});
  if($('message'))$('message').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();send()}});
  window.addEventListener('nocturne:setup',function(){showSetup()});
  window.addEventListener('pagehide',function(){save();if(videoUrl)URL.revokeObjectURL(videoUrl)});
  autoTimer=setInterval(function(){if(state.auto&&state.running&&Date.now()-lastAuto>11000){lastAuto=Date.now();director('Continue the Live session with a coherent next adjustment.',true).catch(function(){})}},12000);
  window.__NOCTURNE_MOBILE_READY__=true;document.documentElement.dataset.liveBoot='ready';requestAnimationFrame(draw);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();