/* The middle of the walk. Shoji screens over the Lab toys that slide open
   as each one comes into view, and the ema plaques in Work, which hang on
   strings and sway: a cursor brushing past knocks them, and they knock their
   neighbours. The plaques turn over on click (chapters.js owns that). */
(() => {
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce) return;

  /* ---------------- shoji ---------------- */
  const io = new IntersectionObserver(entries => entries.forEach(en => {
    if (!en.isIntersecting) return;
    const sj = en.target.querySelector(':scope > .shoji');
    setTimeout(() => sj && sj.classList.add('is-open'), 180);
    io.unobserve(en.target);
  }), { threshold: 0.45 });
  $$('#lab .spec, #lab .toy__stage, #lab .tokz').forEach(el => {
    el.classList.add('has-shoji');
    const sj = document.createElement('div');
    sj.className = 'shoji'; sj.setAttribute('aria-hidden', 'true');
    sj.innerHTML = '<i></i><i></i>';
    sj.addEventListener('click', () => sj.classList.add('is-open'));
    el.appendChild(sj);
    io.observe(el);
  });

  /* ---------------- ema on the rack ---------------- */
  (function ema() {
    const list = document.querySelector('[data-wx-list]');
    if (!list) return;
    const items = $$('.wx', list).map((el, i) => ({ el, th: 0, om: 0, ph: i * 1.7 }));
    let raf = 0, last = 0, time = 0, onScreen = false, hx = -1, ht = 0;
    const tick = now => {
      raf = 0;
      const dt = Math.min(0.033, (now - (last || now)) / 1000); last = now; time += dt;
      let moving = false;
      items.forEach((it, i) => {
        if (it.el.hidden) return;
        const breeze = Math.sin(time * 0.8 + it.ph) * 0.02;
        it.om += (-16 * Math.sin(it.th) - 1.6 * it.om + breeze) * dt;
        it.th = Math.max(-0.35, Math.min(0.35, it.th + it.om * dt));
        // plaques that swing into the next one on the rack give it a knock
        const nb = items[i + 1];
        if (nb && !nb.el.hidden && it.th < -0.12 && it.om < -0.4) { nb.om += it.om * 0.12; it.om *= 0.8; }
        it.el.style.transform = `rotate(${it.th.toFixed(4)}rad)`;
        if (Math.abs(it.om) > 0.004) moving = true;
      });
      if (onScreen || moving) raf = requestAnimationFrame(tick); else last = 0;
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
    list.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const now = performance.now();
      if (hx >= 0 && now - ht < 80) {
        const vx = Math.max(-3, Math.min(3, (e.clientX - hx) / Math.max(4, now - ht)));
        const it = items.find(x => x.el.contains(e.target));
        if (it && !it.el.classList.contains('is-open')) it.om -= vx * 0.09;
      }
      hx = e.clientX; ht = now; wake();
    });
    list.addEventListener('pointerleave', () => { hx = -1; });
    // turning one over sets it rocking
    list.addEventListener('click', e => { const it = items.find(x => x.el.contains(e.target)); if (it) { it.om += 0.6; wake(); } });
    new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; if (onScreen) wake(); }).observe(list);
  })();
})();
