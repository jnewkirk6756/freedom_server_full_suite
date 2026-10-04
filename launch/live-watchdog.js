(function(){
  let lastError='',fallbackStarted=false;
  function line(msg){
    const el=document.getElementById('last-line');
    if(el)el.textContent=msg;
    document.documentElement.dataset.liveBoot='error';
  }
  function bootSafe(reason){
    if(fallbackStarted||window.__NOCTURNE_MOBILE_READY__)return;
    fallbackStarted=true;
    document.documentElement.dataset.liveBoot='recovering';
    line('Recovering Live…');
    const s=document.createElement('script');
    s.src='/experience-mobile-safe.js?v=0705';
    s.defer=true;
    s.onload=()=>{setTimeout(()=>{if(window.__NOCTURNE_MOBILE_READY__){document.documentElement.dataset.liveBoot='ready';line('Live recovered · controls ready.');}},0)};
    s.onerror=()=>line('Live recovery failed. Reload the main Nocturne page.');
    document.head.appendChild(s);
  }
  window.addEventListener('error',e=>{
    lastError=String(e.message||'Live runtime error').slice(0,180);
    line('Live error · '+lastError);
    bootSafe('error');
  });
  window.addEventListener('unhandledrejection',e=>{
    lastError=String(e.reason?.message||e.reason||'Live promise error').slice(0,180);
    line('Live error · '+lastError);
    bootSafe('promise');
  });
  window.addEventListener('DOMContentLoaded',()=>{
    document.documentElement.dataset.liveBoot='loading';
    setTimeout(()=>{
      if(window.__NOCTURNE_MOBILE_READY__){document.documentElement.dataset.liveBoot='ready';return}
      bootSafe('timeout');
    },1800);
    setTimeout(()=>{
      if(window.__NOCTURNE_MOBILE_READY__)return;
      line(lastError?('Live failed · '+lastError):'Live did not finish starting.');
      const start=document.getElementById('live-start');
      if(start){start.textContent='RELOAD LIVE';start.disabled=false;start.onclick=()=>location.reload();}
    },5000);
  });
})();