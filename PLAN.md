# Folio — Project Plan

Everything built, in progress, and planned. Granular details.

---

## What Folio Is

An offline-first study companion. Upload PDFs and EPUBs, take rich-text notes alongside your reading, review flashcards with spaced repetition, track your study habits. Single HTML file, no server, no account, your data stays on your device.

Built from personal frustration: every existing tool either put your data in someone else's cloud, had a bad reading experience, or bolted note-taking on as an afterthought.

**Live:** https://imsulaeman.github.io/Folio

---

## Architecture

### Stack
- Vanilla HTML + CSS + JavaScript. No framework, no build step.
- `Folio.html` — all markup + 950 lines of inline CSS
- `js/` — 20 modular scripts (01-state.js through 20-richtext.js)
- `build.js` — concatenates everything into a single `index.html` for deployment

### External Libraries (CDN)
- **PDF.js 3.11.174** — PDF rendering with text layer
- **JSZip 3.10.1** — EPUB parsing + Anki .apkg extraction
- **sql.js 1.10.2** — Anki SQLite database parsing
- **Google Fonts** — Shippori Mincho, Noto Serif JP, DM Mono

### Data Persistence
- **IndexedDB** (`NihongoStudy v1`) — binary storage for PDFs, EPUBs, canvas drawings, sticky notes
- **localStorage** — progress, notes, flashcards, settings, study streak, theme, Pomodoro count, EPUB position
- **No server. No sync. No network after first CDN load.**

### File Structure
```
Folio.html              <- HTML shell + all CSS + script tags
index.html              <- built output (single file for deployment)
build.js                <- concatenation script
extract.js              <- utility
Light-Mode-Cat.png      <- logo asset
js/
  01-state.js           <- S{} global state object
  02-persistence.js     <- localStorage save/load helpers
  03-ui.js              <- toast notifications, tab switching, session restore
  04-pdf.js             <- PDF rendering, text layer, page navigation, selection
  05-audio.js           <- audio player, folder tree, playback controls
  06-notes.js           <- note CRUD, rich text migration, panel sync
  07-flashcards.js      <- FSRS-5 SRS engine, card review, Anki import/export
  08-dashboard.js       <- library view, stats rendering, Mochi nudges
  09-storage.js         <- storage quota monitoring, health badge
  10-pomodoro.js        <- timer logic, bell sounds, splash animation
  11-indexeddb.js       <- IDB open/transaction helpers, PDF persistence
  12-drawing.js         <- canvas drawing, sticky notes, page-key storage
  13-epub.js            <- EPUB parsing (OPF/container), chapter nav, rendering
  14-notifications.js   <- browser notification permissions + due card alerts
  15-tts.js             <- Web Speech API, Japanese voice selection
  16-theme.js           <- light/dark mode toggle, sepia filter, logo animation
  17-markdown.js        <- simple markdown renderer
  18-notes-preview.js   <- note preview formatting
  19-kana.js            <- romaji <-> hiragana/katakana conversion
  20-richtext.js        <- ContentEditable formatting, link/quote dialogs
```

---

## Design System

### Color Palette
```
--bg:     #181614     darkest surface
--bg2:    #211f1c     card/panel surface
--bg3:    #2a2825     raised element / hover
--border: #363330     dividers
--text:   #ede5d8     warm cream, primary text
--muted:  #857d72     secondary / labels
--accent: #c0392b     red, primary interactive
--acc2:   #e74c3c     red hover
```
Color strategy: **Restrained dark.** Warm neutrals + single red accent, limited to ~10% of surface area. No new accent colors without design reason.

### Typography
- **Display/Logo:** Shippori Mincho (serif JP)
- **Body:** Noto Serif JP (serif JP)
- **Labels/Numbers/Meta:** DM Mono (monospace)
- Three fonts only. Never add more.

### Logo / Branding
- **Cat mascot ("Mochi")** — animated cat illustration
- **Dark mode:** awake cat, moon glow effect
- **Light mode:** sleeping cat on book, sun with rays
- **Logo transition:** morphs between awake/sleeping states on theme toggle
- **Asset:** `Light-Mode-Cat.png` + dark variant (WebP in dashboard)
- **Favicon:** not currently set (planned)

### Light / Dark Mode
- **Default:** dark mode (the identity of the app)
- **Toggle:** header button (sun/moon icon)
- **Storage:** `theme` key in localStorage ('light' | 'dark')
- **Scope:** CSS variable swap on `:root`, sepia filter toggle on PDF viewer
- **Logo animation:** cat awake (dark) / sleeping (light), smooth transition
- **Rule:** never lighten the dark background — the dark warmth is the identity

### Layout
```
+----------------------------------------------------------+
| HEADER (50px fixed)                                      |
+------------+------------------------+--------------------+
| SIDEBAR    | MAIN CONTENT           | RIGHT PANEL        |
| (260px)    | (flex 1fr)             | (260px)            |
|            |                        |                    |
| - Lessons  | Views:                 | - Mochi avatar     |
| - Audio    | - study (PDF reader)   | - Stats (streak    |
|            | - flashcards (SRS)     |   ring, focus bars, |
|            | - notes (editor)       |   cards donut,     |
|            | - dashboard (library)  |   progress)        |
|            |                        | - Notes panel      |
|            | Floating:              |                    |
|            | - Pomodoro widget      |                    |
|            | - Selection popup      |                    |
|            | - Modals               |                    |
+------------+------------------------+--------------------+
```
- CSS Grid: `260px | 1fr | 260px`
- Desktop only (no mobile optimization currently)

### Interaction Conventions
- **Active tab:** `background: var(--accent)` + `box-shadow: 0 0 16px rgba(192,57,43,.55)`
- **Hover:** `background: var(--bg3)` — no color shift, no border glow
- **Active lesson:** `inset 2px 0 0 var(--accent)` box-shadow (left accent)
- **Pressed buttons:** `transform: scale(0.97)` on `:active`
- **Toast notifications:** `opacity: 0 -> 1`, 1800ms timeout
- **Tab switch:** `transition: all .22s`
- **Sidebar hover:** `transition: all .15s`
- **Modal entry:** `scale(0.97) -> scale(1)` + `opacity: 0 -> 1`, 180ms ease-out
- **Flashcard transitions:** 150-200ms ease-out on transform

---

## Features — What's Built

### 1. PDF Reader
- PDF.js rendering with text layer (selection + copy)
- Page navigation: prev/next buttons, keyboard (A/D), direct page jump input
- Zoom: fit page, +/-, range 0.4x-3x
- Sepia tone filter toggle
- Per-lesson page progress tracking
- Resume from last page on reopen
- Progress bar on sidebar lesson items
- Selection popup: highlight text -> add to notes, speak (TTS)
- Keyboard: A/D (pages), W/S (smooth scroll)

### 2. EPUB Reader
- Pure JSZip-based parsing (no external EPUB library)
- OPF/container.xml parsing -> manifest + spine extraction
- Chapter navigation (works like pages)
- HTML content rendering with integrated styling
- Resource blob URL caching for offline images/styles
- EPUB position tracking via CFI (Canonical Fragment Identifier)
- Resume from last chapter/position

### 3. Flashcards & Spaced Repetition
- **Algorithm:** FSRS-5 (Free Spaced Repetition System)
  - 18 pre-trained weight parameters
  - Migrated from SM-2 to FSRS with easiness->difficulty conversion
  - States: New (0) -> Learning (1) -> Review (2) -> Relearning (3)
  - Stability / Difficulty / Retrievability calculations
- **Card fields:** Japanese (kanji), Reading (furigana), Meaning
- **Review flow:**
  - Step 1: type reading (romaji auto-converts to hiragana/katakana)
  - Step 2: type meaning
  - Combined grade (worst of both steps)
  - 10-second countdown on wrong answers
  - Auto-advance on correct
- **Stats bar:** DUE / NEW / MATURE (stability >= 21 days) counts
- **Card chip grid:** tag indicators (new, mature, due, days until due)
- **Correct count per card:** star ratings (0-3)
- **Deck manager:** group by source (manual, imported, Anki deck name)
- **Import/Export:**
  - Anki (.apkg): SQL parsing, field mapping UI, duplicate detection, live preview
  - JSON export/import: full card data with SRS progress
  - Card CRUD: add/edit modal, delete individual or by deck
  - "Delete All" with double-confirm
- **Keyboard:** A/D (back/forward cards), L (speak card)

### 4. Notes System
- Multiple notes per lesson
- **Rich text editor (ContentEditable):**
  - Headings (H1-H3 + normal)
  - Font size (small to huge)
  - Bold, Italic, Underline, Strikethrough
  - Text color picker
  - Bullet lists, numbered lists
  - Links (insert/remove)
  - Blockquotes (toggle)
  - Inline code (toggle)
  - Clear formatting
  - Floating popup on text selection
- Per-lesson note array in localStorage
- Auto-save on keystroke (saved indicator)
- Migration from plain text -> HTML ContentEditable
- Import/Export: JSON with all notes + lesson associations
- Sidebar: lesson list with note indicators (has-notes badge)
- Right panel: floating notes panel synced with active PDF/lesson
- Quick add from selection: "Add to Notes" with blockquote styling

### 5. Drawing & Sticky Notes
- **Drawing mode:**
  - Canvas overlay on PDF/EPUB
  - Color picker + brush size (1-20px)
  - Eraser tool
  - Clear page button
  - Drawings persisted per page to IndexedDB
- **Sticky notes mode:**
  - Draggable positioned elements
  - Customizable: BG color, font size, width/height, font family
  - Stored per page in IndexedDB
- **Keyboard:** F (draw mode), E (eraser), T (sticky mode)

### 6. Dashboard / Library
- **Welcome screen:**
  - Time-based greeting (morning/afternoon/evening)
  - Study streak counter (7-day dot display)
  - CTA buttons: "Continue Reading", "Review Cards (N due)"
- **Book library:**
  - Filter by status: Reading / To-Read / Finished / All
  - Book categories (custom + assign books)
  - Book cards: title, page progress %, notes indicator, category tag, hidden status
  - Actions: Open, Restore, Change status, Change category, Hide, Delete
- **Visual stats (right panel):**
  - Streak ring: SVG circular progress, 7-day history dots
  - Focus sessions: bar chart (7-day Pomodoro count)
  - Cards donut: Mature (green) / Learning (gold) / New (blue) segments
  - Progress row: total pages read + total words written
- **Mochi companion:**
  - Cat mascot image in right panel
  - AI-like nudges: streak messages, flashcard reminders, study encouragement
  - Theme-aware (dark/light variants)

### 7. Pomodoro Timer
- **Phases:** Work (25m) -> Short Rest (5m) x4 cycles -> Long Rest (30m)
- **UI:** floating draggable widget
  - Live timer (MM:SS)
  - 4 completion dots (fills per work session)
  - Phase label + emoji (tomato/coffee/moon)
  - Play/Pause, Reset, Skip buttons
- **Bells:** Web Audio API
  - Triumphant notes (C5 E5 G5 C6 E6) on work end
  - Gentle rest bell (G5 E5 C5)
- **Splash animation:**
  - Full-screen red pulsing overlay
  - 20 exploding tomato particles (randomized velocity, size, rotation)
  - "DONE!" text slam
  - Intentionally theatrical — never reduce
- **Tracking:** Pomodoro count stored for stats bar chart

### 8. Audio Player
- Folder + file upload (webkitdirectory API)
- Formats: MP3, M4A, OGG, WAV, FLAC, WebM, AAC, Opus
- Playlist by folder hierarchy, toggle folders
- Progress bar with seek
- Skip +/-10s buttons
- Speed control: 0.75x / 1x / 1.25x / 1.5x
- Repeat modes: off / one / all
- Current track display + time
- Keyboard: Space (play/pause)

### 9. Japanese-Specific Features
- **Romaji -> Kana converter:**
  - Auto-detects if answer should be hiragana or katakana
  - Handles special chars (n, long vowel marks, etc.)
- **Text-to-Speech:**
  - Web Speech API for Japanese voice
  - Prefers ja-JP local voice
  - Slightly slower rate (0.9x) for study
  - Triggered by: speaker button on cards, selection popup, L key
  - Strips HTML before speaking

### 10. Storage & Persistence
- Storage health indicator: real-time badge showing quota usage (green/yellow/red)
- Uses `navigator.storage.estimate()` for quota monitoring
- Browser notifications for due flashcards
- File System Access API support for data persistence

---

## Features — Planned / Not Yet Built

### Mobile Responsiveness
- Currently desktop-only (3-column grid)
- Need responsive layout: collapse sidebars, bottom tab bar
- Touch gestures: swipe between pages, pinch zoom
- Priority: high (most people read on phones)

### PWA / Service Worker
- No service worker registered
- All resources from CDN on first load
- Plan: add service worker to cache CDN libs + app shell
- Add web manifest for "Add to Home Screen"
- Goal: true offline-first, works without any network after install

### Favicon
- Currently not set
- Plan: match the cat logo / Mochi mascot
- SVG favicon preferred (scalable, theme-aware)

### Search
- Full-text search across PDF content
- Search across all notes
- Search flashcards by content
- Keyboard shortcut: Ctrl+K or /

### Bookmarks / Highlights
- Highlight text in PDF with color options
- Persistent highlights stored per page
- Bookmark specific pages for quick return
- Highlight export (for review)

### PDF Annotations
- Currently drawings are separate canvas overlay, not embedded
- Plan: merge annotations into PDF view layer
- Margin notes alongside paragraphs
- Exportable annotations

### EPUB Chapter Navigation
- Currently renders flat (chapter by chapter)
- Plan: table of contents sidebar for EPUBs
- Chapter jump menu
- Visual chapter progress

### Data Export / Backup
- Full app data export (all lessons, cards, notes, progress) as JSON
- Import from backup
- Option to export as markdown
- CSV export for flashcards

### Performance
- Large PDF rendering optimization
- Virtual scrolling for long note lists
- Lazy load lesson thumbnails
- IndexedDB cleanup for orphaned data

### Accessibility
- Keyboard navigation improvements
- Screen reader labels
- Focus management in modals
- High contrast mode option

### Reading Stats
- Time spent reading per session
- Pages per day chart
- Reading speed tracking
- Completion predictions

### Focus Mode
- Hide all UI except the reader
- Dimmed background
- Keyboard shortcut to toggle (Ctrl+Shift+F or similar)
- Pair with Pomodoro auto-start

### Multi-language Support
- Currently Japanese-specific (kana converter, JP TTS)
- Generalize for any language flashcards
- Language detection for TTS voice selection
- Configurable card fields

### Sync (Long-term / Considered but Deferred)
- Main blocker: going online makes offline-first features pointless + introduces hosting costs
- If ever implemented: end-to-end encrypted sync, peer-to-peer (no server)
- Or: manual export/import via file (already partially exists)
- Decision: stay offline. This is the identity.

---

## Technical Debt

- `Folio - Copy.html` — dead file, should be removed
- Some localStorage keys use legacy naming (`lessonOrder` vs organized namespace)
- EPUB rendering could be more robust (edge cases with complex EPUB structures)
- Audio player waveform visualization is placeholder
- Markdown renderer (`17-markdown.js`) exists but not heavily used in UI
- No automated tests
- No CI/CD pipeline (manual build + push)
- CDN dependency — if CDNs go down, first load fails (service worker would fix)

---

## Build & Deploy

### Build
```bash
node build.js
```
Concatenates `Folio.html` + all `js/*.js` into single `index.html`.

### Deploy
- GitHub Pages: push `index.html` to `main` branch
- Repository: `imsulaeman/Folio`
- Live at: https://imsulaeman.github.io/Folio

---

## Design Principles

1. **Your data stays on your device.** No server, no account, no tracking.
2. **Single file.** Download one HTML file and you have the whole app.
3. **No framework.** Vanilla everything. No build step complexity.
4. **Dark warmth.** The aesthetic is intentional: warm neutrals, single red accent, serif typography.
5. **Study-first.** Every feature serves the loop: read -> note -> review -> retain.
6. **Offline is a feature, not a limitation.** Privacy by architecture.
