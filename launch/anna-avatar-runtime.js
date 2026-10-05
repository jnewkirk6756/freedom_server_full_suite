(function(){
'use strict';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,Number(v)||0));
const smooth=(a,b,rate,dt)=>a+(b-a)*(1-Math.exp(-Math.max(.001,rate)*Math.max(0,dt)));
const POSES=['back','doggy','side','standing','squat'];
const EXPRESSIONS=['calm','attentive','curious','focused','playful','assertive','intense','irritated','withdrawn','recovering'];
const FACE={
 calm:{smile:.04,brow:0,eyes:.18,jaw:.02},
 attentive:{smile:.02,brow:.05,eyes:.24,jaw:.03},
 curious:{smile:.05,brow:.22,eyes:.28,jaw:.04},
 focused:{smile:0,brow:-.02,eyes:.18,jaw:.02},
 playful:{smile:.28,brow:.08,eyes:.20,jaw:.08},
 assertive:{smile:.02,brow:-.08,eyes:.12,jaw:.08},
 intense:{smile:0,brow:-.16,eyes:.08,jaw:.18},
 irritated:{smile:0,brow:-.22,eyes:.08,jaw:.08},
 withdrawn:{smile:0,brow:.03,eyes:-.08,jaw:0},
 recovering:{smile:.08,brow:0,eyes:.10,jaw:.03}
};
class Runtime{
 constructor(){
  this.pose='back';this.poseFrom='back';this.poseTo='back';this.poseMix=1;
  this.expression='attentive';this.expressionTarget='attentive';
  this.telemetry={pace:0,depth:0,force:0,intensity:0};
  this.motion={breath:0,sway:0,headYaw:0,headPitch:0,gazeX:0,gazeY:0,blink:0,speech:0};
  this.face={...FACE.attentive};this.clock=0;this.nextBlink=2.5;this.blinkT=0;this.speaking=false;this.modelReady=false;
 }
 setPose(p){if(!POSES.includes(p)||p===this.poseTo)return;this.poseFrom=this.poseTo;this.poseTo=p;this.poseMix=0}
 setExpression(x){if(EXPRESSIONS.includes(x))this.expressionTarget=x}
 setTelemetry(t={}){for(const k of Object.keys(this.telemetry))if(Number.isFinite(Number(t[k])))this.telemetry[k]=clamp(t[k])}
 setSpeaking(on){this.speaking=Boolean(on)}
 setModelReady(on){this.modelReady=Boolean(on)}
 update(dtMs=16){
  const dt=Math.min(.08,Math.max(0,dtMs/1000));this.clock+=dt;
  this.poseMix=clamp(this.poseMix+dt*(1.45+this.telemetry.pace*1.25));
  if(this.poseMix>=1){this.pose=this.poseTo;this.poseFrom=this.poseTo}
  this.expression=this.expressionTarget;
  const target=FACE[this.expressionTarget]||FACE.attentive;
  for(const k of Object.keys(this.face))this.face[k]=smooth(this.face[k],target[k],6.5,dt);
  const p=this.telemetry.pace,d=this.telemetry.depth,f=this.telemetry.force,i=this.telemetry.intensity;
  const breathHz=.16+p*.12+i*.08;
  this.motion.breath=Math.sin(this.clock*Math.PI*2*breathHz)*(.012+i*.024);
  this.motion.sway=Math.sin(this.clock*(.55+p*.8))*(.008+i*.018);
  this.motion.headYaw=smooth(this.motion.headYaw,Math.sin(this.clock*.43)*(.03+i*.04),4,dt);
  this.motion.headPitch=smooth(this.motion.headPitch,Math.sin(this.clock*.31+.8)*(.018+i*.025),4,dt);
  this.motion.gazeX=smooth(this.motion.gazeX,Math.sin(this.clock*.37)*(.06+i*.05),5,dt);
  this.motion.gazeY=smooth(this.motion.gazeY,Math.sin(this.clock*.29+1.2)*.035,5,dt);
  this.nextBlink-=dt;
  if(this.nextBlink<=0&&this.blinkT<=0){this.blinkT=.14;this.nextBlink=2.2+((Math.sin(this.clock*1.73)+1)*1.25)}
  if(this.blinkT>0){this.blinkT=Math.max(0,this.blinkT-dt);const q=1-this.blinkT/.14;this.motion.blink=Math.sin(q*Math.PI)}else this.motion.blink=0;
  const speechTarget=this.speaking?(.22+.45*((Math.sin(this.clock*11.5)+1)/2)):0;
  this.motion.speech=smooth(this.motion.speech,speechTarget,12,dt);
  this.motion.amplitude=.18+d*.52+i*.16;
  this.motion.firmness=.2+f*.8;
  return this.snapshot();
 }
 snapshot(){return{pose:this.pose,poseFrom:this.poseFrom,poseTo:this.poseTo,poseMix:this.poseMix,expression:this.expression,face:{...this.face},motion:{...this.motion},telemetry:{...this.telemetry},modelReady:this.modelReady}}
}
window.NocturneAvatarRuntime={create:()=>new Runtime(),POSES:[...POSES],EXPRESSIONS:[...EXPRESSIONS]};
})();