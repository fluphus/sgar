(function(root){
  'use strict';
  // One reading action per wheel gesture, including its inertial tail.
  function wheelGesture(){
    let last=-Infinity,direction=0,total=0,used=false,intent='native';
    return {
      feed(delta,time,context){
        const sign=Math.sign(delta),fresh=time-last>180||sign!==direction;
        if(fresh){total=0;used=false;intent=context;direction=sign;}
        last=time;total+=Math.abs(delta);
        const fire=!used&&total>=40;
        if(fire)used=true;
        return {intent,fire,fresh};
      }
    };
  }
  const api={wheelGesture};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.ReaderInput=api;
})(typeof window==='undefined'?globalThis:window);
