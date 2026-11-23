import { mkCanvas } from './canvas.js';
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
const ART_M15 = { x: 0.0767, y: 0.1129, width: 0.8476, height: 0.4429 };
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
  if (!colors.length && !typeLine.includes('Land') && !typeLine.includes('Artifact') && style !== 'Seventh' && style !== 'Eighth') {
    return { pinline: 'C', pinlineRight: null, rules: 'C', rulesRight: null, typeTitle: 'C', pt: power != null ? 'C' : null, frame: 'C', frameRight: null, colors };
  }
  const isHybrid = /\{[WUBRG2C]\/[WUBRG]\}/.test(manaCost || ''); // {W/P} (phyrexisch) ist kein Hybrid
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
function eighthLayer(letter, mask, right, colorshifted = false) {
  letter = letter.toUpperCase();
  if (mask === 'PT') {
    if (letter.length > 1) letter = letter[0];
    else if (letter === 'C') letter = 'L';
  }
  if (letter === 'V') letter = 'A';
  if (mask === 'PT') return { src: `${IMG}/8th/pt/${lc(letter)}.png`, masks: [], bounds: { x: 0.7227, y: 0.8796, width: 0.2147, height: 0.0839 } };
  // Planar Chaos "colorshifted": eigener Rahmen für einfarbige Karten
  if (colorshifted && mask === 'Frame' && 'WUBRG'.includes(letter) && letter.length === 1) {
    return { src: `${IMG}/8th/colorshifted/${lc(letter)}.png`, masks: [`${IMG}/8th/frame.png`, ...(right ? [RIGHT_HALF] : [])] };
  }
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

function m15Stack(p, { legendary, style, stamp, devoid, miracle, companion }) {
  const L = (letter, mask, right = false) => m15Layer(letter, mask, right, style);
  const out = [];
  if (legendary) {
    if (companion) {
      if (p.pinlineRight) out.push(m15Layer(p.pinlineRight, 'Inner Crown', true, 'companion'));
      out.push(m15Layer(p.pinline, 'Inner Crown', false, 'companion'));
    } else if (style === 'nyx') {
      if (p.pinlineRight) out.push(L(p.pinlineRight, 'Inner Crown', true));
      out.push(L(p.pinline, 'Inner Crown'));
    }
    if (p.pinlineRight) out.push(L(p.pinlineRight, 'Crown', true));
    out.push(L(p.pinline, 'Crown'));
    out.push(L(p.pinline, 'Crown Border Cover'));
  }
  if (p.pt) out.push(devoid ? { src: `${IMG}/m15/devoid/m15DevoidPT.png`, masks: [], bounds: { x: 0.7573, y: 0.8848, width: 0.188, height: 0.0733 } } : L(p.pt, 'PT'));
  if (stamp) out.push(L(p.frame, 'Stamp'));
  if (miracle) {
    // Miracle-Überlagerung (Card Conjurer packM15Miracle) über Titel und Bildrahmen
    const l = ({ WL: 'L', UL: 'L', BL: 'L', RL: 'L', GL: 'L', ML: 'L', V: 'A', C: 'A' })[p.pinline] || p.pinline;
    out.push({ src: `${IMG}/m15/miracle/${lc(l)}.png`, masks: [], bounds: { x: 0.04, y: 0.0286, width: 0.92, height: 0.5324 } });
  }
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

function eighthStack(p, colorshifted = false) {
  const out = [];
  if (p.pt) out.push(eighthLayer(p.pt, 'PT'));
  if (p.pinlineRight) out.push(eighthLayer(p.pinlineRight, 'Pinline', true));
  out.push(eighthLayer(p.pinline, 'Pinline'));
  out.push(eighthLayer(p.typeTitle, 'Type'));
  out.push(eighthLayer(p.typeTitle, 'Title'));
  if (p.pinlineRight) out.push(eighthLayer(p.rulesRight, 'Rules', true));
  out.push(eighthLayer(p.rules, 'Rules'));
  if (p.frameRight) out.push(eighthLayer(p.frameRight, 'Frame', true, colorshifted));
  out.push(eighthLayer(p.frame, 'Frame', false, colorshifted));
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


// ---------- Spezial-Layouts (Frame-Packs von Card Conjurer) ----------
// Jeder Pack: Rahmenbild je Farbbuchstabe + Masken je Rahmenbereich.
const P = `${IMG}`;
const PACKS = {
  pw: {
    file: (l) => `${P}/planeswalker/regular/planeswalkerFrame${l}.png`, letters: 'WUBRGMA',
    masks: { Pinline: `${P}/planeswalker/regular/planeswalkerMaskPinline.png`, Title: `${P}/planeswalker/regular/planeswalkerMaskTitle.png`, Type: `${P}/planeswalker/regular/planeswalkerMaskType.png` },
    art: { x: 0.068, y: 0.101, width: 0.864, height: 0.8143 },
  },
  pw4: {
    file: (l) => `${P}/planeswalker/tall/planeswalkerTall${l}.png`, letters: 'WUBRGMAL',
    masks: { Pinline: `${P}/planeswalker/tall/planeswalkerTallMaskPinline.png`, Title: `${P}/planeswalker/regular/planeswalkerMaskTitle.png`, Type: `${P}/planeswalker/tall/planeswalkerTallMaskType.png` },
    art: { x: 0.068, y: 0.101, width: 0.864, height: 0.8143 },
  },
  saga: {
    file: (l) => (l === 'L' ? `${P}/saga/regular/l.png` : `${P}/saga/regular/sagaFrame${l}.png`), letters: 'WUBRGMAL',
    masks: { Pinline: `${P}/saga/sagaMaskPinline.png`, Title: `${P}/m15/regular/m15MaskTitle.png`, Type: `${P}/saga/sagaMaskType.png`, Rules: `${P}/saga/sagaMaskText.png`, RulesRight: `${P}/saga/sagaMaskTextRight.png` },
    art: { x: 0.5, y: 0.1124, width: 0.4247, height: 0.7253 },
    stamp: { src: `${P}/saga/stamp.png`, bounds: { x: 0.438, y: 0.912, width: 0.124, height: 0.0372 } },
  },
  class: {
    file: (l) => `${P}/class/${lc(l)}.png`, letters: 'WUBRGMAL',
    masks: { Pinline: `${P}/class/pinline.svg`, Title: `${P}/m15/regular/m15MaskTitle.png`, Type: `${P}/saga/sagaMaskType.png`, Rules: `${P}/class/text.svg`, RulesRight: `${P}/class/textRight.png` },
    art: { x: 0.0753, y: 0.1124, width: 0.4247, height: 0.7253 },
  },
  adventure: {
    file: (l) => `${P}/adventure/regular/${lc(l)}.png`, letters: 'WUBRGMAL',
    masks: { Pinline: `${P}/adventure/regular/pinline.svg`, Title: `${P}/m15/regular/m15MaskTitle.png`, Type: `${P}/m15/regular/m15MaskType.png`, Rules: `${P}/adventure/regular/book.svg`, RulesLeft: `${P}/adventure/regular/bookLeft.png` },
    art: ART_M15, pt: true,
  },
  transformFront: {
    file: (l) => `${P}/m15/transform/regular/front${l}.png`, letters: 'WUBRGMAL',
    masks: { Pinline: `${P}/m15/transform/regular/maskPinlineFront.png`, Title: `${P}/m15/transform/regular/maskTitle.png`, Type: `${P}/m15/regular/m15MaskType.png`, Rules: `${P}/m15/transform/regular/maskRulesFront.png` },
    art: ART_M15, pt: true, crown: true,
  },
  transformBack: {
    file: (l) => `${P}/m15/transform/regular/back${l}.png`, letters: 'WUBRGMAL',
    masks: { Pinline: `${P}/m15/transform/regular/maskPinlineBack.png`, Title: `${P}/m15/transform/regular/maskTitle.png`, Type: `${P}/m15/regular/m15MaskType.png`, Rules: `${P}/m15/regular/m15MaskRules.png` },
    art: ART_M15, pt: (l) => `${P}/m15/transform/regular/pt${l === 'C' || l === 'L' ? 'A' : l}.png`, crown: true,
  },
  modalFront: {
    file: (l) => `${P}/modal/regular/${lc(l)}.png`, letters: 'WUBRGMAL',
    masks: { Pinline: `${P}/modal/regular/pinline.svg`, Title: `${P}/modal/regular/title.svg`, Type: `${P}/m15/regular/m15MaskType.png`, Rules: `${P}/modal/regular/textbox.svg`, Flipside: `${P}/modal/regular/reminder.svg` },
    art: ART_M15, pt: true, crown: true,
  },
  modalBack: {
    file: (l) => `${P}/modal/regular/${lc(l)}b.png`, letters: 'WUBRGMAL',
    masks: { Pinline: `${P}/modal/regular/pinline.svg`, Title: `${P}/modal/regular/title.svg`, Type: `${P}/m15/regular/m15MaskType.png`, Rules: `${P}/modal/regular/textbox.svg`, Flipside: `${P}/modal/regular/reminder.svg` },
    art: ART_M15, pt: true, crown: true,
  },
};

/** Buchstaben auf die im Pack vorhandenen Dateien abbilden */
function packLetter(pack, l) {
  if (!l) return null;
  l = l.toUpperCase();
  if (l.length > 1) l = pack.letters.includes('L') ? 'L' : l[0];
  if (l === 'V') l = 'A';
  if (!pack.letters.includes(l)) l = l === 'C' || l === 'L' ? (pack.letters.includes('L') ? 'L' : 'A') : 'A';
  return l;
}

function packStack(pack, p, { legendary, stamp, leftPage = null, flipside = null }) {
  const F = (l, mask, right = false) => {
    const m = pack.masks[mask];
    return { src: pack.file(packLetter(pack, l)), masks: m ? [m, ...(right ? [RIGHT_HALF] : [])] : (right ? [RIGHT_HALF] : []) };
  };
  const out = [];
  if (legendary && pack.crown) {
    if (p.pinlineRight) out.push(m15Layer(p.pinlineRight, 'Crown', true, 'regular'));
    out.push(m15Layer(p.pinline, 'Crown', false, 'regular'));
    out.push(m15Layer(p.pinline, 'Crown Border Cover', false, 'regular'));
  }
  if (pack.pt && p.pt) {
    out.push(typeof pack.pt === 'function'
      ? { src: pack.pt(packLetter(pack, p.pt)), masks: [], bounds: { x: 0.7573, y: 0.8848, width: 0.188, height: 0.0733 } }
      : m15Layer(p.pt, 'PT', false, 'regular'));
  }
  if (stamp) out.push(pack.stamp ? { ...pack.stamp, masks: [] } : m15Layer(p.frame, 'Stamp', false, 'regular'));
  if (p.pinlineRight) out.push(F(p.pinlineRight, 'Pinline', true));
  out.push(F(p.pinline, 'Pinline'));
  out.push(F(p.typeTitle, 'Type'));
  out.push(F(p.typeTitle, 'Title'));
  // Modal DFC: Lasche unten links in der Farbe der anderen Seite (Maske "Flipside")
  if (flipside && pack.masks.Flipside) out.push({ src: pack.file(packLetter(pack, flipside)), masks: [pack.masks.Flipside] });
  // Adventure: linke Buchseite (Leisten + Seite) in der Farbe des Abenteuers (Maske "Rules (Left)")
  if (leftPage && pack.masks.RulesLeft) out.push({ src: pack.file(packLetter(pack, leftPage)), masks: [pack.masks.RulesLeft] });
  if (pack.masks.Rules) {
    if (p.rulesRight) out.push(pack.masks.RulesRight ? { src: pack.file(packLetter(pack, p.rulesRight)), masks: [pack.masks.RulesRight] } : F(p.rulesRight, 'Rules', true));
    out.push(F(p.rules, 'Rules'));
  }
  if (p.frameRight) out.push({ src: pack.file(packLetter(pack, p.frameRight)), masks: [RIGHT_HALF] });
  // ganzes Rahmenbild (Rahmen + Rand) als unterste Ebene
  out.push({ src: pack.file(packLetter(pack, p.frame)), masks: [] });
  return out;
}

function packFor(model) {
  const { layout: L, card, faceIdx } = model;
  if (L.style !== 'm15') return null;
  if (L.kind === 'pw') return L.typePlate.y < 1100 ? PACKS.pw4 : PACKS.pw; // pw4 = 4 Fähigkeiten (hoher Rahmen)
  if (L.kind === 'saga') return PACKS.saga;
  if (L.kind === 'class') return PACKS.class;
  if (L.kind === 'adventure') return PACKS.adventure;
  if (L.kind) return null; // Split/Battle: Code-Renderer
  if (card.layout === 'transform') return faceIdx === 1 ? PACKS.transformBack : PACKS.transformFront;
  if (card.layout === 'modal_dfc') return faceIdx === 1 ? PACKS.modalBack : PACKS.modalFront;
  return null;
}

/** true, wenn der Rahmen aus einem Transform-/Modal-DFC-Pack kommt (Symbolkreis bzw. Pfeil + Lasche im Bild). */
export function ccDfcFrame(model) {
  const p = packFor(model);
  return p === PACKS.transformFront || p === PACKS.transformBack || p === PACKS.modalFront || p === PACKS.modalBack;
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
  const pack = packFor(model);
  if (pack) {
    let leftPage = null;
    const adv = pack === PACKS.adventure && card.card_faces?.[1];
    if (adv) leftPage = frameProperties(frameColorsFor(card, adv), adv.mana_cost, adv.type_line || '', null).rules;
    let flipside = null;
    const other = (pack === PACKS.modalFront || pack === PACKS.modalBack) && card.card_faces?.[1 - model.faceIdx];
    if (other) {
      const oc = frameColorsFor(card, other);
      flipside = oc.length === 1 ? oc[0] : oc.length > 1 ? 'M' : /\bLand\b/.test(other.type_line || '') ? 'L' : 'A';
    }
    return packStack(pack, frameProperties(colors, face.mana_cost, type, power), { legendary: flags.legendary, stamp: flags.holo, leftPage, flipside });
  }
  if (L.kind && L.kind !== 'normal') return null; // Split/Battle zeichnet weiterhin der Code-Renderer
  if (L.style === 'm15') {
    const p = frameProperties(colors, face.mana_cost, type, power);
    let style = 'regular';
    if (fx.includes('snow')) style = 'snow';
    else if (model.palettes[0].variant === 'nyx') style = 'nyx';
    return m15Stack(p, {
      legendary: flags.legendary,
      style,
      stamp: flags.holo,
      devoid: model.palettes[0].variant === 'devoid',
      miracle: fx.includes('miracle'),
      companion: fx.includes('companion'),
    });
  }
  if (L.style === 'm2003') return eighthStack(frameProperties(colors, face.mana_cost, type, power, 'Eighth'), fx.includes('colorshifted'));
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
  const pack = packFor(model);
  if (pack) {
    const b = pack.art;
    // Planeswalker: Artwork-Ausschnitt reicht nur bis zur Typzeile (darunter gespiegelt)
    const h = L.kind === 'pw' ? (L.artFit.y + L.artFit.h) / L.H - b.y : b.height;
    return { x: b.x * L.W - 2, y: b.y * L.H - 2, w: b.width * L.W + 4, h: h * L.H + 4 };
  }
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
      maskImages: await Promise.all((l.masks || []).map((m) => (typeof m === 'string' ? loadImage(m) : m.image))),
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
const bboxCache = new WeakMap();
/** Bounding Box (0..1) der deckenden Pixel eines Bildes – grob gemessen, gecacht. */
function alphaBBox(img) {
  if (bboxCache.has(img)) return bboxCache.get(img);
  const w = 188; const h = 263;
  const c = mkCanvas(w, h);
  const x = c.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  let x0 = w; let y0 = h; let x1 = -1; let y1 = -1;
  for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) {
    if (d[(y * w + xx) * 4 + 3] > 0) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  // eine Rasterzelle Sicherheitsrand
  const r = x1 < 0 ? null : { x0: Math.max(0, (x0 - 1) / w), y0: Math.max(0, (y0 - 1) / h), x1: Math.min(1, (x1 + 2) / w), y1: Math.min(1, (y1 + 2) / h) };
  bboxCache.set(img, r);
  return r;
}

const frameCache = new Map();
/** Rahmen vorab zusammensetzen (füllt den Cache) und die Rahmen-Canvas liefern. */
export function prepareLayers(layers, W, H, scale, opts = {}) {
  return drawLayers(null, layers, W, H, scale, opts);
}
export function drawLayers(ctx, layers, W, H, scale, { borderColor } = {}) {
  const cw = Math.round(W * scale);
  const ch = Math.round(H * scale);
  // fertig zusammengesetzte Rahmen wiederverwenden (z. B. beim Umschalten von Optionen)
  const key = `${cw}x${ch}|${borderColor || ''}|${layers.map((l) => `${l.src || l.fill}:${(l.masks || []).map((m) => (typeof m === 'string' ? m : m.key)).join(',')}:${JSON.stringify(l.bounds || '')}`).join(';')}`;
  let frame = frameCache.get(key);
  if (!frame) {
    frame = mkCanvas(cw, ch);
    const fx = frame.getContext('2d');
    const tmp = mkCanvas(cw, ch);
    const tx = tmp.getContext('2d');
    fx.imageSmoothingQuality = 'high';
    tx.imageSmoothingQuality = 'high';
    for (const l of [...layers].reverse()) {
      const b = l.bounds || { x: 0, y: 0, width: 1, height: 1 };
      // nur das Rechteck bearbeiten, in dem die Ebene sichtbar sein kann (Bounds ∩ Masken)
      let r = { x0: b.x, y0: b.y, x1: b.x + b.width, y1: b.y + b.height };
      for (const m of l.maskImages || []) {
        const mb = alphaBBox(m);
        if (!mb) { r = null; break; }
        r = { x0: Math.max(r.x0, mb.x0), y0: Math.max(r.y0, mb.y0), x1: Math.min(r.x1, mb.x1), y1: Math.min(r.y1, mb.y1) };
      }
      if (!r || r.x1 <= r.x0 || r.y1 <= r.y0) continue;
      const px = Math.max(0, Math.floor(r.x0 * cw)); const py = Math.max(0, Math.floor(r.y0 * ch));
      const pw = Math.min(cw, Math.ceil(r.x1 * cw)) - px; const ph = Math.min(ch, Math.ceil(r.y1 * ch)) - py;
      tx.save();
      tx.beginPath(); tx.rect(px, py, pw, ph); tx.clip();
      tx.globalCompositeOperation = 'source-over';
      tx.clearRect(px, py, pw, ph);
      tx.fillStyle = '#000';
      tx.fillRect(px, py, pw, ph);
      tx.globalCompositeOperation = 'source-in';
      for (const m of l.maskImages || []) tx.drawImage(m, 0, 0, cw, ch);
      const rect = [Math.round(b.x * cw), Math.round(b.y * ch), Math.round(b.width * cw), Math.round(b.height * ch)];
      if (l.image) tx.drawImage(l.image, ...rect);
      else {
        tx.fillStyle = l.fill || '#000';
        tx.fillRect(...rect);
      }
      tx.restore();
      fx.drawImage(tmp, px, py, pw, ph, px, py, pw, ph);
    }
    // Randfarbe (weiß/silber/gold): Card-Conjurer-Rahmen haben immer einen schwarzen Rand
    if (borderColor) recolorBorder(fx, cw, ch, borderColor, layers);
    if (frameCache.size >= 4) frameCache.delete(frameCache.keys().next().value);
    frameCache.set(key, frame);
  }
  if (!ctx) return frame;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(frame, 0, 0);
  ctx.restore();
  return frame;
}

/** Färbt die Border-Maske der Ebene "Border" (falls vorhanden) in der Randfarbe ein. */
function recolorBorder(fx, cw, ch, color, layers) {
  const border = layers.find((l) => (l.masks || []).some((m) => typeof m === 'string' && (/border\.(png|svg)$/i.test(m) || /MaskBorder\.png$/.test(m))));
  if (!border) return;
  const c = mkCanvas(cw, ch);
  const x = c.getContext('2d');
  for (const m of border.maskImages) x.drawImage(m, 0, 0, cw, ch);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = color;
  x.fillRect(0, 0, cw, ch);
  fx.drawImage(c, 0, 0);
}

// ---------- Wasserzeichen (Assets/img/watermarks, Card Conjurer) ----------

const WATERMARKS = [
  'ability-foretell', 'clan-abzan', 'clan-atarka', 'clan-dromoka', 'clan-jeskai', 'clan-kolaghan', 'clan-mardu',
  'clan-ojutai', 'clan-silumgar', 'clan-sultai', 'clan-temur', 'desparked-planeswalker', 'faction-agents-of-sneak',
  'faction-crossbreed-labs', 'faction-goblin-explosioneers', 'faction-league-of-dastardly-doom', 'faction-order-of-the-widget',
  'family-brokers', 'family-cabaretti', 'family-maestros', 'family-obscura', 'family-riveteers', 'guild-azorius',
  'guild-boros', 'guild-dimir', 'guild-golgari', 'guild-gruul', 'guild-izzet', 'guild-orzhov', 'guild-rakdos',
  'guild-selesnya', 'guild-simic', 'mirran', 'misc-dci', 'phyrexian', 'planeswalker', 'polis-akros', 'polis-meletis',
  'polis-setessa', 'school-lorehold', 'school-prismari', 'school-quandrix', 'school-silverquill', 'school-witherbloom',
];
const WM_INDEX = new Map(WATERMARKS.map((f) => [f.replace(/^(ability|clan|faction|family|guild|misc|polis|school)-/, '').replace(/-/g, ''), f]));
WM_INDEX.set('foretell', 'ability-foretell');

// Tönung je Farbe (wie die Farbwahl "Wasserzeichen links/rechts" in Card Conjurer)
const WM_TINT = { W: '#b89c5f', U: '#2a6cb0', B: '#4b4442', R: '#c43c22', G: '#2c7a43', M: '#b8913a', A: '#6f7f8c', L: '#80664a', C: '#8d8d8d' };

export function watermarkUrl(name) {
  const f = WM_INDEX.get(String(name || '').toLowerCase().replace(/[^a-z]/g, ''));
  return f ? `/cc/img/watermarks/${f}.svg` : null;
}

/** Zeichnet das Wasserzeichen ins Textfeld (Deckkraft 40 %, zweifarbig geteilt wie im Original). */
export async function drawWatermark(ctx, model, L, scale) {
  const url = watermarkUrl(model.card.watermark);
  if (!url || !L.box) return;
  const img = await loadImage(url).catch(() => null);
  if (!img) return;
  const props = frameProperties(frameColorsFor(model.card, model.face), model.face.mana_cost, model.face.type_line || '', null);
  const tint = (l) => WM_TINT[(l || 'C').replace(/L$/, '') || 'L'] || WM_TINT[l[0]] || WM_TINT.C;
  const left = tint(props.rules);
  const right = props.rulesRight ? tint(props.rulesRight) : null;
  // Bereich: Card Conjurer card.watermarkBounds (Mitte + Größe), sonst Textfeld
  const b = L.style === 'm15' ? { cx: 0.5 * L.W, cy: 0.7762 * L.H, w: 0.75 * L.W, h: 0.2305 * L.H }
    : L.style === 'm2003' ? { cx: 0.5 * L.W, cy: 0.7605 * L.H, w: 0.75 * L.W, h: 0.2305 * L.H }
      : { cx: L.box.x + L.box.w / 2, cy: L.box.y + L.box.h / 2, w: L.box.w * 0.75, h: L.box.h * 0.85 };
  const ar = (img.naturalWidth || img.width) / (img.naturalHeight || img.height);
  let w = b.w; let h = w / ar;
  if (h > b.h) { h = b.h; w = h * ar; }
  const c = mkCanvas(Math.ceil(w * scale), Math.ceil(h * scale));
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0, c.width, c.height);
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = left;
  x.fillRect(0, 0, c.width, c.height);
  if (right) {
    // rechte Kartenhälfte in der zweiten Farbe
    const split = (L.W / 2 - (b.cx - w / 2)) * scale;
    x.globalCompositeOperation = 'source-atop';
    x.fillStyle = right;
    x.fillRect(split, 0, c.width - split, c.height);
  }
  ctx.save();
  ctx.globalAlpha = 0.4;
  ctx.drawImage(c, b.cx - w / 2, b.cy - h / 2, w, h);
  ctx.restore();
}

/** Loyalitäts-Symbole der Planeswalker (Card Conjurer) */
export async function ccPwIcons(tall, model) {
  const pack = model && packFor(model);
  try {
    const [plus, minus, neutral] = await Promise.all(['Plus', 'Minus', 'Neutral'].map((n) => loadImage(`${IMG}/planeswalker/planeswalker${n}.png`)));
    const [lineOdd, lineEven, textMask] = await Promise.all([
      loadImage(`${IMG}/planeswalker/abilityLineOdd.png`),
      loadImage(`${IMG}/planeswalker/abilityLineEven.png`),
      loadImage(pack?.textMask || (tall ? `${IMG}/planeswalker/tall/planeswalkerTallMaskRules.png` : `${IMG}/planeswalker/text.svg`)),
    ]);
    const loyaltyMask = await loadImage(`${IMG}/planeswalker/maskLoyalty.png`).catch(() => null);
    return { plus, minus, neutral, lineOdd, lineEven, textMask, loyaltyMask };
  } catch { return null; }
}

// ---------- Farbabgleich der Rahmenbereiche mit dem Scan ----------

/**
 * Passt die Farbe jedes Rahmenbereichs (Textfeld, Leisten, Rahmen, Kontur, P/T-Box …) an den
 * Original-Scan an: je Bereich (= Maske der Card-Conjurer-Ebene bzw. Rechteck) werden Mittelwert
 * und Streuung je Farbkanal angeglichen (Farbton, Helligkeit und Kontrast der Struktur).
 * Gemessen wird nur im Inneren der Maske; Schrift/Symbole im Scan blendet ein
 * Helligkeits-Perzentil aus.
 * Muss nach dem Rahmen und vor Text/Symbolen aufgerufen werden.
 */
const alphaCache = new WeakMap();
/** Alphakanal einer Maske (Bild oder Rechteck) in der Größe w×h, gecacht. */
function maskAlpha(reg, w, h) {
  const keyObj = reg.img || reg;
  let per = alphaCache.get(keyObj);
  if (!per) { per = new Map(); alphaCache.set(keyObj, per); }
  const key = `${w}x${h}|${reg.rect ? JSON.stringify(reg.rect) : ''}`;
  if (per.has(key)) return per.get(key);
  const c = mkCanvas(w, h);
  const x = c.getContext('2d', { willReadFrequently: true });
  if (reg.rect) {
    const b = reg.rect;
    if (reg.img) x.drawImage(reg.img, b.x * w, b.y * h, b.width * w, b.height * h);
    else { x.fillStyle = '#000'; x.fillRect(b.x * w, b.y * h, b.width * w, b.height * h); }
  } else x.drawImage(reg.img, 0, 0, w, h);
  const d = x.getImageData(0, 0, w, h).data;
  const a = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) a[i] = d[i * 4 + 3];
  if (per.size > 6) per.clear();
  per.set(key, a);
  return a;
}

export function matchFrameColors(ctx, layers, scan, W, H, exclude = [], extraRects = []) {
  const cv = ctx.canvas;
  const cw = cv.width; const ch = cv.height;
  // Bereiche: erste Maske je Ebene (ohne Rechte-Hälfte-Maske) bzw. Rechteck (bounds)
  const regions = new Map();
  for (const l of layers) {
    const src = (l.masks || []).find((m) => typeof m === 'string' && !/maskRightHalf/.test(m));
    if (src) {
      const i = l.masks.indexOf(src);
      if (!regions.has(src)) regions.set(src, { img: l.maskImages[i] });
    } else if (l.bounds && l.image) {
      regions.set(`rect:${JSON.stringify(l.bounds)}`, { rect: l.bounds, img: l.image });
    }
  }
  // zusätzliche Rechteck-Bereiche (z. B. Textfeld/Rahmen der maskenlosen 1993er-Rahmen)
  for (const r of extraRects) regions.set(`xrect:${JSON.stringify(r)}`, { rect: r, img: null });
  if (!regions.size) return;
  // Arbeitsauflösung 1/2 für die Statistik (dünne Konturen bleiben erfasst)
  const sw = Math.round(cw / 2); const sh = Math.round(ch / 2);
  const grab = (src, w, h) => {
    const c = mkCanvas(w, h);
    const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(src, 0, 0, w, h);
    return x.getImageData(0, 0, w, h).data;
  };
  const pm = (l) => { if (globalThis.__perf) globalThis.__perf.push(['  c:' + l, performance.now()]); };
  pm('pre');
  const ours = grab(cv, sw, sh);
  const orig = grab(scan, sw, sh);
  pm('grab');
  const ex = (px, py) => exclude.some((r) => px >= r.x * sw / W && px < (r.x + r.w) * sw / W && py >= r.y * sh / H && py < (r.y + r.h) * sh / H);
  const full = ctx.getImageData(0, 0, cw, ch);
  const fd = full.data;
  pm('getfull');
  const claimed = new Uint8Array(cw * ch); // jeder Pixel nur einmal (oberste Ebene zuerst)
  // ausgeschlossene Bereiche (Artwork) nie verändern
  for (const r of exclude) {
    const x0 = Math.max(0, Math.floor(r.x * cw / W)); const x1 = Math.min(cw, Math.ceil((r.x + r.w) * cw / W));
    const y0 = Math.max(0, Math.floor(r.y * ch / H)); const y1 = Math.min(ch, Math.ceil((r.y + r.h) * ch / H));
    for (let y = y0; y < y1; y++) claimed.fill(1, y * cw + x0, y * cw + x1);
  }
  for (const [, reg] of regions) {
    // Maske in Arbeits- und in voller Auflösung (nur Alphakanal, je Bild und Größe gecacht –
    // dieselben Masken kommen auf vielen Karten vor)
    const mk = (w, h) => maskAlpha(reg, w, h);
    pm('r'); const ms = mk(sw, sh); pm('ms');
    const inner = (i) => ms[i] >= 200;
    // nur innerhalb der Bounding Box der Maske arbeiten
    const bb = reg.rect ? { x0: reg.rect.x, y0: reg.rect.y, x1: reg.rect.x + reg.rect.width, y1: reg.rect.y + reg.rect.height } : alphaBBox(reg.img);
    if (!bb) continue;
    const range2 = (w, h) => [Math.max(1, Math.floor(bb.x0 * w)), Math.max(1, Math.floor(bb.y0 * h)), Math.min(w - 1, Math.ceil(bb.x1 * w)), Math.min(h - 1, Math.ceil(bb.y1 * h))];
    const [sx0, sy0, sx1, sy1] = range2(sw, sh);
    // Durchgang 1: gültige Pixel (Inneres der Maske, nicht ausgeschlossen) + Helligkeitshistogramme
    const idx = new Int32Array(Math.max(0, (sx1 - sx0) * (sy1 - sy0))); let n = 0;
    const hO = new Uint32Array(256); const hR = new Uint32Array(256);
    const L = (d, i) => (d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114) | 0;
    for (let yy = sy0; yy < sy1; yy++) for (let i = yy * sw + sx0; i < yy * sw + sx1; i++) {
      // nur Pixel im Inneren der Maske (Nachbarn ebenfalls in der Maske) – sonst mischen sich bei
      // dünnen Konturen Nachbarbereiche und 1–2 px Versatz zum Scan ein
      if (!inner(i) || !inner(i - 1) || !inner(i + 1) || !inner(i - sw) || !inner(i + sw)) continue;
      if (orig[i * 4 + 3] < 250 || (exclude.length && ex(i % sw, (i / sw) | 0))) continue;
      idx[n++] = i; hO[L(ours, i)]++; hR[L(orig, i)]++;
    }
    if (n < 40) continue;
    // obere 60 % der Helligkeit (ohne Schrift/Symbole im Scan) – je Bild eigenes 40-%-Perzentil
    const pct = (hist) => { let acc = 0; const lim = Math.floor(n * 0.4); for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc > lim) return v; } return 0; };
    const tO = pct(hO); const tR = pct(hR);
    // Durchgang 2: Summen für Mittelwert und Streuung je Kanal
    const sO = new Float64Array(7); const sR = new Float64Array(7); // n, Summe r g b, Quadratsumme r g b
    for (let j = 0; j < n; j++) {
      const i = idx[j];
      if (L(ours, i) >= tO) { sO[0]++; for (let k = 0; k < 3; k++) { const v = ours[i * 4 + k]; sO[1 + k] += v; sO[4 + k] += v * v; } }
      if (L(orig, i) >= tR) { sR[0]++; for (let k = 0; k < 3; k++) { const v = orig[i * 4 + k]; sR[1 + k] += v; sR[4 + k] += v * v; } }
    }
    if (!sO[0] || !sR[0]) continue;
    // Mittelwert und Streuung je Kanal angleichen (Farbton, Helligkeit und Kontrast der Struktur)
    const tf = [0, 1, 2].map((k) => {
      const mo = sO[1 + k] / sO[0]; const mr = sR[1 + k] / sR[0];
      const so2 = Math.sqrt(Math.max(0, sO[4 + k] / sO[0] - mo * mo)); const sr2 = Math.sqrt(Math.max(0, sR[4 + k] / sR[0] - mr * mr));
      const g = Math.max(0.5, Math.min(1.6, so2 > 1 ? sr2 / so2 : 1));
      return { mo, mr, g };
    });
    if (tf.every((t) => Math.abs(t.mr - t.mo) < 1 && Math.abs(t.g - 1) < 0.03)) continue;
    pm('stats');
    // Alpha in voller Auflösung aus der halb aufgelösten Maske interpolieren
    // (spart je Bereich eine kartengroße Maske)
    const [fx0, fy0, fx1, fy1] = range2(cw, ch);
    const rx = sw / cw; const ry = sh / ch;
    for (let yy = fy0; yy < fy1; yy++) {
      const my = Math.min(sh - 1.001, Math.max(0, (yy + 0.5) * ry - 0.5)); const y0 = my | 0; const wy = my - y0;
      for (let xx = fx0; xx < fx1; xx++) {
        const i = yy * cw + xx;
        if (claimed[i]) continue;
        const mxp = Math.min(sw - 1.001, Math.max(0, (xx + 0.5) * rx - 0.5)); const x0 = mxp | 0; const wx = mxp - x0;
        const j = y0 * sw + x0;
        const a = (ms[j] * (1 - wx) + ms[j + 1] * wx) * (1 - wy) + (ms[j + sw] * (1 - wx) + ms[j + sw + 1] * wx) * wy;
        if (a < 8) continue;
        if (a > 200) claimed[i] = 1;
        const t = a / 255;
        for (let k = 0; k < 3; k++) {
          const v = fd[i * 4 + k];
          const nv = tf[k].mr + (v - tf[k].mo) * tf[k].g;
          fd[i * 4 + k] = Math.max(0, Math.min(255, v + (nv - v) * t));
        }
      }
    }
  }
  pm('apply');
  ctx.putImageData(full, 0, 0);
  pm('put');
}

// ---------- Mana- und Textsymbole (Assets/img/manaSymbols, Card Conjurer loadManaSymbols) ----------

// Symbole, die Card Conjurer lädt (creator-23.js: loadManaSymbols) – Dateiname ohne Endung
const CC_MANA = new Set([
  ...Array.from({ length: 21 }, (_, i) => String(i)),
  'w', 'u', 'b', 'r', 'g', 'c', 'x', 'y', 'z', 't', 'untap', 's', 'purple', 'inf', 'e', 'a', 'half',
  'wu', 'wb', 'ub', 'ur', 'br', 'bg', 'rg', 'rw', 'gw', 'gu', '2w', '2u', '2b', '2r', '2g', 'wp', 'up', 'bp', 'rp', 'gp', 'p',
  'wup', 'wbp', 'ubp', 'urp', 'brp', 'bgp', 'rgp', 'rwp', 'gwp', 'gup', 'cw', 'cu', 'cb', 'cr', 'cg',
  'chaos', 'tk', 'planeswalker',
]);
const CC_ALIAS = { T: 't', Q: 'untap', '∞': 'inf', '½': 'half', PW: 'planeswalker', CHAOS: 'chaos', TK: 'tk' };

/** URL des Card-Conjurer-Symbols für einen Code wie "{W/U}" oder null (wie getManaSymbol: auch umgekehrte Reihenfolge). */
export function ccManaUrl(code) {
  const inner = String(code).replace(/[{}]/g, '').toUpperCase();
  let name = CC_ALIAS[inner] || inner.replace(/\//g, '').toLowerCase();
  if (!CC_MANA.has(name)) name = name.split('').reverse().join('');
  return CC_MANA.has(name) ? `/cc/img/manaSymbols/${name}.svg` : null;
}

/**
 * Symboltabelle für den Renderer: Card-Conjurer-Symbol zuerst, Scryfall-SVG als Ersatz.
 * oldColors: alte Farbsymbole (Card Conjurer manaPrefix "old", Karten vor Ice Age).
 */
export function ccSymbolMap(symbolMap, codes, { oldColors = false } = {}) {
  const m = new Map(symbolMap);
  for (const code of new Set(codes)) {
    const key = symbolMap.has(code) ? code : code.toUpperCase();
    const urls = [];
    const c = key.replace(/[{}]/g, '');
    if (oldColors && /^[WUBRG]$/.test(c)) urls.push(`/cc/img/manaSymbols/old/old${c.toLowerCase()}.svg`);
    const cc = ccManaUrl(key);
    if (cc) urls.push(cc);
    if (symbolMap.get(key)) urls.push(symbolMap.get(key));
    if (urls.length) m.set(key, urls);
  }
  return m;
}

/** Flavor-Trennlinie (Card Conjurer: manaSymbols/bar.png, Breite 96 % der Textbreite, Höhe 0,03 × Kartenhöhe) */
export const CC_FLAVOR_BAR = '/cc/img/manaSymbols/bar.png';

/** Zusatzgrafiken für Saga- und Class-Text (Card Conjurer versionSaga.js / versionClass.js). */
export async function ccColumnImages() {
  const get = (f) => loadImage(`${IMG}/${f}`).catch(() => null);
  const [sagaChapter, sagaDivider, classHeader] = await Promise.all([get('saga/sagaChapter.png'), get('saga/sagaDivider.png'), get('class/header.png')]);
  return { sagaChapter, sagaDivider, classHeader };
}

// ---------- Querformat-Karten: Split (packSplit) und Battle (packBattle) ----------

/** Rahmenbuchstabe -> Dateiname in einem Pack mit den Buchstaben letters. */
function fileLetter(l, letters) {
  l = l.toUpperCase();
  if (l.length > 1) l = 'L';
  if (!letters.includes(l)) l = l === 'V' || l === 'C' ? 'A' : 'M';
  return lc(l);
}
function landscapeLetter(card, face, letters) {
  return fileLetter(frameProperties(frameColorsFor(card, face), face.mana_cost, face.type_line || '', face.power ?? null).frame, letters);
}

// Erzeugte Masken (kartengroß, halbe Auflösung): Rechtecke und weiche Übergänge, für die es
// in einem Pack keine Maskendatei gibt (Split: Textfeld bzw. zweite Farbe je Hälfte)
const genMasks = new Map();
function genMask(key, draw) {
  if (!genMasks.has(key)) {
    const c = mkCanvas(750, 1050);
    const x = c.getContext('2d');
    x.scale(0.5, 0.5);
    draw(x);
    genMasks.set(key, { key: `gen:${key}`, image: c });
  }
  return genMasks.get(key);
}
/** Rechteck (Hochformat-Kartenkoordinaten) */
const rectMask = (r) => genMask(`rect:${r.x},${r.y},${r.w},${r.h}`, (x) => { x.fillStyle = '#000'; x.fillRect(r.x, r.y, r.w, r.h); });
/** Übergang entlang y: deckend oberhalb von y0 + a·(y1 − y0), transparent ab y0 + b·(y1 − y0) */
const fadeMask = (y0, y1, a, b) => genMask(`fade:${y0},${y1},${a},${b}`, (x) => {
  const g = x.createLinearGradient(0, y0 + a * (y1 - y0), 0, y0 + b * (y1 - y0));
  g.addColorStop(0, 'rgba(0,0,0,1)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, 1500, 2100);
});

/**
 * Ebenen einer Split-Hälfte (oben -> unten). Das Pack hat nur die Hälften-Masken; zweifarbige
 * Hälften werden wie die M15-Rahmen aus Rahmen-, Textfeld- und rechter Farbe zusammengesetzt
 * (cardFrameProperties). Im Hochformat liegt "rechts" (zweite Farbe) oben in der Hälfte.
 * y0/y1: Ausdehnung der Hälfte, box: Textfeld im Rahmenbild (vermessen an m15/split/w.png).
 */
function splitHalfLayers(card, face, half, y0, y1, box) {
  const p = frameProperties(frameColorsFor(card, face), face.mana_cost, face.type_line || '', face.power ?? null);
  const f = (l) => `${IMG}/m15/split/${fileLetter(l, 'WUBRGMALV')}.png`;
  const hm = `${IMG}/m15/split/${half}.svg`;
  const bm = rectMask(box);
  const out = [];
  if (p.rulesRight) out.push({ src: f(p.rulesRight), masks: [hm, bm, fadeMask(box.y, box.y + box.h, 0.15, 0.85)] });
  if (p.rulesRight || fileLetter(p.rules, 'WUBRGMALV') !== fileLetter(p.frame, 'WUBRGMALV')) out.push({ src: f(p.rules), masks: [hm, bm] });
  if (p.frameRight) out.push({ src: f(p.frameRight), masks: [hm, fadeMask(y0, y1, 0.35, 0.65)] });
  out.push({ src: f(p.frame), masks: [hm] });
  return out;
}

/**
 * Ebenen für Split- und Battle-Karten oder null.
 * Split: Hochformat-Bild (1500×2100), obere Hälfte = rechte Kartenhälfte (Maske top.svg),
 * untere = linke (bottom.svg). Battle: Querformat-Bild (2814×2010) in Querformat-Koordinaten.
 */
export function ccLandscapeLayers(model) {
  const { card, layout: L, flags } = model;
  if (L.style !== 'm15' || !card.card_faces || card.card_faces.length < 2) return null;
  if (L.kind === 'split') {
    const [left, right] = card.card_faces;
    return {
      orient: 'portrait',
      layers: [
        ...splitHalfLayers(card, right, 'top', 58, 1000, { x: 913, y: 116, w: 530, h: 826 }),
        ...splitHalfLayers(card, left, 'bottom', 1016, 1958, { x: 913, y: 1074, w: 530, h: 826 }),
      ],
    };
  }
  if (L.kind === 'battle') {
    const layers = [];
    if (flags.holo) layers.push({ src: `${IMG}/m15/battle/holostamp.png`, masks: [], bounds: { x: 103 / 2100, y: 657 / 1500, width: 93 / 2100, height: 186 / 1500 } });
    layers.push({ src: `${IMG}/m15/battle/${landscapeLetter(card, card.card_faces[0], 'WUBRGMALC')}.png`, masks: [] });
    return { orient: 'landscape', layers };
  }
  return null;
}
