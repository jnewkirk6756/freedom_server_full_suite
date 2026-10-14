import {capabilities,multiply,transform,perspective,panel,panelHit,roomSurfaces,validateRoom,roomGltf} from './scene.mjs';
import {createMeasurement,createSurfaceSampler,questPanelButtons,questPanelAction,inverseRigid,distanceMetres,MEASUREMENT_WARNING} from './quest-measurement.mjs';
import {drawQuestButton} from './quest-feedback.mjs';
export {capabilities,roomGltf};
/** No network, storage, raw-camera, provider, or generation operations. Caller owns project validation. */
export function createQuestWorkspace({canvas,onStatus=()=>{},onSnapshot=()=>{},onSessionChange=()=>{},room=null,referenceImage=null,feedback=null}={}){
 if(!canvas)throw Error('A canvas is required.');
 room=validateRoom(room);
 const gl=canvas.getContext('webgl',{alpha:true,antialias:true,preserveDrawingBuffer:false});
 if(!gl)throw Error('WebGL is unavailable.');
 let pendingSession=null,session=null,space=null,starting=false,disposed=false,raf=0,showShell=false,lastView=null,snapshotRequested=false,snapshotBusy=false,ref=referenceImage;
 let page='workspace',xrMode=null,previewSample=null,measurementRevision=-1,labelText='',trackingReady=false,firstFrame=true,lastPanelUpdate=0,snapshotEpoch=0,hoveredAction=null,pressedAction=null,pressedUntil=0;
 const workspaceId=globalThis.crypto?.randomUUID?.()||String(Date.now())+'-'+Math.random().toString(36).slice(2);
 const measurement=createMeasurement(),sampler=createSurfaceSampler(),samples=new Map();
 let panelPose=transform([panel.x,panel.y,panel.z]),headPose=transform([0,1.55,0]);
 function hitPanel(matrix){return panelHit(multiply(inverseRigid(panelPose),matrix),{...panel,x:0,y:0,z:0});}
 function recenter(notify=true){const h=headPose;let fx=-h[8],fz=-h[10];const n=Math.hypot(fx,fz);if(n<.01){fx=0;fz=-1;}else{fx/=n;fz/=n;}panelPose=new Float32Array([-fz,0,fx,0,0,1,0,0,-fx,0,-fz,0,h[12]+fx*1.7,h[13],h[14]+fz*1.7,1]);if(notify)onStatus('Workspace recentered. Physical world and shell position were not moved.');}
 let surfaces=roomSurfaces(room),surfaceBuffers=[];
 function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
 const program=gl.createProgram();const shaders=[shader(gl.VERTEX_SHADER,'attribute vec3 p; attribute vec2 uv; uniform mat4 mvp; varying vec2 v; void main(){ v=uv; gl_Position=mvp*vec4(p,1.0); }'),shader(gl.FRAGMENT_SHADER,'precision mediump float; uniform vec4 color; uniform sampler2D tex; uniform bool textured; varying vec2 v; void main(){gl_FragColor=textured ? texture2D(tex,v) : color;}')];
 for(const s of shaders)gl.attachShader(program,s);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
 const loc={p:gl.getAttribLocation(program,'p'),uv:gl.getAttribLocation(program,'uv'),mvp:gl.getUniformLocation(program,'mvp'),color:gl.getUniformLocation(program,'color'),tex:gl.getUniformLocation(program,'tex'),textured:gl.getUniformLocation(program,'textured')};
 const buffer=data=>{const b=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);return b;};
 const plane=buffer(new Float32Array([-.5,-.5,0,.5,-.5,0,.5,.5,0,-.5,-.5,0,.5,.5,0,-.5,.5,0]));
 const uv=buffer(new Float32Array([0,1,1,1,1,0,0,1,1,0,0,0]));const rays=gl.createBuffer();
 const measureBuffer=gl.createBuffer(),labelTexture=gl.createTexture(),labelCanvas=document.createElement('canvas');labelCanvas.width=960;labelCanvas.height=220;const labelCtx=labelCanvas.getContext('2d');
 const texture=gl.createTexture(),panelCanvas=document.createElement('canvas');panelCanvas.width=1120;panelCanvas.height=704;const ctx=panelCanvas.getContext('2d');
 function uploadTexture(target,source){gl.bindTexture(gl.TEXTURE_2D,target);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,source);}
 function uploadPanel(){
  const state=measurement.getState(),canMeasure=xrMode==='immersive-ar';measurementRevision=state.revision;
  ctx.fillStyle='#091a26';ctx.fillRect(0,0,1120,704);ctx.strokeStyle='#52eed4';ctx.lineWidth=3;ctx.strokeRect(2,2,1116,700);
  ctx.fillStyle='#79f8dd';ctx.font='600 27px system-ui';ctx.fillText('MERIDIAN RENDER',45,53);ctx.fillStyle='#adc8d4';ctx.font='20px system-ui';ctx.fillText('LOCAL  /  '+(xrMode==='immersive-ar'?'PASSTHROUGH AR':xrMode==='immersive-vr'?'VR WORKSPACE':'HEADSET PREVIEW'),680,53);
  const audio=feedback?.getState();
  const labels={sound:audio?.muted?'Sound off':'Sound on',haptics:audio?.hapticsEnabled?'Haptics on':'Haptics off',workspace:'Workspace',measure:'Measure',tools:'Tools & area',snap:'Endpoint snap '+(state.snapEnabled?'on':'off'),undo:'Undo last point','use-length':'Mark as length','use-width':'Mark as width','compute-area':'Confirm rectangle & compute',surface:'Aim at a surface',controller:'Controller position',scene:'Shell '+(showShell?'on':'off'),snapshot:'Snapshot',exit:'Exit XR','adjust-a':'Adjust A','adjust-b':'Adjust B',reset:'Reset points'};
  for(const b of questPanelButtons){if(b.page&&b.page!==page)continue;const active=b.action===page||b.action===state.mode||b.action==='sound'&&audio&&!audio.muted||b.action==='haptics'&&audio?.hapticsEnabled||b.action==='snap'&&state.snapEnabled||b.action==='adjust-a'&&state.selected===0||b.action==='adjust-b'&&state.selected===1;
   const disabled=(b.action==='adjust-a'&&!state.points[0])||(b.action==='adjust-b'&&!state.points[1])||(b.action==='compute-area'&&state.area.perpendicular!==true)||(b.action==='undo'&&!state.hasUndo)||(['sound','haptics'].includes(b.action)&&!feedback);
   drawQuestButton(ctx,{x:b.u*1120,y:b.v*704,width:b.w*1120,height:b.h*704,label:labels[b.action],selected:active,hovered:b.action===hoveredAction,pressed:b.action===pressedAction,disabled,tone:b.action==='exit'?'danger':'default'});
  }
  if(page==='measure'){
   ctx.fillStyle='#a6c4ce';ctx.font='22px system-ui';ctx.fillText(!canMeasure?'Enter passthrough AR to measure.':state.reason,45,269);
   ctx.fillStyle='#7affdc';ctx.font='600 51px system-ui';ctx.fillText(state.metres===null?(state.points.some(p=>p&&!p.tracked)?'Tracking paused':state.selected===1?'Point A set':'Two-point measure'):'≈ '+state.imperial,45,337);
   ctx.fillStyle='#ecf9ff';ctx.font='30px system-ui';ctx.fillText(state.metres===null?'Set A, then B with the trigger.':state.metric+'  ·  approximate',45,382);
   ctx.fillStyle='#a6c4ce';ctx.font='21px system-ui';ctx.fillText(state.mode==='surface'?'No surface dot? Choose Controller position explicitly.':'The dot is the tracked controller origin, not its tip.',45,424);
  }else if(page==='tools'){
   ctx.font='18px system-ui';ctx.fillStyle='#adc8d4';ctx.fillText('Snap: marked endpoints within 2.5 cm.',45,267);
   const l=state.area.length,w=state.area.width;ctx.fillText('Length: '+(l===null?'not marked':l.toFixed(2)+' m')+'     Width: '+(w===null?'not marked':w.toFixed(2)+' m'),45,384);
   ctx.fillStyle='#7affdc';ctx.font='500 35px system-ui';ctx.fillText(state.area.squareMetres===null?(state.area.perpendicular===false?'Sides are not perpendicular. Remeasure.':'Measure both perpendicular sides first.'):'≈ '+state.area.squareFeet.toFixed(1)+' sq ft  /  '+state.area.squareMetres.toFixed(2)+' m²',45,426);
   ctx.font='18px system-ui';ctx.fillStyle='#efca86';ctx.fillText('Rectangle only. Confirm sides are perpendicular. No room-shape inference.',45,520);
  }else{
   ctx.font='22px system-ui';ctx.fillStyle='#adc8d4';ctx.fillText(room?'Approved dimensions · optional unaligned rectangular shell':'No approved room dimensions loaded',45,191);
   if(ref){const w=ref.width||ref.naturalWidth,h=ref.height||ref.naturalHeight;if(w>0&&h>0){const scale=Math.min(920/w,235/h);ctx.drawImage(ref,(1120-w*scale)/2,221,w*scale,h*scale);}ctx.fillStyle='#bcebe8';ctx.fillText('2D reference · no 3D reconstruction',45,501);}
   else{ctx.fillText('Keep your design beside you. Measure without leaving AR.',45,295);ctx.fillText('Measurements are local to this session and never update your plan.',45,339);ctx.fillText('Snapshots capture virtual content only.',45,403);}
  }
  ctx.font='18px system-ui';ctx.fillStyle='#f0cd88';ctx.fillText('Stay stationary, keep a clear space. Verify measurements with a tape or laser.',45,652);
  ctx.fillStyle='#adc8d4';ctx.fillText('Grip: recenter panel only. Measurements are approximate, never final cut sizes.',45,683);
  uploadTexture(texture,panelCanvas);
 }
 function measurementChanged(force=true){const now=performance.now(),state=measurement.getState();if(state.revision!==measurementRevision&&(force||now-lastPanelUpdate>120)){uploadPanel();lastPanelUpdate=now;}}
 function clearMeasurement(message){samples.clear();previewSample=null;measurement.reset(message);if(!disposed)measurementChanged();}
 function referenceReset(){snapshotEpoch++;snapshotRequested=false;trackingReady=false;firstFrame=true;clearMeasurement('Tracking origin changed. Remeasure both points.');onStatus('Tracking origin changed. Measurement cleared; verify physical alignment again.');}
 function visibilityChanged(){if(session?.visibilityState!=='visible'){feedback?.suspend();trackingReady=false;clearMeasurement('Tracking interrupted. Remeasure both points.');}}
 function meshVertices(vertices,pv,color){gl.bindBuffer(gl.ARRAY_BUFFER,measureBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);draw(measureBuffer,vertices.length/3,pv,color);}
 function marker(position,pv,color,radius=.016){const vertices=[],axes=[[radius,0,0],[-radius,0,0],[0,radius,0],[0,-radius,0],[0,0,radius],[0,0,-radius]];for(const triangle of [[2,0,4],[2,4,1],[2,1,5],[2,5,0],[3,4,0],[3,1,4],[3,5,1],[3,0,5]])for(const index of triangle)vertices.push(...axes[index].map((v,i)=>v+position[i]));meshVertices(vertices,pv,color);}
 function segment(a,b,pv){const distance=distanceMetres(a,b);if(!distance||distance<.001)return;const d=a.map((v,i)=>(b[i]-v)/distance),axis=Math.abs(d[1])<.9?[0,1,0]:[1,0,0],u=[d[1]*axis[2]-d[2]*axis[1],d[2]*axis[0]-d[0]*axis[2],d[0]*axis[1]-d[1]*axis[0]],len=Math.hypot(...u);for(let i=0;i<3;i++)u[i]/=len;const v=[d[1]*u[2]-d[2]*u[1],d[2]*u[0]-d[0]*u[2],d[0]*u[1]-d[1]*u[0]],vertices=[];
  const ring=(point,angle)=>point.map((n,i)=>n+.004*(Math.cos(angle)*u[i]+Math.sin(angle)*v[i]));for(let i=0;i<8;i++){const t=i*Math.PI/4,next=(i+1)*Math.PI/4,a0=ring(a,t),a1=ring(a,next),b0=ring(b,t),b1=ring(b,next);vertices.push(...a0,...b0,...a1,...a1,...b0,...b1);}meshVertices(vertices,pv,[.12,1,.7,1]);
 }
 function drawMeasurement(pv){if(!['measure','tools'].includes(page)||xrMode!=='immersive-ar'||!trackingReady)return;const state=measurement.getState(),points=state.points;
  if(points[0]?.tracked&&points[1]?.tracked)segment(points[0].position,points[1].position,pv);
  for(let i=0;i<2;i++)if(points[i]?.tracked)marker(points[i].position,pv,i?[.89,.4,1,1]:[.1,1,.73,1]);
  if(previewSample&&state.selected!==null){marker(previewSample.position,pv,[1,.85,.35,1],.012);const other=points[state.selected?0:1];if(other?.tracked)segment(other.position,previewSample.position,pv);}
  if(state.metres===null)return;
  const text=state.imperial+'|'+state.metric;if(labelText!==text){labelText=text;labelCtx.fillStyle='#081c27';labelCtx.fillRect(0,0,960,220);labelCtx.strokeStyle='#50ffce';labelCtx.lineWidth=6;labelCtx.strokeRect(3,3,954,214);labelCtx.fillStyle='#91ffe0';labelCtx.font='600 66px system-ui';labelCtx.fillText('≈ '+state.imperial,30,84);labelCtx.fillStyle='#efffff';labelCtx.font='40px system-ui';labelCtx.fillText(state.metric+' · approximate',30,142);labelCtx.fillStyle='#efca86';labelCtx.font='25px system-ui';labelCtx.fillText('VERIFY WITH TAPE / LASER · NOT A CUT SIZE',30,188);uploadTexture(labelTexture,labelCanvas);}
  const midpoint=points[0].position.map((v,i)=>(v+points[1].position[i])/2);midpoint[1]+=.13;const pose=new Float32Array(headPose);pose[12]=midpoint[0];pose[13]=midpoint[1];pose[14]=midpoint[2];const size=Math.max(.36,Math.min(.9,distanceMetres(midpoint,[headPose[12],headPose[13],headPose[14]])*.3));gl.bindTexture(gl.TEXTURE_2D,labelTexture);draw(plane,6,multiply(pv,multiply(pose,transform([0,0,0],[size,size*220/960,1]))),[1,1,1,1],true);gl.bindTexture(gl.TEXTURE_2D,texture);
 }

 function loadSurfaces(){for(const b of surfaceBuffers)gl.deleteBuffer(b);surfaceBuffers=surfaces.map(s=>buffer(s.positions));}
 loadSurfaces();uploadPanel();
 function draw(b,count,mvp,color=[1,1,1,1],textured=false,mode=gl.TRIANGLES){gl.bindBuffer(gl.ARRAY_BUFFER,b);gl.vertexAttribPointer(loc.p,3,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(loc.p);gl.bindBuffer(gl.ARRAY_BUFFER,uv);gl.vertexAttribPointer(loc.uv,2,gl.FLOAT,false,0,0);if(textured)gl.enableVertexAttribArray(loc.uv);else{gl.disableVertexAttribArray(loc.uv);gl.vertexAttrib2f(loc.uv,0,0);}gl.uniformMatrix4fv(loc.mvp,false,mvp);gl.uniform4fv(loc.color,color);gl.uniform1i(loc.textured,textured);gl.drawArrays(mode,0,count);}
 function render(projection,view,controllerMatrices=[],ar=false){
  gl.useProgram(program);gl.enable(gl.DEPTH_TEST);gl.disable(gl.CULL_FACE);gl.disable(gl.BLEND);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,texture);gl.uniform1i(loc.tex,0);
  const pv=multiply(projection,view);
  if(showShell)surfaces.forEach((s,i)=>draw(surfaceBuffers[i],6,pv,s.color));
  drawMeasurement(pv);
  gl.disable(gl.DEPTH_TEST); // Keep controls accessible even behind an uncut shell wall.
  draw(plane,6,multiply(pv,multiply(panelPose,transform([0,0,0],[panel.width,panel.height,1]))),[1,1,1,1],true);
  for(const m of controllerMatrices){const hit=hitPanel(m),length=hit?.t||3;const vertices=new Float32Array([m[12],m[13],m[14],m[12]-m[8]*length,m[13]-m[9]*length,m[14]-m[10]*length]);gl.bindBuffer(gl.ARRAY_BUFFER,rays);gl.bufferData(gl.ARRAY_BUFFER,vertices,gl.DYNAMIC_DRAW);draw(rays,2,pv,hit?[.85,.3,1,1]:[.15,1,.9,1],false,gl.LINES);}
 }
 function preview(){if(disposed)return;if(!session){const dpr=Math.min(devicePixelRatio||1,2),w=Math.round(canvas.clientWidth*dpr),h=Math.round(canvas.clientHeight*dpr);if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}gl.bindFramebuffer(gl.FRAMEBUFFER,null);gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(.035,.065,.10,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const p=perspective(canvas.width/canvas.height),v=transform([0,-1.55,-.2]);render(p,v);lastView={projection:p,view:v};if(snapshotRequested)capture();}raf=requestAnimationFrame(preview);}
 function onFrame(time,frame){
  if(!session||frame.session!==session||disposed)return;session.requestAnimationFrame(onFrame);
  const layer=session.renderState.baseLayer;gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(0,0,0,session.environmentBlendMode==='opaque'?1:0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
  const pose=frame.getViewerPose(space);if(!pose||pose.emulatedPosition||session.visibilityState&&session.visibilityState!=='visible'){if(trackingReady)clearMeasurement('Tracking interrupted. Remeasure both points.');trackingReady=false;return;}
  trackingReady=true;headPose=new Float32Array(pose.transform.matrix);if(firstFrame){recenter(false);firstFrame=false;}const controllers=[];let hover=null;samples.clear();previewSample=null;
  if(xrMode==='immersive-ar')sampler.sync(session.inputSources);
  measurement.updatePlanes(plane=>{if(!frame.detectedPlanes?.has(plane))return null;const p=frame.getPose(plane.planeSpace,space);return p&&!p.emulatedPosition?p.transform.matrix:null;});
  for(const input of session.inputSources){const p=frame.getPose(input.targetRaySpace,space);if(!p)continue;controllers.push(p.transform.matrix);const target=questPanelAction(hitPanel(p.transform.matrix),page);if(target&&(!hover||input.handedness==='right'))hover=target;
   if(page==='measure'&&xrMode==='immersive-ar'&&!hitPanel(p.transform.matrix)){const sample=sampler.sample(frame,input,space,measurement.getState().mode);if(sample){samples.set(input,{sample,time:performance.now()});if(!previewSample||input.handedness==='right')previewSample=measurement.preview(sample);}}
  }
  if(hover!==hoveredAction||pressedAction&&performance.now()>pressedUntil){hoveredAction=hover;if(performance.now()>pressedUntil)pressedAction=null;uploadPanel();}
  measurementChanged(false);
  for(const view of pose.views){const viewport=layer.getViewport(view);gl.viewport(viewport.x,viewport.y,viewport.width,viewport.height);render(view.projectionMatrix,view.transform.inverse.matrix,controllers);}
  // Snapshot uses a new virtual-only framebuffer and a mono head-centred view, not the compositor.
  lastView={projection:perspective(16/9),view:new Float32Array(pose.transform.inverse.matrix)};if(snapshotRequested)capture();
 }

 async function capture(){if(snapshotBusy||disposed)return;const capturedEpoch=snapshotEpoch;snapshotRequested=false;snapshotBusy=true;const width=1280,height=720,fbo=gl.createFramebuffer(),color=gl.createTexture(),depth=gl.createRenderbuffer();
  try{gl.bindTexture(gl.TEXTURE_2D,color);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,null);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.bindFramebuffer(gl.FRAMEBUFFER,fbo);gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,color,0);gl.bindRenderbuffer(gl.RENDERBUFFER,depth);gl.renderbufferStorage(gl.RENDERBUFFER,gl.DEPTH_COMPONENT16,width,height);gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,depth);if(gl.checkFramebufferStatus(gl.FRAMEBUFFER)!==gl.FRAMEBUFFER_COMPLETE)throw Error('Snapshot buffer is unavailable.');gl.viewport(0,0,width,height);gl.clearColor(.035,.065,.10,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);render(perspective(width/height),lastView?.view||transform([0,-1.55,0]));const pixels=new Uint8Array(width*height*4);gl.readPixels(0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const output=document.createElement('canvas');output.width=width;output.height=height;const c=output.getContext('2d'),img=c.createImageData(width,height);for(let y=0;y<height;y++)img.data.set(pixels.subarray((height-y-1)*width*4,(height-y)*width*4),y*width*4);c.putImageData(img,0,0);c.fillStyle='#081521';c.fillRect(0,height-42,width,42);c.fillStyle='#a6e7df';c.font='18px system-ui';c.fillText('MERIDIAN · VIRTUAL CONTENT ONLY · No passthrough imagery',22,height-15);const blob=await new Promise(resolve=>output.toBlob(resolve,'image/png'));if(!blob)throw Error('Could not encode snapshot.');if(disposed||capturedEpoch!==snapshotEpoch)return;onSnapshot(blob,{kind:'virtual-scene',includesPassthrough:false,createdAt:new Date().toISOString()});onStatus('Virtual snapshot ready. Exit XR to download it.');}
  catch(error){if(!disposed&&capturedEpoch===snapshotEpoch)onStatus('Snapshot failed: '+error.message);}finally{gl.deleteFramebuffer(fbo);gl.deleteTexture(color);gl.deleteRenderbuffer(depth);snapshotBusy=false;}
 }
 function select(event){
  if(!space||!trackingReady||disposed||event.frame.session!==session)return;void feedback?.activate({userInitiated:true});const p=event.frame.getPose(event.inputSource.targetRaySpace,space);if(!p||p.emulatedPosition)return;
  const hit=hitPanel(p.transform.matrix),action=questPanelAction(hit,page);
  if(hit){
   if(action){pressedAction=action;pressedUntil=performance.now()+140;feedback?.play('select',{inputSource:event.inputSource});}
   if(['workspace','measure','tools'].includes(action)){page=action;if(page==='measure')showShell=false;uploadPanel();}
   if(action==='surface'||action==='controller'){measurement.setMode(action);samples.clear();previewSample=null;uploadPanel();onStatus(action==='controller'?'Controller-position mode. Place the tracked controller origin at each safely reachable point; stay stationary.': 'Surface mode. Aim at a detected surface dot, then press trigger for A and B.');}
   if(action==='sound'&&feedback){feedback.setMuted(!feedback.getState().muted);uploadPanel();}
   if(action==='haptics'&&feedback){feedback.setHapticsEnabled(!feedback.getState().hapticsEnabled);uploadPanel();}
   if(action==='snap'){const enabled=measurement.toggleSnap();measurementChanged();onStatus(enabled?'Endpoint snap on: nearby marked endpoints only, within 2.5 cm. No inferred corners.':'Endpoint snap off.');}
   if(action==='undo'){if(!measurement.undo())onStatus('Nothing to undo.');measurementChanged();}
   if(action==='use-length'||action==='use-width'){if(measurement.saveDimension(action==='use-length'?'length':'width')){page='measure';uploadPanel();onStatus('Side marked locally. Measure the other perpendicular side; choose Tools & area to calculate.');}else onStatus('First complete a nonzero two-point measurement with both points tracked.');}
   if(action==='compute-area'){if(measurement.computeArea()){measurementChanged();onStatus('Approximate rectangular area computed from the two sides you chose. Confirm the sides are perpendicular and verify with a tape or laser. No plan dimensions changed.');}else onStatus(measurement.getState().area.perpendicular===false?'The marked sides are not close to perpendicular. Remeasure the two sides of a rectangle.':'Measure and mark both perpendicular sides before confirming a rectangular area.');}
   if(action==='reset'){samples.clear();previewSample=null;measurement.resetPoints();measurementChanged();onStatus('Measurement cleared. Place point A, then point B.');}
   if(action==='adjust-a'||action==='adjust-b'){if(measurement.select(action==='adjust-a'?0:1))measurementChanged();else onStatus('Place that point before adjusting it.');}
   if(action==='scene'){if(!room){onStatus('Confirm rectangular dimensions and height in Meridian before adding a shell.');return;}showShell=!showShell;uploadPanel();}
   if(action==='snapshot')snapshotRequested=true;if(action==='exit')void end();if(action&&!disposed)uploadPanel();return;
  }
  if(page!=='measure'||xrMode!=='immersive-ar')return;
  const state=measurement.getState();if(state.selected===null){onStatus('Both points are set. Select Adjust A, Adjust B, or Reset points on the panel.');return;}
  const cached=samples.get(event.inputSource),fresh=sampler.sample(event.frame,event.inputSource,space,state.mode);
  // Only native hit-test API restrictions on select frames allow a recent animation-frame hit.
  // Missing controller/plane tracking never falls back to cached positions.
  const sample=fresh||(state.mode==='surface'&&sampler.hitReadUnavailable()&&cached?.sample.kind==='hit'&&performance.now()-cached.time<75?cached.sample:null);
  if(!sample){feedback?.play('error',{inputSource:event.inputSource});onStatus(state.mode==='surface'?'No detected surface at this point. Aim at a visible surface dot or explicitly choose Controller position.':'Controller position is unavailable. Keep a tracked controller in view; do not reach or walk into obstacles.');return;}
  if(measurement.place(sample)){measurementChanged();const result=measurement.getState();feedback?.play(result.metres!==null?'complete':result.points.some(p=>p?.snapped)?'snap':'select',{inputSource:event.inputSource});onStatus(result.metres===null?'Point A set. Place point B. Stay stationary.':`Approximate ${result.imperial} / ${result.metric}. ${MEASUREMENT_WARNING} Approved plan dimensions were not changed.`);}
 }

 async function enter(mode){if(disposed||session||starting)return;if(!['immersive-vr','immersive-ar'].includes(mode))throw Error('Unsupported XR mode.');starting=true;let pending,floorApproximate=false;
  try{if(!isSecureContext||!navigator.xr)throw Error('Use a supported XR browser over HTTPS.');
   // Called directly inside a user click; no awaited work before requestSession.
   pending=await navigator.xr.requestSession(mode,{optionalFeatures:mode==='immersive-ar'?['local-floor','plane-detection','hit-test']:['local-floor']});pendingSession=pending;
   let ended=false;pending.addEventListener('end',()=>{ended=true;if(session===pending){space?.removeEventListener?.('reset',referenceReset);pending.removeEventListener('select',select);pending.removeEventListener('squeeze',recenter);pending.removeEventListener('visibilitychange',visibilityChanged);session=null;space=null;xrMode=null;trackingReady=false;snapshotEpoch++;snapshotRequested=false;sampler.reset();clearMeasurement('Session ended. Measurements cleared.');showShell=false;panelPose=transform([panel.x,panel.y,panel.z]);headPose=transform([0,1.55,0]);if(!disposed)uploadPanel();onSessionChange(false);onStatus('XR ended. Session measurements were cleared; your project was not changed.');}if(pendingSession===pending)pendingSession=null;},{once:true});
   const stopped=async()=>{if(!disposed&&!ended)return false;try{await pending.end();}catch{}return true;};
   if(await stopped())return;await gl.makeXRCompatible();if(await stopped())return;session=pending;
   try{space=await session.requestReferenceSpace('local-floor');}catch{floorApproximate=true;space=await session.requestReferenceSpace('local');onStatus('Floor tracking unavailable. Using local tracking with no assumed eye height; shell is not aligned to the physical room.');}
   if(await stopped())return;
   xrMode=mode;trackingReady=false;firstFrame=true;labelText='';snapshotEpoch++;page='workspace';measurement.setMode('surface');clearMeasurement();sampler.reset(mode==='immersive-ar'?session:null);space.addEventListener?.('reset',referenceReset);session.addEventListener('visibilitychange',visibilityChanged);panelPose=transform([panel.x,panel.y,panel.z]);headPose=transform([0,1.55,0]);
   session.updateRenderState({baseLayer:new XRWebGLLayer(session,gl,{alpha:true}),depthNear:.05,depthFar:1500});
   showShell=false;uploadPanel();session.addEventListener('select',select);session.addEventListener('squeeze',recenter);pendingSession=null;session.requestAnimationFrame(onFrame);onSessionChange(true);onStatus((mode==='immersive-ar'?'AR active. Open Measure for approximate two-point measurements. Stay stationary and verify with a tape or laser. Shell hidden; no physical-room alignment.':'VR active. Use your controller trigger; squeeze grip to recenter.')+(floorApproximate?' Floor tracking unavailable: local tracking only, no physical-room alignment.':''));
  }catch(error){if(pending){try{await pending.end();}catch{}}session=null;space=null;onSessionChange(false);onStatus('Could not enter XR: '+error.message);}finally{if(pendingSession===pending)pendingSession=null;starting=false;}
 }
 async function end(){feedback?.suspend();const target=session||pendingSession;if(target){try{await target.end();}catch(error){onStatus('Could not exit XR: '+error.message);}}}
 const contextLost=event=>{event.preventDefault();onStatus('Graphics context lost. Exit XR and reload this workspace.');end();};canvas.addEventListener('webglcontextlost',contextLost);raf=requestAnimationFrame(preview);
 return {enter,end,recenter,getMeasurement:()=>({...measurement.getState(),sessionToken:workspaceId+'_'+snapshotEpoch,sessionActive:Boolean(session)}),requestSnapshot:()=>{if(!disposed&&!snapshotBusy)snapshotRequested=true;},setRoom(value){room=validateRoom(value);surfaces=roomSurfaces(room);clearMeasurement('Room changed. Remeasure both points.');showShell=false;loadSurfaces();uploadPanel();},setReferenceImage(image){ref=image;uploadPanel();},exportRoom:()=>roomGltf(room),async dispose(){if(disposed)return;disposed=true;snapshotEpoch++;snapshotRequested=false;cancelAnimationFrame(raf);await end();canvas.removeEventListener('webglcontextlost',contextLost);sampler.reset();for(const b of [plane,uv,rays,measureBuffer,...surfaceBuffers])gl.deleteBuffer(b);gl.deleteTexture(texture);gl.deleteTexture(labelTexture);for(const s of shaders)gl.deleteShader(s);gl.deleteProgram(program);}};
}
