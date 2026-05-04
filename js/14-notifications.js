/* ═══════════════════════════════════
   DUE BADGE + BROWSER NOTIFICATIONS
═══════════════════════════════════ */
function updateDueBadge() {
  S.cards.forEach(srsInit);
  const due   = getDueCards().length;
  const badge = document.getElementById('due-badge');
  if (!badge) return;
  if (due > 0) {
    badge.textContent = due > 99 ? '99+' : due;
    badge.style.display = 'inline-flex';
  } else {
    badge.style.display = 'none';
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendDueNotification() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  S.cards.forEach(srsInit);
  const due = getDueCards().length;
  if (!due) return;

  // Only send once per day
  const d = loadStore() || {};
  const today = new Date().toDateString();
  if (d.lastNotif === today) return;
  d.lastNotif = today;
  saveStore(d);

  new Notification('📚 Folio — Cards due', {
    body: `You have ${due} card${due>1?'s':''} to review today.`,
    icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">📖</text></svg>',
    tag:  'folio-due',
  });
}
