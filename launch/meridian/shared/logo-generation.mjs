/** Portable bounded company-logo input contract. */
export const LOGO_PATH='/v1/meridian/logos/generate';
export const LOGO_PROTOCOL='meridian-logo-v1';
export const LOGO_MODEL='gpt-image-2.5-flare-2026-09-08';
export const LOGO_ALLOWANCE_MICROS=1000000;
export const LOGO_MAX_BYTES=2*1024*1024;
export function validateLogoInput(input){
 const fail=()=>{throw Object.assign(new Error('Enter a company name and short logo brief.'),{code:'LOGO_INPUT_INVALID',status:400});};
 if(!input||typeof input!=='object'||Array.isArray(input)||![Object.prototype,null].includes(Object.getPrototypeOf(input))||Object.keys(input).sort().join(',')!=='brief,companyName')fail();
 const out={};for(const [key,max]of [['companyName',120],['brief',1000]]){const value=input[key];if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f-\u009f]/.test(value)||(key==='companyName'&&!value.trim()))fail();out[key]=value.trim();}return out;
}
