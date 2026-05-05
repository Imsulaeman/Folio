/* ═══════════════════════════════════
   TOAST
═══════════════════════════════════ */
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.style.opacity = '1';
  clearTimeout(t._tid);
  t._tid = setTimeout(() => t.style.opacity='0', 1800);
}

/* ═══════════════════════════════════
   DISPLAY NAME FORMATTER
   Strips libgen/zlibrary junk, (year, Publisher) metadata,
   and "Author - Title" patterns to show a clean readable name.
   The raw l.name is unchanged — this is display-only.
═══════════════════════════════════ */
function formatLessonName(name) {
  if (!name) return name;
  let s = name;
  let modified = false;
  // Strip common source suffixes (libgen, z-lib, etc.)
  const s1 = s.replace(/\s*[-–]\s*(libgen\.[a-z]+|z-lib\.[a-z]+|z-?library|anna'?s?\s*archive|pdfdrive|b-ok\.[a-z]+|bookfi|bookos)\s*$/i, '').trim();
  if (s1 !== s) { s = s1; modified = true; }
  // Strip (date, Publisher) parentheticals at end
  const s2 = s.replace(/\s*\([^)]*\d{4}[^)]*\)\s*$/g, '').trim();
  if (s2 !== s) { s = s2; modified = true; }
  // Strip [Z-Library / metadata] brackets at end
  const s3 = s.replace(/\s*\[(Z-Library|PDF|EPUB|eBook|Book|Free|Download)[^\]]*\]\s*$/gi, '').trim();
  if (s3 !== s) { s = s3; modified = true; }
  // If filename had junk, extract the title from "Author - Title" pattern
  if (modified) {
    const parts = s.split(/\s+-\s+/);
    if (parts.length >= 2) {
      const title = parts.slice(1).join(' - ').trim();
      if (title.length > 8) s = title;
    }
  }
  // Fix underscores used as colon/separator (e.g. "Range_ How" → "Range: How")
  s = s.replace(/_(?=\s)/g, ':').replace(/_/g, ' ').trim();
  return s;
}

/* ═══════════════════════════════════
   RESTORE SESSION
═══════════════════════════════════ */
function restoreSession() {
  const d = loadStore();
  if (!d) return;
  if (d.cards?.length) { S.cards = d.cards; S.cards.forEach(srsInit); }
  const names = Object.keys(d.progress || {});
  if (!names.length) return;
  const b = document.createElement('div');
  b.id = 'restore-banner';
  b.style.cssText = `position:fixed;bottom:16px;right:16px;z-index:500;background:var(--bg2);
    border:1px solid var(--accent);border-radius:9px;padding:12px 15px;max-width:260px;
    box-shadow:0 8px 28px rgba(0,0,0,.55);animation:slideIn .3s ease;`;
  const list = names.slice(0,4).map(n=>`<li style="color:var(--muted);font-size:10px;font-family:var(--fm);margin-top:2px">• ${n}</li>`).join('')
    + (names.length>4?`<li style="font-size:9px;color:var(--muted)">…+${names.length-4} more</li>`:'');
  b.innerHTML = `<div style="font-size:12px;font-weight:600;margin-bottom:5px">📌 Resume where you left off</div>
    <div style="font-size:10px;color:var(--muted);margin-bottom:6px">Re-upload these PDFs:</div>
    <ul style="list-style:none;margin-bottom:10px">${list}</ul>
    <div style="display:flex;gap:5px">
      <label for="pdf-upload" style="flex:1" onclick="document.getElementById('restore-banner').remove()">
        <div style="background:var(--accent);color:#fff;padding:5px 0;border-radius:4px;text-align:center;cursor:pointer;font-size:11px">Upload PDFs</div>
      </label>
      <button onclick="this.closest('#restore-banner').remove()" style="background:var(--bg3);border:1px solid var(--border);color:var(--muted);padding:5px 8px;border-radius:4px;cursor:pointer;font-size:11px">✕</button>
    </div>`;
  document.body.appendChild(b);
}

/* ═══════════════════════════════════
   TAB SWITCHING
═══════════════════════════════════ */
function switchTab(id, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(id+'-view').classList.add('active');
  btn.classList.add('active');

  const isDash = id === 'navigator';
  // Notes tab: hide right panel (it would duplicate the notes editor)
  document.body.classList.toggle('notes-tab-active', id === 'notes');
  // Dashboard: swap sidebar + right panel
  document.body.classList.toggle('dash-active', isDash);
  // Toggle sidebar content
  const dashSb = document.getElementById('dash-sidebar');
  const lessonsSec = document.querySelector('.lessons-section');
  const sideBottom = document.querySelector('.sidebar-bottom');
  if (dashSb)    dashSb.style.display    = isDash ? '' : 'none';
  if (lessonsSec) lessonsSec.style.display = isDash ? 'none' : '';
  if (sideBottom) sideBottom.style.display = isDash ? 'none' : '';
  // Toggle right panel
  const dashRight = document.getElementById('dash-right-panel');
  const notesPanel = document.querySelector('.notes-panel');
  if (dashRight)  dashRight.style.display  = isDash ? 'flex' : 'none';
  if (notesPanel) notesPanel.style.display = isDash ? 'none' : '';

  if (id==='flashcard') { S.cards.forEach(srsInit); startSrsSession(); }
  if (isDash) renderDashboard();
  if (id==='notes')     renderNotesSidebar();
}

function switchSidebarTab(id, btn) {
  document.querySelectorAll('.sidebar-pane').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.mini-tab').forEach(b => b.classList.remove('active'));
  document.getElementById(id+'-pane').classList.add('active');
  btn.classList.add('active');
}
