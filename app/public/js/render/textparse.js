// Zerlegt Oracle- und Flavortext in Absätze aus "Atomen" (Text / Symbol, kursiv ja/nein).

const SYMBOL_RE = /\{[^}]+\}/g;
const LOYALTY_RE = /^([+−\-]?(?:\d+|X))\s*:\s*(.*)$/;
const CHAPTER_RE = /^[IVX]+(?:,\s*[IVX]+)*$/;

/** Typografische Anführungszeichen/Apostrophe wie im Druck. */
export function smartQuotes(text) {
  if (!text) return text;
  let open = true;
  return text
    .replace(/(^|[\s(\[{—–-])'/g, '$1\u2018')
    .replace(/'/g, '\u2019')
    .replace(/"/g, () => { const q = open ? '\u201C' : '\u201D'; open = !open; return q; });
}

/** Entfernt Reminder-Text (alles in Klammern) und räumt Leerzeichen auf. */
export function stripReminder(line) {
  let prev;
  do {
    prev = line;
    line = line.replace(/\s*\([^()]*\)/g, '');
  } while (line !== prev);
  return line.replace(/\s+([.,;:])/g, '$1').replace(/\s{2,}/g, ' ').trim();
}

function tokenize(line, italicPrefixLen = 0) {
  const atoms = [];
  let depth = 0;
  let buf = '';
  let bufItalic = false;
  const flush = () => {
    if (buf) atoms.push({ t: 'text', text: buf, italic: bufItalic });
    buf = '';
  };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '{') {
      const end = line.indexOf('}', i);
      if (end > i) {
        flush();
        atoms.push({ t: 'sym', code: line.slice(i, end + 1).toUpperCase() });
        i = end;
        continue;
      }
    }
    if (ch === '(') depth++;
    const italic = depth > 0 || i < italicPrefixLen;
    if (italic !== bufItalic) {
      flush();
      bufItalic = italic;
    }
    buf += ch;
    if (ch === ')' && depth > 0) depth--;
  }
  flush();
  return atoms;
}

/**
 * @param {string} text Oracle-Text
 * @param {{showReminder:boolean, keywords:Set<string>, planeswalker:boolean}} opts
 */
export function parseRules(text, opts) {
  const paras = [];
  for (const raw of (smartQuotes(text) || '').split('\n')) {
    let line = raw.trim();
    if (!opts.showReminder) line = stripReminder(line);
    if (!line) continue;

    let loyalty = null;
    if (opts.planeswalker) {
      const m = line.match(LOYALTY_RE);
      if (m) {
        loyalty = m[1].replace('-', '−');
        line = m[2];
      }
    }

    // Fähigkeitswörter / Flavor-Wörter vor " — " werden kursiv gesetzt (z.B. "Landfall — ").
    let italicPrefix = 0;
    const am = line.match(/^([^{}():•—]{2,40}?) — \S/);
    if (am) {
      const prefix = am[1].trim();
      const lower = prefix.toLowerCase();
      const isKeyword = opts.keywords?.has(lower) || opts.keywords?.has(lower.split(' ')[0]);
      if (!isKeyword && !CHAPTER_RE.test(prefix)) italicPrefix = am[1].length;
    }
    paras.push({ kind: 'rules', loyalty, atoms: tokenize(line, italicPrefix) });
  }
  return paras;
}

/** Flavortext: kursiv; "*" schaltet (wie bei Scryfall) auf nicht-kursiv um. */
export function parseFlavor(text) {
  const paras = [];
  for (const raw of (smartQuotes(text) || '').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    const atoms = [];
    let italic = true;
    for (const part of line.split('*')) {
      if (part) atoms.push({ t: 'text', text: part, italic });
      italic = !italic;
    }
    paras.push({ kind: 'flavor', attribution: /^[—\-]/.test(line), atoms });
  }
  return paras;
}

export function symbolsIn(...texts) {
  return texts.flatMap((t) => (t || '').match(SYMBOL_RE) || []).map((s) => s.toUpperCase());
}
