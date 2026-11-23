// Pool aus Web Workern (ein Worker je verfügbarem CPU-Kern, höchstens 4), um Analyseaufgaben
// parallel zum Hauptthread auszuführen. Ohne Worker-/OffscreenCanvas-Unterstützung: null.
let poolPromise = null;

export function getPool(scales) {
  if (poolPromise) return poolPromise;
  const ok = typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined' && typeof createImageBitmap === 'function';
  if (!ok) return (poolPromise = Promise.resolve(null));
  poolPromise = (async () => {
    const n = Math.max(1, Math.min(4, (navigator.hardwareConcurrency || 2) - 1));
    const workers = [];
    let seq = 0;
    const pending = new Map();
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
      w.busy = 0;
      w.onmessage = (e) => {
        const p = pending.get(e.data.id);
        if (!p) return;
        pending.delete(e.data.id);
        w.busy--;
        if (e.data.error) p.reject(new Error(e.data.error)); else p.resolve(e.data.res);
      };
      workers.push(w);
    }
    const send = (w, type, data, transfer = []) => new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      w.busy++;
      w.postMessage({ id, type, data }, transfer);
    });
    try {
      await Promise.all(workers.map((w) => send(w, 'init', { scales })));
    } catch {
      workers.forEach((w) => w.terminate());
      return null;
    }
    return {
      size: n,
      /** Aufgabe an den am wenigsten ausgelasteten Worker geben. */
      run(type, data, transfer) {
        const w = workers.reduce((a, b) => (b.busy < a.busy ? b : a));
        return send(w, type, data, transfer);
      },
    };
  })();
  return poolPromise;
}

/** Bild als ImageBitmap (für die Übergabe an Worker); SVGs werden gerastert. */
const bmCache = new WeakMap();
export async function toBitmap(img, size = null) {
  if (!img) return null;
  if (typeof ImageBitmap !== 'undefined' && img instanceof ImageBitmap && !size) return img;
  const key = size || 0;
  let per = bmCache.get(img);
  if (!per) { per = new Map(); bmCache.set(img, per); }
  if (!per.has(key)) per.set(key, createImageBitmap(img, size ? { resizeWidth: size, resizeHeight: size } : undefined).catch(() => null));
  return per.get(key);
}
