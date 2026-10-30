(() => {
  'use strict';
  const $ = id => document.getElementById(id), core = window.AnimationCore;
  const clamp = n => Math.max(0, Math.min(1, n));
  window.createOriginalAnimations = function ({ renderScene, prepareInteractive, volume, busyChanged }) {
    let busy = false, guardUntil = 0, pending = null, pendingCue = null, data, chapter, frameStageSignature = '', suppressClick = false, generation = 0;
    const running = new Set();
    const reader = $('reader'), sfx = $('sfx-audio');
    const byName = name => Object.values(data.clips).find(c => c.name === name);
    function setBusy(value) {
      const wasBusy = busy;
      busy = value; reader.dataset.animating = String(value);
      reader.setAttribute('aria-busy', String(value));
      if (!value && wasBusy) guardUntil = performance.now() + 180;
      busyChanged(value);
    }
    function sound(name) {
      const clip = chapter.audio[name]; if (!clip) return;
      sfx.pause(); sfx.src = clip.src; sfx.volume = volume(); sfx.play().catch(() => {});
    }
    function run(duration, draw, token = generation) {
      if (token !== generation) return Promise.resolve(false);
      return new Promise((resolve, reject) => {
        let elapsed = 0, previous = performance.now(), frame = null, settled = false;
        const visibilityChanged = () => { previous = performance.now(); };
        const finish = (completed, error) => {
          if (settled) return;
          settled = true;
          if (frame !== null) cancelAnimationFrame(frame);
          document.removeEventListener('visibilitychange', visibilityChanged);
          running.delete(cancel);
          if (error) reject(error); else resolve(completed);
        };
        const cancel = () => finish(false);
        running.add(cancel);
        document.addEventListener('visibilitychange', visibilityChanged);
        function tick(now) {
          if (settled || token !== generation) { finish(false); return; }
          const delta = (now - previous) / 1000; previous = now;
          // Background tabs must not consume the whole animation on return.
          if (!document.hidden) elapsed = Math.min(duration, elapsed + delta);
          try { draw(elapsed); } catch (error) { finish(false, error); return; }
          if (settled) return;
          if (elapsed >= duration) finish(true); else frame = requestAnimationFrame(tick);
        }
        try { draw(0); } catch (error) { finish(false, error); return; }
        if (!settled) frame = requestAnimationFrame(tick);
      });
    }
    function clearPhoto() { const cancel = pending; pending = null; pendingCue = null; if (cancel) cancel(false); $('photo-target').hidden = true; $('photo-image').hidden = true; $('props').inert = false; reader.dataset.awaitingTarget = 'false'; }
    function clearPresentation() {
      // Settling a cancelled frame also releases its awaiting sequence. Each
      // sequence checks its generation before it can touch a replacement scene.
      const cancelling = busy || running.size > 0 || Boolean(pending);
      generation++;
      for (const cancel of [...running]) cancel();
      window.LocalVideo?.clearTransition();
      clearPhoto(); $('golden-uper').hidden = true; $('original-fin').hidden = true;
      $('flash-curtain').style.opacity = '0'; $('black-curtain').style.opacity = '0'; $('scene-curtain').style.opacity = '0';
      $('transition').hidden = true; $('transition').style.opacity = '';
      reader.dataset.ending = 'false';
      $('dialogue').style.visibility = ''; $('dialogue').style.opacity = ''; frameStageSignature = '';
      if (cancelling) sfx.pause();
      suppressClick = false;
      if (busy) setBusy(false);
    }
    function select(ch) { chapter = ch; data = window.ANIMATION_DATA.chapters[ch.key]; clearPresentation(); }
    function applyAt(time,sceneTime=time) {
      for (const el of reader.querySelectorAll('[data-stage-name]')) el.style.opacity = el.dataset.visibleFrom!==undefined&&sceneTime<Number(el.dataset.visibleFrom)?0:clamp(core.alphaAt(data, el.dataset.stageName, sceneTime));
      for (const [target, id] of [['Black', 'black-curtain'], ['SceneChange', 'scene-curtain']]) {
        const exists = data.cues.some(c => c.kind === 'track' && c.target === target && c.t <= time + 1e-5);
        // These questions inherit their location. Keep native transition fades
        // while moving, then release the old puzzle blackout during reading.
        const puzzleReading=reader.dataset.puzzleBackdrop==='true'&&!busy;
        $(id).style.opacity = exists&&!puzzleReading ? clamp(core.alphaAt(data, target, time)) : 0;
      }
    }
    function sceneAt(time, event) {
      // A curtain reveal exposes the destination shot, including tracks whose
      // first frame is at the next dialogue marker. Keep the curtain's native
      // clock separate so a future cut-in cannot pop in after it has faded away.
      const revealing=data.cues.some(c=>c.kind==='track'&&['Black','SceneChange'].includes(c.target)&&c.t<=time&&time<=c.t+c.duration+1e-5&&/FadeOut/.test(data.clips[c.clip].name));
      const sceneTime=revealing?core.readingTime(data,event.t):time;
      const stages = core.activeStages(data, sceneTime);
      const playing = data.cues.filter(c => c.kind === 'track' && time >= c.t && time < c.t + c.duration).map(c => c.id).join('|');
      const signature = stages.map(s => s.name + ':' + s.start).join('|') + playing;
      if (signature !== frameStageSignature) { renderScene({ ...event, presentationTime: sceneTime, stage: stages }); frameStageSignature = signature; }
      applyAt(time,sceneTime);
    }
    function prepareTransition(event){
      // Swap the covered scene before any part of the outgoing video/curtain
      // becomes transparent. Chapter boundaries reveal black, then their title.
      $('dialogue').style.visibility='hidden';
      if(!event){$('black-curtain').style.opacity='1';return;}
      const time=core.readingTime(data,event.t);
      renderScene({...event,presentationTime:time,stage:core.activeStages(data,time)});
      applyAt(time);
    }
    function positionPhoto() {
      const cue = pendingCue; if (!cue) return;
      const target = $('photo-target');
      const original = [...reader.querySelectorAll('[data-stage-name]')].find(el => el.dataset.stageName === cue.target);
      const frame = reader.getBoundingClientRect(), bounds = original?.getBoundingClientRect();
      const actor = cue.target === 'Kyoma';
      const model = actor ? window.PRESENTATION_DATA.portraits[original?.alt] : window.PROP_DATA.chapters[chapter.key]?.[cue.target];
      const sourceWidth = model?.textureWidth || original?.naturalWidth || model?.width;
      const sourceHeight = model?.textureHeight || original?.naturalHeight || model?.height;
      const alpha = model?.alphaBounds || [0, 0, sourceWidth, sourceHeight];
      // Banana uses the measured minimum-area rectangle center in its rendered
      // texture coordinates. Okabe keeps his (340, 440) chest landmark.
      const left = bounds ? Math.max(0, bounds.left - frame.left + bounds.width * alpha[0] / sourceWidth) : frame.width * .3;
      const top = bounds ? Math.max(0, bounds.top - frame.top + bounds.height * alpha[1] / sourceHeight) : frame.height * .3;
      const right = bounds ? Math.min(frame.width, bounds.left - frame.left + bounds.width * alpha[2] / sourceWidth) : frame.width * .7;
      const bottom = bounds ? Math.min(frame.height, bounds.top - frame.top + bounds.height * alpha[3] / sourceHeight) : frame.height * .6;
      const size = Math.max(48, Math.min(79, frame.width * .08));
      const banana = cue.target === 'Banana' && bounds;
      const anchorX = banana ? bounds.left - frame.left + bounds.width * .59104 : actor && bounds ? bounds.left - frame.left + bounds.width * .425 : (left + right) / 2;
      const anchorY = banana ? bounds.top - frame.top + bounds.height * .57819 : actor && bounds ? bounds.top - frame.top + bounds.height * (440 / 1800) : (top + bottom) / 2;
      const centerX = Math.max(size / 2, Math.min(frame.width - size / 2, anchorX));
      const centerY = Math.max(size / 2, Math.min(frame.height - size / 2, anchorY));
      Object.assign(target.style, { left: centerX + 'px', top: centerY + 'px', width: size + 'px', height: size + 'px' });
      Object.assign($('photo-image').style, { left: frame.width * .3 + 'px', top: frame.height * .3 + 'px', width: frame.width * .4 + 'px', height: frame.height * .3 + 'px' });
      $('photo-image').hidden = Boolean(original);
    }
    new ResizeObserver(positionPhoto).observe(reader);
    async function photo(cue, event, token) {
      const target = $('photo-target'); clearPhoto(); pendingCue = cue; reader.dataset.awaitingTarget = 'true'; target.hidden = false;
      renderScene({ ...event, presentationTargets: [cue.target], presentationTime: cue.t, stage: core.activeStages(data, cue.t) });
      $('props').inert = true;
      $('dialogue').style.visibility = 'hidden';
      const japanese = $('reader').dataset.language === 'ja';
      const photoLabel = japanese ? (cue.target === 'Banana' ? 'バナナ' : '岡部') + 'を撮影' : '拍摄' + (cue.target === 'Banana' ? '香蕉' : '冈部');
      target.setAttribute('aria-label', photoLabel);
      $('photo-image').src = cue.images[0].src;
      $('photo-image').alt = cue.target === 'Banana' ? '香蕉' : '冈部';
      positionPhoto();
      const original = [...reader.querySelectorAll('[data-stage-name]')].find(el => el.dataset.stageName === cue.target);
      if (original && !original.complete) original.addEventListener('load', positionPhoto, { once: true });
      $('photo-reticle').src = data.aim?.src || ''; $('photo-reticle').hidden = !data.aim;
      const clicked = await new Promise(resolve => { pending = resolve; });
      if (!clicked || token !== generation) return false;
      clearPhoto(); setBusy(true); sound(cue.sound);
      for (const id of cue.clips) {
        const clip = data.clips[id];
        if (!await run(clip.duration, t => { $('flash-curtain').style.opacity = clamp(core.sample(clip, 0, t)); }, token) || token !== generation) return false;
      }
      if (!await run(.1, () => {}, token)) return false;
      if (token !== generation) return false;
      $('flash-curtain').style.opacity = '0';
      return true;
    }
    async function timeline(cues, targetTime, event, token) {
      if (!cues.length) return true;
      // Clicks pause the original director. Keep those waits outside its clock.
      const photos = cues.filter(c => c.kind === 'photo');
      for (const cue of photos) { if (!await photo(cue, event, token) || token !== generation) return false; }
      const timed = cues.filter(c => c.kind !== 'photo');
      if (!timed.length) return true;
      setBusy(true); $('dialogue').style.visibility = 'hidden';
      const questionFade = timed.find(c => data.clips[c.clip].name === 'SceneChange_FadeIn' && event.type === 'question');
      if (questionFade) { prepareInteractive(event); $('dialogue').style.opacity = '0'; $('dialogue').style.visibility = ''; }
      const start = Math.min(...timed.map(c => c.t)), duration = Math.max(...timed.map(c => c.t + c.duration)) - start;
      const fired = new Set();
      if (!await run(duration, elapsed => {
        const time = start + elapsed; sceneAt(time, event);
        for (const cue of timed) {
          const local = time - cue.t, clip = data.clips[cue.clip];
          if (local < 0) continue;
          if (cue === questionFade) $('dialogue').style.opacity = clamp(core.sample(clip, 3, local));
          if (!fired.has(cue.id)) {
            fired.add(cue.id);
            if (cue.kind === 'golden') { $('golden-uper').src = window.PROP_DATA.chapters[chapter.key]?.GoldenUper?.src || cue.images[0].src; $('golden-uper').hidden = false; sound(cue.sound); }
            if (cue.kind === 'fin') { $('original-fin').hidden = false; reader.dataset.ending = 'true'; }
          }
          if (cue.kind === 'golden') {
            // The native XY path and cabinet share one camera and native size scale.
            const model = window.PropCore.golden(window.PROP_DATA, chapter.key, reader.clientWidth, reader.clientHeight, core.sample(clip, 0, local), core.sample(clip, 1, local), core.sample(clip, 1, clip.duration));
            if (model) Object.assign($('golden-uper').style,{left:model.left+'px',top:model.top+'px',width:model.width+'px',height:model.height+'px'});
            $('golden-uper').style.opacity = clamp(core.sample(clip, 3, local));
          }
          if (cue.kind === 'fin') $('original-fin').style.opacity = clamp(core.sample(clip, 0, local));
        }
      }, token) || token !== generation) return false;
      $('golden-uper').hidden = true;
      return true;
    }
    async function bridge(from, to, event) {
      const token = generation;
      frameStageSignature = ''; clearPhoto();
      const cues = core.between(data, from, to);
      if (!await timeline(cues, to, event, token) || token !== generation) return false;
      return cues.some(c => c.kind === 'fin');
    }
    async function transition(entering, event) {
      const token = generation;
      if (entering && window.LocalVideo?.hasTransition(event)) {
        setBusy(true); $('transition').hidden = true; $('dialogue').style.visibility = 'hidden';
        const result = await window.LocalVideo.playTransition(event, { volume: volume(), language: reader.dataset.language });
        if (token !== generation) return { played: false, cancelled: true };
        if (result.played || result.cancelled) return result;
        window.LocalVideo.clearTransition();
      }
      const clip = byName(entering ? 'WorldLineChange_FadeIn' : 'WorldLineChange_FadeOut');
      if (!entering && window.LocalVideo?.transitionVisible) {
        setBusy(true);
        if (clip && !await run(clip.duration, t => window.LocalVideo.opacity(clamp(core.sample(clip, 0, t))), token)) return { played: false, cancelled: true };
        if (token !== generation) return { played: false, cancelled: true };
        window.LocalVideo.clearTransition(); $('transition').hidden = true;
        return;
      }
      if (!clip) return;
      setBusy(true); $('transition').hidden = false;
      if (!await run(clip.duration, t => {
        $('transition').style.opacity = '1';
        $('transition').style.backgroundColor = `rgba(21,21,21,${clamp(core.sample(clip, 0, t))})`;
        for (const child of $('transition').children) child.style.opacity = clamp(core.sample(clip, 1, t));
      }, token) || token !== generation) return { played: false, cancelled: true };
      if (!entering) { $('transition').hidden = true; $('transition').style.opacity = ''; }
    }
    async function completion() {
      const token = generation;
      const popup = byName('NextDialog_PopupDialog'), fade = byName('NextDialog_FadeIn'), button = byName('NextDialog_Button_FadeIn');
      const box = reader.querySelector('.complete'); if (!box) return;
      reader.dataset.ending = 'true';
      setBusy(true); $('original-fin').hidden = true; $('dialogue').style.visibility = '';
      if (popup && fade) {
        box.style.opacity = '0';
        if (!await run(2, t => { $('black-curtain').style.opacity = clamp(core.sample(fade, 0, t)); }, token)) return;
        if (!await run(popup.duration, t => { box.style.opacity = clamp(core.sample(popup, 3, t)); box.style.transform = `scale(${core.sample(popup, 0, t)})`; }, token)) return;
      } else if (button) {
        $('black-curtain').style.opacity = '1';
        if (!await run(button.duration, t => { box.style.opacity = clamp(core.sample(button, 6, t)); box.style.transform = `scale(${core.sample(button, 0, t)})`; }, token)) return;
      }
      if (token !== generation) return;
      box.style.opacity = ''; box.style.transform = ''; setBusy(false);
    }
    $('photo-target').addEventListener('click', () => { if (pending && !busy) { const resolve = pending; pending = null; resolve(true); } });
    reader.addEventListener('pointerdown', () => { suppressClick = busy || performance.now() < guardUntil; }, true);
    reader.addEventListener('click', ev => {
      const waitingElsewhere = pending && !ev.target.closest('#photo-target,#log,#reader-controls');
      if (busy || performance.now() < guardUntil || suppressClick || waitingElsewhere) { suppressClick = false; ev.preventDefault(); ev.stopImmediatePropagation(); }
    }, true);
    reader.addEventListener('keydown', ev => {
      if (busy || (pending && ev.target.closest('#props') && ['Enter', ' '].includes(ev.key))) { ev.preventDefault(); ev.stopImmediatePropagation(); }
    }, true);
    return {
      select, applyAt, bridge, transition, prepareTransition, completion, clearPresentation,
      refreshTarget: positionPhoto,
      finish() { $('dialogue').style.visibility = ''; $('dialogue').style.opacity = ''; setBusy(false); },
      get busy() { return busy; }, get waiting() { return Boolean(pending); },
      get blocked() { return busy || performance.now() < guardUntil; },
      get endTime() { return data.end; },
      readingTime(time) { return core.readingTime(data,time); },
      updateVolume() { sfx.volume = volume(); window.LocalVideo?.updateVolume(volume()); }
    };
  };
})();
