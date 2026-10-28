// TW-CAD – Fliesen-Katalog: Sorten, Formate, Farben, Oberflächen, Fugen, Profile, Richtwerte
// Alle Formate in cm als [Breite, Länge] wie im Handel angegeben; intern wird in mm gerechnet (L = lange Seite).

export const KATEGORIEN = [
  { id: 'fsz_boden', name: 'Feinsteinzeug Boden', icon: '⬛', material: 'feinsteinzeug', bereich: 'boden', textur: 'uni', staerke: 9, verband: 'drittel',
    formate: [[15, 15], [20, 20], [30, 30], [30, 60], [40, 80], [45, 45], [45, 90], [60, 60], [75, 75], [80, 80], [90, 90], [60, 120], [80, 160], [100, 100], [120, 120]] },
  { id: 'wand', name: 'Wandfliesen (Steingut)', icon: '▭', material: 'steingut', bereich: 'wand', textur: 'glanz', staerke: 8, verband: 'kreuz', fuge: 2,
    formate: [[10, 10], [15, 15], [20, 20], [20, 25], [20, 40], [20, 50], [25, 33], [25, 40], [25, 50], [25, 75], [30, 60], [30, 90], [40, 120], [33, 100]] },
  { id: 'gross', name: 'Großformat / Platten', icon: '⬜', material: 'feinsteinzeug', bereich: 'boden', textur: 'beton', staerke: 6, verband: 'kreuz', fuge: 3,
    formate: [[100, 100], [100, 200], [100, 300], [120, 240], [120, 260], [120, 278], [160, 320], [150, 300]] },
  { id: 'holz', name: 'Holzoptik / Dielen', icon: '🪵', material: 'feinsteinzeug', bereich: 'boden', textur: 'holz', staerke: 9, verband: 'wild', fuge: 2,
    formate: [[15, 60], [15, 90], [20, 120], [20, 160], [20, 180], [25, 150], [30, 120], [30, 150], [30, 180], [40, 240]] },
  { id: 'beton', name: 'Beton- / Zementoptik', icon: '◼', material: 'feinsteinzeug', bereich: 'boden', textur: 'beton', staerke: 9, verband: 'kreuz', fuge: 3,
    formate: [[30, 60], [45, 90], [60, 60], [60, 120], [75, 75], [80, 80], [90, 90], [120, 120], [120, 240]] },
  { id: 'marmor', name: 'Marmoroptik', icon: '◇', material: 'feinsteinzeug', bereich: 'boden', textur: 'marmor', staerke: 9, verband: 'kreuz', fuge: 2, oberflaeche: 'poliert',
    formate: [[30, 60], [60, 60], [60, 120], [75, 150], [80, 80], [120, 120], [120, 278]] },
  { id: 'naturstein', name: 'Naturstein', icon: '🪨', material: 'naturstein', bereich: 'boden', textur: 'naturstein', staerke: 12, verband: 'halb', fuge: 3,
    formate: [[30, 30], [30, 60], [40, 40], [40, 60], [40, 80], [60, 60], [30.5, 61], [45, 90], [60, 90]] },
  { id: 'schiefer', name: 'Schiefer / Quarzit', icon: '▰', material: 'naturstein', bereich: 'boden', textur: 'schiefer', staerke: 12, verband: 'wild', fuge: 4,
    formate: [[30, 30], [30, 60], [40, 40], [40, 80], [60, 60], [15, 60]] },
  { id: 'mosaik', name: 'Mosaik (Keramik)', icon: '▦', material: 'mosaik', bereich: 'boden', textur: 'uni', staerke: 5, verband: 'kreuz', fuge: 2, matte: 300,
    formate: [[1, 1], [2, 2], [2.5, 2.5], [2.3, 4.8], [5, 5], [5, 10], [10, 10]] },
  { id: 'glasmosaik', name: 'Glasmosaik', icon: '◈', material: 'glasmosaik', bereich: 'wand', textur: 'glanz', staerke: 4, verband: 'kreuz', fuge: 2, matte: 300,
    formate: [[1, 1], [1.5, 1.5], [2, 2], [2.3, 2.3], [2.5, 2.5], [2, 4.8], [5, 5]] },
  { id: 'metro', name: 'Metro / Facette', icon: '🧱', material: 'steingut', bereich: 'wand', textur: 'glanz', staerke: 8, verband: 'halb', fuge: 2,
    formate: [[7.5, 15], [7.5, 30], [10, 20], [10, 30], [6.5, 20], [7.5, 25], [10, 40]] },
  { id: 'riemchen', name: 'Riemchen / Klinkerriemchen', icon: '▤', material: 'klinker', bereich: 'wand', textur: 'zement', staerke: 12, verband: 'halb', fuge: 10,
    formate: [[2.4, 24], [5.2, 24], [7.1, 24], [11.3, 24], [5, 25], [4, 40]] },
  { id: 'zement', name: 'Zementfliesen / Dekor', icon: '✿', material: 'zementfliese', bereich: 'boden', textur: 'zement', staerke: 16, verband: 'kreuz', fuge: 1.5,
    formate: [[15, 15], [20, 20], [25, 25]] },
  { id: 'klinker', name: 'Klinker / Spaltplatte', icon: '▥', material: 'spaltplatte', bereich: 'boden', textur: 'uni', staerke: 12, verband: 'kreuz', fuge: 8,
    formate: [[11.5, 24], [7.1, 24], [11.5, 24.4], [24, 24], [30, 30], [12.5, 25]] },
  { id: 'cotto', name: 'Cotto / Terrakotta', icon: '🟫', material: 'cotto', bereich: 'boden', textur: 'naturstein', staerke: 15, verband: 'kreuz', fuge: 8,
    formate: [[20, 20], [25, 25], [30, 30], [15, 30], [20, 40], [40, 40]] },
  { id: 'schwimmbad', name: 'Schwimmbad / Becken', icon: '🏊', material: 'feinsteinzeug', bereich: 'boden', textur: 'uni', staerke: 10, verband: 'kreuz', fuge: 5, rutsch: 'B',
    formate: [[12.5, 12.5], [12.5, 24.5], [11.5, 24.4], [25, 25], [24.4, 24.4], [5, 5], [2.5, 2.5]] },
  { id: 'aussen', name: 'Terrasse / Außen 2 cm', icon: '☀', material: 'feinsteinzeug', bereich: 'boden', textur: 'beton', staerke: 20, verband: 'kreuz', fuge: 4, rutsch: 'R11', frost: true,
    formate: [[40, 80], [45, 90], [60, 60], [60, 90], [60, 120], [80, 80], [40, 120]] },
  { id: 'sechseck', name: 'Sechseck / Hexagon', icon: '⬡', material: 'feinsteinzeug', bereich: 'boden', textur: 'zement', staerke: 9, verband: 'sechseck', fuge: 2,
    formate: [[5, 5.8], [10, 11.5], [15, 17.3], [17.5, 20.2], [20, 23.1], [25, 28.9], [29, 33.5]] },
  { id: 'chevron', name: 'Chevron (Fischgrät 45°)', icon: '⋀', material: 'feinsteinzeug', bereich: 'boden', textur: 'holz', staerke: 9, verband: 'chevron', fuge: 2,
    formate: [[9, 45], [10, 60], [12, 60], [14, 70], [15, 90], [20, 100]] },
  { id: 'sockel', name: 'Sockel / Kehlsockel', icon: '▁', material: 'feinsteinzeug', bereich: 'sockel', textur: 'uni', staerke: 9, verband: 'kreuz', fuge: 3,
    formate: [[6, 30], [6, 60], [7, 30], [7, 60], [8, 30], [8, 60], [10, 60], [8, 120]] }
];

/** Farben: [Name, Hex, Zweitfarbe/Äderung, Textur-Vorschlag] */
export const FARBEN = [
  ['weiß glänzend', '#f6f6f3', '', 'glanz'], ['weiß matt', '#ecebe7', ''], ['creme', '#ebe3d2', ''], ['elfenbein', '#efe7d6', ''], ['beige', '#ddd0b8', ''], ['sand', '#cdbf9f', ''],
  ['greige', '#bdb5a8', ''], ['taupe', '#9e9286', ''], ['hellgrau', '#d3d5d6', ''], ['grau', '#a9adb1', ''], ['mittelgrau', '#8b9096', ''], ['dunkelgrau', '#6a6f75', ''],
  ['anthrazit', '#4d5258', ''], ['schwarz', '#2b2d30', ''], ['Beton hell', '#bfbcb5', '#a9a59d', 'beton'], ['Beton dunkel', '#7f7d78', '#6c6a65', 'beton'],
  ['Marmor Carrara', '#eeeeec', '#9aa0a6', 'marmor'], ['Marmor Calacatta', '#f3f0ea', '#b59a6b', 'marmor'], ['Marmor Nero', '#2c2c2e', '#d8d8d8', 'marmor'],
  ['Travertin', '#d9c7a6', '#bfa983', 'naturstein'], ['Schiefer', '#4a4f55', '#3b4046', 'schiefer'], ['Terrazzo', '#e3ddd3', '#8d877f', 'terrazzo'],
  ['Eiche hell', '#c7a77d', '#a8865c', 'holz'], ['Eiche', '#a77f55', '#86613b', 'holz'], ['Eiche grau', '#a59c90', '#857c70', 'holz'], ['Nuss', '#7a573d', '#5c3f2a', 'holz'],
  ['Terracotta', '#b8693f', '', ''], ['rot', '#a8382f', '', ''], ['Salbei', '#9fae94', '', ''], ['grün', '#6f9b6d', '', ''], ['Petrol', '#2f6e74', '', ''],
  ['Beckenblau', '#3f7fb5', '', ''], ['hellblau', '#8ec2e3', '', ''], ['türkis', '#3aa3a6', '', ''], ['dunkelblau', '#28466e', '', ''], ['gelb', '#e7c45a', '', '']
];

export const OBERFLAECHEN = [['', '–'], ['matt', 'matt'], ['seidenmatt', 'seidenmatt'], ['glaenzend', 'glänzend'], ['poliert', 'poliert (hochglanz)'], ['lappato', 'lappato / halbpoliert'], ['strukturiert', 'strukturiert'], ['anti-slip', 'Anti-Slip / grip'], ['gebuerstet', 'gebürstet'], ['gespalten', 'gespalten / naturrau'], ['geflammt', 'geflammt'], ['getrommelt', 'getrommelt / antik']];
export const RUTSCH = [['', '–'], ['R9', 'R9 (Wohnbereich)'], ['R10', 'R10 (Bad, Küche)'], ['R11', 'R11 (Dusche gewerbl., außen)'], ['R12', 'R12 (Großküche)'], ['R13', 'R13'], ['A', 'A (barfuß)'], ['B', 'B (barfuß, Dusche)'], ['C', 'C (barfuß, Beckenrand)'], ['R10/B', 'R10 / B'], ['R11/C', 'R11 / C']];
export const VERDRAENGUNG = [['', '–'], ['V4', 'V4'], ['V6', 'V6'], ['V8', 'V8'], ['V10', 'V10']];
export const ABRIEB = [['', '–'], ['1', 'PEI I (Wand)'], ['2', 'PEI II'], ['3', 'PEI III (Wohnen)'], ['4', 'PEI IV (stark)'], ['5', 'PEI V (sehr stark)']];
export const MATERIALIEN = [['', '–'], ['feinsteinzeug', 'Feinsteinzeug'], ['steingut', 'Steingut (Wand)'], ['steinzeug', 'Steinzeug glasiert'], ['mosaik', 'Mosaik (Keramik)'], ['glasmosaik', 'Glasmosaik'], ['naturstein', 'Naturstein'], ['klinker', 'Klinker'], ['spaltplatte', 'Spaltplatte'], ['cotto', 'Cotto'], ['zementfliese', 'Zementfliese'], ['glas', 'Glasfliese'], ['metall', 'Metall / Dekor']];
export const STAERKEN = [3, 4, 5, 6, 8, 9, 10, 12, 15, 20, 30];

/** Fugen */
export const FUGENBREITEN = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12];
export const FUGENFARBEN = [['weiß', '#f2f2f2'], ['brillantweiß', '#fbfbfb'], ['silbergrau', '#c4c6c8'], ['manhattan', '#b3b4b2'], ['zementgrau', '#9a9ea2'], ['steingrau', '#878a8c'], ['basalt', '#6c6f72'], ['anthrazit', '#55595e'], ['schwarz', '#2b2b2b'],
  ['jasmin', '#efe6cf'], ['pergamon', '#e3d9c3'], ['bahamabeige', '#d8c8a8'], ['sandgrau', '#b9b19f'], ['caramel', '#b88d5c'], ['braun', '#7a6150'], ['terracotta', '#a85a3a'], ['transparent (Glas)', '#dfe7ea']];
export const FUGENMATERIAL = [['zement', 'zementär CG2 WA (Standard)'], ['schnell', 'zementär schnell / flexibel'], ['epoxid', 'Epoxid RG (Dusche, Gewerbe, Becken)'], ['naturstein', 'Naturstein-Fuge (trassgebunden)'], ['breit', 'Breitfuge (ab 5 mm)'], ['silikon', 'Silikon (Bewegungsfuge)']];
export const FUGENTIEFE = (staerke) => Math.max(3, Math.min(12, (staerke || 9) * 0.9));

/** Kanten-/Abschlussprofile */
export const PROFILE = [['', 'keine (Kante gefliest)'], ['edelstahl_g', 'Edelstahl gebürstet'], ['edelstahl_p', 'Edelstahl poliert'], ['alu_natur', 'Aluminium natur'], ['alu_silber', 'Alu eloxiert silber'], ['alu_chrom', 'Alu chrom glänzend'], ['alu_schwarz', 'Alu schwarz matt'], ['messing', 'Messing'], ['pvc_weiss', 'Kunststoff weiß'], ['gehrung', 'Gehrungsschnitt (Jolly)'], ['viertelstab', 'Viertelstab / Rundprofil']];
export const PROFIL_FORM = [['l', 'L-Winkel (Abschluss)'], ['quadrat', 'Quadrat-/Eckprofil'], ['rund', 'Viertelkreis'], ['treppe', 'Treppenkante'], ['ueber', 'Übergangsprofil (Boden)']];

/** Verlegeart / Kleber */
export const VERLEGEART = [['duenn', 'Dünnbett (Standard)'], ['buttering', 'Dünnbett + Buttering-Floating (ab 60 cm)'], ['mittel', 'Mittelbett (Naturstein, unebene Platten)'], ['fliess', 'Fließbett (Boden, große Formate)'], ['dick', 'Dickbett (Mörtelbett)']];
export const KLEBER = [['c2te', 'C2TE (flexibel, Standard)'], ['c2tes1', 'C2TE S1 (verformbar)'], ['c2fs1', 'C2F S1 (schnell, verformbar)'], ['c2es2', 'C2E S2 (hoch verformbar, Großformat)'], ['weiss', 'Weißkleber (Glas/Naturstein)'], ['epoxid', 'Reaktionsharz R2T']];

/** Höhen-Vorschläge */
export const WANDHOEHEN = [[0, 'raumhoch'], [1200, '1,20 m (Spritzschutz)'], [1500, '1,50 m'], [2000, '2,00 m'], [2100, '2,10 m'], [2250, '2,25 m'], ['tuer', 'Türhöhe (Oberkante Tür)']];
export const SOCKELHOEHEN = [50, 60, 70, 80, 100, 120];

export const ZIEL_NAME = { boden: 'Boden', wand: 'Alle Wände', sockel: 'Sockel', oben: 'Wand oben (2. Fliese)', fries: 'Bordüre / Fries', rand: 'Randfries Boden' };
/** Bauteile, die gefliest werden können: h = Standardhöhe (0 = raumhoch), oben = Ablage/Abdeckung oben fliesen */
export const BAUTEIL_FLIESEN = {
  vorwand: { name: 'Vorwand', h: 1200, oben: true, icon: '▥' },
  schacht: { name: 'Schacht', h: 0, oben: false, icon: '▣' },
  wanne: { name: 'Wannenschürze', h: 560, oben: false, icon: '🛁' },
  duschwanne: { name: 'Wannenschürze', h: 560, oben: false, icon: '🛁' },
  eckwanne: { name: 'Wannenschürze', h: 560, oben: false, icon: '🛁' },
  duschtasse: { name: 'Duschtassen-Schürze', h: 150, oben: false, icon: '▭' },
  podest: { name: 'Podest', h: 150, oben: true, icon: '▬' },
  sitzbank: { name: 'Sitzbank', h: 450, oben: true, icon: '▭' },
  mauerscheibe: { name: 'Mauerscheibe', h: 1200, oben: true, icon: '▮' },
  stufe: { name: 'Stufe', h: 180, oben: true, icon: '▁' },
  nische: { name: 'Ablage / Nischenkasten', h: 1100, oben: true, icon: '▤' }
};
export const BAUTEIL_HOEHEN = [[0, 'raumhoch'], [150, '15 cm'], [560, '56 cm (Wanne)'], [600, '60 cm'], [820, '82 cm'], [1000, '1,00 m'], [1120, '1,12 m (WC-Element)'], [1200, '1,20 m'], [1300, '1,30 m'], [1500, '1,50 m']];

/** Format-Text „30×60“ (cm) aus mm */
export const cm = (mm) => { const v = Math.round(mm) / 10; return (Math.abs(v - Math.round(v)) < 0.05 ? String(Math.round(v)) : v.toFixed(1)).replace('.', ','); };
export const formatText = (t) => { const B = t.B || t.breite || t.hoehe || 0, L = t.L || 0; return `${cm(Math.min(L, B))}×${cm(Math.max(L, B))}`; };

/** Standard-Fugenbreite nach Format/Material (Richtwerte DIN 18352 / Fachregeln) */
export function standardFuge(kat, L, B, rektifiziert = false) {
  if (kat && kat.fuge) return kat.fuge;
  const m = Math.max(L, B), mat = kat ? kat.material : '';
  if (mat === 'mosaik' || mat === 'glasmosaik') return 2;
  if (rektifiziert) return m >= 600 ? 3 : 2;
  return m >= 600 ? 3 : m >= 300 ? 3 : 2;
}

/** Empfehlung Zahnspachtel / Kleberverbrauch (kg/m²) nach Format und Verlegeart */
export function kleberEmpfehlung(L, B, verlegeart = 'duenn') {
  const m = Math.max(L, B);
  let zahn = m >= 600 ? 10 : m >= 300 ? 8 : m >= 150 ? 6 : 4;
  let kg = { 4: 1.6, 6: 2.3, 8: 2.9, 10: 3.6, 12: 4.3 }[zahn];
  if (verlegeart === 'buttering') { kg += 1.2; zahn = Math.max(zahn, 10); }
  if (verlegeart === 'mittel') { zahn = 12; kg = 5.5; }
  if (verlegeart === 'fliess') { zahn = 10; kg = 4.5; }
  if (verlegeart === 'dick') { zahn = 0; kg = 25; }
  return { zahn, kg };
}

/** Neue Bibliotheks-Fliese aus Katalog */
export function ausKatalog(kat, fmt, farbe, extra = {}) {
  const L = Math.round(Math.max(fmt[0], fmt[1]) * 10), B = Math.round(Math.min(fmt[0], fmt[1]) * 10);
  const fname = farbe ? farbe[0] : '';
  return Object.assign({
    name: `${kat.name.replace(/ \(.*\)| \/.*/g, '').replace('Wandfliesen', 'Wandfliese')} ${cm(B)}×${cm(L)}${fname ? ' ' + fname : ''}`,
    L, B, fuge: standardFuge(kat, L, B), staerke: kat.staerke, material: kat.material, bereich: kat.bereich, katId: kat.id,
    farbe: farbe ? farbe[1] : '#d9d4cc', farbe2: farbe && farbe[2] ? farbe[2] : '', farbname: fname,
    textur: farbe && farbe[3] ? farbe[3] : kat.textur || 'uni', oberflaeche: kat.oberflaeche || (kat.bereich === 'wand' ? 'glaenzend' : 'matt'),
    rutsch: kat.rutsch || (kat.bereich === 'boden' ? 'R10' : ''), frost: !!kat.frost, verband: kat.verband,
    fugeFarbe: /schwarz|anthrazit|Nero|Schiefer|dunkel/.test(fname) ? '#55595e' : /Eiche|Nuss|Terracotta|Travertin|beige|sand|creme/.test(fname) ? '#b9b19f' : '#9a9ea2',
    quelle: 'katalog'
  }, extra);
}

/** Felder, die eine Fliese ausmachen (werden beim Zuweisen übernommen) */
export const FLIESEN_FELDER = ['name', 'hersteller', 'serie', 'artikel', 'artNr', 'L', 'B', 'fuge', 'staerke', 'farbe', 'farbe2', 'farbname', 'fugeFarbe', 'fugeMaterial', 'textur', 'bildData', 'quelle', 'material', 'rutsch', 'verdraengung', 'abrieb', 'oberflaeche', 'rektifiziert', 'frost', 'preisM2', 'paketM2', 'stkPaket', 'lvPos', 'libId', 'katId', 'bereich', 'link', 'matte'];

/* ───────── LV-Text ohne KI auslesen ───────── */
const NUM = (s) => { s = String(s).trim(); if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.'); else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, ''); return parseFloat(s); };
/** Bereich einer Position aus dem Text erkennen */
export function bereichAus(t) {
  const s = t.toLowerCase();
  if (/kehlsockel|sockel(fliese|leiste|platte)?\b|sockel\s*h|sockelhöhe/.test(s)) return 'sockel';
  if (/vorwand|installationswand|vormauerung|schacht/.test(s)) return 'vorwand';
  if (/treppe|stufe|setzstufe|trittstufe/.test(s)) return 'treppe';
  if (/dusch(boden|fläche|platz|tasse)|bodengleich/.test(s)) return 'dusche';
  if (/wand(fliese|belag|bekleidung|fläche)|wände|fliesenspiegel|fliesenschild|wandflies/.test(s)) return 'wand';
  if (/boden(fliese|belag|platte|fläche)|bodenflies|fußboden|fussboden|belag boden/.test(s)) return 'boden';
  if (/terrasse|balkon|außen|aussen/.test(s)) return 'aussen';
  if (/mosaik/.test(s) && /wand/.test(s)) return 'wand';
  return '';
}
/** Fliesenpositionen aus eingefügtem LV-Text (GAEB als Text, PDF kopiert) */
export function lvTextAuslesen(text) {
  const out = [];
  const zeilen = String(text || '').replace(/\r/g, '').split('\n');
  // in Positionen gliedern: neue Position bei „01.02.0030“ o. ä. am Zeilenanfang
  const bl = []; let cur = null;
  for (const z of zeilen) {
    const m = z.match(/^\s*((?:\d{1,3}\.){1,4}\d{1,5})\b\.?\s*(.*)$/);
    if (m) { cur = { pos: m[1], txt: m[2] }; bl.push(cur); } else if (cur) cur.txt += '\n' + z; else { cur = { pos: '', txt: z }; bl.push(cur); }
  }
  for (const b of bl) {
    const t = b.txt.replace(/\s+/g, ' ').trim(); if (!t) continue;
    if (!/fliese|platte|mosaik|feinsteinzeug|steingut|naturstein|klinker|spaltplatte|sockel|cotto|riemchen|belag/i.test(t)) continue;
    const fm = t.match(/(\d{1,3}(?:[,.]\d{1,2})?)\s*(?:cm|mm)?\s*[x×\/]\s*(\d{1,3}(?:[,.]\d{1,2})?)\s*(cm|mm)?/i);
    let L = 0, B = 0;
    if (fm) { let a = NUM(fm[1]), c = NUM(fm[2]); const mm = /mm/i.test(fm[3] || '') || (a > 150 && c > 150); if (!mm) { a *= 10; c *= 10; } L = Math.round(Math.max(a, c)); B = Math.round(Math.min(a, c)); }
    const bereich = bereichAus(t);
    if (!L && bereich !== 'sockel') continue;
    const feld = (re) => { const m = t.match(re); return m ? m[1].trim().replace(/[,;.]$/, '') : ''; };
    const fuge = feld(/fugen(?:breite)?\s*(?:ca\.?\s*)?(\d+(?:[,.]\d)?)\s*mm/i);
    const hoehe = feld(/(?:h\s*=|höhe\s*(?:ca\.?)?)\s*(\d+(?:[,.]\d)?)\s*cm/i);
    const menge = t.match(/(\d{1,3}(?:\.\d{3})*(?:,\d{1,3})?|\d+(?:\.\d{1,3})?)\s*(m²|m2|qm|lfm|lfdm|m|stk|stck|st)(?=[\s,;.)]|$)/i);
    const hersteller = feld(/(?:fabrikat|hersteller|marke)\s*[:=]?\s*([A-ZÄÖÜ][\w&.\- ]{1,30}?)(?=[,;]| serie| typ| farbe| format|$)/i);
    const serie = feld(/(?:serie|typ|produkt|programm)\s*[:=]?\s*([\w\-. ]{2,30}?)(?=[,;]| farbe| format| oberfläche| \d|$)/i);
    let farbe = feld(/farbe\s*[:=]?\s*([\wäöüß\- ]{2,25}?)(?=[,;.]| oberfläche| format| fuge| \d|$)/i);
    if (!farbe) { const tl = t.toLowerCase(); const hit = FARBEN.map(f => f[0]).filter(n => tl.includes(n.toLowerCase())).sort((a, b) => b.length - a.length)[0]; if (hit) farbe = hit; else { const m2 = tl.match(/\b(weiß|weiss|schwarz|anthrazit|grau|hellgrau|beige|creme|sand)\b/); if (m2) farbe = m2[1]; } }
    const rutsch = (t.match(/\bR\s?(9|10|11|12|13)\b/) || [])[0];
    const barfuss = (t.match(/\b(?:bewertungsgruppe|gruppe|klasse)\s*([ABC])\b/i) || [])[1];
    const mat = /feinsteinzeug/i.test(t) ? 'feinsteinzeug' : /steingut/i.test(t) ? 'steingut' : /glasmosaik/i.test(t) ? 'glasmosaik' : /mosaik/i.test(t) ? 'mosaik' : /naturstein|granit|marmor|travertin|schiefer|kalkstein/i.test(t) ? 'naturstein' : /spaltplatte/i.test(t) ? 'spaltplatte' : /klinker|riemchen/i.test(t) ? 'klinker' : /cotto/i.test(t) ? 'cotto' : '';
    const ober = /poliert/i.test(t) ? 'poliert' : /lappato|halbpoliert/i.test(t) ? 'lappato' : /glänzend|glasiert glänzend/i.test(t) ? 'glaenzend' : /matt/i.test(t) ? 'matt' : /struktur/i.test(t) ? 'strukturiert' : '';
    let textur = /holz/i.test(t) ? 'holz' : /beton|zement/i.test(t) ? 'beton' : /marmor/i.test(t) ? 'marmor' : /travertin|naturstein/i.test(t) ? 'naturstein' : /terrazzo/i.test(t) ? 'terrazzo' : /schiefer/i.test(t) ? 'schiefer' : mat === 'steingut' ? 'glanz' : 'uni';
    const fHex = farbeHex(farbe);
    if (bereich === 'sockel' && !L) { const hh = hoehe ? NUM(hoehe) * 10 : 80; L = 600; B = Math.round(hh); }
    const kurz = t.split(/[,;]|\.\s/)[0].replace(/\s\d.*$/, '').trim().slice(0, 60);
    out.push({
      pos: b.pos, name: [bereich ? ZIEL_KURZ[bereich] : '', serie || kurz, farbe].filter(Boolean).join(' – ').slice(0, 80) || 'Fliese aus LV',
      hersteller, serie, L, B, fuge: fuge ? NUM(fuge) : (mat === 'mosaik' || mat === 'glasmosaik' || mat === 'steingut' || bereich === 'wand' ? 2 : Math.max(L, B) >= 600 ? 3 : 2),
      farbe: fHex || '#d9d4cc', farbname: farbe, textur, material: mat, oberflaeche: ober, rutsch: rutsch ? rutsch.replace(/\s/, '') + (barfuss ? '/' + barfuss.toUpperCase() : '') : (barfuss || ''),
      bereich, sockelH: bereich === 'sockel' ? B : 0, menge: menge ? NUM(menge[1]) : 0, einheit: menge ? menge[2].replace('m2', 'm²').replace('qm', 'm²') : '', lvText: t.slice(0, 600), quelle: 'lv'
    });
  }
  return out;
}
const ZIEL_KURZ = { boden: 'Boden', wand: 'Wand', sockel: 'Sockel', vorwand: 'Vorwand', treppe: 'Treppe', dusche: 'Dusche', aussen: 'Außen' };
export function farbeHex(name) {
  if (!name) return '';
  const n = name.toLowerCase();
  const hit = FARBEN.find(f => n.includes(f[0].toLowerCase())) || FARBEN.find(f => f[0].toLowerCase().split(' ').some(w => w.length > 3 && n.includes(w)));
  if (hit) return hit[1];
  if (/weiß|weiss/.test(n)) return '#f2f2ef'; if (/grau/.test(n)) return '#a9adb1'; if (/schwarz/.test(n)) return '#2b2d30'; if (/beige|sand/.test(n)) return '#ddd0b8'; if (/braun/.test(n)) return '#7a573d'; if (/blau/.test(n)) return '#3f7fb5'; if (/grün/.test(n)) return '#6f9b6d';
  return '';
}

/** Passt eine LV-/Bibliotheksfliese zu einem Raum? (Raumname in Position) */
export function raumPasst(t, raumName) {
  if (!raumName || !t) return false;
  const txt = `${t.name || ''} ${t.lvText || ''} ${t.raum || ''}`.toLowerCase();
  return raumName.toLowerCase().split(/[\s\-/,.]+/).filter(w => w.length >= 2 && !/^\d+$/.test(w)).some(w => new RegExp('(^|[^a-zäöüß])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-zäöüß]|$)').test(txt));
}
