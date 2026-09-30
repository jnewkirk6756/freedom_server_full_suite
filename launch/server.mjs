/** Read-only staging service. It never opens the account store or calls an AI provider. */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url));
const source=path.resolve(here,'../aurelia-preview/index.html');
const localSource=path.resolve(here,'../preview/index.html');
const template=fs.readFileSync(fs.existsSync(source)?source:localSource,'utf8');
const appHTML=template.replace(",'${esc(S.avatar.name)}',",",esc(S.avatar.name),").replace('</body>','<script type="module" src="/preview-enhancements.js"></script></body>');
const hashes=[...appHTML.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m=>m[1].trim()).map(m=>"'sha256-"+crypto.createHash('sha256').update(m[1]).digest('base64')+"'").join(' ');
const version='0.12.0';
const status={version,stage:'staging',accountSync:false,acceptsPrivateServerData:false,aiVerified:false,aiRequestsEnabled:false,preview:'device-local',buildCommit:process.env.RENDER_GIT_COMMIT||null};
const csp=`default-src 'self'; script-src 'self' ${hashes}; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'`;
const publicFiles=new Map([['/preview-enhancements.js',['preview-enhancements.js','text/javascript']],['/recovery-core.js',['recovery-core.js','text/javascript']],['/launch-client.js',['launch-client.js','text/javascript']]]);
export const server=http.createServer((req,res)=>{
 const headers={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','x-frame-options':'DENY','content-security-policy':csp};
 function reply(code,type,body){res.writeHead(code,{...headers,'content-type':type});res.end(req.method==='HEAD'?'':body);}
 try{
  if(req.url.length>2048)return reply(414,'text/plain','URL too long');
  const u=new URL(req.url,'http://staging.invalid');
  if(!['GET','HEAD'].includes(req.method))return reply(503,'application/json',JSON.stringify({error:{code:'STAGING_READ_ONLY',message:'Account login, uploads and AI are disabled until a configured private backend is verified.'}}));
  if(u.pathname==='/v1/health'||u.pathname==='/launch-status.json')return reply(200,'application/json',JSON.stringify({ok:true,...status}));
  if(u.pathname.startsWith('/v1/')||u.pathname.startsWith('/api/'))return reply(503,'application/json',JSON.stringify({error:{code:'STAGING_READ_ONLY',message:'This is a preview host, not a connected private account backend.'}}));
  if(u.pathname==='/robots.txt')return reply(200,'text/plain','User-agent: *\nDisallow: /\n');
  if(u.pathname==='/')return reply(200,'text/html; charset=utf-8',fs.readFileSync(path.join(here,'index.html')));
  if(u.pathname==='/app'||u.pathname==='/app/')return reply(200,'text/html; charset=utf-8',appHTML);
  const item=publicFiles.get(u.pathname);if(item)return reply(200,item[1]+'; charset=utf-8',fs.readFileSync(path.join(here,item[0])));
  return reply(404,'text/plain','Not found');
 }catch{return reply(500,'text/plain','Staging page unavailable');}
});
server.requestTimeout=15000;server.headersTimeout=10000;
server.listen(Number(process.env.PORT||8787),process.env.HOST||'0.0.0.0',()=>console.log('Aurelia 0.12 staging host started; account writes and AI calls are disabled.'));
