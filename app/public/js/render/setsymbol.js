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
export function drawSetSymbol(ctx, img, rarity, { right, cy, h, maxW, outline = 4, plain = false, scan = null, W = 1500, H = 2100 }) {
  if (!img) return 0;
  img = trimmed(img);
  const ratio = (img.naturalWidth || img.width) / (img.naturalHeight || img.height) || 1;
  let dh = h;
  let dw = h * ratio;
  if (dw > maxW) { dw = maxW; dh = maxW / ratio; }
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

  ctx.drawImage(out, right - dw - pad, cy - dh / 2 - pad, cw / res, ch / res);
  return dw;
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
