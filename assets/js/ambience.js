/* 音, the sound of the place. Off until you ask for it, and there are no audio
   files: everything is synthesised live with Web Audio. Wind is filtered noise,
   the koto is a plucked-string model (Karplus-Strong) on the hirajoshi scale,
   the wind chime is a few inharmonic sines, and each season adds its own
   creature: a stream in spring, evening cicadas in summer, bell crickets in
   autumn, and a temple bell down the valley in winter. */
(() => {
  const btns = [...document.querySelectorAll('[data-sound]')];
  if (!btns.length || !(window.AudioContext || window.webkitAudioContext)) { btns.forEach(b => { b.hidden = true; }); return; }

  let ac = null, master = null, verb = null, on = false, timers = [], seasonNodes = [];
  const SEASON = window.SEASON;
  const R = Math.random;

  function noiseBuffer(sec, brown) {
    const b = ac.createBuffer(1, ac.sampleRate * sec, ac.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const white = R() * 2 - 1;
      if (brown) { last = (last + 0.02 * white) / 1.02; d[i] = last * 3.5; } else d[i] = white;
    }
    return b;
  }

  // a temple hall: decaying noise as an impulse response
  function hall(sec) {
    const len = ac.sampleRate * sec, b = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) { const d = b.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (R() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    const v = ac.createConvolver(); v.buffer = b; return v;
  }

  function setup() {
    ac = new (window.AudioContext || window.webkitAudioContext)();
    master = ac.createGain(); master.gain.value = 0; master.connect(ac.destination);
    verb = hall(3.2);
    const wet = ac.createGain(); wet.gain.value = 0.35;
    verb.connect(wet); wet.connect(master);

    // wind: brown noise, low-passed, breathing on a slow LFO
    const src = ac.createBufferSource(); src.buffer = noiseBuffer(6, true); src.loop = true;
    const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    const g = ac.createGain(); g.gain.value = 0.16;
    const lfo = ac.createOscillator(), lg = ac.createGain();
    lfo.frequency.value = 0.07; lg.gain.value = 0.1; lfo.connect(lg); lg.connect(g.gain);
    const lfo2 = ac.createOscillator(), lg2 = ac.createGain();
    lfo2.frequency.value = 0.045; lg2.gain.value = 260; lfo2.connect(lg2); lg2.connect(lp.frequency);
    src.connect(lp); lp.connect(g); g.connect(master);
    src.start(); lfo.start(); lfo2.start();
  }

  /* ---------------- instruments ---------------- */
  const kotoCache = new Map();
  function koto(freq, when, vel = 0.5) {
    let buf = kotoCache.get(freq);
    if (!buf) {
      const sr = ac.sampleRate, n = Math.round(sr / freq), len = sr * 3.5;
      buf = ac.createBuffer(1, len, sr);
      const d = buf.getChannelData(0), ring = new Float32Array(n);
      for (let i = 0; i < n; i++) ring[i] = R() * 2 - 1;
      let p = 0;
      for (let i = 0; i < len; i++) {
        const nx = (p + 1) % n, v = ring[p];
        ring[p] = 0.4985 * (v + ring[nx]);
        d[i] = v * (i < 40 ? i / 40 : 1);
        p = nx;
      }
      kotoCache.set(freq, buf);
    }
    const s = ac.createBufferSource(); s.buffer = buf;
    const g = ac.createGain(); g.gain.value = vel * 0.26;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2600;
    s.connect(f); f.connect(g); g.connect(master); g.connect(verb);
    s.start(when);
  }

  function chime(when) {
    const base = 1700 + R() * 900;
    [[1, 0.06], [2.76, 0.025], [5.4, 0.012]].forEach(([k, a]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = base * k; o.type = 'sine';
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(a, when + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, when + 2.8 / Math.sqrt(k));
      o.connect(g); g.connect(master); g.connect(verb); o.start(when); o.stop(when + 3);
    });
  }

  function bell(when) {
    const f = 98 + R() * 8;
    [[1, 0.12, 9], [2.02, 0.06, 6], [2.74, 0.04, 5], [4.1, 0.02, 3], [5.4, 0.012, 2]].forEach(([k, a, d]) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.frequency.value = f * k;
      g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(a, when + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, when + d);
      o.connect(g); g.connect(master); g.connect(verb); o.start(when); o.stop(when + d + 0.1);
    });
  }

  // bell cricket: a 4.3 kHz tone gated into short trills
  function suzumushi(when) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 4200 + R() * 300; g.gain.value = 0;
    const pulses = 6 + ((R() * 6) | 0);
    for (let i = 0; i < pulses; i++) {
      const t = when + i * 0.045;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.012, t + 0.008); g.gain.linearRampToValueAtTime(0, t + 0.03);
    }
    o.connect(g); g.connect(master); o.start(when); o.stop(when + pulses * 0.045 + 0.1);
  }

  // higurashi, the evening cicada: a falling "kana-kana-kana"
  function higurashi(when) {
    const o = ac.createOscillator(), g = ac.createGain(), am = ac.createOscillator(), ag = ac.createGain();
    o.frequency.setValueAtTime(4600, when); o.frequency.exponentialRampToValueAtTime(3500, when + 3.2);
    am.frequency.setValueAtTime(9, when); am.frequency.linearRampToValueAtTime(6, when + 3.2);
    const pulse = ac.createGain(); pulse.gain.value = 0.5;
    ag.gain.value = 0.5; am.connect(ag); ag.connect(pulse.gain);
    g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(0.014, when + 0.3); g.gain.linearRampToValueAtTime(0, when + 3.4);
    o.connect(pulse); pulse.connect(g); g.connect(master); g.connect(verb);
    o.start(when); am.start(when); o.stop(when + 3.5); am.stop(when + 3.5);
  }

  function stream() {
    const s = ac.createBufferSource(); s.buffer = noiseBuffer(4, false); s.loop = true;
    const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1400; bp.Q.value = 0.7;
    const g = ac.createGain(); g.gain.value = 0.025;
    const lfo = ac.createOscillator(), lg = ac.createGain(); lfo.frequency.value = 2.7; lg.gain.value = 0.012;
    lfo.connect(lg); lg.connect(g.gain);
    s.connect(bp); bp.connect(g); g.connect(master); s.start(); lfo.start();
    return [s, lfo];
  }

  /* ---------------- scheduling ---------------- */
  const HIRAJOSHI = [220, 246.94, 261.63, 329.63, 349.23, 440, 493.88, 523.25, 659.25];
  const every = (min, max, fn) => {
    let id;
    const tick = () => { if (!on) return; fn(ac.currentTime + 0.05); id = setTimeout(tick, (min + R() * (max - min)) * 1000); timers.push(id); };
    id = setTimeout(tick, (min * 0.4 + R() * min) * 1000); timers.push(id);
  };

  function phrase(t) {
    let i = (R() * HIRAJOSHI.length) | 0;
    const n = 1 + ((R() * 4) | 0);
    for (let k = 0; k < n; k++) {
      koto(HIRAJOSHI[i], t, 0.35 + R() * 0.4);
      t += 0.28 + R() * 0.5;
      i = Math.max(0, Math.min(HIRAJOSHI.length - 1, i + (R() < 0.5 ? -1 : 1) * (1 + ((R() * 2) | 0))));
    }
  }

  function seasonLayer(s) {
    seasonNodes.forEach(n => { try { n.stop(); } catch (_) {} });
    seasonNodes = [];
    if (s === 'spring') seasonNodes = stream();
  }

  function startAll() {
    every(4, 9, phrase);
    every(7, 16, chime);
    every(0.6, 2.2, t => { if (SEASON.get() === 'autumn') suzumushi(t); });
    every(9, 18, t => { if (SEASON.get() === 'summer') higurashi(t); });
    every(18, 34, t => { if (SEASON.get() === 'winter' || R() < 0.25) bell(t); });
    seasonLayer(SEASON.get());
  }

  function set(next) {
    on = next;
    btns.forEach(b => { b.setAttribute('aria-pressed', String(on)); b.classList.toggle('is-on', on); });
    if (on) {
      if (!ac) setup();
      ac.resume();
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(0.9, ac.currentTime, 0.8);
      koto(329.63, ac.currentTime + 0.1, 0.6); koto(440, ac.currentTime + 0.45, 0.5);
      startAll();
    } else if (ac) {
      timers.forEach(clearTimeout); timers = [];
      master.gain.cancelScheduledValues(ac.currentTime);
      master.gain.setTargetAtTime(0, ac.currentTime, 0.3);
      setTimeout(() => { if (!on) { seasonLayer(null); ac.suspend(); } }, 1500);
    }
  }

  btns.forEach(b => b.addEventListener('click', () => set(!on)));
  SEASON.on(s => { if (on) { seasonLayer(s); chime(ac.currentTime + 0.05); } });
  document.addEventListener('visibilitychange', () => { if (ac && on) (document.hidden ? ac.suspend() : ac.resume()); });
  window.AMBIENCE = { toggle: () => set(!on), isOn: () => on };
})();
