// TW-CAD – Objektfang, Ortho/Polar, Spurlinien
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import { symbolFootprint, columnPoly, dimGeometry } from './render2d.js?v=20261028-0429';
import { treppe } from './treppe.js?v=20261028-0429';

const PRIO = { end: 1, ecke: 1, schnitt: 2, mitte: 3, zentrum: 3, lot: 4, naechster: 6, raster: 8, spur: 7 };
export const SNAP_LABEL = { end: 'Endpunkt', ecke: 'Ecke', schnitt: 'Schnittpunkt', mitte: 'Mitte', zentrum: 'Zentrum', lot: 'Lot', naechster: 'auf Linie', raster: 'Raster', spur: 'Spur', polar: 'Winkel', ortho: 'Ortho', abstand: 'Abstand' };

let fcache = { key: null, pts: [], segs: [] };
export function features(app) {
  const doc = app.doc; const sid = doc.p.activeStorey;
  const key = sid + '|' + doc.cacheVersion + '|' + app.mode;
  if (fcache.key === key) return fcache;
  const pts = [], segs = [];
  const P = (p, kind, src) => pts.push({ p, kind, src });
  const S = (a, b, src, inf = false) => segs.push({ a, b, src, inf });
  if (app.mode === 'lageplan') {
    const s = doc.p.site;
    for (const hp of s.punkte) P(hp, 'end', hp);
    if (s.grenze) for (let i = 0; i < s.grenze.length; i++) { P(s.grenze[i], 'ecke'); S(s.grenze[i], s.grenze[(i + 1) % s.grenze.length]); }
    for (const n of s.nachbarn) for (let i = 0; i < n.poly.length; i++) { P(n.poly[i], 'ecke'); S(n.poly[i], n.poly[(i + 1) % n.poly.length]); }
  }
  const geo = W.storeyGeometry(doc, sid);
  for (const g of geo.wg.values()) {
    P(g.w.a, 'end', g.w); P(g.w.b, 'end', g.w); P(G.mid(g.w.a, g.w.b), 'mitte', g.w); S(g.w.a, g.w.b, g.w);
  }
  for (const it of geo.cut) for (const ring of [it.outer, ...it.holes]) for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length]; P(a, 'ecke'); S(a, b, 'kontur'); if (G.dist(a, b) > 300) P(G.mid(a, b), 'mitte');
  }
  for (const r of geo.rooms) for (let i = 0; i < r.length; i++) P(r[i], 'ecke');
  for (const e of doc.all(null, sid)) {
    if (!doc.visible(e)) continue;
    if (e.type === 'line') { P(e.a, 'end', e); P(e.b, 'end', e); P(G.mid(e.a, e.b), 'mitte', e); S(e.a, e.b, e); }
    else if (e.type === 'poly') { for (let i = 0; i < e.pts.length; i++) { P(e.pts[i], 'end', e); const j = i + 1; if (j < e.pts.length || e.closed) { const b = e.pts[j % e.pts.length]; S(e.pts[i], b, e); P(G.mid(e.pts[i], b), 'mitte', e); } } }
    else if (e.type === 'circle') { P(e.c, 'zentrum', e); for (let k = 0; k < 4; k++) P(G.add(e.c, G.fromAngle(k * Math.PI / 2, e.r)), 'end', e); }
    else if (e.type === 'guide') { S(e.a, e.b, e, true); }
    else if (e.type === 'symbol') { const fp = symbolFootprint(e); fp.forEach(p => P(p, 'ecke', e)); P(e.p, 'zentrum', e); for (let i = 0; i < 4; i++) S(fp[i], fp[(i + 1) % 4], e); }
    else if (e.type === 'column') { const fp = columnPoly(e); P(e.p, 'zentrum', e); if (!e.round) fp.forEach(p => P(p, 'ecke', e)); }
    else if (e.type === 'tilezone' && e.poly) { e.poly.forEach(p => P(p, 'ecke', e)); for (let i = 0; i < e.poly.length; i++) S(e.poly[i], e.poly[(i + 1) % e.poly.length], e); }
    else if (e.type === 'dim') { const g = dimGeometry(e); if (g) g.proj.forEach(s => P(s.q, 'end', e)); }
    else if (e.type === 'text') P(e.p, 'end', e);
    else if (e.type === 'stair') { const g = treppe(e); for (let i = 0; i < g.umriss.length; i++) { P(g.umriss[i], 'ecke', e); S(g.umriss[i], g.umriss[(i + 1) % g.umriss.length], e); } }
  }
  for (const u of doc.p.underlays) if (u.snapLines && u.visible && (!u.storey || u.storey === sid)) for (const l of u.snapLines) S(l[0], l[1], 'plan');
  fcache = { key, pts, segs };
  return fcache;
}

/**
 * Fangpunkt bestimmen.
 * opt: { from, ortho, polar, noSnap, exclude:Set }
 */
export function snap(app, raw, opt = {}) {
  const s = app.view.tf.s; const st = app.doc.p.settings;
  const r = 13 / s;
  const res = { p: G.clone(raw), kind: null, raw, guides: [] };
  const excl = opt.exclude || new Set();
  if (!opt.noSnap && st.fangAn) {
    const f = features(app);
    let best = null;
    for (const c of f.pts) {
      if (c.src && excl.has(c.src.id)) continue;
      const d = G.dist(c.p, raw); if (d > r) continue;
      const score = PRIO[c.kind] * 1000 + d * s;
      if (!best || score < best.score) best = { p: c.p, kind: c.kind, score };
    }
    const near = [];
    for (const sg of f.segs) {
      if (sg.src && sg.src.id && excl.has(sg.src.id)) continue;
      const c = sg.inf ? G.closestOnLine(raw, sg.a, sg.b) : G.closestOnSeg(raw, sg.a, sg.b);
      if (c.d < r * 1.5) near.push({ sg, c });
    }
    if (near.length > 1 && (!best || PRIO[best.kind] > PRIO.schnitt)) {
      for (let i = 0; i < near.length && i < 40; i++) for (let j = i + 1; j < near.length && j < 40; j++) {
        const A = near[i].sg, B = near[j].sg;
        const x = G.lineIntersect(A.a, G.sub(A.b, A.a), B.a, G.sub(B.b, B.a)); if (!x) continue;
        const d = G.dist(x, raw); if (d > r) continue;
        const onA = A.inf || G.closestOnSeg(x, A.a, A.b).d < 1, onB = B.inf || G.closestOnSeg(x, B.a, B.b).d < 1;
        if (!onA || !onB) continue;
        const score = PRIO.schnitt * 1000 + d * s; if (!best || score < best.score) best = { p: x, kind: 'schnitt', score };
      }
    }
    if (opt.from && (!best || PRIO[best.kind] > PRIO.lot)) {
      for (const { sg } of near) {
        const c = G.closestOnLine(opt.from, sg.a, sg.b);
        if ((sg.inf || (c.t >= 0 && c.t <= 1)) && G.dist(c.p, raw) < r) { const score = PRIO.lot * 1000 + G.dist(c.p, raw) * s; if (!best || score < best.score) best = { p: c.p, kind: 'lot', score }; }
      }
    }
    if (!best && near.length) { near.sort((a, b) => a.c.d - b.c.d); const n0 = near[0]; if (n0.c.d < r) best = { p: n0.c.p, kind: 'naechster', score: 0, seg: n0.sg }; }
    if (best && PRIO[best.kind] <= PRIO.lot) { res.p = G.clone(best.p); res.kind = best.kind; app.trackPush(best.p); return res; }
    if (best && best.kind === 'naechster' && !opt.from) { res.p = G.clone(best.p); res.kind = best.kind; res.seg = best.seg; return res; }
  }
  // Richtungsbindung
  let p = G.clone(raw);
  if (opt.from) {
    const v = G.sub(raw, opt.from); const L = G.len(v);
    if (L > 0.5) {
      let ang = Math.atan2(v.y, v.x);
      const ortho = opt.ortho ?? st.orthoAn;
      const step = G.rad(ortho ? 90 : (st.winkelRaster || 15));
      const q = Math.round(ang / step) * step;
      const tol = ortho ? Math.PI : G.rad(3);
      if (Math.abs(q - ang) < tol) { ang = q; res.kind = ortho ? 'ortho' : 'polar'; }
      // Länge runden (Raster) – nur ohne Objektfang
      let len = L;
      len = Math.round(L / (st.rasterAn ? 10 : 5)) * (st.rasterAn ? 10 : 5);
      p = G.add(opt.from, G.fromAngle(ang, len));
      // auf Linie fangen entlang Richtung (Spur zu letzten Punkten)
      if (st.spurAn) for (const tp of app.track) {
        const dir = G.fromAngle(ang);
        for (const ax of [{ x: 1, y: 0 }, { x: 0, y: 1 }]) {
          const x = G.lineIntersect(opt.from, dir, tp, ax); if (!x) continue;
          if (G.dist(x, raw) < r) { p = x; res.kind = 'spur'; res.guides.push([tp, x]); break; }
        }
      }
    }
  } else {
    if (st.rasterAn) { const gs = gridStep(app); p = { x: Math.round(raw.x / gs) * gs, y: Math.round(raw.y / gs) * gs }; res.kind = 'raster'; }
    if (st.spurAn) for (const tp of app.track) {
      if (Math.abs(raw.x - tp.x) < r) { p.x = tp.x; res.kind = 'spur'; res.guides.push([tp, { x: tp.x, y: p.y }]); }
      if (Math.abs(raw.y - tp.y) < r) { p.y = tp.y; res.kind = 'spur'; res.guides.push([tp, { x: p.x, y: tp.y }]); }
    }
  }
  res.p = p; return res;
}

export function gridStep(app) {
  const base = app.doc.p.settings.raster || 125; const s = app.view.tf.s;
  let g = base; while (g * s < 7) g *= 2; return g;
}
