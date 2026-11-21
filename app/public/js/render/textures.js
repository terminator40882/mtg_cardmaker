// Prozedural erzeugte Rahmen-Texturen (keine fremden Grafiken nötig).

const cache = new Map();

function hash(x, y, seed) {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
}

function valueNoise(x, y, seed) {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi, seed);
  const b = hash(xi + 1, yi, seed);
  const c = hash(xi, yi + 1, seed);
  const d = hash(xi + 1, yi + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

export function mix(hexA, hexB, t) {
  const a = hexToRgb(hexA);
  const b = hexToRgb(hexB);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export const lighten = (hex, t) => mix(hex, '#ffffff', t);
export const darken = (hex, t) => mix(hex, '#000000', t);

export function luminance(hex) {
  const [r, g, b] = hexToRgb(hex).map((v) => v / 255);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const PRESETS = {
  // scale: Grobheit, stretch: Streifigkeit, contrast, speck: helle Sprenkel
  frame: { scale: 64, octaves: 4, stretch: 1.3, contrast: 1.7, speck: 0.5, grain: 0.08 },
  retro: { scale: 40, octaves: 5, stretch: 1.0, contrast: 1.5, speck: 0.3, grain: 0.08 },
  retro93: { scale: 50, octaves: 5, stretch: 1.0, contrast: 0.75, speck: 0.1, grain: 0.08 },
  box: { scale: 30, octaves: 4, stretch: 1.0, contrast: 0.22, speck: 0, grain: 0.03 },
  plate: { scale: 40, octaves: 3, stretch: 3.0, contrast: 0.16, speck: 0, grain: 0.02 },
};

const lerp = (a, b, t) => a + (b - a) * t;

/**
 * Liefert ein Canvas mit Textur. colors: Hex-Farbe oder [dunkel, mittel, hell].
 */
export function texture(colors, kind = 'frame', w = 500, h = 700, seed = 7) {
  const ramp = Array.isArray(colors) ? colors : [darken(colors, 0.12), colors, lighten(colors, 0.25)];
  const key = `${ramp.join(',')}|${kind}|${w}|${h}|${seed}`;
  if (cache.has(key)) return cache.get(key);
  const p = PRESETS[kind] || PRESETS.frame;
  const [d, m, l] = ramp.map(hexToRgb);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(w, h);
  const base = Math.max(w, h) / p.scale;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let n = 0;
      let amp = 0.5;
      let freq = 1 / base;
      for (let o = 0; o < p.octaves; o++) {
        n += amp * valueNoise(x * freq, y * freq * p.stretch, seed + o * 31);
        amp *= 0.5;
        freq *= 2;
      }
      n /= 0.97;
      let t = Math.min(1, Math.max(0, (n - 0.5) * p.contrast + 0.5 + (hash(x, y, seed + 99) - 0.5) * p.grain));
      if (p.speck) {
        // "Adern"/helle Sprenkel wie bei den gedruckten Rahmen
        const r = 1 - Math.abs(2 * valueNoise(x * 3.1 / base, y * 3.1 / base, seed + 7) - 1);
        t = Math.min(1, t + Math.pow(r, 7) * p.speck);
      }
      const i = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) {
        img.data[i + k] = t < 0.5 ? lerp(d[k], m[k], t * 2) : lerp(m[k], l[k], (t - 0.5) * 2);
      }
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cache.set(key, c);
  return c;
}

/** Füllt den aktuellen Pfad mit einer Textur, auf Kartengröße gestreckt. */
export function fillTexture(ctx, colors, kind, W, H, seed) {
  const tex = texture(colors, kind, Math.round(W / 3), Math.round(H / 3), seed);
  ctx.save();
  ctx.clip();
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(tex, 0, 0, W, H);
  ctx.restore();
}
