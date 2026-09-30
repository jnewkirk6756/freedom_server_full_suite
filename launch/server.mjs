/** Read-only staging host. Does not load account data or provider credentials. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(here,'../aurelia-preview/index.html');
const localSource=path.resolve(here,'../preview/index.html');
const template=fs.readFileSync(fs.existsSync(source)?source:localSource,'utf8');
const coreTemplate=template.replace(",'${esc(S.avatar.name)}',",",esc(S.avatar.name),");
const core=coreTemplate.match(/<script>([\s\S]*?)<\/script>/)?.[1];
if(!core)throw new Error('Preview entry script missing');
const appHTML=coreTemplate.replace('<script>'+core+'</script>','<script type="application/x-aurelia-boot" id="aurelia-core">'+core+'</script><script src="/startup.js" defer></script>');
const hashes="'sha256-"+crypto.createHash('sha256').update(core).digest('base64')+"'";
const version='0.19.0';
const status={version,stage:'staging',accountSync:false,acceptsPrivateServerData:false,aiVerified:false,aiRequestsEnabled:false,preview:'device-local',buildCommit:process.env.RENDER_GIT_COMMIT||null};
const csp=`default-src 'self'; script-src 'self' ${hashes}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
const files=new Map([['/preview-enhancements.js',['preview-enhancements.js','text/javascript']],['/recovery-core.js',['recovery-core.js','text/javascript']],['/launch-client.js',['launch-client.js','text/javascript']],['/quality.js',['quality.js','text/javascript']],['/studio.js',['studio.js','text/javascript']],['/studio-core.js',['studio-core.js','text/javascript']],['/studio.css',['studio.css','text/css']],...['reliability-core.js','startup.js','player.js','player-storage.js','player-deck.js','stability.js','xr-theater.js','world-core.js','world-graphics.js','world-rooms.js','world-panel.js','world.js','spatial-upgrade.js'].map(name=>['/'+name,[name,'text/javascript']]),['/player.css',['player.css','text/css']],['/world.css',['world.css','text/css']]]);
export const server=http.createServer((req,res)=>{
 const headers={'cache-control':'no-store','permissions-policy':'xr-spatial-tracking=(self), camera=(), microphone=()','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':csp};
 function reply(code,type,body){res.writeHead(code,{...headers,'content-type':type});res.end(req.method==='HEAD'?'':body);}
 try{
  if(req.url.length>2048)return reply(414,'text/plain','URL too long');
  const u=new URL(req.url,'http://staging.invalid');
  if(!['GET','HEAD'].includes(req.method))return reply(503,'application/json',JSON.stringify({error:{code:'STAGING_READ_ONLY',message:'Private account writes and AI are not enabled on this preview host.'}}));
  if(u.pathname==='/v1/health'||u.pathname==='/launch-status.json')return reply(200,'application/json',JSON.stringify({ok:true,...status}));
  if(u.pathname.startsWith('/v1/')||u.pathname.startsWith('/api/'))return reply(503,'application/json',JSON.stringify({error:{code:'STAGING_READ_ONLY',message:'This is a device-local preview, not a connected private backend.'}}));
  if(u.pathname==='/robots.txt')return reply(200,'text/plain','User-agent: *\nDisallow: /\n');
  if(u.pathname==='/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'index.html'),'utf8').replaceAll('V0.12','V0.19').replaceAll('V0.14','V0.19'));
  if(u.pathname==='/world'||u.pathname==='/world/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'world.html')));
  if(u.pathname==='/player'||u.pathname==='/player/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'player.html')));
  if(u.pathname==='/app'||u.pathname==='/app/')return reply(200,'text/html; charset=utf-8',appHTML);
  const item=files.get(u.pathname);if(item)return reply(200,item[1]+'; charset=utf-8',fs.readFileSync(path.join(here,item[0])));
  return reply(404,'text/plain','Not found');
 }catch{return reply(500,'text/plain','Staging page unavailable');}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||8787),process.env.HOST||'0.0.0.0',()=>console.log('Aurelia 0.19 staging started; private account writes and AI calls remain disabled. BOUND_PORT='+server.address().port));
