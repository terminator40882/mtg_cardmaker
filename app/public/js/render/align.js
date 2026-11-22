// Richtet das Artwork (Scryfall art_crop) am Original-Scan aus: sucht Skalierung und
// Verschiebung, bei der das Artwork im Bildfenster am besten mit dem Scan übereinstimmt
// (Summe der absoluten Helligkeitsdifferenzen, grob-zu-fein).
const cache = new Map();

function lumaGrid(img, w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
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
    const step = li === 0 ? 1 : 2;
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
          const k = (gw / w);
          let err = 0; let n = 0;
          for (let i = 0; i < pts.length; i += 3) {
            const v = sample(artG, gw, gh, (pts[i] - ox) * k, (pts[i + 1] - oy) * (gh / h));
            if (v < 0) { err += 60; n++; continue; }
            err += Math.abs(v - pts[i + 2]); n++;
          }
          err /= n;
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

/** Dunkle Pixel (Schrift) in einem Kartenausschnitt als 0/1-Raster. */
function inkMask(src, box, f, W, H, threshold = 110) {
  const w = Math.max(1, Math.round(box.w * f)); const h = Math.max(1, Math.round(box.h * f));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.imageSmoothingQuality = 'high';
  const sw = src.width || src.naturalWidth; const sh = src.height || src.naturalHeight;
  x.drawImage(src, box.x * sw / W, box.y * sh / H, box.w * sw / W, box.h * sh / H, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const a = d[i * 4 + 3];
    const l = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114;
    out[i] = a > 128 && l < threshold ? 1 : 0;
  }
  return { out, w, h };
}

/**
 * Vergleicht zwei Tintenraster blockweise (Dichte je b×b-Block) per Korrelation.
 * Liefert 1 - r, damit kleiner = besser. Korrelation statt Differenz, damit weniger
 * Tinte (kleinere Schrift) nicht automatisch „besser“ abschneidet, wenn der Text abweicht.
 */
function densityDiff(a, r, b) {
  // fein in der Höhe (Zeilenlage), grob in der Breite (Zeilenlänge) – robust gegen abweichenden Wortlaut
  const bw = Math.max(b, Math.floor(Math.min(a.w, r.w) / 8));
  const w = Math.floor(Math.min(a.w, r.w) / bw); const h = Math.floor(Math.min(a.h, r.h) / b);
  const n = w * h;
  const va = new Float32Array(n); const vr = new Float32Array(n);
  for (let by = 0; by < h; by++) {
    for (let bx = 0; bx < w; bx++) {
      let sa = 0; let sr = 0;
      for (let y = by * b; y < by * b + b; y++) {
        for (let x = bx * bw; x < bx * bw + bw; x++) { sa += a.out[y * a.w + x]; sr += r.out[y * r.w + x]; }
      }
      va[by * w + bx] = sa; vr[by * w + bx] = sr;
    }
  }
  let ma = 0; let mr = 0;
  for (let i = 0; i < n; i++) { ma += va[i]; mr += vr[i]; }
  ma /= n; mr /= n;
  let cov = 0; let sa2 = 0; let sr2 = 0;
  for (let i = 0; i < n; i++) {
    const da = va[i] - ma; const dr = vr[i] - mr;
    cov += da * dr; sa2 += da * da; sr2 += dr * dr;
  }
  if (!sa2 || !sr2) return 1;
  return 1 - cov / Math.sqrt(sa2 * sr2);
}

/**
 * Wählt aus caps die Versalhöhe, deren Satz (draw(ctx, cap) zeichnet nur den Text in
 * Kartenkoordinaten) am besten mit der Schrift im Scan übereinstimmt.
 */
export function fitCapToScan(scan, box, W, H, caps, draw, key) {
  if (!scan || !caps.length) return null;
  if (key && textCache.has(key)) return textCache.get(key);
  const f = 0.5;
  const ref = inkMask(scan, box, f, W, H);
  const c = document.createElement('canvas');
  c.width = Math.round(W * f); c.height = Math.round(H * f);
  const x = c.getContext('2d', { willReadFrequently: true });
  let best = null;
  for (const cap of caps) {
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.clearRect(0, 0, c.width, c.height);
    x.setTransform(f, 0, 0, f, 0, 0);
    if (!draw(x, cap)) continue;  // cap kann auch ein Objekt {cap, k} sein
    const m = inkMask(c, box, f, W, H);
    const err = densityDiff(m, ref, 3);
    if (!best || err < best.err) best = { cap, err };
    if (globalThis.__fitDebug) console.log('fit', JSON.stringify(cap), err);
  }
  const res = best ? best.cap : null;
  if (key) textCache.set(key, res);
  return res;
}
