import {MeshBuilder} from './world-graphics.js';
import {buildRoom} from './world-rooms.js';
import {ROOMS,FLOOR_HEIGHT} from './travel-core.js';
const transform=(data,r)=>{const o=new Float32Array(data),c=Math.cos(r.yaw),s=Math.sin(r.yaw);for(let i=0;i<o.length;i+=12){const x=data[i],z=data[i+2],nx=data[i+3],nz=data[i+5];o[i]=r.x+c*x+s*z;o[i+1]+=r.floor*FLOOR_HEIGHT;o[i+2]=r.z-s*x+c*z;o[i+3]=c*nx+s*nz;o[i+5]=-s*nx+c*nz;}return o;};
function furnishedRoom(kind){if(['living','bedroom','bathroom'].includes(kind))return buildRoom(kind,{openFront:true}).mesh;if(kind==='reading')return buildRoom('living',{openFront:true}).mesh;
 const b=new MeshBuilder(),box=(...a)=>b.box(...a),cyl=(...a)=>b.cylinder(...a),soft=(...a)=>b.rounded(...a);
 const dark=0x292632,wood=0x564132,brass=0xaf8a58,stone=0xbfb5a3,linen=0xc4bbaa;
 box(0,-.09,0,8,.18,8,stone,1);box(0,3.35,0,8,.14,8,dark);box(0,1.65,-4,8,3.3,.14,dark);for(const x of [-4,4])box(x,1.65,0,.14,3.3,8,wood,1);for(const x of [-2.55,2.55])box(x,1.65,4,2.9,3.3,.14,dark);box(0,2.96,4,2.2,.78,.14,dark);
 box(0,2,-3.9,6.7,2.3,.03,0x9faabb,4);for(const x of [-3,-1,1,3])box(x,2,-3.8,.05,2.7,.06,brass,3);
 for(const z of [-3.86,3.85])box(0,3.2,z,7.75,.025,.05,0xe7bd82,7);
 if(kind==='kitchen'){for(let i=0;i<7;i++){box(-3+i, .54,-3.25,.93,1.05,1.25,wood,1);box(-3+i,1.10,-3.25,.99,.065,1.3,stone,3);box(-3+i,.6,-2.6,.32,.02,.025,brass,3);}box(0,.53,-.35,2.8,1.02,1.6,dark,1);box(0,1.09,-.35,3,.09,1.8,stone,3);for(const x of [-.8,.8]){cyl(x,.65,1.2,.30,.10,linen,2);cyl(x,.32,1.2,.04,.6,brass,3);cyl(x,2.75,-.2,.23,.12,0xf0ce94,7);cyl(x,3.05,-.2,.014,.5,brass,3);}}
 else if(kind==='dining'){soft(0,.8,-.5,3.1,.12,1.65,wood,1,0,.06);for(const x of [-1,1])for(const z of [-1.8,.9]){soft(x,.51,z,.6,.12,.62,linen,2);soft(x,.9,z+(z<0?-.26:.26),.6,.75,.12,dark,2);for(const dx of [-.21,.21])box(x+dx,.25,z,.035,.46,.42,brass,3);}for(let i=0;i<4;i++)cyl(-.7+i*.45,2.72,-.5,.14,.14,0xf1c793,7);}
 else if(kind==='studio'){box(0,.8,-.6,3.05,.10,1.1,wood,1);for(const x of [-1.3,1.3])box(x,.4,-.6,.06,.8,.8,brass,3);box(0,1.3,-.9,1.25,.67,.065,dark);box(0,1.3,-.851,1.16,.60,.012,0x715596,7);box(0,.88,-.4,.8,.025,.28,dark);soft(0,.56,.75,.66,.18,.7,linen,2);soft(0,1.06,1.03,.7,.85,.14,dark,2);for(let i=0;i<5;i++)box(-3.45,.35+i*.56,-.8,.4,.05,3.8,wood,1);}
 else {box(0,3.3,0,8,.06,8,dark);for(let i=0;i<9;i++)box(-3.4+i*.84,3.12,0,.15,.15,7.8,wood,1);for(const x of [-2.4,2.4]){soft(x,.48,-1.35,1.2,.32,2.6,linen,2);soft(x,.83,-2.4,1.2,.7,.2,dark,2);}cyl(0,.55,-1.5,.75,.075,brass,3);}
 for(const x of [-3,3]){cyl(x,.28,2.85,.22,.52,wood);for(let i=0;i<6;i++)b.ellipsoid(x+Math.sin(i*2.3)*.2,.8+i*.08,2.85+Math.cos(i*2.3)*.2,.13,.37,.08,0x486250,0,i,10,6);}
 return b.result();}
export function buildResidence(){const b=new MeshBuilder(),box=(...a)=>b.box(...a);const stone=0x9f9688,dark=0x302e36,brass=0xb99768;
 box(0,-.1,0,4,.2,18,stone,1);
 // Upper floor: leave the stairwell open, with two continuous side galleries.
 for(const x of [-1.6,1.6])box(x,3.51,0,.8,.18,18,stone,1);box(0,3.51,-6.25,2.4,.18,5.5,stone,1);box(0,3.51,5.9,2.4,.18,6.2,stone,1);
 for(const y of [0,3.6]){for(const x of [-2,2])for(const z of [-8,-1.5,1.5,8])box(x,y+1.65,z,.10,3.3,z===-8||z===8?2:3,dark);for(const z of [-9,9])box(0,y+1.65,z,4,3.3,.12,dark);if(y>0)box(0,y+3.36,0,4,.12,18,dark);else{for(const x of [-1.6,1.6])box(x,3.36,0,.8,.12,18,dark);box(0,3.36,-6.25,2.4,.12,5.5,dark);box(0,3.36,5.9,2.4,.12,6.2,dark);}for(const x of [-1.93,1.93])box(x,y+3.2,0,.035,.025,17.7,0x9f71d3,7);}
 for(let i=0;i<18;i++){const h=(i+1)*.2,z=2.55-i*.32;box(0,h/2,z,2.04,h,.32,0x594837,1);box(0,h+.007,z+.15,2.01,.018,.025,0xe5bf85,7);}
 // Structural handrails along the open upper gallery. Stair travel uses deliberate waypoint clicks.
 for(const x of [-1.2,1.2]){box(x,4.65,-.25,.035,.04,6.1,brass,3);for(let i=0;i<10;i++)box(x,4.13,2.5-i*.6,.026,1.03,.026,brass,3);}
 return {hall:b.result(),rooms:ROOMS.map(r=>({id:r.id,mesh:transform(furnishedRoom(r.art),r)}))};}
export function portalMesh(nodes,selected,characterId){const b=new MeshBuilder();for(const n of nodes){const c=n.id===selected?0xd2a6ff:n.id===characterId?0x84e1be:0xaabbd6;b.cylinder(n.p[0],n.p[1]+.025,n.p[2],.42,.025,c,7,.42,24);b.ellipsoid(n.p[0],n.p[1]+.42,n.p[2],.105,.105,.105,c,7,0,10,8);b.cylinder(n.p[0],n.p[1]+.22,n.p[2],.013,.36,c,7); }return b.result();}
