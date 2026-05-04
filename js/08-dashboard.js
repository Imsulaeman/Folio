/* ═══════════════════════════════════
   DASHBOARD — Stats + Lessons
═══════════════════════════════════ */

/* ── Study streak (counts days where a page was turned) ── */
function recordStudyDay() {
  const d    = loadStore() || {};
  const today = new Date().toDateString();
  d.studyDays = d.studyDays || [];
  if (!d.studyDays.includes(today)) d.studyDays.push(today);
  // Keep last 365 days
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

function renderDashboard() {
  const d = loadStore() || {};

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
    else if (S.lessons.length > 0) grS.textContent = 'Continue where you left off.';
    else grS.textContent = 'Add a PDF or EPUB to get started.';
  }
  // CTA buttons
  const ctaRead = document.getElementById('dash-cta-read');
  const ctaCards = document.getElementById('dash-cta-cards');
  const dueCount = document.getElementById('dash-cta-due-count');
  if (ctaRead) {
    const hasLesson = S.lessons.length > 0 || S.hiddenLessons.length > 0;
    ctaRead.style.display = hasLesson ? '' : 'none';
  }
  if (dueCount) {
    const due = getDueCards().length;
    dueCount.textContent = due > 0 ? `(${due})` : '';
  }

  // Stats
  document.getElementById('st-streak').textContent = getStreak();
  document.getElementById('st-pomo').textContent   = d.pomoTotal || 0;
  document.getElementById('st-pages').textContent  = getTotalPagesRead();
  document.getElementById('st-cards').textContent  = getMatureCards().length;
  document.getElementById('st-words').textContent  = getNoteWordCount().toLocaleString();
  document.getElementById('st-due').textContent    = getDueCards().length;

  // Streak dots — last 7 days
  const streakDots = document.getElementById('st-streak-dots');
  if (streakDots) {
    const studyDays = d.studyDays || [];
    const today = new Date();
    streakDots.innerHTML = '';
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today); day.setDate(day.getDate() - i);
      const ds = day.toDateString();
      const dot = document.createElement('span');
      dot.className = 'streak-dot' + (studyDays.includes(ds) ? ' done' : '');
      dot.title = ds.slice(0, 10);
      streakDots.appendChild(dot);
    }
  }

  // Sessions sparkline — last 7 days
  const pomoSpark = document.getElementById('st-pomo-spark');
  if (pomoSpark) {
    const pomoToday = d.pomoToday || {};
    const today = new Date();
    const vals = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today); day.setDate(day.getDate() - i);
      vals.push(pomoToday[day.toDateString()] || 0);
    }
    const maxV = Math.max(...vals, 1);
    pomoSpark.innerHTML = vals.map(v =>
      `<div class="spark-bar${v > 0 ? ' has-data' : ''}" style="height:${Math.max(2, Math.round((v/maxV)*16))}px" title="${v} session${v===1?'':'s'}"></div>`
    ).join('');
  }

  // Pages sparkline — using studyDays presence as proxy (dims gracefully if no per-day data)
  const pagesSpark = document.getElementById('st-pages-spark');
  if (pagesSpark) {
    const studyDays = d.studyDays || [];
    const today = new Date();
    pagesSpark.innerHTML = '';
    for (let i = 6; i >= 0; i--) {
      const day = new Date(today); day.setDate(day.getDate() - i);
      const active = studyDays.includes(day.toDateString());
      const bar = document.createElement('div');
      bar.className = 'spark-bar' + (active ? ' has-data' : '');
      bar.style.height = active ? '10px' : '2px';
      bar.title = day.toDateString().slice(0, 10);
      pagesSpark.appendChild(bar);
    }
  }

  // Active lessons
  const activeEl = document.getElementById('dash-active');
  if (!S.lessons.length) {
    activeEl.innerHTML = `<div style="font-size:12px;color:var(--muted);padding:8px">No lessons uploaded yet. Use + PDF in the sidebar.</div>`;
  } else {
    activeEl.innerHTML = S.lessons.map((l,i) => {
      const pg   = d.progress?.[l.name];
      const hn   = hasNote(l.name);
      const total = l.pages || 0;
      const pct   = (total > 0 && pg) ? Math.min(100, Math.round((pg / total) * 100)) : 0;
      const progressBar = total > 0
        ? `<div class="dash-card-progress"><div class="dash-card-progress-fill" style="width:${pct}%"></div></div>`
        : '';
      return `<div class="dash-card">
        <div class="dash-card-name">${formatLessonName(l.name)}</div>
        <div class="dash-card-meta">
          ${pg ? `📖 Page ${pg}${total > 0 ? ' / ' + total : ''}` : '📖 Not started'}<br>
          ${hn ? '📝 Has notes' : ''}
        </div>
        ${progressBar}
        <div class="dash-card-actions">
          <button class="dash-btn primary" onclick="goToLesson(${i})">Open</button>
          <button class="dash-btn" onclick="hideLesson(event,${i});renderDashboard()">Hide</button>
        </div>
      </div>`;
    }).join('');
  }

  // Hidden lessons
  const hiddenEl  = document.getElementById('dash-hidden');
  const hiddenSec = document.getElementById('dash-hidden-section');
  if (!S.hiddenLessons.length) {
    hiddenSec.style.display = 'none';
  } else {
    hiddenSec.style.display = 'block';
    hiddenEl.innerHTML = S.hiddenLessons.map(l => {
      const pg = d.progress?.[l.name];
      const hn = hasNote(l.name);
      return `<div class="dash-card hidden-card">
        <div class="dash-card-name">${formatLessonName(l.name)}</div>
        <div class="dash-card-meta">
          ${pg ? `📖 Last: page ${pg}` : '📖 Not started'}<br>
          ${hn ? '📝 Has notes' : ''}
        </div>
        <div class="dash-card-actions">
          <button class="dash-btn primary" onclick="restoreLesson('${l.name.replace(/'/g,"\\'")}');renderDashboard()">Restore</button>
          <button class="dash-btn" style="color:var(--accent);border-color:rgba(192,57,43,.3)" onclick="deleteLesson('${l.name.replace(/'/g,"\\'")}')">Delete</button>
        </div>
      </div>`;
    }).join('');
  }
}

function goToLesson(i) {
  selectLesson(i);
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('study-view').classList.add('active');
  document.getElementById('study-tab-btn').classList.add('active');
}

function dashCtaRead() {
  // Open last active lesson, or first available
  const idx = S.active >= 0 ? S.active : (S.lessons.length > 0 ? 0 : -1);
  if (idx >= 0) { goToLesson(idx); return; }
  // No active lessons — show study view with upload prompt
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
