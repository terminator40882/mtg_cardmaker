import * as api from './api.js';
import { buildModel, renderCard, facesOf } from './render/render.js';
import { setFontScales, setOriginalFonts } from './render/textlayout.js';

const $ = (id) => document.getElementById(id);
const state = { prints: [], card: null, set: null, printId: null, rendering: null, pending: false };

// ---------- Autovervollständigung ----------
let acTimer;
$('q').addEventListener('input', () => {
  clearTimeout(acTimer);
  const q = $('q').value;
  acTimer = setTimeout(async () => {
    try {
      const names = await api.autocomplete(q);
      $('suggestions').innerHTML = names.map((n) => `<option value="${escapeHtml(n)}">`).join('');
    } catch { /* egal */ }
  }, 220);
});

$('search').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = $('q').value.trim();
  if (!name) return;
  $('prints-info').textContent = 'Suche …';
  $('grid').innerHTML = '';
  try {
    const res = await api.prints(name);
    state.result = res;
    state.prints = res.prints;
    $('q').value = res.name;
    renderGrid();
    const wanted = new URLSearchParams(location.search).get('id');
    if (wanted && !visiblePrints().some((p) => p.id === wanted)) { $('dedupe').checked = false; renderGrid(); }
    if (state.prints.length) selectPrint(state.prints.some((p) => p.id === wanted) ? wanted : visiblePrints()[0].id);
  } catch (err) {
    $('prints-info').textContent = err.message;
  }
});

$('dedupe').addEventListener('change', renderGrid);

function visiblePrints() {
  if (!$('dedupe').checked) return state.prints;
  const seen = new Set();
  return state.prints.filter((p) => {
    const key = p.illustration_id || p.id;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function renderGrid() {
  const res = state.result;
  if (!res) return;
  const list = visiblePrints();
  $('prints-title').textContent = res.name;
  $('prints-info').textContent = `${list.length} Version(en) angezeigt · ${res.total} Drucke insgesamt · ${res.excluded} ausgeblendet (Borderless/Full-Art/Extended Art u. ä.)`;
  $('grid').innerHTML = '';
  for (const p of list) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'print' + (p.id === state.printId ? ' active' : '');
    b.dataset.id = p.id;
    const tags = [p.frame, p.border_color !== 'black' ? p.border_color : null, ...p.frame_effects, p.lang !== 'en' ? p.lang : null, p.digital ? 'digital' : null]
      .filter(Boolean).join(' · ');
    b.innerHTML = `<img loading="lazy" src="${p.art}" alt="">
      <div class="meta"><b>${escapeHtml(p.set_name)}</b><br>${p.set.toUpperCase()} #${escapeHtml(p.collector_number)} · ${(p.released_at || '').slice(0, 4)}</div>
      <div class="tags">${escapeHtml(tags)} · ${escapeHtml(p.artist || '')}</div>`;
    b.addEventListener('click', () => selectPrint(p.id));
    $('grid').append(b);
  }
}

// ---------- Auswahl & Rendering ----------
async function selectPrint(id) {
  if (globalThis.__perf) globalThis.__perf.push(['select', performance.now()]);
  state.printId = id;
  document.querySelectorAll('.print').forEach((el) => el.classList.toggle('active', el.dataset.id === id));
  $('status').textContent = 'Lade Karte …';
  try {
    let card = await api.card(id);
    if (state.printId !== id) return; // inzwischen wurde eine andere Version gewählt
    // "The List"/Mystery-Booster-Reprints tragen Set & Nummer des Originals (z. B. "CLB-187")
    const m = /^(plst|plist|mb1|fmb1|pmb1)$/.test(card.set) && /^([A-Za-z0-9]+)-(.+)$/.exec(card.collector_number);
    if (m) card = { ...card, set: m[1].toLowerCase(), collector_number: m[2] };
    const [set, printed] = await Promise.all([
      api.set(card.set).catch(() => null),
      api.printed(card.set, card.id, card.name).catch(() => null),
    ]);
    if (state.printId !== id) return;
    card = { ...card, printed };
    state.card = card;
    state.set = set;
    const faces = facesOf(card);
    $('face-wrap').hidden = faces.length < 2;
    $('opt-face').innerHTML = faces.map((f, i) => `<option value="${i}">${escapeHtml(f.name)}</option>`).join('');
    resetArt();
    $('editor').hidden = false;
    updateOriginal();
    scheduleRender();
  } catch (err) {
    $('status').textContent = err.message;
  }
}

function faceImage(card, face) {
  const f = card.card_faces?.[face];
  return (f?.image_uris || card.image_uris || card.card_faces?.[0]?.image_uris) || {};
}

function updateOriginal() {
  const face = Number($('opt-face').value || 0);
  const url = faceImage(state.card, face).normal;
  $('orig').src = url ? `/asset?u=${encodeURIComponent(url)}` : '';
}

function currentOptions(scale = 1) {
  const face = Number($('opt-face').value || 0);
  const hasFaceArt = !!state.card.card_faces?.[face]?.image_uris;
  return {
    face,
    frame: $('opt-frame').value,
    frameSource: $('opt-source').value,
    border: $('opt-border').value,
    showFlavor: $('opt-flavor').checked,
    showReminder: $('opt-reminder').checked,
    printedText: $('opt-printed').checked,
    fontCap: Number($('opt-size').value) || null,
    flavorBar: $('opt-flavorbar').checked,
    footer: $('opt-footer').value.trim(),
    art: { zoom: Number($('art-zoom').value), dx: Number($('art-dx').value), dy: Number($('art-dy').value) },
    artUrl: api.artUrl(state.card.id, hasFaceArt ? face : 0),
    alignArt: $('opt-align').checked,
    workers: !globalThis.__noWorkers,
    copyLayout: $('opt-copylayout').checked,
    matchColors: $('opt-matchcolors').checked,
    scanUrl: faceImage(state.card, face).png ? `/asset?u=${encodeURIComponent(faceImage(state.card, face).png)}` : null,
    scale,
  };
}

let fontsReady = null;
async function deps() {
  fontsReady ||= api.fontStatus().then((st) => {
    setFontScales(Object.fromEntries(Object.entries(st).map(([fam, v]) => [fam, v.scaleX])));
    setOriginalFonts(Object.entries(st).filter(([, v]) => v.source === 'custom').map(([fam]) => fam));
  }).catch(() => {});
  await fontsReady;
  const [symbolMap, keywords] = await Promise.all([api.symbology(), api.catalog('keyword-abilities')]);
  return { symbolMap, keywords };
}

let renderCount = 0;
function scheduleRender() {
  if (state.rendering) { state.pending = true; return; }
  state.rendering = (async () => {
    try {
      const model = buildModel(state.card, state.set, currentOptions(1));
      await renderCard($('card'), model, await deps());
      window.__lastModel = { layout: model.layout, textCap: model.textCap, frameSource: model.frameSource };
      document.body.dataset.rendered = `${state.card.id}:${model.opts.face}:${++renderCount}`;
      $('status').textContent = model.textCap ? `Regeltext: Versalhöhe ${model.textCap.toFixed(2)} px${$('opt-size').value ? '' : ' (automatisch angepasst)'}${model.layoutCopied ? ' · Zeilenlayout vom Original übernommen' : ''}` : '';
    } catch (err) {
      console.error(err);
      $('status').textContent = `Fehler beim Rendern: ${err.message}`;
    }
  })();
  state.rendering.finally(() => {
    state.rendering = null;
    if (state.pending) { state.pending = false; scheduleRender(); }
  });
}

for (const id of ['opt-flavor', 'opt-flavorbar', 'opt-reminder', 'opt-printed', 'opt-size', 'opt-source', 'opt-frame', 'opt-border', 'opt-footer', 'opt-align', 'opt-copylayout', 'opt-matchcolors', 'art-zoom', 'art-dx', 'art-dy']) {
  $(id).addEventListener('input', scheduleRender);
}
$('opt-face').addEventListener('input', () => { updateOriginal(); scheduleRender(); });
$('art-reset').addEventListener('click', () => { resetArt(); scheduleRender(); });
$('options').addEventListener('submit', (e) => e.preventDefault());

function resetArt() {
  $('art-zoom').value = 1;
  $('art-dx').value = 0;
  $('art-dy').value = 0;
}

$('download').addEventListener('click', async () => {
  const btn = $('download');
  btn.disabled = true;
  try {
    const scale = Number($('opt-scale').value) || 1;
    const canvas = document.createElement('canvas');
    const model = buildModel(state.card, state.set, currentOptions(scale));
    await renderCard(canvas, model, await deps());
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${model.face.name.replace(/[^\w\- ]+/g, '').trim() || 'card'} (${state.card.set.toUpperCase()} ${state.card.collector_number}).png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } finally {
    btn.disabled = false;
  }
});

// Schriftgrößen-Auswahl
for (let s = 50; s >= 20; s -= 1) $('opt-size').insertAdjacentHTML('beforeend', `<option value="${s}">${s} px Versalhöhe</option>`);

// Hinweis zu den Card-Conjurer-Assets
fetch('/api/cc').then((r) => r.json()).then((st) => {
  $('cc-info').textContent = st.available
    ? 'Rahmengrafiken: Card-Conjurer-Assets aus Assets/.'
    : `Card-Conjurer-Assets nicht verfügbar (${st.reason}) – Rahmen werden per Code gezeichnet.`;
}).catch(() => {});

// Hinweis zu Schriften
api.fontStatus().then((st) => {
  const fallback = Object.entries(st).filter(([, v]) => v.source === 'fallback').map(([k]) => k);
  $('font-info').textContent = fallback.length
    ? `Ersatzschriften aktiv für: ${fallback.join(', ')}. Eigene Schriften (z. B. Beleren, MPlantin) in app/fonts ablegen – siehe README.`
    : 'Alle Karten-Schriften aus app/fonts geladen.';
}).catch(() => {});

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// Direktaufruf per URL: /?q=Lightning%20Bolt
// Direktaufruf: /?q=Name oder /?id=<Scryfall-ID>
const params = new URLSearchParams(location.search);
const initial = params.get('q');
if (!initial && params.get('id')) {
  api.card(params.get('id')).then((c) => { $('q').value = c.name; $('search').requestSubmit(); }).catch(() => {});
} else if (initial) {
  $('q').value = initial;
  $('search').requestSubmit();
}
