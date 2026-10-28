// TW-CAD – Dachgeometrie: Dachflächen als Minimum mehrerer Ebenen (exakte Teilflächen)
import * as G from './geom.js?v=20261028-0429';

/** Ebene: z(p) = z0 + k * dot(p - q, n) */
const plane = (q, n, z0, k) => ({ q, n, z0, k });
const zAt = (pl, p) => pl.z0 + pl.k * G.dot(G.sub(p, pl.q), pl.n);

function clipHalf(poly, keep) { // keep(p) >= 0 behalten, lineare Funktion
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length]; const fa = keep(a), fb = keep(b);
    if (fa >= 0) out.push(a);
    if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); }
  }
  return out;
}

/**
 * roof: {typ, neigung, ueberstand, kniestock, richtung}
 * rect: Außenkanten der Wände {x0,y0,x1,y1}; ze: Traufhöhe an der Wandaußenkante (mm)
 * Rückgabe: { faces:[{poly:[{x,y,z}], plane}], footprint, zAt(p), gables:[{side, profile}] , ridge }
 */
export function buildRoof(roof, rect, ze) {
  const o = roof.ueberstand ?? 500; const a = G.rad(Math.max(1, Math.min(75, roof.neigung || 35))); const k = Math.tan(a);
  const { x0, y0, x1, y1 } = rect; const W = x1 - x0, D = y1 - y0;
  let dir = roof.richtung || 'auto'; if (dir === 'auto') dir = W >= D ? 'x' : 'y'; // Firstrichtung
  const S = plane({ x: x0, y: y0 }, { x: 0, y: 1 }, ze, k), N = plane({ x: x0, y: y1 }, { x: 0, y: -1 }, ze, k);
  const Wp = plane({ x: x0, y: y0 }, { x: 1, y: 0 }, ze, k), Ep = plane({ x: x1, y: y0 }, { x: -1, y: 0 }, ze, k);
  let planes = []; let gableSides = [];
  const typ = roof.typ || 'sattel';
  if (typ === 'flach') {
    const fp = [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
    return { flat: true, footprint: fp, faces: [{ poly: fp.map(p => ({ ...p, z: ze })) }], zAt: () => ze, gables: [], attika: 400 };
  }
  if (typ === 'sattel') { planes = dir === 'x' ? [S, N] : [Wp, Ep]; }
  else if (typ === 'pult') { planes = dir === 'x' ? [S] : [Wp]; }
  else if (typ === 'walm' || typ === 'zelt') { planes = [S, N, Wp, Ep]; }
  else if (typ === 'krueppelwalm') {
    const half = (dir === 'x' ? D : W) / 2; const zr = ze + k * half; const dz = (zr - ze) * 0.62; const kh = Math.tan(G.rad(Math.min(80, (roof.neigung || 35) + 15)));
    if (dir === 'x') planes = [S, N, plane({ x: x0, y: y0 }, { x: 1, y: 0 }, ze + dz, kh), plane({ x: x1, y: y0 }, { x: -1, y: 0 }, ze + dz, kh)];
    else planes = [Wp, Ep, plane({ x: x0, y: y0 }, { x: 0, y: 1 }, ze + dz, kh), plane({ x: x0, y: y1 }, { x: 0, y: -1 }, ze + dz, kh)];
  } else if (typ === 'mansard') {
    const ks = Math.tan(G.rad(70)), kf = Math.tan(G.rad(Math.min(35, roof.neigung || 30))); const d = Math.min(W, D) * 0.18; const hk = ks * d;
    for (const pl of [S, N, Wp, Ep]) { planes.push(plane(pl.q, pl.n, ze, ks)); planes.push(plane(G.add(pl.q, G.mul(pl.n, d)), pl.n, ze + hk, kf)); }
  }
  // Grundfläche mit Überstand
  let fx0 = x0 - o, fx1 = x1 + o, fy0 = y0 - o, fy1 = y1 + o;
  const footprint = [{ x: fx0, y: fy0 }, { x: fx1, y: fy0 }, { x: fx1, y: fy1 }, { x: fx0, y: fy1 }];
  const zMin = (p) => Math.min(...planes.map(pl => zAt(pl, p)));
  const faces = [];
  planes.forEach((pl, i) => {
    let poly = footprint.slice();
    for (let j = 0; j < planes.length && poly.length; j++) if (j !== i) { const pj = planes[j]; poly = clipHalf(poly, (p) => zAt(pj, p) - zAt(pl, p) + 1e-6); }
    if (poly.length >= 3 && G.polyArea(poly) > 100) faces.push({ poly: poly.map(p => ({ x: p.x, y: p.y, z: zAt(pl, p) })), plane: pl });
  });
  // Giebel: Profil über den Außenkanten, wo Dach über Traufe liegt
  const gables = [];
  const edges = [[{ x: x0, y: y0 }, { x: x1, y: y0 }, 'S'], [{ x: x1, y: y0 }, { x: x1, y: y1 }, 'O'], [{ x: x1, y: y1 }, { x: x0, y: y1 }, 'N'], [{ x: x0, y: y1 }, { x: x0, y: y0 }, 'W']];
  for (const [p, q, side] of edges) {
    const n = 48; const prof = [];
    for (let i = 0; i <= n; i++) { const t = i / n; const pt = G.lerp(p, q, t); prof.push({ ...pt, z: zMin(pt) }); }
    if (Math.max(...prof.map(r => r.z)) - ze > 30) gables.push({ side, a: p, b: q, profile: prof });
  }
  const top = Math.max(...faces.flatMap(f => f.poly.map(p => p.z)));
  return { faces, footprint, zAt: zMin, gables, top, dir };
}
