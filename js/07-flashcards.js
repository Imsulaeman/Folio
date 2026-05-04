/* ═══════════════════════════════════
   FLASHCARDS — SM-2 Spaced Repetition
   Each card: { jp, rd, mn, interval, easiness, dueDate, reps, lapses }
   interval  = days until next review
   easiness  = multiplier (2.5 default, min 1.3)
   dueDate   = ms timestamp when next due
   reps      = consecutive successful reviews
═══════════════════════════════════ */

const TODAY_MS = () => {
  const d = new Date(); d.setHours(0,0,0,0); return d.getTime();
};
const DAY_MS = 86400000;

function srsInit(card) {
  if (!card.dueDate)      card.dueDate      = TODAY_MS();
  if (!card.interval)     card.interval     = 0;
  if (!card.easiness)     card.easiness     = 2.5;
  if (!card.reps)         card.reps         = 0;
  if (!card.lapses)       card.lapses       = 0;
  if (card.correctCount === undefined) card.correctCount = 0;
  return card;
}

// SM-2 algorithm
function sm2(card, rating) {
  // rating: 0=again, 1=hard, 2=good, 3=easy
  card = srsInit(card);

  if (rating === 0) {
    // Again — reset
    card.reps     = 0;
    card.lapses   += 1;
    card.interval = 1;
    card.easiness = Math.max(1.3, card.easiness - 0.2);
    card.dueDate  = TODAY_MS() + DAY_MS;
  } else {
    // Passed — advance
    if (card.reps === 0)      card.interval = 1;
    else if (card.reps === 1) card.interval = 6;
    else {
      const bonus = rating === 3 ? 1.3 : rating === 1 ? 1.2 : 1;
      card.interval = Math.round(card.interval * card.easiness * bonus);
    }
    // Easiness adjustment
    const q = rating * (5/3); // map 1-3 → 1.67-5
    card.easiness = Math.max(1.3, card.easiness + 0.1 - (5-q)*(0.08+(5-q)*0.02));
    card.reps    += 1;
    card.dueDate  = TODAY_MS() + card.interval * DAY_MS;
  }
  return card;
}

// Session state
let srsQueue      = [];   // cards due this session
let srsQueueIdx   = 0;
let srsReviewAll  = false;
let srsSessionDone = 0;

function getDueCards() {
  const now = TODAY_MS();
  return S.cards.map(srsInit).filter(c => c.dueDate <= now);
}

function getNewCards() {
  return S.cards.map(srsInit).filter(c => c.reps === 0 && c.dueDate <= TODAY_MS());
}

function getMatureCards() {
  return S.cards.filter(c => (c.interval || 0) >= 21);
}

function updateSrsStats() {
  S.cards.forEach(srsInit);
  document.getElementById('srs-due').textContent    = getDueCards().length;
  document.getElementById('srs-new').textContent    = getNewCards().length;
  document.getElementById('srs-mature').textContent = getMatureCards().length;
  document.getElementById('srs-total').textContent  = S.cards.length;
  updateDueBadge();
}

function toggleReviewAll() {
  srsReviewAll = !srsReviewAll;
  document.getElementById('review-all-btn').classList.toggle('active', srsReviewAll);
  startSrsSession();
}

// Per-session tracking: cards that failed their first attempt this session
let srsFailedFirstAttempt = new Set(); // card references that were wrong on first try
let srsCardFirstSeen = new Set();      // card references seen for first time this session

const SRS_SESSION_CAP = 20;

function startSrsSession() {
  S.cards.forEach(srsInit);
  if (srsReviewAll) {
    srsQueue = [...S.cards];
  } else {
    const due = getDueCards();
    const remaining = Math.max(0, SRS_SESSION_CAP - due.length);
    const newCards = S.cards.filter(c => c.reps === 0 && !due.includes(c)).slice(0, remaining);
    srsQueue = [...due, ...newCards];
    // Cap total session to SRS_SESSION_CAP
    if (srsQueue.length > SRS_SESSION_CAP) srsQueue = srsQueue.slice(0, SRS_SESSION_CAP);
  }
  // Shuffle
  for (let i = srsQueue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i+1));
    [srsQueue[i], srsQueue[j]] = [srsQueue[j], srsQueue[i]];
  }
  srsQueueIdx          = 0;
  srsSessionDone       = 0;
  srsFailedFirstAttempt = new Set();
  srsCardFirstSeen      = new Set();
  renderFC();
}

function renderFC() {
  S.cards.forEach(srsInit);
  const empty  = document.getElementById('fc-empty');
  const nodue  = document.getElementById('fc-nodue');
  const study  = document.getElementById('fc-study');
  const sec    = document.getElementById('cards-section');

  updateSrsStats();

  if (!S.cards.length) {
    empty.style.display='block'; nodue.style.display='none';
    study.style.display='none'; sec.style.display='none'; return;
  }

  empty.style.display='none';
  sec.style.display='block';
  renderChips();

  // Update session progress bar
  const sessBar = document.getElementById('srs-session-bar');
  const sessFill = document.getElementById('srs-sess-fill');
  const sessLabel = document.getElementById('srs-sess-label');
  if (sessBar) {
    if (srsQueue.length > 0 && !srsReviewAll) {
      sessBar.classList.add('visible');
      const done = Math.min(srsQueueIdx, srsQueue.length);
      sessLabel.textContent = `${done} / ${srsQueue.length}`;
      sessFill.style.width = `${Math.round((done / srsQueue.length) * 100)}%`;
    } else {
      sessBar.classList.remove('visible');
    }
  }

  if (srsQueue.length === 0 || srsQueueIdx >= srsQueue.length) {
    // Nothing due / session complete
    nodue.style.display='flex'; study.style.display='none';
    if (sessBar) sessBar.classList.remove('visible');
    const nextDue = S.cards.reduce((min, c) => Math.min(min, c.dueDate||Infinity), Infinity);
    const daysUntil = nextDue === Infinity ? '—' : Math.ceil((nextDue - TODAY_MS()) / DAY_MS);
    const accuracy = srsCardFirstSeen.size > 0
      ? Math.round(((srsCardFirstSeen.size - srsFailedFirstAttempt.size) / srsCardFirstSeen.size) * 100)
      : 100;
    document.getElementById('fc-nodue-msg').innerHTML =
      srsSessionDone > 0
        ? `Session complete! Reviewed <b>${srsSessionDone}</b> card${srsSessionDone>1?'s':''}  ·  Accuracy: <b>${accuracy}%</b><br><span style="font-size:11px;opacity:.7">Next card due in ${daysUntil} day${daysUntil===1?'':'s'} · Click Review All to keep going</span>`
        : `No cards due right now.<br>Next due in <b>${daysUntil}</b> day${daysUntil===1?'':'s'}. Click Review All to practice.`;
    return;
  }

  nodue.style.display='none'; study.style.display='flex';
  showSrsCard();
}

/* ── Typing answer state ── */
let typeStep       = 1;
let typeRdOk       = false;
let typeMnOk       = false;
let wrongCountdown = null;   // setInterval handle for 10s countdown
let waitingForNext = false;  // true when in the 10s wrong delay
let currentKanaMode = null;  // 'hiragana' | 'katakana' | null (auto-detected per card)

function clearWrongCountdown() {
  if (wrongCountdown) { clearInterval(wrongCountdown); wrongCountdown = null; }
  waitingForNext = false;
}

function showSrsCard() {
  clearWrongCountdown();
  const c = srsQueue[srsQueueIdx];
  if (!c) return;

  typeStep = 1; typeRdOk = false; typeMnOk = false;
  currentKanaMode = detectKanaMode(c.rd);

  document.getElementById('type-kanji').textContent = c.jp;
  const step1Label = currentKanaMode === 'katakana'
    ? 'Step 1 of 2 — Type the reading (カタカナ)'
    : currentKanaMode === 'hiragana'
    ? 'Step 1 of 2 — Type the reading (ふりがな)'
    : 'Step 1 of 2 — Type the reading';
  document.getElementById('type-step').textContent = step1Label;
  const inp = document.getElementById('type-input');
  const ph = currentKanaMode === 'katakana' ? 'Type reading (romaji → カタカナ)…'
           : currentKanaMode === 'hiragana' ? 'Type reading (romaji → ひらがな)…'
           : 'Type reading…';
  inp.value = ''; inp.placeholder = ph;
  inp.className = 'type-input'; inp.disabled = false;
  document.getElementById('type-feedback').textContent = '';
  document.getElementById('type-feedback').className   = 'type-feedback';
  document.getElementById('type-feedback').style.color = '';
  document.getElementById('type-submit-btn').textContent = 'Check →';
  document.getElementById('type-submit-btn').disabled    = false;
  document.getElementById('type-submit-btn').onclick     = submitTypeAnswer;
  document.getElementById('result-row').style.display    = 'none';

  const info = c.reps === 0
    ? 'New card'
    : `Interval: ${c.interval}d · Ease: ${c.easiness.toFixed(2)} · Reviews: ${c.reps}`;
  document.getElementById('card-srs-info').textContent = info;
  document.getElementById('session-progress').textContent =
    `${srsQueueIdx + 1} / ${srsQueue.length} · ${srsSessionDone} done`;

  setTimeout(() => { inp.focus(); }, 50);
}

function normalize(s) {
  if (!s) return '';
  let r = s.trim();
  // Convert katakana → hiragana so コーヒー and こーひー are treated equal
  r = r.replace(/[ァ-ヶ]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60));
  return r.toLowerCase().replace(/[　\s]+/g, ' ').replace(/[ー－]/g, 'ー');
}

function fuzzyMatch(input, target) {
  const a = normalize(input), b = normalize(target);
  if (a === b) return 'exact';
  if (b.includes(a) || a.includes(b)) return 'close';
  return 'wrong';
}

function startWrongCountdown(card) {
  // Called after wrong answer — 10s countdown, D/→ skips, A/← goes back
  waitingForNext = true;
  let secs = 10;
  const btn = document.getElementById('type-submit-btn');
  const updateBtn = () => {
    btn.textContent = `Next card in ${secs}s — or D/→`;
    btn.disabled    = false;
  };
  updateBtn();
  btn.onclick = () => { clearWrongCountdown(); applyRatingAndAdvance(card, 'again', false); };

  wrongCountdown = setInterval(() => {
    secs--;
    if (secs <= 0) {
      clearWrongCountdown();
      applyRatingAndAdvance(card, 'again', false);
    } else {
      updateBtn();
    }
  }, 1000);
}

function submitTypeAnswer() {
  const c   = srsQueue[srsQueueIdx];
  if (!c) return;
  const inp = document.getElementById('type-input');
  const fb  = document.getElementById('type-feedback');
  // Finalize any pending romaji before checking (e.g. trailing 'n' → 'ん')
  let raw = inp.value.trim();
  if (typeStep === 1 && currentKanaMode) {
    raw = convertRomaji(raw, currentKanaMode, true);
    inp.value = raw; // show the finalized kana in the field
  }
  const val = raw;
  if (!val) { inp.focus(); return; }

  const isFirstAttempt = !srsCardFirstSeen.has(c);

  if (typeStep === 1) {
    const match = fuzzyMatch(val, c.rd || c.jp);
    if (match === 'exact') {
      typeRdOk = true;
      inp.className = 'type-input correct';
      fb.textContent = '✓ Correct!'; fb.className = 'type-feedback correct';
    } else {
      typeRdOk = false;
      inp.className = 'type-input wrong';
      fb.textContent = `✗  ${c.rd || c.jp}`; fb.className = 'type-feedback wrong';
    }
    setTimeout(() => {
      typeStep = 2;
      document.getElementById('type-step').textContent = 'Step 2 of 2 — Type the meaning';
      inp.value = ''; inp.placeholder = 'Type meaning…';
      inp.className = 'type-input'; inp.disabled = false;
      fb.textContent = ''; fb.className = 'type-feedback'; fb.style.color = '';
      inp.focus();
    }, typeRdOk ? 500 : 1000);

  } else {
    const match = fuzzyMatch(val, c.mn);
    if (match === 'exact') {
      typeMnOk = true;
      inp.className = 'type-input correct';
      fb.textContent = '✓ Correct!'; fb.className = 'type-feedback correct';
    } else {
      typeMnOk = false;
      inp.className = 'type-input wrong';
      fb.textContent = `✗  ${c.mn}`; fb.className = 'type-feedback wrong';
    }

    const bothCorrect = typeRdOk && typeMnOk;
    inp.disabled = true;
    document.getElementById('type-submit-btn').disabled = true;

    setTimeout(() => {
      fb.innerHTML   = `Reading: <b>${c.rd||c.jp}</b> · Meaning: <b>${c.mn}</b>`;
      fb.className   = 'type-feedback';
      fb.style.color = 'var(--muted)';

      if (bothCorrect) {
        srsCardFirstSeen.add(c);
        if (isFirstAttempt && !srsFailedFirstAttempt.has(c)) {
          c.correctCount = (c.correctCount || 0) + 1;
        }
        const autoRating = (c.correctCount >= 3) ? 'easy' : 'good';
        // Correct: 0.8s then auto-advance
        setTimeout(() => applyRatingAndAdvance(c, autoRating, true), 800);

      } else {
        srsCardFirstSeen.add(c);
        if (isFirstAttempt && !srsFailedFirstAttempt.has(c)) {
          c.correctCount = Math.max(0, (c.correctCount || 0) - 1);
          srsFailedFirstAttempt.add(c);
        }
        // Wrong: show full answer then start 10s countdown
        document.getElementById('result-row').style.display = 'block';
        startWrongCountdown(c);
      }
    }, bothCorrect ? 400 : 600);
  }
}

function applyRatingAndAdvance(card, rating, isCorrect) {
  clearWrongCountdown();
  const ratingMap = { again:0, hard:1, good:2, easy:3 };
  const r = ratingMap[rating] ?? 2;
  const globalIdx = S.cards.findIndex(c => c === card);

  if (isCorrect) {
    if (globalIdx >= 0) S.cards[globalIdx] = sm2(S.cards[globalIdx], r);
    srsQueueIdx++;
    srsSessionDone++;
  } else {
    if (globalIdx >= 0) S.cards[globalIdx] = sm2(S.cards[globalIdx], 0);
    const retry = Math.min(srsQueueIdx + 1 + 3, srsQueue.length);
    srsQueue.splice(retry, 0, srsQueue[srsQueueIdx]);
    srsQueueIdx++;
    srsSessionDone++;
  }

  persist(); updateSrsStats();

  // Reset UI
  const inp = document.getElementById('type-input');
  if (inp) {
    inp.className='type-input'; inp.disabled=false; inp.value='';
  }
  const fb = document.getElementById('type-feedback');
  if (fb) { fb.textContent=''; fb.style.color=''; fb.className='type-feedback'; }
  document.getElementById('type-submit-btn').onclick    = submitTypeAnswer;
  document.getElementById('type-submit-btn').disabled   = false;
  document.getElementById('type-submit-btn').textContent = 'Check →';
  document.getElementById('result-row').style.display   = 'none';
  waitingForNext = false;

  if (srsQueueIdx >= srsQueue.length) renderFC();
  else showSrsCard();
}

function srsPreviousCard() {
  // Go back to previous card in queue
  if (srsQueueIdx <= 0) return;
  clearWrongCountdown();
  srsQueueIdx = Math.max(0, srsQueueIdx - 1);
  // Reset typing UI cleanly
  const inp = document.getElementById('type-input');
  if (inp) {
    inp.className='type-input'; inp.disabled=false; inp.value='';
  }
  const fb = document.getElementById('type-feedback');
  if (fb) { fb.textContent=''; fb.style.color=''; fb.className='type-feedback'; }
  document.getElementById('type-submit-btn').onclick    = submitTypeAnswer;
  document.getElementById('type-submit-btn').disabled   = false;
  document.getElementById('type-submit-btn').textContent = 'Check →';
  document.getElementById('result-row').style.display   = 'none';
  showSrsCard();
}

function srsRate(rating) {
  const c = srsQueue[srsQueueIdx];
  if (!c) return;
  applyRatingAndAdvance(c, rating, rating==='good'||rating==='easy');
}

function flipCard() {}

let cardsSectionOpen = false;

function toggleCardsSection() {
  cardsSectionOpen = !cardsSectionOpen;
  document.getElementById('cards-grid-wrap').style.display = cardsSectionOpen ? 'block' : 'none';
  document.getElementById('cards-section-arrow').style.transform = cardsSectionOpen ? 'rotate(0deg)' : 'rotate(-90deg)';
  if (cardsSectionOpen) renderChips();
}

function renderChips() {
  const count = S.cards.length;
  const csc = document.getElementById('cards-section-count');
  if (csc) csc.textContent = `(${count})`;

  if (!cardsSectionOpen) {
    const wrap = document.getElementById('cards-grid-wrap');
    if (wrap) wrap.style.display = 'none';
    const arrow = document.getElementById('cards-section-arrow');
    if (arrow) arrow.style.transform = 'rotate(-90deg)';
  }

  document.getElementById('cards-grid').innerHTML = S.cards.map((c,i) => {
    srsInit(c);
    if (!c.source) c.source = 'manual';
    const isDue    = c.dueDate <= TODAY_MS();
    const isMature = c.interval >= 21;
    const tag      = c.reps===0 ? '🆕' : isMature ? '🌟' : isDue ? '⏰' : `${c.interval}d`;
    const cc       = c.correctCount || 0;
    const ccColor  = cc >= 3 ? '#5bbf7a' : cc > 0 ? '#c9a227' : 'var(--muted)';
    return `<div class="chip">
      <div style="flex:1;min-width:0">
        <div class="chip-jp">${c.jp}</div>
        <div class="chip-en" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.mn}</div>
        <div style="font-size:9px;font-family:var(--fm);margin-top:2px;display:flex;gap:6px">
          <span>${tag}</span>
          <span style="color:${ccColor}">★${cc}/3</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">
        <button class="chip-del" onclick="speakJP('${c.jp.replace(/'/g,"\\'")}')" title="Listen">🔊</button>
        <button class="chip-del" onclick="editCard(${i})" title="Edit" style="color:var(--muted);font-size:11px">✎</button>
        <button class="chip-del" onclick="deleteCard(${i})" title="Delete">×</button>
      </div>
    </div>`;
  }).join('');

  renderDeckManager();
}

function renderDeckManager() {
  const dm = document.getElementById('deck-manager');
  const dl = document.getElementById('deck-list');
  if (!dm || !dl) return;

  if (!S.cards.length) { dm.style.display = 'none'; return; }
  dm.style.display = 'block';

  // Group cards by source
  const sources = {};
  S.cards.forEach(c => {
    const src = c.source || 'manual';
    if (!sources[src]) sources[src] = 0;
    sources[src]++;
  });

  dl.innerHTML = Object.entries(sources).map(([src, cnt]) => `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;
                background:var(--bg3);border-radius:6px;border:1px solid var(--border)">
      <span style="font-size:12px;flex:1">
        ${src === 'manual' ? '✏️ Manual' : src === 'imported' ? '📥 Imported' : '📦 ' + src}
      </span>
      <span style="font-size:11px;color:var(--muted);font-family:var(--fm)">${cnt} card${cnt>1?'s':''}</span>
      <button onclick="deleteDeck('${src.replace(/'/g,"\\'")}')"
        style="background:none;border:1px solid var(--border);color:var(--muted);
               padding:2px 8px;border-radius:4px;cursor:pointer;font-size:11px;
               font-family:var(--fb);transition:all .15s"
        onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'"
        onmouseout="this.style.borderColor='var(--border)';this.style.color='var(--muted)'">
        🗑 Delete
      </button>
    </div>`).join('');
}

function deleteDeck(source) {
  const count = S.cards.filter(c => (c.source||'manual') === source).length;
  const label = source === 'manual' ? 'manually added cards' : `"${source}"`;
  if (!confirm(`Delete all ${count} cards from ${label}?\n\nThis removes the cards and all their progress. Cannot be undone.`)) return;
  S.cards = S.cards.filter(c => (c.source||'manual') !== source);
  startSrsSession(); persist();
  showToast(`Deleted ${count} cards from ${source}`);
}

function deleteAllCards() {
  if (!S.cards.length) { showToast('No cards to delete'); return; }
  const count = S.cards.length;
  if (!confirm(`Delete ALL ${count} cards and their SRS progress?\n\nThis cannot be undone.`)) return;
  if (!confirm(`Are you sure? All ${count} cards will be permanently deleted.`)) return;
  S.cards = [];
  startSrsSession(); persist();
  showToast(`Deleted all ${count} cards`);
}

function deleteCard(i) {
  S.cards.splice(i,1);
  startSrsSession();
  persist();
}

let editingCardIdx = -1;

function openModal(editIdx) {
  editingCardIdx = editIdx !== undefined ? editIdx : -1;
  const isEdit = editingCardIdx >= 0;
  document.getElementById('modal-title').textContent    = isEdit ? 'Edit Card' : 'Add Flashcard';
  document.getElementById('modal-save-btn').textContent = isEdit ? 'Update' : 'Save';
  if (isEdit) {
    const c = S.cards[editingCardIdx];
    document.getElementById('in-jp').value = c.jp || '';
    document.getElementById('in-rd').value = c.rd || '';
    document.getElementById('in-mn').value = c.mn || '';
  } else {
    ['in-jp','in-rd','in-mn'].forEach(id => document.getElementById(id).value = '');
  }
  document.getElementById('modal-bg').classList.add('open');
  document.getElementById('in-jp').focus();
}

function editCard(i) { openModal(i); }

function closeModal() {
  document.getElementById('modal-bg').classList.remove('open');
  editingCardIdx = -1;
  ['in-jp','in-rd','in-mn'].forEach(id => document.getElementById(id).value = '');
}

function saveCard() {
  const jp = document.getElementById('in-jp').value.trim();
  const rd = document.getElementById('in-rd').value.trim();
  const mn = document.getElementById('in-mn').value.trim();
  if (!jp || !mn) { document.getElementById(jp?'in-mn':'in-jp').focus(); return; }
  if (editingCardIdx >= 0) {
    // Edit — preserve SRS data
    S.cards[editingCardIdx].jp = jp;
    S.cards[editingCardIdx].rd = rd;
    S.cards[editingCardIdx].mn = mn;
  } else {
    S.cards.push({ jp, rd, mn, interval:0, easiness:2.5, dueDate:TODAY_MS(), reps:0, lapses:0, correctCount:0, source:'manual' });
  }
  closeModal(); startSrsSession(); persist();
}

document.getElementById('in-mn').addEventListener('keydown', e => { if(e.key==='Enter') saveCard(); });
document.getElementById('modal-bg').addEventListener('click', function(e) { if(e.target===this) closeModal(); });

/* ═══════════════════════════════════
   ANKI IMPORT
═══════════════════════════════════ */
let ankiNotes     = [];
let ankiFields    = [];
let ankiSQL       = null;
let ankiDeckName  = '';

document.getElementById('anki-import-file').addEventListener('change', async function(e) {
  const file = e.target.files[0]; this.value = '';
  if (!file) return;
  showToast('Reading Anki file…');
  try {
    await parseApkg(file);
  } catch(err) {
    showToast('Failed to read .apkg: ' + err.message);
    console.error(err);
  }
});

async function parseApkg(file) {
  // 1. Unzip
  const zip  = await JSZip.loadAsync(await file.arrayBuffer());

  // Find the SQLite DB — could be collection.anki2 or collection.anki21
  const dbEntry = zip.file('collection.anki21') || zip.file('collection.anki2');
  if (!dbEntry) throw new Error('No collection database found in .apkg');

  const dbBuf = await dbEntry.async('arraybuffer');

  // 2. Load sql.js
  const SQL = await initSqlJs({
    locateFile: f => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.2/${f}`
  });
  ankiSQL = new SQL.Database(new Uint8Array(dbBuf));

  // 3. Get models (field names)
  const colRes = ankiSQL.exec('SELECT models FROM col LIMIT 1');
  const models = JSON.parse(colRes[0].values[0][0]);
  // Pick first model
  const firstModel  = Object.values(models)[0];
  ankiFields = firstModel.flds.map(f => f.name);

  // 4. Get notes
  const notesRes = ankiSQL.exec('SELECT flds FROM notes');
  ankiNotes = notesRes[0]?.values.map(row => {
    const parts = row[0].split('\x1f');
    const obj = {};
    ankiFields.forEach((name, i) => { obj[name] = (parts[i] || '').replace(/<[^>]+>/g, '').trim(); });
    return obj;
  }) || [];

  // 5. Open mapping modal
  openAnkiModal(firstModel.name, ankiFields, ankiNotes.slice(0, 3));
  ankiDeckName = firstModel.name;
}

function openAnkiModal(deckName, fields, preview) {
  document.getElementById('anki-deck-info').textContent =
    `Deck: "${deckName}" · ${ankiNotes.length} notes · ${fields.length} fields`;

  const makeOptions = (selected) => fields.map(f =>
    `<option value="${f}" ${f===selected?'selected':''}>${f}</option>`
  ).join('') + `<option value="__none__">— skip —</option>`;

  // Auto-guess field mapping by common names
  const guess = (keywords) => fields.find(f =>
    keywords.some(k => f.toLowerCase().includes(k))
  ) || fields[0];

  document.getElementById('anki-map-jp').innerHTML = makeOptions(guess(['expression','kanji','word','vocab','japanese','front']));
  document.getElementById('anki-map-rd').innerHTML = makeOptions(guess(['reading','kana','furigana','hiragana','yomi']));
  document.getElementById('anki-map-mn').innerHTML = makeOptions(guess(['meaning','english','translation','definition','gloss','back']));

  // Live preview
  const updatePreview = () => {
    if (!preview.length) return;
    const jp = document.getElementById('anki-map-jp').value;
    const rd = document.getElementById('anki-map-rd').value;
    const mn = document.getElementById('anki-map-mn').value;
    const ex = preview[0];
    document.getElementById('anki-preview').textContent =
      `Preview: ${ex[jp]||'—'} · ${rd!=='__none__'?ex[rd]||'—':'—'} · ${ex[mn]||'—'}`;
  };
  ['anki-map-jp','anki-map-rd','anki-map-mn'].forEach(id => {
    document.getElementById(id).addEventListener('change', updatePreview);
  });
  updatePreview();

  document.getElementById('anki-modal-bg').classList.add('open');
}

function closeAnkiModal() {
  document.getElementById('anki-modal-bg').classList.remove('open');
  ankiNotes = []; ankiFields = [];
  if (ankiSQL) { try { ankiSQL.close(); } catch(e){} ankiSQL = null; }
}

function confirmAnkiImport() {
  const jpField = document.getElementById('anki-map-jp').value;
  const rdField = document.getElementById('anki-map-rd').value;
  const mnField = document.getElementById('anki-map-mn').value;

  let imported = 0, skipped = 0;
  ankiNotes.forEach(note => {
    const jp = (note[jpField] || '').trim();
    const rd = rdField !== '__none__' ? (note[rdField] || '').trim() : '';
    const mn = (note[mnField] || '').trim();
    if (!jp || !mn) { skipped++; return; }
    // Skip duplicates (same jp + mn)
    const isDup = S.cards.some(c => c.jp === jp && c.mn === mn);
    if (isDup) { skipped++; return; }
    S.cards.push({ jp, rd, mn, interval:0, easiness:2.5, dueDate:TODAY_MS(), reps:0, lapses:0, correctCount:0, source: ankiDeckName || 'Anki' });
    imported++;
  });

  closeAnkiModal();
  startSrsSession();
  persist();
  showToast(`Imported ${imported} cards${skipped ? ` · ${skipped} skipped` : ''}`);
}

document.getElementById('anki-modal-bg').addEventListener('click', function(e) {
  if (e.target === this) closeAnkiModal();
});

/* ── Cards export / import (JSON) ── */
function exportCards() {
  if (!S.cards.length) { showToast('No cards to export'); return; }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S.cards, null, 2)], {type:'application/json'}));
  a.download = 'folio-cards.json'; a.click();
  showToast('Cards exported ✓');
}

document.getElementById('cards-import-file').addEventListener('change', function(e) {
  const file = e.target.files[0]; this.value = '';
  if (!file) return;
  const r = new FileReader();
  r.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!Array.isArray(imported)) throw new Error('Invalid format');
      let added = 0;
      imported.forEach(c => {
        if (!c.jp || !c.mn) return;
        srsInit(c);
        if (!c.correctCount) c.correctCount = 0;
        const isDup = S.cards.some(x => x.jp === c.jp && x.mn === c.mn);
        if (!isDup) { S.cards.push(c); added++; }
      });
      startSrsSession(); persist();
      showToast(`Imported ${added} cards`);
    } catch { showToast('Invalid cards file'); }
  };
  r.readAsText(file);
});
