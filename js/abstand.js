// TW-CAD – Abstandsmaße: zeigt beim Zeichnen live die Entfernung vom Mauszeiger zu den Wandflächen
// (links/rechts/oben/unten, an der Hauptrichtung des Gebäudes ausgerichtet), fängt auf runde Abstände
// und erlaubt das exakte Eintippen eines Abstands (Tab wählt das Maß, Zahl + Enter).
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import { columnPoly } from './render2d.js?v=20261028-0429';

/** Werkzeuge, bei denen Abstandsmaße sinnvoll sind */
export const ABSTAND_TOOLS = new Set(['wall', 'wallrect', 'column', 'stair', 'symbol', 'text', 'level', 'line', 'poly', 'rect', 'circle', 'guide', 'joint', 'tilezone', 'measure', 'dim', 'move', 'copy', 'rotate', 'mirror']);
export const RICHTUNG = ['rechts', 'links', 'oben', 'unten'];

let cache = { key: null };
function data(app) {
  const doc = app.doc, sid = doc.p.activeStorey; const key = sid + '|' + doc.cacheVersion;
  if (cache.key === key) return cache;
  const geo = W.storeyGeometry(doc, sid);
  const segs = [], solids = [];
  const addRing = (ring) => { for (let i = 0; i < ring.length; i++) segs.push([ring[i], ring[(i + 1) % ring.length]]); };
  for (const it of geo.body) { addRing(it.outer); it.holes.forEach(addRing); solids.push(it); }
  for (const e of doc.all('column', sid)) { if (!doc.visible(e)) continue; const p = columnPoly(e); if (p && p.length > 2) { addRing(p); solids.push({ outer: p, holes: [] }); } }
  // Hauptrichtung (längengewichtet, modulo 90°)
  const hist = new Map();
  for (const g of geo.wg.values()) {
    const d = G.sub(g.w.b, g.w.a); const L = G.len(d); if (L < 300) continue;
    let a = G.deg(Math.atan2(d.y, d.x)); a = ((a % 90) + 90) % 90; if (a > 89.75) a = 0;
    const k = Math.round(a * 4) / 4; hist.set(k, (hist.get(k) || 0) + L);
  }
  let ang = 0, best = 0; for (const [k, v] of hist) if (v > best) { best = v; ang = k; }
  cache = { key, segs, solids, ang: G.rad(ang) };
  return cache;
}

function inMaterial(d, p) {
  for (const it of d.solids) if (G.pointInPoly(p, it.outer) && !it.holes.some(h => G.pointInPoly(p, h))) return true;
  return false;
}

/** Strahl von p in Richtung dir bis zur nächsten Wandfläche (aus freiem Raum kommend) */
export function ray(app, p, dir, maxT = 60000) {
  const d = data(app); const hits = [];
  for (const [a, b] of d.segs) {
    const e = G.sub(b, a); const den = G.cross(dir, e); if (Math.abs(den) < 1e-9) continue;
    const ap = G.sub(a, p); const t = G.cross(ap, e) / den; const u = G.cross(ap, dir) / den;
    if (t > 0.3 && t < maxT && u >= -1e-9 && u <= 1 + 1e-9) hits.push({ t, a, b });
  }
  hits.sort((x, y) => x.t - y.t);
  let prev = 0;
  for (const h of hits) {
    if (h.t - prev < 0.2) { prev = h.t; continue; }
    const mid = G.add(p, G.mul(dir, (prev + h.t) / 2)); const n = G.mul(G.perp(dir), 1);
    // läuft der Strahl genau an einer Wandfläche entlang, zählt das als freier Raum
    if (!(inMaterial(d, G.add(mid, n)) && inMaterial(d, G.sub(mid, n)))) return { t: h.t, q: G.add(p, G.mul(dir, h.t)), seg: [h.a, h.b] };
    prev = h.t;
  }
  return null;
}

export function axes(app) { const a = data(app).ang; const u = G.fromAngle(a); return { u, v: G.perp(u), ang: a }; }

/** Alle vier Abstände vom Punkt p */
export function messen(app, p) {
  const { u, v } = axes(app);
  const dirs = [u, G.mul(u, -1), v, G.mul(v, -1)];
  return dirs.map((dir, i) => { const r = ray(app, p, dir); return r ? { ...r, dir, from: p, name: RICHTUNG[i], i } : null; });
}

/** Schrittweite für das Fangen auf runde Abstände (abhängig vom Zoom) */
export function schritt(app) {
  const s = app.view.tf.s; for (const st of [5, 10, 50, 100, 500]) if (st * s >= 4) return st; return 1000;
}

/** Punkt entlang Achse(n) so verschieben, dass der kürzere Abstand ein runder Wert wird */
export function runden(app, p, onlyAlong = null) {
  const { u, v } = axes(app); const step = schritt(app); let q = G.clone(p);
  for (const ax of [u, v]) {
    if (onlyAlong && Math.abs(G.cross(onlyAlong, ax)) > 0.02) continue; // nur parallel zur Fanglinie
    const r1 = ray(app, q, ax), r2 = ray(app, q, G.mul(ax, -1));
    let r = null, dir = null;
    if (r1 && (!r2 || r1.t <= r2.t)) { r = r1; dir = ax; } else if (r2) { r = r2; dir = G.mul(ax, -1); }
    if (!r) continue;
    const target = Math.round(r.t / step) * step; q = G.add(q, G.mul(dir, r.t - target));
  }
  return q;
}

/** Eingabe: "2,40" = m, "240cm", "2400" = mm */
export function parseAbstand(txt) {
  const s = String(txt).trim().toLowerCase().replace(/\s+/g, '');
  if (/^\d+[,.]\d+$/.test(s) && parseFloat(s.replace(',', '.')) < 100) return parseFloat(s.replace(',', '.')) * 1000;
  return G.parseLen(s, 'mm');
}

/** Bemaßungen auf den Bildschirm zeichnen (konstante Pixelgröße) */
export function zeichne(app, c, list, opt = {}) {
  const view = app.view; const active = opt.active;
  for (const m of list) {
    if (!m) continue;
    const a = view.toScreen(m.from), b = view.toScreen(m.q);
    const L = Math.hypot(b.x - a.x, b.y - a.y); if (L < 6) continue;
    const isA = m === active; const col = isA ? '#ea580c' : (m.licht ? '#0e7c6b' : '#1452a8');
    c.save(); c.strokeStyle = col; c.fillStyle = col; c.lineWidth = isA ? 1.8 : 1.2; c.setLineDash(isA ? [] : [5, 3]);
    c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); c.setLineDash([]);
    // Pfeil/Anschlag an der Wand
    const ux = (b.x - a.x) / L, uy = (b.y - a.y) / L; const nx = -uy, ny = ux;
    c.beginPath(); c.moveTo(b.x + nx * 7, b.y + ny * 7); c.lineTo(b.x - nx * 7, b.y - ny * 7); c.stroke();
    c.beginPath(); c.moveTo(b.x, b.y); c.lineTo(b.x - ux * 9 + nx * 4, b.y - uy * 9 + ny * 4); c.lineTo(b.x - ux * 9 - nx * 4, b.y - uy * 9 - ny * 4); c.closePath(); c.fill();
    // Wandfläche markieren
    if (m.seg) { const s0 = view.toScreen(m.seg[0]), s1 = view.toScreen(m.seg[1]); c.globalAlpha = 0.35; c.lineWidth = 3; c.beginPath(); c.moveTo(s0.x, s0.y); c.lineTo(s1.x, s1.y); c.stroke(); c.globalAlpha = 1; }
    // Beschriftung
    const txt = (m.licht ? 'licht ' : '') + G.fmtCm(m.t) + (opt.unit === false ? '' : ' cm');
    c.font = `${isA ? 700 : 600} ${isA ? 13 : 12}px Inter, "Segoe UI", Arial, sans-serif`;
    const w = c.measureText(txt).width; let mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    if (L < w + 24) { mx = b.x + ux * (w / 2 + 12); my = b.y + uy * 12; }
    c.fillStyle = isA ? '#ea580c' : '#ffffff'; c.strokeStyle = col; c.lineWidth = 1;
    c.beginPath(); c.roundRect ? c.roundRect(mx - w / 2 - 5, my - 10, w + 10, 20, 4) : c.rect(mx - w / 2 - 5, my - 10, w + 10, 20); c.fill(); c.stroke();
    c.fillStyle = isA ? '#fff' : col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(txt, mx, my + 0.5);
    c.restore();
  }
}
