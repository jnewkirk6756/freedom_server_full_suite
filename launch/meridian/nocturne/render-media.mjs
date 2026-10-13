import {ContractError} from '../shared/errors.mjs';
import {jpegSource,pngSource} from './source-parsers.mjs';
const fail=()=>{throw new ContractError('INVALID_IMAGE','Use a bounded complete still image without metadata.',400);};
export function decodeBase64(value,maxBytes){
 if(typeof value!=='string'||!value.length||value.length>4*Math.ceil(maxBytes/3)||value.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))fail();
 const bytes=Buffer.from(value,'base64');if(!bytes.length||bytes.length>maxBytes||bytes.toString('base64')!==value)fail();return bytes;
}
function checkExifOrientation(bytes){
 let t=bytes;if(bytes.subarray(0,6).equals(Buffer.from('Exif\0\0')))t=bytes.subarray(6);
 if(t.length<8)fail();const endian=t.toString('latin1',0,2);if(!['II','MM'].includes(endian))fail();const le=endian==='II';const u16=p=>{if(p<0||p+2>t.length)fail();return le?t.readUInt16LE(p):t.readUInt16BE(p);};const u32=p=>{if(p<0||p+4>t.length)fail();return le?t.readUInt32LE(p):t.readUInt32BE(p);};
 if(u16(2)!==42)fail();const at=u32(4),n=u16(at);if(n>256||at+2+n*12+4>t.length)fail();let seen=false;
 for(let i=0;i<n;i++){const p=at+2+i*12;if(u16(p)===0x112){if(seen||u16(p+2)!==3||u32(p+4)!==1||u16(p+8)!==1)fail();seen=true;}}
}
// This validates framing/dimensions, not compressed pixel integrity. Browser and provider decode.
export function sanitizeWebP(bytes,{maxBytes=1048576,maxEdge=2048,stripMetadata=false}={}){
 if(!Buffer.isBuffer(bytes)||bytes.length<26||bytes.length>maxBytes||bytes.toString('latin1',0,4)!=='RIFF'||bytes.toString('latin1',8,12)!=='WEBP'||bytes.readUInt32LE(4)+8!==bytes.length)fail();
 let extended=null,frame=null,alpha=false,meta=new Set(),parts=[];
 for(let p=12;p<bytes.length;){
  if(p+8>bytes.length)fail();const tag=bytes.toString('latin1',p,p+4),n=bytes.readUInt32LE(p+4),s=p+8,end=s+n+(n%2);
  if(end>bytes.length||n%2&&bytes[s+n]!==0)fail();let chunk=Buffer.from(bytes.subarray(p,end));
  if(tag==='VP8X'){
   if(p!==12||extended||n!==10||(bytes[s]&0xc3)||bytes[s+1]||bytes[s+2]||bytes[s+3])fail();
   extended={width:bytes.readUIntLE(s+4,3)+1,height:bytes.readUIntLE(s+7,3)+1,flags:bytes[s]};chunk[8]&=~0x2c;
  }else if(['ICCP','EXIF','XMP '].includes(tag)){
   if(!stripMetadata||!extended||meta.has(tag)||tag==='ICCP'&&frame)fail();if(tag==='EXIF')checkExifOrientation(bytes.subarray(s,s+n));meta.add(tag);p=end;continue;
  }else if(tag==='ALPH'){
   if(!extended||frame||alpha||n<1||(bytes[s]&0xc0))fail();alpha=true;
  }else if(tag==='VP8 '){
   if(frame||n<10||(bytes[s]&1)||bytes.toString('hex',s+3,s+6)!=='9d012a')fail();
   frame={width:bytes.readUInt16LE(s+6)&0x3fff,height:bytes.readUInt16LE(s+8)&0x3fff,type:tag};
  }else if(tag==='VP8L'){
   if(frame||alpha||n<5||bytes[s]!==0x2f||(bytes[s+4]&0xe0))fail();const bits=bytes.readUInt32LE(s+1);frame={width:(bits&0x3fff)+1,height:((bits>>>14)&0x3fff)+1,type:tag,alpha:!!(bits&0x10000000)};
  }else fail();
  parts.push(chunk);p=end;
 }
 if(!frame||!frame.width||!frame.height||Math.max(frame.width,frame.height)>maxEdge||extended&&(extended.width!==frame.width||extended.height!==frame.height)||!extended&&(parts.length!==1)||alpha&&frame.type!=='VP8 ')fail();
 if(extended){if(!!(extended.flags&0x10)!==(alpha||!!frame.alpha))fail();for(const [tag,flag] of [['ICCP',0x20],['EXIF',0x08],['XMP ',0x04]])if(!!(extended.flags&flag)!==meta.has(tag))fail();}
 const output=Buffer.concat([Buffer.from(bytes.subarray(0,12)),...parts]);output.writeUInt32LE(output.length-8,4);
 return {bytes:output,mime:'image/webp',width:frame.width,height:frame.height,validation:'container-only'};
}
function crc32(bytes){let crc=0xffffffff;for(const x of bytes){crc^=x;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
export function createImageValidator(){return async(bytes,{mime,maxBytes=1048576,maxEdge=2048,normalize=false}={})=>{
 try{
  if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>maxBytes)fail();
  if(mime==='image/webp')return sanitizeWebP(bytes,{maxBytes,maxEdge,stripMetadata:normalize});
  let dimensions;
  if(mime==='image/jpeg')dimensions=jpegSource(bytes);
  else if(mime==='image/png'){
   dimensions=pngSource(bytes);
   // PNG chunk checksums and canonical IHDR encoding values, without decompression.
   const depth=bytes[24],color=bytes[25];if(!({0:[1,2,4,8,16],2:[8,16],3:[1,2,4,8],4:[8,16],6:[8,16]})[color]?.includes(depth)||bytes[26]!==0||bytes[27]!==0||bytes[28]>1)fail();
   for(let p=8;p<bytes.length;){const n=bytes.readUInt32BE(p);if(crc32(bytes.subarray(p+4,p+8+n))!==bytes.readUInt32BE(p+8+n))fail();p+=12+n;}
  }else fail();
  if(Math.max(dimensions.width,dimensions.height)>maxEdge)fail();
  return {bytes,mime,...dimensions,validation:'container-only'};
 }catch{fail();}
};}
