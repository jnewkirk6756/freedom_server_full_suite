import {fail} from './errors.mjs';
export const SITE_ORIGIN='https://meridian-render.jyyys9zz9x.chatgpt.site';
export const PATH='/v1/meridian/render';
export const VERSION='meridian-oneway-v1';
export const MAX_BODY=6*1024*1024;
export const fields=['version','issuer','audience','path','method','tenantId','jobId','payloadSha256','maximumMicros','nonce','issuedAt','expiresAt','keyId'];
export const encode=s=>new TextEncoder().encode(s);
export const b64=bytes=>{let s='';for(let i=0;i<bytes.length;i+=16384)s+=String.fromCharCode(...bytes.subarray(i,i+16384));return btoa(s);};
export const unb64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
export const b64url=bytes=>b64(bytes).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export const unb64url=s=>unb64(s.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-s.length%4)%4));
export async function digest(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');}
export const canonical=e=>encode(JSON.stringify(fields.map(k=>e[k])));
export function validID(x){return typeof x==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(x);}
export function validateEnvelope(e,{audience,path=PATH,now=Date.now()}={}){
 const t=Math.floor(now/1000);
 if(!e||Object.keys(e).length!==fields.length||Object.keys(e).some(k=>!fields.includes(k))||e.version!==VERSION||e.issuer!==SITE_ORIGIN||e.audience!==audience||e.path!==path||!['/v1/meridian/render','/v1/meridian/materials/search','/v1/meridian/measurements/assist'].includes(path)||e.method!=='POST'||![e.tenantId,e.jobId,e.nonce,e.keyId].every(validID)||e.nonce.length<24||!/^[a-f0-9]{64}$/.test(e.payloadSha256)||!Number.isSafeInteger(e.maximumMicros)||e.maximumMicros<1||e.maximumMicros>1000000||!Number.isSafeInteger(e.issuedAt)||!Number.isSafeInteger(e.expiresAt)||e.issuedAt>t+2||e.issuedAt<t-20||e.expiresAt<=t||e.expiresAt-e.issuedAt>20||e.expiresAt<=e.issuedAt)fail('BAD_ENVELOPE','Render request authorization is invalid.',403);
 return e;
}
export async function boundedBytes(request,max=MAX_BODY,timeoutMs=10000){
 const declared=Number(request.headers?.get('content-length'));if(Number.isFinite(declared)&&declared>max)fail('BODY_LIMIT','Request too large.',413);
 const reader=request.body?.getReader();if(!reader)return new Uint8Array();const chunks=[];let total=0;let timer;const expiry=new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Body read timeout')),timeoutMs);});
 try{while(true){const {done,value}=await Promise.race([reader.read(),expiry]);if(done)break;total+=value.length;if(total>max)fail('BODY_LIMIT','Request too large.',413);chunks.push(value);}}finally{clearTimeout(timer);void reader.cancel().catch(()=>{});}
 const out=new Uint8Array(total);let offset=0;for(const x of chunks){out.set(x,offset);offset+=x.length;}return out;
}

