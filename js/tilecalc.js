// TW-CAD – Fliesenflächen eines Raums: Boden + Wandabwicklung, Mengen, Startpunkt-Maße
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import * as T from './tiles.js?v=20261028-0429';
import { floorTiles, roomRegion, wallTiles, zoneTiles, symbolFootprint } from './render2d.js?v=20261028-0429';
import { FUGENTIEFE, BAUTEIL_FLIESEN } from './fliesenkatalog.js?v=20261028-0429';

/** Wände eines Raums in Abwicklungs-Reihenfolge (von innen gesehen links → rechts) */
export function wallSurfaces(doc, room) {
  const geo = W.storeyGeometry(doc, room.storey);
  const st = doc.storeyById(room.storey);
  const H = room.height || st.roomHeight || 2500;
  const ccw = W.roomEdges(geo, room.poly);
  const res = ccw.slice().reverse().map((e, k) => ({
    k, a: e.b, b: e.a, len: e.len, u: G.mul(e.u, -1), wall: e.wall, H,
    openings: e.openings.map(o => ({ ...o, x0: e.len - o.x1, x1: e.len - o.x0 })).sort((p, q) => p.x0 - q.x0)
  }));
  // Ecken innen/außen (für Silikon / Eckschiene)
  for (let i = 0; i < res.length; i++) { const n = res[(i + 1) % res.length]; res[i].eckeRechts = G.cross(res[i].u, n.u) < 0 ? 'innen' : 'aussen'; }
  return res;
}

function wallRegions(s, z0, top) {
  const rect = [{ x: 0, y: z0 }, { x: s.len, y: z0 }, { x: s.len, y: top }, { x: 0, y: top }];
  const holes = s.openings.filter(o => o.sill < top && o.sill + o.height > z0).map(o => [{ x: o.x0, y: Math.max(z0 - 1, o.sill) }, { x: o.x1, y: Math.max(z0 - 1, o.sill) }, { x: o.x1, y: Math.min(top + 1, o.sill + o.height) }, { x: o.x0, y: Math.min(top + 1, o.sill + o.height) }]);
  for (const v of s.occl || []) if (v.y1 > z0 && v.y0 < top) holes.push([{ x: v.x0, y: Math.max(z0 - 1, v.y0) }, { x: v.x1, y: Math.max(z0 - 1, v.y0) }, { x: v.x1, y: Math.min(top + 1, v.y1) }, { x: v.x0, y: Math.min(top + 1, v.y1) }]);
  const items = holes.length ? G.differenceTree([rect], holes.map(G.ensureCCW)) : [{ outer: rect, holes: [] }];
  return { items, top, z0 };
}
/** Länge eines waagrechten Bands auf einer Wand ohne Öffnungen (mm) */
function bandLaenge(s, z0, z1) {
  let L = s.len;
  const iv = [];
  for (const o of s.openings) if (o.sill < z1 - 1 && o.sill + o.height > z0 + 1) iv.push([Math.max(o.x0, 0), Math.min(o.x1, s.len)]);
  for (const v of s.occl || []) if (v.y0 < z1 - 1 && v.y1 > z0 + 1) iv.push([v.x0, v.x1]);
  iv.sort((a, b) => a[0] - b[0]); let e = -Infinity;
  for (const [a, b] of iv) { const a2 = Math.max(a, e); if (b > a2) L -= b - a2; e = Math.max(e, b); }
  return Math.max(0, L);
}

/* ───────── Bauteile (Vorwand, Schacht, Wannenschürze …) ───────── */
const STD_WAND = { L: 600, B: 300, fuge: 2, verband: 'kreuz', farbe: '#f3f1ec', textur: 'glanz', name: 'Wandfliese' };
export function raumHoehe(doc, room) { const st = doc.storeyById(room.storey); return room.height || (st && st.roomHeight) || 2500; }
/** fliesbare Bauteile im Raum */
export function raumBauteile(doc, room) {
  if (!room || !room.poly) return [];
  return doc.all('symbol', room.storey).filter(sy => BAUTEIL_FLIESEN[sy.kind] && doc.visible(sy) !== false && G.pointInPoly(sy.p, room.poly));
}
export function bauteilHoehe(sy, H) { const def = BAUTEIL_FLIESEN[sy.kind] || { h: 0 }; const bf = sy.fliesen || {}; const v = bf.hoehe ?? def.h; return v > 0 ? Math.min(v, H) : H; }
function randAbstand(p, poly) { let m = Infinity; for (let i = 0; i < poly.length; i++) m = Math.min(m, G.closestOnSeg(p, poly[i], poly[(i + 1) % poly.length]).d); return m; }
/** die vier Seiten eines Bauteils – liegt die Seite an einer Wand an? */
export function bauteilSeiten(sy, room) {
  let fp = symbolFootprint(sy); const ccw = G.polyAreaSigned(fp) > 0;
  const out = fp.map((a, i) => {
    const b = fp[(i + 1) % 4]; const len = G.dist(a, b); const mid = G.mul(G.add(a, b), 0.5);
    const d = G.norm(G.sub(b, a)); const nOut = ccw ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x };
    const anliegend = randAbstand(mid, room.poly) < 40 || !G.pointInPoly(G.add(mid, G.mul(nOut, 35)), room.poly);
    return { i, a, b, len, anliegend };
  });
  // Rückseite = längste anliegende Seite (sonst lokal hinten); vorne gegenüber, links/rechts vom Betrachter aus
  const an = out.filter(o => o.anliegend).sort((p, q) => q.len - p.len)[0];
  const back = an ? an.i : 0, f = (back + 2) % 4, rechts = ccw ? (f + 1) % 4 : (f + 3) % 4;
  for (const o of out) o.name = o.i === f ? 'vorne' : o.i === back ? 'hinten' : o.i === rechts ? 'rechts' : 'links';
  return out;
}
/** Fliesenflächen aller gefliesten Bauteile eines Raums */
export function bauteilPlan(doc, room) {
  const tiles = room.tiles || {}; const wand = tiles.wand && tiles.wand.aktiv ? tiles.wand : null;
  const H = raumHoehe(doc, room); const out = [];
  for (const sy of raumBauteile(doc, room)) {
    const bf = sy.fliesen; if (!bf || !bf.aktiv) continue;
    const def = BAUTEIL_FLIESEN[sy.kind];
    const basis = wand || T.defaultTileCfg(STD_WAND);
    const cfg = bf.eigeneFliese ? Object.assign(mitFliese(basis, bf), bf.verband ? { verband: bf.verband } : {}) : basis;
    const h = bauteilHoehe(sy, H);
    const seiten = bauteilSeiten(sy, room); const faces = [];
    for (const sd of seiten) {
      sd.frei = !sd.anliegend && !(bf.seiten && bf.seiten[sd.name] === false) && sd.len >= 20;
      if (!sd.frei) continue;
      const region = { outer: [{ x: 0, y: 0 }, { x: sd.len, y: 0 }, { x: sd.len, y: h }, { x: 0, y: h }], holes: [] };
      const ox = (bf.xStart || 'optimal') === 'links' ? -cfg.fuge / 2 : bf.xStart === 'mitte' ? sd.len / 2 : T.bestOrigin(region, cfg, 'optimal').x;
      const r = T.layTiles(region, Object.assign({}, cfg, { origin: { x: ox, y: -cfg.fuge / 2 }, angle: cfg.angleWand || 0 }));
      r.pieces.forEach(p => { p.zcfg = cfg; });
      faces.push({ name: sd.name, len: sd.len, h, pieces: r.pieces, region, stats: r.stats, origin: r.origin });
    }
    let oben = null;
    if ((bf.oben ?? def.oben) && h < H - 10) {
      const region = { outer: [{ x: 0, y: 0 }, { x: sy.w, y: 0 }, { x: sy.w, y: sy.d }, { x: 0, y: sy.d }], holes: [] };
      const r = T.planTiles(region, Object.assign({}, cfg, { originMode: 'optimal', origin: null, angle: 0 }));
      r.pieces.forEach(p => { p.zcfg = cfg; });
      oben = { name: 'oben', len: sy.w, h: sy.d, pieces: r.pieces, region, stats: r.stats, origin: r.origin };
    }
    // Kanten: senkrechte Außenecken (zwei freie Seiten), Innenecken zur Wand (Silikon), obere Abschlusskante
    let aussen = 0, innen = 0;
    for (let i = 0; i < 4; i++) { const p = seiten[(i + 3) % 4], q = seiten[i]; if (p.frei && q.frei) aussen++; else if (p.frei !== q.frei && (p.anliegend || q.anliegend)) innen++; }
    const freiLen = faces.reduce((a, f) => a + f.len, 0);
    const kantenLfm = (aussen * h + (h < H - 10 ? freiLen : 0)) / 1000;
    const silikonLfm = (innen * h + freiLen) / 1000;
    out.push({ sy, name: sy.name || def.name, cfg, h, faces, oben, kantenLfm, silikonLfm, eigene: !!bf.eigeneFliese });
  }
  return out;
}
/** Bereiche einer Wand, die von Vorwand/Schacht/Wanne verdeckt sind (dort keine Wandfliesen) */
function verdeckt(doc, room, s, H, bts) {
  let nIn = G.perp(s.u); const mid = G.add(s.a, G.mul(s.u, s.len / 2));
  if (!G.pointInPoly(G.add(mid, G.mul(nIn, 60)), room.poly)) nIn = G.mul(nIn, -1);
  const out = [];
  for (const sy of bts) {
    const fp = symbolFootprint(sy); const ds = fp.map(p => G.dot(G.sub(p, s.a), nIn)), ts = fp.map(p => G.dot(G.sub(p, s.a), s.u));
    if (Math.min(...ds) > 40 || Math.max(...ds) < -40) continue;
    const x0 = Math.max(0, Math.min(...ts)), x1 = Math.min(s.len, Math.max(...ts)); if (x1 - x0 < 20) continue;
    out.push({ x0, x1, y0: 0, y1: bauteilHoehe(sy, H), name: sy.name || (BAUTEIL_FLIESEN[sy.kind] || {}).name || 'Bauteil', id: sy.id });
  }
  return out;
}
/** Felder einer Fliese (für Zonen mit eigener Fliese) */
const FL = ['name', 'hersteller', 'serie', 'artikel', 'artNr', 'L', 'B', 'fuge', 'staerke', 'farbe', 'farbe2', 'farbname', 'fugeFarbe', 'fugeMaterial', 'textur', 'bildData', 'quelle', 'material', 'rutsch', 'oberflaeche', 'preisM2', 'paketM2', 'stkPaket', 'lvPos', 'libId', 'verband', 'versatz', 'angleWand', 'katId'];
export function mitFliese(base, src) { const o = Object.assign({}, base); if (src) for (const k of FL) if (src[k] !== undefined && src[k] !== null && src[k] !== '') o[k] = src[k]; return o; }
export const fliesenKey = (c) => `${c.name || 'Fliese'}|${Math.round(c.L)}x${Math.round(c.B)}|${c.farbe || ''}|${c.hersteller || ''}`;
/** effektive Einstellung einer Wand (k) */
export function wandCfg(base, k) {
  const ov = base && base.einzeln && base.einzeln[k];
  if (!ov) return base;
  const e = mitFliese(base, ov.eigeneFliese ? ov : null);
  for (const key of ['aktiv', 'hoehe', 'unten', 'xModus', 'yModus', 'yHoehe']) if (ov[key] !== undefined) e[key] = ov[key];
  if (ov.verband && ov.eigeneFliese) e.verband = ov.verband;
  return e;
}
/** Sockel-Stückzahl */
export function sockelBedarf(lfm, sk, boden) {
  const res = 1 + ((sk.reserve ?? 10) / 100);
  if (sk.quelle === 'boden' && boden && boden.aktiv) {
    const streifenJeFliese = Math.max(1, Math.floor((boden.B + 2) / ((sk.hoehe || 60) + 5)));
    const stuecke = Math.ceil(lfm * 1000 / (boden.L + (boden.fuge || 3)));
    const fliesen = Math.ceil(stuecke / streifenJeFliese * res);
    return { stuecke, fliesen, streifenJeFliese, cfg: boden, m2: fliesen * boden.L * boden.B / 1e6 };
  }
  const L = Math.max(sk.L || 600, sk.B || 80); const stuecke = Math.ceil(lfm * 1000 / (L + (sk.fuge || 3)));
  return { stuecke, fliesen: Math.ceil(stuecke * res), streifenJeFliese: 1, cfg: sk, m2: 0 };
}

/** Wandfliesen (+ Zonen, Fries, Sockel) eines Raums berechnen */
export function wallTilePlan(doc, room, floorRes) {
  const tiles = room.tiles || {}; const base = tiles.wand && tiles.wand.aktiv ? tiles.wand : null; const sk = tiles.sockel && tiles.sockel.aktiv ? tiles.sockel : null;
  const bts = raumBauteile(doc, room); const btPlan = bauteilPlan(doc, room);
  if (!base && !sk && !btPlan.length) return null;
  const cfg0 = base || Object.assign(T.defaultTileCfg({ aktiv: false }), { name: 'keine Wandfliese' });
  const surfaces = wallSurfaces(doc, room); const Hraum = raumHoehe(doc, room);
  for (const s of surfaces) s.occl = verdeckt(doc, room, s, Hraum, bts);
  const out = []; let cum = 0;
  const fcfg = tiles.boden && tiles.boden.aktiv ? tiles.boden : null;
  const rows = new Map();
  const row = (c, art) => { const key = art + '|' + fliesenKey(c); let r = rows.get(key); if (!r) { r = { key, art, cfg: c, m2: 0, mit: 0, full: 0, cut: 0, krit: 0, warn: 0, laibung: 0, lfm: 0, waende: [] }; rows.set(key, r); } return r; };
  for (const s of surfaces) {
    const eff = base ? wandCfg(base, s.k) : null;
    const aktiv = !!(eff && eff.aktiv !== false);
    const top = aktiv ? (eff.hoehe === 'tuer' ? Math.min(s.H, tuerOK(s) || 2100) : eff.hoehe && eff.hoehe > 0 ? Math.min(eff.hoehe, s.H) : s.H) : 0;
    const z0 = aktiv ? Math.max(0, eff.unten || 0) : 0;
    // Zonen bilden
    const zonen = [], baender = [];
    if (aktiv && top > z0) {
      const fr = eff.fries && eff.fries.aktiv && eff.fries.z > z0 && eff.fries.z < top ? eff.fries : null;
      const ob = eff.oben && eff.oben.aktiv && eff.oben.ab > z0 + 50 && eff.oben.ab < top - 20 ? eff.oben : null;
      let iv = [[z0, top]];
      if (fr) { const b0 = fr.z, b1 = Math.min(top, fr.z + (fr.breite || 50)); baender.push({ z0: b0, z1: b1, art: 'fries', cfg: fr }); iv = [[z0, b0], [b1, top]].filter(([a, b]) => b - a > 5); }
      if (ob) iv = iv.flatMap(([a, b]) => ob.ab > a + 5 && ob.ab < b - 5 ? [[a, ob.ab], [ob.ab, b]] : [[a, b]]);
      iv.forEach(([a, b], i) => { const istOben = ob && a >= ob.ab - 1; zonen.push({ z0: a, z1: b, oben: istOben, cfg: istOben ? mitFliese(eff, ob) : eff, unterste: i === 0 }); });
    }
    if (sk && (!aktiv || z0 > 0)) baender.push({ z0: 0, z1: Math.min(sk.hoehe || 60, s.H), art: 'sockel', cfg: sk });
    const pieces = [], regions = [];
    let origin0 = null, mainStats = null;
    for (const zo of zonen) {
      const c = zo.cfg; const P = c.L + c.fuge;
      const { items } = wallRegions(s, zo.z0, zo.z1);
      let ox; const mode = c.xModus || 'ecke'; const ov = !zo.oben && c.wandOrigin && c.wandOrigin[s.k];
      if (ov) ox = ov.x;
      else if (mode === 'boden' && floorRes && fcfg && Math.abs(((fcfg.angle || 0) % 90 + 90) % 90) < 0.01 && !['diagonal', 'fischgrat', 'diagonalhalb'].includes(fcfg.verband)) {
        const F = floorRes.origin; const fx = fcfg.L + fcfg.fuge, fy = fcfg.B + fcfg.fuge;
        const rot90 = Math.abs(((fcfg.angle || 0) % 180 + 180) % 180 - 90) < 0.01;
        const along = Math.abs(s.u.x) > 0.99 ? 'x' : Math.abs(s.u.y) > 0.99 ? 'y' : null;
        const fp = along === 'x' ? (rot90 ? fy : fx) : (rot90 ? fx : fy);
        if (along && (Math.abs(fp - P) < 1.5 || Math.abs(fp - 2 * P) < 1.5 || Math.abs(2 * fp - P) < 1.5)) ox = G.dot(G.sub(F, s.a), s.u);
        else ox = -cum;
      }
      else if (mode === 'mitte') ox = s.len / 2;
      else if (mode === 'mitteFliese') ox = s.len / 2 - P / 2;
      else if (mode === 'optimal') { const o = T.bestOrigin({ outer: [{ x: 0, y: zo.z0 }, { x: s.len, y: zo.z0 }, { x: s.len, y: zo.z1 }, { x: 0, y: zo.z1 }], holes: [] }, c, 'optimal'); ox = o.x; }
      else ox = -cum;
      let oy; const ym = c.yModus || 'unten';
      if (ov && ov.y != null) oy = ov.y;
      else if (!zo.unterste && !zo.oben) oy = zo.z0 - c.fuge / 2; // über einem Fries: ganze Reihe
      else if (zo.oben && ym !== 'oben') oy = zo.z0 - c.fuge / 2;
      else if (ym === 'oben') oy = zo.z1 + c.fuge / 2;
      else if (ym === 'hoehe') oy = c.yHoehe || 1000;
      else if (ym === 'optimal') { const o = T.bestOrigin({ outer: [{ x: 0, y: zo.z0 }, { x: s.len, y: zo.z0 }, { x: s.len, y: zo.z1 }, { x: 0, y: zo.z1 }], holes: [] }, c, 'optimal'); oy = o.y; }
      else oy = zo.z0 - c.fuge / 2;
      const origin = { x: ox, y: oy };
      zo.pieces = []; zo.regions = []; zo.origin = origin;
      for (const it of items) { const r = T.layTiles(it, Object.assign({}, c, { origin, angle: c.angleWand || 0 })); zo.pieces.push(...r.pieces); zo.regions.push(it); }
      zo.stats = T.tileStats(zo.pieces, { outer: [{ x: 0, y: 0 }, { x: s.len, y: 0 }, { x: s.len, y: zo.z1 - zo.z0 }, { x: 0, y: zo.z1 - zo.z0 }], holes: [] }, c, c);
      zo.stats.area = zo.regions.reduce((a, it) => a + G.areaWithHoles(it), 0); zo.stats.m2 = zo.stats.area / 1e6;
      zo.pieces.forEach(p => { p.zcfg = c; });
      pieces.push(...zo.pieces); regions.push(...zo.regions);
      if (!origin0) origin0 = origin;
      const r = row(c, zo.oben ? 'oben' : 'wand'); r.m2 += zo.stats.m2; r.mit += zo.stats.mit; r.full += zo.stats.full; r.cut += zo.stats.cut; r.krit += zo.stats.krit; r.warn += zo.stats.warn; if (!r.waende.includes(s.k)) r.waende.push(s.k);
      if (!zo.oben && !mainStats) mainStats = zo.stats;
    }
    // Laibungen (Fenster/Türen innerhalb der Fliesenhöhe) – zur Hauptfliese
    let laibung = 0, schiene = 0;
    if (aktiv) {
      for (const o of s.openings) {
        const t = o.reveal ? o.reveal / 2 : 120;
        const yTop = Math.min(top, o.sill + o.height);
        if (o.kind === 'window' && o.sill < top) { const hh = yTop - Math.max(o.sill, z0); laibung += (2 * hh + o.x1 - o.x0) * t; schiene += 2 * hh + (o.x1 - o.x0) * (o.sill > z0 ? 1 : 0) + (yTop < o.sill + o.height ? 0 : (o.x1 - o.x0)); }
        else if (o.kind !== 'window') { const hh = Math.min(top, o.height); laibung += 2 * hh * t; schiene += 2 * hh; }
      }
      if (zonen.length) row(zonen.find(z => !z.oben) ? zonen.find(z => !z.oben).cfg : zonen[0].cfg, zonen.find(z => !z.oben) ? 'wand' : 'oben').laibung += laibung / 1e6;
    }
    for (const b of baender) {
      b.lfm = bandLaenge(s, b.z0, b.z1) / 1000;
      const r = row(b.art === 'sockel' ? (b.cfg.quelle === 'boden' && fcfg ? Object.assign({}, fcfg, { sockelH: b.cfg.hoehe }) : Object.assign({}, b.cfg, { L: Math.max(b.cfg.L || 600, b.cfg.B || 60), B: b.cfg.hoehe || 60 })) : Object.assign({}, b.cfg, { B: b.cfg.breite || 50 }), b.art); r.lfm += b.lfm; if (!r.waende.includes(s.k)) r.waende.push(s.k);
    }
    const stats = mainStats || { m2: 0, full: 0, cut: 0, krit: 0, warn: 0, mit: 0, ohne: 0 };
    out.push({ s, cfg: eff || cfg0, aktiv, zonen, baender, origin: origin0 || { x: 0, y: 0 }, pieces, regions, top, z0, stats, laibungM2: laibung / 1e6, schieneLfm: schiene / 1000, x0: cum });
    cum += s.len;
  }
  // Zeilen abschließen (Bestellmengen)
  for (const r of rows.values()) {
    const c = r.cfg; const res = 1 + ((c.reserve ?? (r.art === 'sockel' ? 10 : 5)) / 100);
    if (r.art === 'sockel') { const sb = sockelBedarf(r.lfm, sk, fcfg); r.bedarf = sb.fliesen; r.stuecke = sb.stuecke; r.streifen = sb.streifenJeFliese; r.ausBoden = sk.quelle === 'boden' && !!fcfg; r.m2Bestell = sb.m2; continue; }
    if (r.art === 'fries') { r.bedarf = Math.ceil(r.lfm * 1000 / ((c.L || 250) + (c.fuge ?? 2)) * res); r.m2Bestell = 0; continue; }
    const tileM2 = T.stueckM2(c);
    r.bedarf = Math.ceil((r.mit + Math.ceil(r.laibung / tileM2 * 1.3)) * res);
    r.m2Bestell = r.bedarf * tileM2; r.pakete = c.paketM2 > 0 ? Math.ceil(r.m2Bestell / c.paketM2 - 1e-9) : (c.stkPaket > 0 ? Math.ceil(r.bedarf / c.stkPaket) : null);
    r.fugeKg = (c.L + c.B) / (c.L * c.B) * c.fuge * (c.fugeTiefe || FUGENTIEFE(c.staerke)) * 1.6 * (r.m2 + r.laibung);
    r.kleberKg = T.materialRichtwerte(r.m2 + r.laibung, c).kleberKg;
    r.kosten = c.preisM2 > 0 ? r.m2Bestell * c.preisM2 : 0;
  }
  const flaechen = [...rows.values()].filter(r => r.art === 'wand' || r.art === 'oben');
  const sum = out.reduce((a, w) => { for (const z of w.zonen) { a.m2 += z.stats.m2; a.full += z.stats.full; a.cut += z.stats.cut; a.krit += z.stats.krit; a.warn += z.stats.warn; a.mit += z.stats.mit; a.ohne += z.stats.ohne; } a.laibung += w.laibungM2; a.schiene += w.schieneLfm; return a; }, { m2: 0, full: 0, cut: 0, krit: 0, warn: 0, mit: 0, ohne: 0, laibung: 0, schiene: 0 });
  sum.bedarf = flaechen.reduce((a, r) => a + r.bedarf, 0); sum.m2Bestell = flaechen.reduce((a, r) => a + r.m2Bestell, 0);
  sum.pakete = flaechen.length === 1 ? flaechen[0].pakete : null;
  sum.fugeKg = flaechen.reduce((a, r) => a + (r.fugeKg || 0), 0); sum.kleberKg = flaechen.reduce((a, r) => a + (r.kleberKg || 0), 0); sum.kosten = [...rows.values()].reduce((a, r) => a + (r.kosten || 0), 0);
  const innenEcken = surfaces.filter(s => s.eckeRechts === 'innen').length;
  const maxTop = Math.max(0, ...out.map(w => w.top));
  sum.silikonLfm = (surfaces.reduce((a, s) => a + s.len, 0) + innenEcken * maxTop) / 1000;
  sum.sockelLfm = [...rows.values()].filter(r => r.art === 'sockel').reduce((a, r) => a + r.lfm, 0);
  sum.friesLfm = [...rows.values()].filter(r => r.art === 'fries').reduce((a, r) => a + r.lfm, 0);
  sum.profilLfm = base && base.profil ? sum.schiene + out.filter(w => w.aktiv && w.top < w.s.H - 5).reduce((a, w) => a + bandLaenge(w.s, w.top - 5, w.top) / 1000, 0) : 0;
  // Bauteile: Flächen je Fliese
  for (const bt of btPlan) {
    const r = row(bt.cfg, 'bauteil'); if (!r.bauteile) r.bauteile = [];
    for (const f of bt.faces.concat(bt.oben ? [bt.oben] : [])) { r.m2 += f.stats.m2; r.mit += f.stats.mit; r.full += f.stats.full; r.cut += f.stats.cut; r.krit += f.stats.krit; r.warn += f.stats.warn; }
    r.bauteile.push(bt.name);
  }
  for (const r of rows.values()) if (r.art === 'bauteil') {
    const c = r.cfg; const tileM2 = T.stueckM2(c); const res = 1 + ((c.reserve ?? 5) / 100);
    r.bedarf = Math.ceil(r.mit * res); r.m2Bestell = r.bedarf * tileM2; r.pakete = c.paketM2 > 0 ? Math.ceil(r.m2Bestell / c.paketM2 - 1e-9) : (c.stkPaket > 0 ? Math.ceil(r.bedarf / c.stkPaket) : null);
    r.fugeKg = (c.L + c.B) / (c.L * c.B) * c.fuge * (c.fugeTiefe || FUGENTIEFE(c.staerke)) * 1.6 * r.m2; r.kleberKg = T.materialRichtwerte(r.m2, c).kleberKg; r.kosten = c.preisM2 > 0 ? r.m2Bestell * c.preisM2 : 0;
    sum.fugeKg += r.fugeKg; sum.kleberKg += r.kleberKg; sum.kosten += r.kosten;
  }
  sum.bauteilKanten = btPlan.reduce((a, b) => a + b.kantenLfm, 0); sum.silikonLfm += btPlan.reduce((a, b) => a + b.silikonLfm, 0);
  sum.rows = [...rows.values()];
  const btBreite = btPlan.length ? 800 + btPlan.reduce((a, b) => a + b.faces.reduce((x, f) => x + f.len + 300, 0) + (b.oben ? b.oben.len + 300 : 0) + 500, 0) : 0;
  return { cfg: cfg0, walls: out, sum, total: cum, rows: sum.rows, bauteile: btPlan, btBreite };
}
/** Oberkante der höchsten Tür einer Wand (für „Fliesen bis Türhöhe“) */
function tuerOK(s) { let m = 0; for (const o of s.openings) if (o.kind !== 'window') m = Math.max(m, o.sill + o.height); return m; }

/** Startpunkt-Maße (Abstand Fugenkreuz zu zwei Wandflächen entlang der Fliesenachsen) */
export function originDims(res, poly) {
  const o = res.origin; const ang = G.rad(res.cfg.angle || 0);
  const ex = { x: Math.cos(ang), y: Math.sin(ang) }, ey = { x: -Math.sin(ang), y: Math.cos(ang) };
  const ray = (d) => { let best = null; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const x = G.lineIntersect(o, d, a, G.sub(b, a)); if (!x) continue; const t = G.dot(G.sub(x, o), d); const c = G.closestOnSeg(x, a, b); if (t > 0.5 && c.d < 0.5 && (!best || t < best.t)) best = { t, p: x }; } return best; };
  const out = [];
  for (const [d, nm] of [[G.mul(ex, -1), 'x'], [G.mul(ey, -1), 'y']]) { const r = ray(d) || ray(G.mul(d, -1)); if (r) out.push({ from: r.p, to: o, len: r.t, axis: nm }); }
  return out;
}

/** Fliesen-Zusammenstellung über alle Räume (je Fliese eine Zeile) */
export function tileSummary(doc) {
  const rows = new Map();
  const add = (cfg, m2, stuck, raum, art, extra = {}) => {
    const key = (art === 'Sockel' ? 'S|' : art === 'Fries' ? 'F|' : '') + fliesenKey(cfg);
    const r = rows.get(key) || { name: cfg.name || 'Fliese', hersteller: cfg.hersteller || '', artikel: cfg.artikel || cfg.serie || '', L: cfg.L, B: cfg.B, m2: 0, stuck: 0, raeume: [], cfg, fugeKg: 0, kleberKg: 0, kosten: 0, lfm: 0, art };
    r.m2 += m2; r.stuck += stuck; r.raeume.push(`${raum} (${art})`); r.fugeKg += extra.fugeKg || 0; r.kleberKg += extra.kleberKg || 0; r.kosten += extra.kosten || 0; r.lfm += extra.lfm || 0; rows.set(key, r);
  };
  const raeume = [];
  for (const st of doc.p.storeys) {
    const geo = W.storeyGeometry(doc, st.id);
    for (const room of doc.all('room', st.id)) {
      if (!room.poly || !room.tiles) continue;
      const fr = floorTiles(doc, geo, room); const nm = `${room.nr ? room.nr + ' ' : ''}${room.name}`;
      const entry = { room, nm, st, boden: null, wand: null };
      if (fr) {
        const c = room.tiles.boden; add(c, fr.stats.m2, fr.stats.bedarf, nm, 'Boden', { fugeKg: fr.stats.fugeKg, kleberKg: T.materialRichtwerte(fr.stats.m2, c).kleberKg, kosten: c.preisM2 > 0 ? fr.stats.m2Bestell * c.preisM2 : 0 });
        if (fr.rand) add(fr.rand.cfg, fr.rand.stats.m2, fr.rand.stats.bedarf, nm, 'Randfries', { fugeKg: fr.rand.stats.fugeKg, kleberKg: T.materialRichtwerte(fr.rand.stats.m2, fr.rand.cfg).kleberKg, kosten: fr.rand.cfg.preisM2 > 0 ? fr.rand.stats.m2Bestell * fr.rand.cfg.preisM2 : 0 });
        entry.boden = fr;
      }
      const wp = wallTilePlan(doc, room, fr);
      if (wp) {
        for (const r of wp.rows) {
          if (r.art === 'sockel') add(r.cfg, 0, r.bedarf, nm, 'Sockel', { lfm: r.lfm });
          else if (r.art === 'fries') add(r.cfg, 0, r.bedarf, nm, 'Fries', { lfm: r.lfm });
          else add(r.cfg, r.m2 + r.laibung, r.bedarf, nm, r.art === 'oben' ? 'Wand oben' : r.art === 'bauteil' ? 'Bauteile (' + (r.bauteile || []).join(', ') + ')' : 'Wand', { fugeKg: r.fugeKg, kleberKg: r.kleberKg, kosten: r.kosten });
        }
        entry.wand = wp;
      }
      if (fr || wp) raeume.push(entry);
    }
  }
  for (const z of doc.p.elements.filter(e => e.type === 'tilezone')) {
    const res = zoneTiles(z); if (!res) continue;
    add(z.tiles, res.stats.m2, res.stats.bedarf, z.name || 'Fliesenfläche', 'Fläche', { fugeKg: res.stats.fugeKg, kleberKg: T.materialRichtwerte(res.stats.m2, z.tiles).kleberKg, kosten: z.tiles.preisM2 > 0 ? res.stats.m2Bestell * z.tiles.preisM2 : 0 });
  }
  return { rows: [...rows.values()], raeume };
}
