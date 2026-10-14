import {createPublicKey,verify} from 'node:crypto';
import {Readable} from 'node:stream';
import {LOGO_PATH,LOGO_PROTOCOL,LOGO_ALLOWANCE_MICROS,validateLogoInput} from '../shared/logo-generation.mjs';
import {validateEnvelope,canonical,unb64url,boundedBytes,digest} from '../shared/protocol.mjs';
import {createLogoClient,normalizeLogoApiKey} from '../logo-client.mjs';
const error=(code,status=400)=>Object.assign(new Error('Logo ideas unavailable.'),{code,status});
export function createLogoRoute({enabled=false,audience,keyId,publicJwk,apiKey,fetchImpl=globalThis.fetch,now=Date.now}={}){
 let key=null;if(publicJwk){key=createPublicKey({key:publicJwk,format:'jwk'});if(key.asymmetricKeyType!=='ed25519')throw Error('Ed25519 required');}
 let validAudience=false;try{const u=new URL(audience);validAudience=u.protocol==='https:'&&u.origin===audience&&!u.username&&!u.password;}catch{}
 const normalizedApiKey=normalizeLogoApiKey(apiKey);
 const reasonCode=enabled!==true?'LOGO_DISABLED':!key||typeof keyId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(keyId)?'LOGO_VERIFICATION_NOT_CONFIGURED':!validAudience?'LOGO_AUDIENCE_NOT_CONFIGURED':!normalizedApiKey?'LOGO_PROVIDER_NOT_CONFIGURED':null;
 const ready=reasonCode===null;
 const run=createLogoClient({enabled,apiKey:normalizedApiKey,fetchImpl}),seen=new Map();
 return async request=>{let accepted=false;try{
  const u=new URL(request.url);if(u.search)return null;
  if(request.method==='GET'&&u.pathname===LOGO_PATH+'/ready')return Response.json({ready,protocol:LOGO_PROTOCOL,verificationKeyId:keyId??null,reasonCode},{status:ready?200:503,headers:{'cache-control':'no-store'}});
  if(request.method!=='POST'||u.pathname!==LOGO_PATH)return null;
  if(!ready)throw error('LOGO_DISABLED',503);
  if(request.headers.has('origin')||request.headers.has('cookie'))throw error('SERVER_ONLY',403);
  const encoded=request.headers.get('x-meridian-envelope'),signature=request.headers.get('x-meridian-signature');
  if(!encoded||encoded.length>4096||!signature||!/^[A-Za-z0-9_-]{86}$/.test(signature))throw error('BAD_ENVELOPE',403);
  let envelope;try{envelope=JSON.parse(new TextDecoder().decode(unb64url(encoded)));}catch{throw error('BAD_ENVELOPE',403);}
  validateEnvelope(envelope,{audience,path:LOGO_PATH,now:now()});
  if(envelope.maximumMicros!==LOGO_ALLOWANCE_MICROS||envelope.keyId!==keyId||!verify(null,canonical(envelope),key,unb64url(signature)))throw error('BAD_SIGNATURE',403);
  const raw=await boundedBytes(request,24576);if(await digest(raw)!==envelope.payloadSha256)throw error('BAD_DIGEST',403);
  validateEnvelope(envelope,{audience,path:LOGO_PATH,now:now()});
  let input;try{input=validateLogoInput(JSON.parse(new TextDecoder().decode(raw)));}catch{throw error('LOGO_INPUT_INVALID');}
  for(const [id,expiry]of seen)if(expiry<=now())seen.delete(id);
  const replay=keyId+':'+envelope.nonce;if(seen.has(replay)||seen.size>=10000)throw error('REPLAY_REJECTED',409);
  seen.set(replay,envelope.expiresAt*1000);accepted=true;
  return Response.json({ok:true,...await run(input)},{headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});
 }catch(e){const code=/^[A-Z_]{1,60}$/.test(e?.code??'')?e.code:'LOGO_REVIEW_FAILED';return Response.json({ok:false,error:code,billing:accepted?e.billing??null:null},{status:accepted?200:e.status??502,headers:{'cache-control':'private, no-store','x-content-type-options':'nosniff'}});}};
}
export function logoNodeAdapter(handler){return async(req,res)=>{const u=new URL(req.url,'https://nocturne.invalid');if(u.search||!((req.method==='POST'&&u.pathname===LOGO_PATH)||(req.method==='GET'&&u.pathname===LOGO_PATH+'/ready')))return false;
 try{const response=await handler(new Request(u,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})}));res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));}catch{if(!res.headersSent)res.writeHead(502,{'content-type':'application/json','cache-control':'no-store'});res.end('{"ok":false,"error":"LOGO_ADAPTER_FAILED"}');}return true;};}
