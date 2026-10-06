(function(g){
'use strict';
let activeAudio=null,activeUrl='',seq=0,lastAt=0;
function cleanup(){try{activeAudio?.pause?.()}catch{}if(activeUrl)try{URL.revokeObjectURL(activeUrl)}catch{}activeAudio=null;activeUrl=''}
async function ensureToken(){
  let token=sessionStorage.getItem('nocturne.staging.token')||'';if(token)return token;
  try{const r=await fetch('/v1/director/status'),d=await r.json();if(d.sessionToken){token=d.sessionToken;sessionStorage.setItem('nocturne.staging.token',token)}}catch{}
  return token;
}
function chooseBrowserVoice(){
  if(!('speechSynthesis'in g))return null;const voices=speechSynthesis.getVoices?.()||[],en=voices.filter(v=>/^en(?:-|_)/i.test(v.lang||''));
  const pref=['Ava','Samantha','Victoria','Tessa','Karen','Moira','Zira','Serena','Google US English'];
  for(const name of pref){const v=en.find(x=>String(x.name).toLowerCase().includes(name.toLowerCase()));if(v)return v}
  return en[0]||voices[0]||null;
}
function browserFallback(text,mySeq){
  if(!('speechSynthesis'in g)||mySeq!==seq)return false;
  try{speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(String(text).slice(0,500)),v=chooseBrowserVoice();if(v)u.voice=v;u.rate=.92;u.pitch=.97;u.volume=.94;
    u.onstart=()=>g.dispatchEvent(new CustomEvent('nocturne:voice-start',{detail:{engine:'browser'}}));
    u.onend=()=>g.dispatchEvent(new CustomEvent('nocturne:voice-end',{detail:{engine:'browser'}}));
    speechSynthesis.speak(u);return true;
  }catch{return false}
}
async function speak(text,{force=false,minGap=5500}={}){
  const s=String(text||'').trim();if(!s)return false;const now=Date.now();if(!force&&now-lastAt<minGap)return false;lastAt=now;const mySeq=++seq;cleanup();try{speechSynthesis?.cancel?.()}catch{}
  try{
    const token=await ensureToken();if(!token)throw Error('no session');
    const r=await fetch('/v1/voice/speak',{method:'POST',headers:{'content-type':'application/json','x-nocturne-session':token},body:JSON.stringify({text:s.slice(0,900)})});
    if(!r.ok)throw Error('neural voice '+r.status);const blob=await r.blob();if(!blob.size||mySeq!==seq)return false;
    activeUrl=URL.createObjectURL(blob);activeAudio=new Audio(activeUrl);activeAudio.preload='auto';activeAudio.volume=.96;
    activeAudio.onplay=()=>g.dispatchEvent(new CustomEvent('nocturne:voice-start',{detail:{engine:'neural'}}));
    activeAudio.onended=()=>{if(mySeq===seq){cleanup();g.dispatchEvent(new CustomEvent('nocturne:voice-end',{detail:{engine:'neural'}}))}};
    activeAudio.onerror=()=>{if(mySeq===seq){cleanup();browserFallback(s,mySeq)}};
    await activeAudio.play();return true;
  }catch{return browserFallback(s,mySeq)}
}
function stop(){seq++;cleanup();try{speechSynthesis?.cancel?.()}catch{}g.dispatchEvent(new CustomEvent('nocturne:voice-end',{detail:{engine:'stop'}}))}
g.NocturneVoice={version:'0.82.0',speak,stop,chooseBrowserVoice};
})(window);
