'use strict';

// ── BOOT SEQUENCE INTEGRATION ──
document.addEventListener('portfolioReady', () => {
  // Reveal hero
  document.documentElement.style.setProperty('--hero-opacity', '1');
});

/* ─────────────────────────────────────
   NAV — scroll state + mobile toggle
───────────────────────────────────── */
const nav       = document.getElementById('nav');
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');
const allNavLinks = document.querySelectorAll('.nav-link');

// Scrolled class for nav border (kept for compatibility or nav effects)
if (nav) {
  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });
}

// Mobile hamburger (if present)
if (navToggle) {
  navToggle.addEventListener('click', () => {
    const open = navToggle.classList.toggle('open');
    if (navLinks) navLinks.classList.toggle('open', open);
    navToggle.setAttribute('aria-expanded', String(open));
  });
}

// Close mobile nav on link click
allNavLinks.forEach(link => {
  link.addEventListener('click', () => {
    if (navToggle) navToggle.classList.remove('open');
    if (navLinks) navLinks.classList.remove('open');
    if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
  });
});


/* ─────────────────────────────────────
   ACTIVE NAV — highlight current section
───────────────────────────────────── */
const sections = document.querySelectorAll('section[id]');

const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    const id = entry.target.id;
    allNavLinks.forEach(link => {
      link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
    });
  });
}, { rootMargin: '-40% 0px -55% 0px' });

sections.forEach(s => sectionObserver.observe(s));


/* ─────────────────────────────────────
   SCROLL REVEAL — Intersection Observer
   Elements need class "reveal"
   Optional delay via CSS --d variable
───────────────────────────────────── */
const revealEls = document.querySelectorAll('.reveal');

const revealObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('visible');
    revealObserver.unobserve(entry.target);   // fire once only
  });
}, {
  threshold: 0.08,
  rootMargin: '0px 0px -48px 0px'
});

revealEls.forEach(el => revealObserver.observe(el));


/* ─────────────────────────────────────
   SMOOTH SCROLL — fix offset for fixed nav
───────────────────────────────────── */
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', e => {
    const target = document.querySelector(anchor.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    const navH = nav ? nav.offsetHeight : 0; // BUG-7: guard against null nav
    const top  = target.getBoundingClientRect().top + window.scrollY - navH;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});


/* ─────────────────────────────────────
   SCROLL INDICATOR — hide after scroll
───────────────────────────────────── */
const scrollHint = document.querySelector('.scroll-hint');
if (scrollHint) {
  const hideHint = () => {
    if (window.scrollY > 80) {
      scrollHint.style.opacity = '0';
      scrollHint.style.pointerEvents = 'none';
      window.removeEventListener('scroll', hideHint);
    }
  };
  window.addEventListener('scroll', hideHint, { passive: true });
}

document.addEventListener('DOMContentLoaded', () => {
  // ── DYNAMIC YEAR ──
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ── NEURON PULSE ON PROJECT CARDS ──
  const projCards = document.querySelectorAll('.proj-card');

  projCards.forEach(card => {
    card.addEventListener('mouseenter', () => {
      card.classList.remove('pulsing');
      // Force reflow to restart animation
      void card.offsetWidth;
      card.classList.add('pulsing');
    });

    card.addEventListener('mouseleave', () => {
      card.classList.remove('pulsing');
    });

    card.addEventListener('animationend', () => {
      card.classList.remove('pulsing');
    });
  });

  // ── LOSS CURVE ANIMATION ──
  const canvas = document.getElementById('loss-curve');
  if (canvas) {
    // BUG-6: Make loss curve DPI-aware — crisp on Retina/HiDPI displays
    const dpr    = Math.min(window.devicePixelRatio || 1, 2);
    const width  = parseInt(canvas.getAttribute('width'))  || 220;
    const height = parseInt(canvas.getAttribute('height')) || 120;
    canvas.width  = Math.round(width  * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width  = width  + 'px';
    canvas.style.height = height + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const pad = 12;

    let epoch = 42;
    const textColors = {
      green: '#22c55e',
      muted: '#4d7a58',
      axis: '#2d4f34',
      bg: 'rgba(7, 16, 9, 0.7)',
      dot: '#86efac'
    };

    setInterval(() => {
      epoch++;
    }, 2000);

    // OU process variables
    let currentTrainY = height * 0.5;
    let currentValY = height * 0.52;
    const targetTrainY = height * 0.5;
    const targetValY = height * 0.52;
    
    let points = [];
    let valPoints = []; // BUG-5: removed dead xOffset variable
    
    // Create an initial state
    let x = pad;
    while (x < width - pad) {
      points.push({x: x, y: currentTrainY});
      valPoints.push({x: x, y: currentValY});
      x += 2;
      currentTrainY += (targetTrainY - currentTrainY) * 0.05 + (Math.random() - 0.5) * 8;
      currentValY += (targetValY - currentValY) * 0.04 + (Math.random() - 0.5) * 10;
      
      // constrain to avoid top text
      // constrain to avoid top/bottom text area
      currentTrainY = Math.max(pad + 12, Math.min(height - pad - 12, currentTrainY));
      currentValY = Math.max(pad + 12, Math.min(height - pad - 12, currentValY));
    }

    let lastTime = 0;
    let pulsingTime = 0;
    // Fractional scroll accumulator — advances by dt-normalized units per frame
    let xAccum = 0;

    // Intersection Observer to prevent running when offscreen
    let isVisible = true;
    const observer = new IntersectionObserver(entries => {
      isVisible = entries[0].isIntersecting;
    }, { threshold: 0 });
    observer.observe(document.querySelector('.hero'));

    // BUG-4: Hoisted outside draw() — avoids creating a new function object every frame
    function drawCurve(pts, color, lWidth) {
      if (pts.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth   = lWidth;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const xc = (pts[i].x + pts[i + 1].x) / 2;
        const yc = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, xc, yc);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }

    function draw(time) {
      // BUG-14: Also pause when browser tab is hidden to save CPU/battery
      if (!isVisible || document.hidden) {
        requestAnimationFrame(draw);
        return;
      }

      // ── Delta-time normalisation ──────────────────────────────
      // dt is clamped to avoid a huge jump after a tab was hidden
      const rawDt  = time - lastTime;
      lastTime = time;
      const dt = Math.min(rawDt, 50); // cap at ~20fps equivalent
      // Normalised factor: 1.0 at 60 fps, 0.5 at 120 fps, ~0.42 at 144 fps
      const dtFactor = dt / 16.667;

      pulsingTime += dt;

      ctx.clearRect(0, 0, width, height);
      
      // Axes
      ctx.strokeStyle = '#0f2414';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad, height - pad);
      ctx.lineTo(width - pad, height - pad);
      ctx.moveTo(pad, pad);
      ctx.lineTo(pad, height - pad);
      ctx.stroke();

      // Axis Labels
      ctx.font = "9px 'JetBrains Mono', monospace";
      ctx.fillStyle = textColors.axis;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText("epoch", width / 2, height - pad + 3);
      
      ctx.save();
      ctx.translate(pad - 3, height / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = 'bottom';
      ctx.fillText("loss", 0, 0);
      ctx.restore();
      
      // Training State text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillStyle = textColors.muted;
      ctx.fillText("training...", pad + 4, pad);
      ctx.fillStyle = textColors.green;
      ctx.fillText(`ep: ${epoch.toString().padStart(4, '0')}`, pad + 4, pad + 12);
      
      // Validation Label
      ctx.fillStyle = textColors.muted;
      ctx.textAlign = 'right';
      ctx.fillText("val", width - pad, pad);
      
      // ── dt-normalised scroll accumulator ─────────────────────
      // 0.5 px per frame at 60 fps → same real speed at any Hz
      xAccum += 0.5 * dtFactor;
      while (xAccum >= 2) {
        xAccum -= 2;
        if (points.length > 0) {
          currentTrainY = points[points.length - 1].y;
          currentValY = valPoints[valPoints.length - 1].y;
        }
        
        points.shift();
        valPoints.shift();
        for (let i = 0; i < points.length; i++) {
          points[i].x -= 2;
          valPoints[i].x -= 2;
        }
        
        currentTrainY += (targetTrainY - currentTrainY) * 0.05 + (Math.random() - 0.5) * 8;
        currentValY += (targetValY - currentValY) * 0.04 + (Math.random() - 0.5) * 10;
        
        // constrain to avoid top/bottom text area
        currentTrainY = Math.max(pad + 12, Math.min(height - pad - 12, currentTrainY));
        currentValY = Math.max(pad + 12, Math.min(height - pad - 12, currentValY));

        let lastX = points.length > 0 ? points[points.length - 1].x : pad;
        points.push({x: lastX + 2, y: currentTrainY});
        valPoints.push({x: lastX + 2, y: currentValY});
      }
      
      // Draw Validation  — drawCurve is hoisted above draw() (BUG-4)
      drawCurve(valPoints, "rgba(74,222,128,0.35)", 1.5);
      
      // Draw Train (glow + line)
      drawCurve(points, "rgba(34,197,94,0.15)", 4);
      drawCurve(points, textColors.green, 1.5);
      
      // Draw live dot at the head
      if (points.length > 0) {
        let head = points[points.length - 1];
        let scale = 1 + Math.sin(pulsingTime * Math.PI * 2 / 800) * 0.2; // pulse (uses real ms — already frame-rate independent)
        ctx.fillStyle = textColors.dot;
        ctx.beginPath();
        ctx.arc(head.x, head.y, 3 * scale, 0, Math.PI * 2);
        ctx.fill();
      }
      
      requestAnimationFrame(draw);
    }
    
    requestAnimationFrame(draw);
  }

  // ── TAGCANVAS (SKILLS CLOUD) ──
  try {
    if (window.TagCanvas) {
      TagCanvas.Start('skill-cloud', 'tags', {
        textColour: null,
        outlineColour: 'transparent',
        reverse: true,
        depth: 0.8,
        maxSpeed: 0.03,
        minSpeed: 0.01,
        initial: [0.06, -0.06],
        imageScale: 0.9,
        imageMode: 'image',
        radius: 0.9,
        wheelZoom: false,
        activeCursor: 'default',
        tooltip: 'native'
      });
    }
  } catch(e) {
    console.error('TagCanvas error', e);
  }
});

// Jiggly Avatar Animation (Interactive Particle Cloud)
document.addEventListener('DOMContentLoaded', () => {
  const avatarImg = document.querySelector('.term-photo img');
  if (!avatarImg) return;
  
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const parent = avatarImg.parentElement;
  
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.zIndex = '2'; 
  canvas.style.filter = 'grayscale(100%) contrast(1.08) brightness(0.92)';
  
  parent.style.position = 'relative';
  parent.appendChild(canvas);
  
  // Hide original image completely
  avatarImg.style.opacity = '0';
  
  const img = new Image();
  img.crossOrigin = 'Anonymous';
  img.src = avatarImg.src;
  
  let particles = [];
  let mouse = { x: -9999, y: -9999, radius: 120 };
  
  // Track mouse over the parent for interaction
  parent.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    mouse.x = (e.clientX - rect.left) * scaleX;
    mouse.y = (e.clientY - rect.top) * scaleY;
  });
  parent.addEventListener('mouseleave', () => {
    mouse.x = -9999;
    mouse.y = -9999;
  });
  
  img.onload = () => {
    // Canvas actual resolution (high DPI)
    canvas.width = parent.clientWidth * 2;
    canvas.height = parent.clientHeight * 2;
    
    const isMobile = window.innerWidth <= 768;
    const cols = isMobile ? 65 : 150; // Reduce particles on mobile to fix lag
    const aspect = img.naturalHeight / img.naturalWidth;
    const rows = Math.floor(cols * aspect);
    
    // Draw image to an offscreen canvas to extract pixel data
    const offCanvas = document.createElement('canvas');
    const offCtx = offCanvas.getContext('2d');
    offCanvas.width = cols;
    offCanvas.height = rows;
    
    offCtx.drawImage(img, 0, 0, cols, rows);
    const imgData = offCtx.getImageData(0, 0, cols, rows).data;
    
    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;
    
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        const r = imgData[i];
        const g = imgData[i+1];
        const b = imgData[i+2];
        const a = imgData[i+3];
        
        if (a > 0) {
          particles.push({
            ox: (x * cellWidth) + (cellWidth / 2),
            oy: (y * cellHeight) + (cellHeight / 2),
            x: (Math.random() * canvas.width),
            y: (Math.random() * canvas.height),
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4,
            r: r,
            g: g,
            b: b,
            a: a / 255,
            size: Math.max(1.0, cellWidth * 0.95),
            seed: Math.random() * 100
          });
        }
      }
    }
    
    let startTime = null;
    // 'time' is now in real seconds, incremented by dt — frame-rate independent
    let time = 0;
    let lastAnimTime = null;

    // BUG-3: Declared before animate() — prevents Temporal Dead Zone risk
    let isReady = false;
    let isVisible = false;
    let animationStarted = false;

    function animate(now) {
      if (!isVisible) {
        requestAnimationFrame(animate);
        return;
      }

      // ── Delta-time (seconds) ─────────────────────────────────
      // Guard: if now is undefined or first frame, skip physics update
      if (lastAnimTime === null || now === undefined) { lastAnimTime = now ?? performance.now(); requestAnimationFrame(animate); return; }
      const rawDt = now - lastAnimTime;
      lastAnimTime = now;
      // Cap to avoid huge jump after tab switch; normalise to seconds
      const dtSec = Math.min(rawDt, 50) / 1000;
      // dtFactor: 1.0 at 60 fps, ~0.42 at 144 fps
      const dtFactor = dtSec * 60;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // Advance time in real seconds so sin/cos frequency is Hz-independent
      time += dtSec * 3; // 3 rad/s (≈ 0.05*60 rad/frame@60fps)
      
      if (!startTime) startTime = Date.now();
      let progress = (Date.now() - startTime) / 2000; // 2s butterfly formation time
      if (progress > 1) progress = 1;
      let forming = progress < 1;
      
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        let currentSize = p.size;
        
        // Mouse repulsion
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < mouse.radius) {
          const force = (mouse.radius - dist) / mouse.radius;
          // Scale impulse by dtFactor so repulsion strength is Hz-independent
          p.vx -= (dx / dist) * force * 5 * dtFactor;
          p.vy -= (dy / dist) * force * 5 * dtFactor;
        }
        
        if (forming) {
          // Butterfly effect: float around randomly initially
          // 0.4 acceleration per 60fps-frame → scale by dtFactor
          p.vx += Math.sin(time + p.seed) * 0.4 * (1 - progress) * dtFactor;
          p.vy += Math.cos(time + p.seed * 1.5) * 0.4 * (1 - progress) * dtFactor;
          
          // Spring force slowly takes over (also scaled)
          let spring = 0.08 * Math.pow(progress, 2);
          p.vx += (p.ox - p.x) * spring * dtFactor;
          p.vy += (p.oy - p.y) * spring * dtFactor;
          
          // Friction: convert per-frame multiplier to dt-based equivalent
          // 0.92^dtFactor gives the same damping per second at any Hz
          const friction = Math.pow(0.92, dtFactor);
          p.vx *= friction;
          p.vy *= friction;
        } else {
          // Spring back to origin
          p.vx += (p.ox - p.x) * 0.08 * dtFactor;
          p.vy += (p.oy - p.y) * 0.08 * dtFactor;
          
          // Friction (bouncy pendulum) — same dt-conversion trick
          const friction = Math.pow(0.85, dtFactor);
          p.vx *= friction;
          p.vy *= friction;
        }
        
        // Position update scaled by dtFactor
        p.x += p.vx * dtFactor;
        p.y += p.vy * dtFactor;
        
        if (currentSize > 0) {
          ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${p.a})`;
          ctx.beginPath();
          // Draw as tiny squares for a digital/binary aesthetic
          ctx.fillRect(p.x - currentSize/2, p.y - currentSize/2, currentSize, currentSize);
        }
      }
      
      requestAnimationFrame(animate);
    }
    
    function checkStart() {
      if (isReady && isVisible && !animationStarted) {
        animationStarted = true;
        // Always start via rAF so the browser supplies a valid timestamp
        requestAnimationFrame(animate);
      }
    }
    
    // Intersection Observer to pause animation when offscreen (crucial for mobile performance)
    const observer = new IntersectionObserver((entries) => {
      isVisible = entries[0].isIntersecting;
      if (isVisible) {
        checkStart();
      }
    }, { threshold: 0.0 });
    observer.observe(parent);
    
    // Wait for the OS loader to finish before flying in
    if (!document.getElementById('nikhil-os-loader')) {
      isReady = true;
      checkStart();
    } else {
      document.addEventListener('portfolioReady', () => {
        isReady = true;
        checkStart();
      });
    }
  };
});


/* ─────────────────────────────────────
   PROJECT FILESYSTEM EXPLORER
   Terminal-style folder tab switching
───────────────────────────────────── */
(function () {
  const tabs   = document.querySelectorAll('.proj-folder-tab');
  const panels = document.querySelectorAll('.proj-panel');

  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.target;

      // Update tab states
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');

      // Update panel visibility
      panels.forEach(panel => {
        if (panel.id === target) {
          panel.classList.add('active');
        } else {
          panel.classList.remove('active');
        }
      });

      // Re-trigger reveal for newly visible cards
      const newlyVisible = document.querySelectorAll(
        `#${target} .reveal:not(.visible)`
      );
      // Small delay so panel is fully visible before triggering animation
      setTimeout(() => {
        newlyVisible.forEach(el => {
          // Re-observe so IntersectionObserver picks them up
          revealObserver.observe(el);
        });
      }, 30);
    });
  });
})();
