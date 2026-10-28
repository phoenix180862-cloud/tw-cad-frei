// TW-CAD – zusätzliche Bauteil-Werkzeuge: Bogenwand, Körper/Podest, Deckendurchbruch, Unterzug, Dachfenster, Gaube
import * as G from './geom.js?v=20261028-0429';
import { Tool } from './tools.js?v=20261028-0429';
import * as AB from './aufbau.js?v=20261028-0429';
import { uid } from './model.js?v=20261028-0429';

const PREV = { color: '#2563eb', w: 0.35 };

/** Kreisbogen durch Start, Ende und Stich (Pfeilhöhe; Vorzeichen = Seite) */
export function bogenPunkte(a, b, stich, seg = null) {
  const c = G.dist(a, b); if (c < 1 || Math.abs(stich) < 1) return [a, b];
  const s = Math.abs(stich); const R = (c * c / 4 + s * s) / (2 * s); const m = G.mid(a, b); const u = G.norm(G.sub(b, a)); const n = G.mul(G.perp(u), Math.sign(stich));
  const M = G.add(m, G.mul(n, s - R)); // Mittelpunkt
  const a0 = Math.atan2(a.y - M.y, a.x - M.x), a1 = Math.atan2(b.y - M.y, b.x - M.x); let da = a1 - a0;
  // Bogen über den Stichpunkt
  const top = G.add(m, G.mul(n, s)); const at = Math.atan2(top.y - M.y, top.x - M.x);
  const norm = (x) => { while (x <= -Math.PI) x += 2 * Math.PI; while (x > Math.PI) x -= 2 * Math.PI; return x; };
  da = norm(da); const dt = norm(at - a0); if (Math.sign(dt) !== Math.sign(da) || Math.abs(dt) > Math.abs(da)) da = da > 0 ? da - 2 * Math.PI : da + 2 * Math.PI;
  const L = Math.abs(da) * R; const n2 = seg || Math.max(6, Math.min(48, Math.ceil(L / 300)));
  const pts = []; for (let i = 0; i <= n2; i++) { const t = a0 + da * i / n2; pts.push({ x: M.x + Math.cos(t) * R, y: M.y + Math.sin(t) * R }); }
  pts[0] = G.clone(a); pts[n2] = G.clone(b); return pts;
}

/* ───────── Bogenwand ───────── */
export class ArcWallTool extends Tool {
  hint() { return this.pts.length === 0 ? 'Bogenwand: Anfangspunkt klicken' : this.pts.length === 1 ? 'Endpunkt klicken (oder Sehnenlänge tippen)' : 'Bogen mit der Maus aufziehen und klicken – oder Stich (Pfeilhöhe) bzw. „R 2500“ für den Radius tippen'; }
  options() {
    const S = this.S;
    return [
      { label: 'Stärke', type: 'combo', anzeige: 'cm', chips: [115, 175, 240, 300, 365], values: [[75, '7,5'], [100, '10'], [115, '11,5'], [125, '12,5'], [150, '15'], [175, '17,5'], [200, '20'], [240, '24'], [300, '30'], [365, '36,5'], [425, '42,5'], [490, '49']], unit: 'mm', get: () => S.wandStaerke, set: v => S.wandStaerke = +v },
      { label: 'Art', type: 'seg', values: [['aussen', 'Außenwand'], ['innen', 'Innenwand']], get: () => S.wandArt, set: v => S.wandArt = v },
      { label: 'Teilung', type: 'sel', values: [['', 'automatisch (≈ 30 cm)'], ['8', '8 Segmente'], ['12', '12'], ['16', '16'], ['24', '24'], ['36', '36']], get: () => S.bogenSeg || '', set: v => S.bogenSeg = v || null }
    ];
  }
  down(ev) { if (ev.button === 2) { this.cancel(); return; } this.add(this.app.cursor.p); }
  add(p) {
    if (this.pts.length < 2) { this.pts.push(G.clone(p)); this.app.redraw(); return; }
    this.erzeugen(this.stichAus(p));
  }
  stichAus(p) { const [a, b] = this.pts; const n = G.perp(G.norm(G.sub(b, a))); return G.dot(G.sub(p, G.mid(a, b)), n); }
  erzeugen(stich) {
    const [a, b] = this.pts; const S = this.S; const pts = bogenPunkte(a, b, stich, S.bogenSeg ? +S.bogenSeg : null); const gid = uid('bg');
    this.doc.change('Bogenwand', () => {
      for (let i = 1; i < pts.length; i++) {
        const w = this.doc.add({ type: 'wall', a: pts[i - 1], b: pts[i], thickness: S.wandStaerke, height: S.wandHoehe || null, art: S.wandArt, material: S.wandMaterial || 'mauerwerk', facade: S.wandArt === 'aussen' ? (S.stdFassade || 'putz-scheibenputz') : null, bogen: gid });
        const ab = AB.aufbauById(S.wandAufbau); if (ab && AB.summe(ab.schichten) === S.wandStaerke) { w.aufbau = ab.id; w.schichten = ab.schichten.map(x => x.slice()); }
      }
    });
    this.pts = []; this.app.redraw(); this.app.toast(`Bogenwand aus ${pts.length - 1} Segmenten – Radius ${G.fmtCm(this.radius(a, b, stich))} cm`);
  }
  radius(a, b, s) { const c = G.dist(a, b); s = Math.abs(s); return s < 1 ? Infinity : (c * c / 4 + s * s) / (2 * s); }
  enter(txt) {
    const t = txt.trim();
    if (this.pts.length === 2) {
      const [a, b] = this.pts; const c = G.dist(a, b);
      const mR = t.match(/^r\s*([\d.,]+\s*(mm|cm|m)?)$/i);
      if (mR) { const R = G.parseLen(mR[1], 'mm'); if (!(R >= c / 2)) { this.app.toast('Radius zu klein (mind. halbe Sehne)', true); return true; } const cur = this.app.cursor ? this.stichAus(this.app.cursor.p) : 1; const s = R - Math.sqrt(R * R - c * c / 4); this.erzeugen(Math.sign(cur || 1) * s); return true; }
      const s = G.parseLen(t, 'mm'); if (isFinite(s)) { const cur = this.app.cursor ? this.stichAus(this.app.cursor.p) : 1; this.erzeugen(Math.sign(cur || 1) * Math.abs(s)); return true; }
      return false;
    }
    const p = this.typedPoint(txt); if (!p) return false; this.add(p); return true;
  }
  draw(P) {
    const cur = this.app.cursor; if (!cur || !this.pts.length) return;
    if (this.pts.length === 1) { P.line(this.pts[0], cur.p, PREV); this.app.dyn(this.lenLabel(this.pts[0], cur.p)); return; }
    const [a, b] = this.pts; const s = this.stichAus(cur.p); const pts = bogenPunkte(a, b, s, this.S.bogenSeg ? +this.S.bogenSeg : null);
    const t = (this.S.wandStaerke || 240) / 2; const L = [], R = [];
    for (let i = 0; i < pts.length; i++) { const p0 = pts[Math.max(0, i - 1)], p1 = pts[Math.min(pts.length - 1, i + 1)]; const n = G.perp(G.norm(G.sub(p1, p0))); L.push(G.add(pts[i], G.mul(n, t))); R.push(G.sub(pts[i], G.mul(n, t))); }
    P.polyline(pts, { color: '#2563eb', w: 0.2, dash: [2, 1] }); P.polyline(L, PREV); P.polyline(R, PREV);
    this.app.dyn(`Stich ${G.fmtCm(Math.abs(s))} cm · Radius ${isFinite(this.radius(a, b, s)) ? G.fmtCm(this.radius(a, b, s)) + ' cm' : '∞'}`);
  }
}

/* ───────── Polygon-Bauteile: Körper/Podest/Sitzbank, Deckendurchbruch ───────── */
export const KOERPER_ARTEN = [['podest', 'Podest / Sockel', 0, 150], ['sitzbank', 'Sitzbank (gemauert)', 0, 450], ['stufe', 'Stufe', 0, 180], ['kamin', 'Kamin / Schornstein', 0, null], ['ablage', 'Ablage / Mauerscheibe', 0, 1100], ['brunnen', 'Beckenrand / Brüstung', 0, 900], ['koerper', 'freier Körper', 0, 1000], ['decke', 'Decke / Platte (frei)', null, null]];
export class PolyBodyTool extends Tool {
  constructor(app, opt) { super(app, opt); this.kind = opt.kind; }
  hint() { return this.kind === 'durchbruch' ? 'Deckendurchbruch: Umriss klicken, Enter/Doppelklick oder Startpunkt schließt · Rechteck: zwei Ecken mit Umschalt' : this.kind === 'balken' ? 'Unterzug/Balken: Anfangs- und Endpunkt klicken (oder Länge tippen)' : 'Körper/Podest: Umriss klicken – Enter/Doppelklick/Startpunkt schließt'; }
  options() {
    const S = this.S;
    if (this.kind === 'durchbruch') return [{ label: 'Art', type: 'sel', values: [['decke', 'Decke über diesem Geschoss'], ['boden', 'Boden (Decke darunter)']], get: () => S.durchbruchIn || 'boden', set: v => S.durchbruchIn = v }];
    if (this.kind === 'balken') return [
      { label: 'Breite', type: 'num', unit: 'mm', get: () => S.balkenB || 240, set: v => S.balkenB = +v },
      { label: 'Höhe (unter Decke)', type: 'num', unit: 'mm', get: () => S.balkenH || 300, set: v => S.balkenH = +v },
      { label: 'Material', type: 'sel', values: [['beton', 'Stahlbeton'], ['stahl', 'Stahlträger'], ['holz', 'Holz']], get: () => S.balkenM || 'beton', set: v => S.balkenM = v }];
    const art = S.koerperArt || 'podest'; const a = KOERPER_ARTEN.find(x => x[0] === art) || KOERPER_ARTEN[0];
    return [
      { label: 'Art', type: 'sel', values: KOERPER_ARTEN.map(x => [x[0], x[1]]), get: () => art, set: v => { S.koerperArt = v; const d = KOERPER_ARTEN.find(x => x[0] === v); if (d && d[3]) S.koerperH = d[3]; this.app.refreshOpt(); } },
      art === 'decke' ? { label: 'Oberkante', type: 'num', unit: 'mm über FFB', get: () => S.deckeZ ?? 2500, set: v => S.deckeZ = +v } : { label: 'Höhe', type: 'num', unit: 'mm', placeholder: 'raumhoch', get: () => S.koerperH ?? a[3] ?? '', set: v => S.koerperH = v === '' ? null : +v },
      art === 'decke' ? { label: 'Stärke', type: 'num', unit: 'mm', get: () => S.deckeD || 200, set: v => S.deckeD = +v } : { label: 'ab Höhe', type: 'num', unit: 'mm', get: () => S.koerperZ0 || 0, set: v => S.koerperZ0 = +v }
    ];
  }
  down(ev) {
    if (ev.button === 2) { this.finish(true); return; }
    const p = G.clone(this.app.cursor.p);
    if (this.kind === 'balken') { if (!this.pts.length) { this.pts = [p]; return; } this.balken(this.pts[0], p); return; }
    if (ev.shift && this.pts.length === 1) { const a = this.pts[0]; this.pts = [a, { x: p.x, y: a.y }, p, { x: a.x, y: p.y }]; this.finish(true); return; }
    if (this.pts.length >= 3 && G.dist(p, this.pts[0]) < 2) { this.finish(true); return; }
    this.pts.push(p); this.app.redraw();
  }
  balken(a, b) { const S = this.S; this.doc.change('Unterzug', () => this.doc.add({ type: 'balken', a: G.clone(a), b: G.clone(b), breite: S.balkenB || 240, hoehe: S.balkenH || 300, material: S.balkenM || 'beton' })); this.pts = []; this.app.redraw(); }
  dbl() { this.finish(true); }
  finish() {
    const pts = this.pts; this.pts = []; if (this.kind === 'balken' || pts.length < 3) { this.app.redraw(); return; }
    const S = this.S; const poly = G.ensureCCW(pts);
    if (this.kind === 'durchbruch') this.doc.change('Deckendurchbruch', () => this.doc.add({ type: 'durchbruch', pts: poly, in: S.durchbruchIn || 'boden' }));
    else {
      const art = S.koerperArt || 'podest'; const d = KOERPER_ARTEN.find(x => x[0] === art) || KOERPER_ARTEN[0];
      if (art === 'decke') this.doc.change('Decke', () => this.doc.add({ type: 'koerper', art, pts: poly, z1: S.deckeZ ?? 2500, z0: (S.deckeZ ?? 2500) - (S.deckeD || 200) }));
      else this.doc.change(d[1], () => this.doc.add({ type: 'koerper', art, pts: poly, z0: S.koerperZ0 || 0, z1: S.koerperH === null || S.koerperH === undefined ? (d[3] ?? null) : (S.koerperZ0 || 0) + S.koerperH, material: art === 'kamin' ? 'klinker' : 'mauerwerk' }));
    }
    this.app.redraw();
  }
  enter(txt) {
    if (txt === '' && this.pts.length) { this.finish(); return true; }
    if (this.kind === 'balken' && this.pts.length) { const p = this.typedPoint(txt); if (p) { this.balken(this.pts[0], p); return true; } return false; }
    const p = this.typedPoint(txt); if (!p) return false; this.pts.push(p); this.app.redraw(); return true;
  }
  draw(P) {
    const cur = this.app.cursor; if (!cur || !this.pts.length) return;
    if (this.kind === 'balken') { const w = (this.S.balkenB || 240) / 2; P.polyline(G.stripPoly(this.pts[0], cur.p, w), PREV, true); this.app.dyn(this.lenLabel(this.pts[0], cur.p)); return; }
    const all = [...this.pts, cur.p]; P.polyline(all, PREV, false); if (all.length >= 3) { P.fill([all], '#2563eb', 0.1); this.app.dyn(`Fläche ${(G.polyArea(all) / 1e6).toFixed(2).replace('.', ',')} m²`); } else this.app.dyn(this.lenLabel(this.pts[this.pts.length - 1], cur.p));
  }
}

/* ───────── Dachfenster und Gauben ───────── */
export class RoofItemTool extends Tool {
  constructor(app, opt) { super(app, opt); this.kind = opt.kind; }
  hint() { return this.kind === 'gaube' ? 'Gaube: auf der Dachfläche die Mitte der Gauben-Vorderwand klicken (Grundriss des Dachgeschosses)' : 'Dachfenster: Mitte des Fensters auf der Dachfläche klicken'; }
  options() {
    const S = this.S;
    if (this.kind === 'gaube') return [
      { label: 'Form', type: 'sel', values: [['schlepp', 'Schleppgaube'], ['sattel', 'Satteldachgaube'], ['flach', 'Flachdachgaube'], ['walm', 'Walmgaube']], get: () => S.gaubeTyp || 'schlepp', set: v => S.gaubeTyp = v },
      { label: 'Breite', type: 'num', unit: 'mm', get: () => S.gaubeB || 2000, set: v => S.gaubeB = +v },
      { label: 'Wandhöhe vorne', type: 'num', unit: 'mm', get: () => S.gaubeH || 1600, set: v => S.gaubeH = +v },
      { label: 'Fenster', type: 'sel', values: [['', 'automatisch'], ['ohne', 'ohne Fenster']], get: () => S.gaubeFenster || '', set: v => S.gaubeFenster = v }];
    return [
      { label: 'Größe', type: 'sel', values: [['550x780', '55 × 78 (CK02)'], ['660x1180', '66 × 118 (FK06)'], ['780x980', '78 × 98 (MK04)'], ['780x1180', '78 × 118 (MK06)'], ['780x1400', '78 × 140 (MK08)'], ['940x1600', '94 × 160 (PK10)'], ['1140x1180', '114 × 118 (SK06)'], ['1340x1400', '134 × 140 (UK08)']], get: () => S.dfGroesse || '780x1180', set: v => S.dfGroesse = v },
      { label: 'Ausführung', type: 'sel', values: [['schwing', 'Schwingfenster'], ['klapp', 'Klapp-Schwing'], ['ausstieg', 'Ausstiegsfenster'], ['fest', 'Festverglasung']], get: () => S.dfArt || 'schwing', set: v => S.dfArt = v }];
  }
  down(ev) {
    if (ev.button === 2) return; const p = G.clone(this.app.cursor.p); const S = this.S; const doc = this.doc;
    const rf = doc.p.roofs.find(r => r.storey === doc.p.activeStorey) || doc.p.roofs[0];
    if (!rf) { this.app.toast('Erst ein Dach anlegen (3D-Ansicht → „+ Dach hinzufügen“ oder Geschoss-Eigenschaften).', true); return; }
    if (this.kind === 'gaube') doc.change('Gaube', () => doc.add({ type: 'gaube', roof: rf.id, p, typ: S.gaubeTyp || 'schlepp', breite: S.gaubeB || 2000, hoehe: S.gaubeH || 1600, fenster: S.gaubeFenster !== 'ohne' }));
    else { const [w, l] = (S.dfGroesse || '780x1180').split('x').map(Number); doc.change('Dachfenster', () => doc.add({ type: 'dachfenster', roof: rf.id, p, breite: w, laenge: l, art: S.dfArt || 'schwing' })); }
    this.app.redraw();
  }
  draw(P) { const cur = this.app.cursor; if (!cur) return; const S = this.S; const w = this.kind === 'gaube' ? (S.gaubeB || 2000) : (+(S.dfGroesse || '780x1180').split('x')[0]); P.polyline([{ x: cur.p.x - w / 2, y: cur.p.y }, { x: cur.p.x + w / 2, y: cur.p.y }], PREV); }
}

export function makeTool2(app, name, opt = {}) {
  switch (name) {
    case 'bogenwand': return new ArcWallTool(app, opt);
    case 'koerper': case 'durchbruch': case 'balken': return new PolyBodyTool(app, { kind: name });
    case 'dachfenster': case 'gaube': return new RoofItemTool(app, { kind: name });
  }
  return null;
}
