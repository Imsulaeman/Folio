/* ═══════════════════════════════════
   STORAGE HEALTH INDICATOR
═══════════════════════════════════ */
function updateStorageHealth() {
  const d   = loadStore() || {};
  const dot = document.getElementById('sh-dot');
  const lbl = document.getElementById('sh-label');
  if (!dot) return;

  const lastExport = d.lastExport;
  const now        = Date.now();
  const daysSince  = lastExport ? Math.floor((now - lastExport) / 86400000) : 999;

  if (daysSince <= 7) {
    dot.style.background = '#5bbf7a';
    lbl.textContent = 'Notes safe';
    lbl.style.color = 'var(--muted)';
    document.getElementById('storage-health').style.borderColor = 'var(--border)';
  } else if (daysSince <= 14) {
    dot.style.background = '#c9a227';
    lbl.textContent = `Back up! (${daysSince}d)`;
    lbl.style.color = '#c9a227';
    document.getElementById('storage-health').style.borderColor = '#c9a227';
  } else {
    dot.style.background = 'var(--accent)';
    lbl.textContent = `Export notes now`;
    lbl.style.color = 'var(--accent)';
    document.getElementById('storage-health').style.borderColor = 'var(--accent)';
  }
}
