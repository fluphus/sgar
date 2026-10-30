(function(root){
  'use strict';
  function merge(chapters,...sources){
    const read={};
    for(const chapter of chapters)for(const source of sources){
      const at=source?.[chapter.key];
      if(Number.isInteger(at)&&at>=0)read[chapter.key]=Math.max(read[chapter.key]??-1,Math.min(at,chapter.events.length-1));
    }
    return read;
  }
  function fromSave(chapters,save){
    if(!save)return {};
    const current=chapters.find(c=>c.key===save.chapter);
    return merge(chapters,save.readThrough,current&&Number.isInteger(save.index)?{[current.key]:save.index}:{});
  }
  function entries(chapters,read,chapterKey=''){
    return chapters.filter(c=>!chapterKey||c.key===chapterKey).flatMap(c=>c.events.slice(0,(read[c.key]??-1)+1).map((event,index)=>({chapter:c,index,event})));
  }
  function through(chapters,read,chapterKey,index){
    const cursor=chapters.findIndex(c=>c.key===chapterKey),visible={};
    if(cursor<0||!Number.isInteger(index)||index<0)return visible;
    for(let i=0;i<=cursor;i++){
      const c=chapters[i],known=read[c.key];
      if(!Number.isInteger(known)||known<0)continue;
      visible[c.key]=Math.min(known,c.events.length-1,i===cursor?index:c.events.length-1);
    }
    return visible;
  }
  function voiceSources(chapter,event,core){
    const cues=core.voiceCues(event.text||'').map(c=>c.name);
    const names=cues.length?cues:(event.voices||[]);
    return names.map(name=>chapter.audio[name]?.src).filter(Boolean);
  }
  const api={merge,fromSave,entries,through,voiceSources};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.BacklogCore=api;
})(typeof window==='undefined'?globalThis:window);
