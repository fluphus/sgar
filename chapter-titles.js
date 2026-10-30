(function(root){
  'use strict';
  const strip=title=>String(title).replace(/\s*[①②]$/,'');
  const assets=Object.freeze(Object.fromEntries(Array.from({length:8},(_,i)=>[String(i+1),'assets/chapter-titles-v5/chapter-'+String(i+1).padStart(2,'0')+'-v5.png'])));
  function create(){
    const layer=document.getElementById('chapter-title-card'),reader=document.getElementById('reader');
    const art=layer.querySelector('.chapter-title-art');    const hint=layer.querySelector('.chapter-title-continue');
    let pending=null,timer=null,loadTimer=null,started=0,remaining=0,elapsed=0,ready=false,sequence=0;
    function finish(completed){
      sequence++;clearTimeout(timer);clearTimeout(loadTimer);timer=null;loadTimer=null;
      if(art){art.onload=null;art.onerror=null;}
      const done=pending;pending=null;ready=false;
      layer.hidden=true;reader.dataset.chapterTitle='false';done?.(completed);
    }
    function arm(){started=Date.now();if(Number.isFinite(remaining))timer=setTimeout(()=>finish(true),remaining);}
    function skip(){if(pending&&ready&&!document.hidden&&elapsed+Date.now()-started>=450)finish(true);}
    layer.addEventListener('click',ev=>{ev.preventDefault();ev.stopPropagation();skip();});
    document.addEventListener('visibilitychange',()=>{
      if(!pending||!ready)return;
      if(document.hidden){clearTimeout(timer);const spent=Date.now()-started;elapsed+=spent;remaining=Math.max(0,remaining-spent);}
      else arm();
    });
    return{
      get active(){return Boolean(pending);},cancel:()=>finish(false),skip,      fastForward(){        if(!pending||layer.dataset.playback==='fast')return;        clearTimeout(timer);remaining=700;elapsed=0;layer.dataset.playback='fast';        if(hint)hint.hidden=true;        if(ready&&!document.hidden)arm();      },
      show({chapter,language,title,fast=false,auto=false}){
        finish(false);const ticket=sequence,jp=strip(chapter.title),split=jp.indexOf('の'),cn=strip(title),number=chapter.key.split('-')[0];
        layer.querySelector('.chapter-title-number').textContent='Chapter '+number;
        layer.querySelector('.chapter-title-prefix').textContent=split<0?jp:jp.slice(0,split);
        layer.querySelector('.chapter-title-term').textContent=split<0?'':jp.slice(split);
        const translation=layer.querySelector('.chapter-title-translation');translation.textContent=cn;translation.hidden=language==='ja';
        layer.setAttribute('aria-label',language==='ja'?jp+'。クリック、Enter、スペースでつづける':cn+'，点击、Enter 或空格继续');        layer.dataset.playback=fast?'fast':auto?'auto':'manual';        if(hint){hint.hidden=fast;hint.textContent=language==='ja'?(auto?'オート · クリックでつづける':'クリックでつづける'):(auto?'自动播放 · 点击继续':'点击继续');}
        layer.dataset.chapter=number;layer.dataset.art='loading';layer.hidden=false;reader.dataset.chapterTitle='true';
        remaining=fast?700:auto?6000:Infinity;elapsed=0;started=Date.now();
        return new Promise(resolve=>{
          pending=resolve;
          const settle=loaded=>{
            if(ticket!==sequence||!pending||ready)return;
            clearTimeout(loadTimer);loadTimer=null;ready=true;layer.dataset.art=loaded?'ready':'fallback';
            if(art){art.onload=null;art.onerror=null;}
            if(!document.hidden)arm();
          };
          if(!art||!assets[number]){settle(false);return;}
          art.onload=()=>settle(true);art.onerror=()=>settle(false);
          loadTimer=setTimeout(()=>settle(false),5000);
          art.src=assets[number];
          if(art.complete)settle(art.naturalWidth>0);
        });
      }
    };
  }
  root.ChapterTitles={create,strip,assets};
})(typeof window!=='undefined'?window:globalThis);

