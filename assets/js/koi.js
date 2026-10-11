/* 鯉, the koi pond in Contact. Each koi is a flexible spine: the head steers
   (wander, keep off the rim, give the others room, chase food, drift toward a
   still cursor) and every segment follows the one before it, so the body bends
   and the tail flows. Patterns are the traditional varieties. The floor has
   pebbles and moving caustics, the surface has lily pads, a lotus or two, and
   whatever the season is dropping. A bamboo spout trickles in one corner.
   Tap the water to feed them. */
(() => {
  const fig = document.querySelector('[data-pond]');
  const canvas = fig && fig.querySelector('canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TAU = Math.PI * 2;
  const R = Math.random;

  // body colour, then patches as [from, to] along the body (0 head, 1 tail), side offset, width
  const VARIETIES = [
    { name: 'kohaku', base: '#f4eee3', patches: [[0.04, 0.22, 0.1, 0.9, '#d9442a'], [0.32, 0.55, -0.25, 0.85, '#d9442a'], [0.62, 0.74, 0.3, 0.6, '#d9442a']] },
    { name: 'sanke', base: '#f3ece0', patches: [[0.06, 0.3, -0.1, 0.9, '#d3402a'], [0.42, 0.6, 0.2, 0.8, '#d3402a'], [0.35, 0.42, -0.5, 0.35, '#1d1b20'], [0.66, 0.72, 0.45, 0.3, '#1d1b20']] },
    { name: 'showa', base: '#1f1c21', patches: [[0.02, 0.18, 0, 0.9, '#d44a2c'], [0.3, 0.48, 0.3, 0.7, '#f1ebdf'], [0.5, 0.64, -0.3, 0.75, '#d44a2c'], [0.7, 0.8, 0.2, 0.5, '#f1ebdf']] },
    { name: 'ogon', base: '#e3a93f', patches: [], metal: true },
    { name: 'tancho', base: '#f6f1e8', patches: [[0.04, 0.1, 0, 0.55, '#d63b28']] },
    { name: 'asagi', base: '#8197ae', patches: [[0.1, 0.7, 0.85, 0.5, '#e2712f'], [0.1, 0.7, -0.85, 0.5, '#e2712f']], scales: true },
    { name: 'yamabuki', base: '#f0c552', patches: [], metal: true },
  ];

  let w = 0, h = 0, dpr = 1, raf = 0, visible = false, last = 0, time = 0, built = false;
  let koi = [], food = [], ripples = [], pads = [], floaters = [], glints = [];
  let bed = null, caustic = null, rim = null, spoutAt = 0;
  const mouse = { x: -1, y: -1, still: 0, on: false };

  /* ---------------- static paintings ---------------- */
  function makeCaustic(S) {
    const c = document.createElement('canvas'); c.width = c.height = S;
    const g = c.getContext('2d'), img = g.createImageData(S, S), d = img.data;
    const pts = Array.from({ length: 22 }, () => [R() * S, R() * S]);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      let d1 = 1e9, d2 = 1e9;
      for (const [px, py] of pts) for (let ox = -S; ox <= S; ox += S) for (let oy = -S; oy <= S; oy += S) {
        const dd = (x - px - ox) ** 2 + (y - py - oy) ** 2;
        if (dd < d1) { d2 = d1; d1 = dd; } else if (dd < d2) d2 = dd;
      }
      const v = Math.max(0, 1 - (Math.sqrt(d2) - Math.sqrt(d1)) / 7) ** 3 * (0.55 + 0.45 * Math.sin(x * 0.07 + y * 0.05)), o = (y * S + x) * 4;
      d[o] = 200; d[o + 1] = 240; d[o + 2] = 235; d[o + 3] = v * 255;
    }
    g.putImageData(img, 0, 0);
    const soft = document.createElement('canvas'); soft.width = soft.height = S;
    const sg = soft.getContext('2d'); sg.filter = 'blur(1.2px)'; sg.drawImage(c, 0, 0);
    return soft;
  }

  function paintBed() {
    const c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    const gr = g.createRadialGradient(w * 0.45, h * 0.45, 10, w * 0.5, h * 0.5, Math.max(w, h) * 0.7);
    gr.addColorStop(0, '#1d4a52'); gr.addColorStop(0.6, '#123640'); gr.addColorStop(1, '#0a2029');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    // pebbles, and a few large stones lying deep
    for (let i = 0; i < w * h / 160; i++) {
      const x = R() * w, y = R() * h, r = 1 + R() * 3.2, l = R();
      g.fillStyle = l < 0.5 ? `rgba(10, 30, 34, ${0.25 + R() * 0.3})` : `rgba(120, 160, 150, ${0.06 + R() * 0.08})`;
      g.beginPath(); g.ellipse(x, y, r * 1.3, r, R() * 3, 0, TAU); g.fill();
    }
    g.filter = 'blur(3px)';
    for (let i = 0; i < 6; i++) {
      const x = R() * w, y = R() * h, r = 14 + R() * 26;
      g.fillStyle = 'rgba(70, 90, 88, 0.35)'; g.beginPath(); g.ellipse(x, y, r * 1.4, r, R() * 3, 0, TAU); g.fill();
    }
    g.filter = 'none';
    return c;
  }

  // the stones round the edge, with moss, and the bamboo spout in the top right
  function paintRim() {
    const c = document.createElement('canvas'); c.width = w * dpr; c.height = h * dpr;
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    const stone = (x, y, r) => {
      g.save();
      g.fillStyle = 'rgba(0, 0, 0, 0.45)'; g.filter = 'blur(4px)';
      g.beginPath(); g.ellipse(x + 3, y + 5, r * 1.15, r * 0.95, 0, 0, TAU); g.fill();
      g.restore();
      const p = new Path2D(), n = 12, j = Array.from({ length: n }, () => 0.85 + R() * 0.25);
      for (let i = 0; i <= n; i++) { const a = (i / n) * TAU, rr = r * j[i % n]; i ? p.lineTo(x + Math.cos(a) * rr * 1.2, y + Math.sin(a) * rr) : p.moveTo(x + Math.cos(a) * rr * 1.2, y + Math.sin(a) * rr); }
      const sg = g.createLinearGradient(x - r, y - r, x + r, y + r);
      const tone = 0.8 + R() * 0.35;
      sg.addColorStop(0, `rgb(${120 * tone | 0}, ${122 * tone | 0}, ${118 * tone | 0})`); sg.addColorStop(1, '#262a2b');
      g.fillStyle = sg; g.fill(p);
      g.save(); g.clip(p);
      g.fillStyle = 'rgba(255, 255, 255, 0.06)';
      for (let i = 0; i < 30; i++) { g.beginPath(); g.arc(x + (R() - 0.5) * r * 2, y + (R() - 0.5) * r * 2, R() * 1.4, 0, TAU); g.fill(); }
      g.fillStyle = 'rgba(92, 128, 64, 0.6)';
      g.beginPath(); g.ellipse(x - r * 0.25, y - r * 0.55, r * 0.75, r * 0.35, -0.2, 0, TAU); g.fill();
      g.fillStyle = 'rgba(140, 170, 90, 0.35)';
      g.beginPath(); g.ellipse(x - r * 0.35, y - r * 0.65, r * 0.4, r * 0.15, -0.2, 0, TAU); g.fill();
      g.restore();
    };
    const s = Math.max(14, Math.min(w, h) * 0.075);
    for (let x = -s * 0.5; x < w + s; x += s * (1.3 + R() * 0.6)) { stone(x, -s * 0.35 + R() * s * 0.3, s * (0.8 + R() * 0.5)); stone(x + s * 0.5, h + s * 0.3 - R() * s * 0.3, s * (0.8 + R() * 0.5)); }
    for (let y = s; y < h - s; y += s * (1.4 + R() * 0.6)) { stone(-s * 0.4 + R() * s * 0.2, y, s * (0.75 + R() * 0.4)); stone(w + s * 0.4 - R() * s * 0.2, y, s * (0.75 + R() * 0.4)); }
    // kakei, the bamboo spout
    const bx = w - s * 0.2, by = s * 0.9, ex = w - s * 3.2, ey = s * 1.7;
    g.lineCap = 'round';
    g.strokeStyle = '#3f5a2a'; g.lineWidth = s * 0.42; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = '#7c9a4a'; g.lineWidth = s * 0.3; g.beginPath(); g.moveTo(bx, by); g.lineTo(ex, ey); g.stroke();
    g.strokeStyle = 'rgba(220, 240, 180, 0.35)'; g.lineWidth = s * 0.06; g.beginPath(); g.moveTo(bx, by - s * 0.08); g.lineTo(ex, ey - s * 0.08); g.stroke();
    g.strokeStyle = '#33461f'; g.lineWidth = s * 0.07;
    const nx = bx + (ex - bx) * 0.45, ny = by + (ey - by) * 0.45;
    g.beginPath(); g.moveTo(nx, ny - s * 0.16); g.lineTo(nx + s * 0.04, ny + s * 0.16); g.stroke();
    spoutAt = { x: ex - s * 0.1, y: ey + s * 0.08, land: { x: ex - s * 0.45, y: ey + s * 1.4 } };
    return c;
  }

  /* ---------------- the koi ---------------- */
  function makeKoi(v, i) {
    const scale = Math.max(0.6, Math.min(1.25, w / 760));
    const L = (54 + R() * 30) * scale, n = 16, seg = L / n;
    const x = w * (0.2 + R() * 0.6), y = h * (0.25 + R() * 0.5), a = R() * TAU;
    return {
      v, L, n, seg, a, speed: 18 + R() * 10, phase: R() * TAU, wander: R() * TAU, depth: 0.72 + R() * 0.28, gulp: 0, id: i,
      pts: Array.from({ length: n + 1 }, (_, k) => [x - Math.cos(a) * seg * k, y - Math.sin(a) * seg * k]),
    };
  }
  const width = (k, t) => k.L * 0.12 * (t < 0.14 ? 0.72 + (t / 0.14) * 0.28 : Math.max(0.16, Math.pow(1 - (t - 0.14) / 0.86, 0.85)));

  function steer(k, dt) {
    const [hx, hy] = k.pts[0];
    let tx = Math.cos(k.wander), ty = Math.sin(k.wander), urgency = 0;
    k.wander += (R() - 0.5) * dt * 1.6;
    // food first
    let best = null, bd = 1e9;
    for (const f of food) { const d = Math.hypot(f.x - hx, f.y - hy); if (d < bd && d < Math.max(w, h) * 0.7) { bd = d; best = f; } }
    if (best) { tx = (best.x - hx) / bd; ty = (best.y - hy) / bd; urgency = 1; if (bd < 7 + k.L * 0.05) { best.eaten = true; k.gulp = 1; ripples.push({ x: best.x, y: best.y, r: 2, a: 0.5, v: 26 }); } }
    else if (mouse.on && mouse.still > 0.6) {
      const d = Math.hypot(mouse.x - hx, mouse.y - hy);
      if (d < 220 && d > 34) { tx += ((mouse.x - hx) / d) * 1.2; ty += ((mouse.y - hy) / d) * 1.2; urgency = 0.15; }
    }
    // keep off the stones
    const m = Math.min(w, h) * 0.2;
    if (hx < m) tx += (m - hx) / m * 2.2; if (hx > w - m) tx -= (hx - (w - m)) / m * 2.2;
    if (hy < m) ty += (m - hy) / m * 2.2; if (hy > h - m) ty -= (hy - (h - m)) / m * 2.2;
    // and give the others room
    for (const o of koi) {
      if (o === k) continue;
      const dx = hx - o.pts[3][0], dy = hy - o.pts[3][1], d = Math.hypot(dx, dy);
      if (d < k.L * 0.9 && d > 0) { tx += (dx / d) * 0.8; ty += (dy / d) * 0.8; }
    }
    const want = Math.atan2(ty, tx);
    let da = want - k.a; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
    const turn = (1.1 + urgency * 2.2) * dt;
    k.a += Math.max(-turn, Math.min(turn, da));
    if (Math.abs(da) > 1.2 && !urgency) k.wander = want;
    const target = 16 + urgency * 46 + (k.gulp > 0 ? -10 : 0);
    k.speed += (target - k.speed) * Math.min(1, dt * 1.5);
    k.gulp = Math.max(0, k.gulp - dt * 2);
    // the head swims, the body follows: a little lateral swing makes the undulation
    k.phase += dt * (3 + k.speed * 0.12);
    const swing = Math.sin(k.phase) * 0.32 * Math.min(1, k.speed / 30);
    const dir = k.a + swing;
    k.pts[0][0] += Math.cos(dir) * k.speed * dt;
    k.pts[0][1] += Math.sin(dir) * k.speed * dt;
    for (let i = 1; i <= k.n; i++) {
      const p = k.pts[i], q = k.pts[i - 1], dx = p[0] - q[0], dy = p[1] - q[1], d = Math.hypot(dx, dy) || 1;
      p[0] = q[0] + (dx / d) * k.seg; p[1] = q[1] + (dy / d) * k.seg;
    }
  }

  function bodyPath(k) {
    const L = [], Rt = [];
    for (let i = 0; i <= k.n; i++) {
      const p = k.pts[i], q = k.pts[Math.min(k.n, i + 1)], o = k.pts[Math.max(0, i - 1)];
      const ang = Math.atan2(o[1] - q[1], o[0] - q[0]), wd = width(k, i / k.n);
      const nx = -Math.sin(ang) * wd, ny = Math.cos(ang) * wd;
      L.push([p[0] + nx, p[1] + ny]); Rt.push([p[0] - nx, p[1] - ny]);
    }
    const head = k.pts[0], a0 = Math.atan2(head[1] - k.pts[1][1], head[0] - k.pts[1][0]);
    const path = new Path2D();
    path.moveTo(head[0] + Math.cos(a0) * k.seg * 0.9, head[1] + Math.sin(a0) * k.seg * 0.9);
    const side = arr => arr.forEach(([x, y], i) => {
      const nx2 = arr[Math.min(arr.length - 1, i + 1)];
      path.quadraticCurveTo(x, y, (x + nx2[0]) / 2, (y + nx2[1]) / 2);
    });
    side(L);
    const tail = k.pts[k.n];
    path.lineTo(tail[0], tail[1]);
    side(Rt.slice().reverse());
    path.closePath();
    return path;
  }

  function drawKoi(k) {
    const P = k.pts, v = k.v, n = k.n;
    const ang = i => Math.atan2(P[i][1] - P[Math.min(n, i + 1)][1], P[i][0] - P[Math.min(n, i + 1)][0]);
    ctx.save();
    ctx.globalAlpha = 0.55 + k.depth * 0.45;
    // tail fin: two lobes trailing the last segment, swaying with it
    const tp = P[n], ta = ang(n - 1) + Math.PI, sway = Math.sin(k.phase - 1.4) * 0.35, fl = k.L * 0.3;
    ctx.fillStyle = v.metal ? 'rgba(240, 200, 110, 0.55)' : 'rgba(246, 238, 226, 0.5)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'; ctx.lineWidth = 0.6;
    [-1, 1].forEach(sd => {
      const a = ta + sway + sd * 0.42, mx = tp[0] + Math.cos(a) * fl, my = tp[1] + Math.sin(a) * fl;
      ctx.beginPath(); ctx.moveTo(tp[0], tp[1]);
      ctx.quadraticCurveTo(tp[0] + Math.cos(ta + sway + sd * 0.15) * fl * 0.8, tp[1] + Math.sin(ta + sway + sd * 0.15) * fl * 0.8, mx, my);
      ctx.quadraticCurveTo(tp[0] + Math.cos(ta + sway + sd * 0.7) * fl * 0.5, tp[1] + Math.sin(ta + sway + sd * 0.7) * fl * 0.5, tp[0], tp[1]);
      ctx.fill(); ctx.stroke();
    });
    // pectoral fins
    const pi = 3, pp = P[pi], pa = ang(pi), flap = Math.sin(k.phase * 1.3) * 0.4;
    ctx.fillStyle = v.metal ? 'rgba(240, 200, 110, 0.5)' : 'rgba(246, 238, 226, 0.45)';
    [-1, 1].forEach(sd => {
      const a = pa + Math.PI + sd * (1.05 + flap * sd), r = k.L * 0.16;
      ctx.beginPath(); ctx.ellipse(pp[0] + Math.cos(a) * r * 0.7, pp[1] + Math.sin(a) * r * 0.7, r, r * 0.42, a, 0, TAU); ctx.fill();
    });
    // body
    const body = bodyPath(k);
    ctx.fillStyle = v.base; ctx.fill(body);
    ctx.save(); ctx.clip(body);
    for (const [t0, t1, sideOff, wsc, col] of v.patches) {
      ctx.fillStyle = col;
      for (let i = Math.floor(t0 * n); i <= Math.ceil(t1 * n) && i <= n; i++) {
        const p = P[i], a = ang(i), wd = width(k, i / n);
        const ox = -Math.sin(a) * wd * sideOff, oy = Math.cos(a) * wd * sideOff;
        ctx.beginPath(); ctx.arc(p[0] + ox, p[1] + oy, wd * wsc, 0, TAU); ctx.fill();
      }
    }
    if (v.scales) { // asagi: a net of darker scale edges along the back
      ctx.strokeStyle = 'rgba(40, 55, 75, 0.45)'; ctx.lineWidth = 0.6;
      for (let i = 2; i < n - 2; i += 1) { const p = P[i], a = ang(i), wd = width(k, i / n); ctx.beginPath(); ctx.arc(p[0], p[1], wd * 0.55, a + 1.9, a + 4.4); ctx.stroke(); }
    }
    // shading: dark flanks, a lit ridge down the back
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)'; ctx.lineWidth = 2.2; ctx.stroke(body);
    ctx.beginPath(); P.slice(0, n - 2).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = v.metal ? 'rgba(255, 245, 200, 0.55)' : 'rgba(255, 255, 255, 0.28)'; ctx.lineWidth = width(k, 0.3) * 0.5; ctx.lineCap = 'round'; ctx.stroke();
    ctx.restore();
    // dorsal fin, a translucent ridge
    ctx.beginPath(); P.slice(4, 10).forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)'; ctx.lineWidth = 1.4; ctx.stroke();
    // eyes
    const h0 = P[1], ha = ang(1), ew = width(k, 0.06) * 0.62;
    ctx.fillStyle = '#121014';
    [-1, 1].forEach(sd => { ctx.beginPath(); ctx.arc(h0[0] - Math.sin(ha) * ew * sd + Math.cos(ha) * k.seg * 0.5, h0[1] + Math.cos(ha) * ew * sd + Math.sin(ha) * k.seg * 0.5, Math.max(0.8, k.L * 0.012), 0, TAU); ctx.fill(); });
    ctx.restore();
  }

  /* ---------------- the surface ---------------- */
  function makeSurface() {
    const sc = Math.max(0.65, Math.min(1.2, w / 760));
    pads = Array.from({ length: Math.max(4, Math.round(w / 140)) }, (_, i) => ({
      x: w * (0.08 + R() * 0.84), y: h * (0.12 + R() * 0.76), r: (14 + R() * 16) * sc, a: R() * TAU, va: (R() - 0.5) * 0.04, flower: i % 3 === 0,
    }));
    const kind = window.SEASON ? window.SEASON.info().kind : 'leaf';
    floaters = kind === 'snow' || kind === 'firefly' ? [] : Array.from({ length: 7 }, () => {
      const p = window.SEASON.particle.spawn(kind, w, h, { anywhere: true });
      p.x = R() * w; p.y = R() * h; p.flip = 0; p.size *= 1.1; p.drift = (R() - 0.5) * 4; return p;
    });
    glints = Array.from({ length: 24 }, () => ({ x: R() * w, y: R() * h, ph: R() * TAU, s: 0.6 + R() * 1.4 }));
  }

  function drawPad(p) {
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.a);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)'; ctx.beginPath(); ctx.ellipse(3, 5, p.r, p.r * 0.92, 0, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(-p.r * 0.3, -p.r * 0.3, 1, 0, 0, p.r);
    g.addColorStop(0, '#5d8f4a'); g.addColorStop(1, '#2f5a2f');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, p.r, 0.22, TAU - 0.05); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(200, 230, 160, 0.18)'; ctx.lineWidth = 0.7;
    for (let i = 0; i < 9; i++) { const a = 0.4 + (i / 9) * (TAU - 0.5); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * p.r * 0.9, Math.sin(a) * p.r * 0.9); ctx.stroke(); }
    if (p.flower) {
      const fr = p.r * 0.5;
      ctx.translate(-p.r * 0.25, -p.r * 0.2);
      [[10, fr, '#e8a5b6'], [8, fr * 0.75, '#f3c1cc'], [6, fr * 0.5, '#fbe1e6']].forEach(([cnt, r, col], layer) => {
        ctx.fillStyle = col;
        for (let i = 0; i < cnt; i++) { const a = (i / cnt) * TAU + layer * 0.3; ctx.beginPath(); ctx.ellipse(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45, r * 0.55, r * 0.22, a, 0, TAU); ctx.fill(); }
      });
      ctx.fillStyle = '#f2cf5a'; ctx.beginPath(); ctx.arc(0, 0, fr * 0.16, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* ---------------- frame ---------------- */
  function draw(dt) {
    ctx.drawImage(bed, 0, 0, w, h);
    // caustics on the floor, two layers drifting against each other
    if (caustic) {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const S = caustic.width;
      for (const [k, vx, vy, al] of [[1.7, 7, 4, 0.11], [2.6, -5, 6, 0.08]]) {
        ctx.globalAlpha = al;
        const size = S * k, ox = ((time * vx) % size + size) % size, oy = ((time * vy) % size + size) % size;
        for (let x = -size + ox; x < w; x += size) for (let y = -size + oy; y < h; y += size) ctx.drawImage(caustic, x, y, size, size);
      }
      ctx.restore();
    }
    // shadows on the floor, then food, then the koi
    ctx.save(); ctx.filter = 'blur(4px)'; ctx.fillStyle = 'rgba(0, 12, 16, 0.4)';
    for (const k of koi) { ctx.save(); ctx.translate(8 * k.depth, 12 * k.depth); ctx.fill(bodyPath(k)); ctx.restore(); }
    ctx.restore();
    for (const f of food) {
      ctx.fillStyle = `rgba(196, 140, 70, ${Math.min(1, f.life / 2).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(f.x, f.y, 2.2, 0, TAU); ctx.fill();
    }
    koi.slice().sort((a, b) => a.depth - b.depth).forEach(drawKoi);
    // a little caustic light on their backs too, and the water over them
    const wg = ctx.createLinearGradient(0, 0, w, h);
    wg.addColorStop(0, 'rgba(160, 210, 220, 0.07)'); wg.addColorStop(1, 'rgba(6, 24, 30, 0.12)');
    ctx.fillStyle = wg; ctx.fillRect(0, 0, w, h);
    // surface
    for (const p of pads) { p.a += p.va * dt; drawPad(p); }
    for (const p of floaters) {
      p.x += (p.drift + Math.sin(time * 0.3 + p.t) * 2) * dt; p.rot += 0.05 * dt;
      if (p.x > w + 20) p.x = -20; if (p.x < -20) p.x = w + 20;
      window.SEASON.particle.draw(ctx, p, 0.9);
    }
    // ripples
    ctx.lineWidth = 1;
    for (const r of ripples) {
      for (const k of [1, 0.6]) {
        ctx.strokeStyle = `rgba(220, 245, 245, ${(r.a * k).toFixed(3)})`;
        ctx.beginPath(); ctx.ellipse(r.x, r.y, r.r * k, r.r * k * 0.82, 0, 0, TAU); ctx.stroke();
      }
    }
    // glints of sky on the surface
    for (const g of glints) {
      const a = Math.max(0, Math.sin(time * g.s + g.ph)) ** 6 * 0.5;
      if (a < 0.02) continue;
      ctx.fillStyle = `rgba(235, 248, 255, ${a.toFixed(3)})`; ctx.fillRect(g.x, g.y, 3 * g.s, 0.8);
    }
    // the spout's stream
    if (spoutAt) {
      const { x, y, land } = spoutAt;
      ctx.strokeStyle = 'rgba(220, 240, 245, 0.55)'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x - 4, y + (land.y - y) * 0.3, land.x, land.y); ctx.stroke();
    }
    ctx.drawImage(rim, 0, 0, w, h);
  }

  function step(dt) {
    time += dt;
    koi.forEach(k => steer(k, dt));
    food.forEach(f => { f.life -= dt; f.x += Math.sin(time + f.ph) * 2 * dt; });
    food = food.filter(f => !f.eaten && f.life > 0);
    ripples.forEach(r => { r.r += r.v * dt; r.a -= dt * 0.5; });
    ripples = ripples.filter(r => r.a > 0);
    if (spoutAt && (time % 0.7) < dt) ripples.push({ x: spoutAt.land.x, y: spoutAt.land.y, r: 2, a: 0.35, v: 22 });
    if (mouse.on) mouse.still += dt;
  }

  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min(0.04, (now - (last || now)) / 1000); last = now;
    step(dt); draw(dt);
    raf = requestAnimationFrame(frame);
  }

  function build() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    w = r.width; h = r.height; dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bed = paintBed(); rim = paintRim();
    if (!caustic) caustic = makeCaustic(160);
    if (!koi.length) koi = VARIETIES.slice(0, w < 520 ? 5 : 7).map(makeKoi);
    makeSurface();
    built = true;
    return true;
  }

  const point = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  canvas.addEventListener('pointerdown', e => {
    const [x, y] = point(e);
    ripples.push({ x, y, r: 3, a: 0.6, v: 34 }, { x, y, r: 1, a: 0.4, v: 22 });
    for (let i = 0; i < 6; i++) food.push({ x: x + (R() - 0.5) * 26, y: y + (R() - 0.5) * 26, life: 14, ph: R() * 6 });
    if (reduce) { for (let i = 0; i < 200; i++) step(1 / 30); draw(0); }
  });
  canvas.addEventListener('pointermove', e => {
    const [x, y] = point(e);
    if (Math.hypot(x - mouse.x, y - mouse.y) > 3) mouse.still = 0;
    if (mouse.on && Math.hypot(x - mouse.x, y - mouse.y) > 26) ripples.push({ x, y, r: 1, a: 0.18, v: 20 });
    mouse.x = x; mouse.y = y; mouse.on = true;
  });
  canvas.addEventListener('pointerleave', () => { mouse.on = false; });

  const start = () => { if (!raf && visible && !reduce) { last = 0; raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible && !built && build()) { for (let i = 0; i < 60; i++) step(1 / 30); draw(0); }
    start();
  }, { rootMargin: '200px 0px' }).observe(canvas);
  document.addEventListener('visibilitychange', start);
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (built && build()) draw(0); }, 200); });
  if (window.SEASON) window.SEASON.on(() => { if (built) { makeSurface(); if (reduce) draw(0); } });
})();
