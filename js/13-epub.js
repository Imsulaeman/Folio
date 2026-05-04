/* ═══════════════════════════════════
   EPUB READER (pure JSZip — no iframe, works as local file)
═══════════════════════════════════ */
let epubBook      = null;
let epubRendition = null; // kept null for compat

async function loadEpub(url, lessonName) {
  // Hide PDF elements, show epub reader
  document.getElementById('pdf-page-wrap').style.display = 'none';
  document.getElementById('pdf-ph').style.display        = 'none';
  const wrap    = document.getElementById('epub-wrap');
  const content = document.getElementById('epub-content');
  wrap.style.display = 'block';
  content.innerHTML  = '<p style="color:#888;text-align:center;padding-top:40px">Loading…</p>';

  S.currentLessonName = lessonName;
  S.pdfDoc = null;
  epubRendition = null;
  syncNotesTabToLesson(lessonName);

  // Fetch epub bytes
  const resp = await fetch(url);
  const buf  = await resp.arrayBuffer();
  const zip  = await JSZip.loadAsync(buf);

  // 1. Find OPF via container.xml
  const containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) { content.innerHTML = '<p style="color:red">Invalid EPUB: missing container.xml</p>'; return; }
  const containerXml = await containerFile.async('string');
  const opfMatch = containerXml.match(/full-path="([^"]+)"/i);
  if (!opfMatch) { content.innerHTML = '<p style="color:red">Cannot find OPF path</p>'; return; }

  const opfPath = opfMatch[1];
  const opfDir  = opfPath.includes('/') ? opfPath.substring(0, opfPath.lastIndexOf('/') + 1) : '';
  const opfFile = zip.file(opfPath);
  if (!opfFile) { content.innerHTML = '<p style="color:red">OPF file not found: ' + opfPath + '</p>'; return; }

  // 2. Parse manifest + spine from OPF
  const opfXml = await opfFile.async('string');
  const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');

  const manifest = {};
  opfDoc.querySelectorAll('manifest item').forEach(item => {
    manifest[item.getAttribute('id')] = {
      href:      item.getAttribute('href'),
      mediaType: item.getAttribute('media-type') || '',
    };
  });

  const spine = [];
  opfDoc.querySelectorAll('spine itemref').forEach(ref => {
    const id   = ref.getAttribute('idref');
    const item = manifest[id];
    if (item) spine.push({ id, href: opfDir + item.href });
  });

  if (!spine.length) { content.innerHTML = '<p style="color:red">No spine items found in EPUB</p>'; return; }

  // 3. Build blob URL map for all resources (images, fonts, css)
  const resources = {};
  await Promise.all(
    Object.values(manifest).map(async item => {
      const fullPath = opfDir + item.href;
      const f = zip.file(fullPath) || zip.file(item.href);
      if (!f) return;
      try {
        const blob = await f.async('blob');
        const burl = URL.createObjectURL(blob);
        resources[item.href]     = burl;
        resources[fullPath]      = burl;
        resources[item.href.split('/').pop()] = burl; // filename-only lookup
      } catch(e) {}
    })
  );

  epubBook = { zip, spine, resources, opfDir, chapterIdx: 0, lessonName };

  // Restore saved chapter
  const d     = loadStore() || {};
  const saved = d.epubCfi?.[lessonName];
  if (saved !== undefined && !isNaN(parseInt(saved))) {
    epubBook.chapterIdx = Math.min(parseInt(saved), spine.length - 1);
  }

  // Wire toolbar buttons
  document.getElementById('prev-btn').onclick = epubPrevChapter;
  document.getElementById('next-btn').onclick = () => { epubNextChapter(); recordStudyDay(); };

  await renderEpubChapter();
  initDrawCanvas();
  if (IDB) { loadDrawings(); loadStickies(); }
  updateNotesPanel();
}

async function renderEpubChapter() {
  if (!epubBook) return;
  const { zip, spine, resources, opfDir, chapterIdx } = epubBook;
  const content = document.getElementById('epub-content');
  const item    = spine[chapterIdx];

  content.innerHTML = '<p style="color:#888;text-align:center;padding-top:40px">Loading chapter…</p>';

  // Update toolbar
  document.getElementById('page-info').textContent =
    `${formatLessonName(S.currentLessonName) || ''} · Ch. ${chapterIdx + 1} / ${spine.length}`;
  document.getElementById('prev-btn').disabled = chapterIdx <= 0;
  document.getElementById('next-btn').disabled = chapterIdx >= spine.length - 1;

  // Load chapter file
  const chFile = zip.file(item.href) || zip.file(item.href.replace(opfDir,''));
  if (!chFile) {
    content.innerHTML = `<p style="color:#999">Chapter file not found: ${item.href}</p>`;
    return;
  }

  let html = await chFile.async('string');

  // Replace resource URLs with blob URLs
  // Handle relative paths like ../Images/cover.jpg or just cover.jpg
  html = html.replace(/(src|href)="([^"#]*)"/gi, (match, attr, orig) => {
    if (orig.startsWith('http') || orig.startsWith('data:')) return match;
    const filename = orig.split('/').pop();
    const blob = resources[orig] || resources[opfDir + orig] || resources[filename];
    return blob ? `${attr}="${blob}"` : match;
  });

  // Extract body content
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyHtml  = bodyMatch ? bodyMatch[1] : html;

  // Extract any <style> from <head>
  let inlineStyle = '';
  const styleMatches = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)];
  styleMatches.forEach(m => { inlineStyle += m[1] + '\n'; });

  content.innerHTML = `
    <style>
      ${inlineStyle}
      #epub-content img { max-width:100%; height:auto; display:block; margin:1em auto; }
      #epub-content h1,#epub-content h2,#epub-content h3 { margin:1.2em 0 .5em; line-height:1.35; }
      #epub-content p { margin:.65em 0; }
      #epub-content ruby rt { font-size:.55em; }
      #epub-content a { color:#c0392b; text-decoration:none; cursor:pointer; }
      #epub-content table { border-collapse:collapse; width:100%; margin:1em 0; }
      #epub-content td,#epub-content th { border:1px solid #ccc; padding:6px 10px; }
    </style>
    ${bodyHtml}`;

  // Intercept ALL link clicks — prevent navigating away
  content.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const href = a.getAttribute('href') || '';
      if (!href || href === '#') return;

      if (href.startsWith('http://') || href.startsWith('https://')) {
        window.open(href, '_blank', 'noopener');
        return;
      }

      const parts    = href.split('#');
      const filePart = parts[0]; // could be empty for hash-only links
      const hashPart = parts[1] || '';

      // Try to navigate to an internal chapter
      if (filePart && epubBook) {
        const targetFile = filePart.split('/').pop(); // just the filename
        const targetIdx  = epubBook.spine.findIndex(s => {
          const sFile = s.href.split('/').pop();
          return sFile === targetFile;
        });
        if (targetIdx >= 0 && targetIdx !== epubBook.chapterIdx) {
          epubBook.chapterIdx = targetIdx;
          renderEpubChapter().then(() => {
            // After chapter renders, scroll to hash if present
            if (hashPart) {
              try {
                const el = content.querySelector(`[id="${hashPart}"]`);
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              } catch(e) {}
            }
          });
          return;
        }
      }

      // Hash-only or same-chapter hash — scroll within current chapter
      if (hashPart) {
        try {
          const el = content.querySelector(`[id="${hashPart}"]`);
          if (el) el.scrollIntoView({ behavior: 'smooth' });
        } catch(e) {}
      }
    });
  });

  document.getElementById('canvas-wrap').scrollTop = 0;
  saveEpubLocation();

  // Reload drawings and stickies for this chapter
  initDrawCanvas();
  if (IDB) { loadDrawings(); loadStickies(); }
}

async function epubNextChapter() {
  if (!epubBook || epubBook.chapterIdx >= epubBook.spine.length - 1) return;
  epubBook.chapterIdx++; await renderEpubChapter();
}
async function epubPrevChapter() {
  if (!epubBook || epubBook.chapterIdx <= 0) return;
  epubBook.chapterIdx--; await renderEpubChapter();
}
function saveEpubLocation() {
  if (!epubBook) return;
  const name = epubBook.lessonName || S.currentLessonName;
  if (!name) return;
  const d = loadStore() || {};
  d.epubCfi = d.epubCfi || {};
  d.epubCfi[name] = epubBook.chapterIdx;
  saveStore(d);
}
