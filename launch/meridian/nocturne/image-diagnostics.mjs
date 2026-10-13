/** Bounded, content-free diagnostics. Call only after envelope signature verification. */
const stages=new Set(['signature_valid','digest_valid','payload_valid','provider_dispatch','provider_headers','provider_body_read','output_validated','output_quarantined','provider_failed','route_failed','response_prepared','response_end_called','response_finish','response_close','request_aborted','adapter_failed']);
const codes=new Set(['AI_DISABLED','PROVIDER_NOT_CONFIGURED','BAD_ENVELOPE','BAD_DIGEST','BODY_LIMIT','REPLAY_REJECTED','INVALID_RENDER_PAYLOAD','INVALID_IMAGE','PROVIDER_AUTH_FAILED','PROVIDER_ACCESS_DENIED','PROVIDER_MODEL_UNAVAILABLE','PROVIDER_LIMIT_REACHED','PROVIDER_REQUEST_FAILED','PROVIDER_INVALID_RESPONSE','PROVIDER_OUTCOME_UNKNOWN','PROVIDER_TRANSPORT_FAILED','RENDER_FAILED','ADAPTER_FAILED',...['BASE64','CONTAINER','TRUNCATED','CHUNK_BOUNDS','PROVENANCE_CHUNK','UNSUPPORTED_CHUNK','DIMENSIONS_OR_FRAME','EXIF_ORIENTATION','STRUCTURE'].map(x=>'OUTPUT_'+x)]);
const noop=()=>{};
const id=(value,max)=>typeof value==='string'&&value.length<=max&&/^[A-Za-z0-9_-]+$/.test(value)?value:null;
const count=value=>Number.isSafeInteger(value)&&value>=0&&value<=64*1024*1024?value:null;
const status=value=>Number.isInteger(value)&&value>=100&&value<=599?value:null;
export function diagnosticErrorCode(error,fallback='RENDER_FAILED'){
 try{return codes.has(error?.code)?error.code:fallback;}catch{return fallback;}
}
/** Ignore both synchronous throws and rejected promises; never await diagnostic sinks. */
export function recordImageDiagnostic(record,stage,fields){
 try{if(typeof record==='function'){const result=record(stage,fields);if(result&&typeof result.then==='function')void Promise.resolve(result).catch(noop);}}catch{}
}
export function createImageDiagnostics(jobId,{logger=line=>console.info(line),clock=()=>performance.now()}={}){
 if(!id(jobId,100))return noop;
 let started=0;try{const value=clock();if(Number.isFinite(value))started=value;}catch{}
 const emitted=new Set();let elapsedMs=0;
 return (stage,fields={})=>{
  try{
   if(!stages.has(stage)||emitted.has(stage))return;emitted.add(stage);
   try{const value=clock()-started;if(Number.isFinite(value))elapsedMs=Math.min(86400000,Math.max(elapsedMs,Math.round(value)));}catch{}
   const entry={event:'meridian_image_lifecycle',version:1,jobId,stage,elapsedMs};
   for(const key of ['inputBytes','providerBytes','outputBytes','responseBytes'])if(key in fields)entry[key]=count(fields[key]);
   for(const key of ['status','providerStatus'])if(key in fields)entry[key]=status(fields[key]);
   if('providerRequestId' in fields)entry.providerRequestId=id(fields.providerRequestId,200);
   if('errorCode' in fields)entry.errorCode=codes.has(fields.errorCode)?fields.errorCode:'RENDER_FAILED';
   for(const key of ['writableFinished','destroyed','requestAborted','disconnected'])if(key in fields)entry[key]=fields[key]===true;
   const result=logger(JSON.stringify(entry));if(result&&typeof result.then==='function')void Promise.resolve(result).catch(noop);
  }catch{}
 };
}
