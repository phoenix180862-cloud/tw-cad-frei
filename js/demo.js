// TW-CAD – Beispielprojekt (Einfamilienhaus mit Bad-Fliesenplanung, Lageplan, Dach)
import { newProject, uid } from './model.js?v=20261028-0429';
import { rectWalls } from './edit.js?v=20261028-0429';
import { defaultTileCfg } from './tiles.js?v=20261028-0429';
import { FREI } from './frei.js?v=20261028-0429';
import { HEIMAT } from './firma.js?v=20261028-0429';
import { t } from './i18n.js?v=20261028-0429';

export function demoProject() {
  const p = newProject(t('Beispiel: Einfamilienhaus'));
  p.meta.bauvorhaben = t('Neubau Einfamilienhaus (Beispiel)'); p.meta.bauherr = t('Mustermann'); p.meta.ort = FREI || !HEIMAT.ort ? t('Musterstadt') : HEIMAT.ort; p.meta.planNr = 'F-01';
  const eg = p.storeys[0]; eg.height = 2875; eg.roomHeight = 2600;
  const og = { id: uid('g'), name: t('OG'), elevation: 2875, height: 2750, slab: 200, roomHeight: 2500 };
  p.storeys.push(og);
  const add = (e) => { e.id = e.id || uid(e.type[0]); p.elements.push(e); return e; };
  const wall = (st, a, b, t, art = 'innen', extra = {}) => add({ type: 'wall', storey: st, layer: 'L_konstr', a, b, thickness: t, height: null, art, material: 'mauerwerk', facade: art === 'aussen' ? 'putz-scheibenputz' : null, facadeColor: art === 'aussen' ? '#F2F1EC' : null, ...extra });
  const outer = rectWalls({ x: 0, y: 0 }, { x: 10490, y: 8990 }, 365, 'aussen').map(([a, b]) => wall(eg.id, a, b, 365, 'aussen', { sockel: 'putz-scheibenputz', sockelColor: '#4A4D4F', sockelH: 400 }));
  const [Wu, Wr, Wo, Wl] = outer;
  const W1 = wall(eg.id, { x: 4500, y: 365 }, { x: 4500, y: 8625 }, 240);
  wall(eg.id, { x: 365, y: 3500 }, { x: 4380, y: 3500 }, 115);
  wall(eg.id, { x: 365, y: 6200 }, { x: 4380, y: 6200 }, 115);
  const W4 = wall(eg.id, { x: 7000, y: 3620 }, { x: 7000, y: 8625 }, 115);
  const W5 = wall(eg.id, { x: 4620, y: 3500 }, { x: 10125, y: 3500 }, 240);
  const op = (w, pos, kind, width, height, sill, side = 1, hinge = 'links', extra = {}) => add({ type: 'opening', storey: w.storey, layer: 'L_konstr', wall: w.id, pos, kind, width, height, sill, side, hinge, ...extra });
  op(W1, 4435, 'door', 885, 2135, 0, 1); op(W1, 1635, 'door', 1010, 2135, 0, -1); op(W1, 7035, 'door', 885, 2135, 0, -1, 'rechts');
  op(W5, 1300, 'door', 1010, 2135, 0, -1); op(W4, 1500, 'door', 885, 2135, 0, -1);
  op(Wo, 4507.5, 'door', 1135, 2260, 0, -1, 'links', { stil: 'tuer-hoermann-700b', stilColor: '#383E42', aussen: 'R' });
  const win = (w, pos, width, height, sill, extra = {}) => op(w, pos, 'window', width, height, sill, 1, 'links', { aussen: 'R', stil: 'fenster-kst-7016-aussen', stilColor: '#383E42', ...extra });
  win(Wu, 2117.5, 1260, 1385, 875); win(Wu, 6317.5, 2010, 2135, 125, { teilung: '2' }); win(Wu, 8617.5, 1260, 2135, 125);
  win(Wr, 1817.5, 1010, 1385, 875); win(Wr, 5817.5, 1260, 1385, 875);
  win(Wo, 1707.5, 1260, 1385, 875); win(Wo, 7907.5, 1260, 1385, 875);
  win(Wl, 3957.5, 1010, 760, 1500); win(Wl, 1407.5, 1260, 1385, 875);
  // Räume
  const room = (st, seed, nr, name, tiles = null) => add({ type: 'room', storey: st, layer: 'L_konstr', seed, poly: null, nr, name, showDims: false, tiles });
  room(eg.id, { x: 2000, y: 2000 }, '01', t('Küche'), { boden: defaultTileCfg({ aktiv: true, name: t('Feinsteinzeug Beton'), L: 600, B: 600, fuge: 3, verband: 'kreuz', farbe: '#b9b6b0', textur: 'beton', originMode: 'optimal' }) });
  const bad = room(eg.id, { x: 2000, y: 4800 }, '02', t('Bad'), {
    boden: defaultTileCfg({ aktiv: true, name: t('Feinsteinzeug Grau'), L: 600, B: 300, fuge: 3, verband: 'drittel', farbe: '#c9c4bb', textur: 'beton', originMode: 'optimal' }),
    wand: defaultTileCfg({ aktiv: true, name: t('Wandfliese Weiß glänzend'), L: 600, B: 300, fuge: 2, verband: 'kreuz', farbe: '#f3f1ec', textur: 'glanz', hoehe: 2100, xModus: 'boden', yModus: 'unten' })
  });
  room(eg.id, { x: 2000, y: 7400 }, '03', t('Schlafen'));
  room(eg.id, { x: 7000, y: 2000 }, '04', t('Wohnen / Essen'), { boden: defaultTileCfg({ aktiv: true, name: t('Holzoptik Eiche'), L: 1200, B: 200, fuge: 2, verband: 'wild', farbe: '#b08a5e', textur: 'holz', originMode: 'optimal' }) });
  room(eg.id, { x: 5800, y: 6000 }, '05', t('Flur'), { boden: defaultTileCfg({ aktiv: true, name: t('Feinsteinzeug Grau'), L: 600, B: 300, fuge: 3, verband: 'drittel', farbe: '#c9c4bb', textur: 'beton', originMode: 'optimal' }) });
  room(eg.id, { x: 8500, y: 6000 }, '06', t('Arbeiten'));
  // Sanitär im Bad (Bad: x 365..4380, y 3557..6142)
  add({ type: 'symbol', storey: eg.id, layer: 'L_moebel', kind: 'wc', p: { x: 800, y: 3557 + 270 }, w: 360, d: 540, rot: 0 });
  add({ type: 'symbol', storey: eg.id, layer: 'L_moebel', kind: 'waschtisch', p: { x: 2000, y: 3557 + 240 }, w: 800, d: 480, rot: 0 });
  add({ type: 'symbol', storey: eg.id, layer: 'L_moebel', kind: 'dusche', p: { x: 3880, y: 6142 - 500 }, w: 1000, d: 1000, rot: 0 });
  add({ type: 'symbol', storey: eg.id, layer: 'L_moebel', kind: 'wanne', p: { x: 365 + 375, y: 5200 }, w: 1700, d: 750, rot: 90, aussparen: true });
  // OG
  rectWalls({ x: 0, y: 0 }, { x: 10490, y: 8990 }, 365, 'aussen').forEach(([a, b]) => wall(og.id, a, b, 365, 'aussen'));
  wall(og.id, { x: 4500, y: 365 }, { x: 4500, y: 8625 }, 175);
  room(og.id, { x: 2000, y: 4000 }, '11', t('Kind 1')); room(og.id, { x: 7000, y: 4000 }, '12', t('Kind 2'));
  const ogw = p.elements.filter(e => e.type === 'wall' && e.storey === og.id && e.art === 'aussen');
  win(ogw[0], 2117.5, 1260, 1385, 875); win(ogw[0], 7317.5, 1260, 1385, 875); win(ogw[2], 2307.5, 1260, 1385, 875); win(ogw[2], 7907.5, 1260, 1385, 875);
  p.roofs.push({ id: uid('r'), storey: og.id, typ: 'sattel', neigung: 38, ueberstand: 500, kniestock: 0, richtung: 'auto', material: 'dach-braas-rubin13v', farbe: '#3A3B3D' });
  // Bemaßung außen
  add({ type: 'dim', storey: eg.id, layer: 'L_mass', pts: [{ x: 0, y: 0 }, { x: 10490, y: 0 }], dir: { x: 1, y: 0 }, off: -1600, total: false });
  add({ type: 'dim', storey: eg.id, layer: 'L_mass', pts: [{ x: 0, y: 0 }, { x: 0, y: 8990 }], dir: { x: 0, y: 1 }, off: 1600, total: false });
  add({ type: 'section', storey: null, layer: 'L_mass', a: { x: 3300, y: -1500 }, b: { x: 3300, y: 10500 }, name: 'A', flip: false });
  // Lageplan
  p.site.nnEG = 312.40; p.site.nord = 0;
  p.site.grenze = [{ x: -6000, y: -7000 }, { x: 17000, y: -7000 }, { x: 17500, y: 17000 }, { x: -6500, y: 16500 }];
  const hp = [[-6000, -7000, 311.20], [17000, -7000, 311.05], [17500, 17000, 313.85], [-6500, 16500, 314.10], [5000, -7000, 311.10], [-6000, 5000, 312.60], [17200, 5000, 312.30], [5500, 16800, 314.00], [5000, 4500, 312.25], [12000, 11000, 313.10], [0, 12000, 313.40], [13000, -2500, 311.60]];
  p.site.punkte = hp.map(([x, y, z]) => ({ id: uid('h'), x, y, z }));
  p.site.nachbarn = [{ id: uid('n'), name: t('Nachbarhaus Nr. 12'), hoehe: 8800, dach: 'sattel', poly: [{ x: 22000, y: 0 }, { x: 31000, y: 0 }, { x: 31000, y: 9000 }, { x: 22000, y: 9000 }] }];
  p.settings.massstab = 50;
  return p;
}
