(function(){
  let lastError='';
  function line(msg){
    const el=document.getElementById('last-line');
    if(el)el.textContent=msg;
    document.documentElement.dataset.liveBoot='error';
  }
  window.addEventListener('error',e=>{lastError=String(e.message||'Live runtime error').slice(0,180);line('Live error · '+lastError)});
  window.addEventListener('unhandledrejection',e=>{lastError=String(e.reason?.message||e.reason||'Live promise error').slice(0,180);line('Live error · '+lastError)});
  window.addEventListener('DOMContentLoaded',()=>{
    document.documentElement.dataset.liveBoot='loading';
    setTimeout(()=>{
      if(window.__NOCTURNE_MOBILE_READY__){document.documentElement.dataset.liveBoot='ready';return}
      line(lastError?('Live failed · '+lastError):'Live did not finish starting. Reload this page once.');
      const start=document.getElementById('live-start');
      if(start){start.textContent='RELOAD LIVE';start.disabled=false;start.onclick=()=>location.reload();}
    },3500);
  });
})();