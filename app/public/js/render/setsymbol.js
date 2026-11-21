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
export function drawSetSymbol(ctx, img, rarity, { right, cy, h, maxW, outline = 4, plain = false }) {
  if (!img) return 0;
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

  const style = plain ? { fill: ['#111', '#111', '#111'], outline: null } : (RARITY[rarity] || RARITY.common);

  const out = document.createElement('canvas');
  out.width = cw; out.height = ch;
  const o = out.getContext('2d');
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
