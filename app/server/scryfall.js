// Zugriff auf die Scryfall-API: Rate-Limit, Caching, Filterung der Versionen.
import * as cache from './cache.js';

const API = 'https://api.scryfall.com';
const HEADERS = {
  // Scryfall verlangt einen aussagekräftigen User-Agent und einen Accept-Header.
  'User-Agent': process.env.SCRYFALL_USER_AGENT || 'MTGCardmaker/0.1 (self-hosted)',
  Accept: 'application/json;q=0.9,*/*;q=0.8',
};
const ALLOWED_ASSET_HOSTS = new Set(['cards.scryfall.io', 'svgs.scryfall.io', 'c1.scryfall.com', 'c2.scryfall.com']);

const DAY = 24 * 60 * 60 * 1000;

// Scryfall bittet um 50–100 ms Abstand zwischen Anfragen -> serialisierte Queue.
let queue = Promise.resolve();
let last = 0;
function throttled(fn) {
  const run = queue.then(async () => {
    const wait = Math.max(0, last + 110 - Date.now());
    if (wait) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    return fn();
  });
  queue = run.catch(() => {});
  return run;
}

export class ScryfallError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function apiGet(urlOrPath, maxAge = DAY) {
  const url = urlOrPath.startsWith('http') ? urlOrPath : API + urlOrPath;
  if (!url.startsWith(API + '/')) throw new ScryfallError(400, 'Nur api.scryfall.com ist erlaubt');
  const cached = await cache.getJson(url, maxAge);
  if (cached) return cached;
  const res = await throttled(() => fetch(url, { headers: HEADERS }));
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ScryfallError(res.status, body?.details || `Scryfall antwortete mit ${res.status}`);
  }
  await cache.putJson(url, body);
  return body;
}

/** Lädt ein Bild/SVG von Scryfall-CDN (gecached). */
export async function asset(url) {
  let u;
  try {
    u = new URL(url);
  } catch {
    throw new ScryfallError(400, 'Ungültige URL');
  }
  if (u.protocol !== 'https:' || !ALLOWED_ASSET_HOSTS.has(u.hostname)) {
    throw new ScryfallError(400, 'Host nicht erlaubt');
  }
  const cached = await cache.getBlob(url);
  if (cached) return cached;
  const res = await throttled(() => fetch(url, { headers: { 'User-Agent': HEADERS['User-Agent'], Accept: '*/*' } }));
  if (!res.ok) throw new ScryfallError(res.status, `Bild konnte nicht geladen werden (${res.status})`);
  let type = res.headers.get('content-type') || 'application/octet-stream';
  let data = Buffer.from(await res.arrayBuffer());
  if (type.includes('svg') || u.pathname.endsWith('.svg')) {
    type = 'image/svg+xml';
    data = Buffer.from(fixSvgSize(data.toString('utf8')));
  }
  await cache.putBlob(url, data, type);
  return { data, type };
}

// Canvas (v.a. Firefox) kann SVGs ohne width/height nicht zeichnen -> aus viewBox ergänzen.
function fixSvgSize(svg) {
  return svg.replace(/<svg\b([^>]*)>/, (tag, attrs) => {
    if (/\swidth=/.test(attrs) && /\sheight=/.test(attrs)) return tag;
    const vb = attrs.match(/viewBox=["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)/);
    if (!vb) return tag;
    const w = parseFloat(vb[3]);
    const h = parseFloat(vb[4]);
    const scale = 512 / Math.max(w, h);
    const clean = attrs.replace(/\s(width|height)=["'][^"']*["']/g, '');
    return `<svg${clean} width="${(w * scale).toFixed(2)}" height="${(h * scale).toFixed(2)}">`;
  });
}

export const assetPath = (url) => (url ? `/asset?u=${encodeURIComponent(url)}` : null);

export async function autocomplete(q) {
  if (!q || q.trim().length < 2) return [];
  const body = await apiGet(`/cards/autocomplete?q=${encodeURIComponent(q.trim())}`, 7 * DAY);
  return body.data || [];
}

const EXCLUDED_LAYOUTS = new Set([
  'art_series', 'token', 'double_faced_token', 'emblem', 'planar', 'scheme', 'vanguard', 'reversible_card',
]);
// Frame-Effekte, bei denen das Artwork nicht im klassischen Bildfenster sitzt.
const EXCLUDED_EFFECTS = new Set(['extendedart', 'fullart', 'textless', 'waxingandwaningmoondfc_borderless']);

function facesWithArt(card) {
  if (card.image_uris?.art_crop) return [card.image_uris];
  return (card.card_faces || []).map((f) => f.image_uris).filter((i) => i?.art_crop);
}

/** true, wenn die Version ein "normales" Bildfenster mit Rahmen hat (kein Borderless/Fullart/Extended). */
export function hasRegularFrame(card) {
  if (EXCLUDED_LAYOUTS.has(card.layout)) return false;
  if (card.border_color === 'borderless') return false;
  if (card.full_art) return false;
  if (card.textless) return false;
  if (card.oversized) return false;
  if ((card.frame_effects || []).some((e) => EXCLUDED_EFFECTS.has(e))) return false;
  if (card.image_status === 'missing' || card.image_status === 'placeholder') return false;
  return facesWithArt(card).length > 0;
}

function summarizePrint(card) {
  const faces = facesWithArt(card);
  return {
    id: card.id,
    name: card.name,
    set: card.set,
    set_name: card.set_name,
    collector_number: card.collector_number,
    released_at: card.released_at,
    frame: card.frame,
    border_color: card.border_color,
    frame_effects: card.frame_effects || [],
    promo_types: card.promo_types || [],
    rarity: card.rarity,
    lang: card.lang,
    digital: card.digital,
    artist: card.artist,
    illustration_id: card.illustration_id || card.card_faces?.[0]?.illustration_id || null,
    art: assetPath(faces[0]?.art_crop),
    thumb: assetPath(faces[0]?.small),
  };
}

/** Sucht eine Karte per Namen und liefert alle passenden Versionen. */
export async function findPrints(name) {
  const card = await apiGet(`/cards/named?fuzzy=${encodeURIComponent(name.trim())}`, 7 * DAY);
  const prints = [];
  let next = card.prints_search_uri;
  // include_extras, damit auch Promos/Sonderdrucke auftauchen.
  if (next && !next.includes('include_extras')) next += '&include_extras=true';
  while (next) {
    const page = await apiGet(next);
    prints.push(...page.data);
    next = page.has_more ? page.next_page : null;
  }
  // englische Drucke zuerst (Scryfall-Reihenfolge: neueste zuerst bleibt erhalten)
  const usable = prints.filter(hasRegularFrame).sort((a, b) => (a.lang === 'en' ? 0 : 1) - (b.lang === 'en' ? 0 : 1));
  return {
    name: card.name,
    oracle_id: card.oracle_id,
    total: prints.length,
    excluded: prints.length - usable.length,
    prints: usable.map(summarizePrint),
  };
}

export async function getCard(id) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw new ScryfallError(400, 'Ungültige Karten-ID');
  return apiGet(`/cards/${id}`, 7 * DAY);
}

/** Karte über Set-Code und Sammlernummer (für Werkzeuge wie tools/delta.mjs) */
export async function getCardBySet(set, cn) {
  if (!/^[a-z0-9]{2,6}$/i.test(set) || !/^[\w\-★†]{1,10}$/u.test(cn)) throw new ScryfallError(400, 'Ungültige Angabe');
  return apiGet(`/cards/${set.toLowerCase()}/${encodeURIComponent(cn)}`);
}

export async function getSet(code) {
  if (!/^[a-z0-9]{2,8}$/i.test(code)) throw new ScryfallError(400, 'Ungültiger Set-Code');
  const set = await apiGet(`/sets/${code.toLowerCase()}`, 7 * DAY);
  if (!set.printed_size) {
    // Scryfall kennt die aufgedruckte Setgröße (z. B. "171/269") nicht immer.
    // Näherung: höchste rein numerische Sammlernummer der Booster-Karten.
    try {
      const page = await apiGet(`/cards/search?q=${encodeURIComponent(`e:${set.code} is:booster`)}&order=set&dir=desc&unique=prints`, 30 * DAY);
      const nums = page.data.map((c) => c.collector_number).filter((n) => /^\d+$/.test(n)).map(Number);
      if (nums.length) set.printed_size_estimate = Math.max(...nums);
    } catch { /* kein Booster-Set */ }
  }
  return set;
}

export async function symbology() {
  const body = await apiGet('/symbology', 30 * DAY);
  return body.data.map((s) => ({ symbol: s.symbol, svg: assetPath(s.svg_uri), english: s.english }));
}

export async function catalog(name) {
  const allowed = new Set(['ability-words', 'keyword-abilities', 'keyword-actions']);
  if (!allowed.has(name)) throw new ScryfallError(404, 'Unbekannter Katalog');
  const body = await apiGet(`/catalog/${name}`, 30 * DAY);
  return body.data;
}
