// Markierungen doppelseitiger Karten (M15-Rahmen):
// Transform: Kreis-Symbol (Sonne/Mond …) vor dem Namen,
// Modal DFC: Linsen-Symbol mit Dreieck und Lasche unten links mit Infos zur Rückseite.
import { drawFittedLine, drawSymbol, sizeForCap } from './textlayout.js';
import { symbolsIn } from './textparse.js';
import { PALETTES, frameColors } from './palettes.js';
import { darken } from './textures.js';

export function dfcKind(card) {
  if (card.layout === 'modal_dfc') return 'mdfc';
  if (card.layout === 'transform' || card.layout === 'battle') return 'transform';
  return null;
}

// Transform-Symbole aus Card Conjurer (packM15TransformTypes) je Scryfall-Rahmeneffekt: [Vorderseite, Rückseite]
const ICONS = '/cc/img/frames/m15/transform/icons';
const TRANSFORM_ICONS = {
  sunmoondfc: ['sun.svg', 'moon.svg'],
  compasslanddfc: ['compass.svg', 'land.svg'],
  originpwdfc: ['spark.svg', 'planeswalker.svg'],
  mooneldrazidfc: ['fullmoon.svg', 'emrakul.svg'],
  waxingandwaningmoondfc: ['fullmoon.svg', 'moon.svg'],
  fandfc: ['fanClosed.svg', 'fanOpen.svg'],
  upsidedowndfc: ['default.png', 'downArrow.png'],
};
/** URL des Card-Conjurer-Symbols vor dem Namen (nur Transform; MDFC-Pfeil ist Teil des Rahmenbilds). */
export function dfcIconUrl(kind, back, effects = []) {
  if (kind !== 'transform') return null;
  const key = Object.keys(TRANSFORM_ICONS).find((k) => effects.includes(k));
  const pair = TRANSFORM_ICONS[key] || ['default.png', 'downArrow.png'];
  return `${ICONS}/${pair[back ? 1 : 0]}`;
}

/**
 * Zeichnet das Symbol vor dem Namen; liefert, um wie viel der Name nach rechts rückt.
 * cc: Rahmen aus Card-Conjurer-Grafiken – MDFC-Pfeil ist dort schon enthalten, Transform-Symbol
 * (ccIcon) liegt an der Stelle des Kreises im Rahmenbild (Bounds aus packM15TransformTypes).
 */
export function drawDfcIcon(ctx, kind, back, effects = [], cy = 155, cxIn = null, { cc = false, ccIcon = null } = {}) {
  if (cc && kind === 'mdfc') return 120;
  if (cc && kind === 'transform' && ccIcon) {
    ctx.drawImage(ccIcon, 0.0594 * 1500, 0.0505 * 2100, 0.0734 * 1500, 0.0524 * 2100);
    return 118;
  }
  ctx.save();
  if (kind === 'mdfc') {
    const cx = 125;
    ctx.beginPath();
    ctx.moveTo(42, cy);
    ctx.quadraticCurveTo(cx, cy - 92, 208, cy);
    ctx.quadraticCurveTo(cx, cy + 92, 42, cy);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx, cy, 58, 44, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#f2f0ea';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#1a1a1a';
    ctx.stroke();
    ctx.beginPath();
    const s = back ? -1 : 1;
    ctx.moveTo(cx, cy - 26 * s);
    ctx.lineTo(cx + 26, cy + 18 * s);
    ctx.lineTo(cx - 26, cy + 18 * s);
    ctx.closePath();
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();
    ctx.restore();
    return 120;
  }
  const cx = cxIn ?? 148;
  ctx.beginPath();
  ctx.arc(cx, cy, 64, 0, Math.PI * 2);
  ctx.fillStyle = '#1a1a1a';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(cx, cy, 52, 0, Math.PI * 2);
  ctx.fillStyle = '#f2f0ea';
  ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.strokeStyle = '#1a1a1a';
  if (kind === 'battle') {
    // Battle: Dreieck im Kreis
    ctx.beginPath();
    ctx.moveTo(cx, cy - 28);
    ctx.lineTo(cx + 28, cy + 20);
    ctx.lineTo(cx - 28, cy + 20);
    ctx.closePath();
    ctx.fill();
  } else if (!back) {
    // Sonne: Ring mit Zacken
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a - 0.12) * 30, cy + Math.sin(a - 0.12) * 30);
      ctx.lineTo(cx + Math.cos(a) * 46, cy + Math.sin(a) * 46);
      ctx.lineTo(cx + Math.cos(a + 0.12) * 30, cy + Math.sin(a + 0.12) * 30);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 22, 0, Math.PI * 2);
    ctx.fillStyle = '#f2f0ea';
    ctx.fill();
  } else {
    // Mond (Sichel)
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 18, cy - 12, 34, 0, Math.PI * 2);
    ctx.fillStyle = '#f2f0ea';
    ctx.fill();
  }
  ctx.restore();
  return 118;
}

/** Lasche unten links mit Typ + Kosten/Manafähigkeit der anderen Seite. */
export function drawMdfcTab(ctx, other, back, symbols, colorIdentity = [], { cc = false } = {}) {
  const y = 1868;
  const h = 58;
  const x0 = 50;
  const x1 = 690;
  // Card-Conjurer-Rahmen enthalten die Lasche samt Pfeil (Maske "Flipside") -> nur die Texte
  if (!cc) drawTabShape(ctx, other, back, colorIdentity, x0, x1, y, h);
  drawTabText(ctx, other, symbols, x0, x1, y, h);
}

function drawTabShape(ctx, other, back, colorIdentity, x0, x1, y, h) {
  // Farbe wie der Rahmen der anderen Seite (Land -> Farbe der erzeugten Mana)
  const ci = /Land/.test(other.type_line || '') ? [...new Set(((other.oracle_text || '').match(/Add [^.]*/g) || []).join(' ').match(/[WUBRG]/g) || [])] : colorIdentity;
  const pal = frameColors({ ...other, color_identity: ci })[0];
  const fill = darken(pal.band, 0.12);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x0 + 26, y);
  ctx.lineTo(x1 - 30, y);
  ctx.lineTo(x1, y + h / 2);
  ctx.lineTo(x1 - 30, y + h);
  ctx.lineTo(x0 + 26, y + h);
  ctx.lineTo(x0, y + h / 2);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.restore();
  // Pfeil + Typ
  ctx.save();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  const ax = x0 + 22;
  const ay = y + h / 2;
  if (back) { ctx.moveTo(ax + 20, ay); ctx.lineTo(ax, ay - 13); ctx.lineTo(ax, ay + 13); }
  else { ctx.moveTo(ax, ay); ctx.lineTo(ax + 20, ay - 13); ctx.lineTo(ax + 20, ay + 13); }
  ctx.fill();
  ctx.restore();
}

function drawTabText(ctx, other, symbols, x0, x1, y, h) {
  const mainType = (other.type_line || '').split('—')[0].replace(/\b(Legendary|Basic|Snow|World|Tribal|Kindred)\b/g, '').trim().split(' ').pop();
  drawFittedLine(ctx, mainType, 'CMTitle', 30, x0 + 54, y + h / 2 + 15, 220, { color: '#fff' });
  // rechts: Manafähigkeit (Länder) oder Manakosten
  const firstLine = (other.oracle_text || '').split('\n').find((l) => /^\{T\}: Add/.test(l)) || '';
  const right = x1 - 46;
  if (/Land/.test(other.type_line || '') && /^\{T\}: Add/.test(firstLine) && firstLine.length < 30) {
    const parts = firstLine.split(/(\{[^}]+\})/).filter(Boolean);
    // von rechts nach links setzen
    const d = 34;
    ctx.save();
    ctx.font = `${sizeForCap(ctx, 'CMRules', 27)}px CMRules`;
    const widths = parts.map((p) => (p.startsWith('{') ? d + 4 : ctx.measureText(p).width));
    let x = right - widths.reduce((a, b) => a + b, 0);
    ctx.fillStyle = '#fff';
    parts.forEach((p, i) => {
      if (p.startsWith('{')) drawSymbol(ctx, symbols, p.toUpperCase(), x + 2, y + h / 2 - d / 2, d);
      else ctx.fillText(p, x, y + h / 2 + 13);
      x += widths[i];
    });
    ctx.restore();
  } else {
    const codes = symbolsIn(other.mana_cost);
    const d = 34;
    let x = right - codes.length * (d + 3);
    for (const code of codes) { drawSymbol(ctx, symbols, code, x, y + h / 2 - d / 2, d); x += d + 3; }
  }
}

/** Kleine P/T der Rückseite rechts im Textfeld (Transform-Vorderseiten). */
export function drawBackPT(ctx, other, x, y) {
  if (other?.power == null || other?.toughness == null) return;
  drawFittedLine(ctx, `${other.power}/${other.toughness}`, 'CMTitle', 27, x, y, 120, { align: 'right', color: '#8b8b8b' });
}
