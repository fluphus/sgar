(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const core = window.PlayerCore;
  const locale = window.StoryLocale;
  const storyMode = window.StoryMode;
  const presentation = window.PresentationCore, presentationData = window.PRESENTATION_DATA;
  let actorShot = null, propShot = null;
  const chapters = window.STORY_DATA?.chapters || [];
  const STORE = 'sgxr.offline.v1';
  const storage = { get(key) { try { return JSON.parse(localStorage.getItem(STORE + key)); } catch { return null; } }, set(key, value) { try { localStorage.setItem(STORE + key, JSON.stringify(value)); return true; } catch { return false; } } };
  const backlog=window.BacklogCore;
  let readThrough=backlog.merge(chapters,storage.get('.readThrough'),backlog.fromSave(chapters,storage.get('.auto')));
  let logVoice=null;
  let imageReturn=null;
  function stopLogVoice(){const playing=logVoice;logVoice=null;playing?.stop();}
  function browserLanguage() {
    const browser = typeof navigator === 'undefined' ? null : navigator;
    return locale.detectLanguage?.([...(Array.isArray(browser?.languages) ? browser.languages : []), browser?.language]) || 'zh-CN';
  }
  const defaults = { language: browserLanguage(), languageMode: 'auto', speed: 28, voice: .85, music: .25, mode: 'story', clockStyle: 'compact', muted: false, autoDelay: 2200 };
  const storedSettings = storage.get('.settings') || {};
  let settings = { ...defaults, ...storedSettings };
  // Older saved languages are explicit preferences; preserve those on upgrade.
  settings.languageMode = storedSettings.languageMode === 'auto' ? 'auto' : ['zh-CN','ja'].includes(storedSettings.language) ? 'manual' : 'auto';
  if (settings.languageMode === 'auto' || !['zh-CN', 'ja'].includes(settings.language)) settings.language = defaults.language;
  if (!['story', 'puzzle'].includes(settings.mode)) settings.mode = defaults.mode;
  if (!['compact', 'hidden'].includes(settings.clockStyle)) settings.clockStyle = defaults.clockStyle;
  const ui=(zh,ja)=>settings.language==='ja'?ja:zh;
  let chapterIndex = 0, index = 0, solved = {}, inReader = false, auto = false;
  let typeTimer, autoTimer, toastTimer, typing = false, displayedText = '', typed = 0;
  let cues = [], cueIndex = 0, voiceQueue = [], voiceToken = 0, currentBgm = '', renderToken = 0;
  let forwardPending = false, finReady = false, startingNewGame = false, logRequested = false;
  let phoneGesture = null;
  const chapterCards = window.ChapterTitles?.create();
  const clockContrast = window.ClockContrast?.create($('background'), $('clock'));
  let controlHeld = false, fastForward = false, fastTimer;
  const fastStatus = document.createElement('span'); fastStatus.className = 'fast-forward-status'; fastStatus.hidden = true;
  fastStatus.setAttribute('role','status'); $('hud-actions').append(fastStatus);
  const voice = $('voice-audio'), music = $('music-audio'); music.loop = true;
  const chapter = () => chapters[chapterIndex];
  const event = () => chapter() && storyMode.event(chapter(),index,settings.mode,settings.language);
  const view = e => e.storyBridge ? e : locale.event(e, settings.language);
  const chapterTitle = c => locale.title(c, settings.language);
  const optionLabel = (key, value) => locale.option(key, value, settings.language);
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  function format(s) { return escapeHtml(core.cleanText(s)).replace(/\n/g, '<br>'); }
  function toast(message) {
    clearTimeout(toastTimer); const notice=$('toast');notice.textContent=message;
    notice.classList.toggle('native-notice',message.length<=40);
    notice.dataset.tone=inReader&&chapter()?.key==='7'?'light':'dark';
    notice.hidden=false;toastTimer=setTimeout(()=>notice.hidden=true,2600);
  }
  function snapshot() { return { version: 1, chapter: chapter().key, index, mode:settings.mode, solved: { ...solved }, readThrough:{...readThrough}, date: new Date().toISOString() }; }
  function persist() { if (inReader) storage.set('.auto', snapshot()); }
  function saveSettings() { storage.set('.settings', settings); applyVolume(); updateControls(); refreshHome(); }
  const animations = window.createOriginalAnimations({ renderScene: renderStage, prepareInteractive: previewInteractive, volume: () => settings.muted ? 0 : Number(settings.voice), busyChanged: busy => { if (busy) clearTimeout(autoTimer); else scheduleAuto(); } });
  function applyVolume() { voice.volume = settings.muted ? 0 : Number(settings.voice); music.volume = settings.muted ? 0 : Number(settings.music); animations.updateVolume(); }
  function setControlsOpen(open) {
    if(open) stopFastForward();
    $('reader-controls').hidden = !open;
    $('controls-toggle').setAttribute('aria-expanded', String(open));
    if (open) clearTimeout(autoTimer); else scheduleAuto();
  }
  function openPanel(title, content, image = false) {
    if(chapterCards?.active)return;
    $('panel').lang=settings.language;
    if(!image)imageReturn=null;
    stopLogVoice();
    for(const video of $('panel').querySelectorAll('video'))video.pause();
    stopFastForward();
    window.CoasterView?.stop(); $('panel').classList.remove('coaster-panel');
    $('panel').classList.remove('settings-panel');
    $('panel').classList.remove('backlog-panel');
    $('panel').classList.toggle('image-panel',image);
    setControlsOpen(false); clearTimeout(autoTimer); $('panel-title').textContent = title; $('panel-body').replaceChildren();
    if (typeof content === 'string') $('panel-body').innerHTML = content; else $('panel-body').append(content);
    if (!$('panel').open) $('panel').showModal();
    $('panel').scrollTop=0; $('panel-body').scrollTop=0;
  }
  function openImage(image, title = '原作图片') {
    const japanese=settings.language==='ja';
    if($('panel').open&&!$('panel').classList.contains('image-panel')){
      imageReturn={title:$('panel-title').textContent,classes:$('panel').className,nodes:[...$('panel-body').childNodes],top:$('panel-body').scrollTop,focus:document.activeElement};
    }
    const viewer=document.createElement('div');viewer.className='image-viewer';
    const dismiss=makeButton('',closePanel,'image-dismiss');dismiss.type='button';dismiss.setAttribute('aria-label',japanese?'画像を閉じる':'关闭图片');
    const full=document.createElement('img');full.className='full-image';full.src=image.src;full.alt=image.alt||image.name||title;
    dismiss.append(full);viewer.append(dismiss);
    openPanel(title,viewer,true);
    dismiss.focus({preventScroll:true});
  }
  function closePanel() {
    stopLogVoice();
    if(imageReturn&&$('panel').classList.contains('image-panel')){
      const previous=imageReturn;imageReturn=null;$('panel').className=previous.classes;$('panel-title').textContent=previous.title;
      $('panel-body').replaceChildren(...previous.nodes);$('panel-body').scrollTop=previous.top;previous.focus?.focus({preventScroll:true});return;
    }
    imageReturn=null;$('panel').close();scheduleAuto();
  }
  function showOriginalMaterials() {
    const content=window.NativeUI.materials({language:settings.language,openImage});
    const trailer=window.LocalVideo?.appendTrailer(content,settings.language);
    const videos=[trailer,...(window.LocalVideo?.appendDemos(content,settings.language)||[])].filter(Boolean);
    let resumeMusic=false;
    const restoreMusic=()=>{
      if(videos.some(video=>!video.paused&&!video.ended))return;
      if(resumeMusic&&inReader&&currentBgm&&!settings.muted)music.play().catch(()=>{});
      resumeMusic=false;
    };
    for(const video of videos){
      video.muted=settings.muted;video.volume=Number(settings.voice);
      video.addEventListener('play',()=>{
        resumeMusic=resumeMusic||!music.paused;music.pause();stopVoice();
        for(const other of videos)if(other!==video)other.pause();
      });
      for(const name of ['pause','ended','error'])video.addEventListener(name,restoreMusic);
    }
    openPanel(settings.language==='ja'?'資料':'原版资料',content);
  }
  function stopVoice() { voiceToken++; voice.pause(); voice.removeAttribute('src'); voiceQueue = []; $('voice-state').textContent = ''; }
  function playQueue() {
    if (!voiceQueue.length || !voice.paused) return;
    const name = voiceQueue.shift(), clip = chapter().audio[name];
    if (!clip) { toast('此段语音资源缺失：' + name); return playQueue(); }
    voice.src = clip.src; applyVolume(); $('voice-state').textContent = '配音播放中';
    const token = voiceToken;
    voice.play().catch(() => { if (token === voiceToken) { $('voice-state').textContent = '点击「重听」播放配音'; voiceQueue = []; scheduleAuto(); } });
  }
  voice.addEventListener('ended', () => { $('voice-state').textContent = ''; playQueue(); scheduleAuto(); });
  voice.addEventListener('error', () => { $('voice-state').textContent = '音频加载失败'; voiceQueue = []; scheduleAuto(); });
  function enqueueCues(all = false) {
    if(fastForward){cueIndex=cues.length;return;}
    while (cueIndex < cues.length && (all || cues[cueIndex].at <= typed)) voiceQueue.push(cues[cueIndex++].name);
    playQueue();
  }
  function finishTyping() {
    clearInterval(typeTimer); typing = false; typed = displayedText.length; $('body-text').textContent = displayedText;
    enqueueCues(true); scheduleAuto();
  }
  function startText(text) {
    clearInterval(typeTimer); displayedText = core.cleanText(text); typed = 0; cues = core.voiceCues(text || ''); cueIndex = 0;
    $('body-text').textContent = ''; typing = displayedText.length > 0 && Number(settings.speed) > 0;
    if (!typing) { finishTyping(); return; }
    enqueueCues();
    const token = renderToken;
    typeTimer = setInterval(() => {
      if (token !== renderToken) return clearInterval(typeTimer);
      typed = Math.min(displayedText.length, typed + 1); $('body-text').textContent = displayedText.slice(0, typed); enqueueCues();
      if (typed >= displayedText.length) finishTyping();
    }, 1000 / Number(settings.speed));
  }
  function scheduleAuto() {
    clearTimeout(autoTimer);
    if (document.hidden || chapterCards?.active || fastForward || logRequested || !auto || !inReader || typing || forwardPending || finReady || animations.busy || animations.waiting || $('panel').open || !$('reader-controls').hidden || !voice.paused || voiceQueue.length) return;
    const e = event();
    if (!e || !['dialogue', 'transition'].includes(e.type)) return;
    autoTimer = setTimeout(() => advance(), Math.max(settings.autoDelay, core.cleanText(view(e).text).length * 35));
  }
  function stopFastForward(release = false) {
    clearTimeout(fastTimer); fastForward=false; fastStatus.hidden=true;
    if(release) controlHeld=false;
  }
  function fastForwardTick() {
    if(!fastForward) return;
    if(chapterCards?.active){chapterCards.fastForward?.();fastTimer=setTimeout(fastForwardTick,100);return;}
    const e=event(), focused=document.activeElement;
    if(!controlHeld || !inReader || document.hidden || $('panel').open || !$('reader-controls').hidden ||
      focused?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])') ||
      !e || !['dialogue','transition'].includes(e.type) || animations.waiting || finReady){stopFastForward();return;}
    // Native animation and its input guard always finish before the next advance.
    if(!forwardPending && !animations.blocked){
      if(typing) finishTyping();
      stopVoice(); advance(true);
    }
    if(fastForward)fastTimer=setTimeout(fastForwardTick,100);
  }
  function beginFastForward() {
    if(controlHeld) return;
    controlHeld=true;
    if(!inReader || $('panel').open || !$('reader-controls').hidden ||
      document.activeElement?.closest('input,select,textarea,[contenteditable]:not([contenteditable="false"])'))return;
    fastForward=true; auto=false;clearTimeout(autoTimer);updateControls();
    fastStatus.textContent=settings.language==='ja'?'早送り ▶▶':'快进 ▶▶';fastStatus.hidden=false;
    // A short grace period lets Ctrl+C / Ctrl+S cancel without advancing a line.
    fastTimer=setTimeout(fastForwardTick,120);
  }
  const actorKey = presentation.character;
  function fitActors() {
    if (!actorShot) return;
    const frame = $('reader').getBoundingClientRect();
    if (!(frame.width > 0 && frame.height > 0)) return;
    const layout = presentation.layout(actorShot, frame.width, frame.height);
    const signature = layout.map(x=>x.stageName+':'+x.src).join('|');
    if ($('actors').dataset.signature !== signature) {
      $('actors').replaceChildren(); $('actors').dataset.signature = signature;
      layout.forEach(img => { const el = document.createElement('img'); el.src = img.src; el.alt = img.name; el.className = 'actor'; el.dataset.character = img.character; el.dataset.identity = img.identity; el.dataset.stageName = img.stageName; $('actors').append(el); });
    }
    [...$('actors').children].forEach((el, i) => {
      const actor = layout[i];
      Object.assign(el.style, { left: actor.left + 'px', top: actor.top + 'px', width: actor.width + 'px', height: actor.height + 'px' });
      if(actor.visibleFrom!==undefined)el.dataset.visibleFrom=actor.visibleFrom;else delete el.dataset.visibleFrom;
    });
    const propLayout = window.PropCore.layout(propShot, frame.width, frame.height);
    const propSignature = propLayout.map(x=>x.model+':'+x.src).join('|');
    if ($('props').dataset.signature !== propSignature) {
      $('props').replaceChildren(); $('props').dataset.signature = propSignature;
      propLayout.forEach(img=>{
        const label=({'pic_banana':'香蕉','pic_chest':'柜子','pic_locker':'储物柜','pic_paper':'故障中告示','pic_vend':'售货机','pic_vend-onSale':'售货机'})[img.name]||'原作道具';
        const el=document.createElement('img');el.src=img.src;el.alt=label;el.dataset.stageName=img.stageName;el.dataset.propModel=img.model;
        el.tabIndex=0;el.setAttribute('role','button');el.setAttribute('aria-label','放大查看'+label);
        const inspect=()=>openImage(img,label);
        el.addEventListener('click',ev=>{ev.stopPropagation();inspect();});
        el.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();ev.stopPropagation();inspect();}});
        $('props').append(el);
      });
    }
    [...$('props').children].forEach((el,i)=>{const model=propLayout[i];Object.assign(el.style,{left:model.left+'px',top:model.top+'px',width:model.width+'px',height:model.height+'px'});});
    fitCall();
    // Refresh after both art layers have their new geometry. The animation's
    // ResizeObserver can otherwise read the previous viewport's image bounds.
    animations.refreshTarget?.();
  }
  function fitCall(){
    const call=actorShot?.calls[0];if(!call)return;
    const frame=$('reader').getBoundingClientRect();if(!(frame.width>0&&frame.height>0))return;
    const relative=node=>{const r=node.getBoundingClientRect();return {left:r.left-frame.left,top:r.top-frame.top,width:r.width,height:r.height};};
    const bubble=window.CallLayout.layout(call,frame,relative($('dialogue')),relative($('speaker')));
    if(bubble){Object.assign($('call-portraits').style,{left:bubble.left+'px',right:'auto',top:bubble.top+'px',width:bubble.width+'px'});$('call-portraits').dataset.placement=bubble.side;}
  }
  new ResizeObserver(fitActors).observe($('reader'));
  new ResizeObserver(fitCall).observe($('dialogue'));
  function renderStage(e) {
    const seen = new Set(); let background = '', bgm = '';
    for (const s of e.stage || []) {
      if (s.bgm) bgm = s.bgm;
      // Phone UI is rendered by the interactive event, not as scenery.
      if (/^(PhoneQuiz|RecvMail|PhonePicture|NazoShiritori)$/.test(s.name)) continue;
      for (const img of s.images || []) {
        const key = s.name + '|' + img.src;
        if (seen.has(key)) continue;
        seen.add(key);
        // The locker sign is placed by PropCore with its native overlay transform.
        if (img.name === 'pic_paper') continue;
        if (/^BG|background|Room/i.test(img.name) && img.width > img.height) background = img.src;
        else if (/_Bubble$/i.test(img.name)) continue;
        else if (actorKey(img.name)) continue;
      }
    }
    // Chapter 2-1 keeps the lab backdrop active outside its Timeline tracks.
    // The archived sprite and the 13:15 original screenshot both confirm it.
    if (!background && chapter().key === '2-1') background = chapter().sprites.find(img => img.name === 'BG02A2')?.src || '';
    const shot = presentation.plan(chapter(), e, presentationData, window.ANIMATION_DATA.chapters[chapter().key]);
    propShot = window.PropCore.plan(chapter(), e, window.PROP_DATA);
    const backdrop = window.BackgroundCore.plan(chapter(), e, background, propShot.mode);
    $('background').style.backgroundImage = backdrop.src ? `url("${backdrop.src}")` : '';
    $('background').style.backgroundPosition = backdrop.position;
    $('background').dataset.source = backdrop.source;
    $('background').dataset.scene = backdrop.scene;
    $('reader').dataset.puzzleBackdrop = String(backdrop.scene==='puzzle-context');
    $('reader').dataset.propShot = propShot.mode;
    actorShot = propShot.mode === 'none' ? shot : {...shot, actors:[], calls:[]};
    $('actors').dataset.shotReason = shot.reason;
    fitActors();
    const call = actorShot.calls[0];
    if ($('call-portraits').dataset.signature !== (call?.src || '')) {
      $('call-portraits').replaceChildren(); $('call-portraits').dataset.signature = call?.src || '';
      if (call) $('call-portraits').append(window.CallView.create(call,presentationData));
    }
    if (call) $('call-portraits').firstElementChild.setAttribute('aria-label',(settings.language==='ja'?'電話中の':'电话中的')+(view(e).speakerLabel || call.name));
    $('reader').classList.toggle('has-call', Boolean(call));
    fitCall();
    const clip = chapter().audio[bgm]; const src = clip?.src || '';
    if (currentBgm !== src) { currentBgm = src; music.pause(); if (src) { music.src = src; applyVolume(); music.play().catch(() => {}); } }
    $('clock').textContent = e.clock || '';
    $('reader').dataset.clockEmpty = String(!e.clock);
    clockContrast?.update();
  }
  function makeButton(text, handler, className = '') { const el = document.createElement('button'); el.textContent = text; el.className = className; el.addEventListener('click', handler); return el; }
  function showImage(image, parent) {
    if (!image) return; const img = document.createElement('img'); img.src = image.src; img.alt = image.name || '原作图片'; img.className = 'event-image';
    img.addEventListener('click', () => openImage(img));
    img.tabIndex=0;img.setAttribute('role','button');
    img.addEventListener('keydown',ev=>{if(ev.key==='Enter'||ev.key===' '){ev.preventDefault();ev.stopPropagation();openImage(img);}});parent.append(img);
  }
  function makeField(parent, labelText, key, options, value = '') {
    const label = document.createElement('label'); label.append(document.createTextNode(labelText));
    const input = options ? document.createElement('select') : document.createElement('input'); input.name = key; input.id = 'answer-' + key;
    if (options) for (const option of options) { const o = document.createElement('option'); o.value = option; o.textContent = option ? optionLabel(key, option) : '请选择'; input.append(o); }
    else { input.autocomplete = 'off'; input.placeholder = settings.language==='ja'?'答えを入力':'输入原文答案'; }
    input.value = value; label.append(input); parent.append(label); return input;
  }
  function renderDmail(e) {
    const display=view(e);
    const editor=window.DmailView.create({event:e,chapter:chapter(),language:settings.language,
      prompt:core.cleanText(display.text),label:optionLabel,normalize:core.normalize,
      onSend(values,feedback) {
        finishTyping();
        if (core.checkMail(e,values)) {
          solved[e.id]='solved';persist();updateControls();advance(true);
        } else {
          const custom=(display.incorrect||[]).find(rule=>Object.entries(rule).filter(([key])=>['time','at','what'].includes(key)).every(([key,value])=>core.normalize(values[key])===core.normalize(value)));
          const message=custom?.message ? core.cleanText(custom.message) : settings.language==='ja'?'メールの内容が正しくありません。修正して再送信してください。':'邮件内容有误，请修改后重新发送。';
          feedback.textContent=message;
          feedback.scrollIntoView({block:'nearest'});
        }
      },
      onContinue() { finishTyping();solved[e.id]='story-skip';advance(true); },
      hint() { const ja=settings.language==='ja';return (ja?'正解の組み合わせ：':'答案组合：')+[e.answer[0]||(ja?'時刻指定なし':'任意时刻'),optionLabel('to',e.answer.length>3?e.answer[3]:e.to),optionLabel('at',e.answer[1])||(ja?'場所指定なし':'任意地点'),optionLabel('what',e.answer[2])].join(' · '); }
    });
    $('dmail-layer').replaceChildren(editor);
  }
  function renderInteractive(e) {
    const display = view(e);
    const container = $('event-extra');
    if(settings.language==='zh-CN'){
      const reading={
        '8:38':'つくれ ／ つくるな',
        '8:47':'なかまつ ｜ くるな → 别来中松',
        '8:48':'なかま ｜ つくるな → 别交伙伴'
      }[e.id];
      if(reading){const note=document.createElement('p');note.className='pun-reading';note.textContent=reading;container.append(note);}
    }
    if (e.type === 'image' || e.type === 'mail') {
      $('phone-layer').replaceChildren(window.NativeUI.phone({event:e,display,language:settings.language,clean:core.cleanText,openImage}));return;
    }
    if (e.type === 'document'&&e.image) {
      const layout=document.createElement('div');layout.className='native-document-layout';
      const inspect=makeButton('',()=>openImage(e.image,ui('新闻','ニュース')),'native-document-button');inspect.type='button';inspect.setAttribute('aria-label',ui('放大新闻','ニュースを拡大'));
      const image=document.createElement('img');image.src=e.image.src;image.alt=ui('新闻','ニュース');inspect.append(image);layout.append(inspect);$('phone-layer').replaceChildren(layout);return;
    }
    if (e.type==='dmail') { renderDmail(e);return; }
    if (e.type!=='question') return;
    for (const notice of display.notices || []) { const p = document.createElement('p'); p.className = 'question-note'; p.textContent = core.cleanText(notice); container.append(p); }
    showImage(e.image, container);
    const clueImages = [...new Map((e.stage || []).filter(s => s.name === 'NazoShiritori').flatMap(s => s.images || []).map(img => [img.src, img])).values()];
    if (e.type === 'question' && clueImages.length) {
      const gallery = document.createElement('div'); gallery.className = 'clue-gallery';
      clueImages.forEach((image, n) => {
        const card = document.createElement('button'); card.type = 'button'; card.className = 'clue-card'; card.setAttribute('aria-label', '查看物件 ' + (n + 1));
        const img = document.createElement('img'); img.src = image.src; img.alt = '场景物件 ' + (n + 1); card.append(img);
        card.addEventListener('click', () => openImage(img,'原作物件')); gallery.append(card);
      });
      container.append(gallery);
    }
    const fields = document.createElement('div'); fields.className = 'puzzle-fields'; container.append(fields);
    const inputs = {};
    inputs.answer = makeField(fields, settings.language==='ja'?'答え':'答案', 'text');
    const feedback = document.createElement('span'); feedback.className = 'answer-feedback'; feedback.setAttribute('role', 'status');
    const actions = document.createElement('div'); actions.className = 'event-actions';
    function submit() {
      if(forwardPending||animations.blocked)return;
      finishTyping(); const values = Object.fromEntries(Object.entries(inputs).map(([key, input]) => [key, input.value]));
      const correct = core.checkQuestion(e, values.answer);
      if (correct) { stopFastForward();solved[e.id] = 'solved'; persist();updateControls();advance(true); }
      else {
        const custom = (display.incorrect || []).find(rule => Object.entries(rule).filter(([key]) => ['time', 'at', 'what'].includes(key)).every(([key, value]) => core.normalize(values[key]) === core.normalize(value)));
        feedback.textContent = custom?.message ? core.cleanText(custom.message) : settings.language==='ja'?'答えが違うようです。もう一度試してください。':'答案不正确，再试一次。';
      }
    }
    inputs.answer?.addEventListener('keydown', ev => { if (ev.key === 'Enter'&&!ev.isComposing&&ev.keyCode!==229) { ev.preventDefault(); submit(); } });
    actions.append(makeButton(settings.language==='ja'?'回答する':'提交答案', submit, 'solve'));
    actions.append(makeButton(settings.language==='ja'?'問題をスキップ →':'跳过题目 →', () => { finishTyping(); solved[e.id] = 'story-skip'; advance(true); }));
    actions.append(makeButton(settings.language==='ja'?'ヒント':'提示', () => {
      feedback.textContent = (settings.language==='ja'?'正解：':'答案：') + e.answers.join(' / ');
    }, 'inline-link'));
    container.append(actions, feedback);
    if (solved[e.id]) feedback.textContent = settings.language==='ja'?(solved[e.id]==='solved'?'回答済み':'スキップ済み'):(solved[e.id] === 'solved' ? '已解答' : '已跳过');
  }
  function updateControls() {
    $('reader').lang=settings.language;
    $('reader').dataset.language = settings.language;
    $('speaker').lang = settings.language; $('body-text').lang = settings.language;
    $('reader').dataset.clockStyle = ['compact', 'hidden'].includes(settings.clockStyle) ? settings.clockStyle : 'compact';
    $('auto').setAttribute('aria-pressed', String(auto)); $('auto').textContent = auto ? ui('自动 开','オート ON') : ui('自动','オート');
    $('mute').setAttribute('aria-pressed', String(settings.muted)); $('mute').textContent = settings.muted ? ui('声音 关','サウンド OFF') : ui('声音 开','サウンド ON');
    for(const [id,labels] of Object.entries({'chapter-menu':['选择章节','チャプター選択'],save:['存档与读取','セーブ・ロード'],settings:['阅读设置','読書設定'],'original-materials':['原版资料','資料'],menu:['返回主菜单','タイトルへ戻る'],'replay-voice':['重听配音','ボイス再生']}))$(id).textContent=ui(...labels);
    $('controls-toggle').setAttribute('aria-label',ui('播放菜单','再生メニュー'));$('controls-toggle').title=ui('播放菜单','再生メニュー');
    $('panel-close').setAttribute('aria-label',ui('关闭','閉じる'));
    $('mode-badge').textContent = settings.language==='ja'?(settings.mode==='story'?'ストーリーモード':'謎解きモード'):(settings.mode === 'story' ? '故事模式' : '解谜模式');
    $('previous').disabled = false; $('previous').textContent=settings.language==='ja'?'バックログ':'回看记录';
    $('log').setAttribute('aria-label',settings.language==='ja'?'バックログ':'回看记录');$('log').title=$('log').getAttribute('aria-label');
    $('next').disabled = index >= (chapter()?.events.length || 0);
  }
  function previewInteractive(e) {
    $('reader').dataset.eventType = e.type; $('dialogue').classList.add('interactive');
    $('speaker').textContent = ui('谜题','謎解き'); $('body-text').textContent = core.cleanText(view(e).text);
    $('event-extra').replaceChildren(); $('dmail-layer').replaceChildren(); $('phone-layer').replaceChildren(); renderInteractive(e);
  }
  function render() {
    index=storyMode.anchor(chapter(),index,settings.mode);
    // Finish native chapter animations, then enter the next segment directly.
    // This also migrates old saves parked on the former Next Chapter screen.
    if(index>=chapter().events.length&&chapterIndex<chapters.length-1){const major=chapter().key.split('-')[0]!==chapters[chapterIndex+1].key.split('-')[0];startChapter(chapterIndex+1,0,true,major);return;}
    phoneGesture=null;
    animations.clearPresentation(); finReady = false; forwardPending = false;
    renderToken++; setControlsOpen(false); clearInterval(typeTimer); clearTimeout(autoTimer); stopVoice(); $('event-extra').replaceChildren(); $('dmail-layer').replaceChildren(); $('phone-layer').replaceChildren();
    $('chapter-number').textContent = 'CHAPTER ' + chapter().key; $('chapter-title').textContent = chapterTitle(chapter());
    const e = event();
    if(!e || !['dialogue','transition'].includes(e.type))stopFastForward();
    if(e&&index>(readThrough[chapter().key]??-1)){
      readThrough=backlog.merge(chapters,readThrough,{[chapter().key]:index});storage.set('.readThrough',readThrough);
    }
    $('reader').dataset.eventType = e?.type || 'complete';
    $('transition').hidden = e?.type !== 'transition';
    $('dialogue').classList.toggle('interactive', !e || !['dialogue', 'transition'].includes(e.type));
    $('dialogue').querySelector('.dialogue-content').scrollTop = 0;
    $('progress-fill').style.width = (100 * Math.min(index + 1, chapter().events.length) / chapter().events.length) + '%';
    $('position').textContent = `${Math.min(index + 1, chapter().events.length)} / ${chapter().events.length}`;
    $('replay-voice').hidden = !e?.voices?.length; updateControls();
    if (!e) {
      typing = false; $('speaker').textContent = ''; $('body-text').replaceChildren(); $('transition').hidden = true; $('advance-hint').textContent = '';
      const complete = document.createElement('div'); complete.className = 'complete';
      complete.innerHTML = '<span class="end-label">END OF STORY</span>';
      complete.append(makeButton(settings.language==='ja'?'タイトルへ戻る':'返回主菜单', home, 'primary'));
      $('body-text').append(complete); persist(); animations.completion(); return;
    }
    $('speaker').textContent = e.type === 'mail' ? (settings.language==='ja'?'受信メール':'收到邮件') : e.type === 'dmail' ? 'D-MAIL' : e.type === 'question' ? (settings.language==='ja'?'謎解き':'谜题') : view(e).speakerLabel;
    $('advance-hint').textContent = '点击画面或按空格继续';
    const readingTime = animations.readingTime(e.t);
    renderStage({...e,presentationTime:readingTime}); animations.applyAt(readingTime); renderInteractive(e); startText(view(e).text || (e.type === 'image' ? '原作图片' : ''));
    if(e.type==='mail'||e.type==='image')finishTyping();
    if (e.type === 'transition') {
      const token=renderToken,mapped=window.LocalVideo?.hasTransition(e),resumeMusic=mapped&&!music.paused;
      if(mapped){stopFastForward();music.pause();}
      animations.transition(true,e).then(result=>{
        if(token!==renderToken||!inReader||event()!==e)return;
        animations.finish();
        if(resumeMusic&&!settings.muted)music.play().catch(()=>{});
        if(result?.played)moveForward();
      });
    }
    if (e.type === 'mail' && e.voices?.length) { voiceQueue.push(...e.voices); playQueue(); }
    persist();
  }
  function startChapter(n, at = 0, seamless = false, showTitle = false) {
    if (!Number.isInteger(n) || n < 0 || n >= chapters.length) return;
    chapterCards?.cancel();
    if(!seamless)stopFastForward();logRequested=false;
    chapterIndex = n; index = Math.max(0, Math.min(Number(at) || 0, chapter().events.length)); inReader = true; forwardPending = false; animations.select(chapter());
    $('home').hidden = true; $('reader').hidden = false; if ($('panel').open) $('panel').close();
    if(showTitle&&chapterCards&&index===0){
      const token=++renderToken;clearInterval(typeTimer);clearTimeout(autoTimer);stopVoice();typing=false;setControlsOpen(false);updateControls();
      chapterCards.show({chapter:chapter(),language:settings.language,title:chapterTitle(chapter()),fast:fastForward,auto}).then(completed=>{if(completed&&inReader&&token===renderToken)render();});
      clearTimeout(autoTimer);persist();return;
    }
    render();
  }
  function advance(force = false) {
    if(chapterCards?.active){chapterCards.skip();return;}
    if (!inReader || $('panel').open || animations.blocked) return;
    if (forwardPending) { if (animations.waiting) toast('请点击画面中的目标完成拍摄'); return; }
    if (finReady) { finReady = false; index++; render(); return; }
    if (typing && !force) { finishTyping(); return; }
    const e = event(); if (!e) return;
    if (['question', 'dmail'].includes(e.type) && !force) { toast(settings.language==='ja'?'回答を送信するか、「問題をスキップ」を選んでください。':'请提交答案，或使用「跳过题目」'); return; }
    moveForward();
  }
  async function moveForward() {
    forwardPending = true; clearTimeout(autoTimer); stopVoice();
    const priorIndex = index, priorChapter = chapterIndex, priorRender = renderToken;
    const ownsStep=()=>inReader&&priorChapter===chapterIndex&&priorIndex===index&&priorRender===renderToken;
    let advanced=false;
    const from = event(), nextIndex=storyMode.next(chapter(),index,settings.mode);
    const next = storyMode.event(chapter(),nextIndex,settings.mode,settings.language);
    try {
      let fin;
      if (from.type === 'transition') {
        // Advance native state while the full-screen transition still covers
        // it. Its fade must never reveal the previous cast or prop variant.
        fin=await animations.bridge(from.t,next?.t??animations.endTime,next||from);
        if(!ownsStep())return;
        animations.prepareTransition?.(next);
        const result=await animations.transition(false,from);
        if(!ownsStep()||result?.cancelled)return;
      }else{
        fin=await animations.bridge(from.t,next?.t??animations.endTime,next||from);
      }
      if (!ownsStep()) return;
      forwardPending = false; animations.finish();
      if (fin) { finReady = true; $('dialogue').style.visibility = 'hidden'; return; }
      advanced=true;index=nextIndex; render();
    } catch (error) {
      if(!ownsStep())return;
      stopFastForward();
      forwardPending = false; animations.finish(); toast('演出加载失败，请重新进入本段'); console.error(error);
    } finally {
      if(logRequested&&inReader&&(advanced||ownsStep())){logRequested=false;showLog();}
    }
  }
  function home() { chapterCards?.cancel();stopFastForward();persist(); setControlsOpen(false); inReader = false; auto = false; forwardPending = false; animations.clearPresentation(); clearInterval(typeTimer); clearTimeout(autoTimer); stopVoice(); music.pause(); currentBgm = ''; $('reader').hidden = true; $('home').hidden = false; refreshContinue(); }
  function restore(save) { if (!core.validateSave(save, chapters)) { toast('存档格式或进度无效'); return; } if(['story','puzzle'].includes(save.mode)){settings.mode=save.mode;saveSettings();}readThrough=backlog.merge(chapters,readThrough,backlog.fromSave(chapters,save));storage.set('.readThrough',readThrough);solved = { ...(save.solved || {}) }; startChapter(chapters.findIndex(c => c.key === save.chapter), save.index); }
  function refreshHome() {
    document.documentElement?.setAttribute('lang',settings.language);
    document.title=ui('STEINS;GATE · 自我指涉的动力学','STEINS;GATE · 自己言及のダイナミクス');
    $('home').lang=settings.language;
    $('home').dataset.language=settings.language;
    for(const [id,zh,ja,icon] of [
      ['continue','继续阅读','つづきから','↗'],
      ['start','开始阅读','はじめから','→'],
      ['home-chapters','选择章节','チャプター選択','01 — 11'],
      ['home-mode',settings.mode==='story'?'故事模式':'解谜模式',settings.mode==='story'?'ストーリーモード':'謎解きモード','⇄']
    ])$(id).innerHTML=`${ui(zh,ja)} <span aria-hidden="true">${icon}</span>`;
    const modeAction=settings.mode==='story'?ui('切换为解谜模式','謎解きモードに切り替え'):ui('切换为故事模式','ストーリーモードに切り替え');
    $('home-mode').title=modeAction;
    $('home-mode').setAttribute('aria-label',$('home-mode').textContent.replace('⇄','').trim()+'，'+modeAction);
    $('home-language').setAttribute('aria-pressed',String(settings.language==='ja'));
    $('download-offline').textContent=ui('下载离线版','ダウンロード');
    $('download-offline').setAttribute('aria-label',ui('下载 Windows 离线版，约 215 MB','Windows オフライン版をダウンロード、約215 MB'));
    $('source-code').setAttribute('aria-label',ui('在 GitHub 查看源码','GitHub でソースコードを見る'));
    $('home-language').title=ui('切换为日本語','简体中文に切り替え');
    $('home-actions').setAttribute('aria-label',ui('主菜单','メインメニュー'));
    $('home-title').innerHTML=ui('自我指涉的<span>动力学</span>','自己言及の<span>ダイナミクス</span>');
    for(const [id,labels] of Object.entries({
      'home-sub':['秋叶原，一次偶然的相遇。','秋葉原、偶然の出会い。'],      'home-meta':['原作日语配音','オリジナル日本語音声'],
      about:['游玩说明','遊び方'],
      'original-materials-home':['原版资料','資料'],
      'coaster-home':['AR 杯垫','ARコースター']
    }))$(id).textContent=ui(...labels);
  }
  function refreshContinue() { $('continue').hidden = !core.validateSave(storage.get('.auto'), chapters); refreshHome(); }
  function showChapters() {
    const list = document.createElement('div');
    chapters.forEach((c, n) => { const b = document.createElement('button'); b.className = 'chapter-card'; b.innerHTML = `<b>${escapeHtml(c.key)}</b><span>${escapeHtml(chapterTitle(c))}</span>`; b.addEventListener('click', () => startChapter(n,0,false,!c.key.endsWith('-2'))); list.append(b); });
    openPanel(ui('选择章节','チャプター選択'), list);
  }
  function showLog() {
    if(chapterCards?.active)return;
    stopFastForward();clearTimeout(autoTimer);
    // Finish an already-running advance before opening history. This prevents
    // its asynchronous completion from moving the scene behind the dialog.
    if(forwardPending&&!animations.waiting){logRequested=true;return;}
    logRequested=false;
    finishTyping();stopVoice();
    const ja=settings.language==='ja';
    // A rewind or old save must not expose later lines, even if another visit
    // has already marked them read. Keep that saved knowledge separate.
    const visibleRead=backlog.through(chapters,readThrough,chapter().key,index);
    const box=document.createElement('div');box.className='backlog-view';
    const tools=document.createElement('div');tools.className='backlog-tools';
    const filter=document.createElement('select');filter.setAttribute('aria-label',ja?'章を選択':'回看章节');
    filter.add(new Option(ja?'すべての既読':'全部已读',''));
    chapters.filter(c=>visibleRead[c.key]>=0).forEach(c=>filter.add(new Option(c.key+' · '+chapterTitle(c),c.key)));
    const search=document.createElement('input');search.type='search';search.placeholder=ja?'本文・名前を検索':'搜索对白或姓名';search.setAttribute('aria-label',search.placeholder);
    const list=document.createElement('div');list.className='backlog-list';list.tabIndex=0;list.setAttribute('role','region');list.setAttribute('aria-label',ja?'既読履歴':'已读记录');list.lang=settings.language;
    function alignCurrentLine(){
      if(list.dataset.browsing!=='true'&&$('panel').open&&$('panel-body').querySelector('.backlog-view')===box)list.scrollTop=list.scrollHeight;
    }
    function draw(){
      stopLogVoice();
      list.replaceChildren();const query=search.value.trim().toLocaleLowerCase();let lastChapter='',count=0;
      for(const row of backlog.entries(chapters,visibleRead,filter.value)){
        if(storyMode.anchor(row.chapter,row.index,settings.mode)!==row.index)continue;
        const e=storyMode.event(row.chapter,row.index,settings.mode,settings.language),display=view(e),label=display.speakerLabel||(e.type==='dialogue'?(ja?'地の文':'旁白'):({question:ja?'問題':'谜题',dmail:'D-Mail',mail:ja?'メール':'邮件',image:ja?'画像':'图片',document:ja?'資料':'资料',transition:ja?'世界線移動':'世界线过渡'})[e.type]);
        if(query&&!(label+' '+core.cleanText(display.text)).toLocaleLowerCase().includes(query))continue;
        if(lastChapter!==row.chapter.key){const heading=document.createElement('h3');heading.className='backlog-chapter';heading.textContent=row.chapter.key+' · '+chapterTitle(row.chapter);list.append(heading);lastChapter=row.chapter.key;}
        const entry=document.createElement('article');entry.className='log-entry';entry.dataset.event=e.id;
        if(row.chapter.key===chapter().key&&row.index===index){entry.classList.add('current');entry.setAttribute('aria-current','true');}
        const sources=backlog.voiceSources(row.chapter,e,core);
        const body=document.createElement(sources.length?'button':'div');body.className='backlog-entry-body';
        const meta=document.createElement('span');meta.className='backlog-meta';
        const speaker=document.createElement('span');speaker.textContent=label;
        meta.append(speaker);
        if(sources.length){
          body.type='button';body.classList.add('backlog-entry-play');body.setAttribute('aria-label',ja?label+'の音声を再生': '重听'+label+'的台词');
          body.addEventListener('click',()=>{
            if(window.getSelection?.()?.toString())return;
            stopLogVoice();const audio=new Audio();audio.hidden=true;entry.append(audio);let next=0;
            const session={stop(){audio.pause();audio.removeAttribute('src');audio.load();audio.remove();entry.classList.remove('playing');}};
            logVoice=session;entry.classList.add('playing');audio.volume=settings.muted?0:Number(settings.voice);
            const play=()=>{if(logVoice!==session)return;if(next===sources.length){stopLogVoice();return;}audio.src=sources[next++];audio.play().catch(()=>{if(logVoice===session){stopLogVoice();toast(ja?'音声を再生できませんでした。':'语音播放失败，请重试。');}});};
            audio.addEventListener('ended',play);audio.addEventListener('error',()=>{if(logVoice===session){stopLogVoice();toast(ja?'音声を読み込めませんでした。':'语音加载失败。');}});play();
          });
        }
        const jump=makeButton(ja?'ジャンプ':'跳转',ev=>{ev.stopPropagation();auto=false;stopFastForward();clearTimeout(autoTimer);closePanel();startChapter(chapters.indexOf(row.chapter),row.index);});jump.className='backlog-jump';
        const text=document.createElement('span');text.className='backlog-text';text.innerHTML=format(display.text);body.append(meta,text);entry.append(body,jump);list.append(entry);count++;
      }
      if(!count){const empty=document.createElement('p');empty.className='backlog-empty';empty.textContent=ja?'一致する履歴はありません。':'没有匹配的已读记录。';list.append(empty);}
      list.scrollTop=0;
    }
    filter.addEventListener('change',draw);search.addEventListener('input',draw);
    for(const type of ['pointerdown','keydown'])box.addEventListener(type,()=>{list.dataset.browsing='true';});
    tools.append(filter,search);box.append(tools,list);draw();
    openPanel(ja?'バックログ':'回看记录',box);$('panel').classList.add('backlog-panel');
    // Every opening starts at the current line, with no later entries below it.
    alignCurrentLine();
    window.requestAnimationFrame?.(alignCurrentLine);
    document.fonts?.ready?.then(alignCurrentLine);
  }
  function refreshReaderPreservingAnswers() {
    if(!inReader)return;
    const id=event()?.id;
    const fields=[$('dmail-layer'),$('event-extra')].flatMap(root=>[...root.querySelectorAll('input,select')]).map(input=>({id:input.id,value:input.value}));
    render();
    // A language/mode refresh may translate this same form. Keep its values,
    // but never carry a draft into a different question or story bridge.
    if(event()?.id!==id)return;
    for(const field of fields){const input=$(field.id);if(!input)continue;input.value=field.value;input.dispatchEvent(new Event('change',{bubbles:true}));}
  }
  function showSettings() {
    const ja=settings.language==='ja';
    openPanel(ja?'読書設定':'阅读设置', ja?`<label class="setting-row"><span>プレイモード</span><select id="set-mode"><option value="story">ストーリーモード</option><option value="puzzle">謎解きモード</option></select></label><label class="setting-row"><span>時刻表示</span><select id="set-clock"><option value="compact">表示</option><option value="hidden">非表示</option></select></label><label class="setting-row"><span>文字速度</span><select id="set-speed"><option value="14">遅い</option><option value="28">標準</option><option value="55">速い</option><option value="0">即時表示</option></select></label><label class="setting-row"><span>ボイス音量</span><input id="set-voice" type="range" min="0" max="1" step="0.05"></label><label class="setting-row"><span>BGM音量</span><input id="set-music" type="range" min="0" max="1" step="0.05"></label><label class="setting-row"><span>オート待機</span><select id="set-delay"><option value="1200">短い</option><option value="2200">標準</option><option value="4000">長い</option></select></label><p class="panel-note">上スクロールで履歴、下スクロールで次へ。Ctrl長押しで早送り。操作が必要な場面で停止します。</p>`:`<label class="setting-row"><span>游玩方式</span><select id="set-mode"><option value="story">故事模式</option><option value="puzzle">解谜模式</option></select></label><label class="setting-row"><span>时间显示</span><select id="set-clock"><option value="compact">显示</option><option value="hidden">隐藏</option></select></label><label class="setting-row"><span>文字速度</span><select id="set-speed"><option value="14">慢</option><option value="28">标准</option><option value="55">快</option><option value="0">立即显示</option></select></label><label class="setting-row"><span>配音音量</span><input id="set-voice" type="range" min="0" max="1" step="0.05"></label><label class="setting-row"><span>背景音乐</span><input id="set-music" type="range" min="0" max="1" step="0.05"></label><label class="setting-row"><span>自动等待</span><select id="set-delay"><option value="1200">短</option><option value="2200">标准</option><option value="4000">长</option></select></label><p class="panel-note">上滚回看，下滚推进。按住 Ctrl 快进，遇到操作点停止。</p>`);
    $('panel').classList.add('settings-panel');
    const language = document.createElement('label'); language.className = 'setting-row';
    language.innerHTML = `<span>${ja?'本文の言語':'正文语言'}</span><select id="set-language"><option value="auto">${ja?'ブラウザーに従う':'跟随浏览器'}</option><option value="zh-CN" lang="zh-CN">简体中文</option><option value="ja" lang="ja">日本語</option></select>`;
    $('panel-body').prepend(language);
    const modeNote=document.createElement('p');modeNote.className='panel-note';modeNote.textContent=ja?'ストーリーモードは冊子・折り紙の謎を省略します。D-Mailはどちらのモードでも操作できます。':'故事模式省略纸质材料解谜；两种模式均保留 D-Mail 操作。';$('panel-body').append(modeNote);
    $('set-language').value = settings.languageMode === 'auto' ? 'auto' : settings.language;
    $('set-language').addEventListener('change', () => { const choice=$('set-language').value; settings.languageMode=choice==='auto'?'auto':'manual';settings.language=choice==='auto'?browserLanguage():choice; saveSettings(); refreshReaderPreservingAnswers(); showSettings(); });
    [['mode', 'set-mode'], ['clockStyle', 'set-clock'], ['speed', 'set-speed'], ['voice', 'set-voice'], ['music', 'set-music'], ['autoDelay', 'set-delay']].forEach(([key, id]) => { $(id).value = settings[key]; $(id).addEventListener('change', () => { settings[key] = ['mode', 'clockStyle'].includes(key) ? $(id).value : Number($(id).value); saveSettings(); if(key==='mode')refreshReaderPreservingAnswers(); }); });
  }
  function saveLabel(save) { const c = chapters.find(ch => ch.key === save?.chapter); return c ? `${c.key} · ${chapterTitle(c)}` : ui('空存档','空きスロット'); }
  function showSaves() {
    finishTyping(); const box = document.createElement('div');
    for (let slot = 1; slot <= 3; slot++) {
      const save = storage.get('.slot' + slot), row = document.createElement('div'); row.className = 'save-row';
      const desc = document.createElement('span'); desc.textContent = `0${slot}　${saveLabel(save)}`;
      if (save) { const small = document.createElement('small'); small.textContent = `${save.index + 1} · ${new Date(save.date).toLocaleString(settings.language)}`; desc.append(small); }
      row.append(desc, makeButton(ui('保存','セーブ'), () => { if (storage.set('.slot' + slot, snapshot())) { toast(ui('已保存到存档 ','セーブしました：')+slot); showSaves(); } else toast(ui('浏览器未允许本地存档，请导出进度','保存できません。進行状況を書き出してください。')); }));
      const load = makeButton(ui('读取','ロード'), () => restore(storage.get('.slot' + slot))); load.disabled = !save; row.append(load); box.append(row);
    }
    const actions = document.createElement('div'); actions.className = 'panel-actions';
    actions.append(makeButton(ui('导出进度','進行状況を書き出す'), () => { const blob = new Blob([JSON.stringify(snapshot(), null, 2)], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'SteinsGate-XR-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }, 'panel-action'));
    const file = document.createElement('input'); file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true; file.addEventListener('change', async () => { try { restore(JSON.parse(await file.files[0].text())); } catch { toast(ui('无法读取此存档','セーブデータを読み込めません。')); } });
    actions.append(makeButton(ui('导入进度','進行状況を読み込む'), () => file.click(), 'panel-action'), file); box.append(actions);
    const p = document.createElement('p'); p.className = 'panel-note'; p.style.marginTop = '22px'; p.textContent = ui('进度自动保存在当前浏览器。','進行状況はこのブラウザーに自動保存されます。'); box.append(p); openPanel(ui('存档与读取','セーブ・ロード'), box);
  }
  $('start').addEventListener('click', async () => {
    if(startingNewGame)return;startingNewGame=true;
    try { await window.LocalVideo?.opening({ language:settings.language, volume:settings.muted?0:Number(settings.voice) }); solved = {}; startChapter(0,0,false,true); }
    finally { startingNewGame=false; }
  }); $('continue').addEventListener('click', () => {
    const save=storage.get('.auto');
    // Continue uses the mode chosen on the home screen; explicit save loads
    // still restore the mode recorded in that save.
    restore(save?{...save,mode:settings.mode}:save);
  });
  $('home-language').addEventListener('click',()=>{settings.languageMode='manual';settings.language=settings.language==='ja'?'zh-CN':'ja';saveSettings();});
  $('home-mode').addEventListener('click',()=>{settings.mode=settings.mode==='story'?'puzzle':'story';saveSettings();});
  $('coaster-home')?.addEventListener('click',()=>{
    openPanel(settings.language==='ja'?'STEINS;GATE ARコースター':'STEINS;GATE AR 杯垫','');
    $('panel').classList.add('coaster-panel');$('panel-body').append(window.CoasterView.create({language:settings.language,volume:settings.muted?0:Number(settings.voice)}));
  });
  $('home-chapters').addEventListener('click', showChapters); $('chapter-menu').addEventListener('click', showChapters); $('menu').addEventListener('click', home);
  $('original-materials-home').addEventListener('click',showOriginalMaterials);$('original-materials').addEventListener('click',showOriginalMaterials);
  $('controls-toggle').addEventListener('click', () => setControlsOpen($('reader-controls').hidden));
  $('next').addEventListener('click', () => { if (!$('reader-controls').hidden) setControlsOpen(false); else advance(); });
  $('phone-layer').addEventListener('pointerdown',ev=>{phoneGesture={x:ev.clientX,y:ev.clientY,dragged:false};});
  $('phone-layer').addEventListener('pointermove',ev=>{if(phoneGesture&&Math.hypot(ev.clientX-phoneGesture.x,ev.clientY-phoneGesture.y)>8)phoneGesture.dragged=true;});
  $('phone-layer').addEventListener('pointercancel',()=>{if(phoneGesture)phoneGesture.dragged=true;});
  $('phone-layer').addEventListener('scroll',()=>{if(phoneGesture)phoneGesture.dragged=true;},true);
  $('phone-layer').addEventListener('click',ev=>{
    const gesture=phoneGesture;phoneGesture=null;
    if(gesture?.dragged || ev.target.closest('button,a,input,select,textarea') || window.getSelection?.()?.toString())return;
    if(!$('reader-controls').hidden)setControlsOpen(false);else advance();
  });
  $('body-text').addEventListener('click', ev => { if (!window.getSelection?.()?.toString()&&!ev.target.closest('button') && event()) advance(); });
  $('previous').addEventListener('click', showLog);
  $('log').addEventListener('click', showLog); $('save').addEventListener('click', showSaves); $('settings').addEventListener('click', showSettings);
  $('auto').addEventListener('click', () => { auto = !auto; updateControls(); scheduleAuto(); });
  $('mute').addEventListener('click', () => { settings.muted = !settings.muted; saveSettings(); if (!settings.muted && currentBgm) music.play().catch(() => {}); });
  $('replay-voice').addEventListener('click', () => { finishTyping(); stopVoice(); voiceQueue = [...(event()?.voices || [])]; playQueue(); });
  $('panel-close').addEventListener('click', closePanel); $('panel').addEventListener('close',()=>{imageReturn=null;stopLogVoice();for(const v of $('panel').querySelectorAll('video'))v.pause();window.CoasterView?.stop();scheduleAuto();});
  $('panel').addEventListener('cancel',ev=>{ev.preventDefault();closePanel();});
  $('panel').addEventListener('click', ev => {
    if(ev.target!==$('panel'))return;const r=$('panel').getBoundingClientRect();
    if(ev.clientX<r.left||ev.clientX>r.right||ev.clientY<r.top||ev.clientY>r.bottom)closePanel();
  });
  $('about').addEventListener('click', () => {
    const ja=settings.language==='ja';
    openPanel(ja?'遊び方':'游玩说明', ja
      ? '<p>画面をクリック、Enter、スペースでつづけます。上スクロールで履歴、下スクロールで次へ進みます。</p><p>Ctrl 長押しで早送りします。章タイトルはクリックでつづけます。オートでは6秒間表示します。</p><p>ストーリーモードは紙の謎を省略します。D-Mail はどちらのモードでも操作できます。</p><p>進行状況はブラウザーに保存されます。別の端末で遊ぶ場合は、メニューからセーブを書き出して読み込んでください。</p><p class="panel-note">© MAGES. / NITRO PLUS<br>資料：Internet Archive「xrcity_steinsgate」、イベント公式サイト。</p>'
      : '<p>点击画面、Enter 或空格继续；上滚回看，下滚推进。</p><p>按住 Ctrl 快进。章节标题点击后继续，自动播放时停留 6 秒。</p><p>故事模式省略纸质谜题，两种模式均保留 D-Mail 操作。</p><p>进度自动保存在浏览器。更换设备时，可在菜单中导出、导入存档。</p><p class="panel-note">© MAGES. / NITRO PLUS<br>资料来源：Internet Archive「xrcity_steinsgate」、活动官网。</p>');
  });
  document.addEventListener('keydown', ev => {
    if(ev.key==='Control'){if(!ev.repeat&&!ev.altKey&&!ev.metaKey&&!ev.shiftKey)beginFastForward();return;}
    if(ev.ctrlKey)stopFastForward();
  },true);
  document.addEventListener('keyup',ev=>{if(ev.key==='Control')stopFastForward(true);},true);
  document.addEventListener('pointerdown',()=>stopFastForward(),true);
  window.addEventListener('blur',()=>stopFastForward(true));
  document.addEventListener('visibilitychange',()=>{if(document.hidden){stopFastForward(true);clearTimeout(autoTimer);}else scheduleAuto();});
  document.addEventListener('keydown', ev => {
    if(chapterCards?.active){if([' ','Enter','ArrowRight','Escape'].includes(ev.key)){ev.preventDefault();if(!ev.repeat)chapterCards.skip();}return;}
    if(ev.ctrlKey||ev.altKey||ev.metaKey||ev.isComposing||ev.keyCode===229)return;
    if(ev.target?.closest?.('#story-video-resume'))return;
    if($('panel').open)return;
    if (inReader && animations.blocked) { if ([' ', 'Enter', 'ArrowRight', 'ArrowLeft'].includes(ev.key)) ev.preventDefault(); return; }
    if (!inReader || $('panel').open || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    if (ev.key === 'Escape') { setControlsOpen(false); return; }
    if(!$('reader-controls').hidden)return;
    // Let focused buttons handle Enter/Space themselves, without also advancing.
    if ([' ', 'Enter'].includes(ev.key) && document.activeElement.tagName === 'BUTTON' && document.activeElement.id !== 'next') return;
    if ([' ', 'Enter', 'ArrowRight'].includes(ev.key)) { ev.preventDefault(); if (!ev.repeat) advance(); }
    else if (ev.key === 'ArrowLeft') { ev.preventDefault(); if (!ev.repeat) showLog(); }
    else if (ev.key.toLowerCase() === 'l') showLog();
  });
  const wheel=window.ReaderInput.wheelGesture();
  document.addEventListener('wheel',ev=>{
    if(chapterCards?.active){if(!ev.ctrlKey){ev.preventDefault();wheel.feed(ev.deltaY,ev.timeStamp,'native');}return;}
    if(!inReader||document.hidden||ev.ctrlKey||ev.metaKey||ev.altKey||!ev.deltaY||Math.abs(ev.deltaX)>Math.abs(ev.deltaY))return;
    const target=ev.target,editable=target?.closest?.('input,select,textarea,[contenteditable]:not([contenteditable="false"])');
    const panel=$('panel'),history=panel.open&&panel.classList.contains('backlog-panel');
    const list=history?panel.querySelector('.backlog-list'):null;
    let intent='native';
    if(!editable&&history){
      if(ev.deltaY>0&&list&&list.scrollTop+list.clientHeight>=list.scrollHeight-2)intent='close-history';
    } else if(!editable&&!panel.open&&$('reader-controls').hidden){
      // Long mail, descriptions and all form panels own their scrolling.
      const scrollable=target?.closest?.('.native-mail-body,.dialogue-content,.dmail-scroll');
      const scrolling=scrollable&&(scrollable.classList.contains('dmail-scroll')||scrollable.scrollHeight>scrollable.clientHeight+2);
      if(!scrolling&&!animations.blocked&&!animations.waiting&&!forwardPending){
        if(ev.deltaY<0)intent='history';
        else if(!['question','dmail'].includes(event()?.type))intent='next';
      }
    }
    const gesture=wheel.feed(ev.deltaY*(ev.deltaMode===1?16:ev.deltaMode===2?$('reader').clientHeight:1),ev.timeStamp,intent);
    if(gesture.intent==='native'){if(history&&list)list.dataset.browsing='true';return;}
    // A menu/scroll region can open between trackpad events. Never deliver an
    // earlier reading gesture into that new context.
    if(gesture.intent!==intent){if(intent!=='native'||history&&gesture.intent==='history')ev.preventDefault();return;}
    ev.preventDefault();
    if(!gesture.fire)return;
    if(gesture.intent==='close-history'&&history){closePanel();return;}
    if(panel.open)return;
    if(gesture.intent==='history')showLog();
    else if(gesture.intent==='next')advance();
  },{passive:false});
  window.addEventListener('beforeunload', persist);
  if (!chapters.length) { $('start').disabled = true; toast('剧情数据未加载，请保持文件夹完整'); }
  refreshContinue(); applyVolume();
})();
