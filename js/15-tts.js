/* ═══════════════════════════════════
   JAPANESE TTS
═══════════════════════════════════ */
let ttsVoice = null;

function initTTS() {
  const load = () => {
    const voices = window.speechSynthesis.getVoices();
    // Prefer a Japanese voice — look for ja-JP
    ttsVoice = voices.find(v => v.lang === 'ja-JP' && v.localService)
            || voices.find(v => v.lang === 'ja-JP')
            || voices.find(v => v.lang.startsWith('ja'))
            || null;
  };
  load();
  // Voices load async in some browsers
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = load;
  }
}

function speakJP(text) {
  if (!text?.trim()) return;
  // Strip HTML tags if any
  text = text.replace(/<[^>]+>/g, '').trim();
  window.speechSynthesis.cancel(); // stop any ongoing speech
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang  = 'ja-JP';
  utt.rate  = 0.9;   // slightly slower for study
  utt.pitch = 1;
  if (ttsVoice) utt.voice = ttsVoice;
  window.speechSynthesis.speak(utt);
}

function speakSelection() {
  if (lastSel) speakJP(lastSel);
  document.getElementById('sel-popup').style.display = 'none';
}
genWave();
// Request persistent storage — prevents browser from evicting IndexedDB/localStorage
navigator.storage?.persist?.();

// Init file sync before restoring session (loads newer data from file if available)
initFileSync().then(() => {
  restoreSession();
  renderDashboard();
  updateDueBadge();
}).catch(() => {
  restoreSession();
  renderDashboard();
  updateDueBadge();
});
initTTS();
// Request notification permission politely after 3 seconds
setTimeout(() => requestNotificationPermission(), 3000);
// Send daily notification if cards are due
setTimeout(() => sendDueNotification(), 4000);
// Refresh badge every minute
setInterval(updateDueBadge, 60000);

// Restore lesson order and hidden lessons from localStorage
(function restoreLessonState() {
  const d = loadStore() || {};
  if (d.hiddenLessons?.length) {
    // Hidden lesson URLs are gone (IDB will restore), mark names for restoration after IDB loads
    S._pendingHidden = d.hiddenLessons;
  }
  if (d.lessonOrder?.length) {
    S._pendingOrder = d.lessonOrder;
  }
})();

// Open IndexedDB then auto-restore PDFs stored from previous sessions
openIDB().then(async () => {
  // Restore all PDFs from IDB but DON'T select a lesson yet
  await restorePDFsFromIDB(/* skipSelect */ true);

  // Also restore any PDFs saved in the linked folder (survives IDB eviction)
  const folderFiles = await getPdfsFromFolder();
  for (const file of folderFiles) {
    const name = file.name.replace(/\.(pdf|epub)$/i, '');
    if (!S.lessons.find(l => l.name === name)) {
      const isEpub = file.name.toLowerCase().endsWith('.epub');
      const url = URL.createObjectURL(file);
      S.lessons.push({ name, url, type: isEpub ? 'epub' : 'pdf' });
      if (IDB) savePdfToIDB(name, file); // back-fill IDB
    }
  }

  // Apply saved order BEFORE selecting any lesson
  if (S._pendingOrder?.length) {
    const ordered = [];
    S._pendingOrder.forEach(name => {
      const found = S.lessons.find(l => l.name === name);
      if (found) ordered.push(found);
    });
    // Append any lessons not in saved order (newly added)
    S.lessons.forEach(l => { if (!ordered.find(o => o.name === l.name)) ordered.push(l); });
    S.lessons = ordered;
  }

  // Apply hidden lessons BEFORE selecting any lesson
  if (S._pendingHidden?.length) {
    S._pendingHidden.forEach(name => {
      const idx = S.lessons.findIndex(l => l.name === name);
      if (idx >= 0) {
        const lesson = S.lessons.splice(idx, 1)[0];
        S.hiddenLessons.push(lesson);
      }
    });
  }

  // Now select the first visible lesson, or clear the reader if none
  if (S.lessons.length) {
    renderSidebar(); renderNotesSidebar();
    selectLesson(0);
  } else {
    renderSidebar(); renderNotesSidebar();
    clearReader();
  }

  setMode('select');
  updateStorageHealth();
  // Re-render dashboard now that lessons are loaded from IDB
  renderDashboard();
  updateDueBadge();
  // Check storage health every 30 minutes
  setInterval(updateStorageHealth, 30 * 60 * 1000);
}).catch(err => {
  console.warn('IndexedDB not available:', err);
  setMode('select');
  updateStorageHealth();
});

// Pomodoro drag
initPomoDrag();
// Repeat button starts dimmed (off)
document.getElementById('repeat-btn').style.opacity = '.4';
