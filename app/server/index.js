import cluster from 'node:cluster';
import { availableParallelism } from 'node:os';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sf from './scryfall.js';
import { fontCss, FONTS_DIR, FONTSOURCE_DIR } from './fonts.js';
import { ccStatus, CC_IMG_DIR } from './ccassets.js';
import { printed } from './mtgjson.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(here, '..', 'public');
const PORT = Number(process.env.PORT || 8080);

const app = express();
app.disable('x-powered-by');

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    const status = err instanceof sf.ScryfallError ? err.status : 500;
    if (status >= 500) console.error(err);
    res.status(status).json({ error: err.message || 'Fehler' });
  }
};

app.get('/api/autocomplete', wrap(async (req, res) => res.json(await sf.autocomplete(String(req.query.q || '')))));

app.get('/api/prints', wrap(async (req, res) => {
  const name = String(req.query.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Kartenname fehlt' });
  res.json(await sf.findPrints(name));
}));

app.get('/api/card/:id', wrap(async (req, res) => res.json(await sf.getCard(req.params.id))));
app.get('/api/card-by/:set/:cn', wrap(async (req, res) => res.json(await sf.getCardBySet(req.params.set, req.params.cn))));
// Gedruckter Text eines Drucks (MTGJSON); leer, wenn unbekannt
app.get('/api/printed/:set/:id', wrap(async (req, res) => {
  res.json({ faces: await printed(req.params.set, req.params.id, String(req.query.name || '')).catch(() => null) });
}));
app.get('/api/set/:code', wrap(async (req, res) => {
  const set = await sf.getSet(req.params.code);
  res.json({ ...set, icon: sf.assetPath(set.icon_svg_uri) });
}));
app.get('/api/symbology', wrap(async (req, res) => res.json(await sf.symbology())));
app.get('/api/catalog/:name', wrap(async (req, res) => res.json(await sf.catalog(req.params.name))));

// Artwork einer Version. Hier wird später ein Upscaling-Schritt eingehängt.
app.get('/api/art/:id', wrap(async (req, res) => {
  const card = await sf.getCard(req.params.id);
  const face = Number(req.query.face || 0);
  const uris = card.image_uris || card.card_faces?.[face]?.image_uris || card.card_faces?.[0]?.image_uris;
  if (!uris?.art_crop) return res.status(404).json({ error: 'Kein Artwork vorhanden' });
  const img = await sf.asset(uris.art_crop);
  res.set('Cache-Control', 'public, max-age=604800').type(img.type).send(img.data);
}));

// Proxy + Cache für Bilder/SVGs von Scryfall (nur Scryfall-Hosts erlaubt).
app.get('/asset', wrap(async (req, res) => {
  const img = await sf.asset(String(req.query.u || ''));
  res.set('Cache-Control', 'public, max-age=604800').type(img.type).send(img.data);
}));

app.get('/fonts/fonts.css', wrap(async (req, res) => {
  const { css } = await fontCss();
  res.set('Cache-Control', 'no-cache').type('text/css').send(css);
}));
app.get('/api/fonts', wrap(async (req, res) => res.json((await fontCss()).status)));
app.use('/fonts/custom', express.static(FONTS_DIR, { fallthrough: false }));
app.use('/fonts/fallback', express.static(FONTSOURCE_DIR, { fallthrough: false }));

// Card-Conjurer-Rahmengrafiken (Ordner Assets/ im Repo, per Git LFS)
app.get('/api/cc', wrap(async (req, res) => res.json(await ccStatus())));
app.use('/cc/img', express.static(CC_IMG_DIR, { fallthrough: false, maxAge: '7d' }));

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

// Ein Worker pro CPU-Kern (WEB_CONCURRENCY überschreibt die Anzahl). Die Worker teilen sich
// den Port; der Festplatten-Cache ist prozessübergreifend (atomare Schreibvorgänge).
export const WORKERS = Math.max(1, Number(process.env.WEB_CONCURRENCY) || availableParallelism());

if (cluster.isPrimary && WORKERS > 1) {
  console.log(`MTG Cardmaker: starte ${WORKERS} Worker auf http://localhost:${PORT}`);
  for (let i = 0; i < WORKERS; i++) cluster.fork();
  // abgestürzte Worker ersetzen (nicht beim regulären Beenden)
  cluster.on('exit', (w, code, signal) => {
    if (signal === 'SIGTERM' || signal === 'SIGINT' || code === 0) return;
    console.error(`Worker ${w.process.pid} beendet (${signal || code}) – starte neu`);
    cluster.fork();
  });
  for (const sig of ['SIGTERM', 'SIGINT']) {
    process.on(sig, () => {
      for (const w of Object.values(cluster.workers)) w.process.kill(sig);
      process.exit(0);
    });
  }
} else {
  app.listen(PORT, () => {
    if (WORKERS === 1) console.log(`MTG Cardmaker läuft auf http://localhost:${PORT}`);
  });
}
