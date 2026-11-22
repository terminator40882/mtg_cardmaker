// Misst das Delta zwischen Nachbau und Original-Scan (Scryfall-PNG).
//
//   node tools/delta.mjs [--url http://localhost:8080] [--out delta-out] <karte> ...
//
// <karte> ist eine Scryfall-ID oder "set/nummer" (z. B. "m19/154"); Suffix ":1" wählt
// die Rückseite. Pro Karte entsteht <out>/<set>-<nr>.png (Nachbau | Original | Differenz)
// und eine Tabelle mit der mittleren absoluten Abweichung (0–255) je Kartenbereich.
// Benötigt Playwright (npm i -g playwright) und einen laufenden Cardmaker-Server.
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const require = createRequire(import.meta.url);
let playwright;
try { playwright = require('playwright'); } catch {
  playwright = require(path.join(process.env.NODE_PATH || '/opt/node-tools/node_modules', 'playwright'));
}

const args = process.argv.slice(2);
const opt = { url: 'http://localhost:8080', out: 'delta-out', json: false };
const cards = [];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--url') opt.url = args[++i];
  else if (args[i] === '--out') opt.out = args[++i];
  else if (args[i] === '--json') opt.json = true;
  else cards.push(args[i]);
}
if (!cards.length) {
  console.error('Aufruf: node tools/delta.mjs [--url URL] [--out DIR] <scryfall-id|set/nr[:face]> ...');
  process.exit(1);
}

// Bereiche als Anteil der Kartenhöhe (grob für alle Rahmenstile)
const REGIONS = [
  ['Name', 0.00, 0.11],
  ['Bild', 0.11, 0.56],
  ['Typ', 0.56, 0.62],
  ['Text', 0.62, 0.895],
  ['Unten', 0.895, 1.00],
];

async function resolve(spec) {
  const [ref, face = '0'] = spec.split(':');
  if (/^[0-9a-f-]{36}$/.test(ref)) return { id: ref, face: Number(face) };
  const res = await fetch(`${opt.url}/api/card-by/${ref}`);
  if (!res.ok) throw new Error(`${spec}: ${res.status}`);
  return { id: (await res.json()).id, face: Number(face) };
}

const browser = await playwright.chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
page.on('pageerror', (e) => console.error('Seitenfehler:', e.message));
await mkdir(opt.out, { recursive: true });
const rows = [];

for (const spec of cards) {
  try {
    const { id, face } = await resolve(spec);
    await page.goto(`${opt.url}/?id=${id}`);
    await page.waitForFunction((cid) => (document.body.dataset.rendered || '').startsWith(cid), id, { timeout: 60000 });
    if (face) {
      await page.selectOption('#opt-face', String(face));
      await page.waitForFunction((cid) => (document.body.dataset.rendered || '').startsWith(`${cid}:1:`), id, { timeout: 60000 });
    }
    await page.waitForFunction(() => document.getElementById('orig').complete && document.getElementById('orig').naturalWidth > 0);
    const r = await page.evaluate(async ({ regions }) => {
      const card = await (await fetch(`/api/card/${new URLSearchParams(location.search).get('id')}`)).json();
      const f = Number(document.getElementById('opt-face').value || 0);
      const uris = card.card_faces?.[f]?.image_uris || card.image_uris || card.card_faces?.[0]?.image_uris;
      const orig = new Image();
      orig.src = `/asset?u=${encodeURIComponent(uris.png)}`;
      await orig.decode();
      const W = orig.naturalWidth;
      const H = orig.naturalHeight;
      const draw = (src) => {
        const c = document.createElement('canvas');
        c.width = W; c.height = H;
        const x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        x.drawImage(src, 0, 0, W, H);
        return x.getImageData(0, 0, W, H);
      };
      const a = draw(document.getElementById('card'));
      const b = draw(orig);
      const out = document.createElement('canvas');
      out.width = W * 3; out.height = H;
      const ox = out.getContext('2d');
      ox.fillStyle = '#fff'; ox.fillRect(0, 0, W * 3, H);
      ox.putImageData(a, 0, 0);
      ox.drawImage(orig, W, 0, W, H);
      const d = ox.createImageData(W, H);
      const sums = regions.map(() => [0, 0]);
      let tot = 0; let n = 0;
      for (let y = 0; y < H; y++) {
        const ri = regions.findIndex(([, y0, y1]) => y / H >= y0 && y / H < y1);
        for (let x = 0; x < W; x++) {
          const i = (y * W + x) * 4;
          if (b.data[i + 3] < 250 || a.data[i + 3] < 250) { d.data[i + 3] = 0; continue; }
          const e = (Math.abs(a.data[i] - b.data[i]) + Math.abs(a.data[i + 1] - b.data[i + 1]) + Math.abs(a.data[i + 2] - b.data[i + 2])) / 3;
          tot += e; n++;
          sums[ri][0] += e; sums[ri][1]++;
          const v = Math.min(255, e * 3);
          d.data[i] = v; d.data[i + 1] = v * 0.3; d.data[i + 2] = 0; d.data[i + 3] = 255;
        }
      }
      ox.fillStyle = '#000'; ox.fillRect(W * 2, 0, W, H);
      const tmp = document.createElement('canvas');
      tmp.width = W; tmp.height = H;
      tmp.getContext('2d').putImageData(d, 0, 0);
      ox.drawImage(tmp, W * 2, 0);
      return {
        name: card.name, set: card.set, cn: card.collector_number, frame: card.frame,
        total: tot / n, regions: sums.map(([s, c]) => (c ? s / c : 0)),
        png: out.toDataURL('image/png'),
      };
    }, { regions: REGIONS });
    const file = path.join(opt.out, `${r.set}-${r.cn}${face ? '-b' : ''}.png`.replace(/[^\w.\-]/g, '_'));
    await writeFile(file, Buffer.from(r.png.split(',')[1], 'base64'));
    rows.push({ spec, name: r.name, frame: r.frame, total: r.total, regions: r.regions, file });
  } catch (err) {
    rows.push({ spec, error: err.message });
  }
}
await browser.close();

if (opt.json) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const head = ['Karte', 'Rahmen', 'Gesamt', ...REGIONS.map(([n]) => n)];
  console.log(head.join('\t'));
  for (const r of rows) {
    if (r.error) { console.log(`${r.spec}\tFEHLER: ${r.error}`); continue; }
    console.log([`${r.name} (${r.spec})`, r.frame, r.total.toFixed(1), ...r.regions.map((v) => v.toFixed(1))].join('\t'));
  }
  const ok = rows.filter((r) => !r.error);
  if (ok.length > 1) console.log(`Mittel\t\t${(ok.reduce((s, r) => s + r.total, 0) / ok.length).toFixed(1)}`);
}
