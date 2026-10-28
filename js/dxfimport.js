// TW-CAD – DXF-Import (ASCII-DXF R12 … 2018): Linien, Polylinien, Bögen, Kreise, Ellipsen, Texte, Blöcke; Ebenen; optional Wände aus parallelen Linien
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';

const ACI = { 1: '#d32f2f', 2: '#c9a400', 3: '#2e7d32', 4: '#00838f', 5: '#1565c0', 6: '#8e24aa', 7: '#1b1f24', 8: '#6b7280', 9: '#9ca3af', 30: '#ef6c00', 40: '#ff8f00', 250: '#374151', 251: '#4b5563', 252: '#6b7280', 253: '#9ca3af' };
const aciHex = (n) => ACI[Math.abs(n)] || '#374151';
export const EINHEITEN = { 0: ['ohne Angabe', 1], 1: ['Zoll', 25.4], 2: ['Fuß', 304.8], 4: ['Millimeter', 1], 5: ['Zentimeter', 10], 6: ['Meter', 1000], 14: ['Dezimeter', 100] };

/** Gruppencode-Paare lesen */
function paare(text) { const z = text.split(/\r?\n/); const out = []; for (let i = 0; i + 1 < z.length; i += 2) out.push([parseInt(z[i].trim(), 10), z[i + 1].replace(/\s+$/, '')]); return out; }
/** MTEXT-Formatierung entfernen */
export function mtextKlar(s) { return String(s).replace(/\\P/g, '\n').replace(/\\[ACFHQTWfpLlOoKk][^;\\]*;?/g, '').replace(/\\S([^;]*)\^([^;]*);/g, '$1/$2').replace(/[{}]/g, '').replace(/%%c/gi, 'Ø').replace(/%%d/gi, '°').replace(/%%p/gi, '±').trim(); }

/** DXF → { einheit, layers:{name:{color}}, entities:[...], bbox } in Zeichnungseinheiten */
export function parseDXF(text) {
  const P = paare(text); let i = 0; const res = { insunits: 0, layers: {}, blocks: {}, entities: [] };
  const sektion = () => { while (i < P.length && !(P[i][0] === 0 && P[i][1] === 'SECTION')) i++; i++; return P[i] && P[i][0] === 2 ? P[i++][1] : null; };
  // Entity ab aktueller Position lesen (P[i] = [0, TYP])
  const leseEntity = () => {
    const typ = P[i][1]; i++; const e = { typ, layer: '0', color: 256, codes: [] };
    while (i < P.length && P[i][0] !== 0) { const [c, v] = P[i]; e.codes.push([c, v]); if (c === 8) e.layer = v; else if (c === 62) e.color = parseInt(v, 10); i++; }
    return e;
  };
  const num = (e, c, d = 0) => { const f = e.codes.find(x => x[0] === c); return f ? parseFloat(f[1]) : d; };
  const str = (e, c) => { const f = e.codes.filter(x => x[0] === c).map(x => x[1]); return f.join(''); };
  const wandle = (e, liste) => {
    const t = e.typ;
    if (t === 'LINE') liste.push({ k: 'line', layer: e.layer, color: e.color, a: { x: num(e, 10), y: num(e, 20) }, b: { x: num(e, 11), y: num(e, 21) } });
    else if (t === 'LWPOLYLINE') { const pts = []; let cur = null; const bul = []; for (const [c, v] of e.codes) { if (c === 10) { cur = { x: parseFloat(v), y: 0 }; pts.push(cur); bul.push(0); } else if (c === 20 && cur) cur.y = parseFloat(v); else if (c === 42 && pts.length) bul[pts.length - 1] = parseFloat(v); }
      const closed = (num(e, 70) & 1) === 1; liste.push({ k: 'poly', layer: e.layer, color: e.color, pts: mitBulges(pts, bul, closed), closed }); }
    else if (t === 'CIRCLE') liste.push({ k: 'circle', layer: e.layer, color: e.color, c: { x: num(e, 10), y: num(e, 20) }, r: num(e, 40) });
    else if (t === 'ARC') { const c = { x: num(e, 10), y: num(e, 20) }, r = num(e, 40); let a0 = num(e, 50), a1 = num(e, 51); if (a1 < a0) a1 += 360; const n = Math.max(6, Math.ceil((a1 - a0) / 6)); const pts = []; for (let k = 0; k <= n; k++) { const a = G.rad(a0 + (a1 - a0) * k / n); pts.push({ x: c.x + Math.cos(a) * r, y: c.y + Math.sin(a) * r }); } liste.push({ k: 'poly', layer: e.layer, color: e.color, pts, closed: false }); }
    else if (t === 'ELLIPSE') { const c = { x: num(e, 10), y: num(e, 20) }, mx = num(e, 11), my = num(e, 21), ratio = num(e, 40, 1); let s0 = num(e, 41, 0), s1 = num(e, 42, Math.PI * 2); if (s1 < s0) s1 += Math.PI * 2; const R = Math.hypot(mx, my), rot = Math.atan2(my, mx); const n = Math.max(12, Math.ceil((s1 - s0) / 0.1)); const pts = []; for (let k = 0; k <= n; k++) { const u = s0 + (s1 - s0) * k / n; const x = Math.cos(u) * R, y = Math.sin(u) * R * ratio; pts.push({ x: c.x + x * Math.cos(rot) - y * Math.sin(rot), y: c.y + x * Math.sin(rot) + y * Math.cos(rot) }); } liste.push({ k: 'poly', layer: e.layer, color: e.color, pts, closed: Math.abs(s1 - s0 - Math.PI * 2) < 1e-6 }); }
    else if (t === 'TEXT' || t === 'MTEXT') { const txt = t === 'MTEXT' ? mtextKlar(str(e, 3) + str(e, 1)) : mtextKlar(str(e, 1)); if (txt) liste.push({ k: 'text', layer: e.layer, color: e.color, p: { x: num(e, 10), y: num(e, 20) }, h: num(e, 40, 250), text: txt, rot: num(e, 50, 0) }); }
    else if (t === 'INSERT') liste.push({ k: 'insert', layer: e.layer, color: e.color, name: str(e, 2), p: { x: num(e, 10), y: num(e, 20) }, sx: num(e, 41, 1), sy: num(e, 42, 1), rot: num(e, 50, 0) });
    else if (t === 'SOLID' || t === '3DFACE') { const pts = [[10, 20], [11, 21], [13, 23], [12, 22]].map(([a, b]) => ({ x: num(e, a), y: num(e, b) })); liste.push({ k: 'poly', layer: e.layer, color: e.color, pts, closed: true }); }
  };
  // POLYLINE (alt) mit VERTEX-Folge
  const lesePolyline = (e, liste) => { const pts = [], bul = []; while (i < P.length && P[i][0] === 0 && P[i][1] === 'VERTEX') { const v = leseEntity(); pts.push({ x: num(v, 10), y: num(v, 20) }); bul.push(num(v, 42, 0)); } if (P[i] && P[i][1] === 'SEQEND') leseEntity(); const closed = (num(e, 70) & 1) === 1; if (pts.length > 1) liste.push({ k: 'poly', layer: e.layer, color: e.color, pts: mitBulges(pts, bul, closed), closed }); };
  const leseListe = (ende, liste) => { while (i < P.length && !(P[i][0] === 0 && ende.includes(P[i][1]))) { if (P[i][0] !== 0) { i++; continue; } const e = leseEntity(); if (e.typ === 'POLYLINE') lesePolyline(e, liste); else wandle(e, liste); } };
  while (i < P.length) {
    const s = sektion(); if (!s) break;
    if (s === 'HEADER') { while (i < P.length && !(P[i][0] === 0 && P[i][1] === 'ENDSEC')) { if (P[i][0] === 9 && P[i][1] === '$INSUNITS') { res.insunits = parseInt(P[i + 1][1], 10); } i++; } }
    else if (s === 'TABLES') { while (i < P.length && !(P[i][0] === 0 && P[i][1] === 'ENDSEC')) { if (P[i][0] === 0 && P[i][1] === 'LAYER') { const e = leseEntity(); const n = e.codes.find(x => x[0] === 2); if (n) res.layers[n[1]] = { color: e.color, aus: e.color < 0 }; } else i++; } }
    else if (s === 'BLOCKS') { while (i < P.length && !(P[i][0] === 0 && P[i][1] === 'ENDSEC')) { if (P[i][0] === 0 && P[i][1] === 'BLOCK') { const b = leseEntity(); const name = (b.codes.find(x => x[0] === 2) || [0, ''])[1]; const base = { x: num(b, 10), y: num(b, 20) }; const liste = []; leseListe(['ENDBLK'], liste); if (P[i]) leseEntity(); res.blocks[name] = { base, liste }; } else i++; } }
    else if (s === 'ENTITIES') { leseListe(['ENDSEC'], res.entities); }
    while (i < P.length && !(P[i][0] === 0 && P[i][1] === 'ENDSEC')) i++; i++;
  }
  // Blöcke auflösen (rekursiv, max. Tiefe 6)
  const aufloesen = (liste, tf, tiefe, layerErbe) => { const out = []; for (const e of liste) {
    const lay = e.layer === '0' && layerErbe ? layerErbe : e.layer;
    if (e.k === 'insert') { const b = res.blocks[e.name]; if (!b || tiefe > 6 || /^\*(model|paper)_space/i.test(e.name)) continue; const t2 = (p) => tf({ x: e.p.x + ((p.x - b.base.x) * e.sx) * Math.cos(G.rad(e.rot)) - ((p.y - b.base.y) * e.sy) * Math.sin(G.rad(e.rot)), y: e.p.y + ((p.x - b.base.x) * e.sx) * Math.sin(G.rad(e.rot)) + ((p.y - b.base.y) * e.sy) * Math.cos(G.rad(e.rot)) }); const sk = Math.abs(e.sx); out.push(...aufloesen(b.liste, t2, tiefe + 1, lay).map(x => x.k === 'circle' ? { ...x, r: x.r * sk } : x.k === 'text' ? { ...x, h: x.h * sk } : x)); continue; }
    if (e.k === 'line') out.push({ ...e, layer: lay, a: tf(e.a), b: tf(e.b) }); else if (e.k === 'poly') out.push({ ...e, layer: lay, pts: e.pts.map(tf) }); else if (e.k === 'circle') out.push({ ...e, layer: lay, c: tf(e.c) }); else if (e.k === 'text') out.push({ ...e, layer: lay, p: tf(e.p) });
  } return out; };
  res.entities = aufloesen(res.entities, p => p, 0, null);
  let bb = null; for (const e of res.entities) { const pts = e.k === 'line' ? [e.a, e.b] : e.k === 'poly' ? e.pts : e.k === 'circle' ? [{ x: e.c.x - e.r, y: e.c.y - e.r }, { x: e.c.x + e.r, y: e.c.y + e.r }] : [e.p]; for (const p of pts) if (isFinite(p.x) && isFinite(p.y)) bb = G.bboxUnion(bb, { x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }
  res.bbox = bb; return res;
}
function mitBulges(pts, bul, closed) {
  if (!bul.some(b => b)) return pts; const out = []; const n = pts.length;
  for (let k = 0; k < n; k++) { const a = pts[k]; out.push(a); if (!closed && k === n - 1) break; const b = pts[(k + 1) % n]; const bg = bul[k]; if (!bg) continue;
    const th = 4 * Math.atan(bg); const L = G.dist(a, b); if (L < 1e-9) continue; const r = L / (2 * Math.sin(th / 2)); const m = G.mid(a, b); const d = G.norm(G.sub(b, a)); const nrm = { x: -d.y, y: d.x }; const s = r * Math.cos(th / 2); const c = G.add(m, G.mul(nrm, s));
    const a0 = Math.atan2(a.y - c.y, a.x - c.x); const steps = Math.max(4, Math.ceil(Math.abs(th) / G.rad(8))); for (let j = 1; j < steps; j++) { const ang = a0 + th * j / steps; out.push({ x: c.x + Math.cos(ang) * Math.abs(r), y: c.y + Math.sin(ang) * Math.abs(r) }); } }
  return out;
}

/** Wände aus parallelen Linienpaaren erkennen (Abstand 60–550 mm, Überlappung ≥ 300 mm) */
export function waendeErkennen(segs, opt = {}) {
  const dMin = opt.dMin || 60, dMax = opt.dMax || 550, minUeb = opt.minUeb || 300; const waende = []; const benutzt = new Set();
  const S = segs.map((s, idx) => { const L = G.dist(s.a, s.b); const u = L ? G.mul(G.sub(s.b, s.a), 1 / L) : { x: 1, y: 0 }; return { ...s, idx, L, u }; }).filter(s => s.L >= minUeb);
  S.sort((a, b) => b.L - a.L);
  for (let i = 0; i < S.length; i++) { const s = S[i]; if (benutzt.has(s.idx)) continue; let best = null;
    for (let j = 0; j < S.length; j++) { if (i === j) continue; const t = S[j]; if (benutzt.has(t.idx)) continue; if (Math.abs(G.cross(s.u, t.u)) > 0.02) continue;
      const n = { x: -s.u.y, y: s.u.x }; const d = G.dot(G.sub(t.a, s.a), n); const ad = Math.abs(d); if (ad < dMin || ad > dMax) continue;
      const ta = G.dot(G.sub(t.a, s.a), s.u), tb = G.dot(G.sub(t.b, s.a), s.u); const lo = Math.max(0, Math.min(ta, tb)), hi = Math.min(s.L, Math.max(ta, tb)); const ueb = hi - lo; if (ueb < minUeb) continue;
      const score = ueb - ad * 0.5; if (!best || score > best.score) best = { t, d, lo, hi, score }; }
    if (!best) continue; benutzt.add(s.idx); benutzt.add(best.t.idx);
    const n = { x: -s.u.y, y: s.u.x }; const off = G.mul(n, best.d / 2); const a = G.add(G.add(s.a, G.mul(s.u, best.lo)), off), b = G.add(G.add(s.a, G.mul(s.u, best.hi)), off);
    waende.push({ a, b, thickness: Math.round(Math.abs(best.d) / 5) * 5 });
  }
  // Wandenden zu Ecken und T-Stößen verlängern (Schnittpunkt der Achsen)
  for (const w of waende) for (const ende of ['a', 'b']) {
    let best = null;
    for (const o of waende) { if (o === w) continue; const du = G.sub(w.b, w.a), dv = G.sub(o.b, o.a); const cr = G.cross(du, dv); if (Math.abs(cr) < 1e-6 * G.len(du) * G.len(dv)) continue;
      const x = G.lineIntersect(w.a, du, o.a, dv); if (!x) continue; const tol = Math.max(w.thickness, o.thickness) * 0.75 + 60; const d = G.dist(x, w[ende]); if (d > tol) continue;
      const Lo = G.len(dv), t = G.dot(G.sub(x, o.a), dv) / Lo; if (t < -tol || t > Lo + tol) continue; if (!best || d < best.d) best = { x, d }; }
    if (best) w[ende] = { x: best.x.x, y: best.x.y };
  }
  return { waende, benutzt };
}

function innenPunkt(poly) { const c = G.polyCentroid(poly); if (G.pointInPoly(c, poly)) return c; const bb = G.bbox(poly); let best = null, bd = -1; for (let i = 1; i < 12; i++) for (let j = 1; j < 12; j++) { const p = { x: bb.x0 + bb.w * i / 12, y: bb.y0 + bb.h * j / 12 }; if (!G.pointInPoly(p, poly)) continue; let d = Infinity; for (let k = 0; k < poly.length; k++) d = Math.min(d, G.closestOnSeg(p, poly[k], poly[(k + 1) % poly.length]).d); if (d > bd) { bd = d; best = p; } } return best || c; }
/** Importierte Elemente ins Projekt übernehmen */
export function uebernehmen(doc, res, opt = {}) {
  const f = opt.faktor || 1; const sid = doc.p.activeStorey; const bb = res.bbox || { x0: 0, y0: 0 };
  const ox = opt.ursprung === 'null' ? -bb.x0 * f : 0, oy = opt.ursprung === 'null' ? -bb.y0 * f : 0; const T = (p) => ({ x: p.x * f + ox, y: p.y * f + oy });
  const layerAus = new Set(opt.aus || []); const mapL = new Map(); const st = { linien: 0, polylinien: 0, kreise: 0, texte: 0, waende: 0 };
  const lid = (name) => { if (mapL.has(name)) return mapL.get(name); const id = 'L_dxf_' + name.replace(/[^\w]+/g, '_').slice(0, 40); if (!doc.p.layers.find(l => l.id === id)) doc.p.layers.push({ id, name: 'DXF: ' + name, color: aciHex((res.layers[name] || {}).color || 7), visible: true, locked: false }); mapL.set(name, id); return id; };
  const ents = res.entities.filter(e => !layerAus.has(e.layer));
  doc.change('DXF importieren', () => {
    let rest = ents;
    if (opt.waende) {
      const segs = []; ents.forEach((e, k) => { if (e.k === 'line') segs.push({ a: T(e.a), b: T(e.b), k }); else if (e.k === 'poly') { const p = e.pts.map(T); for (let q = 0; q < p.length - (e.closed ? 0 : 1); q++) segs.push({ a: p[q], b: p[(q + 1) % p.length], k, teil: true }); } });
      const r = waendeErkennen(segs, opt);
      for (const w of r.waende) { doc.add({ type: 'wall', storey: sid, a: w.a, b: w.b, thickness: w.thickness, art: w.thickness >= 240 ? 'aussen' : 'innen', material: 'mauerwerk' }); st.waende++; }
      const weg = new Set([...r.benutzt].map(ix => segs[ix]).filter(s => s && !s.teil).map(s => s.k)); rest = ents.filter((e, k) => !weg.has(k));
      // Räume aus den erkannten Wänden anlegen; DXF-Texte im Raum werden Raumname/-nummer
      if (r.waende.length && opt.raeume !== false) { doc.cacheVersion++; const geo = W.storeyGeometry(doc, sid); const genutzt = new Set(); let nr = 1;
        for (const poly of geo.rooms) { if (G.polyArea(poly) < 1.5e6) continue; const innen = innenPunkt(poly);
          const txt = rest.map((e, k) => ({ e, k })).filter(({ e }) => e.k === 'text' && G.pointInPoly(T(e.p), poly));
          const nrT = txt.find(({ e }) => /^\s*\d+([.,]\d+)*\s*$/.test(e.text) || /^\d{1,2}\.\d{2}/.test(e.text)); const nameT = txt.find(({ e }) => /[a-zäöü]{3,}/i.test(e.text) && !/m²|m2|qm|\d+[,.]\d+\s*m/i.test(e.text));
          if (nameT) genutzt.add(nameT.k); if (nrT) genutzt.add(nrT.k);
          doc.add({ type: 'room', storey: sid, seed: innen, poly: null, name: nameT ? nameT.e.text.split('\n')[0].trim() : 'Raum', nr: nrT ? nrT.e.text.trim() : String(nr).padStart(2, '0'), tiles: {} }); nr++; st.raeume = (st.raeume || 0) + 1; }
        rest = rest.filter((e, k) => !genutzt.has(k)); }
    }
    for (const e of rest) {
      const layer = lid(e.layer);
      if (e.k === 'line') { doc.add({ type: 'line', storey: sid, layer, a: T(e.a), b: T(e.b) }); st.linien++; }
      else if (e.k === 'poly' && e.pts.length > 1) { doc.add({ type: 'poly', storey: sid, layer, pts: e.pts.map(T), closed: !!e.closed }); st.polylinien++; }
      else if (e.k === 'circle' && e.r > 0) { doc.add({ type: 'circle', storey: sid, layer, c: T(e.c), r: e.r * f }); st.kreise++; }
      else if (e.k === 'text' && opt.texte !== false) { doc.add({ type: 'text', storey: sid, layer, p: T(e.p), text: e.text, size: Math.max(1.5, Math.min(10, e.h * f / (doc.p.settings.massstab || 50))) }); st.texte++; }
    }
  });
  return st;
}

/* ───────── Dialog ───────── */
const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
export async function openDxfImport(app, file = null) {
  if (!file) file = await app.pickFile('.dxf,.dwg'); if (!file) return;
  if (/\.dwg$/i.test(file.name)) { app.toast('DWG ist ein geschlossenes Format – bitte im CAD des Architekten „Speichern unter → DXF“ wählen (oder den Architekten um DXF bitten).', true); return; }
  let res; try { const buf = await file.arrayBuffer(); let txt = new TextDecoder('utf-8').decode(buf); if (txt.includes('�')) txt = new TextDecoder('windows-1252').decode(buf); if (/^AutoCAD Binary DXF/.test(txt)) throw new Error('Binär-DXF wird nicht unterstützt – bitte als ASCII-DXF speichern.'); res = parseDXF(txt); } catch (e) { app.toast('DXF konnte nicht gelesen werden: ' + e.message, true); return; }
  if (!res.entities.length) { app.toast('In der DXF-Datei wurden keine Zeichnungselemente gefunden.', true); return; }
  // Einheit raten, falls nicht angegeben
  const bb = res.bbox; const groesse = Math.max(bb.w, bb.h); let einheit = res.insunits && EINHEITEN[res.insunits] ? res.insunits : (groesse < 200 ? 6 : groesse < 5000 ? 5 : 4);
  const zaehl = {}; for (const e of res.entities) zaehl[e.layer] = (zaehl[e.layer] || 0) + 1;
  const aus = new Set(Object.keys(zaehl).filter(l => (res.layers[l] || {}).aus || /^(defpoints|hatch|schraffur)/i.test(l)));
  const st = { einheit, ursprung: groesse * EINHEITEN[einheit][1] > 1e6 || bb.x0 * EINHEITEN[einheit][1] > 5e5 ? 'null' : 'behalten', waende: false, texte: true };
  const body = h('div', {}); const info = h('div', { class: 'note' });
  const malen = () => {
    body.innerHTML = ''; const f = EINHEITEN[st.einheit][1];
    info.textContent = `${file.name}: ${res.entities.length} Elemente auf ${Object.keys(zaehl).length} Ebenen · Ausdehnung ${G.fmtM(bb.w * f)} × ${G.fmtM(bb.h * f)} m${res.insunits ? '' : ' (Einheit geschätzt – bitte prüfen)'}`;
    const es = h('select', {}); for (const [k, [l]] of Object.entries(EINHEITEN)) if (k !== '0') es.append(h('option', { value: k, selected: +k === +st.einheit }, l)); es.onchange = () => { st.einheit = +es.value; malen(); };
    const us = h('select', {}); for (const [k, l] of [['behalten', 'Koordinaten behalten'], ['null', 'linke untere Ecke auf 0/0']]) us.append(h('option', { value: k, selected: st.ursprung === k }, l)); us.onchange = () => st.ursprung = us.value;
    const lay = h('div', { class: 'list', style: 'max-height:220px;overflow:auto' });
    for (const [l, n] of Object.entries(zaehl).sort((a, b) => b[1] - a[1])) { const cb = h('input', { type: 'checkbox' }); cb.checked = !aus.has(l); cb.onchange = () => cb.checked ? aus.delete(l) : aus.add(l); lay.append(h('label', { class: 'li', style: 'gap:8px' }, cb, h('span', { class: 'sw', style: `background:${aciHex((res.layers[l] || {}).color || 7)}` }), h('span', { class: 'grow' }, l), h('span', { class: 'muted' }, n + ' Elemente'))); }
    const cw = h('input', { type: 'checkbox' }); cw.checked = st.waende; cw.onchange = () => st.waende = cw.checked;
    const ct = h('input', { type: 'checkbox' }); ct.checked = st.texte; ct.onchange = () => st.texte = ct.checked;
    body.append(info, h('div', { class: 'row' }, h('label', {}, 'Einheit der Zeichnung'), es), h('div', { class: 'row' }, h('label', {}, 'Lage'), us),
      h('h4', {}, 'Ebenen übernehmen'), lay,
      h('label', { class: 'li', style: 'gap:8px' }, cw, h('span', {}, h('b', {}, 'Wände automatisch erkennen'), h('br'), h('span', { class: 'muted' }, 'Parallele Linienpaare mit 6–55 cm Abstand werden zu echten Wänden (Stärke wird übernommen). Tipp: vorher nur die Wand-Ebene anhaken.'))),
      h('label', { class: 'li', style: 'gap:8px' }, ct, h('span', {}, 'Texte übernehmen')),
      h('div', { class: 'muted', style: 'margin-top:6px' }, `Ziel: Geschoss ${app.doc.storeyById(app.doc.p.activeStorey).name}. Jede DXF-Ebene wird eine eigene Ebene „DXF: …“ – rechts unter „Ebenen“ ein-/ausblenden oder sperren.`));
  };
  malen();
  const close = app.modal('DXF-Zeichnung importieren', body, [h('button', { class: 'btn', onclick: () => close() }, 'Abbrechen'), h('button', { class: 'btn pri', onclick: () => {
    const s = uebernehmen(app.doc, res, { faktor: EINHEITEN[st.einheit][1], ursprung: st.ursprung, aus: [...aus], waende: st.waende, texte: st.texte }); close(); app.zoomFit(); app.renderSide();
    app.toast(`DXF importiert: ${s.waende ? s.waende + ' Wände, ' : ''}${s.raeume ? s.raeume + ' Räume, ' : ''}${s.linien} Linien, ${s.polylinien} Polylinien, ${s.kreise} Kreise, ${s.texte} Texte`); } }, 'Importieren')]);
}
