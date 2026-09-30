import './preview-enhancements.js';
/** 0.13 device-preview polish. This module never calls a model or posts user data. */
const note = document.querySelector('.launch-note');
const report = text => { if(note)note.textContent=text; };
const styles=document.createElement('style');
styles.textContent=`.local-save-label{font:11px system-ui;color:#b7d8c4;margin:10px 0}.local-save-label:empty{display:none}.mediaempty{z-index:0}.mediastage video{z-index:1}input,textarea,select{font-size:16px}.photocard img[hidden]{display:none}button:focus-visible,a:focus-visible{outline:2px solid #cba6ff;outline-offset:3px}@media(min-width:681px){.mobilebar{display:none!important}}@media(max-width:680px){.main{padding-bottom:calc(110px + env(safe-area-inset-bottom))}.launch-strip{font-size:11px;padding:10px 12px;gap:9px}}`;
document.head.append(styles);
let saveTimer;
const fields={
 'a-name':'preferredName','a-pronouns':'pronouns','a-home':'homeBase','a-work':'occupation',
 'a-bio':'bio','a-interests':'interests','a-goals':'goals','a-comm':'communicationStyle',
 'a-likes':'likes','a-dislikes':'dislikes','a-boundaries':'boundaries','a-people':'importantPeople',
 'a-routines':'routines','a-notes':'aiNotes'
};
// Text-only autosave: consent switches still require the explicit Save action.
function saveProfileText(){
 if(S.page!=='about')return;
 for(const [id,key] of Object.entries(fields)){const el=document.getElementById(id);if(el)S.about[key]=el.value.trim().slice(0,12000);}
 try{save();report('Profile text saved on this device. Sharing switches take effect when you press Save About You.');}
 catch{report('This browser could not save the changes. Export a backup before clearing anything.');}
}
document.addEventListener('input',event=>{
 if(!fields[event.target.id])return;
 clearTimeout(saveTimer);saveTimer=setTimeout(saveProfileText,700);
});
document.addEventListener('click',event=>{
 if(event.target.closest?.('[data-nav]')&&S.page==='about'){clearTimeout(saveTimer);saveProfileText();}
},true);
window.addEventListener('pagehide',()=>{clearTimeout(saveTimer);saveProfileText();});
// Read previously stored media without changing/deleting the old databases.
async function existingBlob(name,store,id){
 return new Promise(resolve=>{
  const req=indexedDB.open(name);
  req.onupgradeneeded=()=>{req.transaction.abort();};
  req.onerror=()=>resolve(null);
  req.onblocked=()=>resolve(null);
  req.onsuccess=()=>{const db=req.result;if(!db.objectStoreNames.contains(store)){db.close();return resolve(null);}
   const tx=db.transaction(store,'readonly'),get=tx.objectStore(store).get(id);
   get.onsuccess=()=>resolve(get.result?.blob||null);get.onerror=()=>resolve(null);tx.oncomplete=()=>db.close();
  };
 });
}
const priorGet=getMediaBlob;
getMediaBlob=async function(id){
 let found;try{found=await priorGet(id);}catch{}
 if(found)return found;
 for(const db of ['aurelia-preview-media-v08','aurelia-preview-media-v010']){const b=await existingBlob(db,'clips',id);if(b)return b;}
 return null;
};
const priorRender=render;
render=function(){
 priorRender();
 document.querySelectorAll('.brand small').forEach(n=>n.textContent='V0.13 · Device preview');
 document.querySelectorAll('.devtag').forEach(n=>n.textContent='LOCAL DATA · LIVE AI NOT CONNECTED');
 document.querySelectorAll('.meta,.muted.small').forEach(n=>{
  if(n.textContent.includes('scripted')||n.textContent.includes('local personality logic'))n.textContent='Live AI is not connected. Messages are not sent from this preview.';
 });
 const title=document.querySelector('h1');if(title&&S.page==='companion'&&S.avatar)title.textContent=S.avatar.name;
 const chat=document.querySelector('#chat-form');if(chat){const send=chat.querySelector('button');if(send){send.disabled=true;send.textContent='AI connection pending';}const input=chat.querySelector('textarea');if(input)input.placeholder='Live conversation opens after the private backend and AI credential are configured.';}
 if(S.page==='about'){
  const h=document.querySelector('.contextscore');if(h){h.setAttribute('aria-label','Profile fields filled. This is not a measure of AI quality.');}
 }
};
render();
report('V0.13 preview. Profile text autosaves locally; live account sync and AI are not connected.');
