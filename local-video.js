(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  // Decoded start/end digits checked against the XR event order (2026-10-23).
  // 01–05 are Studio reconstructions; 06 is the unchanged official-site master.
  const transitions = Object.freeze({
    '2-2:26': { src: 'assets/video/divergence/WorldLine01.mp4', from: '30.63841', to: '30.63846' },
    '3-2:30': { src: 'assets/video/divergence/WorldLine02.mp4', from: '30.63846', to: '30.63851' },
    '5:22': { src: 'assets/video/divergence/WorldLine03.mp4', from: '30.63851', to: '30.63856' },
    '6-2:7': { src: 'assets/video/divergence/WorldLine04.mp4', from: '30.63856', to: '30.63861' },
    '7:21': { src: 'assets/video/divergence/WorldLine05.mp4', from: '30.63861', to: '30.63866' },
    '8:63': { src: 'assets/video/divergence/WorldLine06.mp4', from: '30.63866', to: '30.63841' }
  });
  const transitionFor = event => event && Object.prototype.hasOwnProperty.call(transitions, event.id) ? transitions[event.id] : null;
  const demos = [];
  let active = null, intro = null;
  function release(video) { video.pause(); video.removeAttribute('src'); video.load(); }
  function opening({ language, volume }) {
    if (intro) return intro.promise;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    const layer = $('startup-layer'), video = $('startup-video'), skip = $('skip-startup'), home = $('home');
    const japanese = language === 'ja';
    skip.setAttribute('aria-label', japanese ? 'オープニングをスキップ' : '跳过开场动画');
    skip.firstElementChild.textContent = japanese ? 'クリックでスキップ' : '点击跳过';
    let finished = false, timer, resolve, lastTime = -1, stalledSince = performance.now();
    const promise = new Promise(done => { resolve = done; });
    const finish = () => {
      if (finished) return; finished = true;
      clearInterval(timer); layer.hidden = true; home.inert = false;
      video.removeEventListener('ended', finish); video.removeEventListener('error', finish);
      skip.removeEventListener('click', click); document.removeEventListener('keydown', key, true);
      document.removeEventListener('visibilitychange', visibility);
      release(video); intro = null;
      resolve();
    };
    const click = ev => { ev.preventDefault(); ev.stopPropagation(); finish(); };
    const key = ev => { if (['Escape','Enter',' '].includes(ev.key)) { ev.preventDefault(); ev.stopImmediatePropagation(); finish(); } };
    const visibility = () => { stalledSince = performance.now(); if (document.hidden) video.pause(); else video.play().catch(finish); };
    intro = { finish, promise }; home.inert = true; layer.hidden = false;
    video.volume = volume; video.muted = volume === 0; video.src = 'assets/video/official-trailer-1080p.mp4';
    video.addEventListener('ended', finish); video.addEventListener('error', finish);
    skip.addEventListener('click', click); document.addEventListener('keydown', key, true);
    document.addEventListener('visibilitychange', visibility);
    timer = setInterval(() => {
      if (document.hidden) { stalledSince = performance.now(); return; }
      if (video.currentTime !== lastTime) { lastTime = video.currentTime; stalledSince = performance.now(); }
      else if (performance.now() - stalledSince > 12000) finish();
    }, 500);
    video.play().catch(finish);
    return promise;
  }
  function clearTransition() {
    const old = active; active = null;
    if (old) old.cancel();
    $('story-video-layer').hidden = true; $('story-video-layer').style.opacity = '';
    $('story-video-resume').hidden = true; release($('story-video'));
  }
  function playTransition(event, { volume, language }) {
    clearTransition();
    const clip = transitionFor(event); if (!clip) return Promise.resolve({ played: false });
    const layer = $('story-video-layer'), video = $('story-video'), resume = $('story-video-resume');
    layer.hidden = false; layer.style.opacity = '1'; video.src = clip.src;
    video.volume = volume; video.muted = volume === 0;
    video.setAttribute('aria-label', (language === 'ja' ? '世界線変動 ' : '世界线变动 ') + clip.from + ' → ' + clip.to);
    resume.textContent = language === 'ja' ? 'クリックして再生' : '点击播放';
    return new Promise(resolve => {
      let settled = false, watchdog, lastTime = -1, stalledSince = performance.now();
      const cleanup = () => {
        clearInterval(watchdog);
        video.removeEventListener('ended', ended); video.removeEventListener('error', failed);
        document.removeEventListener('visibilitychange', visibility); resume.removeEventListener('click', retry);
      };
      const settle = result => {
        if (settled) return; settled = true; cleanup(); resume.hidden = true;
        if (!result.played) layer.hidden = true;
        resolve(result);
      };
      const ended = () => settle({ played: true });
      const failed = () => settle({ played: false });
      const requestPlay = () => {
        stalledSince = performance.now();
        video.play().then(() => { if (!settled) resume.hidden = true; }).catch(() => { if (!settled) resume.hidden = false; });
      };
      const retry = ev => { ev.stopPropagation(); requestPlay(); };
      const visibility = () => { stalledSince = performance.now(); if (document.hidden) video.pause(); else requestPlay(); };
      active = { eventId: event.id, cancel: () => settle({ played: false, cancelled: true }) };
      video.addEventListener('ended', ended); video.addEventListener('error', failed);
      resume.addEventListener('click', retry); document.addEventListener('visibilitychange', visibility);
      watchdog = setInterval(() => {
        if (document.hidden || !resume.hidden) { stalledSince = performance.now(); return; }
        if (video.currentTime !== lastTime) { lastTime = video.currentTime; stalledSince = performance.now(); }
        else if (performance.now() - stalledSince > 10000) failed();
      }, 500);
      requestPlay();
    });
  }
  function appendTrailer(box, language) {
    const section = document.createElement('section'), title = document.createElement('h3'), video = document.createElement('video');
    title.textContent = language === 'ja' ? '公式トレーラー' : '官方宣传片';
    video.className = 'materials-video'; video.controls = true; video.playsInline = true; video.preload = 'none';
    video.src = 'assets/video/official-trailer-1080p.mp4';
    video.setAttribute('aria-label', title.textContent); section.append(title, video); box.append(section);
    return video;
  }
  function appendDemos() { return []; }
  window.LocalVideo = {
    opening, clearTransition, playTransition, appendTrailer, appendDemos,
    hasTransition: event => Boolean(transitionFor(event)),
    get transitionVisible() { return Boolean(active && !$('story-video-layer').hidden); },
    opacity(value) { $('story-video-layer').style.opacity = String(value); },
    updateVolume(value) { $('story-video').volume = value; $('story-video').muted = value === 0; }
  };
})();
