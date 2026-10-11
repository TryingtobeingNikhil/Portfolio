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

  /* ---------------- name plaques on the dojo board ---------------- */
  // Small and light, so they swing quicker than the ema. A cursor brushing past
  // knocks one, it knocks its neighbour on the same rail, and the first time the
  // board comes into view a gust runs along each rail.
  (function plaques() {
    const board = document.querySelector('.stack');
    if (!board) return;
    const rows = $$('.pills', board).map(ul => $$('li', ul).map((el, i) => ({ el, th: 0, om: 0, ph: Math.random() * 6 + i })));
    const all = rows.flat();
    let raf = 0, last = 0, time = 0, onScreen = false, gusted = false, hx = -1, ht = 0;
    const tick = now => {
      raf = 0;
      const dt = Math.min(0.033, (now - (last || now)) / 1000); last = now; time += dt;
      let moving = false;
      rows.forEach(row => row.forEach((it, i) => {
        const breeze = Math.sin(time * 0.9 + it.ph) * 0.05;
        it.om += (-26 * Math.sin(it.th) - 2.2 * it.om + breeze) * dt;
        it.th = Math.max(-0.4, Math.min(0.4, it.th + it.om * dt));
        const nb = row[i + 1];
        if (nb && it.th < -0.1 && it.om < -0.5) { nb.om += it.om * 0.18; it.om *= 0.75; }
        const pv = row[i - 1];
        if (pv && it.th > 0.1 && it.om > 0.5) { pv.om += it.om * 0.18; it.om *= 0.75; }
        it.el.style.setProperty('--swing', `${it.th.toFixed(4)}rad`);
        if (Math.abs(it.om) > 0.004) moving = true;
      }));
      if (onScreen || moving) raf = requestAnimationFrame(tick); else last = 0;
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
    board.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const now = performance.now();
      if (hx >= 0 && now - ht < 80) {
        const vx = Math.max(-3, Math.min(3, (e.clientX - hx) / Math.max(4, now - ht)));
        const it = all.find(x => x.el.contains(e.target));
        if (it) it.om -= vx * 0.16;
      }
      hx = e.clientX; ht = now; wake();
    });
    board.addEventListener('pointerleave', () => { hx = -1; });
    // a tap sets one rocking, for touch screens
    board.addEventListener('pointerdown', e => { const it = all.find(x => x.el.contains(e.target)); if (it) { it.om += 1.4; wake(); } });
    new IntersectionObserver(([en]) => {
      onScreen = en.isIntersecting;
      if (onScreen && !gusted) {
        gusted = true;
        rows.forEach(row => row.forEach((it, i) => setTimeout(() => { it.om -= 0.9; wake(); }, 250 + i * 90)));
      }
      if (onScreen) wake();
    }, { threshold: 0.25 }).observe(board);
  })();

  /* ---------------- festival lanterns in Elsewhere ---------------- */
  // Each hangs on its own string from the rope: a breeze, a knock from the
  // cursor going past, and a proper swing when you hover one.
  (function lanterns() {
    const rope = document.querySelector('.lanterns');
    if (!rope) return;
    const items = $$('.lamp', rope).map((el, i) => ({ el, th: 0, om: 0, ph: i * 1.3 }));
    let raf = 0, last = 0, time = 0, onScreen = false, hx = -1, ht = 0;
    const tick = now => {
      raf = 0;
      const dt = Math.min(0.033, (now - (last || now)) / 1000); last = now; time += dt;
      let moving = false;
      items.forEach(it => {
        it.om += (-14 * Math.sin(it.th) - 1.3 * it.om + Math.sin(time * 0.7 + it.ph) * 0.04) * dt;
        it.th = Math.max(-0.45, Math.min(0.45, it.th + it.om * dt));
        it.el.style.setProperty('--swing', `${it.th.toFixed(4)}rad`);
        if (Math.abs(it.om) > 0.004) moving = true;
      });
      if (onScreen || moving) raf = requestAnimationFrame(tick); else last = 0;
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };
    const find = t => items.find(x => x.el.parentElement.contains(t));
    rope.addEventListener('pointermove', e => {
      if (e.pointerType !== 'mouse') return;
      const now = performance.now();
      if (hx >= 0 && now - ht < 80) { const it = find(e.target); if (it) it.om -= Math.max(-3, Math.min(3, (e.clientX - hx) / Math.max(4, now - ht))) * 0.12; }
      hx = e.clientX; ht = now; wake();
    });
    rope.addEventListener('pointerleave', () => { hx = -1; });
    rope.addEventListener('pointerover', e => { const it = find(e.target); if (it && e.relatedTarget && !it.el.parentElement.contains(e.relatedTarget)) { it.om += 0.5 * (Math.random() < 0.5 ? -1 : 1); wake(); } });
    new IntersectionObserver(([en]) => { onScreen = en.isIntersecting; if (onScreen) wake(); }).observe(rope);
  })();

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
