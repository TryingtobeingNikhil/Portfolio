/* Binary cursor trail, carried over from the old site (matrix-fx.js).
   A smoothed cursor sheds 0s and 1s that drift upward, wobble and fade.
   Trail state lives in JS; the canvas is cleared every frame, and the
   loop stops entirely once every digit has faded and the mouse is still.
   Off on touch devices and for prefers-reduced-motion. */
(() => {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!fine || reduce) return;

  const CFG = {
    LERP: 0.09,          // cursor smoothing (lower = more lag)
    SPAWN_RATE: 2,       // digits per frame while moving
    MAX: 180,
    LIFE_MIN: 45,        // in 60fps frames
    LIFE_MAX: 80,
    DRIFT_UP: 0.5,
    WOBBLE: 0.25,
    SIZE_MIN: 9,
    SIZE_MAX: 13,
    SPAWN_RADIUS: 16,
    ALPHA: 0.65,
    MOVE_THRESH: 2.5,    // px the smoothed cursor must move to spawn
    COLOR: '88, 242, 155',
  };

  const canvas = document.createElement('canvas');
  canvas.className = 'cursor-trail';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  let W = 0, H = 0;
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.textBaseline = 'middle';
  }
  resize();
  let rt;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(resize, 150); }, { passive: true });

  const cur = { rx: -999, ry: -999, sx: -999, sy: -999, on: false };
  const pool = [];
  let raf = 0, last = 0;

  function spawn(x, y) {
    let p = pool.find(q => !q.alive);
    if (!p) { if (pool.length >= CFG.MAX) return; p = {}; pool.push(p); }
    p.x = x + (Math.random() - 0.5) * CFG.SPAWN_RADIUS * 2;
    p.y = y + (Math.random() - 0.5) * CFG.SPAWN_RADIUS;
    p.vx = (Math.random() - 0.5) * CFG.WOBBLE;
    p.vy = -(CFG.DRIFT_UP + Math.random() * 0.4);
    p.life = p.max = CFG.LIFE_MIN + Math.random() * (CFG.LIFE_MAX - CFG.LIFE_MIN);
    p.ch = Math.random() < 0.5 ? '0' : '1';
    p.size = Math.round(CFG.SIZE_MIN + Math.random() * (CFG.SIZE_MAX - CFG.SIZE_MIN));
    p.phase = Math.random() * Math.PI * 2;
    p.alive = true;
  }

  function frame(now) {
    raf = 0;
    const f = Math.min(now - (last || now), 50) / (1000 / 60); // 1.0 at 60fps
    last = now;

    // smoothed cursor; spawn while it's still travelling
    const px = cur.sx, py = cur.sy;
    const k = 1 - Math.pow(1 - CFG.LERP, f);
    cur.sx += (cur.rx - cur.sx) * k;
    cur.sy += (cur.ry - cur.sy) * k;
    const moving = cur.on && Math.hypot(cur.sx - px, cur.sy - py) > CFG.MOVE_THRESH;
    if (moving) for (let i = 0; i < CFG.SPAWN_RATE; i++) spawn(cur.sx, cur.sy);

    ctx.clearRect(0, 0, W, H);
    let alive = 0, font = 0;
    for (const p of pool) {
      if (!p.alive) continue;
      p.phase += 0.07 * f;
      p.x += (p.vx + Math.sin(p.phase) * 0.12) * f;
      p.y += p.vy * f;
      p.life -= f;
      if (p.life <= 0) { p.alive = false; continue; }
      alive++;
      const t = p.life / p.max;
      if (p.size !== font) { ctx.font = `${p.size}px 'Geist Mono', ui-monospace, monospace`; font = p.size; }
      ctx.fillStyle = `rgba(${CFG.COLOR}, ${(t * t * CFG.ALPHA).toFixed(3)})`;
      ctx.fillText(p.ch, p.x, p.y);
    }

    // keep running while digits are visible or the smoothed cursor is still catching up
    const settling = cur.on && Math.hypot(cur.rx - cur.sx, cur.ry - cur.sy) > 0.5;
    if (alive || settling) raf = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, W, H);
  }
  const wake = () => { if (!raf && !document.hidden) { last = 0; raf = requestAnimationFrame(frame); } };

  window.addEventListener('mousemove', e => {
    if (!cur.on) { cur.sx = e.clientX; cur.sy = e.clientY; } // don't streak in from the corner
    cur.rx = e.clientX; cur.ry = e.clientY; cur.on = true;
    wake();
  }, { passive: true });
  document.addEventListener('mouseleave', () => { cur.on = false; });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) wake(); });
})();
