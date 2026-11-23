// Spalten-Layouts: Saga (Kapitel) und Class (Level-Leisten).
// Gemeinsames Prinzip: der Text besteht aus Abschnitten; es wird die größte
// Schrift gesucht, mit der alle Abschnitte samt Mindestabstand passen, und der
// übrige Platz gleichmäßig verteilt (wie bei gedruckten Karten).
import { layoutAll, place, drawText, drawFittedLine, drawSymbol, METRICS, sizeForCap } from './textlayout.js';
import { parseRules } from './textparse.js';
import { darken, lighten, hexToRgb } from './textures.js';

const rgba = (hex, a) => `rgba(${hexToRgb(hex).join(',')},${a})`;

/**
 * sections: [{ paras, x, w, fixedH }]; region: {y, h}
 * Liefert pro Abschnitt top/bottom und ein zeichenfertiges Layout.
 */
function fitSections(ctx, sections, region, rules, fixedCap) {
  const step = rules.step || rules.maxCap / 18;
  let pick = null;
  for (let c = fixedCap || rules.maxCap; c >= rules.minCap; c -= step) {
    const items = sections.map((s) => (s.paras.length ? layoutAll(ctx, s.paras, c * (s.scale || 1), s.w, METRICS) : null));
    const heights = items.map((it, i) => (it ? it.height : 0) + (sections[i].fixedH || 0));
    const total = heights.reduce((a, b) => a + b, 0);
    const minPad = c * 0.9;
    pick = { c, items, heights, total };
    if (fixedCap) break;
    if (!items.some((it) => it && it.overflow) && total + minPad * sections.length <= region.h) break;
  }
  const pad = Math.max(0, (region.h - pick.total) / sections.length);
  let y = region.y;
  return {
    cap: pick.c,
    rows: sections.map((s, i) => {
      const top = y;
      y += pick.heights[i] + pad;
      const it = pick.items[i];
      let lay = null;
      if (it) {
        for (const b of it.blocks) for (const l of b.lines) l.dx = 0;
        const textTop = top + (s.fixedH || 0) + pad / 2;
        lay = { ...it, box: { x: s.x, y: textTop, w: s.w, h: it.height }, offset: textTop - it.visTop };
      }
      return { top, bottom: y, section: s, lay };
    }),
  };
}

function textCenter(lay) {
  const lines = lay.blocks.flatMap((b) => b.lines);
  return (lines[0].baseline - lay.cap + lines[lines.length - 1].baseline + lay.cap * METRICS.descent) / 2 + lay.offset;
}

// Grafiken aus Card Conjurer (versionSaga.js / versionClass.js); null -> per Code gezeichnet
let ccImg = null;
export function setColumnImages(imgs) { ccImg = imgs || null; }

// ---------------------------------------------------------------- Saga

const CHAPTER_RE = /^([IVX]+(?:,\s*[IVX]+)*)\s+—\s+(.*)$/;

export function drawSagaText(ctx, model, L, pal, symbols, keywords) {
  const { face, opts } = model;
  const lines = (face.oracle_text || '').split('\n').filter(Boolean);
  const reminder = [];
  const chapters = [];
  for (const line of lines) {
    const m = line.match(CHAPTER_RE);
    if (m) chapters.push({ numerals: m[1].split(/,\s*/), text: m[2] });
    else if (chapters.length) chapters[chapters.length - 1].text += `\n${line}`;
    else reminder.push(line);
  }
  const parse = (t) => parseRules(t, { showReminder: opts.showReminder, keywords });
  const sections = [];
  const remParas = parse(reminder.join('\n'));
  if (remParas.length) {
    sections.push({ kind: 'reminder', paras: remParas, x: L.saga.reminderX, w: L.box.x + L.box.w - L.saga.reminderX - 18 });
  }
  for (const ch of chapters) {
    sections.push({ kind: 'chapter', numerals: ch.numerals, paras: parse(ch.text), x: L.text.x, w: L.text.w });
  }
  // Reminder-Bereich hat feste Höhe; die Kapitel bekommen Höhe nach Inhalt (wie gedruckt),
  // übriger Platz wird gleichmäßig verteilt
  const remH = sections[0]?.kind === 'reminder' ? L.saga.reminderH : 0;
  const chSections = sections.filter((x) => x.kind === 'chapter');
  const avail = L.box.h - remH;
  const step = L.rules.step;
  let cap = opts.fontCap || L.rules.maxCap;
  let items;
  for (; cap >= L.rules.minCap; cap -= step) {
    items = sections.map((x) => (x.paras.length ? layoutAll(ctx, x.paras, cap, x.w, METRICS) : null));
    const remOk = !items[0] || sections[0].kind !== 'reminder' || (!items[0].overflow && items[0].height + cap * 1.0 <= remH);
    const need = sections.reduce((a, x, i) => (x.kind === 'chapter' && items[i] ? a + items[i].height + cap * 1.6 : a), 0);
    const ok = remOk && need <= avail && items.every((it) => !it || !it.overflow);
    model._fitOk = ok;
    if (opts.fontCap || ok) break;
  }
  const chNeed = sections.map((x, i) => (x.kind === 'chapter' ? (items[i] ? items[i].height : 0) + cap * 1.6 : 0));
  const extra = Math.max(0, (avail - chNeed.reduce((a, b) => a + b, 0)) / Math.max(1, chSections.length));
  let yy = L.box.y + remH;
  const regions = sections.map((x, i) => {
    if (x.kind === 'reminder') return { y: L.box.y, h: remH };
    const r = { y: yy, h: chNeed[i] + extra };
    yy += r.h;
    return r;
  });
  const res = {
    cap,
    rows: sections.map((x, i) => {
      const it = items[i];
      const r = regions[i];
      let lay = null;
      if (it) {
        for (const b of it.blocks) for (const l of b.lines) l.dx = 0;
        lay = place(it, { x: x.x, y: r.y, w: x.w, h: r.h }, {});
      }
      return { top: r.y, bottom: r.y + r.h, section: x, lay };
    }),
  };

  // Kapitel-Leiste (Pfeil) links über die ganze Spalte – im Card-Conjurer-Rahmen schon enthalten
  if (!ccImg) {
    const top = L.box.y + 8;
    const bottom = L.box.y + L.box.h - 10;
    const x = L.saga.trackX;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x - 22, top);
    ctx.lineTo(x + 22, top);
    ctx.lineTo(x + 22, bottom - 40);
    ctx.lineTo(x, bottom);
    ctx.lineTo(x - 22, bottom - 40);
    ctx.closePath();
    ctx.fillStyle = darken(pal.box, 0.12);
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = rgba('#000000', 0.35);
    ctx.stroke();
    ctx.restore();
  }
  res.rows.forEach((r, i) => {
    // Trennlinien zwischen den Abschnitten
    if (i > 0 && ccImg?.sagaDivider) {
      // Card Conjurer: sagaDivider.png ab x = 0,1 · Breite, Breite 0,3947, Höhe 0,0029 (mittig auf der Grenze)
      ctx.drawImage(ccImg.sagaDivider, 0.1 * L.W, r.top - 0.0029 * L.H / 2, 0.3947 * L.W, 0.0029 * L.H);
    } else if (i > 0) {
      ctx.save();
      ctx.strokeStyle = rgba('#000000', 0.28);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(L.saga.trackX + 30, r.top);
      ctx.lineTo(L.box.x + L.box.w - 14, r.top);
      ctx.stroke();
      ctx.restore();
    }
    if (r.lay) drawText(ctx, r.lay, symbols);
    if (r.section.kind === 'chapter') {
      const n = r.section.numerals.length;
      const cy = r.lay ? textCenter(r.lay) : (r.top + r.bottom) / 2;
      // Abstand mehrerer Kapitel-Symbole: Card Conjurer 2 × 0,0358 der Kartenhöhe
      const step = ccImg?.sagaChapter ? 2 * 0.0358 * L.H : 104 + 8;
      r.section.numerals.forEach((num, k) => {
        drawChapterMarker(ctx, num, L.saga.markerX, cy + (k - (n - 1) / 2) * step, pal);
      });
    }
  });
  return res.cap;
}

function drawChapterMarker(ctx, numeral, cx, cy, pal) {
  const w = 88;
  const h = 104;
  if (ccImg?.sagaChapter) {
    // Card Conjurer: sagaChapter.png, 0,0787 × 0,0629 der Kartengröße
    const iw = 0.0787 * 1500; const ih = 0.0629 * 2100;
    ctx.drawImage(ccImg.sagaChapter, cx - iw / 2, cy - ih / 2, iw, ih);
    // Ziffern wie Card Conjurer: 0,0324 · H Schriftgröße, Grundlinie 0,0429 · H unter der Oberkante
    drawFittedLine(ctx, numeral, 'CMRules', 46, cx, cy - ih / 2 + 0.0429 * 2100, iw - 24, { align: 'center', color: '#1c1a17' });
    return;
  }
  const hex = (ww, hh) => {
    ctx.beginPath();
    ctx.moveTo(cx, cy - hh / 2);
    ctx.lineTo(cx + ww / 2, cy - hh / 4);
    ctx.lineTo(cx + ww / 2, cy + hh / 4);
    ctx.lineTo(cx, cy + hh / 2);
    ctx.lineTo(cx - ww / 2, cy + hh / 4);
    ctx.lineTo(cx - ww / 2, cy - hh / 4);
    ctx.closePath();
  };
  ctx.save();
  hex(w, h);
  ctx.fillStyle = '#2a2622';
  ctx.shadowColor = 'rgba(0,0,0,0.45)';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  hex(w - 10, h - 12);
  const g = ctx.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  g.addColorStop(0, '#f3e6c0');
  g.addColorStop(0.5, '#cdb67f');
  g.addColorStop(1, '#efdfb2');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
  drawFittedLine(ctx, numeral, 'CMRules', 40, cx, cy + 20, w - 18, { align: 'center', color: '#1c1a17' });
}

// ---------------------------------------------------------------- Class

const LEVEL_RE = /^((?:\{[^}]+\})+):\s*Level\s+(\d+)\s*$/i;

export function drawClassText(ctx, model, L, pal, symbols, keywords) {
  const { face, opts } = model;
  const lines = (face.oracle_text || '').split('\n').filter(Boolean);
  const groups = [{ header: null, text: [] }];
  for (const line of lines) {
    const m = line.match(LEVEL_RE);
    if (m) groups.push({ header: { cost: m[1], level: m[2] }, text: [] });
    else groups[groups.length - 1].text.push(line);
  }
  const parse = (t) => parseRules(t, { showReminder: opts.showReminder, keywords });
  const sections = [];
  groups.forEach((g, i) => {
    let text = g.text;
    if (i === 0) {
      // Reminder-Text oben kleiner, mit Trennlinie zum Level-1-Text
      const rem = text.filter((t) => /^\(.*\)$/.test(t.trim()));
      text = text.filter((t) => !/^\(.*\)$/.test(t.trim()));
      const remParas = parse(rem.join('\n'));
      if (remParas.length) sections.push({ paras: remParas, x: L.text.x, w: L.text.w, scale: 0.8, reminder: true });
    }
    sections.push({ header: g.header, paras: parse(text.join('\n')), x: L.text.x, w: L.text.w, fixedH: g.header ? L.classBar.h : 0 });
  });
  // Oben ausgerichteter Fluss mit festen Abständen (am Scan gemessen):
  // Reminder 32 px unter Oberkante, Text 1,7c nach Leiste/Trennlinie, 0,9c Luft danach.
  const step = L.rules.step;
  let cap = opts.fontCap || L.rules.maxCap;
  let flow;
  for (; cap >= L.rules.minCap; cap -= step) {
    flow = [];
    let y = L.box.y;
    let overflow = false;
    sections.forEach((x, i) => {
      if (x.header) { flow.push({ bar: x.header, y }); y += L.classBar.h; }
      else if (i > 0) { flow.push({ divider: true, y }); }
      const it = x.paras.length ? layoutAll(ctx, x.paras, cap * (x.scale || 1), x.w, METRICS) : null;
      const padTop = i === 0 ? 49 : x.header ? cap * 1.85 : cap * 1.7;
      const next = sections[i + 1];
      const after = next ? (next.header ? cap * 1.2 : cap * 0.65) : 0;
      if (it) {
        overflow ||= it.overflow;
        for (const b of it.blocks) for (const l of b.lines) l.dx = 0;
        const top = y + padTop;
        flow.push({ lay: { ...it, box: { x: x.x, y: top, w: x.w, h: it.height }, offset: top - it.visTop } });
        y = top + it.height + after;
      } else {
        y += padTop;
      }
    });
    model._fitOk = !overflow && y <= L.box.y + L.box.h;
    if (opts.fontCap || (!overflow && y <= L.box.y + L.box.h)) break;
  }
  for (const f of flow) {
    if (f.bar) drawLevelBar(ctx, f.bar, L.box.x, f.y, L.box.w, L.classBar.h, pal, symbols);
    else if (f.divider) divider(ctx, L.text.x, f.y, L.text.w);
    else drawText(ctx, f.lay, symbols);
  }
  return cap;
}

function divider(ctx, x, y, w) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, 'rgba(40,36,32,0)');
  g.addColorStop(0.1, 'rgba(40,36,32,0.6)');
  g.addColorStop(0.9, 'rgba(40,36,32,0.6)');
  g.addColorStop(1, 'rgba(40,36,32,0)');
  ctx.save();
  ctx.fillStyle = g;
  ctx.fillRect(x, y - 1.5, w, 3);
  ctx.restore();
}

function drawLevelBar(ctx, header, x, y, w, h, pal, symbols) {
  if (ccImg?.classHeader) {
    // Card Conjurer: class/header.png über x = 0,5014, Breite 0,422 der Karte
    ctx.drawImage(ccImg.classHeader, 0.5014 * 1500, y, 0.422 * 1500, h);
    drawLevelText(ctx, header, x, y, w, h, symbols);
    return;
  }
  ctx.save();
  ctx.fillStyle = darken(pal.box, 0.07);
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  // Oberkante mit kleiner Kerbe (Pfeil nach unten)
  const nx = x + w * 0.62;
  ctx.moveTo(x, y);
  ctx.lineTo(nx - 22, y);
  ctx.lineTo(nx, y + 20);
  ctx.lineTo(nx + 22, y);
  ctx.lineTo(x + w, y);
  ctx.moveTo(x, y + h);
  ctx.lineTo(x + w, y + h);
  ctx.stroke();
  ctx.restore();
  drawLevelText(ctx, header, x, y, w, h, symbols);
}

function drawLevelText(ctx, header, x, y, w, h, symbols) {
  // Kosten links, "Level N" rechts
  const d = 38;
  const codes = header.cost.match(/\{[^}]+\}/g) || [];
  let cx = x + 24;
  const cy = y + h / 2 + 4;
  for (const code of codes) {
    drawSymbol(ctx, symbols, code.toUpperCase(), cx, cy - d / 2, d);
    cx += d + 4;
  }
  ctx.save();
  ctx.fillStyle = '#111';
  ctx.font = `${sizeForCap(ctx, 'CMRules', 30)}px CMRules`;
  ctx.fillText(':', cx + 2, cy + 14);
  ctx.restore();
  drawFittedLine(ctx, `Level ${header.level}`, 'CMTitle', 33, x + w - 24, cy + 15, w * 0.45, { align: 'right', color: '#111' });
}
