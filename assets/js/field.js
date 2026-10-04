/* Hero field: a dot-matrix grid with a sparse neural net laid over it.
   Neurons fire, send pulses along their edges, and the activation ring
   decodes the grid cells it passes through into glyphs before they fade
   back to dots. Occasional rain streams fall down single columns, and the
   cursor acts as a standing activation source. */
(() => {
  const canvas = document.getElementById('field');
  if (!canvas) return;
  const ctx = canvas.getContext('2d', { alpha: true });
  const hero = canvas.parentElement;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CELL = 22;
  const GLYPHS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノ<>/{}[]=+*#%λΣ∂∇'.split('');
  const css = (v, d) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d; // palette lives in main.css :root
  const SIGNAL = css('--accent-rgb', '205, 176, 124');
  const GLYPH = css('--accent-2-rgb', SIGNAL);
  const FG = css('--fg-rgb', '236, 235, 230');
  const HI = css('--hi-rgb', '250, 244, 230');
  const DOT = `rgba(${FG}, 0.07)`;

  let w = 0, h = 0, dpr = 1, cols = 0, rows = 0;
  let heat, glyph;            // per-cell activation [0..1] and glyph index
  let nodes = [], edges = [], pulses = [], rings = [], streams = [];
  let mouse = { x: -9999, y: -9999, on: false };
  let visible = true, raf = 0, last = 0, idle = 0, rain = 0, booted = false;
  let tempo = 1; // > 1 while Spotify says I'm listening: the net fires a little faster

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = rect.width; h = rect.height;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(w / CELL) + 1;
    rows = Math.ceil(h / CELL) + 1;
    heat = new Float32Array(cols * rows);
    glyph = new Uint8Array(cols * rows);
    ctx.font = `500 11px 'Geist Mono', ui-monospace, monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    buildNet();
  }

  // Neurons snap to grid intersections, biased to the right so the headline stays clean.
  function buildNet() {
    nodes = []; edges = []; pulses = []; rings = []; streams = [];
    const narrow = w < 720;
    const target = Math.round((w * h) / (narrow ? 26000 : 34000));
    const minD = narrow ? 70 : 110;
    let tries = 0;
    while (nodes.length < target && tries++ < target * 40) {
      const bias = narrow ? Math.random() : 0.28 + Math.pow(Math.random(), 0.7) * 0.72;
      const x = Math.round((bias * w) / CELL) * CELL;
      const y = Math.round((Math.random() * h * 0.92) / CELL) * CELL;
      if (nodes.some(n => (n.x - x) ** 2 + (n.y - y) ** 2 < minD * minD)) continue;
      nodes.push({ x, y, fire: 0, cool: 0, nb: [] });
    }
    const key = new Set();
    nodes.forEach((n, i) => {
      nodes
        .map((m, j) => ({ j, d: (m.x - n.x) ** 2 + (m.y - n.y) ** 2 }))
        .filter(o => o.j !== i)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .forEach(({ j }) => {
          const k = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (key.has(k)) return;
          key.add(k);
          const e = { a: i, b: j, lit: 0 };
          edges.push(e);
          n.nb.push({ j, e });
          nodes[j].nb.push({ j: i, e });
        });
    });
  }

  function fire(i, from = -1) {
    const n = nodes[i];
    if (!n || n.cool > 0) return;
    n.fire = 1;
    n.cool = 1.6 + Math.random() * 1.4;
    if (rings.length < 10) rings.push({ x: n.x, y: n.y, r: 0, max: 90 + Math.random() * 90 });
    n.nb.forEach(({ j, e }) => {
      if (j === from || pulses.length > 36 || Math.random() > 0.72) return;
      const len = Math.hypot(nodes[j].x - n.x, nodes[j].y - n.y);
      pulses.push({ from: i, to: j, e, t: 0, speed: 260 / len });
    });
  }

  function cellAt(x, y) {
    const c = Math.round(x / CELL), r = Math.round(y / CELL);
    return c >= 0 && r >= 0 && c < cols && r < rows ? r * cols + c : -1;
  }

  function excite(idx, v) {
    if (idx < 0) return;
    if (heat[idx] < 0.08 && v > 0.08) glyph[idx] = (Math.random() * GLYPHS.length) | 0;
    if (v > heat[idx]) heat[idx] = v;
  }

  function step(dt) {
    // decay
    const k = Math.pow(0.12, dt);
    for (let i = 0; i < heat.length; i++) {
      if (heat[i] > 0.002) {
        heat[i] *= k;
        if (Math.random() < 0.02) glyph[i] = (Math.random() * GLYPHS.length) | 0;
      } else heat[i] = 0;
    }
    nodes.forEach(n => { n.fire *= Math.pow(0.05, dt); n.cool -= dt; });
    edges.forEach(e => { e.lit *= Math.pow(0.08, dt); });

    // rings decode the cells they cross
    for (let i = rings.length - 1; i >= 0; i--) {
      const g = rings[i];
      g.r += 150 * dt;
      const life = 1 - g.r / g.max;
      if (life <= 0) { rings.splice(i, 1); continue; }
      const c0 = Math.max(0, Math.floor((g.x - g.r - CELL) / CELL)), c1 = Math.min(cols - 1, Math.ceil((g.x + g.r + CELL) / CELL));
      const r0 = Math.max(0, Math.floor((g.y - g.r - CELL) / CELL)), r1 = Math.min(rows - 1, Math.ceil((g.y + g.r + CELL) / CELL));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const d = Math.abs(Math.hypot(c * CELL - g.x, r * CELL - g.y) - g.r);
        if (d < 14) excite(r * cols + c, (1 - d / 14) * life * 0.9);
      }
    }

    // pulses travel edges; arrival can cascade
    for (let i = pulses.length - 1; i >= 0; i--) {
      const p = pulses[i];
      p.t += p.speed * dt;
      p.e.lit = Math.max(p.e.lit, 0.9);
      const a = nodes[p.from], b = nodes[p.to];
      const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
      excite(cellAt(x, y), 0.75);
      if (p.t >= 1) {
        pulses.splice(i, 1);
        if (Math.random() < 0.58) fire(p.to, p.from);
      }
    }

    // cursor halo, and nearby neurons fire
    if (mouse.on) {
      const R = 110;
      const c0 = Math.max(0, Math.floor((mouse.x - R) / CELL)), c1 = Math.min(cols - 1, Math.ceil((mouse.x + R) / CELL));
      const r0 = Math.max(0, Math.floor((mouse.y - R) / CELL)), r1 = Math.min(rows - 1, Math.ceil((mouse.y + R) / CELL));
      for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
        const d = Math.hypot(c * CELL - mouse.x, r * CELL - mouse.y);
        if (d < R) excite(r * cols + c, (1 - d / R) ** 1.6 * 0.7);
      }
      nodes.forEach((n, i) => { if ((n.x - mouse.x) ** 2 + (n.y - mouse.y) ** 2 < 60 * 60) fire(i); });
    }

    // matrix rain: a head falls down one column, leaving decaying glyphs behind it
    rain += dt;
    if (rain > 0.8 && streams.length < 4) {
      rain = 0;
      streams.push({ c: (Math.random() * cols) | 0, y: -CELL * (Math.random() * 6), v: 90 + Math.random() * 140, end: h * (0.4 + Math.random() * 0.6) });
    }
    for (let i = streams.length - 1; i >= 0; i--) {
      const st = streams[i];
      st.y += st.v * dt;
      if (st.y > st.end) { streams.splice(i, 1); continue; }
      const r = Math.round(st.y / CELL);
      if (r >= 0 && r < rows) {
        const idx = r * cols + st.c;
        glyph[idx] = (Math.random() * GLYPHS.length) | 0;
        heat[idx] = Math.max(heat[idx], 0.62);
      }
    }

    // keep the net breathing
    idle += dt;
    if (idle > (pulses.length ? 2.8 : 1.1) / tempo) { idle = 0; fire((Math.random() * nodes.length) | 0); }
  }

  function draw() {
    ctx.clearRect(0, 0, w, h);

    // grid
    ctx.fillStyle = DOT;
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      if (heat[r * cols + c] < 0.08) ctx.fillRect(c * CELL - 0.75, r * CELL - 0.75, 1.5, 1.5);
    }

    // edges
    ctx.lineWidth = 1;
    edges.forEach(e => {
      const a = nodes[e.a], b = nodes[e.b];
      ctx.strokeStyle = e.lit > 0.05 ? `rgba(${SIGNAL}, ${e.lit * 0.35})` : `rgba(${FG}, 0.05)`;
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    });

    // decoded cells
    for (let i = 0; i < heat.length; i++) {
      const v = heat[i];
      if (v < 0.08) continue;
      const c = i % cols, r = (i / cols) | 0;
      ctx.fillStyle = v > 0.72 ? `rgba(${HI}, ${v})` : `rgba(${GLYPH}, ${v * 0.9})`;
      ctx.fillText(GLYPHS[glyph[i]], c * CELL, r * CELL);
    }

    // pulses
    pulses.forEach(p => {
      const a = nodes[p.from], b = nodes[p.to];
      const x = a.x + (b.x - a.x) * p.t, y = a.y + (b.y - a.y) * p.t;
      ctx.fillStyle = `rgba(${SIGNAL}, 0.2)`;
      ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = `rgb(${SIGNAL})`;
      ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
    });

    // neurons
    nodes.forEach(n => {
      const r = 3.5 + n.fire * 2.5;
      if (n.fire > 0.05) {
        ctx.fillStyle = `rgba(${SIGNAL}, ${n.fire * 0.16})`;
        ctx.beginPath(); ctx.arc(n.x, n.y, r + 8 * n.fire, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#08090a';
      ctx.strokeStyle = n.fire > 0.05 ? `rgba(${SIGNAL}, ${0.4 + n.fire * 0.6})` : `rgba(${FG}, 0.28)`;
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = n.fire > 0.05 ? `rgba(${SIGNAL}, ${0.25 + n.fire * 0.75})` : `rgba(${FG}, 0.3)`;
      ctx.beginPath(); ctx.arc(n.x, n.y, 1.4 + n.fire, 0, Math.PI * 2); ctx.fill();
    });
  }

  function loop(t) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min((t - (last || t)) / 1000, 0.05);
    last = t;
    step(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }

  function start() { if (booted && !raf && !reduce) { last = 0; raf = requestAnimationFrame(loop); } }

  hero.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top; mouse.on = true;
  }, { passive: true });
  hero.addEventListener('pointerleave', () => { mouse.on = false; });

  new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); }).observe(hero);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) start(); });

  let rt;
  window.addEventListener('resize', () => {
    clearTimeout(rt);
    rt = setTimeout(() => { if (!booted) return; resize(); seed(); draw(); }, 150);
  });

  // A few initial firings so the first frame isn't empty.
  function seed() {
    for (let i = 0; i < 3; i++) fire((Math.random() * nodes.length) | 0);
    if (reduce) { for (let s = 0; s < 40; s++) step(1 / 30); }
  }

  window.FIELD = { tempo(v) { tempo = Math.max(0.5, Math.min(3, v || 1)); } };

  const boot = () => { resize(); booted = true; seed(); draw(); start(); };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(boot); else boot();
})();
