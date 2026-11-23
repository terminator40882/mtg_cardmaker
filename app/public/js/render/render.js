// Setzt alles zusammen: Datenmodell aus Scryfall-Karte bauen und Karte zeichnen.
import { LAYOUTS, layoutForFrame, W, H } from './layouts.js';
import { frameColors, BORDER_COLORS, VEHICLE_PT } from './palettes.js';
import { drawFrameLayer, drawHolo, drawBrush, roundRect } from './frames.js';
import { parseRules, parseFlavor, symbolsIn, smartQuotes } from './textparse.js';
import { fitText, drawText, drawSymbol, drawFittedLine, sizeForCap, METRICS, layoutFromLines, getFontScales, setFlavorBarImage, isOriginalFont } from './textlayout.js';
import { drawSetSymbol } from './setsymbol.js';
import { loadImage, loadSymbols, ensureFonts } from './assets.js';
import { luminance, mix } from './textures.js';
import { drawSagaText, drawClassText, setColumnImages } from './columns.js';
import { drawAdventure } from './adventure.js';
import { historicWordings, expectedWording } from './wording.js';
import { dfcKind, drawDfcIcon, drawMdfcTab, drawBackPT, dfcIconUrl } from './dfc.js';
import { renderLandscape } from './landscape.js';
import { layoutPlaneswalker, drawPlaneswalkerText, drawLoyaltyShield as drawPwShield, setPwIcons } from './planeswalker.js';
import { ccStatus, ccLayers, loadLayers, drawLayers, prepareLayers, ccArtBounds, drawWatermark, ccPwIcons, matchFrameColors, ccSymbolMap, CC_FLAVOR_BAR, CC_FLAVOR_BAR_LIGHT, ccDfcFrame, ccColumnImages, ccLandscapeLayers, ccClearFrame } from './cc.js';
import { getPool, toBitmap } from './pool.js';
import { fitRulesVariant } from './rulesfit.js';
import { alignArt, fitTextToScan, blockExtent, scanLines, boxEdges, sampleTextColor, cacheArtAlignment, hasArtAlignment, inkSimilarity } from './align.js';

export { W, H };

const FACE_LAYOUTS = new Set(['transform', 'modal_dfc', 'double_faced', 'flip', 'meld', 'battle']);

export function facesOf(card) {
  if (card.card_faces && FACE_LAYOUTS.has(card.layout)) return card.card_faces;
  return [card];
}

/**
 * Baut das Render-Modell.
 * opts: { face, frame, border, showFlavor, showReminder, footer, art: {zoom,dx,dy}, artUrl, fontCap, flavorBar, holoStamp }
 */
export function buildModel(card, set, opts) {
  const faces = facesOf(card);
  const faceIdx = Math.min(opts.face || 0, faces.length - 1);
  // Adventure/Split: eine Kartenseite mit mehreren Hälften -> Hauptteil als "Seite"
  const f = (card.layout === 'adventure' || card.layout === 'split') && card.card_faces ? card.card_faces[0] : faces[faceIdx];
  const pick = (k) => f[k] ?? card[k];
  let type = pick('type_line') || '';
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
    color_indicator: f.color_indicator || null,
    color_identity: card.color_identity || [],
    produced_mana: card.produced_mana || [],
    artist: f.artist || card.artist || '',
  };
  // Gedruckter Text/Typ dieses Drucks (MTGJSON originalText/originalType) statt Oracle-Text
  let pf = opts.printedText !== false && Array.isArray(card.printed)
    ? (card.printed.find((p) => p.name === face.name) || card.printed[faceIdx] || null) : null;
  // Plausibilitätsprüfung: MTGJSON ordnet vereinzelt den Text einer anderen Karte zu
  // (alte Karten weichen inhaltlich stark vom Oracle-Text ab – dort nicht prüfen)
  if (pf?.text && (card.released_at || '') >= '2008-01-01' && !similarText(pickPart(pf.text, face.oracle_text), face.oracle_text)) pf = null;
  if (pf?.text) pf = { ...pf, text: pickPart(pf.text, face.oracle_text) };
  if (pf?.text) face.oracle_text = cleanPrinted(pf.text);
  if (pf?.type) face.type_line = pf.type.replace(/ [–-] /g, ' — ');
  face.printed = !!pf?.text;
  face.type_line = historicTypeLine(face.type_line, card.released_at || '', face.oracle_text, f.oracle_text ?? card.oracle_text ?? '');
  // "Æther" wurde erst mit Kaladesh (2016) zu "Aether" vereinheitlicht
  if ((card.released_at || '') < '2016-09-30') face.name = face.name.replace(/\bAether/g, 'Æther');
  type = face.type_line;
  // auch die anderen Hälften/Seiten (Adventure, Split, MDFC-Lasche) mit gedrucktem Text
  if (opts.printedText !== false && Array.isArray(card.printed) && card.card_faces) {
    card = {
      ...card,
      card_faces: card.card_faces.map((cf) => {
        const p = card.printed.find((x) => x.name === cf.name);
        const pt = p?.text && pickPart(p.text, cf.oracle_text);
        return pt && similarText(pt, cf.oracle_text) ? { ...cf, oracle_text: cleanPrinted(pt), type_line: p.type ? p.type.replace(/ [–-] /g, ' \u2014 ') : cf.type_line } : cf;
      }),
    };
  }
  let layoutName = opts.frame && opts.frame !== 'auto' ? opts.frame : layoutForFrame(card.frame);
  const isPw = loyalty != null && /\bPlaneswalker\b/.test(type);
  if ((layoutName === 'm15' || (layoutName === 'm2003' && (!opts.frame || opts.frame === 'auto'))) && isPw) {
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
    borderKey: BORDER_COLORS[border] ? border : 'black',
    lightBorder: border === 'white' || border === 'silver' || border === 'gold' || border === 'yellow',
    palettes: frameVariant(frameColors(face), card, type),
    flags: {
      // Legendary-Krone gibt es erst ab Dominaria (2018)
      // Krone laut Scryfall-Rahmeneffekt (gibt es nur im 2015er-Rahmen ab Dominaria)
      legendary: card.frame_effects ? (card.frame_effects.includes('legendary') && /\bLegendary\b/.test(type))
        : (/\bLegendary\b/.test(type) && (card.released_at || '') >= '2018-04-27'),
      pt: face.power != null && face.toughness != null,
      vehicle: /\bVehicle\b/.test(type),
      planeswalker: loyalty != null && /\bPlaneswalker\b/.test(type),
      basic: /\bBasic\b/.test(type) && /\bLand\b/.test(type),
      // Holo-Stempel (samt Bogen der Rahmenkante darüber) nur auf Wunsch – Standard: ohne, Rahmenkante gerade
      holo: opts.holoStamp === true && (card.rarity === 'rare' || card.rarity === 'mythic') && (LAYOUTS[layoutName] || LAYOUTS.m15).style === 'm15' && (card.released_at || '') >= '2014-07-18',
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
  // Scryfall-Rahmeneffekte: "nyxtouched"/"enchantment" = Sternenhimmel-Rahmen, "devoid" = durchscheinend
  const nyx = fx.includes('nyxtouched') || fx.includes('enchantment');
  const devoid = fx.includes('devoid') || (card.keywords || []).includes('Devoid');
  return palettes.map((p) => {
    if (snow) return { ...p, tex: ['#a9b9c6', '#e3eaef', '#ffffff'], variant: 'snow' };
    if (nyx) return { ...p, tex: p.tex.map((c) => mix(c, '#ffffff', 0.5)), variant: 'nyx' };
    if (devoid) return { ...p, texAlpha: 0.35, variant: 'devoid' };
    return p;
  });
}

function placeArt(img, box, adj = {}) {
  const zoom = adj.zoom || 1;
  if (adj.rect) {
    // am Scan ausgerichtet; Zoom/Verschiebung wirken zusätzlich
    const r = adj.rect;
    return {
      x: r.x + (r.w - r.w * zoom) / 2 + (adj.dx || 0) * box.w * 0.5,
      y: r.y + (r.h - r.h * zoom) / 2 + (adj.dy || 0) * box.h * 0.5,
      w: r.w * zoom,
      h: r.h * zoom,
    };
  }
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

/**
 * Pinsel vor dem Künstlernamen: wie Card Conjurer der Glyph U+FFEE der Originalschrift
 * (Beleren Small Caps bzw. Matrix Bold), endet bei artistX (8th: plus Leerzeichen wie
 * "\uFFEE {artist}"); ohne Originalschrift per Code gezeichnet (mittig bei cx).
 */
function artistBrush(ctx, family, cap, cx, baseline, size, color, artistX, space = false) {
  if (isOriginalFont(family)) {
    ctx.save();
    ctx.font = `${sizeForCap(ctx, family, cap).toFixed(2)}px ${family}`;
    ctx.fillStyle = color;
    ctx.textAlign = 'right';
    ctx.fillText('\uFFEE', artistX - (space ? ctx.measureText(' ').width : 0), baseline);
    ctx.restore();
    return;
  }
  drawBrush(ctx, cx, baseline - cap * 0.45, size, color);
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
    artistBrush(ctx, 'CMArtist', I.cap * 1.05, x, I.y2, I.cap * 1.7, color, x + I.cap * 1.2);
    x += I.cap * 1.2;
    ctx.font = fs('CMArtist', I.cap * 1.05);
    ctx.fillText(face.artist, x, I.y2);
    if (opts.footer) {
      ctx.font = fs('CMInfo', I.cap * 0.9);
      ctx.textAlign = 'right';
      ctx.fillText(opts.footer, I.right, I.y2);
    }
  } else if (L.style === 'm2003') {
    artistBrush(ctx, 'CMMatrix', I.cap, I.x + I.cap * 1.1, I.y1, I.cap * 2.1, color, I.x + I.cap * 2.4, true);
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
const perfMark = (label) => { if (globalThis.__perf) globalThis.__perf.push([label, performance.now()]); };
export async function renderCard(canvas, model, deps) {
  perfMark('start');
  const { symbolMap, keywords } = deps;
  const scale = model.opts.scale || 1;
  const L = model.layout;
  const { face, flags, opts } = model;

  const retroLayout = L.style === 'retro';
  // Standardländer: Reminder "({T}: Add {G}.)" steht nie auf der Karte –
  // stattdessen Flavortext oder ein großes Manasymbol.
  // Retro-Planeswalker zeigen Loyalitätskosten inline ("+1: ...")
  const parseR = (t, showReminder = opts.showReminder) => parseRules(t, { showReminder, keywords, planeswalker: flags.planeswalker && !retroLayout });
  // Ohne gedruckten Text (MTGJSON): Wortlaut früherer Regel-Epochen ableiten. Ohne Scan entscheidet
  // das Erscheinungsdatum, mit Scan der Vergleich (unten, Textvarianten).
  const wordings = !face.printed && opts.printedText !== false && !flags.basic ? historicWordings(face.oracle_text) : [];
  const expected = expectedWording(wordings, model.card.released_at);
  model.textVariant = expected?.label || null;
  const rulesParas = flags.basic ? [] : parseR(expected ? expected.text : face.oracle_text);
  const flavorParas = opts.showFlavor ? parseFlavor(face.flavor_text) : [];
  const codes = symbolsIn(face.mana_cost, face.oracle_text,
    ...(model.card.card_faces || []).flatMap((f) => [f.mana_cost, f.oracle_text]));
  const basicSym = flags.basic && flavorParas.length === 0 ? basicLandSymbol(face) : null;
  if (basicSym) codes.push(basicSym);

  const ccOk = (await ccStatus()).available;
  const ccDefs = opts.frameSource !== 'code' && ccOk ? ccLayers(model) : null;
  const [art, setIcon, symbols, cc, scan, , , officialSym] = await Promise.all([
    loadImage(opts.artUrl).catch(() => null),
    loadImage(model.set?.icon).catch(() => null),
    loadSymbols(codes, ccOk ? ccSymbolMap(symbolMap, codes, { oldColors: (model.card.released_at || '9999') < '1995-06-03' }) : symbolMap),
    ccDefs ? loadLayers(ccDefs) : null,
    opts.alignArt && opts.scanUrl ? loadImage(opts.scanUrl).catch(() => null) : null,
    ensureFonts(),
    (ccOk ? Promise.all([CC_FLAVOR_BAR, CC_FLAVOR_BAR_LIGHT].map((u) => loadImage(u).catch(() => null))) : Promise.resolve([]))
      .then(([dark, light]) => setFlavorBarImage(dark, light)),
    ccOk ? loadOfficialSetSymbol(model) : null,
  ]);
  perfMark('loaded');
  model.frameSource = cc ? 'cc' : 'code';

  // ---- Analyse vorab planen und auf Worker verteilen (parallel zum Zeichnen im Hauptthread)
  const dfcEarly = L.style === 'm15' || L.style === 'm2003' ? dfcKind(model.card) : null;
  let textBoxEarly = { ...L.text };
  if (dfcEarly === 'mdfc' && model.card.card_faces?.length === 2) textBoxEarly = { ...textBoxEarly, h: textBoxEarly.h - 80 };
  if (flags.planeswalker && !retroLayout) textBoxEarly = { ...textBoxEarly, x: textBoxEarly.x + 120, w: textBoxEarly.w - 120 };
  let ptZoneEarly = (flags.pt || flags.planeswalker) && L.ptPlate ? { x: L.ptPlate.x - 12, y: L.ptPlate.y } : null;
  if (ptZoneEarly && dfcEarly === 'transform' && model.faceIdx === 0 && model.card.card_faces?.[1]?.power != null) {
    ptZoneEarly = { x: L.ptPlate.x + L.ptPlate.w - 120, y: L.ptPlate.y - 80, tolerance: 60 };
  }
  const parasEarly = [...rulesParas, ...flavorParas];
  const rulesBase = {
    maxCap: flags.planeswalker ? L.rules.maxCap * 0.9 : L.rules.maxCap,
    minCap: L.rules.minCap,
    fixedCap: opts.fontCap || null,
    exclude: ptZoneEarly,
    metrics: L.metrics,
    centerShort: L.rules.centerShort,
  };
  let rulesVariants = null;
  if (!['adventure', 'saga', 'class', 'pw', 'split', 'battle'].includes(L.kind) && !basicSym && parasEarly.length
    && !opts.fontCap && opts.alignArt && scan) {
    // Varianten: Oracle-Text enthält oft Reminder-Text, der auf diesem Druck fehlt; ohne gedruckten
    // Text außerdem die Wortlaute früherer Epochen (die nach Datum erwartete zuerst)
    const texts = [{ label: expected?.label || null, text: expected ? expected.text : face.oracle_text }];
    // digitale Karten (Arena/MTGO): Bilder zeigen eine andere Schrift, der Scan-Vergleich taugt nicht
    // zur Wahl des Wortlauts -> nur der nach Datum erwartete
    for (const v of model.card.digital ? [] : [{ label: null, text: face.oracle_text }, ...wordings]) {
      if (!texts.some((t) => t.text === v.text)) texts.push(v);
    }
    rulesVariants = [];
    for (const t of texts) {
      rulesVariants.push({ label: t.label, paras: t === texts[0] ? parasEarly : [...parseR(t.text), ...flavorParas] });
      if (opts.showReminder && /\(/.test(t.text || '')) {
        rulesVariants.push({ label: t.label, paras: [...parseR(t.text, false), ...flavorParas] });
      }
    }
  }
  const rulesKey = (vi) => `${opts.scanUrl}|${model.faceIdx}|${L.style}${L.variant || ''}|${opts.showFlavor}|${vi}|${rulesVariants?.[vi]?.label}|${model.face.oracle_text}`;
  const pool = opts.workers === false ? null : await getPool(getFontScales());
  let rulesJobs = null;
  let alignJob = null;
  const alignBox = cc ? ccArtBounds(model, L, true) : null;
  const artClip = cc ? ccArtBounds(model, L) : null;
  const alignKey = `${opts.artUrl}|${opts.scanUrl}|${L.style}${L.variant || ''}`;
  if (pool) {
    const scanBm = scan ? await toBitmap(scan) : null;
    if (rulesVariants && scanBm) {
      const symBm = new Map();
      await Promise.all([...symbols].map(async ([k, img]) => symBm.set(k, await toBitmap(img, 256))));
      rulesJobs = rulesVariants.map(({ paras: vp }, vi) => pool.run('rules', {
        vp, textBox: textBoxEarly, baseOpts: rulesBase, rules: L.rules, metrics: L.metrics,
        scan: scanBm, W, H, symbols: symBm, key: rulesKey(vi),
      }).catch(() => null));
    }
    if (cc && art && scanBm && opts.alignArt && !hasArtAlignment(alignKey)) {
      const artBm = await toBitmap(art);
      if (artBm) alignJob = pool.run('align', { art: artBm, scan: scanBm, box: alignBox, W, H }).catch(() => null);
    }
  }
  // Rahmen im Hauptthread zusammensetzen, während die Worker rechnen
  if (cc) prepareLayers(cc, W, H, scale, { borderColor: model.borderKey !== 'black' ? model.borderColor : null });
  // maskenlose 1993er-Rahmen: Textfeld und übriger Rahmen als eigene Bereiche (Legends/Revised haben andere Töne)
  const colorRects = L.style === 'retro' && L.variant === '93' && L.box
    ? [{ x: (L.box.x + 10) / W, y: (L.box.y + 10) / H, width: (L.box.w - 20) / W, height: (L.box.h - 20) / H },
      { x: 90 / W, y: 90 / H, width: (W - 180) / W, height: (H - 180) / H }] : [];

  setPwIcons(cc && L.kind === 'pw' ? await ccPwIcons(L.typePlate.y < 1100, model) : null);
  setColumnImages(cc && (L.kind === 'saga' || L.kind === 'class') ? await ccColumnImages() : null);

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
    // Rahmen aus Card Conjurer (packSplit / packBattle), sonst per Code
    const land = opts.frameSource !== 'code' && ccOk ? ccLandscapeLayers(model) : null;
    const landLayers = land ? await loadLayers(land.layers) : null;
    model.frameSource = landLayers ? 'cc' : 'code';
    model.textCap = renderLandscape(ctx, model, { art, setIcon, symbols, keywords, scale, official: officialSym,
      cc: landLayers ? { ...land, layers: landLayers } : null });
    ctx.restore();
    return model;
  }

  if (cc) {
    // Rahmen aus Card-Conjurer-Grafiken; Artwork liegt darunter im Bildfenster
    const box = alignBox;
    perfMark('f0');
    if (alignJob) cacheArtAlignment(alignKey, await alignJob);
    const rect = alignArt(art, scan, box, W, H, alignKey);
    model.artAligned = !!rect;
    const adj = rect ? { ...opts.art, rect } : opts.art;
    if (model.palettes[0].variant === 'devoid') drawArt(ctx, art, { x: 0, y: 0, w: W, h: H }, adj, box);
    else drawArt(ctx, art, L.kind === 'pw' ? L.art : artClip, adj, box);
    perfMark('align+art');
    drawLayers(ctx, cc, W, H, scale, { borderColor: model.borderKey !== 'black' ? model.borderColor : null });
    perfMark('layers');
    // Farben der Rahmenbereiche an den gedruckten Scan angleichen (Druckfarben sind dunkler/satter)
    if (opts.alignArt && opts.matchColors !== false && scan && model.artAligned) {
      matchFrameColors(ctx, cc, scan, W, H, [artClip], colorRects);
    }
    perfMark('colors');
    if (opts.watermark !== false) await drawWatermark(ctx, model, L, scale);
  } else {
    if (model.palettes[0].variant === 'devoid' && L.style === 'm15') {
      // Devoid: Artwork scheint durch den ganzen Rahmen
      ctx.save();
      ctx.filter = 'blur(3px)';
      drawArt(ctx, art, L.frame, opts.art, L.artFit || L.art);
      ctx.restore();
    }
    drawArt(ctx, art, L.art, opts.art, L.artFit || L.art);
    drawFramesComposite(ctx, L, model.palettes, flags, scale);
  }

  // Artwork-Kontur
  if (!cc && L.style === 'm15' && L.kind !== 'pw') {
    ctx.save();
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(10,10,10,0.9)';
    ctx.strokeRect(L.art.x - 2, L.art.y - 2, L.art.w + 4, L.art.h + 4);
    ctx.restore();
  }

  const retro = L.style === 'retro';
  // Rückseiten von Transform-Karten haben dunkle Leisten mit weißer Schrift
  const darkBack = model.card.layout === 'transform' && model.faceIdx === 1 && L.style === 'm15';
  let headColor = darkBack ? '#ffffff' : retro ? (luminance(model.palettes[0].retroTex[1]) > 0.55 ? '#111' : '#fbfaf6') : '#111';
  // Schriftfarbe von Name/Typzeile aus dem Scan (z. B. weiße Titel mit Schatten auf hellen Ice-Age-Rahmen)
  const sampleHead = (t, fam, cap, x, base, maxW) => (opts.alignArt && scan && opts.matchColors !== false
    ? sampleTextColor(scan, W, H, { x: x - 10, y: base - cap * 1.6, w: Math.min(maxW, 900) + 20, h: cap * 2.1 },
      (c) => drawFittedLine(c, t, fam, cap, x, base, maxW, { color: '#fff' }), { maxLightBg: retro ? 256 : 140 }) : null);
  const sampledName = sampleHead(smartQuotes(face.name), L.nameText.family, L.nameText.cap, L.nameText.x, L.nameText.baseline, L.nameText.right - L.nameText.x - 200);
  if (sampledName) headColor = sampledName;
  const headShadow = (retro || darkBack) && luminance(headColor) > 0.45 ? 'rgba(0,0,0,0.9)' : null;
  // Typzeile eigens: bei Clear Textboxes ("inverted") liegt sie dunkel über dem Artwork -> weiße Schrift
  // mit Schatten (packM15ClearTextboxes), sonst wie der Name; der Scan entscheidet, wenn vorhanden
  const clear = !!cc && ccClearFrame(model);
  let typeColor = clear ? '#ffffff' : headColor;
  const sampledType = sampleHead(face.type_line, L.typeText.family, L.typeText.cap, L.typeText.x, L.typeText.baseline, L.setSym.right - L.typeText.x - 200);
  if (sampledType && !clear) typeColor = sampledType;
  const typeShadow = luminance(typeColor) > 0.45 && (retro || darkBack || clear || luminance(headColor) <= 0.45) ? 'rgba(0,0,0,0.9)' : headShadow;

  perfMark('frame');
  // Name + Manakosten
  const costCodes = symbolsIn(face.mana_cost);
  const cw = costWidth(costCodes, L.cost);
  drawCost(ctx, costCodes, symbols, L.cost);
  const N = L.nameText;
  // Doppelseitige Karten: Symbol vor dem Namen (nur moderne Rahmen)
  const dfc = L.style === 'm15' || L.style === 'm2003' ? dfcKind(model.card) : null;
  // Card-Conjurer-DFC-Rahmen: Symbolkreis/Pfeil und MDFC-Lasche sind Teil des Rahmenbilds
  const ccDfc = !!cc && !!dfc && ccDfcFrame(model);
  const ccIcon = ccDfc ? await loadImage(dfcIconUrl(dfc, model.faceIdx === 1, model.card.frame_effects || [])).catch(() => null) : null;
  const nameShift = dfc ? drawDfcIcon(ctx, dfc, model.faceIdx === 1, model.card.frame_effects, L.cost.cy + 1, null, { cc: ccDfc, ccIcon }) : 0;
  drawFittedLine(ctx, smartQuotes(face.name), N.family, N.cap, N.x + nameShift, N.baseline,
    N.right - N.x - nameShift - cw - (cw ? 20 : 0), { color: headColor, shadow: headShadow });

  // Typzeile + Set-Symbol
  const plainSymbol = (model.card.released_at || '9999') < '1998-06-01';
  const symW = drawSetSymbol(ctx, setIcon, model.card.rarity, { ...L.setSym, outline: L.setSym.outline ?? (retro ? 3 : 4), plain: plainSymbol,
    scan: opts.alignArt ? scan : null, W, H, fixedSize: L.style === 'm15', official: officialSym });
  const T = L.typeText;
  // Farbindikator (Punkt vor der Typzeile, z. B. Rückseiten von DFCs) – Card Conjurer m15/ciPips
  const ciShift = face.color_indicator && L.style !== 'retro' ? await drawColorIndicator(ctx, face.color_indicator, T) : 0;
  drawFittedLine(ctx, face.type_line, T.family, T.cap, T.x + ciShift, T.baseline,
    Math.min(T.right, L.setSym.right - (symW ? symW + 24 : 0)) - T.x - ciShift, { color: typeColor, shadow: typeShadow,
      ...(clear ? { shadowDx: 2, shadowDy: 2 } : {}) });

  perfMark('head');
  // Regeltext
  let textBox = { ...L.text };
  if (dfc === 'mdfc' && model.card.card_faces?.length === 2) {
    drawMdfcTab(ctx, model.card.card_faces[1 - model.faceIdx], model.faceIdx === 1, symbols, model.card.color_identity, { cc: ccDfc });
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
  /**
   * Textzeilen des Originals im Scan (Grundlinie, linke/rechte Kante), in das eigene Textfeld
   * umgerechnet; null, wenn keine erkennbar.
   */
  const originalLines = (textBox) => {
    // Fenster knapp um die Textspalte (ohne Rahmenkanten des Textfelds)
    const region = { x: textBox.x - 10, y: textBox.y - 24, w: textBox.w + 18, h: textBox.h + 36 };
    const found = scanLines(scan, region, W, H, L.ptPlate && (flags.pt || flags.planeswalker) ? { x: L.ptPlate.x - 12, y: L.ptPlate.y - 8 } : null);
    // nur echte Textzeilen: beginnen in der Textspalte, liegen im Textfeld
    let lines = found && found.filter((l) => l.left < region.x + region.w * 0.6 && l.left >= textBox.x - 24
      && l.base <= textBox.y + textBox.h + 8 && l.base > textBox.y);
    if (!lines || !lines.length) return null;
    // Rahmen weichen minimal ab (Druck/Scan vs. Card-Conjurer-Grafik): Zeilen vom Textfeld des
    // Scans in das eigene Textfeld umrechnen, damit die Abstände zu den Kanten gleich bleiben
    const eo = boxEdges(scan, W, H, L.box);
    const eu = boxEdges(ctx.canvas, W, H, L.box);
    if (eo && eu && Math.abs(eo.R - eo.L - (eu.R - eu.L)) < 40 && Math.abs(eo.B - eo.T - (eu.B - eu.T)) < 40) {
      const sx = (eu.R - eu.L) / (eo.R - eo.L); const sy = (eu.B - eu.T) / (eo.B - eo.T);
      // nur plausible Abbildungen (Kantenerkennung kann auf strukturierten Textfeldern danebenliegen)
      if (Math.abs(sx - 1) < 0.03 && Math.abs(sy - 1) < 0.03 && Math.abs(eu.L - eo.L) < 15 && Math.abs(eu.T - eo.T) < 15) {
        const mx = (x) => eu.L + (x - eo.L) * sx; const my = (y) => eu.T + (y - eo.T) * sy;
        lines = lines.map((l) => ({ ...l, base: my(l.base), left: mx(l.left), right: mx(l.right) }));
        model.boxMap = { eo, eu };
      }
    }
    // Zeilen, die mit einem (hellen) Manasymbol beginnen, an die gemeinsame linke Kante setzen
    if (lines.length > 1) {
      const lefts = lines.map((l) => l.left).sort((a, b) => a - b);
      const common = lefts[Math.floor(lefts.length / 2)];
      lines = lines.map((l) => (l.left > common && l.left - common < 30 ? { ...l, left: common } : l));
    }
    if (globalThis.__fitDebug) console.log('copy', JSON.stringify(lines.map((l) => [Math.round(l.base), Math.round(l.left), Math.round(l.right)])));
    return lines;
  };
  /** Layout mit den Zeilen des Originals (Umbrüche, Grundlinien, Ränder); worst = Abweichung der Zeilenlängen. */
  const copyLines = (paras, lay, lines) => {
    let copied = layoutFromLines(ctx, paras, lay.cap, lines, lay.box || L.text, lay.M);
    // Schriftgröße aus den gemessenen Zeilenlängen nachführen, wenn die Breiten nicht passen
    // obere Grenze aus dem kleinsten Zeilenabstand im Scan (sonst überlappen die Zeilen)
    const pitches = lines.slice(1).map((l, i) => l.base - lines[i].base).filter((d) => d > 5);
    const capLimit = pitches.length ? Math.min(...pitches) / 1.42 : Infinity;
    if (copied && copied.cap > capLimit) copied = layoutFromLines(ctx, paras, capLimit, lines, lay.box || L.text, lay.M) || copied;
    for (let it = 0; it < 3 && copied && copied.worst >= 0.04; it++) {
      const c2 = Math.min(capLimit, copied.cap * Math.max(0.8, Math.min(1.3, copied.widthRatio)));
      const alt = layoutFromLines(ctx, paras, c2, lines, lay.box || L.text, lay.M);
      if (!alt || alt.worst >= copied.worst) break;
      copied = alt;
    }
    return copied;
  };

  /** Zeichnet Saga/Class/Adventure-Text; Schriftgröße per Vergleich mit dem Scan (wie beim Regeltext). */
  const fitColumnsToScan = (draw, tag) => {
    if (opts.fontCap || !opts.alignArt || !scan) return draw(ctx, model);
    const tmp = document.createElement('canvas');
    tmp.width = W / 2; tmp.height = H / 2;
    const tx = tmp.getContext('2d');
    tx.scale(0.5, 0.5);
    const auto = draw(tx, model);
    if (!auto) return draw(ctx, model);
    const caps = [];
    // nie größer als die automatisch passende Größe (sonst läuft der Text aus dem Feld)
    for (let c = auto; c >= auto * 0.75; c -= 0.5) caps.push(c);
    const best = fitTextToScan(scan, L.text || L.box, W, H, caps, [1], (x, c) => {
      draw(x, { ...model, opts: { ...opts, fontCap: c.cap } });
      return true;
    }, `${opts.scanUrl}|${tag}|${model.faceIdx}|${model.face.oracle_text}`);
    return draw(ctx, best ? { ...model, opts: { ...opts, fontCap: best.cap } } : model);
  };
  if (L.kind === 'adventure') {
    model.textCap = fitColumnsToScan((x, m) => drawAdventure(x, m, L, m.palettes[0], symbols, keywords, ptZone), 'adv');
  } else if (L.kind === 'saga') {
    model.textCap = fitColumnsToScan((x, m) => drawSagaText(x, m, L, m.palettes[0], symbols, keywords), 'saga');
  } else if (L.kind === 'class') {
    model.textCap = fitColumnsToScan((x, m) => drawClassText(x, m, L, m.palettes[0], symbols, keywords), 'class');
  } else if (L.kind === 'pw') {
    let pwCap = opts.fontCap || null;
    if (!pwCap && opts.alignArt && scan) {
      // Größe des Fähigkeitstexts wie im Original (Vergleich mit dem Scan)
      const auto = layoutPlaneswalker(ctx, rulesParas, L, {});
      if (auto) {
        const caps = [];
        for (let c = auto.cap * 1.3; c >= auto.cap * 0.8; c -= 0.5) caps.push(c);
        // innen etwas Abstand: die Kontur des Textfelds im Scan ist keine Schrift
        // Messfenster ab der ersten Fähigkeit: statisch -> weiter links, mit Loyalität -> rechts der Symbole
        const firstRule = rulesParas.find((p) => p.kind === 'rules');
        const sh = firstRule?.loyalty ? 0 : Math.round(0.044 * W);
        const box = { x: L.text.x - sh + 4, y: L.pwBox.y + 4, w: L.text.w + sh - 8, h: L.pwBox.h - 12 };
        const best = fitTextToScan(scan, box, W, H, caps, [1], (x, c) => {
          const lay = layoutPlaneswalker(x, rulesParas, L, { fixedCap: c.cap });
          if (!lay) return false;
          for (const r of lay.rows) drawText(x, r.lay, symbols);
          return true;
        }, `${opts.scanUrl}|pw|${model.faceIdx}|${model.face.oracle_text}`);
        if (best) {
          // nicht größer als das, was ins Textfeld passt
          let c = best.cap;
          const fits = (cc) => {
            const lay = layoutPlaneswalker(ctx, rulesParas, L, { fixedCap: cc });
            const it = lay?.rows || [];
            return lay && it.every((r) => !r.lay.overflow) && it.reduce((a, r) => a + r.lay.height, 0) + cc * 0.85 * it.length <= L.pwBox.h;
          };
          while (c > L.rules.minCap && !fits(c)) c -= 0.5;
          pwCap = c;
        }
      }
    }
    let pw = layoutPlaneswalker(ctx, rulesParas, L, { fixedCap: pwCap });
    // Original-Layout übernehmen (wie beim Regeltext): Zeilen aus dem Scan, Zeilengrenzen daraus
    if (pw && scan && opts.alignArt && opts.copyLayout !== false && face.printed && opts.showReminder && !opts.fontCap) {
      const shiftX = Math.round(0.044 * W);
      const pRules = rulesParas.filter((p) => p.kind === 'rules');
      // links der Textspalte stehen Loyalitätssymbole -> ausblenden, linke Kanten kommen aus dem Layout
      const region = { x: L.text.x - 2, y: L.pwBox.y + 6, w: L.text.w + 12, h: L.pwBox.h - 4 };
      const ex = L.shield ? { x: L.shield.cx - L.shield.w / 2 - 10, y: L.shield.cy - L.shield.h / 2 - 10 } : null;
      const lines = scanLines(scan, region, W, H, ex);
      const copied = lines && layoutFromLines(ctx, pRules, pw.cap, lines, L.text, METRICS,
        (pi) => (pRules[pi].loyalty ? L.text.x : L.text.x - shiftX));
      if (globalThis.__fitDebug) console.log('pwcopy', lines && lines.length, pRules.length, copied && copied.worst);
      if (copied && copied.worst < 0.12 && copied.blocks.length === pRules.length) {
        const c = copied.cap;
        const rows = copied.blocks.map((b, i) => {
          const first = b.lines[0].baseline - c; const last = b.lines[b.lines.length - 1].baseline + c * METRICS.descent;
          return { first, last, b };
        });
        pw = {
          cap: c,
          rows: rows.map((r, i) => ({
            top: i === 0 ? L.pwBox.y : (rows[i - 1].last + r.first) / 2,
            bottom: i === rows.length - 1 ? L.pwBox.y + L.pwBox.h : (r.last + rows[i + 1].first) / 2,
            para: pRules[i],
            lay: { cap: c, M: METRICS, blocks: [{ ...r.b, flavorBarY: null }], box: L.text, offset: 0 },
          })),
        };
        model.layoutCopied = true;
      }
    }
    if (pw) {
      drawPlaneswalkerText(ctx, pw, L, model.palettes[0], symbols);
      model.textCap = pw.cap;
    }
  } else if (basicSym) {
    const d = Math.min(L.text.h * 0.6, 330);
    drawSymbol(ctx, symbols, basicSym, L.text.x + L.text.w / 2 - d / 2, L.text.y + L.text.h / 2 - d / 2, d);
  } else if (paras.length) {
    const baseOpts = {
      maxCap: flags.planeswalker ? L.rules.maxCap * 0.9 : L.rules.maxCap,
      minCap: L.rules.minCap,
      fixedCap: opts.fontCap || null,
      exclude: ptZone,
      metrics: L.metrics,
      centerShort: L.rules.centerShort,
    };
    let textOpts = baseOpts;
    let textParas = paras;
    let textChecked = false;
    // Zeilen des Originals aus dem Scan (für die Übernahme des Zeilenlayouts und die Wortlaut-Wahl)
    const lines = scan && opts.alignArt && !(flags.planeswalker && !retroLayout) ? originalLines(textBox) : null;
    const copyAllowed = opts.copyLayout !== false && opts.showReminder && opts.showFlavor && !opts.fontCap;
    let lay = null;
    if (rulesVariants) {
      // Ergebnisse der Worker (parallel berechnet) bzw. lokal, falls keine Worker verfügbar
      const results = rulesJobs ? await Promise.all(rulesJobs) : rulesVariants.map(() => null);
      // Wortlaut/Reminder-Variante wählen: jede Variante im Zeilenlayout des Scans (falls übernehmbar)
      // zeichnen und die Schrift pixelweise mit dem Scan vergleichen; ohne Zeilen zählt die
      // Bewertung aus fitRulesVariant (erste Zeile + Blocklage). Die erste Variante (gedruckter bzw.
      // nach Datum erwarteter Text) gewinnt, solange keine andere deutlich (> 0,05) besser passt.
      const region = { x: textBox.x - 10, y: textBox.y - 10, w: textBox.w + 20, h: textBox.h + 20 };
      let best = null;
      rulesVariants.forEach(({ paras: vp, label }, vi) => {
        const r = results[vi] || fitRulesVariant({ vp, textBox, baseOpts, rules: L.rules, metrics: L.metrics, scan, W, H, symbols, key: rulesKey(vi) });
        const auto = fitText(ctx, vp, textBox, r.o);
        const copied = lines ? copyLines(vp, auto, lines) : null;
        const cand = copied && copied.worst < 0.12 ? copied : auto;
        const sim = rulesVariants.length > 1 ? inkSimilarity(scan, region, W, H, (x) => drawText(x, cand, symbols, { flavorBar: false })) : 0;
        if (globalThis.__fitDebug) console.log('variant', vi, label, JSON.stringify(r.fit), r.total, 'sim', sim.toFixed(3), 'worst', copied && copied.worst.toFixed(3));
        const better = !best || (lines ? sim > best.sim + 0.05 : r.total < best.total - 4);
        if (better) best = { total: r.total, sim, o: r.o, vp, label, auto, copied };
      });
      textOpts = best.o;
      textParas = best.vp;
      model.textVariant = best.label;
      // Wortlaut am Scan geprüft -> wie gedruckter Text behandeln (Zeilenlayout darf übernommen werden)
      textChecked = true;
      lay = best.auto;
      if (copyAllowed && best.copied && best.copied.worst < 0.12) { lay = best.copied; model.layoutCopied = true; }
    } else {
      lay = fitText(ctx, textParas, textBox, textOpts);
      // Original-Layout übernehmen: Zeilenumbrüche, Grundlinien und Ränder wie auf dem Scan –
      // nur, wenn der Text nicht angepasst wurde (gedruckter Text, Reminder + Flavor an, Größe automatisch)
      if (lines && copyAllowed && face.printed) {
        const copied = copyLines(textParas, lay, lines);
        if (copied && copied.worst < 0.12) { lay = copied; model.layoutCopied = true; }
      }
    }
    if (flags.planeswalker && !retroLayout) drawPlaneswalkerRows(ctx, lay, L);
    // Schriftfarbe des Regeltexts: weiß mit Schatten bei Clear Textboxes; mit Scan wird gemessen
    // (helle Schrift auf dunklem Textfeld, z. B. FNM-/Secret-Lair-Drucke)
    let rulesColor = clear ? '#ffffff' : null;
    if (!clear && opts.alignArt && scan && opts.matchColors !== false) {
      const sampled = sampleTextColor(scan, W, H, { x: textBox.x - 10, y: textBox.y - 10, w: textBox.w + 20, h: textBox.h + 20 },
        (c) => drawText(c, lay, symbols, { color: '#fff', flavorBar: false }), { maxLightBg: 140 });
      if (sampled) rulesColor = luminance(sampled) > 0.55 ? '#ffffff' : null;
    }
    drawText(ctx, lay, symbols, { flavorBar: opts.flavorBar !== false,
      ...(rulesColor ? { color: rulesColor, shadow: 'rgba(0,0,0,0.85)' } : {}) });
    model.rulesColor = rulesColor;
    model.textCap = lay.cap;
  }

  perfMark('text');
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
        { align: 'center', color: flags.vehicle || darkBack ? '#ffffff' : '#111' });
    }
  }

  if (flags.holo && !cc) drawHolo(ctx, L);
  drawInfo(ctx, model);
  ctx.restore();
  perfMark('end');
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

/**
 * Farbindikator wie Card Conjurer (packM15CIPips): Grundplatte (base.png, eigene Bounds) und
 * kartengroße Farb-SVGs, bei mehreren Farben über die Masken firstHalf/secondHalf bzw. …Third.
 * Liefert die Verschiebung der Typzeile.
 */
async function drawColorIndicator(ctx, colors, T) {
  const order = ['W', 'U', 'B', 'R', 'G'].filter((c) => colors.includes(c));
  if (!order.length) return 0;
  const base = '/cc/img/frames/m15/ciPips/';
  const b = { x: 0.0767 * W, y: 0.5748 * H, w: 0.0467 * W, h: 0.0334 * H };
  // an die Typzeile des aktuellen Layouts verschieben (SVGs sind für die M15-Typzeile gezeichnet)
  const dx = T.x - 0.0087 * W - b.x;
  const dy = T.baseline - T.cap / 2 + 3.5 - b.h / 2 - b.y;
  try {
    const parts = order.length === 2 ? ['firstHalf', 'secondHalf'] : order.length === 3 ? ['firstThird', 'secondThird', 'thirdThird'] : [];
    const [plate, ...rest] = await Promise.all([loadImage(`${base}base.png`),
      ...order.map((c) => loadImage(`${base}${c.toLowerCase()}.svg`)), ...parts.map((p) => loadImage(`${base}${p}.svg`))]);
    const cols = rest.slice(0, order.length);
    const masks = rest.slice(order.length);
    ctx.drawImage(plate, b.x + dx, b.y + dy, b.w, b.h);
    if (order.length > 3) {
      ctx.drawImage(cols[0], dx, dy, W, H);
    } else {
      cols.forEach((img, i) => {
        if (!masks[i]) { ctx.drawImage(img, dx, dy, W, H); return; }
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const cx = c.getContext('2d');
        cx.drawImage(masks[i], 0, 0, W, H);
        cx.globalCompositeOperation = 'source-in';
        cx.drawImage(img, 0, 0, W, H);
        ctx.drawImage(c, dx, dy, W, H);
      });
    }
  } catch {
    return 0;
  }
  return b.w + 0.004 * W;
}

/** Bereinigt gedruckten Text aus MTGJSON (Zeilenenden, fehlerhaftes Schnee-Symbol "{S}i}"). */
/** MTGJSON führt bei Adventure/Split teils beide Hälften in einem Text (" // "): passende Hälfte wählen. */
function pickPart(text, oracle) {
  if (!text || !text.includes(' // ')) return text;
  const parts = text.split(' // ');
  const words = (t) => new Set(String(t || '').toLowerCase().replace(/\([^)]*\)/g, ' ').match(/[a-z]{3,}/g) || []);
  const o = words(oracle);
  let best = parts[0]; let bs = -1;
  for (const p of parts) {
    const w = words(p); let c = 0;
    for (const x of w) if (o.has(x)) c++;
    const sc = c / Math.max(1, Math.min(w.size, o.size));
    if (sc > bs) { bs = sc; best = p; }
  }
  return best;
}

function cleanPrinted(t) {
  return t.replace(/\\r/g, '').replace(/\r/g, '').replace(/\{S\}i\}/g, '{S}')
    // alte Gatherer-Kürzel für Tap/Untap ("ocT", "ocQ")
    .replace(/\bocT\b/g, '{T}').replace(/\bocQ\b/g, '{Q}')
    .replace(/\s+$/, '');
}

/** Gedruckter und Oracle-Text gehören zur selben Karte? (Wortüberdeckung) */
function similarText(a, b) {
  if (!b) return true;
  const words = (t) => new Set(String(t).toLowerCase().replace(/\([^)]*\)/g, ' ').match(/[a-z]{3,}/g) || []);
  const A = words(a); const B = words(b);
  if (!A.size || !B.size) return true;
  let common = 0;
  for (const w of A) if (B.has(w)) common++;
  return common / Math.min(A.size, B.size) >= 0.4;
}

/**
 * Typzeile so, wie sie zur Druckzeit aussah (MTGJSON/Scryfall liefern die heutige Form):
 * - bis Classic Sixth Edition (1999): Kreaturen als "Summon <Typ>", legendäre als "Summon Legend",
 *   Auren als "Enchant Creature/Land/…"
 * - Planeswalker vor Amonkhet (2017) ohne "Legendary"
 */
export function historicTypeLine(type, released, text = '', oracle = '') {
  let t = type;
  if (released && released < '2017-04-28' && /\bPlaneswalker\b/.test(t)) t = t.replace(/^Legendary /, '');
  // "Kindred" hieß bis Mitte 2024 "Tribal"
  if (released && released < '2024-06-07') t = t.replace(/\bKindred\b/, 'Tribal');
  if (released && released < '1999-04-21') {
    let m;
    if ((m = /^Legendary Creature — (.+)$/.exec(t))) t = 'Summon Legend';
    else if ((m = /^Creature — (.+)$/.exec(t))) t = `Summon ${m[1]}`;
  }
  // Auren hießen bis zur 9. Edition (Juli 2005) "Enchant Creature/Land/…"
  if (released && released < '2005-07-29' && /^Enchantment — Aura/.test(t)) {
    const what = /^Enchant (\w+)/m.exec(text) || /^Enchant (\w+)/m.exec(oracle);
    if (what) t = `Enchant ${what[1][0].toUpperCase()}${what[1].slice(1)}`;
  }
  return t;
}

/**
 * Offizielles Set-Symbol aus Card Conjurer (Assets/img/setSymbols/official/<set>-<rarity>.svg,
 * wie fetchSetSymbol() in creator-23.js). Set-Code: zuerst der des Scryfall-Symbols (Promo-Sets
 * nutzen das Symbol ihres Hauptsets), dann der Druck selbst.
 */
const SET_ALIASES = { anb: 'ana', tsb: 'tsp', pmei: 'sld' };
const PNG_SETS = new Set(['moc', 'ltr', 'ltc', 'cmm', 'who', 'scd', 'woe', 'wot', 'woc', 'lci', 'lcc', 'mkm', 'mkc', 'otj', 'otc']);
async function loadOfficialSetSymbol(model) {
  const r = { common: 'c', uncommon: 'u', rare: 'r', mythic: 'm', special: 's', bonus: 's' }[model.card.rarity];
  if (!r) return null;
  const iconCode = /\/sets\/([a-z0-9]+)\.svg/i.exec(model.set?.icon_svg_uri || '')?.[1];
  const codes = [...new Set([iconCode, model.card.set].filter(Boolean).map((c) => SET_ALIASES[c.toLowerCase()] || c.toLowerCase()))];
  for (const c of codes) {
    for (const ext of PNG_SETS.has(c) ? ['png', 'svg'] : ['svg', 'png']) {
      try { return await loadImage(`/cc/img/setSymbols/official/${c}-${r}.${ext}`); } catch { /* nächste Variante */ }
    }
  }
  return null;
}

function basicLandSymbol(face) {
  const m = face.produced_mana || [];
  if (m.length === 1) return `{${m[0]}}`;
  const ci = face.color_identity || [];
  if (ci.length === 1) return `{${ci[0]}}`;
  return '{C}';
}
