/** Shared flat-screen / spatial UI model. All writes are device-local; no model requests here. */
export const WORLD_VERSION='0.21.0';
export const WORLD_KEY='aurelia.preview.world';
export const FREE_AVATARS=1;
export const ROOMS=[{id:'bedroom',name:'The Suite',kind:'Bedroom',subtitle:'Warm walnut · layered linen · dusk'},{id:'bathroom',name:'The Retreat',kind:'Bathroom',subtitle:'Travertine · brass · sculptural bath'},{id:'living',name:'The Residence',kind:'Living room',subtitle:'Soft seating · gallery wall · city view'}];
export const LOOKS={presentation:['Realistic','Cinematic','Stylized'],hairColor:['Black','Dark brown','Light brown','Blonde','Red','Silver','Violet'],hairStyle:['Long waves','Straight','Curly','Short','Braided','Tied back','Bald'],eyes:['Brown','Hazel','Green','Blue','Gray'],skinTone:['Deep','Rich brown','Golden brown','Tan','Olive','Light','Fair'],build:['Lean','Athletic','Average','Curvy','Broad'],wardrobe:['Casual','Tailored','Athleisure','Evening wear','Minimalist'],mood:['Calm','Warm','Confident','Playful','Reserved'],voice:['Warm','Measured','Bright','Soft'],age:[21,25,28,30,35,40,50,60]};
export const LABELS={presentation:'Visual style',hairColor:'Hair color',hairStyle:'Hair style',eyes:'Eye color',skinTone:'Skin tone',build:'Build',wardrobe:'Wardrobe',mood:'Personality',voice:'Voice direction',age:'Adult age'};
export const TABS=['Rooms','Character','Looks','Materials','Loops','About You','Settings'];
export const INITIAL={version:1,scene:'living',quality:1024,mood:'dusk',tab:'Rooms',yaw:0,recipe:{state:'idle_neutral',frame:'portrait',pose:'center',duration:5,variants:3},recipes:[],settings:{captions:true,reduceMotion:false},draft:{name:'',age:28,looks:{presentation:'Realistic',hairColor:'Dark brown',hairStyle:'Long waves',eyes:'Hazel',skinTone:'Golden brown',build:'Athletic',wardrobe:'Casual',mood:'Warm',voice:'Warm',age:28}}};
const own=(x,k)=>Object.prototype.hasOwnProperty.call(x,k);
export function parse(text){return JSON.parse(text,(k,v)=>{if(['__proto__','constructor','prototype'].includes(k))throw Error('Unsafe saved data');return v;});}
export function validateLooks(data={}){const out={};for(const [k,values] of Object.entries(LOOKS))out[k]=values.includes(data[k])?data[k]:INITIAL.draft.looks[k];return out;}
export function normalizeWorld(input={}){const out=structuredClone(INITIAL);if(!input||typeof input!=='object')return out;
 out.scene=ROOMS.some(x=>x.id===input.scene)?input.scene:out.scene;out.quality=[1024,2048,4096].includes(input.quality)?input.quality:1024;
 out.tab=TABS.includes(input.tab)?input.tab:'Rooms';out.mood=input.mood==='day'?'day':'dusk';out.draft={name:String(input.draft?.name||'').slice(0,40),age:Number(input.draft?.age)||28,looks:validateLooks(input.draft?.looks)};
 out.settings={captions:input.settings?.captions!==false,reduceMotion:input.settings?.reduceMotion===true};out.recipe=normalizeRecipe(input.recipe);
 if(Array.isArray(input.recipes))out.recipes=input.recipes.slice(-40).filter(x=>typeof x?.id==='string'&&typeof x?.avatarId==='string').map(x=>({...normalizeRecipe(x),id:x.id,avatarId:x.avatarId,room:ROOMS.some(r=>r.id===x.room)?x.room:'living',status:'DRAFT_NOT_SUBMITTED',createdAt:String(x.createdAt||''),provider:'venice'}));return out;}
export function normalizeRecipe(x={}){return{state:['idle_neutral','listen_engaged','speak_calm','think_reflective','react_pleased'].includes(x?.state)?x.state:'idle_neutral',frame:['portrait','full-body','wide'].includes(x?.frame)?x.frame:'portrait',pose:['center','seated','standing'].includes(x?.pose)?x.pose:'center',duration:[5,10].includes(Number(x?.duration))?Number(x.duration):5,variants:[1,3,5].includes(Number(x?.variants))?Number(x.variants):3};}
export function canCreateCharacter(avatars){return Array.isArray(avatars)&&avatars.length<FREE_AVATARS;}
export function createCharacter(avatars,draft,id){if(!canCreateCharacter(avatars))throw Error('Your free plan includes one character. Existing beta characters are preserved. Extra-character checkout is not active.');
 const name=String(draft.name||'').trim();if(!name||name.length>40)throw Error('Enter a name from 1 to 40 characters.');if(!Number.isInteger(draft.age)||draft.age<18||draft.age>120)throw Error('Character age must be between 18 and 120.');
 return{id,name,age:draft.age,tier:'free',looks:validateLooks(draft.looks),createdAt:new Date().toISOString()};}
export function applyLooks(avatar,looks){return{...avatar,looks:validateLooks(looks),updatedAt:new Date().toISOString()};}
export function newRecipe(avatarId,world,id){if(!avatarId)throw Error('Create or select a character first.');return{...normalizeRecipe(world.recipe),id,avatarId,room:world.scene,status:'DRAFT_NOT_SUBMITTED',provider:'venice',createdAt:new Date().toISOString()};}
export function ownedClips(media,avatarId){return media.filter(c=>c.avatarId===avatarId);}
export function textureMemory(size){return Math.round(size*size*4*4/3/1024/1024);}
export function normalizeRay(matrix){return{origin:[matrix[12],matrix[13],matrix[14]],direction:[-matrix[8],-matrix[9],-matrix[10]]};}
/** Panel is front-facing in X/Y with local +Z normal; transform ray using rigid inverse. */
export function panelHit(ray,panel){const c=Math.cos(panel.yaw||0),s=Math.sin(panel.yaw||0),dx=ray.origin[0]-panel.x,dy=ray.origin[1]-panel.y,dz=ray.origin[2]-panel.z;
 const o=[c*dx-s*dz,dy,s*dx+c*dz],d=[c*ray.direction[0]-s*ray.direction[2],ray.direction[1],s*ray.direction[0]+c*ray.direction[2]];
 if(d[2]>=-.0001||o[2]<0)return null;const t=-o[2]/d[2];if(t<0||t>12)return null;const x=o[0]+d[0]*t,y=o[1]+d[1]*t;if(Math.abs(x)>panel.width/2||Math.abs(y)>panel.height/2)return null;
 return{x:(x/panel.width+.5)*panel.pixelsW,y:(.5-y/panel.height)*panel.pixelsH,t};}
export function hitButton(buttons,point){return point?buttons.find(b=>!b.disabled&&point.x>=b.x&&point.x<=b.x+b.w&&point.y>=b.y&&point.y<=b.y+b.h):null;}
export function boundedNumber(value,min,max){return Math.max(min,Math.min(max,Number(value)||min));}
