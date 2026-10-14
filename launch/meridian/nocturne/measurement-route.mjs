import {createPublicKey,verify} from 'node:crypto';
import {Readable} from 'node:stream';
import {ASSIST_PATH,ASSIST_PROTOCOL,ASSIST_ALLOWANCE_MICROS,validateAssistInput} from '../shared/measurement-assist.mjs';
import {validateEnvelope,canonical,unb64url,boundedBytes,digest} from '../shared/protocol.mjs';
import {createMeasurementAssistClient} from '../measurement-assist-client.mjs';
const error=(code,status=400)=>Object.assign(new Error('Measurement review unavailable.'),{code,status});
export function createMeasurementRoute({enabled=false,audience,keyId,publicJwk,apiKey,fetchImpl=globalThis.fetch,now=Date.now}={}){
 let key=null;if(publicJwk){key=createPublicKey({key:publicJwk,format:'jwk'});if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 required');}
 let validAudience=false;try{const u=new URL(audience);validAudience=u.protocol==='https:'&&u.origin===audience&&!u.username&&!u.password;}catch{}
 const ready=enabled===true&&!!key&&/^[A-Za-z0-9_-]{1,100}$/.test(keyId||'')&&validAudience&&typeof apiKey==='string'&&!!apiKey.trim()&&!/[\u0000-\u0020\u007f]/.test(apiKey)&&apiKey.length<=4096;
 const run=createMeasurementAssistClient({enabled,apiKey,fetchImpl}),seen=new Map();
 return async request=>{let accepted=false;try{
  const u=new URL(request.url);if(u.search)return null;
  if(request.method==='GET'&&u.pathname===ASSIST_PATH+'/ready')return Response.json({ready,protocol:ASSIST_PROTOCOL,verificationKeyId:keyId??null},{status:ready?200:503,headers:{'cache-control':'no-store'}});
  if(request.method!=='POST'||u.pathname!==ASSIST_PATH)return null;
  if(!ready)throw error('MEASUREMENT_ASSIST_DISABLED',503);
  if(request.headers.has('origin')||request.headers.has('cookie'))throw error('SERVER_ONLY',403);
  const encoded=request.headers.get('x-meridian-envelope'),signature=request.headers.get('x-meridian-signature');
  if(!encoded||encoded.length>4096||!signature||!/^[A-Za-z0-9_-]{86}$/.test(signature))throw error('BAD_ENVELOPE',403);
  let envelope;try{envelope=JSON.parse(new TextDecoder().decode(unb64url(encoded)));}catch{throw error('BAD_ENVELOPE',403);}
  validateEnvelope(envelope,{audience,path:ASSIST_PATH,now:now()});
  if(envelope.maximumMicros!==ASSIST_ALLOWANCE_MICROS||envelope.keyId!==keyId||!verify(null,canonical(envelope),key,unb64url(signature)))throw error('BAD_SIGNATURE',403);
  const raw=await boundedBytes(request,8192);if(await digest(raw)!==envelope.payloadSha256)throw error('BAD_DIGEST',403);
  validateEnvelope(envelope,{audience,path:ASSIST_PATH,now:now()});
  let input;try{input=validateAssistInput(JSON.parse(new TextDecoder().decode(raw)));}catch{throw error('MEASUREMENT_INPUT_INVALID');}
  for(const [id,expiry]of seen)if(expiry<=now())seen.delete(id);
  const replay=keyId+':'+envelope.nonce;if(seen.has(replay)||seen.size>=10000)throw error('REPLAY_REJECTED',409);
  seen.set(replay,envelope.expiresAt*1000);accepted=true;
  return Response.json({ok:true,...await run(input)},{headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
 }catch(e){const code=/^[A-Z_]{1,60}$/.test(e?.code??'')?e.code:'MEASUREMENT_REVIEW_FAILED';return Response.json({ok:false,error:code,accounting:accepted?e.accounting??null:null},{status:accepted?200:e.status??502,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});}};
}
export function measurementNodeAdapter(handler){return async(req,res)=>{const u=new URL(req.url,'https://nocturne.invalid');if(u.search||!((req.method==='POST'&&u.pathname===ASSIST_PATH)||(req.method==='GET'&&u.pathname===ASSIST_PATH+'/ready')))return false;
 try{const response=await handler(new Request(u,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{if(!res.headersSent)res.writeHead(502,{'content-type':'application/json','cache-control':'no-store'});res.end('{"ok":false,"error":"MEASUREMENT_ADAPTER_FAILED"}');}return true;};}
