import {LOOKS,FREE_AVATARS,canCreateCharacter} from './world-core.js';
/** Additive migration: retain all old characters and media, cap future free creation at one. */
const announce=text=>{const el=document.querySelector('.launch-note');if(el)el.textContent=text;};
const priorRender=render;
render=function(){priorRender();document.querySelectorAll('.brand small').forEach(el=>el.textContent='STUDIO / 0.19');
 const nav=document.querySelector('.nav');if(nav&&!nav.querySelector('[data-spatial]')){const a=document.createElement('a');a.href='/world/';a.dataset.spatial='';a.textContent='◇  Spatial Rooms / VR';a.style.cssText='display:block;padding:14px;color:#dfc3f3;font:600 14px system-ui';nav.append(a);}
 const strip=document.querySelector('.launch-strip');if(strip&&!strip.querySelector('[data-spatial]')){const a=document.createElement('a');a.href='/world/';a.dataset.spatial='';a.textContent='Spatial Rooms / VR';strip.append(a);}
 const hero=document.querySelector('.studio-hero .actions');if(hero){const a=document.createElement('a');a.className='btn primary';a.href='/world/';a.textContent='Enter your 3D rooms ↗';hero.prepend(a);}
 document.querySelectorAll('.hero-foot').forEach(el=>el.textContent='One free character · Existing beta characters preserved · Device-local preview');
 document.querySelectorAll('.beta-tag').forEach(el=>el.textContent='FREE / 1 CHARACTER');
 document.querySelectorAll('.empty-slot').forEach(el=>{if(!canCreateCharacter(S.avatars))el.remove();});
 document.querySelectorAll('.nav [data-nav=library] small').forEach(el=>el.textContent=S.avatars.length>1?`${S.avatars.length} legacy`:`${S.avatars.length}/1`);
 document.querySelectorAll('.metric-row>div:first-child p').forEach(el=>el.textContent=S.avatars.length>1?'Legacy beta characters retained':'One character included');
 document.querySelectorAll('.metric-row>div:first-child strong small').forEach(el=>el.textContent=S.avatars.length>1?' legacy':' / 1');
 if(S.page==='create'){
  for(const [id,values] of Object.entries({'c-hair':LOOKS.hairColor,'c-eyes':LOOKS.eyes,'c-build':LOOKS.build,'c-wardrobe':LOOKS.wardrobe})){const old=document.getElementById(id);if(!old||old.tagName==='SELECT')continue;const select=document.createElement('select');select.id=id;const items=[...new Set([old.value,...values].filter(Boolean))];for(const v of items){const o=document.createElement('option');o.value=o.textContent=v;select.append(o);}old.replaceWith(select);}
  if(!canCreateCharacter(S.avatars)){const btn=document.getElementById('c-commission');if(btn){btn.disabled=true;btn.textContent='Free character already created';}}
 }
 document.querySelectorAll('.release-card').forEach(card=>{const h=card.querySelector('h2'),p=card.querySelector('p');if(h)h.textContent='A room you can inhabit.';if(p)p.textContent='Bedroom, bathroom and living room in actual 3D. Use the spatial menus, character looks and saved generation setups without leaving immersive mode.';});
};
document.addEventListener('click',e=>{const t=e.target.closest?.('[data-nav="create"],#c-commission');if(t&&!canCreateCharacter(S.avatars)){e.preventDefault();e.stopImmediatePropagation();announce('The free plan includes one character. Existing beta characters stay accessible. Extra-character checkout is not active; nothing has been charged.');}},true);
const css=document.createElement('style');css.textContent='.studio .card,.studio .avatar-card{transition:box-shadow .22s,border-color .22s}.studio .card:hover,.studio .avatar-card:hover{border-color:#76618b66}.studio .main{animation:aurelia-enter .22s ease-out}@keyframes aurelia-enter{from{opacity:.65;transform:translateY(7px)}to{opacity:1;transform:none}}@media(prefers-reduced-motion:reduce){.studio .main{animation:none}}';document.head.append(css);render();
announce('V0.19 Spatial Rooms · 1 free character · Room preferences and loop setups saved locally. Live AI and model generation remain unconnected.');
