/* ═══════════════════════════════════
   RICH TEXT EDITOR
   Formatting commands, keyboard shortcuts,
   floating selection popup, plain-text migration
═══════════════════════════════════ */

/* ── Formatting commands ── */
function rtCmd(cmd, value) {
  document.execCommand(cmd, false, value || null);
  // Re-focus the active editor
  const el = document.activeElement;
  if (el?.classList?.contains('notes-richtext')) el.focus();
}

function rtHeading(tag) {
  if (!tag) return;
  document.execCommand('formatBlock', false, tag);
}

function rtLink() {
  const sel = window.getSelection();
  const existing = sel?.anchorNode?.parentElement?.closest('a');
  const url = prompt('URL:', existing?.href || 'https://');
  if (url === null) return; // cancelled
  if (url === '') {
    // Remove link
    document.execCommand('unlink', false, null);
  } else {
    document.execCommand('createLink', false, url);
    // Make link open in new tab
    const newSel = window.getSelection();
    if (newSel.anchorNode) {
      const a = newSel.anchorNode.parentElement?.closest('a');
      if (a) a.target = '_blank';
    }
  }
}

function rtCode() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return;
  const range = sel.getRangeAt(0);
  const text = range.toString();
  if (!text) return;
  const code = document.createElement('code');
  range.surroundContents(code);
}

/* ── Migrate plain text → HTML ── */
function migrateNoteToHtml(text) {
  if (!text) return '';
  // Already HTML? (contains any tag)
  if (/<[a-z][\s\S]*>/i.test(text)) return text;
  // Convert plain text: escape HTML, convert newlines to <br>
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

/* ── Keyboard shortcuts inside richtext editors ── */
document.addEventListener('keydown', e => {
  const el = document.activeElement;
  if (!el?.classList?.contains('notes-richtext')) return;

  if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
    switch (e.key.toLowerCase()) {
      case 'b': e.preventDefault(); rtCmd('bold'); break;
      case 'i': e.preventDefault(); rtCmd('italic'); break;
      case 'u': e.preventDefault(); rtCmd('underline'); break;
      case 'k': e.preventDefault(); rtLink(); break;
    }
  }
});

/* ── Floating popup on selection ── */
const rtFloatPopup = document.getElementById('rt-float-popup');
let rtFloatTarget = null; // track which editor the popup belongs to

function showRtFloat() {
  const sel = window.getSelection();
  const txt = sel?.toString().trim();
  if (!txt || !sel.rangeCount) { hideRtFloat(); return; }

  const el = sel.anchorNode?.parentElement?.closest('.notes-richtext');
  if (!el) { hideRtFloat(); return; }

  rtFloatTarget = el;
  const r = sel.getRangeAt(0).getBoundingClientRect();
  rtFloatPopup.style.left = Math.min(r.left, window.innerWidth - 200) + 'px';
  rtFloatPopup.style.top  = (r.top - 38) + 'px';
  rtFloatPopup.style.display = 'flex';
}

function hideRtFloat() {
  rtFloatPopup.style.display = 'none';
  rtFloatTarget = null;
}

// Show popup on mouseup inside richtext editors
document.addEventListener('mouseup', e => {
  if (e.target.closest('.rt-float-popup')) return; // clicking popup buttons
  if (e.target.closest('.rt-toolbar')) return;
  setTimeout(showRtFloat, 10);
});

// Hide on click outside
document.addEventListener('mousedown', e => {
  if (!e.target.closest('.rt-float-popup') && !e.target.closest('.notes-richtext')) {
    hideRtFloat();
  }
});

// Hide on escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') hideRtFloat();
});
