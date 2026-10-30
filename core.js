(function (root) {
  'use strict';
  function normalize(value) { return String(value ?? '').normalize('NFKC').trim().toLowerCase().replace(/[\s\u3000]+/g, ''); }
  function cleanText(value) { return String(value || '').replace(/<voice=[^>]+>/g, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').replace(/\r/g, ''); }
  function voiceCues(text) {
    const cues = []; const expression = /<voice=([^>]+)>/g; let match;
    while ((match = expression.exec(text || ''))) cues.push({ name: match[1], at: cleanText(text.slice(0, match.index)).length });
    return cues;
  }
  function checkQuestion(event, answer) { return (event.answers || []).some(value => normalize(value) === normalize(answer) && normalize(value) !== ''); }
  function checkMail(event, values) {
    const actual = [values.time, values.at, values.what, values.to];
    const expected = [...event.answer];
    // Original three-field answers use the separate To variable; empty fields are unconstrained.
    if (expected.length < 4) expected[3] = event.to;
    return expected.every((value, i) => !value || normalize(value) === normalize(actual[i]));
  }
  function validateSave(save, chapters) {
    if (!save || save.version !== 1 || !Number.isInteger(save.index) || save.index < 0) return false;
    const chapter = chapters.find(c => c.key === save.chapter);
    return Boolean(chapter && save.index <= chapter.events.length && (!save.solved || (typeof save.solved === 'object' && !Array.isArray(save.solved))));
  }
  const api = { normalize, cleanText, voiceCues, checkQuestion, checkMail, validateSave };
  root.PlayerCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
