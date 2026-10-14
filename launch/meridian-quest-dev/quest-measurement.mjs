/** Session-local approximation only. No storage, plan mutation, camera access or network. */
export const MEASUREMENT_WARNING='Approximate only. Verify with a tape or laser before estimating or cutting.';
const finitePoint=p=>Array.isArray(p)&&p.length===3&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=1000);
export function pointFromMatrix(m){return m?.length===16&&[...m].every(Number.isFinite)?[m[12],m[13],m[14]]:null;}
export function transformPoint(m,p){return [0,1,2].map(i=>m[i]*p[0]+m[4+i]*p[1]+m[8+i]*p[2]+m[12+i]);}
export function inverseRigid(m){return new Float32Array([m[0],m[4],m[8],0,m[1],m[5],m[9],0,m[2],m[6],m[10],0,-(m[0]*m[12]+m[1]*m[13]+m[2]*m[14]),-(m[4]*m[12]+m[5]*m[13]+m[6]*m[14]),-(m[8]*m[12]+m[9]*m[13]+m[10]*m[14]),1]);}
export function distanceMetres(a,b){return finitePoint(a)&&finitePoint(b)?Math.hypot(...a.map((v,i)=>v-b[i])):null;}
export function formatMeasurement(metres){if(!Number.isFinite(metres)||metres<0)return {imperial:'—',metric:'—'};const inches=Math.round(metres/.0254);return {imperial:`${Math.floor(inches/12)} ft ${inches%12} in`,metric:`${metres.toFixed(2)} m`};}
function insidePolygon(x,z,polygon){let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
 const a=polygon[i],b=polygon[j],cross=(x-a.x)*(b.z-a.z)-(z-a.z)*(b.x-a.x);
 if(Math.abs(cross)<1e-7&&x>=Math.min(a.x,b.x)-1e-7&&x<=Math.max(a.x,b.x)+1e-7&&z>=Math.min(a.z,b.z)-1e-7&&z<=Math.max(a.z,b.z)+1e-7)return true;
 if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
 }return inside;}
/** Intersect the actual plane polygon in plane-local XZ. Never extend a plane to infinity. */
export function intersectDetectedPlane(rayMatrix,planeMatrix,polygon){
 if(!pointFromMatrix(rayMatrix)||!pointFromMatrix(planeMatrix)||!Array.isArray(polygon)||polygon.length<3||!polygon.every(p=>[p.x,p.y,p.z].every(Number.isFinite)))return null;
 const inv=inverseRigid(planeMatrix),origin=transformPoint(inv,pointFromMatrix(rayMatrix));
 const direction=[0,1,2].map(i=>-(inv[i]*rayMatrix[8]+inv[4+i]*rayMatrix[9]+inv[8+i]*rayMatrix[10]));
 if(Math.abs(direction[1])<1e-7)return null;const t=-origin[1]/direction[1];if(t<=.02||t>20)return null;
 const local=origin.map((v,i)=>v+t*direction[i]);if(!insidePolygon(local[0],local[2],polygon))return null;
 return {position:transformPoint(planeMatrix,local),localPosition:local,distance:t,kind:'plane'};
}
export const questPanelButtons=[
 {action:'workspace',u:.04,v:.135,w:.24,h:.08},{action:'measure',u:.30,v:.135,w:.24,h:.08},{action:'tools',u:.56,v:.135,w:.40,h:.08},
 {action:'sound',page:'tools',u:.58,v:.34,w:.18,h:.05},{action:'haptics',page:'tools',u:.78,v:.34,w:.18,h:.05},
 {action:'snap',page:'tools',u:.04,v:.25,w:.44,h:.08},{action:'undo',page:'tools',u:.52,v:.25,w:.44,h:.08},
 {action:'use-length',page:'tools',u:.04,v:.41,w:.44,h:.08},{action:'use-width',page:'tools',u:.52,v:.41,w:.44,h:.08},{action:'compute-area',page:'tools',u:.04,v:.64,w:.92,h:.075},
 {action:'surface',page:'measure',u:.04,v:.25,w:.43,h:.08},{action:'controller',page:'measure',u:.51,v:.25,w:.45,h:.08},
 {action:'adjust-a',page:'measure',u:.04,v:.64,w:.28,h:.075},{action:'adjust-b',page:'measure',u:.36,v:.64,w:.28,h:.075},{action:'reset',page:'measure',u:.68,v:.64,w:.28,h:.075},
 {action:'scene',u:.04,v:.77,w:.28,h:.12},{action:'snapshot',u:.36,v:.77,w:.28,h:.12},{action:'exit',u:.68,v:.77,w:.28,h:.12},
];
export function questPanelAction(hit,page='workspace'){return hit&&questPanelButtons.find(b=>(!b.page||b.page===page)&&hit.u>b.u&&hit.u<b.u+b.w&&hit.v>b.v&&hit.v<b.v+b.h)?.action||null;}
/** Captures reference-space positions; detected planes retain their plane-local coordinate. */
export function createMeasurement(){
 let mode='surface',points=[null,null],selected=0,reason='Place point A',revision=0,snapEnabled=false,history=[],dimensions={length:null,width:null},areaConfirmed=false;
 const copy=p=>p?{...p,position:[...p.position],localPosition:p.localPosition?[...p.localPosition]:null}:null;
 const checkpoint=()=>{history.push({points:points.map(copy),selected,reason});if(history.length>12)history.shift();};
 const perpendicular=()=>{const a=dimensions.length,b=dimensions.width,l=length(a),w=length(b);if(!(l>0&&w>0))return null;const dot=a[0].position.reduce((sum,v,i)=>sum+(a[1].position[i]-v)*(b[1].position[i]-b[0].position[i]),0);return Math.abs(dot/(l*w))<=.15;};
 const resetPoints=(message='Place point A')=>{points=[null,null];selected=0;reason=message;revision++;};
 const reset=(message='Place point A')=>{history=[];dimensions={length:null,width:null};areaConfirmed=false;resetPoints(message);};
 const length=pair=>pair?.every(p=>p?.tracked)?distanceMetres(pair[0].position,pair[1].position):null;
 function preview(sample){if(!sample||!snapEnabled)return sample;let nearest=null,best=.025;for(const point of [...points,...Object.values(dimensions).flatMap(p=>p||[])]){if(!point?.tracked)continue;const d=distanceMetres(point.position,sample.position);if(d!==null&&d<=best){nearest=point;best=d;}}return nearest?{...copy(nearest),snapped:true}:sample;}
 return {
  reset,
  resetPoints(){checkpoint();resetPoints();},
  setMode(value){if(!['surface','controller'].includes(value))throw Error('Unknown measurement mode.');if(value!==mode){mode=value;reset('Mode changed. Place point A');}},
  toggleSnap(){snapEnabled=!snapEnabled;revision++;return snapEnabled;},
  preview,
  undo(){const previous=history.pop();if(!previous)return false;points=previous.points;selected=previous.selected;reason='Undone. '+previous.reason;revision++;return true;},
  saveDimension(name){if(!['length','width'].includes(name)||!(length(points)>0))return false;dimensions[name]=points.map(copy);areaConfirmed=false;history=[];resetPoints(`${name==='length'?'Length':'Width'} marked. Place point A for another side.`);return true;},
  computeArea(){const l=length(dimensions.length),w=length(dimensions.width);if(!(l>0&&w>0)||!perpendicular())return false;areaConfirmed=true;revision++;return true;},
  select(index){if(![0,1].includes(index)||!points[index])return false;checkpoint();selected=index;reason=`Replace point ${index?'B':'A'}`;revision++;return true;},
  place(sample){if(selected===null)return false;if(!sample||!finitePoint(sample.position)||sample.tracked===false||!['plane','hit','controller'].includes(sample.kind))return false;if((mode==='controller')!==(sample.kind==='controller'))return false;
   if(sample.kind==='plane'&&(!sample.plane||!finitePoint(sample.localPosition)))return false;
   checkpoint();sample=preview(sample);points[selected]={...copy(sample),tracked:true};
   selected=points[0]?points[1]?null:1:0;reason=(sample.snapped?'Snapped to marked endpoint. ':'')+(selected===null?'Adjust or reset below.':`Place point ${selected?'B':'A'}`);revision++;return true;},
  updatePlanes(resolve){let changed=false;for(const point of [...points,...Object.values(dimensions).flatMap(p=>p||[])]){if(point?.kind!=='plane')continue;const matrix=resolve(point.plane);if(!matrix){history=[];if(point.tracked){point.tracked=false;changed=true;}continue;}const position=transformPoint(matrix,point.localPosition);const delta=distanceMetres(position,point.position);if(delta===null||delta>.1){reset('Surface tracking shifted. Remeasure both points.');return;}if(delta>1e-5||!point.tracked)changed=true;point.position=position;point.tracked=true;}if(changed)revision++;},
  getState(){const metres=length(points),l=length(dimensions.length),w=length(dimensions.width),squareMetres=areaConfirmed&&l>0&&w>0&&perpendicular()?l*w:null;return {approximate:true,units:'metres',mode,selected,reason,revision,snapEnabled,hasUndo:history.length>0,points:points.map(p=>p?{position:[...p.position],kind:p.kind,tracked:p.tracked,snapped:Boolean(p.snapped)}:null),metres,...formatMeasurement(metres),area:{length:l,width:w,lengthTracked:l!==null,widthTracked:w!==null,perpendicular:perpendicular(),squareMetres,squareFeet:squareMetres===null?null:squareMetres/.09290304}};},
 };
}

/** Cancel pending and active hit-test subscriptions across input/session lifecycle boundaries. */
export function createSurfaceSampler(){
 let session=null,epoch=0,hitReadFailed=false;const sources=new Map();
 const cancel=source=>{try{source?.cancel();}catch{}};
 function reset(next=null){epoch++;hitReadFailed=false;for(const entry of sources.values())cancel(entry.source);sources.clear();session=next;}
 function sync(inputs){const active=new Set(inputs);for(const [input,entry]of sources)if(!active.has(input)){cancel(entry.source);sources.delete(input);}
  for(const input of active){if(input.targetRayMode!=='tracked-pointer'||!input.targetRaySpace||sources.has(input)||typeof session?.requestHitTestSource!=='function')continue;
   const generation=epoch,owner=session,entry={source:null};sources.set(input,entry);
   // Feature absence, denial, and empty results are ordinary states; never synthesize a hit.
   Promise.resolve().then(()=>{if(generation!==epoch||sources.get(input)!==entry)return null;return owner.requestHitTestSource({space:input.targetRaySpace});}).then(source=>{if(!source)return;if(generation!==epoch||sources.get(input)!==entry){cancel(source);return;}entry.source=source;}).catch(()=>{});
  }
 }
 function sample(frame,input,space,mode='surface'){
  hitReadFailed=false;if(!session||frame.session!==session||input?.targetRayMode!=='tracked-pointer')return null;
  if(mode==='controller'){if(!input.gripSpace)return null;const pose=frame.getPose(input.gripSpace,space);if(!pose||pose.emulatedPosition)return null;const position=pointFromMatrix(pose.transform.matrix);return position?{position,kind:'controller',tracked:true}:null;}
  const rayPose=frame.getPose(input.targetRaySpace,space);if(!rayPose||rayPose.emulatedPosition)return null;
  const ray=rayPose.transform.matrix;let best=null;
  // Prefer plane-relative points where available so they follow tracked plane updates.
  for(const plane of frame.detectedPlanes||[]){const pose=frame.getPose(plane.planeSpace,space);if(!pose||pose.emulatedPosition)continue;const hit=intersectDetectedPlane(ray,pose.transform.matrix,Array.from(plane.polygon||[]));if(hit&&(!best||hit.distance<best.distance))best={...hit,plane,tracked:true};}
  const source=sources.get(input)?.source;
  if(source&&typeof frame.getHitTestResults==='function')try{for(const result of frame.getHitTestResults(source)){const pose=result.getPose(space);if(!pose||pose.emulatedPosition)continue;const position=pointFromMatrix(pose.transform.matrix),distance=distanceMetres(pointFromMatrix(ray),position);if(distance>.02&&distance<=20&&(!best||distance<best.distance-.03))best={position,distance,kind:'hit',tracked:true};}}catch{hitReadFailed=true;}
  return best;
 }
 return {reset,sync,sample,hitReadUnavailable:()=>hitReadFailed};
}
