// Adventure-Layout: Textfeld als aufgeschlagenes Buch, links das Abenteuer
// mit eigener Namens-/Typleiste, rechts der Text der Kreatur.
import { layoutAll, place, drawText, drawFittedLine, drawSymbol, METRICS } from './textlayout.js';
import { parseRules, parseFlavor, symbolsIn, smartQuotes } from './textparse.js';
import { PALETTES } from './palettes.js';
import { darken, mix } from './textures.js';

function barColor(face) {
  const cols = (face.colors && face.colors.length ? face.colors : [...new Set((face.mana_cost || '').match(/[WUBRG]/g) || [])]);
  if (cols.length === 1) return darken(PALETTES[cols[0]].band, 0.18);
  if (cols.length > 1) return darken(PALETTES.M.band, 0.25);
  return darken(PALETTES.A.band, 0.25);
}

export function drawAdventure(ctx, model, L, pal, symbols, keywords, exclude) {
  const { card, opts } = model;
  const main = card.card_faces[0];
  const adv = card.card_faces[1];
  const A = L.adv;
  const parse = (t) => parseRules(t, { showReminder: opts.showReminder, keywords });
  const rightParas = [...parse(main.oracle_text), ...(opts.showFlavor ? parseFlavor(main.flavor_text || card.flavor_text) : [])];
  const leftParas = [...parse(adv.oracle_text), ...(opts.showFlavor ? parseFlavor(adv.flavor_text) : [])];

  // Buchrücken
  ctx.save();
  const g = ctx.createLinearGradient(A.spine - 40, 0, A.spine + 40, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.45, 'rgba(0,0,0,0.18)');
  g.addColorStop(0.5, 'rgba(0,0,0,0.55)');
  g.addColorStop(0.55, 'rgba(0,0,0,0.18)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(A.spine - 40, L.box.y + 7, 80, L.box.h - 14);
  ctx.restore();

  // Leisten des Abenteuers
  const col = barColor(adv);
  for (const b of [A.nameBar, A.typeBar]) {
    ctx.save();
    const gg = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    gg.addColorStop(0, mix(col, '#ffffff', 0.12));
    gg.addColorStop(1, darken(col, 0.12));
    ctx.fillStyle = gg;
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.restore();
  }
  const costCodes = symbolsIn(adv.mana_cost);
  const c = A.cost;
  let x = c.right - (costCodes.length * c.d + Math.max(0, costCodes.length - 1) * c.gap);
  const costLeft = x;
  for (const code of costCodes) {
    drawSymbol(ctx, symbols, code, x, c.cy - c.d / 2, c.d, { ...c.shadow, color: 'rgba(0,0,0,0.9)' });
    x += c.d + c.gap;
  }
  drawFittedLine(ctx, smartQuotes(adv.name), A.nameText.family, A.nameText.cap, A.nameText.x, A.nameText.baseline,
    costLeft - A.nameText.x - 16, { color: '#fff' });
  drawFittedLine(ctx, adv.type_line, A.typeText.family, A.typeText.cap, A.typeText.x, A.typeText.baseline,
    A.typeText.right - A.typeText.x, { color: '#fff' });

  // gemeinsame Schriftgröße für beide Seiten
  const step = L.rules.step;
  let pick = null;
  for (let cap = opts.fontCap || L.rules.maxCap; cap >= L.rules.minCap; cap -= step) {
    const l = leftParas.length ? layoutAll(ctx, leftParas, cap, A.left.w, METRICS) : null;
    const r = rightParas.length ? layoutAll(ctx, rightParas, cap, A.right.w, METRICS) : null;
    const okL = !l || (!l.overflow && l.height <= A.left.h);
    let okR = !r || (!r.overflow && r.height <= A.right.h);
    let pr = null;
    if (r && okR) {
      pr = place(r, A.right, { exclude });
      okR = !pr.collides;
    }
    pick = { cap, l, pr: pr || (r && place(r, A.right, {})) };
    if (opts.fontCap || (okL && okR)) break;
  }
  if (pick.l) drawText(ctx, place(pick.l, A.left, {}), symbols, { flavorBar: opts.flavorBar !== false });
  if (pick.pr) drawText(ctx, pick.pr, symbols, { flavorBar: opts.flavorBar !== false });
  return pick.cap;
}
