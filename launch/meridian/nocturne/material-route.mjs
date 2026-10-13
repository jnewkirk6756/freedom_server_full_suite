import {createPublicKey,verify} from 'node:crypto';import {Readable} from 'node:stream';
import {ContractError,fail} from '../shared/errors.mjs';
import {validateEnvelope,canonical,unb64url,boundedBytes,digest} from '../shared/protocol.mjs';
import {createMaterialLookupClient,MaterialLookupError,MATERIAL_LIMITS} from '../material-search-client.mjs';
export const MATERIAL_PATH='/v1/meridian/materials/search';
export function createMaterialRoute({enabled=false,audience,keyId,publicJwk,apiKey,fetchImpl=globalThis.fetch,now=Date.now}={}){
 let key=null;if(publicJwk){key=createPublicKey({key:publicJwk,format:'jwk'});if(key.asymmetricKeyType!=='ed25519')throw new TypeError('Ed25519 required.');}
 let validAudience=false;try{const u=new URL(audience);validAudience=u.protocol==='https:'&&u.origin===audience&&!u.username&&!u.password;}catch{}
 const normalizedApiKey=typeof apiKey==='string'?apiKey.trim():null;
 const lookup=createMaterialLookupClient({enabled,getApiKey:()=>normalizedApiKey,fetchImpl,now});const seen=new Map();
 const reasonCode=enabled!==true?'MATERIAL_LOOKUP_DISABLED':!key||typeof keyId!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(keyId)?'MATERIAL_VERIFICATION_NOT_CONFIGURED':!validAudience?'MATERIAL_AUDIENCE_NOT_CONFIGURED':typeof normalizedApiKey!=='string'||!normalizedApiKey||normalizedApiKey.length>4096||/[\u0000-\u0020\u007f]/.test(normalizedApiKey)?'MATERIAL_PROVIDER_NOT_CONFIGURED':null;
 const ready=reasonCode===null;
 return async request=>{try{
  const u=new URL(request.url);if(u.search)return null;
  if(request.method==='GET'&&u.pathname===MATERIAL_PATH+'/ready')return Response.json({ready:!!ready,protocol:'meridian-materials-v1',verificationKeyId:keyId??null,reasonCode},{status:ready?200:503,headers:{'cache-control':'no-store'}});
  if(request.method!=='POST'||u.pathname!==MATERIAL_PATH)return null;
  if(!ready)fail('MATERIAL_LOOKUP_DISABLED','Online product lookup is not enabled.',503);
  if(request.headers.has('origin')||request.headers.has('cookie'))fail('SERVER_ONLY','Server connection required.',403);
  const rawEnvelope=request.headers.get('x-meridian-envelope'),signature=request.headers.get('x-meridian-signature');if(!rawEnvelope||rawEnvelope.length>4096||!signature||!/^[A-Za-z0-9_-]{86}$/.test(signature))fail('BAD_ENVELOPE','Invalid lookup authorization.',403);
  let envelope;try{envelope=JSON.parse(new TextDecoder().decode(unb64url(rawEnvelope)));}catch{fail('BAD_ENVELOPE','Invalid lookup authorization.',403);}
  validateEnvelope(envelope,{audience,path:MATERIAL_PATH,now:now()});if(envelope.maximumMicros!==100000||envelope.keyId!==keyId||!verify(null,canonical(envelope),key,unb64url(signature)))fail('BAD_SIGNATURE','Invalid lookup authorization.',403);
  const raw=await boundedBytes(request,20000);if(await digest(raw)!==envelope.payloadSha256)fail('BAD_DIGEST','Invalid lookup authorization.',403);validateEnvelope(envelope,{audience,path:MATERIAL_PATH,now:now()});
  for(const [id,end]of seen)if(end<=now())seen.delete(id);const replayKey=keyId+':'+envelope.nonce;if(seen.has(replayKey)||seen.size>=10000)fail('REPLAY_REJECTED','Lookup already dispatched.',409);
  let body;try{body=JSON.parse(new TextDecoder().decode(raw));}catch{fail('INVALID_INPUT','Invalid lookup request.');}
  const keys=['selectedStoreIds','zip','prompt','materialTier','mode'];if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==keys.length||Object.keys(body).some(k=>!keys.includes(k))||!Array.isArray(body.selectedStoreIds)||body.selectedStoreIds.length<1||body.selectedStoreIds.length>3||new Set(body.selectedStoreIds).size!==body.selectedStoreIds.length||body.selectedStoreIds.some(id=>!['home-depot','lowes','floor-and-decor'].includes(id))||!(body.zip===null||typeof body.zip==='string'&&/^\d{5}$/.test(body.zip))||typeof body.prompt!=='string'||body.prompt.length>6000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(body.prompt)||!['budget','mid_grade','premium'].includes(body.materialTier)||!['quick_concept','measured_plan'].includes(body.mode))fail('INVALID_INPUT','Invalid selected-store request.');
  const designBrief=`Find real renovation products for this design: ${body.prompt.replace(/[\n\r\t]+/g,' ')}. Material tier ${body.materialTier}. Project ZIP ${body.zip??'not supplied'}; do not claim local price or stock without location evidence. No quantities may be inferred from this brief.`;
  if(new TextEncoder().encode(designBrief).length>MATERIAL_LIMITS.designBriefBytes)fail('INVALID_INPUT','Design brief exceeds lookup limits.');
  seen.set(replayKey,envelope.expiresAt*1000);
  const result=await lookup.lookup({selectedStoreIds:body.selectedStoreIds,designBrief,maxProducts:6});
  const text=JSON.stringify(result);if(new TextEncoder().encode(text).length>512*1024)fail('MATERIAL_RESPONSE_LIMIT','Lookup response exceeded limits.',502);
  return new Response(text,{headers:{'content-type':'application/json','cache-control':'private, no-store','x-content-type-options':'nosniff'}});
 }catch(e){const safe=e instanceof ContractError?e.code:typeof e?.code==='string'&&/^[A-Z_]{1,60}$/.test(e.code)?e.code:'MATERIAL_LOOKUP_FAILED';return Response.json({error:safe,...(e?.accounting?{accounting:e.accounting}:{})},{status:e instanceof ContractError||e instanceof MaterialLookupError?e.status:502,headers:{'cache-control':'no-store'}});}};
}
export function materialNodeAdapter(handler){return async(req,res)=>{const u=new URL(req.url,'https://nocturne.invalid');if(u.search||!((req.method==='POST'&&u.pathname===MATERIAL_PATH)||(req.method==='GET'&&u.pathname===MATERIAL_PATH+'/ready')))return false;const request=new Request(u,{method:req.method,headers:req.headers,...(req.method==='POST'?{body:Readable.toWeb(req),duplex:'half'}:{})});const response=await handler(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return true;};}
