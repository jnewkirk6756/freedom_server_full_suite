/* Pure viewport policy, shared by mobile shell tests and DOM integration. */
(function(root){
  'use strict';
  function viewportState({layoutWidth,layoutHeight,visualHeight,offsetTop=0,editable=false,insideNavigation=false}){
    const finite=(value,fallback)=>Number.isFinite(value)&&value>=0?value:fallback;
    const height=finite(layoutHeight,0),visibleHeight=finite(visualHeight,height);
    const inset=Math.max(0,height-visibleHeight-finite(offsetTop,0));
    const keyboard=Boolean(editable&&finite(layoutWidth,1000)<=600&&inset>140);
    return {visibleHeight:Math.round(visibleHeight),keyboardInset:Math.round(inset),keyboardOpen:keyboard&&!insideNavigation,menuKeyboardOpen:keyboard&&insideNavigation};
  }
  root.NocturneUICore=Object.freeze({viewportState});
})(globalThis);
