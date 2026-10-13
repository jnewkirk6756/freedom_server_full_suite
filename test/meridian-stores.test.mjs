import test from 'node:test';import assert from 'node:assert/strict';import {generateKeyPairSync,sign} from 'node:crypto';
import {createMaterialLookupClient,MATERIAL_STORE_DOMAINS} from '../launch/meridian/material-search-client.mjs';
import {createMaterialRoute,MATERIAL_PATH} from '../launch/meridian/nocturne/material-route.mjs';
import {RETAILER_IDS,isRetailerProductURL} from '../launch/meridian/shared/store-catalog.mjs';
import {canonical,b64url,digest,encode,SITE_ORIGIN,VERSION} from '../launch/meridian/shared/protocol.mjs';
import {storeFixtureURLs,mockProductProvider} from './store-fixtures.mjs';
for(const [storeId,url]of Object.entries(storeFixtureURLs))test(storeId+' selected-source pipeline binds citation, identifier and max-one search',async()=>{
 const fake=mockProductProvider({storeId,url}),client=createMaterialLookupClient({enabled:true,getApiKey:()=> 'mock_test_key',fetchImpl:fake.fetchImpl,log:()=>{}});
 const result=await client.lookup({selectedStoreIds:[storeId],designBrief:'Use Test Product',productSelections:[{storeId,sku:'ABC123'}]});
 assert.equal(result.requestedProductsComplete,true);assert.equal(result.products[0].storeId,storeId);assert.equal(result.products[0].sku,'ABC123');assert.equal(result.products[0].url,url);assert.equal(result.products[0].availability,'unknown');assert.equal(result.evidence[0].kind,'search_index');assert.equal(fake.requests.length,2);
 assert.deepEqual(fake.requests[0].tools[0].filters.allowed_domains,[MATERIAL_STORE_DOMAINS[storeId]]);assert.equal(fake.requests[0].max_tool_calls,1);assert.equal(fake.requests[1].tools.length,0);assert.match(JSON.parse(fake.requests[0].input).selectedSources[0].productPathHint,/\//);assert.equal(isRetailerProductURL(url,storeId),true);
});
test('unsupported manufacturer, four stores and duplicates stop before any provider call',async()=>{
 const fake=mockProductProvider(),client=createMaterialLookupClient({enabled:true,getApiKey:()=> 'mock_test_key',fetchImpl:fake.fetchImpl,log:()=>{}});
 for(const ids of [['trex'],['timbertech'],['belgard'],RETAILER_IDS.slice(0,4),['ikea','ikea']])await assert.rejects(()=>client.lookup({selectedStoreIds:ids,designBrief:'Sofa'}),e=>e.code==='MATERIAL_LOOKUP_INPUT_INVALID');assert.equal(fake.requests.length,0);
});
test('uncited, category, spoofed and unselected product sources never become new-store products',async()=>{
 for(const url of ['https://www.westelm.com/shop/furniture/','https://www.westelm.com.evil.test/products/sofa/','https://evil.westelm.com/products/sofa/','https://www.ikea.com/us/en/p/test-12345678/']){
 const fake=mockProductProvider({url}),client=createMaterialLookupClient({enabled:true,getApiKey:()=> 'mock_test_key',fetchImpl:fake.fetchImpl,log:()=>{}});
 const result=await client.lookup({selectedStoreIds:['west-elm'],designBrief:'Sofa',productSelections:[{storeId:'west-elm',sku:'ABC123'}]});assert.equal(result.requestedProductsComplete,false);assert.equal(result.products.length,0);assert.equal(fake.requests.length,1);
 }
});
test('starting prices, samples and financing preserve identity but discard unproven price',async()=>{
 for(const quote of ['Test Product SKU ABC123 from $29.99 each.','Test Product SKU ABC123 sample $29.99 each.','Test Product SKU ABC123 financing $29.99 each.','Test Product SKU ABC123 members-only $29.99 each.','Test Product SKU ABC123 $29.99 per month each.']){const fake=mockProductProvider({quote}),client=createMaterialLookupClient({enabled:true,getApiKey:()=> 'mock_test_key',fetchImpl:fake.fetchImpl,log:()=>{}});const result=await client.lookup({selectedStoreIds:['west-elm'],designBrief:'Sofa'});assert.equal(result.products[0].unitPriceCents,null);assert.equal(result.products[0].priceUnit,null);}
});
test('signed Node route accepts expanded store and rejects replay without another provider request',async()=>{
 const {publicKey,privateKey}=generateKeyPairSync('ed25519'),now=Date.now(),audience='https://staging.onrender.com',fake=mockProductProvider();
 const route=createMaterialRoute({enabled:true,audience,keyId:'key_one',publicJwk:publicKey.export({format:'jwk'}),apiKey:'mock_test_key',fetchImpl:fake.fetchImpl,now:()=>now});
 const body={selectedStoreIds:['west-elm'],zip:null,prompt:'Test Product sofa',materialTier:'mid_grade',mode:'quick_concept',productSelections:[{storeId:'west-elm',sku:'ABC123'}]},raw=encode(JSON.stringify(body));
 const envelope={version:VERSION,issuer:SITE_ORIGIN,audience,path:MATERIAL_PATH,method:'POST',tenantId:'tenant',jobId:'job_one',payloadSha256:await digest(raw),maximumMicros:100000,nonce:'test_nonce_12345678901234567890',issuedAt:Math.floor(now/1000),expiresAt:Math.floor(now/1000)+20,keyId:'key_one'};
 const headers={'content-type':'application/json','x-meridian-envelope':b64url(encode(JSON.stringify(envelope))),'x-meridian-signature':sign(null,canonical(envelope),privateKey).toString('base64url')};
 const request=()=>new Request(audience+MATERIAL_PATH,{method:'POST',headers,body:raw});const response=await route(request());assert.equal(response.status,200);const result=await response.json();assert.equal(result.ok,true);assert.equal(result.products[0].storeId,'west-elm');assert.equal((await route(request())).status,409);assert.equal(fake.requests.length,2);
});
