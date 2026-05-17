# Folio

A personal study companion built for reading, note-taking, and spaced-repetition flashcard review — entirely offline, no account required, your data never leaves your device.

**Live:** https://imsulaeman.github.io/Folio

---

## What it does

| Feature | Details |
|---|---|
| **PDF & EPUB reader** | Full text layer, zoom, sepia filter, per-book progress, resume on reopen |
| **Flashcards (FSRS-5)** | Free Spaced Repetition System with 18 pre-trained weights, Anki .apkg import |
| **Rich-text notes** | ContentEditable editor with headings, font size/color, lists, links, blockquotes, inline code |
| **Drawing & sticky notes** | Canvas overlay on any page, draggable sticky notes, persisted per page to IndexedDB |
| **Dashboard** | Book library, reading status, 7-day streak ring, Pomodoro bar chart, cards donut |
| **Pomodoro timer** | Draggable widget, Web Audio API bells, theatrical completion animation |
| **Audio player** | Folder upload, playlist, speed control, repeat modes |
| **Japanese support** | Romaji → kana auto-conversion in flashcard input, Japanese TTS via Web Speech API |
| **Light / dark mode** | Warm dark default, animated Mochi cat logo that switches between awake and sleeping states |

---

## Stack

Vanilla HTML + CSS + JavaScript. No framework, no build-step complexity, no server.

```
index.html        HTML shell — references css/ and js/
css/main.css      All styles
js/               20 modular scripts (state → richtext)
build.js          Inlines everything into dist/Folio.html
```

**External libraries (CDN only):**
- [PDF.js](https://mozilla.github.io/pdf.js/) — PDF rendering + text layer
- [JSZip](https://stuk.github.io/jszip/) — EPUB parsing + Anki `.apkg` extraction
- [sql.js](https://sql.js.org/) — SQLite parsing for Anki decks

**Persistence:**
- `IndexedDB` — binary storage for PDFs, EPUBs, canvas drawings, sticky notes
- `localStorage` — progress, flashcards, notes, settings, streak, Pomodoro history

No network after the first CDN load. Works fully offline.

---

## Running locally

Open `dist/Folio.html` directly in Chrome or Edge — no server needed.

To rebuild from source after editing `index.html`, `css/main.css`, or any `js/*.js`:

```bash
node build.js
# → dist/Folio.html
```

---

## Flashcard algorithm

Cards use **FSRS-5** (Free Spaced Repetition System), a modern SRS algorithm that outperforms SM-2 on recall benchmarks. Implementation includes:

- 18 pre-trained weight parameters
- Stability / Difficulty / Retrievability calculations
- States: New → Learning → Review → Relearning
- Smooth migration path from SM-2 easiness values
- Anki `.apkg` import with field mapping UI and duplicate detection

---

## Design

Restrained dark aesthetic: warm neutrals, single red accent, serif Japanese typography.

```
--bg:     #181614   darkest surface
--bg2:    #211f1c   card / panel
--bg3:    #2a2825   hover / raised
--accent: #c0392b   red — the only color
--text:   #ede5d8   warm cream

Fonts: Shippori Mincho (display) · Noto Serif JP (body) · DM Mono (labels)
```

---

## Principles

1. **Your data stays on your device.** No server, no account, no tracking.
2. **Single distributable file.** `dist/Folio.html` is the whole app.
3. **No framework.** Vanilla everything — the constraint is intentional.
4. **Study-first.** Every feature serves the loop: read → note → review → retain.
