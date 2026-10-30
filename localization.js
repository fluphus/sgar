(function (root) {
  'use strict';
  const categories = { time: 'TimeDropdown', to: 'ToDropdown', at: 'AtDropdown', what: 'MessageDropdown' };
  function detectLanguage(preferences = []) {
    for (const preference of Array.isArray(preferences) ? preferences : [preferences]) {
      if (typeof preference !== 'string') continue;
      const language = preference.trim().replace(/_/g, '-').toLowerCase();
      if (/^ja(?:-|$)/.test(language)) return 'ja';
      if (/^zh(?:-|$)/.test(language)) return 'zh-CN';
    }
    return 'zh-CN';
  }
  function event(original, language = 'zh-CN', data = root.TRANSLATION_DATA) {
    const entry = language === 'zh-CN' && data?.events[original.id];
    if (!entry) return { ...original, speakerLabel: original.speaker || '' };
    // Speaker identity, scene timing, answer values and stage objects remain native.
    return { ...original, text: entry.text, speakerLabel: entry.speakerLabel,
      from: entry.from ?? original.from, subject: entry.subject ?? original.subject,
      notices: entry.notices ?? original.notices,
      incorrect: original.incorrect?.map((rule, i) => ({ ...rule, message: entry.incorrect?.[i] ?? rule.message })) };
  }
  function title(chapter, language = 'zh-CN', data = root.TRANSLATION_DATA) {
    return language === 'zh-CN' ? data?.chapters[chapter.key] ?? chapter.title : chapter.title;
  }
  function option(key, value, language = 'zh-CN', data = root.TRANSLATION_DATA) {
    return language === 'zh-CN' ? data?.options[categories[key]]?.[value] ?? value : value;
  }
  const api = { event, title, option, detectLanguage };
  root.StoryLocale = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
