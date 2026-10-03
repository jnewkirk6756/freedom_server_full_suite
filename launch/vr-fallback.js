(function(){
const $=id=>document.getElementById(id),set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
let session=null,gl=null,layer=null,refSpace=null,program=null,buf=null,tex=null,menuCanvas=null,menuCtx=null,lastMenu=0;
async function run(){
  set('diag-secure',window.isSecureContext?'YES':'NO');
  set('diag-xr',navigator.xr?'YES':'NO');
  let glok=false;try{const c=document.createElement('canvas');glok=!!c.getContext('webgl')}catch{}
  set('diag-gl',glok?'YES':'NO');
  let immersive=false,err='';
  if(navigator.xr){try{immersive=await navigator.xr.isSessionSupported('immersive-vr')}catch(e){err=String(e&&e.message||e)}}
  set('diag-immersive',immersive?'YES':'NO');
  set('diag-line',[
    window.isSecureContext?'HTTPS secure':'HTTPS not secure',
    navigator.xr?'WebXR exposed':'WebXR missing',
    immersive?'immersive-vr supported':'immersive-vr not supported',
    glok?'WebGL ready':'WebGL missing'
  ].join(' · ')+(err?' · '+err.slice(0,90):''));
  return {immersive};
}
function shader(type,src){const s=gl.createShader(type);gl.shaderSource(s,src);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s)||'shader');return s}
function initMenuGL(){
  if(program)return;
  const vs=shader(gl.VERTEX_SHADER,'attribute vec2 p;attribute vec2 uv;varying vec2 v;void main(){v=uv;gl_Position=vec4(p,0.0,1.0);}');
  const fs=shader(gl.FRAGMENT_SHADER,'precision mediump float;uniform sampler2D t;varying vec2 v;void main(){gl_FragColor=texture2D(t,v);}');
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program)||'program');
  buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([
    -.82,-.72,0,1, .82,-.72,1,1, -.82,.72,0,0,
    -.82,.72,0,0, .82,-.72,1,1, .82,.72,1,0
  ]),gl.STATIC_DRAW);
  menuCanvas=document.createElement('canvas');menuCanvas.width=1024;menuCanvas.height=768;menuCtx=menuCanvas.getContext('2d');
  tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
}
function controllerSummary(){
  if(!session)return 'Controllers: waiting for immersive session';
  const sources=[...session.inputSources].filter(s=>s.gamepad);
  if(!sources.length)return 'Controllers: move/click a Quest controller';
  return 'Controllers: '+sources.map(s=>{
    const gp=s.gamepad,tr=gp.buttons?.[0]?.value||0,gr=gp.buttons?.[1]?.value||0;
    return (s.handedness||'controller')+' T '+tr.toFixed(2)+' G '+gr.toFixed(2);
  }).join('   ');
}
function rounded(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function drawMenu(t){
  if(!menuCtx)return;
  const c=menuCtx,w=menuCanvas.width,h=menuCanvas.height;c.clearRect(0,0,w,h);
  const g=c.createLinearGradient(0,0,w,h);g.addColorStop(0,'rgba(21,10,34,.98)');g.addColorStop(1,'rgba(5,3,10,.98)');c.fillStyle=g;rounded(c,18,18,w-36,h-36,42);c.fill();
  c.strokeStyle='rgba(190,135,245,.75)';c.lineWidth=4;rounded(c,18,18,w-36,h-36,42);c.stroke();
  c.fillStyle='#cda1ff';c.font='700 28px system-ui';c.fillText('NOCTURNE VR  ·  0.62.4',58,78);
  c.fillStyle='#ffffff';c.font='800 58px system-ui';c.fillText('IMMERSIVE ACTIVE',58,155);
  c.fillStyle='#bcaec8';c.font='28px system-ui';c.fillText('Stable VR shell · direct Quest WebXR path',58,205);
  c.fillStyle='#24152f';rounded(c,58,250,908,88,22);c.fill();c.fillStyle='#e9dbf5';c.font='700 28px system-ui';c.fillText(controllerSummary(),84,305);
  const items=[['LIVE','telemetry + waveform'],['CHAT','Anna conversation'],['TOOL','geometry + device'],['EXIT','return to browser']];
  items.forEach((it,i)=>{const x=58+(i%2)*458,y=380+Math.floor(i/2)*128;c.fillStyle='rgba(43,25,57,.95)';rounded(c,x,y,428,100,22);c.fill();c.strokeStyle='rgba(119,83,148,.9)';c.lineWidth=2;rounded(c,x,y,428,100,22);c.stroke();c.fillStyle='#fff';c.font='800 30px system-ui';c.fillText(it[0],x+26,y+40);c.fillStyle='#ae9bb9';c.font='22px system-ui';c.fillText(it[1],x+26,y+72)});
  c.fillStyle='#9a87a7';c.font='22px system-ui';c.fillText('Menu is rendered inside VR. Controller selection comes next.',58,704);
  gl.bindTexture(gl.TEXTURE_2D,tex);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,menuCanvas);
  lastMenu=t;
}
function renderMenu(t){
  if(t-lastMenu>250)drawMenu(t);
  gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buf);
  const p=gl.getAttribLocation(program,'p'),uv=gl.getAttribLocation(program,'uv');
  gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,16,0);
  gl.enableVertexAttribArray(uv);gl.vertexAttribPointer(uv,2,gl.FLOAT,false,16,8);
  gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);gl.uniform1i(gl.getUniformLocation(program,'t'),0);
  gl.disable(gl.DEPTH_TEST);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.drawArrays(gl.TRIANGLES,0,6);gl.disable(gl.BLEND);
}
async function enterFallback(e){
  if(e){e.preventDefault();e.stopImmediatePropagation()}
  if(session){set('diag-line','Immersive session is already active.');return}
  const enter=$('enter');if(enter){enter.disabled=true;enter.textContent='OPENING VR…'}
  try{
    const test=await run();if(!test.immersive)throw new Error('Quest reports immersive-vr unsupported');
    const canvas=$('xr-canvas');gl=canvas.getContext('webgl',{xrCompatible:true,alpha:false,antialias:true});if(!gl)throw new Error('WebGL context unavailable');
    if(gl.makeXRCompatible)await gl.makeXRCompatible();initMenuGL();
    const root=$('xr-overlay');
    try{session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor','hand-tracking','dom-overlay'],domOverlay:{root}})}
    catch{session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor','hand-tracking']})}
    layer=new XRWebGLLayer(session,gl);session.updateRenderState({baseLayer:layer,depthNear:.05,depthFar:50});
    try{refSpace=await session.requestReferenceSpace('local-floor')}catch{refSpace=await session.requestReferenceSpace('local')}
    session.addEventListener('end',()=>{session=null;layer=null;refSpace=null;set('xr-status','VR READY');set('diag-line','Immersive session ended normally.');if(enter){enter.disabled=false;enter.textContent='ENTER IMMERSIVE VR'}const exit=$('exit');if(exit)exit.disabled=true},{once:true});
    set('xr-status','IMMERSIVE VR');set('diag-line','Stable immersive shell active · in-headset menu rendered.');const exit=$('exit');if(exit)exit.disabled=false;
    const frame=(t,f)=>{if(!session)return;const pose=f.getViewerPose(refSpace);gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(.018,.008,.032,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);if(pose)for(const view of pose.views){const vp=layer.getViewport(view);gl.viewport(vp.x,vp.y,vp.width,vp.height);gl.scissor(vp.x,vp.y,vp.width,vp.height);gl.enable(gl.SCISSOR_TEST);gl.clearColor(.018,.008,.032,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);renderMenu(t);gl.disable(gl.SCISSOR_TEST)}session.requestAnimationFrame(frame)};session.requestAnimationFrame(frame);
  }catch(err){set('diag-line','Direct VR start failed: '+String(err&&err.message||err).slice(0,140));set('xr-status','VR START FAILED');if(enter){enter.disabled=false;enter.textContent='ENTER IMMERSIVE VR'}session=null}
}
async function testControllers(e){
  if(e){e.preventDefault();e.stopImmediatePropagation()}
  if(!session){set('diag-line','Controller Test needs an active immersive session. Enter VR first.');return}
  const sources=[...session.inputSources].filter(s=>s.gamepad);if(!sources.length){set('diag-line','Immersive VR is active, but Quest has not exposed controller gamepads yet. Move or click a controller and try again.');return}
  let pulses=0;for(const s of sources){const gp=s.gamepad,acts=[];if(gp.vibrationActuator)acts.push(gp.vibrationActuator);if(gp.hapticActuators)for(const a of gp.hapticActuators)acts.push(a);for(const a of acts){try{if(a.pulse){await a.pulse(.8,180);pulses++}else if(a.playEffect){await a.playEffect('dual-rumble',{duration:180,strongMagnitude:.8,weakMagnitude:.5});pulses++}}catch{}}}
  set('diag-line',pulses?'Controller test sent '+pulses+' haptic pulse'+(pulses===1?'':'s')+'.':'Controllers are visible, but no haptic actuator is exposed.');
}
window.nocturneVrSelfTest=run;
document.addEventListener('DOMContentLoaded',()=>{$('diag-run')?.addEventListener('click',run);setTimeout(run,0);const enter=$('enter');if(enter)enter.addEventListener('click',enterFallback,{capture:true});const test=$('test');if(test)test.addEventListener('click',testControllers,{capture:true});const exit=$('exit');if(exit)exit.addEventListener('click',async e=>{if(session){e.preventDefault();e.stopImmediatePropagation();try{await session.end()}catch{}}},{capture:true})});
window.addEventListener('error',e=>set('diag-line','VR script error: '+String(e.message||'unknown').slice(0,120)));
window.addEventListener('unhandledrejection',e=>set('diag-line','VR promise error: '+String(e.reason&&e.reason.message||e.reason||'unknown').slice(0,120)));
})();