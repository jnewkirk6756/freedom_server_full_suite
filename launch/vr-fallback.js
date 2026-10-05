(function(){
const $=id=>document.getElementById(id),set=(id,v)=>{const e=$(id);if(e)e.textContent=v},clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
let session=null,gl=null,layer=null,refSpace=null,refMode='local-floor';
let worldProgram=null,worldBuf=null,uiProgram=null,uiBuf=null,uiTex=null,annaTex=null,menuCanvas=null,menuCtx=null,lastMenu=0;
let mediaCorePromise=null,annaVideo=null,annaVideoState='A01',annaVideoLoadSeq=0,annaCanvas=null,annaCtx=null,annaVideoReady=false,annaVideoError='',aiStatus='AI CONNECTING',annaTexReady=false,annaTexW=0,annaTexH=0,annaLastUpload=0,lastMotionCycle=-1,lastMotionEvent=0,lastControllerEvent=0;
const ANNA_POSTER_DATA='data:image/jpeg;base64,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';const annaPoster=new Image();let annaPosterReady=false;annaPoster.onload=()=>{annaPosterReady=true};annaPoster.src=ANNA_POSTER_DATA;
let editTarget='anna',annaPose={x:1.42,y:1.48,z:-2.05,scale:1,yaw:0},toolPose={x:0,y:0,z:0,scale:1,yaw:0};
function requestedMode(){const q=new URLSearchParams(location.search).get('mode');if(['live','anna','tool','cognitive'].includes(q))return q;try{const saved=JSON.parse(localStorage.getItem('nocturne.vr.entry.v1')||'null');if(saved&&Date.now()-Number(saved.at||0)<30*60*1000&&['live','anna','tool','cognitive'].includes(saved.mode))return saved.mode}catch{}return'cognitive'}
let sceneMode=requestedMode(),actionLine='Point a controller at a tile and press trigger.',hovered=-1;
const triggerDown=new Map();
let telemetry={pace:0,depth:0,force:0,intensity:0,angle:0,cadence:0,entrySpeedS:3,cycleTimeS:3,initialized:false,startedAt:0};let panelOffset={x:0,y:0,z:0};
const mediaCore=()=>mediaCorePromise||(mediaCorePromise=import('./video-state-core.js'));
async function resolveAnnaState(id){
  const core=await mediaCore(),requested=String(id||'A01').toUpperCase(),state=core.stateById(requested),recent=[];
  const ids=state?[...core.familyCandidates(requested,recent),'A01','A02','A00']:['A01','A02','A00'];
  for(const candidate of [...new Set(ids)]){try{const row=await core.getClipSynced(candidate);if(row?.blob)return{core,id:candidate,row};}catch{}}
  return null;
}
async function loadAnnaVideoState(id){
  const seq=++annaVideoLoadSeq,core=await mediaCore(),requested=String(id||'A01').toUpperCase(),state=core.stateById(requested);
  const ids=state?[...core.familyCandidates(requested,[]),'A01','A02','A00']:['A01','A02','A00'];
  if(!annaVideo){
    annaVideo=document.createElement('video');annaVideo.muted=true;annaVideo.playsInline=true;annaVideo.autoplay=true;annaVideo.preload='auto';annaVideo.setAttribute('playsinline','');annaVideo.setAttribute('webkit-playsinline','');
    annaVideo.style.cssText='position:fixed;width:2px;height:2px;opacity:.001;pointer-events:none;left:-20px;top:-20px';document.body.appendChild(annaVideo);
    annaCanvas=document.createElement('canvas');annaCanvas.width=360;annaCanvas.height=640;annaCtx=annaCanvas.getContext('2d',{alpha:false});
  }
  annaVideoReady=false;annaVideoError='loading';set('vr-video-state','LOADING');
  for(const candidate of [...new Set(ids)]){
    if(seq!==annaVideoLoadSeq)return false;
    try{
      const head=await fetch('/media/'+candidate+'.mp4?v=0730',{method:'HEAD',cache:'no-store'});if(!head.ok)continue;
      const ok=await new Promise(resolve=>{
        let settled=false;const done=v=>{if(settled)return;settled=true;clearTimeout(timer);resolve(v)};
        const timer=setTimeout(()=>done(false),7000);
        annaVideo.onloadeddata=()=>done(true);annaVideo.onerror=()=>done(false);
        annaVideo.src='/media/'+candidate+'.mp4?v=0730';annaVideo.loop=core.playbackMode(candidate)==='loop';annaVideo.load();try{annaVideo.play()}catch{}
      });
      if(!ok)continue;
      annaVideoState=candidate;annaVideoReady=true;annaVideoError='';try{localStorage.setItem('nocturne.vr.video-state.v1',candidate)}catch{}
      const vw=annaVideo.videoWidth||360,vh=annaVideo.videoHeight||640;if(vw>0&&vh>0){annaCanvas.width=Math.max(180,Math.min(720,vw));annaCanvas.height=Math.max(320,Math.min(1280,vh))}
      annaVideo.onended=()=>{const next=core.transitionAfterState(annaVideoState);if(next)loadAnnaVideoState(next)};
      set('vr-video-state',candidate);actionLine='Anna '+candidate+' ready · '+vw+'×'+vh;lastMenu=0;try{await annaVideo.play()}catch{}return true;
    }catch{}
  }
  annaVideoReady=false;annaVideoError='missing';set('vr-video-state','MISSING');actionLine='Anna media unavailable in Quest.';lastMenu=0;return false;
}

function activeDevice(){try{const lib=JSON.parse(localStorage.getItem('nocturne.devices.v1')||'{}');if(!Array.isArray(lib.devices))return null;return lib.devices.find(d=>d.id===lib.activeId)||(lib.devices.length===1?lib.devices[0]:null)}catch{return null}}
function hexRgb(hex){const m=/^#([0-9a-f]{6})$/i.exec(String(hex||''));if(!m)return[.36,1,.84,1];const n=parseInt(m[1],16);return[((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255,1]}
function embodiedColor(){const m={calm:[.48,.35,.72,1],attentive:[.62,.43,.86,1],curious:[.32,.68,.95,1],focused:[.46,.82,.82,1],playful:[.86,.42,.95,1],assertive:[.92,.48,.62,1],intense:[1,.28,.74,1],irritated:[.94,.25,.38,1],withdrawn:[.28,.25,.42,1],recovering:[.4,.62,.86,1]};return m[embodiedState]||m.attentive}
function embodiedPulse(t){const speed=embodiedState==='intense'?.0048:embodiedState==='assertive'?.004:embodiedState==='playful'?.0036:embodiedState==='withdrawn'?.0012:embodiedState==='recovering'?.0018:.0024;return .72+.28*((Math.sin(t*speed)+1)/2)}
function renderEmbodiedPresence(mvp,t){const col=embodiedColor(),pulse=embodiedPulse(t),rings=[],x=annaPose.x,y=floorY()+annaPose.y,z=annaPose.z,scale=annaPose.scale||1;for(let i=0;i<5;i++)rings.push(...ring((.24+i*.13)*pulse*scale,y,z,56).map((v,idx)=>idx%3===0?v+x:v));drawWorld(mvp,rings,[col[0],col[1],col[2],.22+.42*pulse],gl.LINES,2);const core=[x,y,z];drawWorld(mvp,core,[Math.min(1,col[0]+.18),Math.min(1,col[1]+.18),Math.min(1,col[2]+.18),1],gl.POINTS,12)}

function loadTelemetry(){
  try{
    const s=JSON.parse(sessionStorage.getItem('nocturne.vr.session.v070')||'{}');
    if(s.initialized){
      telemetry={...telemetry,pace:clamp(s.pace),depth:clamp(s.depth),force:clamp(s.force),intensity:clamp(s.intensity),angle:Math.max(-45,Math.min(45,Number(s.angle)||0)),cadence:Math.max(0,Math.min(100,Number(s.cadence)||0)),entrySpeedS:Math.max(.5,Math.min(10,Number(s.entrySpeedS)||3)),cycleTimeS:Math.max(.7,Math.min(10,Number(s.cycleTimeS)||3)),initialized:true,startedAt:Number(s.startedAt)||0};
    }else telemetry={...telemetry,pace:0,depth:0,force:0,intensity:0,cadence:0,initialized:false,startedAt:0};
  }catch{telemetry={...telemetry,pace:0,depth:0,force:0,intensity:0,cadence:0,initialized:false,startedAt:0}}
  return telemetry;
}
const VR_SESSION_KEY_FALLBACK='nocturne.vr.session.v070';
function fallbackPaceFromCycle(sec){sec=Math.max(.7,Math.min(10,Number(sec)||3));return clamp((5-sec)/4.3)}
function commitFallbackVrSession(){
  const entry=Math.max(.5,Math.min(10,Number($('vr-entry-speed')?.value)||3));
  const depth=Math.max(0,Math.min(100,Number($('vr-start-depth')?.value)||50))/100;
  const cycle=Math.max(.7,Math.min(10,Number($('vr-stroke-speed')?.value)||3));
  const s={initialized:true,pace:fallbackPaceFromCycle(cycle),depth,force:0,intensity:.2,entrySpeedS:entry,cycleTimeS:cycle,cadence:Math.round(fallbackPaceFromCycle(cycle)*100),pattern:'steady',startedAt:Date.now()};
  try{sessionStorage.setItem(VR_SESSION_KEY_FALLBACK,JSON.stringify(s))}catch{}
  telemetry={...telemetry,...s};set('diag-session','READY');set('pace',Math.round(s.pace*100));set('depth',Math.round(s.depth*100));set('force',0);set('energy',20);
  actionLine='Session ready · enter '+entry.toFixed(1)+'s · depth '+Math.round(depth*100)+'% · cycle '+cycle.toFixed(1)+'s';lastMenu=0;
  window.dispatchEvent(new CustomEvent('nocturne:vr-session-configured',{detail:s}));
  return s;
}
function motionPeriodMs(tel,t){if(!tel.initialized)return 1e9;const elapsed=tel.startedAt?Math.max(0,Date.now()-tel.startedAt):1e9;return elapsed<tel.entrySpeedS*2000?Math.max(1000,tel.entrySpeedS*2000):Math.max(700,tel.cycleTimeS*1000)}
function motionState(){
  const tel=loadTelemetry();if(!tel.initialized)return{phase:0,cycle:0,envelope:0,velocity:0,direction:'STILL',period:1e9};
  const elapsed=Math.max(0,Date.now()-(tel.startedAt||Date.now())),entryPeriod=Math.max(1000,tel.entrySpeedS*2000);
  let phase=0,cycle=0,period=entryPeriod;
  if(elapsed<entryPeriod){phase=elapsed/entryPeriod}
  else{period=Math.max(700,tel.cycleTimeS*1000);const after=elapsed-entryPeriod;cycle=1+Math.floor(after/period);phase=(after%period)/period}
  const envelope=(1-Math.cos(phase*Math.PI*2))/2,velocity=Math.sin(phase*Math.PI*2)*Math.PI*2/period;
  return{phase,cycle,envelope,velocity,direction:Math.abs(velocity)<.00002?'STILL':velocity>0?'FORWARD':'RETURN',period};
}
function aiLinkColor(){const s=String(aiStatus).toUpperCase();if(s.includes('ERROR'))return[1,.28,.34,.9];if(s.includes('THINK')||s.includes('CHOOS'))return[.77,.45,1,.92];if(s.includes('APPLIED'))return[.42,1,.72,.92];if(s.includes('AUTO'))return[.36,.82,1,.9];return[.72,.6,.9,.72]}
function syncMotionRuntime(t,motion){
  const tel=loadTelemetry();window.__NOCTURNE_VR_SYNC__={phase:motion.phase,cycle:motion.cycle,direction:motion.direction,envelope:motion.envelope,telemetry:{...tel},videoState:annaVideoState,aiStatus,at:Date.now()};
  if(motion.cycle!==lastMotionCycle){if(lastMotionCycle>=0&&session){const amp=clamp(.28+tel.intensity*.34+tel.force*.2);for(const src of session.inputSources||[])pulseSource(src,amp,40+tel.depth*65);window.dispatchEvent(new CustomEvent('nocturne:vr-cycle',{detail:{...window.__NOCTURNE_VR_SYNC__}}))}lastMotionCycle=motion.cycle}
  if(t-lastMotionEvent>120){lastMotionEvent=t;window.dispatchEvent(new CustomEvent('nocturne:vr-motion',{detail:{...window.__NOCTURNE_VR_SYNC__}}))}
  if(session&&t-lastControllerEvent>240){lastControllerEvent=t;const controllers=[...session.inputSources].filter(s=>s.gamepad).map(s=>({hand:s.handedness,trigger:s.gamepad.buttons?.[0]?.value||0,grip:s.gamepad.buttons?.[1]?.value||0,axes:[...(s.gamepad.axes||[])].slice(0,4)}));window.dispatchEvent(new CustomEvent('nocturne:vr-controller-state',{detail:{controllers}}))}
}
async function run(){
  set('diag-secure',window.isSecureContext?'YES':'NO');set('diag-xr',navigator.xr?'YES':'NO');
  let glok=false;try{const c=document.createElement('canvas');glok=!!c.getContext('webgl')}catch{}set('diag-gl',glok?'YES':'NO');
  let immersive=false,err='';if(navigator.xr){try{immersive=await navigator.xr.isSessionSupported('immersive-vr')}catch(e){err=String(e&&e.message||e)}}set('diag-immersive',immersive?'YES':'NO');
  const cfg=loadTelemetry();set('diag-session',cfg.initialized?'READY':'ZERO');set('diag-media','EMBODIED');
  set('diag-line',[(window.isSecureContext?'HTTPS secure':'HTTPS not secure'),(navigator.xr?'WebXR exposed':'WebXR missing'),(immersive?'immersive-vr supported':'immersive-vr not supported'),(glok?'WebGL ready':'WebGL missing'),('AI state '+embodiedState),(cfg.initialized?'session initialized':'session zero')].join(' · ')+(err?' · '+err.slice(0,90):''));
  return{immersive,mediaOk:true};
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
  uiBuf=gl.createBuffer();uiTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,uiTex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);annaTex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,annaTex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
  menuCanvas=document.createElement('canvas');menuCanvas.width=1200;menuCanvas.height=820;menuCtx=menuCanvas.getContext('2d');if(!annaCanvas){annaCanvas=document.createElement('canvas');annaCanvas.width=256;annaCanvas.height=455;annaCtx=annaCanvas.getContext('2d',{alpha:false})}
}
function mul4(a,b){const o=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++){let v=0;for(let k=0;k<4;k++)v+=a[k*4+r]*b[c*4+k];o[c*4+r]=v}return o}
function rounded(c,x,y,w,h,r){c.beginPath();c.moveTo(x+r,y);c.arcTo(x+w,y,x+w,y+h,r);c.arcTo(x+w,y+h,x,y+h,r);c.arcTo(x,y+h,x,y,r);c.arcTo(x,y,x+w,y,r);c.closePath()}
function floorY(){return refMode==='local-floor'?0:-1.55}
function basePanelY(){return refMode==='local-floor'?1.48:.02}
function panelY(){return basePanelY()+panelOffset.y}
const PANEL_Z=-2.38,PANEL_W=2.05,PANEL_H=1.38;
function panelZ(){return PANEL_Z+panelOffset.z}
function basePanelX(){return -1.28}
function panelX(){return basePanelX()+panelOffset.x}
function modeColor(){if(sceneMode==='live'||sceneMode==='anna')return embodiedColor();return sceneMode==='tool'?[.36,1,.84,1]:[.67,.42,.94,1]}
function transformPoint(p,pose,pivot=[0,0,0]){
  const x=(p[0]-pivot[0])*pose.scale,z=(p[2]-pivot[2])*pose.scale,y=(p[1]-pivot[1])*pose.scale,a=pose.yaw,ca=Math.cos(a),sa=Math.sin(a);
  return[pivot[0]+x*ca-z*sa+pose.x,pivot[1]+y+pose.y,pivot[2]+x*sa+z*ca+pose.z];
}
function transformVerts(v,pose,pivot=[0,0,0]){const out=[];for(let i=0;i<v.length;i+=3)out.push(...transformPoint([v[i],v[i+1],v[i+2]],pose,pivot));return out}
function resetSpatialView(){panelOffset={x:0,y:0,z:0};annaPose={x:1.42,y:1.48,z:-2.05,scale:1,yaw:0};toolPose={x:0,y:0,z:0,scale:1,yaw:0};editTarget='anna';actionLine='View reset · editing ANNA';lastMenu=0}

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
function telemetryPath(t,motion=motionState()){
  const y0=floorY(),lines=[],points=[];const tel=loadTelemetry(),amp=tel.initialized?(.08+tel.depth*.36):0,cycles=1.5,scroll=tel.initialized?(motion.phase*Math.PI*2):0,z=-1.58;
  for(let i=0;i<84;i++){const q=i/83,x=-1.3+q*2.6,y=y0+1.22+Math.sin(q*Math.PI*2*cycles+scroll)*amp*(.74+.26*Math.sin(q*Math.PI));if(i)lines.push(points[points.length-3],points[points.length-2],points[points.length-1],x,y,z);points.push(x,y,z)}
  return{lines,points,motion};
}
function waveVolumeGeometry(path){const back=[],front=[],ribs=[],pts=path.points,n=pts.length/3;for(let i=1;i<n;i++){for(const dz of[-.09,.09])back.push(pts[(i-1)*3],pts[(i-1)*3+1],pts[(i-1)*3+2]+dz,pts[i*3],pts[i*3+1],pts[i*3+2]+dz)}for(let i=0;i<n;i+=7)ribs.push(pts[i*3],pts[i*3+1],pts[i*3+2]-.09,pts[i*3],pts[i*3+1],pts[i*3+2]+.09);const idx=Math.max(0,Math.min(n-1,Math.round(path.motion.phase*(n-1))));front.push(pts[idx*3],pts[idx*3+1],pts[idx*3+2]);return{layers:back,ribs,marker:front}}
function liveHudGeometry(){const tel=loadTelemetry(),y=floorY()+1.82,z=-1.62,x0=.62,x1=1.82,xf=x0+(x1-x0)*tel.force;return{track:[x0,y,z,x1,y,z],fill:[x0,y,z+.002,xf,y,z+.002],marker:[xf,y,z+.004],frame:[x0,y-.08,z,x1,y-.08,z,x1,y-.08,z,x1,y+.08,z,x1,y+.08,z,x0,y+.08,z,x0,y+.08,z,x0,y-.08,z]}}
function toolGeometry(t,motion=motionState()){
  const tel=loadTelemetry(),device=activeDevice(),baseY=floorY()+1.15,angle=tel.angle*Math.PI/180,dir=[0,Math.sin(angle),-Math.cos(angle)],u=[1,0,0],v=[0,-Math.cos(angle),-Math.sin(angle)],q=tel.initialized?motion.envelope:0,travel=tel.initialized?(.3+tel.depth*1.05):0,anchor=[0,baseY,-.62],center=[anchor[0]+dir[0]*travel*q,anchor[1]+dir[1]*travel*q,anchor[2]+dir[2]*travel*q],length=device?Math.max(.48,Math.min(1.25,Number(device.lengthMm||180)/180)):.72,radius=device?Math.max(.055,Math.min(.17,Number(device.widthMm||30)/280)):.09,color=hexRgb(device?.color||'#62e0c0'),shell=[],tip=[],baseRing=[];
  const point=(offset,rad,a)=>[center[0]+dir[0]*offset+u[0]*rad*Math.cos(a)+v[0]*rad*Math.sin(a),center[1]+dir[1]*offset+u[1]*rad*Math.cos(a)+v[1]*rad*Math.sin(a),center[2]+dir[2]*offset+u[2]*rad*Math.cos(a)+v[2]*rad*Math.sin(a)];
  const ringAt=(offset,rad,store)=>{let prev=null;for(let i=0;i<=24;i++){const a=i/24*Math.PI*2,p=point(offset,rad,a);if(prev)store.push(...prev,...p);prev=p}};
  for(const off of[-length/2,0,length/2])ringAt(off,radius,shell);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2,s0=point(-length/2,radius,a),s1=point(length/2,radius,a);shell.push(...s0,...s1)}
  for(let step=1;step<=4;step++){const q2=step/4,rr=radius*Math.cos(q2*Math.PI/2);ringAt(length/2+radius*q2,rr,tip)}
  ringAt(-length/2-.028,radius*1.55,baseRing);
  for(let i=0;i<10;i++){const a=i/10*Math.PI*2,b0=point(-length/2,radius,a),b1=point(-length/2-.028,radius*1.55,a);baseRing.push(...b0,...b1)}
  const target=[anchor[0]+dir[0]*travel,anchor[1]+dir[1]*travel,anchor[2]+dir[2]*travel],axis=[...anchor,...target],targetRing=[],save=[...center];center[0]=target[0];center[1]=target[1];center[2]=target[2];ringAt(0,radius,targetRing);center[0]=save[0];center[1]=save[1];center[2]=save[2];
  return{shell,tip,baseRing,axis,targetRing,marker:center,color,name:device?.name||'Default',anchor,dir,maxTravel:travel,envelope:q};
}
function drawScene(frame,view,t,rays,motion=motionState()){
  const mvp=mul4(view.projectionMatrix,view.transform.inverse.matrix),lat=staticLattice(),c=constellation(t),mc=modeColor();
  gl.enable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
  drawWorld(mvp,lat.grid,[.12,.09,.18,.34],gl.LINES,1);drawWorld(mvp,lat.hoops,[.28,.17,.38,.28],gl.LINES,1);drawWorld(mvp,lat.vertical,[.18,.12,.25,.22],gl.LINES,1);
  drawWorld(mvp,c.edges,[mc[0],mc[1],mc[2],.14],gl.LINES,1);drawWorld(mvp,c.stars,[.45,.62,.92,.28],gl.POINTS,2);drawWorld(mvp,c.nodes,[mc[0],mc[1],mc[2],.88],gl.POINTS,7);
  const core=[];for(let i=0;i<3;i++)core.push(...ring(.36+i*.18,floorY()+1.38,-1.25,48));drawWorld(mvp,core,[mc[0],mc[1],mc[2],.5],gl.LINES,2);
  {const p=telemetryPath(t,motion),vol=waveVolumeGeometry(p),h=liveHudGeometry(),f=loadTelemetry().force,g=toolGeometry(t,motion),cc=g.color,pivot=[0,floorY()+1.15,-.62],axis=transformVerts(g.axis,toolPose,pivot),shell=transformVerts(g.shell,toolPose,pivot),tip=transformVerts(g.tip,toolPose,pivot),base=transformVerts(g.baseRing,toolPose,pivot),targetRing=transformVerts(g.targetRing,toolPose,pivot),marker=transformVerts(g.marker,toolPose,pivot);drawWorld(mvp,vol.layers,[.22,.58,.82,.28],gl.LINES,1);drawWorld(mvp,vol.ribs,[.38,.76,1,.2],gl.LINES,1);drawWorld(mvp,p.lines,[.35,.82,1,.9],gl.LINES,3);drawWorld(mvp,p.points,[.92,.82,1,.9],gl.POINTS,3);drawWorld(mvp,vol.marker,[1,.95,1,1],gl.POINTS,11);drawWorld(mvp,h.frame,[.3,.24,.36,.72],gl.LINES,1);drawWorld(mvp,h.track,[.18,.28,.42,.9],gl.LINES,6);drawWorld(mvp,h.fill,[.5+.5*f,.2+.45*(1-f),.95-.55*f,1],gl.LINES,8);drawWorld(mvp,h.marker,[1,.95,.98,1],gl.POINTS,10);drawWorld(mvp,axis,[cc[0],cc[1],cc[2],.42],gl.LINES,2);drawWorld(mvp,targetRing,[.85,.9,1,.65],gl.LINES,2);drawWorld(mvp,shell,[cc[0],cc[1],cc[2],.96],gl.LINES,2);drawWorld(mvp,tip,[.92,.82,1,.98],gl.LINES,2);drawWorld(mvp,base,[cc[0],cc[1],cc[2],.9],gl.LINES,3);drawWorld(mvp,marker,[1,.96,1,1],gl.POINTS,9);const trail=[];for(let k=1;k<=6;k++){const q=Math.max(0,g.envelope-k*.08),pt=[g.anchor[0]+g.dir[0]*g.maxTravel*q,g.anchor[1]+g.dir[1]*g.maxTravel*q,g.anchor[2]+g.dir[2]*g.maxTravel*q],tp=transformPoint(pt,toolPose,pivot);trail.push(...tp)}drawWorld(mvp,trail,[cc[0],cc[1],cc[2],.22],gl.POINTS,5);renderEmbodiedPresence(mvp,t);const ep=[annaPose.x,floorY()+annaPose.y,annaPose.z],link=[...ep,...marker.slice(0,3)],lc=aiLinkColor();drawWorld(mvp,link,lc,gl.LINES,2);const nodes=[];for(let i=1;i<7;i++){const q=i/7;nodes.push(ep[0]+(marker[0]-ep[0])*q,ep[1]+(marker[1]-ep[1])*q,ep[2]+(marker[2]-ep[2])*q)}drawWorld(mvp,nodes,[lc[0],lc[1],lc[2],.7],gl.POINTS,4)}
  gl.disable(gl.BLEND);
}
function controllerSummary(){
  if(!session)return'Controllers: waiting';const sources=[...session.inputSources].filter(s=>s.gamepad);if(!sources.length)return'Controllers: move/click to wake';
  return sources.map(s=>{const gp=s.gamepad,tr=gp.buttons?.[0]?.value||0,gr=gp.buttons?.[1]?.value||0;return(s.handedness||'controller').toUpperCase()+'  T '+tr.toFixed(2)+'  G '+gr.toFixed(2)}).join('   ');
}
function telemetrySummary(){const t=loadTelemetry();return t.initialized?('PACE '+Math.round(t.pace*100)+'   DEPTH '+Math.round(t.depth*100)+'   CYCLE '+t.cycleTimeS.toFixed(1)+'s   ENERGY '+Math.round(t.intensity*100)):'SESSION NOT STARTED · ZERO TELEMETRY'}
function drawMenu(t){
  if(!menuCtx)return;const c=menuCtx,w=menuCanvas.width,h=menuCanvas.height,tel=loadTelemetry(),auto=localStorage.getItem('nocturne.vr.autopilot.v1')==='on';
  c.clearRect(0,0,w,h);const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(20,10,33,.98)');g.addColorStop(.58,'rgba(8,6,16,.97)');g.addColorStop(1,'rgba(3,3,8,.99)');c.fillStyle=g;rounded(c,18,18,w-36,h-36,42);c.fill();c.strokeStyle='rgba(183,125,240,.82)';c.lineWidth=4;rounded(c,18,18,w-36,h-36,42);c.stroke();
  c.fillStyle='#a98bc2';c.font='700 24px system-ui';c.fillText('NOCTURNE / EMBODIED IMMERSIVE · 0.74',56,61);
  c.fillStyle='#fff';c.font='800 44px system-ui';c.fillText(tel.initialized?'SESSION LIVE':'SESSION READY',56,113);
  c.fillStyle='#bbaac8';c.font='22px system-ui';c.fillText('AI '+embodiedState.toUpperCase()+' · EMBODIED · '+aiStatus,56,151);
  const metrics=[['PACE',Math.round(tel.pace*100)+'%'],['DEPTH',Math.round(tel.depth*100)+'%'],['FORCE',Math.round(tel.force*100)+'%'],['ENERGY',Math.round(tel.intensity*100)+'%'],['CYCLE',tel.initialized?tel.cycleTimeS.toFixed(1)+'s':'—']];
  metrics.forEach((m,i)=>{const x=56+i*216;c.fillStyle='rgba(24,15,34,.95)';rounded(c,x,178,196,72,17);c.fill();c.strokeStyle='rgba(80,55,96,.75)';c.lineWidth=2;rounded(c,x,178,196,72,17);c.stroke();c.fillStyle='#8f7e9d';c.font='700 14px system-ui';c.fillText(m[0],x+16,203);c.fillStyle='#f1e8f8';c.font='800 25px ui-monospace';c.fillText(m[1],x+16,234)});
  const editLabel=editTarget==='anna'?'PRESENCE':editTarget.toUpperCase();const items=[['AUTO',auto?'ON':'OFF'],['AI','CHOOSE'],['FASTER','PACE +'],['SLOWER','PACE −'],['DEEPER','DEPTH +'],['EASE','ENERGY −'],['VIEW',editLabel],['EXIT','LEAVE VR']];
  const top=290,tw=258,th=132,gap=18;
  items.forEach((it,i)=>{const col=i%4,row=Math.floor(i/4),x=56+col*(tw+gap),y=top+row*(th+gap),hot=hovered===i,active=(i===0&&auto)||(i===6);c.fillStyle=hot?'rgba(112,66,148,.98)':active?'rgba(62,42,78,.98)':'rgba(30,20,40,.96)';rounded(c,x,y,tw,th,22);c.fill();c.strokeStyle=hot?'rgba(230,193,255,1)':active?'rgba(162,112,205,.95)':'rgba(78,56,92,.8)';c.lineWidth=hot?5:2;rounded(c,x,y,tw,th,22);c.stroke();c.fillStyle='#fff';c.font='800 25px system-ui';c.fillText(it[0],x+22,y+48);c.fillStyle='#ac98ba';c.font='20px system-ui';c.fillText(it[1],x+22,y+86)});
  c.fillStyle='#d3c2de';c.font='20px system-ui';c.fillText(actionLine,56,670);
  c.fillStyle='#746481';c.font='18px system-ui';c.fillText('Grip + aim moves '+(editTarget==='anna'?'PRESENCE':editTarget.toUpperCase())+' · while gripping, thumbstick X rotates / Y scales',56,711);
  c.fillText(controllerSummary(),56,751);
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
function updateAnnaTexture(t){
  if(!annaTex||!annaCanvas||!annaCtx)return false;if(t-annaLastUpload<66&&annaTexReady)return true;annaLastUpload=t;
  try{
    const vw=annaVideo?.videoWidth||120,vh=annaVideo?.videoHeight||213,srcRatio=vw/vh,dstRatio=annaCanvas.width/annaCanvas.height;let sx=0,sy=0,sw=vw,sh=vh;
    annaCtx.fillStyle='#08040d';annaCtx.fillRect(0,0,annaCanvas.width,annaCanvas.height);
    if(annaPosterReady)annaCtx.drawImage(annaPoster,0,0,annaCanvas.width,annaCanvas.height);
    if(annaVideoReady&&annaVideo?.readyState>=2){if(srcRatio>dstRatio){sw=vh*dstRatio;sx=(vw-sw)/2}else{sh=vw/dstRatio;sy=(vh-sh)/2}annaCtx.drawImage(annaVideo,sx,sy,sw,sh,0,0,annaCanvas.width,annaCanvas.height)}
    gl.bindTexture(gl.TEXTURE_2D,annaTex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    if(!annaTexReady||annaTexW!==annaCanvas.width||annaTexH!==annaCanvas.height){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,annaCanvas);annaTexW=annaCanvas.width;annaTexH=annaCanvas.height;annaTexReady=true}
    else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,gl.RGBA,gl.UNSIGNED_BYTE,annaCanvas);
    return true;
  }catch(e){annaVideoError='texture';return false}
}
function annaPlaneGeometry(){
  const h=.78*annaPose.scale,ratio=(annaCanvas?.width&&annaCanvas?.height)?annaCanvas.width/annaCanvas.height:.5625,w=h*ratio,x=annaPose.x,y=floorY()+annaPose.y,z=annaPose.z,a=annaPose.yaw,ca=Math.cos(a),sa=Math.sin(a),rx=ca*w,rz=sa*w;
  const corners=[[x-rx,y-h,z-rz],[x+rx,y-h,z+rz],[x+rx,y+h,z+rz],[x-rx,y+h,z-rz]],frame=[];for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4];frame.push(...a,...b)}
  return{h,w,x,y,z,rx,rz,corners,frame};
}
function renderEmbodiedPresence(mvp,t){
  if(!annaTexReady)return;const g=annaPlaneGeometry(),x=g.x,y=g.y,z=g.z,h=g.h,rx=g.rx,rz=g.rz;
  const verts=new Float32Array([x-rx,y-h,z-rz,0,1,x+rx,y-h,z+rz,1,1,x-rx,y+h,z-rz,0,0,x-rx,y+h,z-rz,0,0,x+rx,y-h,z+rz,1,1,x+rx,y+h,z+rz,1,0]);
  gl.useProgram(uiProgram);gl.bindBuffer(gl.ARRAY_BUFFER,uiBuf);gl.bufferData(gl.ARRAY_BUFFER,verts,gl.DYNAMIC_DRAW);const p=gl.getAttribLocation(uiProgram,'p'),uv=gl.getAttribLocation(uiProgram,'uv');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,3,gl.FLOAT,false,20,0);gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,20,12);gl.uniformMatrix4fv(gl.getUniformLocation(uiProgram,'m'),false,mvp);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,annaTex);gl.uniform1i(gl.getUniformLocation(uiProgram,'t'),0);gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,6);gl.disable(gl.BLEND);gl.enable(gl.DEPTH_TEST);
}
function pulseSource(src,strength=.45,duration=75){const gp=src?.gamepad,acts=[];if(!gp)return;try{if(gp.vibrationActuator)acts.push(gp.vibrationActuator);for(const a of gp.hapticActuators||[])acts.push(a)}catch{}for(const a of acts){try{if(a.pulse)a.pulse(clamp(strength),duration);else if(a.playEffect)a.playEffect('dual-rumble',{duration,strongMagnitude:clamp(strength),weakMagnitude:clamp(strength*.6)})}catch{}}}
function dispatchVrAction(action){window.dispatchEvent(new CustomEvent('nocturne:vr-ui-action',{detail:{action}}))}
function selectTile(i,src){
  if(i===0)dispatchVrAction('toggle-auto');
  else if(i===1)dispatchVrAction('ai-choose');
  else if(i===2)dispatchVrAction('faster');
  else if(i===3)dispatchVrAction('slower');
  else if(i===4)dispatchVrAction('deeper');
  else if(i===5)dispatchVrAction('ease');
  else if(i===6){editTarget=editTarget==='anna'?'tool':editTarget==='tool'?'panel':'anna';actionLine='Editing '+editTarget.toUpperCase()+' · grip + aim to move';lastMenu=0}
  else if(i===7){actionLine='Leaving immersive VR…';try{session?.end()}catch{}}
  pulseSource(src);lastMenu=0;
}
function controllerInteraction(frame){
  hovered=-1;const rays=[];if(!session||!refSpace)return rays;let nearest=Infinity,chosen=null;
  for(const src of session.inputSources){if(!src.gamepad)continue;const pose=frame.getPose(src.targetRaySpace,refSpace);if(!pose)continue;const m=pose.transform.matrix,o=[m[12],m[13],m[14]],d=[-m[8],-m[9],-m[10]],den=d[2],tr=src.gamepad.buttons?.[0]?.value||0,gr=src.gamepad.buttons?.[1]?.value||0,ax=src.gamepad.axes?.[2]??src.gamepad.axes?.[0]??0,ay=src.gamepad.axes?.[3]??src.gamepad.axes?.[1]??0;
    if(gr>.72&&tr<.45){
      const dd=2.25,px=o[0]+d[0]*dd,py=o[1]+d[1]*dd,pz=o[2]+d[2]*dd;
      if(editTarget==='panel'){panelOffset.x=Math.max(-1.8,Math.min(1.8,px-basePanelX()));panelOffset.y=Math.max(-1.1,Math.min(1.1,py-basePanelY()));panelOffset.z=Math.max(-1.4,Math.min(.8,pz-PANEL_Z))}
      else if(editTarget==='anna'){annaPose.x=Math.max(-2.2,Math.min(2.2,px));annaPose.y=Math.max(.55,Math.min(2.6,py-floorY()));annaPose.z=Math.max(-4.5,Math.min(-.7,pz));annaPose.yaw=Math.max(-1.2,Math.min(1.2,annaPose.yaw+ax*.018));annaPose.scale=Math.max(.45,Math.min(1.8,annaPose.scale-ay*.012))}
      else {toolPose.x=Math.max(-2,Math.min(2,px));toolPose.y=Math.max(-1,Math.min(1.6,py-(floorY()+1.15)));toolPose.z=Math.max(-2.2,Math.min(1.2,pz+.62));toolPose.yaw=Math.max(-1.2,Math.min(1.2,toolPose.yaw+ax*.018));toolPose.scale=Math.max(.55,Math.min(1.8,toolPose.scale-ay*.012))}
      actionLine='Moving '+(editTarget==='anna'?'PRESENCE':editTarget.toUpperCase())+' · stick X rotate · Y scale';lastMenu=0;
    }
    let end=[o[0]+d[0]*3,o[1]+d[1]*3,o[2]+d[2]*3],idx=-1,dist=3;
    if(Math.abs(den)>.0001){const tt=(panelZ()-o[2])/den;if(tt>0&&tt<6){const hx=o[0]+d[0]*tt,hy=o[1]+d[1]*tt,lx=(hx-panelX())/PANEL_W+.5,ly=.5-(hy-panelY())/PANEL_H;if(lx>=0&&lx<=1&&ly>=0&&ly<=1){end=[hx,hy,panelZ()+.008];dist=tt;if(ly>=.34&&ly<=.79){const col=Math.max(0,Math.min(3,Math.floor(lx*4))),row=ly<.565?0:1;idx=row*4+col;if(dist<nearest){nearest=dist;chosen=idx}}}}}
    rays.push(o[0],o[1],o[2],end[0],end[1],end[2]);const was=triggerDown.get(src)||false,down=tr>.62;if(down&&!was&&idx>=0)selectTile(idx,src);triggerDown.set(src,down);
  }
  hovered=chosen??-1;return rays;
}

function drawControllerOverlay(mvp,rays){if(!rays.length)return;const tips=[];for(let i=0;i<rays.length;i+=6)tips.push(rays[i+3],rays[i+4],rays[i+5]);gl.disable(gl.DEPTH_TEST);drawWorld(mvp,rays,[.96,.82,1,1],gl.LINES,3);drawWorld(mvp,tips,[1,.96,1,1],gl.POINTS,11);gl.enable(gl.DEPTH_TEST)}
async function enterFallback(e){
  if(e){e.preventDefault();e.stopImmediatePropagation()}if(session){set('diag-line','Immersive session is already active.');return}
  const cfg=loadTelemetry();if(!cfg.initialized){set('diag-line','Initialize Entry Speed, Depth and Stroke Speed before entering VR.');try{$('vr-session-dialog')?.showModal()}catch{}return}
  const enter=$('enter');if(enter){enter.disabled=true;enter.textContent='OPENING VR…'}
  try{
    const test=await run();if(!test.immersive)throw Error('Quest reports immersive-vr unsupported');
    const canvas=$('xr-canvas');gl=canvas.getContext('webgl',{xrCompatible:true,alpha:false,antialias:true});if(!gl)throw Error('WebGL context unavailable');if(gl.makeXRCompatible)await gl.makeXRCompatible();initGL();
    const root=$('xr-overlay');try{session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor','hand-tracking','dom-overlay'],domOverlay:{root}})}catch{session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor','hand-tracking']})}
    layer=new XRWebGLLayer(session,gl);session.updateRenderState({baseLayer:layer,depthNear:.04,depthFar:60});
    try{refSpace=await session.requestReferenceSpace('local-floor');refMode='local-floor'}catch{refSpace=await session.requestReferenceSpace('local');refMode='local'}
    session.addEventListener('end',()=>{session=null;layer=null;refSpace=null;hovered=-1;triggerDown.clear();window.dispatchEvent(new CustomEvent('nocturne:vr-session',{detail:{active:false}}));set('xr-status','VR READY');set('diag-line','Immersive session ended normally.');if(enter){enter.disabled=false;enter.textContent='ENTER IMMERSIVE VR'}const exit=$('exit');if(exit)exit.disabled=true},{once:true});
    sceneMode='live';panelOffset={x:0,y:0,z:0};actionLine='Live workspace · waveform + geometry + Anna + AI controls.';lastMenu=0;if(annaVideo&&!annaVideo.paused){try{annaVideo.play()}catch{}}window.dispatchEvent(new CustomEvent('nocturne:vr-session',{detail:{active:true,mode:sceneMode}}));set('xr-status','IMMERSIVE VR');set('diag-line','Nocturne '+sceneMode+' field active.');const exit=$('exit');if(exit)exit.disabled=false;
    const frame=(t,f)=>{if(!session)return;const motion=motionState();syncMotionRuntime(t,motion);updateAnnaTexture(t);const pose=f.getViewerPose(refSpace),rays=controllerInteraction(f);gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(.006,.004,.014,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(pose)for(const view of pose.views){const vp=layer.getViewport(view);gl.viewport(vp.x,vp.y,vp.width,vp.height);gl.scissor(vp.x,vp.y,vp.width,vp.height);gl.enable(gl.SCISSOR_TEST);gl.clearColor(.006,.004,.014,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);drawScene(f,view,t,rays,motion);const mvp=mul4(view.projectionMatrix,view.transform.inverse.matrix);renderMenu(mvp,t);drawControllerOverlay(mvp,rays);gl.disable(gl.SCISSOR_TEST)}session.requestAnimationFrame(frame)};session.requestAnimationFrame(frame);
  }catch(err){set('diag-line','Direct VR start failed: '+String(err&&err.message||err).slice(0,140));set('xr-status','VR START FAILED');if(enter){enter.disabled=false;enter.textContent='ENTER IMMERSIVE VR'}session=null}
}
async function testControllers(e){
  if(e){e.preventDefault();e.stopImmediatePropagation()}if(!session){set('diag-line','Controller Test needs an active immersive session. Enter VR first.');return}
  const sources=[...session.inputSources].filter(s=>s.gamepad);if(!sources.length){set('diag-line','Immersive VR is active, but Quest has not exposed controller gamepads yet. Move or click a controller and try again.');return}
  let pulses=0;for(const s of sources){const gp=s.gamepad,acts=[];if(gp.vibrationActuator)acts.push(gp.vibrationActuator);for(const a of gp.hapticActuators||[])acts.push(a);for(const a of acts){try{if(a.pulse){await a.pulse(.8,180);pulses++}else if(a.playEffect){await a.playEffect('dual-rumble',{duration:180,strongMagnitude:.8,weakMagnitude:.5});pulses++}}catch{}}}
  set('diag-line',pulses?'Controller test sent '+pulses+' haptic pulse'+(pulses===1?'':'s')+'.':'Controllers are visible, but no haptic actuator is exposed.');
}
window.nocturneVrSelfTest=run;
document.addEventListener('DOMContentLoaded',()=>{$('diag-run')?.addEventListener('click',run);setTimeout(run,0);const enter=$('enter');if(enter)enter.addEventListener('click',enterFallback,{capture:true});const setup=$('session-setup');if(setup)setup.addEventListener('click',()=>{try{$('vr-session-dialog')?.showModal()}catch{}},{capture:true});const form=$('vr-session-form');if(form)form.addEventListener('submit',e=>{if(e.submitter?.value==='cancel')return;if(!form.reportValidity()){e.preventDefault();return}e.preventDefault();e.stopImmediatePropagation();commitFallbackVrSession();try{$('vr-session-dialog')?.close()}catch{}enterFallback()},{capture:true});const test=$('test');if(test)test.addEventListener('click',testControllers,{capture:true});const exit=$('exit');if(exit)exit.addEventListener('click',async e=>{if(session){e.preventDefault();e.stopImmediatePropagation();try{await session.end()}catch{}}},{capture:true})});
window.addEventListener('nocturne:embodied-state',e=>{embodiedState=String(e.detail?.state||'attentive');lastMenu=0});window.addEventListener('nocturne:vr-ai-status',e=>{aiStatus=String(e.detail?.text||'AI READY').slice(0,38);lastMenu=0});window.addEventListener('nocturne:vr-reset-view',()=>resetSpatialView());window.addEventListener('storage',e=>{if(e.key===EMBODIED_STATE_KEY&&e.newValue){embodiedState=e.newValue;lastMenu=0}});
window.addEventListener('error',e=>set('diag-line','VR script error: '+String(e.message||'unknown').slice(0,120)));
window.addEventListener('unhandledrejection',e=>set('diag-line','VR promise error: '+String(e.reason&&e.reason.message||e.reason||'unknown').slice(0,120)));
})();