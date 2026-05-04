/* ═══════════════════════════════════
   LIGHT / DARK THEME
═══════════════════════════════════ */
function toggleTheme() {
  const isLight = document.body.classList.toggle('light');
  const d = loadStore() || {};
  d.theme = isLight ? 'light' : 'dark';
  saveStore(d);
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = isLight ? '🌙' : '☀️';
}

// Apply saved theme on load
(function applyTheme() {
  const saved = (loadStore() || {}).theme;
  if (saved === 'light') {
    document.body.classList.add('light');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = '🌙';
  }
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
