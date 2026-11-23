// Eigene (z. B. hochskalierte) Artworks je Druck und Kartenseite. Die Bilder bleiben im Browser
// (IndexedDB, damit sie ein Neuladen überstehen); fürs Rendern gibt es eine Blob-URL.
const DB_NAME = 'mtg-cardmaker';
const STORE = 'custom-art';

let dbPromise = null;
function db() {
  dbPromise ||= new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null); // ohne IndexedDB (z. B. privater Modus): nur für diese Sitzung
    }
  });
  return dbPromise;
}

async function tx(mode, fn) {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const t = d.transaction(STORE, mode);
      const req = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(req?.result ?? null);
      t.onerror = t.onabort = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

// key -> { url, name, width, height, size } (null = geprüft, nichts hinterlegt)
const loaded = new Map();

export const keyOf = (cardId, face) => `${cardId}:${face}`;

/** Synchron: bereits geladener Eintrag (oder null). */
export const peek = (key) => loaded.get(key) || null;

/** Lädt den Eintrag aus der IndexedDB (einmal je Schlüssel). */
export async function ensure(key) {
  if (loaded.has(key)) return loaded.get(key);
  const rec = await tx('readonly', (s) => s.get(key));
  if (loaded.has(key)) return loaded.get(key); // inzwischen gesetzt
  const entry = rec?.blob ? toEntry(rec) : null;
  loaded.set(key, entry);
  return entry;
}

/** Übernimmt eine Bilddatei; wirft, wenn sie sich nicht als Bild dekodieren lässt. */
export async function store(key, file) {
  if (!/^image\//.test(file.type)) throw new Error('Keine Bilddatei');
  const { width, height } = await dimensions(file);
  const rec = { blob: file, name: file.name || 'Artwork', width, height, size: file.size, added: Date.now() };
  await tx('readwrite', (s) => s.put(rec, key));
  release(key);
  const entry = toEntry(rec);
  loaded.set(key, entry);
  return entry;
}

export async function remove(key) {
  await tx('readwrite', (s) => s.delete(key));
  const old = release(key);
  loaded.set(key, null);
  return old;
}

function toEntry(rec) {
  return { url: URL.createObjectURL(rec.blob), name: rec.name, width: rec.width, height: rec.height, size: rec.size };
}

function release(key) {
  const old = loaded.get(key);
  // erst etwas später freigeben: ein laufendes Rendern kann die URL noch laden
  if (old?.url) setTimeout(() => URL.revokeObjectURL(old.url), 60000);
  return old || null;
}

async function dimensions(file) {
  try {
    const bm = await createImageBitmap(file);
    const d = { width: bm.width, height: bm.height };
    bm.close();
    return d;
  } catch {
    throw new Error('Bild lässt sich nicht lesen');
  }
}
