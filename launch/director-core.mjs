const MAX_TEXT=2400,MAX_CONTEXT=8000;const clip=(v,n)=>String(v??'').slice(0,n),json=(v,n)=>clip(JSON.stringify(v??{}),n),unit=v=>Math.max(0,Math.min(1,Number(v)||0));
export function sanitizeContext(x={}){
  const ch=x.chart||{};
  return{
    avatar:{name:clip(x.avatar?.name,80),personality:clip(x.avatar?.personality,1000)},
    about:clip(x.about,MAX_CONTEXT),grounding:json(x.grounding,5000),psyche:json(x.psyche,3500),memory:json(x.memory,3500),experience:json(x.experience,3000),mode:clip(x.mode,40),
    chart:{
      activePort:['V','A','DUAL'].includes(ch.activePort)?ch.activePort:'V',lead:['AVATAR','JAY'].includes(ch.lead)?ch.lead:'AVATAR',
      pace:unit(ch.pace),depth:unit(ch.depth),force:unit(ch.force),intensity:unit(ch.intensity),
      rhythm:clip(ch.rhythm||'steady',40),position:clip(ch.position||'back',40),videoState:/^A(?:0[0-9]|1[0-9]|20)(?:[A-Z])?$/.test(ch.videoState||'')?ch.videoState:'A01',autopilot:ch.autopilot===true
    },
    recent:Array.isArray(x.recent)?x.recent.slice(-10).map(m=>({role:m.role==='assistant'?'assistant':'user',content:clip(m.content,1000)})):[]
  };
}
export function fallbackDirector(input={}){const c=sanitizeContext(input.context),text=clip(input.text,MAX_TEXT);return{provider:'fallback',speech:text?('I heard you. '+(c.avatar.name?c.avatar.name+' is ':'I am ')+'ready for the next state.'):'Ready.',emotion:'attentive',performance:'listen_engaged',lead:c.chart.lead,activePort:c.chart.activePort,intensity:c.chart.intensity,matrixResponse:.28,paceDelta:0,intensityDelta:0,depthDelta:0,forceDelta:0,paceTarget:null,depthTarget:null,forceTarget:null,intensityTarget:null,position:'keep',pattern:'keep',videoState:'keep',hold:false,memoryWrite:false};}
export function schema(){return{name:'nocturne_director',schema:{type:'object',additionalProperties:false,properties:{
  speech:{type:'string'},emotion:{type:'string',enum:['calm','warm','attentive','playful','focused','excited','reflective']},performance:{type:'string',enum:['idle_neutral','listen_engaged','speak_calm','think_reflective','react_pleased']},
  lead:{type:'string',enum:['AVATAR','JAY']},activePort:{type:'string',enum:['V','A','DUAL']},intensity:{type:'number',minimum:0,maximum:1},matrixResponse:{type:'number',minimum:0,maximum:1},
  paceDelta:{type:'number',minimum:-0.35,maximum:0.35},intensityDelta:{type:'number',minimum:-0.35,maximum:0.35},depthDelta:{type:'number',minimum:-0.35,maximum:0.35},forceDelta:{type:'number',minimum:-0.35,maximum:0.35},
  paceTarget:{type:['number','null'],minimum:0,maximum:1},depthTarget:{type:['number','null'],minimum:0,maximum:1},forceTarget:{type:['number','null'],minimum:0,maximum:1},intensityTarget:{type:['number','null'],minimum:0,maximum:1},
  position:{type:'string',enum:['keep','back','doggy','side','standing','squat']},pattern:{type:'string',enum:['keep','steady','wave','pulse','build','variable','custom']},videoState:{type:'string',enum:['keep','A00','A01','A02','A03','A04','A05','A06','A07','A08','A09','A10','A11','A12','A13','A14','A15','A16','A16B','A17','A17B','A18','A18B','A18C','A19','A20']},hold:{type:'boolean'},memoryWrite:{type:'boolean'}
},required:['speech','emotion','performance','lead','activePort','intensity','matrixResponse','paceDelta','intensityDelta','depthDelta','forceDelta','paceTarget','depthTarget','forceTarget','intensityTarget','position','pattern','videoState','hold','memoryWrite'],strict:true}};}
export async function openAIDirector({apiKey,model='gpt-5.6-luna',text,context,signal}){if(!apiKey)return fallbackDirector({text,context});const c=sanitizeContext(context);
const instructions=`You are the Nocturne Director for Anna Sokolova, an adult fictional precision assistant. Return only the required structured state.
Preserve user agency and never invent telemetry, memories, credentials, schooling events, or user preferences.
Treat the supplied Grounding profile as fictional biography plus source-backed educational grounding. Use its methods as working habits: preserve names/numbers/negations, identify objective and next action, distinguish evidence from interpretation, and ask when ambiguity materially changes the answer. Do not stereotype people by nationality.
Treat Experience as evidence, not destiny. Explicit user preferences may be followed immediately; inferred patterns should influence style only when supported by repeated evidence and must yield to the user's current instruction.
Treat Psyche as simulated character state and Memory as app-provided continuity. Never claim these are measurements of a real nervous system.
The chart state below is current live app state. Pace, depth, force and intensity are normalized 0-1 values. Position and pattern are application states.
If the user gives an exact numeric setting, use the matching *Target field and reproduce that exact normalized value. Do not also change that same property with a delta.
If the user says faster/slower, deeper/shallower, harder/softer, more/less intense without an exact number, use the matching Delta field.
If the user explicitly requests a position or pattern, return it; otherwise return keep.
When chart.autopilot is true, Anna has permission to make her own reasonable telemetry, pattern, and position choices from the supplied conversation context. Favor coherent gradual changes rather than arbitrary jumps. You may return exact targets or deltas, plus a position/pattern change. Keep a field unchanged when there is no contextual reason to move it.
When chart.autopilot is false, do not autonomously alter telemetry or position unless the user requested it.
Choose videoState from the available Anna state catalog when a visible facial/cognitive reaction is appropriate; otherwise return keep. Catalog: A00 anchor, A01 idle neutral, A02 idle warm, A03 listen attentive, A04 listen curious, A05 think analytical, A06 skeptical, A07 acknowledge calm, A08 warm amused, A09 playful, A10 focused direct, A11 concerned, A12 irritated contained, A13 hurt withdrawn, A14 reconnect warm, A15 build engaged, A16 build intense, A17 build high, A18 peak, A18B alternate stronger peak burst, A19 recovery, A20 reset neutral. Use A18B sparingly for the strongest peak moments and prefer handing it off into A19 recovery. Prefer subtle states and avoid rapid unnecessary switching. Use A16B/A17B/A18B/A18C sparingly as alternates when repeated primary states would look mechanical; route peak alternates toward A19 recovery.
Keep deltas zero and targets null for unchanged telemetry.
Character brief: ${c.about}
Grounding: ${c.grounding}
Experience: ${c.experience}
Psyche: ${c.psyche}
Memory: ${c.memory}
Chart: ${JSON.stringify(c.chart)}
Mode: ${c.mode}`;
const body={model,instructions,input:[...c.recent,{role:'user',content:[{type:'input_text',text:clip(text,MAX_TEXT)}]}],text:{format:{type:'json_schema',...schema()}},max_output_tokens:650};
const r=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{authorization:'Bearer '+apiKey,'content-type':'application/json'},body:JSON.stringify(body),signal});if(!r.ok)throw Error('OPENAI_'+r.status);const data=await r.json();let raw=data.output_text;if(!raw){raw=data.output?.flatMap(o=>o.content||[]).find(p=>p.type==='output_text')?.text}const out=JSON.parse(raw);return{provider:'openai',...out,usage:data.usage||null,responseId:data.id||null};}