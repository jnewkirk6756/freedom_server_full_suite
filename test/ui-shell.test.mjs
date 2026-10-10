import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {withNavigation} from '../launch/navigation.mjs';
const ctx=vm.createContext({});vm.runInContext(readFileSync(new URL('../launch/ui-shell-core.js',import.meta.url),'utf8'),ctx);
const viewport=(data)=>JSON.parse(JSON.stringify(ctx.NocturneUICore.viewportState({layoutWidth:390,layoutHeight:844,visualHeight:844,...data})));
test('ordinary phone viewport keeps navigation visible',()=>{assert.deepEqual(viewport({editable:true}),{visibleHeight:844,keyboardInset:0,keyboardOpen:false,menuKeyboardOpen:false})});
test('text keyboard gives a composer space without covering it with bottom navigation',()=>{assert.equal(viewport({editable:true,visualHeight:490}).keyboardOpen,true)});
test('screen-search keyboard keeps the More menu visible and lifts it above the keyboard',()=>{
 const state=viewport({editable:true,insideNavigation:true,visualHeight:490});assert.equal(state.keyboardOpen,false);assert.equal(state.menuKeyboardOpen,true);assert.equal(state.keyboardInset,354);
});
test('browser controls and pinch offset are not mistaken for a keyboard',()=>{
 assert.equal(viewport({editable:true,visualHeight:720}).keyboardOpen,false);assert.equal(viewport({editable:true,visualHeight:500,offsetTop:300}).keyboardOpen,false);assert.equal(viewport({editable:false,visualHeight:300}).keyboardOpen,false);
});
test('desktop viewport and invalid measurements cannot hide the navigation',()=>{
 assert.equal(viewport({layoutWidth:1200,editable:true,visualHeight:400}).keyboardOpen,false);assert.equal(viewport({layoutWidth:NaN,editable:true,visualHeight:400}).keyboardOpen,false);assert.equal(viewport({visualHeight:NaN}).visibleHeight,844);
});
test('all screens get safe shell identifiers, accessible search and correctly ordered scripts',()=>{
 const doc='<html><head></head><body><main></main></body></html>';
 for(const route of ['/','/live/','/vr/','/devices/','/model-viewer/','/world/']){
  const html=withNavigation(doc,route);assert.match(html,/data-nocturne-screen="[a-z-]+"/);assert.match(html,/aria-controls="nocturne-menu-content" aria-expanded="false"/);assert.match(html,/label for="nocturne-screen-filter"/);assert.match(html,/href="\/model-viewer\/"/);
  assert.ok(html.indexOf('/ui-shell-core.js')<html.indexOf('/ui-shell.js'));
 }
 const hostile=withNavigation(doc,'/\"%3E%3Cscript%3E/');assert.match(hostile,/data-nocturne-screen="more"/);assert.doesNotMatch(hostile,/%3Cscript%3E/);
});
test('shell has visual viewport, focus restoration, reduced motion and search-menu wiring',()=>{
 const js=readFileSync(new URL('../launch/ui-shell.js',import.meta.url),'utf8'),css=readFileSync(new URL('../launch/ui-shell.css',import.meta.url),'utf8');
 assert.match(js,/insideNavigation:nav.contains\(document.activeElement\)/);assert.match(js,/if\(opener\?\.isConnected\)opener.focus\(\)/);assert.match(js,/node.inert=true/);assert.match(js,/node.inert=false/);assert.match(css,/nocturne-menu-keyboard-open/);assert.match(css,/prefers-reduced-motion:reduce/);
});
