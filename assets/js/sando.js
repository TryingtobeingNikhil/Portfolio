/* 道: the path through the gates in Experience. Stepping stones wind from one
   torii to the next, with rocks, moss, grass, ferns and little shrubs on the
   outside of each bend, dressed for the season. Painted once to a canvas behind
   the gates (and again on resize or a season change), and walked into view as
   the section scrolls up. */
(() => {
  const tl = document.querySelector('#experience .timeline');
  if (!tl) return;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cv = document.createElement('canvas');
  cv.className = 'sando'; cv.setAttribute('aria-hidden', 'true');
  tl.prepend(cv);
  const ctx = cv.getContext('2d');

  const rng = seed => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const rgb = h => { const n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
  const mix = (a, b, t) => '#' + rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
  const A = (h, a) => `rgba(${rgb(h).join(',')},${a})`;

  // what grows along the path, per season
  const LOOK = {
    spring: { leaf: '#56704a', moss: '#4d6a3f', bloom: ['#f1b3c2', '#fbe3e9', '#e9a0b4'], litter: 0.5, snow: 0 },
    summer: { leaf: '#41663c', moss: '#3f6638', bloom: ['#eef2c8', '#cfe39a'], litter: 0.12, snow: 0 },
    autumn: { leaf: '#5a5e36', moss: '#4f5a30', bloom: ['#c94a2a', '#e2703a', '#e9a03c', '#b8402c'], litter: 0.8, snow: 0 },
    winter: { leaf: '#3f4a52', moss: '#3c4848', bloom: ['#f4f7fc', '#e3ebf6'], litter: 0.25, snow: 1 },
  };

  let L = 0, W = 0, H = 0, cx = 0, top = 0;

  function layout() {
    const roles = [...tl.querySelectorAll(':scope > .role')];
    if (!roles.length) return null;
    const g0 = roles[0].querySelector('.role__gate');
    cx = roles[0].offsetLeft + g0.offsetLeft + g0.offsetWidth / 2;
    const narrow = g0.offsetWidth < 110;
    // the canvas runs from well left of the gates to just short of the text
    L = Math.round(cx - (narrow ? 66 : 150)); W = Math.round((narrow ? 66 + 48 : 150 + 82)); H = tl.offsetHeight;
    const gates = roles.map(r => {
      const g = r.querySelector('.role__gate'), gt = g.querySelector('.gate'), wh = g.querySelector('.role__when');
      // the gate is an svg (no offset*), and scaled until revealed: size it from its css width
      const y0 = r.offsetTop + g.offsetTop + parseFloat(getComputedStyle(g).paddingTop), gw = parseFloat(getComputedStyle(gt).width);
      return { foot: y0 + gw * 0.92, top: y0, gw, label: wh ? { y: r.offsetTop + g.offsetTop + wh.offsetTop, h: wh.offsetHeight, w: wh.offsetWidth } : null };
    });
    return { gates, narrow };
  }

  // Catmull-Rom through the control points, sampled finely
  function spline(pts, step = 2) {
    const out = [];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
      const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / step));
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        out.push([0, 1].map(j => 0.5 * ((2 * p1[j]) + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
      }
    }
    out.push(pts[pts.length - 1]);
    return out;
  }

  function blob(x, y, rx, ry, r, n = 8, rot = 0) {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = (i % n) / n * Math.PI * 2, k = 0.82 + r() * 0.3;
      const px = Math.cos(a) * rx * k, py = Math.sin(a) * ry * k;
      const X = x + px * Math.cos(rot) - py * Math.sin(rot), Y = y + px * Math.sin(rot) + py * Math.cos(rot);
      i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
    }
    ctx.closePath();
  }

  function stone(x, y, s, r, look) {
    const rx = (9 + r() * 4.5) * s, ry = rx * (0.42 + r() * 0.12), rot = (r() - 0.5) * 0.35;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; blob(x + 1, y + 2, rx, ry, r, 9, rot); ctx.fill();
    const g = ctx.createLinearGradient(x, y - ry, x, y + ry);
    g.addColorStop(0, '#4a4852'); g.addColorStop(1, '#2a2930');
    ctx.fillStyle = g; blob(x, y, rx, ry, r, 9, rot); ctx.fill();
    ctx.strokeStyle = 'rgba(236,228,210,0.13)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.ellipse(x, y - ry * 0.2, rx * 0.8, ry * 0.7, rot, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke();
    if (look.snow) { ctx.fillStyle = 'rgba(240,244,250,0.38)'; blob(x - rx * 0.05, y - ry * 0.25, rx * 0.7, ry * 0.5, r, 7, rot); ctx.fill(); }
    // moss in the seams
    ctx.fillStyle = A(look.moss, 0.5);
    for (let i = 0; i < 3; i++) { const a = r() * Math.PI * 2; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * rx, y + Math.sin(a) * ry + 1, 2.2 * s, 1.1 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  }

  function rock(x, y, s, r, look) {
    const rx = (7 + r() * 9) * s, ry = rx * (0.6 + r() * 0.25);
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.beginPath(); ctx.ellipse(x + 2, y + ry * 0.35, rx * 1.1, ry * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createLinearGradient(x - rx, y - ry, x + rx * 0.6, y + ry * 0.4);
    g.addColorStop(0, '#55535e'); g.addColorStop(0.55, '#302f38'); g.addColorStop(1, '#1c1b22');
    ctx.fillStyle = g; ctx.beginPath();
    const n = 7, pts = [];
    for (let i = 0; i < n; i++) { const a = Math.PI + (i / (n - 1)) * Math.PI, k = 0.75 + r() * 0.35; pts.push([x + Math.cos(a) * rx * k, y + Math.sin(a) * ry * k]); }
    ctx.moveTo(x - rx, y + ry * 0.3); pts.forEach(p => ctx.lineTo(p[0], p[1])); ctx.lineTo(x + rx, y + ry * 0.3); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(236,228,210,0.12)'; ctx.lineWidth = 0.8; ctx.beginPath(); pts.slice(1, 4).forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.stroke();
    if (look.snow) { ctx.fillStyle = 'rgba(240,244,250,0.7)'; ctx.beginPath(); ctx.moveTo(pts[1][0], pts[1][1] + 1); pts.slice(1, 6).forEach(p => ctx.lineTo(p[0], p[1] - 0.5)); ctx.quadraticCurveTo(x, y - ry * 0.35, pts[1][0], pts[1][1] + 1); ctx.fill(); }
    else if (r() < 0.6) { ctx.fillStyle = A(look.moss, 0.55); blob(x - rx * 0.2, y - ry * 0.55, rx * 0.45, ry * 0.22, r, 7); ctx.fill(); }
  }

  function grass(x, y, s, r, look) {
    const n = 5 + (r() * 5 | 0);
    ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
      const lean = (r() - 0.5) * 1.3, len = (9 + r() * 12) * s;
      ctx.strokeStyle = A(mix(look.leaf, '#9aa07a', r() * 0.25), 0.8); ctx.lineWidth = 1.1 * s;
      ctx.beginPath(); ctx.moveTo(x + (r() - 0.5) * 5 * s, y);
      ctx.quadraticCurveTo(x + lean * len * 0.3, y - len * 0.6, x + lean * len * 0.75, y - len); ctx.stroke();
    }
    if (look.snow) { ctx.fillStyle = 'rgba(240,244,250,0.5)'; ctx.beginPath(); ctx.ellipse(x, y, 7 * s, 2 * s, 0, 0, Math.PI * 2); ctx.fill(); }
  }

  function fern(x, y, s, r, look, dir) {
    const fronds = 3 + (r() * 2 | 0);
    for (let f = 0; f < fronds; f++) {
      const a0 = -Math.PI / 2 + (f - (fronds - 1) / 2) * 0.55 + dir * 0.15, len = (16 + r() * 10) * s;
      ctx.strokeStyle = A(look.leaf, 0.8); ctx.lineWidth = 0.9 * s;
      let px = x, py = y, a = a0;
      ctx.beginPath(); ctx.moveTo(px, py);
      const seg = [];
      for (let k = 0; k < 8; k++) { a += 0.07 * Math.sign(a0 + Math.PI / 2 || dir); px += Math.cos(a) * len / 8; py += Math.sin(a) * len / 8; ctx.lineTo(px, py); seg.push([px, py, a]); }
      ctx.stroke();
      ctx.fillStyle = A(look.leaf, 0.7);
      seg.forEach(([qx, qy, qa], k) => {
        const l = (1 - k / 8) * 4.5 * s + 1;
        [-1, 1].forEach(sd => { ctx.beginPath(); ctx.ellipse(qx + Math.cos(qa + sd * 1.3) * l * 0.6, qy + Math.sin(qa + sd * 1.3) * l * 0.6, l * 0.6, l * 0.22, qa + sd * 1.3, 0, Math.PI * 2); ctx.fill(); });
      });
    }
  }

  function shrub(x, y, s, r, look, season) {
    const rw = (13 + r() * 9) * s, rh = rw * 0.62;
    ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.ellipse(x + 2, y + 1, rw * 1.05, rh * 0.3, 0, 0, Math.PI * 2); ctx.fill();
    const base = season === 'autumn' ? mix(look.leaf, '#6a3424', 0.3) : look.leaf;
    for (let i = 0; i < 16; i++) {
      const a = Math.PI + r() * Math.PI, d = r() * 0.8;
      const bx = x + Math.cos(a) * rw * d, by = y - rh * 0.4 + Math.sin(a) * rh * d * 0.85, br = (3.4 + r() * 3.4) * s;
      const g = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.4, 0, bx, by, br);
      g.addColorStop(0, mix(base, '#c8c8a0', 0.12)); g.addColorStop(1, mix(base, '#0e0d0f', 0.55));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill();
    }
    if (look.snow) { ctx.fillStyle = 'rgba(240,244,250,0.75)'; blob(x - rw * 0.1, y - rh * 0.95, rw * 0.7, rh * 0.25, r, 8); ctx.fill(); return; }
    if (season === 'summer') return;
    const fl = look.bloom, k = season === 'autumn' ? 14 : 8;
    for (let i = 0; i < k; i++) {
      const a = Math.PI + 0.2 + r() * (Math.PI - 0.4), d = 0.3 + r() * 0.65;
      ctx.fillStyle = A(fl[(r() * fl.length) | 0], 0.85);
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * rw * d, y - rh * 0.45 + Math.sin(a) * rh * d, (1.1 + r() * 1) * s, 0, Math.PI * 2); ctx.fill();
    }
  }

  // fallen leaves, petals or a patch of snow on the ground
  function litter(x, y, s, r, look, season) {
    if (season === 'winter') { ctx.fillStyle = 'rgba(236,240,248,0.16)'; blob(x, y, (10 + r() * 12) * s, (3 + r() * 3) * s, r, 9); ctx.fill(); return; }
    ctx.fillStyle = A(look.bloom[(r() * look.bloom.length) | 0], 0.7);
    ctx.save(); ctx.translate(x, y); ctx.rotate(r() * Math.PI);
    if (season === 'autumn') { ctx.beginPath(); for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + i * 0.6 - 1.2; ctx.lineTo(Math.cos(a) * 3.4 * s, Math.sin(a) * 3.4 * s); ctx.lineTo(Math.cos(a + 0.3) * 1.3 * s, Math.sin(a + 0.3) * 1.3 * s); } ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.ellipse(0, 0, 2 * s, 1.1 * s, 0, 0, Math.PI * 2); ctx.fill(); }
    ctx.restore();
  }

  function paint() {
    const lay = layout();
    if (!lay || !H) return;
    const { gates, narrow } = lay, s = narrow ? 0.72 : 1;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    Object.assign(cv.style, { left: `${L}px`, width: `${W}px`, height: `${H}px` });
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, -L * dpr, 0);
    ctx.clearRect(L, 0, W, H);
    const season = window.SEASON ? window.SEASON.get() : 'autumn', look = LOOK[season] || LOOK.autumn;

    // the line: through each gate, swinging out to alternate sides between them
    const swingL = narrow ? 30 : 74, swingR = narrow ? 26 : 46;
    const pts = [[cx, 0]];
    gates.forEach((g, i) => {
      pts.push([cx, g.top + (g.foot - g.top) * 0.55]);
      pts.push([cx, g.foot + 6]);
      const next = gates[i + 1] ? gates[i + 1].top : H;
      const side = i % 2 ? 1 : -1;
      pts.push([cx + side * (side < 0 ? swingL : swingR), (g.foot + next) / 2 + 10]);
    });
    pts.push([cx, H]);
    const path = spline(pts);

    // keep the stones off the labels under each gate
    const clear = gates.filter(g => g.label).map(g => ({ y0: g.label.y - 4, y1: g.label.y + g.label.h + 4, x0: cx - g.label.w / 2 - 6, x1: cx + g.label.w / 2 + 6 }));
    const inGate = (x, y) => gates.some(g => y > g.top && y < g.foot + 2 && Math.abs(x - cx) < g.gw * 0.32);
    const blocked = (x, y) => clear.some(c => y > c.y0 && y < c.y1 && x > c.x0 && x < c.x1);

    const r = rng(7 + gates.length * 13);
    const nearGate = y => gates.some(g => y > g.top - 8 && y < g.foot + 26);
    // the text starts just right of the canvas: tall things stay further left
    const maxX = (tall) => cx + (narrow ? (tall ? 30 : 40) : (tall ? 52 : 66));

    // the bed: packed earth and gravel under the stones, mossy at the edges
    ctx.save();
    ctx.filter = `blur(${narrow ? 4 : 6}px)`;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(236,228,210,0.04)'; ctx.lineWidth = (narrow ? 24 : 36);
    ctx.beginPath(); path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    ctx.fillStyle = A(look.moss, look.snow ? 0.1 : 0.2);
    for (let i = 0; i < path.length; i += 7) {
      const [x, y] = path[i];
      [-1, 1].forEach(sd => { if (r() < 0.75) { ctx.beginPath(); ctx.ellipse(x + sd * (narrow ? 13 : 19) * (0.9 + r() * 0.4), y, (6 + r() * 8) * s, (3 + r() * 4) * s, 0, 0, Math.PI * 2); ctx.fill(); } });
    }
    ctx.restore();
    for (let i = 0; i < path.length; i += 2) {
      const [x, y] = path[i];
      if (blocked(x, y)) continue;
      ctx.fillStyle = `rgba(236,228,210,${0.05 + r() * 0.08})`;
      ctx.fillRect(x + (r() - 0.5) * (narrow ? 18 : 28), y + (r() - 0.5) * 3, 0.9, 0.9);
    }

    // planting along both sides, more on the outside of each bend
    let acc = 0;
    const props = [];
    const add = (x, y, kind, extra = {}) => {
      const tall = kind === 'shrub' || kind === 'fern';
      x = Math.max(L + 12, Math.min(maxX(tall), x));
      if (!blocked(x, y) && !nearGate(y)) props.push({ x, y, kind, seed: (r() * 1e6 | 0) + 1, dir: Math.sign(x - cx) || 1, ...extra });
    };
    for (let i = 1; i < path.length; i++) {
      const [x, y] = path[i], [px, py] = path[i - 1];
      acc += Math.hypot(x - px, y - py);
      if (acc < (narrow ? 26 : 22)) continue;
      acc = 0;
      const out = Math.sign(x - cx) || (r() < 0.5 ? -1 : 1), sd = r() < 0.7 ? out : -out;
      const off = (narrow ? 15 : 24) + r() * (narrow ? 12 : 30);
      const roll = r();
      if (r() < 0.85) add(x + sd * off, y + (r() - 0.5) * 16, roll < 0.2 ? 'rock' : roll < 0.55 ? 'grass' : roll < 0.75 ? 'fern' : 'shrub');
      if (r() < look.litter) for (let k = 0; k < 3; k++) { const lx = x + (r() - 0.5) * 60, ly = y + (r() - 0.5) * 30; if (!blocked(lx, ly)) props.push({ x: lx, y: ly, kind: 'litter', seed: (r() * 1e6 | 0) + 1, low: 1 }); }
    }
    // a planted corner at each bend: a shrub, a rock behind it, a fern and grass
    pts.forEach(([bx, by], i) => {
      if (Math.abs(bx - cx) < 5 || i === pts.length - 1) return;
      const left = bx < cx, o = left ? -1 : 1;
      if (left) {
        add(bx - (narrow ? 26 : 44), by - 18, 'rock', { big: 1 });
        add(bx - (narrow ? 20 : 34), by + 4, 'shrub');
        add(bx - (narrow ? 10 : 18), by + 26, 'fern');
        add(bx - (narrow ? 30 : 52), by + 30, 'grass');
      } else {
        // on the right the text is close, so the corner planting sits inside the bend
        add(bx - (narrow ? 26 : 40), by - 6, 'shrub');
        add(bx - (narrow ? 34 : 56), by + 18, 'rock');
        add(bx + o * 18, by + 16, 'grass');
      }
    });
    props.filter(p => p.low).forEach(p => { if (!blocked(p.x, p.y)) litter(p.x, p.y, s, rng(p.seed), look, season); });
    // the stones
    acc = 999;
    for (let i = 1; i < path.length; i++) {
      const [x, y] = path[i], [px, py] = path[i - 1];
      acc += Math.hypot(x - px, y - py);
      if (acc < (narrow ? 21 : 29)) continue;
      acc = 0;
      if (blocked(x, y) || inGate(x, y)) continue;
      const rr = rng((x * 31 + y * 17) | 0 || 1);
      stone(x + (rr() - 0.5) * 4, y, s * (0.9 + rr() * 0.25), rr, look);
    }
    props.filter(p => !p.low).sort((a, b) => a.y - b.y).forEach(p => {
      const pr = rng(p.seed);
      if (p.kind === 'rock') rock(p.x, p.y, s * (p.big ? 1.6 : 1), pr, look);
      else if (p.kind === 'grass') grass(p.x, p.y, s, pr, look);
      else if (p.kind === 'fern') fern(p.x, p.y, s, pr, look, p.dir);
      else shrub(p.x, p.y, s, pr, look, season);
    });
    reveal();
  }

  // walk the path into view: it is drawn down to a little below the bottom of the screen
  function reveal() {
    if (reduce) { cv.style.setProperty('--p', `${H + 200}px`); return; }
    const t = tl.getBoundingClientRect().top;
    cv.style.setProperty('--p', `${Math.max(0, Math.min(H + 200, innerHeight - t - 60))}px`);
  }
  let ticking = false;
  addEventListener('scroll', () => { if (ticking) return; ticking = true; requestAnimationFrame(() => { ticking = false; reveal(); }); }, { passive: true });

  let rt = 0;
  const later = () => { clearTimeout(rt); rt = setTimeout(paint, 120); };
  new ResizeObserver(later).observe(tl);
  window.SEASON && window.SEASON.on(() => paint());
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(paint);
  paint();
})();
