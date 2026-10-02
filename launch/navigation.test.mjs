import test from 'node:test';
import assert from 'node:assert/strict';
import {withNavigation} from './navigation.mjs';
import {screenKey,readNavigationState,writeNavigationState} from './navigation-state.js';
const source='<!doctype html><html><head><title>Screen</title></head><body><main>Test</main></body></html>';
const storage=()=>{const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)}};
test('shared navigation is injected once, including Buffer responses',()=>{
 const html=withNavigation(Buffer.from(source),'/live/');
 assert.match(html,/navigation\.js\?v=0592/);assert.match(html,/data-screen="live" aria-current="page"/);
 assert.equal(withNavigation(html,'/live/'),html);
});
test('all public UI surfaces have a route back to Home',()=>{
 for(const route of ['/','/experience/','/live/','/vr/','/world/','/player/','/matrix/','/nps/','/commission/','/director/','/video-router/','/photo-space/','/travel/','/venice-setup/','/app/','/launcher/']){
  const html=withNavigation(source,route);assert.match(html,/href="\/" data-screen="home"/);assert.match(html,/href="\/experience\/\?panel=settings"/);
 }
});
test('navigation never interpolates untrusted URL data into HTML',()=>{
 assert.equal(withNavigation(source,'/live/?x=%22%3E%3Cscript%3E'),withNavigation(source,'/live/'));
 assert.equal(withNavigation('plain text','/'),'plain text');
});
test('home aliases share one UI snapshot',()=>{assert.equal(screenKey('/'),'home');assert.equal(screenKey('/experience/'),'home');assert.equal(screenKey('/live/'),'live')});
test('per-tab snapshot round-trip and expiry',()=>{
 const s=storage();assert.equal(writeNavigationState('screen.home',{draft:'hello'},s,100),true);
 assert.deepEqual(readNavigationState('screen.home',s,200),{draft:'hello'});
 assert.equal(readNavigationState('screen.home',s,99),null);
 assert.equal(readNavigationState('screen.home',s,100+13*3600000),null);
});
test('blocked or corrupt storage cannot break navigation',()=>{
 const s={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 assert.equal(readNavigationState('x',s),null);assert.equal(writeNavigationState('x',{},s),false);
 assert.equal(readNavigationState('x',{getItem:()=>'{bad'}),null);
});
test('navigation state does not write relationship or permission keys',()=>{
 const keys=[];writeNavigationState('screen.live',{draft:'hello'},{setItem:(k)=>keys.push(k)});
 assert.deepEqual(keys,['nocturne.navigation.v1.screen.live']);
});
