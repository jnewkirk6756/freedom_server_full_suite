/* Exact fallback lifetime/controller functions, with neutral rendering stubs.
 * These tests do not render existing scenes or claim headset compatibility. */
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=name=>readFileSync(new URL('../launch/'+name,import.meta.url),'utf8');
const source=read('vr-fallback.js');
function extract(name){const start=source.search(new RegExp('(?:async )?function '+name+'\\('));assert.ok(start>=0,name);const rest=source.slice(start);const next=rest.slice(1).search(/\n(?:async )?function /);return next<0?rest:rest.slice(0,next+1);}
const functions=['navigateOut','controllerInteraction','disposeGL','setEntryState','getLifecycle','enterFallback','resetSpatialView','handleContextLost','handleContextRestored'].map(extract).join('\n');
const defer=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject}};
class Session extends EventTarget{
 inputSources=[];visibilityState='visible';ends=0;frames=[];failEnd=false;spaceFailure=false;
 requestAnimationFrame(fn){this.frames.push(fn);}
 updateRenderState(){}
 async requestReferenceSpace(mode){if(this.spaceFailure)throw Error('No space');return {mode};}
 async end(){this.ends++;if(this.failEnd)throw Error('Exit failed');this.dispatchEvent(new Event('end'));}
}
function harness(){
 const next=new Session(),elements=new Map(),classes=new Set(),events=[],routes=[],selected=[],rendered=[];
 const noop=()=>{},gl=new Proxy({makeXRCompatible:async()=>{}},{get:(obj,key)=>obj[key]||noop});
 for(const id of ['enter','exit','diag-line','xr-status','xr-canvas','xr-overlay','vr-session-dialog'])elements.set(id,{disabled:false,textContent:'',getContext:()=>gl,showModal:noop});
 const context=vm.createContext({console,URL,Event,EventTarget,Set,Map,Math,Number,Promise,Float32Array,
  document:{documentElement:{classList:{add:key=>classes.add(key),remove:key=>classes.delete(key)}},getElementById:id=>elements.get(id)},
  navigator:{xr:{requestSession:async()=>next}},localStorage:{getItem:()=>null},location:{assign:path=>routes.push(path)},
  CustomEvent:class{constructor(type,properties={}){this.type=type;Object.assign(this,properties)}},XRWebGLLayer:class{framebuffer={};getViewport(){return{x:0,y:0,width:10,height:10}}},
  isSecureContext:true,dispatchEvent:e=>events.push(e),loadTelemetry:()=>({initialized:true}),loadAnnaFaceState:noop,
  initGL:noop,motionState:()=>({neutral:true}),syncMotionRuntime:noop,updateAvatarRuntime:noop,updateAnnaTexture:noop,
  drawScene:()=>rendered.push('neutral-frame'),mul4:()=>[],renderMenu:noop,drawControllerOverlay:noop,
  selectTile:(i,src)=>selected.push({i,src}),floorY:()=>0,basePanelX:()=>0,basePanelY:()=>0,panelCenter:()=>[0,0,-2],panelNormal:()=>[0,0,1],inverseTransformPoint:point=>point,menuTileIndex:()=>3,
 });
 context.window=context;
 vm.runInContext(read('viewer-core.js'),context);vm.runInContext(read('xr-session-core.js'),context);
 vm.runInContext(`var session=null,gl=null,layer=null,refSpace=null,refMode='local-floor';
 var worldProgram=null,worldBuf=null,uiProgram=null,uiBuf=null,uiTex=null,annaTex=null,menuCanvas=null,menuCtx=null,annaTexReady=false,lastMenu=0;
 var triggerDown=new Map(),escapeDown=new Map(),rayTargets=new Map(),glShaders=new Set(),lastDisplayFrame=null,contextLost=false,xrLifecycle=null;
 var pendingRoute=null,hovered=-1,editTarget='panel',panelPose={scale:1,yaw:0},panelOffset={x:0,y:0,z:0};
 var annaPose={x:0,y:0,z:0,scale:1,yaw:0},toolPose={x:0,y:0,z:0,scale:1,yaw:0},wavePose={x:0,y:0,z:0,scale:1,yaw:0},mannequinPose={x:0,y:0,z:0,scale:1,yaw:0};
 var sceneMode='',actionLine='',annaFaceState='',PANEL_Z=-2,PANEL_W=2,PANEL_H=2;
 var $=id=>document.getElementById(id),set=(id,value)=>{const e=$(id);if(e)e.textContent=value};
 ${functions}`,context);
 return {context,next,elements,classes,events,routes,selected,rendered,run:code=>vm.runInContext(code,context)};
}
const tracked={transform:{matrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}};
const controller=(grip=.9,x=.4,y=-.3)=>({targetRaySpace:{},gamepad:{buttons:[{value:0},{value:grip},{},{},{},{pressed:false}],axes:[0,0,x,y]}});
test('actual fallback loads the required generic cores before its capture-phase entry handler',()=>{
 const html=read('vr.html');for(const name of ['viewer-core.js','xr-session-core.js'])assert.ok(html.indexOf(name)<html.indexOf('vr-fallback.js'));
 assert.match(source,/enter\.addEventListener\('click',enterFallback,\{capture:true\}\)/);
});
test('actual fallback entry, frame and normal exit clean up UI and allow re-entry',async()=>{
 const h=harness();await h.context.enterFallback();assert.equal(h.next.frames.length,1);assert.equal(h.classes.has('xr-active'),true);assert.equal(h.elements.get('exit').disabled,false);
 h.next.frames.shift()(0,{getViewerPose:()=>({views:[]}),getPose:()=>null});assert.equal(h.next.frames.length,1);
 await h.context.getLifecycle().stop();assert.equal(h.classes.has('xr-active'),false);assert.equal(h.elements.get('enter').disabled,false);assert.equal(h.elements.get('exit').disabled,true);
 h.next.frames.shift()(16,{});assert.equal(h.next.frames.length,0,'stale frame cannot continue');await h.context.enterFallback();assert.equal(h.classes.has('xr-active'),true);await h.context.getLifecycle().stop();
});
test('actual fallback does not request twice on rapid repeated entry',async()=>{
 const h=harness(),pending=defer();let requests=0;h.context.navigator.xr.requestSession=()=>{requests++;return pending.promise};
 const a=h.context.enterFallback();await h.context.enterFallback();assert.equal(requests,1);pending.resolve(h.next);await a;await h.context.getLifecycle().stop();
});
test('Home navigation completes when a cancelled pending permission request is denied',async()=>{
 const h=harness(),pending=defer();h.context.navigator.xr.requestSession=()=>pending.promise;
 const entering=h.context.enterFallback(),leaving=h.context.navigateOut('/');assert.deepEqual(h.routes,[]);pending.reject(Error('Permission denied'));await entering;await leaving;
 assert.deepEqual(h.routes,['/']);assert.equal(h.context.getLifecycle().status().state,'idle');
});
test('Home navigation cancels a late grant and ends it before leaving',async()=>{
 const h=harness(),pending=defer();h.context.navigator.xr.requestSession=()=>pending.promise;
 const entering=h.context.enterFallback(),leaving=h.context.navigateOut('/');pending.resolve(h.next);await entering;await leaving;
 assert.equal(h.next.ends,1);assert.deepEqual(h.routes,['/']);assert.equal(h.next.frames.length,0);
});
test('failed exit keeps the page and allows explicit retry without false navigation',async()=>{
 const h=harness();await h.context.enterFallback();h.next.failEnd=true;await h.context.navigateOut('/');assert.deepEqual(h.routes,[]);assert.equal(h.elements.get('exit').disabled,false);
 h.next.failEnd=false;await h.context.navigateOut('/');assert.deepEqual(h.routes,['/']);
});
test('reference-space setup failure closes the granted session and keeps failure feedback',async()=>{
 const h=harness();h.next.spaceFailure=true;await h.context.enterFallback();assert.equal(h.next.ends,1);assert.equal(h.next.frames.length,0);assert.match(h.elements.get('diag-line').textContent,/No space/);
});
test('actual fallback panel transform is equal at 30/60/72/90/120 Hz with nonzero movement',async()=>{
 const outcomes=[];
 for(const hz of [30,60,72,90,120]){
  const h=harness();await h.context.enterFallback();const src=controller();h.next.inputSources=[src];h.context.neutralFrame={getPose:()=>tracked};h.run("editTarget='panel'");
  for(let i=0;i<hz;i++)h.context.controllerInteraction(h.context.neutralFrame,1/hz);
  outcomes.push(h.run('({yaw:panelPose.yaw,scale:panelPose.scale})'));await h.context.getLifecycle().stop();
 }
 assert.ok(outcomes[0].yaw>.1);assert.ok(outcomes[0].scale>1.05);
 for(const result of outcomes){assert.ok(Math.abs(result.yaw-outcomes[0].yaw)<1e-12);assert.ok(Math.abs(result.scale-outcomes[0].scale)<1e-12);}
});
test('display controls ignore thumbstick drift, clamp pause jumps and reset transforms',async()=>{
 const h=harness();await h.context.enterFallback();const src=controller(.9,.05,.05);h.next.inputSources=[src];h.run("editTarget='panel'");const frame={getPose:()=>tracked};
 h.context.controllerInteraction(frame,1);assert.equal(h.run('panelPose.yaw'),0);assert.equal(h.run('panelPose.scale'),1);
 src.gamepad.axes=[0,0,1,-1];h.context.controllerInteraction(frame,100);assert.ok(h.run('panelPose.yaw')<=.054001);assert.ok(h.run('panelPose.scale')<=1.036001);
 h.context.resetSpatialView();assert.equal(h.run('panelPose.yaw'),0);assert.equal(h.run('panelPose.scale'),1);await h.context.getLifecycle().stop();
});
test('tracking loss and disconnect remove stale ray targets and button state',async()=>{
 const h=harness();await h.context.enterFallback();const src=controller(0,0,0);h.next.inputSources=[src];h.context.controllerInteraction({getPose:()=>tracked},.01);assert.equal(h.run('rayTargets.size'),1);
 h.context.controllerInteraction({getPose:()=>null},.01);assert.equal(h.run('rayTargets.size+triggerDown.size+escapeDown.size'),0);
 h.context.controllerInteraction({getPose:()=>tracked},.01);h.next.inputSources=[];h.next.dispatchEvent(new Event('inputsourceschange'));assert.equal(h.run('rayTargets.size+triggerDown.size+escapeDown.size'),0);await h.context.getLifecycle().stop();
});
test('controller escape edges are tracked independently across both sources',async()=>{
 const h=harness();await h.context.enterFallback();const a=controller(0),b=controller(0);a.gamepad.buttons[5].pressed=true;h.next.inputSources=[a,b];
 h.context.controllerInteraction({getPose:()=>tracked},.01);await new Promise(resolve=>setImmediate(resolve));assert.equal(h.next.ends,1);assert.deepEqual(h.routes,['/vr/']);
});
test('visibility interruption clears held buttons and resets display frame time',async()=>{
 const h=harness();await h.context.enterFallback();h.run('lastDisplayFrame=100;triggerDown.set({},true);rayTargets.set({},4)');h.next.dispatchEvent(new Event('visibilitychange'));
 assert.equal(h.run('lastDisplayFrame'),null);assert.equal(h.run('triggerDown.size+rayTargets.size'),0);await h.context.getLifecycle().stop();
});


test('actual fallback reports missing XR or insecure context without requesting a session',async()=>{
 for(const mode of ['missing','insecure']){
  const h=harness();if(mode==='missing')h.context.navigator.xr=null;else h.context.isSecureContext=false;
  await h.context.enterFallback();assert.equal(h.context.getLifecycle().status().state,'idle');assert.match(h.elements.get('diag-line').textContent,/supported headset browser on HTTPS/);assert.equal(h.elements.get('enter').disabled,false);assert.equal(h.next.frames.length,0);
 }
});
test('context loss during active XR ends it and restoration enables explicit re-entry',async()=>{
 const h=harness();await h.context.enterFallback();let prevented=false;
 await h.context.handleContextLost({preventDefault:()=>{prevented=true}});assert.equal(prevented,true);assert.equal(h.next.ends,1);assert.equal(h.elements.get('enter').disabled,true);assert.equal(h.classes.has('xr-active'),false);
 h.context.handleContextRestored();assert.equal(h.elements.get('enter').disabled,false);assert.match(h.elements.get('diag-line').textContent,/Enter VR/);await h.context.enterFallback();assert.equal(h.classes.has('xr-active'),true);await h.context.getLifecycle().stop();
});
test('context loss during pending permission closes a late grant without a stale frame',async()=>{
 const h=harness(),pending=defer();h.context.navigator.xr.requestSession=()=>pending.promise;
 const entering=h.context.enterFallback(),losing=h.context.handleContextLost({preventDefault(){}});pending.resolve(h.next);await entering;await losing;
 assert.equal(h.next.ends,1);assert.equal(h.next.frames.length,0);assert.equal(h.elements.get('enter').disabled,true);h.context.handleContextRestored();assert.equal(h.elements.get('enter').disabled,false);
});
test('graphics recovery after rejected XR exit preserves an actionable exit retry',async()=>{
 const h=harness();await h.context.enterFallback();h.next.failEnd=true;await h.context.handleContextLost({preventDefault(){}});h.context.handleContextRestored();
 assert.match(h.elements.get('diag-line').textContent,/Exit the old VR session/);assert.equal(h.elements.get('enter').disabled,true);assert.equal(h.elements.get('exit').disabled,false);
 h.next.failEnd=false;await h.context.getLifecycle().stop();assert.equal(h.elements.get('enter').disabled,false);
});
test('actual canvas lifecycle handlers are wired along with pagehide cleanup',()=>{
 assert.match(source,/addEventListener\('webglcontextlost',handleContextLost\)/);assert.match(source,/addEventListener\('webglcontextrestored',handleContextRestored\)/);assert.match(source,/addEventListener\('pagehide',.*stop\('pagehide'\)/);
});

test('fallback diagnostics initialize their own status before the separate module loads',async()=>{
 const declarations=source.match(/const EMBODIED_STATE_KEY=[^\n]+\nlet embodiedState=[^\n]+/);
 assert.ok(declarations,'fallback must own its status binding; module-scoped vr.js state is unavailable');
 for(const saved of [null,'curious']){
  const lines=new Map(),context=vm.createContext({
   localStorage:{getItem:key=>{assert.equal(key,'nocturne.embodied.state.v071');return saved}},
   document:{createElement:()=>({getContext:()=>null})},navigator:{},
   set:(key,value)=>lines.set(key,value),loadTelemetry:()=>({initialized:false}),
   patternCore:null,annaFaceReady:false,annaFaceState:'',annaFaceError:'',isSecureContext:true,
  });context.window=context;
  vm.runInContext(declarations[0]+'\n'+extract('run'),context);
  await context.run();assert.match(lines.get('diag-line'),new RegExp('AI '+(saved||'attentive')));
  assert.equal(Object.hasOwn(context,'embodiedState'),false,'state remains lexical rather than leaking to the global object');
 }
});

test('fallback storage status listener resolves its own key and updates diagnostics',async()=>{
 const declarations=source.match(/const EMBODIED_STATE_KEY=[^\n]+\nlet embodiedState=[^\n]+/),listeners=new Map(),lines=new Map();
 const listener=source.split('\n').find(line=>line.startsWith("window.addEventListener('nocturne:embodied-state'"));
 const context=vm.createContext({
  localStorage:{getItem:()=>null},document:{createElement:()=>({getContext:()=>null})},navigator:{},
  set:(key,value)=>lines.set(key,value),loadTelemetry:()=>({initialized:false}),
  patternCore:null,annaFaceReady:false,annaFaceState:'',annaFaceError:'',isSecureContext:true,
  addEventListener:(type,callback)=>listeners.set(type,callback),String,
 });context.window=context;
 vm.runInContext(declarations[0]+'\nlet lastMenu=1;\n'+extract('run')+'\n'+listener,context);
 listeners.get('storage')({key:'nocturne.embodied.state.v071',newValue:'focused'});
 await context.run();assert.match(lines.get('diag-line'),/AI focused/);
 listeners.get('nocturne:embodied-state')({detail:{state:'curious'}});
 await context.run();assert.match(lines.get('diag-line'),/AI curious/);
 assert.equal(vm.runInContext('lastMenu',context),0);
});
