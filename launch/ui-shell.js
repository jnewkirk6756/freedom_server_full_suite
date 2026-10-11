/* Shared navigation, accessible legacy panels and local display preferences. */
(function () {
  'use strict';
  function initialize() {
    const root=document.documentElement,nav=document.getElementById('nocturne-navigation');
    if(!nav)return;
    const main=document.querySelector('main')||document.querySelector('#hud')||document.querySelector('section');
    if(main){
      if(!main.id)main.id='nocturne-main';
      if(!main.hasAttribute('tabindex'))main.tabIndex=-1;
      const skip=document.createElement('a');skip.className='nocturne-skip';skip.href='#'+main.id;skip.textContent='Skip to content';
      skip.addEventListener('click',()=>main.focus());document.body.prepend(skip);
    }
    // Visual viewport changes are used only for UI placement, never app state.
    function viewport(){
      const vv=window.visualViewport;
      const state=NocturneUICore.viewportState({layoutWidth:innerWidth,layoutHeight:innerHeight,visualHeight:vv?.height,offsetTop:vv?.offsetTop,visualScale:vv?.scale,coarsePointer:window.matchMedia?.('(any-pointer: coarse)')?.matches===true,editable:document.activeElement?.matches('input:not([type=range]):not([type=checkbox]):not([type=radio]),textarea,[contenteditable=true]'),insideNavigation:nav.contains(document.activeElement)});
      root.style.setProperty('--nocturne-viewport-height',state.visibleHeight+'px');
      root.style.setProperty('--nocturne-keyboard-inset',state.keyboardInset+'px');
      root.classList.toggle('nocturne-keyboard-open',state.keyboardOpen);
      root.classList.toggle('nocturne-menu-keyboard-open',state.menuKeyboardOpen);
    }
    window.visualViewport?.addEventListener('resize',viewport);window.visualViewport?.addEventListener('scroll',viewport);
    window.addEventListener('resize',viewport);document.addEventListener('focusin',viewport);document.addEventListener('focusout',()=>requestAnimationFrame(viewport));viewport();
    const menu=document.getElementById('nocturne-screen-menu'),summary=menu?.querySelector('summary'),filter=document.getElementById('nocturne-screen-filter');
    const syncMenu=()=>summary?.setAttribute('aria-expanded',String(Boolean(menu?.open)));
    menu?.addEventListener('toggle',syncMenu);syncMenu();
    document.getElementById('nocturne-close-menu')?.addEventListener('click',()=>{menu.open=false;summary.focus()});
    filter?.addEventListener('input',()=>{
      const query=filter.value.trim().toLowerCase();let found=0;
      for(const link of menu.querySelectorAll('[data-screen-link]')){const match=link.textContent.toLowerCase().includes(query);link.hidden=!match;if(match)found++;}
      const tools=menu.querySelector('.nocturne-tools');if(query&&tools)tools.open=true;
      document.getElementById('nocturne-menu-empty').hidden=found>0;
    });
    nav.addEventListener('keydown',event=>{
      if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
      const tabs=[...nav.querySelectorAll(':scope > a,:scope > details > summary')],at=tabs.indexOf(document.activeElement);if(at<0)return;
      event.preventDefault();const next=event.key==='Home'?0:event.key==='End'?tabs.length-1:(at+(event.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[next].focus();
    });
    for(const dialog of document.querySelectorAll('dialog')){
      const heading=dialog.querySelector('h1,h2,h3');
      if(heading&&!dialog.hasAttribute('aria-label')&&!dialog.hasAttribute('aria-labelledby')){if(!heading.id)heading.id=(dialog.id||'dialog')+'-heading';dialog.setAttribute('aria-labelledby',heading.id);}
    }
    // The Home settings sheet predates <dialog>. Preserve its controls and make
    // its existing open/close path keyboard-operable, with focus restoration.
    const panel=document.querySelector('body[data-nocturne-screen=home] > #panel');
    if(panel){
      let opener=null,active=false;const inerted=[];
      panel.setAttribute('role','dialog');panel.setAttribute('aria-label','Settings');panel.tabIndex=-1;
      const focusable=()=>[...panel.querySelectorAll('button,a[href],input,select,textarea,[tabindex="0"]')].filter(node=>!node.disabled&&!node.hidden);
      const sync=()=>{
        if(!panel.hidden&&!active){
          active=true;opener=document.activeElement;panel.setAttribute('aria-modal','true');
          for(const node of document.body.children)if(node!==panel&&!node.contains(panel)&&!node.inert&&!['SCRIPT','STYLE','DIALOG'].includes(node.tagName)){node.inert=true;inerted.push(node);}
          (focusable()[0]||panel).focus();
        }else if(panel.hidden&&active){
          active=false;panel.removeAttribute('aria-modal');for(const node of inerted.splice(0))node.inert=false;
          if(opener?.isConnected)opener.focus();
        }
      };
      new MutationObserver(sync).observe(panel,{attributes:true,attributeFilter:['hidden']});sync();
      panel.addEventListener('keydown',event=>{
        if(event.key==='Escape'){event.preventDefault();document.getElementById('close')?.click();}
        if(event.key==='Tab'){
          const items=focusable(),first=items[0],last=items.at(-1);
          if(!first){event.preventDefault();panel.focus();}
          else if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
          else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
        }
      });
    }
    const dialog=document.createElement('dialog');dialog.id='nocturne-preferences';dialog.setAttribute('aria-labelledby','nocturne-preferences-title');
    dialog.innerHTML='<form method="dialog"><h2 id="nocturne-preferences-title">Display preferences</h2><p>Saved in this browser. Your device’s reduced-motion preference always applies.</p><label><input type="checkbox" id="nocturne-reduce-motion"> Reduce interface animation</label><label><input type="checkbox" id="nocturne-high-contrast"> Higher contrast</label><menu><button value="close" autofocus>Done</button></menu></form>';
    document.body.appendChild(dialog);
    let prefs={};try{prefs=JSON.parse(localStorage.getItem('nocturne.display-preferences.v1')||'{}')||{};}catch{}
    const motion=document.getElementById('nocturne-reduce-motion'),contrast=document.getElementById('nocturne-high-contrast');
    motion.checked=prefs.reduceMotion===true;contrast.checked=prefs.highContrast===true;
    function apply(save){
      root.dataset.nocturneMotion=motion.checked?'reduce':'system';root.dataset.nocturneContrast=contrast.checked?'high':'standard';
      if(save)try{localStorage.setItem('nocturne.display-preferences.v1',JSON.stringify({reduceMotion:motion.checked,highContrast:contrast.checked}))}catch{}
      window.dispatchEvent(new CustomEvent('nocturne:display-preferences',{detail:{reduceMotion:motion.checked,highContrast:contrast.checked}}));
    }
    motion.addEventListener('change',()=>apply(true));contrast.addEventListener('change',()=>apply(true));apply(false);
    const preferenceButton=document.getElementById('nocturne-display-preferences');
    preferenceButton?.addEventListener('click',()=>{menu.open=false;if(!dialog.open)dialog.showModal()});
    dialog.addEventListener('close',()=>summary?.focus());
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
})();
