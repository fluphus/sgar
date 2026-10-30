(function(root){
  'use strict';
  // Editorial bridges replace only physical-paper puzzles. Native data stays intact.
  const groups=[
    {chapter:'1',start:63,end:66,zh:'你和冈部继续埋头实验。经过一番忙碌，新的未来道具终于完成了。',ja:'あなたは岡部とともに実験を続けた。そして、ついに新たな未来ガジェットが完成した。'},
    {chapter:'7',start:47,end:47,zh:'你确定了电写微波炉的所在地——MayQueen＋喵²，随即和冈部赶了过去。',ja:'あなたは電写レンジのある場所がメイクイーン＋ニャン²だと突き止め、岡部とともに向かった。'},
    {chapter:'8',start:31,end:34,zh:'按照红莉栖的提议，你以“冈部并不饿”为前提，重新梳理了当时的制作过程。',ja:'あなたは紅莉栖の提案に従い、岡部が空腹ではなかったと仮定して、当時の製作手順をもう一度たどった。'}
  ];
  const cache=new WeakMap();
  function group(chapter,index,mode){return mode==='story'?groups.find(g=>g.chapter===chapter.key&&index>=g.start&&index<=g.end):undefined;}
  function anchor(chapter,index,mode){return group(chapter,index,mode)?.start??index;}
  function next(chapter,index,mode){return (group(chapter,index,mode)?.end??index)+1;}
  function event(chapter,index,mode,language){
    const g=group(chapter,index,mode),e=chapter.events[g?.start??index];
    if(!g||!e)return e;
    let texts=cache.get(e);if(!texts){texts={};cache.set(e,texts);}
    const key=language==='ja'?'ja':'zh';
    return texts[key]??= {...e,type:'dialogue',speaker:'',speakerLabel:'',text:g[key],voices:[],image:null,notices:[],storyBridge:true};
  }
  const api={groups,anchor,next,event};root.StoryMode=api;
  if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
