/* ═══════════════════════════════════
   LIGHT / DARK THEME
═══════════════════════════════════ */
function setLogoState(isLight) {
  const awake = document.getElementById('logo-cat-awake');
  const sleep = document.getElementById('logo-cat-sleep');
  if (!awake || !sleep) return;
  awake.style.display = isLight ? 'none' : '';
  sleep.style.display = isLight ? ''     : 'none';
}

function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  const d = loadStore() || {};
  d.theme = isLight ? 'light' : 'dark';
  saveStore(d);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = isLight ? '🌙' : '☀️';
  setLogoState(isLight);
  if (typeof renderMochi === 'function') renderMochi();
}

// Apply saved theme on load
(function applyTheme() {
  const saved = (loadStore() || {}).theme;
  const isLight = saved === 'light';
  if (isLight) {
    document.body.classList.add('light');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = '🌙';
  }
  // Set logo state immediately (no transition on load)
  requestAnimationFrame(() => setLogoState(isLight));
})();

/* ═══════════════════════════════════
   SEPIA TOGGLE
═══════════════════════════════════ */
let sepiaOn = false;
function toggleSepia() {
  sepiaOn = !sepiaOn;
  const wrap = document.getElementById('canvas-wrap');
  const btn  = document.getElementById('sepia-btn');
  if (wrap) wrap.classList.toggle('sepia', sepiaOn);
  if (btn)  btn.classList.toggle('sepia-active', sepiaOn);
}
