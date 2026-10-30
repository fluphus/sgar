(function (root) {
  'use strict';
  const keys = ['time', 'at', 'what', 'to'];
  function plan(event, data = root.DMAIL_DATA) {
    const native = data.chapters[event.id.split(':')[0]];
    const recipientSelectable = event.answer.length > 3 && Boolean(event.answer[3]);
    return { native, fields: { time: Boolean(event.answer[0]), at: Boolean(event.answer[1]), what: true, to: recipientSelectable },
      fixedTo: recipientSelectable ? '' : event.to, command: native.commands.find(c => c.active).text };
  }
  function values(event, input, data = root.DMAIL_DATA) {
    const p = plan(event, data);
    return { time: p.fields.time ? input.time || '' : '', at: p.fields.at ? input.at || '' : '',
      what: input.what || '', to: p.fields.to ? input.to || '' : p.fixedTo };
  }
  function draft(event, input, data = root.DMAIL_DATA) {
    const p = plan(event, data), v = values(event, input, data);
    return { time: v.time, to: v.to, subject: '', command: p.command,
      body: (p.fields.at ? 'at ' + v.at + '\n' : '') + v.what + p.command, phrase: v.what + p.command };
  }
  function fieldsCorrect(event, input, normalize, data = root.DMAIL_DATA) {
    const p = plan(event, data), v = values(event, input, data);
    const expected = [...event.answer]; if (expected.length < 4) expected[3] = event.to;
    return Object.fromEntries(keys.map((key, i) => [key, !p.fields[key] || !expected[i] || normalize(v[key]) === normalize(expected[i])]));
  }
  const api = { plan, values, draft, fieldsCorrect };
  root.DmailCore = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
