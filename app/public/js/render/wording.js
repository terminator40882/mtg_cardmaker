// Historische Formulierungen des Regeltexts.
//
// Scryfall liefert für englische Karten nur den heutigen Oracle-Text; der gedruckte Text kommt aus
// MTGJSON (originalText) – das fehlt aber für viele Sets (z. B. 30A, ATH, BTD, CED, PTC, SUM, TD0,
// viele Promos). Dann werden aus dem Oracle-Text die Wortlaute früherer Regel-Epochen abgeleitet
// (jeweils kumulativ, von neu nach alt); welcher auf dem Druck steht, entscheidet der Vergleich mit
// dem Scan, ohne Scan das Erscheinungsdatum.

// [Kennung, gilt für Drucke vor, Ersetzungen]
const ERAS = [
  // "enters" statt "enters the battlefield" seit Bloomburrow/Duskmourn (2024)
  ['etb', '2024-07-26', [[/\benters(?! the battlefield)\b/g, 'enters the battlefield']]],
  // "mana value" seit Strixhaven (April 2021)
  ['cmc', '2021-04-23', [[/\bmana values\b/g, 'converted mana costs'], [/\bmana value\b/g, 'converted mana cost']]],
  // "any target" seit Dominaria (April 2018)
  ['cp', '2018-04-27', [[/\bany target\b/g, 'target creature or player']]],
  // "battlefield" seit Magic 2010 (Juli 2009)
  ['play', '2009-07-17', [
    [/\benters the battlefield\b/g, 'comes into play'],
    [/\benter the battlefield\b/g, 'come into play'],
    [/\bonto the battlefield\b/g, 'into play'],
    [/\bon the battlefield\b/g, 'in play'],
    [/\bthe battlefield\b/g, 'play'],
  ]],
  // "does N damage to one target" bis Revised/Summer Magic (4th Edition: "deals")
  ['does', '1995-04-01', [
    [/\bdeals (\d+|X) damage to target creature or player\b/g, 'does $1 damage to one target'],
    [/\bdeals (\d+|X) damage\b/g, 'does $1 damage'],
    [/\bdeal (\d+|X) damage\b/g, 'do $1 damage'],
  ]],
];

/**
 * Wortlaut-Varianten früherer Epochen (ohne den unveränderten Text), neueste zuerst:
 * [{ label, text, before }] – before = Erscheinungsdatum, vor dem die Variante gilt.
 */
export function historicWordings(text) {
  const out = [];
  let t = text || '';
  for (const [label, before, reps] of ERAS) {
    let n = t;
    for (const [re, rep] of reps) n = n.replace(re, rep);
    if (n !== t) {
      t = n;
      out.push({ label, text: t, before });
    }
  }
  return out;
}

/** Variante, die nach dem Erscheinungsdatum zu erwarten ist (null = Oracle-Text). */
export function expectedWording(variants, released) {
  if (!released) return null;
  let pick = null;
  for (const v of variants) if (released < v.before) pick = v;
  return pick;
}
