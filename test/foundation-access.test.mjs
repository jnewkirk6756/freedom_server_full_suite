import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccessPolicy} from '../launch/access-policy.mjs';

// Deliberately public test fixture. Never a deployment credential.
const password='public-test-fixture-not-a-secret';
const auth='Basic '+Buffer.from('owner:'+password).toString('base64');
const request=(overrides={})=>({method:'GET',headers:{host:'localhost:8787'},socket:{remoteAddress:'127.0.0.1'},...overrides});
const privatePolicy=()=>createAccessPolicy({NOCTURNE_ACCESS_PASSWORD:password},{bindHost:'0.0.0.0'});
test('unconfigured public server fails closed except health and robots',()=>{
 const p=createAccessPolicy({}, {bindHost:'0.0.0.0'});
 for(const path of ['/','/live/','/navigation.js','/v1/director/status','/v1/media/status','/media/A01.mp4'])assert.equal(p.check(request(),path).status,503,path);
 assert.equal(p.check(request(),'/v1/health').allowed,true);
 assert.equal(p.check(request(),'/robots.txt').allowed,true);
 assert.equal(p.check(request({method:'POST'}),'/v1/health').allowed,false);
});
test('local credential-free preview can read the shell but no backend or media',()=>{
 const p=createAccessPolicy();
 for(const path of ['/','/vr/','/navigation.js'])assert.equal(p.check(request(),path).allowed,true);
 for(const path of ['/api','/api/status','/v1/director/status','/media/A01.mp4'])assert.equal(p.check(request(),path).allowed,false);
 assert.equal(p.check(request({method:'POST'}),'/').allowed,false);
});
test('production or Render never gets the local preview bypass',()=>{
 for(const env of [{NODE_ENV:'production'},{RENDER:'true'}])assert.equal(createAccessPolicy(env).check(request(),'/').allowed,false);
 assert.equal(createAccessPolicy().check(request({socket:{remoteAddress:'203.0.113.1'}}),'/').allowed,false);
});
test('short and missing owner passwords do not open the app',()=>{
 for(const value of ['','short'])assert.equal(createAccessPolicy({NOCTURNE_ACCESS_PASSWORD:value},{bindHost:'0.0.0.0'}).check(request(),'/').status,503);
});
test('owner Basic auth unlocks a private response and is never returned',()=>{
 const p=privatePolicy(),good=p.check(request({headers:{authorization:auth}}),'/');
 assert.equal(good.allowed,true);assert.equal(good.private,true);
 assert.equal(JSON.stringify(good).includes(password),false);
 assert.equal(p.check(request(),'/').status,401);
 assert.match(p.check(request(),'/').headers['www-authenticate'],/^Basic /);
 for(const value of ['Bearer '+password,'Basic !!!', 'Basic '+Buffer.from('wrong:'+password).toString('base64'),'Basic '+Buffer.from('owner:wrong').toString('base64'),'x'.repeat(3000)])assert.equal(p.check(request({headers:{authorization:value}}),'/').allowed,false);
});
test('media mutation is disabled even for an authenticated owner by default',()=>{
 const p=privatePolicy();
 for(const method of ['PUT','POST','DELETE'])assert.equal(p.check(request({method,headers:{authorization:auth}}),'/v1/media/A01').code,'SHARED_MEDIA_WRITES_DISABLED');
 assert.equal(p.check(request({headers:{authorization:auth}}),'/v1/media/manifest').allowed,true);
});
test('explicit shared-write opt-in still needs owner auth',()=>{
 const p=createAccessPolicy({NOCTURNE_ACCESS_PASSWORD:password,NOCTURNE_ALLOW_SHARED_MEDIA_WRITES:'1'});
 assert.equal(p.check(request({method:'PUT',headers:{authorization:auth}}),'/v1/media/A01').allowed,true);
 assert.equal(p.check(request({method:'PUT'}),'/v1/media/A01').status,401);
});
test('cross-site writes fail before route handlers',()=>{
 const p=privatePolicy();
 for(const extra of [{'sec-fetch-site':'cross-site'},{origin:'https://evil.invalid'},{origin:'null'},{origin:'file://localhost:8787'}])assert.equal(p.check(request({method:'POST',headers:{authorization:auth,host:'localhost:8787',...extra}}),'/v1/example').code,'CROSS_ORIGIN_WRITE');
 assert.equal(p.check(request({method:'POST',headers:{authorization:auth,host:'localhost:8787',origin:'http://localhost:8787'}}),'/v1/example').allowed,true);
});
test('configured public origin pins write origin scheme and authority',()=>{
 const p=createAccessPolicy({NOCTURNE_ACCESS_PASSWORD:password,NOCTURNE_PUBLIC_ORIGIN:'https://preview.example.invalid'});
 assert.equal(p.check(request({method:'POST',headers:{authorization:auth,host:'preview.example.invalid',origin:'http://preview.example.invalid'}}),'/v1/example').allowed,false);
 assert.equal(p.check(request({method:'POST',headers:{authorization:auth,origin:'https://preview.example.invalid'}}),'/v1/example').allowed,true);
});
