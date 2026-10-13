/** Sharp is injected from a reviewed runtime dependency; no installation or network at import. */
import {ContractError} from '../shared/errors.mjs';
const fail=()=>{throw new ContractError('INVALID_IMAGE','Use a complete, supported still image within the size limits.',400);};
export function decodeBase64(value,maxBytes){
 if(typeof value!=='string'||!value.length||value.length>4*Math.ceil(maxBytes/3)||value.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value))fail();
 const bytes=Buffer.from(value,'base64');if(!bytes.length||bytes.length>maxBytes||bytes.toString('base64')!==value)fail();return bytes;
}
export function createImageValidator(sharp){
 if(typeof sharp!=='function')throw new TypeError('A reviewed Sharp decoder is required.');
 return async function validate(bytes,{mime,maxBytes=1024*1024,maxEdge=2048,normalize=false,lossless=false}={}){
  try{
   if(!Buffer.isBuffer(bytes)||!bytes.length||bytes.length>maxBytes)fail();
   const image=sharp(bytes,{failOn:'warning',limitInputPixels:maxEdge*maxEdge,animated:true}).timeout({seconds:10});
   const m=await image.metadata();
   if(!['jpeg','png','webp'].includes(m.format)||mime!==`image/${m.format}`||!m.width||!m.height||Math.max(m.width,m.height)>maxEdge||(m.pages??1)!==1)fail();
   // Decode all pixels, not metadata alone. Re-encoding drops metadata/EXIF by default.
   const output=normalize?await image.rotate().webp(lossless?{lossless:true}:{quality:85}).toBuffer():await image.raw().toBuffer();
   if(normalize&&output.length>maxBytes)fail();
   return {bytes:normalize?output:bytes,mime:normalize?'image/webp':mime,width:normalize&&[5,6,7,8].includes(m.orientation)?m.height:m.width,height:normalize&&[5,6,7,8].includes(m.orientation)?m.width:m.height};
  }catch{fail();}
 };
}
