// Planeswalker-Rahmen (ab 2015): Fähigkeiten in Zeilen mit Loyalitäts-Symbolen,
// halbtransparentes Textfeld über dem hohen Artwork, Loyalitäts-Schild.
import { layoutAll, drawText, drawFittedLine, sizeForCap, METRICS } from './textlayout.js';
import { roundRect } from './frames.js';
import { hexToRgb } from './textures.js';

const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`;

/** Teilt das Textfeld in Zeilen (eine pro Fähigkeit) und sucht die passende Größe. */
export function layoutPlaneswalker(ctx, paras, L, opts = {}) {
  const box = L.text;
  const rules = paras.filter((p) => p.kind === 'rules');
  if (!rules.length) return null;
  const max = L.rules.maxCap;
  const step = L.rules.step || max / 18;
  let best = null;
  for (let c = opts.fixedCap || max; c >= L.rules.minCap; c -= step) {
    const items = rules.map((p) => layoutAll(ctx, [p], c, box.w, METRICS));
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
    const items = rules.map((p) => layoutAll(ctx, [p], c, box.w, METRICS));
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
    return { top, bottom: y, para: rules[i], lay: { ...it, box, offset: textTop - it.visTop } };
  });
  return { cap: best.c, rows };
}

export function drawPlaneswalkerText(ctx, pw, L, pal, symbols) {
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

export function drawLoyaltyCost(ctx, cost, cx, cy) {
  const kind = cost.startsWith('+') ? 'up' : (cost.startsWith('−') || cost.startsWith('-')) ? 'down' : 'flat';
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
