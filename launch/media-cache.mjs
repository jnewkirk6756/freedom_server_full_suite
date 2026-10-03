import net from 'node:net';
import {URL} from 'node:url';

const PREFIX='nocturne:media:v1:';
const IDS=[...Array.from({length:21},(_,i)=>'A'+String(i).padStart(2,'0')),'A16B','A17B','A18B','A18C','A18D','A18E','A18F','A19B','A19C'];
const validId=id=>IDS.includes(String(id||'').toUpperCase());

function encodeCommand(args){
  const parts=[Buffer.from('*'+args.length+'\r\n')];
  for(const arg of args){
    const b=Buffer.isBuffer(arg)?arg:Buffer.from(String(arg));
    parts.push(Buffer.from('$'+b.length+'\r\n'),b,Buffer.from('\r\n'));
  }
  return Buffer.concat(parts);
}
function parseResp(buf,offset=0){
  if(offset>=buf.length)return null;
  const type=String.fromCharCode(buf[offset]),lineEnd=buf.indexOf('\r\n',offset);
  if(lineEnd<0)return null;
  const line=buf.subarray(offset+1,lineEnd).toString(),next=lineEnd+2;
  if(type==='+')return{value:line,next};
  if(type==='-')throw Error('REDIS_'+line);
  if(type===':')return{value:Number(line),next};
  if(type==='$'){
    const n=Number(line);if(n===-1)return{value:null,next};
    if(buf.length<next+n+2)return null;
    return{value:buf.subarray(next,next+n),next:next+n+2};
  }
  if(type==='*'){
    const n=Number(line),arr=[];let at=next;
    for(let i=0;i<n;i++){const p=parseResp(buf,at);if(!p)return null;arr.push(p.value);at=p.next;}
    return{value:arr,next:at};
  }
  throw Error('Unsupported Redis response.');
}
async function command(args,{timeout=12000}={}){
  const raw=process.env.NOCTURNE_MEDIA_REDIS_URL;if(!raw)throw Error('MEDIA_SYNC_NOT_CONFIGURED');
  const u=new URL(raw),host=u.hostname,port=Number(u.port||6379);
  return await new Promise((resolve,reject)=>{
    const socket=net.createConnection({host,port}),timer=setTimeout(()=>{socket.destroy();reject(Error('MEDIA_SYNC_TIMEOUT'));},timeout);
    let buf=Buffer.alloc(0);
    const done=(err,value)=>{clearTimeout(timer);socket.destroy();err?reject(err):resolve(value);};
    socket.on('connect',()=>socket.write(encodeCommand(args)));
    socket.on('data',chunk=>{buf=Buffer.concat([buf,chunk]);try{const p=parseResp(buf);if(p)done(null,p.value);}catch(e){done(e);}});
    socket.on('error',e=>done(e));
  });
}
const metaKey=id=>PREFIX+id+':meta',dataKey=id=>PREFIX+id+':data';
export async function mediaPing(){try{const v=await command(['PING']);return String(v)==='PONG';}catch{return false;}}
export async function mediaManifest(){
  const keys=IDS.map(metaKey),rows=await command(['MGET',...keys]),states=[];
  rows.forEach((v,i)=>{if(!v)return;try{const row=JSON.parse(Buffer.isBuffer(v)?v.toString():String(v));if(row?.id===IDS[i])states.push(row);}catch{}});
  return states.sort((a,b)=>a.id.localeCompare(b.id));
}
export async function mediaGet(id){
  id=String(id||'').toUpperCase();if(!validId(id))return null;
  const out=await command(['MGET',metaKey(id),dataKey(id)]),m=out?.[0],data=out?.[1];
  if(!m||!data)return null;
  let meta;try{meta=JSON.parse(Buffer.isBuffer(m)?m.toString():String(m));}catch{return null;}
  return{meta,data:Buffer.isBuffer(data)?data:Buffer.from(data)};
}
export async function mediaPut(id,data,meta={}){
  id=String(id||'').toUpperCase();if(!validId(id))throw Error('INVALID_MEDIA_STATE');
  if(!Buffer.isBuffer(data)||!data.length)throw Error('EMPTY_MEDIA');
  if(data.length>8*1024*1024)throw Error('MEDIA_TOO_LARGE');
  const row={id,size:data.length,mime:String(meta.mime||'video/mp4').slice(0,80),fileName:String(meta.fileName||id+'.mp4').slice(0,180),duration:Number(meta.duration)||0,width:Number(meta.width)||0,height:Number(meta.height)||0,sha256:String(meta.sha256||''),updatedAt:Date.now()};
  await command(['MSET',metaKey(id),JSON.stringify(row),dataKey(id),data],{timeout:20000});return row;
}
export async function mediaDelete(id){
  id=String(id||'').toUpperCase();if(!validId(id))return 0;
  return Number(await command(['DEL',metaKey(id),dataKey(id)]))||0;
}
export async function mediaStats(){
  const rows=await mediaManifest(),used=rows.reduce((n,x)=>n+(Number(x.size)||0),0);
  return{states:rows.length,usedBytes:used,capacityBytes:25*1024*1024};
}
export const MEDIA_IDS=IDS;
