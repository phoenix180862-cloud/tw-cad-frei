// TW-CAD – Lageplan: Grundstück, Nachbargebäude, Höhenpunkte, Höhenlinien, Gebäudeumriss
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import { buildTerrain, contours } from './terrain.js?v=20261028-0429';
import { PEN } from './render2d.js?v=20261028-0429';

let tcache = { key: null, model: null, lines: null };
export function terrainOf(doc) {
  const s = doc.p.site; const key = JSON.stringify([s.punkte, s.grenze]);
  if (tcache.key === key) return tcache;
  const model = buildTerrain(s.punkte, s.grenze);
  tcache = { key, model, lines: contours(model, s.hlAbstand || 0.25) };
  return tcache;
}
/** Gebäude-Umriss (Außenkontur aller Geschosse) */
export function footprint(doc) {
  const polys = [];
  for (const st of doc.p.storeys) { const g = W.storeyGeometry(doc, st.id); for (const it of g.body) polys.push(G.ensureCCW(it.outer)); }
  return polys.length ? G.unionPolys(polys) : [];
}

export function drawSite(P, doc, opt = {}) {
  const s = doc.p.site; const ps = opt.paperScale || 200;
  // Unterlagen (Lageplan-PDF)
  for (const u of doc.p.underlays) if (u.storey === 'site' && u.visible && u.img) P.image(u.img, u.x, u.y, u.w, u.h, u.opacity ?? 0.5);
  const { model, lines } = terrainOf(doc);
  // Höhenlinien
  for (const l of lines) for (const seg of l.segs) P.line(seg[0], seg[1], { color: l.haupt ? '#8a6a3f' : '#c8b08b', w: l.haupt ? PEN.mittel : PEN.fein });
  for (const l of lines) if (l.haupt && l.segs.length) { const sg = l.segs[Math.floor(l.segs.length / 2)]; P.text(G.mid(sg[0], sg[1]), l.z.toFixed(2).replace('.', ','), 1.8, { color: '#8a6a3f', align: 'center', base: 'middle', bg: 'rgba(251,251,249,.85)' }); }
  // Grundstück
  if (s.grenze && s.grenze.length > 2) {
    P.fill([s.grenze], '#e9f3df', 0.6);
    P.polyline(s.grenze, { color: '#15803d', w: PEN.dick, dash: [5, 1.2, 1, 1.2] }, true);
    for (let i = 0; i < s.grenze.length; i++) { const a = s.grenze[i], b = s.grenze[(i + 1) % s.grenze.length]; const m = G.mid(a, b); const L = G.dist(a, b); const u = G.norm(G.sub(b, a)); let ang = Math.atan2(u.y, u.x); if (ang > Math.PI / 2) ang -= Math.PI; if (ang < -Math.PI / 2) ang += Math.PI; P.text(m, (L / 1000).toFixed(2).replace('.', ',') + ' m', 2, { align: 'center', rot: ang, color: '#15803d' }); }
    const A = G.polyArea(s.grenze) / 1e6; P.text(G.polyCentroid(s.grenze), `Grundstück ${A.toFixed(0)} m²`, 2.6, { align: 'center', color: '#166534', bold: true });
  }
  // Nachbargebäude
  for (const n of s.nachbarn) {
    P.fill([n.poly], '#cbd2da', 1, { color: '#334155', w: PEN.kraeftig });
    for (let k = 0; k < 3; k++) { /* Schraffur angedeutet */ }
    P.text(G.polyCentroid(n.poly), `${n.name || 'Nachbar'} · H ${((n.hoehe || 6000) / 1000).toFixed(1).replace('.', ',')} m`, 2, { align: 'center', base: 'middle', color: '#1f2937' });
  }
  // eigenes Gebäude
  for (const f of footprint(doc)) { P.fill([f], '#f3c7c7', 1, { color: '#991b1b', w: PEN.dick }); }
  const fp = footprint(doc); if (fp.length) { const c = G.polyCentroid(fp[0]); P.text(c, `Neubau · OKFF EG ${((s.nnEG || 0)).toFixed(2).replace('.', ',')} ü. NN`, 2.4, { align: 'center', base: 'middle', bold: true, color: '#7f1d1d' }); }
  // Höhenpunkte
  for (const hp of s.punkte) {
    P.line({ x: hp.x - 150, y: hp.y - 150 }, { x: hp.x + 150, y: hp.y + 150 }, { color: '#9a3412', w: PEN.mittel });
    P.line({ x: hp.x - 150, y: hp.y + 150 }, { x: hp.x + 150, y: hp.y - 150 }, { color: '#9a3412', w: PEN.mittel });
    P.text({ x: hp.x + 200, y: hp.y + 120 }, hp.z.toFixed(2).replace('.', ','), 2.2, { color: '#9a3412', bold: true });
  }
  // Nordpfeil
  const bb = s.grenze && s.grenze.length ? G.bbox(s.grenze) : null;
  if (bb) { const p = { x: bb.x1 + 3000, y: bb.y1 }; const a = G.rad(s.nord || 0); const tip = G.add(p, G.rot({ x: 0, y: 2500 }, a)); const l = G.add(p, G.rot({ x: -700, y: -500 }, a)), r = G.add(p, G.rot({ x: 700, y: -500 }, a)); P.fill([[tip, l, p]], '#111', 1); P.polyline([tip, r, p], { color: '#111', w: PEN.mittel }, true); P.text(G.add(p, G.rot({ x: 0, y: 3000 }, a)), 'N', 4, { align: 'center', bold: true }); }
}
