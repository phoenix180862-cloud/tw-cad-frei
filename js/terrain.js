// TW-CAD – Geländemodell aus Höhenpunkten (Delaunay-Dreiecke, Interpolation, Höhenlinien)
import * as G from './geom.js?v=20261028-0429';

function DL() { return (typeof globalThis !== 'undefined' && globalThis.Delaunator) || (typeof window !== 'undefined' && window.Delaunator); }

/** Punkte: [{x,y,z(m ü. NN)}] → Modell */
export function buildTerrain(punkte, grenze = null, rand = 6000) {
  const pts = punkte.filter(p => isFinite(p.z));
  if (pts.length < 3) {
    const z = pts.length ? pts.reduce((s, p) => s + p.z, 0) / pts.length : 0;
    return { flat: true, z0: z, at: () => z, tris: [], pts, bbox: null };
  }
  // Rahmenpunkte (außerhalb) per nächstem Nachbarn ergänzen, damit das Gelände über die Grenze reicht
  const bb0 = G.bbox(grenze && grenze.length ? [...pts, ...grenze] : pts);
  const ext = [];
  const bb = { x0: bb0.x0 - rand, y0: bb0.y0 - rand, x1: bb0.x1 + rand, y1: bb0.y1 + rand };
  const nearestZ = (p) => { let best = null, bd = Infinity; for (const q of pts) { const d = G.dist(p, q); if (d < bd) { bd = d; best = q; } } return best.z; };
  const nx = 6, ny = 6;
  for (let i = 0; i <= nx; i++) for (const y of [bb.y0, bb.y1]) { const p = { x: bb.x0 + (bb.x1 - bb.x0) * i / nx, y }; ext.push({ ...p, z: nearestZ(p), rand: true }); }
  for (let j = 1; j < ny; j++) for (const x of [bb.x0, bb.x1]) { const p = { x, y: bb.y0 + (bb.y1 - bb.y0) * j / ny }; ext.push({ ...p, z: nearestZ(p), rand: true }); }
  const all = [...pts, ...ext];
  const D = DL(); const d = D.from(all.map(p => [p.x, p.y]));
  const tris = []; for (let i = 0; i < d.triangles.length; i += 3) tris.push([d.triangles[i], d.triangles[i + 1], d.triangles[i + 2]]);
  const model = { flat: false, pts: all, tris, bbox: { ...bb, w: bb.x1 - bb.x0, h: bb.y1 - bb.y0 } };
  model.at = (x, y) => {
    for (const [a, b, c] of tris) {
      const A = all[a], B = all[b], C = all[c];
      const den = (B.y - C.y) * (A.x - C.x) + (C.x - B.x) * (A.y - C.y); if (Math.abs(den) < 1e-9) continue;
      const l1 = ((B.y - C.y) * (x - C.x) + (C.x - B.x) * (y - C.y)) / den;
      const l2 = ((C.y - A.y) * (x - C.x) + (A.x - C.x) * (y - C.y)) / den;
      const l3 = 1 - l1 - l2;
      if (l1 >= -1e-6 && l2 >= -1e-6 && l3 >= -1e-6) return l1 * A.z + l2 * B.z + l3 * C.z;
    }
    return nearestZ({ x, y });
  };
  return model;
}

/** Höhenlinien (Marching Triangles). step in m. → [{z, segs:[[a,b]]}] */
export function contours(model, step = 0.25) {
  if (model.flat || !model.tris.length) return [];
  const zs = model.pts.map(p => p.z); const zmin = Math.min(...zs), zmax = Math.max(...zs);
  const out = [];
  for (let z = Math.ceil(zmin / step) * step; z <= zmax + 1e-9; z += step) {
    const segs = [];
    for (const t of model.tris) {
      const P = t.map(i => model.pts[i]); const cut = [];
      for (let k = 0; k < 3; k++) {
        const a = P[k], b = P[(k + 1) % 3];
        if ((a.z - z) * (b.z - z) < 0) { const f = (z - a.z) / (b.z - a.z); cut.push({ x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f }); }
      }
      if (cut.length === 2) segs.push(cut);
    }
    if (segs.length) out.push({ z: Math.round(z * 1000) / 1000, segs, haupt: Math.abs(z / (step * 4) - Math.round(z / (step * 4))) < 1e-6 });
  }
  return out;
}
