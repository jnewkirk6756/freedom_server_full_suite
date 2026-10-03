(function(){
const $=id=>document.getElementById(id),set=(id,v)=>{const e=$(id);if(e)e.textContent=v},clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
let session=null,gl=null,layer=null,refSpace=null,refMode='local-floor';
let worldProgram=null,worldBuf=null,uiProgram=null,uiBuf=null,uiTex=null,menuCanvas=null,menuCtx=null,lastMenu=0;
function requestedMode(){const q=new URLSearchParams(location.search).get('mode');if(['live','anna','tool','cognitive'].includes(q))return q;try{const saved=JSON.parse(localStorage.getItem('nocturne.vr.entry.v1')||'null');if(saved&&Date.now()-Number(saved.at||0)<30*60*1000&&['live','anna','tool','cognitive'].includes(saved.mode))return saved.mode}catch{}return'cognitive'}
let sceneMode=requestedMode(),actionLine='Point a controller at a tile and press trigger.',hovered=-1;
const triggerDown=new Map();
let telemetry={pace:.45,depth:.5,force:.4,intensity:.35,angle:0,cadence:45};let panelOffset={x:0,y:0,z:0};
function activeDevice(){try{const lib=JSON.parse(localStorage.getItem('nocturne.devices.v1')||'{}');return Array.isArray(lib.devices)?lib.devices.find(d=>d.id===lib.activeId)||null:null}catch{return null}}
function hexRgb(hex){const m=/^#([0-9a-f]{6})$/i.exec(String(hex||''));if(!m)return[.36,1,.84,1];const n=parseInt(m[1],16);return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255,1]}
function loadTelemetry(){try{const s=JSON.parse(localStorage.getItem('nocturne.telemetry.v1')||'{}');telemetry={pace:clamp(s.pace??.45),depth:clamp(s.depth??.5),force:clamp(s.force??.4),intensity:clamp(s.intensity??.35),angle:Math.max(-45,Math.min(45,Number(s.angle)||0)),cadence:Math.max(0,Math.min(100,Number(s.cadence??45)))}}catch{}return telemetry}
async function run(){
  set('diag-secure',window.isSecureContext?'YES':'NO');set('diag-xr',navigator.xr?'YES':'NO');
  let glok=false;try{const c=document.createElement('canvas');glok=!!c.getContext('webgl')}catch{}set('diag-gl',glok?'YES':'NO');
  let immersive=false,err='';if(navigator.xr){try{immersive=await navigator.xr.isSessionSupported('immersive-vr')}catch(e){err=String(e&&e.message||e)}}set('diag-immersive',immersive?'YES':'NO');
  set('diag-line',[(window.isSecureContext?'HTTPS secure':'HTTPS not secure'),(navigator.xr?'WebXR exposed':'WebXR missing'),(immersive?'immersive-vr supported':'immersive-vr not supported'),(glok?'WebGL ready':'WebGL missing')].join(' · ')+(err?' · '+err.slice(0,90):''));
  return{immersive};
}
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'shader');return s}
function initGL(){
  if(worldProgram)return;
  let vs=shader(gl.VERTEX_SHADER,'attribute vec3 a;uniform mat4 m;uniform float ps;void main(){gl_Position=m*vec4(a,1.0);gl_PointSize=ps;}');
  let fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform vec4 c;void main(){gl_FragColor=c;}');
  worldProgram=gl.createProgram();gl.attachShader(worldProgram,vs);gl.attachShader(worldProgram,fs);gl.linkProgram(worldProgram);if(!gl.getProgramParameter(worldProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(worldProgram)||'world program');
  worldBuf=gl.createBuffer();
  vs=shader(gl.VERTEX_SHADER,'attribute vec3 p;attribute vec2 uv;uniform mat4 m;varying vec2 v;void main(){v=uv;gl_Position=m*vec4(p,1.0);}');
  fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D t;varying vec2 v;void main(){gl_FragColor=texture2D(t,v);}');
  uiProgram=gl.createProgram();gl.attachShader(uiProgram,vs);gl.attachShader(uiProgram,fs);gl.linkProgram(uiProgram);if(!gl.getProgramParameter(uiProgram,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(uiProgram)||'ui program');
  uiBuf=gl.createBuffer();uiTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,uiTex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  menuCanvas=document.createElement('canvas');menuCanvas.width=1200;menuCanvas.height=820;menuCtx=menuCanvas.getContext('2d');
}
function mul4(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let v=0;for(let k=0;k<4;k++)v+=a[k*4+r]*b[c*4+k];o[c*4+r]=v}return o}
function rounded(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function floorY(){return refMode==='local-floor'?0:-1.55}
function basePanelY(){return refMode==='local-floor'?1.48:.02}
function panelY(){return basePanelY()+panelOffset.y}
const PANEL_Z=-2.45,PANEL_W=1.62,PANEL_H=1.12;
function panelZ(){return PANEL_Z+panelOffset.z}
function basePanelX(){return sceneMode==='cognitive'?0:-1.42}
function panelX(){return basePanelX()+panelOffset.x}
function modeColor(){return sceneMode==='live'?[.28,.78,1,1]:sceneMode==='anna'?[.86,.48,1,1]:sceneMode==='tool'?[.36,1,.84,1]:[.67,.42,.94,1]}
function drawWorld(mvp,verts,color,mode,size=4){
  if(!verts.length)return;gl.useProgram(worldProgram);gl.bindBuffer(gl.ARRAY_BUFFER,worldBuf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(verts),gl.DYNAMIC_DRAW);
  const a=gl.getAttribLocation(worldProgram,'a');gl.enableVertexAttribArray(a);gl.vertexAttribPointer(a,3,gl.FLOAT,false,0,0);gl.uniformMatrix4fv(gl.getUniformLocation(worldProgram,'m'),false,mvp);gl.uniform4fv(gl.getUniformLocation(worldProgram,'c'),color);gl.uniform1f(gl.getUniformLocation(worldProgram,'ps'),size);gl.drawArrays(mode,0,verts.length/3);
}
function ring(r,y,z0=0,segments=64){const v=[];for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2,b=(i+1)/segments*Math.PI*2;v.push(Math.cos(a)*r,y,z0+Math.sin(a)*r,Math.cos(b)*r,y,z0+Math.sin(b)*r)}return v}
function staticLattice(){
  const y=floorY(),grid=[];for(let x=-6;x<=6;x+=.75)grid.push(x,y,-7,x,y,5);for(let z=-7;z<=5;z+=.75)grid.push(-6,y,z,6,y,z);
  const hoops=[];for(const dy of [.15,1.45,2.75])hoops.push(...ring(3.7,y+dy,0,72));
  const vertical=[];for(let i=0;i<12;i++){const a=i/12*Math.PI*2,x=Math.cos(a)*3.7,z=Math.sin(a)*3.7;vertical.push(x,y+.15,z,x,y+2.75,z)}
  return{grid,hoops,vertical};
}
function constellation(t){
  const y0=floorY(),nodes=[],edges=[],stars=[];const n=38;
  for(let i=0;i<n;i++){const az=i*2.3999632297,r=2.65+(i%5)*.34,x=Math.cos(az)*r,z=Math.sin(az)*r-.4,y=y0+.72+((i*37)%100)/100*2.75+Math.sin(t*.00022+i*.91)*.055;nodes.push(x,y,z)}
  for(let i=0;i<n;i++){for(const j of [1,5]){const k=(i+j)%n;edges.push(nodes[i*3],nodes[i*3+1],nodes[i*3+2],nodes[k*3],nodes[k*3+1],nodes[k*3+2])}}
  for(let i=0;i<90;i++){const a=i*1.6180339,r=5.5+(i%9)*.32,yy=y0+.2+((i*53)%100)/100*4.2;stars.push(Math.cos(a)*r,yy,Math.sin(a)*r)}
  return{nodes,edges,stars};
}
function telemetryPath(t){
  const y0=floorY(),lines=[],points=[];const tel=loadTelemetry(),amp=.12+tel.depth*.34,cycles=1.4+tel.pace*2.6,scroll=t*.0012*(.45+tel.pace*1.8),z=-1.58;
  for(let i=0;i<84;i++){const q=i/83,x=-1.3+q*2.6,y=y0+1.22+Math.sin(q*Math.PI*2*cycles+scroll)*amp*(.74+.26*Math.sin(q*Math.PI));if(i)lines.push(points[points.length-3],points[points.length-2],points[points.length-1],x,y,z);points.push(x,y,z)}
  return{lines,points};
}
function liveHudGeometry(){const tel=loadTelemetry(),y=floorY()+1.82,z=-1.62,x0=.62,x1=1.82,xf=x0+(x1-x0)*tel.force;return{track:[x0,y,z,x1,y,z],fill:[x0,y,z+.002,xf,y,z+.002],marker:[xf,y,z+.004],frame:[x0,y-.08,z,x1,y-.08,z,x1,y-.08,z,x1,y+.08,z,x1,y+.08,z,x0,y+.08,z,x0,y+.08,z,x0,y-.08,z]}}
function toolGeometry(t){
  const tel=loadTelemetry(),device=activeDevice(),baseY=floorY()+1.15,angle=tel.angle*Math.PI/180,dir=[0,Math.sin(angle),-Math.cos(angle)],u=[1,0,0],v=[0,-Math.cos(angle),-Math.sin(angle)],period=Math.max(700,4200-tel.cadence*30),q=(1-Math.cos((t%period)/period*Math.PI*2))/2,travel=.3+tel.depth*1.05,anchor=[0,baseY,-.62],center=[anchor[0]+dir[0]*travel*q,anchor[1]+dir[1]*travel*q,anchor[2]+dir[2]*travel*q],length=device?Math.max(.48,Math.min(1.25,Number(device.lengthMm||180)/180)):.72,radius=device?Math.max(.055,Math.min(.17,Number(device.widthMm||30)/280)):.09,color=hexRgb(device?.color||'#62e0c0'),shell=[],tip=[],baseRing=[];
  const point=(offset,rad,a)=>[center[0]+dir[0]*offset+u[0]*rad*Math.cos(a)+v[0]*rad*Math.sin(a),center[1]+dir[1]*offset+u[1]*rad*Math.cos(a)+v[1]*rad*Math.sin(a),center[2]+dir[2]*offset+u[2]*rad*Math.cos(a)+v[2]*rad*Math.sin(a)];
  const ringAt=(offset,rad,store)=>{let prev=null;for(let i=0;i<=24;i++){const a=i/24*Math.PI*2,p=point(offset,rad,a);if(prev)store.push(...prev,...p);prev=p}};
  for(const off of[-length/2,0,length/2])ringAt(off,radius,shell);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2,s0=point(-length/2,radius,a),s1=point(length/2,radius,a);shell.push(...s0,...s1)}
  for(let step=1;step<=4;step++){const q2=step/4,rr=radius*Math.cos(q2*Math.PI/2);ringAt(length/2+radius*q2,rr,tip)}
  ringAt(-length/2-.028,radius*1.55,baseRing);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2,b0=point(-length/2,radius,a),b1=point(-length/2-.028,radius*1.55,a);baseRing.push(...b0,...b1)}
  const target=[anchor[0]+dir[0]*travel,anchor[1]+dir[1]*travel,anchor[2]+dir[2]*travel],axis=[...anchor,...target],targetRing=[],save=[...center];center[0]=target[0];center[1]=target[1];center[2]=target[2];ringAt(0,radius,targetRing);center[0]=save[0];center[1]=save[1];center[2]=save[2];
  return{shell,tip,baseRing,axis,targetRing,marker:center,color,name:device?.name||'Default'};
}
function drawScene(frame,view,t,rays){
  const mvp=mul4(view.projectionMatrix,view.transform.inverse.matrix),lat=staticLattice(),c=constellation(t),mc=modeColor();
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  drawWorld(mvp,lat.grid,[.12,.09,.18,.34],gl.LINES,1);drawWorld(mvp,lat.hoops,[.28,.17,.38,.28],gl.LINES,1);drawWorld(mvp,lat.vertical,[.18,.12,.25,.22],gl.LINES,1);
  drawWorld(mvp,c.edges,[mc[0],mc[1],mc[2],.14],gl.LINES,1);drawWorld(mvp,c.stars,[.45,.62,.92,.28],gl.POINTS,2);drawWorld(mvp,c.nodes,[mc[0],mc[1],mc[2],.88],gl.POINTS,7);
  const core=[];for(let i=0;i<3;i++)core.push(...ring(.36+i*.18,floorY()+1.38,-1.25,48));drawWorld(mvp,core,[mc[0],mc[1],mc[2],.5],gl.LINES,2);
  if(sceneMode==='live'){const p=telemetryPath(t),h=liveHudGeometry(),f=loadTelemetry().force;drawWorld(mvp,p.lines,[.35,.82,1,.82],gl.LINES,3);drawWorld(mvp,p.points,[.92,.82,1,.95],gl.POINTS,4);drawWorld(mvp,h.frame,[.3,.24,.36,.72],gl.LINES,1);drawWorld(mvp,h.track,[.18,.28,.42,.9],gl.LINES,6);drawWorld(mvp,h.fill,[.5+.5*f,.2+.45*(1-f),.95-.55*f,1],gl.LINES,8);drawWorld(mvp,h.marker,[1,.95,.98,1],gl.POINTS,10)}
  if(sceneMode==='anna'){const halo=[];for(let i=0;i<4;i++)halo.push(...ring(.3+i*.16,floorY()+1.42,-1.35,48));drawWorld(mvp,halo,[.88,.48,1,.64],gl.LINES,2)}
  if(sceneMode==='tool'){const g=toolGeometry(t),cc=g.color;drawWorld(mvp,g.axis,[cc[0],cc[1],cc[2],.42],gl.LINES,2);drawWorld(mvp,g.targetRing,[.85,.9,1,.6],gl.LINES,2);drawWorld(mvp,g.shell,[cc[0],cc[1],cc[2],.94],gl.LINES,2);drawWorld(mvp,g.tip,[Math.min(1,cc[0]+.18),Math.min(1,cc[1]+.18),Math.min(1,cc[2]+.18),.96],gl.LINES,2);drawWorld(mvp,g.baseRing,[cc[0],cc[1],cc[2],.96],gl.LINES,3);drawWorld(mvp,g.marker,[1,.96,1,1],gl.POINTS,8)}
  gl.disable(gl.BLEND);
}
function controllerSummary(){
  if(!session)return'Controllers: waiting';const sources=[...session.inputSources].filter(s=>s.gamepad);if(!sources.length)return'Controllers: move/click to wake';
  return sources.map(s=>{const gp=s.gamepad,tr=gp.buttons?.[0]?.value||0,gr=gp.buttons?.[1]?.value||0;return(s.handedness||'controller').toUpperCase()+'  T '+tr.toFixed(2)+'  G '+gr.toFixed(2)}).join('   ');
}
function telemetrySummary(){const t=loadTelemetry();return'PACE '+Math.round(t.pace*100)+'   DEPTH '+Math.round(t.depth*100)+'   FORCE '+Math.round(t.force*100)+'   ENERGY '+Math.round(t.intensity*100)}
function drawMenu(t){
  if(!menuCtx)return;const c=menuCtx,w=menuCanvas.width,h=menuCanvas.height;c.clearRect(0,0,w,h);
  const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(20,10,33,.97)');g.addColorStop(.55,'rgba(8,6,16,.96)');g.addColorStop(1,'rgba(3,3,8,.98)');c.fillStyle=g;rounded(c,18,18,w-36,h-36,42);c.fill();
  c.strokeStyle='rgba(183,125,240,.78)';c.lineWidth=4;rounded(c,18,18,w-36,h-36,42);c.stroke();
  c.fillStyle='#a98bc2';c.font='700 25px system-ui';c.fillText('NOCTURNE  /  COGNITIVE FIELD  ·  0.64.0',58,69);
  c.fillStyle='#ffffff';c.font='800 54px system-ui';c.fillText(sceneMode==='cognitive'?'WORLD ONLINE':sceneMode.toUpperCase()+' FIELD',58,132);
  c.fillStyle='#bbaac8';c.font='25px system-ui';c.fillText(telemetrySummary(),58,178);
  c.fillStyle='#171020';rounded(c,58,210,1084,70,20);c.fill();c.fillStyle='#e9ddf5';c.font='700 24px system-ui';c.fillText(controllerSummary(),82,253);
  const items=[['LIVE','waveform + telemetry'],['ANNA','cognitive presence'],['TOOL','geometry field'],['EXIT','leave immersion']];
  items.forEach((it,i)=>{const x=58+(i%2)*548,y=326+Math.floor(i/2)*142,active=(sceneMode==='live'&&i===0)||(sceneMode==='anna'&&i===1)||(sceneMode==='tool'&&i===2),hot=hovered===i;c.fillStyle=hot?'rgba(112,66,148,.98)':active?'rgba(65,48,82,.98)':'rgba(35,24,45,.94)';rounded(c,x,y,518,112,24);c.fill();c.strokeStyle=hot?'rgba(224,181,255,1)':active?'rgba(143,218,255,.9)':'rgba(105,75,127,.8)';c.lineWidth=hot?5:2;rounded(c,x,y,518,112,24);c.stroke();c.fillStyle='#fff';c.font='800 31px system-ui';c.fillText(it[0],x+28,y+44);c.fillStyle='#ae9bb9';c.font='22px system-ui';c.fillText(it[1],x+28,y+80)});
  c.fillStyle='#806f8d';c.font='22px system-ui';c.fillText(actionLine,58,739);c.fillStyle='#5f5270';c.font='18px system-ui';c.fillText('Trigger selects · Grip + aim moves this panel · no flashing',58,778);
  gl.bindTexture(gl.TEXTURE_2D,uiTex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,menuCanvas);lastMenu=t;
}
function renderMenu(mvp,t){
  if(t-lastMenu>150)drawMenu(t);const y=panelY(),z=panelZ(),x=panelX(),w=PANEL_W/2,h=PANEL_H/2;
  const verts=new Float32Array([x-w,y-h,z,0,1,x+w,y-h,z,1,1,x-w,y+h,z,0,0,x-w,y+h,z,0,0,x+w,y-h,z,1,1,x+w,y+h,z,1,0]);
  gl.useProgram(uiProgram);gl.bindBuffer(gl.ARRAY_BUFFER,uiBuf);gl.bufferData(gl.ARRAY_BUFFER,verts,gl.DYNAMIC_DRAW);
  const p=gl.getAttribLocation(uiProgram,'p'),uv=gl.getAttribLocation(uiProgram,'uv');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,20,12);
  gl.uniformMatrix4fv(gl.getUniformLocation(uiProgram,'m'),false,mvp);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,uiTex);gl.uniform1i(gl.getUniformLocation(uiProgram,'t'),0);
  gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,6);gl.disable(gl.BLEND);
}
function pulseSource(src){const gp=src?.gamepad,acts=[];if(!gp)return;try{if(gp.vibrationActuator)acts.push(gp.vibrationActuator);for(const a of gp.hapticActuators||[])acts.push(a)}catch{}for(const a of acts){try{if(a.pulse)a.pulse(.45,75);else if(a.playEffect)a.playEffect('dual-rumble',{duration:75,strongMagnitude:.45,weakMagnitude:.25})}catch{}}}
function selectTile(i,src){
  if(i===0){sceneMode='live';actionLine='Live telemetry field selected.'}
  else if(i===1){sceneMode='anna';actionLine='Anna cognitive field selected.'}
  else if(i===2){sceneMode='tool';actionLine='Tool geometry field selected.'}
  else if(i===3){actionLine='Leaving immersive VR…';try{session?.end()}catch{}}
  pulseSource(src);lastMenu=0;
}
function controllerInteraction(frame){
  hovered=-1;const rays=[];if(!session||!refSpace)return rays;let nearest=Infinity,chosen=null;
  for(const src of session.inputSources){if(!src.gamepad)continue;const pose=frame.getPose(src.targetRaySpace,refSpace);if(!pose)continue;const m=pose.transform.matrix,o=[m[12],m[13],m[14]],d=[-m[8],-m[9],-m[10]],den=d[2],tr=src.gamepad.buttons?.[0]?.value||0,gr=src.gamepad.buttons?.[1]?.value||0;if(gr>.72&&tr<.45){const dd=2.35,px=o[0]+d[0]*dd,py=o[1]+d[1]*dd,pz=o[2]+d[2]*dd;panelOffset.x=Math.max(-1.8,Math.min(1.8,px-basePanelX()));panelOffset.y=Math.max(-1.2,Math.min(1.2,py-basePanelY()));panelOffset.z=Math.max(-1.5,Math.min(1.2,pz-PANEL_Z));actionLine='Panel moved · release grip, then use trigger to select.';lastMenu=0}let end=[o[0]+d[0]*3,o[1]+d[1]*3,o[2]+d[2]*3],idx=-1,dist=3;
    if(Math.abs(den)>.0001){const tt=(panelZ()-o[2])/den;if(tt>0&&tt<6){const hx=o[0]+d[0]*tt,hy=o[1]+d[1]*tt,lx=hx-panelX();if(Math.abs(lx)<=PANEL_W/2&&Math.abs(hy-panelY())<=PANEL_H/2){end=[hx,hy,panelZ()+.008];dist=tt;const localY=hy-panelY();idx=(localY>-.03?0:2)+(lx>0?1:0);if(dist<nearest){nearest=dist;chosen=idx}}}}
    rays.push(o[0],o[1],o[2],end[0],end[1],end[2]);const was=triggerDown.get(src)||false,down=tr>.62;if(down&&!was&&idx>=0)selectTile(idx,src);triggerDown.set(src,down);
  }
  hovered=chosen??-1;return rays;
}
function drawControllerOverlay(mvp,rays){if(!rays.length)return;const tips=[];for(let i=0;i<rays.length;i+=6)tips.push(rays[i+3],rays[i+4],rays[i+5]);gl.disable(gl.DEPTH_TEST);drawWorld(mvp,rays,[.96,.82,1,1],gl.LINES,3);drawWorld(mvp,tips,[1,.96,1,1],gl.POINTS,11);gl.enable(gl.DEPTH_TEST)}
async function enterFallback(e){
  if(e){e.preventDefault();e.stopImmediatePropagation()}if(session){set('diag-line','Immersive session is already active.');return}
  const enter=$('enter');if(enter){enter.disabled=true;enter.textContent='OPENING VR…'}
  try{
    const test=await run();if(!test.immersive)throw Error('Quest reports immersive-vr unsupported');
    const canvas=$('xr-canvas');gl=canvas.getContext('webgl',{xrCompatible:true,alpha:false,antialias:true});if(!gl)throw Error('WebGL context unavailable');if(gl.makeXRCompatible)await gl.makeXRCompatible();initGL();
    const root=$('xr-overlay');try{session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor','hand-tracking','dom-overlay'],domOverlay:{root}})}catch{session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor','hand-tracking']})}
    layer=new XRWebGLLayer(session,gl);session.updateRenderState({baseLayer:layer,depthNear:.04,depthFar:60});
    try{refSpace=await session.requestReferenceSpace('local-floor');refMode='local-floor'}catch{refSpace=await session.requestReferenceSpace('local');refMode='local'}
    session.addEventListener('end',()=>{session=null;layer=null;refSpace=null;hovered=-1;triggerDown.clear();set('xr-status','VR READY');set('diag-line','Immersive session ended normally.');if(enter){enter.disabled=false;enter.textContent='ENTER IMMERSIVE VR'}const exit=$('exit');if(exit)exit.disabled=true},{once:true});
    sceneMode=requestedMode();panelOffset={x:0,y:0,z:0};actionLine=sceneMode==='live'?'Live field loaded from Session Setup.':'Point a controller at a tile and press trigger.';lastMenu=0;set('xr-status','IMMERSIVE VR');set('diag-line','Nocturne '+sceneMode+' field active.');const exit=$('exit');if(exit)exit.disabled=false;
    const frame=(t,f)=>{if(!session)return;const pose=f.getViewerPose(refSpace),rays=controllerInteraction(f);gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(.006,.004,.014,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(pose)for(const view of pose.views){const vp=layer.getViewport(view);gl.viewport(vp.x,vp.y,vp.width,vp.height);gl.scissor(vp.x,vp.y,vp.width,vp.height);gl.enable(gl.SCISSOR_TEST);gl.clearColor(.006,.004,.014,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);drawScene(f,view,t,rays);const mvp=mul4(view.projectionMatrix,view.transform.inverse.matrix);renderMenu(mvp,t);drawControllerOverlay(mvp,rays);gl.disable(gl.SCISSOR_TEST)}session.requestAnimationFrame(frame)};session.requestAnimationFrame(frame);
  }catch(err){set('diag-line','Direct VR start failed: '+String(err&&err.message||err).slice(0,140));set('xr-status','VR START FAILED');if(enter){enter.disabled=false;enter.textContent='ENTER IMMERSIVE VR'}session=null}
}
async function testControllers(e){
  if(e){e.preventDefault();e.stopImmediatePropagation()}if(!session){set('diag-line','Controller Test needs an active immersive session. Enter VR first.');return}
  const sources=[...session.inputSources].filter(s=>s.gamepad);if(!sources.length){set('diag-line','Immersive VR is active, but Quest has not exposed controller gamepads yet. Move or click a controller and try again.');return}
  let pulses=0;for(const s of sources){const gp=s.gamepad,acts=[];if(gp.vibrationActuator)acts.push(gp.vibrationActuator);for(const a of gp.hapticActuators||[])acts.push(a);for(const a of acts){try{if(a.pulse){await a.pulse(.8,180);pulses++}else if(a.playEffect){await a.playEffect('dual-rumble',{duration:180,strongMagnitude:.8,weakMagnitude:.5});pulses++}}catch{}}}
  set('diag-line',pulses?'Controller test sent '+pulses+' haptic pulse'+(pulses===1?'':'s')+'.':'Controllers are visible, but no haptic actuator is exposed.');
}
window.nocturneVrSelfTest=run;
document.addEventListener('DOMContentLoaded',()=>{$('diag-run')?.addEventListener('click',run);setTimeout(run,0);const enter=$('enter');if(enter)enter.addEventListener('click',enterFallback,{capture:true});const test=$('test');if(test)test.addEventListener('click',testControllers,{capture:true});const exit=$('exit');if(exit)exit.addEventListener('click',async e=>{if(session){e.preventDefault();e.stopImmediatePropagation();try{await session.end()}catch{}}},{capture:true})});
window.addEventListener('error',e=>set('diag-line','VR script error: '+String(e.message||'unknown').slice(0,120)));
window.addEventListener('unhandledrejection',e=>set('diag-line','VR promise error: '+String(e.reason&&e.reason.message||e.reason||'unknown').slice(0,120)));
})();