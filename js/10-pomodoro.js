/* ═══════════════════════════════════
   POMODORO TIMER
   Phases: work(25m) → rest(5m) × 4 cycles → long rest(30m)
═══════════════════════════════════ */
const POMO = {
  WORK: { label:'Focus',      secs: 25*60, cls:'work' },
  REST: { label:'Short Rest', secs:  5*60, cls:'rest' },
  LONG: { label:'Long Rest',  secs: 30*60, cls:'long' },
};

let pomoPhase     = POMO.WORK;   // current phase object
let pomoSecsLeft  = POMO.WORK.secs;
let pomoRunning   = false;
let pomoInterval  = null;
let pomoCycle     = 0;           // 0-3 completed work sessions
let pomoWorksDone = 0;           // completed work sessions in current set

function pomoTick() {
  pomoSecsLeft--;
  pomoRender();
  if (pomoSecsLeft <= 0) {
    clearInterval(pomoInterval); pomoRunning = false;
    if (pomoPhase === POMO.WORK) {
      pomoWorksDone++;
      pomoSplash();              // 🍅 animation + bell!
      if (pomoWorksDone >= 4) {
        pomoWorksDone = 0;
        pomoPhase = POMO.LONG;
      } else {
        pomoPhase = POMO.REST;
      }
    } else {
      playBell(false);           // gentle bell for rest end
      pomoPhase = POMO.WORK;
    }
    pomoSecsLeft = pomoPhase.secs;
    pomoRender();
    document.getElementById('pomo-play').textContent = '▶';
  }
}

function pomoToggle() {
  if (pomoRunning) {
    clearInterval(pomoInterval); pomoRunning = false;
    document.getElementById('pomo-play').textContent = '▶';
  } else {
    pomoRunning = true;
    pomoInterval = setInterval(pomoTick, 1000);
    document.getElementById('pomo-play').textContent = '⏸';
  }
}

function pomoReset() {
  clearInterval(pomoInterval); pomoRunning = false;
  pomoPhase = POMO.WORK; pomoSecsLeft = POMO.WORK.secs;
  pomoWorksDone = 0;
  document.getElementById('pomo-play').textContent = '▶';
  pomoRender();
}

function pomoSkip() {
  clearInterval(pomoInterval); pomoRunning = false;
  document.getElementById('pomo-play').textContent = '▶';
  if (pomoPhase === POMO.WORK) {
    pomoWorksDone++;
    if (pomoWorksDone >= 4) { pomoWorksDone = 0; pomoPhase = POMO.LONG; }
    else pomoPhase = POMO.REST;
  } else {
    pomoPhase = POMO.WORK;
  }
  pomoSecsLeft = pomoPhase.secs;
  pomoRender();
}

function pomoRender() {
  const m = String(Math.floor(pomoSecsLeft / 60)).padStart(2,'0');
  const s = String(pomoSecsLeft % 60).padStart(2,'0');
  document.getElementById('pomo-time').textContent  = `${m}:${s}`;
  document.getElementById('pomo-label').textContent = pomoPhase.label;
  const w = document.getElementById('pomo-widget');
  w.className = pomoPhase.cls;
  // Dots = completed work sessions
  for (let i = 0; i < 4; i++) {
    document.getElementById('pd'+i).classList.toggle('done', i < pomoWorksDone);
  }
  // Tomato changes emoji on rest
  document.getElementById('pomo-tomato').textContent =
    pomoPhase === POMO.WORK ? '🍅' : pomoPhase === POMO.REST ? '☕' : '🌙';
}

/* ── Bell alarm (Web Audio API) ── */
function playBell(isWorkEnd) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = isWorkEnd
      ? [523.25, 659.25, 783.99, 1046.50, 1318.51]   // C5 E5 G5 C6 E6 — triumphant
      : [783.99, 659.25, 523.25];                      // G5 E5 C5 — gentle rest tone
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type      = 'sine';
      osc.frequency.value = freq;
      const t = ctx.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.5, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.7);
      osc.start(t); osc.stop(t + 0.72);
    });
    // Extra resonant low boom on work end
    if (isWorkEnd) {
      const boom = ctx.createOscillator();
      const bg   = ctx.createGain();
      boom.connect(bg); bg.connect(ctx.destination);
      boom.type = 'sine'; boom.frequency.value = 130;
      const t = ctx.currentTime;
      bg.gain.setValueAtTime(0.4, t);
      bg.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      boom.start(t); boom.stop(t + 1.25);
    }
  } catch(e) { console.warn('Audio context error', e); }
}

/* ── Full-screen tomato splash ── */
function pomoSplash() {
  playBell(true);
  incrementPomoCount();

  const W = window.innerWidth, H = window.innerHeight;

  // Phase 1 — red pulsing overlay
  const overlay = document.createElement('div');
  overlay.style.cssText = `position:fixed;inset:0;background:rgba(192,57,43,0);z-index:1000;
    pointer-events:none;transition:background .15s;`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => {
    overlay.style.background = 'rgba(192,57,43,0.35)';
    setTimeout(() => { overlay.style.background = 'rgba(192,57,43,0)'; }, 200);
    setTimeout(() => { overlay.style.background = 'rgba(192,57,43,0.2)'; }, 400);
    setTimeout(() => { overlay.style.background = 'rgba(0,0,0,0.55)'; }, 600);
    setTimeout(() => { overlay.style.background = 'rgba(0,0,0,0)'; overlay.remove(); }, 3200);
  });

  // Phase 2 — 20 tomatoes explode from widget outward to all screen edges
  const widget = document.getElementById('pomo-widget');
  const wr     = widget.getBoundingClientRect();
  const ox     = wr.left + wr.width  / 2;
  const oy     = wr.top  + wr.height / 2;

  const edges = [];
  for (let i = 0; i < 20; i++) {
    // Pick random edge target
    const side = Math.floor(Math.random() * 4);
    let tx, ty;
    if (side === 0) { tx = Math.random()*W; ty = -40; }        // top
    else if (side===1){ tx=W+40; ty=Math.random()*H; }         // right
    else if (side===2){ tx=Math.random()*W; ty=H+40; }         // bottom
    else              { tx=-40; ty=Math.random()*H; }           // left
    edges.push({tx,ty});
  }

  edges.forEach(({tx,ty}, i) => {
    const delay = i * 45;
    const size  = 28 + Math.random() * 36;
    const spin  = (Math.random() - 0.5) * 720;

    // Flying tomato
    const t = document.createElement('div');
    t.textContent = '🍅';
    t.style.cssText = `position:fixed;left:${ox}px;top:${oy}px;font-size:${size}px;
      pointer-events:none;z-index:1001;transform:translate(-50%,-50%) rotate(0deg);
      transition:none;`;
    document.body.appendChild(t);

    setTimeout(() => {
      const dur = 600 + Math.random() * 400;
      t.style.transition = `left ${dur}ms cubic-bezier(.2,.8,.4,1), top ${dur}ms cubic-bezier(.2,.8,.4,1), transform ${dur}ms ease-out, opacity ${dur*0.4}ms ease-in ${dur*0.6}ms`;
      t.style.left      = tx + 'px';
      t.style.top       = ty + 'px';
      t.style.transform = `translate(-50%,-50%) rotate(${spin}deg)`;
      t.style.opacity   = '0';

      // Splat at landing edge
      const splat = document.createElement('div');
      const sz    = 30 + Math.random()*50;
      splat.style.cssText = `position:fixed;left:${tx-sz/2}px;top:${ty-sz/2}px;
        width:${sz}px;height:${sz}px;border-radius:50%;pointer-events:none;z-index:1000;
        background:radial-gradient(circle,rgba(192,57,43,.8) 0%,rgba(192,57,43,0) 70%);
        transform:scale(0);transition:transform ${200}ms ease-out ${dur}ms, opacity 1.2s ease-out ${dur+300}ms;`;
      document.body.appendChild(splat);
      requestAnimationFrame(() => requestAnimationFrame(() => {
        splat.style.transform = 'scale(1)';
        splat.style.opacity   = '0';
      }));

      const cleanup = dur + 2000;
      setTimeout(() => { t.remove(); splat.remove(); }, cleanup);
    }, delay);
  });

  // Phase 3 — big DONE text slams in
  setTimeout(() => {
    const msg = document.createElement('div');
    msg.style.cssText = `position:fixed;left:50%;top:50%;transform:translate(-50%,-50%) scale(0.3);
      z-index:1002;font-family:var(--fd);font-size:clamp(48px,10vw,96px);color:#fff;
      text-shadow:0 4px 30px rgba(0,0,0,.8);pointer-events:none;text-align:center;
      transition:transform .35s cubic-bezier(.17,.67,.3,1.4), opacity .3s;opacity:0;line-height:1.2;`;
    msg.innerHTML = '<img src="img/stickers/sprite-3-1.png" style="width:90px;height:90px;object-fit:contain;display:block;margin:0 auto 6px" alt=""><br>Session Done!';
    document.body.appendChild(msg);
    requestAnimationFrame(() => requestAnimationFrame(() => {
      msg.style.transform = 'translate(-50%,-50%) scale(1)';
      msg.style.opacity   = '1';
    }));
    setTimeout(() => {
      msg.style.transition = 'opacity .5s';
      msg.style.opacity    = '0';
      setTimeout(() => msg.remove(), 600);
    }, 1500);
  }, 500);
}
