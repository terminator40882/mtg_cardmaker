// Einfacher Festplatten-Cache für Scryfall-Antworten und Bilder.
// Alles landet unter DATA_DIR (im Container ein Volume), damit wiederholte
// Anfragen lokal bedient werden und Scryfall geschont wird.
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';

export const DATA_DIR = process.env.DATA_DIR || path.resolve('data');
const API_DIR = path.join(DATA_DIR, 'api');
const IMG_DIR = path.join(DATA_DIR, 'img');

await mkdir(API_DIR, { recursive: true });
await mkdir(IMG_DIR, { recursive: true });

const hash = (s) => createHash('sha1').update(s).digest('hex');

async function atomicWrite(file, data) {
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(tmp, data);
  await rename(tmp, file);
}

/** JSON-Cache mit Ablaufzeit (ms). Liefert null, wenn nicht vorhanden/abgelaufen. */
export async function getJson(key, maxAgeMs) {
  try {
    const raw = await readFile(path.join(API_DIR, `${hash(key)}.json`), 'utf8');
    const entry = JSON.parse(raw);
    if (maxAgeMs != null && Date.now() - entry.t > maxAgeMs) return null;
    return entry.body;
  } catch {
    return null;
  }
}

export async function putJson(key, body) {
  await atomicWrite(path.join(API_DIR, `${hash(key)}.json`), JSON.stringify({ t: Date.now(), key, body }));
}

/** Binär-Cache (Bilder). Bilder ändern sich praktisch nie -> kein Ablauf. */
export async function getBlob(key) {
  const base = path.join(IMG_DIR, hash(key));
  try {
    const meta = JSON.parse(await readFile(`${base}.meta`, 'utf8'));
    const data = await readFile(`${base}.bin`);
    return { data, type: meta.type };
  } catch {
    return null;
  }
}

export async function putBlob(key, data, type) {
  const base = path.join(IMG_DIR, hash(key));
  await atomicWrite(`${base}.bin`, data);
  await atomicWrite(`${base}.meta`, JSON.stringify({ key, type }));
}
