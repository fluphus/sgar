(() => {
  'use strict';
  // Shipped scenery has a spatial luminance map, so file:// and HTTP produce
  // the same ink without depending on canvas pixel access. Canvas supports
  // additional same-origin images; a failed read uses an explicit safe fallback.
  function create(background, clock) {
    const canvas = document.createElement('canvas'); canvas.width = 24; canvas.height = 8;
    const context = canvas.getContext('2d', {willReadFrequently:true});
    const maps = window.CLOCK_CONTRAST_DATA || {}, decoded = new Map();
    let source = '', image = null, map = null, generation = 0, frame = 0, loading = false;
    const linear = n => (n /= 255) <= .04045 ? n / 12.92 : ((n + .055) / 1.055) ** 2.4;
    function ink(luminance, sampling) {
      const dark = (luminance + .05) / .05 >= 1.05 / (luminance + .05);
      clock.dataset.ink = dark ? 'black' : 'white'; clock.dataset.sampling = sampling;
      clock.style.setProperty('--clock-ink', dark ? '#000' : '#fff');
      clock.style.setProperty('--clock-halo', dark ? '#fff9' : '#000b');
    }
    function fallback() {
      clock.dataset.ink = 'fallback'; clock.dataset.sampling = 'fallback';
      clock.style.setProperty('--clock-ink', '#fff');
      clock.style.setProperty('--clock-halo', '#000');
    }
    function lookup(src) {
      let pathname;
      try { pathname = decodeURIComponent(new URL(src, document.baseURI).pathname).replace(/\\/g, '/'); } catch { return null; }
      const key = Object.keys(maps).find(key => pathname.endsWith('/' + key));
      if (!key) return null;
      if (!decoded.has(key)) {
        const data = maps[key], bytes = Uint8Array.from(atob(data.pixels), c => c.charCodeAt(0));
        decoded.set(key, {...data, bytes});
      }
      return decoded.get(key);
    }
    function sample() {
      if (!clock.getClientRects().length || loading) return;
      const b = background.getBoundingClientRect(), r = clock.getBoundingClientRect();
      if (!b.width || !b.height || !r.width || !r.height) return;
      if (!source) { ink(.2126 * linear(217) + .7152 * linear(216) + .0722 * linear(210), 'solid'); return; }
      const art = map || (image?.naturalWidth ? {width:image.naturalWidth, height:image.naturalHeight} : null);
      if (!art) { fallback(); return; }
      const scale = Math.max(b.width / art.width, b.height / art.height);
      const position = getComputedStyle(background).backgroundPosition.split(/\s+/);
      const offset = (value, free) => value?.endsWith('%') ? free * parseFloat(value) / 100 : parseFloat(value) || 0;
      const x = offset(position[0], b.width - art.width * scale), y = offset(position[1], b.height - art.height * scale);
      const sx = (r.left - b.left - x) / scale, sy = (r.top - b.top - y) / scale;
      const sw = r.width / scale, sh = r.height / scale;
      if (map) {
        let luminance = 0;
        // Use the text's actual screen rectangle, not the full image average.
        for (let j = 0; j < 8; j++) for (let i = 0; i < 24; i++) {
          const col = Math.max(0, Math.min(map.cols - 1, Math.floor((sx + (i + .5) * sw / 24) * map.cols / map.width)));
          const row = Math.max(0, Math.min(map.rows - 1, Math.floor((sy + (j + .5) * sh / 8) * map.rows / map.height)));
          luminance += map.bytes[row * map.cols + col] / 255;
        }
        ink(luminance / 192, 'map'); return;
      }
      if (!context) { fallback(); return; }
      try {
        // Resizing clears any taint left by a previously rejected file image.
        canvas.width = 24; context.fillStyle = '#d9d8d2'; context.fillRect(0, 0, 24, 8);
        context.drawImage(image, sx, sy, sw, sh, 0, 0, 24, 8);
        const pixels = context.getImageData(0, 0, 24, 8).data;
        let luminance = 0;
        for (let i = 0; i < pixels.length; i += 4) luminance += .2126 * linear(pixels[i]) + .7152 * linear(pixels[i + 1]) + .0722 * linear(pixels[i + 2]);
        ink(luminance / (pixels.length / 4), 'canvas');
      } catch { fallback(); }
    }
    function update() {
      cancelAnimationFrame(frame);
      const next = getComputedStyle(background).backgroundImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1] || '';
      if (next !== source) {
        source = next; const token = ++generation; image = null; map = source ? lookup(source) : null; loading = false;
        if (source && !map) {
          loading = true;
          const pending = new Image();
          pending.onload = () => { if (token === generation) { image = pending; loading = false; sample(); } };
          pending.onerror = () => { if (token === generation) { loading = false; fallback(); } };
          pending.src = source;
          return;
        }
      }
      frame = requestAnimationFrame(sample);
    }
    const geometry = new ResizeObserver(update);
    geometry.observe(background); geometry.observe(clock);
    new MutationObserver(update).observe(background, {attributes:true,attributeFilter:['style']});
    new MutationObserver(update).observe(clock, {childList:true,characterData:true,subtree:true});
    document.fonts?.ready.then(update);
    return {update};
  }
  window.ClockContrast = {create};
})();
