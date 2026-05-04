/* ═══════════════════════════════════
   PERSISTENCE
═══════════════════════════════════ */
const KEY = 'nihongo_v5';
function loadStore()  { try { return JSON.parse(localStorage.getItem(KEY)||'null'); } catch { return null; } }

/* ── Multi-note migration ── */
function migrateNotes(d) {
  if (!d || !d.notes) return d || {};
  Object.keys(d.notes).forEach(lesson => {
    const val = d.notes[lesson];
    if (typeof val === 'string') {
      // Old format: plain string → wrap in array
      d.notes[lesson] = val.trim()
        ? [{ id:'note-1', name:'Note 1', text:val, lastEdited:Date.now() }]
        : [];
    }
  });
  return d;
}

function saveStore(d) { localStorage.setItem(KEY, JSON.stringify(d)); }

function persist() {
  // Load full existing store (preserving theme, studyDays, lessonOrder, etc.)
  const d = migrateNotes(loadStore() || {});
  d.progress    = d.progress    || {};
  d.notes       = d.notes       || {};
  d.activeNoteId= d.activeNoteId|| {};
  d.cards       = S.cards;
  if (S.currentLessonName) d.progress[S.currentLessonName] = S.page;
  saveStore(d);
}

function getSavedPage(n) { return loadStore()?.progress?.[n] || 1; }

/* ── Note helpers ── */
function getNotes(lessonName) {
  const d = migrateNotes(loadStore() || {});
  return d.notes?.[lessonName] || [];
}

function getActiveNoteId(lessonName) {
  const d = migrateNotes(loadStore() || {});
  const notes = d.notes?.[lessonName] || [];
  if (!notes.length) return null;
  const stored = d.activeNoteId?.[lessonName];
  if (stored && notes.find(n => n.id === stored)) return stored;
  // Default: most recently edited
  return notes.reduce((a,b) => ((a.lastEdited||0) >= (b.lastEdited||0) ? a : b)).id;
}

function setActiveNoteId(lessonName, noteId) {
  const d = migrateNotes(loadStore() || {});
  d.activeNoteId = d.activeNoteId || {};
  d.activeNoteId[lessonName] = noteId;
  saveStore(d);
}

function getActiveNote(lessonName) {
  const id = getActiveNoteId(lessonName);
  return getNotes(lessonName).find(n => n.id === id) || null;
}

function saveNoteById(lessonName, noteId, text) {
  const d = migrateNotes(loadStore() || {});
  d.notes = d.notes || {};
  d.notes[lessonName] = d.notes[lessonName] || [];
  const note = d.notes[lessonName].find(n => n.id === noteId);
  if (note) { note.text = text; note.lastEdited = Date.now(); }
  saveStore(d);
  renderNotesSidebar();
}

function addNote(lessonName) {
  const d = migrateNotes(loadStore() || {});
  d.notes = d.notes || {};
  d.notes[lessonName] = d.notes[lessonName] || [];
  const idx = d.notes[lessonName].length + 1;
  const id  = 'note-' + Date.now();
  d.notes[lessonName].push({ id, name:`Note ${idx}`, text:'', lastEdited:Date.now() });
  saveStore(d);
  return id;
}

function renameNote(lessonName, noteId, newName) {
  const d = migrateNotes(loadStore() || {});
  const note = d.notes?.[lessonName]?.find(n => n.id === noteId);
  if (note) { note.name = newName; saveStore(d); }
}

function deleteNoteById(lessonName, noteId) {
  const d = migrateNotes(loadStore() || {});
  if (!d.notes?.[lessonName]) return;
  d.notes[lessonName] = d.notes[lessonName].filter(n => n.id !== noteId);
  saveStore(d);
}

function hasNote(lessonName) {
  return getNotes(lessonName).some(n => n.text?.trim());
}

// Legacy compat for addSelectionToNotes
function getNote(n) { return getActiveNote(n)?.text || ''; }
function saveNoteText(name, text) {
  const id = getActiveNoteId(name) || ensureNote(name);
  saveNoteById(name, id, text);
}
function ensureNote(lessonName) {
  const existing = getNotes(lessonName);
  if (existing.length) return existing[0].id;
  return addNote(lessonName);
}
