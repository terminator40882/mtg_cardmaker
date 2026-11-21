// Zeichnet die Rahmenebene (ohne Text/Artwork) für die verschiedenen Stile.
import { fillTexture, texture, lighten, darken, mix } from './textures.js';
import { VEHICLE_PT } from './palettes.js';

export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  if (r <= 0) { ctx.rect(x, y, w, h); return; }
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

const rect = (ctx, b) => ctx.rect(b.x, b.y, b.w, b.h);

/** Leiste mit elliptischen Enden (M15-Namens-/Typleiste) */
function capsule(ctx, b, rx) {
  const { x, y, w, h } = b;
  ctx.moveTo(x + rx, y);
  ctx.lineTo(x + w - rx, y);
  ctx.ellipse(x + w - rx, y + h / 2, rx, h / 2, 0, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(x + rx, y + h);
  ctx.ellipse(x + rx, y + h / 2, rx, h / 2, 0, Math.PI / 2, Math.PI * 1.5);
  ctx.closePath();
}

const texCache = new Map();
/** Vorberechnete, kartengroße Rahmenstruktur inkl. leichter Vignette. */
function frameTex(colors, L, kind = 'frame') {
  const key = `${colors.join(',')}|${kind}`;
  if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = L.W / 2;
  c.height = L.H / 2;
  const x = c.getContext('2d');
  x.scale(0.5, 0.5);
  x.drawImage(texture(colors, kind, Math.round(L.W / 3), Math.round(L.H / 3), 1), 0, 0, L.W, L.H);
  const v = x.createRadialGradient(L.W / 2, L.H / 2, L.H * 0.3, L.W / 2, L.H / 2, L.H * 0.75);
  v.addColorStop(0, 'rgba(255,255,255,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.18)');
  x.fillStyle = v;
  x.fillRect(0, 0, L.W, L.H);
  texCache.set(key, c);
  return c;
}

function artPath(ctx, a) {
  if (a.r) roundRect(ctx, a.x, a.y, a.w, a.h + a.r * 2, a.r);
  else rect(ctx, a);
}

function fillFrame(ctx, L, colors, pathFn, kind, alpha = 1) {
  ctx.save();
  ctx.beginPath();
  pathFn();
  artPath(ctx, L.art);
  ctx.clip('evenodd');
  ctx.globalAlpha = alpha;
  ctx.drawImage(frameTex(colors, L, kind), 0, 0, L.W, L.H);
  ctx.restore();
}

function softShadow(ctx, blur = 8, dy = 2, alpha = 0.5) {
  ctx.shadowColor = `rgba(0,0,0,${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = dy;
}

/** Helle Leiste (Name/Typ/PT) mit dunkler Kontur und Glanz. */
function plate(ctx, L, b, pathFn, { fill, outline = 'rgba(30,30,30,0.85)', outlineW = 3, kind = 'plate', gloss = true }) {
  ctx.save();
  ctx.beginPath();
  pathFn(b);
  softShadow(ctx, 10, 3, 0.55);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  pathFn(b);
  fillTexture(ctx, fill, kind, L.W, L.H, 3);
  if (gloss) {
    ctx.beginPath();
    pathFn(b);
    const g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, 'rgba(255,255,255,0.30)');
    g.addColorStop(0.4, 'rgba(255,255,255,0.04)');
    g.addColorStop(1, 'rgba(0,0,0,0.12)');
    ctx.fillStyle = g;
    ctx.fill();
  }
  ctx.beginPath();
  pathFn(b);
  ctx.lineWidth = outlineW;
  ctx.strokeStyle = outline;
  ctx.stroke();
  ctx.restore();
}

function crown(ctx, L, pal) {
  const x0 = L.frame.x;
  const x1 = L.frame.x + L.frame.w;
  const cx = L.W / 2;
  const top = 34;
  const path = () => {
    ctx.beginPath();
    ctx.moveTo(x0, 170);
    ctx.lineTo(x0, 70);
    // seitliche Schwünge mit kleinen Zacken
    ctx.bezierCurveTo(x0 + 40, 56, x0 + 80, 70, x0 + 120, 52);
    ctx.bezierCurveTo(x0 + 200, 44, x0 + 300, 66, cx - 330, 50);
    ctx.lineTo(cx - 300, top + 6);
    ctx.bezierCurveTo(cx - 220, 50, cx - 150, 30, cx - 90, top);
    ctx.lineTo(cx - 40, top + 14);
    ctx.lineTo(cx, top - 6);
    ctx.lineTo(cx + 40, top + 14);
    ctx.lineTo(cx + 90, top);
    ctx.bezierCurveTo(cx + 150, 30, cx + 220, 50, cx + 300, top + 6);
    ctx.lineTo(cx + 330, 50);
    ctx.bezierCurveTo(x1 - 300, 66, x1 - 200, 44, x1 - 120, 52);
    ctx.bezierCurveTo(x1 - 80, 70, x1 - 40, 56, x1, 70);
    ctx.lineTo(x1, 170);
    ctx.closePath();
  };
  ctx.save();
  path();
  softShadow(ctx, 10, 0, 0.6);
  ctx.fillStyle = pal.tex[1];
  ctx.fill();
  ctx.restore();
  ctx.save();
  path();
  ctx.clip();
  ctx.drawImage(frameTex(pal.tex.map((c) => lighten(c, 0.18)), L), 0, 0, L.W, L.H);
  // farbige Einfassung innen
  path();
  ctx.lineWidth = 14;
  ctx.strokeStyle = pal.band;
  ctx.stroke();
  ctx.restore();
  ctx.save();
  path();
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.stroke();
  ctx.restore();
}

/**
 * flags: { legendary, pt, vehicle, planeswalker }
 */
export function drawFrameLayer(ctx, L, pal, flags) {
  if (L.style === 'retro') return drawRetroLayer(ctx, L, pal, flags);
  if (L.style === 'm2003') return draw2003Layer(ctx, L, pal, flags);
  return drawM15Layer(ctx, L, pal, flags);
}

function drawPwLayer(ctx, L, pal) {
  const f = L.frame;
  fillFrame(ctx, L, pal.tex, () => roundRect(ctx, f.x, f.y, f.w, f.h, f.r));
  // helle Zierlinie + dunkle Kante ums Artwork
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, f.x, f.y, f.w, f.h, f.r);
  ctx.clip();
  ctx.beginPath();
  artPath(ctx, { ...L.art, x: L.art.x - 7, y: L.art.y - 7, w: L.art.w + 14, r: L.art.r + 7 });
  ctx.lineWidth = 9;
  ctx.strokeStyle = lighten(pal.band, 0.55);
  ctx.stroke();
  ctx.beginPath();
  artPath(ctx, { ...L.art, x: L.art.x - 2, y: L.art.y - 2, w: L.art.w + 4, r: L.art.r + 2 });
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(15,15,15,0.9)';
  ctx.stroke();
  ctx.restore();
  const cap = (b) => capsule(ctx, b, 20);
  plate(ctx, L, L.namePlate, cap, { fill: pal.plate });
  plate(ctx, L, L.typePlate, cap, { fill: pal.plate });
}

function drawM15Layer(ctx, L, pal, flags) {
  if (L.kind === 'pw') return drawPwLayer(ctx, L, pal);
  const f = L.frame;
  // 1. strukturierte Rahmenfläche
  fillFrame(ctx, L, pal.tex, () => roundRect(ctx, f.x, f.y, f.w, f.h, f.r), 'frame', pal.texAlpha ?? 1);
  if (pal.variant === 'nyx') nyxLace(ctx, L, pal);

  // 2. einfarbige Innenkante um Artwork und Leisten
  ctx.save();
  ctx.beginPath();
  rect(ctx, L.band);
  rect(ctx, L.art);
  ctx.clip('evenodd');
  const g = ctx.createLinearGradient(L.band.x, 0, L.band.x + L.band.w, 0);
  g.addColorStop(0, lighten(pal.band, 0.08));
  g.addColorStop(0.5, pal.band);
  g.addColorStop(1, darken(pal.band, 0.08));
  ctx.fillStyle = g;
  ctx.fillRect(L.band.x, L.band.y, L.band.w, L.band.h);
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.strokeRect(L.band.x, L.band.y, L.band.w, L.band.h);
  ctx.restore();

  // 3. Textfeld (reicht unten über den Rahmen hinaus in den Rand)
  textBox(ctx, L, pal, 7);

  if (flags.legendary) crown(ctx, L, pal);

  const cap = (b) => capsule(ctx, b, 20);
  plate(ctx, L, L.namePlate, cap, { fill: pal.plate });
  plate(ctx, L, L.typePlate, cap, { fill: pal.plate });

  if (flags.pt && !flags.planeswalker) ptBox(ctx, L, pal, flags, 26);
}

function textBox(ctx, L, pal, edge) {
  const b = L.box;
  if (pal.variant !== 'devoid') {
    ctx.save();
    ctx.beginPath();
    rect(ctx, b);
    softShadow(ctx, 8, 0, 0.5);
    ctx.fillStyle = pal.box;
    ctx.fill();
    ctx.restore();
  }
  ctx.save();
  ctx.beginPath();
  rect(ctx, b);
  if (pal.variant === 'devoid') {
    // Devoid: Artwork scheint auch durchs Textfeld
    ctx.globalAlpha = 0.55;
  }
  fillTexture(ctx, pal.box, 'box', L.W, L.H, 5);
  ctx.globalAlpha = 1;
  // feine Innenschattierung
  ctx.beginPath();
  rect(ctx, b);
  ctx.clip();
  ctx.lineWidth = 14;
  ctx.strokeStyle = 'rgba(0,0,0,0.06)';
  ctx.strokeRect(b.x + edge + 4, b.y + edge + 4, b.w - 2 * edge - 8, b.h - 2 * edge - 8);
  // farbige Kante
  ctx.lineWidth = edge;
  ctx.strokeStyle = pal.band;
  ctx.strokeRect(b.x + edge / 2, b.y + edge / 2, b.w - edge, b.h - edge);
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.strokeRect(b.x + edge, b.y + edge, b.w - 2 * edge, b.h - 2 * edge);
  ctx.restore();
}

function ptBox(ctx, L, pal, flags, r) {
  const b = L.ptPlate;
  const path = (bb) => roundRect(ctx, bb.x, bb.y, bb.w, bb.h, r);
  if (flags.vehicle) {
    plate(ctx, L, b, path, { fill: VEHICLE_PT.fill, kind: 'box' });
    return;
  }
  // silberne Einfassung + helle Füllung
  plate(ctx, L, b, path, { fill: mix(pal.plate, '#9da3a8', 0.55), kind: 'plate' });
  const inner = { x: b.x + 10, y: b.y + 10, w: b.w - 20, h: b.h - 20 };
  plate(ctx, L, inner, (bb) => roundRect(ctx, bb.x, bb.y, bb.w, bb.h, r - 8), { fill: pal.plate, outlineW: 2 });
}

function draw2003Layer(ctx, L, pal, flags) {
  const f = L.frame;
  fillFrame(ctx, L, pal.tex.map((c) => lighten(c, 0.08)), () => roundRect(ctx, f.x, f.y, f.w, f.h, f.r));
  // dunkle Kontur ums Artwork
  ctx.save();
  ctx.lineWidth = 12;
  ctx.strokeStyle = darken(pal.band, 0.35);
  ctx.strokeRect(L.art.x - 6, L.art.y - 6, L.art.w + 12, L.art.h + 12);
  ctx.restore();
  textBox(ctx, L, { ...pal, band: darken(pal.band, 0.35) }, 8);
  const path = (b) => roundRect(ctx, b.x, b.y, b.w, b.h, 30);
  const outline = darken(pal.band, 0.35);
  plate(ctx, L, L.namePlate, path, { fill: pal.plate, outline, outlineW: 8 });
  plate(ctx, L, L.typePlate, path, { fill: pal.plate, outline, outlineW: 8 });
  if (flags.pt && !flags.planeswalker) {
    if (flags.vehicle) plate(ctx, L, L.ptPlate, path, { fill: VEHICLE_PT.fill, outline, outlineW: 8, kind: 'box' });
    else plate(ctx, L, L.ptPlate, path, { fill: mix(pal.plate, '#c9ccce', 0.5), outline: '#2a2a2a', outlineW: 6 });
  }
}

function bevelRect(ctx, b, d, topLeft, bottomRight) {
  const { x, y, w, h } = b;
  ctx.save();
  ctx.fillStyle = topLeft;
  ctx.beginPath();
  ctx.moveTo(x - d, y - d); ctx.lineTo(x + w + d, y - d); ctx.lineTo(x + w, y); ctx.lineTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x - d, y + h + d);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = bottomRight;
  ctx.beginPath();
  ctx.moveTo(x + w + d, y - d); ctx.lineTo(x + w + d, y + h + d); ctx.lineTo(x - d, y + h + d); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Ausgefranster Pergamentrand (1997-Textfeld). */
function raggedRect(ctx, b, amp = 5, seed = 3) {
  let s = seed;
  const rnd = () => { s = (s * 16807) % 2147483647; return (s / 2147483647 - 0.5) * 2 * amp; };
  const step = 14;
  ctx.moveTo(b.x + rnd(), b.y + rnd());
  for (let x = b.x + step; x < b.x + b.w; x += step) ctx.lineTo(x, b.y + rnd());
  for (let y = b.y; y < b.y + b.h; y += step) ctx.lineTo(b.x + b.w + rnd(), y);
  for (let x = b.x + b.w; x > b.x; x -= step) ctx.lineTo(x, b.y + b.h + rnd());
  for (let y = b.y + b.h; y > b.y; y -= step) ctx.lineTo(b.x + rnd(), y);
  ctx.closePath();
}

function drawRetroLayer(ctx, L, pal, flags) {
  const f = L.frame;
  const tex = pal.retroTex;
  fillFrame(ctx, L, tex, () => roundRect(ctx, f.x, f.y, f.w, f.h, f.r), L.variant === '93' ? 'retro93' : 'retro');
  // feine dunkle Außenlinie des Rahmens
  ctx.save();
  ctx.lineWidth = 4;
  ctx.strokeStyle = darken(tex[0], 0.4);
  ctx.strokeRect(f.x + 2, f.y + 2, f.w - 4, f.h - 4);
  ctx.restore();

  if (L.variant === '93') {
    bevelRect(ctx, L.art, L.artBevel, darken(tex[1], 0.25), lighten(tex[1], 0.3));
    // Textfeld: getönt, mit breiter Fase
    const bv = L.boxBevel;
    const boxCol = mix(tex[1], '#ffffff', 0.32);
    ctx.save();
    ctx.beginPath();
    rect(ctx, L.box);
    fillTexture(ctx, boxCol, 'box', L.W, L.H, 5);
    ctx.restore();
    bevelRect(ctx, L.box, bv, darken(boxCol, 0.12), lighten(boxCol, 0.3));
    // linke Fase heller wie beim Original
    ctx.save();
    ctx.fillStyle = lighten(boxCol, 0.35);
    ctx.beginPath();
    ctx.moveTo(L.box.x - bv, L.box.y - bv); ctx.lineTo(L.box.x, L.box.y); ctx.lineTo(L.box.x, L.box.y + L.box.h); ctx.lineTo(L.box.x - bv, L.box.y + L.box.h + bv);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  } else {
    bevelRect(ctx, L.art, L.artBevel, darken(tex[0], 0.45), lighten(tex[1], 0.25));
    ctx.save();
    ctx.beginPath();
    raggedRect(ctx, L.box);
    softShadow(ctx, 8, 2, 0.6);
    ctx.fillStyle = pal.retroBox;
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.beginPath();
    raggedRect(ctx, L.box);
    fillTexture(ctx, [darken(pal.retroBox, 0.1), pal.retroBox, lighten(pal.retroBox, 0.15)], 'box', L.W, L.H, 9);
    ctx.restore();
  }
}

/** Feine helle Netzstruktur für Nyx-Rahmen */
function nyxLace(ctx, L, pal) {
  const f = L.frame;
  ctx.save();
  ctx.beginPath();
  roundRect(ctx, f.x, f.y, f.w, f.h, f.r);
  rect(ctx, L.art);
  ctx.clip('evenodd');
  ctx.strokeStyle = 'rgba(255,255,255,0.45)';
  ctx.lineWidth = 2;
  let seed = 11;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < 900; i++) {
    const x = f.x + rnd() * f.w;
    const y = f.y + rnd() * f.h;
    ctx.beginPath();
    ctx.arc(x, y, 6 + rnd() * 10, rnd() * 6, rnd() * 6 + 2.5);
    ctx.stroke();
  }
  ctx.restore();
}

/** Holo-Siegel (M15, selten/mythisch): halb ins Textfeld ragendes Oval. */
export function drawHolo(ctx, L) {
  const { cx, cy, rx, ry } = L.holo;
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, Math.PI, 0);
  ctx.closePath();
  ctx.fillStyle = '#121212';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(cx, cy + 2, rx - 9, ry - 8, 0, Math.PI, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - rx, cy - ry, cx + rx, cy);
  g.addColorStop(0, '#7d848a');
  g.addColorStop(0.45, '#eef1f3');
  g.addColorStop(0.6, '#b9c0c6');
  g.addColorStop(1, '#6f767c');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.restore();
}

/** Pinsel-Icon vor dem Künstlernamen */
export function drawBrush(ctx, x, y, size, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.beginPath();
  // Borsten (links) + Griff (rechts), leicht geneigt
  ctx.rotate(-0.12);
  ctx.moveTo(-size * 0.5, 0);
  ctx.quadraticCurveTo(-size * 0.25, -size * 0.2, 0, -size * 0.13);
  ctx.lineTo(size * 0.55, -size * 0.04);
  ctx.lineTo(size * 0.55, size * 0.04);
  ctx.lineTo(0, size * 0.13);
  ctx.quadraticCurveTo(-size * 0.25, size * 0.2, -size * 0.5, 0);
  ctx.fill();
  ctx.restore();
}
