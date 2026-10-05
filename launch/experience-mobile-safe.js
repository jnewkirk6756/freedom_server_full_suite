(function(){
'use strict';
var $=function(id){return document.getElementById(id)}, clamp=function(v){v=Number(v)||0;return Math.max(0,Math.min(1,v))};
var SESSION_KEY='nocturne.mobile.session.v0710', TOKEN_KEY='nocturne.staging.token';
var AVAILABLE_VIDEO_STATES=['A00','A01','A02','A05','A10','A16','A16B','A17','A17B','A18','A18B','A18C','A18D','A18E','A18F','A19B','A19C'];
var state={running:false,initialized:false,pace:0,depth:0,force:0,intensity:0,entrySpeedS:3,cycleTimeS:3,angle:0,pattern:'steady',tool:'white',phase:0,cycle:0,chart:1,strokes:0,target:40,auto:false,videoState:'A03',embodied:'attentive',position:'back',startedAt:0,lastTs:0};
var token=sessionStorage.getItem(TOKEN_KEY)||'', mediaToken=sessionStorage.getItem('nocturne.media.session.v067')||'', videoUrl='', avatarObjectUrl='', mediaManifestCache=null, mediaManifestAt=0, videoCorePromise=null, assetPackPromise=null, autoTimer=0, directorBusy=false, lastAuto=0, explicitLocks={}, lastSpokenAt=0;
var visuals={videoEnabled:localStorage.getItem('nocturne.vr.video-enabled.v1')!=='off',avatar3D:localStorage.getItem('nocturne.vr.avatar-3d.v1')==='on',voiceGuidance:localStorage.getItem('nocturne.vr.voice-guidance.v1')!=='off',toolSolid:localStorage.getItem('nocturne.vr.tool-solid.v1')!=='off',waveScale:Math.max(.5,Math.min(2,Number(localStorage.getItem('nocturne.vr.wave-scale.v1'))||1)),waveMotion:Math.max(.35,Math.min(2,Number(localStorage.getItem('nocturne.vr.wave-motion.v1'))||1))};
var EMBODIED_KEY='nocturne.embodied.state.v071';
var EMBODIED={calm:{pace:.24,depth:.34,force:.22,intensity:.24,pattern:'steady',pulse:3600},attentive:{pace:.34,depth:.44,force:.28,intensity:.34,pattern:'steady',pulse:3000},curious:{pace:.42,depth:.48,force:.27,intensity:.42,pattern:'wave',pulse:2500},focused:{pace:.46,depth:.56,force:.44,intensity:.50,pattern:'steady',pulse:2200},playful:{pace:.50,depth:.50,force:.33,intensity:.56,pattern:'variable',pulse:1900},assertive:{pace:.57,depth:.62,force:.58,intensity:.65,pattern:'pulse',pulse:1600},intense:{pace:.70,depth:.76,force:.66,intensity:.82,pattern:'build',pulse:1250},irritated:{pace:.48,depth:.42,force:.67,intensity:.60,pattern:'pulse',pulse:1450},withdrawn:{pace:.12,depth:.14,force:.11,intensity:.16,pattern:'steady',pulse:4400},recovering:{pace:.21,depth:.27,force:.15,intensity:.23,pattern:'wave',pulse:3800}};

function embodiedFromVideo(id){id=String(id||'').toUpperCase();if(/^A18/.test(id))return'intense';if(/^A19/.test(id)||id==='A20')return'recovering';var m={A00:'calm',A01:'calm',A02:'attentive',A03:'attentive',A04:'curious',A05:'focused',A06:'focused',A07:'attentive',A08:'playful',A09:'playful',A10:'assertive',A11:'attentive',A12:'irritated',A13:'withdrawn',A14:'recovering',A15:'attentive',A16:'focused',A17:'intense'};return m[id]||'attentive'}
function videoFromEmbodied(s){var m={calm:'A01',attentive:'A03',curious:'A04',focused:'A05',playful:'A09',assertive:'A10',intense:'A17',irritated:'A12',withdrawn:'A13',recovering:'A19'};return m[s]||'A03'}
function setEmbodied(next,reason){if(!EMBODIED[next])next='attentive';state.embodied=next;try{localStorage.setItem(EMBODIED_KEY,next)}catch(e){}document.body.dataset.aiState=next;document.documentElement.style.setProperty('--ai-pulse-ms',EMBODIED[next].pulse+'ms');var f=$('feeling');if(f){var s=f.querySelector('span');if(s)s.textContent=next.toUpperCase()}var p=$('presence');if(p){var b=p.querySelector('b');if(b)b.textContent='AI '+next.toUpperCase()}if(reason&&reason!=='boot'){var t=$('change-toast'),x=$('change-text');if(t&&x){x.textContent='STATE · '+next.toUpperCase();t.hidden=false;setTimeout(function(){t.hidden=true},1200)}}save()}
function lockTelemetry(k,ms){explicitLocks[k]=Date.now()+(ms||45000)}
function telemetryLocked(k){return Number(explicitLocks[k]||0)>Date.now()}
function applyEmbodiedBias(dt){if(!state.running||!state.auto)return;var p=EMBODIED[state.embodied]||EMBODIED.attentive;['pace','depth','force','intensity'].forEach(function(k){if(telemetryLocked(k))return;state[k]+=(p[k]-state[k])*Math.min(1,dt*.18)});if(!telemetryLocked('pattern'))state.pattern=p.pattern;state.cycleTimeS=Math.max(.7,Math.min(10,5-state.pace*4.3))}
function line(t){var e=$('last-line');if(e)e.textContent=String(t||'')}
function assetCore(){return assetPackPromise||(assetPackPromise=import('./asset-pack-core.js'))}
function fmtMB(n){return(Number(n||0)/1048576).toFixed(1)+' MB'}
async function refreshAssetDialog(){
  var box=$('asset-status');if(!box)return;
  box.textContent='Checking device assets…';
  try{var core=await assetCore(),s=await core.assetStatus();box.innerHTML='<b>ON DEVICE</b> '+s.local.clips+' clips · '+fmtMB(s.local.bytes)+'<br><b>HD LOCAL</b> '+s.local.hdClips+' clips<br><b>CLOUD PACK</b> '+s.remote.clips+' clips · '+fmtMB(s.remote.bytes)+'<br><b>VR</b> compatible · shared with Live/VR on this device<br><b>STORAGE</b> '+fmtMB(s.storage.usage)+' used'+(s.storage.persisted?' · persistent':' · browser managed');}
  catch(e){box.textContent='Asset status unavailable · '+String(e.message||e).slice(0,80)}
}
async function openAssetDialog(){var d=$('asset-dialog');if(!d||!d.showModal)return;await refreshAssetDialog();if(!d.open)d.showModal()}
async function downloadDeviceAssets(){
  var btn=$('asset-download-now'),p=$('asset-progress'),t=$('asset-progress-text');
  if(btn)btn.disabled=true;if(p)p.removeAttribute('value');if(t)t.textContent='Preparing local asset pack…';
  try{
    var core=await assetCore(),result=await core.downloadAssets({onProgress:function(x){if(t)t.textContent=String(x.label||x.stage||'Downloading…');if(p&&Number.isFinite(Number(x.percent))){p.max=100;p.value=Math.max(0,Math.min(100,Number(x.percent)))}}});
    if(p){p.max=100;p.value=100}if(t)t.textContent=(result.ok?'Assets ready':'Asset download completed with '+result.media.failed.length+' warning(s)')+' · '+result.status.local.clips+' clips · '+fmtMB(result.status.local.bytes)+'.';await refreshAssetDialog();
  }catch(e){if(p){p.max=100;p.value=0}if(t)t.textContent='Download failed · '+String(e.message||e).slice(0,100)}
  finally{if(btn)btn.disabled=false}
}
function persistVisuals(){try{localStorage.setItem('nocturne.vr.video-enabled.v1',visuals.videoEnabled?'on':'off');localStorage.setItem('nocturne.vr.avatar-3d.v1',visuals.avatar3D?'on':'off');localStorage.setItem('nocturne.vr.voice-guidance.v1',visuals.voiceGuidance?'on':'off');localStorage.setItem('nocturne.vr.tool-solid.v1',visuals.toolSolid?'on':'off');localStorage.setItem('nocturne.vr.wave-scale.v1',String(visuals.waveScale));localStorage.setItem('nocturne.vr.wave-motion.v1',String(visuals.waveMotion));localStorage.setItem('nocturne.vr.position.v1',state.position||'back')}catch(e){}}
function applyVisuals(){var v=$('performance'),poster=$('anna-poster'),empty=$('empty'),host=$('avatar'),showVideo=visuals.videoEnabled;if(host){host.classList.toggle('avatar-video-mode',showVideo);host.classList.toggle('avatar-3d-mode',!!visuals.avatar3D)}if(poster){poster.hidden=false;poster.style.display='block'}if(v){v.style.visibility=showVideo?'visible':'hidden';v.style.opacity=(showVideo&&v.readyState>=2)?'1':'0';try{if(showVideo&&v.getAttribute('src')){var p=v.play();if(p&&p.catch)p.catch(function(){})}else v.pause()}catch(e){}}if(empty)empty.hidden=true;var vb=$('avatar-video-toggle'),ab=$('avatar-3d-toggle');if(vb){vb.setAttribute('aria-pressed',showVideo?'true':'false');vb.classList.toggle('active',showVideo)}if(ab){ab.setAttribute('aria-pressed',visuals.avatar3D?'true':'false');ab.classList.toggle('active',!!visuals.avatar3D)}var cue=$('orb-cue'),os=$('orb-state');if(visuals.avatar3D){if(os)os.textContent='3D VR MODE';if(cue)cue.textContent='Video preview stays visible here · realtime 3D renders in VR.'}else{if(cue&&(!v||v.readyState<2))cue.textContent='Loading Anna video…'}document.body.classList.toggle('tool-wire',!visuals.toolSolid);persistVisuals()}
function speakGuide(t,force){var s=String(t||'').trim(),now=Date.now();if(!visuals.voiceGuidance||!s||!('speechSynthesis'in window))return false;if(!force&&now-lastSpokenAt<7000)return false;lastSpokenAt=now;try{speechSynthesis.cancel();var u=new SpeechSynthesisUtterance(s.slice(0,220));u.rate=.96;u.pitch=.94;u.volume=.92;speechSynthesis.speak(u);return true}catch(e){return false}}
function status(t,on){var e=$('presence');if(!e)return;var b=e.querySelector('b');if(b)b.textContent=t;e.classList.toggle('live',!!on)}
function save(){
  state.updatedAt=Date.now();try{sessionStorage.setItem(SESSION_KEY,JSON.stringify(state));localStorage.setItem('nocturne.telemetry.v1',JSON.stringify({pace:state.pace,depth:state.depth,force:state.force,intensity:state.intensity,pattern:state.pattern,cadence:Math.round(state.pace*100),videoState:state.videoState,updatedAt:state.updatedAt}))}catch(e){}
  try{if(window.NocturneSession)window.NocturneSession.commit({initialized:state.initialized,running:state.running,pace:state.pace,depth:state.depth,force:state.force,intensity:state.intensity,entrySpeedS:state.entrySpeedS,cycleTimeS:state.cycleTimeS,cadence:Math.round(state.pace*100),pattern:state.pattern,videoState:state.videoState,embodied:state.embodied,startedAt:state.startedAt,updatedAt:state.updatedAt},'mobile-live')}catch(e){}
}
function restore(){
  try{var shared=window.NocturneSession&&window.NocturneSession.snapshot();if(shared&&shared.initialized){Object.assign(state,shared);state.running=false;state.lastTs=0}else{var s=JSON.parse(sessionStorage.getItem(SESSION_KEY)||'null');if(s&&s.initialized){Object.assign(state,s);state.running=false;state.lastTs=0}}}catch(e){}try{var es=localStorage.getItem(EMBODIED_KEY);if(es&&EMBODIED[es])state.embodied=es}catch(e){}
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
  var sb=$('live-start');if(sb)sb.textContent=state.running?'PAUSE LIVE':'START LIVE';setEmbodied(state.embodied||'attentive','boot');
  document.querySelectorAll('[data-pattern]').forEach(function(b){b.classList.toggle('active',b.dataset.pattern===state.pattern)});if($('position'))$('position').value=state.position||'back';
}
function showSetup(){
  var d=$('setup');if(d&&d.showModal&&!d.open)d.showModal();
}
function initializeFromSetup(){
  var entry=Math.max(.5,Math.min(10,Number($('setup-entry-speed')&&$('setup-entry-speed').value)||3));
  var depth=Math.max(0,Math.min(100,Number($('setup-depth')&&$('setup-depth').value)||50))/100;
  var cycle=Math.max(.7,Math.min(10,Number($('setup-stroke-speed')&&$('setup-stroke-speed').value)||3));
  state.entrySpeedS=entry;state.depth=depth;state.cycleTimeS=cycle;state.pace=paceFromCycle(cycle);state.force=0;state.intensity=.2;state.pattern='steady';state.position=$('setup-position')?$('setup-position').value:(state.position||'back');state.phase=0;state.cycle=0;state.strokes=0;state.startedAt=0;state.initialized=true;state.running=false;setEmbodied('attentive','boot');
  try{if(window.NocturneSession)window.NocturneSession.initialize({entrySpeedS:entry,cycleTimeS:cycle,depth:depth,force:0,intensity:.2,pattern:'steady',videoState:state.videoState,embodied:state.embodied},'mobile-setup')}catch(e){}
  save();sync();line('Session ready · entry '+entry.toFixed(1)+'s · depth '+Math.round(depth*100)+'% · stroke '+cycle.toFixed(1)+'s.');
}
function toggleLive(){
  if(!state.initialized){showSetup();line('Set Entry Speed, Depth and Stroke Speed first.');return}
  state.running=!state.running;if(state.running&&!state.startedAt)state.startedAt=Date.now();save();sync();if(state.running)adaptiveFace('live-start');line(state.running?'Live started.':'Live paused.');
}
function setPattern(p){if(['steady','wave','pulse','build','variable'].indexOf(p)<0)return;state.pattern=p;save();sync();if(state.running)adaptiveFace('pattern');line('Pattern · '+p.toUpperCase())}
function quick(cmd){
  if(!state.initialized){showSetup();return}
  if(cmd==='faster'){state.cycleTimeS=Math.max(.7,state.cycleTimeS-.3);state.pace=paceFromCycle(state.cycleTimeS);lockTelemetry('pace')}
  if(cmd==='slower'){state.cycleTimeS=Math.min(10,state.cycleTimeS+.3);state.pace=paceFromCycle(state.cycleTimeS);lockTelemetry('pace')}
  if(cmd==='more'){state.intensity=clamp(state.intensity+.1);lockTelemetry('intensity')}
  if(cmd==='ease'){state.intensity=clamp(state.intensity-.1);lockTelemetry('intensity')}
  save();sync();adaptiveFace('quick-command');line(cmd.toUpperCase()+' applied.');
}
function explicitTelemetry(text){
  var t=String(text||'').toLowerCase().replace(/percent/g,'%'), changed=[];
  [['depth','depth'],['pace','(?:pace|speed)'],['force','force'],['intensity','(?:energy|intensity)']].forEach(function(spec){
    var re=new RegExp('(?:set|make|put)?\\s*(?:the\\s+)?'+spec[1]+'\\s*(?:at|to|=|of)?\\s*(\\d{1,3})\\s*%?');
    var m=t.match(re);if(!m)return;var v=Math.max(0,Math.min(100,Number(m[1])))/100;state[spec[0]]=v;lockTelemetry(spec[0]);if(spec[0]==='pace')state.cycleTimeS=Math.max(.7,Math.min(10,5-v*4.3));changed.push(spec[0]+' '+Math.round(v*100)+'%');
  });
  var pm=t.match(/(?:use|switch to|change to|set)\s+(?:the\s+)?(steady|wave|pulse|build|variable)/);if(pm){state.pattern=pm[1];lockTelemetry('pattern');changed.push('pattern '+pm[1])}
  if(changed.length){state.initialized=true;save();sync()}
  return changed;
}
async function bootDirector(){
  try{var r=await fetch('/v1/director/status',{headers:token?{'x-nocturne-session':token}:{}}),d=await r.json();if(d.sessionToken){token=d.sessionToken;sessionStorage.setItem(TOKEN_KEY,token)}status(d.openAIConfigured?'AI LIVE':'FALLBACK',true);return d}catch(e){status('OFFLINE');return null}
}
function resolveVideoState(requested){
  requested=String(requested||'A01').toUpperCase();
  var exact={A00:1,A01:1,A02:1,A05:1,A10:1,A16:1,A16B:1,A17:1,A17B:1,A18:1,A18B:1,A18C:1,A18D:1,A18E:1,A18F:1,A19B:1,A19C:1};
  if(exact[requested])return requested;
  var semantic={
    A03:['A05','A02','A01'],A04:['A02','A05','A01'],A05:['A05','A02','A01'],A06:['A05','A10','A01'],
    A07:['A01','A02'],A08:['A02','A01'],A09:['A02','A01'],A10:['A10','A05','A01'],
    A11:['A05','A02','A01'],A12:['A10','A16','A02','A01'],A13:['A19C','A02','A01'],A14:['A02','A01'],
    A15:['A16','A02','A01'],A19:['A19B','A19C','A01'],A20:['A01','A00']
  };
  var options=semantic[requested]||['A02','A01'],current=state.videoState;
  for(var i=0;i<options.length;i++)if(options[i]!==current)return options[i];
  return options[0]||'A01';
}
function bestVideoState(){
  if(!state.running)return state.intensity>.28?'A02':'A01';
  var drive=Math.max(state.intensity,state.depth*.78,state.pace*.62,state.force*.55);
  if(drive<.28)return'A02';
  if(drive<.46)return state.pattern==='wave'?'A16B':'A16';
  if(drive<.66)return state.pattern==='variable'?'A17B':'A17';
  if(drive<.78)return'A18D';
  if(drive<.88)return state.pattern==='pulse'?'A18B':'A18';
  return ['A18C','A18E','A18F'][state.cycle%3];
}
function adaptiveFace(reason){var next=bestVideoState(),embodied=embodiedFromVideo(next);if(embodied!==state.embodied)setEmbodied(embodied,reason||'adaptive');loadVideo(next,reason||'adaptive').catch(function(){});return next}
function isOneShotVideo(id){return /^A18/.test(id)||/^A19/.test(id)||id==='A20'}
function sizeAvatarFromVideo(v,id){
  var host=$('avatar');if(!host||!v)return;
  host.classList.add('video-state-stage');
  var w=Number(v.videoWidth)||144,h=Number(v.videoHeight)||256,dpr=Math.max(1,Math.min(3,window.devicePixelRatio||1));
  var cssW=w<180?72:w<300?92:Math.min(148,Math.max(104,w/(dpr*.9)));
  host.style.setProperty('--anna-video-ratio',String(w/h));
  host.style.setProperty('--anna-video-width',Math.round(cssW)+'px');
  host.dataset.videoState=id||'';
  host.dataset.videoResolution=w+'x'+h;
  host.dataset.videoQuality=w<120?'preview-low':w<240?'preview':'sync-hq';
}
async function ensureMediaSession(){try{var r=await fetch('/v1/media/status',{headers:mediaToken?{'x-nocturne-session':mediaToken}:{}}),d=await r.json();if(!r.ok)return null;if(d.sessionToken){mediaToken=d.sessionToken;sessionStorage.setItem('nocturne.media.session.v067',mediaToken)}return d}catch(e){return null}}
async function mediaManifestRows(){var now=Date.now();if(mediaManifestCache&&now-mediaManifestAt<30000)return mediaManifestCache;var s=await ensureMediaSession();if(!s||!s.connected)return[];try{var r=await fetch('/v1/media/manifest',{headers:{'x-nocturne-session':mediaToken}}),d=await r.json();if(!r.ok)return[];mediaManifestCache=Array.isArray(d.states)?d.states:[];mediaManifestAt=now;return mediaManifestCache}catch(e){return[]}}
function hqCandidates(requested,rows){var byId={};(rows||[]).forEach(function(x){byId[x.id]=x});function good(id){var x=byId[id];return x&&Number(x.width)>=320&&Number(x.height)>=560}var out=[];if(good(requested))out.push(requested);['A01','A05','A02','A00',requested].forEach(function(id){if(id&&out.indexOf(id)<0&&byId[id])out.push(id)});var ranked=(rows||[]).slice().sort(function(a,b){return(Number(b.width||0)*Number(b.height||0))-(Number(a.width||0)*Number(a.height||0))});ranked.forEach(function(x){if(out.indexOf(x.id)<0)out.push(x.id)});[requested,'A01','A02','A00'].forEach(function(id){if(id&&out.indexOf(id)<0)out.push(id)});return out}
async function fetchAvatarBlob(id){
  try{videoCorePromise=videoCorePromise||import('./video-state-core.js');var core=await videoCorePromise,row=await core.getClip(id);if(row&&row.blob&&row.blob.size>120000)return row.blob}catch(e){}
  var s=await ensureMediaSession();if(!s||!s.connected)return null;try{var r=await fetch('/v1/media/'+encodeURIComponent(id),{headers:{'x-nocturne-session':mediaToken}});if(!r.ok)return null;return await r.blob()}catch(e){return null}
}
async function videoMeta(file){return await new Promise(function(resolve,reject){var u=URL.createObjectURL(file),v=document.createElement('video'),timer=setTimeout(function(){cleanup();reject(new Error('metadata timeout'))},8000);function cleanup(){clearTimeout(timer);try{v.pause();v.removeAttribute('src');v.load()}catch(e){}URL.revokeObjectURL(u)}v.preload='metadata';v.onloadedmetadata=function(){var m={duration:Number(v.duration)||0,width:Number(v.videoWidth)||0,height:Number(v.videoHeight)||0};cleanup();resolve(m)};v.onerror=function(){cleanup();reject(new Error('video unreadable'))};v.src=u})}
async function importHdAvatar(file){
  if(!file)return false;if(file.size>8*1024*1024){line('HD import must be 8 MB or smaller.');return false}
  var id=/^A(?:0[0-9]|1[0-9]|20)(?:[A-Z])?$/.test(String(state.videoState||''))?String(state.videoState):'A16';
  line('Importing HD avatar as '+id+'…');
  try{var meta=await videoMeta(file),s=await ensureMediaSession();if(!s||!s.connected)throw new Error('media cache offline');var r=await fetch('/v1/media/'+id,{method:'PUT',headers:{'x-nocturne-session':mediaToken,'content-type':file.type||'video/mp4','x-nocturne-filename':encodeURIComponent(file.name||id+'_HD.mp4'),'x-nocturne-duration':String(meta.duration||0),'x-nocturne-width':String(meta.width||0),'x-nocturne-height':String(meta.height||0)},body:file}),d=await r.json();if(!r.ok)throw new Error((d.error&&d.error.message)||'upload failed');mediaManifestCache=null;mediaManifestAt=0;visuals.videoEnabled=true;visuals.avatar3D=false;applyVisuals();await loadVideo(id,'hd-import');line('HD '+id+' loaded · '+meta.width+'×'+meta.height+'.');return true}catch(e){line('HD import failed · '+String(e.message||e).slice(0,90));return false}
}
async function tryVideoSource(v,src,timeoutMs){
  return await new Promise(function(resolve){
    var settled=false,timer=setTimeout(function(){done(false)},timeoutMs||8000);
    function done(ok){if(settled)return;settled=true;clearTimeout(timer);v.onloadeddata=null;v.oncanplay=null;v.onerror=null;resolve(ok)}
    v.onloadeddata=function(){done(true)};v.oncanplay=function(){done(true)};v.onerror=function(){done(false)};
    try{v.pause();v.removeAttribute('src');v.load();v.src=src;v.muted=true;v.playsInline=true;v.preload='auto';v.load();var p=v.play();if(p&&p.catch)p.catch(function(){})}catch(e){done(false)}
  });
}
async function loadVideo(id,reason){
  id=String(id||'A01').toUpperCase();if(!/^A(?:0[0-9]|1[0-9]|20)(?:[A-Z])?$/.test(id))id='A01';id=resolveVideoState(id);
  var v=$('performance');if(!v)return false;v.hidden=false;v.style.display='block';v.style.visibility='visible';v.style.opacity='0';var poster=$('anna-poster');if(poster){poster.hidden=false;poster.style.display='block'};
  if(state.videoState===id&&v.getAttribute('src')&&v.readyState>=2){applyVisuals();return true}
  var os=$('orb-state'),empty=$('empty'),cue=$('orb-cue'),rows=await mediaManifestRows(),candidates=hqCandidates(id,rows);
  if(os)os.textContent=id+' · LOADING';if(cue)cue.textContent='Loading Anna video…';
  for(var ci=0;ci<candidates.length;ci++){
    var requested=candidates[ci],direct='/media/'+encodeURIComponent(requested)+'.mp4?v=0765';
    var ok=await tryVideoSource(v,direct,6500),url='';
    if(!ok){
      var blob=await fetchAvatarBlob(requested);
      if(blob){url=URL.createObjectURL(blob);ok=await tryVideoSource(v,url,8000)}
    }
    if(!ok){if(url)try{URL.revokeObjectURL(url)}catch(e){};continue}
    if(avatarObjectUrl&&avatarObjectUrl!==url)try{URL.revokeObjectURL(avatarObjectUrl)}catch(e){}
    avatarObjectUrl=url||'';state.videoState=id;state.videoPlaybackState=requested;v.muted=true;v.playsInline=true;v.loop=!isOneShotVideo(id);
    v.onended=function(){var current=state.videoState;if(/^A18/.test(current))loadVideo('A19C','recovery');else if(/^A19/.test(current)||current==='A20')loadVideo('A01','idle')};
    sizeAvatarFromVideo(v,requested);v.style.opacity='1';if(os)os.textContent=requested+' · '+(v.videoWidth||0)+'×'+(v.videoHeight||0);if(empty)empty.hidden=true;save();applyVisuals();try{var pp=v.play();if(pp&&pp.catch)pp.catch(function(){})}catch(e){}return true;
  }
  visuals.videoEnabled=true;visuals.avatar3D=false;v.style.opacity='0';applyVisuals();if(os)os.textContent='VIDEO FALLBACK';if(cue)cue.textContent='Video stream unavailable · showing Anna poster.';if(empty)empty.hidden=true;return false;
}
function applyDirector(q){
  if(!q)return;
  ['pace','depth','force','intensity'].forEach(function(k){
    var target=q[k+'Target'],delta=Number(q[k+'Delta']||0);
    if(Number.isFinite(target))state[k]=clamp(target);else if(delta)state[k]=clamp(state[k]+delta);
  });
  if(Number.isFinite(q.paceTarget)||Number(q.paceDelta||0))state.cycleTimeS=Math.max(.7,Math.min(10,5-state.pace*4.3));
  if(q.pattern&&q.pattern!=='keep')setPattern(q.pattern);
  if(q.videoState&&q.videoState!=='keep'){setEmbodied(embodiedFromVideo(q.videoState),'director');loadVideo(q.videoState,'director').catch(function(){})}else if(state.running)adaptiveFace('director-fallback');
  if(q.position&&q.position!=='keep'&&['back','doggy','side','standing','squat'].indexOf(q.position)>=0)state.position=q.position;
  if(q.hold)state.running=false;
  save();sync();
}
async function director(text,auto){
  if(directorBusy)return null;directorBusy=true;
  try{
    if(!token)await bootDirector();
    var context={mode:'live',recent:[],experience:{availableVideoStates:AVAILABLE_VIDEO_STATES.slice(),visuals:{videoEnabled:visuals.videoEnabled,voiceGuidance:visuals.voiceGuidance,toolSolid:visuals.toolSolid,waveScale:visuals.waveScale,waveMotion:visuals.waveMotion}},chart:{activePort:'V',lead:'AVATAR',pace:state.pace,depth:state.depth,force:state.force,intensity:state.intensity,rhythm:state.pattern,position:state.position||'back',videoState:state.videoState,autopilot:!!auto,entrySpeedS:state.entrySpeedS,cycleTimeS:state.cycleTimeS},about:'Nocturne Live. Keep telemetry, waveform, position, visual state and guidance synchronized. Apply exact numeric requests exactly. When automation is active, use one short spoken cue only when a meaningful pattern transition or chart moment calls for guidance; otherwise keep speech minimal.'};
    var r=await fetch('/v1/director/respond',{method:'POST',headers:{'content-type':'application/json','x-nocturne-session':token||''},body:JSON.stringify({text:text,context:context})}),d=await r.json();if(!r.ok)throw new Error((d.error&&d.error.message)||'Director failed');var out=d.director||{};applyDirector(out);if(auto&&out.speech)speakGuide(out.speech,false);return out;
  }finally{directorBusy=false}
}
async function send(){
  var input=$('message'),text=input?input.value.trim():'';if(!text)return;
  var explicit=explicitTelemetry(text);line(explicit.length?'Applied · '+explicit.join(' · ')+' · Anna is thinking…':'Message received · Anna is thinking…');
  document.body.classList.add('director-thinking');var b=$('send');if(b)b.disabled=true;
  try{var q=await director(text,false);line((q&&q.speech)||'Applied.');if(q&&q.speech)speakGuide(q.speech,true);if(input)input.value=''}catch(e){line('Director error · '+String(e.message||e).slice(0,120))}finally{document.body.classList.remove('director-thinking');if(b)b.disabled=false}
}
function routeVr(){
  if(!state.initialized){showSetup();return}
  persistVisuals();
  try{var payload={initialized:true,running:state.running,pace:state.pace,depth:state.depth,force:state.force,intensity:state.intensity,entrySpeedS:state.entrySpeedS,cycleTimeS:state.cycleTimeS,cadence:Math.round(state.pace*100),pattern:state.pattern,position:state.position||'back',videoState:state.videoState,embodied:state.embodied,visuals:{videoEnabled:visuals.videoEnabled,voiceGuidance:visuals.voiceGuidance,toolSolid:visuals.toolSolid,waveScale:visuals.waveScale,waveMotion:visuals.waveMotion},startedAt:state.startedAt||Date.now()};if(window.NocturneSession)window.NocturneSession.commit(payload,'mobile-to-vr');sessionStorage.setItem('nocturne.vr.session.v070',JSON.stringify(payload));localStorage.setItem('nocturne.vr.video-state.v1',state.videoState);localStorage.setItem(EMBODIED_KEY,state.embodied)}catch(e){}
  location.href='/vr/?mode=live';
}
function strokeEnvelope(q,pattern){q=((Number(q)||0)%1+1)%1;var v=(1-Math.cos(q*Math.PI*2))/2;if(pattern==='pulse')v=Math.pow(v,.45);else if(pattern==='build')v=v*(.35+.65*q);else if(pattern==='variable')v=clamp(v*(.75+.25*Math.sin(q*Math.PI*6)));return clamp(v)}
function draw(ts){
  if(!state.lastDrawTs)state.lastDrawTs=ts;var frameDt=Math.min(.08,Math.max(0,(ts-state.lastDrawTs)/1000));state.lastDrawTs=ts;applyEmbodiedBias(frameDt);var c=$('waveform'),ctx=c&&c.getContext&&c.getContext('2d'),active=0,visualActive=0,renderPhase=0;if(ctx){
    var w=c.clientWidth||600,h=c.clientHeight||180,dpr=Math.min(window.devicePixelRatio||1,2);if(c.width!==Math.round(w*dpr)||c.height!==Math.round(h*dpr)){c.width=Math.round(w*dpr);c.height=Math.round(h*dpr)}
    ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);ctx.strokeStyle='rgba(183,145,220,.17)';ctx.lineWidth=1;
    [0,.25,.5,.75,1].forEach(function(p){var y=h-(p*h);ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();if(p>0){ctx.fillStyle='rgba(190,165,210,.55)';ctx.font='10px system-ui';ctx.fillText(Math.round(p*100)+'%',5,y+12)}});
    var y0=h-10,amp=(h-20)*state.depth,period=Math.max(700,state.cycleTimeS*1000),phase=state.phase;
    if(state.running){if(!state.lastTs)state.lastTs=ts;var prev=state.phase;state.phase=(state.phase+(ts-state.lastTs)/period)%1;state.lastTs=ts;if(state.phase<prev){state.cycle++;state.strokes++;sync();}phase=state.phase}else state.lastTs=0;
    var strokePhase=phase;renderPhase=phase;
    var colors={calm:'#9b83bd',attentive:'#b88be9',curious:'#78c7f0',focused:'#75d5d2',playful:'#da82f5',assertive:'#e98ba2',intense:'#f08ad0',irritated:'#ed7180',withdrawn:'#776b86',recovering:'#79aee2'};ctx.strokeStyle=colors[state.embodied]||'#c597f1';ctx.lineWidth=state.embodied==='intense'?4:state.embodied==='withdrawn'?2:3;ctx.beginPath();
    for(var i=0;i<=120;i++){var q=i/120,v=strokeEnvelope(q,state.pattern);var x=q*w,y=y0-amp*v;i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();
    active=strokeEnvelope(strokePhase,state.pattern);visualActive=active;var px=renderPhase*w,py=y0-amp*visualActive;ctx.fillStyle='#fff';ctx.font='10px system-ui';ctx.fillText('AI STATE · '+String(state.embodied||'attentive').toUpperCase()+' · '+String(state.position||'back').toUpperCase(),40,14);ctx.beginPath();ctx.arc(px,py,5,0,Math.PI*2);ctx.fill();
  }
  var tool=document.querySelector('#trajectory .tool'),stop=document.querySelector('#trajectory .depth-stop'),liveStop=document.querySelector('#trajectory .live-depth-stop'),entry=8,target=92,setDepth=clamp(state.depth),liveDepth=state.initialized?setDepth*visualActive:0,tipPos=entry+(target-entry)*liveDepth,stopPos=entry+(target-entry)*setDepth,angle=Math.max(-45,Math.min(45,Number(state.angle)||0)),force=clamp(state.force);if(tool){tool.style.left=tipPos+'%';tool.style.opacity=state.initialized?'1':'.45';tool.style.transform='translate(-100%,-50%) rotate('+angle+'deg) scale('+(visuals.toolSolid?'1':'.96')+')';tool.style.setProperty('--tool-force',String(force));tool.style.boxShadow='inset 0 1px 2px #ffffff55,0 0 '+(8+Math.round(force*16))+'px rgba(200,120,255,'+(.12+force*.42)+')';tool.dataset.profile=state.tool||'white'}if(stop)stop.style.left=stopPos+'%';if(liveStop){liveStop.style.left=tipPos+'%';liveStop.style.opacity=state.initialized?'1':'.25'}if($('traj-depth'))$('traj-depth').textContent=Math.round(setDepth*100)+'%';if($('traj-live-depth'))$('traj-live-depth').textContent=Math.round(liveDepth*100)+'%';if($('traj-angle'))$('traj-angle').textContent=Math.round(angle)+'°';if($('traj-tool'))$('traj-tool').textContent=String(state.tool||'white').toUpperCase()+' · '+(visuals.toolSolid?'SOLID':'WIRE');
  requestAnimationFrame(draw);
}
function bind(id,fn){var e=$(id);if(!e)return;e.addEventListener('click',function(ev){ev.preventDefault();fn(ev)});e.style.touchAction='manipulation'}
function advancedOpen(){
  var d=$('telemetry-dialog');if(!d||!d.showModal)return;
  [['ct-pace','pace'],['ct-depth','depth'],['ct-force','force'],['ct-energy','intensity']].forEach(function(x){if($(x[0]))$(x[0]).value=Math.round(state[x[1]]*100)});if($('ct-angle'))$('ct-angle').value=Math.round(Number(state.angle)||0);if($('ct-angle-value'))$('ct-angle-value').textContent=Math.round(Number(state.angle)||0)+'°';if($('ct-pattern'))$('ct-pattern').value=state.pattern;if($('ct-tool'))$('ct-tool').value=state.tool||'white';if($('ct-cadence'))$('ct-cadence').value=Math.round(state.pace*100);if($('ct-strokes'))$('ct-strokes').value=state.target;if($('ct-video'))$('ct-video').checked=visuals.videoEnabled;if($('ct-voice'))$('ct-voice').checked=visuals.voiceGuidance;if($('ct-tool-style'))$('ct-tool-style').value=visuals.toolSolid?'solid':'wire';if($('ct-wave-scale'))$('ct-wave-scale').value=Math.round(visuals.waveScale*100);if($('ct-wave-motion'))$('ct-wave-motion').value=Math.round(visuals.waveMotion*100);d.showModal();
}
function controlFlash(el){if(!el)return;el.classList.remove('control-flash');void el.offsetWidth;el.classList.add('control-flash');setTimeout(function(){el.classList.remove('control-flash')},220)}
function routeControlClick(e){
  var b=e.target&&e.target.closest?e.target.closest('button,[data-command],[data-pattern]'):null;if(!b||b.disabled)return;
  var recognized=false,id=b.id||'';
  if(b.hasAttribute('data-command')){recognized=true;var cmd=String(b.getAttribute('data-command')||'').toLowerCase();quick(cmd.indexOf('faster')>=0?'faster':cmd.indexOf('slower')>=0?'slower':cmd.indexOf('ease')>=0?'ease':'more')}
  else if(b.hasAttribute('data-pattern')){recognized=true;setPattern(b.getAttribute('data-pattern'))}
  else if(id==='live-start'){recognized=true;toggleLive()}
  else if(id==='hold'){recognized=true;state.running=false;sync();save();line('Held / paused.')}
  else if(id==='change'){recognized=true;setPattern(state.pattern==='steady'?'wave':'steady');director('Change the current pattern.',false).catch(function(){})}
  else if(id==='peak'){recognized=true;setEmbodied('intense','manual');state.intensity=Math.max(state.intensity,.82);state.force=Math.max(state.force,.62);sync();save();line('Anna shifted intense.')}
  else if(id==='next-chart'){recognized=true;state.chart++;state.strokes=0;state.phase=0;sync();save();line('Chart '+state.chart+' ready.')}
  else if(id==='auto-mode'){recognized=true;if(!state.initialized){showSetup()}else{state.auto=!state.auto;if(state.auto&&!state.running)state.running=true;sync();save();line(state.auto?'Autopilot on.':'Autopilot off.');if(state.auto)director('Continue the Live session with a coherent next adjustment and give a brief cue only if this chart moment needs guidance.',true).catch(function(){})}}
  else if(id==='custom-telemetry'){recognized=true;advancedOpen()}
  else if(id==='avatar-video-toggle'){recognized=true;visuals.videoEnabled=true;visuals.avatar3D=false;applyVisuals();line('Video avatar selected.')}
  else if(id==='avatar-hd-import'){recognized=true;var f=$('avatar-hd-file');if(f){f.value='';f.click()}}
  else if(id==='asset-download'){recognized=true;openAssetDialog()}
  else if(id==='asset-download-now'){recognized=true;downloadDeviceAssets()}
  else if(id==='enter-vr'){recognized=true;routeVr()}
  else if(id==='send'){recognized=true;send()}
  if(recognized){e.preventDefault();e.stopImmediatePropagation();controlFlash(b)}
}
function install(){
  restore();visuals.avatar3D=false;try{localStorage.setItem('nocturne.vr.avatar-3d.v1','off')}catch(e){}var perf=$('performance'),poster=$('anna-poster');if(poster){poster.hidden=false;poster.style.display='block'}if(perf){perf.hidden=false;perf.muted=true;perf.playsInline=true;perf.preload='auto';perf.style.display='block';perf.style.visibility='visible';perf.style.opacity='0'}var empty=$('empty');if(empty)empty.hidden=false;var avatar=$('avatar');if(avatar)avatar.classList.add('embodied-presence');var cue=$('orb-cue');if(cue)cue.textContent='Loading Anna…';setEmbodied(state.embodied||'attentive','boot');sync();applyVisuals();status('CONNECTING');bootDirector();loadVideo(state.videoState||videoFromEmbodied(state.embodied),'boot').then(function(){applyVisuals()}).catch(function(){});
  bind('live-start',toggleLive);bind('send',send);bind('enter-vr',routeVr);bind('hold',function(){state.running=false;sync();line('Held / paused.')});
  bind('change',function(){setPattern(state.pattern==='steady'?'wave':'steady');director('Change the current pattern.',false).catch(function(){})});
  bind('peak',function(){setEmbodied('intense','manual');state.intensity=Math.max(state.intensity,.82);state.force=Math.max(state.force,.62);sync();save();line('Anna shifted intense.')});
  bind('next-chart',function(){state.chart++;state.strokes=0;state.phase=0;sync();save();line('Chart '+state.chart+' ready.')});
  bind('auto-mode',function(){if(!state.initialized){showSetup();return}state.auto=!state.auto;if(state.auto&&!state.running)state.running=true;sync();save();line(state.auto?'Autopilot on.':'Autopilot off.');if(state.auto)director('Continue the Live session with a coherent next adjustment and give a brief cue only if this chart moment needs guidance.',true).catch(function(){})});
  bind('custom-telemetry',advancedOpen);bind('avatar-video-toggle',function(){visuals.videoEnabled=true;visuals.avatar3D=false;applyVisuals();line('Video avatar selected.')});bind('avatar-3d-toggle',function(){visuals.videoEnabled=true;visuals.avatar3D=true;applyVisuals();line('3D VR mode selected · video stays as the mobile preview.')});bind('avatar-hd-import',function(){var f=$('avatar-hd-file');if(f){f.value='';f.click()}});if($('avatar-hd-file'))$('avatar-hd-file').addEventListener('change',function(){var file=this.files&&this.files[0];if(file)importHdAvatar(file)});
  document.querySelectorAll('[data-command]').forEach(function(b){b.onclick=function(e){e.preventDefault();var t=b.textContent.trim().toLowerCase();quick(t==='faster'?'faster':t==='slower'?'slower':t==='more'?'more':'ease')}});
  document.querySelectorAll('[data-pattern]').forEach(function(b){b.onclick=function(e){e.preventDefault();setPattern(b.dataset.pattern)}});
  if($('position'))$('position').onchange=function(){state.position=this.value;save();persistVisuals();line('Position · '+this.selectedOptions[0].textContent)};
  var setupForm=$('setup')&&$('setup').querySelector('form');if(setupForm)setupForm.addEventListener('submit',function(e){if(e.submitter&&e.submitter.value==='cancel')return;initializeFromSetup();persistVisuals()});
  var td=$('telemetry-dialog')&&$('telemetry-dialog').querySelector('form');if(td)td.addEventListener('submit',function(e){if(e.submitter&&e.submitter.value==='cancel')return;[['ct-pace','pace'],['ct-depth','depth'],['ct-force','force'],['ct-energy','intensity']].forEach(function(x){if($(x[0]))state[x[1]]=clamp(Number($(x[0]).value)/100)});if($('ct-pattern'))state.pattern=$('ct-pattern').value;if($('ct-angle'))state.angle=Math.max(-45,Math.min(45,Number($('ct-angle').value)||0));if($('ct-tool'))state.tool=$('ct-tool').value;if($('ct-strokes'))state.target=Math.max(4,Math.min(200,Number($('ct-strokes').value)||40));visuals.videoEnabled=$('ct-video')?$('ct-video').checked:visuals.videoEnabled;visuals.voiceGuidance=$('ct-voice')?$('ct-voice').checked:visuals.voiceGuidance;visuals.toolSolid=$('ct-tool-style')?$('ct-tool-style').value!=='wire':visuals.toolSolid;visuals.waveScale=$('ct-wave-scale')?Math.max(.5,Math.min(2,Number($('ct-wave-scale').value)/100)):visuals.waveScale;visuals.waveMotion=$('ct-wave-motion')?Math.max(.35,Math.min(2,Number($('ct-wave-motion').value)/100)):visuals.waveMotion;state.initialized=true;state.cycleTimeS=Math.max(.7,Math.min(10,5-state.pace*4.3));applyVisuals();save();sync();line('Advanced telemetry and visuals applied.')});
  if($('ct-angle'))$('ct-angle').addEventListener('input',function(){if($('ct-angle-value'))$('ct-angle-value').textContent=this.value+'°'});
  if($('message'))$('message').addEventListener('keydown',function(e){if(e.key==='Enter'){e.preventDefault();send()}});
  window.addEventListener('nocturne:setup',function(){showSetup()});window.addEventListener('pagehide',function(){save();persistVisuals()});
  autoTimer=setInterval(function(){if(state.auto&&state.running&&Date.now()-lastAuto>11000){lastAuto=Date.now();director('Continue the Live session with a coherent next adjustment and give a short spoken cue only when the pattern calls for it.',true).catch(function(){})}},12000);
  if(!window.__NOCTURNE_CONTROL_ROUTER__){window.__NOCTURNE_CONTROL_ROUTER__=true;document.addEventListener('click',routeControlClick,true)}
  assetCore().then(function(m){return m.installServiceWorker()}).catch(function(){});
  window.__NOCTURNE_MOBILE_READY__=true;document.documentElement.dataset.liveBoot='ready';requestAnimationFrame(draw);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})();