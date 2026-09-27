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

  /* ---------------- particle portrait ---------------- */
  // Carried over from the old site: every pixel is a small square particle.
  // They fly in from random positions, spring back to their spot, and the
  // cursor pushes them away. Moving particles glow green; the loop sleeps
  // once everything has settled.
  (function portrait() {
    const canvas = $('#ascii');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.src = './assets/images/portrait.jpg';

    let P = [], w = 0, h = 0, dpr = 1, cell = 2.2;
    let raf = 0, visible = true, started = 0, time = 0, last = 0;
    const mouse = { x: -9999, y: -9999, r: 58 };

    function build() {
      const rect = canvas.getBoundingClientRect();
      w = rect.width; h = rect.height;
      if (!w || !h) return false;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      cell = w < 260 ? 3 : 2.2;
      const cols = Math.round(w / cell), rows = Math.round(h / cell);
      const off = document.createElement('canvas');
      off.width = cols; off.height = rows;
      const o = off.getContext('2d', { willReadFrequently: true });
      const k = img.width / 1123; // framing tuned on the 1123px original
      o.drawImage(img, 170 * k, 80 * k, 800 * k, 1000 * k, 0, 0, cols, rows);
      let d;
      try { d = o.getImageData(0, 0, cols, rows).data; } catch (_) { return false; }

      // contrast-stretch luminance, then map onto the site's neutral ramp
      const L = new Float32Array(cols * rows), hist = [];
      for (let i = 0; i < L.length; i++) { L[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255; if (i % 5 === 0) hist.push(L[i]); }
      hist.sort((a, b) => a - b);
      const lo = hist[(hist.length * 0.02) | 0], hi = hist[(hist.length * 0.995) | 0];

      const fresh = !P.length;
      P = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const t = Math.pow(Math.min(1, Math.max(0, (L[y * cols + x] - lo) / (hi - lo))), 1.15);
        let r, g, b;
        if (t < 0.6) { const u = t / 0.6; r = 7 + 83 * u; g = 9 + 111 * u; b = 9 + 89 * u; }
        else { const u = (t - 0.6) / 0.4; r = 90 + 146 * u; g = 120 + 124 * u; b = 98 + 138 * u; }
        const ox = (x + 0.5) * cell, oy = (y + 0.5) * cell;
        P.push({
          ox, oy,
          x: fresh && !reduce ? Math.random() * w : ox,
          y: fresh && !reduce ? Math.random() * h : oy,
          vx: 0, vy: 0, seed: Math.random() * 100, t,
          c: `rgb(${r | 0},${g | 0},${b | 0})`,
        });
      }
      return true;
    }

    function frame(now) {
      raf = 0;
      if (!visible || document.hidden) return;
      const dt = Math.min(now - (last || now), 50) / 1000;
      last = now;
      const f = dt * 60; // 1.0 at 60 fps
      time += dt * 3;
      const progress = Math.min(1, (now - started) / 2000); // 2s formation
      const forming = progress < 1;
      const fr = Math.pow(forming ? 0.92 : 0.85, f);
      const size = cell * 0.95;
      let energy = 0;

      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < P.length; i++) {
        const p = P[i];
        const dx = mouse.x - p.x, dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < mouse.r && dist > 0.01) {
          const force = (mouse.r - dist) / mouse.r;
          p.vx -= (dx / dist) * force * 2.6 * f;
          p.vy -= (dy / dist) * force * 2.6 * f;
        }
        if (forming) {
          p.vx += Math.sin(time + p.seed) * 0.2 * (1 - progress) * f;
          p.vy += Math.cos(time + p.seed * 1.5) * 0.2 * (1 - progress) * f;
          const spring = 0.08 * progress * progress;
          p.vx += (p.ox - p.x) * spring * f;
          p.vy += (p.oy - p.y) * spring * f;
        } else {
          p.vx += (p.ox - p.x) * 0.08 * f;
          p.vy += (p.oy - p.y) * 0.08 * f;
        }
        p.vx *= fr; p.vy *= fr;
        p.x += p.vx * f; p.y += p.vy * f;

        const speed = Math.abs(p.vx) + Math.abs(p.vy);
        energy += speed + Math.abs(p.ox - p.x) + Math.abs(p.oy - p.y);
        // moving particles pick up the signal colour
        ctx.fillStyle = speed > 1.1 && !forming ? `rgba(88,242,155,${Math.min(0.9, 0.2 + speed * 0.12)})` : p.c;
        ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
      }

      // sleep once settled and the cursor is away; wake on pointer move
      if (!forming && mouse.x < -999 && energy / P.length < 0.004) return;
      raf = requestAnimationFrame(frame);
    }
    const wake = () => { if (!raf && P.length && visible && !reduce) { last = 0; raf = requestAnimationFrame(frame); } };

    const box = canvas.parentElement;
    box.addEventListener('pointermove', e => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
      wake();
    });
    box.addEventListener('pointerleave', () => { mouse.x = mouse.y = -9999; });

    const drawStatic = () => {
      const size = cell * 0.95;
      ctx.clearRect(0, 0, w, h);
      P.forEach(p => { ctx.fillStyle = p.c; ctx.fillRect(p.ox - size / 2, p.oy - size / 2, size, size); });
    };
    const go = () => {
      if (!build()) return;
      if (reduce) { drawStatic(); return; }
      new IntersectionObserver(([en]) => {
        visible = en.isIntersecting;
        if (visible && !started) started = performance.now();
        if (visible) wake();
      }).observe(canvas);
    };
    let rt;
    window.addEventListener('resize', () => {
      clearTimeout(rt);
      rt = setTimeout(() => { if (build()) { if (reduce) drawStatic(); else wake(); } }, 150);
    });
    img.onload = go;
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
