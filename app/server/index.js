import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as sf from './scryfall.js';
import { fontCss, FONTS_DIR, FONTSOURCE_DIR } from './fonts.js';

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

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

app.listen(PORT, () => console.log(`MTG Cardmaker läuft auf http://localhost:${PORT}`));
