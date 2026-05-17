pdfjsLib.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js';

/* ═══════════════════════════════════
   STATE
═══════════════════════════════════ */
const S = {
  lessons: [], active: -1,
  hiddenLessons: [],       // [{name, url}] — hidden from sidebar, still in dashboard
  pdfDoc: null, page: 1, total: 0, scale: 1.2,
  currentLessonName: null,
  audioFolders: [], activeFolder: -1, activeTrack: -1, allOpen: true,
  cards: [], card: 0, flipped: false,
  activeNoteLesson: null,
  activeNoteId: null,
  mode: 'select',
  drawing: false,
  lastX: 0, lastY: 0,
};
