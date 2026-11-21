// Setzt alles zusammen: Datenmodell aus Scryfall-Karte bauen und Karte zeichnen.
import { LAYOUTS, layoutForFrame, W, H } from './layouts.js';
import { frameColors, BORDER_COLORS, VEHICLE_PT } from './palettes.js';
import { drawFrameLayer, drawHolo, drawBrush, roundRect } from './frames.js';
import { parseRules, parseFlavor, symbolsIn, smartQuotes } from './textparse.js';
import { fitText, drawText, drawSymbol, drawFittedLine, sizeForCap } from './textlayout.js';
import { drawSetSymbol } from './setsymbol.js';
import { loadImage, loadSymbols, ensureFonts } from './assets.js';
import { luminance, mix } from './textures.js';
import { drawSagaText, drawClassText } from './columns.js';
import { drawAdventure } from './adventure.js';
import { dfcKind, drawDfcIcon, drawMdfcTab, drawBackPT } from './dfc.js';
import { renderLandscape } from './landscape.js';
import { layoutPlaneswalker, drawPlaneswalkerText, drawLoyaltyShield as drawPwShield } from './planeswalker.js';

export { W, H };

const FACE_LAYOUTS = new Set(['transform', 'modal_dfc', 'double_faced', 'flip', 'meld', 'battle']);

export function facesOf(card) {
  if (card.card_faces && FACE_LAYOUTS.has(card.layout)) return card.card_faces;
  return [card];
}

/**
 * Baut das Render-Modell.
 * opts: { face, frame, border, showFlavor, showReminder, footer, art: {zoom,dx,dy}, artUrl, fontCap, flavorBar }
 */
export function buildModel(card, set, opts) {
  const faces = facesOf(card);
  const faceIdx = Math.min(opts.face || 0, faces.length - 1);
  // Adventure/Split: eine Kartenseite mit mehreren Hälften -> Hauptteil als "Seite"
  const f = (card.layout === 'adventure' || card.layout === 'split') && card.card_faces ? card.card_faces[0] : faces[faceIdx];
  const pick = (k) => f[k] ?? card[k];
  const type = pick('type_line') || '';
  const loyalty = f.loyalty ?? (faces.length === 1 ? card.loyalty : null);
  const face = {
    name: pick('name'),
    mana_cost: f.mana_cost ?? (faces.length === 1 ? card.mana_cost : ''),
    type_line: type,
    oracle_text: f.oracle_text ?? (faces.length === 1 ? card.oracle_text : ''),
    flavor_text: f.flavor_text ?? (faces.length === 1 ? card.flavor_text : null),
    power: f.power ?? (faces.length === 1 ? card.power : null),
    toughness: f.toughness ?? (faces.length === 1 ? card.toughness : null),
    loyalty,
    defense: f.defense ?? card.defense ?? null,
    colors: f.colors ?? f.color_indicator ?? card.colors ?? [],
    color_identity: card.color_identity || [],
    produced_mana: card.produced_mana || [],
    artist: f.artist || card.artist || '',
  };
  let layoutName = opts.frame && opts.frame !== 'auto' ? opts.frame : layoutForFrame(card.frame);
  const isPw = loyalty != null && /\bPlaneswalker\b/.test(type);
  if (layoutName === 'm15' && isPw) {
    const abilities = (face.oracle_text || '').split('\n').filter(Boolean).length;
    layoutName = abilities >= 4 ? 'pw4' : 'pw';
  } else if (layoutName === 'm15' && card.layout === 'saga') {
    layoutName = 'saga';
  } else if (layoutName === 'm15' && card.layout === 'class') {
    layoutName = 'class';
  } else if (layoutName === 'm15' && card.layout === 'split' && card.card_faces?.length === 2) {
    layoutName = 'split';
  } else if (layoutName === 'm15' && faceIdx === 0 && /\bBattle\b/.test(card.card_faces?.[0]?.type_line || '')) {
    layoutName = 'battle';
  } else if (layoutName === 'm15' && card.layout === 'adventure') {
    layoutName = 'adventure';
  }
  const border = opts.border && opts.border !== 'auto' ? opts.border : card.border_color;
  return {
    card,
    set,
    face,
    faceIdx,
    layout: LAYOUTS[layoutName] || LAYOUTS.m15,
    borderColor: BORDER_COLORS[border] || BORDER_COLORS.black,
    lightBorder: border === 'white' || border === 'silver' || border === 'gold' || border === 'yellow',
    palettes: frameVariant(frameColors(face), card, type),
    flags: {
      // Legendary-Krone gibt es erst ab Dominaria (2018)
      legendary: /\bLegendary\b/.test(type) && (card.released_at || '') >= '2018-04-27',
      pt: face.power != null && face.toughness != null,
      vehicle: /\bVehicle\b/.test(type),
      planeswalker: loyalty != null && /\bPlaneswalker\b/.test(type),
      basic: /\bBasic\b/.test(type) && /\bLand\b/.test(type),
      holo: (card.rarity === 'rare' || card.rarity === 'mythic') && (LAYOUTS[layoutName] || LAYOUTS.m15).style === 'm15',
    },
    opts,
  };
}

/**
 * Rahmen-Varianten über die Struktur-Farben:
 * Snow (eisig-weiß), Nyx (helle Spitzenstruktur, ab Theros Beyond Death), Devoid (durchscheinend).
 */
function frameVariant(palettes, card, type) {
  const fx = card.frame_effects || [];
  const modern = card.frame === '2015' || card.frame === 'future';
  const snow = fx.includes('snow');
  const nyx = fx.includes('nyxtouched') || (modern && /\bEnchantment\b/.test(type) && /\b(Creature|Artifact)\b/.test(type) && (card.released_at || '') >= '2020-01-24');
  const devoid = (card.keywords || []).includes('Devoid');
  return palettes.map((p) => {
    if (snow) return { ...p, tex: ['#a9b9c6', '#e3eaef', '#ffffff'], variant: 'snow' };
    if (nyx) return { ...p, tex: p.tex.map((c) => mix(c, '#ffffff', 0.5)), variant: 'nyx' };
    if (devoid) return { ...p, texAlpha: 0.35, variant: 'devoid' };
    return p;
  });
}

function placeArt(img, box, adj = {}) {
  const zoom = adj.zoom || 1;
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const sc = Math.max(box.w / iw, box.h / ih) * zoom;
  const dw = iw * sc;
  const dh = ih * sc;
  return {
    x: box.x + (box.w - dw) / 2 + (adj.dx || 0) * box.w * 0.5,
    y: box.y + (box.h - dh) / 2 + (adj.dy || 0) * box.h * 0.5,
    w: dw,
    h: dh,
  };
}

/**
 * Zeichnet das Artwork. clip = sichtbares Fenster, fit = Bereich, den der
 * Scryfall-Crop abdeckt (bei Planeswalkern nur bis zur Typzeile). Unterhalb
 * wird das Bild gespiegelt und weichgezeichnet fortgesetzt.
 */
export function drawArt(ctx, img, clip, adj = {}, fit = clip) {
  ctx.save();
  ctx.beginPath();
  if (clip.r) roundRect(ctx, clip.x, clip.y, clip.w, clip.h + clip.r * 2, clip.r);
  else ctx.rect(clip.x, clip.y, clip.w, clip.h);
  ctx.clip();
  ctx.fillStyle = '#111';
  ctx.fillRect(clip.x, clip.y, clip.w, clip.h);
  if (img) {
    const p = placeArt(img, fit, adj);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const bottom = p.y + p.h;
    if (bottom < clip.y + clip.h) {
      ctx.save();
      ctx.filter = 'blur(14px)';
      ctx.translate(0, bottom * 2);
      ctx.scale(1, -1);
      ctx.drawImage(img, p.x, p.y, p.w, p.h);
      ctx.restore();
    }
    ctx.drawImage(img, p.x, p.y, p.w, p.h);
  }
  ctx.restore();
}

export function costWidth(codes, c) {
  return codes.length ? codes.length * c.d + (codes.length - 1) * c.gap : 0;
}

export function drawCost(ctx, codes, symbols, c) {
  let x = c.right - costWidth(codes, c);
  for (const code of codes) {
    drawSymbol(ctx, symbols, code, x, c.cy - c.d / 2, c.d, c.shadow ? { ...c.shadow, color: 'rgba(0,0,0,0.95)' } : null);
    x += c.d + c.gap;
  }
}

function drawLoyaltyCost(ctx, cost, cx, cy) {
  const w = 128;
  const h = 86;
  const up = cost.startsWith('+');
  const down = cost.startsWith('−') || cost.startsWith('-');
  ctx.save();
  ctx.beginPath();
  const x0 = cx - w / 2;
  const x1 = cx + w / 2;
  const t = cy - h / 2;
  const b = cy + h / 2;
  if (up) {
    ctx.moveTo(x0, b); ctx.lineTo(x0, t + 18); ctx.lineTo(cx, t - 14); ctx.lineTo(x1, t + 18); ctx.lineTo(x1, b);
  } else if (down) {
    ctx.moveTo(x0, t); ctx.lineTo(x1, t); ctx.lineTo(x1, b - 18); ctx.lineTo(cx, b + 14); ctx.lineTo(x0, b - 18);
  } else {
    ctx.moveTo(x0, t); ctx.lineTo(x1, t); ctx.lineTo(x1 - 8, b); ctx.lineTo(x0 + 8, b);
  }
  ctx.closePath();
  ctx.fillStyle = '#1b1a19';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 8;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#cfc8b8';
  ctx.stroke();
  ctx.restore();
  drawFittedLine(ctx, cost, 'CMTitle', 40, cx, cy + 20, w - 16, { align: 'center', color: '#fff' });
}

function drawLoyaltyShield(ctx, value, L) {
  const b = L.ptPlate;
  const cx = b.x + b.w / 2;
  const top = b.y - 6;
  const w = 168;
  const h = 128;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top);
  ctx.lineTo(cx + w / 2, top);
  ctx.lineTo(cx + w / 2, top + h * 0.55);
  ctx.quadraticCurveTo(cx + w / 2, top + h * 0.9, cx, top + h);
  ctx.quadraticCurveTo(cx - w / 2, top + h * 0.9, cx - w / 2, top + h * 0.55);
  ctx.closePath();
  ctx.fillStyle = '#1b1a19';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 10;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#cfc8b8';
  ctx.stroke();
  ctx.restore();
  drawFittedLine(ctx, String(value), 'CMTitle', 54, cx, top + h * 0.62, w - 30, { align: 'center', color: '#fff' });
}

function rarityLetter(r) {
  return { common: 'C', uncommon: 'U', rare: 'R', mythic: 'M', special: 'S', bonus: 'B' }[r] || 'C';
}

function collectorLine(model) {
  const { card, set } = model;
  const cn = card.collector_number || '';
  const total = set?.printed_size || set?.printed_size_estimate;
  if (/^\d+$/.test(cn) && total && Number(cn) <= total) {
    return `${cn.padStart(3, '0')}/${String(total).padStart(3, '0')}`;
  }
  return /^\d+$/.test(cn) ? cn.padStart(3, '0') : cn;
}

export function drawInfo(ctx, model) {
  const L = model.layout;
  const I = L.info;
  const { card, face, opts } = model;
  const onFrame = L.style !== 'm15';
  // M15: Text steht im Rand; sonst direkt auf der Rahmenfläche
  const bg = onFrame ? (L.style === 'retro' ? model.palettes[0].retroTex[1] : model.palettes[0].tex[1]) : null;
  const color = onFrame ? (luminance(bg) > 0.5 ? '#111' : '#f4f2ee') : (model.lightBorder ? '#111' : '#f2f2f2');
  const shadow = onFrame && color !== '#111' ? 'rgba(0,0,0,0.8)' : null;
  const fs = (fam, cap) => `${sizeForCap(ctx, fam, cap).toFixed(2)}px ${fam}`;
  ctx.save();
  ctx.fillStyle = color;
  ctx.textBaseline = 'alphabetic';
  const year = (card.released_at || '').slice(0, 4);
  if (L.style === 'm15') {
    ctx.font = fs('CMInfo', I.cap);
    // ab 2023 neues Format: "C 0213" statt "213/280 C"
    const cn = card.collector_number || '';
    const line1 = (card.released_at || '') >= '2023-02-03' && /^\d+$/.test(cn)
      ? `${model.flags.basic ? 'L' : rarityLetter(card.rarity)} ${cn.padStart(4, '0')}`
      : `${collectorLine(model)}  ${rarityLetter(card.rarity)}`;
    ctx.fillText(line1, I.x, I.y1);
    const left = `${(card.set || '').toUpperCase()} \u2022 ${(card.lang || 'en').toUpperCase()}`;
    ctx.fillText(left, I.x, I.y2);
    let x = I.x + ctx.measureText(left).width + I.cap * 1.6;
    drawBrush(ctx, x, I.y2 - I.cap * 0.45, I.cap * 1.7, color);
    x += I.cap * 1.2;
    ctx.font = fs('CMArtist', I.cap * 1.05);
    ctx.fillText(face.artist, x, I.y2);
    if (opts.footer) {
      ctx.font = fs('CMInfo', I.cap * 0.9);
      ctx.textAlign = 'right';
      ctx.fillText(opts.footer, I.right, I.y2);
    }
  } else if (L.style === 'm2003') {
    drawBrush(ctx, I.x + I.cap * 1.1, I.y1 - I.cap * 0.45, I.cap * 2.1, color);
    ctx.font = fs('CMMatrix', I.cap);
    ctx.fillText(face.artist, I.x + I.cap * 2.4, I.y1);
    ctx.font = fs('CMInfo', I.smallCap);
    const line = [opts.footer, collectorLine(model)].filter(Boolean).join('   ');
    ctx.fillText(line, I.x, I.y2);
  } else {
    const artist = `Illus. ${face.artist}`;
    if (shadow) { ctx.shadowColor = shadow; ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; ctx.shadowBlur = 1; }
    ctx.font = fs('CMRules', I.artistCap);
    if (I.artistAlign === 'center') {
      ctx.textAlign = 'center';
      ctx.fillText(artist, L.W / 2, I.artistBaseline);
    } else {
      ctx.fillText(artist, I.artistX, I.artistBaseline);
    }
    ctx.shadowColor = 'transparent';
    ctx.font = fs('CMRules', I.smallCap);
    const line = [opts.footer, L.variant === '97' ? collectorLine(model) : null].filter(Boolean).join('   ');
    if (I.artistAlign === 'center') ctx.fillText(line, L.W / 2, I.smallBaseline);
    else ctx.fillText(line, I.artistX, I.smallBaseline);
  }
  ctx.restore();
}

/**
 * Zeichnet die Rahmenebene. Bei zwei Paletten (Hybrid, zweifarbige Länder/Gold)
 * werden zwei Ebenen mit weichem Übergang in der Mitte des Rahmens überblendet.
 */
export function drawFramesComposite(ctx, L, palettes, flags, scale) {
  if (palettes.length === 1) {
    drawFrameLayer(ctx, L, palettes[0], flags);
    return;
  }
  const make = (pal) => {
    const c = document.createElement('canvas');
    c.width = Math.round(L.W * scale);
    c.height = Math.round(L.H * scale);
    const x = c.getContext('2d');
    x.scale(scale, scale);
    drawFrameLayer(x, L, pal, flags);
    return c;
  };
  const a = make(palettes[0]);
  const b = make(palettes[1]);
  const bx = b.getContext('2d');
  bx.setTransform(1, 0, 0, 1, 0, 0);
  bx.globalCompositeOperation = 'destination-in';
  const f = L.frame;
  const g = bx.createLinearGradient((f.x + f.w * 0.4) * scale, 0, (f.x + f.w * 0.6) * scale, 0);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,1)');
  bx.fillStyle = g;
  bx.fillRect(0, 0, b.width, b.height);
  ctx.drawImage(a, 0, 0, L.W, L.H);
  ctx.drawImage(b, 0, 0, L.W, L.H);
}

/** Hauptfunktion: zeichnet die Karte auf ein Canvas. */
export async function renderCard(canvas, model, deps) {
  const { symbolMap, keywords } = deps;
  const scale = model.opts.scale || 1;
  const L = model.layout;
  const { face, flags, opts } = model;

  const retroLayout = L.style === 'retro';
  // Standardländer: Reminder "({T}: Add {G}.)" steht nie auf der Karte –
  // stattdessen Flavortext oder ein großes Manasymbol.
  const rulesParas = flags.basic ? [] : parseRules(face.oracle_text, {
    showReminder: opts.showReminder,
    keywords,
    // Retro-Planeswalker zeigen Loyalitätskosten inline ("+1: ...")
    planeswalker: flags.planeswalker && !retroLayout,
  });
  const flavorParas = opts.showFlavor ? parseFlavor(face.flavor_text) : [];
  const codes = symbolsIn(face.mana_cost, face.oracle_text,
    ...(model.card.card_faces || []).flatMap((f) => [f.mana_cost, f.oracle_text]));
  const basicSym = flags.basic && flavorParas.length === 0 ? basicLandSymbol(face) : null;
  if (basicSym) codes.push(basicSym);

  const [art, setIcon, symbols] = await Promise.all([
    loadImage(opts.artUrl).catch(() => null),
    loadImage(model.set?.icon).catch(() => null),
    loadSymbols(codes, symbolMap),
    ensureFonts(),
  ]);

  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  const ctx = canvas.getContext('2d');
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  ctx.clearRect(0, 0, W, H);

  // Karte mit abgerundeten Ecken + Randfarbe
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, 0, 0, W, H, L.radius);
  ctx.clip();
  ctx.fillStyle = model.borderColor;
  ctx.fillRect(0, 0, W, H);

  if (L.kind === 'split' || L.kind === 'battle') {
    model.textCap = renderLandscape(ctx, model, { art, setIcon, symbols, keywords, scale });
    ctx.restore();
    return model;
  }

  if (model.palettes[0].variant === 'devoid' && L.style === 'm15') {
    // Devoid: Artwork scheint durch den ganzen Rahmen
    ctx.save();
    ctx.filter = 'blur(3px)';
    drawArt(ctx, art, L.frame, opts.art, L.artFit || L.art);
    ctx.restore();
  }
  drawArt(ctx, art, L.art, opts.art, L.artFit || L.art);
  drawFramesComposite(ctx, L, model.palettes, flags, scale);

  // Artwork-Kontur
  if (L.style === 'm15' && L.kind !== 'pw') {
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10,10,10,0.9)';
    ctx.strokeRect(L.art.x - 2, L.art.y - 2, L.art.w + 4, L.art.h + 4);
    ctx.restore();
  }

  const retro = L.style === 'retro';
  const headColor = retro ? (luminance(model.palettes[0].retroTex[1]) > 0.55 ? '#111' : '#fbfaf6') : '#111';
  const headShadow = retro && headColor !== '#111' ? 'rgba(0,0,0,0.9)' : null;

  // Name + Manakosten
  const costCodes = symbolsIn(face.mana_cost);
  const cw = costWidth(costCodes, L.cost);
  drawCost(ctx, costCodes, symbols, L.cost);
  const N = L.nameText;
  // Doppelseitige Karten: Symbol vor dem Namen (nur moderne Rahmen)
  const dfc = L.style === 'm15' ? dfcKind(model.card) : null;
  const nameShift = dfc ? drawDfcIcon(ctx, dfc, model.faceIdx === 1, model.card.frame_effects, L.cost.cy + 1) : 0;
  drawFittedLine(ctx, smartQuotes(face.name), N.family, N.cap, N.x + nameShift, N.baseline,
    N.right - N.x - nameShift - cw - (cw ? 20 : 0), { color: headColor, shadow: headShadow });

  // Typzeile + Set-Symbol
  const plainSymbol = (model.card.released_at || '9999') < '1998-06-01';
  const symW = drawSetSymbol(ctx, setIcon, model.card.rarity, { ...L.setSym, outline: retro ? 3 : 4, plain: plainSymbol });
  const T = L.typeText;
  drawFittedLine(ctx, face.type_line, T.family, T.cap, T.x, T.baseline,
    Math.min(T.right, L.setSym.right - (symW ? symW + 24 : 0)) - T.x, { color: headColor, shadow: headShadow });

  // Regeltext
  let textBox = { ...L.text };
  if (dfc === 'mdfc' && model.card.card_faces?.length === 2) {
    drawMdfcTab(ctx, model.card.card_faces[1 - model.faceIdx], model.faceIdx === 1, symbols, model.card.color_identity);
    textBox = { ...textBox, h: textBox.h - 80 };
  }
  if (dfc === 'transform' && model.faceIdx === 0 && model.card.card_faces?.length === 2 && L.ptPlate) {
    drawBackPT(ctx, model.card.card_faces[1], L.ptPlate.x + L.ptPlate.w - 8, L.ptPlate.y - 46);
  }
  if (flags.planeswalker && !retroLayout) textBox = { ...textBox, x: textBox.x + 120, w: textBox.w - 120 };
  const paras = [...rulesParas, ...flavorParas];
  let ptZone = (flags.pt || flags.planeswalker) && L.ptPlate ? { x: L.ptPlate.x - 12, y: L.ptPlate.y } : null;
  if (ptZone && dfc === 'transform' && model.faceIdx === 0 && model.card.card_faces?.[1]?.power != null) {
    // Platz für die kleine Rückseiten-P/T rechts über der P/T-Box
    ptZone = { x: L.ptPlate.x + L.ptPlate.w - 120, y: L.ptPlate.y - 80, tolerance: 60 };
  }
  if (L.kind === 'adventure') {
    model.textCap = drawAdventure(ctx, model, L, model.palettes[0], symbols, keywords, ptZone);
  } else if (L.kind === 'saga') {
    model.textCap = drawSagaText(ctx, model, L, model.palettes[0], symbols, keywords);
  } else if (L.kind === 'class') {
    model.textCap = drawClassText(ctx, model, L, model.palettes[0], symbols, keywords);
  } else if (L.kind === 'pw') {
    const pw = layoutPlaneswalker(ctx, rulesParas, L, { fixedCap: opts.fontCap || null });
    if (pw) {
      drawPlaneswalkerText(ctx, pw, L, model.palettes[0], symbols);
      model.textCap = pw.cap;
    }
  } else if (basicSym) {
    const d = Math.min(L.text.h * 0.6, 330);
    drawSymbol(ctx, symbols, basicSym, L.text.x + L.text.w / 2 - d / 2, L.text.y + L.text.h / 2 - d / 2, d);
  } else if (paras.length) {
    const lay = fitText(ctx, paras, textBox, {
      maxCap: flags.planeswalker ? L.rules.maxCap * 0.9 : L.rules.maxCap,
      minCap: L.rules.minCap,
      fixedCap: opts.fontCap || null,
      exclude: ptZone,
      metrics: L.metrics,
      centerShort: L.rules.centerShort,
    });
    if (flags.planeswalker && !retroLayout) drawPlaneswalkerRows(ctx, lay, L);
    drawText(ctx, lay, symbols, { flavorBar: opts.flavorBar !== false });
    model.textCap = lay.cap;
  }

  // P/T bzw. Loyalität
  if (L.kind === 'pw') {
    drawPwShield(ctx, face.loyalty, L.shield);
  } else if (flags.planeswalker && L.ptPlate) {
    drawLoyaltyShield(ctx, face.loyalty, L);
  } else if (flags.pt || flags.planeswalker) {
    const pt = flags.planeswalker ? String(face.loyalty) : `${face.power}/${face.toughness}`;
    if (retro) {
      drawFittedLine(ctx, pt, L.pt.family, L.pt.cap, L.pt.cx, L.pt.baseline, 260,
        { align: 'center', color: headColor, shadow: headShadow });
    } else {
      const b = L.ptPlate;
      drawFittedLine(ctx, pt, L.pt.family, L.pt.cap, b.x + b.w / 2, b.y + b.h / 2 + L.pt.baselineOffset, b.w - 50,
        { align: 'center', color: flags.vehicle ? VEHICLE_PT.text : '#111' });
    }
  }

  if (flags.holo) drawHolo(ctx, L);
  drawInfo(ctx, model);
  ctx.restore();
  return model;
}

function drawPlaneswalkerRows(ctx, lay, L) {
  const blocks = lay.blocks.filter((b) => b.para.kind === 'rules');
  const box = L.box;
  const c = lay.cap;
  const lh = c * lay.M.lineHeight;
  // sichtbare Ober-/Unterkante jedes Absatzes
  const spans = blocks.map((b) => ({
    top: b.lines[0].baseline + lay.offset - c,
    bottom: b.lines[b.lines.length - 1].baseline + lay.offset + c * lay.M.descent,
  }));
  ctx.save();
  blocks.forEach((b, i) => {
    const y0 = i === 0 ? box.y + 8 : (spans[i - 1].bottom + spans[i].top) / 2;
    const y1 = i === blocks.length - 1 ? box.y + box.h - 8 : (spans[i].bottom + spans[i + 1].top) / 2;
    if (i % 2 === 1) {
      ctx.fillStyle = 'rgba(0,0,0,0.07)';
      ctx.fillRect(box.x + 8, y0, box.w - 16, y1 - y0);
    }
    if (b.para.loyalty) {
      drawLoyaltyCost(ctx, b.para.loyalty, box.x + 66, (spans[i].top + spans[i].bottom) / 2 + (lh - c) * 0);
    }
  });
  ctx.restore();
}

function basicLandSymbol(face) {
  const m = face.produced_mana || [];
  if (m.length === 1) return `{${m[0]}}`;
  const ci = face.color_identity || [];
  if (ci.length === 1) return `{${ci[0]}}`;
  return '{C}';
}
