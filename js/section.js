// TW-CAD – Schnitte und Ansichten (vektoriell, maßstäblich druckbar)
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import { buildRoof } from './roof.js?v=20261028-0429';
import { buildTerrain } from './terrain.js?v=20261028-0429';
import { matById } from './material-db.js?v=20261028-0429';
import { CanvasPainter, shade } from './painter.js?v=20261028-0429';
import { PEN } from './render2d.js?v=20261028-0429';
import { icon } from './icons.js?v=20261028-0429';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };

export function roofsOf(doc) {
  const out = [];
  for (const rf of doc.p.roofs) {
    const st = doc.storeyById(rf.storey); if (!st) continue; const geo = W.storeyGeometry(doc, st.id); const pts = geo.outers.flat(); if (!pts.length) continue;
    const bb = G.bbox(pts); const ze = st.elevation + st.height + (rf.kniestock || 0);
    out.push({ rf, st, R: buildRoof(rf, bb, ze), ze, bb });
  }
  return out;
}
function matColor(id, col, def) { const m = matById(id); return col || (m && m.farben[0].hex) || def; }
function levelMark(P, x, z, txt, ps, left = false) {
  const s = 1.4 * ps; P.fill([[{ x, y: z }, { x: x - s, y: z + s * 1.2 }, { x: x + s, y: z + s * 1.2 }]], '#111', 1);
  P.line({ x: x - s * 2, y: z }, { x: x + s * 6, y: z }, { color: '#111', w: PEN.duenn });
  P.text({ x: x + s * 1.4, y: z + s * 0.4 }, txt, 2.2, {});
}
const fmtZ = (z) => (z >= 0 ? (Math.abs(z) < 0.5 ? '±' : '+') : '−') + Math.abs(z / 1000).toFixed(2).replace('.', ',');

/** Ansicht aus Richtung: 'S' (Blick nach Norden) | 'N' | 'O' | 'W' */
export function drawElevation(P, doc, dir, opt = {}) {
  const ps = opt.ps || 100; const look = { S: { x: 0, y: 1 }, N: { x: 0, y: -1 }, O: { x: -1, y: 0 }, W: { x: 1, y: 0 } }[dir];
  const right = { x: look.y, y: -look.x };
  const X = (p) => G.dot(p, right), D = (p) => G.dot(p, look);
  const items = []; let xmin = Infinity, xmax = -Infinity, zmax = 0;
  for (const st of doc.p.storeys) {
    const geo = W.storeyGeometry(doc, st.id);
    for (const g of geo.wg.values()) {
      const os = W.outsideSide(geo, g); if (!os) continue;
      for (const side of (os === 'beide' ? ['L', 'R'] : [os])) {
        const nrm = side === 'L' ? g.n : G.mul(g.n, -1); if (G.dot(nrm, look) > -0.05) continue;
        const pa = side === 'L' ? g.aL : g.aR, pb = side === 'L' ? g.bL : g.bR;
        const x0 = Math.min(X(pa), X(pb)), x1 = Math.max(X(pa), X(pb)); if (x1 - x0 < 1) continue;
        const z0 = st.elevation, z1 = st.elevation + (g.w.height || st.height);
        const col = matColor(g.w.facade, g.w.facadeColor, '#f2f1ec');
        const ops = geo.openings.filter(o => o.g === g).map(o => { const c0 = X(G.add(o.c0, G.mul(nrm, g.w.thickness / 2))), c1 = X(G.add(o.c1, G.mul(nrm, g.w.thickness / 2))); return { o: o.o, x0: Math.min(c0, c1), x1: Math.max(c0, c1), z0: st.elevation + (o.o.sill || 0), z1: st.elevation + (o.o.sill || 0) + o.o.height }; });
        items.push({ kind: 'wall', depth: (D(pa) + D(pb)) / 2, x0, x1, z0, z1, col, sockel: st === doc.p.storeys[0] && g.w.sockelH ? { h: g.w.sockelH, col: matColor(g.w.sockel, g.w.sockelColor, '#4a4d4f') } : null, ops, stilCol: null });
        xmin = Math.min(xmin, x0); xmax = Math.max(xmax, x1); zmax = Math.max(zmax, z1);
      }
    }
  }
  for (const { rf, R, ze } of roofsOf(doc)) {
    const rc = matColor(rf.material, rf.farbe, '#8a3b25');
    for (const f of R.faces || []) { const poly = f.poly.map(p => ({ x: X(p), y: p.z + 220 })); items.push({ kind: 'roof', depth: f.poly.reduce((s, p) => s + D(p), 0) / f.poly.length, poly, col: rc }); for (const p of poly) { zmax = Math.max(zmax, p.y); xmin = Math.min(xmin, p.x); xmax = Math.max(xmax, p.x); } }
    for (const gb of R.gables || []) { const u = G.norm(G.sub(gb.b, gb.a)); const nrm = G.mul(G.perp(u), -1); if (G.dot(nrm, look) > -0.05) continue; const poly = [...gb.profile.map(p => ({ x: X(p), y: Math.max(ze, p.z) }))].concat([{ x: X(gb.b), y: ze }, { x: X(gb.a), y: ze }]); items.push({ kind: 'gable', depth: (D(gb.a) + D(gb.b)) / 2, poly, col: '#f2f1ec' }); }
  }
  if (!isFinite(xmin)) return null;
  items.sort((a, b) => b.depth - a.depth);
  // Gelände
  const s = doc.p.site; const tm = buildTerrain(s.punkte, s.grenze); const nn = s.nnEG || 0;
  const terrainZ = (x) => { if (tm.flat && !s.punkte.length) return -300; const p = G.add(G.mul(right, x), G.mul(look, -1e5)); // Profil an Vorderkante
    return ((tm.at ? tm.at(...(() => { // Gelände entlang der Gebäudevorderseite
      return [p.x, p.y]; })()) : nn) - nn) * 1000; };
  for (const it of items) {
    if (it.kind === 'wall') {
      const rect = [{ x: it.x0, y: it.z0 }, { x: it.x1, y: it.z0 }, { x: it.x1, y: it.z1 }, { x: it.x0, y: it.z1 }];
      P.fill([rect, ...it.ops.map(o => [{ x: o.x0, y: o.z0 }, { x: o.x1, y: o.z0 }, { x: o.x1, y: o.z1 }, { x: o.x0, y: o.z1 }])], opt.farbig === false ? '#ffffff' : it.col, 1, { color: '#111', w: PEN.kraeftig });
      if (it.sockel) P.fill([[{ x: it.x0, y: it.z0 }, { x: it.x1, y: it.z0 }, { x: it.x1, y: it.z0 + it.sockel.h }, { x: it.x0, y: it.z0 + it.sockel.h }]], opt.farbig === false ? '#e5e5e5' : it.sockel.col, 1, { color: '#111', w: PEN.duenn });
      for (const o of it.ops) {
        const sc = matColor(o.o.stil, o.o.stilColor, '#f1f0ea'); const f = 70;
        const q = [{ x: o.x0, y: o.z0 }, { x: o.x1, y: o.z0 }, { x: o.x1, y: o.z1 }, { x: o.x0, y: o.z1 }];
        P.fill([q], opt.farbig === false ? '#ffffff' : sc, 1, { color: '#111', w: PEN.mittel });
        const gl = [{ x: o.x0 + f, y: o.z0 + f }, { x: o.x1 - f, y: o.z0 + f }, { x: o.x1 - f, y: o.z1 - f }, { x: o.x0 + f, y: o.z1 - f }];
        if (o.o.kind === 'window') {
          P.fill([gl], opt.farbig === false ? '#ffffff' : '#a9c4d6', 1, { color: '#111', w: PEN.duenn });
          const n = o.o.teilung === 'fest' ? 1 : +(o.o.teilung || (o.x1 - o.x0 > 1200 ? 2 : 1));
          for (let i = 1; i < n; i++) { const x = o.x0 + (o.x1 - o.x0) * i / n; P.line({ x, y: o.z0 }, { x, y: o.z1 }, { color: '#111', w: PEN.mittel }); }
          for (let i = 0; i < n; i++) { const xa = o.x0 + (o.x1 - o.x0) * i / n + f, xb = o.x0 + (o.x1 - o.x0) * (i + 1) / n - f; P.polyline([{ x: xa, y: o.z1 - f }, { x: (xa + xb) / 2, y: o.z0 + f }, { x: xb, y: o.z1 - f }], { color: '#555', w: PEN.fein, dash: [2, 1] }); }
          P.fill([[{ x: o.x0 - 30, y: o.z0 - 40 }, { x: o.x1 + 30, y: o.z0 - 40 }, { x: o.x1 + 30, y: o.z0 }, { x: o.x0 - 30, y: o.z0 }]], '#9aa0a6', 1, { color: '#111', w: PEN.fein });
        } else if (o.o.kind === 'door') {
          P.polyline(gl, { color: '#111', w: PEN.duenn }, true);
          const st2 = matById(o.o.stil); if (st2 && st2.design === 'glasstreifen_seitlich') P.fill([[{ x: o.x0 + f + 120, y: o.z0 + 300 }, { x: o.x0 + f + 220, y: o.z0 + 300 }, { x: o.x0 + f + 220, y: o.z1 - 300 }, { x: o.x0 + f + 120, y: o.z1 - 300 }]], '#a9c4d6', 1);
          P.line({ x: o.x1 - f - 120, y: o.z0 + 900 }, { x: o.x1 - f - 120, y: o.z0 + 1400 }, { color: '#111', w: PEN.kraeftig });
        }
      }
    } else if (it.kind === 'roof') {
      P.fill([it.poly], opt.farbig === false ? '#ffffff' : it.col, 1, { color: '#111', w: PEN.kraeftig });
      if (opt.farbig !== false) { const bb = G.bbox(it.poly); for (let y = bb.y0 + 180; y < bb.y1; y += 360) { const segs = G.clipLines([[{ x: bb.x0 - 10, y }, { x: bb.x1 + 10, y }]], [it.poly]); for (const sgm of segs) P.polyline(sgm, { color: shade(it.col, -0.35), w: PEN.fein }); } }
    } else if (it.kind === 'gable') P.fill([it.poly], opt.farbig === false ? '#ffffff' : it.col, 1, { color: '#111', w: PEN.kraeftig });
  }
  // Gelände-Linie
  const gz = s.punkte.length >= 1 ? (() => { const c = G.polyCentroid(s.grenze && s.grenze.length ? s.grenze : s.punkte); const zs = []; for (let x = xmin - 2000; x <= xmax + 2000; x += 250) { const along = x; const base = G.add(G.mul(right, along), G.mul(look, G.dot(c, look) - 6000)); const p = { x: base.x, y: base.y }; zs.push({ x, y: ((tm.at ? tm.at(p.x, p.y) : nn) - nn) * 1000 }); } return zs; })() : [{ x: xmin - 2000, y: -300 }, { x: xmax + 2000, y: -300 }];
  P.polyline(gz, { color: '#3f6212', w: PEN.dick });
  const below = [...gz, { x: gz[gz.length - 1].x, y: Math.min(...gz.map(p => p.y)) - 600 }, { x: gz[0].x, y: Math.min(...gz.map(p => p.y)) - 600 }];
  P.fill([below], '#e2e8d6', 0.6);
  // Höhenkoten
  const xm = xmax + 1500;
  for (const st of doc.p.storeys) levelMark(P, xm, st.elevation, `${fmtZ(st.elevation)} OKFF ${st.name}`, ps);
  for (const { R, ze } of roofsOf(doc)) { levelMark(P, xm, ze, `${fmtZ(ze)} Traufe`, ps); if (R.top) levelMark(P, xm, R.top + 220, `${fmtZ(R.top + 220)} First`, ps); }
  P.text({ x: xmin, y: Math.max(zmax, 0) + 1200 }, `Ansicht ${{ S: 'Süd', N: 'Nord', O: 'Ost', W: 'West' }[dir]}`, 5, { bold: true });
  return { x0: xmin - 2500, y0: Math.min(-1500, ...gz.map(p => p.y)) - 800, x1: xm + 4000, y1: zmax + 2000 };
}

/** Schnitt entlang Linie a→b, Blick nach links (oder rechts mit flip) */
export function drawSection(P, doc, sec, opt = {}) {
  const ps = opt.ps || 100; const a = sec.a, b = sec.b; const u = G.norm(G.sub(b, a)); let look = G.perp(u); if (sec.flip) look = G.mul(look, -1);
  const L = G.dist(a, b); const X = (p) => G.dot(G.sub(p, a), u), D = (p) => G.dot(G.sub(p, a), look);
  const cutPolyLine = (poly) => { // Intervalle der Schnittlinie innerhalb eines Polygons
    const ts = []; for (let i = 0; i < poly.length; i++) { const x = G.segIntersect(a, b, poly[i], poly[(i + 1) % poly.length]); if (x) ts.push(x.t * L); }
    ts.sort((p, q) => p - q); const out = []; for (let i = 0; i + 1 < ts.length; i += 2) if (ts[i + 1] - ts[i] > 1) out.push([ts[i], ts[i + 1]]); return out;
  };
  let zmax = 0; const hatchPolys = [];
  // Ansicht dahinter (dünn)
  for (const st of doc.p.storeys) {
    const geo = W.storeyGeometry(doc, st.id); const z0 = st.elevation;
    for (const g of geo.wg.values()) {
      for (const side of ['L', 'R']) {
        const nrm = side === 'L' ? g.n : G.mul(g.n, -1); if (G.dot(nrm, look) > -0.3) continue;
        const pa = side === 'L' ? g.aL : g.aR, pb = side === 'L' ? g.bL : g.bR; const da = D(pa), db = D(pb); if (da < 50 || db < 50) continue;
        if (da > 12000) continue;
        const x0 = Math.max(0, Math.min(X(pa), X(pb))), x1 = Math.min(L, Math.max(X(pa), X(pb))); if (x1 - x0 < 10) continue;
        const z1 = z0 + (g.w.height || st.height);
        P.polyline([{ x: x0, y: z0 }, { x: x1, y: z0 }, { x: x1, y: z1 }, { x: x0, y: z1 }], { color: '#9ca3af', w: PEN.fein }, true);
        for (const o of geo.openings.filter(o => o.g === g)) { const c0 = X(o.c0), c1 = X(o.c1); const xo0 = Math.max(x0, Math.min(c0, c1)), xo1 = Math.min(x1, Math.max(c0, c1)); if (xo1 - xo0 < 5) continue; const zz0 = z0 + (o.o.sill || 0), zz1 = zz0 + o.o.height; P.polyline([{ x: xo0, y: zz0 }, { x: xo1, y: zz0 }, { x: xo1, y: zz1 }, { x: xo0, y: zz1 }], { color: '#9ca3af', w: PEN.fein }, true); }
      }
    }
  }
  // Geschnittene Bauteile
  for (const st of doc.p.storeys) {
    const geo = W.storeyGeometry(doc, st.id); const z0 = st.elevation;
    for (const g of geo.wg.values()) {
      for (const [t0, t1] of cutPolyLine(g.poly)) {
        const z1 = z0 + (g.w.height || st.height); const mid = G.add(a, G.mul(u, (t0 + t1) / 2)); const sAx = G.dot(G.sub(mid, g.a), g.u);
        const op = geo.openings.find(o => o.g === g && sAx > o.s0 && sAx < o.s1);
        const parts = op ? [[z0, z0 + (op.o.sill || 0)], [z0 + (op.o.sill || 0) + op.o.height, z1]].filter(([p, q]) => q - p > 5) : [[z0, z1]];
        for (const [za, zb] of parts) hatchPolys.push([{ x: t0, y: za }, { x: t1, y: za }, { x: t1, y: zb }, { x: t0, y: zb }]);
        if (op) { const zz0 = z0 + (op.o.sill || 0), zz1 = zz0 + op.o.height; if (op.o.kind === 'window') { P.line({ x: (t0 + t1) / 2 - 40, y: zz0 }, { x: (t0 + t1) / 2 - 40, y: zz1 }, { color: '#111', w: PEN.mittel }); P.line({ x: (t0 + t1) / 2 + 40, y: zz0 }, { x: (t0 + t1) / 2 + 40, y: zz1 }, { color: '#111', w: PEN.mittel }); } }
        zmax = Math.max(zmax, z1);
      }
    }
    // Decke unter diesem Geschoss
    for (const it of geo.body) for (const [t0, t1] of cutPolyLine(it.outer)) hatchPolys.push({ slab: true, poly: [{ x: t0, y: z0 - (st.slab || 200) }, { x: t1, y: z0 - (st.slab || 200) }, { x: t1, y: z0 }, { x: t0, y: z0 }] });
    // Räume: Bezeichnung + Fußboden
    for (const r of doc.all('room', st.id)) if (r.poly) for (const [t0, t1] of cutPolyLine(r.poly)) { P.text({ x: (t0 + t1) / 2, y: z0 + 1200 }, `${r.nr || ''} ${r.name}`.trim(), 2.6, { align: 'center' }); if (r.tiles && r.tiles.boden && r.tiles.boden.aktiv) P.line({ x: t0, y: z0 + 10 }, { x: t1, y: z0 + 10 }, { color: '#0e7c6b', w: PEN.kraeftig }); }
  }
  for (const it of hatchPolys) { const poly = it.slab ? it.poly : it; P.fill([poly], it.slab ? '#c7c7c7' : '#ffffff', 1, { color: '#111', w: PEN.dick }); }
  const hatch = []; const wallsOnly = hatchPolys.filter(x => !x.slab);
  if (wallsOnly.length) { const bb = G.bbox(wallsOnly.flat()); const sp = 1.6 * ps; for (let k = -bb.h; k < bb.w + bb.h; k += sp) hatch.push([{ x: bb.x0 + k, y: bb.y0 }, { x: bb.x0 + k + bb.h, y: bb.y1 }]); for (const l of G.clipLines(hatch, wallsOnly)) P.polyline(l, { color: '#4b5563', w: PEN.fein }); }
  // Dach geschnitten
  for (const { rf, R, ze } of roofsOf(doc)) {
    for (const f of R.faces || []) {
      const poly2 = f.poly.map(p => ({ x: p.x, y: p.y }));
      for (const [t0, t1] of cutPolyLine(poly2)) {
        const pa = G.add(a, G.mul(u, t0)), pb = G.add(a, G.mul(u, t1)); const za = R.zAt(pa), zb = R.zAt(pb); const pl = f.plane;
        const zf = (p) => pl.z0 + pl.k * G.dot(G.sub(p, pl.q), pl.n);
        const q = [{ x: t0, y: zf(pa) }, { x: t1, y: zf(pb) }, { x: t1, y: zf(pb) + 220 }, { x: t0, y: zf(pa) + 220 }];
        P.fill([q], '#d4a373', 1, { color: '#111', w: PEN.dick }); zmax = Math.max(zmax, zf(pa) + 220, zf(pb) + 220);
      }
    }
    for (const gb of R.gables || []) for (const [t0, t1] of [[0, 0]]) { }
  }
  // Gelände entlang der Schnittlinie
  const s = doc.p.site; const tm = buildTerrain(s.punkte, s.grenze); const nn = s.nnEG || 0;
  const gz = []; for (let t = -2000; t <= L + 2000; t += 200) { const p = G.add(a, G.mul(u, t)); gz.push({ x: t, y: s.punkte.length ? ((tm.at ? tm.at(p.x, p.y) : nn) - nn) * 1000 : -300 }); }
  P.polyline(gz, { color: '#3f6212', w: PEN.dick });
  const zl = Math.min(...gz.map(p => p.y)) - 800; P.fill([[...gz, { x: gz[gz.length - 1].x, y: zl }, { x: gz[0].x, y: zl }]], '#e2e8d6', 0.6);
  for (const st of doc.p.storeys) levelMark(P, L + 1500, st.elevation, `${fmtZ(st.elevation)} OKFF ${st.name}`, ps);
  for (const { R, ze } of roofsOf(doc)) { levelMark(P, L + 1500, ze, `${fmtZ(ze)} Traufe`, ps); if (R.top) levelMark(P, L + 1500, R.top + 220, `${fmtZ(R.top + 220)} First`, ps); }
  P.text({ x: 0, y: zmax + 1500 }, `Schnitt ${sec.name}–${sec.name}`, 5, { bold: true });
  return { x0: -2500, y0: zl - 500, x1: L + 6000, y1: zmax + 2500 };
}

export function mount(app, el) { return new SectionView(app, el); }

class SectionView {
  constructor(app, el) {
    this.app = app; this.el = el; el.innerHTML = ''; this.sideTitle = 'Schnitt & Ansicht';
    const secs = app.doc.p.elements.filter(e => e.type === 'section');
    this.cur = app.sectionId ? { kind: 'sec', id: app.sectionId } : secs.length ? { kind: 'sec', id: secs[0].id } : { kind: 'ans', dir: 'S' };
    this.farbig = true;
    this.cv = h('canvas', { style: 'position:absolute;inset:0;width:100%;height:100%;touch-action:none' }); el.append(this.cv); el.style.background = '#fbfbf9';
    this.tf = { s: 0.05, ox: 100, oy: 500 };
    new ResizeObserver(() => this.resize()).observe(el); this.bind(); this.resize(); setTimeout(() => this.fit(), 30);
  }
  refresh() { this.draw(); }
  resize() { const r = this.el.getBoundingClientRect(); const d = window.devicePixelRatio || 1; this.w = r.width; this.h = r.height; this.cv.width = r.width * d; this.cv.height = r.height * d; this.dpr = d; this.draw(); }
  paint(P, ps) {
    if (this.cur.kind === 'sec') { const s = this.app.doc.byId(this.cur.id); if (!s) return null; return drawSection(P, this.app.doc, s, { ps }); }
    return drawElevation(P, this.app.doc, this.cur.dir, { ps, farbig: this.farbig });
  }
  draw() {
    if (!this.w) return; const c = this.cv.getContext('2d'); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.fillStyle = '#fbfbf9'; c.fillRect(0, 0, this.w, this.h);
    const ps = Math.max(10, Math.min(300, 10 / (2.5 * this.tf.s)));
    this.bb = this.paint(new CanvasPainter(c, this.tf, ps), ps);
    if (!this.bb) { c.fillStyle = '#555'; c.font = '14px Inter'; c.fillText('Noch keine Schnittlinie – im Grundriss mit „Schnittlinie“ anlegen. Ansichten sind immer verfügbar.', 20, 30); }
  }
  fit() { if (!this.bb) { this.draw(); if (!this.bb) return; } const bb = this.bb; const w = bb.x1 - bb.x0, hh = bb.y1 - bb.y0; const s = Math.min(this.w / w, this.h / hh) * 0.95; this.tf.s = s; this.tf.ox = this.w / 2 - (bb.x0 + w / 2) * s; this.tf.oy = this.h / 2 + (bb.y0 + hh / 2) * s; this.draw(); }
  bind() {
    const cv = this.cv; let d = null;
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; const f = Math.pow(1.0015, -e.deltaY); const wx = (sx - this.tf.ox) / this.tf.s, wy = -(sy - this.tf.oy) / this.tf.s; this.tf.s *= f; this.tf.ox = sx - wx * this.tf.s; this.tf.oy = sy + wy * this.tf.s; this.draw(); }, { passive: false });
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); d = { x: e.clientX, y: e.clientY, ox: this.tf.ox, oy: this.tf.oy }; });
    cv.addEventListener('pointermove', e => { if (!d) return; this.tf.ox = d.ox + e.clientX - d.x; this.tf.oy = d.oy + e.clientY - d.y; this.draw(); });
    cv.addEventListener('pointerup', () => d = null);
  }
  renderSide(body) {
    const secs = this.app.doc.p.elements.filter(e => e.type === 'section');
    const l = h('div', { class: 'list' });
    for (const s of secs) l.append(h('div', { class: 'li' + (this.cur.kind === 'sec' && this.cur.id === s.id ? ' on' : ''), onclick: () => { this.cur = { kind: 'sec', id: s.id }; this.fit(); this.app.renderSide(); } }, h('span', { class: 'grow' }, `Schnitt ${s.name}–${s.name}`)));
    if (!secs.length) l.append(h('div', { class: 'muted' }, 'Keine Schnittlinien. Im Grundriss: Werkzeug „Schnittlinie“.'));
    const a = h('div', { class: 'list' });
    for (const [d, n] of [['S', 'Ansicht Süd'], ['N', 'Ansicht Nord'], ['O', 'Ansicht Ost'], ['W', 'Ansicht West']]) a.append(h('div', { class: 'li' + (this.cur.kind === 'ans' && this.cur.dir === d ? ' on' : ''), onclick: () => { this.cur = { kind: 'ans', dir: d }; this.fit(); this.app.renderSide(); } }, h('span', { class: 'grow' }, n)));
    body.append(h('div', { class: 'sec' }, h('h4', {}, 'Schnitte'), l), h('div', { class: 'sec' }, h('h4', {}, 'Ansichten (Fassaden)'), a),
      h('div', { class: 'btns' }, h('button', { class: 'chip' + (this.farbig ? ' on' : ''), onclick: () => { this.farbig = !this.farbig; this.draw(); this.app.renderSide(); } }, 'farbig (Materialien)'), h('button', { class: 'btn sm', onclick: () => this.fit(), html: icon('fit') + 'Einpassen' }),
        h('button', { class: 'btn sm pri', onclick: async () => { const M = await import('./print.js?v=20261028-0429'); M.openPrint(this.app, this.cur.kind === 'sec' ? { inhalt: 'schnitt', sec: this.cur.id } : { inhalt: 'ansicht', dir: this.cur.dir, farbig: this.farbig }); }, html: icon('print') + 'Drucken (PDF)' })));
  }
}
