/** Measurement review contract. Tracker values remain approximate and are never plan geometry. */
export const ASSIST_PATH='/v1/meridian/measurements/assist';
export const ASSIST_PROTOCOL='meridian-measurement-assist-v1';
export const ASSIST_MODEL='gpt-5.4-mini-2026-03-17';
export const ASSIST_ALLOWANCE_MICROS=100000;
export const ASSIST_OUTPUT_TOKENS=800;
export const ASSIST_CONSENT='Send these approximate tracking measurements and your question to OpenAI for one AI review? A $0.10 allowance will be held from your existing $5 usage target. Actual usage is estimated afterward; unverified usage keeps the allowance held. No automatic paid retry. No images, location or customer records are sent. Verify every dimension with a tape or laser.';
const object=x=>x&&typeof x==='object'&&!Array.isArray(x)&&[Object.prototype,null].includes(Object.getPrototypeOf(x));
const exact=(x,keys)=>object(x)&&Object.keys(x).sort().join(',')===[...keys].sort().join(',');
const id=x=>typeof x==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(x);
const readingIDs=['span','length','width'];
function fail(code='MEASUREMENT_INPUT_INVALID'){const e=new Error('Use current, approximate tracked measurements and a short question.');e.code=code;e.status=400;throw e;}
export function validateAssistInput(value){
 if(!exact(value,['snapshot','question'])&&!exact(value,['snapshot','question','scope']))fail();
 const scope=value.scope??'unknown';if(!['interior','exterior','unknown'].includes(scope))fail();
 const {snapshot:s,question}=value;
 if(!exact(s,['version','sessionToken','revision','mode','unit','approximate','readings'])||s.version!==1||!id(s.sessionToken)||!Number.isSafeInteger(s.revision)||s.revision<0||!['surface','controller'].includes(s.mode)||s.unit!=='m'||s.approximate!==true||!Array.isArray(s.readings)||s.readings.length<1||s.readings.length>3)fail();
 const seen=new Set();const readings=s.readings.map(r=>{if(!exact(r,['id','valueMetres','tracked'])||!readingIDs.includes(r.id)||seen.has(r.id)||r.tracked!==true||typeof r.valueMetres!=='number'||!Number.isFinite(r.valueMetres)||r.valueMetres<=0||r.valueMetres>1000)fail();seen.add(r.id);return {id:r.id,valueMetres:r.valueMetres,tracked:true};}).sort((a,b)=>readingIDs.indexOf(a.id)-readingIDs.indexOf(b.id));
 if(typeof question!=='string'||question.length>500||new TextEncoder().encode(question).length>2000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(question))fail();
 const input={scope,snapshot:{version:1,sessionToken:s.sessionToken,revision:s.revision,mode:s.mode,unit:'m',approximate:true,readings},question:question.trim()};if(new TextEncoder().encode(JSON.stringify(input)).length>8192)fail();return input;
}
export function snapshotFromTracking(state){
 if(state?.historical===true||state?.sessionActive!==true||state?.approximate!==true||state?.units!=='metres')fail('MEASUREMENT_NOT_TRACKED');
 const readings=[];
 if(state.points?.length===2&&state.points.every(p=>p?.tracked===true)&&state.metres>0)readings.push({id:'span',valueMetres:state.metres,tracked:true});
 for(const key of ['length','width'])if(state.area?.[key+'Tracked']===true&&state.area[key]>0)readings.push({id:key,valueMetres:state.area[key],tracked:true});
 return validateAssistInput({snapshot:{version:1,sessionToken:state.sessionToken,revision:state.revision,mode:state.mode,unit:'m',approximate:true,readings},question:''}).snapshot;
}
/** A frozen capture proves only that tracking was active at capture time, never that it is live now. */
export function snapshotFromCapture(capture){
 if(capture?.historical!==true||!Number.isSafeInteger(capture.capturedAt)||capture.capturedAt<0)fail('MEASUREMENT_CAPTURE_INVALID');
 return snapshotFromTracking({...capture,historical:false});
}
export function assistCandidates(input){
 const v=validateAssistInput(input),present=new Set(v.snapshot.readings.map(r=>r.id));
 return {observations:['approximate_readings','shape_unverified',v.snapshot.mode==='controller'?'controller_offset':'surface_tracking'],missingMeasurements:[...(!present.has('length')?['length']:[]),...(!present.has('width')?['width']:[]),...(v.scope==='interior'?['ceiling_height','opening_sizes']:[]),'diagonals','field_verification']};
}
export function assistOutputSchema(input){
 const choices=assistCandidates(input),ids=validateAssistInput(input).snapshot.readings.map(r=>r.id);
 return {type:'object',additionalProperties:false,properties:{observations:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,properties:{code:{type:'string',enum:choices.observations},readingIds:{type:'array',maxItems:3,items:{type:'string',enum:ids}}},required:['code','readingIds']}},missingMeasurements:{type:'array',maxItems:4,items:{type:'object',additionalProperties:false,properties:{code:{type:'string',enum:choices.missingMeasurements},priority:{type:'string',enum:['next','later']}},required:['code','priority']}}},required:['observations','missingMeasurements']};
}
export function validateAssistOutput(output,input){
 if(!exact(output,['observations','missingMeasurements'])||!Array.isArray(output.observations)||output.observations.length>3||!Array.isArray(output.missingMeasurements)||output.missingMeasurements.length>4)fail('MEASUREMENT_OUTPUT_INVALID');
 const choices=assistCandidates(input),ids=new Set(validateAssistInput(input).snapshot.readings.map(r=>r.id)),seen=new Set();
 const observations=output.observations.map(o=>{if(!exact(o,['code','readingIds'])||!choices.observations.includes(o.code)||seen.has(o.code)||!Array.isArray(o.readingIds)||o.readingIds.length>3||new Set(o.readingIds).size!==o.readingIds.length||o.readingIds.some(x=>!ids.has(x)))fail('MEASUREMENT_OUTPUT_INVALID');seen.add(o.code);return {code:o.code,readingIds:[...o.readingIds]};});
 seen.clear();const missingMeasurements=output.missingMeasurements.map(o=>{if(!exact(o,['code','priority'])||!choices.missingMeasurements.includes(o.code)||seen.has(o.code)||!['next','later'].includes(o.priority))fail('MEASUREMENT_OUTPUT_INVALID');seen.add(o.code);return {code:o.code,priority:o.priority};});
 return {observations,missingMeasurements};
}
export const ASSIST_LABELS=Object.freeze({approximate_readings:'These readings are approximate. Verify them with a tape or laser.',shape_unverified:'These readings do not establish the space shape or a measured plan.',controller_offset:'Controller position includes placement and controller-offset uncertainty.',surface_tracking:'Surface tracking can shift. Remeasure after tracking loss.',length:'Measure and label the space length.',width:'Measure and label the space width.',ceiling_height:'Measure ceiling height before calculating wall coverage.',opening_sizes:'Measure door and window sizes before deducting openings.',diagonals:'Measure diagonals and review the space shape before assuming a rectangle.',field_verification:'Check the readings with a tape or laser before estimating or cutting.'});
export function assistLines(result){return [...result.observations.map(o=>ASSIST_LABELS[o.code]),...result.missingMeasurements.map(o=>(o.priority==='next'?'Next: ':'Later: ')+ASSIST_LABELS[o.code])];}
