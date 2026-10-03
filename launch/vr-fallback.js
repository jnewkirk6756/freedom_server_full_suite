(function(){
const $=id=>document.getElementById(id),set=(id,v)=>{const e=$(id);if(e)e.textContent=v};
async function run(){
  set('diag-secure',window.isSecureContext?'YES':'NO');
  set('diag-xr',navigator.xr?'YES':'NO');
  let gl=false;try{const c=document.createElement('canvas');gl=!!(c.getContext('webgl2')||c.getContext('webgl'))}catch{}
  set('diag-gl',gl?'YES':'NO');
  let immersive=false,err='';
  if(navigator.xr){try{immersive=await navigator.xr.isSessionSupported('immersive-vr')}catch(e){err=String(e&&e.message||e)}}
  set('diag-immersive',immersive?'YES':'NO');
  const parts=[
    window.isSecureContext?'HTTPS secure':'HTTPS not secure',
    navigator.xr?'WebXR exposed':'WebXR missing',
    immersive?'immersive-vr supported':'immersive-vr not supported',
    gl?'WebGL ready':'WebGL missing'
  ];
  set('diag-line',parts.join(' · ')+(err?' · '+err.slice(0,90):''));
  return {immersive};
}
window.nocturneVrSelfTest=run;
document.addEventListener('DOMContentLoaded',()=>{
  $('diag-run')?.addEventListener('click',run);
  setTimeout(run,0);
  const enter=$('enter');
  if(enter) enter.addEventListener('pointerdown',()=>{set('diag-line','Enter VR press detected by browser. Checking WebXR…');},{capture:true});
  const test=$('test');
  if(test) test.addEventListener('pointerdown',()=>{set('diag-line','Controller Test press detected by browser.');},{capture:true});
});
window.addEventListener('error',e=>set('diag-line','VR script error: '+String(e.message||'unknown').slice(0,120)));
window.addEventListener('unhandledrejection',e=>set('diag-line','VR promise error: '+String(e.reason&&e.reason.message||e.reason||'unknown').slice(0,120)));
})();