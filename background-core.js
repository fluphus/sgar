(function(root){
  'use strict';
  // Explicit player locations: phone calls and mail timestamps never move the camera.
  const scenes = {
    street: {src:'assets/vn-BG20A.webp', position:'50% 50%'},
    parts: {src:'assets/vn-BG17A0.webp', position:'50% 50%'},
    radio: {src:'assets/vn-BG10A1D.webp', position:'50% 100%'},
    shrine: {src:'assets/vn-BG15A.webp', position:'65% 50%'},
    'bridge-area': {src:'assets/vn-BG30A.PNG', position:'50% 50%'},
    lockers: {src:'assets/vn-BG21A.webp', position:'45% 50%'}
  };
  function precedingBackground(chapter,index){
    // Resolve from script state so direct loads and chapter jumps agree with
    // continuous reading, even if the last screen was a mail or news image.
    for(let i=index-1;i>=0;i--){
      let src='';
      for(const stage of chapter.events[i].stage||[]){
        if(/^(PhoneQuiz|RecvMail|PhonePicture|NazoShiritori)$/.test(stage.name))continue;
        for(const image of stage.images||[])if(/^BG|background|Room/i.test(image.name)&&image.width>image.height)src=image.src;
      }
      if(src)return src;
    }
    return '';
  }
  function plan(chapter,event,native='',propMode='none'){
    const key=chapter.key, n=Number(event.id.split(':').at(-1));
    const puzzle=(key==='1'&&n===64)||(key==='7'&&n===47)||(key==='8'&&n===32);
    if(puzzle){const src=native||precedingBackground(chapter,n);return {src,position:'50% 50%',source:src?'xr-continuation':'unavailable',scene:'puzzle-context'};}
    if(native)return {src:native,position:'50% 50%',source:'xr',scene:'native'};
    if(['locker','vending'].includes(propMode))return {src:'',position:'50% 50%',source:'neutral',scene:'prop-closeup'};
    let scene='';
    if(key==='1'&&n===0||key==='8'&&n>=66&&n<=67)scene='street';
    else if(key==='1'&&n>=1&&n<=24)scene='parts';
    else if(key==='2-2'||key==='3-1')scene='radio';
    else if(key==='4')scene='shrine';
    // Approved borrowed scenery: the Daru encounter and both following calls
    // share this location across WorldLine03; native cast/phone tracks still apply.
    else if(key==='5'||key==='6-1')scene='bridge-area';
    else if(key==='3-2'||key==='6-2'||key==='7'&&n<=32)scene='lockers';
    return scene?{...scenes[scene],source:'vn-adaptation',scene}:{src:'',position:'50% 50%',source:'unavailable',scene:'pending'};
  }
  const api={plan,scenes};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.BackgroundCore=api;
})(typeof window==='undefined'?globalThis:window);
