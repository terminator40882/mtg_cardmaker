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
    text: { x: 133, y: 1326, w: 1234, h: 606 },
    ptPlate: { x: 1167, y: 1875, w: 250, h: 100 },
    nameText: { x: 130, right: 1383, baseline: 181, cap: 55, family: 'CMTitle' },
    typeText: { x: 130, right: 1383, baseline: 1263, cap: 49, family: 'CMTitle' },
    cost: { d: 60, gap: 4, right: 1383, cy: 156, shadow: { dx: -3, dy: 4 } },
    setSym: { right: 1384, cy: 1241, h: 74, maxW: 150 },
    pt: { cap: 49, family: 'CMTitle', baselineOffset: 32 },
    rules: { maxCap: 48, minCap: 16 },
    info: { y1: 1990, y2: 2031, x: 100, right: 1400, cap: 22 },
    holo: { cx: 750, cy: 1950, rx: 66, ry: 42 },
  },
  // Modern (8th Edition 2003 – Magic 2014)
  m2003: {
    ...common,
    style: 'm2003',
    frame: { x: 68, y: 68, w: 1364, h: 1966, r: 6 },
    art: { x: 126, y: 242, w: 1245, h: 917 },
    namePlate: { x: 95, y: 109, w: 1299, h: 118 },
    typePlate: { x: 95, y: 1182, w: 1296, h: 113 },
    box: { x: 109, y: 1310, w: 1262, h: 584 },
    text: { x: 152, y: 1334, w: 1196, h: 536 },
    ptPlate: { x: 1114, y: 1876, w: 275, h: 94 },
    nameText: { x: 133, right: 1370, baseline: 197, cap: 56, family: 'CMMatrix' },
    typeText: { x: 133, right: 1370, baseline: 1265, cap: 50, family: 'CMMatrix' },
    cost: { d: 58, gap: 4, right: 1370, cy: 170, shadow: { dx: -3, dy: 3 } },
    setSym: { right: 1386, cy: 1240, h: 78, maxW: 150 },
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
    nameText: { x: 167, right: 1371, baseline: 164, cap: 55, family: 'CMRetroTitle' },
    typeText: { x: 164, right: 1330, baseline: 1227, cap: 42, family: 'CMRetroTitle' },
    cost: { d: 58, gap: 3, right: 1371, cy: 139, shadow: { dx: -2, dy: 3 } },
    setSym: { right: 1332, cy: 1206, h: 72, maxW: 130 },
    pt: { cap: 57, family: 'CMRetroTitle', cx: 1306, baseline: 1959 },
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
    nameText: { x: 124, right: 1361, baseline: 139, cap: 51, family: 'CMRetroTitle' },
    typeText: { x: 133, right: 1358, baseline: 1224, cap: 45, family: 'CMRetroTitle' },
    cost: { d: 60, gap: 2, right: 1361, cy: 121, shadow: { dx: -2, dy: 3 } },
    setSym: { right: 1358, cy: 1204, h: 64, maxW: 120 },
    pt: { cap: 55, family: 'CMRetroTitle', cx: 1290, baseline: 1936 },
    rules: { maxCap: 50, minCap: 16, centerShort: true },
    metrics: { lineHeight: 1.66, paraGap: 0.6, flavorGap: 1.0, flavorBar: null },
    info: { artistBaseline: 1936, artistCap: 33, artistAlign: 'left', artistX: 133, smallBaseline: 1977, smallCap: 17 },
  },
};

/** Rahmen-Jahr von Scryfall -> Layoutname */
export function layoutForFrame(frame) {
  if (frame === '1993') return 'retro93';
  if (frame === '1997') return 'retro97';
  if (frame === '2003') return 'm2003';
  return 'm15';
}
