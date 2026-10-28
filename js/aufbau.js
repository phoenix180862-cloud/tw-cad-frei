// TW-CAD – Mehrschichtige Wände (Wandaufbauten): Schichten-Katalog, Darstellung im Grundriss/Schnitt, Kennwerte
import * as G from './geom.js?v=20261028-0429';

/** Schicht-Materialien: Füllfarbe, Schraffur, Wärmeleitfähigkeit λ (W/mK, Richtwert) */
export const SCHICHT_MAT = {
  putz: { name: 'Putz', fill: '#f4f2ee', hatch: 'punkt', lambda: 0.7 },
  ks: { name: 'Kalksandstein', fill: '#f1ecdd', hatch: 'diag', lambda: 0.99 },
  ziegel: { name: 'Hochlochziegel', fill: '#f4dccb', hatch: 'diag', lambda: 0.16 },
  ziegelgef: { name: 'Ziegel gedämmt (Perlit)', fill: '#f4dccb', hatch: 'diag', lambda: 0.08 },
  porenbeton: { name: 'Porenbeton', fill: '#f6f6ef', hatch: 'diag2', lambda: 0.11 },
  mauerwerk: { name: 'Mauerwerk', fill: '#f1ecdd', hatch: 'diag', lambda: 0.6 },
  beton: { name: 'Stahlbeton', fill: '#d9d9d9', hatch: 'kreuz', lambda: 2.3 },
  leichtbeton: { name: 'Leichtbeton / Bims', fill: '#e9e5dc', hatch: 'diag2', lambda: 0.3 },
  daemmung: { name: 'Dämmung (EPS/MW)', fill: '#fff6c9', hatch: 'zick', lambda: 0.035 },
  holzfaser: { name: 'Holzfaserdämmung', fill: '#f3e3c2', hatch: 'zick', lambda: 0.045 },
  perimeter: { name: 'Perimeterdämmung (XPS)', fill: '#dfeff9', hatch: 'zick', lambda: 0.035 },
  luft: { name: 'Luftschicht / Hinterlüftung', fill: '#ffffff', hatch: null, lambda: 0.18 },
  klinker: { name: 'Vormauer-Klinker', fill: '#e8b49b', hatch: 'diag', lambda: 0.96 },
  gk: { name: 'Gipskarton', fill: '#e7eef7', hatch: null, lambda: 0.25 },
  staender: { name: 'Ständerwerk + Dämmung', fill: '#fff6c9', hatch: 'zick', lambda: 0.04 },
  holz: { name: 'Holz / OSB', fill: '#efdfbf', hatch: 'holz', lambda: 0.13 },
  abdichtung: { name: 'Abdichtung', fill: '#3b3b3b', hatch: null, lambda: 0.2 },
  bekleidung: { name: 'Fassadenbekleidung', fill: '#cfd6dd', hatch: null, lambda: 0.5 },
  fliese: { name: 'Fliese + Kleber', fill: '#dbeefa', hatch: null, lambda: 1.3 },
  vorsatz: { name: 'Vorsatzschale (GK auf Profil)', fill: '#e7eef7', hatch: null, lambda: 0.25 }
};
export const SCHICHT_LISTE = Object.entries(SCHICHT_MAT).map(([k, v]) => [k, v.name]);

/** Wandaufbauten – Schichten jeweils von INNEN nach AUSSEN (bei Innenwänden: Seite links → rechts) */
export const AUFBAUTEN = [
  { id: 'aw_wdvs', name: 'Außenwand KS 17,5 + WDVS 14', art: 'aussen', schichten: [['putz', 15], ['ks', 175], ['daemmung', 140], ['putz', 10]] },
  { id: 'aw_wdvs20', name: 'Außenwand KS 17,5 + WDVS 20 (KfW)', art: 'aussen', schichten: [['putz', 15], ['ks', 175], ['daemmung', 200], ['putz', 10]] },
  { id: 'aw_ziegel365', name: 'Außenwand Ziegel 36,5 monolithisch', art: 'aussen', schichten: [['putz', 15], ['ziegelgef', 365], ['putz', 20]] },
  { id: 'aw_ziegel425', name: 'Außenwand Ziegel 42,5 monolithisch', art: 'aussen', schichten: [['putz', 15], ['ziegelgef', 425], ['putz', 20]] },
  { id: 'aw_porenbeton', name: 'Außenwand Porenbeton 36,5', art: 'aussen', schichten: [['putz', 10], ['porenbeton', 365], ['putz', 15]] },
  { id: 'aw_kern', name: 'Zweischalig KS + Kerndämmung + Klinker', art: 'aussen', schichten: [['putz', 15], ['ks', 175], ['daemmung', 140], ['luft', 10], ['klinker', 115]] },
  { id: 'aw_vhf', name: 'Beton 20 + Dämmung + hinterlüftete Fassade', art: 'aussen', schichten: [['putz', 10], ['beton', 200], ['daemmung', 160], ['luft', 40], ['bekleidung', 20]] },
  { id: 'aw_holz', name: 'Holzrahmenbau', art: 'aussen', schichten: [['gk', 15], ['holz', 15], ['staender', 200], ['holzfaser', 60], ['putz', 10]] },
  { id: 'kw_beton', name: 'Kellerwand WU-Beton + Perimeter', art: 'aussen', schichten: [['beton', 300], ['abdichtung', 5], ['perimeter', 120]] },
  { id: 'iw_ks115', name: 'Innenwand KS 11,5 beidseitig verputzt', art: 'innen', schichten: [['putz', 10], ['ks', 115], ['putz', 10]] },
  { id: 'iw_ks175', name: 'Innenwand KS 17,5 beidseitig verputzt', art: 'innen', schichten: [['putz', 10], ['ks', 175], ['putz', 10]] },
  { id: 'iw_ks240', name: 'Innenwand KS 24 (tragend)', art: 'innen', schichten: [['putz', 10], ['ks', 240], ['putz', 10]] },
  { id: 'iw_beton', name: 'Innenwand Stahlbeton 20', art: 'innen', schichten: [['putz', 10], ['beton', 200], ['putz', 10]] },
  { id: 'iw_gk100', name: 'Trockenbau CW 50, 2× GK beidseitig (100)', art: 'innen', schichten: [['gk', 25], ['staender', 50], ['gk', 25]] },
  { id: 'iw_gk125', name: 'Trockenbau CW 75, 2× GK beidseitig (125)', art: 'innen', schichten: [['gk', 25], ['staender', 75], ['gk', 25]] },
  { id: 'iw_gk150', name: 'Trockenbau CW 100, 2× GK beidseitig (150)', art: 'innen', schichten: [['gk', 25], ['staender', 100], ['gk', 25]] },
  { id: 'iw_bad', name: 'Innenwand KS 11,5, Bad-Seite gefliest', art: 'innen', schichten: [['fliese', 15], ['putz', 10], ['ks', 115], ['putz', 10]] },
  { id: 'iw_vorsatz', name: 'Vorsatzschale GK auf Mauerwerk', art: 'innen', schichten: [['vorsatz', 60], ['putz', 10], ['ks', 175], ['putz', 10]] }
];
export const aufbauById = (id) => AUFBAUTEN.find(a => a.id === id) || null;
/** Schichten einer Wand oder null */
export function schichten(w) { return Array.isArray(w.schichten) && w.schichten.length ? w.schichten : null; }
export const summe = (sch) => sch.reduce((a, s) => a + (+s[1] || 0), 0);
/** Tragende/Haupt-Schicht → Wandmaterial für Füllung, 3D usw. */
export function hauptMaterial(sch) {
  const trag = ['ks', 'ziegel', 'ziegelgef', 'porenbeton', 'mauerwerk', 'beton', 'leichtbeton', 'staender', 'holz'];
  const s = sch.filter(x => trag.includes(x[0])).sort((a, b) => b[1] - a[1])[0];
  if (!s) return 'mauerwerk'; return { ks: 'ks', ziegel: 'ziegel', ziegelgef: 'ziegel', porenbeton: 'porenbeton', beton: 'beton', leichtbeton: 'leichtbeton', staender: 'trockenbau', holz: 'holz' }[s[0]] || 'mauerwerk';
}
/** Aufbau auf Wand anwenden (Stärke = Summe; Bezug auf Achse bleibt) */
export function aufbauSetzen(w, aufbau) {
  if (!aufbau) { delete w.schichten; w.aufbau = null; return; }
  w.aufbau = aufbau.id; w.schichten = aufbau.schichten.map(s => s.slice()); w.thickness = summe(w.schichten); w.material = hauptMaterial(w.schichten); if (aufbau.art) w.art = aufbau.art;
}
/** U-Wert (W/m²K) nach DIN EN ISO 6946 (vereinfachend: Rsi 0,13, Rse 0,04, hinterlüftet: Schichten außerhalb der Luft entfallen) */
export function uWert(sch) {
  let R = 0.13 + 0.04; let nachLuft = false;
  const iLuft = sch.findIndex(s => s[0] === 'luft');
  sch.forEach((s, i) => { if (iLuft >= 0 && i >= iLuft && SCHICHT_MAT.luft && sch[iLuft][1] >= 30) { nachLuft = true; return; } const m = SCHICHT_MAT[s[0]]; if (m && m.lambda) R += (s[1] / 1000) / m.lambda; });
  if (nachLuft) R += 0.09; // hinterlüftet: Rse ≈ Rsi
  return 1 / R;
}

/* ───────── Zeichnen ───────── */
function hatchPoly(P, poly, art, sp) {
  if (!art || poly.length < 3) return;
  const bb = G.bbox(poly); const L = bb.w + bb.h + 10; const lines = [];
  const add = (ang, s) => { const d = { x: Math.cos(ang), y: Math.sin(ang) }, n = { x: -d.y, y: d.x }; const c = { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 }; for (let k = -L; k <= L; k += s) { const o = G.add(c, G.mul(n, k)); lines.push([G.sub(o, G.mul(d, L)), G.add(o, G.mul(d, L))]); } };
  if (art === 'diag') add(Math.PI / 4, sp);
  else if (art === 'diag2') add(Math.PI / 4, sp * 2);
  else if (art === 'kreuz') { add(Math.PI / 4, sp * 0.8); add(-Math.PI / 4, sp * 0.8); }
  else if (art === 'holz') add(0, sp * 0.6);
  else if (art === 'punkt') { add(Math.PI / 4, sp * 2.5); }
  if (lines.length) for (const l of G.clipLines(lines, [poly])) P.polyline(l, { color: art === 'punkt' ? '#b9b4aa' : '#6b7280', w: 0.1, dash: art === 'punkt' ? [0.3, 1.2] : undefined });
}
/** Dämmungs-Zickzack mittig in einem Streifen */
function zickzack(P, a, b, n, o0, o1, clip) {
  const d = G.dist(a, b); if (d < 10) return; const u = G.norm(G.sub(b, a)); const w = Math.abs(o1 - o0); const step = Math.max(40, w * 0.8); const pts = [];
  for (let t = 0, k = 0; t <= d; t += step / 2, k++) pts.push(G.add(G.add(a, G.mul(u, t)), G.mul(n, k % 2 ? Math.min(o0, o1) + w * 0.1 : Math.max(o0, o1) - w * 0.1)));
  for (const l of G.clipLines([pts], clip)) P.polyline(l, { color: '#9a7b2e', w: 0.13 });
}
/** Schichten aller Wände berechnen (je Geometrie-Stand zwischengespeichert) */
function schichtGeometrie(geo, cutPolys, outsideSide) {
  if (geo._schichten) return geo._schichten;
  const out = [];
  for (const g of geo.wg.values()) {
    const sch = schichten(g.w); if (!sch) continue;
    const T = g.w.thickness; const sum = summe(sch) || T; const f = T / sum;
    const os = outsideSide ? outsideSide(geo, g) : null; const sign = (os === 'R') ? -1 : (os === 'L' ? 1 : (g.w.schichtSeite === 'R' ? -1 : 1));
    let o = -sign * T / 2; const ext = T * 1.5; const A = G.sub(g.a, G.mul(g.u, ext)), B = G.add(g.b, G.mul(g.u, ext));
    let wallClip; try { wallClip = G.intersectPolys([G.ensureCCW(g.poly)], cutPolys); } catch (e) { continue; }
    if (!wallClip.length) continue;
    const lagen = [], grenzen = [];
    for (const [m, d] of sch) {
      const o1 = o + sign * d * f;
      const strip = [G.add(A, G.mul(g.n, o)), G.add(B, G.mul(g.n, o)), G.add(B, G.mul(g.n, o1)), G.add(A, G.mul(g.n, o1))];
      lagen.push({ m, o0: o, o1, teile: G.intersectPolys([G.ensureCCW(strip)], wallClip.map(G.ensureCCW)) });
      grenzen.push(o1); o = o1;
    }
    grenzen.pop();
    const linien = grenzen.flatMap(ob => G.clipLines([[G.add(A, G.mul(g.n, ob)), G.add(B, G.mul(g.n, ob))]], wallClip));
    out.push({ g, A, B, lagen, linien });
  }
  geo._schichten = out; return out;
}
/** Schichten aller Wände im Grundriss zeichnen (über die weiße Schnittfläche) */
export function zeichneSchichten(P, geo, cutPolys, opt = {}, outsideSide) {
  const sp = (opt.paperScale || 50) * 1.6;
  for (const w of schichtGeometrie(geo, cutPolys, outsideSide)) {
    for (const L of w.lagen) {
      const mt = SCHICHT_MAT[L.m] || SCHICHT_MAT.mauerwerk;
      for (const t of L.teile) { P.fill([t], mt.fill, 1); if (mt.hatch === 'zick') zickzack(P, w.A, w.B, w.g.n, L.o0, L.o1, [t]); else hatchPoly(P, t, mt.hatch, sp); }
    }
    for (const l of w.linien) P.polyline(l, { color: '#374151', w: 0.13 });
  }
}
