/** Portable brief-only design advice contract. No image or customer data fields. */
export const DESIGN_PATH='/v1/meridian/design/assist';
export const DESIGN_PROTOCOL='meridian-design-assist-v1';
export const DESIGN_MODEL='gpt-5.4-mini-2026-03-17';
export const DESIGN_ALLOWANCE_MICROS=100000;
export const DESIGN_OUTPUT_TOKENS=800;
export const DESIGN_CONSENT='Send your room type, design instructions, selected store names and any approved dimensions to OpenAI for three AI design ideas? A $0.10 allowance will be held from your existing $5 usage target. Actual usage is estimated afterward; unverified usage keeps the allowance held. No automatic paid retry or new funding. No photo, ZIP or customer records are sent. Ideas are based on your brief, not a photo assessment, product availability or construction advice.';
const exact=(v,keys)=>v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Object.keys(v).sort().join(',')===[...keys].sort().join(',');
const text=(v,n)=>typeof v==='string'&&v.length<=n&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const measure=v=>v===null||typeof v==='number'&&Number.isFinite(v)&&v>0&&v<=24000;
function fail(code='DESIGN_INPUT_INVALID'){throw Object.assign(new Error('Use a short design brief and valid project context.'),{code,status:400});}
export function validateDesignInput(input){
 if(!exact(input,['context']))fail();const c=input.context;
 if(!exact(c,['projectId','revision','roomType','prompt','selectedStoreIds','dimensions'])||!id(c.projectId)||!Number.isSafeInteger(c.revision)||c.revision<0||!id(c.roomType)||!text(c.prompt,4000)||!Array.isArray(c.selectedStoreIds)||c.selectedStoreIds.length>5||!c.selectedStoreIds.every(id)||new Set(c.selectedStoreIds).size!==c.selectedStoreIds.length)fail();
 const d=c.dimensions;if(d!==null&&(!exact(d,['unit','wallInches','ceilingHeightInches'])||d.unit!=='in'||!Array.isArray(d.wallInches)||d.wallInches.length<3||d.wallInches.length>256||!d.wallInches.every(measure)||!measure(d.ceilingHeightInches)))fail();
 const value={context:{projectId:c.projectId,revision:c.revision,roomType:c.roomType,prompt:c.prompt,selectedStoreIds:[...c.selectedStoreIds].sort(),dimensions:d?{unit:'in',wallInches:[...d.wallInches],ceilingHeightInches:d.ceilingHeightInches}:null}};
 if(new TextEncoder().encode(JSON.stringify(value)).length>20000)fail();return value;
}
export function designOutputSchema(){return {type:'object',additionalProperties:false,properties:{suggestions:{type:'array',minItems:3,maxItems:3,items:{type:'object',additionalProperties:false,properties:{title:{type:'string',minLength:1,maxLength:60},prompt:{type:'string',minLength:1,maxLength:500}},required:['title','prompt']}}},required:['suggestions']};}
export function validateDesignOutput(value){
 if(!exact(value,['suggestions'])||!Array.isArray(value.suggestions)||value.suggestions.length!==3)fail('DESIGN_OUTPUT_INVALID');
 const seen=new Set();const suggestions=value.suggestions.map(s=>{if(!exact(s,['title','prompt'])||!text(s.title,60)||!s.title.trim()||!text(s.prompt,500)||!s.prompt.trim()||seen.has(s.prompt.trim()))fail('DESIGN_OUTPUT_INVALID');seen.add(s.prompt.trim());return {title:s.title.trim(),prompt:s.prompt.trim()};});return {suggestions};
}
export function appendDesignSuggestion(current,suggestion,maxLength=4000){if(typeof current!=='string'||typeof suggestion!=='string'||!suggestion)throw Error('Choose a design idea.');if(current.includes(suggestion))return current;const next=current+(current&&!current.endsWith('\n')?'\n':'')+suggestion;if(next.length>maxLength)throw Error('There isn’t enough room to add this idea. Shorten your instructions first.');return next;}
