import * as api from './api.js';
import { buildModel, renderCard, facesOf } from './render/render.js';
import { setFontScales, setOriginalFonts } from './render/textlayout.js';
import { forgetImage } from './render/assets.js';
import * as customArt from './customart.js';

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
    await customArt.ensure(artKey());
    if (state.printId !== id) return;
    updateArtPanel();
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

/** Seite, deren Artwork verwendet wird (einseitige Bilder bei Split/Adventure/Flip: immer 0). */
function artFace() {
  const face = Number($('opt-face').value || 0);
  return state.card.card_faces?.[face]?.image_uris ? face : 0;
}
const artKey = () => customArt.keyOf(state.card.id, artFace());
const originalArtUrl = () => api.artUrl(state.card.id, artFace());

function currentOptions(scale = 1) {
  const face = Number($('opt-face').value || 0);
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
    holoStamp: $('opt-stamp').checked,
    footer: $('opt-footer').value.trim(),
    art: { zoom: Number($('art-zoom').value), dx: Number($('art-dx').value), dy: Number($('art-dy').value) },
    artUrl: customArt.peek(artKey())?.url || originalArtUrl(),
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
      window.__lastModel = { layout: model.layout, textCap: model.textCap, frameSource: model.frameSource, layoutCopied: !!model.layoutCopied, printed: !!model.face?.printed, textVariant: model.textVariant || null, artAligned: !!model.artAligned };
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

for (const id of ['opt-flavor', 'opt-flavorbar', 'opt-stamp', 'opt-reminder', 'opt-printed', 'opt-size', 'opt-source', 'opt-frame', 'opt-border', 'opt-footer', 'opt-align', 'opt-copylayout', 'opt-matchcolors', 'art-zoom', 'art-dx', 'art-dy']) {
  $(id).addEventListener('input', scheduleRender);
}
$('opt-face').addEventListener('input', async () => {
  updateOriginal();
  const card = state.card;
  await customArt.ensure(artKey());
  if (state.card !== card) return;
  updateArtPanel();
  scheduleRender();
});
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

// ---------- Artwork: Original herunterladen, eigenes (upscaltes) Artwork verwenden ----------
function cardFileName() {
  const face = state.card.card_faces?.[artFace()];
  const name = (face?.name || state.card.name).replace(/[^\w\- ]+/g, '').trim() || 'card';
  return `${name} (${state.card.set.toUpperCase()} ${state.card.collector_number})`;
}

function updateArtPanel() {
  const url = originalArtUrl();
  if ($('art-thumb-img').getAttribute('src') !== url) $('art-thumb-img').src = url;
  const entry = customArt.peek(artKey());
  const drop = $('art-drop');
  drop.classList.toggle('filled', !!entry);
  drop.querySelector('.art-drop-empty').hidden = !!entry;
  $('art-custom-img').hidden = !entry;
  $('art-custom-badge').hidden = !entry;
  $('art-clear').hidden = !entry;
  drop.title = entry ? 'Klicken, um ein anderes Artwork zu wählen' : 'Eigenes Artwork ablegen oder auswählen';
  if (entry && $('art-custom-img').getAttribute('src') !== entry.url) $('art-custom-img').src = entry.url;
  if (!entry) { $('art-custom-img').removeAttribute('src'); $('art-custom-info').textContent = ''; return; }
  const info = $('art-custom-info');
  info.textContent = `Eigenes Artwork: ${entry.name} · ${entry.width} × ${entry.height} px`;
  // Seitenverhältnis/Faktor gegenüber dem Scryfall-Crop (zeigt, ob das Bild zur Karte passt)
  const orig = $('art-thumb-img');
  const compare = () => {
    if (customArt.peek(artKey()) !== entry || !orig.naturalWidth) return;
    const factor = entry.width / orig.naturalWidth;
    const arDiff = Math.abs(entry.width / entry.height / (orig.naturalWidth / orig.naturalHeight) - 1);
    info.textContent = `Eigenes Artwork: ${entry.name} · ${entry.width} × ${entry.height} px (${factor.toFixed(1).replace('.', ',')}× Original)`;
    if (arDiff > 0.02) {
      info.insertAdjacentHTML('beforeend', '<br><span class="warn">Seitenverhältnis weicht vom Original ab – Ausrichtung am Scan kann ungenau sein.</span>');
    }
  };
  if (orig.complete && orig.naturalWidth) compare();
  else orig.addEventListener('load', compare, { once: true });
}

$('art-thumb').addEventListener('click', async () => {
  const btn = $('art-thumb');
  btn.disabled = true;
  try {
    const res = await fetch(originalArtUrl());
    if (!res.ok) throw new Error(`Fehler ${res.status}`);
    const blob = await res.blob();
    const ext = { 'image/png': 'png', 'image/webp': 'webp' }[blob.type] || 'jpg';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${cardFileName()} art.${ext}`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  } catch (err) {
    $('status').textContent = `Artwork-Download fehlgeschlagen: ${err.message}`;
  } finally {
    btn.disabled = false;
  }
});

async function useCustomArt(file) {
  if (!file || !state.card) return;
  const key = artKey();
  const drop = $('art-drop');
  drop.classList.add('busy');
  try {
    const old = customArt.peek(key);
    await customArt.store(key, file);
    if (old) forgetImage(old.url);
  } catch (err) {
    $('art-custom-info').textContent = `${file.name}: ${err.message}`;
    return;
  } finally {
    drop.classList.remove('busy');
  }
  if (artKey() !== key) return;
  resetArt();
  updateArtPanel();
  scheduleRender();
}

$('art-drop').addEventListener('click', (e) => {
  if (e.target.closest('#art-clear')) return;
  $('art-file').click();
});
$('art-drop').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('art-file').click(); }
});
$('art-file').addEventListener('change', () => {
  const file = $('art-file').files[0];
  $('art-file').value = ''; // dieselbe Datei erneut wählbar
  useCustomArt(file);
});
$('art-drop').addEventListener('dragenter', (e) => { e.preventDefault(); $('art-drop').classList.add('dragover'); });
$('art-drop').addEventListener('dragover', (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
$('art-drop').addEventListener('dragleave', (e) => {
  if (!$('art-drop').contains(e.relatedTarget)) $('art-drop').classList.remove('dragover');
});
$('art-drop').addEventListener('drop', (e) => {
  e.preventDefault();
  $('art-drop').classList.remove('dragover');
  const file = [...(e.dataTransfer.files || [])].find((f) => /^image\//.test(f.type)) || e.dataTransfer.files?.[0];
  useCustomArt(file);
});
// daneben fallengelassene Dateien nicht im Browser öffnen
for (const t of ['dragover', 'drop']) {
  window.addEventListener(t, (e) => { if (e.dataTransfer?.types?.includes('Files')) e.preventDefault(); });
}

$('art-clear').addEventListener('click', async (e) => {
  e.stopPropagation();
  const key = artKey();
  const old = await customArt.remove(key);
  if (old) forgetImage(old.url);
  if (artKey() !== key) return;
  resetArt();
  updateArtPanel();
  scheduleRender();
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
