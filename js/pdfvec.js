// TW-CAD – Vektor-PDF auswerten: Linien lesen, Maßstab bestimmen, Wände/Öffnungen aus Maßen rekonstruieren
// Reine Rechenfunktionen (auch in Node testbar).
import * as G from './geom.js?v=20261028-0429';

/* ───────── 1. Linien aus der pdf.js-Operatorliste ───────── */
export function extractPaths(opList, OPS, vt /* viewport.transform */) {
  const segs = [], curves = [], fills = [];
  let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
  const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
  let lw = 1;
  const T = (x, y) => { const m = mul(vt, ctm); return { x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] }; };
  const lwScale = () => { const m = mul(vt, ctm); return Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])); };
  const { fnArray, argsArray } = opList;
  let pending = null;
  for (let i = 0; i < fnArray.length; i++) {
    const fn = fnArray[i], args = argsArray[i];
    if (fn === OPS.save) stack.push(ctm.slice());
    else if (fn === OPS.restore) { if (stack.length) ctm = stack.pop(); }
    else if (fn === OPS.transform) ctm = mul(ctm, args);
    else if (fn === OPS.paintFormXObjectBegin) { stack.push(ctm.slice()); if (args && args[0]) ctm = mul(ctm, args[0]); }
    else if (fn === OPS.paintFormXObjectEnd) { if (stack.length) ctm = stack.pop(); }
    else if (fn === OPS.setLineWidth) lw = args[0];
    else if (fn === OPS.constructPath) {
      const ops = args[0], co = args[1]; let k = 0; let cur = null, start = null; const path = { segs: [], curves: [], lw: lw * lwScale() };
      for (const op of ops) {
        if (op === OPS.moveTo) { cur = T(co[k], co[k + 1]); start = cur; k += 2; }
        else if (op === OPS.lineTo) { const p = T(co[k], co[k + 1]); k += 2; if (cur) path.segs.push([cur, p]); cur = p; }
        else if (op === OPS.curveTo) { const c1 = T(co[k], co[k + 1]), c2 = T(co[k + 2], co[k + 3]), p = T(co[k + 4], co[k + 5]); k += 6; if (cur) path.curves.push([cur, c1, c2, p]); cur = p; }
        else if (op === OPS.curveTo2 || op === OPS.curveTo3) { const c = T(co[k], co[k + 1]), p = T(co[k + 2], co[k + 3]); k += 4; if (cur) path.curves.push([cur, c, c, p]); cur = p; }
        else if (op === OPS.closePath) { if (cur && start && G.dist(cur, start) > 1e-6) path.segs.push([cur, start]); cur = start; }
        else if (op === OPS.rectangle) { const x = co[k], y = co[k + 1], w = co[k + 2], hh = co[k + 3]; k += 4; const a = T(x, y), b = T(x + w, y), c = T(x + w, y + hh), d = T(x, y + hh); path.segs.push([a, b], [b, c], [c, d], [d, a]); cur = a; start = a; }
      }
      pending = path;
    } else if (pending && [OPS.stroke, OPS.closeStroke, OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke, OPS.endPath].includes(fn)) {
      const stroked = ![OPS.fill, OPS.eoFill, OPS.endPath].includes(fn); const filled = [OPS.fill, OPS.eoFill, OPS.fillStroke, OPS.eoFillStroke, OPS.closeFillStroke, OPS.closeEOFillStroke].includes(fn);
      if (fn !== OPS.endPath) {
        for (const s of pending.segs) segs.push({ a: s[0], b: s[1], lw: pending.lw, stroked, filled });
        for (const c of pending.curves) curves.push({ pts: c, lw: pending.lw });
      }
      pending = null;
    }
  }
  return { segs, curves };
}

/* ───────── 2. Text: Maßstab und Maßzahlen ───────── */
export function textItems(textContent, vt) {
  const out = [];
  for (const it of textContent.items) {
    if (!it.str || !it.str.trim()) continue; const m = it.transform;
    const x = vt[0] * m[4] + vt[2] * m[5] + vt[4], y = vt[1] * m[4] + vt[3] * m[5] + vt[5];
    const size = Math.hypot(m[2], m[3]) * Math.abs(vt[3] || vt[0]);
    out.push({ str: it.str.trim(), x, y, size, rot: Math.atan2(m[1], m[0]), w: it.width });
  }
  return out;
}
export function detectScaleText(texts) {
  const counts = new Map();
  for (const t of texts) { const all = t.str.matchAll(/(?:^|[^\d])1\s*:\s*(\d{1,4})(?!\d)/g); for (const m of all) { const v = +m[1]; if ([1, 5, 10, 20, 25, 50, 75, 100, 125, 150, 200, 250, 500, 1000].includes(v)) counts.set(v, (counts.get(v) || 0) + (/M|Maßstab|Mst/i.test(t.str) ? 3 : 1)); } }
  let best = null, bc = 0; for (const [v, c] of counts) if (c > bc) { bc = c; best = v; }
  return best;
}
/** Zahlen, die wie Maße aussehen → Kandidaten in mm (mehrdeutig: m oder cm) */
export function dimNumbers(texts) {
  const out = [];
  for (const t of texts) {
    const s = t.str.replace(/\s/g, ''); const m = s.match(/^(\d{1,2})[,.](\d{2,3})$/) || s.match(/^(\d{1,3})[,.](\d)$/) || s.match(/^(\d{2,4})$/);
    if (!m) continue;
    const v = parseFloat(s.replace(',', '.'));
    const cands = [];
    if (/^\d{1,2}[,.]\d{2,3}$/.test(s)) cands.push(v * 1000); // 3,51 m
    if (/^\d{1,3}[,.]\d$/.test(s)) cands.push(v * 10); // 88,5 cm
    if (/^\d{2,4}$/.test(s)) { cands.push(v * 10); if (v >= 100) cands.push(v); } // 24 cm / 1010 mm
    out.push({ t, cands });
  }
  return out;
}

/* ───────── 3. Linien bereinigen ───────── */
function angOf(s) { let a = Math.atan2(s.b.y - s.a.y, s.b.x - s.a.x); if (a < 0) a += Math.PI; if (a >= Math.PI - 1e-9) a -= Math.PI; return a; }
export function toMM(paths, k) {
  const f = (p) => ({ x: p.x * k, y: -p.y * k });
  return { segs: paths.segs.map(s => ({ ...s, a: f(s.a), b: f(s.b) })).filter(s => G.dist(s.a, s.b) > 1), curves: paths.curves.map(c => ({ ...c, pts: c.pts.map(f) })) };
}
/** Kollineare Stücke zusammenfassen */
export function mergeCollinear(segs, angTol = 0.006, offTol = 1.5, gapTol = 4) {
  const items = segs.map(s => { const a = angOf(s); const d = { x: Math.cos(a), y: Math.sin(a) }; const n = { x: -d.y, y: d.x }; const off = G.dot(s.a, n); let t0 = G.dot(s.a, d), t1 = G.dot(s.b, d); if (t0 > t1) [t0, t1] = [t1, t0]; return { a, d, n, off, t0, t1, lw: s.lw, filled: s.filled }; });
  items.sort((p, q) => p.a - q.a || p.off - q.off || p.t0 - q.t0);
  const out = [];
  for (const it of items) {
    let m = null;
    for (let j = out.length - 1; j >= 0 && j >= out.length - 60; j--) { const o = out[j]; if (Math.abs(o.a - it.a) < angTol && Math.abs(o.off - it.off) < offTol && it.t0 <= o.t1 + gapTol && it.t1 >= o.t0 - gapTol) { m = o; break; } }
    if (m) { m.t0 = Math.min(m.t0, it.t0); m.t1 = Math.max(m.t1, it.t1); m.lw = Math.max(m.lw, it.lw); }
    else out.push({ ...it });
  }
  return out.map(o => ({ ...o, len: o.t1 - o.t0, pa: G.add(G.mul(o.n, o.off), G.mul(o.d, o.t0)), pb: G.add(G.mul(o.n, o.off), G.mul(o.d, o.t1)) }));
}

/* ───────── 4. Wände erkennen ───────── */
export const STD_DICKEN = [100, 115, 125, 150, 175, 200, 240, 250, 300, 365, 425, 490];
function snapThick(t) { let best = t, bd = Infinity; for (const s of STD_DICKEN) { const d = Math.abs(s - t); if (d < bd) { bd = d; best = s; } } return bd <= Math.max(8, t * 0.04) ? best : Math.round(t / 5) * 5; }

export function detectWalls(lines, curves, opt = {}) {
  const minT = opt.minT || 70, maxT = opt.maxT || 560, minLen = opt.minLen || 250;
  const L = lines.filter(l => l.len >= minLen);
  // vorherrschende Richtungen
  const hist = new Map(); let total = 0;
  for (const l of L) { if (l.len < 600) continue; const k = Math.round(l.a / 0.0087) % 361; hist.set(k, (hist.get(k) || 0) + l.len); total += l.len; }
  const dom = [...hist.entries()].filter(([, v]) => v > total * 0.04).map(([k]) => k * 0.0087);
  const okAng = (a) => !dom.length || dom.some(d => Math.abs(d - a) < 0.012 || Math.abs(Math.abs(d - a) - Math.PI) < 0.012);
  const cand = L.filter(l => okAng(l.a));
  // Paare paralleler Linien
  const pieces = [];
  const byAng = [...cand].sort((p, q) => p.a - q.a);
  for (let i = 0; i < byAng.length; i++) {
    const A = byAng[i];
    for (let j = i + 1; j < byAng.length; j++) {
      const B = byAng[j]; if (B.a - A.a > 0.01) break;
      const t = Math.abs(B.off - A.off); if (t < minT || t > maxT) continue;
      const o0 = Math.max(A.t0, B.t0), o1 = Math.min(A.t1, B.t1); const ov = o1 - o0; if (ov < Math.min(300, 0.45 * Math.min(A.len, B.len))) continue;
      // keine dritte durchgehende Linie dazwischen (sonst ist es Schichtenwand → später verschmelzen)
      pieces.push({ A, B, a: A.a, d: A.d, n: A.n, off0: Math.min(A.off, B.off), off1: Math.max(A.off, B.off), t0: o0, t1: o1 });
    }
  }
  // je Linie nur der nächste Partner auf jeder Seite
  const best = new Map();
  for (const p of pieces) {
    const w = p.off1 - p.off0;
    for (const [ln, side] of [[p.A, p.A.off < p.B.off ? 1 : -1], [p.B, p.B.off < p.A.off ? 1 : -1]]) {
      const key = ln; const cur = best.get(key) || {}; const k = side > 0 ? 'up' : 'dn';
      if (!cur[k] || w < cur[k].off1 - cur[k].off0 - 1) cur[k] = p; best.set(key, cur);
    }
  }
  const keep = new Set(); for (const v of best.values()) { if (v.up) keep.add(v.up); if (v.dn) keep.add(v.dn); }
  let walls = [...keep].filter(p => { const pu = best.get(p.A), pd = best.get(p.B); return (pu && (pu.up === p || pu.dn === p)) && (pd && (pd.up === p || pd.dn === p)); });
  // Schichtenwände: benachbarte Stücke mit gemeinsamer Linie und gleicher Ausdehnung zusammenlegen
  let changed = true;
  while (changed) {
    changed = false;
    outer: for (let i = 0; i < walls.length; i++) for (let j = 0; j < walls.length; j++) {
      if (i === j) continue; const p = walls[i], q = walls[j];
      if (Math.abs(p.a - q.a) > 0.01) continue;
      if (Math.abs(p.off1 - q.off0) < 1.5 && q.off1 - p.off0 <= maxT && Math.min(p.t1, q.t1) - Math.max(p.t0, q.t0) > 0.8 * Math.min(p.t1 - p.t0, q.t1 - q.t0)) {
        walls[i] = { ...p, off1: q.off1, t0: Math.max(p.t0, q.t0), t1: Math.min(p.t1, q.t1), layered: true }; walls.splice(j, 1); changed = true; break outer;
      }
    }
  }
  // zu Wandstücken
  let ws = walls.map(p => { const off = (p.off0 + p.off1) / 2; return { a: p.a, d: p.d, n: p.n, off, t: p.off1 - p.off0, t0: p.t0, t1: p.t1 }; });
  // kollineare Wandstücke verbinden, Lücken = Öffnungen
  ws.sort((p, q) => p.a - q.a || p.off - q.off || p.t0 - q.t0);
  const merged = [];
  for (const w of ws) {
    const m = merged.find(o => Math.abs(o.a - w.a) < 0.01 && Math.abs(o.off - w.off) < 25 && Math.abs(o.t - w.t) < 30 && w.t0 <= o.t1 + 2700 && w.t1 >= o.t0 - 5);
    if (m) {
      const gap = w.t0 - m.t1;
      if (gap > 380) m.gaps.push([m.t1, w.t0]);
      m.t1 = Math.max(m.t1, w.t1); m.t0 = Math.min(m.t0, w.t0); m.t = Math.max(m.t, w.t); m.parts++;
    } else merged.push({ ...w, gaps: [], parts: 1 });
  }
  // Wände bauen
  const out = [];
  for (const m of merged) {
    const thick = snapThick(m.t);
    const pa = G.add(G.mul(m.n, m.off), G.mul(m.d, m.t0)), pb = G.add(G.mul(m.n, m.off), G.mul(m.d, m.t1));
    if (G.dist(pa, pb) < 200) continue;
    const ops = [];
    for (const [g0, g1] of m.gaps) {
      const width = g1 - g0; const c = G.add(G.mul(m.n, m.off), G.mul(m.d, (g0 + g1) / 2));
      // Türbogen in der Nähe?
      const isDoor = curves.some(cv => { const ch = G.dist(cv.pts[0], cv.pts[3]); const mid = G.mul(G.add(cv.pts[0], cv.pts[3]), 0.5); return ch > width * 0.6 && ch < width * 1.7 && G.dist(mid, c) < width * 1.3; });
      // Glaslinien (parallel, innerhalb der Lücke)
      const glass = lines.filter(l => Math.abs(l.a - m.a) < 0.02 && Math.abs(l.off - m.off) < m.t / 2 + 5 && l.t0 >= g0 - 30 && l.t1 <= g1 + 30 && l.len > width * 0.6).length;
      ops.push({ s0: g0 - m.t0, s1: g1 - m.t0, width, kind: isDoor ? 'door' : glass >= 1 ? 'window' : 'opening' });
    }
    out.push({ a: pa, b: pb, thickness: thick, rawT: m.t, ops });
  }
  // Glaslinien in Fensteröffnungen sind keine Wände
  const keepW = out.filter(w => {
    if (w.thickness >= 100) return true;
    const u = G.norm(G.sub(w.b, w.a)); const m = G.mid(w.a, w.b);
    return !out.some(o => o !== w && o.ops.length && Math.abs(G.cross(u, G.norm(G.sub(o.b, o.a)))) < 0.02 && G.closestOnLine(m, o.a, o.b).d < o.thickness / 2 + 5 && o.ops.some(op => { const ou = G.norm(G.sub(o.b, o.a)); const s = G.dot(G.sub(m, o.a), ou); return s > op.s0 - 50 && s < op.s1 + 50; }));
  });
  joinWalls(keepW);
  return { walls: keepW, dominant: dom };
}
/** Endpunkte zu Ecken/T-Stößen verbinden */
export function joinWalls(walls) {
  for (const w of walls) for (const end of ['a', 'b']) {
    const p = w[end]; const u = G.norm(G.sub(w.b, w.a)); const dirOut = end === 'a' ? G.mul(u, -1) : u;
    let best = null;
    for (const o of walls) {
      if (o === w) continue; const ou = G.norm(G.sub(o.b, o.a)); if (Math.abs(G.cross(u, ou)) < 0.3) continue;
      const x = G.lineIntersect(p, dirOut, o.a, ou); if (!x) continue;
      const along = G.dot(G.sub(x, p), dirOut); const lim = o.thickness / 2 + w.thickness / 2 + 40;
      if (along < -lim || along > lim) continue;
      const tt = G.projectT(x, o.a, o.b); const oL = G.dist(o.a, o.b); if (tt * oL < -w.thickness - 40 || tt * oL > oL + w.thickness + 40) continue;
      const d = Math.abs(along); if (!best || d < best.d) best = { x, d, o, tt };
    }
    if (best) {
      const shift = G.dot(G.sub(best.x, p), u); w[end] = best.x;
      if (end === 'a') for (const op of w.ops) { op.s0 -= shift; op.s1 -= shift; }
      // L-Ecke: anderes Wandende ebenfalls auf den Schnittpunkt ziehen
      const o = best.o; const oL = G.dist(o.a, o.b);
      if (best.tt * oL < o.thickness + 60 && best.tt * oL > -o.thickness - 60) { const sh = G.dist(o.a, best.x) * (best.tt < 0 ? -1 : 1); o.a = G.clone(best.x); for (const op of o.ops) { op.s0 -= best.tt * oL; op.s1 -= best.tt * oL; } }
      else if (best.tt * oL > oL - o.thickness - 60 && best.tt * oL < oL + o.thickness + 60) o.b = G.clone(best.x);
    }
  }
}

/** Maßstab über Maßzahlen bestätigen/finden: Anteil Wandlängen, die zu einer Maßzahl passen */
export function scoreScale(lines, nums, kPt) {
  const lens = lines.filter(l => l.len > 50).map(l => l.len * kPt);
  const vals = nums.flatMap(n => n.cands);
  if (!vals.length || !lens.length) return { hits: 0, of: vals.length };
  let hits = 0; for (const v of vals) if (v > 300 && lens.some(L => Math.abs(L - v) <= Math.max(6, v * 0.006))) hits++;
  return { hits, of: vals.filter(v => v > 300).length };
}
export function bestScale(linesPt, nums, hint) {
  const mmPerPt = 25.4 / 72; const tries = [20, 25, 50, 75, 100, 125, 200, 250, 500];
  let best = null;
  for (const sc of tries) { const r = scoreScale(linesPt, nums, mmPerPt * sc); const score = r.hits + (sc === hint ? 3 : 0); if (!best || score > best.score) best = { sc, score, ...r }; }
  return best;
}
