// TW-CAD – Auswertungen: Raumbuch (DIN 277 / WoFlV), Tür- und Fensterliste, Bauteilmengen, Plan-Prüfung
// Reine Rechenfunktionen (ohne DOM) – testbar mit node.
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import * as AB from './aufbau.js?v=20261028-0429';
import * as K from './katalog.js?v=20261028-0429';
import * as T from './treppe.js?v=20261028-0429';
import { buildRoof } from './roof.js?v=20261028-0429';
import { symbolFootprint, SYMBOLE, bewegungsFlaeche } from './render2d.js?v=20261028-0429';
import { FREI } from './frei.js?v=20261028-0429';

const m2 = (mm2) => mm2 / 1e6;

/* ───────── DIN 277 – Nutzungsgruppen ───────── */
export const DIN277 = [
  ['NUF1', 'NUF 1 – Wohnen und Aufenthalt'], ['NUF2', 'NUF 2 – Büroarbeit'], ['NUF3', 'NUF 3 – Produktion, Hand- und Maschinenarbeit'], ['NUF4', 'NUF 4 – Lagern, Verteilen, Verkaufen'],
  ['NUF5', 'NUF 5 – Bildung, Unterricht, Kultur'], ['NUF6', 'NUF 6 – Heilen und Pflegen'], ['NUF7', 'NUF 7 – Sonstige Nutzungen (Sanitär, Abstellen, Garage …)'],
  ['TF', 'TF 8 – Technische Anlagen'], ['VF', 'VF 9 – Verkehrserschließung'], ['AUSSEN', 'Außenfläche (Balkon, Terrasse, Loggia)']
];
export const DIN277_KURZ = { NUF1: 'NUF 1', NUF2: 'NUF 2', NUF3: 'NUF 3', NUF4: 'NUF 4', NUF5: 'NUF 5', NUF6: 'NUF 6', NUF7: 'NUF 7', TF: 'TF', VF: 'VF', AUSSEN: 'außen' };
const NAMENSREGELN = [
  [/balkon|terrasse|loggia|dachgarten|freisitz/i, 'AUSSEN'],
  [/flur|diele|gang|treppe|windfang|eingang|galerie|podest|aufzug|vorraum|foyer|halle/i, 'VF'],
  [/heiz|technik|hausanschl|\bhar\b|elektro|server|lüftung|tank/i, 'TF'],
  [/büro|buero|arbeitszimmer|besprech|empfang|sekretar/i, 'NUF2'],
  [/werkstatt|labor|produktion|großküche|grosskueche|gastro/i, 'NUF3'],
  [/abstell|lager|vorrat|speis|keller(?!bar)|archiv/i, 'NUF4'],
  [/schul|klasse|unterricht|bibliothek|seminar/i, 'NUF5'],
  [/praxis|behandl|pflege|therap/i, 'NUF6'],
  [/\bbad\b|bad\b|^bad|dusch|\bwc\b|toilett|sanit|umkleid|garderob|garage|carport|hausw|\bhwr\b|wasch/i, 'NUF7'],
];
export function nutzungVorschlag(name) { const n = String(name || ''); for (const [re, k] of NAMENSREGELN) if (re.test(n)) return k; return 'NUF1'; }
/** Aufenthaltsraum im Sinne der LBauO (zum nicht nur vorübergehenden Aufenthalt) */
export function istAufenthaltsraum(r, nutz) { if (r.aufenthalt === true) return true; if (r.aufenthalt === false) return false; return nutz === 'NUF1' || nutz === 'NUF2' || nutz === 'NUF5' || nutz === 'NUF6'; }

/* ───────── Bauordnung / Normwerte ───────── */
export const REGELWERKE = {
  RLP: { name: 'LBauO Rheinland-Pfalz', hoehe: 2400, dgHoehe: 2200, dgAnteil: 0.5, dgUnberuecksichtigt: 1500, licht: 1 / 10, lichtText: '1/10', quelle: '§ 43 Abs. 1 und 2, § 45 LBauO RLP' },
  MBO: { name: 'Musterbauordnung (MBO)', hoehe: 2400, dgHoehe: 2200, dgAnteil: 0.5, dgUnberuecksichtigt: 1500, licht: 1 / 8, lichtText: '1/8', quelle: '§ 47 MBO' }
};
export const BF_STUFEN = [['aus', 'aus'], ['bf', 'barrierefrei nutzbar (DIN 18040-2)'], ['r', 'rollstuhlgerecht „R“ (DIN 18040-2)']];
export function pruefEinstellungen(doc) { const s = doc.p.settings || {}; return { regel: REGELWERKE[s.pruefRegel] ? s.pruefRegel : (FREI ? 'MBO' : 'RLP'), bf: s.pruefBF || 'aus' }; }

/* ───────── Dach & lichte Höhe ───────── */
function daecher(doc) {
  const out = [];
  for (const rf of doc.p.roofs || []) {
    const st = doc.storeyById(rf.storey); if (!st) continue; const geo = W.storeyGeometry(doc, st.id); const pts = geo.outers.flat(); if (!pts.length) continue;
    const bb = G.bbox(pts); const ze = st.elevation + st.height + (rf.kniestock || 0);
    try { const R = buildRoof(rf, bb, ze); const dv = (rf.dicke || 280) / Math.cos(G.rad(Math.min(75, rf.neigung || 35))); out.push({ rf, st, R, dv }); } catch (e) { }
  }
  return out;
}
/** lichte Höhe an einem Punkt (mm) */
function hoeheAn(raumH, st, dachListe, p) {
  let h = raumH;
  for (const d of dachListe) if (d.st.id === st.id && !d.R.flat) h = Math.min(h, d.R.zAt(p) - d.dv - st.elevation);
  return Math.max(0, h);
}
/** Flächenanteile nach Höhe (Raster 100 mm) */
function hoehenAnteile(poly, raumH, st, dachListe) {
  const hatDach = dachListe.some(d => d.st.id === st.id && !d.R.flat);
  const A = G.polyArea(poly);
  if (!hatDach) { const b = raumH >= 2000 ? 'voll' : raumH >= 1000 ? 'halb' : 'null'; return { A, min: raumH, max: raumH, voll: b === 'voll' ? A : 0, halb: b === 'halb' ? A : 0, null: b === 'null' ? A : 0, ab220: raumH >= 2200 ? A : 0, ueber150: raumH > 1500 ? A : 0, schraege: false }; }
  const bb = G.bbox(poly); const s = Math.max(50, Math.min(150, Math.sqrt(A / 4000))); let n = 0; const c = { voll: 0, halb: 0, null: 0, ab220: 0, ueber150: 0 }; let mn = Infinity, mx = 0;
  for (let y = bb.y0 + s / 2; y < bb.y1; y += s) for (let x = bb.x0 + s / 2; x < bb.x1; x += s) {
    const p = { x, y }; if (!G.pointInPoly(p, poly)) continue; n++; const h = hoeheAn(raumH, st, dachListe, p); mn = Math.min(mn, h); mx = Math.max(mx, h);
    if (h >= 2000) c.voll++; else if (h >= 1000) c.halb++; else c.null++;
    if (h >= 2200) c.ab220++; if (h > 1500) c.ueber150++;
  }
  if (!n) return { A, min: raumH, max: raumH, voll: A, halb: 0, null: 0, ab220: A, ueber150: A, schraege: false };
  const f = A / n; return { A, min: mn, max: mx, voll: c.voll * f, halb: c.halb * f, null: c.null * f, ab220: c.ab220 * f, ueber150: c.ueber150 * f, schraege: mn < raumH - 5 };
}

/* ───────── Öffnungen je Raum ───────── */
function raumAnPunkt(raeume, pt) { let best = null, ba = Infinity; for (const r of raeume) if (r.poly && G.pointInPoly(pt, r.poly)) { const a = G.polyArea(r.poly); if (a < ba) { ba = a; best = r; } } return best; }
function oeffnungsRaeume(raeume, op) {
  const d = op.g.w.thickness / 2 + 60; const c = op.center;
  return [raumAnPunkt(raeume, G.add(c, G.mul(op.g.n, d))), raumAnPunkt(raeume, G.sub(c, G.mul(op.g.n, d)))];
}
export function tuerLicht(o) {
  const art = o.art || 'dreh1';
  if (art.startsWith('dreh2') || art === 'schiebe2') { const b = K.TUER_BREITEN_2.find(x => x.rb === o.width); if (b) return b.licht; return o.width - 90; }
  if (art === 'haustuer' || art === 'haustuer_st' || art === 'nebeneingang') return o.width - (art === 'haustuer_st' ? 520 : 150);
  if (art === 'garagentor') return o.width - 60;
  if (art.startsWith('schiebe')) return o.width - 40;
  const b = K.TUER_BREITEN_1.find(x => x.rb === o.width); return b ? b.licht : o.width - 60;
}
function tuerLichtHoehe(o) { const hh = K.TUER_HOEHEN.find(x => x.rb === o.height); return hh ? hh.licht : o.height - 37; }

/* ───────── Raumbuch ───────── */
export function raumbuch(doc) {
  const dl = daecher(doc); const zeilen = []; const geschosse = [];
  for (const st of doc.p.storeys) {
    const geo = W.storeyGeometry(doc, st.id); const raeume = doc.all('room', st.id).filter(r => r.poly && r.poly.length >= 3);
    const fenster = new Map(); for (const r of raeume) fenster.set(r.id, { anz: 0, flaeche: 0, tueren: 0 });
    for (const op of geo.openings) {
      const rs = oeffnungsRaeume(raeume, op); const o = op.o;
      for (const r of rs) if (r) { const f = fenster.get(r.id); if (o.kind === 'window') { f.anz++; f.flaeche += o.width * o.height; } else f.tueren++; }
    }
    for (const df of doc.all('dachfenster')) { const r = raumAnPunkt(raeume, df.p); if (r) { const f = fenster.get(r.id); f.anz++; f.flaeche += (df.breite || 780) * (df.laenge || 1180); } }
    let summe = { nrf: 0, wfl: 0 };
    for (const r of raeume) {
      const raumH = r.height || st.roomHeight || (st.height - (st.slab || 200)); const nutz = r.nutzung || nutzungVorschlag(r.name);
      const ha = hoehenAnteile(r.poly, raumH, st, dl); const A = ha.A; const U = G.polyPerimeter(r.poly);
      // WoFlV
      let wfl, wflRegel;
      const keller = /keller|^kg$|^ug$|untergeschoss/i.test(st.name || '');
      const mode = r.woflv || 'auto';
      if (mode === '0' || (mode === 'auto' && (nutz === 'TF' || /garage|carport|heiz|keller|technik/i.test(r.name || '') || keller))) { wfl = 0; wflRegel = keller ? 'Zubehörraum (Keller) – § 2 Abs. 3 WoFlV' : 'nicht Wohnfläche – § 2 Abs. 3 WoFlV'; }
      else if (mode === '25' || (mode === 'auto' && nutz === 'AUSSEN')) { wfl = A * 0.25; wflRegel = '¼ – § 4 Nr. 4 WoFlV'; }
      else if (mode === '50') { wfl = A * 0.5; wflRegel = '½ – § 4 Nr. 3/4 WoFlV'; }
      else if (mode === '100') { wfl = A; wflRegel = 'voll'; }
      else { wfl = ha.voll + ha.halb * 0.5; wflRegel = ha.schraege ? `Dachschräge: ≥2 m voll, 1–2 m halb, <1 m nicht – § 4 Nr. 1/2 WoFlV` : raumH >= 2000 ? 'voll – § 4 Nr. 1 WoFlV' : raumH >= 1000 ? '½ – § 4 Nr. 2 WoFlV' : '0 – unter 1 m'; }
      const f = fenster.get(r.id);
      zeilen.push({ id: r.id, geschoss: st.name, storey: st.id, nr: r.nr || '', name: r.name || 'Raum', nutzung: nutz, nutzungAuto: !r.nutzung, flaeche: m2(A), umfang: U / 1000, hoehe: raumH, hoeheMin: ha.min, hoeheMax: ha.max, schraege: ha.schraege,
        wfl: m2(wfl), wflRegel, woflv: mode, aufenthalt: istAufenthaltsraum(r, nutz), fensterAnz: f.anz, fensterFlaeche: m2(f.flaeche), tueren: f.tueren, anteil220: A ? ha.ab220 / Math.max(1, ha.ueber150) : 1, ueber150: m2(ha.ueber150), volumen: m2(A) * raumH / 1000 });
      summe.nrf += m2(A); summe.wfl += m2(wfl);
    }
    let bgf = 0; for (const it of geo.body) bgf += G.polyArea(it.outer);
    bgf = m2(bgf); const nrf = summe.nrf;
    geschosse.push({ id: st.id, name: st.name, bgf, nrf, kgf: Math.max(0, bgf - nrf), wfl: summe.wfl, bri: bgf * (st.height || 2750) / 1000, raeume: raeume.length });
  }
  // DIN 277 Summen
  const din = {}; for (const [k] of DIN277) din[k] = 0; for (const z of zeilen) din[z.nutzung] = (din[z.nutzung] || 0) + z.flaeche;
  const nuf = Object.entries(din).filter(([k]) => k.startsWith('NUF')).reduce((s, [, v]) => s + v, 0);
  const tot = geschosse.reduce((s, g) => ({ bgf: s.bgf + g.bgf, nrf: s.nrf + g.nrf, kgf: s.kgf + g.kgf, wfl: s.wfl + g.wfl, bri: s.bri + g.bri }), { bgf: 0, nrf: 0, kgf: 0, wfl: 0, bri: 0 });
  return { zeilen, geschosse, din, nuf, tf: din.TF, vf: din.VF, aussen: din.AUSSEN, summe: tot };
}

/* ───────── Tür- und Fensterliste ───────── */
export function oeffnungsliste(doc) {
  const tueren = [], fenster = []; let nt = 0, nf = 0;
  for (const st of doc.p.storeys) {
    const geo = W.storeyGeometry(doc, st.id); const raeume = doc.all('room', st.id).filter(r => r.poly);
    const ops = geo.openings.slice().sort((a, b) => (a.o.kind > b.o.kind ? 1 : -1) || (a.center.y - b.center.y) || (a.center.x - b.center.x));
    for (const op of ops) {
      const o = op.o; const rs = oeffnungsRaeume(raeume, op).map(r => r ? `${r.nr ? r.nr + ' ' : ''}${r.name || 'Raum'}` : 'außen');
      const wand = op.g.w; const ab = AB.aufbauById(wand.aufbau);
      if (o.kind === 'window') {
        nf++; fenster.push({ id: o.id, pos: `F${String(nf).padStart(2, '0')}`, geschoss: st.name, raum: rs[0] === 'außen' ? rs[1] : rs[0], typ: K.FENSTER_TYPEN.find(x => x[0] === o.typ)?.[1] || 'Fenster', breite: o.width, hoehe: o.height, bruestung: o.sill || 0, flaeche: m2(o.width * o.height),
          material: K.FENSTER_MATERIAL.find(x => x[0] === o.material)?.[1] || '', glas: K.GLAS.find(x => x[0] === o.glas)?.[1] || '', sonnenschutz: K.SONNENSCHUTZ.find(x => x[0] === o.sonnenschutz)?.[1] || '', wand: ab ? ab.name : `${G.fmtCm(wand.thickness)} cm`, oberflaeche: '' });
      } else {
        nt++; const art = o.kind === 'opening' ? 'Durchgang' : (K.TUER_ARTEN.find(x => x[0] === o.art)?.[1] || 'Tür');
        tueren.push({ id: o.id, pos: `T${String(nt).padStart(2, '0')}`, geschoss: st.name, von: rs[0], nach: rs[1], art, breite: o.width, hoehe: o.height, licht: o.kind === 'opening' ? o.width : tuerLicht(o), lichtH: o.kind === 'opening' ? o.height : tuerLichtHoehe(o),
          anschlag: o.kind === 'opening' || (o.art || '').startsWith('schiebe') ? '–' : (o.hinge === 'rechts' ? 'DIN rechts' : 'DIN links'), zarge: K.ZARGEN.find(x => x[0] === o.zarge)?.[1] || '', brandschutz: o.brandschutz || '', schwelle: K.SCHWELLEN.find(x => x[0] === o.schwelle)?.[1] || '', wand: `${G.fmtCm(wand.thickness)} cm` });
      }
    }
  }
  return { tueren, fenster };
}

/* ───────── Bauteilmengen ───────── */
export function bauteilmengen(doc) {
  const waende = new Map(), schichten = new Map(); const decken = [], koerper = [], balken = [], sonst = [];
  for (const st of doc.p.storeys) {
    const geo = W.storeyGeometry(doc, st.id);
    for (const [id, g] of geo.wg) {
      const w = g.w; const H = w.height || st.height; const L = G.dist(g.a, g.b);
      let off = 0; for (const op of geo.openings) if (op.g === g) off += op.o.width * Math.min(op.o.height, Math.max(0, H - (op.o.sill || 0)));
      const ab = AB.aufbauById(w.aufbau); const sch = AB.schichten(w);
      const key = `${st.name}|${w.art === 'aussen' ? 'Außenwand' : 'Innenwand'}|${ab ? ab.name : (sch ? 'eigener Aufbau' : (w.material || 'mauerwerk'))}|${w.thickness}`;
      const z = waende.get(key) || { geschoss: st.name, art: w.art === 'aussen' ? 'Außenwand' : 'Innenwand', bez: ab ? ab.name : (sch ? 'eigener Aufbau' : matName(w.material)), dicke: w.thickness, anz: 0, laenge: 0, brutto: 0, oeff: 0, netto: 0, vol: 0 };
      z.anz++; z.laenge += L / 1000; z.brutto += m2(L * H); z.oeff += m2(off); z.netto += m2(L * H - off); z.vol += m2(L * H - off) * w.thickness / 1000; waende.set(key, z);
      if (sch) for (const [mat, d] of sch) { const k2 = `${mat}|${d}`; const s = schichten.get(k2) || { mat, name: (AB.SCHICHT_MAT[mat] || {}).name || mat, dicke: d, flaeche: 0, vol: 0 }; s.flaeche += m2(L * H - off); s.vol += m2(L * H - off) * d / 1000; schichten.set(k2, s); }
    }
    // Decke über dem Geschoss (Bruttofläche minus Durchbrüche)
    let A = 0; for (const it of geo.body) A += G.polyArea(it.outer);
    let loch = 0; for (const d of doc.all('durchbruch', st.id)) if (d.pts && d.pts.length >= 3) loch += G.polyArea(d.pts);
    if (A > 0) decken.push({ geschoss: st.name, art: 'Decke/Bodenplatte über ' + st.name, dicke: st.slab || 200, brutto: m2(A), loch: m2(loch), netto: m2(A - loch), vol: m2(A - loch) * (st.slab || 200) / 1000 });
    for (const k of doc.all('koerper', st.id)) { if (!k.pts || k.pts.length < 3) continue; const a = G.polyArea(k.pts); const hh = (k.z1 ?? (st.roomHeight || 2500)) - (k.z0 || 0); koerper.push({ geschoss: st.name, art: k.art || 'koerper', flaeche: m2(a), hoehe: hh, vol: m2(a) * hh / 1000, mantel: G.polyPerimeter(k.pts) * hh / 1e6 }); }
    for (const b of doc.all('balken', st.id)) { const L = G.dist(b.a, b.b); balken.push({ geschoss: st.name, material: b.material || 'beton', laenge: L / 1000, querschnitt: `${G.fmtCm(b.breite || 240)}/${G.fmtCm(b.hoehe || 300)}`, vol: L * (b.breite || 240) * (b.hoehe || 300) / 1e9 }); }
    const nSt = doc.all('column', st.id).length; if (nSt) sonst.push({ geschoss: st.name, was: 'Stützen', menge: nSt, einheit: 'Stk' });
    for (const s of doc.all('stair', st.id)) { let k = null; try { k = T.kennwerte(s, st.height); } catch (e) { } sonst.push({ geschoss: st.name, was: `Treppe (${(K.TREPPEN_FORMEN.find(f => f[0] === s.form) || [0, s.form])[1]}), Laufbreite ${G.fmtCm(s.w || 1000)} cm${k ? `, ${k.n} Steigungen ${G.fmtCm(k.h)}/${G.fmtCm(k.a)} cm` : ''}`, menge: 1, einheit: 'Stk' }); }
  }
  // Dach
  for (const d of daecher(doc)) {
    let A = 0; for (const f of d.R.faces) { const p = f.poly; const a = G.polyArea(p); A += d.R.flat ? a : a / Math.cos(G.rad(Math.min(75, d.rf.neigung || 35))); }
    sonst.push({ geschoss: d.st.name, was: `Dachfläche ${d.rf.typ || 'sattel'} ${d.R.flat ? '' : (d.rf.neigung || 35) + '°'} (inkl. Überstand)`, menge: m2(A), einheit: 'm²' });
  }
  const ndf = doc.all('dachfenster').length; if (ndf) sonst.push({ geschoss: '', was: 'Dachfenster', menge: ndf, einheit: 'Stk' });
  const ng = doc.all('gaube').length; if (ng) sonst.push({ geschoss: '', was: 'Gauben', menge: ng, einheit: 'Stk' });
  const ol = oeffnungsliste(doc);
  if (ol.fenster.length) sonst.push({ geschoss: '', was: 'Fenster (Rohbaumaß)', menge: ol.fenster.reduce((s, f) => s + f.flaeche, 0), einheit: 'm²', zusatz: `${ol.fenster.length} Stk` });
  if (ol.tueren.length) sonst.push({ geschoss: '', was: 'Türen und Durchgänge', menge: ol.tueren.length, einheit: 'Stk' });
  return { waende: [...waende.values()], schichten: [...schichten.values()].sort((a, b) => b.flaeche - a.flaeche), decken, koerper, balken, sonst };
}
const MAT_NAMEN = { mauerwerk: 'Mauerwerk', ziegel: 'Hochlochziegel', ks: 'Kalksandstein', poren: 'Porenbeton', beton: 'Stahlbeton', leicht: 'Leichtbeton/Bims', trockenbau: 'Trockenbau', holz: 'Holzständer', glasbaustein: 'Glasbaustein' };
const matName = (m) => MAT_NAMEN[m] || m || 'Mauerwerk';

/* ───────── Plan-Prüfung ───────── */
const BEWEGUNG_KAT = new Set(['wc', 'wt', 'wanne']);
const BEWEGUNG_KIND = new Set(['wcbf', 'wtbf', 'dusche', 'walkin', 'duschtasse']);
const FREI_KIND = new Set(['bewegung', 'ablauf', 'rinne', 'duschwand', 'haltegriff', 'stuetzgriff', 'duschsitz', 'dusche', 'walkin']);
/** Liefert [{stufe:'fehler'|'warn'|'info'|'ok', kat, text, regel, id, storey}] */
export function planPruefung(doc) {
  const E = pruefEinstellungen(doc); const R = REGELWERKE[E.regel]; const out = [];
  const add = (stufe, kat, text, regel = '', id = null, storey = null) => out.push({ stufe, kat, text, regel, id, storey });
  const rb = raumbuch(doc);
  // 1) Räume
  for (const z of rb.zeilen) {
    const n = `${z.nr ? z.nr + ' ' : ''}${z.name} (${z.geschoss})`;
    if (!z.name || z.name === 'Raum') add('info', 'Räume', `Raum ohne Bezeichnung (${z.geschoss}, ${z.flaeche.toFixed(2).replace('.', ',')} m²)`, 'Für Raumbuch und Wohnflächenberechnung Bezeichnung vergeben.', z.id, z.storey);
    if (z.tueren === 0 && z.nutzung !== 'AUSSEN') add('warn', 'Räume', `${n}: keine Tür und kein Durchgang erkannt`, 'Zugang prüfen – oder Tür/Durchgang einzeichnen.', z.id, z.storey);
    if (!z.aufenthalt) continue;
    if (z.schraege) {
      const anteil = z.ueber150 > 0 ? z.anteil220 : 0;
      if (anteil + 1e-6 < R.dgAnteil) add('fehler', 'Raumhöhe', `${n}: nur ${(anteil * 100).toFixed(0)} % der Fläche mit ≥ ${G.fmtM(R.dgHoehe)} m lichter Höhe (gefordert ${R.dgAnteil * 100} %)`, `${R.name}: Aufenthaltsräume im Dachgeschoss ${G.fmtM(R.dgHoehe)} m über mind. der Hälfte der Grundfläche; Raumteile bis ${G.fmtM(R.dgUnberuecksichtigt)} m bleiben außer Betracht (${R.quelle}).`, z.id, z.storey);
      else add('ok', 'Raumhöhe', `${n}: Dachschräge – ${(anteil * 100).toFixed(0)} % mit ≥ ${G.fmtM(R.dgHoehe)} m`, R.quelle, z.id, z.storey);
    } else if (z.hoehe < R.hoehe) add('fehler', 'Raumhöhe', `${n}: lichte Höhe ${G.fmtM(z.hoehe)} m < ${G.fmtM(R.hoehe)} m`, `${R.name}: Aufenthaltsräume brauchen eine lichte Höhe von ${G.fmtM(R.hoehe)} m (${R.quelle}).`, z.id, z.storey);
    else add('ok', 'Raumhöhe', `${n}: lichte Höhe ${G.fmtM(z.hoehe)} m`, R.quelle, z.id, z.storey);
    // Belichtung (bei Dachschräge zählt die Fläche > 1,50 m)
    const bezug = z.schraege ? z.ueber150 : z.flaeche; const soll = bezug * R.licht;
    if (z.fensterAnz === 0) add('fehler', 'Belichtung', `${n}: Aufenthaltsraum ohne Fenster`, `${R.name}: Aufenthaltsräume brauchen Fenster ins Freie, Rohbaumaß mind. ${R.lichtText} der Grundfläche (${R.quelle}).`, z.id, z.storey);
    else if (z.fensterFlaeche + 1e-6 < soll) add('warn', 'Belichtung', `${n}: Fensterfläche ${z.fensterFlaeche.toFixed(2).replace('.', ',')} m² < ${R.lichtText} der Grundfläche (${soll.toFixed(2).replace('.', ',')} m²)`, `${R.name}: Fensterrohbaumaß mind. ${R.lichtText} der Grundfläche (${R.quelle}). Größeres Fenster oder zusätzliches Fenster/Dachfenster vorsehen.`, z.id, z.storey);
    else add('ok', 'Belichtung', `${n}: Fenster ${z.fensterFlaeche.toFixed(2).replace('.', ',')} m² ≥ ${soll.toFixed(2).replace('.', ',')} m²`, R.quelle, z.id, z.storey);
  }
  // 2) Türen
  const ol = oeffnungsliste(doc);
  for (const t of ol.tueren) {
    const st = doc.p.storeys.find(s => s.name === t.geschoss); const sid = st && st.id; const eingang = t.von === 'außen' || t.nach === 'außen';
    if (E.bf !== 'aus') { const soll = eingang || E.bf === 'r' ? 900 : 800; if (t.licht < soll) add('fehler', 'Türen', `${t.pos} ${t.art} (${t.von} ↔ ${t.nach}): lichte Breite ca. ${G.fmtCm(t.licht)} cm < ${G.fmtCm(soll)} cm`, `DIN 18040-2: lichte Durchgangsbreite ${eingang ? 'Eingangstür' : E.bf === 'r' ? 'R-Wohnung' : 'innerhalb der Wohnung'} mind. ${G.fmtCm(soll)} cm. Nächstgrößeres Türmaß wählen (z. B. ${soll >= 900 ? '101' : '88,5'} cm Rohbaumaß).`, t.id, sid); }
    if (E.bf !== 'aus' && t.lichtH < 2050) add('warn', 'Türen', `${t.pos}: lichte Höhe ca. ${G.fmtCm(t.lichtH)} cm < 205 cm`, 'DIN 18040-2: lichte Höhe mind. 2,05 m.', t.id, sid);
    if (t.breite < 735 && t.art !== 'Durchgang') add('info', 'Türen', `${t.pos} ${t.art}: Rohbaumaß ${G.fmtCm(t.breite)} cm – nur für Nebenräume üblich`, 'Für Wohnräume sind 88,5 cm Rohbaumaß üblich.', t.id, sid);
    if (eingang && t.licht < 900 && E.bf === 'aus') add('info', 'Türen', `${t.pos} Eingang: lichte Breite ca. ${G.fmtCm(t.licht)} cm`, 'Für Eingangstüren wird mind. 90 cm lichte Breite empfohlen (Möbeltransport, barrierefrei).', t.id, sid);
  }
  // 3) Fenster: Brüstung in Obergeschossen
  for (const st of doc.p.storeys) {
    if ((st.elevation || 0) < 1000) continue; const geo = W.storeyGeometry(doc, st.id);
    for (const op of geo.openings) { const o = op.o; if (o.kind !== 'window') continue; const sill = o.sill || 0;
      if (sill < 800) add('warn', 'Absturzsicherung', `Fenster im ${st.name}: Brüstung ${G.fmtCm(sill)} cm < 80 cm`, `Brüstung unter 80 cm (${K.istBodentief(o.typ) ? 'bodentief' : 'niedrige Brüstung'}) – Absturzsicherung (Geländer, Glasbrüstung, französischer Balkon) vorsehen; Anforderungen der Landesbauordnung prüfen.`, o.id, st.id); }
  }
  // 4) Treppen DIN 18065
  for (const st of doc.p.storeys) for (const s of doc.all('stair', st.id)) {
    let k; try { k = T.kennwerte(s, st.height); } catch (e) { continue; }
    const txt = `${k.n} Steigungen · s = ${G.fmtCm(k.h)} cm · a = ${G.fmtCm(k.a)} cm · 2s+a = ${G.fmtCm(k.sm)} cm · Laufbreite ${G.fmtCm(s.w || 1000)} cm`;
    const f = []; if (k.h < 140 || k.h > 200) f.push('Steigung 14–20 cm'); if (k.a < 230 || k.a > 370) f.push('Auftritt 23–37 cm'); if (k.sm < 590 || k.sm > 650) f.push('Schrittmaß 59–65 cm'); if ((s.w || 1000) < 800) f.push('Laufbreite mind. 80 cm');
    if (f.length) add('fehler', 'Treppen', `Treppe ${st.name}: ${txt}`, `DIN 18065 (Wohngebäude bis 2 Wohnungen): ${f.join(', ')} nicht eingehalten. Tipp: Treppe anklicken → „Maße automatisch“.`, s.id, st.id);
    else add('ok', 'Treppen', `Treppe ${st.name}: ${txt}`, 'DIN 18065 eingehalten.', s.id, st.id);
  }
  // 5) Objekte in Wänden / Bewegungsflächen
  for (const st of doc.p.storeys) {
    const geo = W.storeyGeometry(doc, st.id); const raeume = doc.all('room', st.id).filter(r => r.poly); const syms = doc.all('symbol', st.id);
    const wandPolys = [...geo.wg.values()].map(g => G.ensureCCW(g.poly));
    for (const s of syms) {
      const def = SYMBOLE[s.kind] || {}; if (s.aussparen || def.kat === 'bau' || def.kat === 'aussen' || def.kat === 'inst') continue;
      const fp = symbolFootprint(s); const ov = wandPolys.length ? G.intersectPolys([G.ensureCCW(fp)], wandPolys).reduce((a, p) => a + G.polyArea(p), 0) : 0;
      if (ov > 0.02 * G.polyArea(fp) && ov > 2000) add('warn', 'Objekte', `${def.name || s.kind} (${st.name}) steht ${Math.round(ov / 1e4)} cm² in der Wand`, 'Objekt verschieben oder Maße prüfen.', s.id, st.id);
    }
    if (E.bf === 'aus') continue;
    const B = E.bf === 'r' ? 1500 : 1200;
    for (const s of syms) {
      const def = SYMBOLE[s.kind] || {}; if (!(BEWEGUNG_KAT.has(def.kat) || BEWEGUNG_KIND.has(s.kind))) continue;
      const raum = raumAnPunkt(raeume, s.p); if (!raum) continue;
      const fp = symbolFootprint(s); const r = G.rad(s.rot || 0); const fwd = G.rot({ x: 0, y: 1 }, r); const side = G.rot({ x: 1, y: 0 }, r);
      const istDusche = def.kat === 'dusche';
      let rect;
      if (istDusche) { // Duschplatz selbst muss B × B haben (bodengleich)
        if (Math.min(s.w, s.d) < B) add('fehler', 'Bewegungsfläche', `${def.name} ${G.fmtCm(s.w)}×${G.fmtCm(s.d)} cm (${raum.name || 'Raum'}): Duschplatz kleiner als ${G.fmtCm(B)}×${G.fmtCm(B)} cm`, `DIN 18040-2: niveaugleicher Duschplatz mind. ${G.fmtM(B)} × ${G.fmtM(B)} m.`, s.id, st.id);
        if (s.kind === 'duschtasse' && !s.bodengleich) add('warn', 'Bewegungsfläche', `${def.name} (${raum.name || 'Raum'}): Duschtasse mit Rand`, 'DIN 18040-2: Duschplatz niveaugleich (max. 2 cm) zum angrenzenden Boden.', s.id, st.id);
        continue;
      }
      rect = bewegungsFlaeche(s, B, raum.poly);
      const ccw = G.ensureCCW(rect); const aussen = G.differencePolys([ccw], [G.ensureCCW(raum.poly)]).reduce((a, p) => a + G.polyArea(p), 0);
      let belegt = 0; const wer = [];
      for (const o of syms) { if (o === s) continue; const d2 = SYMBOLE[o.kind] || {}; if (FREI_KIND.has(o.kind) || d2.kat === 'dusche' && o.kind !== 'duschtasse' && o.kind !== 'duschviertel') continue; const a = G.intersectPolys([ccw], [G.ensureCCW(symbolFootprint(o))]).reduce((x, p) => x + G.polyArea(p), 0); if (a > 5000) { belegt += a; wer.push(d2.name || o.kind); } }
      const name = `${def.name || s.kind} (${raum.nr ? raum.nr + ' ' : ''}${raum.name || 'Raum'})`;
      if (aussen > 0.03 * B * B || belegt > 0) add('fehler', 'Bewegungsfläche', `${name}: Bewegungsfläche ${G.fmtCm(B)}×${G.fmtCm(B)} cm davor nicht frei${aussen > 0.03 * B * B ? ' – reicht in die Wand' : ''}${wer.length ? ' – belegt durch ' + [...new Set(wer)].join(', ') : ''}`, `DIN 18040-2: vor ${def.kat === 'wc' ? 'WC' : def.kat === 'wt' ? 'Waschtisch' : 'Badewanne'} Bewegungsfläche ${G.fmtM(B)} × ${G.fmtM(B)} m (überlagern sich gegenseitig zulässig).`, s.id, st.id);
      else add('ok', 'Bewegungsfläche', `${name}: ${G.fmtCm(B)}×${G.fmtCm(B)} cm frei`, 'DIN 18040-2', s.id, st.id);
    }
  }
  return out;
}

/* ───────── Planindex ───────── */
export function naechsterIndex(revs) {
  const last = (revs || []).map(r => r.index).filter(Boolean).pop(); if (!last) return 'a';
  if (/^[a-y]$/.test(last)) return String.fromCharCode(last.charCodeAt(0) + 1); if (/^[A-Y]$/.test(last)) return String.fromCharCode(last.charCodeAt(0) + 1);
  if (/^\d+$/.test(last)) return String(+last + 1); return last + "'";
}
export const PLANSTATUS = [['', '–'], ['vorabzug', 'Vorabzug'], ['entwurf', 'Entwurfsplanung'], ['genehmigung', 'Genehmigungsplanung'], ['ausfuehrung', 'Ausführungsplanung'], ['werkplan', 'Werkplan / Verlegeplan'], ['bestand', 'Bestandsplan'], ['revision', 'Revisionsplan']];

/* ───────── CSV ───────── */
export function csv(kopf, zeilen) {
  const esc = (v) => { const s = typeof v === 'number' ? v.toLocaleString('de-DE', { maximumFractionDigits: 3 }) : String(v ?? ''); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  return '﻿' + [kopf, ...zeilen].map(r => r.map(esc).join(';')).join('\r\n');
}
