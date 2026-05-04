/* ═══════════════════════════════════
   SELF-CONTAINED ROMAJI → KANA CONVERTER
   No CDN dependency — works fully offline.
   Auto-detects target script from the card's reading field.
   hiragana card → romaji input auto-converts to hiragana
   katakana card → romaji input auto-converts to katakana
   other cards   → plain text, no conversion
═══════════════════════════════════ */

const KANA_MAP = {
  // vowels
  'a':'あ','i':'い','u':'う','e':'え','o':'お',
  // k
  'ka':'か','ki':'き','ku':'く','ke':'け','ko':'こ',
  'kya':'きゃ','kyi':'きぃ','kyu':'きゅ','kye':'きぇ','kyo':'きょ',
  // s
  'sa':'さ','si':'し','su':'す','se':'せ','so':'そ',
  'shi':'し','sha':'しゃ','shu':'しゅ','she':'しぇ','sho':'しょ',
  'sya':'しゃ','syi':'しぃ','syu':'しゅ','sye':'しぇ','syo':'しょ',
  // t
  'ta':'た','ti':'ち','tu':'つ','te':'て','to':'と',
  'chi':'ち','tsu':'つ',
  'cha':'ちゃ','chu':'ちゅ','che':'ちぇ','cho':'ちょ',
  'tya':'ちゃ','tyi':'ちぃ','tyu':'ちゅ','tye':'ちぇ','tyo':'ちょ',
  'tchi':'っち',
  // n
  'na':'な','ni':'に','nu':'ぬ','ne':'ね','no':'の',
  'nya':'にゃ','nyi':'にぃ','nyu':'にゅ','nye':'にぇ','nyo':'にょ',
  'n':'ん','nn':'ん',
  // h
  'ha':'は','hi':'ひ','hu':'ふ','he':'へ','ho':'ほ',
  'fu':'ふ',
  'hya':'ひゃ','hyi':'ひぃ','hyu':'ひゅ','hye':'ひぇ','hyo':'ひょ',
  'fa':'ふぁ','fi':'ふぃ','fe':'ふぇ','fo':'ふぉ',
  // m
  'ma':'ま','mi':'み','mu':'む','me':'め','mo':'も',
  'mya':'みゃ','myi':'みぃ','myu':'みゅ','mye':'みぇ','myo':'みょ',
  // y
  'ya':'や','yu':'ゆ','yo':'よ',
  // r
  'ra':'ら','ri':'り','ru':'る','re':'れ','ro':'ろ',
  'rya':'りゃ','ryi':'りぃ','ryu':'りゅ','rye':'りぇ','ryo':'りょ',
  // w
  'wa':'わ','wi':'ゐ','we':'ゑ','wo':'を',
  // g
  'ga':'が','gi':'ぎ','gu':'ぐ','ge':'げ','go':'ご',
  'gya':'ぎゃ','gyi':'ぎぃ','gyu':'ぎゅ','gye':'ぎぇ','gyo':'ぎょ',
  // z / j
  'za':'ざ','zi':'じ','zu':'ず','ze':'ぜ','zo':'ぞ',
  'ji':'じ','ja':'じゃ','ju':'じゅ','je':'じぇ','jo':'じょ',
  'jya':'じゃ','jyi':'じぃ','jyu':'じゅ','jye':'じぇ','jyo':'じょ',
  'zya':'じゃ','zyi':'じぃ','zyu':'じゅ','zye':'じぇ','zyo':'じょ',
  // d
  'da':'だ','di':'ぢ','du':'づ','de':'で','do':'ど',
  'dya':'ぢゃ','dyi':'ぢぃ','dyu':'ぢゅ','dye':'ぢぇ','dyo':'ぢょ',
  // b
  'ba':'ば','bi':'び','bu':'ぶ','be':'べ','bo':'ぼ',
  'bya':'びゃ','byi':'びぃ','byu':'びゅ','bye':'びぇ','byo':'びょ',
  // p
  'pa':'ぱ','pi':'ぴ','pu':'ぷ','pe':'ぺ','po':'ぽ',
  'pya':'ぴゃ','pyi':'ぴぃ','pyu':'ぴゅ','pye':'ぴぇ','pyo':'ぴょ',
  // small kana via x-prefix
  'xa':'ぁ','xi':'ぃ','xu':'ぅ','xe':'ぇ','xo':'ぉ',
  'xya':'ゃ','xyu':'ゅ','xyo':'ょ',
  'xtu':'っ','xtsu':'っ',
  'ltu':'っ','ltsu':'っ',
  'la':'ぁ','li':'ぃ','lu':'ぅ','le':'ぇ','lo':'ぉ',
};

function hiraganaToKatakana(str) {
  return str.replace(/[ぁ-ゖ]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60));
}

function detectKanaMode(reading) {
  if (!reading) return null;
  let hira = 0, kata = 0;
  for (const ch of reading) {
    const code = ch.charCodeAt(0);
    if (code >= 0x3041 && code <= 0x3096) hira++;
    else if (code >= 0x30A1 && code <= 0x30F6) kata++;
  }
  if (hira === 0 && kata === 0) return null;
  return kata > hira ? 'katakana' : 'hiragana';
}

// convertRomaji: live IME-style converter
//   input   — current text field value (romaji)
//   mode    — 'hiragana' | 'katakana' | null
//   finalize— true at submit: flush pending 'n' → ん
function convertRomaji(input, mode, finalize) {
  if (!mode || !input) return input;
  const s = input.toLowerCase();
  let result = '';
  let i = 0;

  while (i < s.length) {
    const ch = s[i];

    // Long vowel dash → ー
    if (ch === '-') {
      result += 'ー';
      i++;
      continue;
    }

    // Double consonant → っ/ッ (not vowels, not 'n' which has its own rule)
    const isVowel = 'aeiou'.includes(ch);
    if (!isVowel && ch !== 'n' && i + 1 < s.length && s[i + 1] === ch) {
      result += mode === 'katakana' ? 'ッ' : 'っ';
      i++;   // consume one of the pair; next iteration handles the second
      continue;
    }

    // Longest-match lookup (4 → 3 → 2 → 1)
    let matched = false;
    for (let len = Math.min(4, s.length - i); len >= 1; len--) {
      // IME pending rule: don't consume lone 'n' when next char could extend it
      if (len === 1 && ch === 'n' && !finalize) {
        if (i + 1 < s.length && 'aeiouyn'.includes(s[i + 1])) continue;
        if (i + 1 >= s.length) continue; // lone 'n' at end → leave pending
      }
      const chunk = s.slice(i, i + len);
      if (Object.prototype.hasOwnProperty.call(KANA_MAP, chunk)) {
        let kana = KANA_MAP[chunk];
        if (mode === 'katakana') kana = hiraganaToKatakana(kana);
        result += kana;
        i += len;
        matched = true;
        break;
      }
    }

    if (!matched) {
      result += s[i]; // pass through unconverted (e.g. pending 'n', partial consonant)
      i++;
    }
  }

  return result;
}

/* ── Live kana input listener (permanent, set up once at page load) ── */
(function setupKanaInput() {
  const inp = document.getElementById('type-input');
  if (!inp) return;

  inp.addEventListener('input', function() {
    if (typeStep !== 1) return;       // Step 2 is plain text (meaning)
    if (!currentKanaMode) return;     // non-Japanese card → no conversion

    const val = this.value;
    if (!val) return;

    const conv = convertRomaji(val, currentKanaMode, false);
    if (conv !== val) {
      const cursor = this.selectionStart;
      this.value = conv;
      const diff = conv.length - val.length;
      this.setSelectionRange(Math.max(0, cursor + diff), Math.max(0, cursor + diff));
    }
  });
})();

let notesTabPreviewMode = false;
function toggleNotesTabPreview() {
  notesTabPreviewMode = !notesTabPreviewMode;
  const btn      = document.getElementById('notes-tab-preview-btn');
  const textarea = document.getElementById('note-area');
  const preview  = document.getElementById('notes-tab-preview');
  if (!btn || !textarea || !preview) return;
  btn.classList.toggle('active', notesTabPreviewMode);
  if (notesTabPreviewMode) {
    textarea.style.display = 'none';
    preview.classList.add('visible');
    preview.innerHTML = simpleMarkdown(textarea.value);
  } else {
    textarea.style.display = '';
    preview.classList.remove('visible');
    textarea.focus();
  }
}
