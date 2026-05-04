/* ═══════════════════════════════════
   SIMPLE MARKDOWN RENDERER
═══════════════════════════════════ */
function simpleMarkdown(text) {
  if (!text) return '<p style="color:var(--muted);font-style:italic">No notes yet.</p>';

  function esc(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
  }

  const lines = text.split('\n');
  let html = '', inUl = false, inOl = false, inPre = false, preBuffer = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Fenced code block
    if (line.trim().startsWith('```')) {
      if (!inPre) { inPre = true; preBuffer = ''; continue; }
      else { inPre = false; html += `<pre><code>${esc(preBuffer)}</code></pre>\n`; preBuffer = ''; continue; }
    }
    if (inPre) { preBuffer += (preBuffer ? '\n' : '') + line; continue; }

    // Close lists if line doesn't continue them
    const isUl = /^[ \t]*[-*+] /.test(line);
    const isOl = /^[ \t]*\d+\. /.test(line);
    if (!isUl && inUl) { html += '</ul>\n'; inUl = false; }
    if (!isOl && inOl) { html += '</ol>\n'; inOl = false; }

    // HR
    if (/^-{3,}$/.test(line.trim()) || /^\*{3,}$/.test(line.trim())) { html += '<hr>\n'; continue; }
    // Headings
    const h3m = line.match(/^### (.+)/);
    const h2m = line.match(/^## (.+)/);
    const h1m = line.match(/^# (.+)/);
    if (h1m) { html += `<h1>${inline(h1m[1])}</h1>\n`; continue; }
    if (h2m) { html += `<h2>${inline(h2m[1])}</h2>\n`; continue; }
    if (h3m) { html += `<h3>${inline(h3m[1])}</h3>\n`; continue; }
    // Blockquote
    if (line.startsWith('> ')) { html += `<blockquote>${inline(line.slice(2))}</blockquote>\n`; continue; }
    // UL
    if (isUl) {
      if (!inUl) { html += '<ul>\n'; inUl = true; }
      html += `<li>${inline(line.replace(/^[ \t]*[-*+] /, ''))}</li>\n`; continue;
    }
    // OL
    if (isOl) {
      if (!inOl) { html += '<ol>\n'; inOl = true; }
      html += `<li>${inline(line.replace(/^[ \t]*\d+\. /, ''))}</li>\n`; continue;
    }
    // Empty line
    if (!line.trim()) { html += '<br>\n'; continue; }
    // Paragraph
    html += `<p>${inline(line)}</p>\n`;
  }
  if (inUl) html += '</ul>\n';
  if (inOl) html += '</ol>\n';
  if (inPre) html += `<pre><code>${esc(preBuffer)}</code></pre>\n`;
  return html;
}
