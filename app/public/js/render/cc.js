// Rahmen aus den Card-Conjurer-Assets (Ordner Assets/, ausgeliefert unter /cc/img).
//
// Die Auswahl der Ebenen folgt der Auto-Frame-Logik von Card Conjurer
// (cardFrameProperties / autoM15NewFrame / auto8thEditionFrame / autoSeventhEditionFrame
// in Assets/js/creator-23.js), wird aber aus den Scryfall-Daten des gewählten Drucks
// gespeist (Farben, Typzeile, Rahmenjahr, Rahmeneffekte, Set). Jede Ebene ist ein
// kartengroßes Bild, das durch eine oder mehrere Masken gezeichnet wird – genau wie
// drawFrames() in Card Conjurer.
import { loadImage } from './assets.js';

let statusPromise = null;
export function ccStatus() {
  statusPromise ||= fetch('/api/cc').then((r) => r.json()).catch(() => ({ available: false }));
  return statusPromise;
}

const IMG = '/cc/img/frames';
const RIGHT_HALF = `${IMG}/maskRightHalf.png`;
const WUBRG = ['W', 'U', 'B', 'R', 'G'];

// Card Conjurer sortiert Farbpaare so, dass die linke Rahmenhälfte die erste Farbe zeigt.
const PAIR_ORDER = ['WU', 'WB', 'UB', 'UR', 'BR', 'BG', 'RG', 'RW', 'GW', 'GU'];
function orderColors(colors) {
  const c = WUBRG.filter((x) => colors.includes(x));
  if (c.length !== 2) return c;
  return PAIR_ORDER.includes(c.join('')) ? c : [c[1], c[0]];
}

/** Port von cardFrameProperties() aus creator-23.js */
export function frameProperties(colors, manaCost, typeLine, power, style) {
  colors = orderColors(colors);
  const isHybrid = /\{[^}]*\/[^}]*\}/.test(manaCost || '');
  const land = typeLine.includes('Land');
  let rules;
  if (style === 'Seventh') {
    if (land) rules = colors.length === 0 || colors.length > 2 ? 'L' : `${colors[0]}L`;
    else if (colors.length === 1) rules = colors[0];
    else if (colors.length >= 2) rules = 'M';
    else if (typeLine.includes('Artifact')) rules = 'A';
    else rules = 'C';
  } else if (land) {
    rules = colors.length === 0 ? 'L' : colors.length > 2 ? 'ML' : `${colors[0]}L`;
  } else if (colors.length > 2) rules = 'M';
  else if (colors.length) rules = colors[0];
  else rules = 'A';

  let rulesRight = null;
  if (colors.length === 2) {
    if (land) rulesRight = `${colors[1]}L`;
    else if (style !== 'Seventh') rulesRight = colors[1];
  }
  let pinline = rules;
  let pinlineRight = rulesRight;
  if (style === 'Seventh' && land && colors.length >= 2) { pinline = 'L'; pinlineRight = null; }

  let typeTitle;
  if (colors.length >= 2) {
    typeTitle = isHybrid || land ? (colors.length >= 3 ? 'M' : 'L') : 'M';
  } else if (land) typeTitle = colors.length === 0 ? 'L' : `${colors[0]}L`;
  else if (colors.length === 1) typeTitle = colors[0];
  else typeTitle = 'A';

  let pt = null;
  if (power != null) {
    if (typeLine.includes('Vehicle')) pt = 'V';
    else if (typeTitle === 'L') pt = 'C';
    else pt = typeTitle;
  }

  let frame;
  if (style === 'Seventh') frame = land ? 'L' : pinline;
  else if (land) frame = 'L';
  else if (typeLine.includes('Vehicle')) frame = 'V';
  else if (typeLine.includes('Artifact')) frame = 'A';
  else if (colors.length > 2) frame = 'M';
  else if (colors.length === 2) frame = isHybrid ? colors[0] : 'M';
  else if (colors.length === 1) frame = colors[0];
  else frame = 'L';

  let frameRight = null;
  if (!(typeLine.includes('Vehicle') || typeLine.includes('Artifact')) && colors.length === 2 && isHybrid) frameRight = colors[1];

  return { pinline, pinlineRight, rules, rulesRight, typeTitle, pt, frame, frameRight, colors };
}

/** Farben für die Rahmenwahl – Länder nach erzeugtem Mana (wie autoFrame in Card Conjurer) */
export function frameColorsFor(card, face) {
  const type = face.type_line || '';
  if (/\bLand\b/.test(type)) {
    const text = (face.oracle_text || '').toLowerCase();
    let cols = (card.produced_mana || []).filter((c) => WUBRG.includes(c));
    if (/any color|any one color|choose a color|any combination of colors/.test(text)) cols = [...WUBRG];
    if (!cols.length) {
      const basics = { W: 'plains', U: 'island', B: 'swamp', R: 'mountain', G: 'forest' };
      cols = WUBRG.filter((c) => text.includes(basics[c]) || type.toLowerCase().includes(basics[c]));
      if (!cols.length && text.includes('search') && !text.includes('into your hand') && !/basic land card/.test(text)) cols = [];
    }
    return cols;
  }
  const fromCost = WUBRG.filter((c) => (face.mana_cost || '').toUpperCase().includes(c));
  if (fromCost.length) return fromCost;
  return WUBRG.filter((c) => (face.colors || []).includes(c));
}

// ---------- Ebenen-Bausteine ----------

const lc = (s) => s.toLowerCase();

/** M15 „new“ (Card Conjurer: makeM15NewFrameByLetter) */
function m15Layer(letter, mask, right, style) {
  letter = letter.toUpperCase();
  if (letter.length === 2) letter = letter.split('').reverse().join(''); // "WL" -> "LW" (Dateiname lw.png)
  if ((mask.includes('Crown') || mask === 'PT' || mask === 'Stamp') && letter.length > 1 && letter.includes('L')) letter = letter[1];
  const rh = right ? [RIGHT_HALF] : [];
  if (mask === 'Crown Border Cover') return { fill: '#000', bounds: { x: 0, y: 0, width: 1, height: 137 / 2814 } };
  if (mask === 'Crown') {
    return { src: `${IMG}/m15/crowns/new/${lc(letter === 'V' ? 'A' : letter)}.png`, masks: rh, bounds: { x: 44 / 2010, y: 53 / 2814, width: 1922 / 2010, height: 493 / 2814 } };
  }
  if (mask === 'Inner Crown') {
    return { src: `${IMG}/m15/innerCrowns/new/${lc(style)}/${lc(letter === 'V' ? 'A' : letter)}.png`, masks: rh, bounds: { x: 329 / 2010, y: 70 / 2814, width: 1353 / 2010, height: 64 / 2814 } };
  }
  if (mask === 'PT') {
    return { src: `${IMG}/m15/regular/m15PT${letter}.png`, masks: [], bounds: { x: 0.7573, y: 0.8848, width: 0.188, height: 0.0733 } };
  }
  if (mask === 'Stamp') {
    const l = letter === 'V' ? 'A' : letter;
    return { src: `${IMG}/m15/holoStamps/m15HoloStamp${l}.png`, masks: [], bounds: { x: 0.436, y: 0.9034, width: 0.128, height: 0.0458 } };
  }
  let dir = style === 'regular' ? '' : `${lc(style)}/`;
  // Nyx gibt es nicht für Länder/Fahrzeuge -> regulär
  if (style === 'nyx' && !['W', 'U', 'B', 'R', 'G', 'M', 'A'].includes(letter)) dir = '';
  if (style === 'snow' && ['V', 'C'].includes(letter)) dir = '';
  return { src: `${IMG}/m15/new/${dir}${lc(letter)}.png`, masks: [`${IMG}/m15/new/${lc(mask)}.png`, ...rh] };
}

/** Devoid (Card Conjurer: packM15Devoid) – durchscheinender Rahmen über dem Artwork */
function devoidLayer(letter, mask, right) {
  const l = letter.length > 1 ? 'L' : letter === 'V' ? 'A' : letter === 'C' ? 'L' : letter;
  const rh = right ? [RIGHT_HALF] : [];
  return { src: `${IMG}/m15/devoid/m15DevoidFrame${l}.png`, masks: [`${IMG}/m15/regular/m15Mask${mask}.png`, ...rh] };
}

/** 8th Edition 2003–2014 (Card Conjurer: make8thEditionFrameByLetter) */
function eighthLayer(letter, mask, right) {
  letter = letter.toUpperCase();
  if (mask === 'PT') {
    if (letter.length > 1) letter = letter[0];
    else if (letter === 'C') letter = 'L';
  }
  if (letter === 'V') letter = 'A';
  if (mask === 'PT') return { src: `${IMG}/8th/pt/${lc(letter)}.png`, masks: [], bounds: { x: 0.7227, y: 0.8796, width: 0.2147, height: 0.0839 } };
  const masks = [`${IMG}/8th/${lc(mask)}.${mask === 'Border' ? 'svg' : 'png'}`];
  if (right) masks.push(RIGHT_HALF);
  return { src: `${IMG}/8th/${lc(letter)}.png`, masks };
}

/** 7th Edition 1997–2003 (Card Conjurer: makeSeventhEditionFrameByLetter) */
function seventhLayer(letter, mask, right) {
  letter = letter.toUpperCase();
  if (letter === 'V') letter = 'A';
  if (letter === 'ML') letter = 'L';
  const file = mask === 'Textbox Pinline' ? 'trim' : lc(mask);
  const masks = [`${IMG}/seventh/regular/${file}.svg`];
  if (right) masks.push(RIGHT_HALF);
  return { src: `${IMG}/seventh/regular/${lc(letter)}.png`, masks };
}

// ---------- Stapel je Rahmenstil (Reihenfolge: oben -> unten, wie in Card Conjurer) ----------

function m15Stack(p, { legendary, style, stamp, devoid }) {
  const L = (letter, mask, right = false) => m15Layer(letter, mask, right, style);
  const out = [];
  if (legendary) {
    if (style === 'nyx') {
      if (p.pinlineRight) out.push(L(p.pinlineRight, 'Inner Crown', true));
      out.push(L(p.pinline, 'Inner Crown'));
    }
    if (p.pinlineRight) out.push(L(p.pinlineRight, 'Crown', true));
    out.push(L(p.pinline, 'Crown'));
    out.push(L(p.pinline, 'Crown Border Cover'));
  }
  if (p.pt) out.push(devoid ? { src: `${IMG}/m15/devoid/m15DevoidPT.png`, masks: [], bounds: { x: 0.7573, y: 0.8848, width: 0.188, height: 0.0733 } } : L(p.pt, 'PT'));
  if (stamp) out.push(L(p.frame, 'Stamp'));
  if (p.pinlineRight) out.push(L(p.pinlineRight, 'Pinline', true));
  out.push(L(p.pinline, 'Pinline'));
  out.push(L(p.typeTitle, 'Type'));
  out.push(L(p.typeTitle, 'Title'));
  if (p.pinlineRight) out.push(L(p.rulesRight, 'Rules', true));
  out.push(L(p.rules, 'Rules'));
  if (devoid) {
    out.push({ ...devoidLayer(p.frame, 'Frame', false), devoid: true });
  } else {
    if (p.frameRight) out.push(L(p.frameRight, 'Frame', true));
    out.push(L(p.frame, 'Frame'));
  }
  out.push(L(p.frame, 'Border'));
  return out;
}

function eighthStack(p) {
  const out = [];
  if (p.pt) out.push(eighthLayer(p.pt, 'PT'));
  if (p.pinlineRight) out.push(eighthLayer(p.pinlineRight, 'Pinline', true));
  out.push(eighthLayer(p.pinline, 'Pinline'));
  out.push(eighthLayer(p.typeTitle, 'Type'));
  out.push(eighthLayer(p.typeTitle, 'Title'));
  if (p.pinlineRight) out.push(eighthLayer(p.rulesRight, 'Rules', true));
  out.push(eighthLayer(p.rules, 'Rules'));
  if (p.frameRight) out.push(eighthLayer(p.frameRight, 'Frame', true));
  out.push(eighthLayer(p.frame, 'Frame'));
  out.push(eighthLayer(p.frame, 'Border'));
  return out;
}

function seventhStack(p) {
  const out = [];
  out.push(seventhLayer(p.pinline, 'Pinline'));
  if (p.rulesRight) out.push(seventhLayer(p.rulesRight, 'Rules', true));
  out.push(seventhLayer(p.rules, 'Rules'));
  out.push(seventhLayer(p.frame, 'Frame'));
  out.push(seventhLayer(p.pinline, 'Textbox Pinline'));
  out.push(seventhLayer(p.frame, 'Border'));
  return out;
}

// Alpha, Beta, Unlimited (+ Collectors' Editions) haben den ABU-Rahmen, alle übrigen
// 1993er-Rahmen (Revised, 4th, 5th, Ice Age …) den „Fourth“-Rahmen.
const ABU_SETS = new Set(['lea', 'leb', '2ed', 'ced', 'cei']);

function oldStack(p, card, colors, type, border) {
  const abu = ABU_SETS.has(card.set);
  const land = /\bLand\b/.test(type);
  let letter;
  if (land) letter = abu && colors.length === 1 ? `${lc(colors[0])}l` : 'l';
  else if (colors.length > 1) letter = 'm';
  else if (colors.length === 1) letter = lc(colors[0]);
  else letter = 'a';
  if (abu && letter === 'm') letter = 'a';
  const dir = abu ? 'abu' : 'fourth';
  const out = [];
  // Rand (Card Conjurer: "Pure Black Border"/"White Border" bzw. borderBlack/borderWhite)
  if (abu) out.push({ fill: border.color, masks: [`${IMG}/old/abu/border.svg`] });
  else out.push({ src: `${IMG}/old/fourth/border${border.key === 'white' ? 'White' : 'Black'}.png`, masks: [] });
  if (abu && land && colors.length === 2) {
    // Dual Lands: zweite Farbe über die Dual-Land-Maske
    out.push({ src: `${IMG}/old/abu/${lc(colors[1])}l.png`, masks: [`${IMG}/old/abu/dualLand.png`] });
    letter = `${lc(colors[0])}l`;
  }
  out.push({ src: `${IMG}/old/${dir}/${letter}.png`, masks: [] });
  return out;
}

/**
 * Liefert die Ebenen (oben -> unten) für das Modell oder null, wenn der Stil
 * (noch) nicht aus Card-Conjurer-Assets gebaut werden kann.
 */
export function ccLayers(model) {
  const { card, face, layout: L, flags } = model;
  const type = face.type_line || '';
  const colors = frameColorsFor(card, face);
  const power = face.power ?? null;
  const fx = card.frame_effects || [];
  if (L.kind && L.kind !== 'normal') return null; // Spezial-Layouts zeichnet weiterhin der Code-Renderer
  if (L.style === 'm15') {
    const p = frameProperties(colors, face.mana_cost, type, power);
    let style = 'regular';
    if (fx.includes('snow') || /\bSnow\b/.test(type)) style = 'snow';
    else if (model.palettes[0].variant === 'nyx') style = 'nyx';
    return m15Stack(p, {
      legendary: flags.legendary,
      style,
      stamp: flags.holo,
      devoid: model.palettes[0].variant === 'devoid',
    });
  }
  if (L.style === 'm2003') return eighthStack(frameProperties(colors, face.mana_cost, type, power));
  if (L.style === 'retro' && L.variant === '97') return seventhStack(frameProperties(colors, face.mana_cost, type, power, 'Seventh'));
  if (L.style === 'retro' && L.variant === '93') return oldStack(null, card, orderColors(colors), type, { key: model.borderKey, color: model.borderColor });
  return null;
}

// Bildfenster der Card-Conjurer-Rahmen (card.artBounds der jeweiligen Version)
const ART_BOUNDS = {
  m15: { x: 0.0767, y: 0.1129, width: 0.8476, height: 0.4429 },
  m2003: { x: 0.088, y: 0.12, width: 0.824, height: 0.4348 },
  retro97: { x: 0.12, y: 0.0991, width: 0.7667, height: 0.4429 },
  fourth: { x: 0.1034, y: 0.0886, width: 0.794, height: 0.4543 },
  abu: { x: 0.116, y: 0.1043, width: 0.7654, height: 0.441 },
};

/** Artwork-Box in Kartenkoordinaten (leicht vergrößert, damit keine Lücken entstehen) */
export function ccArtBounds(model, L) {
  let key = L.style === 'm15' ? 'm15' : L.style === 'm2003' ? 'm2003' : L.variant === '97' ? 'retro97' : ABU_SETS.has(model.card.set) ? 'abu' : 'fourth';
  const b = ART_BOUNDS[key];
  const pad = 2;
  return { x: b.x * L.W - pad, y: b.y * L.H - pad, w: b.width * L.W + pad * 2, h: b.height * L.H + pad * 2 };
}

/** Lädt alle Bilder der Ebenen; null, wenn eines fehlt. */
export async function loadLayers(layers) {
  try {
    return await Promise.all(layers.map(async (l) => ({
      ...l,
      image: l.src ? await loadImage(l.src) : null,
      maskImages: await Promise.all((l.masks || []).map((m) => loadImage(m))),
    })));
  } catch (err) {
    console.warn('Card-Conjurer-Ebene fehlt:', err.message);
    return null;
  }
}

/**
 * Setzt die Ebenen wie drawFrames() in Card Conjurer zusammen: Jede Ebene wird
 * durch ihre Masken (Alpha-Schnittmenge) gezeichnet; unterste Ebene zuerst.
 * Zeichnet in Kartenkoordinaten (W × H) auf ctx; scale = Ausgabeauflösung.
 */
export function drawLayers(ctx, layers, W, H, scale, { borderColor } = {}) {
  const cw = Math.round(W * scale);
  const ch = Math.round(H * scale);
  const frame = document.createElement('canvas');
  frame.width = cw; frame.height = ch;
  const fx = frame.getContext('2d');
  const tmp = document.createElement('canvas');
  tmp.width = cw; tmp.height = ch;
  const tx = tmp.getContext('2d');
  fx.imageSmoothingQuality = 'high';
  tx.imageSmoothingQuality = 'high';
  for (const l of [...layers].reverse()) {
    const b = l.bounds || { x: 0, y: 0, width: 1, height: 1 };
    tx.globalCompositeOperation = 'source-over';
    tx.clearRect(0, 0, cw, ch);
    tx.fillStyle = '#000';
    tx.fillRect(0, 0, cw, ch);
    tx.globalCompositeOperation = 'source-in';
    for (const m of l.maskImages || []) tx.drawImage(m, 0, 0, cw, ch);
    const rect = [Math.round(b.x * cw), Math.round(b.y * ch), Math.round(b.width * cw), Math.round(b.height * ch)];
    if (l.image) tx.drawImage(l.image, ...rect);
    else {
      tx.fillStyle = l.fill || '#000';
      tx.fillRect(...rect);
    }
    fx.drawImage(tmp, 0, 0);
  }
  // Randfarbe (weiß/silber/gold): Card-Conjurer-Rahmen haben immer einen schwarzen Rand
  if (borderColor) recolorBorder(fx, cw, ch, borderColor, layers);
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(frame, 0, 0);
  ctx.restore();
}

/** Färbt die Border-Maske der Ebene "Border" (falls vorhanden) in der Randfarbe ein. */
function recolorBorder(fx, cw, ch, color, layers) {
  const border = layers.find((l) => (l.masks || []).some((m) => /border\.(png|svg)$/i.test(m) || /MaskBorder\.png$/.test(m)));
  if (!border) return;
  const c = document.createElement('canvas');
  c.width = cw; c.height = ch;
  const x = c.getContext('2d');
  for (const m of border.maskImages) x.drawImage(m, 0, 0, cw, ch);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, cw, ch);
  fx.drawImage(c, 0, 0);
}
