// Satz-Engine für den Regeltext: Zeilenumbruch, automatische Schriftgröße
// (größte Größe, die passt), vertikale Zentrierung wie auf echten Karten,
// Mana-Symbole im Fließtext und Flavor-Trennlinie.
//
// Alle Maße sind relativ zur Versalhöhe (c) angegeben und wurden an Scans
// gedruckter Karten abgemessen. Die Schriftgröße wird aus der tatsächlich
// gemessenen Versalhöhe der geladenen Schrift berechnet – so passt der Satz
// mit den Originalschriften genauso wie mit Ersatzschriften.

export const FONTS = { rules: 'CMRules', italic: 'CMRulesItalic' };

/**
 * Horizontale Korrektur je Schrift: Ersatzschriften laufen schmaler/breiter als
 * die Originale. Mit dem Faktor fallen Zeilenumbrüche wie auf der echten Karte.
 */
const SCALE = new Map();
export function setFontScales(map) {
  SCALE.clear();
  for (const [fam, x] of Object.entries(map)) SCALE.set(fam, x || 1);
}
export const scaleOf = (family) => SCALE.get(family) || 1;
export const getFontScales = () => Object.fromEntries(SCALE);

export const METRICS = {
  lineHeight: 1.545, // Grundlinienabstand
  paraGap: 0.62, // zusätzlicher Abstand zwischen Fähigkeiten
  flavorGap: 1.26, // zusätzlicher Abstand vor dem Flavortext
  flavorBar: 1.12, // Position der Trennlinie unter der letzten Regelzeile
  symSize: 1.1, // Durchmesser Mana-Symbol im Text (an Scans nachgemessen)
  symDrop: 0.1, // Symbol ragt etwas unter die Grundlinie
  symGap: 0.08,
  descent: 0.32,
};

const capCache = new Map();
/** Versalhöhe einer Schrift als Anteil der Schriftgröße. */
export function capRatio(ctx, family) {
  if (capCache.has(family)) return capCache.get(family);
  ctx.save();
  ctx.font = `200px ${family}`;
  const m = ctx.measureText('HTEZ');
  ctx.restore();
  const r = m.actualBoundingBoxAscent / 200 || 0.68;
  capCache.set(family, r);
  return r;
}
export const resetCapCache = () => capCache.clear();

/** Schriftgröße in px, sodass die Versalhöhe = cap ist. */
export const sizeForCap = (ctx, family, cap) => cap / capRatio(ctx, family);

function fontFor(ctx, italic, cap) {
  const fam = italic ? FONTS.italic : FONTS.rules;
  return `${sizeForCap(ctx, fam, cap).toFixed(2)}px ${fam}`;
}
const famOf = (italic) => (italic ? FONTS.italic : FONTS.rules);

function splitWords(atoms) {
  const words = [];
  let cur = null;
  const push = () => { if (cur && cur.pieces.length) words.push(cur); cur = null; };
  for (const a of atoms) {
    if (a.t === 'sym') {
      if (!cur) cur = { pieces: [] };
      cur.pieces.push(a);
      continue;
    }
    for (const p of a.text.split(/( +)/)) {
      if (!p) continue;
      if (/^ +$/.test(p)) { push(); continue; }
      if (!cur) cur = { pieces: [] };
      cur.pieces.push({ t: 'text', text: p, italic: a.italic });
    }
  }
  push();
  return words;
}

function measureWord(ctx, word, c) {
  let w = 0;
  for (let i = 0; i < word.pieces.length; i++) {
    const p = word.pieces[i];
    if (p.t === 'sym') {
      p.w = c * METRICS.symSize;
      const next = word.pieces[i + 1];
      p.gap = next ? c * METRICS.symGap : 0;
      w += p.w + p.gap;
    } else {
      ctx.font = fontFor(ctx, p.italic, c);
      p.w = ctx.measureText(p.text).width * scaleOf(famOf(p.italic));
      w += p.w;
    }
  }
  return w;
}

function layoutParagraph(ctx, para, c, width) {
  const words = splitWords(para.atoms);
  ctx.font = fontFor(ctx, para.kind === 'flavor', c);
  const space = ctx.measureText(' ').width * scaleOf(famOf(para.kind === 'flavor'));
  const lines = [];
  let line = { words: [], w: 0 };
  let overflow = false;
  for (const word of words) {
    const w = measureWord(ctx, word, c);
    const needed = line.words.length ? line.w + space + w : w;
    if (needed > width && line.words.length) {
      lines.push(line);
      line = { words: [], w: 0 };
    }
    if (w > width) overflow = true;
    line.w = line.words.length ? line.w + space + w : w;
    word.x = line.w - w;
    line.words.push(word);
  }
  if (line.words.length) lines.push(line);
  return { lines, overflow };
}

/** Komplettes Layout für eine Versalhöhe c; Koordinaten relativ (y=0 = erste Grundlinie). */
export function layoutAll(ctx, paras, c, width, M = METRICS) {
  const lh = c * M.lineHeight;
  const blocks = [];
  let baseline = 0;
  let overflow = false;
  let prev = null;
  for (const para of paras) {
    let flavorBarY = null;
    if (prev) {
      baseline += lh;
      if (prev.kind !== 'flavor' && para.kind === 'flavor') {
        flavorBarY = M.flavorBar == null ? null : baseline - lh + c * M.flavorBar;
        baseline += c * M.flavorGap;
      } else if (para.kind !== 'flavor') {
        baseline += c * M.paraGap;
      }
    }
    const { lines, overflow: o } = layoutParagraph(ctx, para, c, width);
    overflow ||= o;
    lines.forEach((l, i) => { l.baseline = baseline + i * lh; });
    baseline += (lines.length - 1) * lh;
    blocks.push({ para, lines, flavorBarY });
    prev = para;
  }
  const visTop = -c;
  const visBottom = baseline + c * M.descent;
  return { cap: c, M, blocks, overflow, visTop, visBottom, height: visBottom - visTop };
}

/**
 * Sucht die größte Versalhöhe, mit der alles in die Box passt.
 * box = {x,y,w,h}; opts.maxCap/minCap; opts.exclude = {x, y} (P/T-Box unten rechts)
 */
export function fitText(ctx, paras, box, opts = {}) {
  const max = opts.maxCap || 48;
  const min = opts.minCap || 16;
  const M = { ...METRICS, ...(opts.metrics || {}) };
  if (opts.fixedCap) return place(layoutAll(ctx, paras, opts.fixedCap, box.w, M), box, opts);
  // Gedruckte Karten verkleinern den Regeltext in 0,5-pt-Schritten ausgehend
  // von 9 pt (= maxCap); am Questing-Beast-Scan exakt 7,0 pt nachgemessen.
  const step = opts.step || max / 18;
  for (let c = max; c >= min; c -= step) {
    const lay = layoutAll(ctx, paras, c, box.w, M);
    if (lay.overflow || lay.height > box.h) continue;
    const placed = place(lay, box, opts);
    if (!placed.collides) return placed;
  }
  return place(layoutAll(ctx, paras, min, box.w, M), box, opts);
}

export function place(lay, box, opts) {
  // vertikal zentrieren (echte Karten zentrieren den Regeltext im Textfeld)
  let offset = opts.align === 'top' ? box.y - lay.visTop : box.y + (box.h - lay.height) / 2 - lay.visTop;
  // Würde der zentrierte Block unten bis in die Höhe der P/T-Box reichen, rückt er
  // nach oben (soweit oben Luft ist) – so gemessen an gedruckten Kreaturen.
  if (opts.exclude) {
    const over = lay.visBottom + offset - (opts.exclude.y + (opts.exclude.tolerance ?? 6));
    const slack = lay.visTop + offset - box.y;
    if (over > 0 && slack > 0) offset -= Math.min(over, slack);
  }
  lay.offset = offset;
  lay.box = box;
  lay.collides = false;
  const lines = lay.blocks.flatMap((b) => b.lines);
  const maxCentered = typeof opts.centerShort === 'number' ? opts.centerShort : 3;
  const center = opts.centerShort && lines.length <= maxCentered && lay.blocks.every((b) => b.para.kind !== 'flavor');
  for (const l of lines) l.dx = center ? (box.w - l.w) / 2 : 0;
  if (opts.exclude) {
    for (const b of lay.blocks) {
      for (const l of b.lines) {
        const bottom = l.baseline + offset + lay.cap * lay.M.descent;
        if (bottom > opts.exclude.y && box.x + l.dx + l.w > opts.exclude.x) lay.collides = true;
      }
    }
  }
  return lay;
}

/** Zeichnet ein fertiges Layout. symbols: Map code -> Image */
export function drawText(ctx, lay, symbols, opts = {}) {
  const { box, cap, offset } = lay;
  ctx.save();
  ctx.fillStyle = opts.color || '#111';
  ctx.textBaseline = 'alphabetic';
  for (const block of lay.blocks) {
    if (block.flavorBarY != null && opts.flavorBar !== false) {
      drawFlavorBar(ctx, box.x, block.flavorBarY + offset, box.w, cap);
    }
    for (const line of block.lines) {
      const by = line.baseline + offset;
      const lx = line.x != null ? line.x : box.x + line.dx;
      const sx = line.sx || 1;
      if (sx !== 1) { ctx.save(); ctx.translate(lx, 0); ctx.scale(sx, 1); }
      for (const word of line.words) {
        let x = (sx !== 1 ? 0 : lx) + word.x;
        for (const p of word.pieces) {
          if (p.t === 'sym') {
            drawSymbol(ctx, symbols, p.code, x, by + cap * lay.M.symDrop - p.w, p.w);
            x += p.w + p.gap;
          } else {
            ctx.font = fontFor(ctx, p.italic, cap);
            const sx = scaleOf(famOf(p.italic));
            if (sx !== 1) {
              ctx.save();
              ctx.translate(x, by);
              ctx.scale(sx, 1);
              ctx.fillText(p.text, 0, 0);
              ctx.restore();
            } else {
              ctx.fillText(p.text, x, by);
            }
            x += p.w;
          }
        }
      }
      if (sx !== 1) ctx.restore();
    }
  }
  ctx.restore();
}

export function drawSymbol(ctx, symbols, code, x, y, d, shadow = null) {
  const img = symbols.get(code);
  if (shadow) {
    ctx.save();
    ctx.fillStyle = shadow.color || '#000';
    ctx.beginPath();
    ctx.arc(x + d / 2 + shadow.dx, y + d / 2 + shadow.dy, d / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  if (img) {
    ctx.drawImage(img, x, y, d, d);
  } else {
    ctx.save();
    ctx.fillStyle = '#ccc';
    ctx.beginPath();
    ctx.arc(x + d / 2, y + d / 2, d / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.font = `${d * 0.6}px CMTitle`;
    ctx.textAlign = 'center';
    ctx.fillText(code.replace(/[{}]/g, ''), x + d / 2, y + d * 0.72);
    ctx.restore();
  }
}

function drawFlavorBar(ctx, x, y, w, c) {
  const x0 = x + w * 0.005;
  const x1 = x + w * 0.995;
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  g.addColorStop(0, 'rgba(40,36,32,0)');
  g.addColorStop(0.08, 'rgba(40,36,32,0.7)');
  g.addColorStop(0.92, 'rgba(40,36,32,0.7)');
  g.addColorStop(1, 'rgba(40,36,32,0)');
  ctx.save();
  ctx.fillStyle = g;
  const t = Math.max(1.5, c * 0.05);
  ctx.beginPath();
  ctx.moveTo(x0, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y - t, x1, y);
  ctx.quadraticCurveTo((x0 + x1) / 2, y + t, x0, y);
  ctx.fill();
  ctx.restore();
}

/**
 * Einzeilige Texte (Name, Typzeile): erst leicht horizontal stauchen,
 * dann Schrift verkleinern – so wie es bei gedruckten Karten gemacht wird.
 * cap = gewünschte Versalhöhe.
 */
export function drawFittedLine(ctx, text, family, cap, x, baseline, maxW, opts = {}) {
  const size0 = sizeForCap(ctx, family, cap);
  const base = scaleOf(family);
  let s = size0;
  let w;
  let sx = base;
  for (; s > size0 * 0.5; s -= 0.5) {
    ctx.font = `${s}px ${family}`;
    w = ctx.measureText(text).width;
    if (w * base <= maxW) { sx = base; break; }
    if (w * base * (opts.minScaleX ?? 0.88) <= maxW) { sx = maxW / w; break; }
  }
  ctx.save();
  ctx.font = `${s}px ${family}`;
  ctx.textBaseline = 'alphabetic';
  let drawX = x;
  if (opts.align === 'right') drawX = x - w * sx;
  else if (opts.align === 'center') drawX = x - (w * sx) / 2;
  ctx.translate(drawX, baseline);
  ctx.scale(sx, 1);
  if (opts.shadow) {
    ctx.fillStyle = opts.shadow;
    ctx.fillText(text, opts.shadowDx ?? 3, opts.shadowDy ?? 3);
  }
  ctx.fillStyle = opts.color || '#111';
  ctx.fillText(text, 0, 0);
  ctx.restore();
  return { size: s, width: w * sx };
}


/**
 * Setzt den Text in die Zeilenstruktur des Originals (aus dem Scan): gleiche Anzahl Zeilen,
 * Umbrüche so gewählt, dass die Zeilenlängen am besten passen, jede Zeile auf der Grundlinie
 * und an der linken Kante der Original-Zeile; minimale Laufweitenkorrektur (±4 %) je Zeile.
 * lines = [{base, left, right}] in Kartenkoordinaten. Liefert ein Layout für drawText oder null.
 */
export function layoutFromLines(ctx, paras, c, lines, box, M = METRICS, paraLeft = null) {
  // Wörter aller Absätze mit Breiten
  const words = [];
  paras.forEach((para, pi) => {
    const ws = splitWords(para.atoms);
    ctx.font = fontFor(ctx, para.kind === 'flavor', c);
    const space = ctx.measureText(' ').width * scaleOf(famOf(para.kind === 'flavor'));
    for (const w of ws) words.push({ word: w, w: measureWord(ctx, w, c), space, pi });
  });
  const n = words.length; const N = lines.length;
  if (!n || N < paras.length || N > n) return null;
  const lineW = (i, k) => {
    let w = 0;
    for (let t = i; t < k; t++) w += words[t].w + (t > i ? words[t].space : 0);
    return w;
  };
  // DP: dp[j][k] = minimale Kosten, die ersten k Wörter auf j Zeilen zu verteilen
  const INF = 1e18;
  const dp = Array.from({ length: N + 1 }, () => new Float64Array(n + 1).fill(INF));
  const from = Array.from({ length: N + 1 }, () => new Int32Array(n + 1).fill(-1));
  dp[0][0] = 0;
  const leftOf = (j, pi) => (paraLeft ? paraLeft(pi) : lines[j].left);
  for (let j = 1; j <= N; j++) {
    for (let k = 1; k <= n; k++) {
      const target = lines[j - 1].right - leftOf(j - 1, words[k - 1].pi);
      // Zeile endet vor einem Absatzwechsel oder am Ende? (Pflichtumbruch wird durch "gleicher Absatz" erzwungen)
      for (let i = k - 1; i >= 0; i--) {
        if (words[i].pi !== words[k - 1].pi) break;
        if (i > 0 && dp[j - 1][i] >= INF) continue;
        if (i === 0 && j !== 1) continue;
        if (i > 0 && words[i - 1].pi === words[i].pi && false) continue;
        const w = lineW(i, k);
        const e = (w - target) / Math.max(target, 1);
        const cost = dp[j - 1][i] + e * e;
        if (cost < dp[j][k]) { dp[j][k] = cost; from[j][k] = i; }
      }
    }
  }
  if (dp[N][n] >= INF) return null;
  // Rückverfolgen
  const cuts = [];
  let k = n;
  for (let j = N; j >= 1; j--) { const i = from[j][k]; cuts.unshift([i, k]); k = i; }
  // Absatzgrenzen müssen auf Zeilengrenzen fallen (durch "gleicher Absatz" garantiert); Blöcke bauen
  const blocks = [];
  let worst = 0;
  cuts.forEach(([i, kk], j) => {
    const L = lines[j];
    let x = 0;
    const lw = [];
    for (let t = i; t < kk; t++) {
      if (t > i) x += words[t].space;
      words[t].word.x = x;
      x += words[t].w;
      lw.push(words[t].word);
    }
    const lx = leftOf(j, words[i].pi);
    const target = L.right - lx;
    const sx = Math.min(1.04, Math.max(0.96, target / Math.max(x, 1)));
    worst = Math.max(worst, Math.abs(target / Math.max(x, 1) - 1));
    const pi = words[i].pi;
    let block = blocks[blocks.length - 1];
    if (!block || block.pi !== pi) { block = { pi, para: paras[pi], lines: [], flavorBarY: null }; blocks.push(block); }
    block.lines.push({ words: lw, w: x, baseline: L.base, x: lx, sx, dx: 0 });
  });
  // Flavor-Trennlinie mittig zwischen letzter Regel- und erster Flavor-Zeile
  for (let b = 1; b < blocks.length; b++) {
    if (blocks[b].para.kind === 'flavor' && blocks[b - 1].para.kind !== 'flavor') {
      const a = blocks[b - 1].lines[blocks[b - 1].lines.length - 1].baseline;
      const z = blocks[b].lines[0].baseline;
      blocks[b].flavorBarY = a + (z - c - a) / 2 + c * M.descent * 0.5;
    }
  }
  const natural = cuts.reduce((a, [i, kk]) => a + lineW(i, kk), 0);
  const targetSum = cuts.reduce((a, _, j) => a + (lines[j].right - leftOf(j, words[cuts[j][0]].pi)), 0);
  return { cap: c, M, blocks, overflow: false, offset: 0, box, fromScan: true, worst, widthRatio: targetSum / Math.max(natural, 1) };
}
