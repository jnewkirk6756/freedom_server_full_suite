/* Ordinary UI smoke tests. Every backend response is mocked; no provider calls. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const {once}=require('node:events');
const fs=require('node:fs');
(async()=>{
 const child=spawn(process.execPath,['launch/server.mjs'],{env:{PATH:process.env.PATH,HOST:'127.0.0.1',PORT:'0'},stdio:['ignore','pipe','pipe']});
 let output='';const url=await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>{child.kill();reject(Error('Server startup timed out'));},5000);
  child.stdout.on('data',d=>{output+=d;const m=output.match(/BOUND_PORT=(\d+)/);if(m){clearTimeout(timer);resolve('http://127.0.0.1:'+m[1]);}});
  child.once('exit',()=>{clearTimeout(timer);reject(Error('Server exited before startup'));});
 });
 let browser;let passed=0;
 try{
  browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{})});
  for(const [label,viewport,blocked] of [['desktop',{width:1440,height:1000},false],['mobile',{width:390,height:844},false],['narrow',{width:320,height:640},false],['blocked-storage',{width:390,height:844},true]]){
   const context=await browser.newContext({viewport});
   if(blocked)await context.addInitScript(()=>{for(const name of ['localStorage','sessionStorage'])Object.defineProperty(window,name,{configurable:true,get(){throw new DOMException('blocked','SecurityError');}});});
   await context.route('**/*',async route=>{
    const request=route.request(),target=new URL(request.url());
    if(target.origin!==url)return route.abort();
    if(target.pathname.startsWith('/v1/')){
     const response=target.pathname==='/v1/director/status'?{ok:true,openAIConfigured:false,sessionToken:'test-only-mock-session'}:target.pathname==='/v1/media/status'?{ok:true,configured:false,connected:false}: {ok:true,states:[],configured:false,connected:false};
     return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(response)});
    }
    if(target.pathname.startsWith('/media/'))return route.fulfill({status:404,body:'No test media'});
    return route.continue();
   });
   const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(url);await page.locator('#nocturne-navigation').waitFor();
   await page.waitForFunction(()=>document.querySelector('#presence')?.textContent!=='CONNECTING');
   assert.equal(await page.locator('#nocturne-navigation').count(),1,label);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,label+' horizontal overflow');
   await page.locator('#settings').click();assert.equal(await page.locator('#panel').isVisible(),true,label);await page.locator('#close').click();
   await page.locator('#message').fill('Neutral unsent draft');
   await page.locator('#nocturne-screen-menu>summary').click();assert.equal(await page.locator('.nocturne-menu-panel').isVisible(),true,label);
   await page.keyboard.press('Escape');assert.equal(await page.locator('.nocturne-menu-panel').isVisible(),false,label);
   if(!blocked){await page.reload();await page.waitForFunction(()=>document.querySelector('#message')?.value==='Neutral unsent draft');}
   if(blocked)assert.match(await page.locator('#nocturne-storage-warning').innerText(),/only last on this page/);
   assert.deepEqual(errors,[],label+' page errors');
   fs.mkdirSync('reports',{recursive:true});await page.screenshot({path:'reports/home-'+label+'.png',fullPage:true});
   console.log('PASS '+label+' startup, settings, More menu, draft and storage warning');passed++;
   await context.close();
  }
  console.log('BROWSER_SMOKE '+passed+'/4 PASS');
 }finally{
  await browser?.close();if(child.exitCode===null){const done=once(child,'exit');child.kill();await done;}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
