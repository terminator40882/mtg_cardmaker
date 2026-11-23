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

/** Lädt alle Symbole (z.B. "{2}", "{W/U}", "{T}") eines Textes vor. */
export async function loadSymbols(codes, symbolMap) {
  const out = new Map();
  await Promise.all([...new Set(codes)].map(async (code) => {
    const url = symbolMap.get(code) || symbolMap.get(code.toUpperCase());
    if (!url) return;
    try {
      out.set(code, await loadImage(url));
    } catch { /* Symbol fehlt -> wird als Text gezeichnet */ }
  }));
  return out;
}

export async function ensureFonts(sizes = ['80px']) {
  const fams = ['CMTitle', 'CMRules', 'CMRulesItalic', 'CMInfo', 'CMArtist', 'CMRetroTitle', 'CMMatrix'];
  await Promise.all(fams.flatMap((f) => sizes.map((s) => document.fonts.load(`${s} ${f}`, 'AaĆ—•'))));
}
