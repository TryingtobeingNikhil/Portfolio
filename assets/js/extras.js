/* Extras: time-zone line, token hover, contribution calendar,
   the three lab toys, and the ⌘K command palette. */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ---------------- writing, rendered from assets/data/articles.js ---------------- */
  (function articles() {
    const host = $('[data-articles]');
    const data = window.ARTICLES;
    if (!host || !Array.isArray(data)) return;
    const total = data.reduce((n, s) => n + s.items.length, 0);
    host.innerHTML = data.map(s => `
      <div class="series__col">
        <h4>${esc(s.series)} <span>${s.numbered ? `${s.items.length} part${s.items.length === 1 ? '' : 's'}` : s.items.length}</span></h4>
        <ol>${s.items.map((a, i) => `
          <li><a href="${esc(a.url)}" target="_blank" rel="noopener"${a.date ? ` title="${esc(a.date)}"` : ''}>
            <span class="series__n">${s.numbered ? String(i + 1).padStart(2, '0') : esc(a.tag || '')}</span>
            <span class="series__t">${esc(a.title)}</span>
            <span class="series__go" aria-hidden="true">↗</span></a></li>`).join('')}
        </ol>
      </div>`).join('');
    $$('[data-article-count]').forEach(el => { el.textContent = total; });
  })();

  /* ---------------- quote strip, from assets/data/quotes.js ---------------- */
  (function quotes() {
    const box = $('[data-quote]'), bank = window.QUOTES;
    if (!box || !Array.isArray(bank) || !bank.length) return;
    const text = $('[data-quote-text]', box), by = $('[data-quote-by]', box);
    const KEY = 'quote:last';
    let cur = -1;
    try { cur = parseInt(sessionStorage.getItem(KEY) ?? '-1', 10); } catch (_) {}
    const pickNext = () => {
      if (bank.length === 1) return 0;
      let i; do { i = Math.floor(Math.random() * bank.length); } while (i === cur);
      return i;
    };
    const render = i => {
      const q = bank[i];
      text.textContent = q.text;
      by.innerHTML = [q.by ? esc(q.by) : '', q.mine ? '<span class="mine">a favourite</span>' : ''].filter(Boolean).join(' · ') || '&nbsp;';
      box.title = q.source || '';
      cur = i;
      try { sessionStorage.setItem(KEY, String(i)); } catch (_) {}
    };
    render(pickNext()); // new quote on every visit, never the same twice in a row
    $('[data-quote-next]', box).addEventListener('click', () => {
      if (reduce) { render(pickNext()); return; }
      box.classList.add('is-swapping');
      setTimeout(() => { render(pickNext()); box.classList.remove('is-swapping'); }, 300);
    });
  })();

  /* ---------------- your time vs mine ---------------- */
  (function tz() {
    const IST = 330; // minutes east of UTC (Asia/Kolkata)
    const mine = -new Date().getTimezoneOffset();
    const diff = IST - mine;
    const fmt = m => { const h = Math.floor(Math.abs(m) / 60), r = Math.abs(m) % 60; return `${h ? h + 'h' : ''}${h && r ? ' ' : ''}${r ? r + 'm' : ''}`; };
    const short = diff === 0 ? 'same time zone as you' : `${fmt(diff)} ${diff > 0 ? 'ahead of' : 'behind'} you`;
    $$('[data-tzdiff]').forEach(el => { el.textContent = short; });
    $$('[data-tzdiff-long]').forEach(el => { el.textContent = diff === 0 ? ', same as you' : `, ${short}`; });
  })();

  /* ---------------- tokenizer hover ---------------- */
  $$('.tok[data-tokens]').forEach(el => {
    const tokens = el.dataset.tokens.split('|');
    const plain = el.textContent;
    const split = () => {
      if (el.classList.contains('is-split')) return;
      el.innerHTML = tokens.map(t => `<span class="t">${esc(t)}</span>`).join('') +
        `<span class="tok__tip" aria-hidden="true"><b>${tokens.length}</b> tokens · ${plain.length} chars</span>`;
      el.classList.add('is-split');
    };
    const join = () => { el.classList.remove('is-split'); el.textContent = plain; };
    el.setAttribute('aria-label', plain);
    el.addEventListener('pointerenter', split);
    el.addEventListener('pointerleave', join);
    el.addEventListener('focus', split);
    el.addEventListener('blur', join);
  });

  /* ---------------- contribution calendar ---------------- */
  (function contrib() {
    const box = $('#contrib'), svg = $('#contrib-svg');
    if (!box || !svg) return;
    const draw = data => {
      const days = data.contributions;
      if (!days || !days.length) return;
      const C = 11, G = 3, top = 16, left = 26;
      const first = new Date(days[0].date + 'T00:00:00');
      const pad = first.getDay(); // Sunday-first columns, like GitHub
      const weeks = Math.ceil((days.length + pad) / 7);
      const W = left + weeks * (C + G), H = top + 7 * (C + G);
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      let out = '', lastMonth = -1;
      days.forEach((d, i) => {
        const idx = i + pad, col = Math.floor(idx / 7), row = idx % 7;
        const x = left + col * (C + G), y = top + row * (C + G);
        const date = new Date(d.date + 'T00:00:00');
        if (row === 0 || i === 0) {
          const m = date.getMonth();
          if (m !== lastMonth && date.getDate() <= 7) { out += `<text x="${x}" y="10">${date.toLocaleString('en-US', { month: 'short' })}</text>`; lastMonth = m; }
        }
        out += `<rect x="${x}" y="${y}" width="${C}" height="${C}" data-l="${d.level}"><title>${d.count} on ${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</title></rect>`;
      });
      ['Mon', 'Wed', 'Fri'].forEach((n, k) => { out += `<text x="0" y="${top + (1 + k * 2) * (C + G) + 9}">${n}</text>`; });
      svg.innerHTML = out;
      $('[data-contrib-total]').textContent = (data.total.lastYear ?? 0).toLocaleString('en-US');
      box.hidden = false;
    };
    const KEY = 'gh:contrib';
    try {
      const hit = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      if (hit && Date.now() - hit.t < 6 * 3600 * 1000) { draw(hit.d); return; }
    } catch (_) { /* storage unavailable */ }
    fetch('https://github-contributions-api.jogruber.de/v4/TryingtobeingNikhil?y=last')
      .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(d => { draw(d); try { sessionStorage.setItem(KEY, JSON.stringify({ t: Date.now(), d })); } catch (_) {} })
      .catch(() => { /* leave the block hidden */ });
  })();

  /* ---------------- lab: temperature ---------------- */
  (function temperature() {
    const root = $('#toy-temp');
    if (!root) return;
    const cands = [['keys and values', 3.1], ['attention', 2.2], ['past tokens', 1.9], ['activations', 1.2], ['weights', 0.7], ['gradients', 0.3]];
    const bars = $('[data-bars]', root), slider = $('[data-t]', root), tv = $('[data-tv]', root), pick = $('[data-pick]', root);
    bars.innerHTML = cands.map(([w]) => `<div class="bar"><span>${w}</span><div class="bar__track"><div class="bar__fill"></div></div><b>0%</b></div>`).join('');
    const rows = $$('.bar', bars);
    let probs = [];
    const update = () => {
      const T = parseFloat(slider.value);
      tv.textContent = T.toFixed(2);
      const ex = cands.map(([, l]) => Math.exp(l / T));
      const sum = ex.reduce((a, b) => a + b, 0);
      probs = ex.map(e => e / sum);
      const max = Math.max(...probs);
      rows.forEach((r, i) => {
        $('.bar__fill', r).style.width = `${(probs[i] * 100).toFixed(1)}%`;
        $('b', r).textContent = `${Math.round(probs[i] * 100)}%`;
        r.classList.toggle('is-top', probs[i] === max);
      });
    };
    slider.addEventListener('input', update);
    $('[data-sample]', root).addEventListener('click', () => {
      let u = Math.random(), i = 0;
      while (i < probs.length - 1 && (u -= probs[i]) > 0) i++;
      pick.textContent = cands[i][0];
      rows.forEach((r, k) => r.classList.toggle('is-picked', k === i));
    });
    update();
  })();

  /* ---------------- lab: learning rate ---------------- */
  (function learningRate() {
    const root = $('#toy-lr');
    if (!root) return;
    const canvas = $('[data-canvas]', root), ctx = canvas.getContext('2d');
    const slider = $('[data-lr]', root), lrv = $('[data-lrv]', root), readout = $('[data-readout]', root);
    const A = 1, B = 12;                        // f(x, y) = ½(A x² + B y²)
    const f = (x, y) => 0.5 * (A * x * x + B * y * y);
    const start = [-3.6, 1.1];
    let w = 0, h = 0, path = [], timer = 0;
    const toPx = (x, y) => [w / 2 + x * (w / 9), h / 2 - y * (h / 3.4)];

    function size() {
      const r = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function draw() {
      ctx.clearRect(0, 0, w, h);
      // contours
      for (let k = 1; k <= 7; k++) {
        const c = 0.35 * k * k;
        const rx = Math.sqrt((2 * c) / A) * (w / 9), ry = Math.sqrt((2 * c) / B) * (h / 3.4);
        ctx.strokeStyle = `rgba(236, 238, 237, ${0.12 - k * 0.012})`;
        ctx.beginPath(); ctx.ellipse(w / 2, h / 2, rx, ry, 0, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(88, 242, 155, 0.9)';
      ctx.beginPath(); ctx.arc(w / 2, h / 2, 2.5, 0, Math.PI * 2); ctx.fill();
      if (!path.length) return;
      ctx.strokeStyle = 'rgba(88, 242, 155, 0.8)'; ctx.lineWidth = 1.4;
      ctx.beginPath();
      path.forEach(([x, y], i) => { const [px, py] = toPx(x, y); i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); });
      ctx.stroke();
      path.forEach(([x, y], i) => {
        const [px, py] = toPx(x, y);
        ctx.fillStyle = i === path.length - 1 ? '#eceeed' : 'rgba(88, 242, 155, 0.7)';
        ctx.beginPath(); ctx.arc(px, py, i === path.length - 1 ? 3.5 : 1.8, 0, Math.PI * 2); ctx.fill();
      });
    }
    function run() {
      clearInterval(timer);
      const lr = parseFloat(slider.value);
      path = [start.slice()];
      let step = 0;
      const tick = () => {
        const [x, y] = path[path.length - 1];
        const nx = x - lr * A * x, ny = y - lr * B * y;
        path.push([nx, ny]); step++;
        const loss = f(nx, ny);
        const diverged = !isFinite(loss) || Math.abs(ny) > 6;
        readout.textContent = diverged ? `step ${step} · diverged` : `step ${step} · loss ${loss.toFixed(3)}`;
        draw();
        if (diverged || step >= 40 || loss < 1e-3) clearInterval(timer);
      };
      if (reduce) { for (let i = 0; i < 40; i++) tick(); } else timer = setInterval(tick, 90);
    }
    slider.addEventListener('input', () => { lrv.textContent = parseFloat(slider.value).toFixed(3).replace(/0$/, ''); });
    $('[data-run]', root).addEventListener('click', run);
    window.addEventListener('resize', () => { size(); draw(); });
    new IntersectionObserver(([en], obs) => { if (en.isIntersecting) { size(); run(); obs.disconnect(); } }, { threshold: 0.4 }).observe(canvas);
    size(); draw();
  })();

  /* ---------------- lab: causal attention ---------------- */
  (function attention() {
    const root = $('#toy-attn');
    if (!root) return;
    const words = ['The', 'model', 'knows', 'when', 'it', "doesn't", 'know', 'enough'];
    // hand-set links that a trained head might plausibly learn; everything else decays with distance
    const links = { '4,1': 2.6, '6,2': 2.4, '5,4': 1.4, '7,6': 1.6, '2,1': 1.8, '3,2': 1.2, '7,2': 1.1 };
    const weights = q => {
      const s = words.map((_, k) => (k > q ? -Infinity : (links[`${q},${k}`] || 0) - 0.35 * (q - k) + (k === q ? 0.6 : 0)));
      const ex = s.map(v => (v === -Infinity ? 0 : Math.exp(v)));
      const z = ex.reduce((a, b) => a + b, 0);
      return ex.map(e => e / z);
    };
    const sent = $('[data-sent]', root), hint = $('[data-hint]', root);
    sent.innerHTML = words.map((wd, i) => `<span tabindex="0" data-i="${i}">${esc(wd)}</span>`).join('');
    const spans = $$('span', sent);
    const show = q => {
      const w = weights(q);
      const top = w.map((v, k) => [v, k]).filter(([, k]) => k !== q).sort((a, b) => b[0] - a[0])[0];
      spans.forEach((sp, k) => {
        sp.classList.toggle('is-q', k === q);
        sp.classList.toggle('is-masked', k > q);
        sp.style.background = k <= q ? `rgba(88, 242, 155, ${(w[k] * 0.85).toFixed(3)})` : '';
        sp.style.color = k <= q && w[k] > 0.35 ? '#03140a' : '';
      });
      hint.textContent = top ? `"${words[q]}" looks most at "${words[top[1]]}" (${Math.round(top[0] * 100)}%)` : `"${words[q]}" can only see itself`;
    };
    const clear = () => { spans.forEach(sp => { sp.className = ''; sp.style.background = ''; sp.style.color = ''; }); hint.textContent = 'hover a token'; };
    spans.forEach((sp, i) => {
      sp.addEventListener('pointerenter', () => show(i));
      sp.addEventListener('focus', () => show(i));
    });
    sent.addEventListener('pointerleave', clear);
    // demo once on reveal so it isn't a dead box
    new IntersectionObserver(([en], obs) => {
      if (!en.isIntersecting) return;
      obs.disconnect();
      if (reduce) { show(6); return; }
      let i = 0;
      const t = setInterval(() => { show(i++); if (i >= words.length) { clearInterval(t); setTimeout(() => show(6), 400); } }, 420);
    }, { threshold: 0.5 }).observe(sent);
  })();

  /* ---------------- ⌘K command palette ---------------- */
  (function palette() {
    const dlg = $('#cmdk');
    if (!dlg) return;
    const input = $('[data-cmdk-input]', dlg), list = $('[data-cmdk-list]', dlg);
    const email = ($('#copy-email') || {}).dataset?.email || '';
    const txt = el => (el ? el.textContent.replace(/\s+/g, ' ').replace('↗', '').trim() : '');

    // Built from the page itself so the palette never drifts from the content.
    const items = [];
    const add = (group, label, hint, run, keys = '') => items.push({ group, label, hint, run, hay: `${label} ${hint} ${keys}`.toLowerCase() });
    const go = hash => () => { const el = document.querySelector(hash); if (el) el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); };
    const open = href => () => window.open(href, '_blank', 'noopener');

    [['#about', 'About'], ['#experience', 'Experience'], ['#projects', 'Projects'], ['#lab', 'Lab'], ['#writing', 'Writing'], ['#contact', 'Contact']]
      .forEach(([h, l]) => add('Sections', l, 'jump', go(h), 'section'));
    $$('.feature').forEach(f => { const a = $('.feature__links a', f); if (a) add('Projects', txt($('.feature__name', f)), 'GitHub', open(a.href), txt($('.feature__kicker', f))); });
    $$('.card').forEach(c => { const a = $$('.card__top a', c).pop(); if (a) add('Projects', txt($('h3', c)), 'GitHub', open(a.href), txt($('.feature__kicker', c))); });
    $$('.ix').forEach(a => add('Projects', txt($('.ix__name', a)), 'GitHub', open(a.href), txt($('.ix__desc', a))));
    $$('.series__col').forEach(col => {
      const series = txt($('h4', col)).replace(/\d+\s*parts?|\s\d+$/, '').trim();
      $$('a', col).forEach(a => add('Writing', txt($('.series__t', a)), series, open(a.href), 'article'));
    });
    $$('.social').forEach(a => add('Links', txt($('.social__k', a)), txt($('b', a)), open(a.href)));
    if (email) add('Actions', 'Copy email', email, () => navigator.clipboard?.writeText(email), 'mail contact');
    add('Actions', 'Back to top', 'scroll', go('#top'), 'home');

    let shown = [], sel = 0, lastFocus = null;
    const render = () => {
      const q = input.value.trim().toLowerCase();
      const terms = q.split(/\s+/).filter(Boolean);
      shown = items.filter(it => terms.every(t => it.hay.includes(t)));
      sel = Math.min(sel, Math.max(0, shown.length - 1));
      if (!shown.length) { list.innerHTML = `<li class="cmdk__empty">No match for "${esc(input.value)}"</li>`; return; }
      let html = '', g = '';
      shown.forEach((it, i) => {
        if (it.group !== g) { g = it.group; html += `<li class="cmdk__group" role="presentation">${g}</li>`; }
        html += `<li class="cmdk__item" role="option" id="cmdk-${i}" data-i="${i}" aria-selected="${i === sel}"><span>${esc(it.label)}</span><small>${esc(it.hint)}</small></li>`;
      });
      list.innerHTML = html;
      input.setAttribute('aria-activedescendant', `cmdk-${sel}`);
      const cur = $(`#cmdk-${sel}`, list);
      if (cur) cur.scrollIntoView({ block: 'nearest' });
    };
    const show = () => {
      lastFocus = document.activeElement;
      dlg.hidden = false; input.value = ''; sel = 0; render();
      document.body.style.overflow = 'hidden';
      input.focus(); // synchronous, so keys typed right after ⌘K aren't lost
    };
    const hide = (restore = true) => {
      dlg.hidden = true; document.body.style.overflow = '';
      if (restore && lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
    };
    const choose = i => { const it = shown[i]; if (!it) return; hide(false); it.run(); };

    input.addEventListener('input', () => { sel = 0; render(); });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = (sel + 1) % Math.max(1, shown.length); render(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = (sel - 1 + shown.length) % Math.max(1, shown.length); render(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
      else if (e.key === 'Escape') { e.preventDefault(); hide(); }
      else if (e.key === 'Tab') e.preventDefault(); // keep focus inside
    });
    list.addEventListener('pointermove', e => { const li = e.target.closest('.cmdk__item'); if (li && +li.dataset.i !== sel) { sel = +li.dataset.i; render(); } });
    list.addEventListener('click', e => { const li = e.target.closest('.cmdk__item'); if (li) choose(+li.dataset.i); });
    $('[data-cmdk-close]', dlg).addEventListener('click', () => hide());
    $$('[data-cmdk]').forEach(b => b.addEventListener('click', () => {
      const menu = $('#mobile-menu'), nav = $('#nav');
      if (menu && !menu.hidden) { menu.hidden = true; nav.classList.remove('is-open'); $('.nav__toggle').setAttribute('aria-expanded', 'false'); }
      show();
    }));
    document.addEventListener('keydown', e => {
      const typing = /input|textarea|select/i.test(document.activeElement?.tagName || '');
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); if (dlg.hidden) show(); else hide(); }
      else if (e.key === '/' && dlg.hidden && !typing) { e.preventDefault(); show(); }
    });
    // Show Ctrl instead of ⌘ off Apple platforms
    if (!/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) {
      $$('kbd').forEach(k => { if (k.textContent === '⌘') k.textContent = 'Ctrl'; });
    }
  })();
})();
