(() => {
  'use strict';
  const character = name => {
    for (const [pattern,key] of [[/Okabe|Kyom/i,'okabe'],[/Shiina|Mayuri/i,'mayuri'],[/Makise|Kurisu/i,'kurisu'],[/Hashida|Daru/i,'daru'],[/Urushibara|Ruka|Ruca/i,'ruka'],[/Faris|Feyris/i,'faris']]) if (pattern.test(name)) return key;
    return '';
  };
  const speaker = name => {
    for (const [pattern,key] of [[/凶真|岡部/,'okabe'],[/まゆり/,'mayuri'],[/紅莉栖|クリス/,'kurisu'],[/ダル/,'daru'],[/ルカ|るか/,'ruka'],[/フェイリス/,'faris']]) if (pattern.test(name)) return key;
    return '';
  };
  const stagesFor = (chapter,event,data) => [...(event.stage||[]),...(data.chapters[chapter.key].persistentStages||[])];
  const activeActors = (chapter,event,data) => {
    const models=data.chapters[chapter.key].actors;
    return [...new Set(stagesFor(chapter,event,data).filter(s=>models[s.name]).map(s=>s.name))];
  };
  function selectSpeaker(names,models,label) {
    const key=speaker(label||'');
    const candidates=names.filter(n=>models[n].character===key);
    if (!candidates.length) return '';
    const identity=/コピー/.test(label)?'copy':'original';
    return candidates.find(n=>models[n].identity===identity)||candidates[0];
  }
  function background(event) {
    return (event.stage||[]).flatMap(s=>s.images||[]).find(i=>/^BG|background|Room/i.test(i.name)&&i.width>i.height)?.src||'';
  }
  function evaluate(chapter,event,data,animation) {
    const models=data.chapters[chapter.key].actors;
    const time=event.presentationTime??event.t;
    const state={actors:[],focus:'',kind:'empty',phone:null,phoneKey:'',scene:'',reason:'opening',camera:null};
    const present=(name,at)=>{
      const stages=animation?.stages||event.stage||[];
      if(![...stages,...(data.chapters[chapter.key].persistentStages||[])].some(s=>s.name===name&&s.start<=at+1e-5&&at+1e-5<s.end))return false;
      const last=(animation?.cues||[]).filter(c=>c.kind==='track'&&c.target===name&&c.t<=at+1e-5).at(-1);
      return !last||last.t+last.duration>at+1e-5||!/FadeOut/.test(animation.clips[last.clip].name);
    };
    function updateCamera(at,scripted=false){
      if(!state.actors.length||state.actors.some(n=>models[n].kind!=='world')){state.camera=null;return;}
      const camera=state.camera,subset=camera&&state.actors.every(n=>camera.actors.includes(n));
      const departure=subset&&camera.actors.some(n=>!state.actors.includes(n)&&!present(n,at));
      // Removing an actor is not a camera move. Preserve the occupied slots,
      // scale and floor until a new composition or an explicit scene cut.
      if(subset&&(camera.held||camera.actors.length>state.actors.length&&(scripted||departure))){state.camera={...camera,held:true};return;}
      state.camera={actors:[...state.actors],kind:state.kind,held:false};
    }
    for(const e of chapter.events) {
      if(e.t>time+1e-5) break;
      const current=e.id===event.id?{...e,stage:event.stage}:e;
      const active=activeActors(chapter,current,data);
      const scene=background(current);
      if(scene&&state.scene&&scene!==state.scene) {
        state.actors=[];state.focus='';state.kind='empty';state.phone=null;state.phoneKey='';state.camera=null;
      }
      if(scene) state.scene=scene;
      const bubbles=stagesFor(chapter,current,data).flatMap(s=>(s.images||[]).filter(i=>/_Bubble$/i.test(i.name)));
      state.phone=bubbles[0]||null;
      state.phoneKey=state.phone?character(state.phone.name):'';
      const remote=Boolean(state.phone&&speaker(current.speaker||'')===state.phoneKey);
      const special=data.overrides[current.id];
      const cutins=active.filter(n=>models[n].kind==='cutin');
      if(special) {
        state.actors=special.actors.filter(n=>models[n]);
        state.focus=state.actors[0]||'';
        state.kind=state.actors.length>2?'group':state.actors.length===2?'story-pair':state.actors.length===1?'single':'empty';
        state.reason='script:'+current.id;
        if(special.calls===false) {state.phone=null;state.phoneKey='';}
      } else if(cutins.length) {
        state.actors=cutins;state.focus=cutins[0];state.kind='cutin';state.reason='source-cutin';
      } else if(remote) {
        // Remote dialogue UI never changes the local camera or focus.
        state.reason='remote-phone';
      } else if(current.speaker==='あなた'||!current.speaker) {
        if(state.kind==='cutin'&&!state.actors.some(n=>active.includes(n))) {
          state.actors=[];state.focus='';state.kind='empty';
        }
        state.reason='hold-previous';
      } else {
        const selected=selectSpeaker(active.filter(n=>models[n].kind==='world'),models,current.speaker);
        if(selected) {
          const world=active.filter(n=>models[n].kind==='world');
          state.actors=world.length===2?world:[selected];
          state.focus=selected;state.kind=state.actors.length===2?'pair':'single';state.reason='in-scene-speaker';
        } else if(/^？+$/.test(current.speaker)&&active.length===1) {
          state.actors=active;state.focus=active[0];state.kind='single';state.reason='unknown-visible-speaker';
        } else if(!state.phone) {
          state.actors=[];state.focus='';state.kind='empty';state.reason='offscreen-speaker';
        }
      }
      if(/<voice=sound_call>/.test(current.text||'')) {state.phone=null;state.phoneKey='';}
      updateCamera(e.t,Boolean(special));
      if(e.id===event.id) break;
    }
    const running=(animation?.cues||[]).filter(c=>c.kind==='track'&&models[c.target]&&time>=c.t&&time<c.t+c.duration);
    let reservedEntrance='';
    if(chapter.key==='2-1'&&time>=81&&time<83){
      // The AR scene moves Kurisu to the front while three off-camera objects
      // fade out. Reserve the final three-person camera before the fades start.
      state.actors=['Kyoma','Kyoma_複製','Makise_前'];state.focus='Makise_前';state.kind='group';
      state.reason='native-relocation';reservedEntrance='Makise_前';
      state.camera={actors:[...state.actors],kind:state.kind,held:false};
    } else {
      const incoming=running.filter(c=>/FadeIn/.test(animation.clips[c.clip].name)).map(c=>c.target);
      if(incoming.length){state.actors=incoming;state.focus=incoming[0];state.kind=incoming.length>1?'story-pair':'single';state.reason='native-entrance';updateCamera(time);}
      // A fade on an off-camera object must not pull it into the current shot.
    }
    state.actors=state.actors.filter(name=>name===reservedEntrance||present(name,time));
    if(event.presentationTargets) {
      state.actors=event.presentationTargets.filter(n=>models[n]);
      state.focus=state.actors[0]||'';state.kind='target';state.reason='interactive-target';
      state.camera=null;
    }
    if(!state.actors.includes(state.focus))state.focus=state.actors[0]||'';
    if(!state.actors.length) state.kind='empty';
    // This approved adaptation keeps the bridge-area camera across WorldLine03.
    // Hashida's vacant slot preserves Kyoma's position without rendering Hashida.
    // Derive it on direct loads too, rather than relying on the preceding chapter.
    if(chapter.key==='6-1'&&state.actors.includes('Kyoma')) {
      state.camera={actors:['Hashida','Kyoma'],kind:'pair',held:true};
    }
    return {...state,actors:state.actors.map(name=>({stageName:name,...models[name],...data.portraits[models[name].portrait],...(name===reservedEntrance?{visibleFrom:81.5}:{})})),calls:state.phone?[state.phone]:[]};
  }
  function layout(shot,width,height) {
    const portrait=width<=height;
    let actors=shot.actors;
    const camera=shot.camera||{actors:actors.map(a=>a.stageName),kind:shot.kind};
    let slots=camera.actors;
    if(portrait&&camera.kind==='pair'){actors=actors.filter(a=>a.stageName===shot.focus);slots=[shot.focus];}
    const count=slots.length;
    const factor=shot.kind==='cutin'?(portrait?1.12:1.18):count>=3?(portrait?.98:1.30):count===2?(portrait?1.12:1.65):(portrait?1.32:1.65);
    // All native full-body drawings share a source-pixel scale. Use the same
    // offscreen floor even when the reference actor is absent. Selecting a
    // shorter speaker must not lift them to the previous speaker's head height.
    const worldScale=portrait
      ?Math.min(height*1.848/1800,width/664)*(count>=3?.76:count===2?.92:1)
      :height*(count>=3?1.30:1.65)*1.12/1800;
    const referenceBodyHeight=1770; // Native Okabe alpha bounds: 1785 - 15.
    const rise=height*32/720;
    const floor=height*(portrait?(count>=2?.12:.09):.055)+referenceBodyHeight*worldScale-rise;
    return actors.map((actor,i)=>{
      const slot=Math.max(0,slots.indexOf(actor.stageName));
      const center=count===1?.5:count===2?(portrait?[.29,.71][slot]:[.34,.66][slot]):count===3?[.22,.50,.78][slot]:(slot+1)/(count+1);
      const scale=height*factor/1800;
      if(actor.kind==='world'){
        return {...actor,left:center*width,top:floor-actor.alphaBounds[3]*worldScale,width:actor.width*worldScale,height:actor.height*worldScale,groundLineY:floor};
      }
      return {...actor,left:center*width,top:height*(shot.kind==='cutin'?.02:portrait?.08:.05)-rise,width:actor.width*scale,height:actor.height*scale};
    });
  }
  const api={character,speaker,stagesFor,activeActors,plan:evaluate,layout};
  if(typeof module!=='undefined'&&module.exports) module.exports=api;
  if(typeof window!=='undefined') window.PresentationCore=api;
})();
