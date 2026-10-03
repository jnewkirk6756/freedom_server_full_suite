/** Nocturne device geometry. Physical descriptions, never physiological predictions. */
export const DEVICE_VERSION = '0.64.0';
export const DEVICE_KEY = 'nocturne.devices.v1';
export const MATERIALS = ['Silicone','TPE','TPR','TPU','Natural rubber','Synthetic rubber','ABS plastic','Polycarbonate','Acrylic','Glass','Stainless steel','Aluminum','Ceramic','Hybrid','Other / unspecified'];
export const TEXTURES = ['Smooth','Ridged','Ribbed','Spiral','Dimpled','Textured','Custom'];
export const SHAPES = ['Cylinder','Rounded','Tapered'];
export const FINISHES = ['Matte','Satin','Gloss'];
export const clamp = (n, lo=0, hi=1) => Math.max(lo, Math.min(hi, Number.isFinite(Number(n)) ? Number(n) : lo));
export const toMm = (n, unit='mm') => Number(n) * (unit === 'in' ? 25.4 : 1);
export const fromMm = (n, unit='mm') => Number(n) / (unit === 'in' ? 25.4 : 1);
const number = (n, name, lo, hi) => { if(n === '' || n === null || typeof n === 'boolean' || !Number.isFinite(Number(n)) || Number(n)<lo || Number(n)>hi) throw Error(`${name} must be between ${lo} and ${hi} mm.`); return Number(n); };
const choice = (v, values, label) => { if(!values.includes(v)) throw Error(`Choose a valid ${label}.`); return v; };
export function newId() { return globalThis.crypto?.randomUUID?.() || 'device-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2); }
export function validateDevice(input, now=Date.now()) {
  if(!input || typeof input!=='object' || Array.isArray(input)) throw Error('Invalid device profile.');
  const name=String(input.name||'').trim(); if(!name || name.length>60) throw Error('Name must contain 1–60 characters.');
  const lengthMm=number(input.lengthMm,'Length',1,2000), widthMm=number(input.widthMm,'Width / diameter',0.5,500);
  const travelMm=number(input.travelMm,'Usable travel',0,lengthMm);
  if(!/^#[0-9a-f]{6}$/i.test(input.color||'')) throw Error('Choose a valid color.');
  const id=typeof input.id==='string' && /^[a-z0-9_-]{1,80}$/i.test(input.id) ? input.id : newId();
  return {id,name,lengthMm,widthMm,travelMm,color:input.color.toLowerCase(),material:choice(input.material,MATERIALS,'material'),texture:choice(input.texture,TEXTURES,'texture'),shape:choice(input.shape||'Cylinder',SHAPES,'shape'),finish:choice(input.finish||'Matte',FINISHES,'finish'),notes:String(input.notes||'').slice(0,300),createdAt:Number.isFinite(input.createdAt)?input.createdAt:now,updatedAt:now};
}
export const emptyLibrary = () => ({schema:1,revision:0,activeId:null,unit:'in',displayUnitsVersion:1,devices:[]});
export function parseLibrary(text) {
  if(typeof text!=='string' || text.length>100000) throw Error('Device file exceeds 100 KB.');
  const p=JSON.parse(text); if(p?.schema!==1 || !Array.isArray(p.devices) || p.devices.length>100) throw Error('Unsupported device library; maximum 100 profiles.');
  const devices=p.devices.map(d=>validateDevice(d,Number.isFinite(d.updatedAt)?d.updatedAt:Date.now()));
  if(new Set(devices.map(d=>d.id)).size!==devices.length) throw Error('Duplicate profile IDs.');
  // Migrate only display units from the old metric default. Stored dimensions stay mm.
  // Once the user explicitly changes units in this version, keep that choice.
  const unit=p.displayUnitsVersion===1&&p.unit==='mm'?'mm':'in';
  return {schema:1,revision:Number.isSafeInteger(p.revision)&&p.revision>=0?p.revision:0,activeId:devices.some(d=>d.id===p.activeId)?p.activeId:null,unit,displayUnitsVersion:1,devices};
}
export function readLibrary(storage=globalThis.localStorage) {
  const raw=storage.getItem(DEVICE_KEY); return raw ? parseLibrary(raw) : emptyLibrary();
}
export function writeLibrary(library, storage=globalThis.localStorage, expectedRevision=library.revision) {
  const current=readLibrary(storage); if(current.revision!==expectedRevision) throw Error('Devices changed in another tab. Reload the library before saving.');
  const next=parseLibrary(JSON.stringify(library)); next.revision=current.revision+1;
  storage.setItem(DEVICE_KEY,JSON.stringify(next));
  return next;
}
export function saveDevice(library, input, now=Date.now()) {
  const next=parseLibrary(JSON.stringify(library)), row=validateDevice(input,now), at=next.devices.findIndex(d=>d.id===row.id);
  if(at<0 && next.devices.length>=100) throw Error('Library is full (100 profiles).');
  if(at>=0){row.createdAt=next.devices[at].createdAt;next.devices[at]=row;} else next.devices.push(row);
  if(!next.activeId) next.activeId=row.id; return next;
}
export const selectedDevice = lib => lib.devices.find(d=>d.id===lib.activeId)||(lib.devices.length===1?lib.devices[0]:null);
export function mergeLibrary(library, imported) {
  const next=parseLibrary(JSON.stringify(library)), source=parseLibrary(JSON.stringify(imported));
  if(next.devices.length+source.devices.length>100) throw Error('Import would exceed 100 profiles.');
  next.devices.push(...source.devices.map(d=>({...d,id:newId()}))); if(!next.activeId)next.activeId=next.devices[0]?.id||null; return next;
}
/** A periodic path. Smooth default has zero speed at both endpoints. */
export function sampleCurve(phase, custom=[]) {
  const p=((Number(phase)||0)%1+1)%1;
  if(Array.isArray(custom)&&custom.length>=4){
    const c=custom.slice(0,256).map(v=>clamp(v)); c[0]=0;c[c.length-1]=0;
    const t=p*(c.length-1),i=Math.min(c.length-2,Math.floor(t)),f=t-i;
    return {fraction:c[i]+(c[i+1]-c[i])*f,slope:(c[i+1]-c[i])*(c.length-1)};
  }
  return {fraction:(1-Math.cos(2*Math.PI*p))/2,slope:Math.PI*Math.sin(2*Math.PI*p)};
}
export function direction(pitch=0,yaw=0) {
  const p=clamp(pitch,-60,60)*Math.PI/180,y=clamp(yaw,-60,60)*Math.PI/180;
  return {x:Math.cos(p)*Math.cos(y),y:Math.sin(p),z:Math.cos(p)*Math.sin(y)};
}
export function geometrySample({phase=0,target=0,period=0,running=false,started=false,pitch=0,yaw=0,device=null,custom=[]}={}) {
  const curve=sampleCurve(phase,custom), available=!!device, limit=available?device.travelMm:100, extent=clamp(target)*limit;
  const fraction=started||running?curve.fraction:0, distance=extent*fraction;
  const rate=running&&Number.isFinite(period)&&period>0?extent*curve.slope/period:0, axis=direction(pitch,yaw);
  return {phase:((phase%1)+1)%1,calibrated:available,target:clamp(target),active:clamp(target)*fraction,position:distance,targetDistance:extent,speed:Math.abs(rate),velocity:rate,direction:rate>0.001?'FORWARD':rate<-.001?'RETURN':'STILL',pitch:clamp(pitch,-60,60),yaw:clamp(yaw,-60,60),axis,x:distance*axis.x,y:distance*axis.y,z:distance*axis.z,period,running};
}
/** One clock for all visual outputs. Hidden-page gaps are not replayed. */
export function advanceClock(clock, timestamp, period) {
  const n={...clock}; if(!Number.isFinite(timestamp))return n;
  const dt=Number.isFinite(n.last)?Math.max(0,timestamp-n.last)/1000:0;n.last=timestamp;
  if(!n.running || !(period>0) || dt>1)return n;
  const total=n.phase+dt/period,complete=Math.floor(total);n.phase=total-complete;n.cycles=(n.cycles||0)+complete;n.elapsed=(n.elapsed||0)+dt;return n;
}
