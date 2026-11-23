import { mkCanvas } from './canvas.js';
// Richtet das Artwork (Scryfall art_crop) am Original-Scan aus: sucht Skalierung und
// Verschiebung, bei der das Artwork im Bildfenster am besten mit dem Scan übereinstimmt
// (Summe der absoluten Helligkeitsdifferenzen, grob-zu-fein).
const cache = new Map();

function lumaGrid(img, w, h) {
  const c = mkCanvas(w, h);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
  return out;
}

function sample(grid, gw, gh, x, y) {
  if (x < 0 || y < 0 || x > gw - 1 || y > gh - 1) return -1;
  const x0 = Math.floor(x); const y0 = Math.floor(y);
  const x1 = Math.min(x0 + 1, gw - 1); const y1 = Math.min(y0 + 1, gh - 1);
  const fx = x - x0; const fy = y - y0;
  const a = grid[y0 * gw + x0] * (1 - fx) + grid[y0 * gw + x1] * fx;
  const b = grid[y1 * gw + x0] * (1 - fx) + grid[y1 * gw + x1] * fx;
  return a * (1 - fy) + b * fy;
}

/**
 * art: Artwork-Bild, scan: Original-Scan (ganze Karte), box: Bildfenster in Kartenkoordinaten,
 * W/H: Kartengröße. Ergebnis: Rechteck {x,y,w,h} in Kartenkoordinaten oder null.
 */
export function alignArt(art, scan, box, W, H, key) {
  if (!art || !scan) return null;
  if (key && cache.has(key)) return cache.get(key);
  const res = solve(art, scan, box, W, H);
  if (key) cache.set(key, res);
  return res;
}

function solve(art, scan, box, W, H) {
  const aw = art.naturalWidth || art.width;
  const ah = art.naturalHeight || art.height;
  // Ausgangslage: Artwork füllt das Fenster (cover)
  const s0 = Math.max(box.w / aw, box.h / ah);
  const base = { cx: box.x + box.w / 2, cy: box.y + box.h / 2, s: s0 };

  const levels = [
    { f: 1 / 8, ds: [0.9, 1.16, 0.02], dxy: [-48, 48, 8] },
    { f: 1 / 4, ds: [-0.02, 0.02, 0.005], dxy: [-8, 8, 2] },
    { f: 1 / 2, ds: [-0.005, 0.005, 0.0025], dxy: [-2, 2, 1] },
  ];
  let best = { ds: 1, dx: 0, dy: 0 };
  for (let li = 0; li < levels.length; li++) {
    const { f, ds, dxy } = levels[li];
    const sw = Math.round(W * f); const sh = Math.round(H * f);
    const scanG = lumaGrid(scan, sw, sh);
    // Artwork-Raster in passender Auflösung (Pixel des Rasters = Kartenpixel * f bei s0)
    const gw = Math.max(8, Math.round(aw * s0 * f)); const gh = Math.max(8, Math.round(ah * s0 * f));
    const artG = lumaGrid(art, gw, gh);
    // Stichproben im inneren Fenster (Rand meiden: Rahmenkante, Schatten)
    const inset = 0.06;
    const pts = [];
    // Stichprobendichte: genügt für eindeutige Ausrichtung (grob 2, mittel 3, fein 4 Rasterpunkte)
    const step = [2, 3, 4][li];
    for (let y = box.y + box.h * inset; y < box.y + box.h * (1 - inset); y += step / f) {
      for (let x = box.x + box.w * inset; x < box.x + box.w * (1 - inset); x += step / f) {
        const v = scanG[Math.round(y * f) * sw + Math.round(x * f)];
        if (v !== undefined) pts.push(x, y, v);
      }
    }
    const center = li === 0 ? { ds: 0, dx: 0, dy: 0 } : best;
    let bestErr = Infinity;
    let cand = best;
    const scales = li === 0 ? range(...ds) : range(...ds).map((d) => center.ds + d);
    for (const sc of scales) {
      const s = base.s * sc;
      const w = aw * s; const h = ah * s;
      for (const dy of range(...dxy)) {
        for (const dx of range(...dxy)) {
          const ox = base.cx - w / 2 + (center.dx || 0) + dx;
          const oy = base.cy - h / 2 + (center.dy || 0) + dy;
          // Kartenkoordinate -> Artwork-Raster
          const k = (gw / w); const kh = gh / h;
          let err = 0; let n = 0;
          // Abbruch, sobald der Kandidat sicher schlechter ist als der bisher beste
          const limit = bestErr * (pts.length / 3);
          for (let i = 0; i < pts.length; i += 3) {
            const v = sample(artG, gw, gh, (pts[i] - ox) * k, (pts[i + 1] - oy) * kh);
            err += v < 0 ? 60 : Math.abs(v - pts[i + 2]); n++;
            if (err > limit) break;
          }
          err = n === pts.length / 3 ? err / n : Infinity;
          if (err < bestErr) { bestErr = err; cand = { ds: sc, dx: (center.dx || 0) + dx, dy: (center.dy || 0) + dy }; }
        }
      }
    }
    best = cand;
    best.err = bestErr;
  }
  // Ausrichtung nur übernehmen, wenn sie eindeutig passt (sonst anderes Artwork / Promo)
  if (best.err > 40) return null;
  const s = base.s * best.ds;
  const w = aw * s; const h = ah * s;
  return { x: base.cx - w / 2 + best.dx, y: base.cy - h / 2 + best.dy, w, h, err: best.err };
}

function range(a, b, st) {
  const out = [];
  for (let v = a; v <= b + 1e-9; v += st) out.push(Math.round(v * 10000) / 10000);
  return out;
}

// ---------- Regeltext-Größe am Scan bestimmen ----------

const textCache = new Map();

// wiederverwendete Arbeits-Canvases (vermeidet ständiges Anlegen großer Canvases)
const pool = new Map();
function workCanvas(w, h, slot = 'a') {
  const key = slot;
  let c = pool.get(key);
  if (!c) { c = mkCanvas(w, h); pool.set(key, c); }
  if (c.width !== w || c.height !== h) { c.width = w; c.height = h; } else c.getContext('2d', { willReadFrequently: true }).clearRect(0, 0, w, h);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.imageSmoothingQuality = 'high';
  return [c, x];
}

/**
 * Tintenraster aus RGBA-Daten: Schrift = deutlich dunkler als der Zeilenhintergrund.
 * Helle Schrift auf dunklem Grund (z. B. Clear Textboxes / "inverted"-Drucke): überwiegen deutlich
 * hellere Ausreißer gegenüber dem Median, wird die Helligkeit umgekehrt, damit die Schrift als Tinte zählt.
 */
function maskFromData(d, w, h, threshold = 110) {
  const out = new Uint8Array(w * h);
  const dk = new Float32Array(w * h); // Dunkelheit 0..1 relativ zum Zeilenhintergrund
  const lum = new Float32Array(w);
  const hist = new Uint32Array(256);
  const k = Math.floor(w * 0.85);
  // Polarität: Median der Helligkeit (transparente Pixel = hell)
  for (let i = 0; i < w * h; i++) {
    const j = i * 4;
    hist[d[j + 3] > 128 ? (d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114) | 0 : 255]++;
  }
  let acc0 = 0; let median = 255;
  for (let v = 0; v < 256; v++) { acc0 += hist[v]; if (acc0 > (w * h) / 2) { median = v; break; } }
  // umkehren, wenn deutlich hellere Ausreißer (Schrift) überwiegen als deutlich dunklere
  let brighter = 0; let darker = 0;
  for (let v = 0; v < 256; v++) {
    if (v > median + 70) brighter += hist[v];
    else if (v < median - 70) darker += hist[v];
  }
  const invert = median < 140 && brighter > 0.01 * w * h && brighter > darker * 2;
  for (let y = 0; y < h; y++) {
    hist.fill(0);
    for (let xx = 0; xx < w; xx++) {
      const i = (y * w + xx) * 4;
      let l = d[i + 3] > 128 ? d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114 : 255;
      if (invert && d[i + 3] > 128) l = 255 - l;
      lum[xx] = l; hist[l | 0]++;
    }
    // 85-%-Perzentil der Zeilenhelligkeit über das Histogramm (statt Sortieren)
    let acc = 0; let bg = 255;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > k) { bg = v; break; } }
    const t = Math.min(threshold, bg * 0.6);
    const ref = bg * 0.85;
    for (let xx = 0; xx < w; xx++) {
      const l = lum[xx]; const o = y * w + xx;
      out[o] = l < t ? 1 : 0;
      dk[o] = ref > 0 ? Math.max(0, Math.min(1, (ref - l) / ref)) : 0;
    }
  }
  return { out, dk, w, h };
}

/**
 * Dunkle Pixel (Schrift) in einem Kartenausschnitt als 0/1-Raster.
 * smooth (für Scans): leicht weichzeichnen – sonst hält die Erkennung das Druckraster alter Karten
 * (z. B. Collectors' Edition, Moiré im Scan) für Schrift.
 */
function inkMask(src, box, f, W, H, threshold = 110, smooth = false) {
  const w = Math.max(1, Math.round(box.w * f)); const h = Math.max(1, Math.round(box.h * f));
  const [, x] = workCanvas(w, h, 'ink');
  const sw = src.width || src.naturalWidth; const sh = src.height || src.naturalHeight;
  if (smooth) {
    // Rand mitnehmen, damit der Weichzeichner an den Kanten keinen hellen Saum erzeugt
    x.clearRect(0, 0, w, h);
    x.filter = 'blur(0.8px)';
  }
  x.drawImage(src, box.x * sw / W, box.y * sh / H, box.w * sw / W, box.h * sh / H, 0, 0, w, h);
  x.filter = 'none';
  return maskFromData(x.getImageData(0, 0, w, h).data, w, h, threshold);
}

/**
 * Zeichnet (draw in Kartenkoordinaten) direkt in eine Canvas in der Größe des Ausschnitts
 * (Maßstab f) und liefert das Tintenraster – ohne kartengroße Zwischen-Canvas.
 */
function renderInk(draw, box, f, threshold = 110) {
  const w = Math.max(1, Math.round(box.w * f)); const h = Math.max(1, Math.round(box.h * f));
  const [, x] = workCanvas(w, h, 'render');
  x.setTransform(f, 0, 0, f, -box.x * f, -box.y * f);
  if (draw(x) === false) return null;
  return maskFromData(x.getImageData(0, 0, w, h).data, w, h, threshold);
}

// ---------- Schriftgröße/Zeilenabstand über Zeilenmetriken (unabhängig vom Wortlaut) ----------

/** Zeilenhöhe (Tintenband je Zeile) und Zeilenabstand aus einem Tintenraster. */
function lineStats(m) {
  const r = new Float32Array(m.h);
  for (let y = 0; y < m.h; y++) { let s = 0; for (let x = 0; x < m.w; x++) s += m.out[y * m.w + x]; r[y] = s; }
  const sm = r.map((v, y) => (r[y - 1] || 0) * 0.25 + v * 0.5 + (r[y + 1] || 0) * 0.25);
  const max = Math.max(...sm);
  if (!max) return null;
  // Höhe: Kernband jeder Zeile (Mittellänge der Kleinbuchstaben) bei 35 % der maximalen Zeilentinte
  const thr = max * 0.35;
  const runs = [];
  let start = -1;
  for (let y = 0; y <= m.h; y++) {
    const on = y < m.h && sm[y] > thr;
    if (on && start < 0) start = y;
    if (!on && start >= 0) { if (y - start >= 2) runs.push([start, y]); start = -1; }
  }
  if (!runs.length) return null;
  const med = (a) => { const s2 = [...a].sort((p, q) => p - q); return s2[Math.floor(s2.length / 2)]; };
  // Mittelwert der mittleren Hälfte (robust und feiner als der Median ganzer Pixel)
  const lens = runs.map(([a2, b2]) => b2 - a2).sort((p, q) => p - q);
  const core = lens.slice(Math.floor(lens.length / 4), Math.max(Math.floor(lens.length / 4) + 1, Math.ceil(lens.length * 3 / 4)));
  const height = core.reduce((p, q) => p + q, 0) / core.length;
  // Zeilenabstand: erstes deutliches Maximum der Autokorrelation des Zeilenprofils
  let pitch = null;
  if (runs.length >= 2) {
    const mean = sm.reduce((p, q) => p + q, 0) / m.h;
    const v = sm.map((q) => q - mean);
    const ac = [];
    for (let lag = 0; lag < m.h / 2; lag++) {
      let acc = 0;
      for (let y = 0; y + lag < m.h; y++) acc += v[y] * v[y + lag];
      ac.push(acc);
    }
    const minLag = Math.max(3, Math.round(height * 1.3));
    let bestLag = null; let bestVal = -Infinity;
    for (let lag = minLag; lag < ac.length - 1; lag++) {
      if (ac[lag] > ac[lag - 1] && ac[lag] >= ac[lag + 1] && ac[lag] > bestVal * 1.15) {
        if (bestLag === null || ac[lag] > bestVal) { bestLag = lag; bestVal = ac[lag]; }
        if (ac[lag] > 0.3 * ac[0]) break;
      }
    }
    pitch = bestLag;
  }
  return { height, pitch, lines: runs.length };
}



// ---------- Schriftgröße über die erste Textzeile (Kreuzkorrelation) ----------

/** Lage der ersten Textzeile: Kernband (x-Höhe) und linker Rand der Tinte. */
function firstLine(m) {
  const sm = new Float32Array(m.h);
  for (let y = 0; y < m.h; y++) { let s = 0; for (let x = 0; x < m.w; x++) s += m.out[y * m.w + x]; sm[y] = s; }
  // Rahmenlinien (fast volle Breite) sind keine Schrift
  for (let y = 0; y < m.h; y++) if (sm[y] > m.w * 0.7) { sm[y] = 0; if (y > 0) sm[y - 1] = Math.min(sm[y - 1], m.w * 0.05); if (y < m.h - 1) sm[y + 1] = 0; }
  const max = Math.max(...sm);
  if (!max) return null;
  const thr = max * 0.35;
  let a = -1; let b = -1;
  for (let y = 0; y < m.h; y++) {
    if (sm[y] > thr && a < 0) a = y;
    if (a >= 0 && sm[y] <= thr) {
      if (y - a < 5) { a = -1; continue; } // Splitter (z. B. Kante des Textfelds) überspringen
      b = y; break;
    }
  }
  if (a < 0) return null;
  if (b < 0) b = m.h;
  const core = b - a;
  const top = Math.max(0, Math.round(a - core * 1.0));
  const bottom = Math.min(m.h, Math.round(b + core * 0.6));
  let left = m.w; let right = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < m.w; x++) if (m.out[y * m.w + x]) { if (x < left) left = x; break; }
    for (let x = m.w - 1; x >= 0; x--) if (m.out[y * m.w + x]) { if (x > right) right = x; break; }
  }
  return { base: b, core, top, bottom, left, right };
}

/** Normierte Kreuzkorrelation zweier Zeilenstreifen (Dunkelheit), ausgerichtet an Grundlinie und linkem Rand. */
function stripCorr(A, la, B, lb, width, above, below) {
  let best = -1;
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      let sa = 0; let sb = 0; let saa = 0; let sbb = 0; let sab = 0; let n = 0;
      for (let y = -above; y < below; y++) {
        const ya = la.base + y; const yb = lb.base + y + dy;
        if (ya < 0 || yb < 0 || ya >= A.h || yb >= B.h) continue;
        for (let x = 0; x < width; x++) {
          const xa = la.left + x; const xb = lb.left + x + dx;
          if (xa >= A.w || xb < 0 || xb >= B.w) continue;
          const va = A.dk[ya * A.w + xa]; const vb = B.dk[yb * B.w + xb];
          sa += va; sb += vb; saa += va * va; sbb += vb * vb; sab += va * vb; n++;
        }
      }
      if (n < 10) continue;
      const cov = sab - (sa * sb) / n;
      const den = Math.sqrt((saa - (sa * sa) / n) * (sbb - (sb * sb) / n));
      if (den > 0 && cov / den > best) best = cov / den;
    }
  }
  return best;
}

/**
 * Bestimmt die Schriftgröße, bei der die erste Textzeile (meist identischer Wortlaut in
 * Oracle- und Drucktext) am besten mit dem Scan übereinstimmt, und danach den Zeilenabstand
 * aus dem Zeilenabstand des Scans. draw(ctx, {cap, k}) zeichnet nur Text in Kartenkoordinaten.
 * Ergebnis: {cap, k} oder null.
 */
export function fitTextToScan(scan, box, W, H, caps, ks, draw, key) {
  if (!scan || !caps.length) return null;
  if (key && textCache.has(key)) return textCache.get(key);
  const f = (scan.naturalWidth || scan.width) / W;
  const ref = inkMask(scan, box, f, W, H, 110, true);
  const rl = firstLine(ref);
  const refStats = lineStats(ref);
  // Kandidaten direkt in Ausschnittgröße rendern
  const render = (cand) => renderInk((x) => draw(x, cand), box, f);
  let res = null;
  if (rl) {
    // 1) Größe: erste Zeile – Vergleich über die gemeinsame Länge (die ersten Wörter sind fast immer gleich)
    const above = Math.round(rl.core * 1.1); const below = Math.round(rl.core * 0.6);
    let best = null;
    const tried = new Map();
    const score = (cap) => {
      if (tried.has(cap)) return tried.get(cap);
      const m = render({ cap, k: 1 });
      const ml = m && firstLine(m);
      let r = -1;
      if (ml) {
        const width = Math.round(Math.min(rl.right - rl.left, ml.right - ml.left) * 0.85);
        r = stripCorr(ref, rl, m, ml, width, above, below);
      }
      if (globalThis.__fitDebug) console.log('line', cap, r.toFixed(4));
      tried.set(cap, r);
      if (r > -1 && (!best || r > best.r)) best = { cap, r };
      return r;
    };
    // grob (jeder 3. Kandidat), dann fein um die besten zwei
    for (let i = 0; i < caps.length; i += 3) score(caps[i]);
    const ranked = [...tried.entries()].sort((p, q) => q[1] - p[1]).slice(0, 2).map(([c]) => caps.indexOf(c));
    for (const i of ranked) for (let j = Math.max(0, i - 2); j <= Math.min(caps.length - 1, i + 2); j++) score(caps[j]);
    if (best && best.r > 0.3) {
      res = { cap: best.cap, k: 1, r: best.r };
      // 2) Zeilenabstand passend zum Scan
      if (refStats?.pitch && ks.length > 1) {
        let bk = null;
        for (const k of ks) {
          const st = lineStats(render({ cap: best.cap, k }) || { out: [], w: 0, h: 0 });
          if (!st?.pitch) continue;
          const e = Math.abs(st.pitch - refStats.pitch) + Math.abs(k - 1) * 2;
          if (globalThis.__fitDebug) console.log('pitch', k, st.pitch, refStats.pitch);
          if (!bk || e < bk.e) bk = { k, e };
        }
        if (bk) res.k = bk.k;
      }
    }
  }
  if (key) textCache.set(key, res);
  return res;
}


/** Obere/untere Tintenkante (Kartenkoordinaten) des Textblocks in box – für Bild oder Canvas. */
export function blockExtent(src, box, W, H, f, smooth = false) {
  const m = inkMask(src, box, f, W, H, 110, smooth);
  let top = -1; let bottom = -1;
  for (let y = 0; y < m.h; y++) {
    let s = 0;
    for (let x = 0; x < m.w; x++) s += m.out[y * m.w + x];
    if (s > 2) { if (top < 0) top = y; bottom = y; }
  }
  return top < 0 ? null : { top: box.y + top / f, bottom: box.y + bottom / f };
}

// ---------- Zeilenstruktur des Originals aus dem Scan lesen ----------

/**
 * Erkennt die Textzeilen im Scan: je Zeile Grundlinie, linke und rechte Tintenkante
 * (Kartenkoordinaten). Kernbänder (x-Höhe) werden relativ zur lokalen Zeilendichte
 * erkannt, damit auch kurze Zeilen ("turn.") gefunden werden.
 */
export function scanLines(scan, box, W, H, exclude = null) {
  const f = (scan.naturalWidth || scan.width) / W;
  const m = inkMask(scan, box, f, W, H, 110, true);
  // Bereich ausblenden (P/T-Box ragt unten rechts ins Textfeld)
  if (exclude) {
    const ex = Math.max(0, Math.round((exclude.x - box.x) * f)); const ey = Math.max(0, Math.round((exclude.y - box.y) * f));
    for (let y = ey; y < m.h; y++) for (let x = ex; x < m.w; x++) m.out[y * m.w + x] = 0;
  }
  const r = new Float32Array(m.h);
  for (let y = 0; y < m.h; y++) { let s = 0; for (let x = 0; x < m.w; x++) s += m.out[y * m.w + x]; r[y] = s; }
  // 1) Tintenblöcke, getrennt durch (fast) leere Zeilen
  let runs = [];
  let start = -1;
  for (let y = 0; y <= m.h; y++) {
    const on = y < m.h && r[y] > 2;
    if (on && start < 0) start = y;
    if (!on && start >= 0) { runs.push([start, y]); start = -1; }
  }
  // Rahmenkanten (fast volle Breite) und Splitter verwerfen
  runs = runs.filter(([a, b]) => {
    let mx = 0;
    for (let y = a; y < b; y++) mx = Math.max(mx, r[y]);
    // Rahmenkanten sind dünn UND fast so breit wie das Fenster; dichte Textzeilen (alte Rahmen) bleiben
    const border = mx > m.w * 0.8 || (mx > m.w * 0.6 && b - a < 10 * f * 2);
    return b - a >= 4 * f * 2 && !border;
  });
  if (!runs.length) return null;
  // 2) Blöcke mit mehreren Zeilen (enger Durchschuss) an der dünnsten Stelle teilen
  const heights = runs.map(([a, b]) => b - a).sort((p, q) => p - q);
  const typical = heights[Math.floor(heights.length / 2)];
  // Zeilenabstand (Autokorrelation) begrenzt die Höhe einer einzelnen Zeile
  const st = lineStats(m);
  const maxOne = st?.pitch ? Math.min(typical * 1.6, st.pitch * 1.35) : typical * 1.6;
  const split = (a, b) => {
    if (b - a <= maxOne) return [[a, b]];
    let mi = -1; let mv = Infinity;
    for (let y = Math.round(a + typical * 0.55); y < b - typical * 0.55; y++) if (r[y] < mv) { mv = r[y]; mi = y; }
    if (mi < 0) return [[a, b]];
    return [...split(a, mi), ...split(mi + 1, b)];
  };
  runs = runs.flatMap(([a, b]) => split(a, b));
  // abgetrennte Unterlängen und Splitter (deutlich niedriger als eine Zeile) verwerfen
  runs = runs.filter(([a, b]) => b - a >= typical * 0.45);
  if (globalThis.__fitDebug) console.log('runs', JSON.stringify(runs.map(([a, b]) => [Math.round(box.y + a / f), Math.round(box.y + b / f)])), typical, maxOne);
  // 3) je Zeile: Grundlinie = Ende des dichten Kerns, linke/rechte Kante
  const lines = [];
  for (const [a, b] of runs) {
    let mx = 0;
    for (let y = a; y < b; y++) mx = Math.max(mx, r[y]);
    let base = b;
    for (let y = b - 1; y >= a; y--) if (r[y] >= mx * 0.45) { base = y + 1; break; }
    let left = m.w; let right = -1;
    for (let y = a; y < b; y++) {
      for (let x = 0; x < m.w; x++) if (m.out[y * m.w + x]) { left = Math.min(left, x); break; }
      for (let x = m.w - 1; x >= 0; x--) if (m.out[y * m.w + x]) { right = Math.max(right, x); break; }
    }
    if (right < 0) continue;
    lines.push({ base: box.y + base / f, left: box.x + left / f, right: box.x + (right + 1) / f, top: box.y + a / f });
  }
  return lines.length ? lines : null;
}

// ---------- Innenkanten des Textfelds (für die Übertragung Scan -> eigener Rahmen) ----------

/**
 * Misst die Innenkanten des Textfelds (links, rechts, oben, unten) in Kartenkoordinaten.
 * box = ungefähre Lage des Textfelds. Links/rechts: Spaltenprofil (Median über die mittleren
 * Zeilen), oben/unten: schmaler textfreier Streifen innen am linken Rand.
 */
export function boxEdges(src, W, H, box) {
  const c = mkCanvas(W, H);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(src, 0, 0, W, H);
  const d = x.getImageData(0, 0, W, H).data;
  const lum = (px, py) => { const i = (py * W + px) * 4; return d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114; };
  const med = (a) => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };
  const y0 = Math.round(box.y + box.h * 0.2); const y1 = Math.round(box.y + box.h * 0.75);
  const col = (px) => { const v = []; for (let py = y0; py < y1; py += 3) v.push(lum(px, py)); return med(v); };
  const cx0 = Math.round(box.x + box.w * 0.3); const cx1 = Math.round(box.x + box.w * 0.7);
  const innerVals = []; for (let px = cx0; px < cx1; px += 9) innerVals.push(col(px));
  const inner = med(innerVals);
  let L = null; let R = null;
  for (let px = cx0; px > box.x - 40; px--) if (col(px) < inner * 0.72) { L = px; break; }
  for (let px = cx1; px < box.x + box.w + 40; px++) if (col(px) < inner * 0.72) { R = px; break; }
  if (L == null || R == null) return null;
  const row = (py) => { const v = []; for (let px = L + 4; px < L + 16; px++) v.push(lum(px, py)); return med(v); };
  const rv = []; for (let py = y0; py < y1; py += 5) rv.push(row(py));
  const inner2 = med(rv);
  let T = null; let B = null;
  for (let py = Math.round(box.y + box.h * 0.3); py > box.y - 60; py--) if (row(py) < inner2 * 0.72) { T = py; break; }
  for (let py = Math.round(box.y + box.h * 0.6); py < box.y + box.h + 60; py++) if (row(py) < inner2 * 0.72) { B = py; break; }
  if (T == null || B == null) return null;
  return { L, R, T, B };
}

// ---------- Schriftfarbe aus dem Scan ----------

/**
 * Bestimmt die Farbe einer Textzeile im Scan: draw(ctx) zeichnet die Zeile (weiß) an ihrer
 * Position in Kartenkoordinaten; gemessen wird im Kern der Buchstaben (erodierte Maske), damit
 * Schatten und Hintergrund nicht einfließen. Liefert '#rrggbb' oder null.
 */
export function sampleTextColor(scan, W, H, region, draw, { maxLightBg = 256 } = {}) {
  if (!scan) return null;
  const f = Math.min(1, (scan.naturalWidth || scan.width) / W * 2);
  const w = Math.round(region.w * f); const h = Math.round(region.h * f);
  if (w < 4 || h < 4) return null;
  const c = mkCanvas(w, h);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.setTransform(f, 0, 0, f, -region.x * f, -region.y * f);
  draw(x);
  const m = x.getImageData(0, 0, w, h).data;
  const s = mkCanvas(w, h);
  const sx = s.getContext('2d', { willReadFrequently: true });
  const sw = scan.naturalWidth || scan.width; const sh = scan.naturalHeight || scan.height;
  sx.drawImage(scan, region.x * sw / W, region.y * sh / H, region.w * sw / W, region.h * sh / H, 0, 0, w, h);
  const d = sx.getImageData(0, 0, w, h).data;
  // Hintergrund: Median der ganzen Region; Schrift: Pixel im (leicht erweiterten) Buchstabenbereich,
  // die deutlich heller bzw. dunkler als der Hintergrund sind – die größere Gruppe ist die Schrift
  const L = (i) => d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  const all = []; for (let i = 0; i < w * h; i++) all.push(L(i * 4));
  const bg = [...all].sort((p, q) => p - q)[Math.floor(all.length / 2)];
  const near = (px, py) => {
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const qx = px + dx; const qy = py + dy;
      if (qx >= 0 && qy >= 0 && qx < w && qy < h && m[(qy * w + qx) * 4 + 3] > 128) return true;
    }
    return false;
  };
  const light = [[], [], []]; const dark = [[], [], []];
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      if (!near(px, py)) continue;
      const i = (py * w + px) * 4; const l = L(i);
      const grp = l > bg + Math.min(45, (255 - bg) * 0.5) ? light : l < bg - 45 ? dark : null;
      if (grp) { grp[0].push(d[i]); grp[1].push(d[i + 1]); grp[2].push(d[i + 2]); }
    }
  }
  // Schatten liegen meist außerhalb; helle Schrift mit Schatten: helle Gruppe muss deutlich vertreten sein
  // maxLightBg: helle Schrift nur auf dunklerem Grund (moderne Rahmen – sonst sind die "hellen"
  // Pixel Sprenkel der Leistentextur; alte Rahmen haben dagegen weiße Titel auf hellem Rahmen)
  const pick = light[0].length > dark[0].length * 0.35 && bg < maxLightBg ? light : dark;
  if (pick[0].length < 20) return null;
  const r = pick[0]; const g = pick[1]; const b = pick[2];
  const med = (a) => a.sort((p, q) => p - q)[Math.floor(a.length / 2)];
  const hex = (v) => Math.round(v).toString(16).padStart(2, '0');
  return `#${hex(med(r))}${hex(med(g))}${hex(med(b))}`;
}

export { solve as solveArtAlignment };
/** Ergebnis einer (z. B. im Worker berechneten) Ausrichtung in den Cache übernehmen. */
export function cacheArtAlignment(key, res) { if (key) cache.set(key, res); }
export const hasArtAlignment = (key) => cache.has(key);
