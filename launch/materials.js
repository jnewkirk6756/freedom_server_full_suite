/** Project image finishes. All assets self-hosted; no private data or provider calls. */
export const FINISH_KEY='aurelia.preview.finishes.v1';
export const MATERIALS=['ivory','greige','ceiling','oak','stone','walnut','fabric','leather','brass','garden'];
export const PRESETS={warm:{wall:0,floor:3,seating:6,light:'day'},mineral:{wall:1,floor:4,seating:6,light:'day'},cognac:{wall:0,floor:5,seating:7,light:'golden'}};
export function normalFinish(v={}){return {wall:[0,1].includes(v.wall)?v.wall:0,floor:[3,4,5].includes(v.floor)?v.floor:3,seating:[6,7].includes(v.seating)?v.seating:6,light:['day','golden','night'].includes(v.light)?v.light:'day',enabled:v.enabled!==false,brightness:[.85,1,1.15].includes(v.brightness)?v.brightness:1};}
export function readFinishes(storage){try{const data=JSON.parse(storage.getItem(FINISH_KEY)||'{}');if(!data||typeof data!=='object'||Array.isArray(data))return {};const out={};for(const id of ['hall','living','kitchen','studio','dining','bedroom','bathroom','reading','terrace'])if(data[id])out[id]=normalFinish(data[id]);return out;}catch{return {};}}
export function defaultFinish(id){return normalFinish(['bathroom','terrace','hall'].includes(id)?{wall:1,floor:4}:{});}
export function finishFor(settings,id){return settings[id]?normalFinish(settings[id]):defaultFinish(id);}
export function changeFinish(settings,id,action){const f=finishFor(settings,id),next={...settings};if(action.startsWith('preset:'))Object.assign(f,PRESETS[action.slice(7)]||{});else if(action==='walls')f.wall=1-f.wall;else if(action==='floor')f.floor=[3,4,5][([3,4,5].indexOf(f.floor)+1)%3];else if(action==='seating')f.seating=f.seating===6?7:6;else if(action==='compare')f.enabled=!f.enabled;else if(action==='brightness')f.brightness=[.85,1,1.15][([.85,1,1.15].indexOf(f.brightness)+1)%3];else if(action.startsWith('light:')&&['day','golden','night'].includes(action.slice(6)))f.light=action.slice(6);else if(action==='reset'){delete next[id];return next;}next[id]=normalFinish(f);return next;}
export function materialAssignment(shape,args,room='living'){
 const a=[...args],colorIndex=shape==='box'||shape==='rounded'||shape==='ellipsoid'?6:5,kindIndex=colorIndex+1;
 const c=a[colorIndex],k=a[kindIndex]||0; if(k>=10||k===5||k===6||k===7)return a;
 let material=k;
 if(k===4)material=19;
 else if(shape==='box'&&a[1]<.01&&a[3]>3&&a[5]>3)material=['bathroom','terrace','hall'].includes(room)?14:13;
 else if(shape==='box'&&a[1]>3.25&&a[3]>3&&a[5]>3)material=12;
 else if(shape==='box'&&a[4]>2.5&&(a[3]>2||a[5]>2)&&k===0)material=room==='bathroom'?11:10;
 else if(k===2)material=16;
 else if(k===1)material=15;
 else if([0x513a2e,0x564132,0x594837].includes(c))material=15;
 else if([0xb3935b,0xaf8a58,0xb99768,0xae9e87,0x9f9688].includes(c)&&k===3)material=18;
 a[kindIndex]=material;return a;
}
export function atlasUV(index,u,v,pad=.018){const fract=x=>x-Math.floor(x);return [(index%4+pad+fract(u)*(1-pad*2))/4,(3-Math.floor(index/4)+pad+fract(v)*(1-pad*2))/4];}
function imageFromBlob(blob){return new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(blob);img.onload=()=>{URL.revokeObjectURL(url);resolve(img);};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Image decoding failed'));};img.src=url;});}
export class MaterialLibrary{
 constructor(renderer){this.renderer=renderer;this.images=new Map();this.loaded=0;this.failed=[];this.state='not-loaded';this.atlasSize=1024;this.bytes=0;this.readyMask=new Float32Array(10);this.promise=null;}
 async load(){if(this.promise)return this.promise;this.promise=this._load();return this.promise;}
 async _load(){this.state='loading';this.failed=[];const started=performance.now();await Promise.all(MATERIALS.map(async(id,index)=>{try{const r=await fetch('/materials/'+id+'.webp',{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP '+r.status);const blob=await r.blob();const img=await imageFromBlob(blob);this.images.set(id,img);this.readyMask[index]=1;this.bytes+=blob.size;}catch{this.failed.push(id);}}));this.loaded=this.images.size;this.state=this.loaded===10?'ready':this.loaded?'partial':'fallback';this.loadMs=Math.round(performance.now()-started);if(this.loaded){try{const max=this.renderer.gl.getParameter(this.renderer.gl.MAX_TEXTURE_SIZE),supported=[1024,2048,4096].filter(n=>n<=max);if(!supported.length)throw Error('No supported atlas tier');this.buildAtlas(Math.min(this.atlasSize,supported.at(-1)));const garden=this.images.get('garden');if(garden)this.renderer.texture(4,garden,false);}catch{this.state='fallback';this.readyMask.fill(0);this.failed.push('gpu-upload');}}return this.info();}
 buildAtlas(size=1024){if(![1024,2048,4096].includes(size))throw Error('Unsupported atlas size');const gl=this.renderer.gl;if(size>gl.getParameter(gl.MAX_TEXTURE_SIZE))throw Error('Atlas exceeds this device limit');this.atlasSize=size;const c=document.createElement('canvas');c.width=c.height=size;const ctx=c.getContext('2d'),cell=size/4,pad=Math.max(4,Math.round(cell*.018));ctx.fillStyle='#a79f91';ctx.fillRect(0,0,size,size);
  for(let i=0;i<9;i++){const im=this.images.get(MATERIALS[i]);if(!im)continue;const x=(i%4)*cell,y=Math.floor(i/4)*cell;ctx.drawImage(im,x,y,cell,cell);ctx.drawImage(im,0,0,im.width,1,x,y,cell,pad);ctx.drawImage(im,0,im.height-1,im.width,1,x,y+cell-pad,cell,pad);ctx.drawImage(im,0,0,1,im.height,x,y,pad,cell);ctx.drawImage(im,im.width-1,0,1,im.height,x+cell-pad,y,pad,cell);ctx.drawImage(im,x+pad,y+pad,cell-2*pad,cell-2*pad);}
  this.renderer.texture(3,c,true);return c;
 }
 info(){return {state:this.state,loaded:this.loaded,total:10,failed:[...this.failed],transferBytes:this.bytes,atlasSize:this.atlasSize,atlasMB:Number((this.atlasSize**2*4*4/3/1048576).toFixed(2)),loadMs:this.loadMs||0,nativeSources:'256–512 px optimized from the project source art; atlas size is not native image or per-eye resolution'};}
 dispose(){this.images.clear();}
}
