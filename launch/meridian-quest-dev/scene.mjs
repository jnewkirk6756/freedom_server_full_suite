/** Geometry is built only from explicitly confirmed rectangular dimensions. Metres, +Y up. */
export function validateRoom(room){
 if(!room)return null;
 if(room.rectangleConfirmed!==true||room.heightConfirmed!==true||!['width','depth','height'].every(k=>typeof room[k]==='number'&&Number.isFinite(room[k])&&room[k]>0&&room[k]<=610))throw Error('A shell needs confirmed, finite rectangular dimensions and height in metres.');
 return {width:room.width,depth:room.depth,height:room.height,rectangleConfirmed:true,heightConfirmed:true};
}
function quad(a,b,c,d){return new Float32Array([...a,...b,...c,...a,...c,...d]);}
export function roomSurfaces(input){const room=validateRoom(input);if(!room)return [];const {width:w,depth:d,height:h}=room,x=w/2,z=d/2;
 return [
 {name:'Measured floor',positions:quad([-x,0,-z],[-x,0,z],[x,0,z],[x,0,-z]),color:[.2,.25,.3,1]},
 {name:'Back wall — openings not represented',positions:quad([-x,0,-z],[x,0,-z],[x,h,-z],[-x,h,-z]),color:[.4,.46,.5,1]},
 {name:'Left wall — openings not represented',positions:quad([-x,0,z],[-x,0,-z],[-x,h,-z],[-x,h,z]),color:[.32,.38,.45,1]},
 {name:'Right wall — openings not represented',positions:quad([x,0,-z],[x,0,z],[x,h,z],[x,h,-z]),color:[.32,.38,.45,1]},
 {name:'Front wall — openings not represented',positions:quad([x,0,z],[-x,0,z],[-x,h,z],[x,h,z]),color:[.4,.46,.5,1]},
 ];}
export function multiply(a,b){const c=new Float32Array(16);for(let col=0;col<4;col++)for(let row=0;row<4;row++)for(let k=0;k<4;k++)c[col*4+row]+=a[k*4+row]*b[col*4+k];return c;}
export function transform(position=[0,0,0],scale=[1,1,1]){return new Float32Array([scale[0],0,0,0,0,scale[1],0,0,0,0,scale[2],0,...position,1]);}
export function perspective(aspect){const f=1/Math.tan(Math.PI/6),near=.05,far=50;return new Float32Array([f/aspect,0,0,0,0,f,0,0,0,0,(far+near)/(near-far),-1,0,0,2*far*near/(near-far),0]);}
export const panel={x:0,y:1.55,z:-1.7,width:1.4,height:.88};
export function panelHit(matrix,target=panel){
 const origin=[matrix[12],matrix[13],matrix[14]],dir=[-matrix[8],-matrix[9],-matrix[10]];
 if(Math.abs(dir[2])<1e-7)return null;
 const t=(target.z-origin[2])/dir[2];if(t<=0||t>8)return null;
 const x=origin[0]+dir[0]*t,y=origin[1]+dir[1]*t;
 if(Math.abs(x-target.x)>target.width/2||Math.abs(y-target.y)>target.height/2)return null;
 return {u:(x-target.x)/target.width+.5,v:.5-(y-target.y)/target.height,t};
}
export function panelAction(hit){if(!hit||hit.v<.67||hit.v>.92)return null;return hit.u>.04&&hit.u<.33?'scene':hit.u>.36&&hit.u<.65?'snapshot':hit.u>.68&&hit.u<.97?'exit':null;}
export function roomGltf(room){
 const surfaces=roomSurfaces(room);if(!surfaces.length)throw Error('No confirmed room dimensions.');
 const positions=new Float32Array(surfaces.flatMap(s=>Array.from(s.positions))),bytes=new Uint8Array(positions.buffer);let binary='';for(const b of bytes)binary+=String.fromCharCode(b);
 return {asset:{version:'2.0',generator:'Meridian isolated XR foundation'},extras:{provenance:'Dimension-only rectangular room shell. Open top, no wall thickness. No generated finishes, openings, fixtures, photo reconstruction, or site alignment.',units:'metres'},scene:0,scenes:[{nodes:surfaces.map((_,i)=>i)}],nodes:surfaces.map((s,i)=>({name:s.name,mesh:i})),meshes:surfaces.map((_,i)=>({primitives:[{attributes:{POSITION:i},material:i}]})),materials:surfaces.map(s=>({name:s.name,pbrMetallicRoughness:{baseColorFactor:s.color,metallicFactor:0,roughnessFactor:.9},doubleSided:true})),buffers:[{byteLength:bytes.byteLength,uri:'data:application/octet-stream;base64,'+btoa(binary)}],bufferViews:surfaces.map((s,i)=>({buffer:0,byteOffset:i*72,byteLength:72,target:34962})),accessors:surfaces.map((s,i)=>({bufferView:i,componentType:5126,count:6,type:'VEC3',min:[0,1,2].map(k=>Math.min(...Array.from(s.positions).filter((_,j)=>j%3===k))),max:[0,1,2].map(k=>Math.max(...Array.from(s.positions).filter((_,j)=>j%3===k)))}))};
}
export async function capabilities(scope=globalThis){if(!scope.isSecureContext)return {vr:false,ar:false,reason:'XR needs HTTPS or localhost.'};if(!scope.navigator?.xr)return {vr:false,ar:false,reason:'WebXR is unavailable in this browser. The desktop preview still works.'};const check=async mode=>{try{return await scope.navigator.xr.isSessionSupported(mode);}catch{return false;}};const [vr,ar]=await Promise.all([check('immersive-vr'),check('immersive-ar')]);return {vr,ar,reason:vr||ar?'Ready. Entering XR requires your click and browser approval.':'This browser/device does not offer immersive VR or AR.'};}
