// Card-Conjurer-Assets (Rahmen, Masken, Kronen, P/T-Boxen …) aus dem Ordner Assets/.
// Die Bilder liegen per Git LFS im Repo. Wurde ohne LFS geklont, sind es nur
// Pointer-Dateien – dann meldet /api/cc "available: false" und der Client
// zeichnet die Rahmen wie bisher per Code.
import { open } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const CC_DIR = process.env.CC_ASSETS_DIR || path.resolve(here, '..', '..', 'Assets');
export const CC_IMG_DIR = path.join(CC_DIR, 'img');

const PROBE = 'frames/m15/new/w.png';
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]);

let cached = null;
export function ccStatus() {
  cached ||= (async () => {
    const file = path.join(CC_IMG_DIR, PROBE);
    try {
      const fh = await open(file, 'r');
      const buf = Buffer.alloc(64);
      await fh.read(buf, 0, 64, 0);
      await fh.close();
      if (buf.subarray(0, 4).equals(PNG_MAGIC)) return { available: true, base: '/cc/img' };
      const lfs = buf.toString('utf8').startsWith('version https://git-lfs');
      return { available: false, reason: lfs ? 'Assets sind nur LFS-Pointer – bitte "git lfs pull" ausführen.' : 'Unbekanntes Dateiformat.' };
    } catch {
      return { available: false, reason: `Ordner ${CC_IMG_DIR} nicht gefunden.` };
    }
  })();
  return cached;
}
