// TW-CAD – Treppen-Geometrie: gerade, viertel-/halbgewendelt, mit Podest (L/U), Spindel/Wendel
// Ergebnis in Weltkoordinaten: Umriss, Stufenkanten (Steigungslinien), Auftrittsflächen, Lauflinie
import * as G from './geom.js?v=20261028-0429';

/* Abschnitte entlang des Laufs:
   { typ:'gerade', L }             – Lauf geradeaus
   { typ:'dreh', winkel, wendel }  – Richtungswechsel um die Innenecke (wendel=true: Stufen verzogen, sonst Podest)
   Koordinaten lokal: Antritt von (0,0) bis (0,W), Lauf in +x, Linksdrehung (innen = Seite y=W). */

function abschnitte(s) {
  const W = s.w || 1000, L = s.len || 3000, L2 = s.len2 || 1500, f = s.form || 'gerade';
  switch (f) {
    case 'viertel_u': return [{ typ: 'gerade', L: Math.max(0, s.len2 ?? 300) }, { typ: 'dreh', winkel: 90, wendel: true }, { typ: 'gerade', L }];
    case 'viertel_o': return [{ typ: 'gerade', L }, { typ: 'dreh', winkel: 90, wendel: true }, { typ: 'gerade', L: Math.max(0, s.len2 ?? 300) }];
    case 'podest_l': return [{ typ: 'gerade', L }, { typ: 'dreh', winkel: 90, wendel: false }, { typ: 'gerade', L: L2 }];
    case 'halb': return [{ typ: 'gerade', L }, { typ: 'dreh', winkel: 180, wendel: true }, { typ: 'gerade', L: s.len2 ?? L }];
    case 'zweiviertel': return [{ typ: 'gerade', L }, { typ: 'dreh', winkel: 90, wendel: true }, { typ: 'gerade', L: Math.max(0, s.auge || 0) }, { typ: 'dreh', winkel: 90, wendel: true }, { typ: 'gerade', L: s.len2 ?? L }];
    case 'podest_u': return [{ typ: 'gerade', L }, { typ: 'dreh', winkel: 180, wendel: false }, { typ: 'gerade', L: s.len2 ?? L }];
    case 'podest_gerade': return [{ typ: 'gerade', L }, { typ: 'podest', L: s.podest || W }, { typ: 'gerade', L: L2 }];
    default: return [{ typ: 'gerade', L }];
  }
}

/** Treppe berechnen. s: {p, rot, w, len, len2, auge, form, dreh, steps, durchmesser, winkel} */
export function treppe(s) {
  const W = s.w || 1000; const N = Math.max(3, Math.round(s.steps || 16)); const links = (s.dreh || 'links') === 'links';
  const r = G.rad(s.rot || 0);
  const toW = (q) => { const y = links ? q.y : W - q.y; return G.rot({ x: s.p.x + q.x, y: s.p.y + y }, r, s.p); };
  if (s.form === 'spindel' || s.form === 'wendel') return rund(s, N, toW);
  // ── Lauf aus Abschnitten: Innen-/Außenkante als Polylinien, Stufen entlang der Lauflinie
  const segs = abschnitte(s);
  let pos = { x: 0, y: 0 }, dir = { x: 1, y: 0 }; // Außenkante-Punkt am Abschnittsanfang (y=0 Außen, y=W Innen bei Linksdrehung)
  const auge = Math.max(0, s.auge || 0);
  const parts = []; // je Abschnitt: Funktion t∈[0,1] → {innen, aussen, mitte}, Länge der Lauflinie, Stufen ja/nein
  const outerPts = [{ x: 0, y: 0 }], innerPts = [{ x: 0, y: W }];
  for (const sg of segs) {
    const nrm = G.perp(dir); // nach innen (links)
    if (sg.typ === 'gerade' || sg.typ === 'podest') {
      if (sg.L <= 0.5) continue;
      const a0 = pos, i0 = G.add(pos, G.mul(nrm, W)); const d = G.mul(dir, sg.L);
      parts.push({ len: sg.L, stufen: sg.typ === 'gerade', at: (t) => ({ aussen: G.add(a0, G.mul(d, t)), innen: G.add(i0, G.mul(d, t)) }) });
      pos = G.add(pos, d); outerPts.push(pos); innerPts.push(G.add(pos, G.mul(nrm, W)));
    } else {
      const wink = sg.winkel; const ein = G.add(pos, G.mul(nrm, W)); // Innenecke am Abschnittsanfang
      if (wink === 90) {
        const piv = ein; const o1 = G.add(pos, G.mul(dir, W)); const nd = nrm; const o2 = G.add(o1, G.mul(nd, W)); // Außenecke, Ende außen
        const rc = W / 2; const len = Math.PI / 2 * rc;
        const outerPoly = [pos, o1, o2];
        parts.push({ len, stufen: sg.wendel, podest: !sg.wendel, piv, outerPoly, at: (t) => { const ang = G.angleOf(G.mul(nrm, -1)) + t * Math.PI / 2; const dd = G.fromAngle(ang); return { aussen: rayPoly(piv, dd, outerPoly) || G.add(piv, G.mul(dd, W)), innen: piv, mitte: G.add(piv, G.mul(dd, rc)) }; } });
        outerPts.push(o1, o2); pos = o2; dir = nd; innerPts.push(G.add(pos, G.mul(G.perp(dir), W)));
      } else {
        // 180°: Innenseite mit Treppenauge (Breite auge) – Mittelpunkt in der Augenmitte
        const piv = G.add(ein, G.mul(nrm, auge / 2)); const o1 = G.add(pos, G.mul(dir, W)); const o2 = G.add(o1, G.mul(nrm, 2 * W + auge)); const o3 = G.add(pos, G.mul(nrm, 2 * W + auge));
        const rc = auge / 2 + W / 2; const len = Math.PI * rc; const outerPoly = [pos, o1, o2, o3];
        parts.push({ len, stufen: sg.wendel, podest: !sg.wendel, piv, outerPoly, at: (t) => { const ang = G.angleOf(G.mul(nrm, -1)) + t * Math.PI; const dd = G.fromAngle(ang); return { aussen: rayPoly(piv, dd, outerPoly) || G.add(piv, G.mul(dd, W + auge / 2)), innen: G.add(piv, G.mul(dd, auge / 2)), mitte: G.add(piv, G.mul(dd, rc)) }; } });
        outerPts.push(o1, o2, o3); pos = o3; dir = G.mul(dir, -1); innerPts.push(G.add(ein, G.mul(nrm, auge)));
      }
    }
  }
  // Stufen verteilen: Läufe (zusammenhängende Stufen-Abschnitte) zwischen Podesten; jeder Lauf beginnt und endet mit einer Steigung
  const laeufe = []; let cur = null;
  for (const p of parts) { if (p.stufen) { if (!cur) { cur = { parts: [], len: 0 }; laeufe.push(cur); } cur.parts.push(p); cur.len += p.len; } else { cur = null; laeufe.push({ podest: p }); } }
  const runs = laeufe.filter(l => !l.podest); const nPodest = laeufe.length - runs.length;
  const T = Math.max(runs.length, N - 1 - nPodest); const sumL = runs.reduce((a, r) => a + r.len, 0) || 1;
  runs.forEach(r => r.n = Math.max(1, Math.round(T * r.len / sumL))); let diff = T - runs.reduce((a, r) => a + r.n, 0);
  while (diff !== 0 && runs.length) { const r = runs.slice().sort((x, y) => diff > 0 ? y.len / (y.n + 1) - x.len / (x.n + 1) : x.len / x.n - y.len / y.n)[0]; if (diff < 0 && r.n <= 1) break; r.n += diff > 0 ? 1 : -1; diff += diff > 0 ? -1 : 1; }
  const stufenLen = sumL; const a = runs.length ? runs.reduce((x, r) => x + r.len, 0) / runs.reduce((x, r) => x + r.n, 0) : sumL;
  const linien = [];
  const push = (q) => { const l = linien[linien.length - 1]; if (l && G.dist(l.aussen, q.aussen) < 1 && G.dist(l.innen, q.innen) < 1) return; linien.push(q); };
  for (const l of laeufe) {
    if (l.podest) { push(l.podest.at(0)); push(l.podest.at(1)); continue; }
    const ar = l.len / l.n;
    for (let k = 0; k <= l.n; k++) { let s0 = k * ar; let pi = 0; while (pi < l.parts.length - 1 && s0 > l.parts[pi].len + 1e-6) { s0 -= l.parts[pi].len; pi++; } const p = l.parts[pi]; push(p.at(Math.max(0, Math.min(1, s0 / p.len)))); }
  }
  // Auftrittsflächen: zwischen zwei Linien entlang Außen- und Innenpolylinie
  const outerLine = dedupe(outerPts), innerLine = dedupe(innerPts);
  const ou = linien.map(l => paramOn(outerLine, l.aussen)), iu = linien.map(l => paramOn(innerLine, l.innen));
  const flaechen = [];
  for (let k = 0; k < linien.length - 1; k++) flaechen.push(dedupe([...slice(outerLine, ou[k], ou[k + 1]), ...slice(innerLine, iu[k], iu[k + 1]).reverse()]));
  const mitte = linien.map(l => l.mitte || G.mid(l.aussen, l.innen));
  const umriss = dedupe([...outerLine, ...innerLine.slice().reverse()]);
  const tw = (pts) => pts.map(toW);
  return {
    umriss: tw(umriss), linien: linien.map(l => [toW(l.innen), toW(l.aussen)]), flaechen: flaechen.map(tw), lauflinie: tw(mitte),
    steigungen: linien.length, auftritt: a, laufLinienLaenge: stufenLen
  };
}

function rund(s, N, toW) {
  const ro = (s.durchmesser || 2000) / 2; const ri = s.form === 'spindel' ? Math.max(40, (s.spindel || 160) / 2) : Math.max(100, (s.auge || 600) / 2);
  const W = ro - ri; const total = G.rad(s.winkel || 360);
  // lokale Mitte so, dass der Antritt von (0,0) [außen] bis (0,W) [innen] liegt
  const C = { x: 0, y: ro };
  const P = (rr, ang) => ({ x: C.x + Math.cos(ang) * rr, y: C.y + Math.sin(ang) * rr });
  const a0 = -Math.PI / 2; const n = N - 1;
  const linien = []; for (let k = 0; k <= n; k++) { const ang = a0 + total * k / n; linien.push({ innen: P(ri, ang), aussen: P(ro, ang), mitte: P((ri + ro) / 2, ang) }); }
  const flaechen = []; for (let k = 0; k < n; k++) { const A = a0 + total * k / n, B = a0 + total * (k + 1) / n; const pts = []; const m = 6; for (let i = 0; i <= m; i++) pts.push(P(ro, A + (B - A) * i / m)); for (let i = m; i >= 0; i--) pts.push(P(ri, A + (B - A) * i / m)); flaechen.push(pts); }
  const um = []; const m = Math.max(12, Math.round(total / G.rad(10))); for (let i = 0; i <= m; i++) um.push(P(ro, a0 + total * i / m)); for (let i = m; i >= 0; i--) um.push(P(ri, a0 + total * i / m));
  const tw = (pts) => pts.map(toW);
  const rc = (ri + ro) / 2;
  return { umriss: tw(um), linien: linien.map(l => [toW(l.innen), toW(l.aussen)]), flaechen: flaechen.map(tw), lauflinie: tw(linien.map(l => l.mitte)), steigungen: N, auftritt: rc * total / n, laufLinienLaenge: rc * total, spindel: s.form === 'spindel' ? { c: toW(C), r: ri } : null, auge: s.form === 'wendel' ? { c: toW(C), r: ri } : null, rund: true };
}

/* ───────── Hilfen ───────── */
function rayPoly(o, d, poly) { let best = null; for (let i = 0; i < poly.length - 1; i++) { const x = G.lineIntersect(o, d, poly[i], G.sub(poly[i + 1], poly[i])); if (!x) continue; const t = G.dot(G.sub(x, o), d); const c = G.closestOnSeg(x, poly[i], poly[i + 1]); if (t > 1 && c.d < 0.5 && (!best || t < best.t)) best = { t, x }; } return best && best.x; }
function dedupe(pts) { const r = []; for (const p of pts) if (!r.length || G.dist(r[r.length - 1], p) > 0.5) r.push(p); if (r.length > 2 && G.dist(r[0], r[r.length - 1]) < 0.5) r.pop(); return r; }
function paramOn(line, p) { let best = null, acc = 0; for (let i = 0; i < line.length - 1; i++) { const c = G.closestOnSeg(p, line[i], line[i + 1]); const L = G.dist(line[i], line[i + 1]); const u = acc + Math.max(0, Math.min(1, c.t)) * L; if (!best || c.d < best.d - 1e-6) best = { d: c.d, u }; acc += L; } return best ? best.u : 0; }
function pointAt(line, u) { let acc = 0; for (let i = 0; i < line.length - 1; i++) { const L = G.dist(line[i], line[i + 1]); if (u <= acc + L + 1e-6) return G.add(line[i], G.mul(G.sub(line[i + 1], line[i]), L ? (u - acc) / L : 0)); acc += L; } return line[line.length - 1]; }
function slice(line, u0, u1) { const r = [pointAt(line, u0)]; let acc = 0; for (let i = 0; i < line.length - 1; i++) { acc += G.dist(line[i], line[i + 1]); if (acc > u0 + 0.5 && acc < u1 - 0.5) r.push(line[i + 1]); } r.push(pointAt(line, u1)); return r; }

/** Kennwerte nach DIN 18065 (Wohngebäude) */
export function kennwerte(s, hoehe) {
  const g = treppe(s); const n = g.steigungen; const h = hoehe / n; const a = g.auftritt;
  const sm = 2 * h + a;
  return { n, h, a, sm, ok: h >= 140 && h <= 200 && a >= 230 && a <= 370 && sm >= 590 && sm <= 650 && (s.w || 1000) >= 800, g };
}

/** Steigungszahl für eine Geschosshöhe (Ziel ca. 17,5 cm) */
export const steigungenFuer = (hoehe) => Math.max(3, Math.round(hoehe / 175));
/** Lauflänge(n) so wählen, dass der Auftritt die Schrittmaßregel 2h + a = 63 cm erfüllt */
export function autoMasse(s, hoehe) {
  const n = s.steps || steigungenFuer(hoehe); const h = hoehe / n; const ziel = Math.min(370, Math.max(230, 630 - 2 * h));
  const o = { ...s, steps: n };
  if (o.form === 'spindel' || o.form === 'wendel') {
    const ro = (o.durchmesser || 2000) / 2, ri = o.form === 'spindel' ? (o.spindel || 160) / 2 : (o.auge || 600) / 2; const rc = (ro + ri) / 2;
    o.winkel = Math.round(Math.min(540, Math.max(180, G.deg(ziel * (n - 1) / rc))) / 5) * 5; return o;
  }
  const fix2 = o.form === 'viertel_u' || o.form === 'viertel_o';
  const ratio = o.form === 'podest_l' || o.form === 'podest_gerade' ? 0.5 : 1;
  let L = o.len || 3000;
  for (let it = 0; it < 12; it++) {
    const t = { ...o, len: L, len2: fix2 ? (o.len2 ?? 300) : (o.form === 'gerade' ? undefined : Math.round(L * ratio)) };
    const a = treppe(t).auftritt; if (!isFinite(a) || a <= 0) break;
    const f = ziel / a; if (Math.abs(f - 1) < 0.003) break; L = Math.max(300, L * (f > 1 ? Math.min(1.6, f) : Math.max(0.6, f)));
  }
  o.len = Math.round(L / 5) * 5; if (!fix2 && o.form !== 'gerade') o.len2 = Math.round(o.len * ratio / 5) * 5;
  return o;
}
