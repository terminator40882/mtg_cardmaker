// Schriftgröße/Zeilenabstand des Regeltexts für eine Textvariante am Scan bestimmen.
// Ohne DOM-Abhängigkeiten – läuft im Hauptthread und im Web Worker (siehe worker.js).
import { fitText, drawText, METRICS } from './textlayout.js';
import { fitTextToScan, blockExtent } from './align.js';
import { mkCanvas } from './canvas.js';

/**
 * vp: Absätze der Variante, textBox, baseOpts (fitText-Optionen), rules {maxCap,minCap},
 * metrics (Layout-Metriken), scan (Bild), W/H, symbols (Map code -> Bild), key (Cache-Schlüssel).
 * Liefert { total, o, fit } – kleineres total = passender zum Scan.
 */
export function fitRulesVariant({ vp, textBox, baseOpts, rules, metrics, scan, W, H, symbols, key }) {
  const ctx = mkCanvas(8, 8).getContext('2d');
  const baseM = { ...METRICS, ...(metrics || {}) };
  const withK = (k) => ({ ...(metrics || {}), lineHeight: baseM.lineHeight * k, paraGap: baseM.paraGap * k, flavorGap: baseM.flavorGap * k });
  const fScan = (scan.naturalWidth || scan.width) / W;
  const scanExt = blockExtent(scan, textBox, W, H, fScan);
  const auto = fitText(ctx, vp, textBox, baseOpts).cap;
  const draw = (x, c) => {
    drawText(x, fitText(x, vp, textBox, { ...baseOpts, fixedCap: c.cap, metrics: withK(c.k) }), symbols, { flavorBar: false });
    return true;
  };
  // 1) Versalhöhe über die erste Zeile, 2) Zeilenabstand über den Zeilenabstand im Scan
  const caps = [];
  for (let c = rules.maxCap * 1.15; c >= Math.max(rules.minCap, auto * 0.7); c -= 0.5) caps.push(c);
  const fit = fitTextToScan(scan, textBox, W, H, caps, [0.88, 0.91, 0.94, 0.97, 1, 1.03, 1.06], draw, `${key}|f`);
  let o = baseOpts;
  if (fit) {
    // nie größer als das, was ins Textfeld passt (etwas Luft zu den Kanten lassen)
    let c = fit.cap;
    const fits = (cc) => {
      const lay = fitText(ctx, vp, textBox, { ...baseOpts, fixedCap: cc, metrics: withK(fit.k) });
      return !lay.overflow && lay.height <= textBox.h - 12 && !lay.collides;
    };
    while (c > rules.minCap && !fits(c)) c -= 0.5;
    o = { ...baseOpts, fixedCap: c, metrics: withK(fit.k) };
  }
  // Lage des Textblocks mit dem Scan vergleichen (obere und untere Kante)
  let score = 0;
  if (scanExt) {
    const tmp = mkCanvas(W, H);
    const tx = tmp.getContext('2d');
    drawText(tx, fitText(tx, vp, textBox, o), symbols, { flavorBar: false });
    const e = blockExtent(tmp, textBox, W, H, fScan);
    score = e ? Math.abs(e.top - scanExt.top) + Math.abs(e.bottom - scanExt.bottom) : 1e9;
  }
  // erste Zeile (Wortlaut) zählt stärker als die Blocklage
  const total = score - (fit?.r || 0) * 40;
  return { total, o, fit };
}
