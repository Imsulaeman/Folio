/* ═══════════════════════════════════
   STORAGE HEALTH INDICATOR
═══════════════════════════════════ */
function updateStorageHealth() {
  const d   = loadStore() || {};
  const dot = document.getElementById('sh-dot');
  const lbl = document.getElementById('sh-label');
  if (!dot) return;

  const linked = isFolderLinked();
  const synced = isFileSynced();

  if (linked && synced) {
    // File sync active — data is safe on disk
    dot.style.background = '#5bbf7a';
    dot.style.boxShadow  = '0 0 6px #5bbf7a';
    lbl.textContent = '📁 Synced';
    lbl.style.color = 'var(--muted)';
    document.getElementById('storage-health').style.borderColor = 'var(--border)';
    document.getElementById('storage-health').title = 'Data synced to folder · click to manage';
  } else if (linked && !synced) {
    // Linked but write pending or failed
    dot.style.background = '#c9a227';
    dot.style.boxShadow  = '0 0 6px #c9a227';
    lbl.textContent = '📁 Syncing…';
    lbl.style.color = '#c9a227';
    document.getElementById('storage-health').style.borderColor = '#c9a227';
    document.getElementById('storage-health').title = 'File write pending';
  } else {
    // No file sync — fall back to export-based health
    const lastExport = d.lastExport;
    const now        = Date.now();
    const daysSince  = lastExport ? Math.floor((now - lastExport) / 86400000) : 999;

    if (daysSince <= 7) {
      dot.style.background = '#5bbf7a';
      dot.style.boxShadow  = '0 0 6px #5bbf7a';
      lbl.textContent = 'Notes safe';
      lbl.style.color = 'var(--muted)';
      document.getElementById('storage-health').style.borderColor = 'var(--border)';
    } else if (daysSince <= 14) {
      dot.style.background = '#c9a227';
      dot.style.boxShadow  = '0 0 6px #c9a227';
      lbl.textContent = `Back up! (${daysSince}d)`;
      lbl.style.color = '#c9a227';
      document.getElementById('storage-health').style.borderColor = '#c9a227';
    } else {
      dot.style.background = 'var(--accent)';
      dot.style.boxShadow  = '0 0 6px var(--accent)';
      lbl.textContent = `Export notes now`;
      lbl.style.color = 'var(--accent)';
      document.getElementById('storage-health').style.borderColor = 'var(--accent)';
    }
    document.getElementById('storage-health').title =
      'localStorage only · click to link a save folder';
  }
}

/* ── Storage health click handler ── */
function onStorageHealthClick() {
  if (isFolderLinked()) {
    // Show unlink option
    if (confirm('Data is synced to a folder.\n\n• Click OK to unlink (revert to localStorage only)\n• Click Cancel to keep syncing')) {
      unlinkFolder();
    }
  } else {
    // Offer to link a folder or export
    const choice = confirm(
      'Your data lives in localStorage only (fragile!).\n\n' +
      '• Click OK to link a save folder (recommended)\n' +
      '  → auto-saves folio-data.json to your chosen folder\n' +
      '  → works great with OneDrive / Google Drive\n\n' +
      '• Click Cancel to do a manual JSON export instead'
    );
    if (choice) {
      linkFolder();
    } else {
      exportNotes();
    }
  }
}
