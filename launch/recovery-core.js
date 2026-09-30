/** Versioned personal-device backup format. Contains private user data; never upload automatically. */
export const BACKUP_VERSION = 'aurelia-device-v1';
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
export const MAX_BINARY_BYTES = 36 * 1024 * 1024;
export const KEYS = ['account','avatar','avatars','creator','messages','memories','media','about','aboutPhotos','speak','threads','memoryByAvatar','legacyUnassigned'].map(k=>'aurelia.preview.'+k);
export const DBS = {'aurelia-preview-media-v08':['clips'],'aurelia-preview-media-v010':['clips','photos']};
export async function digest(bytes) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join(''); }
const encoded = value => new TextEncoder().encode(JSON.stringify(value));
export function parseSafely(text) { return JSON.parse(text,(key,value)=>{if(['__proto__','prototype','constructor'].includes(key)) throw Error('Unsafe backup field.');return value;}); }
export function unbase64(s) { if(typeof s!=='string'||s.length%4||!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw Error('Invalid media encoding.');return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); }
export async function makeEnvelope(payload) { return {format:BACKUP_VERSION,payload,sha256:await digest(encoded(payload))}; }
export async function validateEnvelope(envelope) {
  if(envelope?.format!==BACKUP_VERSION||!envelope.payload||typeof envelope.sha256!=='string')throw Error('Not an Aurelia device backup.');
  if(encoded(envelope).length>MAX_BACKUP_BYTES)throw Error('Backup exceeds the 64 MB beta limit.');
  if(await digest(encoded(envelope.payload))!==envelope.sha256)throw Error('Backup integrity check failed; nothing was restored.');
  const p=envelope.payload;
  if(!p.local||typeof p.local!=='object'||Array.isArray(p.local)||!Array.isArray(p.blobs)||p.blobs.length>300)throw Error('Invalid backup structure.');
  for(const [key,value] of Object.entries(p.local)){
    if(!KEYS.includes(key)||typeof value!=='string')throw Error('Backup contains an unsupported setting.');
    if(key.endsWith('.speak')){if(!['true','false'].includes(value))throw Error('Invalid voice setting.');continue;}
    const v=parseSafely(value);
    if(key.endsWith('.avatars')){if(!Array.isArray(v)||v.length>4)throw Error('Invalid avatar slots.');for(const a of v)if(!Number.isInteger(a.age)||a.age<18)throw Error('Avatar age must be 18 or older.');}
    if(key.endsWith('.avatar')&&v&&(!Number.isInteger(v.age)||v.age<18))throw Error('Avatar age must be 18 or older.');
  }
  const seen=new Set(); let total=0;
  for(const b of p.blobs){
    if(!DBS[b.db]?.includes(b.store)||typeof b.id!=='string'||!b.id||b.id.length>180||typeof b.type!=='string'||!Number.isSafeInteger(b.bytes)||b.bytes<0)throw Error('Invalid media record.');
    const k=JSON.stringify([b.db,b.store,b.id]);if(seen.has(k))throw Error('Duplicate media record.');seen.add(k);
    if((total+=b.bytes)>MAX_BINARY_BYTES)throw Error('Media exceeds the 36 MB beta backup limit.');
    const bytes=unbase64(b.data);if(bytes.length!==b.bytes||await digest(bytes)!==b.sha256)throw Error('Media integrity check failed; nothing was restored.');
  }
  return p;
}
