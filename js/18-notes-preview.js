/* ═══════════════════════════════════
   NOTES PREVIEW TOGGLE
═══════════════════════════════════ */
let notesPreviewMode = false;
function toggleNotesPreview() {
  notesPreviewMode = !notesPreviewMode;
  const btn      = document.getElementById('np-preview-btn');
  const textarea = document.getElementById('np-area');
  const preview  = document.getElementById('np-preview');
  if (!btn || !textarea || !preview) return;
  btn.classList.toggle('active', notesPreviewMode);
  if (notesPreviewMode) {
    textarea.style.display = 'none';
    preview.classList.add('visible');
    preview.innerHTML = simpleMarkdown(textarea.value);
  } else {
    textarea.style.display = '';
    preview.classList.remove('visible');
    textarea.focus();
  }
}
