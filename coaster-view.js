(() => {
  'use strict';
  let activeAudio = null;
  function match(data, answer) {
    const value = String(answer ?? '').normalize('NFKC').trim();
    return data.characters.find(c => c.answers.includes(value)) || null;
  }
  function stop() { if (activeAudio) { activeAudio.pause(); activeAudio.removeAttribute('src'); activeAudio.load(); activeAudio = null; } }
  function create({ language, volume }) {
    stop();
    const data = window.COASTER_DATA, ja = language === 'ja';
    const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
    const box = el('div', 'coaster-view'); box.lang = language;
    const stage = el('div', 'coaster-stage'), scene = el('div', 'coaster-scene'), badge = el('img', 'coaster-badge');
    badge.src = data.badge.src; badge.alt = ja ? 'ラボメンバッジ' : 'LabMem 徽章';
    const actor = el('button', 'coaster-character'), image = el('img'); actor.type = 'button'; actor.hidden = true; actor.append(image); scene.append(badge, actor); stage.append(scene);
    const controls = el('div', 'coaster-controls'), form = el('form', 'coaster-answer');
    const label = el('label', '', ja ? data.originalQuestion : '杯垫上谜题的答案是？');
    const input = el('input'); input.type = 'text'; input.autocomplete = 'off'; input.required = true; input.maxLength = 80;
    input.placeholder = ja ? '解答を入力' : '输入日文或英文答案'; label.append(input);
    const submit = el('button', 'coaster-submit', ja ? '送信' : '提交'); submit.type = 'submit';
    const error = el('p', 'coaster-feedback'); error.setAttribute('role', 'status');
    form.append(label, submit, error);
    const result = el('div', 'coaster-result'); result.hidden = true;
    const name = el('p', 'coaster-name'), status = el('p', 'coaster-voice-status'); status.setAttribute('aria-live', 'polite');
    const reset = el('button', 'inline-link', ja ? '別のコースター' : '更换杯垫'); reset.type = 'button'; result.append(name, status, reset);
    const help = el('details', 'coaster-reference'), summary = el('summary', '', ja ? '原版の資料' : '原版资料');
    const marker = el('img', 'coaster-marker'); marker.src = data.marker.src; marker.alt = ja ? '元のAR認識マーカー' : '原版 AR 识别标记';
    const answers = el('details', 'coaster-answers'), answerSummary = el('summary', '', ja ? '答えを見る' : '查看答案'), list = el('ul');
    for (const c of data.characters) list.append(el('li', '', c.name[language] + '：' + c.answers[0]));
    answers.append(answerSummary, list); help.append(summary, marker, answers);
    controls.append(form, result, help); box.append(stage, controls);
    const audio = el('audio'); audio.preload = 'none'; audio.hidden = true; box.append(audio); activeAudio = audio;
    let selected = null, clickCount = 0, token = 0;
    form.addEventListener('submit', ev => {
      ev.preventDefault(); const character = match(data, input.value);
      if (!character) { error.textContent = ja ? data.originalIncorrect : '答案不正确'; input.focus(); return; }
      selected = character; clickCount = 0; token++; audio.pause(); error.textContent = ''; help.open = false;
      box.dataset.character = selected.key; box.dataset.voiceIndex = ''; box.dataset.voiceName = '';
      image.src = selected.image.src; image.alt = selected.name[language];
      actor.setAttribute('aria-label', ja ? selected.name[language] + 'のボイスを再生' : '播放' + selected.name[language] + '的语音');
      actor.hidden = false; form.hidden = true; result.hidden = false;
      name.textContent = selected.name[language]; status.textContent = ja ? 'キャラクターをタップ' : '点击角色播放语音'; actor.focus({ preventScroll: true });
    });
    actor.addEventListener('click', () => {
      if (!selected) return;
      const index = clickCount % selected.voices.length, clip = selected.voices[index], current = ++token;
      clickCount = (clickCount + 1) % selected.voices.length;
      audio.pause(); audio.src = clip.src; audio.volume = volume; audio.muted = volume === 0;
      box.dataset.voiceIndex = String(index); box.dataset.voiceName = clip.name;
      status.textContent = String(index + 1).padStart(2, '0') + ' / ' + String(selected.voices.length).padStart(2, '0');
      audio.play().catch(() => { if (token === current) status.textContent = ja ? '音声を再生できませんでした' : '语音加载失败'; });
    });
    reset.addEventListener('click', () => {
      token++; audio.pause(); selected = null; clickCount = 0; actor.hidden = true; result.hidden = true; form.hidden = false;
      box.dataset.character = ''; input.value = ''; error.textContent = ''; input.focus();
    });
    return box;
  }
  window.CoasterView = { create, stop, match };
})();
