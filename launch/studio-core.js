/** Pure view-model helpers. No provider, payment or network calls. */
export const STUDIO_VERSION='0.14.0';
export const NAV=[['home','Overview','home'],['library','Avatars','avatar'],['companion','Companion','chat'],['media','Media Studio','media'],['about','About You','profile'],['account','Settings','settings']];
export const TOKENS={version:STUDIO_VERSION,color:{canvas:'#0b0c12',surface:'#13151f',raised:'#1b1d2a',border:'#2c3041',text:'#f4f3fc',muted:'#a8afc3',accent:'#bd9bff',positive:'#a0dfc6'},radius:{control:12,card:22},spacing:{unit:4,card:24,touchTarget:48},type:{body:16,caption:12,display:48},motion:{durationMs:160,respectsReducedMotion:true}};
export const escapeHTML=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function updateAvatar(original,patch){
 const name=String(patch.name??'').trim(),age=Number(patch.age);
 if(!name||name.length>40)throw Error('Use an avatar name between 1 and 40 characters.');
 if(!Number.isInteger(age)||age<18||age>120)throw Error('Avatar age must be a whole number between 18 and 120.');
 return {...original,name,age,studioNotes:String(patch.studioNotes??'').trim().slice(0,2000),updatedAt:new Date().toISOString()};
}
export function mediaForAvatar(items,avatarId){return (items||[]).filter(x=>!x.avatarId||x.avatarId===avatarId);}
export function filterMedia(items,query='',state='all'){const q=String(query).toLowerCase().trim();return items.filter(x=>(state==='all'||x.state===state)&&`${x.name||''} ${x.state||''} ${x.family||''}`.toLowerCase().includes(q));}
export function profileFieldCount(profile){return ['preferredName','bio','interests','goals','communicationStyle','likes','boundaries','aiNotes'].filter(k=>String(profile?.[k]||'').trim()).length;}
export function contextSummary(profile){return {shared:profile?.shareWithAI===true,fields:profile?.shareWithAI===true?Object.entries(profile).filter(([k,v])=>!['shareWithAI','usePhotosWithAI'].includes(k)&&typeof v==='string'&&v.trim()).map(([key])=>key):[],photosAutomaticallyAttached:false,networkRequest:false};}
