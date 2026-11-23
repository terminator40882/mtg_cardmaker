// Laden und Cachen von Bildern (Artwork, Mana- und Set-Symbole) für das Canvas.
const images = new Map();

export function loadImage(url) {
  if (!url) return Promise.resolve(null);
  if (!images.has(url)) {
    images.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.decoding = 'async';
      // Rastergrafiken sofort (parallel, außerhalb des Hauptthreads) dekodieren – sonst dekodiert der
      // Browser die großen Rahmen-PNGs erst beim ersten Zeichnen, nacheinander im Hauptthread.
      const svg = /svg/i.test(decodeURIComponent(url));
      img.onload = () => {
        if (svg || typeof createImageBitmap !== 'function') { resolve(img); return; }
        createImageBitmap(img).then(resolve, () => resolve(img));
      };
      img.onerror = () => { images.delete(url); reject(new Error(`Bild nicht ladbar: ${url}`)); };
      img.src = url;
    }));
  }
  return images.get(url);
}

/** Entfernt ein Bild aus dem Cache (z. B. ein gelöschtes eigenes Artwork). */
export function forgetImage(url) {
  images.delete(url);
}

/** Lädt alle Symbole (z.B. "{2}", "{W/U}", "{T}") eines Textes vor. */
export async function loadSymbols(codes, symbolMap) {
  const out = new Map();
  await Promise.all([...new Set(codes)].map(async (code) => {
    // Eintrag: URL oder Liste von URLs (bevorzugte zuerst, z. B. Card Conjurer -> Scryfall)
    const entry = symbolMap.get(code) || symbolMap.get(code.toUpperCase());
    for (const url of [].concat(entry || [])) {
      try {
        out.set(code, await loadImage(url));
        return;
      } catch { /* nächste Quelle; fehlen alle -> wird als Text gezeichnet */ }
    }
  }));
  return out;
}

export async function ensureFonts(sizes = ['80px']) {
  const fams = ['CMTitle', 'CMRules', 'CMRulesItalic', 'CMInfo', 'CMArtist', 'CMRetroTitle', 'CMMatrix'];
  await Promise.all(fams.flatMap((f) => sizes.map((s) => document.fonts.load(`${s} ${f}`, 'AaĆ—•'))));
}
