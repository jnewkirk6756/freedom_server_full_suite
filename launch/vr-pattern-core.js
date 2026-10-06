(function(g){
'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const wrap=v=>((Number(v)||0)%1+1)%1;
const halfCos=q=>(1-Math.cos(wrap(q)*Math.PI*2))/2;
const smooth=t=>{t=clamp(t);return t*t*(3-2*t)};
const PATTERNS=['steady','wave','pulse','build','variable','double','triple','hold','glide','syncopated','custom'];
const LABELS={steady:'STEADY',wave:'WAVE',pulse:'PULSE',build:'BUILD',variable:'VARIABLE',double:'DOUBLE',triple:'TRIPLE',hold:'HOLD CREST',glide:'GLIDE',syncopated:'SYNCOPATED',custom:'CUSTOM'};
const HAPTICS=['auto','sync','crest','heartbeat','doubletap','ripple','crescendo','off'];
const HAPTIC_LABELS={auto:'AUTO',sync:'SYNC',crest:'CREST',heartbeat:'HEARTBEAT',doubletap:'DOUBLE TAP',ripple:'RIPPLE',crescendo:'CRESCENDO',off:'OFF'};
function customSample(q,arr){if(!Array.isArray(arr)||arr.length<4)return halfCos(q);const c=arr.slice(0,256).map(v=>clamp(v));const t=wrap(q)*(c.length-1),i=Math.min(c.length-2,Math.floor(t)),f=t-i;return clamp(c[i]+(c[i+1]-c[i])*f)}
function raw(name,q,ctx={}){
 q=wrap(q);const cyc=Math.max(0,Number(ctx.cycle)||0),base=halfCos(q);let v=base;
 switch(name){
  case'wave':{const pivot=.58;if(q<=pivot)v=Math.pow(Math.sin((q/pivot)*Math.PI/2),2);else v=Math.pow(Math.cos(((q-pivot)/(1-pivot))*Math.PI/2),2);break}
  case'pulse':v=Math.pow(base,2.65);break;
  case'build':v=base*(.58+.42*((cyc%8)+1)/8);break;
  case'variable':v=clamp(base*(.72+.28*((Math.sin(cyc*1.37+q*Math.PI*4)+1)/2)));break;
  case'double':v=halfCos(q*2);break;
  case'triple':v=halfCos(q*3);break;
  case'hold':if(q<.28)v=smooth(q/.28);else if(q<.68)v=1;else v=1-smooth((q-.68)/.32);break;
  case'glide':v=Math.pow(base,.62);break;
  case'syncopated':{if(q<.42)v=halfCos(q/.42);else if(q<.67)v=.18*halfCos((q-.42)/.25);else v=.82*halfCos((q-.67)/.33);break}
  case'custom':v=customSample(q,ctx.custom);break;
  default:v=base;
 }
 if(ctx.dynamic&&name!=='custom'){
   const depthWave=.84+.16*((Math.sin(cyc*1.11+1.2)+1)/2),micro=.94+.06*Math.sin((q*Math.PI*2)+(cyc*.71));
   v=clamp(v*depthWave*micro);
 }
 return clamp(v);
}
function sample(name,q,ctx={}){
 const id=PATTERNS.includes(name)?name:'steady',phase=wrap(q),fraction=raw(id,phase,ctx),eps=.002,next=raw(id,phase+eps,ctx),prev=raw(id,phase-eps,ctx),slope=(next-prev)/(eps*2);
 return{pattern:id,phase,fraction,slope,direction:Math.abs(slope)<.03?'STILL':slope>0?'FORWARD':'RETURN',seated:fraction>=.94,strokeUnits:strokeUnits(id)};
}
function strokeUnits(name){return name==='double'?2:name==='triple'?3:name==='syncopated'?2:1}
function peakPhases(name){
 if(name==='double')return[.25,.75];if(name==='triple')return[1/6,.5,5/6];if(name==='syncopated')return[.21,.835];if(name==='hold')return[.32];return[.5];
}
function resolveHapticMode(pattern,mode='auto'){if(mode!=='auto')return HAPTICS.includes(mode)?mode:'sync';if(pattern==='pulse')return'doubletap';if(pattern==='build')return'crescendo';if(pattern==='wave'||pattern==='glide')return'ripple';if(pattern==='double'||pattern==='triple'||pattern==='syncopated')return'sync';if(pattern==='hold')return'crest';return'sync'}
function hapticEvents(pattern,mode='auto',ctx={}){
 const m=resolveHapticMode(pattern,mode),intensity=clamp(ctx.intensity),force=clamp(ctx.force),base=.26+intensity*.42+force*.22,peaks=peakPhases(pattern),ev=[];
 const add=(phase,strength=1,duration=52)=>ev.push({phase:clamp(phase),strength:clamp(base*strength,.05,1),duration:Math.max(18,Math.min(220,Math.round(duration)))});
 if(m==='off')return[];
 if(m==='sync'){for(const p of peaks)add(p,1,44+intensity*58)}
 else if(m==='crest'){for(const p of peaks)add(p,.92,90+intensity*80)}
 else if(m==='heartbeat'){for(const p of peaks){add(p-.035,.88,54);add(p+.045,.56,42)}}
 else if(m==='doubletap'){for(const p of peaks){add(p-.028,.92,38);add(p+.038,.62,34)}}
 else if(m==='ripple'){for(const p of peaks){add(p-.10,.35,26);add(p-.05,.52,30);add(p,.86,38);add(p+.055,.48,28)}}
 else if(m==='crescendo'){const seq=[.20,.34,.48,.62,.76,.88];seq.forEach((p,i)=>add(p,.28+i*.13,28+i*7))}
 return ev.filter(x=>x.phase>=0&&x.phase<=1).sort((a,b)=>a.phase-b.phase);
}
function nextPattern(current){const i=PATTERNS.indexOf(current);return PATTERNS[(i<0?0:i+1)%PATTERNS.length]}
function nextHaptic(current){const i=HAPTICS.indexOf(current);return HAPTICS[(i<0?0:i+1)%HAPTICS.length]}
function describe(name){return LABELS[PATTERNS.includes(name)?name:'steady']}
g.NocturneVrPatterns={version:'0.81.0',patterns:PATTERNS.slice(),labels:{...LABELS},hapticModes:HAPTICS.slice(),hapticLabels:{...HAPTIC_LABELS},sample,strokeUnits,peakPhases,hapticEvents,resolveHapticMode,nextPattern,nextHaptic,describe};
})(globalThis);
