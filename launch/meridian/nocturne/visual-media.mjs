/** Canonical base64 and bounded still-image framing only; OpenAI decodes compressed pixels. */
import {createImageValidator,decodeBase64} from './render-media.mjs';
import {createHash} from 'node:crypto';
import {validateVisualInput} from '../shared/visual-review.mjs';
export const VISUAL_LIMITS=Object.freeze({originalBytes:1024*1024,generatedBytes:8*1024*1024,requestBytes:13*1024*1024,responseBytes:65536,outputTextBytes:32768,timeoutMs:45000});
const failure=()=>Object.assign(new Error('The saved images could not be validated.'),{code:'VISUAL_IMAGE_INVALID',status:400});
/** Source images were normalized at capture; signed hosted context binds the frozen originals. */
export function createVisualImageValidator(){
 const validateContainer=createImageValidator();
 return async input=>{
  const safe=validateVisualInput(input);
  for(let i=0;i<safe.images.length;i++){
   const image=safe.images[i],match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image.imageUrl);
   try{
    const maxBytes=i?VISUAL_LIMITS.generatedBytes:VISUAL_LIMITS.originalBytes,maxEdge=i?1024:2048;
    const bytes=decodeBase64(match[2],maxBytes),checked=await validateContainer(bytes,{mime:match[1],maxBytes,maxEdge,normalize:true});
    if(i&&(checked.width!==1024||checked.height!==1024||createHash('sha256').update(bytes).digest('hex')!==safe.context.outputSha256))throw failure();
    // Preserve the hash-bound frozen source bytes. Container checks do not certify compressed pixels.
    image.imageUrl=`data:${match[1]};base64,${bytes.toString('base64')}`;
   }catch{throw failure();}
  }
  return safe;
 };
}
