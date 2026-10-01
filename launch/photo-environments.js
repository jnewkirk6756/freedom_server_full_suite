export const PHOTO_ENV_VERSION='0.22.0';
export const PHOTO_ENV_KEY='aurelia.preview.photoEnvironment.v1';
export const ENVIRONMENTS=[
{id:'cayley',name:'Cayley Interior',kind:'Residential · living / dining',author:'Greg Zaal',source:'https://polyhaven.com/a/cayley_interior',image:'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/cayley_interior.jpg',resolution:'8K photographic panorama',size:'4.58 MB',note:'Real captured 360° interior at sunrise with mixed daylight and practical lamps.'},
{id:'hotel',name:'Hotel Room',kind:'Residential · bedroom',author:'Greg Zaal',source:'https://polyhaven.com/a/hotel_room',image:'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/hotel_room.jpg',resolution:'8K photographic panorama',size:'2.99 MB',note:'Real captured hotel bedroom with soft window light and warm practical lighting.'},
{id:'wooden',name:'Wooden Lounge',kind:'Hospitality · lounge',author:'Greg Zaal',source:'https://polyhaven.com/a/wooden_lounge',image:'https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/wooden_lounge.jpg',resolution:'8K photographic panorama',size:'4.56 MB',note:'Real captured wood lounge with sofas, pool table and warm artificial light.'}
];
export function normalizePhotoState(v={}){return {environment:ENVIRONMENTS.some(x=>x.id===v.environment)?v.environment:'cayley',yaw:Number.isFinite(v.yaw)?v.yaw:0,pitch:Number.isFinite(v.pitch)?Math.max(-1.35,Math.min(1.35,v.pitch)):0,fov:[55,65,75,85].includes(v.fov)?v.fov:75};}
export function readPhotoState(storage){try{return normalizePhotoState(JSON.parse(storage.getItem(PHOTO_ENV_KEY)||'{}'));}catch{return normalizePhotoState();}}
export function savePhotoState(storage,state){storage.setItem(PHOTO_ENV_KEY,JSON.stringify(normalizePhotoState(state)));}
export function environment(id){return ENVIRONMENTS.find(x=>x.id===id)||ENVIRONMENTS[0];}
