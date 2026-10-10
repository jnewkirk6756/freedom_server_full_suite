/* Browser release gates. Backend replies are mocks; external requests are denied.
 * Screenshot artifacts contain only the neutral cube/sphere/prism viewer.
 * This suite is additional to foundation-browser.cjs, not a hardware certificate. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const fs=require('node:fs');
const routes=['/','/live/','/devices/','/vr/','/model-viewer/','/world/','/player/','/matrix/','/nps/','/commission/','/director/','/video-router/','/photo-space/','/travel/','/venice-setup/','/app/','/launcher/'];
(async()=>{
 const child=spawn(process.execPath,['launch/server.mjs'],{env:{PATH:process.env.PATH,HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
 let output='',browser,passed=0;
 const url=await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Server startup timed out')),5000);
  child.stdout.on('data',data=>{output+=data;const match=output.match(/BOUND_PORT=(\d+)/);if(match){clearTimeout(timeout);resolve('http://127.0.0.1:'+match[1])}});
  child.once('exit',()=>{clearTimeout(timeout);reject(Error('Server exited before startup'))});
 });
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['phone',{width:390,height:844}],['narrow',{width:320,height:640}],['landscape',{width:844,height:390}]]){
   const context=await browser.newContext({viewport,serviceWorkers:'block'});
   await context.route('**/*',async route=>{
    const target=new URL(route.request().url());if(target.origin!==url)return route.abort();
    if(target.pathname.startsWith('/v1/')){
     const body=target.pathname==='/v1/director/status'?{ok:true,openAIConfigured:false,sessionToken:'mock-test-only'}:{ok:true,states:[],configured:false,connected:false};
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
    }
    if(target.pathname.startsWith('/media/'))return route.fulfill({status:404,body:'No test media'});
    return route.continue();
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(page.url()+': '+error.message));
   for(const path of routes){
    await page.goto(url+path);await page.locator('#nocturne-navigation').waitFor();
    await page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close()));
    assert.equal(await page.locator('#nocturne-navigation').count(),1,name+path);
    const box=await page.locator('#nocturne-navigation').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width+1,name+path+' navigation bounds');
    for(const tab of await page.locator('#nocturne-navigation > a,#nocturne-screen-menu > summary').all()){
     const rect=await tab.boundingBox();assert.ok(rect.width>=44&&rect.height>=44,name+path+' touch target');
    }
   }
   await page.goto(url+'/');await page.locator('#settings').click();await page.waitForFunction(()=>document.querySelector('#panel')?.getAttribute('aria-modal')==='true');
   assert.equal(await page.evaluate(()=>document.querySelector('#panel').contains(document.activeElement)),true,name+' settings focus');
   await page.keyboard.press('Escape');await page.waitForFunction(()=>document.querySelector('#panel').hidden);
   assert.equal(await page.evaluate(()=>document.activeElement.id),'settings',name+' focus restored');
   await page.locator('#nocturne-screen-menu > summary').click();await page.locator('#nocturne-screen-filter').fill('model');
   assert.equal(await page.locator('[data-screen-link]:visible').count(),1,name+' screen filter');
   if(viewport.width<=600){
    // Synthetic VisualViewport tests complement, and do not replace, real iOS keyboard checks.
    await page.evaluate(()=>{
     const vv=new EventTarget();Object.assign(vv,{height:Math.max(250,innerHeight-300),offsetTop:0});Object.defineProperty(window,'visualViewport',{configurable:true,value:vv});
     document.getElementById('nocturne-screen-filter').focus();window.dispatchEvent(new Event('resize'));
    });
    assert.equal(await page.locator('#nocturne-screen-filter').isVisible(),true,name+' search survives keyboard');
    assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('nocturne-menu-keyboard-open')),true);
   }
   await page.locator('#nocturne-close-menu').click();await page.locator('#nocturne-screen-menu > summary').click();await page.locator('#nocturne-display-preferences').click();
   await page.locator('#nocturne-high-contrast').check();await page.locator('#nocturne-preferences button').click();await page.reload();
   await page.waitForFunction(()=>document.documentElement.dataset.nocturneContrast==='high');
   await page.goto(url+'/model-viewer/');await page.waitForFunction(()=>document.querySelector('#model-viewer').dataset.contextState==='ready');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,name+' viewer horizontal overflow');
   assert.equal(await page.evaluate(()=>document.querySelector('.nocturne-skip').getBoundingClientRect().bottom<=0),true,name+' unfocused skip link stays outside the viewport');
   const before=await page.evaluate(()=>NocturneModelViewer.getState().transform);
   await page.locator('#model-canvas').focus();await page.keyboard.press('ArrowRight');
   assert.notEqual((await page.evaluate(()=>NocturneModelViewer.getState().transform)).rotation.y,before.rotation.y);
   await page.locator('[data-viewer-shape="sphere"]').click();await page.locator('[data-viewer-material="gloss"]').click();await page.locator('#viewer-rendering-options > summary').click();await page.locator('#viewer-quality').selectOption('high');
   await page.evaluate(()=>{
    const canvas=document.getElementById('model-canvas');
    const pointer=(type,id,x,y)=>canvas.dispatchEvent(new PointerEvent(type,{pointerId:id,pointerType:'touch',clientX:x,clientY:y,bubbles:true,cancelable:true}));
    pointer('pointerdown',1,80,120);pointer('pointerdown',2,160,120);pointer('pointermove',2,200,120);pointer('pointercancel',1,80,120);pointer('pointercancel',2,200,120);
   });
   assert.ok((await page.evaluate(()=>NocturneModelViewer.getState().transform)).scale>1,name+' pinch scale');
   await page.locator('#reset-model').click();assert.equal((await page.evaluate(()=>NocturneModelViewer.getState().transform)).scale,1,name+' reset');
   await page.emulateMedia({reducedMotion:'reduce'});await page.waitForFunction(()=>document.getElementById('auto-rotate').disabled);assert.equal(await page.locator('#auto-rotate').isChecked(),false);
   const beforeLoss=await page.evaluate(()=>NocturneModelViewer.getState().transform);
   await page.evaluate(()=>{const gl=document.getElementById('model-canvas').getContext('webgl');window.testContextLoss=gl.getExtension('WEBGL_lose_context');if(!window.testContextLoss)throw Error('Context-loss extension unavailable');window.testContextLoss.loseContext()});
   await page.waitForFunction(()=>document.querySelector('#model-viewer').dataset.contextState==='lost');await page.evaluate(()=>window.testContextLoss.restoreContext());
   await page.waitForFunction(()=>document.querySelector('#model-viewer').dataset.contextState==='ready');assert.deepEqual(await page.evaluate(()=>NocturneModelViewer.getState().transform),beforeLoss);
   await page.evaluate(()=>window.scrollTo(0,0));
   fs.mkdirSync('reports',{recursive:true});await page.screenshot({path:'reports/neutral-model-'+name+'.png',fullPage:true});
   assert.deepEqual(errors,[],name+' page errors');console.log('PASS '+name+' navigation, focus, preferences, neutral viewer and recovery');passed++;
   await context.close();
  }
  console.log('UI_BROWSER '+passed+'/4 PASS; real iPhone and Quest still require hardware checks');
 }finally{await browser?.close();if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}}
})().catch(error=>{console.error(error);process.exitCode=1});
