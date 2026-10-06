(function(g){
'use strict';
if(g.NocturneSession&&g.NocturneSession.VERSION==='0.81.0')return;
var VERSION='0.81.0',KEY='nocturne.session.v0750',MOBILE='nocturne.mobile.session.v0710',VR='nocturne.vr.session.v070',TELEMETRY='nocturne.telemetry.v1';
var clamp=function(v){v=Number(v)||0;return Math.max(0,Math.min(1,v))};
function defaults(){return{schema:1,version:VERSION,initialized:false,running:false,pace:0,depth:0,force:0,intensity:0,entrySpeedS:3,cycleTimeS:3,cadence:0,pattern:'steady',hapticMode:'auto',dynamicStrokes:true,recordedPattern:[],videoState:'A01',faceState:'ANNA_02_ATTENTIVE',embodied:'attentive',position:'back',startedAt:0,updatedAt:0,source:'boot'};}
function validPattern(v){return ['steady','wave','pulse','build','variable','double','triple','hold','glide','syncopated','custom'].indexOf(v)>=0?v:'steady'}
function validHaptic(v){return ['auto','sync','crest','heartbeat','doubletap','ripple','crescendo','off'].indexOf(v)>=0?v:'auto'}
function normalize(x){
  x=x&&typeof x==='object'?x:{};var d=defaults(),o=Object.assign({},d,x);
  o.initialized=x.initialized===true;o.running=x.running===true&&o.initialized;
  ['pace','depth','force','intensity'].forEach(function(k){o[k]=clamp(x[k])});
  o.entrySpeedS=Math.max(.5,Math.min(10,Number(x.entrySpeedS)||3));
  o.cycleTimeS=Math.max(.7,Math.min(10,Number(x.cycleTimeS)||3));
  o.cadence=Math.max(0,Math.min(100,Number.isFinite(Number(x.cadence))?Number(x.cadence):Math.round(o.pace*100)));
  o.pattern=validPattern(x.pattern);o.hapticMode=validHaptic(x.hapticMode);o.dynamicStrokes=x.dynamicStrokes!==false;o.recordedPattern=Array.isArray(x.recordedPattern)?x.recordedPattern.slice(0,256).map(clamp):[];o.videoState=String(x.videoState||'A01').toUpperCase().slice(0,5);o.faceState=/^ANNA_\d{2}_[A-Z0-9_]+$/.test(String(x.faceState||''))?String(x.faceState):'ANNA_02_ATTENTIVE';
  o.embodied=String(x.embodied||'attentive').toLowerCase().slice(0,24);o.position=String(x.position||'back').slice(0,24);
  o.startedAt=Math.max(0,Number(x.startedAt)||0);o.updatedAt=Math.max(0,Number(x.updatedAt)||0);o.source=String(x.source||'unknown').slice(0,40);
  if(!o.initialized){o.running=false;o.pace=0;o.depth=0;o.force=0;o.intensity=0;o.cadence=0;o.startedAt=0}
  return o;
}
function parse(store,key){try{return JSON.parse(store.getItem(key)||'null')}catch(e){return null}}
function newest(){
  var items=[],shared=parse(sessionStorage,KEY),m=parse(sessionStorage,MOBILE),v=parse(sessionStorage,VR);
  if(shared)items.push(shared);if(m)items.push(Object.assign({source:'legacy-mobile'},m));if(v)items.push(Object.assign({source:'legacy-vr'},v));
  if(!items.length)return defaults();
  items.sort(function(a,b){return Number(b.updatedAt||b.startedAt||0)-Number(a.updatedAt||a.startedAt||0)});
  return normalize(items[0]);
}
function mirror(s){
  try{sessionStorage.setItem(KEY,JSON.stringify(s))}catch(e){}
  try{sessionStorage.setItem(MOBILE,JSON.stringify(s))}catch(e){}
  try{sessionStorage.setItem(VR,JSON.stringify({initialized:s.initialized,running:s.running,pace:s.pace,depth:s.depth,force:s.force,intensity:s.intensity,entrySpeedS:s.entrySpeedS,cycleTimeS:s.cycleTimeS,cadence:s.cadence,pattern:s.pattern,hapticMode:s.hapticMode,dynamicStrokes:s.dynamicStrokes,recordedPattern:s.recordedPattern,videoState:s.videoState,faceState:s.faceState,embodied:s.embodied,position:s.position,startedAt:s.startedAt,updatedAt:s.updatedAt}))}catch(e){}
  try{localStorage.setItem(TELEMETRY,JSON.stringify({pace:s.pace,depth:s.depth,force:s.force,intensity:s.intensity,pattern:s.pattern,hapticMode:s.hapticMode,dynamicStrokes:s.dynamicStrokes,cadence:s.cadence,videoState:s.videoState,faceState:s.faceState,updatedAt:s.updatedAt}))}catch(e){}
}
var current=newest();mirror(current);
function emit(reason){try{window.dispatchEvent(new CustomEvent('nocturne:session',{detail:{reason:reason||'commit',state:snapshot()}}))}catch(e){}}
function snapshot(){return Object.assign({},current)}
function commit(patch,source){
  current=normalize(Object.assign({},current,patch||{},{updatedAt:Date.now(),source:source||patch?.source||'runtime'}));mirror(current);emit(source||'commit');return snapshot();
}
function initialize(opts,source){
  opts=opts||{};var cycle=Math.max(.7,Math.min(10,Number(opts.cycleTimeS||opts.strokeSpeedS)||3));
  var pace=Number.isFinite(Number(opts.pace))?clamp(opts.pace):clamp((5-cycle)/4.3);
  return commit({initialized:true,running:false,pace:pace,depth:clamp(Number(opts.depth)||0),force:clamp(Number(opts.force)||0),intensity:clamp(Number.isFinite(Number(opts.intensity))?opts.intensity:.2),entrySpeedS:Math.max(.5,Math.min(10,Number(opts.entrySpeedS)||3)),cycleTimeS:cycle,cadence:Math.round(pace*100),pattern:validPattern(opts.pattern||'steady'),hapticMode:validHaptic(opts.hapticMode||'auto'),dynamicStrokes:opts.dynamicStrokes!==false,recordedPattern:Array.isArray(opts.recordedPattern)?opts.recordedPattern.slice(0,256).map(clamp):[],videoState:opts.videoState||current.videoState||'A01',faceState:opts.faceState||current.faceState||'ANNA_02_ATTENTIVE',embodied:opts.embodied||current.embodied||'attentive',position:opts.position||current.position||'back',startedAt:0},source||'initialize');
}
function reset(source){current=defaults();current.updatedAt=Date.now();current.source=source||'reset';mirror(current);emit(source||'reset');return snapshot()}
function bridge(){current=newest();mirror(current);return snapshot()}
g.NocturneSession={VERSION:VERSION,KEY:KEY,snapshot:snapshot,commit:commit,initialize:initialize,reset:reset,bridgeLegacy:bridge};
})(window);