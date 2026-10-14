import {createVisualRoute,visualNodeAdapter} from './visual-route.mjs';
import {VISUAL_PATH} from '../shared/visual-review.mjs';
import {createLogoRoute,logoNodeAdapter} from './logo-route.mjs';
import {LOGO_PATH} from '../shared/logo-generation.mjs';
import {createDesignRoute,designNodeAdapter} from './design-route.mjs';
import {DESIGN_PATH} from '../shared/design-assist.mjs';
import {createMeasurementRoute,measurementNodeAdapter} from './measurement-route.mjs';
import {ASSIST_PATH} from '../shared/measurement-assist.mjs';
import {createMaterialRoute,materialNodeAdapter,MATERIAL_PATH} from './material-route.mjs';
/** Mount only after approval. Disabled by default; never generates or copies a key. */
import {createNocturneRoute,nodeAdapter} from './route.mjs';
export async function initializeMeridianRoute(env=process.env,{}={}){
 if(env.MERIDIAN_BRIDGE_ENABLED!=='true'||!env.MERIDIAN_BRIDGE_APPROVAL_REFERENCE)return async()=>false;
 try{
  const handler=createNocturneRoute({enabled:true,audience:env.MERIDIAN_NOCTURNE_ORIGIN,keyId:env.MERIDIAN_VERIFY_KEY_ID,publicJwk:JSON.parse(env.MERIDIAN_VERIFY_PUBLIC_JWK),apiKey:env.OPENAI_API_KEY});
  const images=nodeAdapter(handler);const materials=materialNodeAdapter(createMaterialRoute({transportProbe:env.MERIDIAN_MATERIAL_TRANSPORT_PROBE==='true',enabled:env.MERIDIAN_MATERIAL_LOOKUP_ENABLED==='true'&&!!env.MERIDIAN_MATERIAL_APPROVAL_REFERENCE,audience:env.MERIDIAN_NOCTURNE_ORIGIN,keyId:env.MERIDIAN_VERIFY_KEY_ID,publicJwk:JSON.parse(env.MERIDIAN_VERIFY_PUBLIC_JWK),apiKey:env.OPENAI_API_KEY}));
  const measurements=measurementNodeAdapter(createMeasurementRoute({enabled:true,audience:env.MERIDIAN_NOCTURNE_ORIGIN,keyId:env.MERIDIAN_VERIFY_KEY_ID,publicJwk:JSON.parse(env.MERIDIAN_VERIFY_PUBLIC_JWK),apiKey:env.OPENAI_API_KEY}));
  const designs=designNodeAdapter(createDesignRoute({enabled:true,audience:env.MERIDIAN_NOCTURNE_ORIGIN,keyId:env.MERIDIAN_VERIFY_KEY_ID,publicJwk:JSON.parse(env.MERIDIAN_VERIFY_PUBLIC_JWK),apiKey:env.OPENAI_API_KEY}));
  const logos=logoNodeAdapter(createLogoRoute({enabled:true,audience:env.MERIDIAN_NOCTURNE_ORIGIN,keyId:env.MERIDIAN_VERIFY_KEY_ID,publicJwk:JSON.parse(env.MERIDIAN_VERIFY_PUBLIC_JWK),apiKey:env.OPENAI_API_KEY}));
  const visuals=visualNodeAdapter(createVisualRoute({enabled:true,audience:env.MERIDIAN_NOCTURNE_ORIGIN,keyId:env.MERIDIAN_VERIFY_KEY_ID,publicJwk:JSON.parse(env.MERIDIAN_VERIFY_PUBLIC_JWK),apiKey:env.OPENAI_API_KEY}));
  return async(req,res)=>await visuals(req,res)||await logos(req,res)||await designs(req,res)||await measurements(req,res)||await materials(req,res)||await images(req,res);
 }catch{
  // A bad new bridge configuration must not bring down the existing Nocturne app.
  return async(req,res)=>{const configuredRoute=req.method==='POST'&&['/v1/meridian/render',MATERIAL_PATH,ASSIST_PATH,DESIGN_PATH,LOGO_PATH,VISUAL_PATH].includes(req.url)||req.method==='GET'&&[MATERIAL_PATH+'/ready',ASSIST_PATH+'/ready',DESIGN_PATH+'/ready',LOGO_PATH+'/ready',VISUAL_PATH+'/ready'].includes(req.url);if(!configuredRoute)return false;res.writeHead(503,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"error":"MERIDIAN_CONNECTION_NOT_CONFIGURED"}');return true;};
 }
}

