// TW-CAD – Geometrie-Kern (Vektoren, Polygone, Clipper-Brücke)
// Einheiten: Millimeter, Weltkoordinaten mit y nach oben.

export const EPS = 1e-7;
export const v = (x, y) => ({ x, y });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a, s) => ({ x: a.x * s, y: a.y * s });
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const len = (a) => Math.hypot(a.x, a.y);
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const norm = (a) => { const l = Math.hypot(a.x, a.y) || 1; return { x: a.x / l, y: a.y / l }; };
export const perp = (a) => ({ x: -a.y, y: a.x }); // links-Normale
export const lerp = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
export const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const angleOf = (a) => Math.atan2(a.y, a.x);
export const fromAngle = (ang, l = 1) => ({ x: Math.cos(ang) * l, y: Math.sin(ang) * l });
export const eq = (a, b, tol = 0.01) => Math.abs(a.x - b.x) <= tol && Math.abs(a.y - b.y) <= tol;
export const clone = (p) => ({ x: p.x, y: p.y });
export const deg = (r) => r * 180 / Math.PI;
export const rad = (d) => d * Math.PI / 180;

export function rot(p, ang, c = { x: 0, y: 0 }) {
  const s = Math.sin(ang), co = Math.cos(ang), dx = p.x - c.x, dy = p.y - c.y;
  return { x: c.x + dx * co - dy * s, y: c.y + dx * s + dy * co };
}
export function mirror(p, a, b) {
  const d = norm(sub(b, a)); const ap = sub(p, a); const t = dot(ap, d);
  const f = add(a, mul(d, t)); return sub(mul(f, 2), p);
}
/** Schnitt zweier unendlicher Geraden p+s*d und q+t*e */
export function lineIntersect(p, d, q, e) {
  const den = cross(d, e);
  if (Math.abs(den) < 1e-9) return null;
  const s = cross(sub(q, p), e) / den;
  return add(p, mul(d, s));
}
/** Schnitt zweier Strecken, null wenn keiner */
export function segIntersect(a, b, c, d, tol = 1e-9) {
  const r = sub(b, a), s = sub(d, c), den = cross(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross(sub(c, a), s) / den, u = cross(sub(c, a), r) / den;
  if (t < -tol || t > 1 + tol || u < -tol || u > 1 + tol) return null;
  return { x: a.x + r.x * t, y: a.y + r.y * t, t, u };
}
export function projectT(p, a, b) {
  const ab = sub(b, a); const l2 = dot(ab, ab) || 1;
  return dot(sub(p, a), ab) / l2;
}
export function closestOnSeg(p, a, b) {
  let t = projectT(p, a, b); t = Math.max(0, Math.min(1, t));
  const q = lerp(a, b, t); return { p: q, t, d: dist(p, q) };
}
export function closestOnLine(p, a, b) {
  const t = projectT(p, a, b); const q = lerp(a, b, t); return { p: q, t, d: dist(p, q) };
}
export function polyAreaSigned(p) {
  let s = 0; for (let i = 0, n = p.length; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; s += a.x * b.y - b.x * a.y; } return s / 2;
}
export const polyArea = (p) => Math.abs(polyAreaSigned(p));
export function polyPerimeter(p, closed = true) {
  let s = 0; const n = p.length; for (let i = 0; i < (closed ? n : n - 1); i++) s += dist(p[i], p[(i + 1) % n]); return s;
}
export function polyCentroid(p) {
  let A = 0, cx = 0, cy = 0; const n = p.length;
  for (let i = 0; i < n; i++) { const a = p[i], b = p[(i + 1) % n]; const f = a.x * b.y - b.x * a.y; A += f; cx += (a.x + b.x) * f; cy += (a.y + b.y) * f; }
  if (Math.abs(A) < 1e-9) { const bb = bbox(p); return { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 }; }
  return { x: cx / (3 * A), y: cy / (3 * A) };
}
export function ensureCCW(p) { return polyAreaSigned(p) < 0 ? p.slice().reverse() : p.slice(); }
export function ensureCW(p) { return polyAreaSigned(p) > 0 ? p.slice().reverse() : p.slice(); }
export function pointInPoly(pt, p) {
  let c = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
    const a = p[i], b = p[j];
    if (((a.y > pt.y) !== (b.y > pt.y)) && (pt.x < (b.x - a.x) * (pt.y - a.y) / (b.y - a.y) + a.x)) c = !c;
  } return c;
}
export function bbox(pts) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const p of pts) { if (p.x < x0) x0 = p.x; if (p.y < y0) y0 = p.y; if (p.x > x1) x1 = p.x; if (p.y > y1) y1 = p.y; }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
export function bboxUnion(a, b) {
  if (!a) return b; if (!b) return a;
  const x0 = Math.min(a.x0, b.x0), y0 = Math.min(a.y0, b.y0), x1 = Math.max(a.x1, b.x1), y1 = Math.max(a.y1, b.y1);
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}
/** Polygon bereinigen: doppelte und kollineare Punkte entfernen */
export function cleanPoly(p, tol = 0.5) {
  let r = [];
  for (const q of p) if (!r.length || dist(r[r.length - 1], q) > tol) r.push(q);
  if (r.length > 1 && dist(r[0], r[r.length - 1]) <= tol) r.pop();
  let changed = true;
  while (changed && r.length > 3) {
    changed = false;
    for (let i = 0; i < r.length; i++) {
      const a = r[(i - 1 + r.length) % r.length], b = r[i], c = r[(i + 1) % r.length];
      const ab = sub(b, a), bc = sub(c, b);
      if (Math.abs(cross(norm(ab), norm(bc))) < 1e-4 && dot(ab, bc) > 0) { r.splice(i, 1); changed = true; break; }
    }
  }
  return r;
}
export function polyEdges(p) { const e = []; for (let i = 0; i < p.length; i++) e.push([p[i], p[(i + 1) % p.length]]); return e; }

/* ───────── Clipper-Brücke ───────── */
const SC = 10; // 0,1 mm Auflösung
function CL() {
  const c = (typeof globalThis !== 'undefined' && globalThis.ClipperLib) || (typeof window !== 'undefined' && window.ClipperLib);
  if (!c) throw new Error('ClipperLib nicht geladen');
  return c;
}
export const toPath = (poly) => poly.map(p => ({ X: Math.round(p.x * SC), Y: Math.round(p.y * SC) }));
export const fromPath = (path) => path.map(p => ({ x: p.X / SC, y: p.Y / SC }));

function exec(type, subj, clip, fill) {
  const C = CL(); const c = new C.Clipper();
  if (subj.length) c.AddPaths(subj.map(toPath), C.PolyType.ptSubject, true);
  if (clip && clip.length) c.AddPaths(clip.map(toPath), C.PolyType.ptClip, true);
  const sol = new C.Paths();
  const ft = fill === 'evenodd' ? C.PolyFillType.pftEvenOdd : C.PolyFillType.pftNonZero;
  c.Execute(type, sol, ft, ft);
  return sol.map(fromPath);
}
function execTree(type, subj, clip) {
  const C = CL(); const c = new C.Clipper();
  if (subj.length) c.AddPaths(subj.map(toPath), C.PolyType.ptSubject, true);
  if (clip && clip.length) c.AddPaths(clip.map(toPath), C.PolyType.ptClip, true);
  const tree = new C.PolyTree();
  c.Execute(type, tree, C.PolyFillType.pftNonZero, C.PolyFillType.pftNonZero);
  return flattenTree(tree);
}
/** PolyTree → [{outer, holes:[]}] (Inseln als eigene Einträge) */
function flattenTree(node) {
  const out = [];
  const walk = (n) => {
    for (const ch of n.Childs()) {
      if (!ch.IsHole()) {
        const item = { outer: fromPath(ch.Contour()), holes: [] };
        for (const h of ch.Childs()) { item.holes.push(fromPath(h.Contour())); walk(h); }
        out.push(item);
      }
    }
  };
  walk(node);
  return out;
}
export function unionPolys(polys) { const C = CL(); return exec(C.ClipType.ctUnion, polys, null); }
export function unionTree(polys) { const C = CL(); return execTree(C.ClipType.ctUnion, polys, null); }
export function differencePolys(subj, clip) { const C = CL(); return exec(C.ClipType.ctDifference, subj, clip); }
export function differenceTree(subj, clip) { const C = CL(); return execTree(C.ClipType.ctDifference, subj, clip); }
export function intersectPolys(subj, clip) { const C = CL(); return exec(C.ClipType.ctIntersection, subj, clip); }
export function intersectTree(subj, clip) { const C = CL(); return execTree(C.ClipType.ctIntersection, subj, clip); }
/** Offenen Linienzug mit Polygonen schneiden → Liste offener Linienzüge */
export function clipLines(lines, polys, inside = true) {
  const C = CL(); const c = new C.Clipper();
  for (const l of lines) c.AddPath(toPath(l), C.PolyType.ptSubject, false);
  c.AddPaths(polys.map(toPath), C.PolyType.ptClip, true);
  const tree = new C.PolyTree();
  c.Execute(inside ? C.ClipType.ctIntersection : C.ClipType.ctDifference, tree, C.PolyFillType.pftEvenOdd, C.PolyFillType.pftEvenOdd);
  return C.Clipper.OpenPathsFromPolyTree(tree).map(fromPath);
}
export function offsetPolys(polys, delta, join = 'miter') {
  const C = CL(); const co = new C.ClipperOffset(4, 0.25);
  const jt = join === 'round' ? C.JoinType.jtRound : join === 'square' ? C.JoinType.jtSquare : C.JoinType.jtMiter;
  co.AddPaths(polys.map(toPath), jt, C.EndType.etClosedPolygon);
  const sol = new C.Paths(); co.Execute(sol, delta * SC); return sol.map(fromPath);
}
/** Fläche einer Mehrfach-Fläche {outer, holes} */
export function areaWithHoles(item) { return polyArea(item.outer) - item.holes.reduce((s, h) => s + polyArea(h), 0); }

/** Rechteck entlang Strecke a→b, Breite w (je w/2 nach links/rechts) */
export function stripPoly(a, b, wL, wR = wL) {
  const d = norm(sub(b, a)), n = perp(d);
  return [add(a, mul(n, -wR)), add(b, mul(n, -wR)), add(b, mul(n, wL)), add(a, mul(n, wL))];
}
export function fmtM(mm, dec = 2) { return (mm / 1000).toFixed(dec).replace('.', ','); }
export function fmtCm(mm, dec = 1) { const v = mm / 10; return (Math.abs(v - Math.round(v)) < 0.05 ? Math.round(v).toString() : v.toFixed(dec)).replace('.', ','); }
export function fmtMM(mm) { return Math.round(mm).toString(); }
/** Maßzahl wie im Bauwesen: < 1 m in cm, sonst m mit hochgestellten mm */
export function fmtBau(mm) {
  const r = Math.round(mm);
  if (Math.abs(r) < 1000) { const cm = Math.floor(r / 10), m5 = r - cm * 10; return { main: String(cm), sup: m5 ? String(m5) : '' }; }
  const m = r / 1000; const s = (Math.floor(Math.abs(r) / 10) / 100).toFixed(2).replace('.', ','); const sup = Math.abs(r) % 10;
  return { main: (r < 0 ? '-' : '') + s, sup: sup ? String(sup) : '' };
}
export function parseLen(str, unit = 'mm') {
  // akzeptiert "3,51" (m wenn Komma und <100), "351cm", "3510", "3.51m"
  if (str == null) return NaN; let s = String(str).trim().toLowerCase().replace(',', '.');
  let f = unit === 'mm' ? 1 : unit === 'cm' ? 10 : 1000;
  if (s.endsWith('mm')) { f = 1; s = s.slice(0, -2); } else if (s.endsWith('cm')) { f = 10; s = s.slice(0, -2); } else if (s.endsWith('m')) { f = 1000; s = s.slice(0, -1); }
  const v = parseFloat(s); if (!isFinite(v)) return NaN;
  return v * f;
}
