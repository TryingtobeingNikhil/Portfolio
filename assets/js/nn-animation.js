'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ═══════════════════════════════════════════════════════════
  // CONFIGURATION — all magic numbers live here
  // ═══════════════════════════════════════════════════════════

  const CFG = {
    // Network topology
    LAYERS_DESKTOP:        [4, 6, 6, 5, 3],
    LAYERS_MOBILE:         [3, 4, 4, 3],
    MOBILE_BREAKPOINT:     768,

    // Node
    NODE_R:                4,        // base radius (px)
    NODE_R_PULSE:          5.5,      // peak pulse radius
    NODE_PULSE_SPEED:      0.013,    // phase increment per frame (~8s per cycle at 60fps)
    NODE_FILL_ALPHA:       0.14,
    NODE_STROKE_ALPHA:     0.26,
    NODE_ACTIVE_DURATION:  520,      // ms: how long activation glow lasts

    // Edge
    EDGE_ALPHA_DEFAULT:    0.055,
    EDGE_ALPHA_ACTIVE:     0.30,
    EDGE_W_DEFAULT:        0.5,
    EDGE_W_ACTIVE:         1,
    EDGE_LINGER:           180,      // ms edge stays lit after signal passes

    // Signal dot
    SIGNAL_R:              2.5,
    SIGNAL_GLOW:           12,       // shadowBlur
    SIGNAL_HOP_MS:         680,      // ms to travel one layer gap

    // Spawning
    SPAWN_MIN_MS:          2600,
    SPAWN_MAX_MS:          3800,
    MAX_PASSES_DESKTOP:    5,
    MAX_PASSES_MOBILE:     3,

    // Layout
    H_MARGIN_FRAC:         0.13,     // fraction of width clipped each side
    V_SPAN_FRAC:           0.60,     // fraction of height for node column spread

    // RGB triplets for rgba()
    RGB_ACCENT:            '34, 197, 94',
    RGB_CYAN:              '74, 222, 128',
  };

  // ═══════════════════════════════════════════════════════════
  // CANVAS
  // ═══════════════════════════════════════════════════════════

  const canvas = document.getElementById('nn-canvas');
  if (!canvas) return;
  const ctx  = canvas.getContext('2d');
  const hero = document.body; // Full page container

  // ═══════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════

  let nodes        = [];   // { baseX, baseY, x, y, layer, phase, activatedAt }
  let edges        = [];   // { from, to, activeUntil }
  let activePasses = [];   // forward-pass wave objects
  let isMobile     = false;
  let isVisible    = true;
  let rafId        = null;
  let nextSpawnAt  = 0;
  let gravityTarget= null; // {x, y} relative to canvas

  // ═══════════════════════════════════════════════════════════
  // BUILD NETWORK — called on every resize
  // ═══════════════════════════════════════════════════════════

  function buildNetwork() {
    nodes        = [];
    edges        = [];
    activePasses = [];

    const W = canvas.width;
    const H = canvas.height;

    isMobile = W < CFG.MOBILE_BREAKPOINT;
    const layerSizes = isMobile ? CFG.LAYERS_MOBILE : CFG.LAYERS_DESKTOP;
    const N = layerSizes.length;

    const marginH  = W * CFG.H_MARGIN_FRAC;
    const netW     = W - marginH * 2;
    const vSpan    = H * CFG.V_SPAN_FRAC;
    const vStart   = (H - vSpan) / 2;

    // ── Node positions ──
    layerSizes.forEach((count, li) => {
      const x   = marginH + (li / (N - 1)) * netW;
      const gap = count > 1 ? vSpan / (count - 1) : 0;

      for (let ni = 0; ni < count; ni++) {
        const cx = x;
        const cy = count === 1 ? H / 2 : vStart + ni * gap;
        nodes.push({
          baseX: cx,
          baseY: cy,
          x: cx,
          y: cy,
          layer: li,
          phase: Math.random() * Math.PI * 2,   // desync pulses
          activatedAt: -Infinity,
        });
      }
    });

    // ── Fully-connected edges between consecutive layers ──
    const byLayer = layerSizes.map((_, li) => nodes.filter(n => n.layer === li));
    for (let li = 0; li < N - 1; li++) {
      byLayer[li].forEach(a =>
        byLayer[li + 1].forEach(b =>
          edges.push({ from: a, to: b, activeUntil: -Infinity })
        )
      );
    }
  }

  // ═══════════════════════════════════════════════════════════
  // SPAWN ONE FORWARD PASS
  // Picks one random node per layer → a "path" from input to output
  // ═══════════════════════════════════════════════════════════

  function spawnPass(now) {
    const N    = (isMobile ? CFG.LAYERS_MOBILE : CFG.LAYERS_DESKTOP).length;
    const path = [];

    for (let li = 0; li < N; li++) {
      const pool = nodes.filter(n => n.layer === li);
      path.push(pool[Math.floor(Math.random() * pool.length)]);
    }

    // Flash the input node immediately
    path[0].activatedAt = now;

    activePasses.push({
      path,
      hop: 0,              // which edge gap is the signal currently in
      hopStart: now,
      done: false,
    });
  }

  // ═══════════════════════════════════════════════════════════
  // UPDATE — advance each active forward pass
  // ═══════════════════════════════════════════════════════════

  function updatePasses(now) {
    activePasses.forEach(pass => {
      if (pass.done) return;

      const fromNode = pass.path[pass.hop];
      const toNode   = pass.path[pass.hop + 1];
      if (!fromNode || !toNode) { pass.done = true; return; }

      // Keep the traversed edge lit while signal is in flight
      const edge = edges.find(e => e.from === fromNode && e.to === toNode);
      if (edge) edge.activeUntil = now + CFG.EDGE_LINGER;

      // Hop complete?
      const elapsed = now - pass.hopStart;
      if (elapsed >= CFG.SIGNAL_HOP_MS) {
        toNode.activatedAt = now;    // flash destination node
        pass.hop++;
        pass.hopStart = now;
        if (pass.hop >= pass.path.length - 1) pass.done = true;
      }
    });

    activePasses = activePasses.filter(p => !p.done);
  }

  // ═══════════════════════════════════════════════════════════
  // EASING — smooth the signal travel
  // ═══════════════════════════════════════════════════════════

  function easeInOut(t) {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
  }

  // ═══════════════════════════════════════════════════════════
  // DRAW — one frame
  // ═══════════════════════════════════════════════════════════

  function draw(now, dtFactor) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ── Drift Logic ─────────────────────────────────────────
    nodes.forEach(node => {
      if (gravityTarget) {
        // Scale drift by dtFactor: same visual speed at any Hz
        const dx = gravityTarget.x - node.x;
        const dy = gravityTarget.y - node.y;
        node.x += dx * 0.005 * dtFactor;
        node.y += dy * 0.005 * dtFactor;
      } else {
        // Ease back to original positions
        const dx = node.baseX - node.x;
        const dy = node.baseY - node.y;
        node.x += dx * 0.03 * dtFactor;
        node.y += dy * 0.03 * dtFactor;
      }
    });

    // ── Edges ──────────────────────────────────────────────
    // Draw all edges; active ones light up
    edges.forEach(edge => {
      const active = now < edge.activeUntil;
      ctx.beginPath();
      ctx.moveTo(edge.from.x, edge.from.y);
      ctx.lineTo(edge.to.x,   edge.to.y);
      ctx.strokeStyle = `rgba(${CFG.RGB_ACCENT}, ${active ? CFG.EDGE_ALPHA_ACTIVE : CFG.EDGE_ALPHA_DEFAULT})`;
      ctx.lineWidth   = active ? CFG.EDGE_W_ACTIVE : CFG.EDGE_W_DEFAULT;
      ctx.stroke();
    });

    // ── Signal dots ─────────────────────────────────────────
    // One glowing cyan dot per in-flight pass hop
    activePasses.forEach(pass => {
      if (pass.done) return;
      const from = pass.path[pass.hop];
      const to   = pass.path[pass.hop + 1];
      if (!from || !to) return;

      const t = easeInOut(Math.min((now - pass.hopStart) / CFG.SIGNAL_HOP_MS, 1));
      const x = from.x + (to.x - from.x) * t;
      const y = from.y + (to.y - from.y) * t;

      ctx.save();
      ctx.shadowColor = `rgba(${CFG.RGB_CYAN}, 0.92)`;
      ctx.shadowBlur  = CFG.SIGNAL_GLOW;
      ctx.beginPath();
      ctx.arc(x, y, CFG.SIGNAL_R, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${CFG.RGB_CYAN}, 0.95)`;
      ctx.fill();
      ctx.restore();
    });

    // ── Nodes ───────────────────────────────────────────────
    nodes.forEach(node => {
      // Advance individual pulse phase — scale by dtFactor for Hz-independence
      node.phase += CFG.NODE_PULSE_SPEED * dtFactor;

      const pulse      = (Math.sin(node.phase) + 1) / 2;                               // 0..1
      const actFrac    = Math.max(0, 1 - (now - node.activatedAt) / CFG.NODE_ACTIVE_DURATION);
      const isActive   = actFrac > 0;

      const r          = isActive
        ? CFG.NODE_R + 3.5 * actFrac
        : CFG.NODE_R + (CFG.NODE_R_PULSE - CFG.NODE_R) * pulse * 0.55;

      const fillAlpha  = isActive
        ? CFG.NODE_FILL_ALPHA + (0.85 - CFG.NODE_FILL_ALPHA) * actFrac
        : CFG.NODE_FILL_ALPHA + 0.09 * pulse;

      const ringAlpha  = isActive
        ? CFG.NODE_STROKE_ALPHA + (0.88 - CFG.NODE_STROKE_ALPHA) * actFrac
        : CFG.NODE_STROKE_ALPHA;

      // Cyan scatter-glow halo on activation
      if (isActive) {
        ctx.save();
        ctx.shadowColor = `rgba(${CFG.RGB_CYAN}, ${0.7 * actFrac})`;
        ctx.shadowBlur  = 20;
        ctx.beginPath();
        ctx.arc(node.x, node.y, r + 4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${CFG.RGB_CYAN}, ${0.10 * actFrac})`;
        ctx.fill();
        ctx.restore();
      }

      // Node body
      ctx.save();
      if (isActive) {
        ctx.shadowColor = `rgba(${CFG.RGB_ACCENT}, ${0.7 * actFrac})`;
        ctx.shadowBlur  = 10;
      }
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle   = `rgba(${CFG.RGB_ACCENT}, ${fillAlpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${CFG.RGB_ACCENT}, ${ringAlpha})`;
      ctx.lineWidth   = 1;
      ctx.stroke();
      ctx.restore();
    });
  }

  // ═══════════════════════════════════════════════════════════
  // ANIMATION LOOP
  // ═══════════════════════════════════════════════════════════

  function loop(now) {
    if (!isVisible) { rafId = null; return; }

    // ── Delta-time normalisation ────────────────────────────
    // BUG-13: Use === undefined (not falsiness) so timestamp 0 doesn't re-init
    if (loop._lastNow === undefined) loop._lastNow = now;
    const rawDt = now - loop._lastNow;
    loop._lastNow = now;
    const dt = Math.min(rawDt, 50);
    const dtFactor = dt / 16.667; // 1.0 @ 60fps, ~0.42 @ 144fps

    const maxPasses = isMobile ? CFG.MAX_PASSES_MOBILE : CFG.MAX_PASSES_DESKTOP;

    // Spawn new forward pass on schedule
    if (now >= nextSpawnAt && activePasses.length < maxPasses) {
      spawnPass(now);
      nextSpawnAt = now + CFG.SPAWN_MIN_MS + Math.random() * (CFG.SPAWN_MAX_MS - CFG.SPAWN_MIN_MS);
    }

    updatePasses(now);
    draw(now, dtFactor);

    rafId = requestAnimationFrame(loop);
  }

  // ═══════════════════════════════════════════════════════════
  // RESIZE — recalculate everything
  // ═══════════════════════════════════════════════════════════

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    buildNetwork();
  }

  // ═══════════════════════════════════════════════════════════
  // INTERSECTION OBSERVER — run when body visible
  // ═══════════════════════════════════════════════════════════

  new IntersectionObserver(entries => {
    isVisible = entries[0].isIntersecting;
    if (isVisible && !rafId) {
      nextSpawnAt = performance.now() + 300;
      loop._lastNow = undefined; // BUG-13: reset so dt doesn't spike on resume
      rafId = requestAnimationFrame(loop);
    }
  }, { threshold: 0.01 }).observe(document.body);

  // BUG-13: Also reset on tab visible so hidden→shown dt spike is prevented
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && isVisible && !rafId) {
      loop._lastNow = undefined;
      rafId = requestAnimationFrame(loop);
    }
  });

  // ═══════════════════════════════════════════════════════════
  // RESIZE OBSERVER — recompute node layout on hero size change
  // ═══════════════════════════════════════════════════════════

  new ResizeObserver(() => resize()).observe(document.body);

  // ═══════════════════════════════════════════════════════════
  // GRAVITY HOOK
  // ═══════════════════════════════════════════════════════════

  window.focusBackground = function(element) {
    if (element) {
      const rect = element.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      gravityTarget = {
        x: rect.left + rect.width / 2 - canvasRect.left,
        y: rect.top + rect.height / 2 - canvasRect.top
      };
    } else {
      gravityTarget = null;
    }
  };

  // ═══════════════════════════════════════════════════════════
  // INIT
  // ═══════════════════════════════════════════════════════════

  resize();
  nextSpawnAt = performance.now() + 500;   // slight warmup delay
  rafId = requestAnimationFrame(loop);

});
