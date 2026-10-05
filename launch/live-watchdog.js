(function(){
  let lastError='';
  function detail(e){
    const msg=String(e?.message||e?.reason?.message||e?.reason||'runtime error').slice(0,150);
    const file=e?.filename?String(e.filename).split('/').pop():'';
    const pos=e?.lineno?(':'+e.lineno+(e.colno?':'+e.colno:'')):'';
    return msg+(file?' · '+file+pos:'');
  }
  function line(msg){
    const el=document.getElementById('last-line');
    if(el)el.textContent=msg;
    document.documentElement.dataset.liveBoot='error';
  }
  function recover(reason){
    if(typeof window.__NOCTURNE_ACTIVATE_LIVE_RECOVERY__==='function')window.__NOCTURNE_ACTIVATE_LIVE_RECOVERY__(reason);
  }
  window.addEventListener('error',e=>{lastError=detail(e);line('Live module error · '+lastError);recover(lastError)});
  window.addEventListener('unhandledrejection',e=>{lastError=detail(e);line('Live promise error · '+lastError);recover(lastError)});
  window.addEventListener('DOMContentLoaded',()=>{
    document.documentElement.dataset.liveBoot='loading';
    setTimeout(()=>{
      if(window.__NOCTURNE_MOBILE_READY__){document.documentElement.dataset.liveBoot=window.__NOCTURNE_MOBILE_READY__==='compat'?'compat':'ready';return}
      recover(lastError||'startup timeout');
      setTimeout(()=>{
        if(window.__NOCTURNE_MOBILE_READY__)return;
        line(lastError?('Live failed · '+lastError):'Live did not finish starting. Reload this page once.');
        const start=document.getElementById('live-start');
        if(start){start.textContent='RELOAD LIVE';start.disabled=false;start.onclick=()=>location.reload();}
      },300);
    },2200);
  });
})();