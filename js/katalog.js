// TW-CAD – Bauteil-Katalog: Türen (DIN 18100/18101), Fenster, Farben, Treppenformen
// Quellen Türmaße: DIN 18100 (Wandöffnungen) / DIN 18101 (Türblätter, Zargen) – Werte wie in den
// Hersteller-Maßtabellen (z. B. Westag Stahlzarge SZ): Nennmaß Wandöffnung = Baurichtmaß + 10 mm (Breite) / + 5 mm (Höhe).

/* ───────── Türen ───────── */
// Breiten einflügelig: Wandöffnung (Rohbau) → Baurichtmaß, Türblatt gefälzt / stumpf, Zargenfalzmaß, Zargendurchgang (ca.)
export const TUER_BREITEN_1 = [
  { rb: 635, br: 625, blatt: 610, stumpf: 584, falz: 591, licht: 561 },
  { rb: 760, br: 750, blatt: 735, stumpf: 709, falz: 716, licht: 686 },
  { rb: 885, br: 875, blatt: 860, stumpf: 834, falz: 841, licht: 811 },
  { rb: 1010, br: 1000, blatt: 985, stumpf: 959, falz: 966, licht: 936 },
  { rb: 1135, br: 1125, blatt: 1110, stumpf: 1084, falz: 1091, licht: 1061 },
  { rb: 1260, br: 1250, blatt: 1235, stumpf: 1209, falz: 1216, licht: 1186 }
];
// Breiten zweiflügelig: Gehflügel (Normflügel) + Standflügel
export const TUER_BREITEN_2 = [
  [1260, 1250, 610, 635], [1385, 1375, 735, 635], [1510, 1500, 735, 760], [1635, 1625, 860, 760], [1760, 1750, 860, 885], [1885, 1875, 985, 885],
  [2010, 2000, 985, 1010], [2135, 2125, 1110, 1010], [2260, 2250, 1110, 1135], [2385, 2375, 1235, 1135], [2510, 2500, 1235, 1260]
].map(([rb, br, geh, stand]) => ({ rb, br, geh, stand, falz: rb - 44, licht: rb - 74 }));
// Höhen: Wandöffnung ab OK Fertigfußboden → Baurichtmaß, Türblatt gefälzt / stumpf, Zargenfalz, Durchgang (ca.)
export const TUER_HOEHEN = [
  { rb: 1880, br: 1875, blatt: 1860, stumpf: 1847, falz: 1858, licht: 1843, info: 'niedrig (Keller/Abstellraum)' },
  { rb: 2005, br: 2000, blatt: 1985, stumpf: 1972, falz: 1983, licht: 1968, info: 'DIN Standard' },
  { rb: 2130, br: 2125, blatt: 2110, stumpf: 2097, falz: 2108, licht: 2093, info: 'DIN Standard (Neubau üblich)' },
  { rb: 2255, br: 2250, blatt: 2235, stumpf: 2222, falz: 2233, licht: 2218, info: 'DIN Überhöhe' },
  { rb: 2380, br: 2375, blatt: 2360, stumpf: 2347, falz: 2358, licht: 2343, info: 'Sonderhöhe (nicht DIN)' },
  { rb: 2505, br: 2500, blatt: 2485, stumpf: 2472, falz: 2483, licht: 2468, info: 'Sonderhöhe raumhoch (nicht DIN)' }
];
export const HAUSTUER_BREITEN = [1010, 1100, 1135, 1200, 1260, 1385, 1510, 1760, 2010, 2260];
export const HAUSTUER_HOEHEN = [2010, 2100, 2130, 2185, 2200, 2255, 2385, 2510];
export const GARAGENTOR_BREITEN = [2375, 2500, 2750, 3000, 4000, 5000, 5500];
export const GARAGENTOR_HOEHEN = [1875, 2000, 2125, 2250, 2500];

export const TUER_ARTEN = [
  ['dreh1', 'Drehtür einflügelig'], ['dreh2', 'Drehtür zweiflügelig (Geh- + Standflügel)'], ['dreh2sym', 'Drehtür zweiflügelig symmetrisch'],
  ['pendel', 'Pendeltür (schwingt beidseitig)'], ['schiebe_vor', 'Schiebetür vor der Wand'], ['schiebe_in', 'Schiebetür in der Wand (Wandtasche)'], ['schiebe2', 'Doppel-Schiebetür in der Wand'],
  ['falt', 'Falttür'], ['haustuer', 'Haustür'], ['haustuer_st', 'Haustür mit Seitenteil'], ['nebeneingang', 'Nebeneingangstür'], ['garagentor', 'Garagentor (Sektional)'], ['brandschutz', 'Brandschutz-/Rauchschutztür']
];
export const ZARGEN = [['umfassung', 'Umfassungszarge (Holz)'], ['stahl', 'Stahlzarge'], ['block', 'Blockzarge / Blockrahmen'], ['eck', 'Eckzarge'], ['flaechenbuendig', 'flächenbündig (verdeckt)'], ['ohne', 'ohne Zarge']];
export const TUER_BLATT = [['glatt', 'glatt'], ['lisenen', 'mit Rillen / Lisenen'], ['glasausschnitt', 'mit Glasausschnitt'], ['ganzglas', 'Ganzglastür'], ['kassette', 'Kassette / Landhaus'], ['stil', 'Stiltür']];
export const TUER_OBERFLAECHE = [
  ['#f4f3ee', 'Weißlack RAL 9010'], ['#f6f6f4', 'Weiß RAL 9016'], ['#ece6d6', 'Cremeweiß RAL 9001'], ['#d9c3a0', 'CPL Eiche hell'], ['#b98f5e', 'Eiche natur'], ['#8a6a4f', 'Eiche geräuchert'],
  ['#6b4a35', 'Nussbaum'], ['#c9b48f', 'Esche weiß'], ['#bfc1c2', 'Lichtgrau RAL 7035'], ['#8f9496', 'Grau RAL 7040'], ['#383e42', 'Anthrazit RAL 7016'], ['#202124', 'Schwarz RAL 9005'], ['#b5b8b9', 'Edelstahl-Optik']
];
export const BRANDSCHUTZ = [['', '–'], ['T30', 'T30 (EI2 30)'], ['T30-RS', 'T30-RS'], ['RS', 'RS Rauchschutz'], ['T60', 'T60'], ['T90', 'T90'], ['EW', 'Einbruchhemmend RC2/RC3']];
export const SCHWELLEN = [['ohne', 'ohne Schwelle'], ['flach', 'Schwelle bis 2 cm (barrierefrei)'], ['mit', 'mit Schwelle'], ['absenk', 'automatische Absenkdichtung']];

export function tuerInfo(width, height, art) {
  const zw = art && art.startsWith('dreh2') || art === 'schiebe2';
  const b = zw ? TUER_BREITEN_2.find(x => x.rb === width) : TUER_BREITEN_1.find(x => x.rb === width);
  const hh = TUER_HOEHEN.find(x => x.rb === height);
  const r = [];
  if (b && !zw) r.push(['Türblatt (gefälzt)', `${b.blatt} × ${hh ? hh.blatt : height - 20} mm`], ['Zargenfalzmaß', `${b.falz} × ${hh ? hh.falz : height - 22} mm`], ['Durchgang ca.', `${b.licht} × ${hh ? hh.licht : height - 37} mm`], ['Baurichtmaß', `${b.br} × ${hh ? hh.br : height - 5} mm`]);
  else if (b && zw) r.push(['Gehflügel / Standflügel', `${b.geh} / ${b.stand} mm`], ['Zargenfalzmaß', `${b.falz} × ${hh ? hh.falz : height - 22} mm`], ['Durchgang ca.', `${b.licht} × ${hh ? hh.licht : height - 37} mm`]);
  else r.push(['Hinweis', 'Sondermaß – kein DIN-Türblatt']);
  return r;
}
export const tuerBreitenListe = (art) => {
  if (art === 'garagentor') return GARAGENTOR_BREITEN.map(v => [v, `${(v / 10).toString().replace('.', ',')}`]);
  if (art === 'haustuer' || art === 'haustuer_st' || art === 'nebeneingang') return HAUSTUER_BREITEN.map(v => [v, `${(v / 10).toString().replace('.', ',')}`]);
  if (art && (art.startsWith('dreh2') || art === 'schiebe2')) return TUER_BREITEN_2.map(b => [b.rb, `${String(b.rb / 10).replace('.', ',')} (Flügel ${b.geh}+${b.stand})`]);
  return TUER_BREITEN_1.map(b => [b.rb, `${String(b.rb / 10).replace('.', ',')} (Blatt ${b.blatt})`]);
};
export const tuerHoehenListe = (art) => {
  if (art === 'garagentor') return GARAGENTOR_HOEHEN.map(v => [v, String(v / 10).replace('.', ',')]);
  if (art === 'haustuer' || art === 'haustuer_st' || art === 'nebeneingang') return HAUSTUER_HOEHEN.map(v => [v, String(v / 10).replace('.', ',')]);
  return TUER_HOEHEN.map(x => [x.rb, `${String(x.rb / 10).replace('.', ',')} (${x.info})`]);
};

/* ───────── Fenster ───────── */
export const FENSTER_TYPEN = [
  ['dk1', 'Dreh-Kipp einflügelig'], ['dk2', 'zweiflügelig mit Stulp (ohne Mittelpfosten)'], ['dk2p', 'zweiflügelig mit Mittelpfosten'], ['dk3', 'dreiteilig'],
  ['fest', 'Festverglasung'], ['kipp', 'Kippfenster / Oberlicht'], ['fenstertuer', 'Fenstertür / Balkontür (bodentief)'], ['fenstertuer2', 'Fenstertür zweiflügelig'],
  ['hs', 'Hebe-Schiebetür (HST)'], ['psk', 'Parallel-Schiebe-Kipptür (PSK)'], ['schiebe', 'Schiebefenster'], ['rundbogen', 'Rundbogenfenster'], ['segmentbogen', 'Segmentbogenfenster'],
  ['rund', 'Rundfenster / Bullauge'], ['dreieck', 'Dreieck- / Giebelfenster'], ['keller', 'Kellerfenster'], ['bandfenster', 'Fensterband (mehrteilig)']
];
export const FENSTER_BREITEN = [385, 510, 635, 760, 885, 1010, 1135, 1260, 1385, 1510, 1635, 1760, 2010, 2260, 2510, 3010, 3510, 4010];
export const FENSTER_HOEHEN = [385, 510, 635, 760, 885, 1010, 1135, 1260, 1385, 1510, 1635, 1760, 2010, 2135, 2260, 2385, 2510];
export const BRUESTUNGEN = [[0, '0 – bodentief'], [450, '45'], [600, '60'], [750, '75'], [875, '87,5 (Standard Wohnraum)'], [900, '90'], [1000, '100'], [1100, '110'], [1250, '125 (Bad/Küche)'], [1400, '140'], [1500, '150 (Keller/WC)'], [1750, '175']];
export const FENSTER_VORLAGEN = [
  { id: 'wohn1', name: 'Wohnraum 1-flg 101 × 138,5 · BRH 87,5', typ: 'dk1', w: 1010, h: 1385, brh: 875 },
  { id: 'wohn2', name: 'Wohnraum 2-flg 126 × 138,5 · BRH 87,5', typ: 'dk2', w: 1260, h: 1385, brh: 875 },
  { id: 'wohn3', name: 'Wohnraum 2-flg 151 × 138,5 · BRH 87,5', typ: 'dk2', w: 1510, h: 1385, brh: 875 },
  { id: 'kueche', name: 'Küche 101 × 113,5 · BRH 112,5', typ: 'dk1', w: 1010, h: 1135, brh: 1125 },
  { id: 'bad', name: 'Bad 88,5 × 101 · BRH 125 (Ornamentglas)', typ: 'dk1', w: 885, h: 1010, brh: 1250, glas: 'ornament' },
  { id: 'wc', name: 'Gäste-WC 51 × 76 · BRH 150', typ: 'kipp', w: 510, h: 760, brh: 1500, glas: 'ornament' },
  { id: 'treppe', name: 'Treppenhaus 63,5 × 138,5', typ: 'dk1', w: 635, h: 1385, brh: 875 },
  { id: 'keller', name: 'Kellerfenster 76 × 51 · BRH 150', typ: 'keller', w: 760, h: 510, brh: 1500 },
  { id: 'ft1', name: 'Fenstertür 88,5 × 213,5', typ: 'fenstertuer', w: 885, h: 2135, brh: 0 },
  { id: 'ft2', name: 'Fenstertür 2-flg 151 × 213,5', typ: 'fenstertuer2', w: 1510, h: 2135, brh: 0 },
  { id: 'hs3', name: 'Hebe-Schiebetür 301 × 213,5', typ: 'hs', w: 3010, h: 2135, brh: 0 },
  { id: 'hs4', name: 'Hebe-Schiebetür 401 × 226', typ: 'hs', w: 4010, h: 2260, brh: 0 },
  { id: 'giebel', name: 'Giebel-Rundbogen 101 × 151', typ: 'rundbogen', w: 1010, h: 1510, brh: 875 },
  { id: 'rund', name: 'Rundfenster Ø 76', typ: 'rund', w: 760, h: 760, brh: 1250 }
];
export const SPROSSEN_ART = [['keine', 'keine Sprossen'], ['aufgesetzt', 'Wiener Sprosse (aufgesetzt)'], ['innen', 'Sprosse im Glas (innenliegend)'], ['echt', 'glasteilende Sprosse']];
export const SPROSSEN_BILD = [['kreuz', 'Kreuz (4 Felder je Flügel)'], ['2x3', '2 × 3 Felder'], ['3x3', '3 × 3 Felder'], ['2x4', '2 × 4 Felder'], ['quer1', '1 Quersprosse'], ['quer2', '2 Quersprossen'], ['senk1', '1 senkrechte Sprosse'], ['oben', 'nur oberes Drittel']];
export const FENSTER_MATERIAL = [['kunststoff', 'Kunststoff'], ['holz', 'Holz'], ['holzalu', 'Holz-Aluminium'], ['alu', 'Aluminium'], ['kunststoffalu', 'Kunststoff-Aluminium'], ['stahl', 'Stahl (Industrieoptik)']];
export const FENSTER_FARBEN = [
  ['#f6f6f4', 'Weiß RAL 9016'], ['#ece6d6', 'Cremeweiß RAL 9001'], ['#383e42', 'Anthrazitgrau RAL 7016'], ['#4d5357', 'Basaltgrau RAL 7012'], ['#6c6e6b', 'Quarzgrau RAL 7039'],
  ['#474a50', 'Schiefergrau RAL 7015'], ['#c5c7c4', 'Lichtgrau RAL 7035'], ['#8a9597', 'Silbergrau RAL 7001'], ['#b0b0a9', 'Achatgrau RAL 7038'], ['#3b3f3c', 'DB 703 Eisenglimmer'],
  ['#0f0f10', 'Tiefschwarz RAL 9005'], ['#4c3a2c', 'Sepiabraun RAL 8014'], ['#45322e', 'Schokobraun RAL 8017'], ['#2d4a3a', 'Moosgrün RAL 6005'], ['#26392f', 'Tannengrün RAL 6009'],
  ['#6d2a2b', 'Weinrot RAL 3005'], ['#22427a', 'Ultramarinblau RAL 5002'], ['#a8753d', 'Golden Oak (Dekor)'], ['#5a3c28', 'Nussbaum (Dekor)'], ['#7b3a26', 'Mahagoni (Dekor)'],
  ['#8c6239', 'Winchester (Dekor)'], ['#b88a55', 'Eiche natur (Dekor)'], ['#a46d47', 'Douglasie (Dekor)'], ['#c9a46a', 'Kiefer natur (Holz)'], ['#9c6b3c', 'Lärche (Holz)']
];
export const GLAS = [['2fach', '2-fach Isolierglas'], ['3fach', '3-fach Wärmeschutzglas'], ['ornament', 'Ornamentglas (Sichtschutz, z. B. Bad)'], ['satiniert', 'satiniert / Milchglas'], ['vsg', 'Sicherheitsglas VSG/ESG'], ['schall', 'Schallschutzglas'], ['sonnen', 'Sonnenschutzglas']];
export const SONNENSCHUTZ = [['ohne', 'ohne'], ['rl_aufsatz', 'Rollladen (Aufsatzkasten)'], ['rl_vorbau', 'Rollladen (Vorbaukasten)'], ['raffstore', 'Raffstore / Jalousie außen'], ['klappladen', 'Klappläden'], ['schiebeladen', 'Schiebeläden'], ['markise', 'Fenstermarkise']];
export const FENSTERBANK_AUSSEN = [['alu', 'Aluminium'], ['naturstein', 'Naturstein'], ['klinker', 'Klinker-Rollschicht'], ['beton', 'Betonwerkstein'], ['ohne', 'ohne']];
export const FENSTERBANK_INNEN = [['naturstein', 'Naturstein'], ['holz', 'Holz'], ['fliesen', 'gefliest'], ['kunststein', 'Kunststein / Werzalit'], ['ohne', 'ohne (Laibung verputzt)']];
export const AUFTEILUNG = [['ohne', 'ohne'], ['oberlicht', 'mit Oberlicht'], ['unterlicht', 'mit Unterlicht'], ['beides', 'Ober- und Unterlicht']];

/** Flügelzahl eines Fenstertyps */
export function fluegel(typ, width) {
  if (['dk2', 'dk2p', 'fenstertuer2'].includes(typ)) return 2;
  if (typ === 'dk3') return 3;
  if (typ === 'hs' || typ === 'psk' || typ === 'schiebe') return 2;
  if (typ === 'bandfenster') return Math.max(2, Math.round(width / 900));
  return 1;
}
export const istBodentief = (typ) => ['fenstertuer', 'fenstertuer2', 'hs', 'psk'].includes(typ);

/* ───────── Treppen ───────── */
export const TREPPEN_FORMEN = [
  ['gerade', 'gerade (einläufig)'], ['viertel_u', 'viertelgewendelt – Wendelung unten'], ['viertel_o', 'viertelgewendelt – Wendelung oben'],
  ['halb', 'halbgewendelt (180°)'], ['zweiviertel', 'zweimal viertelgewendelt (U-Form)'], ['podest_l', 'gewinkelt mit Viertelpodest (L-Form)'], ['podest_u', 'gegenläufig mit Halbpodest (U-Form)'],
  ['podest_gerade', 'gerade mit Zwischenpodest'], ['spindel', 'Spindeltreppe (rund, mit Spindel)'], ['wendel', 'Wendeltreppe (mit Treppenauge)']
];
export const TREPPEN_MATERIAL = [['beton', 'Beton (Rohbau)'], ['fliesen', 'Fliesen / Feinsteinzeug'], ['naturstein', 'Naturstein'], ['holz', 'Holz (Eiche)'], ['stahl', 'Stahl-Wangentreppe'], ['teppich', 'Teppich']];
export const TREPPEN_FARBE = { beton: '#a9a59c', fliesen: '#c9c4ba', naturstein: '#b8b2a6', holz: '#b07e4f', stahl: '#5d6166', teppich: '#7b6f66' };
export const LAUFBREITEN = [[800, '80 (Mindestmaß Wohnhaus, DIN 18065)'], [900, '90'], [1000, '100 (Standard)'], [1100, '110'], [1200, '120'], [1250, '125 (öffentlich)'], [1500, '150']];
