// Schriftverwaltung. Die echten Karten-Schriften (Beleren, MPlantin, ...) sind
// proprietär und werden daher NICHT mitgeliefert. Liegen sie im Ordner FONTS_DIR,
// werden sie automatisch verwendet; sonst greifen frei lizenzierte Ersatzschriften,
// die per npm lokal installiert sind (keine CDNs). Die Auswahl (Tinos für MPlantin,
// PT Serif Bold für Beleren) wurde per Pixel-Korrelation gegen Kartenscans aus
// ~90 freien Schriften ermittelt.
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const FONTS_DIR = process.env.FONTS_DIR || path.resolve(here, '..', 'fonts');
export const FONTSOURCE_DIR = path.resolve(here, '..', 'node_modules', '@fontsource');

const LATIN = 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD';
const LATIN_EXT = 'U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF';

// family: Name im Canvas; custom: akzeptierte Dateinamen (klein, nur a-z0-9); fallback: fontsource-Datei
const ROLES = [
  // scaleX: horizontale Korrektur der Ersatzschrift, per Pixel-Vergleich mit Kartenscans ermittelt
  { family: 'CMTitle', custom: ['belerenbold', 'beleren2016bold', 'belerenbold2016', 'belerenb', 'beleren'], fallback: ['pt-serif', '700-normal'], scaleX: 0.93 },
  { family: 'CMRules', custom: ['mplantin', 'mplantinregular', 'plantinmtpro', 'plantinmtproregular'], fallback: ['tinos', '400-normal'], scaleX: 1.115 },
  { family: 'CMRulesItalic', custom: ['mplantinitalic', 'mplantinit', 'mplantini', 'plantinmtproitalic'], fallback: ['tinos', '400-italic'], scaleX: 1.054 },
  { family: 'CMInfo', custom: ['gothammedium', 'relaymedium', 'relay'], fallback: ['alegreya-sans', '500-normal'], scaleX: 1 },
  { family: 'CMArtist', custom: ['belerensmallcaps', 'beleren2016smallcapsbold', 'belerensmallcapsbold', 'belerenbsc'], fallback: ['alegreya-sans', '700-normal'], scaleX: 1 },
  { family: 'CMRetroTitle', custom: ['goudymedieval', 'goudymediaeval'], fallback: ['alegreya', '500-normal'], scaleX: 1 },
  { family: 'CMMatrix', custom: ['matrixbold', 'matrixb', 'matrix'], fallback: ['pt-serif', '700-normal'], scaleX: 0.93 },
];

const FORMAT = { ttf: 'truetype', otf: 'opentype', woff: 'woff', woff2: 'woff2' };

async function customFonts() {
  try {
    const files = await readdir(FONTS_DIR);
    const map = new Map();
    for (const f of files) {
      const ext = path.extname(f).slice(1).toLowerCase();
      if (!FORMAT[ext]) continue;
      map.set(path.basename(f, path.extname(f)).toLowerCase().replace(/[^a-z0-9]/g, ''), f);
    }
    return map;
  } catch {
    return new Map();
  }
}

/** Erzeugt das @font-face-CSS und eine Übersicht, welche Schrift aktiv ist. */
export async function fontCss() {
  const custom = await customFonts();
  const css = [];
  const status = {};
  for (const role of ROLES) {
    const hit = role.custom.map((k) => custom.get(k)).find(Boolean);
    if (hit) {
      const ext = path.extname(hit).slice(1).toLowerCase();
      css.push(`@font-face{font-family:'${role.family}';src:url('/fonts/custom/${encodeURIComponent(hit)}') format('${FORMAT[ext]}');font-display:block;}`);
      status[role.family] = { source: 'custom', file: hit, scaleX: 1 };
    } else {
      const [pkg, variant] = role.fallback;
      for (const [subset, range] of [['latin', LATIN], ['latin-ext', LATIN_EXT]]) {
        css.push(`@font-face{font-family:'${role.family}';src:url('/fonts/fallback/${pkg}/files/${pkg}-${subset}-${variant}.woff2') format('woff2');unicode-range:${range};font-display:block;}`);
      }
      status[role.family] = { source: 'fallback', file: `${pkg} ${variant}`, scaleX: role.scaleX };
    }
  }
  return { css: css.join('\n'), status };
}
