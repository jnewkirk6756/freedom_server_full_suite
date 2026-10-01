/** Aurelia Residence topology. Scene settings are design telemetry, NOT biological readings. */
export const VERSION='0.21.0', TRAVEL_KEY='aurelia.preview.travel', FLOOR_HEIGHT=3.6;
export const AI_DISCLOSURE='Fictional AI character · non-biological · not a human participant';
export const ROOMS=[
 {id:'living',name:'Living room',floor:0,x:-6,z:-5,yaw:Math.PI/2,art:'living',mood:'social',energy:58,tone:'warm',pace:1,light:1.0,tint:[1,.96,1]},
 {id:'kitchen',name:'Kitchen',floor:0,x:6,z:-5,yaw:-Math.PI/2,art:'kitchen',mood:'bright',energy:68,tone:'upbeat',pace:1.04,light:1.1,tint:[1,1,.96]},
 {id:'studio',name:'Creative studio',floor:0,x:-6,z:5,yaw:Math.PI/2,art:'studio',mood:'focused',energy:52,tone:'clear',pace:.98,light:1,tint:[.96,.97,1]},
 {id:'dining',name:'Dining room',floor:0,x:6,z:5,yaw:-Math.PI/2,art:'dining',mood:'conversational',energy:48,tone:'welcoming',pace:.96,light:.98,tint:[1,.97,.94]},
 {id:'bedroom',name:'Upstairs suite',floor:1,x:-6,z:-5,yaw:Math.PI/2,art:'bedroom',mood:'quiet',energy:28,tone:'gentle',pace:.90,light:.88,tint:[1,.93,1]},
 {id:'bathroom',name:'Spa bathroom',floor:1,x:6,z:-5,yaw:-Math.PI/2,art:'bathroom',mood:'restorative',energy:22,tone:'calm',pace:.9,light:1.05,tint:[.95,1,1]},
 {id:'reading',name:'Reading lounge',floor:1,x:-6,z:5,yaw:Math.PI/2,art:'reading',mood:'reflective',energy:35,tone:'thoughtful',pace:.93,light:.96,tint:[1,.97,.91]},
 {id:'terrace',name:'Sky terrace',floor:1,x:6,z:5,yaw:-Math.PI/2,art:'terrace',mood:'open',energy:45,tone:'easygoing',pace:.98,light:1.08,tint:[.96,.97,1]}
];
const node=(id,name,x,y,z,neighbors)=>({id,name,p:[x,y,z],neighbors});
export const NODES=[
 node('foyer','Entrance hall',0,0,7,['studio','dining','stairs-base']),
 node('studio','Creative studio',-3.5,0,5,['foyer']),node('dining','Dining room',3.5,0,5,['foyer']),
 node('stairs-base','Foot of the stairs',0,0,3.3,['foyer','west-hall','east-hall','stair-mid']),
 node('west-hall','West passage',-1.5,0,-5,['stairs-base','living','east-hall']),
 node('east-hall','East passage',1.5,0,-5,['stairs-base','kitchen','west-hall']),
 node('living','Living room',-3.5,0,-5,['west-hall']),node('kitchen','Kitchen',3.5,0,-5,['east-hall']),
 node('stair-mid','Stair landing',0,1.8,-.1,['stairs-base','upstairs']),
 node('upstairs','Upper landing',0,3.6,-3.65,['stair-mid','upper-west','upper-east']),
 node('upper-west','Suite corridor',-1.5,3.6,-5,['upstairs','bedroom','upper-south']),
 node('upper-east','Spa corridor',1.5,3.6,-5,['upstairs','bathroom','upper-south']),
 node('bedroom','Upstairs suite',-3.5,3.6,-5,['upper-west']),node('bathroom','Spa bathroom',3.5,3.6,-5,['upper-east']),
 node('upper-south','Upper gallery',0,3.6,5,['upper-west','upper-east','reading','terrace']),
 node('reading','Reading lounge',-3.5,3.6,5,['upper-south']),node('terrace','Sky terrace',3.5,3.6,5,['upper-south'])
];
const index=new Map(NODES.map(n=>[n.id,n]));
export function getNode(id){return index.get(id)||null;}
export function pathTo(from,to){if(!index.has(from)||!index.has(to))return [];const q=[[from]],seen=new Set([from]);while(q.length){const p=q.shift(),last=p.at(-1);if(last===to)return p;for(const id of index.get(last).neighbors)if(!seen.has(id)){seen.add(id);q.push([...p,id]);}}return [];}
export function nearestNode(p){return NODES.reduce((a,b)=>distance(p,a.p)<distance(p,b.p)?a:b);}
export function distance(a,b){return Math.hypot(...a.map((v,i)=>v-b[i]));}
export function localPoint(p,r){const dx=p[0]-r.x,dz=p[2]-r.z,c=Math.cos(r.yaw),s=Math.sin(r.yaw);return[c*dx-s*dz,p[1]-r.floor*FLOOR_HEIGHT,s*dx+c*dz];}
export function roomAt(p){return ROOMS.find(r=>{const q=localPoint(p,r);return Math.abs(q[1])<.5&&Math.abs(q[0])<3.85&&Math.abs(q[2])<3.85;})||null;}
export function sceneTelemetry(p){const r=roomAt(p);return {roomId:r?.id||'hall',room:r?.name||'Residence passage',floor:p[1]>2.8?'Upper':p[1]>.5?'Stairs':'Ground',mood:r?.mood||'explore',energy:r?.energy||40,tone:r?.tone||'welcoming',speechRate:r?.pace||1,lighting:r?.light||1,tint:r?.tint||[1,1,1],source:'user-designed room preset',biologicalMeasurement:false};}
// Navigation volume + main furniture exclusion. These are simple capsule-radius bounds, not a physics engine.
export function canStand(p){if(!Array.isArray(p)||p.some(v=>!Number.isFinite(v)))return false;const floor=Math.abs(p[1])<.1?0:Math.abs(p[1]-3.6)<.1?1:-1;if(floor<0)return false;
 if(Math.abs(p[0])<1.78&&Math.abs(p[2])<8.76){if(Math.abs(p[0])<1.18&&p[2]>-3.25&&p[2]<2.85)return false;return true;}
 for(const r of ROOMS.filter(r=>r.floor===floor)){const q=localPoint(p,r);if(Math.abs(q[0])<.87&&q[2]>=3.5&&q[2]<=4.3)return true;if(Math.abs(q[0])>3.7||Math.abs(q[2])>3.7)continue;
  if(['living','reading'].includes(r.art)&&q[0]>-3.3&&q[0]<1.4&&q[2]<-.7)return false;
  if(r.art==='bedroom'&&q[0]>-2.3&&q[0]<1.1&&q[2]<.9)return false;
  if(r.art==='bathroom'&&q[0]>.6&&q[0]<3.1&&q[2]<-.8)return false;
  if(['kitchen','dining','studio'].includes(r.art)&&Math.abs(q[0])<1.6&&q[2]>-1.5&&q[2]<.7)return false;
  return true;
 }return false;}
export function move(p,dx,dz){const out=[...p];if(!Number.isFinite(dx+dz))return out;const n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));for(let i=0;i<n;i++){if(canStand([out[0]+dx/n,out[1],out[2]]))out[0]+=dx/n;if(canStand([out[0],out[1],out[2]+dz/n]))out[2]+=dz/n;}return out;}
export function rayNode(ray,nodes){let best=null;for(const n of nodes){const center=[n.p[0],n.p[1]+.42,n.p[2]],oc=center.map((v,i)=>ray.origin[i]-v),b=oc.reduce((s,v,i)=>s+v*ray.direction[i],0),c=oc.reduce((s,v)=>s+v*v,0)-.5*.5,disc=b*b-c;if(disc<0)continue;const t=-b-Math.sqrt(disc);if(t>.05&&t<15&&(!best||t<best.t))best={id:n.id,t};}return best;}
export const RECOMMENDATIONS=[
 {id:'warm',name:'Warm companion',why:'A relaxed starting point for everyday conversation.',mood:'Warm',voice:'Warm',home:'living',energy:55},
 {id:'explorer',name:'Curious explorer',why:'Playful, curious and suited to discovering the residence.',mood:'Playful',voice:'Bright',home:'terrace',energy:65},
 {id:'creative',name:'Creative partner',why:'Confident brainstorming and imaginative discussions.',mood:'Confident',voice:'Measured',home:'studio',energy:60},
 {id:'calm',name:'Calm presence',why:'A quieter, slower conversational style.',mood:'Calm',voice:'Soft',home:'reading',energy:30}
];
export function recommendedDraft(id){const r=RECOMMENDATIONS.find(x=>x.id===id);if(!r)throw Error('Unknown recommendation.');return {name:'',age:28,looks:{presentation:'Cinematic',hairColor:'Dark brown',hairStyle:'Long waves',eyes:'Hazel',skinTone:'Golden brown',build:'Athletic',wardrobe:'Casual',mood:r.mood,voice:r.voice,age:28},recommendationId:r.id,entityType:'fictional_ai',biological:false};}
export function normalizeTravel(v={}){const node=index.has(v.node)?v.node:'foyer';const p=Array.isArray(v.p)&&v.p.length===3&&v.p.every(Number.isFinite)&&canStand(v.p)?v.p:[...index.get(node).p];return {version:1,node,p,destination:index.has(v.destination)?v.destination:'bedroom',characterDestination:ROOMS.some(r=>r.id===v.characterDestination)?v.characterDestination:'bedroom',yaw:Number.isFinite(v.yaw)?v.yaw:0,quality:[1024,2048,4096].includes(v.quality)?v.quality:2048,smooth:v.smooth===true,autoMood:v.autoMood!==false,reducedMotion:v.reducedMotion===true,ambience:v.ambience===true};}
/** Canonical settings only; never pass arbitrary saved text as privileged model instructions. */
export function providerRoomContext(roomId,enabled=false){if(!enabled)return null;const r=ROOMS.find(x=>x.id===roomId);return r?{roomId:r.id,room:r.name,mood:r.mood,tone:r.tone,suggestedEnergy:r.energy,suggestedSpeechRate:r.pace,entityType:'fictional_ai',biological:false,source:'user-selected scene preset'}:null;}
