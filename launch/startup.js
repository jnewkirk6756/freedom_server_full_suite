/** Run before legacy app code, so invalid browser data cannot blank the entire app. */
(async()=>{
 const root=document.createElement('section');root.id='startup-recovery';root.setAttribute('role','alert');
 const css=document.createElement('style');css.textContent='#startup-recovery{max-width:680px;margin:6vh auto;padding:26px;border:1px solid #66537d;border-radius:22px;background:#171320;color:#f2edf8;font:16px/1.6 system-ui}#startup-recovery button,#startup-recovery a{display:inline-block;margin:8px 8px 0 0;padding:12px 16px;background:#392747;border:1px solid #816095;border-radius:12px;color:#fff;font:inherit}#startup-recovery code{overflow-wrap:anywhere}#boot-safety-note{background:#281b24;color:#ffddab;padding:12px 20px;font:13px system-ui;position:relative;z-index:100}';document.head.append(css);
 let core,storage;
 function download(){try{const data={format:'aurelia-raw-recovery',encrypted:false,createdAt:new Date().toISOString(),local:{}};for(let i=0;i<storage.length;i++){const k=storage.key(i);if(k?.startsWith('aurelia.'))data.local[k]=storage.getItem(k);}const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='AURELIA-PRIVATE-RAW-RECOVERY.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);}catch{message('Export is blocked by this browser. Do not clear its storage.');}}
 function message(s){root.querySelector('p').textContent=s;}
 function recover(issues,reason){
  document.getElementById('app')?.setAttribute('hidden','');
  root.replaceChildren();const h=document.createElement('h1');h.textContent='Your work is still here.';const p=document.createElement('p');p.textContent=reason||'A saved setting could not be read. The application stopped safely without deleting your profile or media.';root.append(h,p);
  const exportBtn=document.createElement('button');exportBtn.textContent='Export raw recovery copy';exportBtn.onclick=download;root.append(exportBtn);
  const last=document.createElement('button');last.textContent='Restore last good checkpoint';last.onclick=()=>{try{const snap=core.safeParse(storage.getItem('aurelia.recovery.good')||'null');if(!snap)throw Error();if(!confirm('Restore the last good metadata checkpoint? Current metadata will be copied to recovery quarantine first. Video files will not be deleted.'))return;core.restoreSnapshot(storage,snap);location.reload();}catch{message('No restorable checkpoint is available, or storage is full. Export the raw recovery copy first.');}};root.append(last);
  if(issues.some(i=>i.key)){
   const reset=document.createElement('button');reset.textContent='Repair unreadable settings';reset.onclick=()=>{if(!confirm('Copy unreadable settings to quarantine, then reset ONLY those fields? Other data and media will stay intact. Export first for an independent copy.'))return;try{const bad={};for(const i of issues)if(i.key)bad[i.key]=storage.getItem(i.key);storage.setItem('aurelia.recovery.quarantine',JSON.stringify({createdAt:new Date().toISOString(),local:bad}));for(const k of Object.keys(bad))storage.removeItem(k);location.reload();}catch{message('Repair could not be saved. Nothing was intentionally deleted. Export recovery before clearing anything.');}};root.append(reset);
  }
  const note=document.createElement('small');note.textContent='Recovery exports contain personal data and are not encrypted. Keep them private. No data is uploaded.';root.append(document.createElement('br'),note);document.body.append(root);
 }
 try{
  core=await import('/reliability-core.js');storage=localStorage;
  const checked=core.inspectStorage(storage);if(!checked.ok){recover(checked.issues);return;}
  globalThis.AureliaBoot={ready:true,version:core.VERSION};
  // Keep one bounded metadata checkpoint, not copies of large media blobs.
  try{const snap=JSON.stringify(core.previewSnapshot(storage));if(snap.length<1500000)storage.setItem('aurelia.recovery.good',snap);}catch{}
  const template=document.querySelector('#aurelia-core');
  if(template){const classic=document.createElement('script');classic.textContent=template.textContent;document.body.append(classic);await import('/studio.js');await import('/stability.js');}
  else await import('/player.js');
 }catch{recover([],'The app could not finish starting. Your saved data has not been cleared. Reload once or export a recovery copy.');}
})();
