/* Showcase: two pieces that are about the work itself.
   1. Speculative decoding, simulated live (Lab).
   2. "This visit, traced": the visitor's own page load as an OpenTelemetry-style
      waterfall, built from the browser's Performance API (footer). */
(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sleep = ms => new Promise(r => setTimeout(r, reduce ? 0 : ms));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ======================================================================
     1. Speculative decoding
     Draft model proposes k tokens; each is right with probability α.
     The target model verifies all k in ONE pass: it keeps the longest
     correct prefix, replaces the first wrong token with its own, and if
     every draft token was right it emits one bonus token. Expected tokens
     per target pass: (1 − α^(k+1)) / (1 − α)  (Leviathan et al., 2023).
     ====================================================================== */
  (function speculative() {
    const root = $('#spec');
    if (!root) return;
    const out = $('[data-spec-out]', root);
    const kIn = $('[data-spec-k]', root), aIn = $('[data-spec-a]', root);
    const S = {
      steps: $('[data-s-steps]', root), tpp: $('[data-s-tpp]', root),
      exp: $('[data-s-exp]', root), speed: $('[data-s-speed]', root),
    };
    const SENTENCES = [
      'I build the parts of AI most people import, then write about what broke along the way.',
      'Continuous batching lets new requests join while earlier ones are still decoding.',
      'A paged KV cache stops long prompts from wasting memory on padding they never use.',
    ];
    const DECOYS = [' the', ' a', ' model', ' tokens', ' cache', ' fast', ' memory', ' batch', ' it', ' and', ' to', ' GPU', ' is', ' of', ' that', ' more'];
    const tokenize = s => s.match(/\s?[A-Za-z']+|\s?[^\sA-Za-z']/g);
    let runId = 0, sentence = 0;

    const params = () => ({ k: parseInt(kIn.value, 10), a: parseFloat(aIn.value) });
    const expected = (k, a) => (1 - Math.pow(a, k + 1)) / (1 - a);
    function showParams() {
      const { k, a } = params();
      $('[data-kv]', root).textContent = k;
      $('[data-av]', root).textContent = a.toFixed(2);
      $('[data-k-label]', root).textContent = k;
      S.exp.textContent = expected(k, a).toFixed(2);
    }
    const tok = (text, cls) => {
      const el = document.createElement('span');
      el.className = `tk ${cls}`;
      el.textContent = text;
      out.appendChild(el);
      return el;
    };

    async function run() {
      const id = ++runId;
      const alive = () => id === runId;
      const { k, a } = params();
      const target = tokenize(SENTENCES[sentence++ % SENTENCES.length]);
      out.textContent = '';
      let pos = 0, passes = 0;
      S.steps.textContent = '0'; S.tpp.textContent = '–'; S.speed.textContent = '–';

      while (pos < target.length) {
        // draft phase: propose up to k tokens
        const n = Math.min(k, target.length - pos);
        const drafts = [];
        for (let i = 0; i < n; i++) {
          const truth = target[pos + i];
          let guess = truth;
          if (Math.random() > a) { do { guess = DECOYS[(Math.random() * DECOYS.length) | 0]; } while (guess.trim() === truth.trim()); }
          drafts.push({ el: tok(guess, 'is-draft'), ok: guess === truth });
          await sleep(55);
          if (!alive()) return;
        }
        await sleep(260);
        if (!alive()) return;

        // verify phase: one target forward pass checks every draft token
        passes++;
        let rejected = false;
        for (const d of drafts) {
          if (rejected) { d.el.classList.add('is-dropped'); continue; }
          if (d.ok) { d.el.className = 'tk is-ok'; pos++; }
          else { d.el.className = 'tk is-bad'; rejected = true; }
          await sleep(85);
          if (!alive()) return;
        }
        await sleep(rejected ? 380 : 120);
        if (!alive()) return;
        drafts.forEach(d => { if (d.el.classList.contains('is-bad') || d.el.classList.contains('is-dropped')) d.el.remove(); });
        $$('.tk.is-ok', out).forEach(el => { el.className = 'tk is-free'; });
        // the target's own token: the correction, or a bonus token after a clean sweep
        if (pos < target.length) { tok(target[pos], 'is-fix'); pos++; }
        S.steps.textContent = passes;
        S.tpp.textContent = (pos / passes).toFixed(2);
        S.speed.textContent = `${(pos / passes).toFixed(1)}×`;
        await sleep(160);
        if (!alive()) return;
        $$('.tk.is-fix', out).forEach(el => { el.className = 'tk is-target'; });
      }
    }

    let deb;
    const restart = () => { showParams(); clearTimeout(deb); deb = setTimeout(run, 280); };
    kIn.addEventListener('input', restart);
    aIn.addEventListener('input', restart);
    $('[data-spec-run]', root).addEventListener('click', () => { showParams(); run(); });
    showParams();
    new IntersectionObserver(([en], obs) => { if (en.isIntersecting) { obs.disconnect(); run(); } }, { threshold: 0.35 }).observe(root);
  })();

  /* ======================================================================
     2. This visit, traced
     ====================================================================== */
  (function trace() {
    const root = $('#trace');
    if (!root || !('performance' in window) || !performance.getEntriesByType) return;
    const rowsEl = $('[data-trace-rows]', root), sumEl = $('[data-trace-sum]', root), scaleEl = $('[data-trace-scale]', root);

    function describe(entry) {
      let u;
      try { u = new URL(entry.name); } catch (_) { return null; }
      const file = decodeURIComponent(u.pathname.split('/').pop() || u.pathname);
      if (u.origin === location.origin) {
        if (u.pathname.startsWith('/api/')) return { name: u.pathname.replace('/api/', ''), svc: 'netlify fn', kind: 'fn' };
        return { name: file || '/', svc: 'netlify edge', kind: 'edge' };
      }
      const host = u.hostname;
      if (host === 'fonts.googleapis.com') return { name: 'font stylesheet', svc: 'google fonts', kind: 'ext' };
      if (host === 'fonts.gstatic.com') return { name: 'font files', svc: 'google fonts', kind: 'ext', group: 'fonts' };
      if (host === 'api.github.com') {
        const pretty = { vLLM_Inference_Engine: 'PageServe', 'Vectorless-RAGs': 'Vectorless RAG' }[file] || file;
        return { name: `stars · ${pretty}`, svc: 'github api', kind: 'ext' };
      }
      if (host.includes('github-contributions')) return { name: 'contributions', svc: 'github', kind: 'ext' };
      if (host === 'i.scdn.co') return { name: 'album art', svc: 'spotify cdn', kind: 'ext' };
      return { name: file || host, svc: host.replace(/^www\./, ''), kind: 'ext' };
    }

    function build() {
      const nav = performance.getEntriesByType('navigation')[0];
      if (!nav) return;
      const spans = [];
      const phase = (name, s, e, kind = 'net') => { if (e > s && e - s >= 0.3) spans.push({ name, svc: kind === 'dom' ? 'browser' : 'network', kind, start: s, end: e, depth: 1 }); };
      phase('dns lookup', nav.domainLookupStart, nav.domainLookupEnd);
      phase('tcp connect', nav.connectStart, nav.secureConnectionStart || nav.connectEnd);
      if (nav.secureConnectionStart) phase('tls handshake', nav.secureConnectionStart, nav.connectEnd);
      phase('waiting for first byte', nav.requestStart, nav.responseStart);
      phase('html download', nav.responseStart, nav.responseEnd);
      phase('parse → interactive', nav.responseEnd, nav.domInteractive, 'dom');

      // resources, fonts collapsed into one span
      const groups = {};
      performance.getEntriesByType('resource').forEach(r => {
        if (r.name.startsWith('data:')) return;
        const d = describe(r);
        if (!d) return;
        const span = { ...d, start: r.startTime, end: r.responseEnd || r.startTime + r.duration, depth: 1, bytes: r.transferSize || 0 };
        if (d.group) {
          const g = groups[d.group] || (groups[d.group] = { ...span, count: 0 });
          g.start = Math.min(g.start, span.start); g.end = Math.max(g.end, span.end); g.bytes += span.bytes; g.count++;
        } else spans.push(span);
      });
      Object.values(groups).forEach(g => { g.name = `${g.name} ×${g.count}`; spans.push(g); });

      spans.sort((x, y) => x.start - y.start);
      const shown = spans.slice(0, 18);
      const end = Math.max(nav.loadEventEnd || nav.domComplete, ...shown.map(s => s.end));
      shown.unshift({ name: `GET ${location.host}${location.pathname}`, svc: 'page load', kind: 'root', start: 0, end, depth: 0 });

      const pct = v => `${((v / end) * 100).toFixed(3)}%`;
      rowsEl.innerHTML = shown.map(s => `
        <li class="tr tr--${s.kind}" title="${esc(`${s.name}: starts at ${s.start.toFixed(1)} ms, takes ${(s.end - s.start).toFixed(1)} ms`)}">
          <span class="tr__name${s.depth ? ' is-child' : ''}">${esc(s.name)}</span>
          <span class="tr__svc">${esc(s.svc)}</span>
          <span class="tr__track"><i style="left:${pct(s.start)};width:max(2px, ${pct(s.end - s.start)})"></i></span>
          <span class="tr__ms">${(s.end - s.start) < 10 ? (s.end - s.start).toFixed(1) : Math.round(s.end - s.start)}</span>
        </li>`).join('');
      scaleEl.innerHTML = `<span>0</span><span>${Math.round(end / 2)}</span><span>${Math.round(end)} ms</span>`;

      const all = performance.getEntriesByType('resource');
      const bytes = (nav.transferSize || 0) + all.reduce((n, r) => n + (r.transferSize || 0), 0);
      const proto = { h2: 'HTTP/2', h3: 'HTTP/3', 'http/1.1': 'HTTP/1.1' }[nav.nextHopProtocol] || nav.nextHopProtocol || '';
      const ttfb = nav.responseStart - nav.requestStart;
      const parts = [
        `<b>${shown.length}</b> spans`,
        `<b>${all.length + 1}</b> requests`,
        bytes > 1024 ? `<b>${Math.round(bytes / 1024)} KB</b> over the wire` : '<b>mostly cache hits</b>',
        `TTFB <b>${ttfb.toFixed(0)} ms</b>`,
        proto ? `<b>${esc(proto)}</b>` : '',
        'served from Netlify’s edge',
        '<b>0</b> frameworks',
      ].filter(Boolean);
      sumEl.innerHTML = parts.map(p => `<span>${p}</span>`).join('');
      root.classList.add('is-ready');
    }

    // Draw once the page (and its late fetches) have settled and the section is near view.
    const ready = () => new Promise(r => (document.readyState === 'complete' ? r() : window.addEventListener('load', r, { once: true })));
    new IntersectionObserver(([en], obs) => {
      if (!en.isIntersecting) return;
      obs.disconnect();
      ready().then(() => setTimeout(build, 300));
    }, { rootMargin: '0px 0px 200px 0px' }).observe(root);
  })();
})();
