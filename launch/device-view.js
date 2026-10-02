import {DEVICE_KEY,readLibrary,selectedDevice,geometrySample,sampleCurve,fromMm} from './device-core.js';
const element=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
export function drawGeometry(canvas,s,device,view='side') {
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const w=canvas.clientWidth||640,h=canvas.clientHeight||260,dpr=Math.min(globalThis.devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const project=(x,y,z)=>view==='top'?[x,-z]:view==='iso'?[x-z*.35,-y-z*.22]:[x,-y];
  const length=device?.lengthMm||100,width=device?.widthMm||12;
  const [ax,ay]=project(s.axis.x,s.axis.y,s.axis.z),norm=Math.hypot(ax,ay)||1,ux=ax/norm,uy=ay/norm;
  const scale=Math.min(w*.43/(length*Math.abs(ax)+width),h*.39/(length*Math.abs(ay)+width),w*.0045*100/length);
  const ox=w*.47,oy=h*.54,point=d=>[ox+d*ax*scale,oy+d*ay*scale];
  ctx.strokeStyle='#271c35';ctx.lineWidth=1;
  for(let x=12;x<w;x+=28){ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x,h-22);ctx.stroke();}
  for(let y=20;y<h-20;y+=28){ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(w-12,y);ctx.stroke();}
  ctx.strokeStyle='#88749c';ctx.setLineDash([4,6]);ctx.beginPath();ctx.moveTo(ox-uy*h*.42,oy+ux*h*.42);ctx.lineTo(ox+uy*h*.42,oy-ux*h*.42);ctx.stroke();ctx.setLineDash([]);
  ctx.font='10px system-ui';ctx.fillStyle='#b6a2c8';ctx.fillText('REFERENCE 0',12,15);ctx.fillText(view.toUpperCase()+' · '+(device?'DIMENSIONED':'UNMEASURED'),w-170,15);
  const [tx,ty]=point(s.targetDistance);ctx.strokeStyle='#be92f1';ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);
  ctx.beginPath();ctx.moveTo(tx-uy*14,ty+ux*14);ctx.lineTo(tx+uy*14,ty-ux*14);ctx.stroke();
  const [px,py]=point(s.position),bodyLength=length*scale*norm,thickness=Math.max(3,width*scale),radius=device?.shape==='Rounded'?thickness*.5:3;
  ctx.save();ctx.translate(px,py);ctx.rotate(Math.atan2(ay,ax));
  ctx.fillStyle=device?.color||'#9e91b1';
  ctx.beginPath();if(device?.shape==='Tapered'){ctx.moveTo(-bodyLength,-thickness/2);ctx.lineTo(-4,-thickness*.24);ctx.lineTo(0,0);ctx.lineTo(-4,thickness*.24);ctx.lineTo(-bodyLength,thickness/2);ctx.closePath();}else ctx.roundRect(-bodyLength,-thickness/2,bodyLength,thickness,radius);
  ctx.fill();ctx.save();ctx.clip();
  const finish=device?.finish||'Matte';if(finish!=='Matte'){const g=ctx.createLinearGradient(0,-thickness/2,0,thickness/2);g.addColorStop(0,'#0005');g.addColorStop(.3,finish==='Gloss'?'#ffffff99':'#ffffff33');g.addColorStop(.6,'#ffffff00');g.addColorStop(1,'#0006');ctx.fillStyle=g;ctx.fillRect(-bodyLength,-thickness/2,bodyLength,thickness);}
  ctx.strokeStyle='#ffffff40';ctx.lineWidth=device?.texture==='Ridged'?2:1;
  if(device&&device.texture!=='Smooth')for(let x=-bodyLength+8;x<-4;x+=12){ctx.beginPath();if(device.texture==='Dimpled')ctx.arc(x,0,1.5,0,Math.PI*2);else {ctx.moveTo(x,-thickness/2);ctx.lineTo(x+(device.texture==='Spiral'?9:0),thickness/2);}ctx.stroke();}
  ctx.restore();ctx.strokeStyle='#ffffff70';ctx.stroke();ctx.restore();
  ctx.fillStyle='#f7efff';ctx.beginPath();ctx.arc(px,py,3,0,Math.PI*2);ctx.fill();
  ctx.font='10px system-ui';ctx.fillStyle='#b6a2c8';ctx.fillText(`${s.pitch.toFixed(0)}° PITCH  /  ${s.yaw.toFixed(0)}° YAW`,12,h-18);ctx.fillText('SIMULATED POSITION · NOT SENSOR DATA',12,h-5);
}
export function drawDisplacement(canvas,s,custom=[]) {
  if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
  const w=canvas.clientWidth||600,h=canvas.clientHeight||150,dpr=Math.min(globalThis.devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const floor=h-25,amp=(h-50)*s.target;
  ctx.strokeStyle='#5b466d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(16,floor);ctx.lineTo(w-16,floor);ctx.stroke();
  ctx.strokeStyle='#be92f1';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<=160;i++){const x=16+(w-32)*i/160,y=floor-amp*sampleCurve(i/160,custom).fraction;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
  const px=16+(w-32)*s.phase,py=floor-(h-50)*s.active;ctx.fillStyle='#eee3ff';ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#b6a2c8';ctx.font='10px system-ui';ctx.fillText('DISPLACEMENT · ONE CYCLE',16,14);ctx.fillText(s.running?'RUNNING':s.position>0?'PAUSED':'IDLE',Math.max(16,w-75),14);
}
export function mountGeometry(root,{waveCanvas=null,library=null,onDeviceChange=()=>{}}={}) {
  if(!root)return {update:()=>null,reset:()=>{},destroy:()=>{}};
  let lib=library,device=null,last=null,view='side';
  const load=()=>{try{lib=readLibrary();device=selectedDevice(lib);}catch{lib={unit:'mm',devices:[]};device=null;}};
  if(lib)device=selectedDevice(lib);else load();
  root.replaceChildren();root.classList.add('device-geometry');
  const head=element('div','','dg-head'),title=element('b','DEVICE GEOMETRY'),link=element('a','Devices ↗');link.href='/devices/';head.append(title,link);
  const info=element('div','','dg-device'),metrics=element('div','','dg-metrics'),labels=['SPEED','ACTIVE DEPTH','TARGET DEPTH','ANGLE','DIRECTION'],values={};
  for(const name of labels){const tile=element('div'),caption=element('span',name),value=element('b','—');values[name]=value;tile.append(caption,value);metrics.append(tile);}
  const canvas=element('canvas','','dg-canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Non-graphic device geometry and travel path');
  const controls=element('div','','dg-views');for(const name of ['side','top','iso']){const b=element('button',name==='iso'?'Isometric':name[0].toUpperCase()+name.slice(1));b.type='button';b.setAttribute('aria-pressed',String(name===view));b.onclick=()=>{view=name;for(const x of controls.children)x.setAttribute('aria-pressed',String(x===b));if(last)drawGeometry(canvas,last,device,view);};controls.append(b);}
  const note=element('small','Simulated geometry. Select a measured profile for physical units.','dg-note');root.append(head,info,metrics,canvas,controls,note);
  const fmt=(n,suffix='')=>device?fromMm(n,lib?.unit).toFixed(1)+' '+(lib?.unit==='in'?'in':'mm')+suffix:n.toFixed(1)+'%'+suffix;
  function update(args={}) {
    let s=geometrySample({...args,device});
    if(!args.running&&args.started&&last&&!last.running)s={...last,running:false,speed:0,velocity:0,direction:'STILL',target:s.target,targetDistance:s.targetDistance};
    last=s;root.dataset.running=String(!!args.running);root.dataset.position=s.position.toFixed(4);root.dataset.phase=s.phase.toFixed(6);
    info.textContent=device?`${device.name} · ${device.material} · ${device.texture}`:'No measured device selected';
    values.SPEED.textContent=fmt(s.speed,'/s');values['ACTIVE DEPTH'].textContent=`${(s.active*100).toFixed(1)}% · ${fmt(s.position)}`;values['TARGET DEPTH'].textContent=`${(s.target*100).toFixed(0)}% · ${fmt(s.targetDistance)}`;values.ANGLE.textContent=`${s.pitch.toFixed(0)}° / ${s.yaw.toFixed(0)}°`;values.DIRECTION.textContent=s.direction;
    note.textContent=device?'Calculated from saved dimensions, not measured movement. Material and texture are visual metadata.':'Unmeasured preview: percentages only. Add length and usable travel in Devices for mm or inches.';
    drawGeometry(canvas,s,device,view);drawDisplacement(waveCanvas,s,args.custom||[]);return s;
  }
  const changed=e=>{if(e.type==='storage'&&e.key!==DEVICE_KEY)return;load();last=null;onDeviceChange(device);};window.addEventListener('storage',changed);window.addEventListener('nocturne:devices-changed',changed);
  return {update,reset(){last=null;},getDevice:()=>device,destroy(){window.removeEventListener('storage',changed);window.removeEventListener('nocturne:devices-changed',changed);}};
}
