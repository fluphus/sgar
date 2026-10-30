(function(root){
  'use strict';
  const ns='http://www.w3.org/2000/svg';
  const portraits={Makise_Bubble:'02-Makise-std',Shiina_Bubble:'03-Shiina-std',Urushibara_Bubble:'07-Urushibara-std',Hashida_Bubble:'08-Hashida-std'};
  // Cover the baked-in portrait only inside the original white window, then
  // clip a complete native sprite. Keep the original border, tail and gears.
  // The lightning tail stays outside the continuous picture window.
  const windowPath='M54 181 L1080 56 Q1103 53 1104 79 L1120 1007 Q1120 1028 1098 1029 L159 1062 Q143 1063 140 1045 L37 204 Q34 185 54 181 Z';
  function geometry(call,data){
    const key=portraits[call.name],portrait=data.portraits[key];if(!portrait)return null;
    const scale=3500/portrait.height,head=portrait.alphaBounds[1]*scale;
    const center=(portrait.alphaBounds[0]+portrait.alphaBounds[2])/2*scale;
    return {key,portrait,x:620-center,y:136-head,width:portrait.width*scale,height:3500};
  }
  function create(call,data){
    const el=(name,attrs={})=>{const n=document.createElementNS(ns,name);for(const [k,v]of Object.entries(attrs))n.setAttribute(k,String(v));return n;};
    const svg=el('svg',{viewBox:'0 0 1278 1322',role:'img','aria-label':'电话头像'}),g=geometry(call,data);
    svg.append(el('image',{href:call.src,width:1278,height:1322}));
    if(g){
      const id='phone-window-'+g.key,defs=el('defs'),clip=el('clipPath',{id,clipPathUnits:'userSpaceOnUse'});
      clip.append(el('path',{d:windowPath}));defs.append(clip);svg.append(defs,el('path',{d:windowPath,fill:'#fff'}));
      const crop=el('g',{'clip-path':`url(#${id})`});crop.append(el('image',{href:g.portrait.src,x:g.x,y:g.y,width:g.width,height:g.height,preserveAspectRatio:'xMidYMin meet','data-full-portrait':g.key}));svg.append(crop);svg.dataset.portrait=g.key;
    }
    return svg;
  }
  const api={create,geometry,windowPath,portraits};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CallView=api;
})(typeof window==='undefined'?globalThis:window);
