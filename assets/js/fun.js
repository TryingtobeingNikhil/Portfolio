/* The playful layer: résumé printing, the precision slider on the portrait,
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

  /* ---------------- résumé: ⌘P prints a one-pager (see .cv in index.html) ---------------- */
  const printCV = () => window.print();
  $$('[data-print]').forEach(b => b.addEventListener('click', printCV));

  /* ---------------- precision slider on the portrait ---------------- */
  (function quantize() {
    const range = $('[data-quant-range]');
    if (!range) return;
    const STEPS = [
      [32, 'FP32', 'full precision'],
      [16, 'FP16', 'half the bits, nobody can tell'],
      [8, 'INT8', 'still me'],
      [4, 'INT4', 'getting artsy'],
      [2, 'INT2', 'a vibe, not a face'],
      [1, 'INT1', 'one bit. still recognisably me. probably.'],
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
      help: () => print(['<b>ls</b>  chapters', '<b>cd</b> &lt;chapter&gt;  go there', '<b>cat</b> about.txt', '<b>ls</b> work · <b>open</b> &lt;project&gt;', '<b>articles</b> [series]', '<b>temp</b> 0 | 0.7 | 1.4', '<b>quantize</b> fp32 | int8 | int4 | int2 | int1', '<b>resume</b>  print the one-pager', '<b>whoami</b> · <b>sudo hire nikhil</b> · <b>clear</b> · <b>exit</b>'].join('<br>')),
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
      resume: () => { close(); setTimeout(printCV, 100); },
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
      s = [...START]; ep = 0; steps = 0; eps = 1; settled = 0; trail = [];
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
    const draw = () => {
      if (!size) resize();
      const c = size / N;
      ctx.clearRect(0, 0, size, size);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const k = `${x},${y}`;
        if (WALLS.has(k)) { ctx.fillStyle = `rgba(${FG}, 0.09)`; ctx.fillRect(x * c + 1, y * c + 1, c - 2, c - 2); continue; }
        ctx.strokeStyle = `rgba(${FG}, 0.08)`; ctx.strokeRect(x * c + 0.5, y * c + 0.5, c - 1, c - 1);
        if (x === GOAL[0] && y === GOAL[1]) continue;
        // greedy arrow, brighter where the agent is more certain
        const q = Q[y * N + x], best = Math.max(...q);
        if (best === 0 && Math.min(...q) === 0) continue;
        const a = greedy([x, y]), cx = x * c + c / 2, cy = y * c + c / 2, L = c * 0.18;
        ctx.strokeStyle = `rgba(${FG}, ${Math.min(0.5, 0.12 + Math.abs(best) * 0.04)})`; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(cx - MOVES[a][0] * L, cy - MOVES[a][1] * L); ctx.lineTo(cx + MOVES[a][0] * L, cy + MOVES[a][1] * L); ctx.stroke();
        ctx.beginPath(); ctx.arc(cx + MOVES[a][0] * L, cy + MOVES[a][1] * L, 1.4, 0, Math.PI * 2); ctx.fillStyle = ctx.strokeStyle; ctx.fill();
      }
      // goal
      ctx.fillStyle = `rgb(${ACC})`; ctx.fillRect(GOAL[0] * c + 3, GOAL[1] * c + 3, c - 6, c - 6);
      ctx.fillStyle = INK; ctx.font = `500 ${Math.round(c * 0.32)}px Geist, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('hi', GOAL[0] * c + c / 2, GOAL[1] * c + c / 2 + 1);
      // trail + agent
      trail.forEach(([x, y], i) => { ctx.fillStyle = `rgba(${ACC}, ${(i / trail.length) * 0.35})`; ctx.beginPath(); ctx.arc(x * c + c / 2, y * c + c / 2, c * 0.1, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = `rgb(${FG})`; ctx.beginPath(); ctx.arc(s[0] * c + c / 2, s[1] * c + c / 2, c * 0.16, 0, Math.PI * 2); ctx.fill();
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
