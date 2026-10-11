/* Real browser decode checks for bundled neutral stills only.
 * Backend traffic is mocked; external browser requests are denied. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const fs=require('node:fs');
(async()=>{
 const child=spawn(process.execPath,['launch/server.mjs'],{env:{PATH:process.env.PATH,HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
 let output='',browser;
 const url=await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Server startup timed out')),5000);
  child.stdout.on('data',data=>{output+=data;const match=output.match(/BOUND_PORT=(\d+)/);if(match){clearTimeout(timeout);resolve('http://127.0.0.1:'+match[1])}});
  child.once('exit',()=>{clearTimeout(timeout);reject(Error('Server exited before startup'))});
 });
 async function context(options={}){
  const ctx=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,hasTouch:true,serviceWorkers:'block',...options});
  await ctx.route('**/*',route=>{
   const target=new URL(route.request().url());if(target.origin!==url)return route.abort();
   if(target.pathname.startsWith('/v1/'))return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(target.pathname==='/v1/director/status'?{ok:true,openAIConfigured:false,sessionToken:'mock-test-only'}:{ok:true,states:[],configured:false,connected:false})});
   if(target.pathname.startsWith('/media/'))return route.fulfill({status:404,body:'No test media'});
   return route.continue();
  });
  return ctx;
 }
 const waitPortrait=(page,id)=>page.waitForFunction(id=>document.getElementById('anna-poster')?.dataset.portrait===id,id);
 const dismiss=page=>page.evaluate(()=>document.querySelectorAll('dialog[open]').forEach(dialog=>dialog.close()));
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['phone',{width:390,height:844}],['narrow',{width:320,height:640}],['landscape',{width:844,height:390}]]){
   const ctx=await context({viewport}),page=await ctx.newPage(),errors=[],requests=[];
   page.on('pageerror',error=>errors.push(error.message));page.on('request',request=>{if(request.url().includes('/portraits/'))requests.push(request.url())});
   await page.goto(url+'/live/');await waitPortrait(page,'calm');await dismiss(page);
   const result=await page.evaluate(async()=>{const image=document.getElementById('anna-poster');await image.decode();return{width:image.naturalWidth,height:image.naturalHeight,gridCount:(await NocturneFacePack.list()).length,fit:getComputedStyle(image).objectFit,opacity:getComputedStyle(image).opacity,issue:document.getElementById('nocturne-navigation-state').textContent}});
   assert.deepEqual(result,{width:944,height:1667,gridCount:0,fit:'cover',opacity:'1',issue:'More'},name+' fresh-device portrait');
   assert.equal(await page.locator('#empty').isVisible(),false,name+' decoded portrait has no empty-state overlay');
   assert.ok(requests.every(request=>request.endsWith('/neutral-20261011.webp')),name+' no unselected image requested');
   const picker=await page.locator('#neutral-portrait-select').boundingBox();assert.ok(picker.width<=viewport.width&&picker.height>=44,name+' accessible native picker');
   fs.mkdirSync('reports',{recursive:true});await page.locator('#anna-poster').screenshot({path:'reports/neutral-portrait-'+name+'.png'});
   await page.locator('#neutral-portrait-select').selectOption('friendly');await waitPortrait(page,'friendly');
   assert.equal(await page.evaluate(async()=>{const image=document.getElementById('anna-poster');await image.decode();return image.naturalHeight}),1666);
   await page.reload();await waitPortrait(page,'friendly');assert.equal(await page.locator('#neutral-portrait-select').inputValue(),'friendly');
   await page.goto(url+'/vr/');await page.waitForFunction(()=>NocturneNeutralPortrait.selected()==='friendly');
   assert.deepEqual(await page.evaluate(async()=>{const image=await NocturneNeutralPortrait.load();return[image.naturalWidth,image.naturalHeight]}),[944,1666]);
   await page.waitForFunction(()=>Array.from(document.querySelectorAll('canvas')).some(canvas=>canvas.width===720&&canvas.height===1200&&canvas.style.left==='-10000px'));
   assert.deepEqual(errors,[],name+' page errors');await ctx.close();console.log('PASS '+name+' portrait decode, manual selection, reload and VR fallback');
  }
  {
   const ctx=await context();await ctx.addInitScript(()=>{
    localStorage.setItem('portrait-test-existing-preference','keep');
    Object.defineProperty(window,'indexedDB',{get(){throw Error('Synthetic blocked image database')}});
   });
   const page=await ctx.newPage();await page.goto(url+'/live/');await waitPortrait(page,'calm');
   assert.equal(await page.evaluate(()=>localStorage.getItem('portrait-test-existing-preference')),'keep');
   await page.waitForFunction(()=>document.getElementById('nocturne-runtime-message').dataset.status.includes('storage-unavailable'));
   assert.equal(await page.evaluate(()=>document.getElementById('anna-poster').naturalWidth),944);await ctx.close();console.log('PASS portrait without IndexedDB; storage warning preserved');
  }
  {
   const ctx=await context(),page=await ctx.newPage();let fail=true;
   await page.route('**/portraits/*.webp',route=>fail?route.abort():route.continue());
   await page.goto(url+'/live/');await page.waitForFunction(()=>document.getElementById('nocturne-runtime-message').dataset.status.includes('portrait-unavailable'));await dismiss(page);
   const old=await page.evaluate(()=>({src:document.getElementById('anna-poster').getAttribute('src'),width:document.getElementById('anna-poster').naturalWidth}));assert.match(old.src,/^data:image\/jpeg/);assert.equal(old.width,120);
   assert.equal(await page.locator('#anna-poster').getAttribute('data-portrait'),null,'failed initial load does not apply loaded-portrait styling');
   fail=false;await page.locator('#neutral-portrait-select').selectOption('friendly');await waitPortrait(page,'friendly');await ctx.close();console.log('PASS failed request retains basic portrait and explicit selection recovers');
  }
  {
   const ctx=await context(),page=await ctx.newPage();await page.goto(url+'/live/');await waitPortrait(page,'calm');await dismiss(page);
   await page.evaluate(async()=>{
    const grid=document.createElement('canvas');grid.width=500;grid.height=200;const draw=grid.getContext('2d');draw.fillStyle='#228866';draw.fillRect(0,0,500,200);
    const blob=await new Promise(resolve=>grid.toBlob(resolve,'image/png'));await NocturneFacePack.putGrid(1,blob,{name:'neutral-solid-grid-test'});
   });
   // Boot renders persisted imports; the low-level storage API is not the UI import action.
   await page.reload();await waitPortrait(page,'calm');await dismiss(page);
   await page.waitForFunction(()=>document.getElementById('anna-face').dataset.faceGrid==='1');
   await page.locator('#neutral-portrait-select').selectOption('friendly');await waitPortrait(page,'friendly');
   const preserved=await page.evaluate(async()=>{const face=document.getElementById('anna-face');return{grids:(await NocturneFacePack.list()).length,pixel:Array.from(face.getContext('2d').getImageData(10,10,1,1).data),layer:Number(getComputedStyle(face).zIndex)>Number(getComputedStyle(document.getElementById('anna-poster')).zIndex)}});
   assert.equal(preserved.grids,1);assert.deepEqual(preserved.pixel,[34,136,102,255]);assert.equal(preserved.layer,true);await ctx.close();console.log('PASS synthetic local grid remains stored and in front of bundled portrait');
  }
  console.log('PORTRAIT_BROWSER 7/7 PASS; no physical phone or headset certification');
 }finally{await browser?.close();if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}}
})().catch(error=>{console.error(error);process.exitCode=1});
