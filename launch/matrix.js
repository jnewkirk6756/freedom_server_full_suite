import{baseline,sensory,event}from'./matrix-core.js';
const $=id=>document.getElementById(id),c=$('matrix'),x=c.getContext('2d',{alpha:false});
let base=null,set={motion:.4,complexity:.55,telemetry:.65,flash:.05},events=[],started=0,stream=null,analyser=null,audio=0,impulses=[];
const filaments=Array.from({length:22},(_,i)=>({seed:i*17.73,phase:i*.71,depth:.18+(i%9)/11,width:.5+(i%5)*.23}));
const spores=Array.from({length:180},(_,i)=>({a:i*2.399,r:(i%47)/47,z:(i%31)/31,phase:i*.43,size:.6+(i%7)*.16}));
function resize(){c.width=Math.min(innerWidth*devicePixelRatio,2400);c.height=Math.min(innerHeight*devicePixelRatio,1600)}
addEventListener('resize',resize);resize();const val=id=>Number($(id).value)/100;
function bus(){return{speed:val('speed'),intensity:val('intensity'),pleasure:val('pleasure'),discomfort:val('liveDiscomfort'),shock:val('shock'),rhythm:base?Math.min(1,3/base.cycleTime):.2,audio}}
function filament(f,t,s,sc){
 const time=t*.00022*(.35+s.flow*2),hue=(s.hue*360+f.seed*3)%360,amp=sc*(.08+f.depth*.11+s.density*.035),span=sc*(.65+f.depth*.55);
 x.beginPath();
 for(let j=0;j<=48;j++){const q=j/48,u=(q-.5)*span*2,breath=Math.sin(time*.9+f.phase)*sc*.025;
  const v=Math.sin(q*6.283+time+f.phase)*amp+Math.sin(q*12.1-time*.63+f.seed)*amp*.24+breath;
  const twist=Math.cos(q*4.7+time*.4+f.phase)*sc*.06*f.depth;
  const px=u+twist,py=v;
  j?x.lineTo(px,py):x.moveTo(px,py);
 }
 x.strokeStyle='hsla('+hue+',88%,'+(58+f.depth*18)+'%,'+(.08+f.depth*.24)+')';
 x.lineWidth=(f.width+f.depth*2.2)*devicePixelRatio;x.shadowBlur=(8+f.depth*26)*devicePixelRatio;x.shadowColor='hsla('+hue+',100%,65%,.45)';x.stroke();
}
function draw(t){
 const b=bus(),s=sensory(b,set),w=c.width,h=c.height,sc=Math.min(w,h),cx=w/2,cy=h/2;
 const bg=x.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*.75);bg.addColorStop(0,'hsl('+((s.hue*360+18)%360)+' 28% 8%)');bg.addColorStop(.42,'#070512');bg.addColorStop(1,'#010104');x.fillStyle=bg;x.fillRect(0,0,w,h);
 x.save();x.translate(cx,cy);x.globalCompositeOperation='lighter';
 // soft membrane halos
 for(let k=0;k<6;k++){const phase=t*.00016*(.4+s.pulse)+k*1.047,r=sc*(.12+k*.085+Math.sin(phase)*.012),hue=(s.hue*360+k*18)%360;x.beginPath();x.ellipse(Math.sin(phase*.37)*sc*.035,Math.cos(phase*.29)*sc*.025,r,r*(.68+Math.sin(phase*.41)*.08),phase*.08,0,Math.PI*2);x.strokeStyle='hsla('+hue+',82%,62%,'+(.035+k*.008)+')';x.lineWidth=(9-k)*devicePixelRatio;x.shadowBlur=30*devicePixelRatio;x.shadowColor='hsla('+hue+',100%,60%,.18)';x.stroke();}
 // neural filaments
 for(const f of filaments){x.save();x.rotate(Math.sin(f.phase+t*.00003)*.34+f.phase*.18);x.scale(.78+f.depth*.38,.78+f.depth*.38);filament(f,t,s,sc);x.restore();}
 // drifting synaptic spores
 x.shadowBlur=0;for(const p of spores){const drift=t*.000035*(.2+s.flow*1.7),a=p.a+drift*(.35+p.z),rr=(.06+p.r*.66)*sc*(.88+Math.sin(t*.0007+p.phase)*.025),px=Math.cos(a+Math.sin(drift+p.phase)*.09)*rr,py=Math.sin(a*.92+Math.cos(drift*.8+p.phase)*.08)*rr*.72;const hue=(s.hue*360+p.z*95+p.phase*5)%360,alpha=.08+p.z*.34+s.audio*.14;x.fillStyle='hsla('+hue+',100%,72%,'+alpha+')';x.beginPath();x.arc(px,py,p.size*devicePixelRatio*(.8+p.z*1.7),0,Math.PI*2);x.fill();}
 // expanding event waves
 impulses=impulses.filter(q=>t-q.at<1800);for(const q of impulses){const age=(t-q.at)/1800,r=age*sc*.72;x.beginPath();x.arc(0,0,r,0,Math.PI*2);x.strokeStyle='hsla('+((s.hue*360+120*age)%360)+',100%,72%,'+((1-age)*.32)+')';x.lineWidth=(1+4*(1-age))*devicePixelRatio;x.stroke();}
 x.restore();x.globalCompositeOperation='source-over';x.shadowBlur=0;
 if(s.flash){const glow=x.createRadialGradient(cx,cy,0,cx,cy,sc*.65);glow.addColorStop(0,'rgba(255,255,255,'+(s.flash*.22)+')');glow.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=glow;x.fillRect(0,0,w,h);}
 $('readout').textContent='flow '+Math.round(b.speed*100)+' · intensity '+Math.round(b.intensity*100)+' · response '+Math.round((b.pleasure+b.discomfort+b.shock)/3*100)+' · audio '+Math.round(audio*100);
 if(analyser){const a=new Uint8Array(analyser.frequencyBinCount);analyser.getByteFrequencyData(a);audio=a.reduce((n,v)=>n+v,0)/(a.length*255)}
 requestAnimationFrame(draw)
}
requestAnimationFrame(draw);
$('start').onclick=()=>$('chart').showModal();
$('form').onsubmit=e=>{if(e.submitter?.value==='cancel')return;base=baseline({mood:$('mood').value,energy:$('energy').value,discomfort:$('discomfort').value,thcEnabled:$('thc').checked,thcLevel:$('thcLevel').value,alcoholEnabled:$('alcohol').checked,alcoholLevel:$('alcoholLevel').value,entrySpeed:$('entrySpeed').value,depth:$('depth').value,cycleTime:$('cycleTime').value,force:$('force').value,rhythm:$('rhythm').value});set={motion:val('motion'),complexity:val('complexity'),telemetry:val('telemetry'),flash:$('safe').checked?0:val('flash')};started=performance.now();events=[event('session_start',1,started)];$('mode').textContent='NEURAL FIELD ACTIVE'};
$('impulse').onclick=()=>{const at=performance.now();events.push(event('impulse',1,at));impulses.push({at});$('shock').value=100;setTimeout(()=>$('shock').value=0,180)};
$('mic').onclick=async()=>{if(analyser){stream.getTracks().forEach(t=>t.stop());analyser=null;audio=0;$('mic').textContent='Mic analysis off';return}try{stream=await navigator.mediaDevices.getUserMedia({audio:true});const ac=new AudioContext(),src=ac.createMediaStreamSource(stream);analyser=ac.createAnalyser();analyser.fftSize=256;src.connect(analyser);$('mic').textContent='Mic analysis on'}catch{$('mic').textContent='Mic unavailable'}};
$('export').onclick=()=>{const p={standard:'NOCTURNE-MATRIX-SESSION-1',visualStyle:'neural-organic-v1',baseline:base,settings:set,events,durationMs:started?performance.now()-started:0},a=document.createElement('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(p,null,2)],{type:'application/json'}));a.download='NOCTURNE-MATRIX-SESSION.json';a.click()};