// TW-CAD – Ansicht „Fliesenplan“: Boden + aufgeklappte Wandabwicklung, Einstellungen, Mengen
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import * as T from './tiles.js?v=20261028-0429';
import { CanvasPainter } from './painter.js?v=20261028-0429';
import { drawPlan, drawTileResult, floorTiles, zoneTiles, drawDim, drawSymbol, symbolFootprint, PEN, STATUS_FARBE } from './render2d.js?v=20261028-0429';
import { wallTilePlan, originDims, tileSummary } from './tilecalc.js?v=20261028-0429';
import { TILE_TEXTUREN } from './textures.js?v=20261028-0429';
import { icon } from './icons.js?v=20261028-0429';
import { FREI } from './frei.js?v=20261028-0429';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
const m2 = (v) => v.toFixed(2).replace('.', ',') + ' m²';
export const FORMATE = [[100, 100], [150, 150], [200, 200], [75, 150], [100, 200], [250, 400], [300, 300], [300, 600], [300, 900], [400, 400], [450, 450], [450, 900], [600, 600], [600, 1200], [750, 750], [800, 800], [1000, 1000], [1200, 1200], [1200, 2600], [200, 1200], [200, 1800], [250, 1500], [50, 50], [25, 25]];

export function mount(app, el, opt) {
  const v = new TilePlanView(app, el, opt); return v;
}

class TilePlanView {
  constructor(app, el, opt = {}) {
    this.app = app; this.el = el; el.innerHTML = ''; this.embedded = !!opt.embedded; this.onChange = opt.onChange || null;
    this.flaeche = opt.flaeche || 'beides'; this.mode = opt.mode || (app.tileMode === 'kunde' ? 'kunde' : 'plan'); this.edit = 'boden';
    const doc = app.doc;
    const rooms = this.rooms();
    if (this.embedded) {
      this.roomId = opt.roomId;
      this.cvWrap = h('div', { class: 'tiles-canvas', style: 'position:absolute;inset:0' }); this.cv = h('canvas'); this.cvWrap.append(this.cv); el.append(this.cvWrap);
      this.tf = { s: 0.1, ox: 300, oy: 300 }; this.bindCanvas(); this._ro = new ResizeObserver(() => { this.resize(); this.fit(); }); this._ro.observe(this.cvWrap);
      this.compute(); setTimeout(() => { this.resize(); this.fit(); }, 20);
      return;
    }
    this.roomId = app.tileRoom && doc.byId(app.tileRoom) ? app.tileRoom : app.tileZone && doc.byId(app.tileZone) ? app.tileZone : (rooms.find(r => r.tiles) || rooms[0] || {}).id;
    app.tileRoom = null; app.tileZone = null;
    this.wrap = h('div', { class: 'tiles-wrap' });
    this.list = h('div', { class: 'tiles-rooms' });
    this.bar = h('div', { class: 'tiles-bar' });
    this.cvWrap = h('div', { class: 'tiles-canvas' }); this.cv = h('canvas'); this.cvWrap.append(this.cv);
    this.wrap.append(this.list, h('div', { class: 'tiles-main' }, this.bar, this.cvWrap)); el.append(this.wrap);
    this.tf = { s: 0.1, ox: 300, oy: 300 };
    this.bindCanvas(); new ResizeObserver(() => { this.resize(); }).observe(this.cvWrap);
    this.refresh(); setTimeout(() => { this.resize(); this.fit(); }, 20);
    app.renderSide();
  }
  rooms() { const d = this.app.doc; return d.p.storeys.flatMap(s => d.all('room', s.id).filter(r => r.poly)).concat(d.p.elements.filter(e => e.type === 'tilezone')); }
  get room() { return this.app.doc.byId(this.roomId); }
  hide() { }
  refresh() { if (this.embedded) { this.compute(); this.draw(); return; } this.renderList(); this.renderBar(); this.compute(); this.draw(); if (this.app.sideTabName) this.app.renderSide && this.renderSideLater(); }
  renderSideLater() { clearTimeout(this._rs); this._rs = setTimeout(() => this.app.renderSide(), 10); }
  renderList() {
    const l = this.list; l.innerHTML = ''; l.append(h('div', { class: 'sec' }, h('h4', {}, 'Räume')));
    const doc = this.app.doc;
    for (const r of this.rooms()) {
      const st = doc.storeyById(r.storey); const hasT = r.type === 'tilezone' || (r.tiles && ((r.tiles.boden && r.tiles.boden.aktiv) || (r.tiles.wand && r.tiles.wand.aktiv)));
      l.append(h('div', { class: 'li' + (r.id === this.roomId ? ' on' : ''), style: 'margin-bottom:4px', onclick: () => { this.roomId = r.id; this.refresh(); this.fit(); this.app.renderSide(); } },
        h('span', { class: 'grow' }, r.type === 'tilezone' ? 'Fliesenfläche' : `${r.nr ? r.nr + ' ' : ''}${r.name}`), h('span', { class: 'mut' }, st ? st.name : ''), hasT ? h('span', { class: 'pill ok' }, 'F') : null));
    }
    if (!this.rooms().length) l.append(h('div', { class: 'note' }, 'Noch keine Räume. Im Grundriss mit „Raum“ in einen umschlossenen Bereich klicken.'));
    l.append(h('div', { class: 'sec', style: 'margin-top:14px' }, h('h4', {}, 'Legende Verlegeplan'), ...[['voll', 'ganze Fliese'], ['schnitt', 'Schnittstück ≥ ½'], ['warnung', 'unter ½ Fliese'], ['kritisch', 'zu klein (< ⅓ / 5 cm)']].map(([k, t]) => h('div', { style: 'display:flex;gap:8px;align-items:center;margin:4px 0' }, h('span', { class: 'sw', style: `background:${STATUS_FARBE[k]};border-color:#999` }), h('span', { class: 'muted' }, t))), h('div', { style: 'display:flex;gap:8px;align-items:center;margin:4px 0' }, h('span', { style: 'color:#dc2626;font-weight:700' }, '⊕'), h('span', { class: 'muted' }, 'Startpunkt (Fugenkreuz)'))));
  }
  renderBar() {
    const b = this.bar; b.innerHTML = ''; const r = this.room;
    b.append(h('b', {}, r ? (r.type === 'tilezone' ? 'Fliesenfläche' : `${r.nr || ''} ${r.name}`) : '–'));
    const seg = (vals, get, set) => { const s = h('div', { class: 'seg' }); for (const [v, l] of vals) s.append(h('button', { class: get() === v ? 'on' : '', onclick: () => { set(v); this.refresh(); this.fit(); } }, l)); return s; };
    if (!r || r.type !== 'tilezone') b.append(seg([['boden', 'Boden'], ['wand', 'Wandabwicklung'], ['beides', 'Boden + Wände']], () => this.flaeche, v => this.flaeche = v));
    b.append(seg([['plan', 'Verlegeplan (Mitarbeiter)'], ['kunde', 'Kundenansicht']], () => this.mode, v => { this.mode = v; }));
    b.append(h('button', { class: 'btn sm', onclick: () => this.fit(), html: icon('fit') + 'Einpassen' }));
    b.append(h('button', { class: 'btn sm studio-btn', 'data-hilfe': 'fliesenstudio', onclick: () => this.studio(), title: 'Fliesen-Studio: Fliese wählen, Verlegung, Fugen, Sockel, Mengen' }, '🧱 Fliesen-Studio'));
    b.append(h('span', { style: 'flex:1' }));
    b.append(h('button', { class: 'btn sm pri', onclick: () => this.printPlan(), html: icon('print') + 'Verlegeplan als PDF' }));
    b.append(h('button', { class: 'btn sm', onclick: () => this.materialDialog(), html: icon('tiles') + 'Materialliste' }));
  }
  compute() {
    const r = this.room; this.res = null; this.wp = null; if (!r) return;
    const doc = this.app.doc;
    if (r.type === 'tilezone') { this.res = zoneTiles(r); return; }
    const geo = W.storeyGeometry(doc, r.storey);
    this.res = floorTiles(doc, geo, r);
    this.wp = wallTilePlan(doc, r, this.res);
  }
  /* ───── Zeichnen ───── */
  resize() { const rc = this.cvWrap.getBoundingClientRect(); const d = window.devicePixelRatio || 1; this.w = rc.width; this.h = rc.height; this.cv.width = Math.max(1, rc.width * d); this.cv.height = Math.max(1, rc.height * d); this.dpr = d; this.draw(); }
  layout() {
    const r = this.room; if (!r) return null;
    const poly = r.poly; const bb = G.bbox(poly);
    const L = { floor: null, wall: null };
    if (this.flaeche !== 'wand' || r.type === 'tilezone') L.floor = { bb };
    if (this.flaeche !== 'boden' && this.wp) {
      const H = this.wp.walls.length ? Math.max(...this.wp.walls.map(w => w.s.H)) : 2500;
      const nZ = this.wp.rows.length;
      const ox = bb.x0, oy = (L.floor ? bb.y0 - 2400 - H - nZ * 300 : 0);
      L.wall = { ox, oy, H, bb: { x0: ox, y0: oy - 600, x1: ox + this.wp.total + (this.wp.btBreite || 0), y1: oy + H + 900 + nZ * 300 } };
    }
    return L;
  }
  fit() {
    const L = this.layout(); if (!L) return; let bb = null; if (L.floor) bb = G.bboxUnion(bb, { ...L.floor.bb }); if (L.wall) bb = G.bboxUnion(bb, L.wall.bb);
    if (!bb) return; bb = { x0: bb.x0 - 800, y0: bb.y0 - 800, x1: bb.x1 + 800, y1: bb.y1 + 800 }; bb.w = bb.x1 - bb.x0; bb.h = bb.y1 - bb.y0;
    const s = Math.min(this.w / bb.w, this.h / bb.h); this.tf.s = s; this.tf.ox = this.w / 2 - (bb.x0 + bb.w / 2) * s; this.tf.oy = this.h / 2 + (bb.y0 + bb.h / 2) * s; this.draw();
  }
  draw() {
    if (!this.cv || !this.w) return; const c = this.cv.getContext('2d'); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#fbfbf9'; c.fillRect(0, 0, this.w, this.h);
    const r = this.room; if (!r) { c.fillStyle = '#666'; c.font = '14px Inter'; c.fillText('Raum wählen', 20, 30); return; }
    const ps = Math.max(8, Math.min(200, 10 / (2.5 * this.tf.s)));
    const P = new CanvasPainter(c, this.tf, ps);
    this.paint(P, this.layout(), { ps });
  }
  /** gemeinsame Zeichnung (Bildschirm & PDF) */
  paint(P, L, opt = {}) {
    const r = this.room; const doc = this.app.doc; const mode = opt.mode || this.mode; const ps = opt.ps || 25;
    if (L.floor) {
      if (r.type === 'tilezone') { if (this.res) drawTileResult(P, this.res, mode, r.tiles, { paperScale: ps }); P.polyline(r.poly, { color: '#111', w: PEN.dick }, true); }
      else {
        const bb = L.floor.bb; const pad = 900;
        const clip = [{ x: bb.x0 - pad, y: bb.y0 - pad }, { x: bb.x1 + pad, y: bb.y0 - pad }, { x: bb.x1 + pad, y: bb.y1 + pad }, { x: bb.x0 - pad, y: bb.y1 + pad }];
        P.clip([clip], () => drawPlan(P, doc, { storey: r.storey, tiles: 'aus', paperScale: ps, underlays: false, stampDetails: false }));
        if (this.res) drawTileResult(P, this.res, mode, r.tiles.boden, { paperScale: ps });
        for (const sy of doc.all('symbol', r.storey)) if (G.pointInPoly(sy.p, r.poly)) drawSymbol(P, sy, '#374151');
        // Objekte darüber zeichnen
        if (this.res && mode === 'plan') {
          for (const d of originDims(this.res, r.poly)) drawDim(P, { pts: [d.from, d.to], off: d.axis === 'x' ? -500 : 500, dir: G.norm(G.sub(d.to, d.from)) }, '#dc2626', { paperScale: ps });
          P.text(G.add(this.res.origin, { x: 140, y: 140 }), 'Startpunkt', 2.2, { color: '#dc2626', bold: true, bg: 'rgba(255,255,255,.85)' });
        }
        const poly = G.ensureCCW(r.poly);
        for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; if (G.dist(a, b) > 200) drawDim(P, { pts: [a, b], off: -(400 + ps * 2) }, '#1452a8', { paperScale: ps }); }
        P.text({ x: L.floor.bb.x0, y: L.floor.bb.y1 + 1300 }, `Boden · ${r.nr || ''} ${r.name}`, 4, { bold: true });
        if (r.tiles && r.tiles.boden && r.tiles.boden.aktiv) { const b = r.tiles.boden; P.text({ x: L.floor.bb.x0, y: L.floor.bb.y1 + 1000 }, `${b.name || 'Fliese'} ${G.fmtCm(b.L)}×${G.fmtCm(b.B)} cm · Fuge ${b.fuge} mm · ${T.VERBAENDE[b.verband] || b.verband}${b.angle ? ' · ' + b.angle + '°' : ''}${this.res && this.res.rand ? ` · Randfries ${G.fmtCm(b.rand.breite)} cm: ${this.res.rand.cfg.name || ''} ${G.fmtCm(this.res.rand.cfg.L)}×${G.fmtCm(this.res.rand.cfg.B)}` : ''}`, 2.6, { color: '#374151' }); }
      }
    }
    if (L.wall && this.wp) this.paintWalls(P, L.wall, mode, ps);
    if (L.floor && this.hervor && r.type !== 'tilezone') {
      const hv = this.hervor; const og = { color: '#f97316', w: 1.1 };
      if (hv.wand !== undefined && this.wp && this.wp.walls[hv.wand]) { const s = this.wp.walls[hv.wand].s; P.line(s.a, s.b, og); }
      if (hv.bt) { const sy = doc.byId(hv.bt); if (sy) P.polyline(symbolFootprint(sy), og, true); }
    }
  }
  paintWalls(P, Lw, mode, ps) {
    const wp = this.wp; const cfg = wp.cfg; const r = this.room;
    let x = Lw.ox;
    const nZ = wp.rows.length;
    P.text({ x: Lw.ox, y: Lw.oy + Lw.H + 650 + nZ * 300 }, `Wandabwicklung · ${r.nr || ''} ${r.name} (von innen gesehen, im Uhrzeigersinn)`, 4, { bold: true });
    const zeilen = wp.rows.map(rw => rw.art === 'sockel' ? `Sockel ${G.fmtCm(r.tiles.sockel.hoehe || 60)} cm: ${rw.cfg.name || 'Fliese'} · ${rw.lfm.toFixed(1).replace('.', ',')} lfm` : rw.art === 'fries' ? `Fries: ${rw.cfg.name || 'Bordüre'} ${G.fmtCm(rw.cfg.breite || 50)} cm · ${rw.lfm.toFixed(1).replace('.', ',')} lfm` : `${rw.art === 'oben' ? 'Wand oben' : rw.art === 'bauteil' ? (rw.bauteile || ['Bauteile']).join(', ') : 'Wand'}: ${rw.cfg.name || 'Wandfliese'} ${G.fmtCm(rw.cfg.L)}×${G.fmtCm(rw.cfg.B)} cm · Fuge ${rw.cfg.fuge} mm · ${T.VERBAENDE[rw.cfg.verband] || rw.cfg.verband}`);
    zeilen.forEach((t, k) => P.text({ x: Lw.ox, y: Lw.oy + Lw.H + 500 + (nZ - 1 - k) * 300 }, t, 2.4, { color: '#374151' }));
    wp.walls.forEach((w, i) => {
      const off = { x: x, y: Lw.oy }; const tr = (p) => ({ x: p.x + off.x, y: p.y + off.y });
      const s = w.s;
      // ganze Wand (Rohbau) hellgrau
      P.fill([[tr({ x: 0, y: 0 }), tr({ x: s.len, y: 0 }), tr({ x: s.len, y: s.H }), tr({ x: 0, y: s.H })]], '#eef0f2', 1, { color: '#6b7280', w: PEN.duenn });
      if (!w.aktiv && !w.baender.length) P.text(tr({ x: s.len / 2, y: s.H / 2 }), 'nicht gefliest', 2.4, { align: 'center', base: 'middle', color: '#9ca3af' });
      for (const zo of w.zonen) {
        const zc = zo.cfg;
        const res = { pieces: zo.pieces.map(p => ({ ...p, poly: p.poly.map(tr), wr0: tr(p.wr0), wr1: tr(p.wr1), wr2: tr(p.wr2) })), region: { outer: [], holes: [] }, origin: tr(zo.origin), cfg: zc };
        if (mode === 'kunde') { for (const rg of zo.regions) P.fill([rg.outer.map(tr), ...rg.holes.map(hh => hh.map(tr))], zc.fugeFarbe || '#b9b3aa', 1); drawTileResult(P, res, 'kunde', zc, { paperScale: ps }); }
        else drawTileResult(P, res, 'plan', zc, { paperScale: ps, cutLabels: true });
        if (zo.oben && mode === 'plan') P.line(tr({ x: 0, y: zo.z0 }), tr({ x: s.len, y: zo.z0 }), { color: '#7c3aed', w: PEN.kraeftig, dash: [2, 1] });
      }
      for (const b of w.baender) {
        const bc = b.art === 'sockel' && b.cfg.quelle === 'boden' && r.tiles && r.tiles.boden && r.tiles.boden.aktiv ? r.tiles.boden : b.cfg;
        const q = [tr({ x: 0, y: b.z0 }), tr({ x: s.len, y: b.z0 }), tr({ x: s.len, y: b.z1 }), tr({ x: 0, y: b.z1 })];
        P.fill([q], mode === 'kunde' ? (bc.farbe || '#9ca3af') : (b.art === 'sockel' ? '#fef3c7' : '#ede9fe'), 1, { color: b.art === 'sockel' ? '#b45309' : '#7c3aed', w: PEN.duenn });
        if (mode === 'plan') {
          const st = bc.L ? bc.L + (bc.fuge || 2) : 0; if (st > 0) for (let xx = st; xx < s.len; xx += st) P.line(tr({ x: xx, y: b.z0 }), tr({ x: xx, y: b.z1 }), { color: '#a8a29e', w: PEN.fein });
          P.text(tr({ x: 120, y: (b.z0 + b.z1) / 2 }), b.art === 'sockel' ? `Sockel ${G.fmtCm(b.z1 - b.z0)} cm${b.cfg.quelle === 'boden' ? ' (aus Bodenfliese)' : ''}` : `Fries ${G.fmtCm(b.z1 - b.z0)} cm`, 1.7, { base: 'middle', color: '#374151' });
        }
      }
      // Öffnungen
      for (const o of s.openings) {
        const q = [tr({ x: o.x0, y: o.sill }), tr({ x: o.x1, y: o.sill }), tr({ x: o.x1, y: o.sill + o.height }), tr({ x: o.x0, y: o.sill + o.height })];
        P.fill([q], o.kind === 'window' ? '#dbeafe' : '#ffffff', 1, { color: '#111', w: PEN.kraeftig });
        P.text(tr({ x: (o.x0 + o.x1) / 2, y: o.sill + o.height / 2 }), `${o.kind === 'window' ? 'Fenster' : 'Tür'} ${G.fmtCm(o.x1 - o.x0)}/${G.fmtCm(o.height)}${o.kind === 'window' ? ' BRH ' + G.fmtCm(o.sill) : ''}`, 2, { align: 'center', base: 'middle', color: '#1f2937' });
      }
      // Wandlänge & Nummer
      drawDim(P, { pts: [tr({ x: 0, y: 0 }), tr({ x: s.len, y: 0 })], dir: { x: 1, y: 0 }, off: -300 - ps * 2 }, '#1452a8', { paperScale: ps });
      P.text(tr({ x: s.len / 2, y: s.H + 160 }), `Wand ${i + 1}${s.wall ? '' : ''}`, 2.6, { align: 'center', bold: true, color: '#111' });
      // Höhenteilung der Reihen (nur erste Wand)
      if (i === 0) {
        const rows = new Set(); for (const p of w.pieces) { const bb = G.bbox(p.polyL); rows.add(Math.round(bb.y0)); rows.add(Math.round(bb.y1)); }
        const ys = [...rows].sort((a, b) => a - b).filter((y, k, arr) => k === 0 || y - arr[k - 1] > 20);
        if (ys.length > 1) drawDim(P, { pts: ys.map(y => tr({ x: 0, y })), dir: { x: 0, y: 1 }, off: 300 + ps * 2 }, '#0e7c6b', { paperScale: ps });
      }
      // von Vorwand/Schacht/Wanne verdeckt
      for (const v of s.occl || []) {
        const q = [tr({ x: v.x0, y: v.y0 }), tr({ x: v.x1, y: v.y0 }), tr({ x: v.x1, y: v.y1 }), tr({ x: v.x0, y: v.y1 })];
        P.fill([q], mode === 'kunde' ? '#cbd5e1' : '#e5e7eb', 1, { color: '#64748b', w: PEN.mittel || PEN.kraeftig });
        P.text(tr({ x: (v.x0 + v.x1) / 2, y: (v.y0 + v.y1) / 2 }), v.name, 1.9, { align: 'center', base: 'middle', color: '#475569' });
      }
      P.line(tr({ x: s.len, y: 0 }), tr({ x: s.len, y: s.H }), { color: '#111', w: PEN.kraeftig });
      if (this.hervor && this.hervor.wand === s.k) P.polyline([tr({ x: -20, y: -20 }), tr({ x: s.len + 20, y: -20 }), tr({ x: s.len + 20, y: s.H + 20 }), tr({ x: -20, y: s.H + 20 })], { color: '#f97316', w: 0.9 }, true);
      x += s.len;
    });
    P.line({ x: Lw.ox, y: Lw.oy }, { x: x, y: Lw.oy }, { color: '#111', w: PEN.dick });
    // geflieste Bauteile (Ansichten der freien Seiten + Draufsicht oben)
    if (wp.bauteile && wp.bauteile.length) {
      let bx = x + 800; const SN = { vorne: 'vorne', hinten: 'hinten', links: 'links', rechts: 'rechts', oben: 'oben (Draufsicht)' };
      for (const bt of wp.bauteile) {
        const x0 = bx; const hv = this.hervor && this.hervor.bt === bt.sy.id; let maxH = 0;
        for (const f of bt.faces.concat(bt.oben ? [bt.oben] : [])) {
          const ox = bx; const tr = (p) => ({ x: p.x + ox, y: p.y + Lw.oy }); maxH = Math.max(maxH, f.h);
          const q = [tr({ x: 0, y: 0 }), tr({ x: f.len, y: 0 }), tr({ x: f.len, y: f.h }), tr({ x: 0, y: f.h })];
          P.fill([q], mode === 'kunde' ? (bt.cfg.fugeFarbe || '#b9b3aa') : '#eef0f2', 1, { color: '#6b7280', w: PEN.duenn });
          const res = { pieces: f.pieces.map(p => ({ ...p, poly: p.poly.map(tr), wr0: tr(p.wr0), wr1: tr(p.wr1), wr2: tr(p.wr2) })), region: { outer: [], holes: [] }, origin: tr(f.origin), cfg: bt.cfg };
          drawTileResult(P, res, mode === 'kunde' ? 'kunde' : 'plan', bt.cfg, { paperScale: ps });
          P.polyline(q, { color: '#111', w: PEN.kraeftig }, true);
          drawDim(P, { pts: [tr({ x: 0, y: 0 }), tr({ x: f.len, y: 0 })], dir: { x: 1, y: 0 }, off: -300 - ps * 2 }, '#1452a8', { paperScale: ps });
          P.text(tr({ x: f.len / 2, y: f.h + (f.len < 450 ? 120 + (f.name === 'links' ? 220 : 0) : 160) }), SN[f.name] || f.name, f.len < 450 ? 1.7 : 2.2, { align: 'center', bold: true, color: '#111' });
          bx += f.len + 300;
        }
        P.text({ x: x0, y: Lw.oy + maxH + 520 }, `${bt.name} ${G.fmtCm(bt.sy.w)}×${G.fmtCm(bt.sy.d)} cm, Höhe ${G.fmtCm(bt.h)} cm${bt.eigene ? ' – ' + (bt.cfg.name || 'eigene Fliese') : ''}`, 2.4, { bold: true, color: '#374151' });
        if (hv) P.polyline([{ x: x0 - 100, y: Lw.oy - 120 }, { x: bx - 200, y: Lw.oy - 120 }, { x: bx - 200, y: Lw.oy + maxH + 800 }, { x: x0 - 100, y: Lw.oy + maxH + 800 }], { color: '#f97316', w: 0.9 }, true);
        bx += 500;
      }
    }
  }
  /* ───── Interaktion ───── */
  bindCanvas() {
    const cv = this.cv; let drag = null;
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; const f = Math.pow(1.0015, -e.deltaY); const wx = (sx - this.tf.ox) / this.tf.s, wy = -(sy - this.tf.oy) / this.tf.s; this.tf.s *= f; this.tf.ox = sx - wx * this.tf.s; this.tf.oy = sy + wy * this.tf.s; this.draw(); }, { passive: false });
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); const r = cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const w = { x: (sx - this.tf.ox) / this.tf.s, y: -(sy - this.tf.oy) / this.tf.s };
      if (this.res && this.flaeche !== 'wand' && G.dist(w, this.res.origin) * this.tf.s < 14) { drag = { kind: 'origin', before: this.app.doc.snapshot() }; return; }
      drag = { kind: 'pan', x: e.clientX, y: e.clientY, ox: this.tf.ox, oy: this.tf.oy };
    });
    cv.addEventListener('pointermove', e => {
      if (!drag) return; const r = cv.getBoundingClientRect();
      if (drag.kind === 'pan') { this.tf.ox = drag.ox + e.clientX - drag.x; this.tf.oy = drag.oy + e.clientY - drag.y; this.draw(); return; }
      const sx = e.clientX - r.left, sy = e.clientY - r.top; let w = { x: (sx - this.tf.ox) / this.tf.s, y: -(sy - this.tf.oy) / this.tf.s };
      w = { x: Math.round(w.x / 5) * 5, y: Math.round(w.y / 5) * 5 };
      const cfg = this.cfgFloor(); if (cfg) { cfg.origin = w; cfg.originMode = 'frei'; this.app.doc.cacheVersion++; this.compute(); this.draw(); }
    });
    cv.addEventListener('pointerup', () => { if (drag && drag.kind === 'origin') { this.app.commitLive(drag.before, 'Startpunkt'); if (this.onChange) this.onChange(); } drag = null; });
  }
  cfgFloor() { const r = this.room; if (!r) return null; return r.type === 'tilezone' ? r.tiles : r.tiles && r.tiles.boden; }

  async studio(ziel) { const M = await import('./fliesenstudio.js?v=20261028-0429'); M.openStudio(this.app, { roomId: this.roomId, ziel: ziel || (this.edit === 'wand' ? 'wand' : 'boden'), onClose: () => this.refresh() }); }
  /* ───── Seitenleiste: Einstellungen ───── */
  renderSide(body) {
    const r = this.room; const doc = this.app.doc; if (!r) { body.append(h('div', { class: 'muted' }, 'Raum wählen')); return; }
    body.append(h('button', { class: 'btn studio-btn big', style: 'width:100%;margin-bottom:10px', onclick: () => this.studio() }, '🧱 Fliesen-Studio öffnen', h('small', {}, 'Fliese wählen · Katalog · LV · Verlegung · Fugen · Sockel · Mengen')));
    const isZone = r.type === 'tilezone';
    if (!isZone && !r.tiles) r.tiles = {};
    const which = isZone ? 'zone' : this.edit;
    if (!isZone) { const s = h('div', { class: 'seg', style: 'margin-bottom:10px' }); for (const [v, l] of [['boden', 'Bodenfliese'], ['wand', 'Wandfliese']]) s.append(h('button', { class: this.edit === v ? 'on' : '', onclick: () => { this.edit = v; this.app.renderSide(); } }, l)); body.append(s); }
    let cfg = isZone ? r.tiles : r.tiles[which];
    const ch = (label, fn) => { doc.change(label, fn); this.compute(); this.draw(); this.app.renderSide(); };
    if (!cfg || !cfg.aktiv) {
      body.append(h('div', { class: 'note' }, which === 'wand' ? 'Für die Wände ist noch keine Fliese eingestellt.' : 'Für den Boden ist noch keine Fliese eingestellt.'),
        h('div', { class: 'btns', style: 'margin-top:8px' }, h('button', { class: 'btn pri', onclick: () => ch('Fliesen an', () => { if (isZone) r.tiles = T.defaultTileCfg({ aktiv: true }); else r.tiles[which] = Object.assign(T.defaultTileCfg({ aktiv: true }), which === 'wand' ? { L: 600, B: 300, verband: 'kreuz', hoehe: 2000, xModus: 'boden', yModus: 'unten', farbe: '#f3f1ec', textur: 'glanz', fuge: 2 } : {}, r.tiles[which] || {}, { aktiv: true }); }) }, '+ Fliese einstellen'),
          doc.p.tileLib.length ? h('button', { class: 'btn', onclick: () => this.fromLib(r, which) }, 'Aus LV/Bibliothek') : null));
      if (cfg && !cfg.aktiv) body.append(h('button', { class: 'btn sm', style: 'margin-top:6px', onclick: () => ch('Fliesen an', () => cfg.aktiv = true) }, 'Letzte Einstellung wieder aktivieren'));
      return;
    }
    const row = (l, inp) => h('div', { class: 'row' }, h('label', {}, l), inp);
    const inp = (key, type = 'number', step = 1, label) => { const i = h('input', { type, step, value: cfg[key] ?? '' }); i.onchange = () => ch(label || key, () => { cfg[key] = type === 'number' ? parseFloat(i.value) : i.value; }); return i; };
    const sel = (key, values, label) => { const s = h('select', {}); for (const [v, l] of values) s.append(h('option', { value: v, selected: String(cfg[key]) === String(v) }, l)); s.onchange = () => ch(label || key, () => { cfg[key] = isNaN(+s.value) || s.value === '' ? s.value : +s.value; }); return s; };
    // Produkt
    body.append(h('div', { class: 'sec' }, h('h4', {}, 'Fliese'), row('Bezeichnung', inp('name', 'text')), row('Hersteller', inp('hersteller', 'text')), row('Serie / Artikel', inp('artikel', 'text')),
      doc.p.tileLib.length ? h('button', { class: 'btn sm', onclick: () => this.fromLib(r, which) }, `Aus LV/Bibliothek (${doc.p.tileLib.length})`) : null));
    // Format
    const fmt = h('select', {}); fmt.append(h('option', { value: '' }, 'Format wählen …')); for (const [a, b] of FORMATE) fmt.append(h('option', { value: a + 'x' + b, selected: (cfg.L === b && cfg.B === a) || (cfg.L === a && cfg.B === b) }, `${G.fmtCm(a)} × ${G.fmtCm(b)} cm`));
    fmt.onchange = () => { if (!fmt.value) return; const [a, b] = fmt.value.split('x').map(Number); ch('Format', () => { cfg.L = Math.max(a, b); cfg.B = Math.min(a, b); }); };
    body.append(h('div', { class: 'sec' }, h('h4', {}, 'Format & Verlegung'), row('Format', fmt), row('Länge × Breite (mm)', h('div', { class: 'pair' }, inp('L'), inp('B'))), row('Fuge (mm)', inp('fuge', 'number', 0.5)),
      row('Verband', sel('verband', Object.entries(T.VERBAENDE))), row('Winkel (°)', inp(which === 'wand' ? 'angleWand' : 'angle', 'number', 15)),
      cfg.verband === 'halb' && Math.max(cfg.L, cfg.B) >= 600 ? h('div', { class: 'note warn' }, 'Hinweis: Bei Großformat ab ca. 60 cm raten die Fachverbände vom Halbverband ab (Schüsselung/Überzähne). Besser Drittelverband oder Kreuzfuge.') : null));
    if (which !== 'wand') {
      const sp = h('div', { class: 'btns' });
      for (const [v, l] of [['optimal', 'Optimal'], ['mitteFuge', 'Fuge mittig'], ['mitteFliese', 'Fliese mittig'], ['ecke', 'Ab Ecke'], ['frei', 'Frei (gezogen)']]) sp.append(h('button', { class: 'chip' + ((cfg.originMode || 'optimal') === v ? ' on' : ''), onclick: () => ch('Startpunkt', () => { cfg.originMode = v; if (v !== 'frei') cfg.origin = null; else if (!cfg.origin && this.res) cfg.origin = { ...this.res.origin }; }) }, l));
      body.append(h('div', { class: 'sec' }, h('h4', {}, 'Startpunkt (Fugenkreuz)'), sp, h('div', { class: 'muted', style: 'margin-top:6px' }, 'Roten Punkt im Plan ziehen = frei setzen. „Optimal“ vermeidet kleine Randstücke und legt symmetrisch.')));
    } else {
      const hr = h('input', { type: 'number', value: cfg.hoehe || '' }); hr.onchange = () => ch('Fliesenhöhe', () => cfg.hoehe = parseFloat(hr.value) || 0);
      body.append(h('div', { class: 'sec' }, h('h4', {}, 'Wand'), row('Fliesenhöhe (mm, leer = raumhoch)', hr),
        row('Senkrechte Fugen', sel('xModus', [['boden', 'wie Boden (durchgehend)'], ['ecke', 'um die Ecke durchlaufend'], ['optimal', 'je Wand optimal'], ['mitte', 'je Wand Fuge mittig'], ['mitteFliese', 'je Wand Fliese mittig']])),
        row('Waagrechte Fugen', sel('yModus', [['unten', 'unten ganze Fliese'], ['oben', 'oben ganze Fliese'], ['hoehe', 'Fuge auf Höhe …'], ['optimal', 'optimal']])),
        cfg.yModus === 'hoehe' ? row('Fugenhöhe (mm)', inp('yHoehe')) : null,
        h('button', { class: 'btn sm', onclick: () => ch('Wand-Startpunkte', () => { cfg.wandOrigin = null; }) }, 'Einzelne Wand-Startpunkte zurücksetzen')));
    }
    // Optik
    const file = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    file.onchange = async () => { const f = file.files[0]; if (!f) return; const url = await shrinkImage(f, 384); ch('Fliesenfoto', () => { cfg.bildData = url; cfg.textur = 'bild'; }); };
    body.append(h('div', { class: 'sec' }, h('h4', {}, 'Optik (Kundenansicht & 3D)'), row('Oberfläche', sel('textur', [...Object.entries(TILE_TEXTUREN), ['bild', 'Foto der Fliese']])), row('Farbe', inp('farbe', 'color')), row('Zweitfarbe / Äderung', inp('farbe2', 'color')), row('Fugenfarbe', inp('fugeFarbe', 'color')),
      h('div', { class: 'btns' }, h('button', { class: 'btn sm', onclick: () => file.click() }, 'Foto hochladen'), FREI ? null : h('button', { class: 'btn sm', onclick: async () => { const M = await import('./ai.js?v=20261028-0429'); M.searchTile(this.app, cfg, () => { this.compute(); this.draw(); this.app.renderSide(); }); }, html: icon('ki') + 'Fliese im Internet suchen (KI)' }), file),
      cfg.bildData ? h('img', { src: cfg.bildData, style: 'width:100%;max-height:120px;object-fit:cover;border-radius:8px;margin-top:8px' }) : null,
      cfg.quelle ? h('div', { class: 'muted', style: 'margin-top:4px' }, 'Quelle: ', h('a', { href: cfg.quelle, target: '_blank' }, cfg.quelle.slice(0, 60))) : null));
    // Mengen
    const st = which === 'wand' ? (this.wp ? this.wp.sum : null) : (this.res ? this.res.stats : null);
    if (st) {
      const kv = h('div', { class: 'kv' }); const add = (k, v, cls) => kv.append(h('span', {}, k), h('b', {}, cls ? h('span', { class: 'pill ' + cls }, v) : v));
      add('Fläche netto', m2(st.m2)); if (which === 'wand') add('Laibungen ca.', m2(st.laibung)); add('Ganze Fliesen', String(st.full)); add('Schnittstücke', String(st.cut));
      add('unter ½ Fliese', String(st.warn), st.warn ? 'warn' : 'ok'); add('zu klein (kritisch)', String(st.krit), st.krit ? 'bad' : 'ok');
      add(`Bedarf inkl. ${cfg.reserve ?? 5} % Reserve`, `${st.bedarf} Stk = ${m2(st.m2Bestell)}`); if (st.pakete) add('Pakete', String(st.pakete));
      if (which !== 'wand') add('Verschnitt', (st.verschnitt || 0).toFixed(1).replace('.', ',') + ' %');
      add('Fugenmörtel ca.', (st.fugeKg || 0).toFixed(1).replace('.', ',') + ' kg'); add('Kleber ca.', (T.materialRichtwerte(st.m2, cfg).kleberKg).toFixed(0) + ' kg');
      if (which === 'wand') { add('Silikon (Boden/Innenecken)', st.silikonLfm.toFixed(1).replace('.', ',') + ' lfm'); add('Kantenschutz Laibungen ca.', st.schiene.toFixed(1).replace('.', ',') + ' lfm'); }
      body.append(h('div', { class: 'sec' }, h('h4', {}, 'Mengen'), kv, row('Reserve %', inp('reserve')), row('m² je Paket', inp('paketM2', 'number', 0.01)), row('Mindest-Randstück', inp('minRand', 'number', 0.05))));
      if (st.krit) body.append(h('div', { class: 'note warn' }, `${st.krit} Randstück(e) sind zu klein. Tipp: Startpunkt „Optimal“ oder roten Punkt verschieben.`));
    }
    body.append(h('div', { class: 'btns', style: 'margin-top:10px' },
      h('button', { class: 'btn sm', onclick: () => this.copyToRooms(cfg, which) }, 'Auf andere Räume übertragen …'),
      h('button', { class: 'btn sm red', onclick: () => ch('Fliesen aus', () => cfg.aktiv = false) }, 'Fliesen entfernen')));
  }
  fromLib(r, which) {
    const app = this.app; const lib = app.doc.p.tileLib; const body = h('div', { class: 'list' });
    const close = app.modal('Fliese aus LV / Bibliothek', body);
    for (const t of lib) body.append(h('div', { class: 'li', onclick: () => { app.doc.change('Fliese aus LV', () => { const base = (r.type === 'tilezone' ? r.tiles : r.tiles[which]) || T.defaultTileCfg(); const n = Object.assign(base, { aktiv: true, name: t.name, hersteller: t.hersteller, artikel: t.artikel || t.serie, L: t.L, B: t.B, farbe: t.farbe || base.farbe, textur: t.textur || base.textur, fuge: t.fuge || base.fuge, lvPos: t.pos }); if (r.type === 'tilezone') r.tiles = n; else r.tiles[which] = n; }); close(); this.compute(); this.draw(); app.renderSide(); } },
      h('span', { class: 'sw', style: `background:${t.farbe || '#ccc'}` }), h('span', { class: 'grow' }, `${t.pos ? 'Pos. ' + t.pos + ' · ' : ''}${t.name}`), h('span', { class: 'mut' }, `${G.fmtCm(t.L)}×${G.fmtCm(t.B)}`)));
  }
  copyToRooms(cfg, which) {
    const app = this.app; const rooms = this.rooms().filter(r => r.type === 'room' && r.id !== this.roomId);
    const body = h('div', { class: 'list' }); const checks = [];
    for (const r of rooms) { const c = h('input', { type: 'checkbox' }); checks.push([c, r]); body.append(h('label', { class: 'li' }, c, h('span', { class: 'grow' }, `${r.nr || ''} ${r.name}`))); }
    const close = app.modal(`${which === 'wand' ? 'Wandfliese' : 'Bodenfliese'} übertragen`, body, [h('button', { class: 'btn pri', onclick: () => { app.doc.change('Fliese übertragen', () => { for (const [c, r] of checks) if (c.checked) { r.tiles = r.tiles || {}; const n = JSON.parse(JSON.stringify(cfg)); n.origin = null; if (n.originMode === 'frei') n.originMode = 'optimal'; n.wandOrigin = null; r.tiles[which === 'zone' ? 'boden' : which] = n; } }); close(); app.toast('Übertragen'); this.refresh(); } }, 'Übertragen')]);
  }
  materialDialog() {
    const app = this.app; const S = tileSummary(app.doc);
    const t = h('table', { style: 'width:100%;border-collapse:collapse;font-size:12.5px' });
    t.append(h('tr', {}, ...['Fliese', 'Format', 'Menge netto', 'Bestellung Stk', 'Fugenmörtel', 'Kleber', 'Kosten', 'Räume'].map(x => h('th', { style: 'text-align:left;border-bottom:1px solid #444;padding:5px' }, x))));
    const menge = (r) => r.lfm ? r.lfm.toFixed(1).replace('.', ',') + ' lfm' : m2(r.m2); const eur = (v) => v ? v.toFixed(2).replace('.', ',') + ' €' : '–';
    for (const r of S.rows) t.append(h('tr', {}, h('td', { style: 'padding:5px' }, `${r.name}${r.hersteller ? ' – ' + r.hersteller : ''}`), h('td', {}, `${G.fmtCm(r.L)}×${G.fmtCm(r.B)}`), h('td', {}, menge(r)), h('td', {}, String(r.stuck)), h('td', {}, r.fugeKg.toFixed(1).replace('.', ',') + ' kg'), h('td', {}, Math.round(r.kleberKg || 0) + ' kg'), h('td', {}, eur(r.kosten)), h('td', { class: 'muted' }, r.raeume.join(', '))));
    const csv = () => { const lines = ['Fliese;Hersteller;Artikel;Format;Menge netto;Einheit;Bestellung Stk;Fugenmoertel kg;Kleber kg;Kosten EUR;Raeume']; for (const r of S.rows) lines.push([r.name, r.hersteller, r.artikel, `${r.L}x${r.B}`, (r.lfm || r.m2).toFixed(2).replace('.', ','), r.lfm ? 'lfm' : 'm2', r.stuck, r.fugeKg.toFixed(1).replace('.', ','), Math.round(r.kleberKg || 0), (r.kosten || 0).toFixed(2).replace('.', ','), r.raeume.join(', ')].join(';')); app.downloadBlob(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }), 'Fliesen-Materialliste.csv'); };
    app.modal('Materialliste Fliesen (alle Räume)', h('div', {}, t, h('div', { class: 'muted', style: 'margin-top:8px' }, 'Bestellmengen inkl. Reserve und geschätzter Reststückverwertung. Kleber/Silikon/Profile stehen je Raum im Fliesenplan.')), [h('button', { class: 'btn', onclick: csv }, 'Als CSV (Excel)'), h('button', { class: 'btn pri', onclick: () => this.printPlan(true) }, 'Als PDF')]);
  }
  async printPlan(nurMaterial = false) {
    const M = await import('./print.js?v=20261028-0429'); M.printTilePlan(this.app, this, { nurMaterial });
  }
}

export function shrinkImage(file, max = 384) {
  return new Promise((res, rej) => { const img = new Image(); img.onload = () => { const s = Math.min(1, max / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); res(c.toDataURL('image/jpeg', 0.85)); }; img.onerror = rej; img.src = URL.createObjectURL(file); });
}
