import {createPublicKey,verify} from 'node:crypto';
import {Readable} from 'node:stream';
import {VISUAL_PATH,VISUAL_PROTOCOL,VISUAL_ALLOWANCE_MICROS,validateVisualInput,visualRequestId} from '../shared/visual-review.mjs';
import {validateEnvelope,canonical,unb64url,boundedBytes,digest} from '../shared/protocol.mjs';
import {createVisualReviewClient,normalizeVisualApiKey} from '../visual-review-client.mjs';
import {VISUAL_LIMITS} from './visual-media.mjs';
const error=(code,status=400)=>Object.assign(new Error('Visual review unavailable.'),{code,status});
const headers={'cache-control':'private, no-store','x-content-type-options':'nosniff'};
/** Site D1 owns durable one-dispatch state. This process never expires accepted job IDs. */
export function createVisualRoute({enabled=false,audience,keyId,publicJwk,apiKey,fetchImpl=globalThis.fetch,now=Date.now,timeoutMs}={}){
 let key=null;try{if(publicJwk){key=createPublicKey({key:publicJwk,format:'jwk'});if(key.asymmetricKeyType!=='ed25519')key=null;}}catch{key=null;}
 let validAudience=false;try{const u=new URL(audience);validAudience=u.protocol==='https:'&&u.origin===audience&&!u.username&&!u.password;}catch{}
 const normalizedApiKey=normalizeVisualApiKey(apiKey);
 const reasonCode=enabled!==true?'VISUAL_REVIEW_DISABLED':!key||typeof keyId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(keyId)?'VISUAL_VERIFICATION_NOT_CONFIGURED':!validAudience?'VISUAL_AUDIENCE_NOT_CONFIGURED':!normalizedApiKey?'VISUAL_PROVIDER_NOT_CONFIGURED':null;
 const ready=reasonCode===null,seenJobs=new Set(),seenNonces=new Set();
 const run=createVisualReviewClient({enabled,apiKey:normalizedApiKey,fetchImpl,...(timeoutMs===undefined?{}:{timeoutMs})});
 return async request=>{let accepted=false;try{
  const u=new URL(request.url);if(u.search)return null;
  if(request.method==='GET'&&u.pathname===VISUAL_PATH+'/ready')return Response.json({ready,protocol:VISUAL_PROTOCOL,verificationKeyId:keyId??null,reasonCode},{status:ready?200:503,headers});
  if(request.method!=='POST'||u.pathname!==VISUAL_PATH)return null;
  if(!ready)throw error(reasonCode,503);
  if(request.headers.has('origin')||request.headers.has('cookie'))throw error('SERVER_ONLY',403);
  const encoded=request.headers.get('x-meridian-envelope'),signature=request.headers.get('x-meridian-signature');
  if(!encoded||encoded.length>4096||!signature||!/^[A-Za-z0-9_-]{86}$/.test(signature))throw error('BAD_ENVELOPE',403);
  let envelope;try{envelope=JSON.parse(new TextDecoder().decode(unb64url(encoded)));}catch{throw error('BAD_ENVELOPE',403);}
  validateEnvelope(envelope,{audience,path:VISUAL_PATH,now:now()});
  if(envelope.maximumMicros!==VISUAL_ALLOWANCE_MICROS||envelope.keyId!==keyId||!verify(null,canonical(envelope),key,unb64url(signature)))throw error('BAD_SIGNATURE',403);
  const raw=await boundedBytes(request,VISUAL_LIMITS.requestBytes);if(await digest(raw)!==envelope.payloadSha256)throw error('BAD_DIGEST',403);
  validateEnvelope(envelope,{audience,path:VISUAL_PATH,now:now()});
  let input;try{input=validateVisualInput(JSON.parse(new TextDecoder().decode(raw)));if(envelope.jobId!==visualRequestId(input.context.jobId))throw error('VISUAL_JOB_MISMATCH',403);}catch(e){if(e.code==='VISUAL_JOB_MISMATCH')throw e;throw error('VISUAL_INPUT_INVALID');}
  // Bind by tenant/source job, not nonce, signing-key rotation, allowance or mutable request IDs.
  const job=JSON.stringify([envelope.tenantId,input.context.jobId]),nonce=envelope.keyId+':'+envelope.nonce;
  if(seenJobs.has(job)||seenNonces.has(nonce)||seenJobs.size>=10000||seenNonces.size>=10000)throw error('REPLAY_REJECTED',409);
  // Reserve synchronously before any asynchronous image validation or provider work. Failed/unknown outcomes stay reserved.
  seenJobs.add(job);seenNonces.add(nonce);accepted=true;
  return Response.json({ok:true,...await run(input)},{headers});
 }catch(e){const code=/^[A-Z_]{1,60}$/.test(e?.code??'')?e.code:'VISUAL_REVIEW_FAILED';return Response.json({ok:false,error:code,accounting:accepted?e.accounting??null:null},{status:accepted?200:e.status??502,headers});}};
}
export function visualNodeAdapter(handler){return async(req,res)=>{const u=new URL(req.url,'https://nocturne.invalid');if(u.search||!((req.method==='POST'&&u.pathname===VISUAL_PATH)||(req.method==='GET'&&u.pathname===VISUAL_PATH+'/ready')))return false;
 try{const response=await handler(new Request(u,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{if(!res.headersSent)res.writeHead(502,{'content-type':'application/json','cache-control':'no-store'});res.end('{"ok":false,"error":"VISUAL_ADAPTER_FAILED"}');}return true;};}
