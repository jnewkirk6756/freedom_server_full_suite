import {VERSION,previewSnapshot} from './reliability-core.js';
import {readBlob,inspectVideo} from './player-storage.js';
import {waitFor} from './player-deck.js';
/** Additive stability layer; never changes credentials or sends private data. */
const note=text=>{const n=document.querySelector('.launch-note');if(n)n.textContent=text;};
const beforeRender=render;
render=function(){
 try{beforeRender();
  document.querySelectorAll('.brand small').forEach(n=>n.textContent='STUDIO / 0.18');
  const card=document.querySelector('.release-card');if(card){const k=card.querySelector('.kicker'),h=card.querySelector('h2'),p=card.querySelector('p');if(k)k.textContent='RELEASE 0.18';if(h)h.textContent='Recover cleanly. Play reliably.';if(p)p.textContent='Startup recovery, saved drafts and a dedicated Loop Deck with reviewed clips, camera-view routing and a WebXR video theater.';const b=card.querySelector('[data-studio=release]');if(b){b.removeAttribute('data-studio');b.textContent='Open the new Loop Deck ↗';b.onclick=()=>{location.href='/player/';};}}
  const nav=document.querySelector('.nav');if(nav&&!nav.querySelector('[data-loop-deck]')){const a=document.createElement('a');a.dataset.loopDeck='';a.href='/player/';a.textContent='▷  Loop Deck / VR';a.style.cssText='display:block;padding:14px;color:#d3b5ff;font:600 14px system-ui';nav.append(a);}
  const hero=document.querySelector('.studio-hero .actions');if(hero){const a=document.createElement('a');a.className='btn secondary';a.href='/player/';a.textContent='Open Loop Deck ↗';hero.append(a);}
  const strip=document.querySelector('.launch-strip');if(strip&&!strip.querySelector('[data-loop-deck]')){const a=document.createElement('a');a.dataset.loopDeck='';a.href='/player/';a.textContent='Loop Deck / VR';strip.append(a);}
 }catch{note('This view could not finish rendering. Your data was not cleared. Export a backup or open the Loop Deck while we recover.');}
};
const beforeSave=save;
save=function(){try{beforeSave();const snap=JSON.stringify(previewSnapshot(localStorage));if(snap.length<1500000)localStorage.setItem('aurelia.recovery.good',snap);}catch(error){note('Saving was interrupted or storage is full. Keep this page open and export before clearing anything.');throw error;}};
// Preserve fields while typing, rather than only on the Next button.
const creatorFields={'c-name':'name','c-age':'age','c-appearance':'appearance','c-hair':'hair','c-eyes':'eyes','c-build':'build','c-wardrobe':'wardrobe','c-cadence':'cadence','c-voice':'voice'};
let timer;
function flush(){clearTimeout(timer);try{if(S.page!=='create')return;for(const [id,key] of Object.entries(creatorFields)){const input=document.getElementById(id);if(input)S.creator[key]=key==='age'?Number(input.value):input.value;}save();}catch{note('The creator draft could not be saved. Your previous saved copy is preserved.');}}
document.addEventListener('input',event=>{if(creatorFields[event.target.id]){clearTimeout(timer);timer=setTimeout(flush,400);}});
document.addEventListener('click',event=>{if(event.target.closest?.('a,[data-nav],#c-next,#c-back'))flush();},true);
window.addEventListener('pagehide',flush);
getMediaBlob=readBlob;
// Stop the old seek/read pipeline from hanging on short, damaged or unsupported clips.
analyzeLoop=async function(file){
 const meta=await inspectVideo(file),v=document.createElement('video'),url=URL.createObjectURL(file),controller=new AbortController();v.muted=true;v.playsInline=true;
 try{const ready=waitFor(v,'loadeddata',controller.signal,10000);v.src=url;v.load();await ready;
  const canvas=document.createElement('canvas');canvas.width=120;canvas.height=Math.max(1,Math.round(120*meta.height/meta.width));const ctx=canvas.getContext('2d',{willReadFrequently:true});
  const sample=async t=>{if(Math.abs(v.currentTime-t)>.01){const done=waitFor(v,'seeked',controller.signal,8000);v.currentTime=t;await done;}ctx.drawImage(v,0,0,canvas.width,canvas.height);return ctx.getImageData(0,0,canvas.width,canvas.height).data;};
  const first=await sample(Math.min(.08,meta.duration*.1)),last=await sample(meta.duration-Math.min(.08,meta.duration*.1));let delta=0;for(let i=0;i<first.length;i+=4)delta+=Math.abs(first[i]-last[i])+Math.abs(first[i+1]-last[i+1])+Math.abs(first[i+2]-last[i+2]);const score=Math.round(100*(1-delta/(first.length/4*3*255)));
  return{...meta,duration:Number(meta.duration.toFixed(2)),score,grade:score>=92?'A':score>=84?'B':score>=72?'C':score>=58?'D':'F',method:'endpoint-pixel-similarity-not-motion-quality'};
 }finally{controller.abort();v.pause();v.removeAttribute('src');v.load();URL.revokeObjectURL(url);}
};
window.addEventListener('unhandledrejection',event=>{event.preventDefault();note('An operation stopped safely. Your files were not cleared. Retry once, or export a recovery copy.');});
window.addEventListener('error',()=>note('A view encountered an error. Export a backup before clearing data; the Loop Deck is a separate recovery-safe view.'));
render();note('V0.18 loaded. Loop Deck adds reviewed clip routing, bounded playback and a paused-session recovery path. Live AI is not connected to this preview.');
