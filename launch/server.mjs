/** Read-only staging host. Does not load account data or issue provider calls. Secret checks return presence only. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {publicVideoCapabilities} from './video-router.mjs';
import {openAIDirector} from './director-core.mjs';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(here,'../aurelia-preview/index.html');
const localSource=path.resolve(here,'../preview/index.html');
const template=fs.readFileSync(fs.existsSync(source)?source:localSource,'utf8');
const coreTemplate=template.replace(",'${esc(S.avatar.name)}',",",esc(S.avatar.name),");
const core=coreTemplate.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if(!core)throw new Error('Preview entry script missing');
const appHTML=coreTemplate.replace('<script>'+core+'</script>','<script type="application/x-aurelia-boot" id="aurelia-core">'+core+'</script><script src="/startup.js" defer></script>');
const hashes="'sha256-"+crypto.createHash('sha256').update(core).digest('base64')+"'";
const version='0.47.0';
const status={version,stage:'staging',accountSync:false,acceptsPrivateServerData:false,aiVerified:false,aiRequestsEnabled:false,preview:'device-local',materialPack:'generated-finishes-v1',materialAssets:10,photoEnvironments:{enabled:true,count:3,source:'Poly Haven CC0',sourceResolution:'8K tonemapped photographic panoramas',selfHosted:false},buildCommit:process.env.RENDER_GIT_COMMIT||null,venice:{credentialPresent:Boolean(process.env.VENICE_API_KEY),privateBackendActive:false,liveReplyVerified:false,videoRouter:'capability-aware-v1',matrix:'nwe-2.4-reflective-wave-ai',nps:'nps-1-alpha',commission:'character-commission-v1',director:'openai-structured-v1',experience:'companion-intelligence-v3',haptics:'vr-haptics-v1',characterSave:'persistent-ai-identity-v1',liveEngine:'wave-feelings-v1',sessionModel:'evidence-grounded-v1',intentBridge:'telemetry-delta-v1',sessionHistory:'beta-history-v1',waveform:'strict-zero-contract-v3',autoSession:'ai-command-v1'}};
const materialNames=new Set(['ivory','greige','ceiling','oak','stone','walnut','fabric','leather','brass','garden']);
const csp=`default-src 'self'; script-src 'self' ${hashes}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://dl.polyhaven.org; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
const files=new Map([['/preview-enhancements.js',['preview-enhancements.js','text/javascript']],['/recovery-core.js',['recovery-core.js','text/javascript']],['/launch-client.js',['launch-client.js','text/javascript']],['/quality.js',['quality.js','text/javascript']],['/studio.js',['studio.js','text/javascript']],['/studio-core.js',['studio-core.js','text/javascript']],['/studio.css',['studio.css','text/css']],...['reliability-core.js','startup.js','player.js','player-storage.js','player-deck.js','stability.js','xr-theater.js','world-core.js','world-graphics.js','world-rooms.js','world-panel.js','world.js','spatial-upgrade.js','travel-core.js','travel-house.js','travel.js','materials.js','materials-ui.js','photo-environments.js','photo-space.js'].map(name=>['/'+name,[name,'text/javascript']]),['/player.css',['player.css','text/css']],['/world.css',['world.css','text/css']],['/travel.css',['travel.css','text/css']],['/photo-space.css',['photo-space.css','text/css']],['/video-router.js',['video-router.js','text/javascript']],['/video-router.css',['video-router.css','text/css']],['/matrix.js',['matrix.js','text/javascript']],['/matrix-core.js',['matrix-core.js','text/javascript']],['/matrix.css',['matrix.css','text/css']],['/nps.js',['nps.js','text/javascript']],['/nps-core.js',['nps-core.js','text/javascript']],['/nps.css',['nps.css','text/css']],['/commission.js',['commission.js','text/javascript']],['/commission-core.js',['commission-core.js','text/javascript']],['/commission.css',['commission.css','text/css']],['/director.js',['director.js','text/javascript']],['/director.css',['director.css','text/css']],['/experience.js',['experience.js','text/javascript']],['/experience-mobile.js',['experience-mobile.js','text/javascript']],['/experience.css',['experience.css','text/css']],['/experience-core.js',['experience-core.js','text/javascript']],['/haptics-core.js',['haptics-core.js','text/javascript']],['/character-save.js',['character-save.js','text/javascript']],['/live-engine.js',['live-engine.js','text/javascript']],['/session-model.js',['session-model.js','text/javascript']],['/session-history.js',['session-history.js','text/javascript']]]);
const sessions=new Map();function newSession(){const token=crypto.randomBytes(24).toString('base64url');sessions.set(token,{created:Date.now(),calls:0});return token}function session(req){const t=req.headers['x-nocturne-session'];const v=typeof t==='string'?sessions.get(t):null;if(v&&Date.now()-v.created<12*60*60*1000)return {token:t,value:v};return null}async function jsonBody(req,limit=20000){let n=0,chunks=[];for await(const c of req){n+=c.length;if(n>limit)throw Error('BODY_TOO_LARGE');chunks.push(c)}return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}')}
export const server=http.createServer(async(req,res)=>{
 const headers={'cache-control':'no-store','permissions-policy':'xr-spatial-tracking=(self), accelerometer=(self), gyroscope=(self), camera=(), microphone=()','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':csp};
 function reply(code,type,body){res.writeHead(code,{...headers,'content-type':type});res.end(req.method==='HEAD'?'':body);}
 try{
  if(req.url.length>2048)return reply(414,'text/plain','URL too long');
  const u=new URL(req.url,'http://staging.invalid');
  if(req.method==='GET'&&u.pathname==='/v1/director/status'){let ss=session(req),token=null;if(!ss){token=newSession();ss={token,value:sessions.get(token)}}return reply(200,'application/json',JSON.stringify({ok:true,openAIConfigured:Boolean(process.env.OPENAI_API_KEY),model:process.env.OPENAI_MODEL||'gpt-5.6-luna',sessionAccepted:Boolean(session(req)),sessionToken:token,calls:ss.value.calls}))}
  if(req.method==='POST'&&u.pathname==='/v1/director/respond'){const ss=session(req);if(!ss)return reply(401,'application/json',JSON.stringify({error:{code:'SESSION_REQUIRED',message:'Start a staging Director session first.'}}));if(ss.value.calls>=100)return reply(429,'application/json',JSON.stringify({error:{code:'SESSION_LIMIT',message:'Staging Director call limit reached.'}}));try{const body=await jsonBody(req);if(typeof body.text!=='string'||!body.text.trim())return reply(400,'application/json',JSON.stringify({error:{code:'TEXT_REQUIRED',message:'Enter a message.'}}));const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),25000);let out;try{out=await openAIDirector({apiKey:process.env.OPENAI_API_KEY,model:process.env.OPENAI_MODEL||'gpt-5.6-luna',text:body.text,context:body.context,signal:controller.signal})}catch(error){out=await openAIDirector({text:body.text,context:body.context});out.degraded=true;out.providerError=String(error.message).slice(0,80)}finally{clearTimeout(timer)}ss.value.calls++;return reply(200,'application/json',JSON.stringify({ok:true,director:out,calls:ss.value.calls}))}catch(error){return reply(400,'application/json',JSON.stringify({error:{code:'BAD_REQUEST',message:'Director request was not accepted.'}}))}}
  if(!['GET','HEAD'].includes(req.method))return reply(503,'application/json',JSON.stringify({error:{code:'STAGING_READ_ONLY',message:'Private account writes remain disabled outside the scoped Director endpoint.'}}));
  if(u.pathname==='/v1/health'||u.pathname==='/launch-status.json')return reply(200,'application/json',JSON.stringify({ok:true,...status}));
  if(u.pathname==='/v1/video/capabilities')return reply(200,'application/json',JSON.stringify(publicVideoCapabilities({credentialPresent:Boolean(process.env.VENICE_API_KEY),routerEnabled:false})));
  if(u.pathname.startsWith('/v1/')||u.pathname.startsWith('/api/'))return reply(503,'application/json',JSON.stringify({error:{code:'STAGING_READ_ONLY',message:'This is a device-local preview, not a connected private backend.'}}));
  if(u.pathname==='/robots.txt')return reply(200,'text/plain','User-agent: *\nDisallow: /\n');
  if(u.pathname==='/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'index.html'),'utf8'));
  if(u.pathname==='/travel'||u.pathname==='/travel/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'travel.html')));
  if(u.pathname==='/photo-space'||u.pathname==='/photo-space/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'photo-space.html')));
  if(u.pathname==='/venice-setup'||u.pathname==='/venice-setup/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'venice-setup.html')));
  if(u.pathname==='/video-router'||u.pathname==='/video-router/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'video-router.html')));
  if(u.pathname==='/matrix'||u.pathname==='/matrix/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'matrix.html')));
  if(u.pathname==='/nps'||u.pathname==='/nps/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'nps.html')));
  if(u.pathname==='/commission'||u.pathname==='/commission/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'commission.html')));
  if(u.pathname==='/director'||u.pathname==='/director/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'director.html')));
  if(u.pathname==='/experience'||u.pathname==='/experience/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'experience.html')));
  if(u.pathname==='/world'||u.pathname==='/world/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'world.html')));
  if(u.pathname==='/player'||u.pathname==='/player/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'player.html')));
  if(u.pathname==='/app'||u.pathname==='/app/')return reply(200,'text/html; charset=utf-8',appHTML);
  if(u.pathname==='/materials/manifest.json')return reply(200,'application/json',fs.readFileSync(path.join(here,'materials/manifest.json')));
  const material=u.pathname.match(/^\/materials\/([a-z]+)\.webp$/);if(material&&materialNames.has(material[1]))return reply(200,'image/webp',fs.readFileSync(path.join(here,'materials',material[1]+'.webp')));
  const item=files.get(u.pathname);if(item)return reply(200,item[1]+'; charset=utf-8',fs.readFileSync(path.join(here,item[0])));
  return reply(404,'text/plain','Not found');
 }catch{return reply(500,'text/plain','Staging page unavailable');}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||8787),process.env.HOST||'0.0.0.0',()=>console.log('Nocturne 0.47 Phase Wave + Mobile Polish started; private account writes and AI calls remain disabled. VENICE_CREDENTIAL_PRESENT='+Boolean(process.env.VENICE_API_KEY)+' BOUND_PORT='+server.address().port));
