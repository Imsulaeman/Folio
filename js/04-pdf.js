/* ═══════════════════════════════════
   PDF / LESSONS
═══════════════════════════════════ */
document.getElementById('pdf-upload').addEventListener('change', function(e) {
  [...e.target.files].forEach(f => addLesson(f, true)); this.value='';
});

async function addLesson(file, saveToIDB=false) {
  const isEpub = file.name.toLowerCase().endsWith('.epub');
  const isPdf  = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf && !isEpub) return;

  const name = file.name.replace(/\.(pdf|epub)$/i, '');
  const url  = URL.createObjectURL(file);
  const existing = S.lessons.findIndex(l => l.name === name);
  const lesson = { name, url, type: isEpub ? 'epub' : 'pdf' };

  if (existing >= 0) {
    S.lessons[existing] = { ...S.lessons[existing], url, type: lesson.type };
  } else {
    S.lessons.push(lesson);
  }

  if (saveToIDB && IDB) await savePdfToIDB(name, file);
  renderSidebar(); renderNotesSidebar();
  const idx = S.lessons.findIndex(l => l.name === name);
  selectLesson(idx >= 0 ? idx : S.lessons.length - 1);
  document.getElementById('restore-banner')?.remove();
}

function renderSidebar() {
  const ll = document.getElementById('lesson-list');
  if (!S.lessons.length) {
    ll.innerHTML = `<label for="pdf-upload"><div class="lesson-empty">Drop PDFs or click + PDF above</div></label>`;
    return;
  }
  const d = loadStore() || {};
  ll.innerHTML = S.lessons.map((l,i) => {
    const pg    = d.progress?.[l.name] || 0;
    const total = l.pages || 0;
    const pct   = (total > 0 && pg) ? Math.min(100, Math.round((pg / total) * 100)) : 0;
    const isEpub = l.type === 'epub';
    const progressBar = total > 0
      ? `<div class="lesson-progress-wrap"><div class="lesson-progress-fill" style="width:${pct}%"></div></div>`
      : '';
    return `<div class="lesson-item ${i===S.active?'active':''}" data-li="${i}" onclick="selectLesson(${i})">
      <span class="lesson-drag" data-drag="${i}" title="Drag to reorder">⠿</span>
      <div style="flex:1;min-width:0">
        <span class="lesson-name">${formatLessonName(l.name)}</span>
        ${progressBar}
      </div>
      <span class="badge-pdf${isEpub?' badge-epub':''}">${isEpub?'EPUB':'PDF'}</span>
      <button class="lesson-hide" title="Hide lesson" onclick="hideLesson(event,${i})">×</button>
    </div>`;
  }).join('');
  initLessonDrag();
}

function clearReader() {
  // Reset PDF/EPUB viewer to blank state
  document.getElementById('pdf-ph').style.display        = 'block';
  document.getElementById('pdf-page-wrap').style.display = 'none';
  document.getElementById('epub-wrap').style.display     = 'none';
  S.pdfDoc = null; epubBook = null;
  document.getElementById('page-info').textContent  = 'No PDF loaded';
  document.getElementById('prev-btn').disabled = true;
  document.getElementById('next-btn').disabled = true;
  // Hide notes panel when no lesson is loaded (welcome screen)
  const np = document.querySelector('.notes-panel');
  if (np) np.style.display = 'none';
  // Clear draw canvas
  const dc = document.getElementById('draw-canvas');
  if (dc) { const ctx = dc.getContext('2d'); ctx.clearRect(0,0,dc.width,dc.height); }
  // Clear sticky layer
  const sl = document.getElementById('sticky-layer');
  if (sl) sl.innerHTML = '';
}

function hideLesson(e, i) {
  e.stopPropagation();
  const lesson = S.lessons.splice(i, 1)[0];
  S.hiddenLessons.push(lesson);
  if (S.active === i) {
    S.active = S.lessons.length ? 0 : -1;
    if (S.active >= 0) selectLesson(0);
    else { clearReader(); S.currentLessonName = null; updateNotesPanel(); }
  } else if (S.active > i) {
    S.active--;
  }
  saveLessonOrder();
  renderSidebar(); renderNotesSidebar();
  showToast(`"${lesson.name}" hidden — find it in Dashboard`);
}

function restoreLesson(name) {
  const idx = S.hiddenLessons.findIndex(l => l.name === name);
  if (idx < 0) return;
  const lesson = S.hiddenLessons.splice(idx, 1)[0];
  S.lessons.push(lesson);
  saveLessonOrder();
  renderSidebar(); renderNotesSidebar();
  selectLesson(S.lessons.length - 1);
  showToast(`"${lesson.name}" restored`);
}

function deleteLesson(name) {
  const confirmed = confirm(
    `Permanently delete "${name}"?\n\n` +
    `• The file will be removed from storage\n` +
    `• All notes for this lesson will be deleted\n` +
    `• Reading progress will be cleared\n\n` +
    `This cannot be undone.`
  );
  if (!confirmed) return;

  // Remove from both active and hidden lists
  const hidIdx = S.hiddenLessons.findIndex(l => l.name === name);
  if (hidIdx >= 0) S.hiddenLessons.splice(hidIdx, 1);
  const actIdx = S.lessons.findIndex(l => l.name === name);
  if (actIdx >= 0) {
    S.lessons.splice(actIdx, 1);
    // If this was the active lesson, clear the reader
    if (S.active === actIdx) {
      S.active = S.lessons.length ? 0 : -1;
      if (S.active >= 0) selectLesson(0);
      else { clearReader(); S.currentLessonName = null; updateNotesPanel(); }
    } else if (S.active > actIdx) {
      S.active--;
    }
  }

  // Delete from IndexedDB
  if (IDB) idbDelete('pdfs', name).catch(() => {});

  // Clean notes, progress, activeNoteId from store
  const d = loadStore() || {};
  if (d.notes)        delete d.notes[name];
  if (d.progress)     delete d.progress[name];
  if (d.activeNoteId) delete d.activeNoteId[name];
  if (d.epubCfi)      delete d.epubCfi[name];
  d.lessonOrder   = S.lessons.map(l => l.name);
  d.hiddenLessons = S.hiddenLessons.map(l => l.name);
  d.cards = S.cards;
  saveStore(d);

  renderSidebar(); renderNotesSidebar(); renderDashboard();
  showToast(`"${name}" permanently deleted`);
}

function saveLessonOrder() {
  const d = loadStore() || {};
  d.lessonOrder  = S.lessons.map(l => l.name);
  d.hiddenLessons = S.hiddenLessons.map(l => l.name);
  saveStore(d);
}

/* Sidebar drag-to-reorder */
function initLessonDrag() {
  const ll = document.getElementById('lesson-list');
  let dragging = null, over = null;
  ll.querySelectorAll('.lesson-drag').forEach(handle => {
    handle.addEventListener('mousedown', e => {
      e.preventDefault();
      const item = handle.closest('.lesson-item');
      dragging = item;
      item.style.opacity = '.5';
      const moveFn = mv => {
        const els = [...ll.querySelectorAll('.lesson-item')];
        over = els.find(el => {
          if (el === dragging) return false;
          const r = el.getBoundingClientRect();
          return mv.clientY >= r.top && mv.clientY <= r.bottom;
        });
        els.forEach(el => el.style.borderTop = '');
        if (over) over.style.borderTop = '2px solid var(--accent)';
      };
      const upFn = () => {
        item.style.opacity = '';
        ll.querySelectorAll('.lesson-item').forEach(el => el.style.borderTop = '');
        if (over) {
          const fromIdx = parseInt(dragging.dataset.li);
          const toIdx   = parseInt(over.dataset.li);
          if (fromIdx !== toIdx) {
            const moved = S.lessons.splice(fromIdx, 1)[0];
            S.lessons.splice(toIdx, 0, moved);
            if (S.active === fromIdx) S.active = toIdx;
            else if (S.active > fromIdx && S.active <= toIdx) S.active--;
            else if (S.active < fromIdx && S.active >= toIdx) S.active++;
            saveLessonOrder();
            renderSidebar();
          }
        }
        dragging = over = null;
        document.removeEventListener('mousemove', moveFn);
        document.removeEventListener('mouseup', upFn);
      };
      document.addEventListener('mousemove', moveFn);
      document.addEventListener('mouseup', upFn);
    });
  });
}

function selectLesson(i) {
  // Save epub position before switching away (use epubBook.lessonName, not S.active)
  if (epubBook) saveEpubLocation();
  S.active = i;
  renderSidebar();
  const lesson = S.lessons[i];
  if (lesson.type === 'epub') {
    loadEpub(lesson.url, lesson.name);
  } else {
    loadPDF(lesson.url, lesson.name);
  }
}

/* ── PDF rendering ── */
async function loadPDF(url, lessonName) {
  epubBook = null; // Clear epub state so drawKey/stickyKey use PDF page keys
  // Hide epub reader, show PDF elements
  document.getElementById('epub-wrap').style.display      = 'none';
  document.getElementById('pdf-ph').style.display         = 'none';
  document.getElementById('pdf-page-wrap').style.display  = 'block';
  // Show notes panel when a lesson is loaded
  const np = document.querySelector('.notes-panel');
  if (np && !document.body.classList.contains('dash-active')) np.style.display = '';
  // Restore default prev/next button behaviour (may have been overridden by epub)
  document.getElementById('prev-btn').onclick = () => changePage(-1);
  document.getElementById('next-btn').onclick = () => changePage(1);
  S.pdfDoc = await pdfjsLib.getDocument(url).promise;
  S.total  = S.pdfDoc.numPages;
  S.page   = Math.min(getSavedPage(lessonName), S.pdfDoc.numPages);
  S.currentLessonName = lessonName;
  syncNotesTabToLesson(lessonName);
  // Store page count on lesson object so sidebar/dashboard can show progress %
  const lessonIdx = S.lessons.findIndex(l => l.name === lessonName);
  if (lessonIdx >= 0) { S.lessons[lessonIdx].pages = S.pdfDoc.numPages; renderSidebar(); }
  await renderPage();
  persist();
  updateNotesPanel();
  if (S.page > 1) showToast(`↩ Resumed at page ${S.page}`);
}

async function renderPage() {
  if (!S.pdfDoc) return;
  const page   = await S.pdfDoc.getPage(S.page);
  const canvas = document.getElementById('pdf-canvas');
  const wrap   = document.getElementById('canvas-wrap');
  const tl     = document.getElementById('text-layer');

  const baseVp    = page.getViewport({scale:1});
  const autoScale = (wrap.clientWidth - 40) / baseVp.width;
  const scale     = S.scale === 'auto' ? autoScale : S.scale;
  const vp        = page.getViewport({scale});

  canvas.width  = vp.width;
  canvas.height = vp.height;
  const pw = document.getElementById('pdf-page-wrap');
  pw.style.width  = vp.width  + 'px';
  pw.style.height = vp.height + 'px';

  // Render visual PDF
  await page.render({canvasContext:canvas.getContext('2d'), viewport:vp}).promise;

  // ── Build text layer for selection/copy ──
  // We use pdfjsLib.renderTextLayer (official API) with a manual fallback.
  tl.innerHTML = '';
  tl.style.width  = vp.width  + 'px';
  tl.style.height = vp.height + 'px';

  const textContent = await page.getTextContent();

  let usedPdfJs = false;
  try {
    // PDF.js 3.x renderTextLayer API
    const task = pdfjsLib.renderTextLayer({
      textContentSource: textContent,
      container: tl,
      viewport: vp,
      textDivs: [],
    });
    // task is a TextLayerRenderTask with .promise
    if (task && typeof task.promise !== 'undefined') {
      await task.promise;
      usedPdfJs = true;
    }
  } catch(e) {
    usedPdfJs = false;
  }

  if (!usedPdfJs || tl.childElementCount === 0) {
    // Manual fallback: place transparent spans at glyph positions
    tl.innerHTML = '';
    textContent.items.forEach(item => {
      if (typeof item.str !== 'string') return;
      const span = document.createElement('span');
      span.textContent = item.str + (item.hasEOL ? ' ' : '');

      // Transform from PDF user space → screen space
      const tx     = pdfjsLib.Util.transform(vp.transform, item.transform);
      // tx[4], tx[5] = screen position of glyph baseline origin
      const height = Math.hypot(tx[2], tx[3]);  // glyph height in screen px
      const angle  = Math.atan2(tx[1], tx[0]);

      Object.assign(span.style, {
        position:        'absolute',
        left:            tx[4] + 'px',
        // top: baseline_y minus height so span top = ascender line (approx)
        top:             (tx[5] - height) + 'px',
        fontSize:        height + 'px',
        fontFamily:      'sans-serif',
        color:           'transparent',
        whiteSpace:      'pre',
        cursor:          'text',
        userSelect:      'text',
        webkitUserSelect:'text',
        transformOrigin: '0% 0%',
        transform:       angle !== 0 ? `rotate(${angle}rad)` : '',
      });

      // Scale width to match PDF glyph width
      if (item.width > 0 && span.textContent.trim().length > 0) {
        span.style.width   = (item.width * scale) + 'px';
        span.style.display = 'inline-block';
      }

      tl.appendChild(span);
    });
  }

  document.getElementById('page-info').textContent = `Page ${S.page} of ${S.total}`;
  document.getElementById('prev-btn').disabled = S.page <= 1;
  document.getElementById('next-btn').disabled = S.page >= S.total;

  // Resize & reload draw canvas
  initDrawCanvas();
  if (IDB) { loadDrawings(); loadStickies(); }
}

function changePage(d) {
  // EPUB navigation
  if (S.lessons[S.active]?.type === 'epub') {
    if (d < 0) epubPrevChapter();
    else       { epubNextChapter(); recordStudyDay(); }
    return;
  }
  // PDF navigation
  if (!S.pdfDoc) return;
  const np = S.page + d;
  if (np < 1 || np > S.total) return;
  S.page = np; renderPage(); persist();
  recordStudyDay();
}

function jumpToPage() {
  const inp = document.getElementById('goto-input');
  const n   = parseInt(inp.value); inp.value='';
  if (!S.pdfDoc||isNaN(n)) return;
  S.page = Math.max(1, Math.min(S.total, n));
  renderPage(); persist();
}

function zoomPdf(d) {
  S.scale = Math.max(0.4, Math.min(3, (S.scale==='auto'?1.2:S.scale)+d));
  if (S.pdfDoc) renderPage();
}
function fitPage() { S.scale='auto'; if (S.pdfDoc) renderPage(); }

/* ── Keyboard shortcuts ── */
document.addEventListener('keydown', e => {
  const tag = document.activeElement?.tagName;
  if (tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT') return;
  if (document.getElementById('modal-bg').classList.contains('open')) return;

  const wrap = document.getElementById('canvas-wrap');
  const inCards = document.getElementById('flashcard-view').classList.contains('active');

  if (e.key==='ArrowLeft'  || e.key==='a' || e.key==='A') {
    if (inCards && (waitingForNext || srsQueueIdx > 0)) {
      e.preventDefault(); srsPreviousCard();
    } else if (!inCards) { e.preventDefault(); changePage(-1); }
  }
  if (e.key==='ArrowRight' || e.key==='d' || e.key==='D') {
    if (inCards && waitingForNext) {
      e.preventDefault();
      const c = srsQueue[srsQueueIdx];
      if (c) { clearWrongCountdown(); applyRatingAndAdvance(c, 'again', false); }
    } else if (!inCards) { e.preventDefault(); changePage(1); }
  }
  if (!inCards) {
    if (e.key==='ArrowUp'    || e.key==='w' || e.key==='W') { e.preventDefault(); wrap.scrollBy({top: -120, behavior:'smooth'}); }
    if (e.key==='ArrowDown'  || e.key==='s' || e.key==='S') { e.preventDefault(); wrap.scrollBy({top:  120, behavior:'smooth'}); }
  }
  if (e.key===' ' || e.code==='Space') { e.preventDefault(); togglePlay(); }
  if (e.key==='f' || e.key==='F') { e.preventDefault(); setMode(S.mode==='draw'?'select':'draw'); }
  if (e.key==='e' || e.key==='E') { e.preventDefault(); if (S.mode==='draw') toggleEraser(); }
  if (e.key==='t' || e.key==='T') { e.preventDefault(); setMode(S.mode==='sticky'?'select':'sticky'); }
  if (e.key==='l' || e.key==='L') {
    e.preventDefault();
    // Speak current card if in flashcard view, else speak any selected text
    const kanji = document.getElementById('type-kanji');
    if (kanji && kanji.textContent.trim() && document.getElementById('flashcard-view').classList.contains('active')) {
      speakJP(kanji.textContent);
    } else if (lastSel) {
      speakJP(lastSel);
    }
  }
  if (e.key==='Tab') {
    e.preventDefault();
    const wrap = document.getElementById('np-wrap');
    const np   = document.getElementById('np-area');
    if (wrap && wrap.style.display !== 'none' && np) {
      np.focus(); np.selectionStart = np.selectionEnd = np.value.length;
    }
  }
});

/* ── Selection → Notes popup ── */
const selPopup = document.getElementById('sel-popup');
let lastSel = '';

document.getElementById('text-layer').addEventListener('mouseup', () => {
  setTimeout(() => {
    const sel = window.getSelection();
    const txt = sel?.toString().trim();
    if (txt) {
      lastSel = txt;
      const r   = sel.getRangeAt(0).getBoundingClientRect();
      selPopup.style.left    = Math.min(r.left, window.innerWidth-160)+'px';
      selPopup.style.top     = (r.bottom+8)+'px';
      selPopup.style.display = 'block';
    } else {
      selPopup.style.display = 'none';
    }
  }, 50);
});

document.addEventListener('mousedown', e => {
  if (!e.target.closest('#sel-popup')) selPopup.style.display = 'none';
});

function addSelectionToNotes() {
  if (!lastSel) return;
  selPopup.style.display = 'none';
  const target = S.currentLessonName || S.activeNoteLesson;
  if (!target) { showToast('Open a lesson first'); return; }

  const append = '\n\n— PDF —\n' + lastSel + '\n';

  // Ensure a note exists
  const noteId = getActiveNoteId(target) || ensureNote(target);
  const existing = getNotes(target).find(n => n.id === noteId);
  const newText  = (existing?.text || '') + append;
  saveNoteById(target, noteId, newText);

  // Update right panel if current lesson
  if (S.currentLessonName === target) {
    const ta = document.getElementById('np-area');
    if (ta) { ta.value = newText; ta.scrollTop = ta.scrollHeight; }
    document.getElementById('np-status').textContent = '✓ saved';
  }

  // Update Notes tab if same lesson+note open
  if (S.activeNoteLesson === target && S.activeNoteId === noteId) {
    const na = document.getElementById('note-area');
    if (na) { na.value = newText; na.scrollTop = na.scrollHeight; }
    document.getElementById('note-status').textContent = '✓ saved';
  }

  showToast('Added to notes ✓');
  lastSel = '';
}
