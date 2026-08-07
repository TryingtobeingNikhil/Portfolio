'use strict';

// ═══════════════════════════════════════════════════════════════════
//  SCROLL-DRIVEN ML TRAINING NARRATIVE
//  Five section canvases — purely additive, zero existing code touched
//  Each canvas is self-contained; if one throws, others keep running
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {

  // BUG-11: function instead of const — re-evaluates on every build()/resize()
  function IS_MOBILE() { return window.innerWidth < 768; }

  // ─── Shared helpers ────────────────────────────────────────────

  function createSectionCanvas(section) {
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = [
      'position:absolute',
      'inset:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      'z-index:0',
      'opacity:0',
      'transition:opacity 600ms ease',
    ].join(';');
    section.insertBefore(canvas, section.firstChild);
    return canvas;
  }

  function sizeCanvas(canvas) {
    const dpr = window.devicePixelRatio || 1;
    const w   = canvas.offsetWidth;
    const h   = canvas.offsetHeight;
    // BUG-8: return null if canvas hasn't been laid out yet (0x0 produces invisible draws)
    if (!w || !h) return null;
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    return { ctx, w, h };
  }

  // Returns array of layers; each layer is array of {x,y}
  // xStart/xEnd are fractions of canvas logical width
  function buildPositions(layerCounts, w, h, xStartFrac, xEndFrac) {
    const xStart = w * xStartFrac;
    const xEnd   = w * xEndFrac;
    return layerCounts.map((count, li) => {
      const x = xStart + (li / Math.max(layerCounts.length - 1, 1)) * (xEnd - xStart);
      return Array.from({ length: count }, (_, ni) => ({
        x,
        y: (h / (count + 1)) * (ni + 1),
      }));
    });
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  function makeObserver(canvas, section, onVisible, onHidden) {
    let animFrameId = null;
    let isVisible   = false;

    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          canvas.style.opacity = '1';
          isVisible = true;
          if (!animFrameId && onVisible) animFrameId = requestAnimationFrame(t => onVisible(t, () => { animFrameId = null; }));
        } else {
          canvas.style.opacity = '0';
          isVisible = false;
          if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
          if (onHidden) onHidden();
        }
      });
    }, { threshold: 0.1 });

    io.observe(section);
    return {
      get isVisible() { return isVisible; },
      start() {
        if (isVisible && !animFrameId && onVisible) {
          animFrameId = requestAnimationFrame(t => onVisible(t, () => { animFrameId = null; }));
        }
      },
      stop() {
        if (animFrameId) { cancelAnimationFrame(animFrameId); animFrameId = null; }
      },
      setLoop(fn) { onVisible = fn; },
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // SECTION 1 — ABOUT: "Learning"
  // Weights oscillate, signals travel forward, backprop feel
  // ═══════════════════════════════════════════════════════════════
  (() => {
    try {
      const section = document.getElementById('about');
      if (!section) return;

      const canvas = createSectionCanvas(section);
      let state = null;

      function build() {
        const sized = sizeCanvas(canvas);
        if (!sized) return; // BUG-8: not yet laid out
        const { ctx, w, h } = sized;
        const layers = IS_MOBILE() ? [2, 3, 3, 2] : [3, 5, 5, 3];

        const positions = buildPositions(layers, w, h, 0.1, 0.9);

        // Build edges with weight oscillation params
        const edges = [];
        for (let li = 0; li < positions.length - 1; li++) {
          for (const a of positions[li]) {
            for (const b of positions[li + 1]) {
              edges.push({
                from: a,
                to: b,
                baseWeight: 0.1 + Math.random() * 0.9,
                speed:       0.3 + Math.random() * 0.5,
                phase:       Math.random() * Math.PI * 2,
                weight:      0,
              });
            }
          }
        }

        // Build nodes with activation state
        const nodes = positions.flat().map((p, i) => ({
          ...p,
          pulsePhase: Math.random() * Math.PI * 2,
          layer: positions.findIndex(layer => layer.includes(p)),
        }));
        // Attach layer index properly
        positions.forEach((layer, li) => {
          layer.forEach(p => { p._layer = li; });
        });

        // Signals: each signal is a path of nodes [l0node, l1node, ...]
        const signals = [];
        let lastSignalTime = 0;

        state = { ctx, w, h, edges, nodes: positions.flat(), positions, layers, signals,
                  lastSignalTime: 0,
                  // BUG-9: schedule stored on state, not recomputed per frame
                  nextSignalAt: performance.now() + 1000 + Math.random() * 1000 };
      }

      function spawnSignal(now, s) {
        if (s.signals.length >= 2) return;
        const path = s.positions.map(layer => layer[Math.floor(Math.random() * layer.length)]);
        s.signals.push({ path, hop: 0, hopStart: now, hopDuration: 500 });
        s.lastSignalTime = now;
        // BUG-9: only randomise interval once per spawn, not every frame
        s.nextSignalAt = now + 3000 + Math.random() * 1000;
      }

      let animId = null;
      let visible = false;

      function loop(now) {
        if (!visible) { animId = null; return; }
        const s = state;
        if (!s) { animId = requestAnimationFrame(loop); return; }
        const { ctx, w, h, edges, positions, signals } = s;

        ctx.clearRect(0, 0, w, h);
        const t = now * 0.001; // seconds

        // Update edge weights
        edges.forEach(e => {
          e.weight = clamp(e.baseWeight + 0.3 * Math.sin(t * e.speed + e.phase), 0.05, 1.0);
        });

        // Compute node activation = avg of incoming edge weights
        const nodeActivation = new Map();
        positions.forEach((layer, li) => {
          layer.forEach(node => {
            if (li === 0) { nodeActivation.set(node, 0.5); return; }
            const incoming = edges.filter(e => e.to === node);
            const avg = incoming.length ? incoming.reduce((a, e) => a + e.weight, 0) / incoming.length : 0.5;
            nodeActivation.set(node, avg);
          });
        });

        // Draw edges
        edges.forEach(e => {
          const op = e.weight * 0.12;
          ctx.beginPath();
          ctx.moveTo(e.from.x, e.from.y);
          ctx.lineTo(e.to.x, e.to.y);
          ctx.strokeStyle = `rgba(34,197,94,${op})`;
          ctx.lineWidth   = e.weight * 1.5;
          ctx.stroke();
        });

        // Update & draw signals
        // BUG-9: use pre-computed schedule instead of random per frame
        if (now >= s.nextSignalAt) spawnSignal(now, s);

        s.signals = s.signals.filter(sig => {
          if (sig.hop >= sig.path.length - 1) return false;
          const elapsed = now - sig.hopStart;
          if (elapsed >= sig.hopDuration) {
            sig.hop++;
            sig.hopStart = now;
            if (sig.hop >= sig.path.length - 1) return false;
          }
          const from = sig.path[sig.hop];
          const to   = sig.path[sig.hop + 1];
          const tt   = clamp((now - sig.hopStart) / sig.hopDuration, 0, 1);
          const sx   = from.x + (to.x - from.x) * tt;
          const sy   = from.y + (to.y - from.y) * tt;
          ctx.beginPath();
          ctx.arc(sx, sy, 2, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(134,239,172,0.35)';
          ctx.fill();
          return true;
        });

        // Draw nodes
        positions.flat().forEach(node => {
          const act  = nodeActivation.get(node) || 0.5;
          const pulse = Math.sin(t * Math.PI + (node._layer || 0)) * 0.5 + 0.5; // 0..1
          const r     = 4 + pulse * 1;
          ctx.beginPath();
          ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
          ctx.fillStyle   = `rgba(34,197,94,${act * 0.25})`;
          ctx.strokeStyle = `rgba(34,197,94,${act * 0.2})`;
          ctx.lineWidth   = 1;
          ctx.fill();
          ctx.stroke();
        });

        animId = requestAnimationFrame(loop);
      }

      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            canvas.style.opacity = '1';
            if (!visible) { visible = true; build(); animId = requestAnimationFrame(loop); }
          } else {
            canvas.style.opacity = '0';
            visible = false;
            if (animId) { cancelAnimationFrame(animId); animId = null; }
          }
        });
      }, { threshold: 0.1 });
      io.observe(section);

      // Resize
      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (visible) build(); }, 200);
      });

    } catch(e) { /* self-contained */ }
  })();


  // ═══════════════════════════════════════════════════════════════
  // SECTION 2 — SKILLS: "Compression"
  // Scroll-driven pruning — edges disappear weakest-first
  // ═══════════════════════════════════════════════════════════════
  (() => {
    try {
      const section = document.getElementById('skills');
      if (!section) return;

      const canvas = createSectionCanvas(section);
      let state = null;
      let animId = null;
      let visible = false;

      function build() {
        const sized = sizeCanvas(canvas);
        if (!sized) return; // BUG-8: not yet laid out
        const { ctx, w, h } = sized;
        const layers = IS_MOBILE() ? [3, 5, 6, 5, 3] : [4, 7, 8, 7, 4];
        const positions = buildPositions(layers, w, h, 0.05, 0.95);

        const edges = [];
        for (let li = 0; li < positions.length - 1; li++) {
          for (const from of positions[li]) {
            for (const to of positions[li + 1]) {
              edges.push({
                from,
                to,
                importance:  Math.random(),
                opacity:     1.0,
                fadingOut:   false,
                fadeStart:   0,
                fadeDuration: 800,
              });
            }
          }
        }

        // Count incoming/outgoing per node
        function nodeConnectionCount(node) {
          return edges.filter(e => e.from === node || e.to === node).length;
        }

        state = { ctx, w, h, edges, positions, layers, nodeConnectionCount };
      }

      function getScrollProgress() {
        const rect = section.getBoundingClientRect();
        const progress = 1 - (rect.bottom / (rect.height + window.innerHeight));
        return clamp(progress, 0, 1);
      }

      function redraw(now) {
        if (!state) return;
        const { ctx, w, h, edges, positions } = state;
        const scrollProgress   = getScrollProgress();
        const pruningThreshold = scrollProgress * 0.85;

        ctx.clearRect(0, 0, w, h);

        // Update edge fade state
        edges.forEach(e => {
          const shouldPrune = e.importance < pruningThreshold;
          if (shouldPrune && !e.fadingOut && e.opacity > 0) {
            e.fadingOut = true;
            e.fadeStart = now;
          }
          if (e.fadingOut) {
            const elapsed = now - e.fadeStart;
            e.opacity = clamp(1 - elapsed / e.fadeDuration, 0, 1);
          } else if (!shouldPrune) {
            // Surviving edge opacity proportional to importance relative to threshold
            const denom = 1 - pruningThreshold;
            e.opacity = denom > 0 ? clamp((e.importance - pruningThreshold) / denom, 0, 1) : 1;
          }
        });

        // Compute node survival strength
        const nodeStrength = new Map();
        positions.flat().forEach(node => {
          const live = edges.filter(e => (e.from === node || e.to === node) && e.opacity > 0.05);
          const total = edges.filter(e => e.from === node || e.to === node);
          const ratio = total.length ? live.length / total.length : 0;
          nodeStrength.set(node, ratio);
        });

        // Draw edges
        edges.forEach(e => {
          if (e.opacity < 0.005) return;
          ctx.beginPath();
          ctx.moveTo(e.from.x, e.from.y);
          ctx.lineTo(e.to.x, e.to.y);
          ctx.strokeStyle = `rgba(34,197,94,${e.opacity * 0.12})`;
          ctx.lineWidth   = 0.8 + e.opacity * 0.7;
          ctx.stroke();
        });

        // Draw nodes
        positions.flat().forEach(node => {
          const strength = nodeStrength.get(node) || 0;
          const baseOp   = 0.1 + strength * 0.5;
          ctx.beginPath();
          ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
          ctx.fillStyle   = `rgba(34,197,94,${baseOp * 0.25})`;
          ctx.strokeStyle = `rgba(34,197,94,${baseOp * 0.2})`;
          ctx.lineWidth   = 1;
          ctx.fill();
          ctx.stroke();
        });

        // Text overlay
        if (scrollProgress > 0.05) {
          ctx.font      = "9px 'JetBrains Mono', monospace";
          ctx.fillStyle = 'rgba(45,79,52,0.4)';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.fillText(
            `pruning... ${Math.round(scrollProgress * 97.3)}% removed`,
            12,
            h - 12
          );
        }
      }

      function loop(now) {
        if (!visible) { animId = null; return; }
        redraw(now);
        animId = requestAnimationFrame(loop);
      }

      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            canvas.style.opacity = '1';
            if (!visible) { visible = true; build(); animId = requestAnimationFrame(loop); }
          } else {
            canvas.style.opacity = '0';
            visible = false;
            if (animId) { cancelAnimationFrame(animId); animId = null; }
          }
        });
      }, { threshold: 0.05 });
      io.observe(section);

      // Passive scroll listener for scroll-driven redraw
      window.addEventListener('scroll', () => {
        if (visible && !animId) {
          animId = requestAnimationFrame(now => { redraw(now); animId = null; });
        }
      }, { passive: true });

      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (visible) build(); }, 200);
      });

    } catch(e) { /* self-contained */ }
  })();


  // ═══════════════════════════════════════════════════════════════
  // SECTION 3 — PROJECTS: "Inference"
  // Per-card activation fires a targeted forward pass
  // ═══════════════════════════════════════════════════════════════
  (() => {
    try {
      const section = document.getElementById('projects');
      if (!section) return;

      const canvas = createSectionCanvas(section);
      let state   = null;
      let animId  = null;
      let visible = false;

      // Network on RIGHT side (60–100% width), 3 layers: 4→6→4
      function build() {
        const sized = sizeCanvas(canvas);
        if (!sized) return; // BUG-8: not yet laid out
        const { ctx, w, h } = sized;
        const layers    = IS_MOBILE() ? [3, 4, 3] : [4, 6, 4];
        const positions = buildPositions(layers, w, h, 0.58, 0.96);

        const edges = [];
        for (let li = 0; li < positions.length - 1; li++) {
          for (const from of positions[li]) {
            for (const to of positions[li + 1]) {
              edges.push({ from, to, opacity: 0.06, targetOpacity: 0.06 });
            }
          }
        }

        // Node state
        const nodeStates = new Map();
        positions.flat().forEach(node => {
          nodeStates.set(node, { opacity: 0.15, radius: 4, glow: 0 });
        });

        state = {
          ctx, w, h, edges, positions, layers,
          nodeStates, activePass: null,
        };
      }

      function firePass(cardIndex, now) {
        if (!state) return;
        const { positions, nodeStates, edges } = state;

        // Pick input node randomly, output node by card vertical position
        const inputNode  = positions[0][Math.floor(Math.random() * positions[0].length)];
        const outputIdx  = clamp(cardIndex, 0, positions[positions.length-1].length - 1);
        const outputNode = positions[positions.length-1][outputIdx];

        // Build path: random middle nodes
        const path = [inputNode];
        for (let li = 1; li < positions.length - 1; li++) {
          path.push(positions[li][Math.floor(Math.random() * positions[li].length)]);
        }
        path.push(outputNode);

        // Reset all edges to dim
        edges.forEach(e => { e.targetOpacity = 0.04; });

        // Activate input node
        const inState = nodeStates.get(inputNode);
        inState.opacity = 0.9;
        inState.radius  = 7;

        state.activePass = {
          path,
          hop:         0,
          hopStart:    now,
          hopDuration: 300,
          outputNode,
          done:        false,
        };
      }

      function loop(now) {
        if (!visible) { animId = null; return; }
        if (!state) { animId = requestAnimationFrame(loop); return; }
        // BUG-10: track dt so lerps are frame-rate independent
        if (loop._last === undefined) loop._last = now;
        const dtF = Math.min((now - loop._last) / 16.667, 4);
        loop._last = now;
        const { ctx, w, h, edges, nodeStates, activePass } = state;

        ctx.clearRect(0, 0, w, h);

        // Update active pass
        if (activePass && !activePass.done) {
          const elapsed = now - activePass.hopStart;
          if (elapsed >= activePass.hopDuration) {
            const nextNode = activePass.path[activePass.hop + 1];
            if (nextNode) {
              const ns = nodeStates.get(nextNode);
              ns.opacity = 0.7;
              ns.radius  = activePass.hop + 2 >= activePass.path.length - 1 ? 8 : 5;
              ns.glow    = activePass.hop + 2 >= activePass.path.length - 1 ? 6 : 0;
            }
            // Light up edges on path
            const fromNode = activePass.path[activePass.hop];
            const toNode   = activePass.path[activePass.hop + 1];
            edges.forEach(e => {
              if (e.from === fromNode && e.to === toNode) e.targetOpacity = 0.12;
            });
            activePass.hop++;
            activePass.hopStart = now;
            if (activePass.hop >= activePass.path.length - 1) activePass.done = true;
          }

          // Interpolate signal dot
          if (!activePass.done) {
            const from = activePass.path[activePass.hop];
            const to   = activePass.path[activePass.hop + 1];
            if (from && to) {
              const t  = clamp((now - activePass.hopStart) / activePass.hopDuration, 0, 1);
              const sx = from.x + (to.x - from.x) * t;
              const sy = from.y + (to.y - from.y) * t;
              ctx.save();
              ctx.shadowColor = 'rgba(134,239,172,0.2)';
              ctx.shadowBlur  = 6;
              ctx.beginPath();
              ctx.arc(sx, sy, 3, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(134,239,172,0.35)';
              ctx.fill();
              ctx.restore();
            }
          }
        }

        // Lerp edge opacities — BUG-10: scaled by dtF for Hz-independence
        edges.forEach(e => {
          e.opacity += (e.targetOpacity - e.opacity) * 0.08 * dtF;
          if (e.opacity < 0.005) return;
          ctx.beginPath();
          ctx.moveTo(e.from.x, e.from.y);
          ctx.lineTo(e.to.x, e.to.y);
          ctx.strokeStyle = `rgba(34,197,94,${e.opacity})`;
          ctx.lineWidth   = 0.8;
          ctx.stroke();
        });

        // Lerp and draw nodes — BUG-10: scaled by dtF
        nodeStates.forEach((ns, node) => {
          ns.opacity += (0.15 - ns.opacity) * 0.015 * dtF;
          ns.radius  += (4    - ns.radius)  * 0.015 * dtF;
          ns.glow    += (0    - ns.glow)    * 0.015 * dtF;

          ctx.save();
          if (ns.glow > 0.5) {
            ctx.shadowColor = 'rgba(134,239,172,0.2)';
            ctx.shadowBlur  = ns.glow;
          }
          ctx.beginPath();
          ctx.arc(node.x, node.y, ns.radius, 0, Math.PI * 2);
          ctx.fillStyle   = `rgba(34,197,94,${ns.opacity * 0.25})`;
          ctx.strokeStyle = `rgba(34,197,94,${ns.opacity * 0.2})`;
          ctx.lineWidth   = 1;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        });

        animId = requestAnimationFrame(loop);
      }

      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            canvas.style.opacity = '1';
            if (!visible) {
              visible = true;
              build();
              loop._last = undefined; // BUG-10: reset dt on section enter
              animId = requestAnimationFrame(loop);
            }
          } else {
            canvas.style.opacity = '0';
            visible = false;
            if (animId) { cancelAnimationFrame(animId); animId = null; }
          }
        });
      }, { threshold: 0.1 });
      io.observe(section);

      // Observe each project card
      const cardIds = ['proj-1', 'proj-2', 'proj-3', 'proj-4'];
      cardIds.forEach((id, cardIndex) => {
        const card = document.getElementById(id);
        if (!card) return;
        const cardObs = new IntersectionObserver(entries => {
          entries.forEach(entry => {
            if (entry.isIntersecting && visible) {
              firePass(cardIndex, performance.now());
            }
          });
        }, { threshold: 0.3 });
        cardObs.observe(card);
      });

      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (visible) build(); }, 200);
      });

    } catch(e) { /* self-contained */ }
  })();


  // ═══════════════════════════════════════════════════════════════
  // SECTION 4 — EXPERIENCE: "Convergence"
  // Calm, regular heartbeat. Loss flatline at bottom.
  // ═══════════════════════════════════════════════════════════════
  (() => {
    try {
      const section = document.getElementById('experience');
      if (!section) return;

      const canvas = createSectionCanvas(section);
      let state   = null;
      let animId  = null;
      let visible = false;

      function build() {
        const sized = sizeCanvas(canvas);
        if (!sized) return; // BUG-8: not yet laid out
        const { ctx, w, h } = sized;
        const layers    = IS_MOBILE() ? [2, 3, 2] : [3, 4, 3];
        const positions = buildPositions(layers, w, h, 0.1, 0.9);

        const edges = [];
        for (let li = 0; li < positions.length - 1; li++) {
          for (const from of positions[li]) {
            for (const to of positions[li + 1]) {
              edges.push({ from, to });
            }
          }
        }

        // Deterministic center path: middle node of each layer
        const centerPath = positions.map(layer => layer[Math.floor(layer.length / 2)]);

        // Signal state
        const signal = {
          active:   false,
          hop:      0,
          hopStart: 0,
          hopDuration: 600,
          interval: 4000,
          lastFired: 0,
        };

        // Loss flatline dot
        const flatDot = { x: 0, startTime: 0, period: 6000 };

        state = { ctx, w, h, edges, positions, centerPath, signal, flatDot };
      }

      function loop(now) {
        if (!visible) { animId = null; return; }
        if (!state) { animId = requestAnimationFrame(loop); return; }
        const { ctx, w, h, edges, positions, centerPath, signal, flatDot } = state;

        ctx.clearRect(0, 0, w, h);

        // Draw stable edges
        edges.forEach(e => {
          ctx.beginPath();
          ctx.moveTo(e.from.x, e.from.y);
          ctx.lineTo(e.to.x, e.to.y);
          ctx.strokeStyle = 'rgba(34,197,94,0.04)';
          ctx.lineWidth   = 0.8;
          ctx.stroke();
        });

        // Draw stable nodes
        positions.flat().forEach(node => {
          ctx.beginPath();
          ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
          ctx.fillStyle   = 'rgba(34,197,94,0.08)';
          ctx.strokeStyle = 'rgba(34,197,94,0.2)';
          ctx.lineWidth   = 1;
          ctx.fill();
          ctx.stroke();
        });

        // Manage signal timing
        if (!signal.active && (now - signal.lastFired) >= signal.interval) {
          signal.active   = true;
          signal.hop      = 0;
          signal.hopStart = now;
          signal.lastFired = now;
        }

        // Draw signal
        if (signal.active) {
          const elapsed = now - signal.hopStart;
          if (elapsed >= signal.hopDuration) {
            signal.hop++;
            signal.hopStart = now;
            if (signal.hop >= centerPath.length - 1) {
              signal.active   = false;
              signal.lastFired = now;
            }
          }
          if (signal.active) {
            const from = centerPath[signal.hop];
            const to   = centerPath[signal.hop + 1];
            if (from && to) {
              const t  = clamp((now - signal.hopStart) / signal.hopDuration, 0, 1);
              const sx = from.x + (to.x - from.x) * t;
              const sy = from.y + (to.y - from.y) * t;
              ctx.beginPath();
              ctx.arc(sx, sy, 2.5, 0, Math.PI * 2);
              ctx.fillStyle = 'rgba(134,239,172,0.35)';
              ctx.fill();
            }
          }
        }

        // Dynamically find the bottom of the inference card so we don't overlap it
        const cardBox = document.querySelector('#experience .inference-card');
        let cardBottom = h * 0.78; // Fallback
        if (cardBox) {
          const cardRect = cardBox.getBoundingClientRect();
          const sectionRect = section.getBoundingClientRect();
          // Position it 30px below the card's bottom relative to the section's top
          cardBottom = (cardRect.bottom - sectionRect.top) + 30;
        }

        // Loss flatline
        const flatY  = Math.min(cardBottom, h - 10);
        const flatX0 = w * 0.05;
        const flatX1 = w * 0.95;

        ctx.beginPath();
        ctx.moveTo(flatX0, flatY);
        ctx.lineTo(flatX1, flatY);
        ctx.strokeStyle = 'rgba(34,197,94,0.04)';
        ctx.lineWidth   = 1;
        ctx.stroke();

        // Traveling dot on flatline
        const dotProgress = ((now % flatDot.period) / flatDot.period);
        const dotX = flatX0 + dotProgress * (flatX1 - flatX0);
        ctx.beginPath();
        ctx.arc(dotX, flatY, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(134,239,172,0.35)';
        ctx.fill();

        // Label
        ctx.font         = "9px 'JetBrains Mono', monospace";
        ctx.fillStyle    = 'rgba(45,79,52,0.4)';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'bottom';
        ctx.fillText('loss: converged', flatX0, flatY - 4);
        animId = requestAnimationFrame(loop);
      }

      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            canvas.style.opacity = '1';
            if (!visible) { visible = true; build(); animId = requestAnimationFrame(loop); }
          } else {
            canvas.style.opacity = '0';
            visible = false;
            if (animId) { cancelAnimationFrame(animId); animId = null; }
          }
        });
      }, { threshold: 0.1 });
      io.observe(section);

      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (visible) build(); }, 200);
      });

    } catch(e) { /* self-contained */ }
  })();


  // ═══════════════════════════════════════════════════════════════
  // SECTION 5 — CONTACT: "Idle / Ready"
  // Single arc of 5 nodes. Center node pulses. Others flicker.
  // ═══════════════════════════════════════════════════════════════
  (() => {
    try {
      const section = document.getElementById('contact');
      if (!section) return;

      const canvas = createSectionCanvas(section);
      let state   = null;
      let animId  = null;
      let visible = false;
      let blinkState = true;
      let lastBlink  = 0;
      const BLINK_INTERVAL = 530;

      function build() {
        const sized = sizeCanvas(canvas);
        if (!sized) return; // BUG-8: not yet laid out
        const { ctx, w, h } = sized;
        const count   = IS_MOBILE() ? 4 : 5;
        const centerX = w * 0.5;
        const centerY = h * 0.52;
        const arcR    = Math.min(w, h) * 0.22;
        const arcSpan = Math.PI * 0.9; // radians total span

        const nodes = Array.from({ length: count }, (_, i) => {
          const angle = -Math.PI * 0.5 - arcSpan / 2 + (i / (count - 1)) * arcSpan;
          return {
            x:         centerX + Math.cos(angle) * arcR,
            y:         centerY + Math.sin(angle) * arcR,
            isCenter:  i === Math.floor(count / 2),
            opacity:   0.08,
            flickerNext: performance.now() + 2000 + Math.random() * 3000,
            flickering: false,
            flickerStart: 0,
          };
        });

        state = { ctx, w, h, nodes };
      }

      function loop(now) {
        if (!visible) { animId = null; return; }
        if (!state) { animId = requestAnimationFrame(loop); return; }
        const { ctx, w, h, nodes } = state;

        ctx.clearRect(0, 0, w, h);

        // Center node: slow pulse
        const centerNode = nodes.find(n => n.isCenter);
        if (centerNode) {
          const phaseFrac = (now % 3000) / 3000; // 0..1 over 3s
          const pOp = 0.08 + 0.22 * (Math.sin(phaseFrac * Math.PI * 2 - Math.PI * 0.5) * 0.5 + 0.5);
          const pGlow = (pOp - 0.08) / 0.22 * 6;
          centerNode.opacity = pOp;

          ctx.save();
          ctx.shadowColor = 'rgba(134,239,172,0.2)';
          ctx.shadowBlur  = pGlow;
          ctx.beginPath();
          ctx.arc(centerNode.x, centerNode.y, 5, 0, Math.PI * 2);
          ctx.fillStyle   = `rgba(134,239,172,${pOp})`;
          ctx.strokeStyle = `rgba(134,239,172,${pOp * 0.6})`;
          ctx.lineWidth   = 1;
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }

        // Other nodes: occasional flicker
        nodes.filter(n => !n.isCenter).forEach(n => {
          if (!n.flickering && now >= n.flickerNext) {
            n.flickering   = true;
            n.flickerStart = now;
          }
          if (n.flickering) {
            const elapsed = now - n.flickerStart;
            const dur     = 400;
            if (elapsed < dur) {
              const t = elapsed / dur;
              n.opacity = 0.08 + 0.17 * Math.sin(t * Math.PI);
            } else {
              n.opacity   = 0.08;
              n.flickering = false;
              n.flickerNext = now + 2000 + Math.random() * 3000;
            }
          }

          ctx.beginPath();
          ctx.arc(n.x, n.y, 3, 0, Math.PI * 2);
          ctx.fillStyle   = `rgba(34,197,94,${n.opacity})`;
          ctx.strokeStyle = `rgba(34,197,94,${n.opacity * 0.5})`;
          ctx.lineWidth   = 1;
          ctx.fill();
          ctx.stroke();
        });

        // Blink underscore
        if (now - lastBlink > BLINK_INTERVAL) {
          blinkState = !blinkState;
          lastBlink  = now;
        }

        // Text: "awaiting input_"
        const text     = 'awaiting input' + (blinkState ? '_' : ' ');
        const textOp   = 0.25;
        ctx.font         = "10px 'JetBrains Mono', monospace";
        ctx.fillStyle    = `rgba(45,79,52,${textOp})`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w * 0.5, h * 0.78);

        animId = requestAnimationFrame(loop);
      }

      const io = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            canvas.style.opacity = '1';
            if (!visible) { visible = true; build(); animId = requestAnimationFrame(loop); }
          } else {
            canvas.style.opacity = '0';
            visible = false;
            if (animId) { cancelAnimationFrame(animId); animId = null; }
          }
        });
      }, { threshold: 0.1 });
      io.observe(section);

      let resizeTimer;
      window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => { if (visible) build(); }, 200);
      });

    } catch(e) { /* self-contained */ }
  })();

}); // end DOMContentLoaded
