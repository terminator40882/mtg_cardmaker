// Farbpaletten (an Scans echter Karten abgeglichen).
// tex = [dunkel, mittel, hell] für die marmorierte Rahmenstruktur,
// band = einfarbige Innenkante um Bild/Leisten, plate = Namens-/Typleiste,
// box = Textfeld, rim = dunkle Konturen, retroTex/retroBox = Rahmen/Textfeld im Retro-Rahmen.
export const PALETTES = {
  W: { tex: ['#b3a982', '#dcd4aa', '#f7f3df'], band: '#b9bbbd', plate: '#f4f5f1', box: '#f3f3ed', rim: '#6d6e6f', retroTex: ['#a8a08a', '#d6d0bf', '#f2efe6'], retroBox: '#e9e3d3' },
  U: { tex: ['#0e3c6e', '#2467a6', '#9dc7ea'], band: '#1c64a6', plate: '#c8dae8', box: '#d9e4ec', rim: '#1d3d5c', retroTex: ['#123a68', '#2b5f96', '#7aa3cf'], retroBox: '#bccbdc' },
  B: { tex: ['#141211', '#37312e', '#8f8680'], band: '#3b3633', plate: '#cdc6c2', box: '#d6d1ce', rim: '#141110', retroTex: ['#121010', '#302a28', '#6a625e'], retroBox: '#aba39f' },
  R: { tex: ['#7a1b11', '#b63f2b', '#f4a86c'], band: '#cd4528', plate: '#efcfc9', box: '#f4e3e1', rim: '#5a1810', retroTex: ['#6e2a1a', '#a14c35', '#c87a5e'], retroBox: '#d3a68f' },
  G: { tex: ['#22462d', '#5b8558', '#c8deb8'], band: '#1f6a3a', plate: '#cbd6d1', box: '#d6dfda', rim: '#163a22', retroTex: ['#203a29', '#3b5b45', '#6f8f74'], retroBox: '#b49a80' },
  M: { tex: ['#8a6720', '#c9a452', '#f6e7b0'], band: '#c9a24c', plate: '#f1e4c0', box: '#f3ebd8', rim: '#6a4f18', retroTex: ['#7a5c20', '#b8954a', '#e3cd8c'], retroBox: '#dccc9f' },
  A: { tex: ['#5c6870', '#98a5ae', '#e4eaef'], band: '#8a97a2', plate: '#e2e7eb', box: '#e7ebee', rim: '#47525a', retroTex: ['#6b6560', '#9d968e', '#cfc8bf'], retroBox: '#cdc6bb' },
  L: { tex: ['#5a442e', '#9b7e5e', '#ddcbb1'], band: '#876a4c', plate: '#e9ddcc', box: '#ede4d7', rim: '#47372a', retroTex: ['#5a4532', '#8a6e52', '#bfa587'], retroBox: '#cdbca4' },
  C: { tex: ['#84817b', '#c3c0ba', '#f0eeea'], band: '#a5a29d', plate: '#ecebe8', box: '#f1f0ed', rim: '#66635e', retroTex: ['#6b6560', '#9d968e', '#cfc8bf'], retroBox: '#d6d2cc' },
};

export const VEHICLE_PT = { fill: '#9c6b42', rim: '#4a2e17', text: '#ffffff' };

export const BORDER_COLORS = {
  black: '#0f0d0b',
  white: '#f3f2ee',
  silver: '#a9aeb3',
  gold: '#c8a14a',
  yellow: '#e8c92f',
};

const ORDER = ['W', 'U', 'B', 'R', 'G'];
const sortColors = (cols) => [...cols].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));

/**
 * Bestimmt, wie der Rahmen eingefärbt wird.
 * Ergebnis: Liste von Ebenen-Paletten (1 = einfarbig, 2 = geteilt/hybrid).
 */
export function frameColors(face) {
  const type = face.type_line || '';
  // Split-Hälften haben bei Scryfall kein "colors" -> aus den Manakosten ableiten
  const fromCost = [...new Set((face.mana_cost || '').match(/[WUBRG]/g) || [])];
  const colors = sortColors(face.colors && face.colors.length ? face.colors : fromCost);
  const isLand = /\bLand\b/.test(type);
  const isArtifact = /\bArtifact\b/.test(type);
  const cost = face.mana_cost || '';
  const colored = (cost.match(/\{[^}]+\}/g) || []).filter((s) => /[WUBRG]/.test(s));
  const hybrid = colored.length > 0 && colored.every((s) => /^\{[WUBRG2]\/[WUBRG]\}$/.test(s));

  const layer = (base, accent) => {
    const b = PALETTES[base];
    const a = PALETTES[accent || base];
    if (!accent || accent === base) return { ...b, key: base };
    // Rahmenstruktur vom Basistyp (Land/Artefakt), Innenkante/Leisten/Textfeld in Kartenfarbe
    return { ...b, band: a.band, plate: a.plate, box: a.box, retroBox: a.retroBox, key: `${base}${accent}` };
  };

  if (colors.length === 0) {
    if (isLand) {
      const ci = sortColors(face.color_identity || []);
      if (ci.length === 1) return [layer('L', ci[0])];
      if (ci.length === 2) return [layer('L', ci[0]), layer('L', ci[1])];
      if (ci.length > 2) return [layer('L', 'M')];
      return [layer('L')];
    }
    if (isArtifact) return [layer('A')];
    return [layer('C')];
  }
  const base = isArtifact ? 'A' : null;
  if (colors.length === 1) return [layer(base || colors[0], colors[0])];
  if (colors.length === 2 && hybrid) return [layer(base || colors[0], colors[0]), layer(base || colors[1], colors[1])];
  // Zweifarbige Goldkarten: Goldrahmen, Innenkante links/rechts in den beiden Farben
  if (colors.length === 2 && !isArtifact) {
    const gold = PALETTES.M;
    return colors.map((c) => ({ ...gold, band: PALETTES[c].band, key: `M${c}` }));
  }
  return [layer(base || 'M', 'M')];
}
