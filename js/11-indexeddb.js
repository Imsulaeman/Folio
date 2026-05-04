/* ═══════════════════════════════════
   INDEXEDDB — auto-store & reload PDFs
═══════════════════════════════════ */
let IDB = null;
function openIDB() {
  return new Promise((res, rej) => {
    const req = indexedDB.open('NihongoStudy', 1);
    req.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('pdfs'))     db.createObjectStore('pdfs');
      if (!db.objectStoreNames.contains('drawings')) db.createObjectStore('drawings');
      if (!db.objectStoreNames.contains('stickies')) db.createObjectStore('stickies');
    };
    req.onsuccess = e => { IDB = e.target.result; res(IDB); };
    req.onerror   = () => rej(req.error);
  });
}

function idbPut(store, key, value) {
  return new Promise((res, rej) => {
    const tx = IDB.transaction(store, 'readwrite');
    tx.objectStore(store).put(value, key);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

function idbGet(store, key) {
  return new Promise((res, rej) => {
    const tx  = IDB.transaction(store, 'readonly');
    const req = tx.objectStore(store).get(key);
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

function idbGetAll(store) {
  return new Promise((res, rej) => {
    const tx  = IDB.transaction(store, 'readonly');
    const req = tx.objectStore(store).getAllKeys();
    req.onsuccess = () => res(req.result);
    req.onerror   = () => rej(req.error);
  });
}

function idbDelete(store, key) {
  return new Promise((res, rej) => {
    const tx = IDB.transaction(store, 'readwrite');
    tx.objectStore(store).delete(key);
    tx.oncomplete = res; tx.onerror = () => rej(tx.error);
  });
}

/* Save PDF blob to IDB when uploaded */
async function savePdfToIDB(name, file) {
  const buf  = await file.arrayBuffer();
  const type = file.name.toLowerCase().endsWith('.epub') ? 'epub' : 'pdf';
  await idbPut('pdfs', name, { data: buf, type });
}

/* Load all stored PDFs/EPUBs on startup and restore them */
async function restorePDFsFromIDB() {
  const keys = await idbGetAll('pdfs');
  for (const name of keys) {
    const stored = await idbGet('pdfs', name);
    // Handle both old format (raw ArrayBuffer) and new format ({data, type})
    let buf, type;
    if (stored && stored.data) {
      buf  = stored.data;
      type = stored.type || 'pdf';
    } else {
      buf  = stored;  // old format: raw ArrayBuffer
      type = 'pdf';
    }
    const mimeType = type === 'epub' ? 'application/epub+zip' : 'application/pdf';
    const blob = new Blob([buf], { type: mimeType });
    const url  = URL.createObjectURL(blob);
    const exists = S.lessons.find(l => l.name === name);
    if (!exists) {
      S.lessons.push({ name, url, type });
    }
  }
  if (S.lessons.length) {
    renderSidebar(); renderNotesSidebar();
    selectLesson(0);
    document.getElementById('restore-banner')?.remove();
    showToast(`↩ ${S.lessons.length} lesson(s) restored automatically`);
  }
}
