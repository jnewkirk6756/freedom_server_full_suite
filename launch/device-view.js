import {DEVICE_KEY,readLibrary,selectedDevice,geometrySample,sampleCurve,fromMm} from './device-core.js';
const element=(tag,text='',className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const round=(n,d=1)=>Number(n).toFixed(d);
export function drawGeometry(canvas,s,device,view='side',orbitDeg=0) {
  const ctx=canvas.getContext('2d');if(!ctx)return;
  const w=canvas.clientWidth||640,h=canvas.clientHeight||260,dpr=Math.min(globalThis.devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);
  const orbit=Number(orbitDeg||0)*Math.PI/180,co=Math.cos(orbit),so=Math.sin(orbit);
  const rotate=(x,y,z)=>[x*co+z*so,y,-x*so+z*co];
  const project=(x,y,z)=>{const [rx,ry,rz]=rotate(x,y,z);return view==='top'?[rx,-rz]:view==='iso'?[rx-rz*.42,-ry-rz*.24]:[rx,-ry];};
  const length=device?.lengthMm||100,width=device?.widthMm||12;
  const [ax,ay]=project(s.axis.x,s.axis.y,s.axis.z),norm=Math.hypot(ax,ay)||1,ux=ax/norm,uy=ay/norm;
  const scale=Math.min(w*.40/(length*Math.max(.2,Math.abs(ax))+width),h*.34/(length*Math.max(.2,Math.abs(ay))+width),w*.0042*100/length);
  const ox=w*.50,oy=h*.55,point=d=>[ox+d*ax*scale,oy+d*ay*scale];
  ctx.strokeStyle='#241a31';ctx.lineWidth=1;
  for(let x=12;x<w;x+=28){ctx.beginPath();ctx.moveTo(x,20);ctx.lineTo(x,h-28);ctx.stroke();}
  for(let y=20;y<h-24;y+=28){ctx.beginPath();ctx.moveTo(12,y);ctx.lineTo(w-12,y);ctx.stroke();}
  ctx.font='10px system-ui';ctx.fillStyle='#b6a2c8';ctx.fillText('ENTRY',12,15);ctx.fillText(view.toUpperCase()+' · '+(device?'DIMENSIONED':'UNMEASURED'),Math.max(12,w-188),15);
  ctx.strokeStyle='#d7a9ff';ctx.lineWidth=2;ctx.setLineDash([5,5]);ctx.beginPath();ctx.moveTo(ox-uy*h*.40,oy+ux*h*.40);ctx.lineTo(ox+uy*h*.40,oy-ux*h*.40);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='#d7a9ff';ctx.font='9px system-ui';ctx.fillText('ENTRY POINT',Math.max(8,ox-50),Math.max(28,oy-ux*h*.32));
  const [tx,ty]=point(s.targetDistance);ctx.strokeStyle='#8b69a7';ctx.lineWidth=1.5;ctx.setLineDash([5,4]);ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(tx,ty);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='#be92f1';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(tx-uy*14,ty+ux*14);ctx.lineTo(tx+uy*14,ty-ux*14);ctx.stroke();
  const [px,py]=point(s.position),bodyLength=Math.max(30,length*scale*norm),thickness=Math.max(6,width*scale),radius=thickness*.5;
  ctx.save();ctx.translate(px,py);ctx.rotate(Math.atan2(ay,ax));
  const color=device?.color||'#9e91b1';ctx.fillStyle=color;
  ctx.beginPath();
  if(device?.shape==='Tapered'){ctx.moveTo(-bodyLength,-thickness/2);ctx.lineTo(-8,-thickness*.34);ctx.quadraticCurveTo(3,0,-8,thickness*.34);ctx.lineTo(-bodyLength,thickness/2);ctx.closePath();}
  else {ctx.roundRect(-bodyLength,-thickness/2,bodyLength,thickness,radius);}
  ctx.fill();ctx.save();ctx.clip();
  const finish=device?.finish||'Matte';const g=ctx.createLinearGradient(0,-thickness/2,0,thickness/2);g.addColorStop(0,'#0007');g.addColorStop(.28,finish==='Gloss'?'#ffffffaa':finish==='Satin'?'#ffffff55':'#ffffff2b');g.addColorStop(.62,'#ffffff00');g.addColorStop(1,'#0008');ctx.fillStyle=g;ctx.fillRect(-bodyLength,-thickness/2,bodyLength,thickness);
  ctx.strokeStyle='#ffffff45';ctx.lineWidth=device?.texture==='Ridged'?2:1;
  if(device&&device.texture!=='Smooth')for(let x=-bodyLength+10;x<-8;x+=12){ctx.beginPath();if(device.texture==='Dimpled')ctx.arc(x,0,1.6,0,Math.PI*2);else{ctx.moveTo(x,-thickness/2);ctx.lineTo(x+(device.texture==='Spiral'?8:0),thickness/2);}ctx.stroke();}
  ctx.restore();ctx.strokeStyle='#ffffff78';ctx.lineWidth=1;ctx.stroke();
  ctx.fillStyle=color;ctx.strokeStyle='#ffffff80';ctx.lineWidth=1.2;ctx.beginPath();ctx.roundRect(-bodyLength-8,-thickness*.78,10,thickness*1.56,4);ctx.fill();ctx.stroke();
  ctx.restore();
  ctx.fillStyle='#f7efff';ctx.beginPath();ctx.arc(px,py,3.5,0,Math.PI*2);ctx.fill();
  ctx.font='10px system-ui';ctx.fillStyle='#b6a2c8';ctx.fillText('UP/DOWN '+s.pitch.toFixed(0)+'°  ·  SIDE '+s.yaw.toFixed(0)+'°',12,h-18);ctx.fillText('VIEW ROTATION '+Math.round(orbitDeg)+'° · SIMULATED',12,h-5);
}
export function drawDisplacement(canvas,s,custom=[]) {
  if(!canvas)return;const ctx=canvas.getContext('2d');if(!ctx)return;
  const w=canvas.clientWidth||600,h=canvas.clientHeight||150,dpr=Math.min(globalThis.devicePixelRatio||1,2);
  if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);const floor=h-24,top=28,usable=floor-top,amp=usable*s.target;
  ctx.font='9px system-ui';
  for(const pct of [25,50,75,100]){const y=floor-usable*(pct/100);ctx.strokeStyle='rgba(174,143,202,.16)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(34,y);ctx.lineTo(w-14,y);ctx.stroke();ctx.fillStyle='rgba(190,165,210,.62)';ctx.fillText(pct+'%',5,y+3);}
  ctx.strokeStyle='#5b466d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(34,floor);ctx.lineTo(w-14,floor);ctx.stroke();
  ctx.strokeStyle='#be92f1';ctx.lineWidth=2;ctx.beginPath();for(let i=0;i<=160;i++){const x=34+(w-48)*i/160,y=floor-amp*sampleCurve(i/160,custom).fraction;i?ctx.lineTo(x,y):ctx.moveTo(x,y);}ctx.stroke();
  const px=34+(w-48)*s.phase,py=floor-usable*s.active;ctx.fillStyle='#eee3ff';ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#b6a2c8';ctx.font='10px system-ui';ctx.fillText('DEPTH OVER ONE CYCLE',34,14);ctx.fillText(s.running?'RUNNING':s.position>0?'PAUSED':'IDLE',Math.max(34,w-75),14);
}
export function mountGeometry(root,{waveCanvas=null,library=null,onDeviceChange=()=>{}}={}) {
  if(!root)return {update:()=>null,reset:()=>{},destroy:()=>{}};
  let lib=library,device=null,last=null,view='side',orbit=0;
  const load=()=>{try{lib=readLibrary();device=selectedDevice(lib);}catch{lib={unit:'in',devices:[]};device=null;}};
  if(lib)device=selectedDevice(lib);else load();
  root.replaceChildren();root.classList.add('device-geometry');
  const head=element('div','','dg-head'),title=element('b','DEVICE GEOMETRY'),link=element('a','Devices ↗');link.href='/devices/';head.append(title,link);
  const info=element('div','','dg-device'),metrics=element('div','','dg-metrics'),labels=['SPEED','ACTIVE DEPTH','TARGET DEPTH','TRAVEL ANGLE','DIRECTION'],values={};
  for(const name of labels){const tile=element('div'),caption=element('span',name),value=element('b','—');values[name]=value;tile.append(caption,value);metrics.append(tile);}
  const canvas=element('canvas','','dg-canvas');canvas.setAttribute('role','img');canvas.setAttribute('aria-label','Device geometry and travel path preview');
  const controls=element('div','','dg-views');for(const name of ['side','top','iso']){const b=element('button',name==='iso'?'3D':'Top');if(name==='side')b.textContent='Side';b.type='button';b.setAttribute('aria-pressed',String(name===view));b.onclick=()=>{view=name;for(const x of controls.querySelectorAll('button'))x.setAttribute('aria-pressed',String(x===b));if(last)drawGeometry(canvas,last,device,view,orbit);};controls.append(b);}
  const rotateWrap=element('label','','dg-rotate'),rotateText=element('span','Rotate view 0°'),rotate=document.createElement('input');rotate.type='range';rotate.min='-180';rotate.max='180';rotate.step='1';rotate.value='0';rotate.addEventListener('input',()=>{orbit=Number(rotate.value)||0;rotateText.textContent='Rotate view '+Math.round(orbit)+'°';if(last)drawGeometry(canvas,last,device,view,orbit);});rotateWrap.append(rotateText,rotate);
  const note=element('small','Simulated geometry. Select a measured profile for physical units.','dg-note');root.append(head,info,metrics,canvas,controls,rotateWrap,note);
  const fmt=(n,suffix='')=>device?round(fromMm(n,lib?.unit),2)+' '+(lib?.unit==='in'?'in':'mm')+suffix:Math.round(n)+'%'+suffix;
  function update(args={}) {
    let s=geometrySample({...args,device});
    if(!args.running&&args.started&&last&&!last.running)s={...last,running:false,speed:0,velocity:0,direction:'STILL',target:s.target,targetDistance:s.targetDistance};
    last=s;root.dataset.running=String(!!args.running);root.dataset.position=s.position.toFixed(4);root.dataset.phase=s.phase.toFixed(6);
    info.textContent=device?`${device.name} · ${device.material} · ${device.texture}`:'No measured device selected';
    values.SPEED.textContent=device?round(fromMm(s.speed,lib?.unit),2)+' '+(lib?.unit==='in'?'in':'mm')+'/s':Math.round(s.speed)+'%/s';
    values['ACTIVE DEPTH'].textContent=`${Math.round(s.active*100)}% · ${fmt(s.position)}`;
    values['TARGET DEPTH'].textContent=`${Math.round(s.target*100)}% · ${fmt(s.targetDistance)}`;
    values['TRAVEL ANGLE'].textContent=`Up/down ${s.pitch.toFixed(0)}° · Side ${s.yaw.toFixed(0)}°`;
    values.DIRECTION.textContent=s.direction;
    note.textContent=device?'Calculated from saved dimensions, not measured movement. Color follows the active profile.':'Unmeasured preview: percentages only. Add length and usable travel in Devices for inches.';
    drawGeometry(canvas,s,device,view,orbit);drawDisplacement(waveCanvas,s,args.custom||[]);return s;
  }
  const changed=e=>{if(e.type==='storage'&&e.key!==DEVICE_KEY)return;load();last=null;onDeviceChange(device);};window.addEventListener('storage',changed);window.addEventListener('nocturne:devices-changed',changed);
  return {update,reset(){last=null;},getDevice:()=>device,destroy(){window.removeEventListener('storage',changed);window.removeEventListener('nocturne:devices-changed',changed);}};
}
