// Dünne Hülle um das lokale Backend (das wiederum Scryfall abfragt und cached).
async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Fehler ${res.status}`);
  return body;
}

const memo = new Map();
const once = (key, fn) => {
  if (!memo.has(key)) memo.set(key, fn().catch((e) => { memo.delete(key); throw e; }));
  return memo.get(key);
};

export const autocomplete = (q) => getJson(`/api/autocomplete?q=${encodeURIComponent(q)}`);
export const prints = (name) => getJson(`/api/prints?name=${encodeURIComponent(name)}`);
export const card = (id) => once(`card:${id}`, () => getJson(`/api/card/${id}`));
export const set = (code) => once(`set:${code}`, () => getJson(`/api/set/${code}`));
export const symbology = () => once('symbology', async () => {
  const list = await getJson('/api/symbology');
  return new Map(list.map((s) => [s.symbol, s.svg]));
});
export const catalog = (name) => once(`catalog:${name}`, async () => new Set((await getJson(`/api/catalog/${name}`)).map((s) => s.toLowerCase())));
export const fontStatus = () => getJson('/api/fonts');
export const artUrl = (id, face = 0) => `/api/art/${id}?face=${face}`;
export const printed = (set, id) => once(`printed:${set}:${id}`, () => getJson(`/api/printed/${set}/${id}`).then((r) => r.faces).catch(() => null));
