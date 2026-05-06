/* ═══════════════════════════════════
   RIGHT NOTES PANEL
═══════════════════════════════════ */
let npTimer;

function updateNotesPanel() {
  const ph  = document.getElementById('np-ph');
  const ta  = document.getElementById('np-area');
  const ttl = document.getElementById('np-title');
  const sts = document.getElementById('np-status');
  const wrap= document.getElementById('np-wrap');
  const bar = document.getElementById('np-note-bar');

  if (!S.currentLessonName) {
    ph.style.display   = 'flex';
    wrap.style.display = 'none';
    ttl.textContent    = '📝 Notes';
    ttl.classList.remove('has-lesson');
    sts.textContent    = '';
    return;
  }

  ph.style.display   = 'none';
  wrap.style.display = 'flex';
  ttl.textContent    = formatLessonName(S.currentLessonName);
  ttl.classList.add('has-lesson');

  // Ensure at least one note exists
  if (!getNotes(S.currentLessonName).length) addNote(S.currentLessonName);

  renderNpBar();

  const activeId   = getActiveNoteId(S.currentLessonName);
  const activeNote = getActiveNote(S.currentLessonName);
  sts.textContent  = 'saved';
  ta.innerHTML     = migrateNoteToHtml(activeNote?.text || '');

  // Scroll to bottom (most recent writing)
  requestAnimationFrame(() => { ta.scrollTop = ta.scrollHeight; });

  ta.oninput = function() {
    sts.textContent = 'saving…';
    clearTimeout(npTimer);
    const lid = S.currentLessonName, nid = getActiveNoteId(lid);
    npTimer = setTimeout(() => {
      saveNoteById(lid, nid, this.innerHTML);
      sts.textContent = '✓ saved';
      syncNoteToTab(lid, nid, this.innerHTML);
    }, 500);
  };
}

function renderNpBar() {
  const bar   = document.getElementById('np-note-bar');
  const notes = getNotes(S.currentLessonName);
  const actId = getActiveNoteId(S.currentLessonName);
  bar.innerHTML = '';
  notes.forEach(n => {
    const pill = document.createElement('button');
    pill.className = 'np-pill' + (n.id === actId ? ' active' : '');
    pill.textContent = n.name;
    pill.title = 'Double-click to rename';
    pill.onclick = () => switchNpNote(n.id);
    pill.ondblclick = () => {
      const newName = prompt('Rename note:', n.name);
      if (newName?.trim()) { renameNote(S.currentLessonName, n.id, newName.trim()); renderNpBar(); renderNotesSidebar(); }
    };
    bar.appendChild(pill);
  });
  const addBtn = document.createElement('button');
  addBtn.className = 'np-add-pill';
  addBtn.textContent = '+ New';
  addBtn.onclick = () => {
    const id = addNote(S.currentLessonName);
    setActiveNoteId(S.currentLessonName, id);
    renderNpBar();
    renderNotesSidebar();
    const ta = document.getElementById('np-area');
    ta.innerHTML = '';
    ta.focus();
    syncNoteToTab(S.currentLessonName, id, '');
  };
  bar.appendChild(addBtn);
}

function switchNpNote(noteId) {
  setActiveNoteId(S.currentLessonName, noteId);
  const ta   = document.getElementById('np-area');
  const note = getNotes(S.currentLessonName).find(n => n.id === noteId);
  ta.innerHTML = migrateNoteToHtml(note?.text || '');
  requestAnimationFrame(() => { ta.scrollTop = ta.scrollHeight; });
  document.getElementById('np-status').textContent = 'saved';
  renderNpBar();
  // Sync Notes tab if same lesson
  if (S.activeNoteLesson === S.currentLessonName) {
    S.activeNoteId = noteId;
    const na = document.getElementById('note-area');
    if (na) na.innerHTML = migrateNoteToHtml(note?.text || '');
    const ttl = document.getElementById('notes-title');
    if (ttl) ttl.textContent = '📝 ' + S.currentLessonName + ' › ' + (note?.name || '');
    renderNotesSidebar();
  }
}

function syncNoteToTab(lessonName, noteId, html) {
  // Update Notes tab if it has the same lesson+note open
  if (S.activeNoteLesson === lessonName && S.activeNoteId === noteId) {
    const na = document.getElementById('note-area');
    if (na) na.innerHTML = html;
    document.getElementById('note-status').textContent = '✓ saved';
  }
}

function syncNotesTabToLesson(lessonName) {
  // Keep Notes tab sidebar in sync with whatever lesson is now loaded.
  // Called whenever a new lesson is opened (loadPDF / loadEpub).
  S.activeNoteLesson = lessonName;
  const id = getActiveNoteId(lessonName);
  if (id) S.activeNoteId = id;
  renderNotesSidebar();
  // If the Notes tab is currently visible, also update the editor
  if (document.getElementById('notes-view').classList.contains('active')) {
    const noteId = id || ensureNote(lessonName);
    S.activeNoteId = noteId;
    openNote(lessonName, noteId);
  }
}

/* ═══════════════════════════════════
   NOTES (full tab)
═══════════════════════════════════ */
let noteTimer;

function renderNotesSidebar() {
  const list = document.getElementById('notes-lesson-list');
  if (!S.lessons.length) {
    list.innerHTML = '<div style="font-size:11px;color:var(--muted)">Upload PDFs first.</div>'; return;
  }
  list.innerHTML = S.lessons.map((l, i) => {
    const notes  = getNotes(l.name);
    const isOpen = l.name === S.activeNoteLesson;
    const hn     = hasNote(l.name);
    const actId  = S.activeNoteId;
    const noteItems = notes.map(n => `
      <div class="note-subitem ${isOpen && n.id === actId ? 'active' : ''}"
           data-lesson="${i}" data-noteid="${n.id}">
        <span class="note-subitem-name">${n.name}</span>
        <span style="font-size:10px;color:var(--muted);cursor:pointer" data-rename="${i}" data-noteid="${n.id}" title="Rename">✎</span>
        ${notes.length > 1 ? `<span style="font-size:10px;color:var(--muted);cursor:pointer" data-del="${i}" data-noteid="${n.id}" title="Delete">×</span>` : ''}
      </div>`).join('');
    return `
      <div class="note-lesson-group">
        <div class="note-lesson-header ${hn?'has-note':''} ${isOpen?'open':''}" data-toggle="${i}">
          <span class="note-dot"></span>
          <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${formatLessonName(l.name)}</span>
          <span class="note-lesson-arrow ${isOpen?'open':''}">▶</span>
        </div>
        <div class="note-subnotes ${isOpen?'open':''}">
          ${noteItems}
          <button class="note-add-btn" data-addnote="${i}">+ New note</button>
        </div>
      </div>`;
  }).join('');
}

document.getElementById('notes-lesson-list').addEventListener('click', e => {
  // Toggle lesson open/close
  const toggle = e.target.closest('[data-toggle]');
  if (toggle) {
    const i = parseInt(toggle.dataset.toggle);
    const name = S.lessons[i].name;
    if (S.activeNoteLesson !== name) {
      S.activeNoteLesson = name;
      // Auto-open most recent note
      const id = getActiveNoteId(name) || ensureNote(name);
      S.activeNoteId = id;
      openNote(name, id);
    } else {
      // Toggle collapse
      S.activeNoteLesson = null;
      S.activeNoteId = null;
      document.getElementById('notes-ph').style.display     = 'flex';
      document.getElementById('notes-editor').style.display = 'none';
      renderNotesSidebar();
    }
    return;
  }

  // Open specific note
  const subitem = e.target.closest('[data-noteid][data-lesson]');
  if (subitem && !e.target.dataset.rename && !e.target.dataset.del) {
    const i = parseInt(subitem.dataset.lesson);
    openNote(S.lessons[i].name, subitem.dataset.noteid);
    return;
  }

  // Rename note
  if (e.target.dataset.rename !== undefined) {
    const i = parseInt(e.target.dataset.rename);
    const id = e.target.dataset.noteid;
    const notes = getNotes(S.lessons[i].name);
    const note  = notes.find(n => n.id === id);
    const newName = prompt('Rename note:', note?.name || '');
    if (newName?.trim()) { renameNote(S.lessons[i].name, id, newName.trim()); renderNotesSidebar(); renderNpBar(); }
    return;
  }

  // Delete note
  if (e.target.dataset.del !== undefined) {
    const i = parseInt(e.target.dataset.del);
    const id = e.target.dataset.noteid;
    if (!confirm('Delete this note?')) return;
    deleteNoteById(S.lessons[i].name, id);
    if (S.activeNoteId === id) {
      const remaining = getNotes(S.lessons[i].name);
      if (remaining.length) openNote(S.lessons[i].name, remaining[0].id);
      else { document.getElementById('notes-ph').style.display='flex'; document.getElementById('notes-editor').style.display='none'; }
    }
    renderNotesSidebar();
    return;
  }

  // Add note button
  const addBtn = e.target.closest('[data-addnote]');
  if (addBtn) {
    const i  = parseInt(addBtn.dataset.addnote);
    const id = addNote(S.lessons[i].name);
    openNote(S.lessons[i].name, id);
    return;
  }
});

function openNote(lessonName, noteId) {
  S.activeNoteLesson = lessonName;
  S.activeNoteId     = noteId;
  setActiveNoteId(lessonName, noteId);
  renderNotesSidebar();

  document.getElementById('notes-ph').style.display     = 'none';
  document.getElementById('notes-editor').style.display = 'flex';

  const note = getNotes(lessonName).find(n => n.id === noteId);
  document.getElementById('notes-title').textContent  = '📝 ' + lessonName + (note ? ' › ' + note.name : '');
  document.getElementById('note-status').textContent  = 'saved';

  const ta = document.getElementById('note-area');
  ta.innerHTML = migrateNoteToHtml(note?.text || '');
  // Scroll to bottom
  requestAnimationFrame(() => { ta.scrollTop = ta.scrollHeight; });

  ta.oninput = function() {
    document.getElementById('note-status').textContent = 'saving…';
    clearTimeout(noteTimer);
    const lid = lessonName, nid = noteId;
    noteTimer = setTimeout(() => {
      saveNoteById(lid, nid, this.innerHTML);
      document.getElementById('note-status').textContent = '✓ saved';
      // Sync right panel if same lesson+note
      if (S.currentLessonName === lid && getActiveNoteId(lid) === nid) {
        const np = document.getElementById('np-area');
        if (np) np.innerHTML = this.innerHTML;
        document.getElementById('np-status').textContent = '✓ saved';
      }
    }, 500);
  };
  ta.focus();
  // Place cursor at end of contenteditable
  const range = document.createRange();
  range.selectNodeContents(ta);
  range.collapse(false);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  // Sync right panel to this note if same lesson
  if (S.currentLessonName === lessonName) {
    setActiveNoteId(lessonName, noteId);
    const npTa = document.getElementById('np-area');
    if (npTa) { npTa.innerHTML = migrateNoteToHtml(note?.text || ''); requestAnimationFrame(() => { npTa.scrollTop = npTa.scrollHeight; }); }
    renderNpBar();
  }
}

// Ctrl+S
document.addEventListener('keydown', e => {
  if ((e.ctrlKey||e.metaKey) && e.key==='s') {
    const ta = document.getElementById('note-area');
    if (S.activeNoteLesson && S.activeNoteId && document.activeElement === ta) {
      e.preventDefault();
      clearTimeout(noteTimer);
      saveNoteById(S.activeNoteLesson, S.activeNoteId, ta.innerHTML);
      document.getElementById('note-status').textContent = '✓ saved';
      showToast('Saved');
    }
  }
});

/* Notes export / import */
function exportNotes() {
  const d = migrateNotes(loadStore() || {});
  const n = d.notes || {};
  if (!Object.keys(n).length) { showToast('No notes to export'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(n,null,2)],{type:'application/json'}));
  a.download = 'folio-notes.json'; a.click();
  // Record export timestamp for storage health indicator
  d.lastExport = Date.now();
  saveStore(d);
  updateStorageHealth();
  showToast('Exported ✓');
}

function importNotesFromFile(file) {
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const imp = JSON.parse(ev.target.result);
      const d   = migrateNotes(loadStore() || {});
      // imp can be old format (strings) or new format (arrays)
      Object.keys(imp).forEach(lesson => {
        const val = imp[lesson];
        if (typeof val === 'string') {
          // Merge into first note or create
          d.notes = d.notes || {};
          d.notes[lesson] = d.notes[lesson] || [];
          if (d.notes[lesson].length) d.notes[lesson][0].text = val;
          else d.notes[lesson].push({id:'note-1',name:'Note 1',text:val,lastEdited:Date.now()});
        } else if (Array.isArray(val)) {
          d.notes[lesson] = val;
        }
      });
      saveStore(d);
      renderNotesSidebar();
      updateNotesPanel();
      showToast('Imported ✓');
    } catch { showToast('Invalid file'); }
  };
  r.readAsText(file);
}

document.getElementById('notes-import-file').addEventListener('change', function(e) {
  importNotesFromFile(e.target.files[0]); this.value='';
});
document.getElementById('np-import-file').addEventListener('change', function(e) {
  importNotesFromFile(e.target.files[0]); this.value='';
});
