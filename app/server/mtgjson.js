// Gedruckter Kartentext aus MTGJSON (originalText / originalType je Druck).
// Scryfall liefert für englische Karten nur den aktuellen Oracle-Text; MTGJSON führt
// zusätzlich den Text, wie er auf diesem Druck steht (ohne fehlenden Reminder-Text,
// alte Formulierungen, alte Typzeilen). Je Set wird die Datei einmal geladen und als
// kompakter Index (Scryfall-ID -> Seiten) im Cache abgelegt.
import * as cache from './cache.js';

const BASE = 'https://mtgjson.com/api/v5';
const MONTH = 30 * 24 * 60 * 60 * 1000;
const memory = new Map();

// Scryfall-Setcode -> MTGJSON-Setcode, wo sie abweichen
const SET_ALIAS = { con: 'CON_' };

async function loadIndex(set) {
  const code = (SET_ALIAS[set] || set).toUpperCase();
  const key = `mtgjson:index:${code}`;
  const cached = await cache.getJson(key, MONTH);
  if (cached) return cached;
  const res = await fetch(`${BASE}/${encodeURIComponent(code)}.json`, {
    headers: { 'User-Agent': process.env.SCRYFALL_USER_AGENT || 'MTGCardmaker/0.1 (self-hosted)' },
  });
  if (!res.ok) {
    const empty = {};
    await cache.putJson(key, empty);
    return empty;
  }
  const body = await res.json();
  const index = {};
  for (const c of body?.data?.cards || []) {
    const id = c.identifiers?.scryfallId;
    if (!id) continue;
    (index[id] ||= []).push({
      side: c.side || 'a',
      name: c.faceName || c.name,
      text: c.originalText ?? null,
      type: c.originalType ?? null,
      flavor: c.flavorText ?? null,
    });
  }
  for (const faces of Object.values(index)) faces.sort((a, b) => a.side.localeCompare(b.side));
  await cache.putJson(key, index);
  return index;
}

/** Gedruckte Seiten eines Drucks: [{side, name, text, type, flavor}] oder null. */
export async function printed(set, scryfallId) {
  if (!/^[a-z0-9]{2,6}$/i.test(set) || !/^[0-9a-f-]{36}$/i.test(scryfallId)) return null;
  const s = set.toLowerCase();
  if (!memory.has(s)) {
    memory.set(s, loadIndex(s).catch((err) => { memory.delete(s); throw err; }));
    if (memory.size > 40) memory.delete(memory.keys().next().value);
  }
  const index = await memory.get(s);
  return index[scryfallId] || null;
}
