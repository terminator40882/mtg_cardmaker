// Set-Symbol mit Seltenheitsfarbe (Verlauf) und Kontur – wie auf echten Karten.

const RARITY = {
  common: { fill: ['#1b1b1b', '#1b1b1b', '#1b1b1b'], outline: '#ffffff' },
  uncommon: { fill: ['#5e6a75', '#e6eef4', '#5e6a75'], outline: '#000000' },
  rare: { fill: ['#8a6a24', '#f5dc95', '#8a6a24'], outline: '#000000' },
  mythic: { fill: ['#b52b12', '#f9a640', '#b52b12'], outline: '#000000' },
  special: { fill: ['#4b2766', '#b896d6', '#4b2766'], outline: '#000000' },
  bonus: { fill: ['#4b2766', '#b896d6', '#4b2766'], outline: '#000000' },
};

/**
 * Zeichnet das Symbol rechtsbündig bei (right, cy).
 * opts.plain: einfarbig schwarz ohne Kontur (Karten vor 1998).
 */
export function drawSetSymbol(ctx, img, rarity, { right, cy, h, maxW, outline = 4, plain = false, scan = null, W = 1500, H = 2100, fixedSize = false, official = null, requireInScan = false }) {
  // ohne Scryfall-Form: offizielles Symbol direkt an der Layout-Position
  if (!img && official && !plain) return drawOfficial(ctx, trimmed(official), right, cy, h, outline, scan, W, H, false);
  if (!img) return 0;
  img = trimmed(img);
  const ratio = (img.naturalWidth || img.width) / (img.naturalHeight || img.height) || 1;
  let dh = h;
  let dw = h * ratio;
  if (dw > maxW) { dw = maxW; dh = maxW / ratio; }
  // Lage und Größe am Scan ausrichten (Symbolposition variiert je Set/Druck)
  // breite Abzeichen-Symbole (M19, M21 …) sind durch die Maximalbreite begrenzt – Größe ist dort vermessen
  const widthLimited = dw >= maxW - 0.5;
  let trusted = false; // Lage per Formvergleich sicher bestimmt -> Farbangleich ohne weitere Prüfung
  if (scan && !(fixedSize && widthLimited)) {
    // fixedSize (aktuelle Rahmen): Lage ist vermessen – nur Größe (und ±4 px) aus dem Scan
    const fit = locateSymbol(scan, img, { right, cy, dw, dh, outline, fixedSize }, W, H);
    if (fit) { right = fit.right; cy = fit.cy; dw *= fit.s; dh *= fit.s; trusted = fit.iou >= 0.78; }
    // alte Rahmen: viele Drucke haben gar kein Set-Symbol (Alpha–5th Edition, CE/IE, Summer Magic,
    // Anthologies, Pro-Tour-Sammlerkarten …) -> nur zeichnen, wenn dort im Scan etwas gedruckt ist
    else if (requireInScan && !inkPresent(scan, { x: right - dw * 1.3, y: cy - dh * 0.7, w: dw * 1.3 + 20, h: dh * 1.4 }, W, H)) return 0;
  }
  // Offizielles Set-Symbol aus Card Conjurer (setSymbols/official, Seltenheitsfarbe und Kontur
  // sind darin enthalten): Lage und Größe wie oben bestimmt, Grafik unverändert zeichnen.
  // Alte Karten (plain, vor 1998) waren einfarbig ohne Kontur gedruckt -> weiter per Code.
  if (official && !plain) return drawOfficial(ctx, trimmed(official), right, cy, dh, outline, scan, W, H, trusted);
  const res = 3; // Auflösungsfaktor für die Zwischenebenen
  const pad = outline * 2;
  const cw = Math.ceil((dw + pad * 2) * res);
  const ch = Math.ceil((dh + pad * 2) * res);

  const mask = document.createElement('canvas');
  mask.width = cw; mask.height = ch;
  const m = mask.getContext('2d');
  m.drawImage(img, pad * res, pad * res, dw * res, dh * res);

  let style = plain ? { fill: ['#111', '#111', '#111'], outline: null } : (RARITY[rarity] || RARITY.common);
  // Farben dieses Drucks aus dem Scan übernehmen (Seltenheitsfarben variieren je Set,
  // z. B. Dominaria-Commons weiß mit schwarzer Kontur, Kaldheim-Commons schwarz mit weißer)
  // Nur die Ausprägung der Commons schwankt (hell mit dunkler Kontur vs. dunkel mit heller Kontur);
  // die anderen Seltenheiten behalten ihren Verlauf.
  if (scan && (plain || rarity === 'common' || !RARITY[rarity])) {
    const sampled = sampleSymbolColors(mask, res, scan, { x: right - dw - pad, y: cy - dh / 2 - pad }, outline, W, H);
    if (globalThis.__fitDebug) console.log('symsample', rarity, plain, right, cy, dw, dh, JSON.stringify(sampled));
    if (sampled && lum(sampled.fill[1]) > 150) style = { fill: ['#f4f4f2', '#f4f4f2', '#f4f4f2'], outline: '#141414' };
  }

  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  const o = out.getContext('2d');
  // Eingeschlossene Flächen der Symbolform (z. B. das "M" von M19, Augen) sind auf gedruckten
  // Karten mit der Konturfarbe gefüllt – nicht durchsichtig
  const holes = enclosedHoles(mask);
  if (holes) {
    o.drawImage(holes, 0, 0);
    o.globalCompositeOperation = 'source-in';
    // ohne Kontur (alte einfarbige Symbole): Innenflächen hell, sonst in Konturfarbe
    o.fillStyle = style.outline || '#ecebe6';
    o.fillRect(0, 0, cw, ch);
    o.globalCompositeOperation = 'source-over';
  }
  if (style.outline) {
    const r = outline * res;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 24) {
      o.drawImage(mask, Math.cos(a) * r, Math.sin(a) * r);
    }
    o.globalCompositeOperation = 'source-in';
    o.fillStyle = style.outline;
    o.fillRect(0, 0, cw, ch);
    o.globalCompositeOperation = 'source-over';
  }
  const fill = document.createElement('canvas');
  fill.width = cw; fill.height = ch;
  const f = fill.getContext('2d');
  f.drawImage(mask, 0, 0);
  f.globalCompositeOperation = 'source-in';
  const g = f.createLinearGradient(0, ch, cw, 0);
  g.addColorStop(0, style.fill[0]);
  g.addColorStop(0.5, style.fill[1]);
  g.addColorStop(1, style.fill[2]);
  f.fillStyle = g;
  f.fillRect(0, 0, cw, ch);
  o.drawImage(fill, 0, 0);

  const rect = { x: right - dw - pad, y: cy - dh / 2 - pad, w: cw / res, h: ch / res };
  ctx.drawImage(scanColorize(out, rect, scan, W, H, trusted), rect.x, rect.y, rect.w, rect.h);
  return dw;
}


/** Zeichnet ein offizielles Symbol (inkl. Kontur) rechtsbündig; dh = Höhe der Form ohne Kontur. */
function drawOfficial(ctx, img, right, cy, dh, outline, scan = null, W = 1500, H = 2100, trusted = false) {
  const ratio = (img.naturalWidth || img.width) / (img.naturalHeight || img.height) || 1;
  const th = dh + 2 * outline; const tw = th * ratio;
  const rect = { x: right + outline - tw, y: cy - th / 2, w: tw, h: th };
  // Zwischenebene in 3-facher Auflösung (Farbangleich am Scan, s. scanColorize)
  const res = 3;
  const c = document.createElement('canvas');
  c.width = Math.ceil(tw * res); c.height = Math.ceil(th * res);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = true;
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, c.width, c.height);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(scanColorize(c, rect, scan, W, H, trusted), rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
  return Math.max(0, tw - 2 * outline);
}

/**
 * Gleicht die Farben eines fertigen Set-Symbols (Canvas src, liegt auf der Karte bei rect) an den
 * Scan an: Druckfarben weichen je Set von den Vorlagen ab (Uncommon im Druck oft silberblau statt
 * grau, Rare blasser/satter, alte Symbole hell statt schwarz). Getrennt für dunkle (meist Kontur)
 * und helle Anteile (Füllung) werden Mittelwert und Streuung je Farbkanal übernommen – gemessen nur
 * im Inneren der Symbolform. Passt die Form nicht zum Scan (Fehlausrichtung, anderes Symbol), bleibt
 * das Symbol unverändert.
 */
function scanColorize(src, rect, scan, W, H, trusted = false) {
  if (!scan) return src;
  const sw = scan.naturalWidth || scan.width; const sh = scan.naturalHeight || scan.height;
  const kx = sw / W; const ky = sh / H;
  const w = Math.max(4, Math.round(rect.w * kx)); const h = Math.max(4, Math.round(rect.h * ky));
  const ca = document.createElement('canvas'); ca.width = w; ca.height = h;
  const xa = ca.getContext('2d', { willReadFrequently: true });
  xa.drawImage(src, 0, 0, w, h);
  const A = xa.getImageData(0, 0, w, h).data;
  const cb = document.createElement('canvas'); cb.width = w; cb.height = h;
  const xb = cb.getContext('2d', { willReadFrequently: true });
  xb.drawImage(scan, rect.x * kx, rect.y * ky, rect.w * kx, rect.h * ky, 0, 0, w, h);
  const B = xb.getImageData(0, 0, w, h).data;
  const L = (d, i) => d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  // Inneres der Form: deckend, ebenso die 4 Nachbarn (Kanten sind im Scan unscharf / leicht versetzt)
  const op = (x, y) => x >= 0 && y >= 0 && x < w && y < h && A[(y * w + x) * 4 + 3] > 230;
  const idx = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (op(x, y) && op(x - 1, y) && op(x + 1, y) && op(x, y - 1) && op(x, y + 1)) idx.push((y * w + x) * 4);
  }
  if (idx.length < 30) return src;
  // Formprüfung: Helligkeitsverlauf von Vorlage und Scan muss zusammenpassen (Betrag – helle und
  // dunkle Commons sind im Druck teils vertauscht)
  let ma = 0; let mb = 0;
  for (const i of idx) { ma += L(A, i); mb += L(B, i); }
  ma /= idx.length; mb /= idx.length;
  let sab = 0; let saa = 0; let sbb = 0;
  for (const i of idx) { const a = L(A, i) - ma; const b = L(B, i) - mb; sab += a * b; saa += a * a; sbb += b * b; }
  const sa = Math.sqrt(saa / idx.length); const sb = Math.sqrt(sbb / idx.length);
  // (entfällt, wenn die Lage per Formvergleich sicher ist – Farbverläufe von Vorlage und Druck
  // verlaufen teils verschieden, dann ist die Helligkeitskorrelation trotz richtiger Lage gering)
  if (!trusted && (sa > 8 ? Math.abs(sab / Math.sqrt(saa * sbb)) < 0.35 : sb > 30)) {
    if (globalThis.__fitDebug) console.log('symcolor skip', sa.toFixed(1), sb.toFixed(1), (sab / Math.sqrt(saa * sbb || 1)).toFixed(2));
    return src;
  }
  // Gruppen der Vorlage: dunkel/hell. Angeglichen wird nur die flächenmäßig größere (Füllung) –
  // die schmale Kontur ist im Scan zu unscharf und mit dem Hintergrund vermischt.
  const SPLIT = 110;
  const groups = [false, true].map((light) => idx.filter((i) => (L(A, i) >= SPLIT) === light));
  const mainIdx = groups[1].length >= groups[0].length ? 1 : 0;
  const sel = groups[mainIdx];
  if (sel.length < 30) return src;
  const stats = (d, list, k) => {
    let m = 0; let q = 0;
    for (const i of list) { m += d[i + k]; q += d[i + k] * d[i + k]; }
    m /= list.length;
    return [m, Math.sqrt(Math.max(0, q / list.length - m * m))];
  };
  const lumMean = (d, list) => list.reduce((a, i) => a + L(d, i), 0) / Math.max(1, list.length);
  // Hintergrund des Scans rund um das Symbol (außerhalb der Form)
  const bgPx = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (A[(y * w + x) * 4 + 3] < 10) bgPx.push((y * w + x) * 4);
  const med = (list, k) => { const v = list.map((i) => B[i + k]).sort((p, q) => p - q); return v[v.length >> 1]; };
  const bg = bgPx.length >= 12 ? [0, 1, 2].map((k) => med(bgPx, k)) : null;
  const tgt = [0, 1, 2].map((k) => stats(B, sel, k)[0]);
  const target = lumMean(B, sel);
  const other = groups[1 - mainIdx].length >= 12 ? lumMean(A, groups[1 - mainIdx]) : null;
  // Plausibilität: gemessene Füllung darf nicht wie der Hintergrund aussehen (Farbabstand – dann
  // wurde daneben gemessen), und Füllung und Kontur müssen unterscheidbar bleiben
  const bgDist = bg ? Math.hypot(tgt[0] - bg[0], tgt[1] - bg[1], tgt[2] - bg[2]) : Infinity;
  // Vorlage gegenüber dem Druck invertiert (z. B. 7th Edition: Vorlage dunkel mit heller Kontur, Druck
  // silbern mit dunkler Kontur): bei sicherer Lage auch die Kontur angleichen
  const otherSel = groups[1 - mainIdx];
  const otherTarget = otherSel.length >= 12 ? lumMean(B, otherSel) : null;
  const both = other != null && Math.abs(target - other) < 45 && trusted && otherTarget != null && Math.abs(target - otherTarget) >= 45;
  if (bgDist < 60 || (other != null && Math.abs(target - other) < 45 && !both)) {
    if (globalThis.__fitDebug) console.log('symcolor implausible', tgt.map(Math.round), bg, other && Math.round(other));
    return src;
  }
  const tfFor = (list) => [0, 1, 2].map((k) => {
    const [m1, s1] = stats(A, list, k); const [m2, s2] = stats(B, list, k);
    return { m1, m2, g: s1 > 4 ? Math.max(0.7, Math.min(1.4, s2 / s1)) : 1 };
  });
  const tfMain = tfFor(sel);
  const tfOther = both ? tfFor(otherSel) : null;
  const tf = mainIdx === 1 ? [tfOther, tfMain] : [tfMain, tfOther];
  if (globalThis.__fitDebug) console.log('symcolor', mainIdx ? 'hell' : 'dunkel', JSON.stringify(tfMain.map((c) => [Math.round(c.m1), Math.round(c.m2), +c.g.toFixed(2)])), 'bg', bg);
  const out = document.createElement('canvas'); out.width = src.width; out.height = src.height;
  const xo = out.getContext('2d');
  xo.drawImage(src, 0, 0);
  const img = xo.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  const ap = (t, k, v) => (t ? t[k].m2 + (v - t[k].m1) * t[k].g : v);
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    // weicher Übergang zwischen den Gruppen (Kantenglättung der Vorlage)
    const t = Math.max(0, Math.min(1, (L(d, i) - (SPLIT - 25)) / 50));
    for (let k = 0; k < 3; k++) {
      const v = d[i + k];
      d[i + k] = Math.max(0, Math.min(255, ap(tf[0], k, v) * (1 - t) + ap(tf[1], k, v) * t));
    }
  }
  xo.putImageData(img, 0, 0);
  return out;
}

/** Ist im Ausschnitt des Scans etwas gedruckt? (Pixel mit deutlichem Kontrast zum Median) */
function inkPresent(scan, r, W, H) {
  const sw = scan.naturalWidth || scan.width; const sh = scan.naturalHeight || scan.height;
  const w = Math.max(4, Math.round(r.w * sw / W)); const h = Math.max(4, Math.round(r.h * sh / H));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(scan, r.x * sw / W, r.y * sh / H, r.w * sw / W, r.h * sh / H, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const l = []; for (let i = 0; i < d.length; i += 4) l.push(d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114);
  const med = [...l].sort((a, b) => a - b)[l.length >> 1];
  const n = l.filter((v) => Math.abs(v - med) > 80).length;
  if (globalThis.__fitDebug) console.log('symink', (n / l.length).toFixed(3));
  return n / l.length > 0.06;
}

const lum = (h) => { const v = parseInt(h.slice(1), 16); return ((v >> 16) & 255) * 0.299 + ((v >> 8) & 255) * 0.587 + (v & 255) * 0.114; };
const hex = (c) => `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/**
 * Misst Füll- und Konturfarbe des Set-Symbols im Scan: Pixel tief im Inneren der Symbolform
 * (drei Abschnitte entlang der Verlaufsdiagonale) und im Ring direkt außerhalb.
 * mask = Canvas der Symbolform (Auflösung res), pos = linke obere Ecke in Kartenkoordinaten.
 */
function sampleSymbolColors(mask, res, scan, pos, outline, W, H) {
  const mw = mask.width; const mh = mask.height;
  const a = mask.getContext('2d').getImageData(0, 0, mw, mh).data;
  const alpha = (x, y) => (x < 0 || y < 0 || x >= mw || y >= mh ? 0 : a[(y * mw + x) * 4 + 3]);
  // Scan-Ausschnitt in Kartenauflösung
  const sw = scan.naturalWidth || scan.width; const sh = scan.naturalHeight || scan.height;
  const cw = Math.ceil(mw / res); const ch = Math.ceil(mh / res);
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const cx = c.getContext('2d', { willReadFrequently: true });
  cx.drawImage(scan, pos.x * sw / W, pos.y * sh / H, cw * sw / W, ch * sh / H, 0, 0, cw, ch);
  const d = cx.getImageData(0, 0, cw, ch).data;
  const er = Math.round(3 * res); // Abstand zur Kante: Scan-Unschärfe und Versatz
  const rr = Math.round((outline + 1) * res);
  const fills = [[], [], []]; const ring = [];
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const mx = Math.round(x * res); const my = Math.round(y * res);
      const inside = alpha(mx, my) > 200 && alpha(mx - er, my) > 200 && alpha(mx + er, my) > 200 && alpha(mx, my - er) > 200 && alpha(mx, my + er) > 200;
      const i = (y * cw + x) * 4;
      const col = [d[i], d[i + 1], d[i + 2]];
      if (inside) {
        const t = (x / cw + (1 - y / ch)) / 2; // Diagonale unten links -> oben rechts
        fills[Math.min(2, Math.floor(t * 3))].push(col);
      } else if (alpha(mx, my) < 20) {
        // Ring: innerhalb des Konturabstands zur Form, aber nicht direkt an der Kante
        let near = false;
        for (const [dx, dy] of [[rr, 0], [-rr, 0], [0, rr], [0, -rr]]) if (alpha(mx + dx, my + dy) > 200) near = true;
        const close = alpha(mx + res, my) > 20 || alpha(mx - res, my) > 20 || alpha(mx, my + res) > 20 || alpha(mx, my - res) > 20;
        if (near && !close) ring.push(col);
      }
    }
  }
  const med = (arr) => [0, 1, 2].map((k) => { const v = arr.map((p) => p[k]).sort((p, q) => p - q); return v[Math.floor(v.length / 2)]; });
  const total = fills.reduce((s, f) => s + f.length, 0);
  if (total < 12 || ring.length < 12) return null;
  const all = fills.flat();
  const stops = fills.map((f) => (f.length >= 4 ? med(f) : med(all)));
  return { fill: stops.map(hex), outline: hex(med(ring)) };
}


/** Canvas mit den von der Form eingeschlossenen Löchern (nicht von außen erreichbar) oder null. */
function enclosedHoles(mask) {
  const w = mask.width; const h = mask.height;
  const d = mask.getContext('2d').getImageData(0, 0, w, h).data;
  const free = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) free[i] = d[i * 4 + 3] < 128 ? 1 : 0;
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => { if (free[i] && !seen[i]) { seen[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop(); const x = i % w; const y = (i - x) / w;
    if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w);
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x2 = c.getContext('2d');
  const img = x2.createImageData(w, h);
  let n = 0;
  for (let i = 0; i < w * h; i++) {
    if (free[i] && !seen[i]) { img.data[i * 4 + 3] = 255; n++; }
  }
  if (!n) return null;
  x2.putImageData(img, 0, 0);
  return c;
}


const trimCache = new WeakMap();
/** Schneidet leeren Rand der SVG-Zeichenfläche ab (einige Scryfall-Symbole haben viel Polster). */
function trimmed(img) {
  if (trimCache.has(img)) return trimCache.get(img);
  const iw = img.naturalWidth || img.width; const ih = img.naturalHeight || img.height;
  const k = 600 / Math.max(iw, ih);
  const w = Math.max(1, Math.round(iw * k)); const h = Math.max(1, Math.round(ih * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    if (d[(y * w + xx) * 4 + 3] > 20) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  let out = img;
  if (x1 >= 0 && (x0 > 2 || y0 > 2 || x1 < w - 3 || y1 < h - 3)) {
    const t = document.createElement('canvas');
    t.width = x1 - x0 + 1; t.height = y1 - y0 + 1;
    t.getContext('2d').drawImage(c, x0, y0, t.width, t.height, 0, 0, t.width, t.height);
    out = t;
  }
  trimCache.set(img, out);
  return out;
}


/**
 * Sucht das Set-Symbol im Scan: rechts in der Typzeile der zusammenhängende Block mit deutlichem
 * Kontrast zum Leistenhintergrund (Begrenzungsrahmen). Liefert {right, cy, s} oder null.
 */
function locateSymbol(scan, img, { right, cy, dw, dh, outline = 3, fixedSize = false }, W, H) {
  const f = 1;
  const rx = right - Math.max(dw * 1.6, 120) - 40; const rw = right + 55 - rx;
  const ry = cy - dh * 0.8 - 14; const rh = dh * 1.6 + 28;
  const gw = Math.round(rw * f); const gh = Math.round(rh * f);
  const c = document.createElement('canvas');
  c.width = gw; c.height = gh;
  const x = c.getContext('2d', { willReadFrequently: true });
  const sw = scan.naturalWidth || scan.width; const sh = scan.naturalHeight || scan.height;
  x.drawImage(scan, rx * sw / W, ry * sh / H, rw * sw / W, rh * sh / H, 0, 0, gw, gh);
  const d = x.getImageData(0, 0, gw, gh).data;
  const px = (i) => [d[i * 4], d[i * 4 + 1], d[i * 4 + 2]];
  // Hintergrund: Median der linken Hälfte der mittleren Zeilen
  const samp = [];
  for (let yy = Math.round(gh * 0.35); yy < gh * 0.65; yy++) for (let xx = 0; xx < gw * 0.3; xx++) samp.push(px(yy * gw + xx));
  const med = (k) => samp.map((p) => p[k]).sort((p, q) => p - q)[Math.floor(samp.length / 2)];
  const bgc = [med(0), med(1), med(2)];
  const on = new Uint8Array(gw * gh);
  for (let i = 0; i < gw * gh; i++) { const p = px(i); on[i] = Math.abs(p[0] - bgc[0]) + Math.abs(p[1] - bgc[1]) + Math.abs(p[2] - bgc[2]) > 110 ? 1 : 0; }
  // Zeilen, die fast vollständig "an" sind (Leistenkanten), ausblenden
  for (let yy = 0; yy < gh; yy++) {
    let n = 0; for (let xx = 0; xx < gw; xx++) n += on[yy * gw + xx];
    if (n > gw * 0.6) for (let xx = 0; xx < gw; xx++) on[yy * gw + xx] = 0;
  }
  // Spalten, die fast vollständig "an" sind (senkrechte Rahmenkanten), ausblenden
  for (let xx = 0; xx < gw; xx++) {
    let n = 0; for (let yy = 0; yy < gh; yy++) n += on[yy * gw + xx];
    if (n > gh * 0.7) for (let yy = 0; yy < gh; yy++) on[yy * gw + xx] = 0;
  }
  // Formvergleich (Überdeckung/IoU) der Symbolsilhouette über Skalierung und Verschiebung.
  // Summenflächentabelle für die "an"-Pixel im Fenster, Silhouette als Punktliste; grob (Schritt 2),
  // dann fein um den besten Treffer.
  const sat = new Uint32Array((gw + 1) * (gh + 1));
  for (let yy = 0; yy < gh; yy++) {
    let rowSum = 0;
    for (let xx = 0; xx < gw; xx++) { rowSum += on[yy * gw + xx]; sat[(yy + 1) * (gw + 1) + xx + 1] = sat[yy * (gw + 1) + xx + 1] + rowSum; }
  }
  const winSum = (ox, oy, w2, h2) => sat[(oy + h2) * (gw + 1) + ox + w2] - sat[oy * (gw + 1) + ox + w2] - sat[(oy + h2) * (gw + 1) + ox] + sat[oy * (gw + 1) + ox];
  const ol = Math.max(1, Math.round(outline * f));
  const shapes = [];
  for (let sc = fixedSize ? 0.85 : 0.75; sc <= (fixedSize ? 1.12 : 1.55); sc += fixedSize ? 0.025 : 0.05) {
    // Silhouette inkl. Kontur (wie gedruckt)
    const mw = Math.max(4, Math.round(dw * sc * f)) + 4 + 2 * ol; const mh = Math.max(4, Math.round(dh * sc * f)) + 4 + 2 * ol;
    if (mw > gw || mh > gh) continue;
    const mc = document.createElement('canvas');
    mc.width = mw; mc.height = mh;
    const mx = mc.getContext('2d', { willReadFrequently: true });
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) mx.drawImage(img, 2 + ol + Math.cos(a) * ol, 2 + ol + Math.sin(a) * ol, mw - 4 - 2 * ol, mh - 4 - 2 * ol);
    const md = mx.getImageData(0, 0, mw, mh).data;
    const pts = []; const ptsCoarse = [];
    for (let yy = 0; yy < mh; yy++) for (let xx = 0; xx < mw; xx++) {
      if (md[(yy * mw + xx) * 4 + 3] > 100) { pts.push(yy * gw + xx); if (!(yy & 1) && !(xx & 1)) ptsCoarse.push(yy * gw + xx); }
    }
    if (!pts.length) continue;
    shapes.push({ sc, mw, mh, pts, ptsCoarse, exOx: (right - rx) * f + ol + 2 - mw, exOy: (cy - ry) * f - mh / 2 });
  }
  const iouAt = (sh, ox, oy, coarse) => {
    const P = coarse ? sh.ptsCoarse : sh.pts; const base0 = oy * gw + ox;
    let inter = 0;
    for (let i = 0; i < P.length; i++) inter += on[base0 + P[i]];
    const scale = sh.pts.length / P.length;
    inter *= scale;
    const uni = sh.pts.length + winSum(ox, oy, sh.mw, sh.mh) - inter;
    return inter / Math.max(1, uni);
  };
  let best = { iou: -1 }; let base = 0;
  for (const sh of shapes) {
    for (let oy = 0; oy + sh.mh <= gh; oy += 2) {
      if (fixedSize && Math.abs(oy - sh.exOy) > 5) continue;
      for (let ox = 0; ox + sh.mw <= gw; ox += 2) {
        if (fixedSize && Math.abs(ox - sh.exOx) > 5) continue;
        const v = iouAt(sh, ox, oy, true);
        if (v > best.iou) best = { iou: v, sh, ox, oy };
      }
    }
    // Wert an der erwarteten Lage (Skalierung 1) als Vergleich
    if (Math.abs(sh.sc - 1) < 0.01) {
      const ox = Math.round(sh.exOx); const oy = Math.round(sh.exOy);
      if (ox >= 0 && oy >= 0 && ox + sh.mw <= gw && oy + sh.mh <= gh) base = iouAt(sh, ox, oy, false);
    }
  }
  if (best.sh) {
    // Feinsuche: Nachbarskalierungen und ±2 px mit allen Punkten
    const i0 = shapes.indexOf(best.sh); const g = best;
    best = { iou: -1 };
    for (let si = Math.max(0, i0 - 1); si <= Math.min(shapes.length - 1, i0 + 1); si++) {
      const sh = shapes[si];
      const cx = g.ox + (g.sh.mw - sh.mw) / 2; const cy0 = g.oy + (g.sh.mh - sh.mh) / 2;
      for (let oy = Math.round(cy0) - 2; oy <= Math.round(cy0) + 2; oy++) {
        for (let ox = Math.round(cx) - 2; ox <= Math.round(cx) + 2; ox++) {
          if (ox < 0 || oy < 0 || ox + sh.mw > gw || oy + sh.mh > gh) continue;
          if (fixedSize && (Math.abs(ox - sh.exOx) > 4 || Math.abs(oy - sh.exOy) > 4)) continue;
          const v = iouAt(sh, ox, oy, false);
          if (v > best.iou) best = { iou: v, sh, ox, oy };
        }
      }
    }
  }
  if (best.sh) Object.assign(best, { sc: best.sh.sc, mw: best.sh.mw, mh: best.sh.mh });
  if (globalThis.__fitDebug) console.log('symloc', best.iou, best.sc, best.ox, best.oy, 'base', base.toFixed(3));
  if (!best.sh || best.iou < 0.3 || best.iou < base + (fixedSize ? 0.02 : 0.04)) return null;
  const s = best.sc;
  const right2 = rx + (best.ox + best.mw - 2 - Math.max(1, Math.round(outline * f))) / f; const cy2 = ry + (best.oy + best.mh / 2) / f;
  if (Math.abs(right2 - right) > 60 || Math.abs(cy2 - cy) > 40) return null;
  return { right: right2, cy: cy2, s, iou: best.iou };
}
