/* Page behaviour: nav, reveals, headline decode, ASCII portrait,
   live GitHub numbers, the KV-cache simulator and small niceties. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const GLYPHS = '01アイウエオカキクケコサシスセソ<>/{}=+*#λΣ∂∇';
  const rand = a => a[(Math.random() * a.length) | 0];

  /* ---------------- nav ---------------- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 16);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  const toggle = $('.nav__toggle');
  const menu = $('#mobile-menu');
  const setMenu = open => {
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    menu.hidden = !open;
    nav.classList.toggle('is-open', open);
  };
  toggle.addEventListener('click', () => setMenu(menu.hidden));
  $$('a', menu).forEach(a => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) setMenu(false); });

  // Highlight the section in view
  const links = $$('.nav__links a');
  const byId = Object.fromEntries(links.map(a => [a.hash.slice(1), a]));
  const spy = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      links.forEach(l => l.classList.remove('is-active'));
      if (byId[en.target.id]) byId[en.target.id].classList.add('is-active');
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  ['top', ...Object.keys(byId)].forEach(id => { const el = document.getElementById(id); if (el) spy.observe(el); });

  /* ---------------- reveal + axon pulses ---------------- */
  const revealer = new IntersectionObserver(entries => {
    entries.forEach(en => {
      if (!en.isIntersecting) return;
      en.target.classList.add('is-in');
      revealer.unobserve(en.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  $$('[data-reveal], .feature__viz').forEach(el => revealer.observe(el));

  const lit = new IntersectionObserver(entries => {
    entries.forEach(en => en.target.classList.toggle('is-lit', en.isIntersecting));
  }, { rootMargin: '0px 0px -30% 0px' });
  $$('.section').forEach(el => lit.observe(el));

  /* ---------------- headline decode ---------------- */
  // Each line resolves left to right out of random glyphs, like a model sampling.
  function decode(el, delay) {
    const text = el.textContent;
    if (reduce) return;
    el.setAttribute('aria-label', text);
    const chars = [...text];
    const start = performance.now() + delay;
    const per = 38;
    const tick = now => {
      const t = now - start;
      if (t < 0) { requestAnimationFrame(tick); return; }
      const done = Math.floor(t / per);
      el.innerHTML = chars.map((c, i) => {
        if (c === ' ' || i < done) return c === ' ' ? ' ' : c;
        if (i < done + 6) return `<span class="x">${rand(GLYPHS)}</span>`;
        return `<span class="x" style="opacity:0">${c}</span>`;
      }).join('');
      if (done < chars.length) requestAnimationFrame(tick);
      else el.textContent = text;
    };
    requestAnimationFrame(tick);
  }
  let acc = 150;
  $$('[data-decode]').forEach(el => { decode(el, acc); acc += el.textContent.length * 20; });

  /* ---------------- phosphor portrait ---------------- */
  // The photo is mapped onto a green CRT ramp, glyphs flicker over the bright
  // regions, a scan line sweeps down, and the cursor decodes a ring of glyphs.
  (function portrait() {
    const canvas = $('#ascii');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const PX = 2;           // css px per luminance sample
    const CELL = 10;        // glyph cell size
    const img = new Image();
    img.src = './assets/images/portrait.jpg';
    let base = null, lum = null, w = 0, h = 0, gw = 0, gh = 0, running = false, visible = true, scan = -40;
    let pointer = { x: -1, y: -1 };

    function build() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      if (!w || !h) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // phosphor duotone of the photo, rendered once at device resolution
      const bc = document.createElement('canvas');
      bc.width = canvas.width; bc.height = canvas.height;
      const b = bc.getContext('2d', { willReadFrequently: true });
      const k = img.width / 1123; // framing tuned on the 1123px original
      const sx = 170 * k, sy = 80 * k, sw = 800 * k, sh = 1000 * k;
      b.drawImage(img, sx, sy, sw, sh, 0, 0, bc.width, bc.height);
      let px;
      try { px = b.getImageData(0, 0, bc.width, bc.height); } catch (_) { return false; }
      const d = px.data, n = d.length / 4;
      const L = new Float32Array(n), hist = [];
      for (let i = 0; i < n; i++) { const v = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255; L[i] = v; if (i % 13 === 0) hist.push(v); }
      hist.sort((a, c) => a - c);
      const lo = hist[(hist.length * 0.02) | 0], hi = hist[(hist.length * 0.995) | 0];
      for (let i = 0; i < n; i++) {
        const t = Math.pow(Math.min(1, Math.max(0, (L[i] - lo) / (hi - lo))), 1.15);
        let r, g, bl;
        // near-neutral ramp with a faint green cast, so the photo stays the photo
        if (t < 0.6) { const u = t / 0.6; r = 7 + 83 * u; g = 9 + 111 * u; bl = 9 + 89 * u; }
        else { const u = (t - 0.6) / 0.4; r = 90 + 146 * u; g = 120 + 124 * u; bl = 98 + 138 * u; }
        d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = bl; d[i * 4 + 3] = 255;
      }
      b.putImageData(px, 0, 0);
      base = bc;
      // coarse luminance grid for glyph placement
      gw = Math.ceil(w / PX); gh = Math.ceil(h / PX);
      lum = new Float32Array(gw * gh);
      for (let y = 0; y < gh; y++) for (let x = 0; x < gw; x++) {
        const i = Math.min(bc.height - 1, Math.round(y * PX * dpr)) * bc.width + Math.min(bc.width - 1, Math.round(x * PX * dpr));
        lum[y * gw + x] = Math.min(1, Math.max(0, (L[i] - lo) / (hi - lo)));
      }
      ctx.font = `500 9px 'JetBrains Mono', ui-monospace, monospace`;
      ctx.textBaseline = 'top';
      return true;
    }

    const lumAt = (x, y) => lum[Math.min(gh - 1, (y / PX) | 0) * gw + Math.min(gw - 1, (x / PX) | 0)] || 0;

    function draw() {
      if (!base) return;
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(base, 0, 0, w, h);
      // flickering glyph cells, weighted toward bright regions
      for (let k = 0; k < 8; k++) {
        const x = ((Math.random() * w) / CELL | 0) * CELL, y = ((Math.random() * h) / CELL | 0) * CELL;
        if (lumAt(x, y) < 0.35) continue;
        ctx.fillStyle = '#040806'; ctx.fillRect(x, y, CELL, CELL);
        ctx.fillStyle = 'rgba(88, 242, 155, 0.9)'; ctx.fillText(rand(GLYPHS), x + 2, y + 1);
      }
      // scan line
      ctx.fillStyle = 'rgba(88, 242, 155, 0.05)'; ctx.fillRect(0, scan - 24, w, 24);
      ctx.fillStyle = 'rgba(88, 242, 155, 0.25)'; ctx.fillRect(0, scan, w, 1);
      // cursor ring decodes into glyphs
      if (pointer.x >= 0) {
        for (let y = Math.max(0, pointer.y - 60); y < Math.min(h, pointer.y + 60); y += CELL) {
          for (let x = Math.max(0, pointer.x - 60); x < Math.min(w, pointer.x + 60); x += CELL) {
            const gx = (x / CELL | 0) * CELL, gy = (y / CELL | 0) * CELL;
            const dd = Math.hypot(gx - pointer.x, gy - pointer.y);
            if (dd > 56) continue;
            ctx.fillStyle = 'rgba(4, 8, 6, 0.88)'; ctx.fillRect(gx, gy, CELL, CELL);
            const v = lumAt(gx, gy);
            ctx.fillStyle = `rgba(88, 242, 155, ${0.25 + v * 0.75})`;
            ctx.fillText(v > 0.12 ? rand(GLYPHS) : '·', gx + 2, gy + 1);
          }
        }
      }
    }

    function loop() {
      if (!visible || document.hidden) { running = false; return; }
      running = true;
      scan = scan > h + 40 ? -40 : scan + 3;
      draw();
      setTimeout(() => requestAnimationFrame(loop), 60);
    }

    const box = canvas.parentElement;
    box.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); pointer = { x: e.clientX - r.left, y: e.clientY - r.top }; });
    box.addEventListener('pointerleave', () => { pointer = { x: -1, y: -1 }; });
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !running && base && !reduce) loop(); }).observe(canvas);
    let rt;
    window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (build()) draw(); }, 150); });
    const go = () => { if (!build()) return; draw(); if (!reduce) loop(); };
    img.onload = () => (document.fonts ? document.fonts.ready.then(go) : go());
  })();

  /* ---------------- train/loss sparkline ---------------- */
  (function loss() {
    const path = $('#loss-path'), val = $('#loss-val');
    if (!path) return;
    const N = 40, pts = [];
    let step = 0;
    const next = () => {
      step++;
      const base = 2.4 * Math.exp(-step / 60) + 0.12;
      return base + (Math.random() - 0.5) * base * 0.35;
    };
    for (let i = 0; i < N; i++) pts.push(next());
    const render = () => {
      const max = Math.max(...pts), min = Math.min(...pts);
      path.setAttribute('d', pts.map((v, i) => `${i ? 'L' : 'M'}${(i / (N - 1)) * 80} ${18 - ((v - min) / (max - min || 1)) * 16}`).join(''));
      val.textContent = pts[N - 1].toFixed(3);
    };
    render();
    if (reduce) return;
    setInterval(() => {
      if (document.hidden) return;
      pts.shift(); pts.push(next());
      if (step > 420) step = 0; // start a new "run"
      render();
    }, 600);
  })();

  /* ---------------- live GitHub numbers ---------------- */
  async function repoStats(repo) {
    const key = `gh:${repo}`;
    try {
      const hit = JSON.parse(sessionStorage.getItem(key) || 'null');
      if (hit && Date.now() - hit.t < 30 * 60 * 1000) return hit;
    } catch (_) { /* storage unavailable */ }
    const res = await fetch(`https://api.github.com/repos/TryingtobeingNikhil/${repo}`, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(String(res.status));
    const j = await res.json();
    const out = { stars: j.stargazers_count, forks: j.forks_count, t: Date.now() };
    try { sessionStorage.setItem(key, JSON.stringify(out)); } catch (_) {}
    return out;
  }
  new Set($$('[data-stars],[data-forks]').map(el => el.dataset.stars || el.dataset.forks)).forEach(repo => {
    repoStats(repo).then(({ stars, forks }) => {
      $$(`[data-stars="${repo}"]`).forEach(el => { el.textContent = stars.toLocaleString('en-US'); });
      $$(`[data-forks="${repo}"]`).forEach(el => { el.textContent = forks.toLocaleString('en-US'); });
    }).catch(() => { /* keep the static numbers */ });
  });

  /* ---------------- KV cache simulator ---------------- */
  (function kvSim() {
    const grid = $('#kv-grid');
    if (!grid) return;
    const POOL = 64, BLOCK = 16, MAX_RUN = 4;
    const cells = Array.from({ length: POOL }, () => {
      const d = document.createElement('div');
      d.className = 'kv-cell';
      grid.appendChild(d);
      return d;
    });
    const out = k => $(`[data-k="${k}"]`);
    const S = { run: out('run'), used: out('used'), swap: out('swap') };

    const owner = new Array(POOL).fill(-1);
    let seqs = [], swapped = [], nextId = 1, stepN = 0;
    const slots = [0, 1, 2, 3];
    const freeBlocks = () => owner.flatMap((o, i) => (o === -1 ? [i] : []));
    const need = s => Math.ceil(s.tokens / BLOCK);
    const flash = (i, cls) => { cells[i].classList.add(cls); setTimeout(() => cells[i].classList.remove(cls), 700); };

    function alloc(s, n) {
      const f = freeBlocks();
      if (f.length < n) return false;
      for (let k = 0; k < n; k++) {
        const i = f.splice((Math.random() * f.length) | 0, 1)[0]; // non-contiguous on purpose
        owner[i] = s.id; s.blocks.push(i);
        cells[i].dataset.s = s.slot;
        flash(i, 'is-new');
      }
      return true;
    }
    function release(s, cls) {
      s.blocks.forEach(i => { owner[i] = -1; delete cells[i].dataset.s; flash(i, cls); });
      s.blocks = [];
    }
    function retire(s) {
      seqs = seqs.filter(x => x !== s);
      slots.push(s.slot); slots.sort();
    }

    function admit() {
      if (!slots.length) return;
      if (swapped.length) {
        const s = swapped[0];
        s.slot = slots[0];
        if (alloc(s, need(s))) { swapped.shift(); slots.shift(); seqs.push(s); }
        return;
      }
      if (seqs.length >= MAX_RUN) return;
      const prompt = 16 + ((Math.random() * 64) | 0);
      const s = { id: nextId++, slot: slots[0], tokens: prompt, target: prompt + 90 + ((Math.random() * 260) | 0), blocks: [], age: stepN };
      if (alloc(s, need(s))) { slots.shift(); seqs.push(s); }
    }

    function tick() {
      stepN++;
      admit();
      for (const s of [...seqs]) {
        if (!seqs.includes(s)) continue;
        s.tokens += 6 + ((Math.random() * 6) | 0);
        if (s.tokens >= s.target) { release(s, 'is-freed'); retire(s); continue; }
        const more = need(s) - s.blocks.length;
        if (more > 0 && !alloc(s, more)) {
          // memory pressure: preempt the youngest sequence to the CPU pool
          const victim = seqs.reduce((a, b) => (b.age > a.age ? b : a));
          release(victim, 'is-swapped');
          retire(victim);
          swapped.push(victim);
          if (victim !== s) alloc(s, more);
        }
      }
      S.run.textContent = seqs.length;
      S.used.textContent = String(owner.filter(o => o !== -1).length).padStart(2, '0');
      S.swap.textContent = swapped.length;
    }

    let timer = 0;
    const run = on => {
      if (on && !timer) timer = setInterval(tick, reduce ? 1400 : 420);
      if (!on && timer) { clearInterval(timer); timer = 0; }
    };
    for (let i = 0; i < 18; i++) tick();
    new IntersectionObserver(([en]) => run(en.isIntersecting && !document.hidden)).observe(grid);
    document.addEventListener('visibilitychange', () => { if (document.hidden) run(false); });
  })();

  /* ---------------- copy email ---------------- */
  const copy = $('#copy-email');
  if (copy) copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(copy.dataset.email);
    } catch (_) {
      window.location.href = `mailto:${copy.dataset.email}`;
      return;
    }
    copy.textContent = 'Copied ✓';
    copy.classList.add('is-copied');
    setTimeout(() => { copy.textContent = 'Copy email'; copy.classList.remove('is-copied'); }, 1800);
  });

  /* ---------------- IST clock ---------------- */
  const clocks = $$('[data-clock]');
  if (clocks.length) {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
    const t = () => { const v = f.format(new Date()); clocks.forEach(c => { c.textContent = v; }); };
    t(); setInterval(t, 15000);
  }
})();
