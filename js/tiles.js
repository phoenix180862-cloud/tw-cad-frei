// TW-CAD – Fliesen-Engine: Verbände, Zuschnitt, Randstück-Prüfung, Optimierung, Mengen
import * as G from './geom.js?v=20261028-0429';
import { kleberEmpfehlung } from './fliesenkatalog.js?v=20261028-0429';

export const VERBAENDE = {
  kreuz: 'Kreuzfuge',
  halb: 'Halbverband (1/2)',
  drittel: 'Drittelverband (1/3)',
  viertel: 'Viertelverband (1/4)',
  wild: 'Wilder Verband',
  fischgrat: 'Fischgrät',
  diagonal: 'Diagonal 45° (Kreuzfuge)',
  diagonalhalb: 'Diagonal 45° im Halbverband',
  stapel: 'Stapelverband hochkant',
  versatz: 'Freier Versatz (einstellbar)',
  sechseck: 'Sechseck / Wabe',
  chevron: 'Chevron (Fischgrät mit Gehrung)'
};
/** Fläche einer Fliese in mm² (Sechseck: B = Schlüsselweite) */
export function tileArea(c) { if (c.verband === 'sechseck') return Math.sqrt(3) / 2 * c.B * c.B; return c.L * c.B; }
/** Bestell-Fläche je Stück in m² (Mosaik wird je m² Matte inkl. Fugen verkauft) */
export function stueckM2(c) { const mos = c.matte || c.material === 'mosaik' || c.material === 'glasmosaik' || Math.max(c.L, c.B) < 60; return (mos ? (c.L + c.fuge) * (c.B + c.fuge) : tileArea(c)) / 1e6; }
/** halber Umfang / Fläche → für Fugenmörtel */
function fugenFaktor(c) { if (c.verband === 'sechseck') return (3 * c.B / Math.sqrt(3)) / tileArea(c); return (c.L + c.B) / (c.L * c.B); }

export function defaultTileCfg(over = {}) {
  return Object.assign({
    L: 600, B: 300, fuge: 3, verband: 'drittel', angle: 0,
    origin: null, originMode: 'optimal', seed: 1,
    farbe: '#d9d4cc', fugeFarbe: '#a8a29a', textur: 'uni', bild: null, name: '', hersteller: '', serie: '', artikel: '',
    preisM2: 0, paketM2: 0, reserve: 5, minRand: 0.5, warnRand: 0.33, minAbs: 50
  }, over);
}

function seeded(seed) { let s = (seed * 9301 + 49297) % 233280 || 1; return () => (s = (s * 9301 + 49297) % 233280) / 233280; }

/** Effektive Konfiguration (Diagonal = Winkel 45°) */
function eff(cfg) {
  const c = Object.assign({}, cfg);
  if (c.verband === 'diagonal') { c.angle = (cfg.angle || 0) + 45; c.verband = 'kreuz'; }
  if (c.verband === 'diagonalhalb') { c.angle = (cfg.angle || 0) + 45; c.verband = 'halb'; }
  if (c.verband === 'stapel') { const L = c.L; c.L = Math.min(c.L, c.B); c.B = Math.max(L, c.B); c.verband = 'kreuz'; }
  if (c.verband === 'sechseck') { c.B = Math.min(c.L, c.B); c.L = Math.round(c.B * 2 / Math.sqrt(3)); }
  if (c.verband === 'chevron') { const L = c.L; c.L = Math.max(L, c.B); c.B = Math.min(L, c.B); }
  return c;
}

/** Rechtecke im Fliesen-Lokalsystem (Ursprung = Fugenkreuz) über bbox */
function* tileRects(c, bb) {
  const L = c.L, B = c.B, f = c.fuge, px = L + f, py = B + f, h = f / 2;
  if (c.verband === 'fischgrat') {
    // Paare H/V, Kettenschritt s=(B+f,B+f), Nachbarkette t=(L+f,-(L+f))
    const s = { x: B + f, y: B + f }, t = { x: L + f, y: -(L + f) };
    const det = s.x * t.y - s.y * t.x;
    const corners = [[bb.x0, bb.y0], [bb.x1, bb.y0], [bb.x1, bb.y1], [bb.x0, bb.y1]];
    let k0 = Infinity, k1 = -Infinity, m0 = Infinity, m1 = -Infinity;
    for (const [x, y] of corners) {
      const k = (x * t.y - y * t.x) / det, m = (s.x * y - s.y * x) / det;
      k0 = Math.min(k0, k); k1 = Math.max(k1, k); m0 = Math.min(m0, m); m1 = Math.max(m1, m);
    }
    const pad = Math.ceil((L + B) / Math.min(B + f, L + f)) + 2;
    for (let m = Math.floor(m0) - pad; m <= Math.ceil(m1) + pad; m++) for (let k = Math.floor(k0) - pad; k <= Math.ceil(k1) + pad; k++) {
      const ox = k * s.x + m * t.x + h, oy = k * s.y + m * t.y + h;
      const H = { x: ox, y: oy, w: L, h: B, ori: 0, i: k, j: m * 2 };
      const V = { x: ox, y: oy + B + f, w: B, h: L, ori: 1, i: k, j: m * 2 + 1 };
      for (const r of [H, V]) if (r.x < bb.x1 && r.x + r.w > bb.x0 && r.y < bb.y1 && r.y + r.h > bb.y0) yield r;
    }
    return;
  }
  if (c.verband === 'sechseck') {
    // Wabe, Spitzen links/rechts; B = Schlüsselweite (Kante zu Kante)
    const S = c.B, R = S / Math.sqrt(3), dx = (S + f) * Math.sqrt(3) / 2, dy = S + f;
    const i0 = Math.floor((bb.x0 - R) / dx) - 1, i1 = Math.ceil((bb.x1 + R) / dx) + 1;
    for (let i = i0; i <= i1; i++) {
      const oy = (((i % 2) + 2) % 2) * dy / 2; const j0 = Math.floor((bb.y0 - S - oy) / dy) - 1, j1 = Math.ceil((bb.y1 + S - oy) / dy) + 1;
      for (let j = j0; j <= j1; j++) {
        const cx = i * dx + R, cy = j * dy + oy + S / 2 + f / 2;
        const poly = []; for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; poly.push({ x: cx + R * Math.cos(a), y: cy + R * Math.sin(a) }); }
        yield { x: cx - R, y: cy - S / 2, w: 2 * R, h: S, poly, ori: 0, i, j };
      }
    }
    return;
  }
  if (c.verband === 'chevron') {
    // Spalten aus Parallelogrammen, abwechselnd steigend/fallend → V-Muster
    const a = G.rad(c.chevronWinkel ?? 45), t = Math.tan(a), Wd = c.L * Math.cos(a), hh = c.B / Math.cos(a), fx = f, fy = f / Math.cos(a);
    const pxc = Wd + fx, pyc = hh + fy, rise = Wd * t;
    const i0 = Math.floor(bb.x0 / pxc) - 1, i1 = Math.ceil(bb.x1 / pxc) + 1;
    for (let i = i0; i <= i1; i++) {
      const x0 = i * pxc + fx / 2; const odd = ((i % 2) + 2) % 2 === 1;
      const j0 = Math.floor((bb.y0 - rise - hh) / pyc) - 1, j1 = Math.ceil(bb.y1 / pyc) + 1;
      for (let j = j0; j <= j1; j++) {
        const y0 = j * pyc + fy / 2;
        const poly = odd ? [{ x: x0, y: y0 + rise }, { x: x0 + Wd, y: y0 }, { x: x0 + Wd, y: y0 + hh }, { x: x0, y: y0 + rise + hh }]
          : [{ x: x0, y: y0 }, { x: x0 + Wd, y: y0 + rise }, { x: x0 + Wd, y: y0 + rise + hh }, { x: x0, y: y0 + hh }];
        yield { x: x0, y: y0, w: Wd, h: rise + hh, poly, ori: odd ? 1 : 0, i, j };
      }
    }
    return;
  }
  const A = px, Bm = py;
  const j0 = Math.floor(bb.y0 / Bm) - 1, j1 = Math.ceil(bb.y1 / Bm) + 1;
  const rnd = seeded(c.seed || 1);
  let prev = 0;
  for (let j = j0; j <= j1; j++) {
    let off = 0;
    if (c.verband === 'halb') off = ((j % 2) + 2) % 2 * A / 2;
    else if (c.verband === 'drittel') off = ((j % 3) + 3) % 3 * A / 3;
    else if (c.verband === 'viertel') off = ((j % 4) + 4) % 4 * A / 4;
    else if (c.verband === 'versatz') { const v = Math.max(0, Math.min(0.95, c.versatz ?? 0.2)); off = ((j * v) % 1 + 1) % 1 * A; }
    else if (c.verband === 'wild') { let o, tries = 0; do { o = (0.2 + rnd() * 0.6) * A; tries++; } while (Math.abs(o - prev) < 0.15 * A && tries < 10); prev = o; off = o; }
    const i0 = Math.floor((bb.x0 - off) / A) - 1, i1 = Math.ceil((bb.x1 - off) / A) + 1;
    for (let i = i0; i <= i1; i++) yield { x: i * A + off + h, y: j * Bm + h, w: L, h: B, ori: 0, i, j };
  }
}

function rectPoly(r) { return [{ x: r.x, y: r.y }, { x: r.x + r.w, y: r.y }, { x: r.x + r.w, y: r.y + r.h }, { x: r.x, y: r.y + r.h }]; }

/** Bereich vorbereiten: Lokal-Transformation */
function frame(c, origin) {
  const ang = G.rad(c.angle || 0), co = Math.cos(ang), si = Math.sin(ang);
  const toL = (p) => { const dx = p.x - origin.x, dy = p.y - origin.y; return { x: dx * co + dy * si, y: -dx * si + dy * co }; };
  const toW = (p) => ({ x: origin.x + p.x * co - p.y * si, y: origin.y + p.x * si + p.y * co });
  return { toL, toW };
}

function segHitsRect(a, b, r) {
  const x0 = r.x, y0 = r.y, x1 = r.x + r.w, y1 = r.y + r.h;
  if (Math.max(a.x, b.x) < x0 || Math.min(a.x, b.x) > x1 || Math.max(a.y, b.y) < y0 || Math.min(a.y, b.y) > y1) return false;
  const P = rectPoly(r);
  for (let i = 0; i < 4; i++) if (G.segIntersect(a, b, P[i], P[(i + 1) % 4])) return true;
  return (a.x > x0 && a.x < x1 && a.y > y0 && a.y < y1);
}

/**
 * Fliesen erzeugen.
 * region: {outer:[pts], holes:[[pts]]} in Weltkoordinaten (mm)
 * Rückgabe: { pieces:[{poly, full, w, h, ratio, status, ori}], stats }
 */
export function layTiles(region, cfg) {
  const c = eff(cfg);
  const origin = cfg.origin || G.polyCentroid(region.outer);
  const { toL, toW } = frame(c, origin);
  const outerL = region.outer.map(toL), holesL = (region.holes || []).map(h => h.map(toL));
  const bb = G.bbox(outerL);
  const edges = [];
  for (const poly of [outerL, ...holesL]) for (let i = 0; i < poly.length; i++) edges.push([poly[i], poly[(i + 1) % poly.length]]);
  const regionSubj = [G.ensureCCW(outerL), ...holesL.map(h => G.ensureCW(h))];
  const pieces = [];
  let n = 0;
  for (const r of tileRects(c, bb)) {
    if (++n > 60000) break;
    // Schnelltest: komplett innen?
    const P = r.poly || rectPoly(r); const tileA = r.poly ? G.polyArea(r.poly) : c.L * c.B;
    let boundary = false;
    for (const [a, b] of edges) if (segHitsRect(a, b, r)) { boundary = true; break; }
    if (!boundary) {
      const cpt = { x: r.x + r.w / 2, y: r.y + r.h / 2 };
      if (!G.pointInPoly(cpt, outerL)) continue;
      if (holesL.some(h => G.pointInPoly(cpt, h))) continue;
      pieces.push({ polyL: P, full: true, w: r.w, h: r.h, ratio: 1, status: 'voll', ori: r.ori, rect: r, i: r.i, j: r.j });
      continue;
    }
    const parts = G.intersectPolys([P], regionSubj);
    for (const part of parts) {
      const a = G.polyArea(part); if (a < 1) continue;
      const pb = G.bbox(part);
      const w = pb.w, h = pb.h;
      const full = a >= tileA * 0.995;
      const rw = w / r.w, rh = h / r.h;
      const rect = !r.poly && Math.abs(a - w * h) < Math.max(5, 0.01 * a);
      let ratio = rect ? Math.min(rw, rh) : a / tileA;
      let status = 'voll';
      if (!full) {
        const minAbs = Math.min(w, h); const grenzAbs = Math.min(cfg.minAbs ?? 50, Math.min(c.L, c.B) * 0.4);
        if (ratio < (cfg.warnRand ?? 0.33) || minAbs < grenzAbs) status = 'kritisch';
        else if (ratio < (cfg.minRand ?? 0.5)) status = 'warnung';
        else status = 'schnitt';
      }
      pieces.push({ polyL: part, full, w, h, ratio: full ? 1 : ratio, status, ori: r.ori, rect: r, i: r.i, j: r.j, area: a });
    }
  }
  for (const p of pieces) {
    p.poly = p.polyL.map(toW); if (!p.area) p.area = G.polyArea(p.polyL);
    const r = p.rect;
    if (p.ori === 1) { p.wr0 = toW({ x: r.x + r.w, y: r.y }); p.wr1 = toW({ x: r.x + r.w, y: r.y + r.h }); p.wr2 = toW({ x: r.x, y: r.y }); }
    else { p.wr0 = toW({ x: r.x, y: r.y + r.h }); p.wr1 = toW({ x: r.x + r.w, y: r.y + r.h }); p.wr2 = toW({ x: r.x, y: r.y }); }
  }
  return { pieces, origin, toL, toW, cfg: c, stats: tileStats(pieces, region, c, cfg) };
}

export function tileStats(pieces, region, c, cfg) {
  const area = G.polyArea(region.outer) - (region.holes || []).reduce((s, h) => s + G.polyArea(h), 0);
  const full = pieces.filter(p => p.full).length;
  const cut = pieces.filter(p => !p.full);
  const krit = cut.filter(p => p.status === 'kritisch').length, warn = cut.filter(p => p.status === 'warnung').length;
  // Restverwertung: Stücke ≤ 1/2 können aus Reststücken entstehen
  let reuse = 0; const small = cut.filter(p => p.ratio <= 0.5).length; const big = cut.length - small;
  reuse = Math.min(small, big);
  const ohne = full + cut.length;
  const mit = full + cut.length - Math.floor(reuse * 0.7);
  const tileA = stueckM2(c);
  const reserve = 1 + (cfg.reserve ?? 5) / 100;
  const bedarf = Math.ceil(mit * reserve);
  const m2Bestell = bedarf * tileA;
  const pakete = cfg.paketM2 > 0 ? Math.ceil(m2Bestell / cfg.paketM2 - 1e-9) : null;
  const verschnitt = area > 0 ? (mit * tileA * 1e6 - area) / area * 100 : 0;
  // Fugenmörtel kg/m² = (L+B)/(L*B) * Fugenbreite * Fugentiefe * 1,6
  const tiefe = cfg.fugeTiefe || 8;
  const fugeKg = fugenFaktor(c) * c.fuge * tiefe * 1.6 * area / 1e6;
  return { area, m2: area / 1e6, full, cut: cut.length, krit, warn, ohne, mit, bedarf, m2Bestell, pakete, verschnitt, fugeKg, tileM2: tileA, minRatio: cut.length ? Math.min(...cut.map(p => p.ratio)) : 1 };
}

/* ───────── Startpunkt-Optimierung ───────── */
function edgePositions(region, c, origin) {
  const { toL } = frame(c, origin);
  const xs = [], ys = [];
  const polys = [G.ensureCCW(region.outer), ...(region.holes || []).map(h => G.ensureCW(h))];
  for (const poly of polys) {
    const P = poly.map(toL);
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length]; const dx = b.x - a.x, dy = b.y - a.y; const l = Math.hypot(dx, dy);
      if (l < 50) continue;
      // Innenseite liegt links der Kantenrichtung
      if (Math.abs(dx) < 0.02 * l) xs.push({ v: (a.x + b.x) / 2, w: l, side: dy > 0 ? 0 : 1 });
      else if (Math.abs(dy) < 0.02 * l) ys.push({ v: (a.y + b.y) / 2, w: l, side: dx > 0 ? 1 : 0 });
    }
  }
  return { xs, ys };
}
function pen(frac, c, size = 300) { // Bruchteil einer Fliese am Rand (0..1): Strafe
  if (frac > 0.995 || frac <= 0.0005) return 0;
  if (frac * size < Math.min(c.minAbs ?? 50, size * 0.4)) return 12;
  const minR = c.minRand ?? 0.5;
  if (frac >= minR) return (1 - frac) * 0.05;
  return 1 + (minR - frac) * 6 + (frac < (c.warnRand ?? 0.33) ? 3 : 0);
}
function cutFrac(edgeV, off, P, Lsize, f) {
  // Abstand Kante → letztes Fugenkreuz, als Anteil einer Fliese
  const m = (((edgeV - off) % P) + P) % P;
  const a = (m - f / 2) / Lsize, b = (P - m - f / 2) / Lsize;
  return [Math.max(0, a), Math.max(0, b)];
}
/** Bester Fugenkreuz-Ursprung. modus: optimal | mitteFuge | mitteFliese | ecke */
export function bestOrigin(region, cfg, modus = 'optimal', ecke = null) {
  const c = eff(cfg);
  const cen = G.polyCentroid(region.outer);
  const bbW = G.bbox(region.outer);
  if (modus === 'mitteFuge') return cen;
  const ang = G.rad(c.angle || 0);
  const ex = { x: Math.cos(ang), y: Math.sin(ang) }, ey = { x: -Math.sin(ang), y: Math.cos(ang) };
  const px = c.L + c.fuge, py = c.B + c.fuge;
  if (modus === 'mitteFliese') return G.add(cen, G.add(G.mul(ex, -px / 2), G.mul(ey, -py / 2)));
  if (modus === 'ecke') {
    const e = ecke || { x: bbW.x0, y: bbW.y0 };
    return G.add(e, G.add(G.mul(ex, -c.fuge / 2), G.mul(ey, -c.fuge / 2)));
  }
  // optimal: 1D-Suche je Achse (Kanten parallel zu den Fugen)
  const { xs, ys } = edgePositions(region, c, cen);
  const steps = 96;
  const rowPhases = c.verband === 'versatz' ? [0, 0.2, 0.4, 0.6, 0.8].map(k => ((k / 0.2) * (c.versatz ?? 0.2)) % 1) : c.verband === 'halb' ? [0, 0.5] : c.verband === 'drittel' ? [0, 1 / 3, 2 / 3] : c.verband === 'viertel' ? [0, .25, .5, .75] : [0];
  const fischgrat = ['fischgrat', 'sechseck', 'chevron'].includes(c.verband);
  let bx = 0, by = 0;
  if (fischgrat || (!xs.length && !ys.length)) {
    // Rechnerische Suche über echte Verlegung (Diagonal, Fischgrät, schiefe Räume)
    let best = Infinity, bo = cen; const n = 9;
    let perX = fischgrat ? c.B + c.fuge : px, perY = fischgrat ? c.B + c.fuge : py;
    if (c.verband === 'sechseck') { perX = (c.B + c.fuge) * Math.sqrt(3); perY = c.B + c.fuge; }
    if (c.verband === 'chevron') { const a = G.rad(c.chevronWinkel ?? 45); perX = 2 * (c.L * Math.cos(a) + c.fuge); perY = c.B / Math.cos(a) + c.fuge / Math.cos(a); }
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
      const o = G.add(cen, G.add(G.mul(ex, i / n * perX), G.mul(ey, k / n * perY)));
      const r = layTiles(region, Object.assign({}, cfg, { origin: o }));
      let sc = 0; for (const p of r.pieces) if (!p.full) sc += (p.status === 'kritisch' ? 3 : p.status === 'warnung' ? 1 : 0.1) + (1 - p.ratio) * 0.2;
      if (sc < best) { best = sc; bo = o; }
    }
    return bo;
  }
  {
    let best = Infinity;
    for (let k = 0; k < steps; k++) {
      const off = k / steps * px; let s = 0;
      for (const e of xs) for (const ph of rowPhases) { const fr = cutFrac(e.v, off + ph * px, px, c.L, c.fuge); s += e.w * pen(fr[e.side], c, c.L) / rowPhases.length; }
      // Symmetrie: gegenüberliegende Kanten gleich
      if (xs.length >= 2) { const sorted = xs.slice().sort((p, q) => p.v - q.v); const fa = (((sorted[0].v - off) % px) + px) % px, fb = (((off - sorted[sorted.length - 1].v) % px) + px) % px; s += Math.abs(fa - fb) / px * 0.02 * sorted[0].w; }
      if (s < best - 1e-9) { best = s; bx = off; }
    }
    best = Infinity;
    for (let k = 0; k < steps; k++) {
      const off = k / steps * py; let s = 0;
      for (const e of ys) { const fr = cutFrac(e.v, off, py, c.B, c.fuge); s += e.w * pen(fr[e.side], c, c.B); }
      if (ys.length >= 2) { const sorted = ys.slice().sort((p, q) => p.v - q.v); const fa = (((sorted[0].v - off) % py) + py) % py, fb = (((off - sorted[sorted.length - 1].v) % py) + py) % py; s += Math.abs(fa - fb) / py * 0.02 * sorted[0].w; }
      if (s < best - 1e-9) { best = s; by = off; }
    }
  }
  return G.add(cen, G.add(G.mul(ex, bx), G.mul(ey, by)));
}

/** Komplett: Ursprung bestimmen (wenn nötig) + legen */
export function planTiles(region, cfg) {
  let origin = cfg.origin;
  if (!origin || cfg.originMode !== 'frei') origin = bestOrigin(region, cfg, cfg.originMode || 'optimal', cfg.ecke);
  return layTiles(region, Object.assign({}, cfg, { origin }));
}

/** Randstück-Maße entlang der Kanten (für Verlegeplan-Beschriftung) */
export function edgeCutLabels(res, region) {
  const out = [];
  const tol = 3;
  for (const p of res.pieces) {
    if (p.full || p.status === 'voll') continue;
    out.push(p);
  }
  return out;
}

/** Kleber-/Material-Richtwerte */
export function materialRichtwerte(m2, cfg, extra = {}) {
  const k = kleberEmpfehlung(cfg.L, cfg.B, cfg.verlegeart || (Math.max(cfg.L, cfg.B) >= 600 ? 'buttering' : 'duenn'));
  return {
    kleberKg: m2 * k.kg, kleberSatz: k.kg, zahn: k.zahn,
    silikonLfm: extra.silikonLfm || 0,
    profileLfm: extra.profileLfm || 0
  };
}
