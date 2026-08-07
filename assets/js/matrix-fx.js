'use strict';

/**
 * matrix-fx.js  — v2 (clean rewrite)
 * ─────────────────────────────────────────────────────────────────
 * Key principle: clearRect() every frame. Trail state lives in JS
 * arrays, NEVER accumulated on the canvas. This eliminates ghosts,
 * ensures consistent appearance across all scroll sections, and
 * plays nicely with any z-index / blend-mode setup.
 *
 * Modules:
 *   CursorTracker  — smooth lerp cursor
 *   WaterfallSystem — very subtle binary rain columns
 *   TrailSystem     — cursor-following binary digit trail
 *   MatrixRenderer  — single rAF owner
 * ─────────────────────────────────────────────────────────────────
 */
(function MatrixFX() {

  /* ─────────────────────────────────────────────────────────────
     CONFIG
  ───────────────────────────────────────────────────────────── */
  const CFG = {
    // Waterfall
    COL_W:           22,      // px per column
    ACTIVE_FRAC:     0.10,    // only 10 % of columns running at once  ← subtle
    TRAIL_LEN:       10,      // characters per column trail
    COL_SPEED_MIN:   0.8,
    COL_SPEED_MAX:   2.2,
    COL_HEAD_ALPHA:  0.55,    // brightness of leading char
    COL_TAIL_ALPHA:  0.10,    // brightness of trailing chars
    FONT_SIZE:       12,      // px

    // Cursor trail
    LERP:            0.09,    // cursor smoothing (lower = more lag/smoothness)
    SPAWN_RATE:      2,       // particles per frame while moving
    MAX_PARTICLES:   180,
    LIFE_MIN:        45,
    LIFE_MAX:        80,
    DRIFT_UP:        0.5,     // upward float speed
    WOBBLE:          0.25,
    SIZE_MIN:        9,
    SIZE_MAX:        13,
    SPAWN_RADIUS:    16,
    ALPHA_START:     0.65,
    MOVE_THRESH:     2.5,     // min delta px to spawn

    // Palette  (matches portfolio --accent #22c55e, --accent-hi #86efac)
    COLOR_HEAD:      'rgba(134,239,172,',  // bright tip
    COLOR_BODY:      'rgba(34,197,94,',    // column body
    COLOR_TRAIL:     'rgba(134,239,172,',  // cursor trail

    MOBILE_W:        768,
    REDUCED_SPEED:   0.2,     // multiplier when prefers-reduced-motion
  };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const mobile  = () => window.innerWidth < CFG.MOBILE_W;

  /* ─────────────────────────────────────────────────────────────
     CursorTracker
  ───────────────────────────────────────────────────────────── */
  class CursorTracker {
    constructor() {
      this.rx = -999; this.ry = -999;   // raw
      this.sx = -999; this.sy = -999;   // smoothed (lerped)
      this.px = -999; this.py = -999;   // previous smoothed
      this.on = false;

      if (!reduced && !mobile()) {
        window.addEventListener('mousemove', e => {
          this.rx = e.clientX; this.ry = e.clientY; this.on = true;
        }, { passive: true });
        document.addEventListener('mouseleave', () => { this.on = false; });
      }
    }
    update(dtFactor) {
      this.px = this.sx; this.py = this.sy;
      // LERP scaled by dtFactor: same smoothing speed at any Hz
      const lerpT = 1 - Math.pow(1 - CFG.LERP, dtFactor);
      this.sx += (this.rx - this.sx) * lerpT;
      this.sy += (this.ry - this.sy) * lerpT;
    }
    get delta() { return Math.hypot(this.sx - this.px, this.sy - this.py); }
  }

  /* ─────────────────────────────────────────────────────────────
     WaterfallSystem — columns store their own trail data in JS
  ───────────────────────────────────────────────────────────── */
  class WaterfallColumn {
    constructor(x) {
      this.x = x;
      this.active = false;
      this.segs = [];   // [{char, y}]
      this.headY = 0;
      this.speed = 1;
    }

    activate(canvasH) {
      this.active = true;
      this.headY  = -CFG.FONT_SIZE;
      this.segs   = [];
      this.canvasH = canvasH;
      const spd   = CFG.COL_SPEED_MIN + Math.random() * (CFG.COL_SPEED_MAX - CFG.COL_SPEED_MIN);
      this.speed  = reduced ? spd * CFG.REDUCED_SPEED : spd;
    }

    update(dtFactor) {
      if (!this.active) return;

      // Column moves at speed px/frame@60fps → scale by dtFactor
      this.headY += this.speed * dtFactor;

      // Add a new segment at increments of FONT_SIZE
      const last = this.segs[this.segs.length - 1];
      if (!last || this.headY - last.y >= CFG.FONT_SIZE) {
        this.segs.push({ char: Math.random() < 0.5 ? '0' : '1', y: this.headY });
        if (this.segs.length > CFG.TRAIL_LEN) this.segs.shift();
      }

      // Done when head exits viewport
      if (this.headY > this.canvasH + CFG.TRAIL_LEN * CFG.FONT_SIZE) {
        this.active = false;
        this.segs   = [];
      }
    }

    draw(ctx) {
      if (!this.active && this.segs.length === 0) return;
      const len = this.segs.length;
      ctx.font = `${CFG.FONT_SIZE}px 'JetBrains Mono',monospace`;
      ctx.textBaseline = 'top';

      this.segs.forEach((seg, i) => {
        const isHead = i === len - 1;
        const t      = i / Math.max(len - 1, 1);   // 0=tail → 1=head
        if (isHead) {
          // Bright leading character
          ctx.fillStyle = CFG.COLOR_HEAD + CFG.COL_HEAD_ALPHA + ')';
        } else {
          // Linear fade from head brightness down to tail
          const a = CFG.COL_TAIL_ALPHA + (CFG.COL_HEAD_ALPHA - CFG.COL_TAIL_ALPHA) * t;
          ctx.fillStyle = CFG.COLOR_BODY + a.toFixed(3) + ')';
        }
        ctx.fillText(seg.char, this.x, seg.y);
      });
    }
  }

  class WaterfallSystem {
    constructor() {
      this.cols = [];
      this._frame = 0;
    }

    resize(w, h) {
      this._h   = h;
      const n   = Math.floor(w / CFG.COL_W);
      // Rebuild columns, preserving active state where possible
      const old = this.cols;
      this.cols = [];
      for (let i = 0; i < n; i++) {
        const col = new WaterfallColumn(i * CFG.COL_W);
        if (old[i] && old[i].active) {
          // carry over running state
          col.active  = true;
          col.headY   = old[i].headY;
          col.segs    = old[i].segs;
          col.speed   = old[i].speed;
          col.canvasH = h;
        }
        this.cols.push(col);
      }
      // Seed initial active columns so screen isn't blank on load
      this._seed();
    }

    _seed() {
      const target  = Math.max(1, Math.floor(this.cols.length * CFG.ACTIVE_FRAC));
      const dormant = this.cols.filter(c => !c.active);
      // shuffle dormant and activate `target` of them at random Y positions
      dormant.sort(() => Math.random() - 0.5)
             .slice(0, target)
             .forEach(c => {
               c.activate(this._h);
               // scatter already mid-stream so we don't see a single "wave" appear
               c.headY = Math.random() * this._h;
             });
    }

    update(dtFactor) {
      // Accumulate elapsed frames (normalised to 60fps) so reactivation
      // fires at the same real-time interval on any refresh rate
      this._frameAcc = (this._frameAcc || 0) + dtFactor;

      // Reactivate dormant columns to maintain target density
      if (this._frameAcc >= 12) {
        this._frameAcc -= 12;
        const active  = this.cols.filter(c => c.active).length;
        const target  = Math.max(1, Math.floor(this.cols.length * CFG.ACTIVE_FRAC));
        if (active < target) {
          const dormant = this.cols.filter(c => !c.active);
          if (dormant.length) {
            const pick = dormant[Math.floor(Math.random() * dormant.length)];
            pick.activate(this._h);
          }
        }
      }

      this.cols.forEach(c => c.update(dtFactor));
    }

    draw(ctx) {
      this.cols.forEach(c => c.draw(ctx));
    }
  }

  /* ─────────────────────────────────────────────────────────────
     TrailParticle — cursor binary digit
  ───────────────────────────────────────────────────────────── */
  class TrailParticle {
    constructor() { this.alive = false; }

    spawn(x, y) {
      const r     = CFG.SPAWN_RADIUS;
      this.x      = x + (Math.random() - 0.5) * r * 2;
      this.y      = y + (Math.random() - 0.5) * r;
      this.vx     = (Math.random() - 0.5) * CFG.WOBBLE;
      this.vy     = -(CFG.DRIFT_UP + Math.random() * 0.4);
      this.life   = CFG.LIFE_MIN + Math.random() * (CFG.LIFE_MAX - CFG.LIFE_MIN) | 0;
      this.maxL   = this.life;
      this.char   = Math.random() < 0.5 ? '0' : '1';
      this.size   = CFG.SIZE_MIN + Math.random() * (CFG.SIZE_MAX - CFG.SIZE_MIN);
      this.phase  = Math.random() * Math.PI * 2;
      this.alive  = true;
    }

    update(dtFactor) {
      if (!this.alive) return;
      // Phase and position advance scaled by dtFactor
      this.phase += 0.07 * dtFactor;
      this.x += (this.vx + Math.sin(this.phase) * 0.12) * dtFactor;
      this.y += this.vy * dtFactor;
      // Lifetime counts in normalised 60fps-frames so it lasts same real time
      this.life -= dtFactor;
      if (this.life <= 0) this.alive = false;
    }

    draw(ctx) {
      if (!this.alive) return;
      const t   = this.life / this.maxL;            // 1 → 0
      const a   = t * t * CFG.ALPHA_START;          // ease-out squared, no accumulation
      ctx.font         = `${this.size}px 'JetBrains Mono',monospace`;
      ctx.textBaseline = 'middle';
      ctx.fillStyle    = CFG.COLOR_TRAIL + a.toFixed(3) + ')';
      ctx.fillText(this.char, this.x, this.y);
    }
  }

  class TrailSystem {
    constructor() { this.pool = []; this._frame = 0; }

    spawn(x, y, count) {
      if (reduced || mobile()) return;
      for (let i = 0; i < count; i++) {
        let p = this.pool.find(p => !p.alive);
        if (!p) {
          if (this.pool.length >= CFG.MAX_PARTICLES) continue;
          p = new TrailParticle();
          this.pool.push(p);
        }
        p.spawn(x, y);
      }
    }

    update(dtFactor) {
      this.pool.forEach(p => p.update(dtFactor));
      // Cleanup dead particles every ~90 normalised frames
      this._acc = (this._acc || 0) + dtFactor;
      if (this._acc >= 90) {
        this._acc -= 90;
        this.pool = this.pool.filter(p => p.alive);
      }
    }

    draw(ctx) {
      this.pool.forEach(p => p.draw(ctx));
    }
  }

  /* ─────────────────────────────────────────────────────────────
     MatrixRenderer — owns the canvas, runs the loop
  ───────────────────────────────────────────────────────────── */
  class MatrixRenderer {
    constructor(canvas) {
      this.canvas  = canvas;
      this.ctx     = canvas.getContext('2d');
      this.cursor  = new CursorTracker();
      this.water   = new WaterfallSystem();
      this.trail   = new TrailSystem();
      this.running = false;
      this.rafId   = null;
      this._resize();
      this._bind();
    }

    _resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w   = window.innerWidth;
      const h   = window.innerHeight;

      this.canvas.style.width  = w + 'px';
      this.canvas.style.height = h + 'px';
      this.canvas.width        = Math.round(w * dpr);
      this.canvas.height       = Math.round(h * dpr);

      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.scale(dpr, dpr);

      this._W = w;
      this._H = h;

      this.water.resize(w, h);
    }

    _bind() {
      let t; window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(() => this._resize(), 150); }, { passive: true });

      // Pause when page is hidden
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) this.stop(); else this.start();
      });

      // Pause when body scrolls out of view (tab switch, etc.)
      new IntersectionObserver(entries => {
        const v = entries[0].isIntersecting;
        if (v && !this.running) this.start();
        if (!v && this.running) this.stop();
      }, { threshold: 0.01 }).observe(document.body);
    }

    _tick(now) {
      const ctx = this.ctx;
      const W   = this._W;
      const H   = this._H;

      // ── Delta-time normalisation ──────────────────────────────
      if (!this._lastTick) this._lastTick = now;
      const rawDt = now - this._lastTick;
      this._lastTick = now;
      // Cap to 50ms to avoid a burst after tab switch
      const dt = Math.min(rawDt, 50);
      // 1.0 at 60fps, ~0.42 at 144fps
      const dtFactor = dt / 16.667;

      // Full clear every frame — NO ghost accumulation
      ctx.clearRect(0, 0, W, H);

      // Update
      this.cursor.update(dtFactor);
      if (this.cursor.on && this.cursor.delta > CFG.MOVE_THRESH) {
        this.trail.spawn(this.cursor.sx, this.cursor.sy, CFG.SPAWN_RATE);
      }
      this.water.update(dtFactor);
      this.trail.update(dtFactor);

      // Draw — waterfall first, then cursor trail on top
      this.water.draw(ctx);
      this.trail.draw(ctx);

      this.rafId = requestAnimationFrame((t) => this._tick(t));
    }

    start() {
      if (this.running) return;
      this.running = true;
      this._lastTick = null; // reset so first dt doesn't spike
      this.rafId   = requestAnimationFrame((t) => this._tick(t));
    }

    stop() {
      this.running = false;
      if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    }
  }

  /* ─────────────────────────────────────────────────────────────
     BOOT
  ───────────────────────────────────────────────────────────── */
  function init() {
    const canvas = document.getElementById('matrix-canvas');
    if (!canvas) { console.warn('[matrix-fx] canvas not found'); return; }
    new MatrixRenderer(canvas).start();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
