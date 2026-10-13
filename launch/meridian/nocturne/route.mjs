import {ContractError,fail} from '../shared/errors.mjs';
import {PATH,MAX_BODY,unb64url,b64url,encode,canonical,validateEnvelope,boundedBytes,digest} from '../shared/protocol.mjs';
import {createRenderClient} from './render-client.mjs';
import {createImageValidator} from './render-media.mjs';
import {createPublicKey,verify} from 'node:crypto';
import {Readable} from 'node:stream';
/** In-memory cache is defense-in-depth only; Site D1 owns durable one-dispatch state. */
export function createNocturneRoute({enabled=false,audience,keyId,publicJwk,apiKey,sharp,fetchImpl=globalThis.fetch,now=Date.now}={}){
 let key=null;if(publicJwk){key=createPublicKey({key:publicJwk,format:'jwk'});if(key.asymmetricKeyType!=='ed25519')throw new TypeError('Ed25519 public key required.');}
 let validAudience=false;try{const u=new URL(audience);validAudience=u.protocol==='https:'&&u.origin===audience&&!u.username&&!u.password;}catch{}
 const ready=enabled===true&&!!key&&!!keyId&&validAudience&&typeof apiKey==='string'&&!!apiKey.trim();
 const seen=new Map();const validateImage=createImageValidator(sharp);
 const render=createRenderClient({enabled,apiKey,validateImage,fetchImpl});
 return async function handle(request){
  try{
   const url=new URL(request.url);if(request.method==='GET'&&url.pathname===PATH+'/ready'&&!url.search)return new Response(JSON.stringify({ready,protocol:'meridian-oneway-v1',verificationKeyId:keyId??null}),{status:ready?200:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});if(request.method!=='POST'||url.pathname!==PATH)return null;
   if(enabled!==true)fail('AI_DISABLED','Image generation is not activated.',503);
   if(request.headers.has('origin')||request.headers.has('cookie'))fail('SERVER_ONLY','Server connection required.',403);
   if(!key||!keyId||!validAudience)fail('CONNECTION_NOT_CONFIGURED','The secure image connection is not configured.',503);
   const rawEnvelope=request.headers.get('x-meridian-envelope'),sig=request.headers.get('x-meridian-signature');
   if(!rawEnvelope||rawEnvelope.length>4096||!sig||!/^[A-Za-z0-9_-]{86}$/.test(sig))fail('BAD_ENVELOPE','Render request authorization is invalid.',403);
   let envelope;try{envelope=JSON.parse(new TextDecoder().decode(unb64url(rawEnvelope)));}catch{fail('BAD_ENVELOPE','Render request authorization is invalid.',403);}
   validateEnvelope(envelope,{audience,now:now()});
   if(envelope.keyId!==keyId||!verify(null,canonical(envelope),key,unb64url(sig)))fail('BAD_SIGNATURE','Render request authorization is invalid.',403);
   const raw=await boundedBytes(request,MAX_BODY);if(await digest(raw)!==envelope.payloadSha256)fail('BAD_DIGEST','Render request authorization is invalid.',403);
   validateEnvelope(envelope,{audience,now:now()});
   for(const [nonce,expiry] of seen)if(expiry<=now())seen.delete(nonce);
   const replayKey=`${envelope.keyId}:${envelope.nonce}`;
   if(seen.has(replayKey)||seen.size>=10000)fail('REPLAY_REJECTED','This render cannot be submitted again.',409);
   seen.set(replayKey,envelope.expiresAt*1000);
   const result=await render(Buffer.from(raw));
   return new Response(result.bytes,{headers:{'Content-Type':'image/webp','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Meridian-Geometry-Verified':'false','X-Meridian-Billing':b64url(encode(JSON.stringify(result.billing)))}});
  }catch(e){return new Response(JSON.stringify({error:e instanceof ContractError?e.code:'RENDER_FAILED'}),{status:e instanceof ContractError?e.status:502,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(e?.billing?{'X-Meridian-Billing':b64url(encode(JSON.stringify(e.billing)))}:{})}});}
 };
}
/** Exact render POST and non-billable readiness GET only. Legacy paths retain existing Basic middleware. */
export function nodeAdapter(handler){return async function route(req,res){
 const url=new URL(req.url,'https://nocturne.invalid');const isRender=req.method==='POST'&&url.pathname===PATH,isReady=req.method==='GET'&&url.pathname===PATH+'/ready';if((!isRender&&!isReady)||url.search)return false;
 const request=new Request(url,{method:req.method,headers:req.headers,...(isRender?{body:Readable.toWeb(req),duplex:'half'}:{})});
 const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return true;
};}
