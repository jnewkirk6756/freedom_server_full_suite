(function(){
const $=id=>document.getElementById(id),set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
let session=null,gl=null,layer=null,refSpace=null;
async function run(){
  set('diag-secure',window.isSecureContext?'YES':'NO');
  set('diag-xr',navigator.xr?'YES':'NO');
  let glok=false;try{const c=document.createElement('canvas');glok=!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{}
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
async function enterFallback(e){
  if(e){e.preventDefault();e.stopImmediatePropagation()}
  if(session){set('diag-line','Immersive session is already active.');return}
  const enter=$('enter'); if(enter){enter.disabled=true;enter.textContent='OPENING VR…'}
  try{
    const test=await run();
    if(!test.immersive)throw new Error('Quest reports immersive-vr unsupported');
    const canvas=$('xr-canvas');
    gl=canvas.getContext('webgl2',{xrCompatible:true,alpha:false})||canvas.getContext('webgl',{xrCompatible:true,alpha:false});
    if(!gl)throw new Error('WebGL context unavailable');
    if(gl.makeXRCompatible)await gl.makeXRCompatible();
    set('diag-line','Direct WebXR request accepted by page · requesting headset session…');
    session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','bounded-floor','hand-tracking']});
    layer=new XRWebGLLayer(session,gl);
    session.updateRenderState({baseLayer:layer,depthNear:.05,depthFar:50});
    try{refSpace=await session.requestReferenceSpace('local-floor')}catch{refSpace=await session.requestReferenceSpace('local')}
    session.addEventListener('end',()=>{
      session=null;layer=null;refSpace=null;
      set('xr-status','VR READY');set('diag-line','Immersive session ended normally.');
      if(enter){enter.disabled=false;enter.textContent='ENTER IMMERSIVE VR'}
      const exit=$('exit');if(exit)exit.disabled=true;
    },{once:true});
    set('xr-status','IMMERSIVE VR');
    set('diag-line','Direct immersive session ACTIVE. If you see the violet room, WebXR entry is fixed.');
    const exit=$('exit');if(exit)exit.disabled=false;
    const frame=(t,f)=>{
      if(!session)return;
      const pose=f.getViewerPose(refSpace);
      gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);
      gl.enable(gl.DEPTH_TEST);
      gl.clearColor(.06,.015,.10,1);
      gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
      if(pose){
        for(const view of pose.views){
          const vp=layer.getViewport(view);gl.viewport(vp.x,vp.y,vp.width,vp.height);
          gl.enable(gl.SCISSOR_TEST);gl.scissor(vp.x,vp.y,vp.width,vp.height);
          const pulse=.03+.02*Math.sin(t*.002);
          gl.clearColor(.08+pulse,.02,.13+pulse,1);
          gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
          gl.disable(gl.SCISSOR_TEST);
        }
      }
      session.requestAnimationFrame(frame);
    };
    session.requestAnimationFrame(frame);
  }catch(err){
    set('diag-line','Direct VR start failed: '+String(err&&err.message||err).slice(0,140));
    set('xr-status','VR START FAILED');
    if(enter){enter.disabled=false;enter.textContent='ENTER IMMERSIVE VR'}
    session=null;
  }
}
async function testControllers(e){
  if(e){e.preventDefault();e.stopImmediatePropagation()}
  if(!session){set('diag-line','Controller Test needs an active immersive session. Enter VR first.');return}
  const sources=[...session.inputSources].filter(s=>s.gamepad);
  if(!sources.length){set('diag-line','Immersive VR is active, but Quest has not exposed controller gamepads yet. Move or click a controller and try again.');return}
  let pulses=0;
  for(const s of sources){
    const gp=s.gamepad,acts=[];
    if(gp.vibrationActuator)acts.push(gp.vibrationActuator);
    if(gp.hapticActuators)for(const a of gp.hapticActuators)acts.push(a);
    for(const a of acts){try{if(a.pulse){await a.pulse(.8,180);pulses++}else if(a.playEffect){await a.playEffect('dual-rumble',{duration:180,strongMagnitude:.8,weakMagnitude:.5});pulses++}}catch{}}
  }
  set('diag-line',pulses?'Controller test sent '+pulses+' haptic pulse'+(pulses===1?'':'s')+'.':'Controllers are visible, but no haptic actuator is exposed.');
}
window.nocturneVrSelfTest=run;
document.addEventListener('DOMContentLoaded',()=>{
  $('diag-run')?.addEventListener('click',run);
  setTimeout(run,0);
  const enter=$('enter');if(enter){enter.addEventListener('click',enterFallback,{capture:true});enter.addEventListener('pointerup',()=>set('diag-line','Enter VR press detected · direct WebXR path armed.'),{capture:true})}
  const test=$('test');if(test)test.addEventListener('click',testControllers,{capture:true});
  const exit=$('exit');if(exit)exit.addEventListener('click',async e=>{if(session){e.preventDefault();e.stopImmediatePropagation();try{await session.end()}catch{}}},{capture:true});
});
window.addEventListener('error',e=>set('diag-line','VR script error: '+String(e.message||'unknown').slice(0,120)));
window.addEventListener('unhandledrejection',e=>set('diag-line','VR promise error: '+String(e.reason&&e.reason.message||e.reason||'unknown').slice(0,120)));
})();