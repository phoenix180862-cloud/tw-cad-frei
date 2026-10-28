// TW-CAD – Wandgeometrie: Gehrungen, T-Stöße, Vereinigung, Räume, Öffnungen
import * as G from './geom.js?v=20261028-0429';

const JOIN_TOL = 6; // mm Toleranz für verbundene Wandenden

/** Mittellinie aus gezeichneter Referenzlinie (links/rechts/mitte bezogen auf Zeichenrichtung) */
export function centerFromRef(a, b, t, ref) {
  if (ref === 'mitte' || !ref) return { a: G.clone(a), b: G.clone(b) };
  const n = G.perp(G.norm(G.sub(b, a)));
  const s = ref === 'links' ? -t / 2 : t / 2; // Referenz links: Wand liegt rechts der Linie
  return { a: G.add(a, G.mul(n, s)), b: G.add(b, G.mul(n, s)) };
}

function endInfo(w) {
  const u = G.norm(G.sub(w.b, w.a)); return { u, n: G.perp(u), len: G.dist(w.a, w.b) };
}

/** Geometrie aller Wände eines Geschosses */
export function wallGeometry(walls) {
  const res = new Map();
  for (const w of walls) {
    const { u, n, len } = endInfo(w); const h = w.thickness / 2;
    res.set(w.id, {
      w, u, n, len, a: G.clone(w.a), b: G.clone(w.b),
      aL: G.add(w.a, G.mul(n, h)), aR: G.sub(w.a, G.mul(n, h)), bL: G.add(w.b, G.mul(n, h)), bR: G.sub(w.b, G.mul(n, h)),
      extA: null, extB: null
    });
  }
  // 1) T-Stöße: Wandende liegt auf/in einer anderen Wand → bis Achse der anderen Wand verlängern
  for (const g of res.values()) {
    for (const end of ['a', 'b']) {
      const p = g.w[end];
      let shared = false;
      for (const o of res.values()) { if (o === g) continue; if (G.dist(o.w.a, p) < JOIN_TOL || G.dist(o.w.b, p) < JOIN_TOL) { shared = true; break; } }
      if (shared) continue;
      for (const o of res.values()) {
        if (o === g) continue;
        const c = G.closestOnLine(p, o.w.a, o.w.b);
        if (c.t <= 0.001 || c.t >= 0.999) continue;
        if (c.d > o.w.thickness / 2 + JOIN_TOL) continue;
        const dirOut = end === 'a' ? G.mul(g.u, -1) : g.u;
        if (Math.abs(G.cross(dirOut, o.u)) < 0.2) continue; // nahezu parallel
        const hit = G.lineIntersect(p, dirOut, o.w.a, o.u);
        if (!hit || G.dist(hit, p) > o.w.thickness / 2 + JOIN_TOL + 1) continue;
        const h = g.w.thickness / 2;
        // Ecken an der Achse der Querwand, leicht darüber hinaus (Vereinigung schließt sauber)
        const pL = G.lineIntersect(G.add(g.w.a, G.mul(g.n, h)), g.u, o.w.a, o.u);
        const pR = G.lineIntersect(G.sub(g.w.a, G.mul(g.n, h)), g.u, o.w.a, o.u);
        if (!pL || !pR) continue;
        if (end === 'a') { g.aL = pL; g.aR = pR; g.extA = hit; } else { g.bL = pL; g.bR = pR; g.extB = hit; }
        break;
      }
    }
  }
  // 2) Knoten: gemeinsame Endpunkte → Gehrung zwischen Nachbarn (gegen den Uhrzeigersinn sortiert)
  const nodes = [];
  for (const g of res.values()) for (const end of ['a', 'b']) {
    const p = g.w[end]; let node = nodes.find(nd => G.dist(nd.p, p) < JOIN_TOL);
    if (!node) { node = { p: G.clone(p), items: [] }; nodes.push(node); }
    node.items.push({ g, end });
  }
  for (const node of nodes) {
    if (node.items.length < 2) continue;
    for (const it of node.items) {
      it.dir = it.end === 'a' ? it.g.u : G.mul(it.g.u, -1);
      it.ang = Math.atan2(it.dir.y, it.dir.x);
      it.h = it.g.w.thickness / 2;
    }
    node.items.sort((x, y) => x.ang - y.ang);
    const k = node.items.length;
    const corner = new Array(k);
    for (let i = 0; i < k; i++) {
      const A = node.items[i], B = node.items[(i + 1) % k];
      const nA = G.perp(A.dir), nB = G.perp(B.dir);
      const pA = G.add(node.p, G.mul(nA, A.h)); // linke Seite von A
      const pB = G.sub(node.p, G.mul(nB, B.h)); // rechte Seite von B
      let c = G.lineIntersect(pA, A.dir, pB, B.dir);
      const lim = 4 * Math.max(A.h, B.h);
      if (!c || G.dist(c, node.p) > lim) c = null;
      corner[i] = c; // Ecke zwischen A(links) und B(rechts)
    }
    for (let i = 0; i < k; i++) {
      const it = node.items[i], g = it.g;
      const left = corner[i], right = corner[(i - 1 + k) % k];
      if (it.end === 'a') { if (left) g.aL = left; if (right) g.aR = right; g.nodeA = node.p; }
      else { if (left) g.bR = left; if (right) g.bL = right; g.nodeB = node.p; }
    }
  }
  for (const g of res.values()) {
    const pa = g.nodeA || g.extA || g.a, pb = g.nodeB || g.extB || g.b;
    g.poly = [pa, g.aR, g.bR, pb, g.bL, g.aL];
    g.quad = [g.aR, g.bR, g.bL, g.aL];
  }
  return res;
}

/** Öffnungs-Rechteck (über die gesamte Wandstärke) */
export function openingInfo(o, g) {
  const s0 = o.pos - o.width / 2, s1 = o.pos + o.width / 2;
  const h = g.w.thickness / 2 + 0.5;
  const c0 = G.add(g.a, G.mul(g.u, s0)), c1 = G.add(g.a, G.mul(g.u, s1));
  const rect = [G.sub(c0, G.mul(g.n, h)), G.sub(c1, G.mul(g.n, h)), G.add(c1, G.mul(g.n, h)), G.add(c0, G.mul(g.n, h))];
  return { s0, s1, c0, c1, rect, center: G.add(g.a, G.mul(g.u, o.pos)) };
}

/** Vollständige Geschoss-Geometrie (gecacht über doc.cacheVersion) */
const cache = new Map();
export function storeyGeometry(doc, storeyId) {
  const key = storeyId + '|' + doc.cacheVersion;
  if (cache.has(key)) return cache.get(key);
  for (const k of cache.keys()) if (k.startsWith(storeyId + '|')) cache.delete(k);
  const walls = doc.all('wall', storeyId).filter(w => G.dist(w.a, w.b) > 1);
  const wg = wallGeometry(walls);
  const polys = [...wg.values()].map(g => G.ensureCCW(g.poly));
  const body = polys.length ? G.unionTree(polys) : [];
  const openings = [];
  for (const o of doc.all('opening', storeyId)) {
    const g = wg.get(o.wall); if (!g) continue;
    openings.push({ o, g, ...openingInfo(o, g) });
  }
  const bodyPolys = []; for (const it of body) { bodyPolys.push(it.outer); for (const h of it.holes) bodyPolys.push(h); }
  const cut = openings.length ? G.differenceTree(bodyPolys.length ? flatToSubj(body) : [], openings.map(x => x.rect)) : body;
  const rooms = []; const outers = [];
  for (const it of body) { outers.push(it.outer); for (const h of it.holes) rooms.push(G.ensureCCW(G.cleanPoly(h))); }
  const geo = { wg, body, cut, rooms, outers, openings, walls };
  cache.set(key, geo); return geo;
}
// PolyTree-Struktur als Subjekt (Löcher bleiben über Nonzero-Orientierung erhalten)
function flatToSubj(items) { const r = []; for (const it of items) { r.push(G.ensureCCW(it.outer)); for (const h of it.holes) r.push(G.ensureCW(h)); } return r; }

/** Raum-Polygon unter einem Punkt (kleinste umschließende Fläche) */
export function roomAt(geo, pt) {
  let best = null, ba = Infinity;
  for (const r of geo.rooms) if (G.pointInPoly(pt, r)) { const a = G.polyArea(r); if (a < ba) { ba = a; best = r; } }
  return best;
}
/** Liegt Punkt außerhalb des Gebäudes? */
export function isOutside(geo, pt) {
  for (const o of geo.outers) if (G.pointInPoly(pt, o)) return false;
  return true;
}
/** Außenseite einer Wand: 'L', 'R', 'beide' oder null */
export function outsideSide(geo, g) {
  const m = G.mid(g.a, g.b), d = g.w.thickness / 2 + 60;
  const L = isOutside(geo, G.add(m, G.mul(g.n, d))), R = isOutside(geo, G.sub(m, G.mul(g.n, d)));
  return L && R ? 'beide' : L ? 'L' : R ? 'R' : null;
}

/** Zu jeder Raumkante: Wand und Öffnungen (für Wandabwicklung / Aufmaß) */
export function roomEdges(geo, poly) {
  const edges = [];
  const p = G.ensureCCW(poly);
  for (let i = 0; i < p.length; i++) {
    const a = p[i], b = p[(i + 1) % p.length]; const L = G.dist(a, b); if (L < 1) continue;
    const u = G.norm(G.sub(b, a)); const m = G.mid(a, b);
    let wall = null, side = null, best = Infinity;
    for (const g of geo.wg.values()) {
      if (Math.abs(G.cross(u, g.u)) > 0.02) continue;
      const h = g.w.thickness / 2;
      for (const s of ['L', 'R']) {
        const off = s === 'L' ? h : -h;
        const pa = G.add(g.a, G.mul(g.n, off));
        const c = G.closestOnLine(m, pa, G.add(pa, g.u));
        if (c.d < 2 && c.d < best) {
          const t = G.projectT(m, g.a, g.b);
          if (t > -0.2 && t < 1.2) { best = c.d; wall = g; side = s; }
        }
      }
    }
    const ops = [];
    if (wall) {
      for (const oi of geo.openings) {
        if (oi.g !== wall) continue;
        // Projektion auf Kante
        const ta = G.dot(G.sub(G.add(wall.a, G.mul(wall.u, oi.s0)), a), u);
        const tb = G.dot(G.sub(G.add(wall.a, G.mul(wall.u, oi.s1)), a), u);
        const x0 = Math.max(0, Math.min(ta, tb)), x1 = Math.min(L, Math.max(ta, tb));
        if (x1 - x0 > 5) ops.push({ o: oi.o, x0, x1, kind: oi.o.kind, sill: oi.o.kind === 'door' || oi.o.kind === 'opening' ? 0 : (oi.o.sill || 0), height: oi.o.height, reveal: wall.w.thickness });
      }
    }
    edges.push({ i, a, b, len: L, u, wall: wall ? wall.w : null, side, openings: ops.sort((x, y) => x.x0 - y.x0) });
  }
  return edges;
}

/** Wandenden finden, die an Punkt p hängen (für mitlaufendes Verschieben) */
export function connectedEnds(doc, storeyId, p, excludeId, tol = JOIN_TOL) {
  const r = [];
  for (const w of doc.all('wall', storeyId)) {
    if (w.id === excludeId) continue;
    if (G.dist(w.a, p) < tol) r.push({ w, end: 'a' });
    if (G.dist(w.b, p) < tol) r.push({ w, end: 'b' });
  }
  return r;
}

/** Raumdaten: Fläche, Umfang, Wandfläche netto (nach DIN 18352 grob: Öffnungen > 0,1 m² abziehen) */
export function roomStats(geo, poly, height) {
  const area = G.polyArea(poly), perim = G.polyPerimeter(poly);
  const edges = roomEdges(geo, poly);
  let wallGross = perim * height, openArea = 0, revealArea = 0, doorWidth = 0;
  for (const e of edges) for (const op of e.openings) {
    const w = op.x1 - op.x0; const top = Math.min(height, op.sill + op.height); const hh = Math.max(0, top - op.sill);
    if (w * hh > 0.1e6) openArea += w * hh;
    if (op.kind === 'door' || op.kind === 'schiebetuer' || op.kind === 'opening' || (op.kind === 'window' && !(op.sill > 0))) doorWidth += w;
    revealArea += 0; // Laibungen getrennt
  }
  return { area, perim, wallGross, wallNet: wallGross - openArea, openArea, doorWidth, edges, height };
}
