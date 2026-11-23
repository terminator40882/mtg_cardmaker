// Geometrie der Rahmenstile in Kartenkoordinaten (1500 × 2100 = 63 × 88 mm @ 600 dpi).
// Alle Werte wurden an hochaufgelösten Scans echter Karten abgemessen.
// Schriftgrößen sind als Versalhöhe (cap) angegeben, siehe textlayout.js.
export const W = 1500;
export const H = 2100;

const common = { W, H, radius: 75 };

export const LAYOUTS = {
  // Modern (ab Magic Origins 2015)
  m15: {
    ...common,
    style: 'm15',
    frame: { x: 58, y: 58, w: 1384, h: 1822, r: 44 },
    band: { x: 92, y: 88, w: 1316, h: 1240 },
    art: { x: 111, y: 228, w: 1278, h: 943 },
    namePlate: { x: 98, y: 97, w: 1304, h: 116 },
    typePlate: { x: 98, y: 1183, w: 1304, h: 117 },
    box: { x: 100, y: 1290, w: 1300, h: 660 },
    // Textlagen an 33 Scans (DOM–NEO) nachgemessen: Tintenkante links Name 129 / Typ 128 / Regeltext 130,
    // längste Regelzeile endet bei ≈1369
    text: { x: 129, y: 1326, w: 1248, h: 606 },
    ptPlate: { x: 1167, y: 1875, w: 250, h: 100 },
    nameText: { x: 125, right: 1383, baseline: 185, cap: 56, family: 'CMTitle' },
    typeText: { x: 124, right: 1383, baseline: 1263, cap: 46.7, family: 'CMTitle' }, // an 33 Scans nachgemessen
    // Manakosten und Set-Symbol an 33 Scans nachgemessen (Kreis Ø 72 px, Abstand 4 px, rechte Kante 1387;
    // Set-Symbol inkl. Kontur 88 px hoch, rechte Kante 1383)
    cost: { d: 72, gap: 4, right: 1387, cy: 154, shadow: { dx: -3, dy: 4 } },
    setSym: { right: 1380, cy: 1243, h: 82, maxW: 196, outline: 3 },
    pt: { cap: 49, family: 'CMTitle', baselineOffset: 32 },
    rules: { maxCap: 48, minCap: 16 },
    info: { y1: 1990, y2: 2031, x: 100, right: 1400, cap: 22 },
    holo: { cx: 750, cy: 1950, rx: 66, ry: 42 },
  },
  // Planeswalker (ab 2015), 3 Fähigkeiten – vermessen an Teferi, Hero of Dominaria
  pw: null,
  // Planeswalker mit 4 Fähigkeiten – vermessen an Jace, the Mind Sculptor (A25)
  pw4: null,
  // Modern (8th Edition 2003 – Magic 2014)
  m2003: {
    ...common,
    style: 'm2003',
    frame: { x: 68, y: 68, w: 1364, h: 1966, r: 6 },
    art: { x: 126, y: 242, w: 1245, h: 917 },
    namePlate: { x: 95, y: 109, w: 1299, h: 118 },
    typePlate: { x: 95, y: 1182, w: 1296, h: 113 },
    box: { x: 109, y: 1310, w: 1262, h: 584 },
    text: { x: 152, y: 1334, w: 1202, h: 536 }, // an 22 Scans (M10–THS) nachgemessen
    ptPlate: { x: 1114, y: 1876, w: 275, h: 94 },
    nameText: { x: 133, right: 1370, baseline: 197, cap: 54.2, family: 'CMMatrix' },
    typeText: { x: 133, right: 1370, baseline: 1263, cap: 43.9, family: 'CMMatrix' }, // an 22 Scans nachgemessen
    // an 22 Scans (M10–THS) nachgemessen: Kreis Ø 63 px, deutlicher Schatten unten links
    cost: { d: 63, gap: 6, right: 1371, cy: 173, shadow: { dx: -4, dy: 6 } },
    setSym: { right: 1386, cy: 1241, h: 80, maxW: 160 },
    pt: { cap: 48, family: 'CMMatrix', baselineOffset: 28 },
    rules: { maxCap: 50, minCap: 16 },
    metrics: { lineHeight: 1.46, flavorGap: 0.66, flavorBar: null },
    info: { y1: 1970, y2: 2012, x: 95, right: 1400, cap: 27, smallCap: 17 },
  },
  // Retro (Mirage 1997 – Scourge 2003)
  retro97: {
    ...common,
    style: 'retro',
    variant: '97',
    frame: { x: 76, y: 83, w: 1348, h: 1932, r: 0 },
    art: { x: 174, y: 205, w: 1167, h: 947 },
    artBevel: 14,
    box: { x: 156, y: 1258, w: 1185, h: 609 },
    text: { x: 197, y: 1286, w: 1104, h: 556 },
    nameText: { x: 164, right: 1371, baseline: 165, cap: 60, family: 'CMRetroTitle' }, // an 20 Scans nachgemessen
    // Typzeile und P/T sind auf alten Karten in der Regeltext-Schrift (MPlantin) gesetzt
    typeText: { x: 164, right: 1330, baseline: 1227, cap: 42, family: 'CMRules' },
    // an 20 Scans nachgemessen: Ø ~66 px, Abstand ~14 px
    cost: { d: 68, gap: 12, right: 1380, cy: 143, shadow: { dx: -2, dy: 3 } },
    setSym: { right: 1332, cy: 1206, h: 72, maxW: 130 },
    pt: { cap: 57, family: 'CMRules', cx: 1306, baseline: 1959 },
    rules: { maxCap: 48, minCap: 16 },
    metrics: { lineHeight: 1.56, paraGap: 0.6, flavorGap: 1.0, flavorBar: null },
    info: { artistBaseline: 1927, artistCap: 33, artistAlign: 'center', smallBaseline: 1970, smallCap: 18 },
  },
  // Retro (Alpha 1993 – Mirage)
  retro93: {
    ...common,
    style: 'retro',
    variant: '93',
    frame: { x: 61, y: 65, w: 1378, h: 1965, r: 0 },
    art: { x: 164, y: 197, w: 1174, h: 939 },
    artBevel: 22,
    box: { x: 189, y: 1280, w: 1114, h: 568 },
    boxBevel: 26,
    text: { x: 216, y: 1300, w: 1060, h: 528 },
    nameText: { x: 119, right: 1361, baseline: 146, cap: 57, family: 'CMRetroTitle' }, // an 16 Scans nachgemessen
    typeText: { x: 133, right: 1358, baseline: 1224, cap: 45, family: 'CMRules' },
    // an 16 Scans nachgemessen: Ø ~66 px, Abstand ~16 px, ohne Schatten
    cost: { d: 68, gap: 14, right: 1378, cy: 128 },
    setSym: { right: 1358, cy: 1204, h: 64, maxW: 120 },
    pt: { cap: 55, family: 'CMRules', cx: 1290, baseline: 1936 },
    rules: { maxCap: 50, minCap: 16, centerShort: 4 }, // bis Legends/4th: kurze Texte (≤ 4 Zeilen) zentriert
    metrics: { lineHeight: 1.66, paraGap: 0.6, flavorGap: 1.0, flavorBar: null },
    info: { artistBaseline: 1936, artistCap: 33, artistAlign: 'left', artistX: 133, smallBaseline: 1977, smallCap: 17 },
  },
};

LAYOUTS.pw = {
  ...LAYOUTS.m15,
  kind: 'pw',
  art: { x: 95, y: 212, w: 1310, h: 1676, r: 44 },
  // Scryfall-Art-Crop deckt nur den Bereich bis zur Typzeile ab
  artFit: { x: 95, y: 212, w: 1310, h: 967 },
  namePlate: { x: 83, y: 61, w: 1334, h: 133 },
  typePlate: { x: 83, y: 1179, w: 1334, h: 116 },
  nameText: { x: 121, right: 1386, baseline: 156, cap: 56, family: 'CMTitle' },
  typeText: { x: 124, right: 1386, baseline: 1258, cap: 46.7, family: 'CMTitle' },
  cost: { d: 72, gap: 4, right: 1388, cy: 134, shadow: { dx: -3, dy: 4 } }, // an Planeswalker-Scans nachgemessen
  setSym: { right: 1394, cy: 1238, h: 74, maxW: 150 },
  pwBox: { x: 174, y: 1310, w: 1212, h: 576, r: 30 },
  text: { x: 268, y: 1310, w: 1104, h: 576 },
  pwIcon: { cx: 128, line: 182 },
  shield: { cx: 1322, cy: 1909, w: 204, h: 106, cap: 50 },
  // Fähigkeitstext max. 7 pt (Teferi: Versalhöhe 37,4 px gemessen)
  rules: { maxCap: 37.4, minCap: 16, step: 48.1 / 18 },
};
LAYOUTS.pw4 = {
  ...LAYOUTS.pw,
  typePlate: { x: 83, y: 1042, w: 1334, h: 110 },
  artFit: { x: 95, y: 212, w: 1310, h: 830 },
  typeText: { x: 124, right: 1386, baseline: 1120, cap: 46.7, family: 'CMTitle' },
  setSym: { right: 1394, cy: 1097, h: 74, maxW: 150 },
  pwBox: { x: 174, y: 1175, w: 1212, h: 712, r: 30 },
  text: { x: 268, y: 1175, w: 1104, h: 712 },
};

// Saga (ab Dominaria 2018): Text links, Artwork rechts – vermessen an History of Benalia
LAYOUTS.saga = {
  ...LAYOUTS.m15,
  kind: 'saga',
  band: { x: 92, y: 88, w: 1316, h: 1720 },
  art: { x: 751, y: 233, w: 609, h: 1500 },
  box: { x: 122, y: 233, w: 629, h: 1500 },
  text: { x: 204, y: 233, w: 530, h: 1500 },
  typePlate: { x: 98, y: 1789, w: 1304, h: 111 },
  typeText: { x: 124, right: 1383, baseline: 1866, cap: 46.7, family: 'CMTitle' },
  setSym: { right: 1384, cy: 1845, h: 74, maxW: 150 },
  saga: { markerX: 124, trackX: 122, reminderX: 138, reminderH: 367 },
  rules: { maxCap: 48.1, minCap: 16, step: 48.1 / 18 },
};
// Class (ab AFR 2021): Artwork links, Text rechts mit Level-Leisten – vermessen an Wizard Class
LAYOUTS.class = {
  ...LAYOUTS.m15,
  kind: 'class',
  band: { x: 92, y: 88, w: 1316, h: 1720 },
  art: { x: 100, y: 233, w: 633, h: 1534 },
  box: { x: 733, y: 233, w: 667, h: 1534 },
  text: { x: 756, y: 233, w: 626, h: 1534 },
  typePlate: { x: 98, y: 1789, w: 1304, h: 111 },
  typeText: { x: 124, right: 1383, baseline: 1866, cap: 46.7, family: 'CMTitle' },
  setSym: { right: 1384, cy: 1845, h: 74, maxW: 150 },
  classBar: { h: 94 },
  rules: { maxCap: 48.1, minCap: 16, step: 48.1 / 18 },
};

// Adventure (ab Eldraine 2019) – vermessen an Bonecrusher Giant
LAYOUTS.adventure = {
  ...LAYOUTS.m15,
  kind: 'adventure',
  adv: {
    spine: 749,
    nameBar: { x: 104, y: 1331, w: 645, h: 82 },
    typeBar: { x: 104, y: 1419, w: 645, h: 82 },
    nameText: { x: 124, right: 712, baseline: 1386, cap: 35, family: 'CMTitle' },
    typeText: { x: 124, right: 730, baseline: 1478, cap: 35, family: 'CMTitle' },
    cost: { d: 50, gap: 3, right: 712, cy: 1366, shadow: { dx: -2, dy: 3 } },
    left: { x: 124, y: 1505, w: 605, h: 430 },
    right: { x: 795, y: 1326, w: 578, h: 606 },
  },
  rules: { maxCap: 40.1, minCap: 16, step: 48.1 / 18 },
};

// ---- Querformat-Layouts (werden gedreht auf die Hochformat-Karte gezeichnet)
// Koordinaten im Querformat 2100 × 1500.

/** Eine Hälfte einer Split-Karte – vermessen an Expansion // Explosion (GRN) */
function splitHalf(hx) {
  return {
    ...LAYOUTS.m15,
    W: 2100,
    H: 1500,
    kind: 'half',
    frame: { x: hx, y: 58, w: 925, h: 1384, r: 30 },
    band: { x: hx + 28, y: 88, w: 869, h: 820 },
    art: { x: hx + 53, y: 233, w: 820, h: 570 },
    namePlate: { x: hx + 22, y: 100, w: 881, h: 125 },
    typePlate: { x: hx + 22, y: 813, w: 881, h: 90 },
    box: { x: hx + 50, y: 900, w: 825, h: 534 },
    text: { x: hx + 72, y: 930, w: 781, h: 486 },
    nameText: { x: hx + 72, right: hx + 895, baseline: 187, cap: 50, family: 'CMTitle' },
    typeText: { x: hx + 72, right: hx + 880, baseline: 869, cap: 33, family: 'CMTitle' },
    cost: { d: 72, gap: 5, right: hx + 895, cy: 163, shadow: { dx: -3, dy: 4 } },
    setSym: { right: hx + 880, cy: 857, h: 52, maxW: 110 },
    rules: { maxCap: 48.1, minCap: 16, step: 48.1 / 18 },
  };
}
// Gemeinsame Sammlerinfo unten (Hochformat)
const landscapeInfo = { ...LAYOUTS.m15.info, y1: 2004, y2: 2045 };
LAYOUTS.split = { ...LAYOUTS.m15, kind: 'split', halves: [splitHalf(147), splitHalf(1112)], info: landscapeInfo };

/** Battle (ab MOM 2023) – vermessen an Invasion of Zendikar */
LAYOUTS.battle = {
  ...LAYOUTS.m15,
  kind: 'battle',
  info: landscapeInfo,
  land: {
    ...LAYOUTS.m15,
    W: 2100,
    H: 1500,
    kind: 'battleFace',
    frame: { x: 145, y: 58, w: 1897, h: 1384, r: 70 },
    art: { x: 175, y: 58, w: 1867, h: 1384 },
    artFit: { x: 175, y: 205, w: 1867, h: 635 },
    namePlate: { x: 217, y: 67, w: 1775, h: 125 },
    typePlate: { x: 233, y: 867, w: 1759, h: 130 },
    box: { x: 247, y: 1000, w: 1720, h: 442 },
    text: { x: 275, y: 1012, w: 1585, h: 420 },
    nameText: { x: 397, right: 1967, baseline: 155, cap: 52, family: 'CMTitle' },
    typeText: { x: 275, right: 1967, baseline: 953, cap: 47, family: 'CMTitle' },
    cost: { d: 70, gap: 5, right: 1967, cy: 130, shadow: { dx: -3, dy: 4 } },
    setSym: { right: 1967, cy: 930, h: 74, maxW: 150 },
    icon: { cx: 295, cy: 130 },
    defense: { cx: 1975, cy: 1383, r: 80, cap: 50 },
    backPT: { x: 1950, y: 1250 },
    rules: { maxCap: 42.8, minCap: 16, step: 48.1 / 18 },
  },
};

/** Rahmen-Jahr von Scryfall -> Layoutname */
export function layoutForFrame(frame) {
  if (frame === '1993') return 'retro93';
  if (frame === '1997') return 'retro97';
  if (frame === '2003') return 'm2003';
  return 'm15';
}
