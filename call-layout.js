(function(root){
  'use strict';
  function layout(call,frame,dialogue,speaker){
    if(!call||frame.width<=0||frame.height<=0)return null;
    const w=frame.width,h=frame.height,aspect=call.width/call.height;
    const gap=Math.max(4,Math.min(8,w*6/1080));
    const anchorTop=Math.min(dialogue.top,speaker?.height?speaker.top:dialogue.top);
    const preferred=h*(w>h?.33:w/h>=.75?.26:.24);
    const maxWidth=w*(w>h?.24:.36);
    const height=Math.max(0,Math.min(preferred,maxWidth/aspect,anchorTop-56-gap));
    return {left:dialogue.left,top:anchorTop-gap-height,width:height*aspect,height,gap,anchorTop,side:'dialogue'};
  }
  const api={layout};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CallLayout=api;
})(typeof window==='undefined'?globalThis:window);
