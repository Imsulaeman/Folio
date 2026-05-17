/**
 * build.js  —  bundles the multi-file project back into a single HTML file.
 *
 * Usage:
 *   node build.js
 *
 * Output:
 *   dist/Folio.html   ← ready to share or open as a standalone file
 *
 * No npm packages required — uses only Node.js built-ins.
 */

const fs   = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const DOCS = path.join(ROOT, 'docs');

/* ── helpers ─────────────────────────────────────────── */
function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/* ── 1. read index.html ──────────────────────────────── */
let html = read('index.html');

/* ── 2. inline <link rel="stylesheet" href="…"> ────── */
html = html.replace(
  /<link\s+rel="stylesheet"\s+href="([^"]+)"[^>]*>/g,
  (_, href) => {
    const css = read(href);
    return `<style>\n${css}</style>`;
  }
);

/* ── 3. inline <script src="…"></script> ────────────── */
html = html.replace(
  /<script\s+src="([^"]+)"><\/script>/g,
  (_, src) => {
    // only inline local files — leave CDN scripts alone
    if (src.startsWith('http://') || src.startsWith('https://')) {
      return `<script src="${src}"></script>`;
    }
    const js = read(src);
    return `<script>\n${js}</script>`;
  }
);

/* ── 4. inline image references (mochi WebP) ──────────── */
html = html.replace(
  /(['"])img\/(mochi-(?:dark|light)\.webp)\1/g,
  (_, q, file) => {
    const imgPath = path.join(ROOT, 'img', file);
    if (fs.existsSync(imgPath)) {
      const b64 = fs.readFileSync(imgPath).toString('base64');
      return `${q}data:image/webp;base64,${b64}${q}`;
    }
    return `${q}img/${file}${q}`;
  }
);

/* ── 5. collapse multiple consecutive blank lines ────── */
html = html.replace(/\n{3,}/g, '\n\n');

/* ── 6. write output ─────────────────────────────────── */
fs.mkdirSync(DIST, { recursive: true });
const out = path.join(DIST, 'Folio.html');
fs.writeFileSync(out, html, 'utf8');

// also write to docs/index.html for GitHub Pages
fs.mkdirSync(DOCS, { recursive: true });
fs.writeFileSync(path.join(DOCS, 'index.html'), html, 'utf8');

const kb = Math.round(fs.statSync(out).size / 1024);
console.log(`✓ dist/Folio.html  (${kb} KB)`);
console.log('  Open it directly in Chrome/Edge — no server needed.');
