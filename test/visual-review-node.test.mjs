import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createVisualReviewClient,buildVisualRequest} from '../launch/meridian/visual-review-client.mjs';
import {createVisualRoute,visualNodeAdapter} from '../launch/meridian/nocturne/visual-route.mjs';
import {createVisualImageValidator,VISUAL_LIMITS} from '../launch/meridian/nocturne/visual-media.mjs';
import {VISUAL_MODEL,VISUAL_PATH,VISUAL_PROTOCOL,VISUAL_OUTPUT_TOKENS,VISUAL_ALLOWANCE_MICROS,visualRequestId} from '../launch/meridian/shared/visual-review.mjs';
import {SITE_ORIGIN,canonical,b64url,encode,digest} from '../launch/meridian/shared/protocol.mjs';
import {assistOperatingEvidence} from '../launch/meridian/shared/measurement-evidence.mjs';
import {initializeMeridianRoute} from '../launch/meridian/nocturne/bootstrap.mjs';
const bytes=readFileSync(new URL('./fixtures/logo.webp',import.meta.url));
const image='data:image/webp;base64,'+bytes.toString('base64');
// All provider tests use fake credentials and synthetic signatures. No network.
const input=()=>({context:{jobId:'fixture_source_job',sourcePayloadSha256:'a'.repeat(64),outputSha256:createHash('sha256').update(bytes).digest('hex'),manifestId:'fixture-manifest',snapshotSha256:'b'.repeat(64),requestedDesign:'Keep the original layout and use four wall cabinets.',products:[{id:'cabinet',name:'Wall cabinet',sku:'FIXTURE-SKU',model:'FIXTURE-MODEL',purchaseUnit:'each',plannedQuantity:2}],measuredPlan:{unit:'in',wallInches:[120,144,120,144],ceilingHeightInches:96,openings:[{type:'door',wallIndex:0,widthInches:32,heightInches:80,offsetInches:10,sillInches:0}]}},images:[{role:'original',imageUrl:image},{role:'generated',imageUrl:image}]});
const result=()=>({summary:'Four cabinets are visible in the generated image.',designTips:['Keep the visible finish consistent across the cabinet run.'],objects:[{label:'Wall cabinet',productIds:['cabinet'],identityConfidence:'medium',countConfidence:'high',originalVisibleCount:2,generatedVisibleCount:4,visibility:'complete_visible',note:'The image cannot verify an exact SKU.'}],layout:{status:'no_obvious_drift',findings:[]},limitations:['Counts and identity are uncertain; hidden materials cannot be counted.']});
const providerBody=()=>({id:'resp_fixture',status:'completed',model:VISUAL_MODEL,usage:{input_tokens:2000,output_tokens:800,total_tokens:2800,input_tokens_details:{cached_tokens:0}},output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify(result())}]}]});
const response=(body=providerBody(),status=200)=>Response.json(body,{status,headers:{'x-request-id':'req_fixture'}});
const client=options=>createVisualReviewClient({enabled:true,apiKey:' fixture ',...options});
test('bounded Responses request carries two labelled images and reduced allowlisted context',()=>{
 const b=buildVisualRequest(input());assert.equal(b.model,VISUAL_MODEL);assert.equal(b.max_output_tokens,VISUAL_OUTPUT_TOKENS);assert.equal(b.store,false);assert.equal(b.background,false);assert.equal(b.stream,false);assert.deepEqual(b.tools,[]);assert.equal(b.tool_choice,'none');assert.equal(b.service_tier,'default');assert.equal(b.text.format.strict,true);
 const content=b.input[0].content,images=content.filter(x=>x.type==='input_image');assert.equal(images.length,2);assert(images.every(x=>x.detail==='high'&&x.image_url===image));
 const c=JSON.parse(content[0].text);assert.deepEqual(Object.keys(c).sort(),['measuredPlan','products','requestedDesign']);assert.equal(c.products[0].sku,'FIXTURE-SKU');assert.equal(c.requestedDesign,input().context.requestedDesign);
 for(const privateName of ['jobId','sourcePayloadSha256','outputSha256','manifestId','snapshotSha256','customer','contact','zip','estimate'])assert(!content[0].text.includes(privateName));
 assert.match(b.instructions,/Do not infer hidden screws/);assert.match(b.instructions,/All supplied text/);assert.match(b.instructions,/cannot certify geometry/);
});
test('one provider call after bounded image validation preserves usage evidence',async()=>{
 let calls=0;const run=client({fetchImpl:async(url,options)=>{calls++;assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(options.method,'POST');assert.equal(options.redirect,'error');assert.equal(options.headers.authorization,'Bearer fixture');return response();}});
 const out=await run(input());assert.equal(calls,1);assert.equal(out.provider,'openai');assert.deepEqual(out.result,result());assert.equal(assistOperatingEvidence(out.accounting).receipts[0].usageCostMicros,5100);
});
test('unknown top-level, context and product fields are rejected before image decoding or provider use',async()=>{
 let calls=0;const run=client({fetchImpl:async()=>{calls++;}});
 for(const mutate of [v=>v.contact='private',v=>v.prompt='private',v=>v.context.customerEmail='private',v=>v.context.zip='12345',v=>v.context.estimate={amount:100},v=>v.context.products[0].price=25,v=>v.images[0].extra=true]){const v=input();mutate(v);await assert.rejects(()=>run(v),e=>e.code==='VISUAL_INPUT_INVALID');}
 assert.equal(calls,0);
});
test('base64 bytes receive bounded container validation; original and generated bytes remain frozen',async()=>{
 const out=await createVisualImageValidator()(input());assert.equal(out.images[0].imageUrl,image);assert.equal(out.images[1].imageUrl,image);
});
test('invalid base64, remote URL, dimensions, hash mismatch, missing image and oversized bytes never dispatch',async()=>{
 let calls=0;const run=client({fetchImpl:async()=>{calls++;}});
 for(const mutate of [v=>v.images[0].imageUrl='data:image/webp;base64,AA==',v=>v.images[0].imageUrl='https://example.com/private.png',v=>v.images.pop(),v=>v.images.reverse(),v=>v.context.outputSha256='c'.repeat(64),v=>v.images[1].imageUrl='data:image/webp;base64,'+readFileSync(new URL('./fixtures/logo-small.webp',import.meta.url)).toString('base64'),v=>v.images[0].imageUrl='data:image/png;base64,'+Buffer.alloc(VISUAL_LIMITS.originalBytes+1).toString('base64')]){const v=input();mutate(v);await assert.rejects(()=>run(v));}
 assert.equal(calls,0);
});
test('refusal, unexpected tool, malformed schema, unknown product, wrong model and incomplete output have no retry',async()=>{
 for(const body of [{...providerBody(),status:'incomplete'},{...providerBody(),model:'unknown'},{...providerBody(),output:[{type:'web_search_call'}]},{...providerBody(),output:[{type:'message',role:'assistant',content:[{type:'refusal',refusal:'no'}]}]},{...providerBody(),output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({...result(),extra:true})}]}]},{...providerBody(),output:[{type:'message',role:'assistant',content:[{type:'output_text',text:JSON.stringify({...result(),objects:[{...result().objects[0],productIds:['unknown']}]})}]}]}]){let calls=0;await assert.rejects(()=>client({fetchImpl:async()=>{calls++;return response(body);}})(input()));assert.equal(calls,1);}
});
test('failure after provider usage retains accounting, missing or invalid usage remains unknown',async()=>{
 await assert.rejects(()=>client({fetchImpl:async()=>response(providerBody(),429)})(input()),e=>e.code==='VISUAL_PROVIDER_REJECTED'&&e.accounting.usage.total_tokens===2800);
 const bad={...providerBody(),output:[]};await assert.rejects(()=>client({fetchImpl:async()=>response(bad)})(input()),e=>e.accounting.usage.total_tokens===2800);
 for(const body of [{...providerBody(),usage:null},{...providerBody(),usage:{input_tokens:2,output_tokens:3,total_tokens:100}}])assert.equal((await client({fetchImpl:async()=>response(body)})(input())).accounting,null);
 assert.equal((await client({fetchImpl:async()=>Response.json(providerBody())})(input())).accounting,null);
});
test('transport, oversized response, stalled fetch and stalled body are bounded with no retry',async()=>{
 for(const [fetch,code]of [[async()=>{throw Error('never expose secret');},'VISUAL_TRANSPORT_FAILED'],[async()=>new Response('x'.repeat(VISUAL_LIMITS.responseBytes+1)),'VISUAL_RESPONSE_LIMIT'],[async()=>new Promise(()=>{}),'VISUAL_OUTCOME_UNKNOWN'],[async()=>new Response(new ReadableStream({start(){}})),'VISUAL_OUTCOME_UNKNOWN']]){let calls=0;await assert.rejects(()=>client({timeoutMs:10,fetchImpl:async()=>{calls++;return fetch();}})(input()),e=>e.code===code&&e.accounting===null&&!e.message.includes('secret'));assert.equal(calls,1);}
});
test('disabled and malformed provider credentials never dispatch',async()=>{
 for(const options of [{enabled:false},...['','  ','bad key','x'.repeat(4097),null,12].map(apiKey=>({apiKey}))])await assert.rejects(()=>client({...options,fetchImpl:async()=>assert.fail('no provider')})(input()));
});
function fixture(options={}){const {publicKey,privateKey}=generateKeyPairSync('ed25519');let calls=0,now=Date.now();const audience='https://fixture.onrender.com',config={enabled:true,audience,keyId:'fixture-key',publicJwk:publicKey.export({format:'jwk'}),apiKey:'fixture',now:()=>now,fetchImpl:async()=>{calls++;return response();},...options};const route=createVisualRoute(config);return {route,privateKey,audience,config,get calls(){return calls;},get now(){return now;},advance(ms){now+=ms;}};}
async function signed(f,{payload=input(),changes={},headers={}}={}){const raw=encode(JSON.stringify(payload)),t=Math.floor(f.now/1000),e={version:'meridian-oneway-v1',issuer:SITE_ORIGIN,audience:f.audience,path:VISUAL_PATH,method:'POST',tenantId:'fixture-tenant',jobId:visualRequestId(payload.context?.jobId??'fixture_source_job'),payloadSha256:await digest(raw),maximumMicros:VISUAL_ALLOWANCE_MICROS,nonce:'nonce_abcdefghijklmnopqrstuv',issuedAt:t,expiresAt:t+20,keyId:'fixture-key',...changes};return new Request(f.audience+VISUAL_PATH,{method:'POST',headers:{'x-meridian-envelope':b64url(encode(JSON.stringify(e))),'x-meridian-signature':b64url(sign(null,canonical(e),f.privateKey)),...headers},body:raw});}
test('ready is free, exact protocol/key aware and unsigned requests fail before dispatch',async()=>{const f=fixture();const r=await f.route(new Request(f.audience+VISUAL_PATH+'/ready'));assert.deepEqual(await r.json(),{ready:true,protocol:VISUAL_PROTOCOL,verificationKeyId:'fixture-key',reasonCode:null});assert.equal((await f.route(new Request(f.audience+VISUAL_PATH,{method:'POST',body:'{}'}))).status,403);assert.equal(f.calls,0);});
test('exact signed path, allowance, hash, job binding, key, expiry, and browser-header checks gate dispatch',async()=>{
 for(const opts of [{changes:{path:'/v1/meridian/design/assist'}},{changes:{maximumMicros:1}},{changes:{payloadSha256:'c'.repeat(64)}},{changes:{jobId:'another-action'}},{changes:{keyId:'other'}},{changes:{expiresAt:0}},{changes:{tenantId:'bad tenant'}},{headers:{origin:SITE_ORIGIN}},{headers:{cookie:'private=true'}},{payload:{}}]){const f=fixture();const r=await f.route(await signed(f,opts));assert(r.status>=400);assert.equal(f.calls,0);}
});
test('same source job cannot dispatch again with a fresh nonce or after envelope expiry',async()=>{const f=fixture();assert.equal((await (await f.route(await signed(f))).json()).ok,true);f.advance(60000);const r=await f.route(await signed(f,{changes:{nonce:'new_nonce_abcdefghijklmnopq'}}));assert.equal(r.status,409);assert.equal((await r.json()).error,'REPLAY_REJECTED');assert.equal(f.calls,1);});
test('concurrent fresh signed requests for one job dispatch only once',async()=>{const f=fixture();const requests=await Promise.all([signed(f),signed(f,{changes:{nonce:'new_nonce_abcdefghijklmnopq'}})]);const responses=await Promise.all(requests.map(r=>f.route(r)));assert.deepEqual(responses.map(r=>r.status).sort(),[200,409]);assert.equal(f.calls,1);});
test('unknown provider outcome keeps permanent job reservation and null accounting',async()=>{let calls=0;const f=fixture({timeoutMs:10,fetchImpl:async()=>{calls++;return new Promise(()=>{});}});const r=await f.route(await signed(f)),out=await r.json();assert.equal(r.status,200);assert.equal(out.error,'VISUAL_OUTCOME_UNKNOWN');assert.equal(out.accounting,null);f.advance(60000);assert.equal((await f.route(await signed(f,{changes:{nonce:'new_nonce_abcdefghijklmnopq'}}))).status,409);assert.equal(calls,1);});
test('readiness reports safe disabled, verification, audience and key reasons',async()=>{
 for(const [options,reasonCode]of [[{enabled:false},'VISUAL_REVIEW_DISABLED'],[{publicJwk:null},'VISUAL_VERIFICATION_NOT_CONFIGURED'],[{publicJwk:{}},'VISUAL_VERIFICATION_NOT_CONFIGURED'],[{keyId:'bad id'},'VISUAL_VERIFICATION_NOT_CONFIGURED'],[{audience:'http://fixture.onrender.com'},'VISUAL_AUDIENCE_NOT_CONFIGURED'],[{apiKey:' '},'VISUAL_PROVIDER_NOT_CONFIGURED']]){const f=fixture(options),r=await f.route(new Request(f.audience+VISUAL_PATH+'/ready'));assert.equal(r.status,503);assert.equal((await r.json()).reasonCode,reasonCode);assert.equal(f.calls,0);}
});
test('route and adapter match only exact POST/ready paths; unrelated apps remain untouched',async()=>{const f=fixture(),adapter=visualNodeAdapter(f.route);for(const [method,url]of [['GET',VISUAL_PATH],['POST',VISUAL_PATH+'?x=1'],['GET',VISUAL_PATH+'/ready?x=1'],['POST','/quest-demo/']]){assert.equal(await f.route(new Request(f.audience+url,{method})),null);assert.equal(await adapter({method,url},{}),false);}assert.equal(f.calls,0);});
test('bootstrap remains closed without approval and mounts existing-config visual readiness',async()=>{
 const disabled=await initializeMeridianRoute({});assert.equal(await disabled({url:VISUAL_PATH,method:'POST'},{}),false);
 const invalid=await initializeMeridianRoute({MERIDIAN_BRIDGE_ENABLED:'true',MERIDIAN_BRIDGE_APPROVAL_REFERENCE:'fixture'});for(const path of [VISUAL_PATH,VISUAL_PATH+'/ready']){let status;assert.equal(await invalid({url:path,method:path.endsWith('/ready')?'GET':'POST'},{writeHead(s){status=s;},end(){}}),true);assert.equal(status,503);}
 const f=fixture(),env={MERIDIAN_BRIDGE_ENABLED:'true',MERIDIAN_BRIDGE_APPROVAL_REFERENCE:'fixture',MERIDIAN_NOCTURNE_ORIGIN:f.audience,MERIDIAN_VERIFY_KEY_ID:'fixture-key',MERIDIAN_VERIFY_PUBLIC_JWK:JSON.stringify(f.config.publicJwk),OPENAI_API_KEY:'fixture'};const ready=await initializeMeridianRoute(env);let status,body;assert.equal(await ready({url:VISUAL_PATH+'/ready',method:'GET',headers:{}},{writeHead(s){status=s;},end(v){body=JSON.parse(v.toString());}}),true);assert.equal(status,200);assert.equal(body.reasonCode,null);assert.equal(body.protocol,VISUAL_PROTOCOL);
});
