// Querformat-Karten (Split, Battle): werden im Querformat 2100×1500 aufgebaut
// und um 90° gedreht auf die Hochformat-Karte gesetzt – wie im Druck.
import { drawArt, drawCost, costWidth, drawFramesComposite, drawInfo } from './render.js';
import { frameColors } from './palettes.js';
import { parseRules, parseFlavor, symbolsIn, smartQuotes } from './textparse.js';
import { fitText, drawText, drawFittedLine } from './textlayout.js';
import { drawSetSymbol } from './setsymbol.js';
import { fillTexture, hexToRgb } from './textures.js';
import { roundRect } from './frames.js';
import { drawDfcIcon, drawBackPT } from './dfc.js';

const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`;

/** Teil eines Bildes als eigenes Canvas (z. B. eine Hälfte des Split-Artworks). */
function cropImage(img, x0, x1) {
  if (!img) return null;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  const c = document.createElement('canvas');
  c.width = Math.round(w * (x1 - x0));
  c.height = h;
  c.getContext('2d').drawImage(img, -w * x0, 0);
  return c;
}

function headerAndType(ctx, HL, face, card, symbols, setIcon, nameShift = 0) {
  const codes = symbolsIn(face.mana_cost);
  const cw = costWidth(codes, HL.cost);
  drawCost(ctx, codes, symbols, HL.cost);
  const N = HL.nameText;
  drawFittedLine(ctx, smartQuotes(face.name), N.family, N.cap, N.x + nameShift, N.baseline,
    N.right - N.x - nameShift - cw - (cw ? 20 : 0), { color: '#111' });
  const symW = drawSetSymbol(ctx, setIcon, card.rarity, { ...HL.setSym, outline: 4 });
  const T = HL.typeText;
  drawFittedLine(ctx, face.type_line, T.family, T.cap, T.x, T.baseline,
    HL.setSym.right - (symW ? symW + 24 : 0) - T.x, { color: '#111' });
}

function rulesFor(face, opts, keywords) {
  return [
    ...parseRules(face.oracle_text, { showReminder: opts.showReminder, keywords }),
    ...(opts.showFlavor ? parseFlavor(face.flavor_text) : []),
  ];
}

export function renderLandscape(ctx, model, env) {
  const { art, setIcon, symbols, keywords, scale } = env;
  const { card, opts } = model;
  const L = model.layout;
  ctx.save();
  // Querformat-Koordinaten: (X, Y) -> Hochformat (Y, 2100 - X)
  ctx.transform(0, -1, 1, 0, 0, 2100);
  let caps = [];
  if (L.kind === 'split') {
    L.halves.forEach((HL, i) => {
      const face = card.card_faces[i];
      const part = cropImage(art, i * 0.5, i * 0.5 + 0.5);
      drawArt(ctx, part, HL.art, opts.art, HL.art);
      drawFramesComposite(ctx, HL, frameColors({ ...face, color_identity: card.color_identity }), {}, scale);
      ctx.save();
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(10,10,10,0.9)';
      ctx.strokeRect(HL.art.x - 2, HL.art.y - 2, HL.art.w + 4, HL.art.h + 4);
      ctx.restore();
      headerAndType(ctx, HL, face, card, symbols, setIcon);
      const paras = rulesFor(face, opts, keywords);
      if (paras.length) {
        const lay = fitText(ctx, paras, HL.text, { maxCap: HL.rules.maxCap, minCap: HL.rules.minCap, step: HL.rules.step, fixedCap: opts.fontCap || null });
        drawText(ctx, lay, symbols, { flavorBar: opts.flavorBar !== false });
        caps.push(lay.cap);
      }
    });
  } else {
    const BL = L.land;
    const face = card.card_faces[0];
    const back = card.card_faces[1];
    const pal = model.palettes[0];
    drawArt(ctx, art, BL.art, opts.art, BL.artFit);
    // Rahmen: schmale Kante links + Konturen, Rest ist Artwork
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, BL.frame.x, BL.frame.y, BL.frame.w, BL.frame.h, BL.frame.r);
    ctx.rect(BL.art.x, BL.art.y, BL.art.w, BL.art.h);
    ctx.clip('evenodd');
    ctx.beginPath();
    ctx.rect(0, 0, BL.W, BL.H);
    fillTexture(ctx, pal.tex, 'frame', BL.W, BL.H, 1);
    ctx.restore();
    // Leisten
    for (const b of [BL.namePlate, BL.typePlate]) {
      ctx.save();
      ctx.beginPath();
      roundRect(ctx, b.x, b.y, b.w, b.h, b.h / 2);
      ctx.fillStyle = pal.band;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.beginPath();
      roundRect(ctx, b.x + 8, b.y + 8, b.w - 16, b.h - 16, b.h / 2 - 8);
      fillTexture(ctx, pal.plate, 'plate', BL.W, BL.H, 3);
      ctx.restore();
    }
    // halbtransparentes Textfeld
    ctx.save();
    ctx.fillStyle = rgba(pal.box, 0.86);
    ctx.fillRect(BL.box.x, BL.box.y, BL.box.w, BL.box.h);
    ctx.lineWidth = 8;
    ctx.strokeStyle = pal.band;
    ctx.strokeRect(BL.box.x + 4, BL.box.y + 4, BL.box.w - 8, BL.box.h - 8);
    ctx.restore();
    drawDfcIcon(ctx, 'battle', false, [], BL.icon.cy, BL.icon.cx);
    headerAndType(ctx, BL, face, card, symbols, setIcon, 0);
    const paras = rulesFor(face, opts, keywords);
    if (paras.length) {
      const lay = fitText(ctx, paras, BL.text, { maxCap: BL.rules.maxCap, minCap: BL.rules.minCap, step: BL.rules.step, fixedCap: opts.fontCap || null });
      drawText(ctx, lay, symbols, { flavorBar: opts.flavorBar !== false });
      caps.push(lay.cap);
    }
    drawBackPT(ctx, back, BL.backPT.x, BL.backPT.y);
    drawDefense(ctx, face.defense ?? card.defense, BL.defense);
  }
  ctx.restore();
  drawInfo(ctx, model);
  return caps.length ? Math.min(...caps) : null;
}

function drawDefense(ctx, value, D) {
  if (value == null) return;
  const { cx, cy, r } = D;
  const star = (rr) => {
    ctx.beginPath();
    const n = 9;
    for (let i = 0; i < n * 2; i++) {
      const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2;
      const rad = i % 2 === 0 ? rr : rr * 0.78;
      ctx.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    ctx.closePath();
  };
  ctx.save();
  star(r);
  ctx.fillStyle = '#e8e6e0';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  star(r - 12);
  ctx.fillStyle = '#1b1b1b';
  ctx.fill();
  ctx.restore();
  drawFittedLine(ctx, String(value), 'CMTitle', D.cap, cx, cy + D.cap / 2, r * 1.2, { align: 'center', color: '#fff' });
}
