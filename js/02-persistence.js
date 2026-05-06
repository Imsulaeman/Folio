/* ═══════════════════════════════════
   PERSISTENCE
   Primary: File System Access API (real .json file on disk)
   Fallback: localStorage
═══════════════════════════════════ */
const KEY = 'nihongo_v5';
const FILE_NAME = 'folio-data.json';
const HANDLE_DB = 'folio_handles';

/* ── File System Access API state ── */
let _dirHandle  = null;   // FileSystemDirectoryHandle (null if not linked)
let _fileSynced = false;  // true after successful file write this session

/* ── IndexedDB helpers for persisting the directory handle ── */
function _openHandleDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(HANDLE_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

async function _saveHandle(handle) {
  const db = await _openHandleDB();
  const tx = db.transaction('handles', 'readwrite');
  tx.objectStore('handles').put(handle, 'dir');
  return new Promise(r => { tx.oncomplete = r; });
}

async function _loadHandle() {
  try {
    const db  = await _openHandleDB();
    const tx  = db.transaction('handles', 'readonly');
    const req = tx.objectStore('handles').get('dir');
    return new Promise(resolve => {
      req.onsuccess = () => resolve(req.result || null);
      req.onerror   = () => resolve(null);
    });
  } catch { return null; }
}

async function _clearHandle() {
  const db = await _openHandleDB();
  const tx = db.transaction('handles', 'readwrite');
  tx.objectStore('handles').delete('dir');
}

/* ── File read/write ── */
async function _writeFile(data) {
  if (!_dirHandle) return false;
  try {
    // Verify we still have permission
    if ((await _dirHandle.queryPermission({ mode: 'readwrite' })) !== 'granted') {
      if ((await _dirHandle.requestPermission({ mode: 'readwrite' })) !== 'granted') {
        return false;
      }
    }
    const fh = await _dirHandle.getFileHandle(FILE_NAME, { create: true });
    const wr = await fh.createWritable();
    await wr.write(JSON.stringify(data, null, 2));
    await wr.close();
    _fileSynced = true;
    return true;
  } catch (err) {
    console.warn('[Folio] File write failed:', err.message);
    _fileSynced = false;
    return false;
  }
}

async function _readFile() {
  if (!_dirHandle) return null;
  try {
    if ((await _dirHandle.queryPermission({ mode: 'read' })) !== 'granted') {
      return null; // don't prompt on load — just use localStorage
    }
    const fh   = await _dirHandle.getFileHandle(FILE_NAME);
    const file = await fh.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null; // file doesn't exist yet or permission denied
  }
}

/* ── Public: link / unlink folder ── */
async function linkFolder() {
  if (!window.showDirectoryPicker) {
    showToast('Your browser doesn\'t support folder sync. Use Chrome or Edge.');
    return;
  }
  try {
    _dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await _saveHandle(_dirHandle);
    // Immediately write current data to the file
    const d = loadStore() || {};
    const ok = await _writeFile(d);
    if (ok) {
      showToast('Folder linked ✓ — data auto-saves here');
    } else {
      showToast('Folder linked but first write failed');
    }
    updateStorageHealth();
  } catch (err) {
    if (err.name !== 'AbortError') showToast('Folder link failed: ' + err.message);
  }
}

async function unlinkFolder() {
  _dirHandle  = null;
  _fileSynced = false;
  await _clearHandle();
  updateStorageHealth();
  showToast('Folder unlinked — using localStorage only');
}

function isFolderLinked() { return !!_dirHandle; }
function isFileSynced()   { return _fileSynced; }

/* ── Restore handle on page load ── */
async function initFileSync() {
  _dirHandle = await _loadHandle();
  if (_dirHandle) {
    // Try to read from file — it may have newer data (e.g. synced via OneDrive)
    const fileData = await _readFile();
    if (fileData) {
      const localData = loadStore();
      // Use whichever was modified more recently
      const fileTime  = fileData._lastSaved  || 0;
      const localTime = localData?._lastSaved || 0;
      if (fileTime > localTime) {
        localStorage.setItem(KEY, JSON.stringify(fileData));
        console.log('[Folio] Loaded newer data from file');
      }
    }
    _fileSynced = true;
  }
  updateStorageHealth();
}

/* ── Core load/save ── */
function loadStore() {
  try { return JSON.parse(localStorage.getItem(KEY) || 'null'); }
  catch { return null; }
}

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

// Debounce file writes (writes are async and expensive)
let _fileSaveTimer = null;
function _scheduleFileWrite(d) {
  if (!_dirHandle) return;
  clearTimeout(_fileSaveTimer);
  _fileSaveTimer = setTimeout(() => _writeFile(d), 1000);
}

function saveStore(d) {
  d._lastSaved = Date.now();
  localStorage.setItem(KEY, JSON.stringify(d));
  _scheduleFileWrite(d);  // async write to file (debounced)
}

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
  return getNotes(lessonName).some(n => n.text?.replace(/<[^>]+>/g,'').trim());
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
