// TW-CAD – Werkzeuge
import * as G from './geom.js?v=20261028-0429';
import * as AB from './aufbau.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import * as E from './edit.js?v=20261028-0429';
import { uid } from './model.js?v=20261028-0429';
import { SYMBOLE, SYMBOL_KATEGORIEN, symboleIn, symbolFootprint, columnPoly, dimGeometry, PEN, floorTiles } from './render2d.js?v=20261028-0429';
import { defaultTileCfg } from './tiles.js?v=20261028-0429';
import * as K from './katalog.js?v=20261028-0429';
import * as B from './bauteile.js?v=20261028-0429';
import * as T from './treppe.js?v=20261028-0429';
import { t } from './i18n.js?v=20261028-0429';

const SEL = '#2563eb';
export const WAND_MATERIAL = [['mauerwerk', 'Mauerwerk (allgemein)'], ['ziegel', 'Hochlochziegel'], ['ks', 'Kalksandstein'], ['porenbeton', 'Porenbeton (Ytong)'], ['beton', 'Stahlbeton'], ['leichtbeton', 'Leichtbeton / Bims'], ['trockenbau', 'Trockenbau (GK, Metallständer)'], ['holz', 'Holzständer'], ['glasbaustein', 'Glasbaustein']];
const PREV = { color: '#2563eb', w: 0.35 };

/* ───────── Basisklasse ───────── */
export class Tool {
  constructor(app, opt = {}) { this.app = app; this.opt = opt; this.pts = []; }
  get doc() { return this.app.doc; }
  get S() { return this.app.doc.p.settings; }
  hint() { return ''; }
  options() { return []; }
  from() { return this.pts.length ? this.pts[this.pts.length - 1] : null; }
  down(ev) { } move(ev) { } up(ev) { } dbl(ev) { }
  key(e) { return false; }
  enter(txt) { return false; }
  cancel() { if (this.pts.length) { this.pts = []; this.app.redraw(); return true; } return false; }
  finish() { this.cancel(); }
  draw(P) { }
  /** getippte Eingabe → Punkt relativ zum letzten Punkt */
  typedPoint(txt) {
    const from = this.from(); txt = txt.trim().replace(/\s+/g, '');
    const num = (s) => G.parseLen(s, 'mm');
    if (/^@?-?[\d.,]+[;:]-?[\d.,]+$/.test(txt)) {
      const rel = txt.startsWith('@') || !!from; const [a, b] = txt.replace('@', '').split(/[;:]/).map(num);
      if (!isFinite(a) || !isFinite(b)) return null; return rel && from ? { x: from.x + a, y: from.y + b } : { x: a, y: b };
    }
    if (/^-?[\d.,]+(mm|cm|m)?<-?[\d.,]+$/.test(txt)) { const [l, w] = txt.split('<'); const L = num(l), ang = G.rad(parseFloat(w.replace(',', '.'))); if (!from) return null; return G.add(from, G.fromAngle(ang, L)); }
    const L = num(txt); if (!isFinite(L) || !from) return null;
    const cur = this.app.cursor ? this.app.cursor.p : null; let dir = cur ? G.sub(cur, from) : { x: 1, y: 0 };
    if (G.len(dir) < 1e-6) dir = { x: 1, y: 0 };
    return G.add(from, G.mul(G.norm(dir), L));
  }
  lenLabel(a, b) { return `${G.fmtCm(G.dist(a, b))} cm · ${Math.round((G.deg(Math.atan2(b.y - a.y, b.x - a.x)) + 360) % 360)}°`; }
}

/* ───────── Auswahl ───────── */
export class SelectTool extends Tool {
  hint() { return 'Klicken: auswählen · Shift: hinzufügen · Ziehen: Rahmen (→ ganz innen, ← berührt) · Griffe ziehen · Doppelklick: Raum öffnen'; }
  down(ev) {
    const app = this.app; const p = ev.world;
    const grip = app.gripAt(ev.sx, ev.sy);
    if (grip) { this.drag = { type: 'grip', grip, start: p, before: this.doc.snapshot() }; return; }
    const hit = app.hitTest(p);
    if (hit) {
      if (ev.shift) { if (app.selection.has(hit.id)) app.selection.delete(hit.id); else app.selection.add(hit.id); }
      else if (!app.selection.has(hit.id)) { app.selection.clear(); app.selection.add(hit.id); }
      app.selChanged();
      this.drag = { type: 'move', start: p, base: app.cursor ? app.cursor.p : p, before: this.doc.snapshot(), moved: false, last: { x: 0, y: 0 } };
      return;
    }
    if (!ev.shift) { app.selection.clear(); app.selChanged(); }
    this.drag = { type: 'box', start: p, cur: p, sx: ev.sx };
  }
  move(ev) {
    const d = this.drag; if (!d) return; const app = this.app;
    if (d.type === 'box') { d.cur = ev.world; d.ex = ev.sx; app.redraw(); return; }
    if (d.type === 'move') {
      if (!d.moved && G.dist(ev.world, d.start) * app.view.tf.s < 5) return;
      if (!d.moved) { d.moved = true; }
      const sp = app.snapAt(ev, d.base, new Set(app.selection));
      const total = G.sub(sp.p, d.base); const delta = G.sub(total, d.last); d.last = total;
      E.transformSelection(this.doc, [...app.selection].filter(id => { const e = this.doc.byId(id); return e && !this.doc.locked(e); }), E.moveFn(delta));
      this.liveOpenings(delta);
      this.doc.emit('live'); app.dyn(`Δ ${G.fmtCm(total.x)} / ${G.fmtCm(total.y)} cm`); return;
    }
    if (d.type === 'grip') { app.applyGrip(d.grip, ev, d); this.doc.emit('live'); }
  }
  liveOpenings(delta) {
    // Öffnungen einzeln verschoben → entlang Wand
    for (const id of this.app.selection) {
      const o = this.doc.byId(id); if (!o || o.type !== 'opening') continue; const w = this.doc.byId(o.wall); if (!w || this.app.selection.has(w.id)) continue;
      const u = G.norm(G.sub(w.b, w.a)); const L = G.dist(w.a, w.b); o.pos = Math.max(o.width / 2, Math.min(L - o.width / 2, o.pos + G.dot(delta, u)));
    }
  }
  up(ev) {
    const d = this.drag; this.drag = null; const app = this.app; if (!d) return;
    if (d.type === 'box') {
      const a = d.start, b = d.cur; if (G.dist(a, b) * app.view.tf.s < 4) { app.redraw(); return; }
      const bb = { x0: Math.min(a.x, b.x), y0: Math.min(a.y, b.y), x1: Math.max(a.x, b.x), y1: Math.max(a.y, b.y) };
      const crossing = (d.ex ?? d.sx) < d.sx;
      for (const e of app.selectable()) { const eb = app.elementBBox(e); if (!eb) continue; const inside = eb.x0 >= bb.x0 && eb.x1 <= bb.x1 && eb.y0 >= bb.y0 && eb.y1 <= bb.y1; const touch = eb.x1 >= bb.x0 && eb.x0 <= bb.x1 && eb.y1 >= bb.y0 && eb.y0 <= bb.y1; if (inside || (crossing && touch)) app.selection.add(e.id); }
      app.selChanged(); app.redraw(); return;
    }
    if ((d.type === 'move' && d.moved) || d.type === 'grip') app.commitLive(d.before, d.type === 'grip' ? 'Griff verschoben' : 'Verschoben');
    app.dyn(null);
  }
  dbl(ev) { const hit = this.app.hitTest(ev.world); if (hit && hit.type === 'room') this.app.openTiles(hit.id); else if (hit && hit.type === 'text') this.app.editText(hit); else if (hit) this.app.sideTab('props'); }
  key(e) {
    if (e.key === 'Delete' || e.key === 'Backspace') { if (this.app.selection.size) { this.app.deleteSelection(); return true; } }
    return false;
  }
  draw(P) {
    const d = this.drag; if (!d || d.type !== 'box') return;
    const a = d.start, b = d.cur; const crossing = (d.ex ?? d.sx) < d.sx;
    const pts = [a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }];
    P.fill([pts], crossing ? '#22c55e' : '#3b82f6', 0.08, { color: crossing ? '#16a34a' : '#2563eb', w: 0.2, dash: crossing ? [2, 1] : null });
  }
}

/* ───────── Wand ───────── */
export class WallTool extends Tool {
  constructor(app, opt) { super(app, opt); this.mode = opt.mode || 'kette'; this.chain = []; this.closed = false; }
  hint() { return this.mode === 'rechteck' ? 'Erste Ecke klicken, dann gegenüberliegende Ecke · Maß tippen: Breite;Tiefe (z. B. 3510;2800)' : 'Startpunkt klicken, weitere Punkte klicken · Länge tippen + Enter · Rechtsklick/Esc beendet · Startpunkt anklicken schließt'; }
  options() {
    const S = this.S;
    return [
      { label: 'Modus', type: 'seg', values: [['kette', 'Wandzug'], ['rechteck', 'Raum (Rechteck)']], get: () => this.mode, set: v => { this.mode = v; this.cancel(); this.app.refreshOpt(); } },
      { label: 'Stärke', type: 'combo', anzeige: 'cm', chips: S.wandArt === 'aussen' ? [240, 300, 365, 425, 490] : [100, 115, 175, 240, 300], values: [[50, '5 (Vorsatzschale)'], [75, '7,5 (Trockenbau CW 50)'], [100, '10 (Trockenbau CW 75 / Porenbeton)'], [115, '11,5 (Innenwand)'], [125, '12,5 (Trockenbau CW 100)'], [150, '15 (Trockenbau / KS)'], [175, '17,5 (tragende Innenwand)'], [200, '20 (Beton / KS)'], [240, '24 (tragend / Außenwand)'], [250, '25 (Beton)'], [300, '30 (Außenwand)'], [365, '36,5 (Außenwand)'], [425, '42,5 (Außenwand)'], [490, '49 (Außenwand)']], unit: 'mm', get: () => S.wandStaerke, set: v => { S.wandStaerke = +v; this.app.redraw(); } },
      { label: 'Höhe', type: 'num', unit: 'mm', placeholder: 'Geschoss', get: () => S.wandHoehe || '', set: v => { S.wandHoehe = v ? +v : null; } },
      this.mode === 'rechteck'
        ? { label: 'Maß ist', type: 'seg', values: [['innen', 'Innenmaß'], ['mitte', 'Achse'], ['aussen', 'Außenmaß']], get: () => S.rechteckBezug || 'innen', set: v => { S.rechteckBezug = v; this.app.redraw(); } }
        : { label: 'Bezugslinie', type: 'seg', values: [['links', 'Links'], ['mitte', 'Mitte'], ['rechts', 'Rechts']], get: () => S.wandBezug, set: v => { S.wandBezug = v; this.app.redraw(); } },
      ...(this.mode === 'kette' && S.abstandAn ? [{ label: 'Abstand bis', type: 'seg', values: [['kante', 'Wandkante'], ['achse', 'Bezugslinie']], get: () => S.abstandBezug || 'kante', set: v => { S.abstandBezug = v; } }] : []),
      { label: 'Art', type: 'seg', values: [['aussen', 'Außenwand'], ['innen', 'Innenwand']], get: () => S.wandArt, set: v => { S.wandArt = v; if (v === 'innen' && S.wandStaerke > 300) S.wandStaerke = 115; if (v === 'aussen' && S.wandStaerke < 175) S.wandStaerke = 365; this.app.refreshOpt(); } },
      { label: 'Material', type: 'sel', values: WAND_MATERIAL, get: () => S.wandMaterial || 'mauerwerk', set: v => { S.wandMaterial = v; if (v === 'trockenbau' && S.wandStaerke > 150) { S.wandStaerke = 100; this.app.refreshOpt(); } } },
      { label: 'Aufbau', type: 'sel', values: [['', 'einschalig'], ...AB.AUFBAUTEN.filter(a => a.art === (S.wandArt || 'aussen')).map(a => [a.id, `${a.name} – ${G.fmtCm(AB.summe(a.schichten))}`])], get: () => S.wandAufbau || '', set: v => { S.wandAufbau = v || null; const a = AB.aufbauById(v); if (a) { S.wandStaerke = AB.summe(a.schichten); S.wandMaterial = AB.hauptMaterial(a.schichten); } this.app.refreshOpt(); } }
    ];
  }
  newWall(a, b) {
    const S = this.S;
    const w = this.doc.add({ type: 'wall', a: G.clone(a), b: G.clone(b), thickness: S.wandStaerke, height: S.wandHoehe || null, art: S.wandArt, material: S.wandMaterial || 'mauerwerk', facade: S.wandArt === 'aussen' ? (S.stdFassade || 'putz-scheibenputz') : null, facadeColor: null });
    const ab = AB.aufbauById(S.wandAufbau); if (ab && AB.summe(ab.schichten) === S.wandStaerke) { w.aufbau = ab.id; w.schichten = ab.schichten.map(x => x.slice()); }
    return w;
  }
  refOff() { const S = this.S; return S.wandBezug === 'links' ? -S.wandStaerke / 2 : S.wandBezug === 'rechts' ? S.wandStaerke / 2 : 0; }
  rebuildChain() {
    const off = this.refOff();
    const c = off ? E.offsetPolyline(this.pts, off, this.closed) : this.pts;
    this.chain.forEach((id, i) => { const w = this.doc.byId(id); if (!w) return; w.a = G.clone(c[i]); w.b = G.clone(c[(i + 1) % c.length]); });
  }
  down(ev) {
    if (ev.button === 2) { this.finish(); return; }
    const p = this.app.cursor.p;
    if (this.mode === 'rechteck') {
      if (!this.pts.length) { this.pts = [p]; return; }
      this.makeRect(this.pts[0], p); return;
    }
    this.addPoint(p);
  }
  addPoint(p) {
    if (!this.pts.length) { this.pts = [G.clone(p)]; this.app.redraw(); return; }
    const last = this.pts[this.pts.length - 1]; if (G.dist(last, p) < 5) return;
    const closing = this.pts.length >= 3 && G.dist(p, this.pts[0]) < 2;
    this.doc.change('Wand', () => {
      if (closing) { this.closed = true; this.chain.push(this.newWall(last, this.pts[0]).id); this.rebuildChain(); }
      else {
        this.pts.push(G.clone(p)); this.chain.push(this.newWall(last, p).id);
        if (this.chain.length === 1 && this.app.abPending) { const sh = this.app.abstandShift(this, p); if (G.len(sh) > 0.01) { this.pts[0] = G.add(this.pts[0], sh); this.pts[1] = G.add(this.pts[1], sh); } this.app.abPending = null; }
        this.rebuildChain();
      }
    });
    if (closing) this.reset();
  }
  makeRect(a, b) {
    if (Math.abs(a.x - b.x) < 10 || Math.abs(a.y - b.y) < 10) return;
    this.doc.change('Raum aus Wänden', () => { for (const [p, q] of E.rectWalls(a, b, this.S.wandStaerke, this.S.rechteckBezug || 'innen')) this.newWall(p, q); });
    this.pts = []; this.app.toast(`Raum ${G.fmtCm(Math.abs(b.x - a.x))} × ${G.fmtCm(Math.abs(b.y - a.y))} cm angelegt`);
    this.app.autoRooms();
  }
  reset() { this.pts = []; this.chain = []; this.closed = false; if (this.app.abPending) this.app.abPending = null; this.app.redraw(); this.app.autoRooms(); }
  finish() { this.reset(); }
  cancel() { if (this.pts.length) { this.reset(); return true; } return false; }
  key(e) { if (e.key === 'Backspace' && this.pts.length > 1 && this.mode === 'kette') { this.doc.undo(); this.pts.pop(); this.chain.pop(); this.app.redraw(); return true; } return false; }
  enter(txt) {
    if (this.mode === 'rechteck') {
      const m = txt.split(/[;x×*]/i).map(s => G.parseLen(s, 'mm'));
      if (m.length === 2 && m.every(isFinite)) { const a = this.pts[0] || this.app.cursor.p; this.makeRect(a, { x: a.x + m[0], y: a.y + m[1] }); return true; }
      return false;
    }
    const p = this.typedPoint(txt); if (!p) return false; if (!this.pts.length) { this.pts = [p]; return true; } this.addPoint(p); return true;
  }
  draw(P) {
    const cur = this.app.cursor; if (!cur) return; const S = this.S; const t = S.wandStaerke;
    if (this.mode === 'rechteck') {
      if (!this.pts.length) return; const a = this.pts[0], b = cur.p;
      for (const [p, q] of E.rectWalls(a, b, t, S.rechteckBezug || 'innen')) P.fill([G.stripPoly(p, q, t / 2)], '#93c5fd', 0.5, { color: SEL, w: 0.18 });
      P.polyline([a, { x: b.x, y: a.y }, b, { x: a.x, y: b.y }], { color: '#dc2626', w: 0.18, dash: [2, 1] }, true);
      this.app.dyn(`${G.fmtCm(Math.abs(b.x - a.x))} × ${G.fmtCm(Math.abs(b.y - a.y))} cm (${S.rechteckBezug === 'mitte' ? 'Achse' : S.rechteckBezug === 'aussen' ? 'außen' : 'innen'})`);
      return;
    }
    if (!this.pts.length) return;
    const sh = this.app.abstandShift ? this.app.abstandShift(this, cur.p) : { x: 0, y: 0 };
    const a = G.add(this.pts[this.pts.length - 1], sh), b = G.add(cur.p, sh);
    const off = this.refOff(); const c = E.offsetPolyline([a, b], off);
    P.fill([G.stripPoly(c[0], c[1], t / 2)], '#93c5fd', 0.55, { color: SEL, w: 0.18 });
    P.line(a, b, { color: '#dc2626', w: 0.18, dash: [2, 1] });
    this.app.dyn(this.lenLabel(a, b));
  }
}

/* ───────── Raum ───────── */
export class RoomTool extends Tool {
  hint() { return 'In einen von Wänden umschlossenen Bereich klicken → Raum mit Fläche, Umfang und Fliesenplanung'; }
  options() { return [{ label: 'Bezeichnung', type: 'text', get: () => this.S.raumName || t('Bad'), set: v => { this.S.raumName = v; } }, { label: 'Raum-Nr.', type: 'text', get: () => this.S.raumNr || '', set: v => { this.S.raumNr = v; } }]; }
  down(ev) {
    const p = ev.world; const geo = W.storeyGeometry(this.doc, this.doc.p.activeStorey);
    const poly = W.roomAt(geo, p);
    if (!poly) { this.app.toast('Kein geschlossener Bereich gefunden – Wände müssen den Raum vollständig umschließen.', true); return; }
    const exist = this.doc.all('room', this.doc.p.activeStorey).find(r => r.poly && G.pointInPoly(p, r.poly));
    if (exist) { this.app.select([exist.id]); return; }
    const nr = this.S.raumNr || String(this.doc.all('room').length + 1).padStart(2, '0');
    const r = this.doc.change('Raum', () => this.doc.add({ type: 'room', seed: G.clone(p), poly, name: this.S.raumName || t('Raum'), nr, height: null, showDims: true, tiles: null }));
    if (this.S.raumNr) { const n = parseInt(this.S.raumNr, 10); if (isFinite(n)) this.S.raumNr = String(n + 1).padStart(this.S.raumNr.length, '0'); }
    this.app.select([r.id]); this.app.toast(`Raum ${r.nr} „${r.name}“: ${(G.polyArea(poly) / 1e6).toFixed(2).replace('.', ',')} m²`);
  }
}

/* ───────── Tür / Fenster / Öffnung ───────── */
export class OpeningTool extends Tool {
  constructor(app, opt) { super(app, opt); this.kind = opt.kind || 'door'; this.hover = null; }
  hint() { return this.kind === 'window' ? 'Fenster: Vorlage oder Typ und Maße wählen · über die Wand fahren und klicken · Abstand vom Wandanfang tippen + Enter setzt exakt' : this.kind === 'door' ? 'Tür: Art und DIN-Maß wählen · über die Wand fahren – Seite des Mauszeigers = Aufschlag · Leertaste: DIN links/rechts' : 'Durchgang: Breite und Höhe wählen, auf die Wand klicken'; }
  options() {
    const S = this.S; const k = this.kind; const app = this.app;
    const o = [{ label: 'Bauteil', type: 'seg', values: [['door', 'Tür'], ['window', 'Fenster'], ['opening', 'Durchgang']], get: () => this.kind, set: v => { this.kind = v; app.refreshOpt(); app.refreshHint(); } }];
    if (k === 'window') {
      o.push(
        { label: 'Vorlage', type: 'sel', values: [['', '– frei –'], ...K.FENSTER_VORLAGEN.map(v => [v.id, v.name])], get: () => S.fensterVorlage || '', set: v => { S.fensterVorlage = v; const t = K.FENSTER_VORLAGEN.find(x => x.id === v); if (t) { S.fensterTyp = t.typ; S.fensterBreite = t.w; S.fensterHoehe = t.h; S.bruestung = t.brh; if (t.glas) S.fensterGlas = t.glas; } app.refreshOpt(); } },
        { label: 'Typ', type: 'sel', values: K.FENSTER_TYPEN, get: () => S.fensterTyp || 'dk1', set: v => { S.fensterTyp = v; S.fensterVorlage = ''; if (K.istBodentief(v)) { S.bruestung = 0; if (S.fensterHoehe < 2000) S.fensterHoehe = 2135; } if (v === 'hs' && S.fensterBreite < 2000) S.fensterBreite = 3010; app.refreshOpt(); } },
        { label: 'Breite', type: 'combo', anzeige: 'cm', unit: 'mm', values: K.FENSTER_BREITEN.map(v => [v, String(v / 10).replace('.', ',')]), get: () => S.fensterBreite, set: v => { S.fensterBreite = +v; S.fensterVorlage = ''; } },
        { label: 'Höhe', type: 'combo', anzeige: 'cm', unit: 'mm', values: K.FENSTER_HOEHEN.map(v => [v, String(v / 10).replace('.', ',')]), get: () => S.fensterHoehe, set: v => { S.fensterHoehe = +v; S.fensterVorlage = ''; } },
        { label: 'Brüstung', type: 'combo', anzeige: 'cm', unit: 'mm', values: K.BRUESTUNGEN, get: () => S.bruestung, set: v => { S.bruestung = +v; S.fensterVorlage = ''; } },
        { label: 'Sprossen', type: 'sel', values: K.SPROSSEN_ART, get: () => S.fensterSprossen || 'keine', set: v => { S.fensterSprossen = v; app.refreshOpt(); } },
        { label: 'Farbe außen', type: 'sel', values: K.FENSTER_FARBEN, get: () => S.fensterFarbeA || '#383e42', set: v => { S.fensterFarbeA = v; } },
        { type: 'btn', label: 'Ausführung …', title: 'Material, Farbe innen, Glas, Sprossenbild, Rollladen/Klappläden, Fensterbänke, Ober-/Unterlicht', onclick: () => B.vorgabenDialog(app, 'window') });
    } else if (k === 'door') {
      const art = S.tuerArt || 'dreh1';
      o.push(
        { label: 'Art', type: 'sel', values: K.TUER_ARTEN, get: () => art, set: v => { S.tuerArt = v; const bl = K.tuerBreitenListe(v), hl = K.tuerHoehenListe(v); if (!bl.some(x => x[0] === S.tuerBreite)) S.tuerBreite = (bl.find(x => x[0] >= 885) || bl[0])[0]; if (!hl.some(x => x[0] === S.tuerHoehe)) S.tuerHoehe = (hl.find(x => x[0] >= 2130) || hl[0])[0]; app.refreshOpt(); } },
        { label: 'Breite (Rohbau)', type: 'combo', anzeige: 'cm', chips: (art || 'dreh1') === 'dreh1' ? [635, 760, 885, 1010] : null, unit: 'mm', values: K.tuerBreitenListe(art), get: () => S.tuerBreite, set: v => { S.tuerBreite = +v; app.refreshOpt(); } },
        { label: 'Höhe (Rohbau)', type: 'combo', anzeige: 'cm', unit: 'mm', values: K.tuerHoehenListe(art), get: () => S.tuerHoehe, set: v => { S.tuerHoehe = +v; app.refreshOpt(); } });
      if (!/^schiebe|garagentor|falt/.test(art)) o.push({ label: 'Anschlag', type: 'seg', values: [['links', 'DIN links'], ['rechts', 'DIN rechts']], get: () => S.tuerAnschlag || 'links', set: v => S.tuerAnschlag = v });
      o.push({ type: 'info', text: () => K.tuerInfo(S.tuerBreite, S.tuerHoehe, art).map(([a, b]) => `${a}: ${b}`).join(' · ') },
        { type: 'btn', label: 'Ausführung …', title: 'Zarge, Türblatt, Farbe, Schwelle, Brandschutz', onclick: () => B.vorgabenDialog(app, 'door') });
    } else {
      o.push(
        { label: 'Form', type: 'sel', values: B.FELDER.opening[0].values, get: () => S.durchgangForm || 'rechteck', set: v => S.durchgangForm = v },
        { label: 'Breite', type: 'combo', anzeige: 'cm', unit: 'mm', values: [635, 760, 885, 1010, 1135, 1260, 1510, 1760, 2010, 2510, 3010].map(v => [v, String(v / 10).replace('.', ',')]), get: () => S.durchgangBreite || 1010, set: v => S.durchgangBreite = +v },
        { label: 'Höhe', type: 'combo', anzeige: 'cm', unit: 'mm', values: [2005, 2130, 2255, 2380, 2505].map(v => [v, String(v / 10).replace('.', ',')]), get: () => S.durchgangHoehe || 2130, set: v => S.durchgangHoehe = +v });
    }
    return o;
  }
  width() { const S = this.S; return this.kind === 'window' ? S.fensterBreite : this.kind === 'door' ? S.tuerBreite : (S.durchgangBreite || 1010); }
  find(p) {
    const geo = W.storeyGeometry(this.doc, this.doc.p.activeStorey); let best = null;
    for (const g of geo.wg.values()) { const c = G.closestOnSeg(p, g.a, g.b); if (c.d < g.w.thickness / 2 + 250 / Math.max(0.05, this.app.view.tf.s * 4) && (!best || c.d < best.d)) best = { g, c, d: c.d }; }
    if (!best) return null; const g = best.g;
    const width = this.width();
    let pos = Math.round(best.c.t * g.len / 5) * 5; pos = Math.max(width / 2, Math.min(g.len - width / 2, pos));
    const side = G.dot(G.sub(this.app.cursor.raw, best.c.p), g.n) >= 0 ? 1 : -1;
    return { g, pos, width, side };
  }
  move(ev) { this.hover = this.find(ev.world); }
  key(e) { if (e.key === ' ' && this.kind === 'door') { this.S.tuerAnschlag = this.S.tuerAnschlag === 'rechts' ? 'links' : 'rechts'; this.app.refreshOpt(); this.app.redraw(); return true; } return false; }
  build(h) {
    const S = this.S; const k = this.kind;
    const geo = W.storeyGeometry(this.doc, this.doc.p.activeStorey); const os = W.outsideSide(geo, h.g);
    const o = { type: 'opening', wall: h.g.w.id, kind: k, pos: h.pos, width: h.width, side: h.side, hinge: S.tuerAnschlag || 'links', storey: h.g.w.storey, ...B.vorgaben(S, k) };
    if (os === 'L' || os === 'R') o.aussen = os;
    if (k === 'window') { o.typ = S.fensterTyp || 'dk1'; o.height = S.fensterHoehe; o.sill = S.bruestung; if (S.stdFenster) o.stil = S.stdFenster; }
    else if (k === 'door') { o.art = S.tuerArt || 'dreh1'; o.height = S.tuerHoehe; o.sill = 0; if (os && /haustuer|nebeneingang/.test(o.art)) o.stil = S.stdHaustuer || 'tuer-hoermann-700b'; }
    else { o.height = o.form === 'raumhoch' ? (this.doc.storey.roomHeight || 2500) : (S.durchgangHoehe || 2130); o.sill = 0; }
    return o;
  }
  down(ev) {
    const h = this.find(ev.world); if (!h) { this.app.toast('Bitte auf eine Wand klicken.', true); return; }
    this.doc.change(this.kind === 'window' ? 'Fenster' : this.kind === 'door' ? 'Tür' : 'Durchgang', () => this.doc.add(this.build(h)));
  }
  draw(P) {
    const h = this.hover; if (!h) return; const g = h.g; const t = g.w.thickness;
    const c0 = G.add(g.a, G.mul(g.u, h.pos - h.width / 2)), c1 = G.add(g.a, G.mul(g.u, h.pos + h.width / 2));
    P.fill([G.stripPoly(c0, c1, t / 2 + 20)], '#2563eb', 0.35, { color: SEL, w: 0.25 });
    if (this.kind === 'door') { const hp = this.S.tuerAnschlag === 'rechts' ? c1 : c0; const face = G.add(hp, G.mul(g.n, h.side * t / 2)); P.line(face, G.add(face, G.mul(g.n, h.side * h.width)), { color: SEL, w: 0.35 }); }
    const d0 = h.pos - h.width / 2, d1 = g.len - h.pos - h.width / 2;
    this.app.dyn(`← ${G.fmtCm(d0)} | ${G.fmtCm(h.width)} | ${G.fmtCm(d1)} → cm (Achse)`);
  }
  enter(txt) { // Abstand vom Wandanfang tippen
    const v = G.parseLen(txt, 'mm'); const h = this.hover; if (!h || !isFinite(v)) return false;
    h.pos = Math.max(h.width / 2, Math.min(h.g.len - h.width / 2, v + h.width / 2)); this.doc.change('Öffnung', () => this.doc.add(this.build(h))); return true;
  }
}

/* ───────── Zeichnen ───────── */
export class LineTool extends Tool {
  constructor(app, opt) { super(app, opt); this.kind = opt.kind || 'line'; }
  hint() { return { line: 'Linie: Punkte klicken, Länge tippen · Esc beendet', poly: 'Polylinie: Punkte klicken · Enter/Doppelklick beendet · Startpunkt schließt', rect: 'Rechteck: zwei Ecken klicken oder Breite;Höhe tippen', circle: 'Kreis: Mittelpunkt, dann Radius', guide: 'Hilfslinie: zwei Punkte (unendlich lang)', joint: 'Bewegungsfuge: Punkte klicken, Enter beendet', tilezone: 'Fliesenfläche: Umriss klicken, Enter schließt', boundary: 'Grundstücksgrenze: Eckpunkte klicken, Enter schließt', neighbor: 'Nachbargebäude: Umriss klicken, Enter schließt', measure: 'Messen: Punkte klicken – Länge, Summe und Fläche · Esc neu' }[this.kind]; }
  down(ev) {
    if (ev.button === 2) { this.finish(); return; }
    const p = this.app.cursor.p; this.add(p);
  }
  add(p) {
    const k = this.kind; const doc = this.doc;
    if (k === 'line') { if (!this.pts.length) { this.pts = [p]; return; } const a = this.from(); doc.change('Linie', () => doc.add({ type: 'line', a: G.clone(a), b: G.clone(p) })); this.pts = [p]; return; }
    if (k === 'guide') { if (!this.pts.length) { this.pts = [p]; return; } doc.change('Hilfslinie', () => doc.add({ type: 'guide', a: G.clone(this.pts[0]), b: G.clone(p) })); this.pts = []; return; }
    if (k === 'rect') { if (!this.pts.length) { this.pts = [p]; return; } const a = this.pts[0]; doc.change('Rechteck', () => doc.add({ type: 'poly', closed: true, pts: [a, { x: p.x, y: a.y }, p, { x: a.x, y: p.y }].map(G.clone) })); this.pts = []; return; }
    if (k === 'circle') { if (!this.pts.length) { this.pts = [p]; return; } doc.change('Kreis', () => doc.add({ type: 'circle', c: G.clone(this.pts[0]), r: G.dist(this.pts[0], p) })); this.pts = []; return; }
    if (this.pts.length >= 3 && G.dist(p, this.pts[0]) < 2 && k !== 'joint' && k !== 'measure') { this.finish(true); return; }
    this.pts.push(G.clone(p)); this.app.redraw();
  }
  async finish(close = false) {
    const k = this.kind; const pts = this.pts; this.pts = [];
    if (k === 'measure') { this.app.redraw(); return; }
    if (pts.length < 2) { this.app.redraw(); return; }
    const doc = this.doc;
    if (k === 'poly') doc.change('Polylinie', () => doc.add({ type: 'poly', pts, closed: close }));
    if (k === 'joint') doc.change('Bewegungsfuge', () => doc.add({ type: 'joint', pts }));
    if (k === 'tilezone' && pts.length >= 3) { const z = doc.change('Fliesenfläche', () => doc.add({ type: 'tilezone', poly: G.ensureCCW(pts), tiles: defaultTileCfg({ aktiv: true, name: 'Fliesenfläche' }) })); this.app.select([z.id]); }
    if (k === 'boundary' && pts.length >= 3) doc.change('Grundstücksgrenze', () => { doc.p.site.grenze = G.ensureCCW(pts); });
    if (k === 'neighbor' && pts.length >= 3) {
      const r = await this.app.prompt('Nachbargebäude', [{ key: 'name', label: 'Bezeichnung', value: 'Nachbarhaus' }, { key: 'hoehe', label: 'Höhe bis First (m)', value: '8,5' }, { key: 'dach', label: 'Dachform', type: 'sel', values: [['sattel', 'Satteldach'], ['flach', 'Flachdach'], ['walm', 'Walmdach']], value: 'sattel' }]);
      if (r) doc.change('Nachbargebäude', () => doc.p.site.nachbarn.push({ id: uid('n'), poly: G.ensureCCW(pts), name: r.name, hoehe: G.parseLen(r.hoehe, 'm') || 8500, dach: r.dach }));
    }
    this.app.redraw();
  }
  enter(txt) {
    if (txt === '' && this.pts.length) { this.finish(this.kind === 'tilezone' || this.kind === 'boundary' || this.kind === 'neighbor'); return true; }
    if (this.kind === 'rect' && this.pts.length) { const m = txt.split(/[;x×*]/i).map(s => G.parseLen(s, 'mm')); if (m.length === 2 && m.every(isFinite)) { const a = this.pts[0]; this.add({ x: a.x + m[0], y: a.y + m[1] }); return true; } }
    if (this.kind === 'circle' && this.pts.length) { const r = G.parseLen(txt, 'mm'); if (isFinite(r)) { this.add(G.add(this.pts[0], { x: r, y: 0 })); return true; } }
    const p = this.typedPoint(txt); if (!p) return false; this.add(p); return true;
  }
  dbl() { if (['poly', 'joint', 'tilezone', 'boundary', 'neighbor'].includes(this.kind)) this.finish(this.kind !== 'poly' && this.kind !== 'joint'); }
  draw(P) {
    const cur = this.app.cursor; if (!cur) return; const k = this.kind;
    if (!this.pts.length) return; const a = this.from(), b = cur.p;
    if (k === 'rect') { const s = this.pts[0]; P.polyline([s, { x: b.x, y: s.y }, b, { x: s.x, y: b.y }], PREV, true); this.app.dyn(`${G.fmtCm(Math.abs(b.x - s.x))} × ${G.fmtCm(Math.abs(b.y - s.y))} cm`); return; }
    if (k === 'circle') { P.circle(this.pts[0], G.dist(this.pts[0], b), PREV); this.app.dyn(`r = ${G.fmtCm(G.dist(this.pts[0], b))} cm`); return; }
    if (k === 'guide') { const d = G.norm(G.sub(b, a)); P.line(G.sub(a, G.mul(d, 1e5)), G.add(a, G.mul(d, 1e5)), { color: '#d0427f', w: 0.13, dash: [3, 1.5] }); return; }
    const all = [...this.pts, b]; P.polyline(all, k === 'joint' ? { color: '#e11d48', w: 0.35, dash: [3, 1, 0.6, 1] } : PREV);
    if (k === 'measure' || k === 'tilezone' || k === 'boundary' || k === 'neighbor') {
      let L = 0; for (let i = 1; i < all.length; i++) L += G.dist(all[i - 1], all[i]);
      const A = all.length >= 3 ? G.polyArea(all) / 1e6 : 0;
      if (all.length >= 3) P.fill([all], '#2563eb', 0.08);
      this.app.dyn(`${G.fmtCm(G.dist(a, b))} cm · Σ ${(L / 1000).toFixed(3).replace('.', ',')} m${A ? ` · Fläche ${A.toFixed(2).replace('.', ',')} m²` : ''}`);
    } else this.app.dyn(this.lenLabel(a, b));
  }
}

/* ───────── Einzelpunkt-Werkzeuge ───────── */
export class PlaceTool extends Tool {
  constructor(app, opt) { super(app, opt); this.kind = opt.kind; this.rot = 0; }
  hint() { return { symbol: 'Objekt setzen · R oder Leertaste: um 90° drehen · Nahe einer Wand richtet es sich automatisch aus', text: 'Klicken, dann Text eingeben', column: 'Stütze/Pfeiler setzen', level: 'Höhenkote setzen', heightpt: 'Höhenpunkt setzen – danach Höhe ü. NN eingeben (z. B. 312,45)', stair: 'Treppe: Antritt (Ecke unten) klicken, dann Laufrichtung klicken – Länge automatisch nach DIN 18065 oder mit der Maus' }[this.kind] || ''; }
  options() {
    const S = this.S;
    if (this.kind === 'symbol') {
      if (this.app.mode === 'lageplan' && (!SYMBOLE[S.symbolArt] || SYMBOLE[S.symbolArt].kat !== 'aussen')) { S.symbolArt = 'baum'; S.symbolW = S.symbolD = 3000; }
      const art = S.symbolArt && SYMBOLE[S.symbolArt] ? S.symbolArt : 'wc'; const kat = SYMBOLE[art].kat; const d = SYMBOLE[art]; const app = this.app;
      const setArt = (v) => { S.symbolArt = v; const x = SYMBOLE[v]; S.symbolW = x.w; S.symbolD = x.d; app.refreshOpt(); };
      return [
        { label: 'Gruppe', type: 'sel', values: SYMBOL_KATEGORIEN, get: () => kat, set: v => setArt(symboleIn(v)[0][0]) },
        { label: 'Objekt', type: 'sel', values: symboleIn(kat).map(([k, v]) => [k, v.name]), get: () => art, set: v => setArt(v) },
        d.g ? { label: 'Größe', type: 'sel', values: [['', '– frei –'], ...d.g.map(([w, dd, l]) => [w + 'x' + dd, `${l} (${w / 10} × ${dd / 10} cm)`])], get: () => (S.symbolW || d.w) + 'x' + (S.symbolD || d.d), set: v => { if (!v) return; const [w, dd] = v.split('x').map(Number); S.symbolW = w; S.symbolD = dd; app.refreshOpt(); } } : null,
        { label: 'Breite', type: 'num', unit: 'mm', get: () => S.symbolW || d.w, set: v => S.symbolW = +v },
        { label: 'Tiefe', type: 'num', unit: 'mm', get: () => S.symbolD || d.d, set: v => S.symbolD = +v },
        { label: 'Drehung', type: 'num', unit: '°', get: () => this.rot, set: v => this.rot = +v }].filter(Boolean);
    }
    if (this.kind === 'column') return [
      { label: 'Vorlage', type: 'sel', values: [['', '– frei –'], ['240x240', 'Mauerwerk 24 × 24'], ['300x300', 'Beton 30 × 30'], ['365x365', 'Mauerwerk 36,5 × 36,5'], ['400x400', 'Beton 40 × 40'], ['240x490', 'Pfeiler 24 × 49'], ['r300', 'Beton rund Ø 30'], ['r400', 'Beton rund Ø 40'], ['160x160', 'Stahl HEB 160'], ['200x200', 'Stahl HEB 200'], ['140x140', 'Holz 14 × 14'], ['160x160h', 'Holz 16 × 16']], get: () => S.stuetzeVorlage || '', set: v => { S.stuetzeVorlage = v; if (!v) return; if (v[0] === 'r') { S.stuetzeRund = true; S.stuetzeB = S.stuetzeT = +v.slice(1); } else { S.stuetzeRund = false; const [b, t] = v.replace('h', '').split('x').map(Number); S.stuetzeB = b; S.stuetzeT = t; } this.app.refreshOpt(); } },
      { label: 'Breite', type: 'num', unit: 'mm', get: () => S.stuetzeB || 300, set: v => S.stuetzeB = +v }, { label: 'Tiefe', type: 'num', unit: 'mm', get: () => S.stuetzeT || 300, set: v => S.stuetzeT = +v }, { label: 'Rund', type: 'chk', get: () => !!S.stuetzeRund, set: v => S.stuetzeRund = v }];
    if (this.kind === 'stair') {
      const f = S.treppeForm || 'gerade'; const hoehe = this.doc.storey.height || 2750; const app = this.app;
      const o = [
        { label: 'Form', type: 'sel', values: K.TREPPEN_FORMEN, get: () => f, set: v => { S.treppeForm = v; app.refreshOpt(); } },
        f === 'gerade' || f === 'podest_gerade' ? null : { label: 'Drehung', type: 'seg', values: [['links', 'links herum'], ['rechts', 'rechts herum']], get: () => S.treppeDreh || 'links', set: v => S.treppeDreh = v },
        f === 'spindel' || f === 'wendel' ? { label: 'Durchmesser', type: 'combo', anzeige: 'cm', unit: 'mm', values: [1200, 1400, 1600, 1800, 2000, 2200, 2400].map(v => [v, String(v / 10)]), get: () => S.treppeD || 2000, set: v => S.treppeD = +v }
          : { label: 'Laufbreite', type: 'combo', anzeige: 'cm', unit: 'mm', values: K.LAUFBREITEN, get: () => S.treppeB || 1000, set: v => S.treppeB = +v },
        f === 'wendel' ? { label: 'Treppenauge Ø', type: 'num', unit: 'mm', get: () => S.treppeAugeW || 600, set: v => S.treppeAugeW = +v } : null,
        ['halb', 'podest_u', 'zweiviertel'].includes(f) ? { label: 'Treppenauge', type: 'num', unit: 'mm', get: () => S.treppeAuge ?? 150, set: v => S.treppeAuge = +v } : null,
        { label: 'Steigungen', type: 'num', get: () => S.treppeN || T.steigungenFuer(hoehe), set: v => S.treppeN = +v || null },
        { label: 'Länge', type: 'seg', values: [['auto', 'automatisch (DIN)'], ['maus', 'mit der Maus']], get: () => S.treppeLaenge || 'auto', set: v => S.treppeLaenge = v },
        { label: 'Belag', type: 'sel', values: K.TREPPEN_MATERIAL, get: () => S.treppeMat || 'beton', set: v => S.treppeMat = v },
        { type: 'info', text: () => { const n = S.treppeN || T.steigungenFuer(hoehe); const hh = hoehe / n; return `Geschoss ${G.fmtCm(hoehe)} cm → ${n} × ${G.fmtCm(hh)} cm Steigung, Auftritt ca. ${G.fmtCm(Math.min(370, Math.max(230, 630 - 2 * hh)))} cm`; } }
      ];
      return o.filter(Boolean);
    }
    if (this.kind === 'text') return [{ label: 'Schrift (mm Papier)', type: 'num', get: () => S.textGr || 3.5, set: v => S.textGr = +v }];
    return [];
  }
  stairAt(p) {
    const S = this.S; const a = this.pts[0]; if (!a || G.dist(a, p) < 50) return null; const f = S.treppeForm || 'gerade'; const hoehe = this.doc.storey.height || 2750;
    let st = { type: 'stair', p: G.clone(a), rot: G.deg(Math.atan2(p.y - a.y, p.x - a.x)), form: f, dreh: S.treppeDreh || 'links', w: S.treppeB || 1000, steps: S.treppeN || T.steigungenFuer(hoehe), len: G.dist(a, p), auge: f === 'wendel' ? (S.treppeAugeW || 600) : (S.treppeAuge ?? 150), durchmesser: S.treppeD || 2000, material: S.treppeMat || 'beton' };
    if (f === 'spindel' || f === 'wendel') { st.w = st.durchmesser / 2 - st.auge / 2; st.spindel = 160; }
    if ((S.treppeLaenge || 'auto') === 'auto' || f === 'spindel' || f === 'wendel') st = T.autoMasse(st, hoehe);
    else if (['podest_l', 'podest_gerade'].includes(f)) st.len2 = Math.round(st.len * 0.5); else if (['halb', 'podest_u', 'zweiviertel'].includes(f)) st.len2 = st.len;
    return st;
  }
  autoRot(p) {
    if (this.kind !== 'symbol') return this.rot;
    const geo = W.storeyGeometry(this.doc, this.doc.p.activeStorey); const S = this.S; const D = S.symbolD || SYMBOLE[S.symbolArt || 'wc'].d;
    let best = null;
    for (const g of geo.wg.values()) for (const s of [1, -1]) {
      const face0 = G.add(g.a, G.mul(g.n, s * g.w.thickness / 2)); const c = G.closestOnLine(p, face0, G.add(face0, g.u));
      if (c.t < -0.05 || c.t > 1.05) continue;
      const side = G.dot(G.sub(p, c.p), G.mul(g.n, s)); if (side < 0) continue;
      if (c.d < D * 0.9 && (!best || c.d < best.d)) best = { d: c.d, ang: Math.atan2(g.n.y * s, g.n.x * s), foot: c.p, dir: G.mul(g.n, s) };
    }
    if (!best) return { rot: this.rot };
    return { rot: G.deg(best.ang) - 90, p: G.add(best.foot, G.mul(best.dir, D / 2)) };
  }
  async down(ev) {
    const p = this.app.cursor.p; const S = this.S; const doc = this.doc;
    if (this.kind === 'symbol') { const ar = this.autoRot(p); const k = S.symbolArt || 'wc'; const d = SYMBOLE[k]; doc.change('Objekt', () => doc.add({ type: 'symbol', kind: k, p: G.clone(ar.p || p), w: S.symbolW || d.w, d: S.symbolD || d.d, rot: ar.rot ?? this.rot, aussparen: !!d.aussparen })); return; }
    if (this.kind === 'column') { doc.change('Stütze', () => doc.add({ type: 'column', p: G.clone(p), w: S.stuetzeB || 300, d: S.stuetzeT || 300, round: !!S.stuetzeRund, rot: 0 })); return; }
    if (this.kind === 'stair') { if (!this.pts.length) { this.pts = [p]; this.app.refreshHint(); return; } const st = this.stairAt(p); this.pts = []; if (!st) return; doc.change('Treppe', () => doc.add(st)); this.app.toast(`Treppe: ${T.treppe(st).linien.length} Steigungen · Auftritt ${G.fmtCm(T.treppe(st).auftritt)} cm`); return; }
    if (this.kind === 'text') { const r = await this.app.prompt('Text', [{ key: 't', label: 'Text', value: '' }]); if (r && r.t) doc.change('Text', () => doc.add({ type: 'text', p: G.clone(p), text: r.t, size: S.textGr || 3.5 })); return; }
    if (this.kind === 'level') { const r = await this.app.prompt('Höhenkote', [{ key: 'v', label: 'Höhe (m, relativ ±0,00 = OKFF EG)', value: '0,00' }, { key: 'l', label: 'Zusatz (z. B. OKFF, OKRD)', value: 'OKFF' }]); if (r) doc.change('Höhenkote', () => doc.add({ type: 'level', p: G.clone(p), value: Math.round(G.parseLen(r.v, 'm')), label: r.l })); return; }
    if (this.kind === 'heightpt') { const last = doc.p.site.punkte.length ? doc.p.site.punkte[doc.p.site.punkte.length - 1].z : (doc.p.site.nnEG || 0); const r = await this.app.prompt('Höhenpunkt', [{ key: 'z', label: 'Geländehöhe in m ü. NN', value: String(last.toFixed(2)).replace('.', ',') }]); if (r) { const z = parseFloat(String(r.z).replace(',', '.')); if (isFinite(z)) doc.change('Höhenpunkt', () => doc.p.site.punkte.push({ id: uid('h'), x: p.x, y: p.y, z })); } return; }
  }
  key(e) { if ((e.key === 'r' || e.key === 'R' || e.key === ' ') && this.kind === 'symbol') { this.rot = (this.rot + 90) % 360; this.app.refreshOpt(); this.app.redraw(); return true; } return false; }
  draw(P) {
    const cur = this.app.cursor; if (!cur) return; const S = this.S;
    if (this.kind === 'symbol') { const ar = this.autoRot(cur.p); const k = S.symbolArt || 'wc'; const d = SYMBOLE[k]; const s = { type: 'symbol', kind: k, p: ar.p || cur.p, w: S.symbolW || d.w, d: S.symbolD || d.d, rot: ar.rot ?? this.rot }; P.polyline(symbolFootprint(s), PREV, true); this.app.drawSymbolPreview(P, s); }
    if (this.kind === 'stair' && this.pts.length) { const st = this.stairAt(cur.p); if (st) { const g = T.treppe(st); P.fill([g.umriss], '#93c5fd', 0.35, PREV); for (const l of g.linien) P.line(l[0], l[1], { color: '#2563eb', w: 0.13 }); const k = T.kennwerte(st, this.doc.storey.height || 2750); this.app.dyn(`${k.n} STG · ${G.fmtCm(k.h)}/${G.fmtCm(k.a)} cm · 2h+a ${G.fmtCm(k.sm)} ${k.ok ? '✓' : '⚠'}`); } }
    if (this.kind === 'column') P.polyline(columnPoly({ p: cur.p, w: S.stuetzeB || 300, d: S.stuetzeT || 300, round: !!S.stuetzeRund }), PREV, true);
  }
}

/* ───────── Bemaßung ───────── */
export class DimTool extends Tool {
  constructor(app, opt) { super(app, opt); this.mode = opt.mode || 'kette'; this.stage = 'pts'; }
  hint() { return this.mode === 'auto' ? 'Wand anklicken → Außenmaßkette mit Öffnungen · in Raum klicken → Raummaße an/aus' : this.stage === 'off' ? 'Lage der Maßlinie klicken' : 'Punkte nacheinander anklicken (Fang!) · Enter: fertig, dann Lage der Maßkette klicken · Shift: freie Richtung'; }
  options() { return [{ label: 'Modus', type: 'seg', values: [['kette', 'Maßkette'], ['auto', 'Automatisch']], get: () => this.mode, set: v => { this.mode = v; this.cancel(); this.app.refreshOpt(); } }, { label: 'Richtung', type: 'seg', values: [['auto', 'Auto'], ['h', 'waagrecht'], ['v', 'senkrecht'], ['par', 'parallel']], get: () => this.S.massRichtung || 'auto', set: v => this.S.massRichtung = v }, { label: 'Gesamtmaß', type: 'chk', get: () => this.S.massGesamt !== false, set: v => this.S.massGesamt = v }]; }
  dir(cur) {
    const r = this.S.massRichtung || 'auto'; if (r === 'h') return { x: 1, y: 0 }; if (r === 'v') return { x: 0, y: 1 };
    const a = this.pts[0], b = this.pts[this.pts.length - 1]; const d = G.sub(b, a);
    if (r === 'par' || this.pts.length < 2) return G.norm(d);
    // auto: Lage des Mauszeigers bestimmt waagrecht/senkrecht
    if (cur) { const bb = G.bbox(this.pts); if (cur.x > bb.x0 && cur.x < bb.x1 && (cur.y > bb.y1 || cur.y < bb.y0)) return { x: 1, y: 0 }; if (cur.y > bb.y0 && cur.y < bb.y1 && (cur.x > bb.x1 || cur.x < bb.x0)) return { x: 0, y: 1 }; }
    return Math.abs(d.x) >= Math.abs(d.y) ? { x: 1, y: 0 } : { x: 0, y: 1 };
  }
  makeDim(cur) { const dir = this.dir(cur); const n = G.perp(dir); const off = G.dot(G.sub(cur, this.pts[0]), n); return { type: 'dim', pts: this.pts.map(G.clone), dir, off, total: this.S.massGesamt !== false }; }
  down(ev) {
    if (ev.button === 2) { this.enter(''); return; }
    const p = this.app.cursor.p;
    if (this.mode === 'auto') { this.auto(ev.world); return; }
    if (this.stage === 'off') { const d = this.makeDim(p); this.doc.change('Bemaßung', () => this.doc.add(d)); this.pts = []; this.stage = 'pts'; this.app.refreshHint(); return; }
    this.pts.push(G.clone(p)); this.app.redraw();
  }
  enter(txt) { if (this.mode === 'kette' && this.stage === 'pts' && this.pts.length >= 2) { this.stage = 'off'; this.app.refreshHint(); return true; } return false; }
  cancel() { this.stage = 'pts'; return super.cancel(); }
  auto(p) {
    const doc = this.doc; const geo = W.storeyGeometry(doc, doc.p.activeStorey);
    const room = doc.all('room', doc.p.activeStorey).find(r => r.poly && G.pointInPoly(p, r.poly));
    let best = null;
    for (const g of geo.wg.values()) { const c = G.closestOnSeg(p, g.a, g.b); if (c.d < g.w.thickness / 2 + 30 && (!best || c.d < best.d)) best = { g, d: c.d }; }
    if (best) {
      const g = best.g; const os = W.outsideSide(geo, g) || 'L'; const s = os === 'R' ? -1 : 1;
      const face = (q) => G.add(q, G.mul(g.n, s * g.w.thickness / 2));
      const pts = [face(g.aL && s === 1 ? g.aL : g.aR)];
      const pa = s === 1 ? g.aL : g.aR, pb = s === 1 ? g.bL : g.bR;
      const P0 = [pa];
      for (const oi of geo.openings.filter(x => x.g === g).sort((a, b) => a.s0 - b.s0)) P0.push(face(oi.c0), face(oi.c1));
      P0.push(pb);
      const dir = g.u; const off = s * (G.dot(G.sub(pa, g.a), g.n) * s + 900) * 1;
      doc.change('Automatische Bemaßung', () => doc.add({ type: 'dim', pts: P0, dir, off: G.dot(G.sub(G.add(pa, G.mul(g.n, s * 900)), pa), G.perp(dir)), total: true }));
      return;
    }
    if (room) { doc.change('Raummaße', () => { room.showDims = !room.showDims; }); return; }
    this.app.toast('Wand oder Raum anklicken', true);
  }
  draw(P) {
    const cur = this.app.cursor; if (!cur || !this.pts.length) return;
    if (this.stage === 'off') { const d = this.makeDim(cur.p); this.app.drawDimPreview(P, d); return; }
    const all = [...this.pts, cur.p]; for (const q of all) P.circle(q, 4 / this.app.view.tf.s, { color: SEL, w: 0.2 });
    if (all.length >= 2) { const save = this.pts; this.pts = all; const d = this.makeDim(G.add(all[0], G.mul(G.perp(this.dir(cur.p)), 600))); this.pts = save; this.app.drawDimPreview(P, d); }
  }
}

/* ───────── Ändern ───────── */
export class ModifyTool extends Tool {
  constructor(app, opt) { super(app, opt); this.kind = opt.kind; this.copyMode = this.kind === 'copy'; }
  hint() {
    const sel = this.app.selection.size;
    if (!sel && ['move', 'copy', 'rotate', 'mirror'].includes(this.kind)) return 'Erst Elemente anklicken/aufziehen, dann Enter oder Rechtsklick';
    return { move: 'Basispunkt klicken, dann Zielpunkt (oder Abstand tippen)', copy: 'Basispunkt, dann Zielpunkte – mehrfach · Esc beendet', rotate: 'Drehpunkt klicken, dann Winkel tippen (z. B. 90) oder Richtung klicken', mirror: 'Spiegelachse: zwei Punkte klicken', offset: 'Wand/Linie anklicken, Abstand tippen + Enter, Seite klicken', trim: 'Erst Begrenzung anklicken, dann zu verlängernde/kürzende Wände/Linien', join: 'Zwei Wände/Linien anklicken → saubere Ecke', split: 'Wand/Linie an der Teilungsstelle anklicken', erase: 'Elemente anklicken zum Löschen' }[this.kind];
  }
  options() {
    if (this.kind === 'offset') return [{ label: 'Abstand', type: 'num', unit: 'mm', get: () => this.S.versatz || 1000, set: v => this.S.versatz = +v }, { label: 'Wand', type: 'seg', values: [['kopie', 'Parallele Kopie'], ['schieben', 'Wand versetzen']], get: () => this.S.versatzModus || 'schieben', set: v => this.S.versatzModus = v }];
    if (this.kind === 'mirror') return [{ label: 'Original behalten', type: 'chk', get: () => !!this.S.spiegelKopie, set: v => this.S.spiegelKopie = v }];
    if (this.kind === 'rotate') return [{ label: 'Kopie', type: 'chk', get: () => !!this.S.drehKopie, set: v => this.S.drehKopie = v }];
    return [];
  }
  picked() { return [...this.app.selection].filter(id => { const e = this.doc.byId(id); return e && !this.doc.locked(e); }); }
  down(ev) {
    const app = this.app; const p = app.cursor.p; const doc = this.doc;
    if (ev.button === 2) { if (this.pts.length) this.cancel(); else app.setTool('select'); return; }
    if (['move', 'copy', 'rotate', 'mirror'].includes(this.kind) && !this.app.selection.size) { const h = app.hitTest(ev.world); if (h) { app.selection.add(h.id); app.selChanged(); } return; }
    switch (this.kind) {
      case 'move': case 'copy': {
        if (!this.pts.length) { this.pts = [p]; return; }
        const d = G.sub(p, this.pts[0]); this.apply(d); if (this.kind === 'move') { this.pts = []; } return;
      }
      case 'rotate': { if (!this.pts.length) { this.pts = [p]; return; } const a = Math.atan2(p.y - this.pts[0].y, p.x - this.pts[0].x); this.rotate(a); return; }
      case 'mirror': { if (!this.pts.length) { this.pts = [p]; return; } const a = this.pts[0]; this.pts = []; doc.change('Spiegeln', () => { if (this.S.spiegelKopie) { const n = E.copyElements(doc, this.picked(), E.mirrorFn(a, p), 0, true); app.select(n.map(e => e.id)); } else E.transformSelection(doc, this.picked(), E.mirrorFn(a, p), 0, true); }); return; }
      case 'offset': {
        if (!this.target) { const h = app.hitTest(ev.world); if (!h || !['wall', 'line', 'poly'].includes(h.type)) { app.toast('Wand oder Linie anklicken', true); return; } this.target = h; app.select([h.id]); app.refreshHint(); return; }
        this.doOffset(ev.world, this.S.versatz || 1000); return;
      }
      case 'trim': {
        const h = app.hitTest(ev.world); if (!h || !['wall', 'line'].includes(h.type)) return;
        if (!this.bound) { this.bound = h; app.select([h.id]); app.toast('Begrenzung gewählt – jetzt Wände/Linien anklicken'); return; }
        if (h.id === this.bound.id) return; doc.change('Verlängern/Kürzen', () => E.extendTo(h, this.bound.a, this.bound.b, ev.world)); app.autoRooms(); return;
      }
      case 'join': {
        const h = app.hitTest(ev.world); if (!h || !['wall', 'line'].includes(h.type)) return;
        if (!this.first) { this.first = h; app.select([h.id]); return; }
        const a = this.first; this.first = null; doc.change('Ecke verbinden', () => E.joinCorner(a, h)); app.select([]); app.autoRooms(); return;
      }
      case 'split': { const h = app.hitTest(ev.world); if (!h || !['wall', 'line'].includes(h.type)) return; doc.change('Teilen', () => E.splitAt(doc, h, p)); return; }
      case 'erase': { const h = app.hitTest(ev.world); if (h) { doc.change('Löschen', () => doc.remove([h.id])); app.selection.delete(h.id); app.autoRooms(); } return; }
    }
  }
  doOffset(side, dist) {
    const t = this.target; const doc = this.doc; const app = this.app;
    if (t.type === 'wall' || t.type === 'line') {
      const n = G.perp(G.norm(G.sub(t.b, t.a))); const s = G.dot(G.sub(side, t.a), n) >= 0 ? 1 : -1;
      if (t.type === 'wall' && (this.S.versatzModus || 'schieben') === 'schieben') doc.change('Wand versetzen', () => E.shiftWall(doc, t, s * dist));
      else doc.change('Parallele', () => { const c = JSON.parse(JSON.stringify(t)); c.id = uid(t.type[0]); c.a = G.add(t.a, G.mul(n, s * dist)); c.b = G.add(t.b, G.mul(n, s * dist)); doc.add(c); });
    } else if (t.type === 'poly') {
      const pts = E.offsetPolyline(t.pts, dist, t.closed); const pts2 = E.offsetPolyline(t.pts, -dist, t.closed);
      const pick = G.dist(G.polyCentroid(pts), side) < G.dist(G.polyCentroid(pts2), side) ? pts : pts2;
      doc.change('Versatz', () => doc.add({ type: 'poly', pts: pick, closed: t.closed }));
    }
    this.target = null; app.autoRooms(); app.refreshHint();
  }
  apply(d) {
    const doc = this.doc; const ids = this.picked();
    if (this.kind === 'copy') { doc.change('Kopieren', () => E.copyElements(doc, ids, E.moveFn(d))); }
    else doc.change('Verschieben', () => E.transformSelection(doc, ids, E.moveFn(d)));
    this.app.autoRooms();
  }
  rotate(a) {
    const c = this.pts[0]; this.pts = []; const doc = this.doc;
    doc.change('Drehen', () => { if (this.S.drehKopie) E.copyElements(doc, this.picked(), E.rotFn(c, a), a); else E.transformSelection(doc, this.picked(), E.rotFn(c, a), a); });
    this.app.autoRooms();
  }
  enter(txt) {
    if (txt === '' && !this.pts.length && this.app.selection.size) { this.app.refreshHint(); return true; }
    if (this.kind === 'offset' && this.target) { const v = G.parseLen(txt, 'mm'); if (isFinite(v)) { this.S.versatz = Math.abs(v); this.app.refreshOpt(); this.app.toast('Jetzt die Seite anklicken'); return true; } }
    if (this.kind === 'rotate' && this.pts.length) { const a = parseFloat(txt.replace(',', '.')); if (isFinite(a)) { this.rotate(G.rad(a)); return true; } }
    if ((this.kind === 'move' || this.kind === 'copy') && this.pts.length) { const p = this.typedPoint(txt); if (p) { this.apply(G.sub(p, this.pts[0])); if (this.kind === 'move') this.pts = []; return true; } }
    return false;
  }
  cancel() { this.target = null; this.bound = null; this.first = null; return super.cancel(); }
  draw(P) {
    const cur = this.app.cursor; if (!cur) return;
    if (this.pts.length && (this.kind === 'move' || this.kind === 'copy')) { const d = G.sub(cur.p, this.pts[0]); P.line(this.pts[0], cur.p, { color: SEL, w: 0.18, dash: [2, 1] }); this.app.drawGhost(P, this.picked(), E.moveFn(d)); this.app.dyn(`${G.fmtCm(G.len(d))} cm`); }
    if (this.pts.length && this.kind === 'rotate') { const a = Math.atan2(cur.p.y - this.pts[0].y, cur.p.x - this.pts[0].x); P.line(this.pts[0], cur.p, { color: SEL, w: 0.18, dash: [2, 1] }); this.app.drawGhost(P, this.picked(), E.rotFn(this.pts[0], a)); this.app.dyn(`${(G.deg(a)).toFixed(1).replace('.', ',')}°`); }
    if (this.pts.length && this.kind === 'mirror') { P.line(this.pts[0], cur.p, { color: '#dc2626', w: 0.18, dash: [3, 1] }); this.app.drawGhost(P, this.picked(), E.mirrorFn(this.pts[0], cur.p)); }
    if (this.kind === 'offset' && this.target && (this.target.type === 'wall' || this.target.type === 'line')) {
      const t = this.target; const n = G.perp(G.norm(G.sub(t.b, t.a))); const s = G.dot(G.sub(cur.raw, t.a), n) >= 0 ? 1 : -1; const d = (this.S.versatz || 1000) * s;
      P.line(G.add(t.a, G.mul(n, d)), G.add(t.b, G.mul(n, d)), { color: SEL, w: 0.35, dash: [2, 1] }); this.app.dyn(`Versatz ${G.fmtCm(Math.abs(d))} cm`);
    }
  }
}

/* ───────── Fliesen-Startpunkt, Schnitt ───────── */
export class TileStartTool extends Tool {
  hint() { return 'In einem Raum mit Bodenfliesen klicken: dort liegt das Fugenkreuz (Startpunkt) · Fang an Wänden nutzen'; }
  down(ev) {
    const p = this.app.cursor.p; const doc = this.doc;
    const room = doc.all('room', doc.p.activeStorey).find(r => r.poly && G.pointInPoly(ev.world, r.poly));
    const zone = !room && doc.all('tilezone', doc.p.activeStorey).find(z => G.pointInPoly(ev.world, z.poly));
    const cfg = room ? room.tiles && room.tiles.boden : zone ? zone.tiles : null;
    if (!cfg || !cfg.aktiv) { this.app.toast('In diesem Raum ist noch keine Bodenfliese eingestellt (Doppelklick auf den Raum).', true); return; }
    doc.change('Startpunkt', () => { cfg.origin = G.clone(p); cfg.originMode = 'frei'; });
    this.app.toast('Startpunkt (Fugenkreuz) gesetzt');
  }
}
export class SectionTool extends Tool {
  hint() { return 'Schnittlinie: zwei Punkte klicken · Blickrichtung danach im Eigenschaften-Fenster umkehrbar'; }
  down(ev) {
    const p = this.app.cursor.p; if (!this.pts.length) { this.pts = [p]; return; }
    const a = this.pts[0]; this.pts = []; const n = this.doc.p.elements.filter(e => e.type === 'section').length;
    const s = this.doc.change('Schnitt', () => this.doc.add({ type: 'section', a: G.clone(a), b: G.clone(p), name: String.fromCharCode(65 + n), flip: false, storey: null }));
    this.app.toast(`Schnitt ${s.name}–${s.name} angelegt – Ansicht unter „Schnitt & Ansicht“`);
  }
  draw(P) { const c = this.app.cursor; if (c && this.pts.length) P.line(this.pts[0], c.p, { color: '#111', w: 0.35, dash: [6, 1.5, 1, 1.5] }); }
}

export function makeTool(app, name, opt = {}) {
  switch (name) {
    case 'select': return new SelectTool(app, opt);
    case 'wall': return new WallTool(app, opt);
    case 'wallrect': return new WallTool(app, { mode: 'rechteck' });
    case 'room': return new RoomTool(app, opt);
    case 'door': return new OpeningTool(app, { kind: 'door' });
    case 'window': return new OpeningTool(app, { kind: 'window' });
    case 'opening': return new OpeningTool(app, { kind: 'opening' });
    case 'line': case 'poly': case 'rect': case 'circle': case 'guide': case 'joint': case 'tilezone': case 'measure': case 'boundary': case 'neighbor': return new LineTool(app, { kind: name });
    case 'symbol': case 'text': case 'column': case 'level': case 'heightpt': case 'stair': return new PlaceTool(app, { kind: name });
    case 'dim': return new DimTool(app, { mode: 'kette' });
    case 'autodim': return new DimTool(app, { mode: 'auto' });
    case 'move': case 'copy': case 'rotate': case 'mirror': case 'offset': case 'trim': case 'join': case 'split': case 'erase': return new ModifyTool(app, { kind: name });
    case 'tilestart': return new TileStartTool(app, opt);
    case 'section': return new SectionTool(app, opt);
  }
  return new SelectTool(app, opt);
}
