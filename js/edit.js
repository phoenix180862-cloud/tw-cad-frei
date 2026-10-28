// TW-CAD – Bearbeitungsfunktionen: Transformieren, Kopieren, Wand versetzen, Verlängern, Verbinden, Teilen
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import { uid } from './model.js?v=20261028-0429';

/** Alle Punkte eines Elements mit f(p) abbilden. rot: zusätzlicher Drehwinkel (Rad), mirror: true */
export function transformElement(e, f, rot = 0, mirror = false) {
  const T = (p) => { const q = f(p); p.x = q.x; p.y = q.y; };
  switch (e.type) {
    case 'wall': case 'line': case 'section': case 'guide': T(e.a); T(e.b); if (mirror && e.type === 'wall') { /* Seiten bleiben */ } break;
    case 'poly': case 'joint': case 'koerper': case 'durchbruch': e.pts.forEach(T); break;
    case 'balken': T(e.a); T(e.b); break;
    case 'dachfenster': case 'gaube': T(e.p); if (rot) e.rot = (e.rot || 0) + G.deg(rot); break;
    case 'circle': T(e.c); break;
    case 'symbol': case 'column': case 'stair': case 'level': T(e.p); if (rot || mirror) e.rot = mirror ? (180 - (e.rot || 0) + G.deg(rot)) : (e.rot || 0) + G.deg(rot); break;
    case 'text': T(e.p); if (rot) e.rot = (e.rot || 0) + G.deg(rot); break;
    case 'dim': e.pts.forEach(T); if (e.dir) { const o = f({ x: 0, y: 0 }), d = f(e.dir); e.dir = G.sub(d, o); } if (mirror) e.off = -(e.off || 0); break;
    case 'room': if (e.poly) e.poly.forEach(T); if (e.seed) T(e.seed); if (e.stampPos) T(e.stampPos); transformTiles(e.tiles && e.tiles.boden, f, rot, mirror); break;
    case 'tilezone': e.poly.forEach(T); (e.holes || []).forEach(h => h.forEach(T)); transformTiles(e.tiles, f, rot, mirror); break;
  }
}
function transformTiles(cfg, f, rot, mirror) {
  if (!cfg) return; if (cfg.origin) { const q = f(cfg.origin); cfg.origin = q; }
  if (rot) cfg.angle = ((cfg.angle || 0) + G.deg(rot)) % 360;
  if (mirror) cfg.angle = -(cfg.angle || 0);
}
export function moveFn(d) { return (p) => ({ x: p.x + d.x, y: p.y + d.y }); }
export function rotFn(c, a) { return (p) => G.rot(p, a, c); }
export function mirrorFn(a, b) { return (p) => G.mirror(p, a, b); }

/** Elemente (inkl. abhängige Öffnungen) kopieren; liefert neue Elemente */
export function copyElements(doc, ids, f, rot = 0, mirror = false) {
  const src = ids.map(id => doc.byId(id)).filter(Boolean);
  const map = new Map(); const out = [];
  for (const e of src) { if (e.type === 'opening') continue; const c = JSON.parse(JSON.stringify(e)); c.id = uid(e.type[0]); map.set(e.id, c.id); transformElement(c, f, rot, mirror); doc.p.elements.push(c); out.push(c); }
  for (const o of doc.p.elements.filter(x => x.type === 'opening' && map.has(x.wall))) {
    const c = JSON.parse(JSON.stringify(o)); c.id = uid('o'); c.wall = map.get(o.wall);
    if (mirror) { c.hinge = o.hinge === 'rechts' ? 'links' : 'rechts'; }
    doc.p.elements.push(c); out.push(c);
  }
  return out;
}
export function transformSelection(doc, ids, f, rot = 0, mirror = false) {
  const set = new Set(ids);
  for (const id of ids) { const e = doc.byId(id); if (e && e.type !== 'opening') transformElement(e, f, rot, mirror); }
  if (mirror) for (const o of doc.p.elements) if (o.type === 'opening' && set.has(o.wall)) o.hinge = o.hinge === 'rechts' ? 'links' : 'rechts';
}

/** Wand senkrecht versetzen; angeschlossene Wände laufen mit (strecken) */
export function shiftWall(doc, w, d) {
  const n = G.perp(G.norm(G.sub(w.b, w.a)));
  const da = G.add(w.a, G.mul(n, d)), db = G.add(w.b, G.mul(n, d));
  for (const [end, np] of [['a', da], ['b', db]]) {
    const old = w[end];
    for (const c of W.connectedEnds(doc, w.storey, old, w.id)) {
      const other = c.w; const oe = c.end === 'a' ? 'b' : 'a';
      const dir = G.sub(other[c.end], other[oe]);
      const x = G.lineIntersect(other[oe], dir, np, G.sub(db, da));
      other[c.end] = x && G.dist(x, np) < 5000 ? x : G.clone(np);
    }
    // T-Anschlüsse anderer Wände an diese Wand mitnehmen
  }
  for (const o of doc.all('wall', w.storey)) {
    if (o.id === w.id) continue;
    for (const end of ['a', 'b']) {
      const p = o[end]; const c = G.closestOnLine(p, w.a, w.b);
      if (c.t > 0.001 && c.t < 0.999 && c.d < 2) { const other = end === 'a' ? o.b : o.a; const x = G.lineIntersect(other, G.sub(p, other), da, G.sub(db, da)); if (x) o[end] = x; }
    }
  }
  w.a = da; w.b = db;
}
/** Wandendpunkt verschieben mit angeschlossenen Enden */
export function moveWallEnd(doc, w, end, p, stretch = true) {
  const old = G.clone(w[end]);
  if (stretch) for (const c of W.connectedEnds(doc, w.storey, old, w.id)) c.w[c.end] = G.clone(p);
  w[end] = G.clone(p);
}
/** Wandlänge setzen (Anfang bleibt) */
export function setWallLength(doc, w, L) {
  const u = G.norm(G.sub(w.b, w.a)); moveWallEnd(doc, w, 'b', G.add(w.a, G.mul(u, L)));
}

/** Verlängern/Kürzen bis Grenzlinie (Wand, Linie) */
export function extendTo(e, boundA, boundB, pickPt) {
  const a = e.a, b = e.b; const x = G.lineIntersect(a, G.sub(b, a), boundA, G.sub(boundB, boundA)); if (!x) return false;
  // Ende, das näher am Klickpunkt bzw. am Schnittpunkt liegt, wird bewegt
  const t = G.projectT(x, a, b);
  if (t > 1 || t < 0) { if (G.dist(x, a) < G.dist(x, b)) e.a = x; else e.b = x; }
  else { const tp = G.projectT(pickPt, a, b); if (tp < t) e.b = x; else e.a = x; }
  return true;
}
/** Zwei Wände/Linien zur Ecke verbinden */
export function joinCorner(e1, e2) {
  const x = G.lineIntersect(e1.a, G.sub(e1.b, e1.a), e2.a, G.sub(e2.b, e2.a)); if (!x) return false;
  for (const e of [e1, e2]) { if (G.dist(e.a, x) < G.dist(e.b, x)) e.a = G.clone(x); else e.b = G.clone(x); }
  return true;
}
/** Wand/Linie an Punkt teilen */
export function splitAt(doc, e, p) {
  const c = G.closestOnSeg(p, e.a, e.b); if (c.t < 0.01 || c.t > 0.99) return null;
  const n = JSON.parse(JSON.stringify(e)); n.id = uid(e.type[0]); n.a = G.clone(c.p); const oldB = e.b; e.b = G.clone(c.p); n.b = oldB;
  doc.p.elements.push(n);
  if (e.type === 'wall') { const L1 = G.dist(e.a, e.b); for (const o of doc.p.elements) if (o.type === 'opening' && o.wall === e.id && o.pos > L1) { o.wall = n.id; o.pos -= L1; } }
  return n;
}
/** Offset-Polylinie (Gehrung) */
export function offsetPolyline(pts, d, closed = false) {
  const n = pts.length; if (n < 2) return pts.slice();
  const res = [];
  for (let i = 0; i < n; i++) {
    const prev = i > 0 ? pts[i - 1] : (closed ? pts[n - 1] : null), next = i < n - 1 ? pts[i + 1] : (closed ? pts[0] : null);
    const p = pts[i];
    if (prev && next) {
      const d1 = G.norm(G.sub(p, prev)), d2 = G.norm(G.sub(next, p));
      const a = G.add(prev, G.mul(G.perp(d1), d)), b = G.add(p, G.mul(G.perp(d2), d));
      const x = G.lineIntersect(a, d1, b, d2); res.push(x && G.dist(x, p) < Math.abs(d) * 6 ? x : G.add(p, G.mul(G.perp(d1), d)));
    } else if (next) { const d2 = G.norm(G.sub(next, p)); res.push(G.add(p, G.mul(G.perp(d2), d))); }
    else { const d1 = G.norm(G.sub(p, prev)); res.push(G.add(p, G.mul(G.perp(d1), d))); }
  }
  return res;
}
/** Rechteckwände aus zwei Ecken. bezug: innen|mitte|aussen */
export function rectWalls(p1, p2, t, bezug) {
  const x0 = Math.min(p1.x, p2.x), x1 = Math.max(p1.x, p2.x), y0 = Math.min(p1.y, p2.y), y1 = Math.max(p1.y, p2.y);
  const ring = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }]; // CCW
  const off = bezug === 'innen' ? -t / 2 : bezug === 'aussen' ? t / 2 : 0;
  const c = off ? offsetPolyline(ring, off, true) : ring;
  return c.map((p, i) => [p, c[(i + 1) % 4]]);
}
