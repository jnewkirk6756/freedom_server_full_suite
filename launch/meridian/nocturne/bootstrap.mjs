/** Mount only after approval. Disabled by default; never generates or copies a key. */
import {createNocturneRoute,nodeAdapter} from './route.mjs';
export async function initializeMeridianRoute(env=process.env,{loadSharp=()=>import('sharp')}={}){
 if(env.MERIDIAN_BRIDGE_ENABLED!=='true'||!env.MERIDIAN_BRIDGE_APPROVAL_REFERENCE)return async()=>false;
 try{
  const sharp=(await loadSharp()).default;
  const handler=createNocturneRoute({enabled:true,audience:env.MERIDIAN_NOCTURNE_ORIGIN,keyId:env.MERIDIAN_VERIFY_KEY_ID,publicJwk:JSON.parse(env.MERIDIAN_VERIFY_PUBLIC_JWK),apiKey:env.OPENAI_API_KEY,sharp});
  return nodeAdapter(handler);
 }catch{
  // A bad new bridge configuration must not bring down the existing Nocturne app.
  return async(req,res)=>{if(req.method!=='POST'||req.url!=='/v1/meridian/render')return false;res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"MERIDIAN_CONNECTION_NOT_CONFIGURED"}');return true;};
 }
}
