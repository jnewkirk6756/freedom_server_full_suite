/* Pure viewport policy, shared by mobile shell tests and DOM integration. */
(function(root){
  'use strict';
  function viewportState({layoutWidth,layoutHeight,visualHeight,offsetTop=0,visualScale=1,coarsePointer=false,editable=false,insideNavigation=false}){
    const finite=(value,fallback)=>Number.isFinite(value)&&value>=0?value:fallback;
    const height=finite(layoutHeight,0),visibleHeight=finite(visualHeight,height);
    const inset=Math.max(0,height-visibleHeight-finite(offsetTop,0));
    // A phone can be wider than 600px in landscape. Touch capability permits
    // that case without treating an ordinary desktop resize as a keyboard.
    // Pinch zoom also shrinks the visual viewport, even with a field focused.
    const mobile=finite(layoutWidth,1000)<=600||coarsePointer===true;
    const keyboard=Boolean(editable&&mobile&&Math.abs(finite(visualScale,1)-1)<0.01&&inset>140);
    return {visibleHeight:Math.round(visibleHeight),keyboardInset:Math.round(inset),keyboardOpen:keyboard&&!insideNavigation,menuKeyboardOpen:keyboard&&insideNavigation};
  }
  root.NocturneUICore=Object.freeze({viewportState});
})(globalThis);
