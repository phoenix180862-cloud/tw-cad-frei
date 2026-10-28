// TW-CAD – Grundriss-Darstellung (Bildschirm und PDF über Painter)
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import * as T from './tiles.js?v=20261028-0429';
import { shade } from './painter.js?v=20261028-0429';
import { tilePatternFor } from './textures.js?v=20261028-0429';
import { zeichneSchichten } from './aufbau.js?v=20261028-0429';
import * as K from './katalog.js?v=20261028-0429';
import { treppe } from './treppe.js?v=20261028-0429';

export const PEN = { fein: 0.13, duenn: 0.18, mittel: 0.25, kraeftig: 0.35, dick: 0.5, schnitt: 0.5, extra: 0.7 };
export const STATUS_FARBE = { voll: '#ffffff', schnitt: '#dbeafe', warnung: '#fde68a', kritisch: '#fca5a5' };

/* ───────── Fliesen-Cache ───────── */
const tileCache = new Map();
export function roomRegion(doc, geo, room) {
  const poly = room.poly; if (!poly || poly.length < 3) return null;
  const holes = [];
  for (const s of doc.all('symbol', room.storey)) {
    if (!s.aussparen) continue;
    const fp = symbolFootprint(s); if (fp && G.pointInPoly(G.polyCentroid(fp), poly)) holes.push(fp);
  }
  for (const c of doc.all('column', room.storey)) { const fp = columnPoly(c); if (G.pointInPoly(c.p, poly)) holes.push(fp); }
  if (!holes.length) return { outer: poly, holes: [] };
  const res = G.differenceTree([G.ensureCCW(poly)], holes.map(G.ensureCCW));
  if (!res.length) return null;
  res.sort((a, b) => G.polyArea(b.outer) - G.polyArea(a.outer));
  return { outer: res[0].outer, holes: res[0].holes };
}
export function floorTiles(doc, geo, room) {
  const cfg = room.tiles && room.tiles.boden; if (!cfg || !cfg.aktiv) return null;
  const region = roomRegion(doc, geo, room); if (!region) return null;
  const key = room.id + JSON.stringify(region.outer) + JSON.stringify(region.holes) + JSON.stringify(cfg);
  if (tileCache.has(key)) return tileCache.get(key);
  let res;
  const rd = cfg.rand && cfg.rand.aktiv && cfg.rand.breite > 20 ? cfg.rand : null;
  const inner = rd ? G.offsetPolys([G.ensureCCW(region.outer)], -rd.breite).sort((x, y) => G.polyArea(y) - G.polyArea(x))[0] : null;
  if (rd && inner && inner.length > 2) {
    // Randfries: außen ein Band mit eigener Fliese, innen die Hauptfliese
    const innenRegion = { outer: inner, holes: region.holes.filter(hh => G.pointInPoly(G.polyCentroid(hh), inner)) };
    res = T.planTiles(innenRegion, cfg);
    const band = G.differenceTree([G.ensureCCW(region.outer), ...region.holes.map(G.ensureCW)], [G.ensureCCW(inner)].concat(innenRegion.holes.map(G.ensureCCW)));
    const rc = Object.assign({}, cfg, rd.eigeneFliese === false ? {} : pickTile(rd), { verband: rd.verband || 'kreuz', angle: rd.angle ?? cfg.angle ?? 0, origin: null, originMode: 'ecke', rand: null });
    const bp = [];
    const bandPolys = band.flatMap(it => [G.ensureCCW(it.outer), ...it.holes.map(G.ensureCW)]);
    if (rd.ecken === 'durchlaufend') {
      const bbO = G.bbox(region.outer); const origin = { x: bbO.x0 - rc.fuge / 2, y: bbO.y0 - rc.fuge / 2 };
      for (const it of band) { const r = T.layTiles(it, Object.assign({}, rc, { origin })); r.pieces.forEach(p => { p.zcfg = rc; p.rand = true; }); bp.push(...r.pieces); }
    } else {
      // je Wand ein Streifen, Fliese längs zur Wand, Ecken auf Gehrung
      const P = G.ensureCCW(region.outer); const n = P.length; const bw = rd.breite;
      const innen = P.map((v, i) => { const pr = P[(i - 1 + n) % n], nx = P[(i + 1) % n]; const n1 = G.perp(G.norm(G.sub(v, pr))), n2 = G.perp(G.norm(G.sub(nx, v))); const bi = G.norm(G.add(n1, n2)); const c = Math.max(0.2, G.dot(bi, n1)); return G.add(v, G.mul(bi, bw / c)); });
      for (let i = 0; i < n; i++) {
        const a0 = P[i], b0 = P[(i + 1) % n]; if (G.dist(a0, b0) < 5) continue;
        const u = G.norm(G.sub(b0, a0)), nn = G.perp(u);
        const quad = G.ensureCCW([a0, b0, innen[(i + 1) % n], innen[i]]);
        const teile = G.intersectTree([quad], bandPolys);
        const origin = G.sub(a0, G.mul(G.add(u, nn), rc.fuge / 2));
        const ec = Object.assign({}, rc, { angle: G.deg(Math.atan2(u.y, u.x)), L: Math.max(rc.L, rc.B), B: Math.min(rc.L, rc.B) });
        for (const it of teile) { const r = T.layTiles(it, Object.assign({}, ec, { origin })); r.pieces.forEach(p => { p.zcfg = rc; p.rand = true; }); bp.push(...r.pieces); }
      }
    }
    const st = T.tileStats(bp, { outer: region.outer, holes: [inner] }, rc, rc); st.area = band.reduce((a, it) => a + G.areaWithHoles(it), 0); st.m2 = st.area / 1e6;
    res.rand = { cfg: rc, pieces: bp, stats: st, inner };
    res.pieces = res.pieces.concat(bp);
  } else res = T.planTiles(region, cfg);
  res.region = region;
  if (tileCache.size > 200) tileCache.clear();
  tileCache.set(key, res); return res;
}
const TILE_KEYS = ['name', 'hersteller', 'serie', 'artikel', 'L', 'B', 'fuge', 'farbe', 'farbe2', 'fugeFarbe', 'textur', 'bildData', 'material', 'rutsch', 'oberflaeche', 'preisM2', 'paketM2', 'stkPaket', 'lvPos', 'libId', 'staerke'];
function pickTile(src) { const o = {}; for (const k of TILE_KEYS) if (src[k] !== undefined && src[k] !== null && src[k] !== '') o[k] = src[k]; return o; }
export function wallTiles(key, region, cfg) {
  const k = key + JSON.stringify(region) + JSON.stringify(cfg);
  if (tileCache.has(k)) return tileCache.get(k);
  const res = T.planTiles(region, cfg); res.region = region; tileCache.set(k, res); return res;
}

/* ───────── Hilfen ───────── */
export function columnPoly(c) {
  if (c.round) { const pts = []; for (let i = 0; i < 24; i++) { const a = i / 24 * Math.PI * 2; pts.push({ x: c.p.x + Math.cos(a) * c.w / 2, y: c.p.y + Math.sin(a) * c.w / 2 }); } return pts; }
  const r = G.rad(c.rot || 0); const hw = c.w / 2, hd = (c.d || c.w) / 2;
  return [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]].map(([x, y]) => G.rot({ x: c.p.x + x, y: c.p.y + y }, r, c.p));
}
// Objekt-Bibliothek: kat = Gruppe im Menü, g = gängige Größen [Breite, Tiefe, Bezeichnung]
export const SYMBOL_KATEGORIEN = [['bau', 'Gemauert & Podeste (fliesbar)'], ['wc', 'WC & Urinal'], ['wt', 'Waschtische'], ['dusche', 'Duschen'], ['wanne', 'Badewannen'], ['ablauf', 'Abläufe & Rinnen'], ['bf', 'Barrierefrei (DIN 18040)'], ['inst', 'Installation & Heizung'], ['kueche', 'Küche'], ['gastro', 'Großküche / Gastro'], ['hw', 'Hauswirtschaft'], ['moebel', 'Möbel'], ['aussen', 'Außen']];
export const SYMBOLE = {
  wc: { kat: 'wc', name: 'WC wandhängend', w: 360, d: 540, g: [[355, 490, 'kompakt 49'], [360, 540, 'Standard 54'], [370, 560, 'groß 56']] },
  wcstand: { kat: 'wc', name: 'WC stehend', w: 380, d: 680, aussparen: true, g: [[360, 650, '65'], [380, 680, '68'], [380, 720, '72']] },
  wcdusch: { kat: 'wc', name: 'Dusch-WC', w: 390, d: 580 },
  bidet: { kat: 'wc', name: 'Bidet', w: 360, d: 540 },
  urinal: { kat: 'wc', name: 'Urinal', w: 380, d: 340, g: [[300, 300, 'klein'], [380, 340, 'Standard'], [400, 400, 'groß']] },
  urinaltrennwand: { kat: 'wc', name: 'Urinal-Trennwand', w: 20, d: 450 },
  waschtisch: { kat: 'wt', name: 'Waschtisch', w: 600, d: 480, g: [[500, 400, '50'], [550, 450, '55'], [600, 480, '60'], [650, 500, '65'], [700, 500, '70'], [800, 500, '80'], [900, 500, '90'], [1000, 500, '100']] },
  wtunterschrank: { kat: 'wt', name: 'Waschtisch mit Unterschrank', w: 800, d: 480, aussparen: false, g: [[600, 480, '60'], [800, 480, '80'], [1000, 480, '100'], [1200, 480, '120']] },
  doppelwt: { kat: 'wt', name: 'Doppelwaschtisch', w: 1200, d: 500, g: [[1200, 500, '120'], [1300, 500, '130'], [1400, 500, '140'], [1600, 500, '160'], [1800, 500, '180']] },
  aufsatzwb: { kat: 'wt', name: 'Aufsatzbecken auf Platte', w: 800, d: 500 },
  handwb: { kat: 'wt', name: 'Handwaschbecken', w: 450, d: 350, g: [[400, 300, '40'], [450, 350, '45'], [500, 380, '50']] },
  eckwb: { kat: 'wt', name: 'Eck-Handwaschbecken', w: 450, d: 450 },
  ausguss: { kat: 'wt', name: 'Ausgussbecken', w: 500, d: 350 },
  waschrinne: { kat: 'wt', name: 'Waschrinne (mehrere Plätze)', w: 1800, d: 450, g: [[1200, 450, '2 Plätze'], [1800, 450, '3 Plätze'], [2400, 450, '4 Plätze']] },
  dusche: { kat: 'dusche', name: 'Dusche bodengleich (gefliest)', w: 900, d: 900, g: [[800, 800, '80×80'], [900, 900, '90×90'], [1000, 1000, '100×100'], [1200, 900, '120×90'], [1200, 1200, '120×120'], [1400, 900, '140×90'], [1600, 900, '160×90']] },
  duschtasse: { kat: 'dusche', name: 'Duschtasse / Duschwanne', w: 900, d: 900, aussparen: true, g: [[800, 800, '80×80'], [900, 900, '90×90'], [1000, 800, '100×80'], [1000, 1000, '100×100'], [1200, 800, '120×80'], [1200, 900, '120×90'], [1400, 900, '140×90'], [1600, 900, '160×90']] },
  duschviertel: { kat: 'dusche', name: 'Viertelkreis-Dusche', w: 900, d: 900, aussparen: true, g: [[800, 800, '80'], [900, 900, '90'], [1000, 1000, '100']] },
  walkin: { kat: 'dusche', name: 'Walk-in-Dusche mit Glaswand', w: 1400, d: 900, g: [[1200, 900, '120×90'], [1400, 900, '140×90'], [1600, 1000, '160×100']] },
  duschwand: { kat: 'dusche', name: 'Glas-Duschwand / Abtrennung', w: 1000, d: 10, g: [[800, 10, '80'], [900, 10, '90'], [1000, 10, '100'], [1200, 10, '120']] },
  reihendusche: { kat: 'dusche', name: 'Reihendusche (Sport/Schwimmbad)', w: 3000, d: 1000, g: [[2000, 1000, '2 Plätze'], [3000, 1000, '3 Plätze'], [4000, 1000, '4 Plätze'], [6000, 1000, '6 Plätze']] },
  wanne: { kat: 'wanne', name: 'Badewanne', w: 1700, d: 750, aussparen: true, g: [[1600, 700, '160×70'], [1700, 700, '170×70'], [1700, 750, '170×75'], [1800, 800, '180×80'], [1900, 900, '190×90']] },
  eckwanne: { kat: 'wanne', name: 'Eckbadewanne', w: 1400, d: 1400, aussparen: true, g: [[1350, 1350, '135'], [1400, 1400, '140'], [1500, 1500, '150']] },
  wannefrei: { kat: 'wanne', name: 'Badewanne freistehend', w: 1700, d: 800, g: [[1600, 750, '160'], [1700, 800, '170'], [1800, 850, '180']] },
  duschwanne: { kat: 'wanne', name: 'Duschbadewanne', w: 1700, d: 750, aussparen: true, g: [[1700, 750, '170'], [1800, 800, '180']] },
  ablauf: { kat: 'ablauf', name: 'Bodenablauf (Punktablauf)', w: 150, d: 150, g: [[100, 100, '10×10'], [150, 150, '15×15'], [200, 200, '20×20']] },
  rinne: { kat: 'ablauf', name: 'Duschrinne', w: 800, d: 70, g: [[700, 70, '70'], [800, 70, '80'], [900, 70, '90'], [1000, 70, '100'], [1200, 70, '120'], [1500, 70, '150']] },
  wandrinne: { kat: 'ablauf', name: 'Wandablaufrinne (an der Wand)', w: 900, d: 60, g: [[800, 60, '80'], [900, 60, '90'], [1200, 60, '120']] },
  kastenrinne: { kat: 'ablauf', name: 'Kastenrinne (Gewerbe/Großküche)', w: 1000, d: 200, g: [[1000, 150, '100×15'], [1000, 200, '100×20'], [1000, 300, '100×30'], [2000, 200, '200×20']] },
  schlitzrinne: { kat: 'ablauf', name: 'Schlitzrinne', w: 1000, d: 40 },
  gewerbeablauf: { kat: 'ablauf', name: 'Gewerbe-Bodenablauf (Edelstahl)', w: 250, d: 250, g: [[200, 200, '20'], [250, 250, '25'], [300, 300, '30']] },
  ueberlaufrinne: { kat: 'ablauf', name: 'Schwimmbad-Überlaufrinne', w: 3000, d: 250 },
  bewegung: { kat: 'bf', name: 'Bewegungsfläche 150 × 150', w: 1500, d: 1500, g: [[1200, 1200, '120×120 (eingeschränkt)'], [1500, 1500, '150×150 (Rollstuhl)']] },
  wcbf: { kat: 'bf', name: 'WC barrierefrei (70 cm tief)', w: 380, d: 700 },
  stuetzgriff: { kat: 'bf', name: 'Stützklappgriff', w: 80, d: 850 },
  haltegriff: { kat: 'bf', name: 'Haltegriff', w: 600, d: 60, g: [[300, 60, '30'], [600, 60, '60'], [900, 60, '90']] },
  wtbf: { kat: 'bf', name: 'Waschtisch unterfahrbar', w: 650, d: 550 },
  duschsitz: { kat: 'bf', name: 'Duschklappsitz', w: 450, d: 450 },
  vorwand: { kat: 'inst', name: 'Vorwand / Installationswand', w: 1200, d: 200, aussparen: true, g: [[600, 200, '60'], [1000, 200, '100'], [1200, 200, '120'], [1500, 250, '150'], [2000, 250, '200']] },
  schacht: { kat: 'inst', name: 'Schacht', w: 400, d: 400, aussparen: true },
  podest: { kat: 'bau', name: 'Podest (gemauert, fliesbar)', w: 1200, d: 900, aussparen: true, g: [[900, 900, '90×90'], [1200, 900, '120×90'], [1500, 1000, '150×100'], [2000, 1200, '200×120']] },
  sitzbank: { kat: 'bau', name: 'Sitzbank gemauert (Dampfbad/Dusche)', w: 1500, d: 450, aussparen: true, g: [[1000, 400, '100×40'], [1500, 450, '150×45'], [2000, 500, '200×50']] },
  mauerscheibe: { kat: 'bau', name: 'Mauerscheibe / Duschtrennwand gemauert', w: 1200, d: 115, aussparen: true, g: [[900, 115, '90'], [1200, 115, '120'], [1500, 115, '150']] },
  stufe: { kat: 'bau', name: 'Stufe / Podeststufe', w: 1000, d: 300, aussparen: true, g: [[800, 300, '80×30'], [1000, 300, '100×30'], [1200, 350, '120×35']] },
  nische: { kat: 'bau', name: 'Ablage / Nischenkasten', w: 600, d: 150, aussparen: true },
  heizkoerper: { kat: 'inst', name: 'Heizkörper', w: 800, d: 100, g: [[600, 100, '60'], [800, 100, '80'], [1000, 100, '100'], [1200, 100, '120'], [1600, 100, '160']] },
  badheizkoerper: { kat: 'inst', name: 'Badheizkörper / Handtuchtrockner', w: 600, d: 100, g: [[500, 100, '50'], [600, 100, '60'], [750, 100, '75']] },
  fbhverteiler: { kat: 'inst', name: 'FBH-Verteilerkasten', w: 600, d: 120 },
  therme: { kat: 'inst', name: 'Therme / Heizgerät', w: 450, d: 350 },
  speicher: { kat: 'inst', name: 'Warmwasserspeicher', w: 650, d: 650 },
  spuele: { kat: 'kueche', name: 'Spüle', w: 800, d: 600 },
  herd: { kat: 'kueche', name: 'Herd / Kochfeld', w: 600, d: 600, g: [[600, 600, '60'], [800, 600, '80'], [900, 600, '90']] },
  kuechenzeile: { kat: 'kueche', name: 'Küchenzeile', w: 2400, d: 600, aussparen: true, g: [[1800, 600, '180'], [2400, 600, '240'], [2700, 600, '270'], [3000, 600, '300'], [3600, 600, '360']] },
  unterschrank: { kat: 'kueche', name: 'Unterschrank', w: 600, d: 600, aussparen: true, g: [[300, 600, '30'], [400, 600, '40'], [450, 600, '45'], [600, 600, '60'], [800, 600, '80']] },
  hochschrank: { kat: 'kueche', name: 'Hochschrank', w: 600, d: 600, aussparen: true },
  kuehlschrank: { kat: 'kueche', name: 'Kühlschrank (freistehend)', w: 600, d: 650, g: [[600, 650, '60'], [700, 700, '70'], [900, 700, 'Side-by-Side 90']] },
  spuelmaschine: { kat: 'kueche', name: 'Geschirrspüler', w: 600, d: 600, g: [[450, 600, '45'], [600, 600, '60']] },
  kochinsel: { kat: 'kueche', name: 'Kochinsel', w: 1800, d: 900, aussparen: true, g: [[1500, 900, '150'], [1800, 900, '180'], [2400, 1000, '240']] },
  gastroherd: { kat: 'gastro', name: 'Herdblock', w: 1200, d: 900, g: [[800, 900, '80'], [1200, 900, '120'], [1600, 900, '160']] },
  kombidaempfer: { kat: 'gastro', name: 'Kombidämpfer', w: 900, d: 800 },
  gastrospuele: { kat: 'gastro', name: 'Spültisch Edelstahl', w: 1400, d: 700, g: [[1200, 700, '120'], [1400, 700, '140'], [1800, 700, '180']] },
  durchschub: { kat: 'gastro', name: 'Durchschub-Spülmaschine', w: 700, d: 750 },
  arbeitstisch: { kat: 'gastro', name: 'Arbeitstisch Edelstahl', w: 1600, d: 700, g: [[1200, 700, '120'], [1600, 700, '160'], [2000, 700, '200']] },
  kuehlzelle: { kat: 'gastro', name: 'Kühlzelle', w: 2000, d: 2000, aussparen: true, g: [[1500, 1500, '150'], [2000, 2000, '200'], [2500, 3000, '250×300']] },
  fettabscheider: { kat: 'gastro', name: 'Fettabscheider (Bodeneinbau)', w: 800, d: 800 },
  waschm: { kat: 'hw', name: 'Waschmaschine', w: 600, d: 600 },
  trockner: { kat: 'hw', name: 'Trockner', w: 600, d: 600 },
  waschtm: { kat: 'hw', name: 'Wasch-Trocken-Säule', w: 600, d: 650 },
  bett: { kat: 'moebel', name: 'Bett', w: 1800, d: 2000, g: [[900, 2000, '90×200'], [1400, 2000, '140×200'], [1600, 2000, '160×200'], [1800, 2000, '180×200'], [2000, 2000, '200×200']] },
  tisch: { kat: 'moebel', name: 'Tisch', w: 1600, d: 900, g: [[800, 800, '80×80'], [1200, 800, '120×80'], [1600, 900, '160×90'], [2000, 1000, '200×100']] },
  tischrund: { kat: 'moebel', name: 'Tisch rund', w: 1200, d: 1200, g: [[900, 900, 'Ø 90'], [1200, 1200, 'Ø 120'], [1400, 1400, 'Ø 140']] },
  stuhl: { kat: 'moebel', name: 'Stuhl', w: 450, d: 500 },
  sofa: { kat: 'moebel', name: 'Sofa', w: 2200, d: 900, g: [[1800, 900, '2-Sitzer'], [2200, 900, '3-Sitzer'], [2800, 1700, 'Eckcouch']] },
  sessel: { kat: 'moebel', name: 'Sessel', w: 850, d: 850 },
  schrank: { kat: 'moebel', name: 'Schrank', w: 1200, d: 600, aussparen: true, g: [[600, 600, '60'], [1000, 600, '100'], [1500, 600, '150'], [2000, 600, '200'], [3000, 600, '300']] },
  regal: { kat: 'moebel', name: 'Regal', w: 1000, d: 350 },
  schreibtisch: { kat: 'moebel', name: 'Schreibtisch', w: 1400, d: 700 },
  auto: { kat: 'aussen', name: 'PKW', w: 1850, d: 4600 },
  baum: { kat: 'aussen', name: 'Baum', w: 3000, d: 3000, g: [[2000, 2000, 'klein'], [3000, 3000, 'mittel'], [6000, 6000, 'groß']] },
  strauch: { kat: 'aussen', name: 'Strauch', w: 1200, d: 1200 },
  muell: { kat: 'aussen', name: 'Mülltonnen (3 Stück)', w: 2000, d: 800 },
  fahrrad: { kat: 'aussen', name: 'Fahrrad', w: 600, d: 1800 }
};
export const symboleIn = (kat) => Object.entries(SYMBOLE).filter(([, v]) => v.kat === kat);
export function symbolFootprint(s) {
  const w = s.w, d = s.d, r = G.rad(s.rot || 0);
  return [[0, 0], [w, 0], [w, d], [0, d]].map(([x, y]) => G.rot({ x: s.p.x + x - w / 2, y: s.p.y + y - d / 2 }, r, s.p));
}

/** Bewegungsfläche B × B vor einem Sanitärobjekt; bei Wannen die Seite, die in den Raum zeigt */
export function bewegungsFlaeche(s, B, raumPoly = null) {
  const mk = (sg) => { const r = G.rad(s.rot || 0), fwd = G.mul(G.rot({ x: 0, y: 1 }, r), sg), side = G.rot({ x: 1, y: 0 }, r), fm = G.add(s.p, G.mul(fwd, s.d / 2)), bw = Math.max(B, s.w) / 2;
    return [G.add(fm, G.mul(side, -bw)), G.add(fm, G.mul(side, bw)), G.add(G.add(fm, G.mul(side, bw)), G.mul(fwd, B)), G.add(G.add(fm, G.mul(side, -bw)), G.mul(fwd, B))]; };
  const a = mk(1); if (!raumPoly || (SYMBOLE[s.kind] || {}).kat !== 'wanne') return a;
  const b = mk(-1); const innen = (q) => G.pointInPoly(G.polyCentroid(q), raumPoly) ? 1 : 0; return innen(b) > innen(a) ? b : a;
}

/* ───────── Hauptzeichnung ───────── */
export function drawPlan(P, doc, opt = {}) {
  const sid = opt.storey || doc.p.activeStorey;
  const st = doc.storeyById(sid);
  const geo = W.storeyGeometry(doc, sid);
  const sel = opt.selection || new Set();
  const tilesMode = opt.tiles || 'plan'; // aus | plan | kunde
  const lay = (e) => doc.visible(e);
  const col = (e, def) => { const l = doc.layer(e.layer); return (l && l.color) || def; };

  // 0) Unterlagen (Pläne)
  if (opt.underlays !== false) for (const u of doc.p.underlays) {
    if (u.storey && u.storey !== sid) continue; if (!u.visible || !u.img) continue;
    P.image(u.img, u.x, u.y, u.w, u.h, u.opacity ?? 0.5, u.rot ? G.rad(u.rot) : 0);
  }
  // 1) darunterliegendes Geschoss grau
  if (opt.ghost) {
    const below = doc.storeyBelow(sid);
    if (below) { const gb = W.storeyGeometry(doc, below.id); for (const it of gb.body) P.fill([it.outer, ...it.holes], null, 1, { color: '#b8c0cc', w: PEN.duenn, dash: [1.5, 1] }); }
  }
  // 2) Räume: Füllung + Fliesen
  const rooms = doc.all('room', sid).filter(lay);
  for (const r of rooms) {
    if (!r.poly) continue;
    if (r.fill && tilesMode !== 'kunde') P.fill([r.poly], r.fill, 0.35);
    if (tilesMode !== 'aus') { const res = floorTiles(doc, geo, r); if (res) drawTileResult(P, res, tilesMode, r.tiles.boden, opt); }
  }
  for (const z of doc.all('tilezone', sid).filter(lay)) {
    if (!z.poly || !z.tiles || tilesMode === 'aus') { if (z.poly) P.polyline(z.poly, { color: '#0e7c6b', w: PEN.duenn, dash: [2, 1] }, true); continue; }
    const res = zoneTiles(z); if (res) drawTileResult(P, res, tilesMode, z.tiles, opt);
    P.polyline(z.poly, { color: '#0e7c6b', w: PEN.mittel }, true);
  }
  // 3) Wände (geschnitten)
  const wallStyle = opt.wallStyle || doc.p.settings.wandDarstellung || 'schraffur';
  const cutPolys = []; for (const it of geo.cut) { cutPolys.push(it.outer, ...it.holes); }
  if (cutPolys.length) {
    if (wallStyle === 'schwarz') P.fill(cutPolys, '#2b2f36', 1);
    else if (wallStyle === 'grau') P.fill(cutPolys, '#9aa3ad', 1);
    else {
      P.fill(cutPolys, '#ffffff', 1);
      const hatch = hatchLines(geo, doc.cacheVersion, (opt.paperScale || 50) * 1.6);
      for (const l of hatch) P.polyline(l, { color: '#5b6470', w: PEN.fein });
    }
    // Leichtbauwände anders
    { const WF = { trockenbau: '#e7eef7', beton: '#dcdcdc', ks: '#f1ecdd', porenbeton: '#f6f6ef', ziegel: '#f4dccb', leichtbeton: '#e9e5dc', holz: '#efdfbf', glasbaustein: '#dbeafe' }; for (const g of geo.wg.values()) if (WF[g.w.material]) { P.fill([g.poly], WF[g.w.material], 1); } }
    if (wallStyle !== 'schwarz' && wallStyle !== 'grau') zeichneSchichten(P, geo, cutPolys, opt, W.outsideSide);
    for (const it of geo.cut) { P.polyline(it.outer, { color: '#111', w: PEN.dick }, true); for (const h of it.holes) P.polyline(h, { color: '#111', w: PEN.dick }, true); }
  }
  // 4) Öffnungen
  for (const oi of geo.openings) if (lay(oi.o)) drawOpening(P, oi, sel.has(oi.o.id));
  // 5) Stützen, Treppen, Symbole
  for (const c of doc.all('column', sid).filter(lay)) { const pl = columnPoly(c); P.fill([pl], '#2b2f36', 1, { color: '#111', w: PEN.dick }); }
  for (const s of doc.all('stair', sid).filter(lay)) drawStair(P, s);
  for (const s of doc.all('symbol', sid).filter(lay)) drawSymbol(P, s, col(s, '#4a5260'));
  // Bewegungsflächen DIN 18040-2 (wenn in „Listen & Prüfung“ eingeschaltet)
  const bfStufe = (doc.p.settings || {}).pruefBF; if (bfStufe === 'bf' || bfStufe === 'r') { const B = bfStufe === 'r' ? 1500 : 1200; const rms = doc.all('room', sid).filter(r => r.poly);
    for (const s of doc.all('symbol', sid).filter(lay)) { const def = SYMBOLE[s.kind] || {}; if (!['wc', 'wt', 'wanne'].includes(def.kat) && !['wcbf', 'wtbf'].includes(s.kind)) continue;
      const rm = rms.find(r => G.pointInPoly(s.p, r.poly)); const q = bewegungsFlaeche(s, B, rm && rm.poly);
      P.polyline(q, { color: '#2563eb', w: PEN.fein, dash: [2, 1.5] }, true); P.line(q[0], q[2], { color: '#2563eb', w: PEN.fein, dash: [1, 2] }); P.line(q[1], q[3], { color: '#2563eb', w: PEN.fein, dash: [1, 2] }); } }
  // 6) Zeichnungselemente
  for (const e of doc.all(null, sid).filter(lay)) {
    if (e.type === 'line') P.line(e.a, e.b, { color: e.color || col(e, '#333'), w: e.w || PEN.mittel, dash: e.dash });
    else if (e.type === 'poly') { P.polyline(e.pts, { color: e.color || col(e, '#333'), w: e.w || PEN.mittel, dash: e.dash }, e.closed); if (e.fill) P.fill([e.pts], e.fill, 0.5); }
    else if (e.type === 'circle') P.circle(e.c, e.r, { color: e.color || col(e, '#333'), w: e.w || PEN.mittel });
    else if (e.type === 'guide') { const d = G.norm(G.sub(e.b, e.a)); const far = 1e6; P.line(G.sub(e.a, G.mul(d, far)), G.add(e.a, G.mul(d, far)), { color: '#d0427f', w: PEN.fein, dash: [3, 1.5], alpha: 0.8 }); }
    else if (e.type === 'joint') P.polyline(e.pts, { color: '#e11d48', w: PEN.kraeftig, dash: [3, 1, 0.6, 1] });
    else if (e.type === 'koerper') {
      const oben = e.art === 'decke' || (e.z0 || 0) >= 1200; const c = col(e, '#374151');
      if (!oben) { P.fill([e.pts], e.art === 'kamin' ? '#e8b49b' : '#e5e7eb', 1, { color: c, w: PEN.kraeftig }); const bb = G.bbox(e.pts); for (const l of G.clipLines([[{ x: bb.x0, y: bb.y0 }, { x: bb.x1, y: bb.y1 }]], [e.pts])) P.polyline(l, { color: '#9ca3af', w: PEN.fein }); }
      else P.polyline(e.pts, { color: c, w: PEN.duenn, dash: [3, 1.5] }, true);
      const KN = { podest: 'Podest', sitzbank: 'Sitzbank', stufe: 'Stufe', kamin: 'Kamin', ablage: 'Ablage', brunnen: 'Beckenrand', koerper: 'Körper', decke: 'Decke' };
      P.text(G.polyCentroid(e.pts), `${KN[e.art] || 'Körper'}${e.z1 != null ? ' h=' + G.fmtCm(e.z1) : ''}`, 1.8, { align: 'center', base: 'middle', color: c });
    }
    else if (e.type === 'durchbruch') { const c = col(e, '#b91c1c'); P.polyline(e.pts, { color: c, w: PEN.kraeftig }, true); if (e.pts.length === 4) { P.line(e.pts[0], e.pts[2], { color: c, w: PEN.duenn }); P.line(e.pts[1], e.pts[3], { color: c, w: PEN.duenn }); } else { const m = G.polyCentroid(e.pts); for (const q of e.pts) P.line(m, q, { color: c, w: PEN.fein }); } P.text(G.polyCentroid(e.pts), e.in === 'decke' ? 'DD' : 'BD', 2, { align: 'center', base: 'middle', color: c, bold: true, bg: 'rgba(255,255,255,.8)' }); }
    else if (e.type === 'balken') { const c = col(e, '#374151'); P.polyline(G.stripPoly(e.a, e.b, (e.breite || 240) / 2), { color: c, w: PEN.duenn, dash: [4, 1.5] }, true); P.text(G.mid(e.a, e.b), `UZ ${G.fmtCm(e.breite || 240)}/${G.fmtCm(e.hoehe || 300)}`, 1.8, { align: 'center', base: 'middle', color: c, bg: 'rgba(255,255,255,.8)' }); }
    else if (e.type === 'dachfenster' || e.type === 'gaube') { const c = col(e, '#7c3aed'); const w = e.breite || 800, l = e.type === 'gaube' ? (e.tiefe || 1800) : (e.laenge || 1180) * 0.8; const q = [{ x: e.p.x - w / 2, y: e.p.y }, { x: e.p.x + w / 2, y: e.p.y }, { x: e.p.x + w / 2, y: e.p.y + l }, { x: e.p.x - w / 2, y: e.p.y + l }].map(p => G.rot(p, G.rad(e.rot || 0), e.p)); P.polyline(q, { color: c, w: PEN.duenn, dash: [3, 1.5] }, true); P.line(q[0], q[2], { color: c, w: PEN.fein }); P.text(G.polyCentroid(q), e.type === 'gaube' ? 'Gaube' : 'DFF', 1.8, { align: 'center', base: 'middle', color: c }); }
  }
  // 7) Bemaßung, Höhenkoten
  for (const d of doc.all('dim', sid).filter(lay)) drawDim(P, d, col(d, '#1452a8'), opt);
  for (const l of doc.all('level', sid).filter(lay)) drawLevel(P, l, col(l, '#1452a8'));
  // 8) Raumstempel + Raummaße
  for (const r of rooms) { if (r.poly) drawRoomStamp(P, doc, geo, r, st, opt); }
  // 9) Texte
  for (const t of doc.all('text', sid).filter(lay)) P.text(t.p, t.text, t.size || 3.5, { rot: t.rot ? G.rad(t.rot) : 0, color: t.color || col(t, '#111'), align: t.align || 'left', bold: t.bold });
  // 10) Schnittlinien
  for (const s of doc.p.elements.filter(e => e.type === 'section')) drawSectionMark(P, s);
}

export function zoneTiles(z) {
  if (!z.tiles || !z.tiles.aktiv) return null;
  const key = 'z' + z.id + JSON.stringify(z.poly) + JSON.stringify(z.tiles);
  if (tileCache.has(key)) return tileCache.get(key);
  const region = { outer: z.poly, holes: z.holes || [] }; const res = T.planTiles(region, z.tiles); res.region = region; tileCache.set(key, res); return res;
}

const hatchCache = new Map();
function hatchLines(geo, ver, spacing) {
  const key = ver + '|' + spacing + '|' + geo.walls.length;
  if (hatchCache.has(key) && hatchCache.get(key).geo === geo) return hatchCache.get(key).lines;
  const polys = []; for (const it of geo.cut) { polys.push(it.outer, ...it.holes); }
  const all = []; for (const p of polys) all.push(...p);
  if (!all.length) return [];
  const bb = G.bbox(all); const lines = [];
  const L = bb.w + bb.h;
  for (let k = -L; k < L; k += spacing) lines.push([{ x: bb.x0 + k, y: bb.y0 }, { x: bb.x0 + k + L, y: bb.y0 + L }]);
  const clipped = G.clipLines(lines, polys);
  hatchCache.clear(); hatchCache.set(key, { geo, lines: clipped });
  return clipped;
}

export function drawTileResult(P, res, mode, cfg, opt = {}) {
  const outline = { color: '#8c939c', w: PEN.fein };
  if (mode === 'kunde') {
    const pat = tilePatternFor && P.kind === 'screen' ? tilePatternFor(P.ctx, cfg, P.tf.s) : null;
    const fugen = cfg.fugeFarbe || '#a8a29a';
    P.fill([res.region.outer, ...res.region.holes], fugen, 1);
    let k = 0;
    for (const p of res.pieces) {
      k++;
      const pc = p.zcfg && p.zcfg !== cfg ? p.zcfg : null;
      if (pc) { const pp = P.kind === 'screen' && tilePatternFor ? tilePatternFor(P.ctx, pc, P.tf.s) : null; if (pp && pp.forPiece) pp.forPiece(P, p, k); else P.fill([p.poly], shade(pc.farbe || '#d9d4cc', ((p.i * 7 + p.j * 13) % 9 - 4) * 0.012), 1); }
      else if (pat && pat.forPiece) { pat.forPiece(P, p, k); }
      else P.fill([p.poly], shade(cfg.farbe || '#d9d4cc', ((p.i * 7 + p.j * 13) % 9 - 4) * 0.012), 1);
    }
    return;
  }
  for (const p of res.pieces) P.fill([p.poly], STATUS_FARBE[p.status] || '#fff', 1, outline);
  // Randstück-Maße
  if (opt.cutLabels !== false && P.pxPerMm * Math.min(cfg.L, cfg.B) > 28) {
    for (const p of res.pieces) {
      if (p.full) continue; const c = G.polyCentroid(p.poly);
      const lab = `${G.fmtCm(p.w)}×${G.fmtCm(p.h)}`;
      P.text(c, lab, 1.6, { align: 'center', base: 'middle', color: p.status === 'kritisch' ? '#b91c1c' : p.status === 'warnung' ? '#92400e' : '#1e3a8a' });
    }
  }
  // Startpunkt (Fugenkreuz)
  const o = res.origin; const r = 0.002 * 1 / Math.max(1e-6, 1 / (opt.paperScale || 50)) * 1000 / 1000;
  const sz = 4 * (opt.paperScale || 50);
  P.line({ x: o.x - sz, y: o.y }, { x: o.x + sz, y: o.y }, { color: '#dc2626', w: PEN.kraeftig });
  P.line({ x: o.x, y: o.y - sz }, { x: o.x, y: o.y + sz }, { color: '#dc2626', w: PEN.kraeftig });
  P.circle(o, sz * 0.45, { color: '#dc2626', w: PEN.kraeftig });
}

/* ───────── Öffnungen ───────── */
function drawOpening(P, oi, selected) {
  const { o, g } = oi; const h = g.w.thickness / 2;
  const u = g.u, n = g.n;
  const c0 = oi.c0, c1 = oi.c1; const m = G.mid(c0, c1);
  const st = { color: selected ? '#2563eb' : '#111', w: PEN.mittel };
  const fein = { color: st.color, w: PEN.fein }, duenn = { color: '#111', w: PEN.duenn };
  const at = (s, d) => G.add(G.add(c0, G.mul(u, s)), G.mul(n, d)); // s entlang Öffnung, d quer (n-Seite +)
  const Wd = o.width;
  // Laibungslinien
  P.line(G.add(c0, G.mul(n, h)), G.sub(c0, G.mul(n, h)), { color: '#111', w: PEN.dick });
  P.line(G.add(c1, G.mul(n, h)), G.sub(c1, G.mul(n, h)), { color: '#111', w: PEN.dick });
  const label = (txt, side, dist = 120) => P.text(G.add(m, G.mul(n, -side * (h + dist))), txt, 1.8, { align: 'center', base: 'middle', color: '#374151', rot: textAngle(u) });
  if (o.kind === 'window') {
    const typ = o.typ || 'dk1'; const ins = Math.min(40, h * 0.5);
    const outS = o.aussen === 'L' ? 1 : o.aussen === 'R' ? -1 : -1; // Außenseite
    const schiebe = typ === 'hs' || typ === 'psk' || typ === 'schiebe';
    if (schiebe) {
      // zwei versetzte Flügel mit Pfeil
      P.line(at(0, ins), at(Wd * 0.55, ins), st); P.line(at(Wd * 0.45, -ins), at(Wd, -ins), st);
      P.line(at(Wd * 0.2, ins * 0.2), at(Wd * 0.4, ins * 0.2), fein); P.polyline([at(Wd * 0.36, ins * 0.5), at(Wd * 0.4, ins * 0.2), at(Wd * 0.36, -ins * 0.1)], fein);
    } else {
      P.line(at(0, ins), at(Wd, ins), st); P.line(at(0, -ins), at(Wd, -ins), st);
      const nF = K.fluegel(typ, Wd);
      for (let i = 1; i < nF; i++) { const x = Wd * i / nF; P.line(at(x, ins + 15), at(x, -ins - 15), { ...st, w: typ === 'dk2' || typ === 'fenstertuer2' ? PEN.mittel : PEN.kraeftig }); }
    }
    P.line(at(0, h), at(Wd, h), duenn); P.line(at(0, -h), at(Wd, -h), duenn);
    // Fensterbank außen (nicht bei bodentief)
    if (!K.istBodentief(typ) && o.fbA !== 'ohne') P.polyline([at(-30, outS * h), at(-30, outS * (h + 50)), at(Wd + 30, outS * (h + 50)), at(Wd + 30, outS * h)], duenn);
    // Sonnenschutz
    const ss = o.sonnenschutz || (o.rollladen ? 'rl_aufsatz' : 'ohne');
    if (ss.startsWith('rl') || ss === 'raffstore') { const d = ss === 'rl_vorbau' || ss === 'raffstore' ? outS * (h + 90) : -outS * (h - 30); P.polyline([at(0, d), at(Wd, d)], { color: '#111', w: PEN.fein, dash: [1.5, 1] }); }
    if (ss === 'klappladen' || ss === 'schiebeladen') { for (const [a, b] of [[0, -1], [Wd, 1]]) P.line(at(a, outS * h), at(a + b * Wd * 0.45, outS * (h + (ss === 'klappladen' ? 60 : 30))), { color: '#111', w: PEN.duenn }); }
    const lb = (K.istBodentief(typ) || !o.sill) ? 'bodentief' : `BRH ${G.fmtCm(o.sill)}`;
    label(`${G.fmtCm(Wd)}/${G.fmtCm(o.height)} · ${lb}`, -outS, 140);
  } else if (o.kind === 'door' || o.kind === 'schiebetuer') {
    const art = o.art || (o.kind === 'schiebetuer' ? 'schiebe_vor' : 'dreh1');
    const side = o.side || 1;
    const hingeAt1 = o.hinge === 'rechts';
    const leaf = (hingeS, len, dir, sgn = side, dashed = false) => { // Flügel ab Bandseite hingeS (0|Wd), Richtung dir (+1 → zur anderen Seite)
      const hp = at(hingeS, sgn * h); const tip = G.add(hp, G.mul(n, sgn * len));
      P.line(hp, tip, { ...st, w: PEN.kraeftig, dash: dashed ? [2, 1] : null });
      const op = at(hingeS + dir * len, sgn * h);
      const a0 = G.angleOf(G.sub(op, hp)), a1 = G.angleOf(G.sub(tip, hp)); let d = a1 - a0; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      P.arc(hp, len, a0, a0 + d, { color: st.color, w: PEN.fein, dash: dashed ? [1.5, 1] : null });
    };
    if (art === 'dreh2' || art === 'dreh2sym') {
      const b = K.TUER_BREITEN_2.find(x => x.rb === Wd); let geh = art === 'dreh2sym' || !b ? Wd / 2 : Wd * b.geh / (b.geh + b.stand);
      if (hingeAt1) { leaf(Wd, geh, -1); leaf(0, Wd - geh, 1); } else { leaf(0, geh, 1); leaf(Wd, Wd - geh, -1); }
    } else if (art === 'pendel') {
      const hs = hingeAt1 ? Wd : 0, dir = hingeAt1 ? -1 : 1; leaf(hs, Wd, dir, 1); leaf(hs, Wd, dir, -1, true);
    } else if (art === 'schiebe_vor') {
      const d = side * (h + 35); const off = hingeAt1 ? -Wd * 0.15 : Wd * 0.15;
      P.fill([[at(off - 20, d - 15), at(Wd + off + 20, d - 15), at(Wd + off + 20, d + 15), at(off - 20, d + 15)]], '#ffffff', 1, { ...st, w: PEN.mittel });
      P.line(at(-Wd * 0.1, d + side * 35), at(Wd * 1.25, d + side * 35), fein);
      const ax = hingeAt1 ? Wd * 0.2 : Wd * 0.8, ad = hingeAt1 ? 1 : -1; P.polyline([at(ax + ad * 120, d + side * 70), at(ax, d + side * 70)], fein); P.polyline([at(ax + ad * 50, d + side * 95), at(ax, d + side * 70), at(ax + ad * 50, d + side * 45)], fein);
    } else if (art === 'schiebe_in' || art === 'schiebe2') {
      const pockets = art === 'schiebe2' ? [[0, -1, Wd / 2], [Wd, 1, Wd / 2]] : [[hingeAt1 ? Wd : 0, hingeAt1 ? 1 : -1, Wd]];
      for (const [s0, dir, len] of pockets) { P.polyline([at(s0, 25), at(s0 + dir * len, 25), at(s0 + dir * len, -25), at(s0, -25)], { color: '#111', w: PEN.fein, dash: [2, 1] }); P.line(at(s0 + dir * 0.0, 0), at(s0 - dir * len * 0.25, 0), { ...st, w: PEN.kraeftig }); }
    } else if (art === 'falt') {
      const k = 4, d = side * h; const pts = []; for (let i = 0; i <= k; i++) pts.push(at(Wd * i / k * 0.45 + (hingeAt1 ? Wd * 0.55 : 0), d + side * (i % 2 ? 140 : 0))); P.polyline(pts, { ...st, w: PEN.kraeftig });
    } else if (art === 'garagentor') {
      P.line(at(0, 0), at(Wd, 0), { color: st.color, w: PEN.mittel, dash: [3, 1.5] }); P.line(at(0, side * (h + 60)), at(Wd, side * (h + 60)), { color: '#111', w: PEN.fein, dash: [1, 1] });
    } else if (art === 'haustuer_st') {
      const stw = Math.min(Wd * 0.45, o.seitenteil || 400); const leafW = Wd - stw;
      const s0 = hingeAt1 ? stw : 0; // Seitenteil auf der Gegenseite der Bänder
      leaf(hingeAt1 ? Wd : 0, leafW, hingeAt1 ? -1 : 1);
      const a = hingeAt1 ? 0 : leafW; P.line(at(a, 30), at(a + stw, 30), st); P.line(at(a, -30), at(a + stw, -30), st); P.line(at(a, h), at(a, -h), { color: '#111', w: PEN.mittel });
      void s0;
    } else {
      leaf(hingeAt1 ? Wd : 0, Wd, hingeAt1 ? -1 : 1);
    }
    if (o.schwelle && o.schwelle !== 'ohne') P.line(at(0, -side * h), at(Wd, -side * h), { color: '#111', w: o.schwelle === 'flach' ? PEN.fein : PEN.duenn });
    const zus = art === 'garagentor' ? 'Tor ' : o.brand ? o.brand + ' ' : /haustuer/.test(art) ? 'HT ' : '';
    label(`${zus}${G.fmtCm(Wd)}/${G.fmtCm(o.height)}`, side);
  } else {
    // Durchgang/Öffnung: gestrichelte Sturzlinie
    P.line(G.add(c0, G.mul(n, h)), G.add(c1, G.mul(n, h)), { color: '#111', w: PEN.fein, dash: [2, 1] });
    P.line(G.sub(c0, G.mul(n, h)), G.sub(c1, G.mul(n, h)), { color: '#111', w: PEN.fein, dash: [2, 1] });
    if (o.form === 'rundbogen' || o.form === 'segmentbogen') label(o.form === 'rundbogen' ? 'RB' : 'SB', 1, 80);
  }
}
export function textAngle(u) { let a = Math.atan2(u.y, u.x); if (a > Math.PI / 2 + 1e-6) a -= Math.PI; if (a <= -Math.PI / 2 + 1e-6) a += Math.PI; return a; }

/* ───────── Bemaßung ───────── */
export function dimGeometry(d) {
  const pts = d.pts; if (!pts || pts.length < 2) return null;
  const dir = d.dir ? G.norm(d.dir) : G.norm(G.sub(pts[pts.length - 1], pts[0]));
  const n = G.perp(dir);
  const base = G.add(pts[0], G.mul(n, d.off || 0));
  const proj = pts.map(p => { const t = G.dot(G.sub(p, base), dir); return { p, t, q: G.add(base, G.mul(dir, t)) }; });
  return { dir, n, base, proj };
}
export function drawDim(P, d, color = '#1452a8', opt = {}) {
  const g = dimGeometry(d); if (!g) return;
  const ps = opt.paperScale || 50; const tick = 1.2 * ps; const ext = 1.5 * ps; const gap = 1 * ps;
  const st = { color, w: PEN.duenn };
  const sorted = g.proj.slice().sort((a, b) => a.t - b.t);
  P.line(G.sub(sorted[0].q, G.mul(g.dir, ext * 0.6)), G.add(sorted[sorted.length - 1].q, G.mul(g.dir, ext * 0.6)), st);
  for (const s of g.proj) {
    const away = G.sub(s.q, s.p); const L = G.len(away);
    const dn = L > 1 ? G.norm(away) : g.n;
    const start = L > gap ? G.add(s.p, G.mul(dn, gap)) : s.p;
    P.line(start, G.add(s.q, G.mul(dn, ext * 0.5)), st);
    const tdir = G.norm(G.add(g.dir, g.n));
    P.line(G.sub(s.q, G.mul(tdir, tick * 0.6)), G.add(s.q, G.mul(tdir, tick * 0.6)), { color, w: PEN.kraeftig });
  }
  const rot = textAngle(g.dir); const flip = Math.abs(rot - G.angleOf(g.dir)) > 0.1;
  const side = G.dot(g.n, { x: -Math.sin(rot), y: Math.cos(rot) }) > 0 ? 1 : -1;
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i], b = sorted[i + 1]; const len = b.t - a.t; if (len < 0.5) continue;
    const m = G.mid(a.q, b.q); const f = G.fmtBau(len);
    const tp = G.add(m, G.mul({ x: -Math.sin(rot), y: Math.cos(rot) }, 0.6 * ps));
    P.text(tp, f.main, 2.5, { align: 'center', rot, color, sup: f.sup });
  }
  if (d.total && sorted.length > 2) {
    const len = sorted[sorted.length - 1].t - sorted[0].t; const f = G.fmtBau(len);
    const m = G.mid(sorted[0].q, sorted[sorted.length - 1].q);
    P.text(G.add(m, G.mul({ x: -Math.sin(rot), y: Math.cos(rot) }, 4 * ps)), f.main, 2.5, { align: 'center', rot, color, sup: f.sup, bold: true });
  }
}
function drawLevel(P, l, color) {
  const ps = 50; const s = 1.6 * ps;
  P.fill([[l.p, { x: l.p.x - s, y: l.p.y + s * 1.2 }, { x: l.p.x + s, y: l.p.y + s * 1.2 }]], l.filled ? color : null, 1, { color, w: PEN.duenn });
  P.line({ x: l.p.x - s * 1.5, y: l.p.y }, { x: l.p.x + s * 5, y: l.p.y }, { color, w: PEN.duenn });
  const v = l.value || 0; const txt = (v >= 0 ? (v === 0 ? '±' : '+') : '−') + Math.abs(v / 1000).toFixed(2).replace('.', ',');
  P.text({ x: l.p.x + s * 1.2, y: l.p.y + s * 0.4 }, txt + (l.label ? ' ' + l.label : ''), 2.2, { color });
}

/* ───────── Raumstempel ───────── */
export function drawRoomStamp(P, doc, geo, r, st, opt) {
  const ps = opt.paperScale || 50;
  const c = r.stampPos || G.polyCentroid(r.poly);
  const area = G.polyArea(r.poly) / 1e6; const per = G.polyPerimeter(r.poly) / 1000;
  const lines = [];
  if (r.nr) lines.push({ t: r.nr, s: 2.2 });
  lines.push({ t: r.name || 'Raum', s: 3.2, b: true });
  lines.push({ t: `${area.toFixed(2).replace('.', ',')} m²`, s: 2.5 });
  if (opt.stampDetails !== false) {
    lines.push({ t: `U ${per.toFixed(2).replace('.', ',')} m · LH ${((r.height || st?.roomHeight || 2500) / 1000).toFixed(2).replace('.', ',')} m`, s: 1.9 });
    if (r.tiles && r.tiles.boden && r.tiles.boden.aktiv) { const b = r.tiles.boden; lines.push({ t: `Boden: ${b.name || 'Fliese'} ${G.fmtCm(b.L)}/${G.fmtCm(b.B)}`, s: 1.9 }); }
    if (r.tiles && r.tiles.wand && r.tiles.wand.aktiv) { const b = r.tiles.wand; lines.push({ t: `Wand: ${b.name || 'Fliese'} ${G.fmtCm(b.L)}/${G.fmtCm(b.B)} bis ${G.fmtCm(b.hoehe || 0)}`, s: 1.9 }); }
  }
  let y = c.y + lines.reduce((s, l) => s + l.s * 1.35, 0) * ps / 2;
  for (const l of lines) { y -= l.s * 1.35 * ps; P.text({ x: c.x, y: y + l.s * 0.3 * ps }, l.t, l.s, { align: 'center', bold: l.b, color: '#111', bg: opt.stampBg ? 'rgba(255,255,255,0.75)' : null }); }
  if (r.showDims) {
    const poly = G.ensureCCW(r.poly);
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i], b = poly[(i + 1) % poly.length]; if (G.dist(a, b) < 100) continue;
      drawDim(P, { pts: [a, b], off: 6 * ps * 0.5 + 200 }, '#0e7c6b', { paperScale: ps });
    }
  }
}

function drawStair(P, s) {
  const g = treppe(s); const fl = { color: '#111', w: PEN.duenn };
  P.fill([g.umriss], '#ffffff', 0.85, null);
  const nCut = Math.max(1, Math.round(g.linien.length * 0.6));
  g.flaechen.forEach((f, k) => P.polyline(f, k >= nCut ? { color: '#111', w: PEN.fein, dash: [2, 1] } : fl, true));
  P.polyline(g.umriss, { color: '#111', w: PEN.mittel }, true);
  if (g.spindel) P.circle(g.spindel.c, g.spindel.r, { color: '#111', w: PEN.mittel }, '#d1d5db');
  if (g.auge) P.circle(g.auge.c, g.auge.r, { color: '#111', w: PEN.duenn });
  // Schnittlinie (Treppe geschnitten in ca. 1 m Höhe)
  const l0 = g.linien[nCut - 1], l1 = g.linien[Math.min(g.linien.length - 1, nCut)];
  if (l0 && l1) { P.line(l0[0], l1[1], { color: '#111', w: PEN.duenn }); }
  // Lauflinie mit Antrittskreis und Pfeil
  const L = g.lauflinie; if (L.length > 1) {
    P.polyline(L, { color: '#111', w: PEN.fein }); P.circle(L[0], 45, { color: '#111', w: PEN.fein });
    const e = L[L.length - 1], d = G.norm(G.sub(e, L[L.length - 2])), q = G.perp(d);
    P.polyline([G.add(G.sub(e, G.mul(d, 160)), G.mul(q, 70)), e, G.sub(G.sub(e, G.mul(d, 160)), G.mul(q, 70))], { color: '#111', w: PEN.fein });
    const m = L[Math.min(L.length - 1, 1)];
    if (s.steps) P.text(G.add(m, { x: 0, y: 0 }), `${g.linien.length} STG`, 1.8, { align: 'left', base: 'middle', color: '#374151' });
  }
}

export function drawSymbol(P, s, color = '#4a5260') {
  const r = G.rad(s.rot || 0); const W = s.w, D = s.d;
  const loc = (x, y) => G.rot({ x: s.p.x - W / 2 + x, y: s.p.y - D / 2 + y }, r, s.p);
  const st = { color, w: PEN.duenn }; const st2 = { color, w: PEN.mittel };
  const rect = (x, y, w, h, stl = st) => P.polyline([loc(x, y), loc(x + w, y), loc(x + w, y + h), loc(x, y + h)], stl, true);
  const ell = (cx, cy, rx, ry, stl = st) => { const pts = []; for (let i = 0; i < 36; i++) { const a = i / 36 * Math.PI * 2; pts.push(loc(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry)); } P.polyline(pts, stl, true); };
  switch (s.kind) {
    case 'wc': case 'wcstand': case 'bidet':
      rect(0, 0, W, D * 0.28, st2); ell(W / 2, D * 0.6, W * 0.42, D * 0.38, st2); if (s.kind !== 'bidet') ell(W / 2, D * 0.62, W * 0.27, D * 0.25); break;
    case 'waschtisch': case 'handwb': rect(0, 0, W, D, st2); ell(W / 2, D * 0.5, W * 0.36, D * 0.33); P.circle(loc(W / 2, D * 0.75), 20, st); break;
    case 'doppelwt': rect(0, 0, W, D, st2); ell(W * 0.27, D * 0.5, W * 0.18, D * 0.33); ell(W * 0.73, D * 0.5, W * 0.18, D * 0.33); break;
    case 'urinal': ell(W / 2, D * 0.5, W * 0.48, D * 0.48, st2); ell(W / 2, D * 0.55, W * 0.3, D * 0.3); break;
    case 'dusche': rect(0, 0, W, D, { color, w: PEN.mittel, dash: [2, 1] }); P.line(loc(0, 0), loc(W, D), st); P.line(loc(W, 0), loc(0, D), st); P.circle(loc(W / 2, D / 2), 60, st2); break;
    case 'duschtasse': rect(0, 0, W, D, st2); rect(40, 40, W - 80, D - 80); P.line(loc(0, 0), loc(W, D), st); P.line(loc(W, 0), loc(0, D), st); P.circle(loc(W / 2, D / 2), 45, st); break;
    case 'wanne': rect(0, 0, W, D, st2); { const pts = []; const m = 70, rr = Math.min(W, D) * 0.35; for (let i = 0; i <= 12; i++) { const a = Math.PI / 2 + i / 12 * Math.PI; pts.push(loc(m + rr + Math.cos(a) * rr, D / 2 + Math.sin(a) * (D / 2 - m))); } pts.push(loc(W - m, m)); pts.push(loc(W - m, D - m)); P.polyline(pts, st, true); P.circle(loc(W - 220, D / 2), 30, st); } break;
    case 'ablauf': rect(0, 0, W, D, st2); P.line(loc(0, 0), loc(W, D), st); P.line(loc(W, 0), loc(0, D), st); break;
    case 'rinne': rect(0, 0, W, D, st2); for (let x = 40; x < W - 20; x += 40) P.line(loc(x, D * 0.2), loc(x, D * 0.8), st); break;
    case 'podest': case 'sitzbank': case 'mauerscheibe': case 'stufe': case 'nische': P.fill([[loc(0, 0), loc(W, 0), loc(W, D), loc(0, D)]], '#dcdfe3', 1, st2); P.line(loc(0, 0), loc(W, D), st); P.text(loc(W / 2, D / 2), SYMBOLE[s.kind].name.split(' ')[0], 1.6, { align: 'center', base: 'middle', color: color }); break;
    case 'vorwand': P.fill([[loc(0, 0), loc(W, 0), loc(W, D), loc(0, D)]], '#c7cdd4', 1, st2); break;
    case 'schacht': rect(0, 0, W, D, st2); P.line(loc(0, 0), loc(W, D), st2); P.line(loc(W, 0), loc(0, D), st2); break;
    case 'heizkoerper': rect(0, 0, W, D, st2); for (let x = 50; x < W; x += 50) P.line(loc(x, 0), loc(x, D), st); break;
    case 'spuele': rect(0, 0, W, D, st2); rect(60, 80, W * 0.5, D - 160); P.circle(loc(60 + W * 0.25, D / 2), 25, st); break;
    case 'herd': rect(0, 0, W, D, st2); for (const [x, y] of [[0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) P.circle(loc(W * x, D * y), Math.min(W, D) * 0.14, st); break;
    case 'kuechenzeile': rect(0, 0, W, D, st2); for (let x = 600; x < W; x += 600) P.line(loc(x, 0), loc(x, D), st); break;
    case 'bett': rect(0, 0, W, D, st2); rect(80, D - 450, W / 2 - 120, 350); rect(W / 2 + 40, D - 450, W / 2 - 120, 350); P.line(loc(0, D * 0.6), loc(W, D * 0.6), st); break;
    case 'tisch': rect(0, 0, W, D, st2); break;
    case 'schrank': rect(0, 0, W, D, st2); P.line(loc(0, 0), loc(W, D), st); break;
    case 'waschm': rect(0, 0, W, D, st2); P.circle(loc(W / 2, D / 2), Math.min(W, D) * 0.35, st); break;
    case 'auto': rect(0, 0, W, D, st2); rect(W * 0.1, D * 0.25, W * 0.8, D * 0.45); break;
    case 'baum': P.circle(s.p, W / 2, st2); P.circle(s.p, W / 10, st); break;
    case 'wcdusch': rect(0, 0, W, D * 0.28, st2); ell(W / 2, D * 0.6, W * 0.42, D * 0.38, st2); ell(W / 2, D * 0.62, W * 0.27, D * 0.25); P.circle(loc(W * 0.8, D * 0.15), 25, st); break;
    case 'wcbf': rect(0, 0, W, D * 0.25, st2); ell(W / 2, D * 0.58, W * 0.42, D * 0.4, st2); ell(W / 2, D * 0.6, W * 0.27, D * 0.27); break;
    case 'urinaltrennwand': rect(0, 0, W, D, st2); break;
    case 'wtunterschrank': rect(0, 0, W, D, st2); rect(20, 20, W - 40, D - 40, { color, w: PEN.fein, dash: [1.5, 1] }); ell(W / 2, D * 0.5, W * 0.3, D * 0.3); break;
    case 'aufsatzwb': rect(0, 0, W, D, st2); ell(W / 2, D * 0.5, Math.min(W, D) * 0.32, Math.min(W, D) * 0.32); break;
    case 'eckwb': P.polyline([loc(0, 0), loc(W, 0), loc(0, D)], st2, true); { const pts = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI / 2; pts.push(loc(Math.cos(a) * W * 0.55, Math.sin(a) * D * 0.55)); } P.polyline(pts, st); } break;
    case 'ausguss': rect(0, 0, W, D, st2); rect(50, 50, W - 100, D - 100); P.line(loc(W * 0.3, D * 0.5), loc(W * 0.7, D * 0.5), st); break;
    case 'waschrinne': rect(0, 0, W, D, st2); { const n = Math.max(1, Math.round(W / 600)); for (let i = 0; i < n; i++) { P.circle(loc(W * (i + 0.5) / n, D * 0.25), 22, st); } rect(40, D * 0.4, W - 80, D * 0.45); } break;
    case 'duschviertel': { const arc = []; for (let k = 0; k <= 16; k++) { const a = k / 16 * Math.PI / 2; arc.push(loc(Math.cos(a) * W, Math.sin(a) * D)); } P.polyline([loc(0, 0), ...arc], st2, true); P.circle(loc(W * 0.3, D * 0.3), 45, st); } break;
    case 'walkin': rect(0, 0, W, D, { color, w: PEN.mittel, dash: [2, 1] }); P.line(loc(W * 0.55, 0), loc(W * 0.55, D * 0.75), { color, w: PEN.kraeftig }); P.line(loc(0, 0), loc(W * 0.55, D), st); P.line(loc(W * 0.55, 0), loc(0, D), st); break;
    case 'duschwand': P.line(loc(0, D / 2), loc(W, D / 2), { color, w: PEN.kraeftig }); P.line(loc(0, D / 2 - 40), loc(0, D / 2 + 40), st2); break;
    case 'reihendusche': { rect(0, 0, W, D, { color, w: PEN.mittel, dash: [2, 1] }); const n = Math.max(1, Math.round(W / 1000)); for (let i = 0; i < n; i++) { P.circle(loc(W * (i + 0.5) / n, D * 0.15), 50, st); if (i) P.line(loc(W * i / n, 0), loc(W * i / n, D * 0.6), st2); } rect(60, D - 140, W - 120, 70); } break;
    case 'eckwanne': { P.polyline([loc(0, 0), loc(W, 0), loc(W, D * 0.35), loc(W * 0.35, D), loc(0, D)], st2, true); const inner = []; for (let k = 0; k <= 12; k++) { const a = k / 12 * Math.PI / 2; inner.push(loc(90 + Math.cos(a) * (W * 0.62), 90 + Math.sin(a) * (D * 0.62))); } P.polyline([loc(90, 90), ...inner], st, true); } break;
    case 'wannefrei': ell(W / 2, D / 2, W / 2, D / 2, st2); ell(W / 2, D / 2, W / 2 - 70, D / 2 - 70); P.circle(loc(W * 0.75, D / 2), 28, st); break;
    case 'duschwanne': rect(0, 0, W, D, st2); rect(70, 70, W - 140, D - 140); P.line(loc(W * 0.6, 70), loc(W * 0.6, D - 70), { color, w: PEN.fein, dash: [1.5, 1] }); P.circle(loc(W - 220, D / 2), 30, st); break;
    case 'wandrinne': rect(0, 0, W, D, st2); for (let x = 40; x < W - 20; x += 40) P.line(loc(x, D * 0.25), loc(x, D * 0.75), st); P.line(loc(0, 0), loc(W, 0), { color, w: PEN.kraeftig }); break;
    case 'kastenrinne': case 'ueberlaufrinne': rect(0, 0, W, D, st2); for (let x = 30; x < W - 10; x += 30) P.line(loc(x, D * 0.12), loc(x, D * 0.88), st); break;
    case 'schlitzrinne': rect(0, 0, W, D, st2); P.line(loc(20, D / 2), loc(W - 20, D / 2), st); break;
    case 'gewerbeablauf': rect(0, 0, W, D, st2); rect(W * 0.15, D * 0.15, W * 0.7, D * 0.7); for (let i = 1; i < 6; i++) P.line(loc(W * 0.15 + W * 0.7 * i / 6, D * 0.15), loc(W * 0.15 + W * 0.7 * i / 6, D * 0.85), st); break;
    case 'bewegung': rect(0, 0, W, D, { color: '#16a34a', w: PEN.duenn, dash: [3, 1.5] }); P.circle(loc(W / 2, D / 2), Math.min(W, D) / 2, { color: '#16a34a', w: PEN.fein, dash: [2, 1] }); break;
    case 'stuetzgriff': rect(0, 0, W, D, st2); P.circle(loc(W / 2, 40), 30, st); break;
    case 'haltegriff': rect(0, 0, W, D, st2); P.line(loc(30, D / 2), loc(W - 30, D / 2), st); break;
    case 'wtbf': rect(0, 0, W, D, st2); ell(W / 2, D * 0.45, W * 0.33, D * 0.3); P.line(loc(0, D), loc(W, D), { color, w: PEN.fein, dash: [1.5, 1] }); break;
    case 'duschsitz': rect(0, 0, W, D, { color, w: PEN.mittel, dash: [2, 1] }); P.line(loc(0, D * 0.15), loc(W, D * 0.15), st); break;
    case 'badheizkoerper': rect(0, 0, W, D, st2); P.line(loc(30, D / 2), loc(W - 30, D / 2), st); break;
    case 'fbhverteiler': rect(0, 0, W, D, st2); P.line(loc(0, 0), loc(W, D), st); P.text(loc(W / 2, D + 80), 'FBH', 1.6, { align: 'center', color }); break;
    case 'therme': rect(0, 0, W, D, st2); P.circle(loc(W / 2, D / 2), Math.min(W, D) * 0.3, st); break;
    case 'speicher': P.circle(s.p, W / 2, st2); P.circle(s.p, W / 2 - 50, st); break;
    case 'unterschrank': case 'hochschrank': rect(0, 0, W, D, st2); P.line(loc(0, D * 0.9), loc(W, D * 0.9), st); if (s.kind === 'hochschrank') P.line(loc(0, 0), loc(W, D), st); break;
    case 'kuehlschrank': rect(0, 0, W, D, st2); P.text(loc(W / 2, D / 2), 'KS', 1.8, { align: 'center', base: 'middle', color }); break;
    case 'spuelmaschine': rect(0, 0, W, D, st2); P.text(loc(W / 2, D / 2), 'GS', 1.8, { align: 'center', base: 'middle', color }); break;
    case 'trockner': rect(0, 0, W, D, st2); P.circle(loc(W / 2, D / 2), Math.min(W, D) * 0.35, st); P.text(loc(W / 2, D / 2), 'T', 1.8, { align: 'center', base: 'middle', color }); break;
    case 'waschtm': rect(0, 0, W, D, st2); P.circle(loc(W / 2, D / 2), Math.min(W, D) * 0.35, st); P.text(loc(W / 2, D / 2), 'WM/T', 1.6, { align: 'center', base: 'middle', color }); break;
    case 'kochinsel': rect(0, 0, W, D, st2); for (const [x, y] of [[0.3, 0.35], [0.45, 0.35], [0.3, 0.65], [0.45, 0.65]]) P.circle(loc(W * x, D * y), Math.min(W, D) * 0.1, st); rect(W * 0.62, D * 0.25, W * 0.25, D * 0.5); break;
    case 'gastroherd': rect(0, 0, W, D, st2); for (let i = 0; i < Math.round(W / 400); i++) for (const y of [0.3, 0.7]) P.circle(loc(200 + i * 400, D * y), 110, st); break;
    case 'kombidaempfer': rect(0, 0, W, D, st2); rect(80, 80, W * 0.7, D - 160); P.circle(loc(W * 0.88, D * 0.5), 30, st); break;
    case 'gastrospuele': rect(0, 0, W, D, st2); rect(60, 80, W * 0.32, D - 160); rect(W * 0.38, 80, W * 0.32, D - 160); break;
    case 'durchschub': rect(0, 0, W, D, st2); P.line(loc(0, D / 2), loc(W, D / 2), { color, w: PEN.fein, dash: [2, 1] }); P.text(loc(W / 2, D * 0.3), 'SPM', 1.6, { align: 'center', base: 'middle', color }); break;
    case 'arbeitstisch': rect(0, 0, W, D, st2); P.line(loc(0, D * 0.12), loc(W, D * 0.12), st); break;
    case 'kuehlzelle': rect(0, 0, W, D, { color, w: PEN.kraeftig }); rect(80, 80, W - 160, D - 160); P.text(loc(W / 2, D / 2), 'Kühlzelle', 2, { align: 'center', base: 'middle', color }); break;
    case 'fettabscheider': rect(0, 0, W, D, { color, w: PEN.mittel, dash: [2, 1] }); P.circle(loc(W / 2, D / 2), Math.min(W, D) * 0.3, st); P.text(loc(W / 2, D + 90), 'FAS', 1.6, { align: 'center', color }); break;
    case 'tischrund': P.circle(s.p, W / 2, st2); break;
    case 'stuhl': rect(0, 0, W, D, st); P.line(loc(0, D * 0.85), loc(W, D * 0.85), st2); break;
    case 'sofa': rect(0, 0, W, D, st2); rect(150, 0, W - 300, D * 0.25); P.line(loc(150, D * 0.25), loc(150, D), st); P.line(loc(W - 150, D * 0.25), loc(W - 150, D), st); break;
    case 'sessel': rect(0, 0, W, D, st2); rect(130, 0, W - 260, D * 0.25); break;
    case 'regal': rect(0, 0, W, D, st2); for (let x = W / 3; x < W - 1; x += W / 3) P.line(loc(x, 0), loc(x, D), st); break;
    case 'schreibtisch': rect(0, 0, W, D, st2); rect(W * 0.35, D * 0.6, W * 0.3, D * 0.5); break;
    case 'strauch': P.circle(s.p, W / 2, { color, w: PEN.fein, dash: [1.5, 1] }); P.circle(s.p, W / 4, st); break;
    case 'muell': for (let i = 0; i < 3; i++) rect(i * W / 3 + 40, 40, W / 3 - 80, D - 80, st2); break;
    case 'fahrrad': P.circle(loc(W / 2, D * 0.2), D * 0.17, st); P.circle(loc(W / 2, D * 0.8), D * 0.17, st); P.line(loc(W / 2, D * 0.2), loc(W / 2, D * 0.8), st2); break;
    default: rect(0, 0, W, D, st2);
  }
}

function drawSectionMark(P, s) {
  const st = { color: '#111', w: PEN.kraeftig, dash: [6, 1.5, 1, 1.5] };
  P.line(s.a, s.b, st);
  const d = G.norm(G.sub(s.b, s.a)); const look = G.mul(G.perp(d), s.flip ? -1 : 1);
  const sz = 300;
  for (const p of [s.a, s.b]) {
    P.fill([[p, G.add(p, G.mul(look, sz * 1.6)), G.add(p, G.add(G.mul(look, sz * 0.8), G.mul(d, p === s.a ? sz * 0.6 : -sz * 0.6)))]], '#111', 1);
    P.text(G.add(p, G.mul(d, p === s.a ? -sz * 1.2 : sz * 1.2)), s.name || 'A', 4, { align: 'center', base: 'middle', bold: true });
  }
}
