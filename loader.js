(function() {
  function initLoader() {
    if (document.getElementById('nikhil-os-loader')) return;

    const style = document.createElement('style');
    style.id = 'loader-styles';
    style.textContent = `
      #nikhil-os-loader {
        position: fixed;
        inset: 0;
        z-index: 99999;
        background: #020a04;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      #nikhil-os-loader-container {
        width: 100%;
        max-width: 480px;
        box-sizing: border-box;
        padding: 32px 40px;
        background: #071009;
        border: 1px solid #0f2414;
        border-radius: 10px;
        box-shadow: 
          0 0 0 1px rgba(34,197,94,0.08),
          0 0 60px rgba(34,197,94,0.06),
          0 24px 80px rgba(0,0,0,0.6);
        position: relative;
      }
      .loader-text {
        font-family: 'JetBrains Mono', 'Fira Code', monospace;
      }
      #loader-line-1 {
        font-size: 10px;
        color: #2d4f34;
        letter-spacing: 0.12em;
        margin-bottom: 20px;
      }
      #loader-line-2 {
        font-size: 14px;
        color: #22c55e;
        white-space: pre;
      }
      #loader-ascii-bar {
        font-size: 14px;
        color: #22c55e;
        margin-top: 15px;
        margin-bottom: 10px;
        white-space: pre;
      }
      #loader-sys-logs {
        font-size: 10px;
        color: #16a34a;
        margin-bottom: 10px;
        line-height: 1.5;
        height: 45px;
        overflow: hidden;
      }
      #loader-line-3 {
        font-size: 10px;
        color: #2d4f34;
        margin-top: 10px;
        letter-spacing: 0.08em;
        opacity: 0;
      }
      #loader-cursor {
        color: #22c55e;
        animation: cursorBlink 530ms step-end infinite;
      }
      #loader-progress-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 1px;
        background: linear-gradient(90deg, #22c55e, #86efac);
        border-radius: 0 0 10px 10px;
        width: 0%;
        transition: width 700ms linear;
      }
      @keyframes cursorBlink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0; }
      }
      @keyframes checkGlow {
        0% { opacity: 0; text-shadow: none; }
        100% { opacity: 1; text-shadow: 0 0 12px rgba(134,239,172,0.8); }
      }
      @keyframes statusFade {
        from { opacity: 0; transform: translateY(4px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      .loader-fade-out {
        opacity: 0;
        transition: opacity 350ms ease;
      }
    `;
    document.head.appendChild(style);

    document.body.style.overflow = 'hidden';
    // BUG-12: Safety net — always restore scrollability within 15s in case of errors
    const _overflowSafety = setTimeout(() => { document.body.style.overflow = ''; }, 15000);

    const overlay = document.createElement('div');
    overlay.id = 'nikhil-os-loader';

    const container = document.createElement('div');
    container.id = 'nikhil-os-loader-container';

    const line1 = document.createElement('div');
    line1.id = 'loader-line-1';
    line1.className = 'loader-text';
    line1.textContent = 'NIKHIL_OS v1.0.0';

    const line2 = document.createElement('div');
    line2.id = 'loader-line-2';
    line2.className = 'loader-text';
    
    const typingSpan = document.createElement('span');
    const cursorSpan = document.createElement('span');
    cursorSpan.id = 'loader-cursor';
    cursorSpan.textContent = '▋';

    line2.appendChild(typingSpan);
    line2.appendChild(cursorSpan);
    
    const asciiBar = document.createElement('div');
    asciiBar.id = 'loader-ascii-bar';
    asciiBar.className = 'loader-text';
    
    const sysLogs = document.createElement('div');
    sysLogs.id = 'loader-sys-logs';
    sysLogs.className = 'loader-text';

    const line3 = document.createElement('div');
    line3.id = 'loader-line-3';
    line3.className = 'loader-text';
    line3.textContent = '[ system ready ]';

    const progress = document.createElement('div');
    progress.id = 'loader-progress-bar';

    container.appendChild(line1);
    container.appendChild(line2);
    container.appendChild(asciiBar);
    container.appendChild(sysLogs);
    container.appendChild(line3);
    container.appendChild(progress);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    progress.getBoundingClientRect();

    const textToType = '> initialising nikhil.portfolio...';
    let charIndex = 0;

    progress.style.width = '100%';

    function typeChar() {
      if (charIndex < textToType.length) {
        typingSpan.textContent += textToType.charAt(charIndex);
        charIndex++;
        setTimeout(typeChar, 18);
      } else {
        setTimeout(finishSequence, 200);
      }
    }

    function finishSequence() {
      typingSpan.appendChild(document.createTextNode(' done '));

      const checkSpan = document.createElement('span');
      checkSpan.style.color = '#86efac';
      checkSpan.textContent = '✓';
      checkSpan.style.animation = 'checkGlow 300ms ease forwards';
      typingSpan.appendChild(checkSpan);

      if (cursorSpan.parentNode) {
        cursorSpan.parentNode.removeChild(cursorSpan);
      }

      setTimeout(runBootSequence, 150);
    }
    
    function runBootSequence() {
      let progressVal = 0;
      const logs = [
        "mounting virtual file system...",
        "loading neural weights...",
        "establishing agent protocols...",
        "compiling vLLM engines...",
        "booting main portfolio core..."
      ];
      let logIndex = 0;
      
      function updateBar() {
        if (progressVal <= 100) {
          let bars = Math.floor(progressVal / 4); // 25 blocks max
          let filled = '█'.repeat(bars);
          let empty = '░'.repeat(25 - bars);
          asciiBar.textContent = `[${filled}${empty}] ${progressVal}%`;
          
          if (progressVal % 20 < 10 && logIndex < logs.length) {
            const logLine = document.createElement('div');
            logLine.textContent = `> ${logs[logIndex]}`;
            sysLogs.appendChild(logLine);
            sysLogs.scrollTop = sysLogs.scrollHeight;
            logIndex++;
          }
          
          progressVal += Math.floor(Math.random() * 8) + 6; // Average 9.5 per frame
          setTimeout(updateBar, 25);
        } else {
          asciiBar.textContent = `[█████████████████████████] 100%`;
          setTimeout(completeBoot, 100);
        }
      }
      updateBar();
    }
    
    function completeBoot() {
      line3.style.animation = 'statusFade 200ms ease forwards';
      setTimeout(fadeOutAndRemove, 600);
    }

    function fadeOutAndRemove() {
      clearTimeout(_overflowSafety); // BUG-12: cancel safety timeout on normal exit
      overlay.classList.add('loader-fade-out');
      
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        if (style.parentNode) style.parentNode.removeChild(style);
        document.body.style.overflow = '';
        document.dispatchEvent(new CustomEvent('portfolioReady'));
      }, 350);
    }

    typeChar();
  }

  if (!document.body) {
    document.addEventListener('DOMContentLoaded', initLoader);
  } else {
    initLoader();
  }
})();
