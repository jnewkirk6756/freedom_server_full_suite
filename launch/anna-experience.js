const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
export const EXPERIENCE_VERSION='ANNA-EXPERIENCE-0.61';
export const EXPERIENCE_KEY='nocturne.anna.experience.v061';
export function defaultExperience(){return{version:EXPERIENCE_VERSION,preferences:{},patterns:{},signals:[],updatedAt:Date.now()}}
export function normalizeExperience(x={}){const d=defaultExperience();return{...d,...x,preferences:{...d.preferences,...(x.preferences||{})},patterns:{...d.patterns,...(x.patterns||{})},signals:Array.isArray(x.signals)?x.signals.slice(-80):[]}}
function bump(e,key,weight=.25){const p=e.patterns[key]||{evidence:0,confidence:0,lastAt:0};p.evidence+=1;p.confidence=clamp(p.confidence+weight*(1-p.confidence));p.lastAt=Date.now();e.patterns[key]=p}
export function observeExperience(input,{userText='',assistantText=''}={}){const e=normalizeExperience(input),t=String(userText).toLowerCase(),a=String(assistantText).toLowerCase();
  if(/\b(inches|american measurements|imperial)\b/.test(t)){e.preferences.units='in';bump(e,'prefers-inches',.8)}
  if(/\b(millimeters|metric)\b/.test(t)){e.preferences.units='mm';bump(e,'prefers-metric',.8)}
  if(/\b(concise|short answer|keep it short|brief)\b/.test(t)){e.preferences.answerStyle='concise';bump(e,'concise-when-requested',.8)}
  if(/\b(detailed|more detail|go deep|advanced)\b/.test(t)){e.preferences.answerStyle='detailed';bump(e,'detailed-when-requested',.8)}
  if(/\b(next step first|action first|what do i do first)\b/.test(t)){e.preferences.sequence='action-first';bump(e,'action-first',.8)}
  if(/\b(that worked|works|perfect|exactly|that helps|better)\b/.test(t)){e.signals.push({at:Date.now(),type:'positive',text:String(userText).slice(0,160)});bump(e,'recent-approach-positive',.18)}
  if(/\b(that didn't work|not working|wrong|no,|revert|undo)\b/.test(t)){e.signals.push({at:Date.now(),type:'correction',text:String(userText).slice(0,160)});bump(e,'needs-correction',.12)}
  if(a&&/i don't know|uncertain|not sure/.test(a)&&/thanks|good|right/.test(t))bump(e,'uncertainty-accepted',.15);
  e.signals=e.signals.slice(-80);e.updatedAt=Date.now();return e}
export function experienceContext(input){const e=normalizeExperience(input),patterns=Object.entries(e.patterns).filter(([,v])=>v.evidence>=2||v.confidence>=.6).sort((a,b)=>b[1].confidence-a[1].confidence).slice(0,12).map(([id,v])=>({id,evidence:v.evidence,confidence:Number(v.confidence.toFixed(2))}));return{version:e.version,preferences:e.preferences,patterns,recentSignals:e.signals.slice(-8)}}