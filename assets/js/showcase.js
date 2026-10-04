/* Showcase: speculative decoding, simulated live (Lab). */
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
      S.steps.textContent = '0'; S.tpp.textContent = '…'; S.speed.textContent = '…';

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

})();
