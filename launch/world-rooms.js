import {MeshBuilder} from './world-graphics.js';
/** Designed room meshes in metres. Procedural material art; no purchased packs or panoramas. */
export function buildRoom(id){
 const b=new MeshBuilder(),box=(...x)=>b.box(...x),ball=(...x)=>b.ellipsoid(...x),cyl=(...x)=>b.cylinder(...x);
 const soft=(x,y,z,rx,ry,rz,color,kind=2,yaw=0)=>b.rounded(x,y,z,rx*2,ry*2,rz*2,color,kind,yaw,Math.min(rx,ry,rz)*.60);
 const walnut=0x513a2e,brass=0xb3935b,stone=0xb8b0a1,cream=0xd4c9b8,ink=0x292b33,plum=0x68546c;
 box(0,-.09,0,8,.18,8,id==='bathroom'?0xc4beb2:0xc4a783,1);
 box(0,3.35,0,8,.14,8,0xc6c1b6);box(0,1.65,-4,8,3.3,.14,id==='bathroom'?stone:0xb7b0a3);box(-4,1.65,0,.14,3.3,8,0x99978e);box(4,1.65,0,.14,3.3,8,0xaaa49a);box(0,1.65,4,8,3.3,.14,0xaaa49a);
 for(const z of [-3.86,3.86]){box(0,.11,z,7.8,.16,.06,walnut);box(0,3.16,z,7.8,.05,.09,brass,3);box(0,3.21,z,7.7,.024,.06,0xc9ac7e,7);}for(const x of [-3.87,3.87]){box(x,.11,0,.05,.16,7.8,walnut);box(x,3.2,0,.04,.03,7.7,0xbdaa8c,7);}
 // Tall windows with a modelled distant skyline, framed in bronze.
 box(3.90,1.82,.6,.035,2.65,4.4,0x99aabc,4);for(const z of [-1.62,-.16,1.31,2.81])box(3.84,1.82,z,.065,2.78,.045,ink,3);for(const y of [.45,3.2])box(3.84,y,.6,.075,.045,4.5,brass,3);
 for(let i=0;i<25;i++){const z=-1.6+i*.174,h=.1+Math.sin(i*8.4)**2*.65;box(3.83,.5+h/2,z,.025,h,.14,0x343e50);for(let j=0;j<3;j++)box(3.811,.57+j*.11,z,.009,.026,.035,0xa09471,7);}
 // Window-side sheer drapes, modelled folds.
 for(const z0 of [-1.9,3.12])for(let i=0;i<7;i++)cyl(3.66,1.72,z0+i*.05,.065,2.95,0xc8c3b7,2,.065,10);
 const plant=(x,z)=>{cyl(x,.22,z,.20,.44,0x373637,0,.24);for(let j=0;j<8;j++){const a=j*2.4,h=.7+j*.09;box(x+Math.sin(a)*.11,.5+h/3,z+Math.cos(a)*.11,.015,h,.015,0x4c6148);ball(x+Math.sin(a)*.28,.45+h,z+Math.cos(a)*.22,.11,.34,.045,0x4f6550,0,a,12,8);}};
 const art=(x,y,z,w,h)=>{box(x,y,z,w,h,.07,brass,3);box(x,y,z+.046,w-.075,h-.075,.023,0xe2d8c2);ball(x-.07,y,z+.08,w*.26,h*.34,.012,0x756078);ball(x+w*.17,y-h*.08,z+.10,w*.18,h*.28,.012,0xb3956d);};
 const lamp=(x,z,y=.8)=>{cyl(x,y,z,.04,.40,brass,3);cyl(x,y+.26,z,.22,.23,cream,2,.16);cyl(x,y-.2,z,.17,.027,brass,3);};
 const rug=(x,z,w,d)=>{box(x,.018,z,w,.02,d,0xada596,2);for(let i=0;i<7;i++){box(x,.032,z-d/2+.09+i*.045,w-.15,.004,.009,0xbeb4a4,2);box(x,.032,z+d/2-.09-i*.045,w-.15,.004,.009,0xbeb4a4,2);}};
 if(id==='bedroom'){
  rug(-.75,-.7,4.9,4.6);box(-.65,.28,-1.85,2.95,.38,2.6,walnut);box(-.65,.57,-1.84,2.80,.28,2.42,0xe5e0d4,2);soft(-.65,.73,-1.60,1.42,.16,1.14,0xe0d7c9,2,0,28,12);
  box(-.65,1.2,-3.37,3.18,1.65,.20,walnut);for(let i=0;i<21;i++)box(-2.13+i*.148,1.2,-3.245,.10,1.6,.09,0x79604c,1);box(-.65,1.05,-3.10,3.00,1.12,.17,plum,2);
  for(const x of [-1.38,.04]){soft(x,.91,-2.6,.66,.16,.39,0xf1e9da,2,0,20,10);soft(x,.94,-2.12,.37,.13,.27,0x8f8085,2);}
  box(-.65,.83,-.84,2.8,.07,.54,0x796577,2);for(let i=0;i<17;i++)box(-2.0+i*.16,.87,-.83,.024,.018,.55,0x998695,2);
  for(const x of [-2.70,1.4]){box(x,.43,-2.97,.8,.8,.57,walnut,1);box(x,.84,-2.97,.84,.04,.6,stone,3);box(x,.45,-2.64,.22,.02,.025,brass,3);lamp(x,-2.97,1.06);cyl(x,2.79,-3.03,.008,.74,brass,3);soft(x,2.41,-3.03,.16,.17,.16,0xffddb0,7);}
  box(-.65,.23,.32,2.46,.12,.57,brass,3);soft(-.65,.37,.32,1.30,.16,.35,0x746578,2);for(const x of [-1.65,.35])box(x,.11,.32,.05,.22,.47,brass,3);
  art(-2.98,2.20,-3.88,1.2,1.25);plant(2.97,-2.55);
  // Reading corner with lounge and pedestal.
  soft(2.25,.5,1.9,.62,.22,.66,0xb8ad9b,2);soft(2.25,.95,2.3,.60,.64,.22,cream,2);cyl(1.25,.42,1.87,.39,.045,walnut,1);cyl(1.25,.22,1.87,.07,.40,brass,3);lamp(1.25,1.87,.68);
 }else if(id==='bathroom'){
  // Travertine tiled backdrop.
  for(let i=0;i<8;i++)for(let j=0;j<4;j++)box(-3.5+i, .43+j*.80,-3.89,.984,.786,.04,0xbdb5a8,1);
  box(-2.30,.73,-2.97,2.8,.62,.70,walnut,1);box(-2.30,1.07,-2.97,2.9,.07,.82,stone,3);for(let i=0;i<17;i++)box(-3.64+i*.163,.73,-2.60,.013,.53,.025,brass,3);
  for(const x of [-3.08,-1.48]){ball(x,1.16,-2.93,.50,.09,.27,0xeee9df,3);ball(x,1.195,-2.93,.39,.025,.19,0xbebdb7,3);box(x,1.23,-3.27,.046,.28,.046,brass,3);box(x,1.37,-3.15,.046,.045,.25,brass,3);box(x,2.07,-3.73,1.12,1.37,.07,brass,3);box(x,2.07,-3.685,1.03,1.28,.025,0x727879,3);box(x-.35,2.07,-3.665,.025,1.14,.01,0xb1aaa0,7);}
  for(const x of [-3.79,-.77]){cyl(x,2.02,-3.60,.06,.68,0xf4d5a1,7);cyl(x,2.02,-3.66,.085,.74,brass,3);}
  // Freestanding elliptical tub with visible hollow interior and rim.
  ball(1.78,.40,-1.82,1.03,.41,.60,0xe5e3d9,3);ball(1.78,.67,-1.82,.94,.09,.53,0xf0ede7,3);ball(1.78,.693,-1.82,.83,.043,.42,0xa9bbb9,3);ball(1.78,.700,-1.82,.79,.03,.39,0xb7cac6,3);
  cyl(2.94,.50,-2.0,.03,1.,brass,3);box(2.81,1.,-2.,.30,.043,.05,brass,3);
  box(-2.5,.12,.5,2.45,.09,.91,0xc7bdac,2);box(-2.5,.45,.5,1.36,.09,.60,walnut,1);for(const x of [-3.0,-2.0])box(x,.27,.5,.07,.42,.47,walnut);for(let i=0;i<3;i++)box(-2.65,.56+i*.095,.5,.65,.08,.45,0xdad6c8,2);
  // Shower rail and a clear opening represented with only frame; no fake reflection claims.
  for(const x of [2.18,3.60])box(x,1.35,2.67,.03,2.7,.03,brass,3);box(2.89,2.7,2.67,1.45,.03,.03,brass,3);box(3.40,1.7,3.62,.03,1.45,.03,brass,3);box(3.4,2.42,3.43,.035,.035,.40,brass,3);cyl(3.4,2.40,3.25,.18,.025,brass,3);box(2.89,.016,3.18,1.6,.02,1.4,0x777b79,1);
  plant(.06,-3.13);art(-.1,2.10,-3.88,.72,1.1);
 }else{
  rug(-.4,-.4,5.4,4.5);
  // L-shaped softly upholstered sofa.
  box(-1.05,.23,-2.35,4.3,.22,1.04,walnut);for(let i=0;i<4;i++){soft(-2.65+i*1.02,.51,-2.18,.54,.23,.62,cream,2);soft(-2.65+i*1.02,1.,-2.71,.54,.56,.18,0xb7b1a5,2);}
  soft(-2.99,.71,-2.2,.18,.38,.68,0xb7b1a5,2);soft(1.,.71,-2.2,.18,.38,.68,0xb7b1a5,2);soft(-2.64,.50,-1.23,.55,.22,.57,cream,2);soft(-3.0,.73,-1.21,.15,.4,.6,cream,2);
  for(const x of [-2.3,.45])soft(x,.90,-2.27,.32,.34,.13,plum,2,.18);soft(-1.54,.87,-2.31,.32,.31,.12,0xa5967d,2,-.16);
  cyl(-.5,.43,-.18,.84,.095,0xae9e87,3,.84,40);cyl(-.5,.23,-.18,.50,.40,walnut,1,.57);box(-.57,.5,-.14,.45,.045,.34,0x4e4557,0,.25);box(-.57,.533,-.14,.37,.026,.31,0xc9b798,0,.1);cyl(-.15,.58,-.48,.08,.15,cream,3,.065);ball(-.16,.73,-.48,.13,.1,.12,0x53684f);
  for(const x of [1.85,2.77]){soft(x,.53,1.36,.45,.25,.49,0x736377,2);soft(x,.93,1.78,.46,.48,.16,0x74667b,2);for(const sx of [-.28,.28])box(x+sx,.20,1.36,.035,.40,.65,brass,3);}
  cyl(2.35,.5,.33,.29,.08,brass,3);cyl(2.35,.27,.33,.035,.48,brass,3);
  // Gallery triptych and slatted wall.
  for(let i=0;i<22;i++)box(-1.08+i*.20,1.8,-3.88,.045,2.64,.07,walnut,1);
  for(const x of [-2.57,-1.1,.4])art(x,2.02,-3.73,1.17,1.48);
  plant(2.91,-2.82);cyl(-3.45,.085,-1.05,.28,.07,brass,3);cyl(-3.45,1.10,-1.05,.028,2.05,brass,3);cyl(-3.45,2.05,-1.05,.33,.30,cream,2,.24);
  box(-3.76,.59,1.49,.41,1.12,2.4,walnut,1);for(let i=0;i<7;i++)box(-3.5,.78,.58+i*.19,.08,.39,.10,[cream,plum,stone][i%3]);
 }
 // Ceiling architectural disc with inset emitter.
 cyl(0,3.22,-1.5,.68,.12,0xbab4a6,0,.68,40);cyl(0,3.147,-1.5,.57,.015,0xe1cfac,7,.57,40);
 return{mesh:b.result(),objects:b.objects,room:id,spawn:[0,1.62,2.5]};
}
