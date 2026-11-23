// Planeswalker-Rahmen (ab 2015): Fähigkeiten in Zeilen mit Loyalitäts-Symbolen,
// halbtransparentes Textfeld über dem hohen Artwork, Loyalitäts-Schild.
import { layoutAll, drawText, drawFittedLine, sizeForCap, METRICS } from './textlayout.js';
import { roundRect } from './frames.js';
import { hexToRgb } from './textures.js';

const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`;

/** Teilt das Textfeld in Zeilen (eine pro Fähigkeit) und sucht die passende Größe. */
export function layoutPlaneswalker(ctx, paras, L, opts = {}) {
  const box = L.text;
  // Statische Fähigkeiten (ohne Loyalitätskosten) beginnen weiter links und nutzen die volle Breite
  // (Card Conjurer: x − 0,044, Breite + 0,044; an Scans bestätigt)
  const shift = Math.round(0.044 * L.W);
  const boxFor = (p) => (p.loyalty ? box : { ...box, x: box.x - shift, w: box.w + shift });
  const rules = paras.filter((p) => p.kind === 'rules');
  if (!rules.length) return null;
  const max = L.rules.maxCap;
  const step = L.rules.step || max / 18;
  let best = null;
  for (let c = opts.fixedCap || max; c >= L.rules.minCap; c -= step) {
    const items = rules.map((p) => layoutAll(ctx, [p], c, boxFor(p).w, METRICS));
    const heights = items.map((it) => it.height);
    const total = heights.reduce((a, b) => a + b, 0);
    const minPad = c * 0.85;
    if (!items.some((it) => it.overflow) && total + minPad * items.length <= box.h) {
      best = { c, items, heights, total };
      break;
    }
    if (opts.fixedCap) { best = { c, items, heights, total }; break; }
  }
  if (!best) {
    const c = L.rules.minCap;
    const items = rules.map((p) => layoutAll(ctx, [p], c, boxFor(p).w, METRICS));
    best = { c, items, heights: items.map((i) => i.height), total: items.reduce((a, i) => a + i.height, 0) };
  }
  // Freiraum gleichmäßig verteilen, Text in jeder Zeile vertikal mittig
  const pad = (L.pwBox.h - best.total) / best.items.length;
  let y = L.pwBox.y;
  const rows = best.items.map((it, i) => {
    const top = y;
    const textTop = y + pad / 2;
    y += best.heights[i] + pad;
    for (const b of it.blocks) for (const l of b.lines) l.dx = 0;
    return { top, bottom: y, para: rules[i], lay: { ...it, box: boxFor(rules[i]), offset: textTop - it.visTop } };
  });
  return { cap: best.c, rows };
}

/** Fähigkeitszeilen wie in Card Conjurer (versionPlaneswalker.js): hell/dunkel im Wechsel, maskiert */
function drawCcRows(ctx, pw, L) {
  const W = L.W; const H = L.H;
  const c = document.createElement('canvas');
  const sc = ctx.getTransform().a || 1;
  c.width = Math.round(W * sc); c.height = Math.round(H * sc);
  const x = c.getContext('2d');
  x.scale(sc, sc);
  const bx = 0.1167 * W; const bw = 0.8094 * W; const tr = 0.0048 * H;
  pw.rows.forEach((r, i) => {
    let y = r.top; let h = r.bottom - r.top;
    if (i === 0) { y -= 0.1 * H; h += 0.1 * H; }
    if (i === pw.rows.length - 1) h += 0.5 * H;
    x.globalAlpha = i % 2 === 0 ? 0.608 : 0.706;
    x.fillStyle = i % 2 === 0 ? '#ffffff' : '#a4a4a4';
    x.fillRect(bx, y + tr, bw, h - 2 * tr);
    x.globalAlpha = 1;
    if (i < pw.rows.length - 1) x.drawImage(i % 2 === 0 ? ccIcons.lineOdd : ccIcons.lineEven, bx, y + h - tr, bw, 2 * tr);
  });
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(ccIcons.textMask, 0, 0, W, H);
  // in Card Conjurer liegen die Zeilen unter dem Rahmen – das Loyalitäts-Schild bleibt frei
  if (ccIcons.loyaltyMask) {
    x.globalCompositeOperation = 'destination-out';
    x.drawImage(ccIcons.loyaltyMask, 0, 0, W, H);
  }
  ctx.drawImage(c, 0, 0, W, H);
}

export function drawPlaneswalkerText(ctx, pw, L, pal, symbols) {
  if (ccIcons) {
    drawCcRows(ctx, pw, L);
    for (const r of pw.rows) {
      drawText(ctx, r.lay, symbols);
      if (r.para.loyalty) {
        const lines = r.lay.blocks[0].lines;
        const cy = (lines[0].baseline + r.lay.offset - pw.cap + lines[lines.length - 1].baseline + r.lay.offset) / 2;
        ctx.save();
        ctx.fillStyle = '#111';
        ctx.font = `${sizeForCap(ctx, 'CMRules', pw.cap)}px CMRules`;
        ctx.fillText(':', L.text.x - pw.cap * 0.55, cy + pw.cap * 0.35);
        ctx.restore();
        drawLoyaltyCost(ctx, r.para.loyalty, L.pwIcon.cx, cy);
      }
    }
    return;
  }
  const b = L.pwBox;
  // halbtransparentes Textfeld; nur die Ecke oben links ist abgerundet
  const shape = () => { ctx.beginPath(); roundRect(ctx, b.x, b.y, b.w + 80, b.h + 80, b.r); };
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x - 10, b.y - 10, b.w + 10, b.h + 10);
  ctx.clip();
  shape();
  ctx.fillStyle = rgba(pal.box, 0.62);
  ctx.fill();
  shape();
  ctx.clip();
  pw.rows.forEach((r, i) => {
    if (i % 2 === 0) {
      ctx.fillStyle = rgba(pal.box, 0.5);
      ctx.fillRect(b.x, r.top, b.w, r.bottom - r.top);
    }
  });
  ctx.restore();
  ctx.save();
  ctx.beginPath();
  ctx.rect(b.x - 10, b.y - 10, b.w + 10, b.h + 10);
  ctx.clip();
  shape();
  ctx.lineWidth = 5;
  ctx.strokeStyle = 'rgba(20,20,20,0.85)';
  ctx.stroke();
  ctx.restore();

  // Verbindungslinie zwischen den Loyalitäts-Symbolen
  const withCost = pw.rows.filter((r) => r.para.loyalty);
  const centerOf = (r) => {
    const lines = r.lay.blocks[0].lines;
    const first = lines[0].baseline + r.lay.offset;
    const last = lines[lines.length - 1].baseline + r.lay.offset;
    return (first - pw.cap + last) / 2;
  };
  if (withCost.length > 1) {
    ctx.save();
    ctx.strokeStyle = 'rgba(20,20,20,0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(L.pwIcon.line, centerOf(withCost[0]));
    ctx.lineTo(L.pwIcon.line, centerOf(withCost[withCost.length - 1]));
    ctx.stroke();
    ctx.restore();
  }
  for (const r of pw.rows) {
    drawText(ctx, r.lay, symbols);
    if (r.para.loyalty) {
      const cy = centerOf(r);
      // Doppelpunkt zwischen Symbol und Text
      ctx.save();
      ctx.fillStyle = '#111';
      ctx.font = `${sizeForCap(ctx, 'CMRules', pw.cap)}px CMRules`;
      ctx.fillText(':', L.text.x - pw.cap * 0.55, cy + pw.cap * 0.35);
      ctx.restore();
      drawLoyaltyCost(ctx, r.para.loyalty, L.pwIcon.cx, cy);
    }
  }
}

function badgePath(ctx, kind, cx, cy, w, h) {
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const t = cy - h / 2;
  const bt = cy + h / 2;
  const tip = h * 0.22;
  ctx.beginPath();
  if (kind === 'up') {
    ctx.moveTo(x0, bt); ctx.lineTo(x0, t + tip); ctx.lineTo(cx, t - tip * 0.4); ctx.lineTo(x1, t + tip); ctx.lineTo(x1, bt);
  } else if (kind === 'down') {
    ctx.moveTo(x0, t); ctx.lineTo(x1, t); ctx.lineTo(x1, bt - tip); ctx.lineTo(cx, bt + tip * 0.4); ctx.lineTo(x0, bt - tip);
  } else {
    ctx.moveTo(x0, t); ctx.lineTo(x1, t); ctx.lineTo(x1, bt); ctx.lineTo(x0, bt);
  }
  ctx.closePath();
}

// Loyalitäts-Symbole aus den Card-Conjurer-Assets (planeswalkerPlus/Minus/Neutral.png)
let ccIcons = null;
export function setPwIcons(icons) { ccIcons = icons; }

/** Wie versionPlaneswalker.js in Card Conjurer: Bild + weiße Zahl (Beleren Small Caps) */
function drawCcLoyaltyCost(ctx, cost, kind, cy, W = 1500, H = 2100) {
  const spec = {
    up: { img: ccIcons.plus, x: 0.0294, dy: -0.0258, w: 0.14, h: 0.0724, ty: 0.0172, c: 0.0104 },
    down: { img: ccIcons.minus, x: 0.028, dy: -0.0153, w: 0.1414, h: 0.0705, ty: 0.0181, c: 0.02 },
    flat: { img: ccIcons.neutral, x: 0.028, dy: -0.0153, w: 0.1414, h: 0.061, ty: 0.0191, c: 0.015 },
  }[kind];
  const place = cy - spec.c * H;
  ctx.drawImage(spec.img, spec.x * W, place + spec.dy * H, spec.w * W, spec.h * H);
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.font = `${(0.0286 * H).toFixed(1)}px CMArtist`;
  ctx.fillText(cost.replace('-', '−'), 0.1027 * W, place + spec.ty * H);
  ctx.restore();
}

export function drawLoyaltyCost(ctx, cost, cx, cy) {
  const kind = cost.startsWith('+') ? 'up' : (cost.startsWith('−') || cost.startsWith('-')) ? 'down' : 'flat';
  if (ccIcons) { drawCcLoyaltyCost(ctx, cost, kind, cy); return; }
  const w = cost.length > 2 ? 126 : 104;
  const h = 76;
  ctx.save();
  // silberne Einfassung
  badgePath(ctx, kind, cx, cy, w + 14, h + 14);
  const g = ctx.createLinearGradient(0, cy - h, 0, cy + h);
  g.addColorStop(0, '#f2f2f0');
  g.addColorStop(0.5, '#9c9fa3');
  g.addColorStop(1, '#e6e6e3');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  badgePath(ctx, kind, cx, cy, w, h);
  ctx.fillStyle = '#1c1c1d';
  ctx.fill();
  ctx.restore();
  drawFittedLine(ctx, cost, 'CMTitle', 38, cx, cy + 19, w - 14, { align: 'center', color: '#fff' });
}

export function drawLoyaltyShield(ctx, value, S) {
  const { cx, cy, w, h } = S;
  // Card-Conjurer-Rahmen enthalten das Schild bereits (Maske "Loyalty") -> nur die Zahl
  if (ccIcons) {
    // Textfeld "Loyalty" aus packPlaneswalkerRegular: x 0,806 + 0,14/2, y 0,902 + 0,0372/2 (Mitte des Schilds)
    const tx = (0.806 + 0.07) * 1500; const ty = (0.902 + 0.0186) * 2100;
    drawFittedLine(ctx, String(value), 'CMTitle', S.cap, tx, ty + S.cap / 2, w - 50, { align: 'center', color: '#fff' });
    return;
  }
  const path = (ww, hh) => {
    const x0 = cx - ww / 2;
    const x1 = cx + ww / 2;
    const t = cy - hh / 2;
    ctx.beginPath();
    ctx.moveTo(x0, t);
    ctx.lineTo(cx - ww * 0.18, t);
    ctx.lineTo(cx, t + hh * 0.1);
    ctx.lineTo(cx + ww * 0.18, t);
    ctx.lineTo(x1, t);
    ctx.lineTo(x1 - ww * 0.06, t + hh * 0.62);
    ctx.lineTo(cx, t + hh);
    ctx.lineTo(x0 + ww * 0.06, t + hh * 0.62);
    ctx.closePath();
  };
  ctx.save();
  path(w, h);
  const g = ctx.createLinearGradient(0, cy - h / 2, 0, cy + h / 2);
  g.addColorStop(0, '#f4f4f2');
  g.addColorStop(0.5, '#9a9da1');
  g.addColorStop(1, '#e2e2df');
  ctx.fillStyle = g;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  path(w - 22, h - 20);
  ctx.fillStyle = '#1c1c1d';
  ctx.fill();
  ctx.restore();
  drawFittedLine(ctx, String(value), 'CMTitle', S.cap, cx, cy + S.cap * 0.42, w - 50, { align: 'center', color: '#fff' });
}
