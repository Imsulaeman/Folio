/* ═══════════════════════════════════
   MODE SWITCHING (select / draw / sticky)
═══════════════════════════════════ */
function setMode(mode) {
  S.mode = mode;
  const dc = document.getElementById('draw-canvas');
  const tl = document.getElementById('text-layer');
  const sl = document.getElementById('sticky-layer');

  // Reset pill styles
  ['mode-select','mode-draw','mode-sticky'].forEach(id => {
    const el = document.getElementById(id);
    el.className = 'mode-pill';
  });

  document.getElementById('draw-toolbar').classList.remove('visible');
  document.getElementById('sticky-toolbar').classList.remove('visible');

  const epubWrap = document.getElementById('epub-wrap');

  if (mode === 'draw') {
    dc.classList.add('draw-active');
    tl.style.pointerEvents    = 'none';
    sl.style.pointerEvents    = 'none';
    if (epubWrap) epubWrap.style.pointerEvents = 'none';
    document.getElementById('mode-draw').className = 'mode-pill active-draw';
    document.getElementById('draw-toolbar').classList.add('visible');
  } else if (mode === 'sticky') {
    dc.classList.remove('draw-active');
    tl.style.pointerEvents    = 'none';
    sl.style.pointerEvents    = 'all';
    if (epubWrap) epubWrap.style.pointerEvents = 'none';
    document.getElementById('mode-sticky').className = 'mode-pill active-sticky';
    document.getElementById('sticky-toolbar').classList.add('visible');
  } else {
    dc.classList.remove('draw-active');
    tl.style.pointerEvents    = '';
    sl.style.pointerEvents    = 'none';
    if (epubWrap) epubWrap.style.pointerEvents = '';
    document.getElementById('mode-select').className = 'mode-pill active';
  }
}

/* ═══════════════════════════════════
   DRAWING
═══════════════════════════════════ */
function drawKey() {
  if (epubBook) return `${S.currentLessonName}::ch${epubBook.chapterIdx}`;
  return `${S.currentLessonName}::p${S.page}`;
}

function stickyKey() {
  if (epubBook) return `${S.currentLessonName}::ch${epubBook.chapterIdx}`;
  return `${S.currentLessonName}::p${S.page}`;
}

let currentStroke = null;
let eraserActive  = false;

function toggleEraser() {
  eraserActive = !eraserActive;
  const btn = document.getElementById('draw-eraser-btn');
  const dc  = document.getElementById('draw-canvas');
  btn.style.background     = eraserActive ? 'var(--accent)' : 'none';
  btn.style.color          = eraserActive ? '#fff' : 'var(--muted)';
  btn.style.borderColor    = eraserActive ? 'var(--accent)' : 'var(--border)';
  dc.style.cursor          = eraserActive ? 'cell' : 'crosshair';
}

function initDrawCanvas() {
  const dc   = document.getElementById('draw-canvas');
  const wrap = document.getElementById('canvas-wrap');
  const r    = wrap.getBoundingClientRect();
  dc.width   = r.width  || 800;
  dc.height  = r.height || 600;
  dc.style.width  = r.width  + 'px';
  dc.style.height = r.height + 'px';
  dc.style.left   = '0px';
  dc.style.top    = '0px';

  // Erase strokes whose path comes within radius of a point
  const eraseAt = async (cx, cy) => {
    const key     = drawKey();
    let strokes   = await idbGet('drawings', key) || [];
    const RADIUS  = parseInt(document.getElementById('draw-size').value) * 3 + 8;
    const before  = strokes.length;
    strokes = strokes.filter(stroke => {
      // Check if any segment of the stroke is within RADIUS of (cx,cy)
      for (let i = 0; i < stroke.pts.length - 1; i++) {
        const ax = stroke.pts[i].rx   * dc.width,  ay = stroke.pts[i].ry   * dc.height;
        const bx = stroke.pts[i+1].rx * dc.width,  by = stroke.pts[i+1].ry * dc.height;
        // Distance from point (cx,cy) to segment (ax,ay)-(bx,by)
        const dx = bx-ax, dy = by-ay;
        const lenSq = dx*dx + dy*dy;
        let t = lenSq > 0 ? ((cx-ax)*dx + (cy-ay)*dy) / lenSq : 0;
        t = Math.max(0, Math.min(1, t));
        const nearX = ax + t*dx, nearY = ay + t*dy;
        if (Math.hypot(cx-nearX, cy-nearY) <= RADIUS) return false;
      }
      return true;
    });
    if (strokes.length !== before) {
      await idbPut('drawings', key, strokes);
      loadDrawings(); // redraw
    }
  };

  dc.onmousedown = async e => {
    if (S.mode !== 'draw') return;
    const r  = dc.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;

    if (eraserActive) {
      S.drawing = true;
      await eraseAt(cx, cy);
      return;
    }

    S.drawing = true;
    currentStroke = {
      color: document.getElementById('draw-color').value,
      size:  parseInt(document.getElementById('draw-size').value),
      pts:   [{ rx: cx/dc.width, ry: cy/dc.height }]
    };
    S.lastX = cx; S.lastY = cy;
  };

  dc.onmousemove = async e => {
    if (!S.drawing || S.mode !== 'draw') return;
    const r  = dc.getBoundingClientRect();
    const cx = e.clientX - r.left;
    const cy = e.clientY - r.top;

    if (eraserActive) {
      await eraseAt(cx, cy);
      return;
    }

    if (!currentStroke) return;
    const ctx = dc.getContext('2d');
    ctx.strokeStyle = currentStroke.color;
    ctx.lineWidth   = currentStroke.size;
    ctx.lineCap     = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(S.lastX, S.lastY);
    ctx.lineTo(cx, cy);
    ctx.stroke();
    currentStroke.pts.push({ rx: cx/dc.width, ry: cy/dc.height });
    S.lastX = cx; S.lastY = cy;
  };

  const endDraw = async () => {
    if (!S.drawing) return;
    S.drawing = false;
    if (eraserActive || !currentStroke || currentStroke.pts.length < 2) {
      currentStroke = null; return;
    }
    const key  = drawKey();
    let existing = await idbGet('drawings', key) || [];
    existing.push(currentStroke);
    await idbPut('drawings', key, existing);
    currentStroke = null;
  };
  dc.onmouseup    = endDraw;
  dc.onmouseleave = endDraw;
}

async function loadDrawings() {
  if (!S.currentLessonName) return;
  const dc  = document.getElementById('draw-canvas');
  const ctx = dc.getContext('2d');
  ctx.clearRect(0, 0, dc.width, dc.height);
  const strokes = await idbGet('drawings', drawKey()) || [];
  strokes.forEach(stroke => {
    if (stroke.pts.length < 2) return;
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth   = stroke.size;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.beginPath();
    ctx.moveTo(stroke.pts[0].rx * dc.width, stroke.pts[0].ry * dc.height);
    stroke.pts.slice(1).forEach(p => ctx.lineTo(p.rx * dc.width, p.ry * dc.height));
    ctx.stroke();
  });
}

async function clearDrawings() {
  if (!S.currentLessonName) return;
  await idbDelete('drawings', drawKey());
  const dc = document.getElementById('draw-canvas');
  dc.getContext('2d').clearRect(0, 0, dc.width, dc.height);
  showToast('Drawings cleared');
}

/* ═══════════════════════════════════
   STICKY NOTES
═══════════════════════════════════ */
async function loadStickies() {
  const layer = document.getElementById('sticky-layer');
  layer.innerHTML = '';
  if (!S.currentLessonName) return;
  const stickies = await idbGet('stickies', stickyKey()) || [];
  stickies.forEach((s, i) => renderSticky(s, i));
}

function renderSticky(data, idx) {
  const layer = document.getElementById('sticky-layer');
  const wrap  = document.getElementById('canvas-wrap');
  const W     = wrap.clientWidth  || 800;
  const H     = wrap.clientHeight || 600;

  const el  = document.createElement('div');
  el.className = 'sticky-note';
  el.dataset.idx = idx;
  el.style.cssText = `
    left:${data.rx * W}px; top:${data.ry * H}px;
    background:${data.color};
    font-size:${data.fontSize}px;
    font-family:${data.fontFamily};
    width:${data.w || 160}px;
    height:${data.h || 100}px;
    overflow:hidden;
  `;

  const bar = document.createElement('div');
  bar.className = 'sticky-note-bar';
  const del = document.createElement('button');
  del.className = 'sticky-del'; del.textContent = '✕';
  del.onclick = async e => {
    e.stopPropagation();
    const stickies = await idbGet('stickies', stickyKey()) || [];
    stickies.splice(parseInt(el.dataset.idx), 1);
    await idbPut('stickies', stickyKey(), stickies);
    // Re-index remaining
    [...document.getElementById('sticky-layer').children].forEach((c, i) => c.dataset.idx = i);
    el.remove();
  };
  bar.appendChild(del);

  const ta = document.createElement('textarea');
  ta.value = data.text || '';
  ta.placeholder = 'Note…';
  ta.style.fontSize   = data.fontSize + 'px';
  ta.style.fontFamily = data.fontFamily;
  ta.style.flex       = '1';
  ta.style.width      = '100%';
  ta.style.resize     = 'none';
  ta.oninput = async () => {
    const stickies = await idbGet('stickies', stickyKey()) || [];
    if (stickies[idx]) { stickies[idx].text = ta.value; await idbPut('stickies', stickyKey(), stickies); }
  };
  ta.onmousedown = e => e.stopPropagation();
  ta.onclick     = e => e.stopPropagation(); // also stop click so it never bubbles to layer

  el.appendChild(bar);
  el.appendChild(ta);

  // Resize handle (bottom-right corner)
  const rh = document.createElement('div');
  rh.className = 'sticky-resize';
  rh.textContent = '⤡';
  rh.onmousedown = async e => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const startW = el.offsetWidth,  startH = el.offsetHeight;
    const stickies = await idbGet('stickies', stickyKey()) || [];
    const moveFn = async mv => {
      const nw = Math.max(80,  startW + mv.clientX - startX);
      const nh = Math.max(50,  startH + mv.clientY - startY);
      el.style.width  = nw + 'px';
      el.style.height = nh + 'px';
      if (stickies[idx]) { stickies[idx].w = nw; stickies[idx].h = nh; }
    };
    const upFn = async () => {
      await idbPut('stickies', stickyKey(), stickies);
      document.removeEventListener('mousemove', moveFn);
      document.removeEventListener('mouseup',   upFn);
    };
    document.addEventListener('mousemove', moveFn);
    document.addEventListener('mouseup',   upFn);
  };
  el.appendChild(rh);
  layer.appendChild(el);

  // Drag
  let ox=0,oy=0,dragging=false;
  el.onmousedown = async e => {
    if (e.target === ta || e.target === del) return;
    dragging = true;
    ox = e.clientX - el.offsetLeft;
    oy = e.clientY - el.offsetTop;
    el.style.zIndex = 20;
    const stickies = await idbGet('stickies', stickyKey()) || [];
    const moveFn = async mv => {
      if (!dragging) return;
      const nx = mv.clientX - ox;
      const ny = mv.clientY - oy;
      el.style.left = nx + 'px';
      el.style.top  = ny + 'px';
      if (stickies[idx]) {
        stickies[idx].rx = nx / W;
        stickies[idx].ry = ny / H;
      }
    };
    const upFn = async () => {
      dragging = false; el.style.zIndex = 12;
      await idbPut('stickies', stickyKey(), stickies);
      document.removeEventListener('mousemove', moveFn);
      document.removeEventListener('mouseup', upFn);
    };
    document.addEventListener('mousemove', moveFn);
    document.addEventListener('mouseup', upFn);
  };
}

/* Click on PDF in sticky mode → place new sticky */
document.getElementById('sticky-layer').addEventListener('click', async e => {
  if (S.mode !== 'sticky') return;
  if (e.target.closest('.sticky-note')) return;
  const layer = document.getElementById('sticky-layer');
  const wrap  = document.getElementById('canvas-wrap');
  const W     = wrap.clientWidth  || 800;
  const H     = wrap.clientHeight || 600;
  const r     = layer.getBoundingClientRect();

  const data = {
    rx:         (e.clientX - r.left) / W,
    ry:         (e.clientY - r.top)  / H,
    color:      document.getElementById('sticky-color').value,
    fontSize:   parseInt(document.getElementById('sticky-size').value),
    fontFamily: document.getElementById('sticky-font').value,
    text:       '',
    w:          parseInt(document.getElementById('sticky-w').value),
    h:          parseInt(document.getElementById('sticky-h').value),
  };

  const stickies = await idbGet('stickies', stickyKey()) || [];
  stickies.push(data);
  await idbPut('stickies', stickyKey(), stickies);
  renderSticky(data, stickies.length - 1);

  // Focus the new sticky's textarea
  const newEl = document.getElementById('sticky-layer').lastChild;
  if (newEl) newEl.querySelector('textarea')?.focus();
});

/* ═══════════════════════════════════
   POMODORO DRAG
═══════════════════════════════════ */
function initPomoDrag() {
  const widget = document.getElementById('pomo-widget');
  const handle = document.getElementById('pomo-drag-handle');

  // Restore saved position
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem('folio_pomo_pos') || 'null'); } catch { return null; }
  })();

  if (saved) {
    // Clamp to viewport in case window was resized
    const maxX = window.innerWidth  - widget.offsetWidth  - 4;
    const maxY = window.innerHeight - widget.offsetHeight - 4;
    const x = Math.max(4, Math.min(saved.x, maxX));
    const y = Math.max(4, Math.min(saved.y, maxY));
    widget.style.right  = 'auto';
    widget.style.bottom = 'auto';
    widget.style.left   = x + 'px';
    widget.style.top    = y + 'px';
  }

  let dragging = false, ox = 0, oy = 0;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    dragging = true;
    handle.style.cursor = 'grabbing';
    // Compute offset from widget top-left to mouse
    const rect = widget.getBoundingClientRect();
    ox = e.clientX - rect.left;
    oy = e.clientY - rect.top;
  });

  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    let nx = e.clientX - ox;
    let ny = e.clientY - oy;
    // Keep within viewport
    const maxX = window.innerWidth  - widget.offsetWidth  - 4;
    const maxY = window.innerHeight - widget.offsetHeight - 4;
    nx = Math.max(4, Math.min(nx, maxX));
    ny = Math.max(4, Math.min(ny, maxY));
    widget.style.right  = 'auto';
    widget.style.bottom = 'auto';
    widget.style.left   = nx + 'px';
    widget.style.top    = ny + 'px';
  });

  document.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    handle.style.cursor = 'grab';
    // Save position
    const rect = widget.getBoundingClientRect();
    localStorage.setItem('folio_pomo_pos', JSON.stringify({ x: rect.left, y: rect.top }));
  });
}
