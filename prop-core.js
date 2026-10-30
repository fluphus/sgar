(function(root){
  'use strict';
  function plan(chapter,event,data){
    const models=data.chapters[chapter.key]||{};
    const index=Number(event.id.split(':').at(-1));
    let mode=Object.entries(data.shots[chapter.key]||{}).find(([,indexes])=>indexes.includes(index))?.[0]||'none';
    if(event.presentationTargets?.includes('Banana'))mode='bananas';
    const candidates=mode==='bananas'?['Banana','Banana_複製']:mode==='cabinet'?['Chest']:mode==='locker'?['CoinLocker','CoinLocker/Paper']:mode==='vending'?['VendingMachine','VendingMachine_onSale']:[];
    const active=new Set((event.stage||[]).map(s=>s.name));
    return {mode,models:candidates.filter(n=>models[n]&&active.has(models[n].stageName)).map(n=>({model:n,...models[n]}))};
  }
  function camera(mode,width,height){
    let scale,centerX,originY;
    if(mode==='bananas'){scale=Math.min(width*.72/.4121,height*.40/.2935);centerX=-.81;originY=height*.40+.82*scale;}
    else if(mode==='cabinet'){scale=Math.min(width*.90/3,height*.57/1.60);centerX=-.875;originY=height*(width/height<.75?.82:.86);}
    else if(mode==='locker'){scale=Math.min(width*.86/3.1933,height*.53/2.2141);centerX=0;originY=height*.65;}
    else if(mode==='vending'){scale=Math.min(width*.68/1.528,height*.58/2.1431);centerX=2.25;originY=height*.66;}
    else return null;
    return {scale,originX:width*.5-centerX*scale,originY};
  }
  function project(model,view){return {...model,left:view.originX+model.x*view.scale,top:view.originY-model.y*view.scale,width:model.width*view.scale,height:model.height*view.scale};}
  function layout(shot,width,height){const view=camera(shot.mode,width,height);return view?shot.models.map(m=>project(m,view)):[];}
  function golden(data,chapter,width,height,x,y,restY=.15){
    const m=data.chapters[chapter]?.GoldenUper,chest=data.chapters[chapter]?.Chest;
    if(!m||!chest)return null;
    // Removing AR depth needs a shared visible floor. Keep the native bounce
    // displacement, horizontal coordinates and size; translate only the Y origin.
    const floor=chest.y+(.5-chest.alphaBounds[3]/chest.textureHeight)*chest.height;
    const restBottom=restY+(.5-m.alphaBounds[3]/m.textureHeight)*m.height;
    return project({...m,x,y:y+floor-restBottom},camera('cabinet',width,height));
  }
  const api={plan,camera,project,layout,golden};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  else root.PropCore=api;
})(typeof window==='undefined'?globalThis:window);
