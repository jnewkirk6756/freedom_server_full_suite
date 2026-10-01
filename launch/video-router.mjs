const MODELS=Object.freeze([
 {id:'wan-3-0-reference-to-video',family:'Wan 3.0',lane:'avatar',mode:'reference-to-video',adultCapable:true,deprecated:false,maxSeconds:30,resolutions:['1080p','720p','480p'],audio:true,identity:'best',priority:100},
 {id:'wan-3-0-image-to-video',family:'Wan 3.0',lane:'avatar',mode:'image-to-video',adultCapable:true,deprecated:false,maxSeconds:30,resolutions:['1080p','720p','480p'],audio:true,identity:'strong',priority:95},
 {id:'wan-3-0-text-to-video',family:'Wan 3.0',lane:'open',mode:'text-to-video',adultCapable:true,deprecated:false,maxSeconds:30,resolutions:['1080p','720p','480p'],audio:true,identity:'prompt-only',priority:90},
 {id:'wan-2-7-enhanced-text-to-video',family:'Wan 2.7 Enhanced',lane:'open',mode:'text-to-video',adultCapable:true,deprecated:false,maxSeconds:15,resolutions:['1080p','720p'],audio:true,identity:'prompt-only',priority:70},
 {id:'wan-2-7-uncensored-text-to-video',family:'Wan 2.7 Uncensored',lane:'adult-legacy',mode:'text-to-video',adultCapable:true,deprecated:true,maxSeconds:15,resolutions:['1080p','720p'],audio:true,identity:'prompt-only',priority:10}
]);

const MINOR_TERMS=/\b(child|children|kid|kids|minor|underage|teenager|schoolgirl|schoolboy|preteen|young-looking)\b/i;

export function validateAdultRequest(input={}){
 if(input.adult!==true)return {ok:true,adult:false};
 if(input.allSubjects18Plus!==true)return {ok:false,code:'ADULT_AGE_ATTESTATION_REQUIRED',message:'Adult generation requires an explicit all-subjects-18+ attestation.'};
 if(MINOR_TERMS.test(String(input.prompt||'')))return {ok:false,code:'MINOR_AMBIGUITY',message:'Adult generation cannot include or ambiguously describe minors.'};
 if(input.usesRealPersonLikeness===true&&input.documentedConsent!==true)return {ok:false,code:'REAL_PERSON_CONSENT_REQUIRED',message:'Explicit real-person adult content requires documented consent/authorization.'};
 return {ok:true,adult:true};
}

export function selectVideoModel(input={}){
 const check=validateAdultRequest(input); if(!check.ok)return {...check,model:null};
 const mode=input.mode|| (input.referenceCount>0?'reference-to-video':input.imageInput?'image-to-video':'text-to-video');
 const wantedResolution=input.resolution||'1080p';
 const wantedSeconds=Math.max(2,Number(input.durationSeconds||5));
 const pool=MODELS.filter(m=>!m.deprecated&&m.mode===mode&&m.resolutions.includes(wantedResolution)&&m.maxSeconds>=wantedSeconds&&(!input.adult||m.adultCapable));
 const model=pool.sort((a,b)=>b.priority-a.priority)[0]||null;
 return model?{ok:true,adult:Boolean(input.adult),model}:{ok:false,code:'NO_COMPATIBLE_MODEL',message:'No active model matches the requested mode, duration, resolution and capability.',model:null};
}

export function publicVideoCapabilities({credentialPresent=false,routerEnabled=false}={}){
 return {
  version:'video-router-v1',
  provider:'Venice',
  credentialPresent:Boolean(credentialPresent),
  routerEnabled:Boolean(routerEnabled),
  generationEnabled:Boolean(credentialPresent&&routerEnabled),
  safeguards:{adultAgeAttestation:true,realPersonConsentAttestation:true,minorAmbiguityBlock:true},
  lanes:{
   avatar:{preferred:'wan-3-0-reference-to-video',reason:'Reference-to-video gives the strongest identity continuity.'},
   image:{preferred:'wan-3-0-image-to-video'},
   text:{preferred:'wan-3-0-text-to-video'},
   legacyAdult:{model:'wan-2-7-uncensored-text-to-video',deprecated:true,reason:'Kept only as a compatibility fallback; not selected automatically.'}
  },
  models:MODELS.map(({priority,...m})=>m)
 };
}

export const VIDEO_MODELS=MODELS;
