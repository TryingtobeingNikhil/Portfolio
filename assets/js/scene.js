/* 夕暮れの村, the dusk village. The hero (and the last screen of the footer)
   is a painting done in code: sky, moon, Fuji, a pagoda on the ridge, a torii
   in the cedars, a village with its lights on and a string of festival lanterns.
   Everything comes from a fixed seed, so it is the same village on every visit.
   Static layers are painted once into offscreen canvases and composited with
   parallax (cursor and scroll); only the sky life, mist, lanterns, birds and the
   falling things are drawn per frame. The season (season.js) repaints it all. */
(() => {
  const SEASON = window.SEASON;
  if (!SEASON) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const P = SEASON.particle, A = SEASON.hexA;

  /* ---------------- palettes: traditional colours at dusk ---------------- */
  const PAL = {
    spring: {
      sky: ['#151a3b', '#30346a', '#6f5690', '#cc87a2', '#f3c1b2'], glow: '#ffcdb8', rim: '#ffd6c8',
      far: '#675b8f', mid: '#413b6d', near: '#29254d', fg: '#120f25', mist: '#e6b8cc',
      fol: ['#f2b6c8', '#e79db5', '#fbd3df', '#d98aa6'], moon: { x: 0.72, y: 0.15, r: 0.022, full: false, c: '#fff2ea' },
      stars: 0.55, cap: 0.3, light: '#ffc98a',
    },
    summer: {
      sky: ['#07112b', '#0f264b', '#1f4a76', '#4985a3', '#9ccac3'], glow: '#c6f0e0', rim: '#bfe8e2',
      far: '#2b4f70', mid: '#1b3754', near: '#11273d', fg: '#06101c', mist: '#9cc8d2',
      fol: ['#2f6b5a', '#245a4c', '#3b7a63'], moon: { x: 0.72, y: 0.14, r: 0.02, full: false, c: '#f4f7e4' },
      stars: 1, cap: 0.12, light: '#ffd27a',
    },
    autumn: {
      sky: ['#12142f', '#2a2854', '#5b3d6c', '#b45d66', '#eea36c'], glow: '#ffbe85', rim: '#ffc596',
      far: '#5a4b79', mid: '#3a305b', near: '#251e41', fg: '#0f0c1f', mist: '#e6aaa0',
      fol: ['#d2502e', '#e06a34', '#b23b2b', '#e39a3a', '#c4452a'], moon: { x: 0.7, y: 0.17, r: 0.04, full: true, c: '#ffe0ab' },
      stars: 0.5, cap: 0.26, light: '#ffc46b',
    },
    winter: {
      sky: ['#091022', '#16213d', '#2b3c5f', '#5c749a', '#aabcd6'], glow: '#dfeaff', rim: '#dce8fa',
      far: '#5b6d92', mid: '#37476b', near: '#24304b', fg: '#0f1525', mist: '#c8d6ec',
      fol: ['#e9eff8', '#d3deec'], moon: { x: 0.71, y: 0.15, r: 0.03, full: true, c: '#f2f5ff' },
      stars: 0.9, cap: 0.42, light: '#ffcf86', snow: true,
    },
  };

  /* ---------------- small maths ---------------- */
  const rng = seed => () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const noise = seed => {
    const r = rng(seed), L = Array.from({ length: 256 }, r);
    return x => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f), a = L[i & 255], b = L[(i + 1) & 255]; return a + (b - a) * u; };
  };
  const fbm = (n, x, o = 4) => { let s = 0, a = 1, f = 1, t = 0; for (let k = 0; k < o; k++) { s += a * n(x * f + k * 17.3); t += a; a *= 0.5; f *= 2.1; } return s / t; };
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');

  /* ---------------- one scene ---------------- */
  function makeScene(canvas, opts) {
    const host = canvas.parentElement;
    const ctx = canvas.getContext('2d');
    const M = 48; // margin painted around every layer, for parallax
    let w = 0, h = 0, dpr = 1, ldpr = 1, nLayer = 0, pal, L = {}, stars = [], parts = [], flock = null, meteor = null, rope = null;
    let time = 0, last = 0, raf = 0, visible = true, booted = false, tempo = 1;
    let mx = 0, my = 0, tx = 0, ty = 0, wind = 0, px = -1, py = -1, pt = 0, fade = null;

    // Offscreen canvases are made once and repainted in place: Safari caps total
    // canvas memory, and a fresh set per season change used to run it out.
    const pool = {};
    function surface(key, W, H) {
      let c = pool[key];
      if (!c) c = pool[key] = document.createElement('canvas');
      W = Math.max(1, Math.ceil(W)); H = Math.max(1, Math.ceil(H));
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const g = c.getContext('2d');
      g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; g.filter = 'none';
      g.clearRect(0, 0, W, H);
      return { c, g };
    }
    function layer() {
      const l = surface(`layer${nLayer++}`, (w + 2 * M) * ldpr, (h + 2 * M) * ldpr);
      l.g.setTransform(ldpr, 0, 0, ldpr, M * ldpr, M * ldpr);
      return l;
    }

    // a filled ridge line with a hazy top, a lit rim and the function that traces it
    function ridge(g, seed, base, amp, period, col, haze, rimA) {
      const n = noise(seed), f = x => base - (fbm(n, x / period) - 0.5) * 2 * amp;
      let top = Infinity;
      g.beginPath(); g.moveTo(-M, h + M);
      for (let x = -M; x <= w + M; x += 3) { const y = f(x); top = Math.min(top, y); g.lineTo(x, y); }
      g.lineTo(w + M, h + M); g.closePath();
      const gr = g.createLinearGradient(0, top, 0, base + amp * 1.5);
      gr.addColorStop(0, mix(col, haze, 0.22)); gr.addColorStop(1, col);
      g.fillStyle = gr; g.fill();
      if (rimA) {
        g.beginPath();
        for (let x = -M; x <= w + M; x += 3) (x === -M ? g.moveTo(x, f(x)) : g.lineTo(x, f(x)));
        g.strokeStyle = A(pal.rim, rimA); g.lineWidth = 1; g.stroke();
      }
      return f;
    }

    function mistBand(g, y, height, alpha, seed) {
      const r = rng(seed);
      g.save();
      g.filter = `blur(${Math.round(height * 0.35)}px)`;
      for (let i = 0; i < 14; i++) {
        const x = r() * (w + 2 * M) - M, rw = (0.2 + r() * 0.35) * w, rh = height * (0.4 + r() * 0.6);
        g.fillStyle = A(pal.mist, alpha * (opts.end ? 0.45 : 1) * (0.5 + r() * 0.5));
        g.beginPath(); g.ellipse(x, y + (r() - 0.5) * height * 0.6, rw, rh / 2, 0, 0, Math.PI * 2); g.fill();
      }
      g.restore();
    }

    // curved temple-style roof; returns the path so snow can be clipped to it
    function roof(g, cx, y, rw, rh, col, curl = 1) {
      const p = new Path2D();
      p.moveTo(cx - rw, y - rh * 0.22 * curl);
      p.quadraticCurveTo(cx - rw * 0.55, y + rh * 0.3, cx, y + rh * 0.26);
      p.quadraticCurveTo(cx + rw * 0.55, y + rh * 0.3, cx + rw, y - rh * 0.22 * curl);
      p.quadraticCurveTo(cx + rw * 0.55, y - rh * 0.3, cx + rw * 0.24, y - rh);
      p.lineTo(cx - rw * 0.24, y - rh);
      p.quadraticCurveTo(cx - rw * 0.55, y - rh * 0.3, cx - rw, y - rh * 0.22 * curl);
      g.fillStyle = col; g.fill(p);
      if (pal.snow) {
        g.save(); g.clip(p);
        g.fillStyle = mix(col, '#e6eef9', 0.55); g.fillRect(cx - rw, y - rh, rw * 2, rh * 0.55);
        g.restore();
      }
      return p;
    }

    function pagoda(g, x, by, s, col) {
      const u = s / 7.4;
      let y = by;
      g.fillStyle = col;
      g.fillRect(x - u * 1.7, y - u * 0.4, u * 3.4, u * 0.4); y -= u * 0.4;
      for (let i = 0; i < 5; i++) {
        const k = 1 - i * 0.1;
        g.fillStyle = col;
        g.fillRect(x - u * 0.62 * k, y - u * 0.66, u * 1.24 * k, u * 0.7); y -= u * 0.6;
        roof(g, x, y, u * 2.05 * k, u * 0.5, col, 1.4);
        g.strokeStyle = A(pal.rim, 0.16); g.lineWidth = 0.8;
        g.beginPath(); g.moveTo(x - u * 0.5 * k, y - u * 0.5); g.lineTo(x + u * 0.5 * k, y - u * 0.5); g.stroke();
        y -= u * 0.46;
      }
      g.fillStyle = col;
      g.fillRect(x - u * 0.05, y - u * 1.7, u * 0.1, u * 1.75);
      for (let i = 0; i < 7; i++) g.fillRect(x - u * 0.15, y - u * 0.35 - i * u * 0.18, u * 0.3, u * 0.05);
    }

    function torii(g, x, by, s, col) {
      const u = s / 10, sp = u * 3.3, pw = u * 0.72;
      g.fillStyle = col;
      for (const d of [-1, 1]) {
        g.beginPath();
        g.moveTo(x + d * (sp + u * 0.25) - pw / 2, by); g.lineTo(x + d * (sp + u * 0.25) + pw / 2, by);
        g.lineTo(x + d * sp + pw / 2 * 0.85, by - u * 8.9); g.lineTo(x + d * sp - pw / 2 * 0.85, by - u * 8.9); g.closePath(); g.fill();
      }
      g.fillRect(x - sp - u * 1.4, by - u * 7.2, (sp + u * 1.4) * 2, u * 0.55);
      g.fillRect(x - u * 0.28, by - u * 8.6, u * 0.56, u * 1.4);
      g.fillRect(x - sp - u * 1.9, by - u * 9.1, (sp + u * 1.9) * 2, u * 0.5);
      const kw = sp + u * 2.9, ky = by - u * 9.2;
      g.beginPath();
      g.moveTo(x - kw, ky - u * 1.1);
      g.quadraticCurveTo(x - kw * 0.45, ky + u * 0.05, x, ky);
      g.quadraticCurveTo(x + kw * 0.45, ky + u * 0.05, x + kw, ky - u * 1.1);
      g.lineTo(x + kw + u * 0.15, ky - u * 1.7);
      g.quadraticCurveTo(x + kw * 0.45, ky - u * 0.75, x, ky - u * 0.8);
      g.quadraticCurveTo(x - kw * 0.45, ky - u * 0.75, x - kw - u * 0.15, ky - u * 1.7);
      g.closePath(); g.fill();
      if (pal.snow) { g.fillStyle = mix(col, '#e6eef9', 0.6); g.fillRect(x - kw * 0.8, ky - u * 0.95, kw * 1.6, u * 0.22); }
    }

    function sugi(g, x, by, ht, col) {
      const wd = ht * 0.26, n = 7, R = [], Lf = [];
      for (let i = 1; i <= n; i++) {
        const t = i / n, yy = by - ht + ht * t * 0.92;
        R.push([x + wd * t * 0.55, yy], [x + wd * t * 0.3, yy + ht * 0.035]);
        Lf.unshift([x - wd * t * 0.3, yy + ht * 0.035], [x - wd * t * 0.55, yy]);
      }
      g.fillStyle = col;
      g.beginPath(); g.moveTo(x, by - ht);
      R.concat(Lf).forEach(([a, b]) => g.lineTo(a, b));
      g.closePath(); g.fill();
      g.fillRect(x - ht * 0.02, by - ht * 0.1, ht * 0.04, ht * 0.1);
      if (pal.snow) { g.fillStyle = A('#e6eef9', 0.35); for (let i = 1; i < n; i += 2) g.fillRect(x - wd * (i / n) * 0.4, by - ht + ht * (i / n) * 0.92 - 1, wd * (i / n) * 0.8, 1.4); }
    }

    function canopy(g, x, by, r, col, rnd) {
      g.fillStyle = col;
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(x + (rnd() - 0.5) * r * 1.6, by - r * 0.8 - rnd() * r * 0.9, r * (0.45 + rnd() * 0.4), 0, Math.PI * 2); g.fill(); }
      g.fillRect(x - r * 0.06, by - r * 0.6, r * 0.12, r * 0.6);
    }

    // seasonal blossom/leaf clusters as fine dots, so they read as foliage and not blobs
    function bloom(g, cx, cy, rad, amount, dim, rnd) {
      for (let i = 0; i < amount; i++) {
        const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * rad;
        const c = pal.fol[(rnd() * pal.fol.length) | 0];
        g.fillStyle = A(mix(c, pal.fg, dim + rnd() * 0.25), 0.9);
        g.beginPath(); g.arc(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.75, 0.8 + rnd() * 2.2 * Math.max(0.6, rad / 40), 0, Math.PI * 2); g.fill();
      }
    }

    function house(g, x, gy, hw, hh, rnd, scale) {
      const wall = mix(pal.fg, pal.near, 0.35), rf = mix(pal.fg, pal.near, 0.12);
      g.fillStyle = wall; g.fillRect(x, gy - hh, hw, hh + 6);
      const p = roof(g, x + hw / 2, gy - hh, hw * 0.64, hh * 0.62, rf, 0.55);
      g.save(); g.strokeStyle = A(pal.rim, 0.22); g.lineWidth = 0.9;
      g.beginPath(); g.moveTo(x + hw / 2 - hw * 0.15, gy - hh - hh * 0.62); g.lineTo(x + hw / 2 + hw * 0.15, gy - hh - hh * 0.62); g.stroke(); g.restore();
      if (rnd() < 0.68) {
        const n = 1 + ((rnd() * 2) | 0);
        for (let i = 0; i < n; i++) {
          const ww = hw * 0.2, wh = hh * 0.44, wx = x + hw * (0.15 + i * 0.42 + rnd() * 0.08), wy = gy - hh * 0.8;
          g.save(); g.globalCompositeOperation = 'lighter';
          const gl = g.createRadialGradient(wx + ww / 2, wy + wh / 2, 0, wx + ww / 2, wy + wh / 2, ww * 3.2);
          gl.addColorStop(0, A(pal.light, 0.32)); gl.addColorStop(1, A(pal.light, 0));
          g.fillStyle = gl; g.fillRect(wx - ww * 3, wy - ww * 3, ww * 7, ww * 7); g.restore();
          g.fillStyle = mix(pal.light, '#fff4dc', 0.2 + rnd() * 0.2); g.fillRect(wx, wy, ww, wh);
          g.strokeStyle = A(wall, 0.85); g.lineWidth = Math.max(0.6, 0.8 * scale);
          g.beginPath(); g.moveTo(wx + ww / 2, wy); g.lineTo(wx + ww / 2, wy + wh); g.moveTo(wx, wy + wh / 2); g.lineTo(wx + ww, wy + wh / 2); g.stroke();
        }
      }
      return p;
    }

    function pole(g, x, gy, top, col) {
      g.fillStyle = col;
      const s = (gy - top) / 100;
      g.fillRect(x - 2.2 * s, top, 4.4 * s, gy - top + 4);
      g.fillRect(x - 16 * s, top + 8 * s, 32 * s, 2.4 * s);
      g.fillRect(x - 12 * s, top + 17 * s, 24 * s, 2 * s);
      g.fillRect(x + 3 * s, top + 26 * s, 7 * s, 9 * s); // transformer
    }
    const wire = (g, x1, y1, x2, y2, sag, col, lw) => {
      g.strokeStyle = col; g.lineWidth = lw;
      g.beginPath(); g.moveTo(x1, y1); g.quadraticCurveTo((x1 + x2) / 2, (y1 + y2) / 2 + sag * 2, x2, y2); g.stroke();
    };

    /* ---------- compose: paint every static layer for this size + season ---------- */
    function compose() {
      pal = PAL[SEASON.get()];
      nLayer = 0;
      const end = opts.end, wide = w > h, S = Math.min(w, h * 1.5) / 1000;
      const H = h * (end ? 0.56 : wide ? 0.64 : 0.6);
      const R = rng(opts.seed || 7);

      // sky
      const sky = layer(), s = sky.g;
      const stops = end ? [pal.sky[0], pal.sky[0], pal.sky[1], mix(pal.sky[2], pal.sky[1], 0.4), mix(pal.sky[3], pal.sky[2], 0.55)] : pal.sky;
      const gr = s.createLinearGradient(0, -M, 0, H + h * 0.06);
      [0, 0.32, 0.6, 0.84, 1].forEach((t, i) => gr.addColorStop(t, stops[i]));
      s.fillStyle = gr; s.fillRect(-M, -M, w + 2 * M, h + 2 * M);
      const gx = w * (end ? 0.6 : 0.62);
      const glow = s.createRadialGradient(gx, H, 0, gx, H, Math.max(w, h) * 0.7);
      glow.addColorStop(0, A(pal.glow, end ? 0.16 : 0.36)); glow.addColorStop(1, A(pal.glow, 0));
      s.fillStyle = glow; s.fillRect(-M, -M, w + 2 * M, h + 2 * M);
      // moon
      const mo = pal.moon, mr = Math.max(9, mo.r * Math.min(w * 1.1, h * 1.6)), mX = w * (end ? 0.16 : wide ? mo.x : 0.56), mY = h * (end ? 0.22 : wide ? mo.y : 0.12);
      const halo = s.createRadialGradient(mX, mY, mr * 0.8, mX, mY, mr * 7);
      halo.addColorStop(0, A(mo.c, 0.22)); halo.addColorStop(1, A(mo.c, 0));
      s.fillStyle = halo; s.beginPath(); s.arc(mX, mY, mr * 7, 0, Math.PI * 2); s.fill();
      const { c: mc, g: m } = surface('moon', mr * 2.4 * ldpr, mr * 2.4 * ldpr); m.scale(ldpr, ldpr);
      m.fillStyle = mo.c; m.beginPath(); m.arc(mr * 1.2, mr * 1.2, mr, 0, Math.PI * 2); m.fill();
      if (mo.full) { m.fillStyle = 'rgba(120,90,60,0.08)'; [[0.8, 0.9, 0.28], [1.45, 1.1, 0.2], [1.1, 1.55, 0.24], [1.5, 0.75, 0.12]].forEach(([a, b, c]) => { m.beginPath(); m.arc(mr * a, mr * b, mr * c, 0, Math.PI * 2); m.fill(); }); }
      else { m.globalCompositeOperation = 'destination-out'; m.beginPath(); m.arc(mr * 1.2 + mr * 0.45, mr * 1.2 - mr * 0.18, mr * 0.92, 0, Math.PI * 2); m.fill(); }
      s.drawImage(mc, mX - mr * 1.2, mY - mr * 1.2, mr * 2.4, mr * 2.4);
      L.sky = sky;

      stars = [];
      const nStars = Math.round((w * H) / 5200 * pal.stars * (end ? 1.6 : 1));
      for (let i = 0; i < nStars; i++) {
        const y = Math.pow(R(), 1.6) * H * 0.85;
        stars.push({ x: R() * w, y, r: 0.35 + R() * 0.9, a: (1 - y / H) * (0.4 + R() * 0.6), tw: 0.5 + R() * 2.5, ph: R() * 6 });
      }

      // far range, and Fuji above it
      const far = layer(), f = far.g;
      const fx = w * (end ? 0.82 : wide ? 0.62 : 0.66), peak = H - Math.min(h * (end ? 0.2 : 0.3), w * (end ? 0.12 : wide ? 0.24 : 0.42)), base = H + h * 0.02;
      if (opts.fuji !== false) {
        const half = (base - peak) * 2.35, fn = noise(5), fp = new Path2D();
        fp.moveTo(fx - half - 4, base + 4);
        for (let u = -1; u <= 1.0001; u += 0.008) {
          const a = Math.max(Math.abs(u), 0.04);
          fp.lineTo(fx + u * half, peak + (base - peak) * (1 - Math.pow(1 - a, 2.5)) + (fn(u * 30) - 0.5) * 2.5);
        }
        fp.lineTo(fx + half + 4, base + 4); fp.closePath();
        const fg = f.createLinearGradient(0, peak, 0, base);
        fg.addColorStop(0, mix(pal.far, pal.mist, 0.18)); fg.addColorStop(1, pal.far);
        f.fillStyle = fg; f.fill(fp);
        f.save(); f.clip(fp);
        const capY = peak + (base - peak) * pal.cap, cap = new Path2D(), cn = noise(9);
        cap.moveTo(fx - half, peak - 10);
        for (let x = fx - half; x <= fx + half; x += 2) {
          const u = (x - fx) / half;
          cap.lineTo(x, capY + Math.pow(Math.abs(Math.sin(u * 23)), 3) * (base - peak) * 0.09 * cn(u * 9) - Math.abs(u) * 4);
        }
        cap.lineTo(fx + half, peak - 10); cap.closePath();
        const cg = f.createLinearGradient(fx - half * 0.3, 0, fx + half * 0.3, 0);
        cg.addColorStop(0, mix(pal.far, '#f6f2ff', 0.58)); cg.addColorStop(1, mix(pal.far, '#f6f2ff', 0.3));
        f.fillStyle = cg; f.fill(cap);
        f.restore();
      }
      ridge(f, 11, H - h * 0.005, h * 0.05, 340, pal.far, pal.mist, 0.12);
      mistBand(f, H + h * 0.01, h * 0.08, 0.32, 3);
      L.far = far;

      // mid ridge: foliage, a temple and its pagoda
      const mid = layer(), g = mid.g;
      const mf = ridge(g, 23, H + h * 0.045, h * 0.04, 240, pal.mid, pal.mist, 0.1);
      const mr2 = rng(31);
      for (let x = -M; x < w + M; x += 7 + mr2() * 10) canopy(g, x, mf(x) + 3, (6 + mr2() * 9) * Math.max(0.7, S * 1.1), mix(pal.mid, pal.fol[(mr2() * pal.fol.length) | 0], 0.16 + mr2() * 0.16), mr2);
      if (opts.pagoda !== false) {
        const pX = w * (wide ? 0.86 : 0.84), pS = Math.min(h * 0.24, Math.max(w * 0.17, 90));
        const tc = mix(pal.mid, pal.fg, 0.35);
        roof(g, pX - pS * 0.42, mf(pX - pS * 0.42) - pS * 0.1, pS * 0.32, pS * 0.12, tc, 1.2);
        g.fillStyle = tc; g.fillRect(pX - pS * 0.62, mf(pX - pS * 0.42) - pS * 0.1, pS * 0.4, pS * 0.12);
        pagoda(g, pX, mf(pX) + 4, pS, tc);
      }
      mistBand(g, H + h * 0.07, h * 0.06, 0.22, 4);
      L.mid = mid;

      // near hill: cedars, maples and the torii
      const near = layer(), n = near.g;
      const nf = ridge(n, 37, H + h * (end ? 0.14 : 0.12), h * 0.035, 200, pal.near, pal.mist, 0.08);
      const nr = rng(41);
      const toriiX = w * (end ? 0.66 : wide ? 0.5 : 0.3);
      for (let x = -M; x < w + M; x += 5 + nr() * 9) {
        if (Math.abs(x - toriiX) < Math.max(40, w * 0.05)) continue;
        if (nr() < 0.72) sugi(n, x, nf(x) + 4, (22 + nr() * 34) * Math.max(0.75, S * 1.2), mix(pal.near, pal.fg, 0.25 + nr() * 0.2));
        else { const rr = (7 + nr() * 7) * Math.max(0.75, S * 1.2); canopy(n, x, nf(x) + 4, rr, mix(pal.near, pal.fg, 0.2), nr); bloom(n, x, nf(x) - rr * 1.2, rr * 1.1, 40, 0.5, nr); }
      }
      const tS = Math.max(34, h * (end ? 0.13 : 0.085));
      torii(n, toriiX, nf(toriiX) + 3, tS, mix('#d4553b', pal.near, end ? 0.35 : 0.42));
      // stone steps down from the torii
      n.fillStyle = A(pal.rim, 0.05);
      for (let i = 0; i < 6; i++) n.fillRect(toriiX - tS * (0.25 + i * 0.06), nf(toriiX) + 6 + i * tS * 0.07, tS * (0.5 + i * 0.12), 1.2);
      L.near = near;

      // foreground: the village, poles, wires and lanterns
      const fgL = layer(), v = fgL.g, vr = rng(53);
      const gy = h * 0.93, gn = noise(61), ground = x => gy - (gn(x / 160) - 0.5) * h * 0.04;
      for (const [row, sc, y0] of [[0, 0.72, h * 0.84], [1, 1, h * 0.95]]) {
        let x = -M - vr() * 40;
        while (x < w + M) {
          const hw = (70 + vr() * 70) * sc * Math.max(0.6, S * 1.1), hh = (26 + vr() * 18) * sc * Math.max(0.6, S * 1.1);
          if (vr() < (row ? 0.82 : 0.9)) house(v, x, y0 + (vr() - 0.5) * h * 0.02, hw, hh, vr, sc);
          else { const rr = 16 * sc * Math.max(0.7, S); canopy(v, x + hw / 2, y0, rr, mix(pal.fg, pal.near, 0.2), vr); bloom(v, x + hw / 2, y0 - rr * 1.3, rr * 1.3, 70, 0.35, vr); }
          x += hw * (0.9 + vr() * 0.5);
        }
      }
      v.beginPath(); v.moveTo(-M, h + M);
      for (let x = -M; x <= w + M; x += 6) v.lineTo(x, ground(x));
      v.lineTo(w + M, h + M); v.closePath();
      v.fillStyle = pal.snow ? mix(pal.fg, '#c6d3e8', 0.12) : pal.fg; v.fill();

      rope = null;
      if (opts.poles !== false && (wide || w > 700)) {
        const x1 = w * (wide ? 0.63 : 0.5), x2 = w * (wide ? 0.97 : 1.02), t1 = h * 0.46, t2 = h * 0.4;
        const pc = mix(pal.fg, pal.near, 0.1), wc = A(mix(pal.fg, pal.near, 0.3), 0.9);
        pole(v, x1, gy, t1, pc); pole(v, x2, gy, t2, pc);
        const sp = (gy - t2) / 100;
        for (const [d, k] of [[8, 0], [17, 1], [8, 2]]) {
          const o = k === 2 ? 14 : 0;
          wire(v, x1 + (k === 1 ? 10 : -14) * sp, t1 + (d + o) * sp, x2 + (k === 1 ? 10 : -14) * sp, t2 + (d + o) * sp, h * 0.03, wc, 1);
          wire(v, x2 + (k === 1 ? 10 : -14) * sp, t2 + (d + o) * sp, w + M + 40, t2 + (d + o + 30) * sp, h * 0.02, wc, 1);
        }
        rope = { x1, y1: t1 + 42 * sp, x2, y2: t2 + 46 * sp, sag: h * 0.035, n: wide ? 5 : 4, s: Math.max(0.65, S * 1.15) };
        wire(v, rope.x1, rope.y1, rope.x2, rope.y2, rope.sag, A(mix(pal.fg, pal.near, 0.4), 0.95), 1.3);
      }

      // a framing branch from the top right, in season
      if (opts.branch !== false) {
        const bx = w + 6, bc = mix(pal.fg, pal.near, 0.08), br = rng(71), u = Math.max(wide ? 0.65 : 0.5, Math.min(1.25, w / 1100));
        v.strokeStyle = bc; v.lineCap = 'round';
        const limb = (x, y, ang, len, wd, depth) => {
          const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
          v.lineWidth = wd; v.beginPath(); v.moveTo(x, y);
          v.quadraticCurveTo((x + x2) / 2 + (br() - 0.5) * len * 0.3, (y + y2) / 2 + (br() - 0.5) * len * 0.3, x2, y2); v.stroke();
          if (depth > 0) { limb(x2, y2, ang + 0.5 + br() * 0.3, len * 0.62, wd * 0.6, depth - 1); limb(x2, y2, ang - 0.35 - br() * 0.3, len * 0.7, wd * 0.62, depth - 1); }
          else if (pal.snow) { v.fillStyle = A('#e6eef9', 0.5); v.beginPath(); v.arc(x2, y2 - 1, wd * 1.6, Math.PI, 0); v.fill(); }
          else bloom(v, x2, y2, (pal === PAL.summer ? 22 : 18) * u, pal === PAL.summer ? 90 : 70, 0.22, br);
        };
        limb(bx, h * 0.02, Math.PI * 0.86, 150 * u, 9 * u, 3);
        limb(bx, h * 0.16, Math.PI * 0.92, 95 * u, 6 * u, 2);
      }
      L.fg = fgL;

      // two drifting mist bands, painted twice as wide so they can wrap
      L.mist = [0, 1].map(k => {
        const mh = h * (k ? 0.12 : 0.1), { c, g: mg } = surface(`mist${k}`, w * 2 * ldpr, mh * 2 * ldpr);
        mg.scale(ldpr, ldpr); mg.filter = `blur(${Math.round(mh * 0.3)}px)`;
        const r = rng(80 + k);
        for (let i = 0; i < 9; i++) {
          const x = r() * w, ew = (0.12 + r() * 0.2) * w, eh = mh * (0.3 + r() * 0.4);
          mg.fillStyle = A(pal.mist, (k ? 0.16 : 0.2) * (opts.end ? 0.5 : 1) * (0.5 + r() * 0.5));
          for (const o of [0, w]) { mg.beginPath(); mg.ellipse(x + o, mh, ew, eh, 0, 0, Math.PI * 2); mg.fill(); }
        }
        return { c, y: (k ? H + h * 0.13 : H + h * 0.05) - mh, w: w * 2, h: mh * 2, v: k ? 9 : 5 };
      });
    }

    /* ---------- live layers ---------- */
    function drawLanterns(ox, oy) {
      if (!rope) return;
      const { x1, y1, x2, y2, sag, n, s } = rope;
      for (let i = 1; i <= n; i++) {
        const t = i / (n + 1);
        const x = x1 + (x2 - x1) * t + ox, y = y1 + (y2 - y1) * t + sag * 4 * t * (1 - t) * 0.5 + oy;
        const ang = Math.sin(time * 0.9 * tempo + i * 1.7) * 0.06 * tempo + wind * 0.0004;
        const bw = 13 * s, bh = 17 * s, red = i % 3 !== 1;
        const body = red ? '#c9432c' : '#efe0c2';
        ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
        ctx.strokeStyle = 'rgba(10,8,16,0.8)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, 6 * s); ctx.stroke();
        const cy = 6 * s + bh / 2;
        ctx.globalCompositeOperation = 'lighter';
        const gl = ctx.createRadialGradient(0, cy, 0, 0, cy, bw * 2.6);
        gl.addColorStop(0, A(red ? '#ff8a4a' : pal.light, 0.28)); gl.addColorStop(1, A(pal.light, 0));
        ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(0, cy, bw * 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
        const bg = ctx.createRadialGradient(0, cy, 0, 0, cy, bw * 0.75);
        bg.addColorStop(0, mix(body, '#fff1c8', 0.55)); bg.addColorStop(1, body);
        ctx.fillStyle = bg; ctx.beginPath(); ctx.ellipse(0, cy, bw / 2, bh / 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(40,10,10,0.22)'; ctx.lineWidth = 0.7;
        for (const k of [-0.25, 0, 0.25]) { ctx.beginPath(); ctx.ellipse(0, cy + k * bh, bw / 2 * Math.sqrt(1 - 4 * k * k), bh * 0.04, 0, 0, Math.PI * 2); ctx.stroke(); }
        ctx.fillStyle = '#16100e';
        ctx.fillRect(-bw * 0.3, cy - bh / 2 - 1, bw * 0.6, bh * 0.12); ctx.fillRect(-bw * 0.3, cy + bh / 2 - bh * 0.1, bw * 0.6, bh * 0.12);
        ctx.restore();
      }
    }

    function drawSky(oy) {
      for (const st of stars) {
        const a = st.a * (0.55 + 0.45 * Math.sin(time * st.tw + st.ph));
        ctx.fillStyle = `rgba(255,248,232,${a.toFixed(3)})`;
        ctx.fillRect(st.x - st.r / 2, st.y + oy - st.r / 2, st.r, st.r);
      }
      if (!meteor && Math.random() < 0.0016) meteor = { x: w * (0.3 + Math.random() * 0.6), y: h * Math.random() * 0.25, t: 0 };
      if (meteor) {
        meteor.t += 1 / 60;
        const k = meteor.t / 0.9, x = meteor.x - k * 220, y = meteor.y + k * 90 + oy;
        const gr = ctx.createLinearGradient(x, y, x + 70, y - 29);
        gr.addColorStop(0, `rgba(255,248,232,${(0.8 * (1 - k)).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,248,232,0)');
        ctx.strokeStyle = gr; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 70, y - 29); ctx.stroke();
        if (k >= 1) meteor = null;
      }
    }

    function drawBirds(dt, oy) {
      if (!flock && Math.random() < 0.0025 && !opts.end) {
        const n = 4 + ((Math.random() * 4) | 0);
        flock = { x: w + 40, y: h * (0.18 + Math.random() * 0.16), v: 32 + Math.random() * 18, m: Array.from({ length: n }, (_, i) => ({ dx: i * 16 + Math.random() * 8, dy: Math.abs(i - n / 2) * 7 + Math.random() * 6, ph: Math.random() * 6 })) };
      }
      if (!flock) return;
      flock.x -= flock.v * dt;
      ctx.strokeStyle = A(pal.fg, 0.85); ctx.lineWidth = 1.2;
      for (const b of flock.m) {
        const x = flock.x + b.dx, y = flock.y + b.dy + oy, f = Math.sin(time * 7 + b.ph) * 2.6, s = 4.5;
        ctx.beginPath(); ctx.moveTo(x - s, y - f); ctx.quadraticCurveTo(x - s * 0.4, y - 1, x, y + 0.6); ctx.quadraticCurveTo(x + s * 0.4, y - 1, x + s, y - f); ctx.stroke();
      }
      if (flock.x < -200) flock = null;
    }

    function syncParts() {
      const kind = SEASON.info().kind;
      const per = { petal: 1 / 22000, leaf: 1 / 30000, firefly: 1 / 24000, snow: 1 / 7000 }[kind];
      const n = Math.round(w * h * per * (opts.end ? 0.7 : 1));
      parts = parts.filter(p => p.kind === kind);
      while (parts.length < n) parts.push(P.spawn(kind, w, h, { anywhere: true }));
      parts.length = Math.min(parts.length, n);
      parts.target = n;
    }

    function drawParts(dt, front) {
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i];
        if ((p.depth > 0.62) !== front) continue;
        if (dt) {
          if (px > 0) { const dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy; if (d2 < 6400) { const k = (1 - d2 / 6400) * 60 * dt; p.x += dx * k * 0.05; p.y += dy * k * 0.03; } }
          if (!P.step(p, dt, w, h, wind * (0.4 + p.depth))) parts[i] = P.spawn(p.kind, w, h);
        }
        P.draw(ctx, parts[i]);
      }
    }

    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min((now - (last || now)) / 1000, 0.05);
      last = now; time += dt;
      render(dt);
      raf = requestAnimationFrame(frame);
    }

    function render(dt) {
      if (!Number.isFinite(tx + ty + mx + my + wind)) tx = ty = mx = my = wind = 0;
      tx += (mx - tx) * Math.min(1, dt * 2.2); ty += (my - ty) * Math.min(1, dt * 2.2);
      wind *= Math.pow(0.35, dt);
      const top = canvas.getBoundingClientRect().top, sc = Math.max(0, -top);
      const put = (lay, depth, k) => ctx.drawImage(lay.c, 0, 0, lay.c.width, lay.c.height, -M - tx * depth * 22, -M - ty * depth * 10 + sc * k, w + 2 * M, h + 2 * M);
      ctx.fillStyle = (opts.end ? PAL[SEASON.get()].sky[0] : pal.sky[0]);
      ctx.fillRect(0, 0, w, h);
      put(L.sky, 0.05, 0.6);
      drawSky(sc * 0.6);
      put(L.far, 0.15, 0.5);
      drawBirds(dt, sc * 0.45);
      put(L.mid, 0.3, 0.38);
      const m0 = L.mist[0], m1 = L.mist[1];
      ctx.drawImage(m0.c, -((time * m0.v) % (m0.w / 2)) - tx * 8, m0.y + sc * 0.3, m0.w, m0.h);
      put(L.near, 0.5, 0.25);
      ctx.drawImage(m1.c, -((time * m1.v) % (m1.w / 2)) - tx * 14, m1.y + sc * 0.18, m1.w, m1.h);
      drawParts(dt, false);
      put(L.fg, 0.9, 0.08);
      drawLanterns(-tx * 0.9 * 22, -ty * 0.9 * 10 + sc * 0.08);
      drawParts(dt, true);
      if (fade) {
        fade.a -= dt * 1.4;
        if (fade.a <= 0) fade = null;
        else { ctx.globalAlpha = fade.a; ctx.drawImage(fade.c, 0, 0, w, h); ctx.globalAlpha = 1; }
      }
    }

    function resize() {
      const r = canvas.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      w = r.width; h = r.height;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      ldpr = Math.min(dpr, Math.sqrt(3.2e6 / ((w + 2 * M) * (h + 2 * M)))); // keep each layer near 3 megapixels
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      compose();
      syncParts();
      return true;
    }

    function start() { if (booted && !raf && !reduce && visible) { last = 0; raf = requestAnimationFrame(frame); } }
    const still = () => { render(0); };

    host.addEventListener('pointermove', e => {
      if (!booted || !w || !h) return; // before the first layout there is no size to divide by
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top, now = performance.now();
      if (px > 0 && now - pt < 120) wind = Math.max(-260, Math.min(260, wind + ((x - px) / Math.max(8, now - pt)) * 40));
      px = x; py = y; pt = now;
      mx = x / w * 2 - 1; my = y / h * 2 - 1;
    }, { passive: true });
    host.addEventListener('pointerleave', () => { px = py = -1; mx = my = 0; });
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }).observe(canvas);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => {
        const r = canvas.getBoundingClientRect();
        if (Math.abs(r.width - w) < 2 && Math.abs(r.height - h) < 120) return; // mobile URL bar: keep the painting
        if (resize() && reduce) still();
      }, 160);
    });

    SEASON.on(() => {
      if (!booted) return;
      if (!reduce) {
        const { c, g } = surface('fade', canvas.width, canvas.height);
        g.drawImage(canvas, 0, 0);
        fade = { c, a: 1 };
      }
      compose(); syncParts();
      if (reduce) still();
    });

    // the painting uses no web fonts, so it does not wait for them
    const boot = () => { if (!resize()) { requestAnimationFrame(boot); return; } booted = true; still(); start(); };
    boot();
    return { tempo(v) { tempo = Math.max(0.5, Math.min(3, v || 1)); } };
  }

  const hero = document.getElementById('scene');
  const heroScene = hero ? makeScene(hero, { seed: 7 }) : null;
  const tail = document.getElementById('scene-end');
  if (tail) makeScene(tail, { end: true, seed: 19, pagoda: false, poles: false, branch: false });
  // extras.js calls this while Spotify says I'm listening: the lanterns sway a little more
  window.FIELD = { tempo(v) { if (heroScene) heroScene.tempo(v); } };

  /* ---------------- the hanging scroll unrolls as you read down to it ---------------- */
  // Scroll position sets a target; the paper eases toward it, so it has a little weight.
  // Scrolling back up rolls it up again. Reduced motion: it simply hangs open.
  (function kakejiku() {
    const fig = document.querySelector('.portrait.scroll'), paper = fig && fig.querySelector('.scroll__paper');
    if (!fig || !paper || reduce) return;
    let cur = 0, target = 0, raf = 0, last = 0;
    const measure = () => fig.style.setProperty('--hpx', `${paper.offsetHeight}px`);
    const tick = now => {
      raf = 0;
      const dt = Math.min(0.05, (now - (last || now)) / 1000); last = now;
      cur += (target - cur) * Math.min(1, dt * 7);
      if (Math.abs(target - cur) < 0.002) cur = target;
      fig.style.setProperty('--u', cur.toFixed(4));
      fig.classList.toggle('is-open', cur > 0.995);
      if (cur !== target) raf = requestAnimationFrame(tick); else last = 0;
    };
    const aim = () => {
      const top = fig.getBoundingClientRect().top, vh = window.innerHeight;
      const t = Math.min(1, Math.max(0, (vh * 0.95 - top) / (vh * 0.55)));
      target = t * t * (3 - 2 * t);
      if (!raf && target !== cur) raf = requestAnimationFrame(tick);
    };
    measure();
    fig.style.setProperty('--u', '0');
    aim();
    window.addEventListener('scroll', aim, { passive: true });
    window.addEventListener('resize', () => { measure(); aim(); }, { passive: true });
  })();

  /* ---------------- the rest of the page: a few things still falling ---------------- */
  // Sparse, behind nothing interactive, and asleep while either painting is on screen.
  (function drift() {
    if (reduce) return;
    const c = document.createElement('canvas');
    c.className = 'drift'; c.setAttribute('aria-hidden', 'true');
    document.body.appendChild(c);
    const g = c.getContext('2d');
    let W = 0, Hh = 0, items = [], raf = 0, last = 0, onScreen = new Set(), wind = 0, lastY = window.scrollY;
    const size = () => {
      const d = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; Hh = window.innerHeight;
      c.width = Math.round(W * d); c.height = Math.round(Hh * d); g.setTransform(d, 0, 0, d, 0, 0);
    };
    const target = () => { const k = SEASON.info().kind; return Math.round({ petal: 9, leaf: 7, firefly: 0, snow: 26 }[k] * Math.min(1.4, W / 1200 + 0.3)); };
    const loop = now => {
      raf = 0;
      const dt = Math.min((now - (last || now)) / 1000, 0.05); last = now;
      const kind = SEASON.info().kind, quiet = onScreen.size > 0;
      g.clearRect(0, 0, W, Hh);
      if (quiet) { items = []; return; }
      wind *= Math.pow(0.3, dt);
      for (let i = items.length - 1; i >= 0; i--) {
        const p = items[i];
        if (!P.step(p, dt, W, Hh, wind)) { items.splice(i, 1); continue; }
        P.draw(g, p, 0.75);
      }
      if (items.length < target() && Math.random() < dt * 1.5) items.push(P.spawn(kind, W, Hh));
      raf = requestAnimationFrame(loop);
    };
    const wake = () => { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(loop); } };
    size();
    window.addEventListener('resize', size, { passive: true });
    window.addEventListener('scroll', () => { const y = window.scrollY; wind = Math.max(-90, Math.min(90, wind + (lastY - y) * 0.4)); lastY = y; }, { passive: true });
    document.addEventListener('visibilitychange', wake);
    SEASON.on(() => { items = []; wake(); });
    const io = new IntersectionObserver(es => { es.forEach(e => (e.isIntersecting ? onScreen.add(e.target) : onScreen.delete(e.target))); if (!onScreen.size) wake(); });
    [hero, tail].forEach(el => el && io.observe(el));
    wake();
  })();
})();
