/* ═══════════════════════════════════
   DASHBOARD — Library + Visual Stats
═══════════════════════════════════ */

let dashFilter   = 'reading';   // 'reading' | 'to-read' | 'finished' | 'all'
let dashCategory = null;        // null = all categories

/* ── Study streak ── */
function recordStudyDay() {
  const d    = loadStore() || {};
  const today = new Date().toDateString();
  d.studyDays = d.studyDays || [];
  if (!d.studyDays.includes(today)) d.studyDays.push(today);
  if (d.studyDays.length > 365) d.studyDays = d.studyDays.slice(-365);
  saveStore(d);
}

function getStreak() {
  const d    = loadStore() || {};
  const days = d.studyDays || [];
  if (!days.length) return 0;
  let streak = 0;
  const today = new Date();
  for (let i = 0; ; i++) {
    const check = new Date(today);
    check.setDate(today.getDate() - i);
    if (days.includes(check.toDateString())) streak++;
    else break;
  }
  return streak;
}

function incrementPomoCount() {
  const d = loadStore() || {};
  d.pomoTotal = (d.pomoTotal || 0) + 1;
  d.pomoToday = d.pomoToday || {};
  const today = new Date().toDateString();
  d.pomoToday[today] = (d.pomoToday[today] || 0) + 1;
  saveStore(d);
}

function getTotalPagesRead() {
  const d = loadStore() || {};
  const prog = d.progress || {};
  return Object.values(prog).reduce((sum, p) => sum + (p || 0), 0);
}

function getNoteWordCount() {
  const d = migrateNotes(loadStore() || {});
  const notes = d.notes || {};
  let total = 0;
  Object.values(notes).forEach(arr => {
    if (Array.isArray(arr)) arr.forEach(n => { total += (n.text||'').trim().split(/\s+/).filter(Boolean).length; });
  });
  return total;
}

/* ── Library data helpers ── */
function getLibrary() {
  const d = loadStore() || {};
  d.library = d.library || { statuses: {}, categories: {} };
  // Ensure structure
  if (!d.library.statuses)   d.library.statuses   = {};
  if (!d.library.categories) d.library.categories  = {};
  return d.library;
}

function setBookStatus(bookName, status) {
  const d = loadStore() || {};
  d.library = d.library || { statuses: {}, categories: {} };
  d.library.statuses = d.library.statuses || {};
  d.library.statuses[bookName] = status;
  saveStore(d);
}

function getBookStatus(bookName) {
  return getLibrary().statuses[bookName] || 'reading';
}

function addCategory(name) {
  const d = loadStore() || {};
  d.library = d.library || { statuses: {}, categories: {} };
  d.library.categories = d.library.categories || {};
  if (!d.library.categories[name]) d.library.categories[name] = [];
  saveStore(d);
}

function deleteCategory(name) {
  const d = loadStore() || {};
  if (d.library?.categories) delete d.library.categories[name];
  saveStore(d);
}

function assignBookToCategory(bookName, catName) {
  const d = loadStore() || {};
  d.library = d.library || { statuses: {}, categories: {} };
  d.library.categories = d.library.categories || {};
  // Remove from other categories
  Object.keys(d.library.categories).forEach(c => {
    d.library.categories[c] = d.library.categories[c].filter(b => b !== bookName);
  });
  // Add to new
  if (catName && d.library.categories[catName]) {
    d.library.categories[catName].push(bookName);
  }
  saveStore(d);
}

function getBookCategory(bookName) {
  const cats = getLibrary().categories;
  for (const [name, books] of Object.entries(cats)) {
    if (books.includes(bookName)) return name;
  }
  return null;
}

/* ── Library filter ── */
function setLibFilter(filter, btn) {
  dashFilter = filter;
  dashCategory = null;
  document.querySelectorAll('.dside-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.dside-cat-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDashBooks();
}

function setCatFilter(catName, btn) {
  dashCategory = catName;
  dashFilter = 'all';
  document.querySelectorAll('.dside-item').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.dside-cat-item').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderDashBooks();
}

/* ── Get all known books ── */
function getAllBooks() {
  const d = loadStore() || {};
  const progress = d.progress || {};
  const allNames = new Set();
  // From active lessons
  S.lessons.forEach(l => allNames.add(l.name));
  // From hidden lessons
  S.hiddenLessons.forEach(l => allNames.add(l.name));
  // From progress (previously seen)
  Object.keys(progress).forEach(n => allNames.add(n));
  return [...allNames];
}

/* ── Render: Dashboard ── */
function renderDashboard() {
  const d = loadStore() || {};

  // Date
  const dateEl = document.getElementById('dash-date');
  if (dateEl) {
    const now = new Date();
    const days = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
    const months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    dateEl.textContent = `TODAY  ·  ${days[now.getDay()]} ${now.getDate()} ${months[now.getMonth()]}`;
  }

  // Greeting
  const grH = document.getElementById('dash-greeting-h');
  const grS = document.getElementById('dash-greeting-sub');
  if (grH) {
    const hour = new Date().getHours();
    const salutation = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
    grH.textContent = salutation + ' 👋';
    const streak = getStreak();
    const due = getDueCards().length;
    if (streak > 1) grS.textContent = `${streak}-day streak — keep it up!`;
    else if (due > 0) grS.textContent = `${due} card${due>1?'s':''} ready for review.`;
    else if (getAllBooks().length > 0) grS.textContent = 'Continue where you left off.';
    else grS.textContent = 'Add a PDF or EPUB to get started.';
  }

  // CTA
  const ctaRead = document.getElementById('dash-cta-read');
  if (ctaRead) ctaRead.style.display = (S.lessons.length || S.hiddenLessons.length) ? '' : 'none';
  const dueCount = document.getElementById('dash-cta-due-count');
  if (dueCount) { const due = getDueCards().length; dueCount.textContent = due > 0 ? `(${due})` : ''; }

  renderDashCategories();
  renderDashBooks();
  renderDashStats();
  renderMochi();
  renderMochiNudge();
  updateDueBadge();
}

/* ── Render: Categories (sidebar) ── */
function renderDashCategories() {
  const el = document.getElementById('dside-cats');
  if (!el) return;
  const cats = Object.keys(getLibrary().categories);
  el.innerHTML =
    cats.map(c =>
      `<button class="dside-cat-item${dashCategory===c?' active':''}" onclick="setCatFilter('${c.replace(/'/g,"\\'")}',this)">
        ${c}
        <span class="dside-cat-del" onclick="event.stopPropagation();promptDeleteCategory('${c.replace(/'/g,"\\'")}')">×</span>
      </button>`
    ).join('') +
    `<button class="dside-cat-add" onclick="promptAddCategory()">+ Add category</button>`;
}

function promptAddCategory() {
  const name = prompt('New category name:');
  if (!name?.trim()) return;
  addCategory(name.trim());
  renderDashCategories();
}

function promptDeleteCategory(name) {
  if (!confirm(`Delete category "${name}"? Books won't be deleted.`)) return;
  deleteCategory(name);
  if (dashCategory === name) dashCategory = null;
  renderDashCategories();
  renderDashBooks();
}

/* ── Render: Book Cards ── */
function renderDashBooks() {
  const el = document.getElementById('dash-books');
  if (!el) return;
  const d = loadStore() || {};
  const allBooks = getAllBooks();

  // Filter by status
  let books = allBooks;
  if (dashFilter !== 'all') {
    books = books.filter(name => getBookStatus(name) === dashFilter);
  }
  // Filter by category
  if (dashCategory) {
    const catBooks = getLibrary().categories[dashCategory] || [];
    books = books.filter(name => catBooks.includes(name));
  }

  if (!books.length) {
    const msg = dashFilter === 'reading' ? 'No books currently being read. Upload a PDF in the sidebar!'
              : dashFilter === 'to-read' ? 'Nothing in your reading list yet.'
              : dashFilter === 'finished' ? 'No finished books yet — keep reading!'
              : 'No books found.';
    el.innerHTML = `<div class="dash-empty">${msg}</div>`;
    return;
  }

  el.innerHTML = books.map(name => {
    const pg    = d.progress?.[name] || 0;
    const lesson = S.lessons.find(l => l.name === name);
    const hidden = S.hiddenLessons.find(l => l.name === name);
    const total  = lesson?.pages || 0;
    const pct    = total > 0 ? Math.min(100, Math.round((pg / total) * 100)) : 0;
    const hn     = hasNote(name);
    const status = getBookStatus(name);
    const cat    = getBookCategory(name);
    const isActive = !!lesson;
    const isHidden = !!hidden;
    const statusLabel = status === 'reading' ? 'READING' : status === 'to-read' ? 'TO READ' : 'FINISHED';
    const idx = S.lessons.findIndex(l => l.name === name);
    const esc = name.replace(/'/g,"\\'");

    return `<div class="dbook-card${isHidden ? ' hidden-card' : ''}">
      <div class="dbook-status-tag ${status}">${statusLabel}</div>
      <div class="dbook-name">${formatLessonName(name)}</div>
      <div class="dbook-meta">
        ${pg ? `p. ${pg}${total > 0 ? ' / ' + total : ''}` : 'Not started'}
        ${hn ? ' · 📝 Notes' : ''}
        ${cat ? ` · 📁 ${cat}` : ''}
        ${isHidden ? ' · 👁 Hidden' : ''}
      </div>
      ${total > 0 ? `<div class="dbook-progress"><div class="dbook-progress-fill" style="width:${pct}%"></div></div>
      <div class="dbook-pct">${pct}%</div>` : ''}
      <div class="dbook-actions">
        ${isActive ? `<button class="dash-btn primary" onclick="goToLesson(${idx})">Open</button>` : ''}
        ${isHidden ? `<button class="dash-btn" onclick="restoreLesson('${esc}');renderDashboard()">Restore</button>` : ''}
        <select class="dbook-status-sel" onchange="changeBookStatus('${esc}',this.value)">
          <option value="reading"${status==='reading'?' selected':''}>Reading</option>
          <option value="to-read"${status==='to-read'?' selected':''}>To Read</option>
          <option value="finished"${status==='finished'?' selected':''}>Finished</option>
        </select>
        <select class="dbook-cat-sel" onchange="changeBookCategory('${esc}',this.value)">
          <option value="">No category</option>
          ${Object.keys(getLibrary().categories).map(c =>
            `<option value="${c}"${cat===c?' selected':''}>${c}</option>`
          ).join('')}
        </select>
        ${isActive ? `<button class="dash-btn" onclick="hideLesson(event,${idx});renderDashboard()">Hide</button>` : ''}
        <button class="dash-btn danger" onclick="deleteLesson('${esc}')">Delete</button>
      </div>
    </div>`;
  }).join('');
}

function changeBookStatus(name, status) {
  setBookStatus(name, status);
  renderDashBooks();
}

function changeBookCategory(name, catName) {
  assignBookToCategory(name, catName);
  renderDashBooks();
}

/* ── Render: Visual Stats ── */
function renderDashStats() {
  const d = loadStore() || {};
  renderStreakRing(d);
  renderFocusBars(d);
  renderCardsDonut(d);
  renderPagesBar(d);
}

function svgRing(cx, cy, r, pct, color, bg) {
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - pct);
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${bg}" stroke-width="4" opacity="0.15"/>
          <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="4"
            stroke-dasharray="${circ}" stroke-dashoffset="${offset}"
            stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
            style="transition:stroke-dashoffset 0.8s ease"/>`;
}

function renderStreakRing(d) {
  const el = document.getElementById('dstat-streak');
  if (!el) return;
  const streak = getStreak();
  const studyDays = d.studyDays || [];
  const today = new Date();
  const pct = Math.min(streak / 7, 1);

  // 7-day dots
  let dots = '';
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today); day.setDate(day.getDate() - i);
    const active = studyDays.includes(day.toDateString());
    const dayLabel = ['S','M','T','W','T','F','S'][day.getDay()];
    dots += `<div class="sdot-col">
      <div class="sdot ${active ? 'done' : ''}"></div>
      <span class="sdot-lbl">${dayLabel}</span>
    </div>`;
  }

  el.innerHTML = `
    <div class="dstat-label">Streak</div>
    <div class="dstat-ring-wrap">
      <svg width="80" height="80" viewBox="0 0 80 80">
        ${svgRing(40, 40, 34, pct, 'var(--accent)', 'var(--accent)')}
      </svg>
      <div class="dstat-ring-center">
        <div class="dstat-ring-val">${streak}</div>
        <div class="dstat-ring-unit">days</div>
      </div>
    </div>
    <div class="sdot-row">${dots}</div>`;
}

function renderFocusBars(d) {
  const el = document.getElementById('dstat-focus');
  if (!el) return;
  const pomoToday = d.pomoToday || {};
  const today = new Date();
  const vals = [];
  const labels = [];
  for (let i = 6; i >= 0; i--) {
    const day = new Date(today); day.setDate(day.getDate() - i);
    vals.push(pomoToday[day.toDateString()] || 0);
    labels.push(['S','M','T','W','T','F','S'][day.getDay()]);
  }
  const maxV = Math.max(...vals, 1);
  const total = d.pomoTotal || 0;

  const bars = vals.map((v, i) =>
    `<div class="fbar-col">
      <div class="fbar ${v > 0 ? 'has' : ''}" style="height:${Math.max(3, Math.round((v/maxV)*40))}px" title="${v} session${v===1?'':'s'}"></div>
      <span class="fbar-lbl">${labels[i]}</span>
    </div>`
  ).join('');

  el.innerHTML = `
    <div class="dstat-label">Focus Sessions</div>
    <div class="dstat-val-sm">${total} total</div>
    <div class="fbar-row">${bars}</div>`;
}

function renderCardsDonut(d) {
  const el = document.getElementById('dstat-cards');
  if (!el) return;
  const total = S.cards.length;
  if (!total) {
    el.innerHTML = `<div class="dstat-label">Cards</div><div class="dstat-val-sm" style="color:var(--muted)">No cards yet</div>`;
    return;
  }
  S.cards.forEach(srsInit);
  const mature = S.cards.filter(c => (c.stability || 0) >= 21).length;
  const due    = getDueCards().length;
  const newC   = S.cards.filter(c => c.reps === 0).length;
  const learning = total - mature - newC;

  // SVG donut segments
  const segs = [
    { val: mature,   color: '#5bbf7a', label: 'Mature' },
    { val: learning, color: '#c9a227', label: 'Learning' },
    { val: newC,     color: '#5b9bd5', label: 'New' },
  ].filter(s => s.val > 0);

  const r = 30, cx = 40, cy = 40;
  const circ = 2 * Math.PI * r;
  let accum = 0;
  let paths = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="6" opacity="0.3"/>`;
  segs.forEach(s => {
    const frac = s.val / total;
    const dash = circ * frac;
    const offset = circ * accum;
    paths += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="6"
      stroke-dasharray="${dash} ${circ - dash}" stroke-dashoffset="-${offset}"
      transform="rotate(-90 ${cx} ${cy})" style="transition:all 0.8s ease"/>`;
    accum += frac;
  });

  const legend = segs.map(s =>
    `<div class="dlegend-item"><span class="dlegend-dot" style="background:${s.color}"></span>${s.val} ${s.label}</div>`
  ).join('');

  el.innerHTML = `
    <div class="dstat-label">Cards</div>
    <div class="dstat-ring-wrap">
      <svg width="80" height="80" viewBox="0 0 80 80">${paths}</svg>
      <div class="dstat-ring-center">
        <div class="dstat-ring-val">${total}</div>
        <div class="dstat-ring-unit">total</div>
      </div>
    </div>
    <div class="dlegend">${legend}</div>
    ${due > 0 ? `<div class="dstat-due">${due} due today</div>` : ''}`;
}

function renderPagesBar(d) {
  const el = document.getElementById('dstat-pages');
  if (!el) return;
  const pages = getTotalPagesRead();
  const words = getNoteWordCount();

  el.innerHTML = `
    <div class="dstat-label">Progress</div>
    <div class="dprog-row">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5b9bd5" stroke-width="2.2" stroke-linecap="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
      </svg>
      <div class="dprog-info">
        <div class="dprog-val">${pages.toLocaleString()}</div>
        <div class="dprog-lbl">pages read</div>
      </div>
    </div>
    <div class="dprog-row">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c9a227" stroke-width="2.2" stroke-linecap="round">
        <line x1="17" y1="10" x2="3" y2="10"/><line x1="21" y1="6" x2="3" y2="6"/><line x1="21" y1="14" x2="3" y2="14"/><line x1="17" y1="18" x2="3" y2="18"/>
      </svg>
      <div class="dprog-info">
        <div class="dprog-val">${words.toLocaleString()}</div>
        <div class="dprog-lbl">words written</div>
      </div>
    </div>`;
}

/* ── Navigation helpers ── */
function goToLesson(i) {
  selectLesson(i);
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('study-view').classList.add('active');
  document.getElementById('study-tab-btn').classList.add('active');
}

function dashCtaRead() {
  const idx = S.active >= 0 ? S.active : (S.lessons.length > 0 ? 0 : -1);
  if (idx >= 0) { goToLesson(idx); return; }
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('study-view').classList.add('active');
  document.getElementById('study-tab-btn').classList.add('active');
}

function dashCtaCards() {
  const btn = document.querySelector('.tab-btn[onclick*="flashcard"]') ||
              document.getElementById('cards-tab-btn');
  if (btn) btn.click();
}

/* ═══════════════════════════════════
   MOCHI — Cat Companion
═══════════════════════════════════ */

function renderMochi() {
  const avatar = document.getElementById('mochi-avatar');
  if (!avatar) return;
  const isLight = document.body.classList.contains('light');
  const fur     = '#1a1714';
  const furHL   = '#2a2520';
  const inner   = '#3a3530';
  const eye     = '#f5c542';
  const eyeDark = '#e8a912';
  const nose    = '#d4837a';
  const glow    = isLight ? '#e8e0d4' : '#2a2622';
  const sparkle = '#f5c542';

  avatar.innerHTML = `<svg width="160" height="180" viewBox="0 0 160 180" fill="none">
    <!-- Background glow circle -->
    <circle cx="80" cy="82" r="62" fill="${glow}" opacity="${isLight ? '0.6' : '0.4'}"/>

    <!-- Sparkles -->
    <g opacity="0.7">
      <path d="M22 30 L24 26 L26 30 L24 34Z" fill="${sparkle}"/>
      <path d="M135 45 L136.5 42 L138 45 L136.5 48Z" fill="${sparkle}"/>
      <path d="M18 75 L19 73 L20 75 L19 77Z" fill="${sparkle}"/>
      <path d="M142 80 L143 78 L144 80 L143 82Z" fill="${sparkle}" opacity="0.5"/>
      <circle cx="30" cy="52" r="1.2" fill="${sparkle}" opacity="0.4"/>
      <circle cx="132" cy="65" r="1" fill="${sparkle}" opacity="0.5"/>
    </g>

    <!-- Tail (behind body) -->
    <path d="M118 105 Q132 85 126 65 Q122 55 118 58" stroke="${fur}" stroke-width="7" stroke-linecap="round" fill="none"/>
    <path d="M118 105 Q132 85 126 65 Q122 55 118 58" stroke="${furHL}" stroke-width="4" stroke-linecap="round" fill="none" opacity="0.3"/>

    <!-- Body -->
    <ellipse cx="80" cy="115" rx="38" ry="28" fill="${fur}"/>
    <ellipse cx="80" cy="112" rx="34" ry="24" fill="${furHL}" opacity="0.15"/>

    <!-- Head -->
    <circle cx="80" cy="72" r="30" fill="${fur}"/>

    <!-- Left ear outer + inner -->
    <polygon points="55,50 44,18 68,42" fill="${fur}"/>
    <polygon points="57,47 48,24 65,41" fill="${inner}"/>
    <!-- Right ear outer + inner -->
    <polygon points="105,50 116,18 92,42" fill="${fur}"/>
    <polygon points="103,47 112,24 95,41" fill="${inner}"/>

    <!-- Eyes -->
    <ellipse cx="68" cy="70" rx="7" ry="8" fill="${eye}"/>
    <ellipse cx="92" cy="70" rx="7" ry="8" fill="${eye}"/>
    <!-- Pupils -->
    <ellipse cx="68" cy="71" rx="4" ry="5.5" fill="#111"/>
    <ellipse cx="92" cy="71" rx="4" ry="5.5" fill="#111"/>
    <!-- Eye rim -->
    <ellipse cx="68" cy="70" rx="7" ry="8" fill="none" stroke="${eyeDark}" stroke-width="0.8" opacity="0.4"/>
    <ellipse cx="92" cy="70" rx="7" ry="8" fill="none" stroke="${eyeDark}" stroke-width="0.8" opacity="0.4"/>
    <!-- Highlights -->
    <circle cx="71" cy="67" r="2.2" fill="#fff" opacity="0.9"/>
    <circle cx="95" cy="67" r="2.2" fill="#fff" opacity="0.9"/>
    <circle cx="65" cy="73" r="1" fill="#fff" opacity="0.4"/>
    <circle cx="89" cy="73" r="1" fill="#fff" opacity="0.4"/>

    <!-- Nose -->
    <ellipse cx="80" cy="80" rx="3" ry="2.2" fill="${nose}"/>
    <!-- Mouth -->
    <path d="M76 83 Q80 87 84 83" stroke="${inner}" stroke-width="1.3" stroke-linecap="round" fill="none"/>

    <!-- Whiskers -->
    <line x1="54" y1="76" x2="66" y2="78" stroke="${inner}" stroke-width="0.8" opacity="0.4"/>
    <line x1="53" y1="80" x2="66" y2="80" stroke="${inner}" stroke-width="0.8" opacity="0.4"/>
    <line x1="94" y1="78" x2="106" y2="76" stroke="${inner}" stroke-width="0.8" opacity="0.4"/>
    <line x1="94" y1="80" x2="107" y2="80" stroke="${inner}" stroke-width="0.8" opacity="0.4"/>

    <!-- Collar -->
    <path d="M58 95 Q80 102 102 95" stroke="#8b2a1a" stroke-width="3.5" stroke-linecap="round" fill="none"/>
    <path d="M58 95 Q80 102 102 95" stroke="#a83225" stroke-width="2" stroke-linecap="round" fill="none"/>
    <!-- Bell -->
    <circle cx="80" cy="101" r="4" fill="#f5c542"/>
    <circle cx="80" cy="101" r="4" fill="none" stroke="${eyeDark}" stroke-width="0.6"/>
    <line x1="78" y1="101" x2="82" y2="101" stroke="#b8941a" stroke-width="0.8"/>
    <circle cx="80" cy="103" r="0.8" fill="#b8941a"/>

    <!-- Paws on book -->
    <ellipse cx="62" cy="138" rx="10" ry="6" fill="${fur}"/>
    <ellipse cx="98" cy="138" rx="10" ry="6" fill="${fur}"/>

    <!-- Open book -->
    <path d="M35 140 Q42 132 80 136 Q118 132 125 140 L125 155 Q118 148 80 152 Q42 148 35 155Z" fill="#4a1a12" stroke="#6b2a1e" stroke-width="0.8"/>
    <!-- Book pages -->
    <path d="M38 142 Q45 135 80 138 L80 153 Q45 150 38 155Z" fill="#f5ede0" opacity="0.85"/>
    <path d="M122 142 Q115 135 80 138 L80 153 Q115 150 122 155Z" fill="#efe7da" opacity="0.85"/>
    <!-- Book spine -->
    <line x1="80" y1="137" x2="80" y2="153" stroke="#c0392b" stroke-width="1.5"/>
    <!-- Bookmark ribbon -->
    <path d="M80 137 L78 145 L80 143 L82 145 L80 137Z" fill="#c0392b" opacity="0.7"/>
  </svg>`;

  // Also render the small nudge face
  const nudgeFace = document.getElementById('mochi-nudge-face');
  if (nudgeFace) {
    nudgeFace.innerHTML = `<svg width="36" height="36" viewBox="30 35 100 65" fill="none">
      <circle cx="80" cy="72" r="30" fill="${fur}"/>
      <polygon points="55,50 44,18 68,42" fill="${fur}"/>
      <polygon points="105,50 116,18 92,42" fill="${fur}"/>
      <ellipse cx="68" cy="70" rx="7" ry="8" fill="${eye}"/>
      <ellipse cx="92" cy="70" rx="7" ry="8" fill="${eye}"/>
      <ellipse cx="68" cy="71" rx="4" ry="5.5" fill="#111"/>
      <ellipse cx="92" cy="71" rx="4" ry="5.5" fill="#111"/>
      <circle cx="71" cy="67" r="2.2" fill="#fff" opacity="0.9"/>
      <circle cx="95" cy="67" r="2.2" fill="#fff" opacity="0.9"/>
      <ellipse cx="80" cy="80" rx="3" ry="2.2" fill="${nose}"/>
      <path d="M76 83 Q80 87 84 83" stroke="${inner}" stroke-width="1.3" stroke-linecap="round" fill="none"/>
    </svg>`;
  }
}

/* Gentle nudge messages */
const MOCHI_NUDGES = [
  { cond: 'long-session',  msgs: [
    "You've been reading for a while. Try a short break?",
    "Mochi thinks a stretch would feel good right now.",
    "Your focus is impressive! Rest your eyes for a moment.",
  ]},
  { cond: 'streak',  msgs: [
    "Keep it up! Mochi is proud of your streak.",
    "Another day of studying — Mochi approves!",
  ]},
  { cond: 'cards-due',  msgs: [
    "Some flashcards are waiting for you!",
    "Review time? Mochi will keep you company.",
  ]},
  { cond: 'welcome',  msgs: [
    "Welcome back! Ready to learn something new?",
    "Mochi missed you! Let's study together.",
    "Good to see you! What shall we read today?",
  ]},
];

function getMochiNudge() {
  const d = loadStore() || {};
  const due = getDueCards().length;
  const streak = getStreak();

  // Pick condition
  let pool;
  if (due > 3) pool = MOCHI_NUDGES.find(n => n.cond === 'cards-due');
  else if (streak > 2) pool = MOCHI_NUDGES.find(n => n.cond === 'streak');
  else pool = MOCHI_NUDGES.find(n => n.cond === 'welcome');

  if (!pool) return null;
  return pool.msgs[Math.floor(Math.random() * pool.msgs.length)];
}

function renderMochiNudge() {
  const el = document.getElementById('mochi-nudge');
  const txt = document.getElementById('mochi-nudge-text');
  if (!el || !txt) return;
  const msg = getMochiNudge();
  if (msg) {
    txt.textContent = '"' + msg + '"';
    el.style.display = '';
  }
}
