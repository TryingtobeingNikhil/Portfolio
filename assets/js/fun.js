/* The playful layer: the precision slider on the woodblock portrait,
   the temperature dial on About, the reading meter in the nav (tokens decoded,
   chapters in your KV cache), a 429 for over-eager email copiers, a backtick
   terminal, Konami debug mode, the GridWorld agent in Contact and the Lab
   tokenizer. Everything degrades to plain content without JS. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (_) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } },
  };

  /* ---------------- toast: one quiet line at the bottom ---------------- */
  let toastEl, toastT;
  const toast = (msg, ms = 2600) => {
    if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); document.body.appendChild(toastEl); }
    toastEl.innerHTML = msg;
    toastEl.classList.add('is-on');
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('is-on'), ms);
  };

  /* ---------------- precision slider on the portrait ---------------- */
  (function quantize() {
    const range = $('[data-quant-range]');
    if (!range) return;
    const STEPS = [
      [32, 'FP32', 'full precision'],
      [16, 'FP16', 'half the bits, nobody can tell'],
      [8, 'INT8', 'still me'],
      [4, 'INT4', 'sixteen blocks to carve'],
      [2, 'INT2', 'four blocks. Hokusai would allow it'],
      [1, 'INT1', 'one block of sumi. still me. probably.'],
    ];
    const kb = bytes => (bytes >= 1024 * 1024 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(0.1, bytes / 1024).toFixed(bytes < 10240 ? 1 : 0)} KB`);
    const label = $('[data-quant-label]'), note = $('[data-quant-note]');
    const set = i => {
      const [bits, name, line] = STEPS[i];
      const px = window.PORTRAIT ? window.PORTRAIT.pixels() : 0;
      label.textContent = name;
      note.textContent = px ? `${line} · ${kb((px * bits) / 8)}` : line;
      range.setAttribute('aria-valuetext', `${name}, ${line}`);
      if (window.PORTRAIT) window.PORTRAIT.quantize(bits);
    };
    range.addEventListener('input', () => set(+range.value));
    // show the memory figure once the portrait has been built
    setTimeout(() => set(+range.value), 1200);
    window.QUANT = name => { const i = STEPS.findIndex(s => s[1].toLowerCase() === String(name).toLowerCase()); if (i < 0) return false; range.value = i; set(i); return true; };
  })();

  /* ---------------- temperature dial on About ---------------- */
  (function temperature() {
    const opts = $$('.temp [data-t]'), ps = $$('[data-temp-p]');
    if (!opts.length || ps.length !== 3) return;
    const V = [
      [
        'ML engineer focused on LLM inference and multi-agent systems.',
        'Built PageServe, a vLLM-style inference engine with continuous batching and a paged KV cache, and RLForge, a dependency-free C++20 reinforcement-learning library with its own autograd. Each system is documented in a public article series.',
        'Student at BIT Mesra. Codeforces Specialist (1400+). Founder of DevPath. Open to ML engineering roles in inference, serving and agent infrastructure.',
      ],
      ps.map(p => p.innerHTML),
      [
        'Retrieval scores over vibes. Pruned weights over hoarding. Shipped code over a screenshot of a loss curve that only went down because of a bug.',
        "I don't call <code>generate()</code>. I write it, then the scheduler under it, then the autograd under that, then an article about how it all broke, and then it breaks again in a new and educational way. Apparently this is a personality now.",
        'BIT Mesra by day, staring contest with a single code block by night. The code block is winning. We have beef. It knows what it did.',
      ],
    ];
    let cur = 1;
    const set = i => {
      if (i === cur) return;
      cur = i;
      opts.forEach(b => b.setAttribute('aria-checked', String(+b.dataset.t === i)));
      const swap = () => ps.forEach((p, k) => { p.innerHTML = V[i][k]; });
      if (reduce) { swap(); return; }
      ps.forEach(p => p.classList.add('is-resampling'));
      setTimeout(() => { swap(); ps.forEach(p => p.classList.remove('is-resampling')); }, 220);
    };
    opts.forEach(b => b.addEventListener('click', () => set(+b.dataset.t)));
    window.TEMP = v => { const i = { '0': 0, '0.0': 0, '0.7': 1, '1.4': 2 }[String(v)]; if (i == null) return false; set(i); return true; };
  })();

  /* ---------------- reading meter: tokens decoded, chapters cached ---------------- */
  (function meter() {
    const tokEl = $('[data-tok]'), kvm = $('[data-kvm]'), sum = $('[data-kv-sum]');
    const IDS = ['about', 'experience', 'projects', 'lab', 'writing', 'contact'];
    const secs = IDS.map(id => document.getElementById(id)).filter(Boolean);
    if (!tokEl || !kvm || !secs.length) return;

    // ~4 characters per token, the usual rule of thumb for English
    let total = 0;
    const count = () => { total = Math.round(($('main').innerText || '').length / 4); };
    const fmt = n => n.toLocaleString('en-US');
    const onScroll = () => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 1;
      tokEl.innerHTML = p > 0.995 ? '&lt;EOS&gt;' : fmt(Math.round(total * p));
    };
    setTimeout(() => { count(); onScroll(); }, 1500); // after articles and counters render
    addEventListener('scroll', onScroll, { passive: true });

    // a chapter is "cached" once it has held at least 40% of the viewport for 1.2s
    const saved = new Set(store.get('kv:cached', []).filter(id => IDS.includes(id)));
    const returning = saved.size > 0;
    const cached = new Set(saved);
    let hits = 0, misses = 0;
    kvm.innerHTML = secs.map(s => `<i data-kv="${s.id}" class="${cached.has(s.id) ? 'is-on' : ''}"></i>`).join('');
    const cell = id => $(`[data-kv="${id}"]`, kvm);
    const timers = new Map();
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      const id = en.target.id;
      const visible = en.intersectionRect.height / innerHeight >= 0.4 || en.intersectionRatio > 0.6;
      if (visible && !timers.has(id)) {
        if (cached.has(id)) {
          hits++;
          const c = cell(id); c.classList.remove('is-hit'); void c.offsetWidth; c.classList.add('is-hit');
          timers.set(id, 0);
        } else {
          misses++;
          timers.set(id, setTimeout(() => {
            cached.add(id); cell(id).classList.add('is-on');
            store.set('kv:cached', [...cached]);
          }, 1200));
        }
      } else if (!visible && timers.has(id)) {
        clearTimeout(timers.get(id)); timers.delete(id);
      }
    }), { threshold: [0, 0.2, 0.4, 0.6, 0.8] });
    secs.forEach(s => io.observe(s));

    // the footer reports back
    if (sum) new IntersectionObserver(([en]) => {
      if (!en.isIntersecting) return;
      const n = cached.size, rate = hits + misses ? Math.round((hits / (hits + misses)) * 100) : 0;
      sum.textContent = returning && rate > 0
        ? `Welcome back. KV cache hit rate ${rate}%, it was still warm.`
        : `You cached ${n} of ${secs.length} chapters. ${n < secs.length ? 'Come back, it stays warm.' : 'Full cache. Respect.'}`;
      sum.hidden = false;
    }).observe(sum.parentElement);
  })();

  /* ---------------- 429 for over-eager email copiers ---------------- */
  (function rateLimit() {
    const btn = $('#copy-email');
    if (!btn) return;
    let stamps = [];
    btn.addEventListener('click', () => {
      const now = Date.now();
      stamps = stamps.filter(t => now - t < 8000).concat(now);
      if (stamps.length < 6) return;
      setTimeout(() => { btn.textContent = '429 · Too many requests'; btn.classList.add('is-copied'); }, 0);
      toast('<b>429</b> Too many requests. He\'ll reply, promise.');
      stamps = [];
    });
  })();

  /* ---------------- backtick terminal ---------------- */
  (function terminal() {
    let box, out, input, hist = store.get('term:hist', []), hi = -1;
    const CHAPTERS = { about: '#about', experience: '#experience', work: '#projects', projects: '#projects', lab: '#lab', writing: '#writing', contact: '#contact', top: '#top' };
    const print = (html, cls = '') => { out.insertAdjacentHTML('beforeend', `<div class="tx__l ${cls}">${html}</div>`); out.scrollTop = out.scrollHeight; };
    const go = sel => { close(); document.querySelector(sel)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
    const works = () => [...$$('.feature').map(f => ({ name: $('.feature__name', f).textContent.trim(), run: () => window.open($('.feature__links a', f).href, '_blank', 'noopener') })),
      ...$$('.wx').map(li => ({ name: $('.wx__name', li).textContent.trim(), run: () => { close(); window.WORK && window.WORK.open(li); } }))];
    const CMDS = {
      help: () => print(['<b>ls</b>  chapters', '<b>cd</b> &lt;chapter&gt;  go there', '<b>cat</b> about.txt', '<b>ls</b> work · <b>open</b> &lt;project&gt;', '<b>articles</b> [series]', '<b>temp</b> 0 | 0.7 | 1.4', '<b>quantize</b> fp32 | int8 | int4 | int2 | int1', '<b>whoami</b> · <b>sudo hire nikhil</b> · <b>clear</b> · <b>exit</b>'].join('<br>')),
      ls: a => {
        if (/^(work|projects)/.test(a)) return print(works().map(w => esc(w.name)).join('  '));
        print('about/  experience/  work/  lab/  writing/  contact/  about.txt');
      },
      cd: a => { const t = CHAPTERS[(a || '').replace(/\/$/, '').toLowerCase()]; if (t) go(t); else print(`cd: no such chapter: ${esc(a || '')}`, 'is-err'); },
      cat: a => {
        if (!/about(\.txt)?$/.test(a || '')) return print(`cat: ${esc(a || '')}: no such file`, 'is-err');
        print($$('[data-temp-p]').map(p => esc(p.textContent.trim())).join('<br><br>'));
      },
      open: a => {
        const q = (a || '').toLowerCase().replace(/\s+/g, '');
        const w = works().find(x => x.name.toLowerCase().replace(/\s+/g, '').startsWith(q));
        if (!q || !w) return print(`open: try one of: ${works().map(x => esc(x.name)).join(', ')}`, 'is-err');
        w.run();
      },
      articles: a => {
        const data = window.ARTICLES_MERGED || [];
        const q = (a || '').toLowerCase();
        const list = data.filter(s => !q || s.series.toLowerCase().includes(q)).flatMap(s => s.items.map(x => ({ ...x, s: s.series })));
        if (!list.length) return print(`articles: no series matches "${esc(a)}"`, 'is-err');
        list.sort((x, y) => (y.date || '').localeCompare(x.date || ''));
        print(list.slice(0, 6).map(x => `<a href="${esc(x.url)}" target="_blank" rel="noopener">${esc(x.title)}</a> <span class="tx__dim">${esc(x.s)}</span>`).join('<br>'));
      },
      temp: a => { if (window.TEMP && window.TEMP(a)) print(`temperature set to ${esc(a)}. scroll up to About.`); else print('temp: use 0, 0.7 or 1.4', 'is-err'); },
      quantize: a => { if (window.QUANT && window.QUANT(a)) print(`portrait quantized to ${esc(a.toUpperCase())}. look up.`); else print('quantize: fp32, fp16, int8, int4, int2 or int1', 'is-err'); },
      whoami: () => print('a visitor with good taste. also: this is the site of Nikhil Mourya, ML engineer.'),
      sudo: a => {
        if (!/^hire\s+nikhil/i.test(a || '')) return print('sudo: nice try.', 'is-err');
        print('[sudo] password for recruiter: ********');
        setTimeout(() => { print('permission granted. opening a draft to tsmftxnikhil14@gmail.com…', 'is-ok'); setTimeout(() => { location.href = 'mailto:tsmftxnikhil14@gmail.com?subject=Let%27s%20talk'; }, 900); }, 600);
      },
      rm: a => print(/-rf\s+doubts/.test(a || '') ? "removed 'doubts'. it was mostly imposter syndrome." : 'rm: permission denied. this is a portfolio.', /doubts/.test(a || '') ? 'is-ok' : 'is-err'),
      clear: () => { out.innerHTML = ''; },
      exit: () => close(),
    };
    function run(line) {
      print(`<span class="tx__p">nikhil@portfolio:~$</span> ${esc(line)}`);
      const [cmd, ...rest] = line.trim().split(/\s+/);
      if (!cmd) return;
      const fn = CMDS[cmd.toLowerCase()];
      if (fn) fn(rest.join(' ')); else print(`command not found: ${esc(cmd)}. try <b>help</b>.`, 'is-err');
    }
    function build() {
      box = document.createElement('div');
      box.className = 'tx'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Terminal'); box.hidden = true;
      box.innerHTML = `<div class="tx__bar"><span><i class="led" aria-hidden="true"></i>nikhil@portfolio</span><span class="tx__dim">\` or esc to close</span></div>
        <div class="tx__out" aria-live="polite"></div>
        <label class="tx__in"><span class="tx__p" aria-hidden="true">~$</span><input type="text" aria-label="Terminal command" autocomplete="off" spellcheck="false" autocapitalize="off"></label>`;
      document.body.appendChild(box);
      out = $('.tx__out', box); input = $('input', box);
      print('welcome. type <b>help</b>. nothing here can break anything, I checked.', 'tx__dim');
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { const v = input.value; input.value = ''; if (v.trim()) { hist = [v, ...hist.filter(h => h !== v)].slice(0, 30); store.set('term:hist', hist); } hi = -1; run(v); }
        else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi < hist.length - 1) input.value = hist[++hi]; }
        else if (e.key === 'ArrowDown') { e.preventDefault(); hi = Math.max(-1, hi - 1); input.value = hi < 0 ? '' : hist[hi]; }
        else if (e.key === 'Escape' || e.key === '`') { e.preventDefault(); close(); }
      });
    }
    function open() { if (!box) build(); box.hidden = false; requestAnimationFrame(() => input.focus()); }
    function close() { if (box) box.hidden = true; }
    document.addEventListener('keydown', e => {
      const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '');
      if (e.key === '`' && !typing && !e.metaKey && !e.ctrlKey) { e.preventDefault(); if (box && !box.hidden) close(); else open(); }
    });
    window.TERMINAL = { open };
  })();

  /* ---------------- Konami: debug mode ---------------- */
  (function konami() {
    const SEQ = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
    let i = 0;
    document.addEventListener('keydown', e => {
      const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
      i = k === SEQ[i] ? i + 1 : (k === SEQ[0] ? 1 : 0);
      if (i < SEQ.length) return;
      i = 0;
      const on = document.documentElement.classList.toggle('debug');
      if (on) $$('main > section').forEach(s => {
        const tok = Math.round((s.innerText || '').length / 4), nodes = s.getElementsByTagName('*').length;
        s.dataset.debug = `#${s.id || 'section'} · ${tok.toLocaleString('en-US')} tok · ${nodes} nodes · ${Math.round(s.offsetHeight)}px`;
      });
      toast(on ? '<b>debug mode</b> on. konami again to exit.' : '<b>debug mode</b> off.');
    });
  })();

  /* ---------------- the agent that learns to say hi ---------------- */
  // Tabular Q-learning on a 6x6 grid with walls. Reward -1 per step, +10 at
  // "hi". Faint arrows show the greedy action per cell as it learns.
  (function agent() {
    const fig = $('[data-agent]'), canvas = $('[data-agent-canvas]');
    if (!fig || !canvas) return;
    const ctx = canvas.getContext('2d');
    const css = (v, d) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || d;
    const ACC = css('--accent-rgb', '205, 176, 124'), FG = css('--fg-rgb', '236, 235, 230'), INK = css('--accent-ink', '#17120a');
    const N = 6, START = [0, 5], GOAL = [5, 0];
    const WALLS = new Set(['2,1', '2,2', '2,3', '4,2', '4,3', '4,4', '1,4']);
    const MOVES = [[0, -1], [1, 0], [0, 1], [-1, 0]]; // up right down left
    const OPTIMAL = 10; // shortest path length around the walls
    const el = k => $(`[data-ag-${k}]`, fig);
    let Q, s, ep, steps, eps, settled, trail, raf = 0, visible = false, size = 0, tick = 0;

    const key = ([x, y]) => y * N + x;
    const reset = () => {
      Q = Array.from({ length: N * N }, () => [0, 0, 0, 0]);
      s = [...START]; ep = 0; steps = 0; eps = 1; settled = 0; trail = []; kx = START[0]; ky = START[1];
      el('title').textContent = 'Even my agent is figuring out how to reach me.';
    };
    const stepEnv = ([x, y], a) => {
      const nx = x + MOVES[a][0], ny = y + MOVES[a][1];
      if (nx < 0 || ny < 0 || nx >= N || ny >= N || WALLS.has(`${nx},${ny}`)) return [[x, y], -1, false];
      const done = nx === GOAL[0] && ny === GOAL[1];
      return [[nx, ny], done ? 10 : -1, done];
    };
    const greedy = st => { const q = Q[key(st)]; let b = 0; for (let a = 1; a < 4; a++) if (q[a] > q[b]) b = a; return b; };
    const learnStep = () => {
      const a = Math.random() < eps ? (Math.random() * 4) | 0 : greedy(s);
      const [ns, r, done] = stepEnv(s, a);
      const q = Q[key(s)];
      q[a] += 0.5 * (r + (done ? 0 : 0.95 * Math.max(...Q[key(ns)])) - q[a]);
      s = ns; steps++; trail.push([...s]); if (trail.length > 24) trail.shift();
      if (done || steps > 200) {
        settled = done && steps <= OPTIMAL ? settled + 1 : 0;
        el('steps').textContent = done ? steps : '200+';
        ep++; eps = Math.max(0.03, eps * 0.93); steps = 0; s = [...START]; trail = [];
        el('ep').textContent = ep; el('eps').textContent = eps.toFixed(2);
        if (settled === 3) el('title').textContent = `Even my agent figured out how to reach me. Took it ${ep} episodes.`;
      }
    };
    const resize = () => {
      const w = canvas.getBoundingClientRect().width;
      if (!w) return;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      size = w; canvas.width = canvas.height = Math.round(w * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    // The pond. Walls are rocks, the goal is a little shrine island that says hi,
    // the agent is a koi, its recent path leaves ripples, and the faint current
    // in each cell is the greedy policy it has learned so far.
    let kx = START[0], ky = START[1], ang = -Math.PI / 2;
    const seeded = (n => () => ((n = (n * 16807) % 2147483647) / 2147483647))(42);
    const rocks = [...WALLS].map(k => {
      const [x, y] = k.split(',').map(Number);
      return { x, y, r: Array.from({ length: 10 }, () => 0.36 + seeded() * 0.1), tone: 0.85 + seeded() * 0.3 };
    });
    const pads = [[1, 1], [4, 0], [0, 3], [3, 5], [5, 3]].filter(([x, y]) => !WALLS.has(`${x},${y}`)).map(([x, y]) => ({ x, y, a: seeded() * 6, r: 0.22 + seeded() * 0.08 }));
    const koi = (x, y, a, len, t) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      const w = len * 0.15, sw = Math.sin(t * 7) * len * 0.09, h = len / 2;
      // tail fin
      ctx.fillStyle = 'rgba(246, 238, 226, 0.72)';
      ctx.beginPath(); ctx.moveTo(-h * 0.8, sw * 0.6);
      ctx.quadraticCurveTo(-h * 1.25, sw - w * 1.6, -h * 1.45, sw - w * 1.2); ctx.quadraticCurveTo(-h * 1.15, sw, -h * 1.45, sw + w * 1.2);
      ctx.quadraticCurveTo(-h * 1.25, sw + w * 1.6, -h * 0.8, sw * 0.6); ctx.fill();
      // pectoral fins
      ctx.fillStyle = 'rgba(246, 238, 226, 0.5)';
      [-1, 1].forEach(d => { ctx.beginPath(); ctx.ellipse(h * 0.25, d * w * 1.15, w * 0.9, w * 0.45, d * 0.6 + Math.sin(t * 5) * 0.2 * d, 0, Math.PI * 2); ctx.fill(); });
      // body, with kohaku patches clipped to it
      const body = new Path2D();
      body.moveTo(h, 0);
      body.bezierCurveTo(h * 0.8, -w * 1.1, -h * 0.2, -w * 1.2, -h * 0.85, sw * 0.6 - w * 0.3);
      body.lineTo(-h * 0.85, sw * 0.6 + w * 0.3);
      body.bezierCurveTo(-h * 0.2, w * 1.2, h * 0.8, w * 1.1, h, 0);
      ctx.fillStyle = '#f6efe3'; ctx.fill(body);
      ctx.save(); ctx.clip(body);
      ctx.fillStyle = '#e1542d';
      [[h * 0.55, -w * 0.2, w * 0.9], [h * 0.05, w * 0.3, w * 1.05], [-h * 0.45, -w * 0.4, w * 0.7]].forEach(([px, py, r]) => { ctx.beginPath(); ctx.ellipse(px, py, r * 1.4, r, 0, 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
      ctx.fillStyle = '#1a1210';
      [-1, 1].forEach(d => { ctx.beginPath(); ctx.arc(h * 0.72, d * w * 0.45, Math.max(0.7, w * 0.14), 0, Math.PI * 2); ctx.fill(); });
      ctx.restore();
    };
    const draw = () => {
      if (!size) resize();
      const c = size / N, t = performance.now() / 1000;
      // water, with slow caustics
      const wg = ctx.createRadialGradient(size * 0.4, size * 0.35, size * 0.1, size / 2, size / 2, size * 0.75);
      wg.addColorStop(0, '#14394a'); wg.addColorStop(1, '#081a26');
      ctx.fillStyle = wg; ctx.fillRect(0, 0, size, size);
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 6; i++) {
        const x = size * (0.5 + 0.4 * Math.sin(t * 0.13 + i * 1.9)), y = size * (0.5 + 0.4 * Math.cos(t * 0.11 + i * 2.7)), r = size * (0.16 + 0.05 * Math.sin(t * 0.4 + i));
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, 'rgba(120, 190, 200, 0.07)'); g.addColorStop(1, 'rgba(120, 190, 200, 0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
      // lily pads
      pads.forEach(p => {
        const x = p.x * c + c / 2, y = p.y * c + c / 2, r = p.r * c;
        ctx.fillStyle = 'rgba(70, 120, 80, 0.55)';
        ctx.beginPath(); ctx.moveTo(x, y); ctx.arc(x, y, r, p.a + 0.35, p.a + Math.PI * 2 - 0.05); ctx.closePath(); ctx.fill();
      });
      // the current: what the agent has learned, cell by cell
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (WALLS.has(`${x},${y}`) || (x === GOAL[0] && y === GOAL[1])) continue;
        const q = Q[y * N + x], best = Math.max(...q);
        if (best === 0 && Math.min(...q) === 0) continue;
        const a = greedy([x, y]), cx = x * c + c / 2, cy = y * c + c / 2, L = c * 0.22, drift = ((t * 0.6 + (x + y) * 0.13) % 1) * 2 - 1;
        const al = Math.min(0.42, 0.08 + Math.abs(best) * 0.035);
        ctx.strokeStyle = `rgba(190, 228, 236, ${al.toFixed(3)})`; ctx.lineWidth = 1; ctx.lineCap = 'round';
        const ox = -MOVES[a][1] * c * 0.08, oy = MOVES[a][0] * c * 0.08;
        [-1, 1].forEach(d => {
          const sx = cx + ox * d + MOVES[a][0] * L * drift * 0.4, sy = cy + oy * d + MOVES[a][1] * L * drift * 0.4;
          ctx.beginPath(); ctx.moveTo(sx - MOVES[a][0] * L * 0.6, sy - MOVES[a][1] * L * 0.6); ctx.lineTo(sx + MOVES[a][0] * L * 0.6, sy + MOVES[a][1] * L * 0.6); ctx.stroke();
        });
      }
      // rocks
      rocks.forEach(rk => {
        const x = rk.x * c + c / 2, y = rk.y * c + c / 2;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
        ctx.beginPath(); ctx.ellipse(x + c * 0.05, y + c * 0.08, c * 0.44, c * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        const path = new Path2D();
        rk.r.forEach((r, i) => { const a = (i / rk.r.length) * Math.PI * 2, px = x + Math.cos(a) * r * c * 1.15, py = y + Math.sin(a) * r * c; i ? path.lineTo(px, py) : path.moveTo(px, py); });
        path.closePath();
        const rg = ctx.createLinearGradient(x - c / 2, y - c / 2, x + c / 2, y + c / 2);
        rg.addColorStop(0, `rgb(${Math.round(120 * rk.tone)}, ${Math.round(122 * rk.tone)}, ${Math.round(128 * rk.tone)})`); rg.addColorStop(1, '#2c3036');
        ctx.fillStyle = rg; ctx.fill(path);
        ctx.fillStyle = 'rgba(96, 130, 70, 0.55)';
        ctx.beginPath(); ctx.ellipse(x - c * 0.08, y - c * 0.16, c * 0.2, c * 0.08, -0.3, 0, Math.PI * 2); ctx.fill();
      });
      // ripples where the koi has just been
      trail.forEach(([x, y], i) => {
        const k = i / trail.length;
        ctx.strokeStyle = `rgba(200, 235, 240, ${(k * 0.28).toFixed(3)})`; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(x * c + c / 2, y * c + c / 2, c * (0.12 + (1 - k) * 0.3), 0, Math.PI * 2); ctx.stroke();
      });
      // the shrine island that says hi
      const gx = GOAL[0] * c + c / 2, gy = GOAL[1] * c + c / 2;
      ctx.fillStyle = '#c9b184'; ctx.beginPath(); ctx.ellipse(gx, gy + c * 0.05, c * 0.44, c * 0.38, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.stroke();
      const u = c / 46;
      ctx.fillStyle = '#d4553b';
      ctx.fillRect(gx - 9 * u, gy - 13 * u, 18 * u, 2.4 * u); ctx.fillRect(gx - 7.5 * u, gy - 9 * u, 15 * u, 1.8 * u);
      ctx.fillRect(gx - 6 * u, gy - 12 * u, 2 * u, 13 * u); ctx.fillRect(gx + 4 * u, gy - 12 * u, 2 * u, 13 * u);
      ctx.fillStyle = '#1d1a26'; ctx.font = `600 ${Math.round(c * 0.26)}px 'Shippori Mincho', serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('hi', gx, gy + c * 0.24);
      // the koi glides toward wherever the agent is now
      const dx = s[0] - kx, dy = s[1] - ky, d = Math.hypot(dx, dy);
      if (d > 2.5) { kx = s[0]; ky = s[1]; } else { kx += dx * 0.3; ky += dy * 0.3; }
      if (d > 0.02) { const target = Math.atan2(dy, dx); let da = target - ang; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; ang += da * 0.3; }
      koi(kx * c + c / 2, ky * c + c / 2, ang, c * 0.82, t);
    };
    const loop = () => {
      raf = 0;
      if (!visible || document.hidden) return;
      tick++;
      // fast while exploring, walking pace once it has learned, so you can watch it go
      const perFrame = settled >= 3 ? (tick % 6 === 0 ? 1 : 0) : eps > 0.3 ? 12 : eps > 0.08 ? 3 : 1;
      for (let i = 0; i < perFrame; i++) learnStep();
      draw();
      raf = requestAnimationFrame(loop);
    };
    reset();
    if (reduce) { for (let i = 0; i < 20000 && settled < 3; i++) learnStep(); s = [...START]; trail = []; draw(); }
    else new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible && !raf) raf = requestAnimationFrame(loop); }).observe(canvas);
    el('reset').addEventListener('click', () => { reset(); el('ep').textContent = '0'; el('eps').textContent = '1.00'; el('steps').textContent = '…'; if (reduce) { for (let i = 0; i < 20000 && settled < 3; i++) learnStep(); s = [...START]; } draw(); });
    addEventListener('resize', () => { size = 0; draw(); });
    draw();
  })();

  /* ---------------- Lab: GPT-2's pre-tokenizer, live ---------------- */
  (function tokenizer() {
    const input = $('[data-tok-in]'), outEl = $('[data-tok-out]');
    if (!input || !outEl) return;
    // the exact regex GPT-2 uses to split text before BPE merges
    const PAT = /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu;
    const render = () => {
      const text = input.value.slice(0, 400);
      const toks = text.match(PAT) || [];
      outEl.innerHTML = toks.map(t => `<span>${esc(t).replace(/ /g, '<i>·</i>')}</span>`).join('');
      $('[data-tok-n]').textContent = toks.length;
      $('[data-tok-c]').textContent = text.length;
      $('[data-tok-r]').textContent = toks.length ? (text.length / toks.length).toFixed(1) : '0';
    };
    input.addEventListener('input', render);
    render();
  })();
})();
