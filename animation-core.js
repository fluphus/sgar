(function (root) {
  'use strict';
  // A streamed key stores cubic coefficients in seconds from that key.
  function sample(clip, channel, time) {
    const keys = clip.channels[channel];
    if (!keys) return clip.constant[channel - clip.channels.length] ?? 0;
    let key = keys[0];
    for (const candidate of keys) { if (candidate[0] > time) break; key = candidate; }
    if (!key) return 0;
    const dt = Math.max(0, Math.min(time, clip.duration) - key[0]);
    return ((key[1] * dt + key[2]) * dt + key[3]) * dt + key[4];
  }
  function between(data, from, to) {
    const start=readingTime(data,from),end=readingTime(data,to);
    return data.cues.filter(c => c.t > start + 1e-5 && c.t <= end + 1e-5);
  }
  function activeStages(data, time) { return data.stages.filter(s => s.start <= time + 1e-5 && time + 1e-5 < s.end); }
  function alphaAt(data, target, time) {
    const cues = data.cues.filter(c => c.kind === 'track' && c.target === target && c.t <= time + 1e-5);
    const cue = cues[cues.length - 1];
    if (!cue) return 1;
    const clip = data.clips[cue.clip];
    const alpha = clip.bindings.find(b => b.type === 114 && b.path === 0 && b.attribute === 304273561);
    return sample(clip, alpha?.channel ?? 0, Math.max(0, time - cue.t) * cue.speed + cue.clipIn);
  }
  function readingTime(data,time) {
    let cursor=time;
    for(let i=0;i<data.cues.length;i++){
      const next=Math.max(cursor,...data.cues.filter(c=>c.kind==='track'&&c.t<=cursor+1e-5&&c.t+c.duration>cursor).map(c=>c.t+c.duration));
      if(next===cursor)break;
      cursor=next;
    }
    return cursor;
  }
  const api = { sample, between, activeStages, alphaAt, readingTime };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AnimationCore = api;
})(typeof window === 'undefined' ? globalThis : window);
