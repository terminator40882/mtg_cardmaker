// Web Worker für rechenintensive Bildanalyse (läuft parallel auf weiteren CPU-Kernen):
// Artwork-Ausrichtung und Bestimmung der Regeltext-Größe am Original-Scan.
import { setFontScales } from './textlayout.js';
import { solveArtAlignment } from './align.js';
import { fitRulesVariant } from './rulesfit.js';

let ready = null;

/** Schriften wie im Hauptthread laden (aus /fonts/fonts.css). */
async function init({ scales }) {
  setFontScales(scales || {});
  const css = await (await fetch('/fonts/fonts.css')).text();
  const faces = [];
  const re = /@font-face\{font-family:'([^']+)';src:url\('([^']+)'\)[^;]*;(?:unicode-range:([^;]+);)?/g;
  let m;
  while ((m = re.exec(css))) {
    const face = new FontFace(m[1], `url(${new URL(m[2], self.location.origin).href})`, m[3] ? { unicodeRange: m[3] } : {});
    self.fonts.add(face);
    faces.push(face.load().catch(() => null));
  }
  await Promise.all(faces);
}

const handlers = {
  align: ({ art, scan, box, W, H }) => solveArtAlignment(art, scan, box, W, H),
  rules: (d) => {
    const r = fitRulesVariant(d);
    return { total: r.total, o: r.o, fit: r.fit };
  },
};

self.onmessage = async (e) => {
  const { id, type, data } = e.data;
  try {
    if (type === 'init') { ready = init(data); await ready; self.postMessage({ id, res: true }); return; }
    await ready;
    const res = handlers[type](data);
    self.postMessage({ id, res }, typeof ImageBitmap !== 'undefined' && res instanceof ImageBitmap ? [res] : []);
  } catch (err) {
    self.postMessage({ id, error: String(err?.message || err) });
  }
};
