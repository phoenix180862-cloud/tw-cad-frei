// TW-CAD – Fliesen-Studio: eigenes großes Fenster für alles rund um Fliesen
//   links  „① Wohin?“     Boden, Randfries, alle Wände, jede Wand einzeln, Wand oben (2. Fliese), Bordüre/Fries, Sockel
//   Mitte  Vorschau (Verlegeplan/Kundenansicht, Startpunkt ziehen) + „② Welche Fliese?“ (Projekt · LV · Katalog · Eigene)
//   rechts „③ Wie verlegen?“  Verband, Richtung, Startpunkt, Fugen, Höhen, Kanten/Kleber, Mengen & Kosten, Übertragen
import * as G from './geom.js?v=20261123-0837';
import * as T from './tiles.js?v=20261123-0837';
import * as K from './fliesenkatalog.js?v=20261123-0837';
import { wallSurfaces, wallTilePlan, tileSummary, raumBauteile, bauteilSeiten, bauteilHoehe, raumHoehe } from './tilecalc.js?v=20261123-0837';
import { floorTiles, zoneTiles, symbolFootprint, SYMBOLE } from './render2d.js?v=20261123-0837';
import * as W from './walls.js?v=20261123-0837';
import { TILE_TEXTUREN, tileSurface } from './textures.js?v=20261123-0837';
import { mount as mountPlan, shrinkImage } from './tileplan.js?v=20261123-0837';
import { uid } from './model.js?v=20261123-0837';
import { FREI, einstieg } from './frei.js?v=20261123-0837';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (k === 'style') e.style.cssText = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) ap(e, c.nodeType ? c : document.createTextNode(c)); return e; };
const zahl = (v, d = 2) => (Math.round(v * Math.pow(10, d)) / Math.pow(10, d)).toFixed(d).replace('.', ',');
const m2 = (v) => zahl(v) + ' m²';
const eur = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const clone = (o) => JSON.parse(JSON.stringify(o));
const ap = (el, ...k) => { el.append(...k.flat().filter(x => x != null && x !== false)); return el; };

const BODEN_STD = { L: 600, B: 300, fuge: 3, verband: 'drittel', farbe: '#bdb5a8', textur: 'beton', name: 'Bodenfliese 30×60', material: 'feinsteinzeug', rutsch: 'R10', oberflaeche: 'matt', staerke: 9 };
const WAND_STD = { L: 600, B: 300, fuge: 2, verband: 'kreuz', farbe: '#f3f1ec', textur: 'glanz', name: 'Wandfliese 30×60', hoehe: 0, xModus: 'boden', yModus: 'unten', material: 'steingut', oberflaeche: 'glaenzend', staerke: 8 };

let offen = null;
const _u = (f) => !f[3];
const OPTIK = [
  ['beton', 'Beton', ['beton', 'gross'], f => f[3] === 'beton' || ['hellgrau', 'grau', 'mittelgrau', 'dunkelgrau', 'anthrazit', 'greige', 'sand', 'taupe'].includes(f[0]), 'beton'],
  ['marmor', 'Marmor', ['marmor'], f => f[3] === 'marmor'],
  ['holz', 'Holz', ['holz', 'chevron'], f => f[3] === 'holz'],
  ['stein', 'Naturstein', ['naturstein', 'schiefer'], f => ['naturstein', 'schiefer'].includes(f[3]) || ['beige', 'sand', 'taupe', 'creme', 'anthrazit'].includes(f[0]), 'naturstein'],
  ['terrazzo', 'Terrazzo', ['fsz_boden'], f => f[3] === 'terrazzo' || ['weiß matt', 'creme', 'hellgrau', 'greige', 'anthrazit'].includes(f[0]), 'terrazzo'],
  ['uni', 'Uni', ['fsz_boden', 'wand'], f => _u(f) || f[3] === 'glanz'],
  ['metro', 'Metro', ['metro'], f => _u(f) || f[3] === 'glanz'],
  ['zement', 'Zementfliese', ['zement', 'sechseck'], f => ['weiß matt', 'creme', 'beige', 'greige', 'grau', 'anthrazit', 'schwarz', 'Terracotta', 'Salbei', 'Petrol', 'dunkelblau'].includes(f[0]), 'zement'],
  ['mosaik', 'Mosaik', ['mosaik', 'glasmosaik'], f => _u(f) || f[3] === 'glanz'],
  ['klinker', 'Klinker & Cotto', ['klinker', 'cotto', 'riemchen'], f => ['Terracotta', 'rot', 'sand', 'beige', 'taupe', 'grau', 'anthrazit', 'schwarz'].includes(f[0])],
  ['becken', 'Schwimmbad', ['schwimmbad'], f => ['weiß matt', 'Beckenblau', 'hellblau', 'türkis', 'dunkelblau', 'hellgrau', 'grau', 'anthrazit'].includes(f[0])],
  ['aussen', 'Außen 2 cm', ['aussen'], f => f[3] === 'beton' || ['Travertin', 'Schiefer', 'grau', 'anthrazit', 'sand', 'greige'].includes(f[0]), 'beton'],
];
const DUSCHEN = ['dusche', 'walkin', 'reihendusche', 'duschtasse', 'duschviertel'];
const SCHRITTE = [[1, 'Raum'], [2, 'Fliese'], [3, 'Verlegung'], [4, 'Wände'], [5, 'Dusche & Abdichtung'], [6, 'Mengen & Plan']];
const TEIL = { 'Verlegemuster & Richtung': 'verlegung', 'Startpunkt (Fugenkreuz)': 'verlegung', 'Fugen': 'verlegung', 'Kanten, Verlegeart & Kleber': 'verlegung', 'Höhe & Fugenlage Wände': 'waende', 'Höhe & Fugenlage dieser Wand': 'waende', 'Zweiteilung': 'waende', 'Bordüre / Fries': 'flaeche', 'Mengen & Kosten (Raum)': 'mengen', 'Übertragen & Entfernen': 'mengen' };
export function istOffen() { return !!offen; }

/** Fliesen-Studio öffnen. opt: { roomId, ziel, onClose } */
export function openStudio(app, opt = {}) {
  if (offen) offen.schliessen();
  const st = new Studio(app, opt); offen = st; return st;
}

class Studio {
  constructor(app, opt) {
    this.app = app; this.opt = opt; this.doc = app.doc;
    try { if (app.seiteFlug) app.seiteFlug(false); } catch (e) { }
    const rooms = this.rooms();
    this.roomId = opt.roomId && this.doc.byId(opt.roomId) ? opt.roomId : (rooms.find(r => r.tiles && (r.tiles.boden || r.tiles.wand)) || rooms[0] || {}).id;
    this.ziel = opt.ziel || 'boden'; if (this.room && this.room.type === 'tilezone') this.ziel = 'zone';
    this.tab = this.doc.p.tileLib.some(t => t.quelle === 'lv' || t.pos) && !this.doc.p.tileLib.some(t => this.verwendet(t).length) ? 'lv' : (this.doc.p.tileLib.length ? 'projekt' : 'katalog');
    this.katId = K.KATEGORIEN[0].id; this.katFarbe = K.FARBEN[8]; this.katOber = ''; this.katR = '';
    this.ansicht = 'auto'; this.mode = 'plan'; this.edit = null; this.suche = '';
    this.ov = h('div', { class: 'fs-ov', 'data-hilfe': 'fliesenstudio' });
    this.box = h('div', { class: 'fs-box' }); ap(this.ov, this.box);
    this.kopf = h('div', { class: 'fs-kopf' });
    this.links = h('div', { class: 'fs-links' }); this.mitte = h('div', { class: 'fs-mitte' }); this.rechts = h('div', { class: 'fs-rechts' });
    this.vorschauKopf = h('div', { class: 'fs-vk' }); this.vorschau = h('div', { class: 'fs-vorschau' });
    this.wahl = h('div', { class: 'fs-wahl' });
    // Entwurf F1 „Schritt für Schritt“ (Thomas 22.11.2026): Schritte oben, Vorschau links, immer nur ein Schritt rechts
    this.schritt = opt.schritt || 2; this.leiste = h('div', { class: 'fs-schritte', 'data-tw': 'fs-schritte' }); this.panel = h('div', { class: 'fs-panel', 'data-tw': 'fs-panel' });
    ap(this.mitte, this.vorschauKopf, this.vorschau);
    ap(this.box, this.kopf, this.leiste, h('div', { class: 'fs-body f1' }, this.mitte, this.panel));
    ap(document.body, this.ov); document.body.classList.add('studio-open');
    this.onKey = (e) => { if (e.key === 'Escape' && document.getElementById('modal').classList.contains('hidden')) { e.preventDefault(); e.stopPropagation(); this.schliessen(); } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !/INPUT|TEXTAREA|SELECT/.test((e.target || {}).tagName || '')) { e.preventDefault(); e.stopPropagation(); if (e.shiftKey) app.redo(); else app.undo(); this.alles(); } };
    window.addEventListener('keydown', this.onKey, true);
    this.alles();
    app.studio = this;
  }
  schliessen() {
    window.removeEventListener('keydown', this.onKey, true);
    if (this.plan && this.plan._ro) this.plan._ro.disconnect();
    this.ov.remove(); document.body.classList.remove('studio-open'); offen = null; this.app.studio = null;
    this.app.redraw && this.app.redraw(); if (this.app.views && this.app.views.fliesen) { /* */ }
    if (this.opt.onClose) this.opt.onClose();
  }
  /* ───────── Daten ───────── */
  rooms() { const d = this.doc; return d.p.storeys.flatMap(s => d.all('room', s.id).filter(r => r.poly)).concat(d.p.elements.filter(e => e.type === 'tilezone')); }
  get room() { return this.doc.byId(this.roomId); }
  istZone() { return this.room && this.room.type === 'tilezone'; }
  raumName(r) { return r.type === 'tilezone' ? (r.name || 'Fliesenfläche') : `${r.nr ? r.nr + ' ' : ''}${r.name || 'Raum'}`; }
  waende() { const r = this.room; if (!r || this.istZone()) return []; try { return wallSurfaces(this.doc, r); } catch (e) { return []; } }
  /** Einstellungs-Objekt eines Ziels (ggf. anlegen) */
  cfg(ziel = this.ziel, anlegen = false) {
    const r = this.room; if (!r) return null;
    if (ziel === 'zone') { if (!r.tiles && anlegen) r.tiles = T.defaultTileCfg(Object.assign({ aktiv: true }, BODEN_STD)); return r.tiles; }
    if (!r.tiles) { if (!anlegen) return null; r.tiles = {}; }
    const t = r.tiles;
    if (ziel === 'boden') { if (!t.boden && anlegen) t.boden = T.defaultTileCfg(Object.assign({ aktiv: true }, BODEN_STD)); return t.boden; }
    if (ziel === 'wand') { if (!t.wand && anlegen) t.wand = T.defaultTileCfg(Object.assign({ aktiv: true }, WAND_STD)); return t.wand; }
    if (ziel === 'sockel') { if (!t.sockel && anlegen) t.sockel = { aktiv: true, hoehe: 60, quelle: t.boden && t.boden.aktiv ? 'boden' : 'eigen', L: 600, B: 60, fuge: 3, name: 'Sockel 6×60', farbe: t.boden ? t.boden.farbe : '#9ca3af', reserve: 10 }; return t.sockel; }
    if (ziel === 'rand') { const b = this.cfg('boden', anlegen); if (!b) return null; if (!b.rand && anlegen) b.rand = { aktiv: true, breite: 150, eigeneFliese: true, L: 300, B: 150, fuge: b.fuge, farbe: '#4d5258', textur: 'uni', name: 'Randfries 15×30', verband: 'kreuz' }; return b.rand; }
    if (ziel === 'oben' || ziel === 'fries') { const w = this.cfg('wand', anlegen); if (!w) return null;
      if (ziel === 'oben' && !w.oben && anlegen) w.oben = { aktiv: true, ab: 1200, L: 600, B: 300, fuge: w.fuge, farbe: '#ecebe7', textur: 'glanz', name: 'Wandfliese oben 30×60', verband: w.verband };
      if (ziel === 'fries' && !w.fries && anlegen) w.fries = { aktiv: true, z: 1200, breite: 50, L: 250, fuge: w.fuge, farbe: '#4d5258', name: 'Bordüre 5×25' };
      return ziel === 'oben' ? w.oben : w.fries; }
    if (ziel.startsWith('wand:')) { const w = this.cfg('wand', anlegen); if (!w) return null; const k = +ziel.slice(5); w.einzeln = w.einzeln || {}; if (!w.einzeln[k] && anlegen) w.einzeln[k] = {}; return w.einzeln[k] || null; }
    if (ziel.startsWith('bt:')) { const sy = this.doc.byId(ziel.slice(3)); if (!sy) return null; if (!sy.fliesen && anlegen) { const d = K.BAUTEIL_FLIESEN[sy.kind] || {}; sy.fliesen = { aktiv: true, hoehe: d.h, oben: d.oben, eigeneFliese: false }; } return sy.fliesen || null; }
    return null;
  }
  bauteile() { return this.istZone() ? [] : raumBauteile(this.doc, this.room); }
  /** wirksame Fliese eines Ziels (für Anzeige) */
  fliese(ziel = this.ziel) {
    const c = this.cfg(ziel); const r = this.room; if (!r) return null;
    if (ziel.startsWith('wand:')) { const w = this.cfg('wand'); if (!w) return null; return c && c.eigeneFliese ? Object.assign({}, w, c) : w; }
    if (ziel.startsWith('bt:')) { const w = this.cfg('wand'); if (c && c.eigeneFliese) return Object.assign({}, w || {}, c); return w || null; }
    if (ziel === 'sockel' && c && c.quelle === 'boden') return this.cfg('boden') || c;
    if (ziel === 'rand' && c && c.eigeneFliese === false) return this.cfg('boden');
    return c;
  }
  aktiv(ziel) {
    const c = this.cfg(ziel);
    if (ziel.startsWith('wand:')) { const w = this.cfg('wand'); return !!(w && w.aktiv && (!c || c.aktiv !== false)); }
    if (!c) return false;
    if (ziel === 'rand' || ziel === 'oben' || ziel === 'fries') { const p = this.cfg(ziel === 'rand' ? 'boden' : 'wand'); return !!(p && p.aktiv && c.aktiv); }
    return !!c.aktiv;
  }
  zielName(z = this.ziel) { if (z.startsWith('bt:')) { const sy = this.doc.byId(z.slice(3)); return sy ? (sy.name || (K.BAUTEIL_FLIESEN[sy.kind] || {}).name || 'Bauteil') : 'Bauteil'; } if (z.startsWith('wand:')) { const k = +z.slice(5); const s = this.waende()[k]; return `Wand ${k + 1}` + (s ? ` (${G.fmtCm(s.len)} cm)` : ''); } if (z === 'zone') return 'Fliesenfläche'; return K.ZIEL_NAME[z] || z; }
  ch(label, fn, neu = true) {
    try { this.doc.change(label, fn); } catch (e) { console.error(e); this.app.toast('Fehler: ' + e.message, true); }
    if (neu) this.alles();
  }
  verwendet(t) {
    const out = []; if (!t) return out;
    const passt = (c) => c && c.aktiv !== false && (c.libId === t.id || (!c.libId && c.name && c.name === t.name && c.L === t.L && c.B === t.B));
    for (const r of this.rooms()) {
      const nm = this.raumName(r); const tt = r.tiles; if (!tt) continue;
      if (r.type === 'tilezone') { if (passt(tt)) out.push(nm); continue; }
      if (tt.boden && tt.boden.aktiv && passt(tt.boden)) out.push(nm + ' Boden');
      if (tt.boden && tt.boden.rand && tt.boden.rand.aktiv && passt(tt.boden.rand)) out.push(nm + ' Randfries');
      if (tt.wand && tt.wand.aktiv && passt(tt.wand)) out.push(nm + ' Wand');
      if (tt.wand && tt.wand.oben && tt.wand.oben.aktiv && passt(tt.wand.oben)) out.push(nm + ' Wand oben');
      if (tt.wand && tt.wand.einzeln) for (const [k, v] of Object.entries(tt.wand.einzeln)) if (v && v.eigeneFliese && passt(v)) out.push(nm + ' Wand ' + (+k + 1));
      if (tt.sockel && tt.sockel.aktiv && tt.sockel.quelle !== 'boden' && passt(tt.sockel)) out.push(nm + ' Sockel');
      if (r.type === 'room') for (const sy of raumBauteile(this.doc, r)) if (sy.fliesen && sy.fliesen.aktiv && sy.fliesen.eigeneFliese && passt(sy.fliesen)) out.push(nm + ' ' + (sy.name || K.BAUTEIL_FLIESEN[sy.kind].name));
    }
    return out;
  }
  /** Fliese (aus Bibliothek/Katalog) dem aktuellen Ziel zuweisen */
  zuweisen(t, ziel = this.ziel) {
    const r = this.room; if (!r) return;
    this.ch('Fliese: ' + (t.name || ''), () => {
      const c = this.cfg(ziel, true);
      for (const k of K.FLIESEN_FELDER) if (t[k] !== undefined && t[k] !== '' && k !== 'bereich') c[k] = clone(t[k]);
      if (!t.libId && t.id) c.libId = t.id;
      if (t.verband && !c._verbandVonHand && ziel !== 'fries' && ziel !== 'sockel') c.verband = t.verband;
      if (!c.fugeFarbe && t.fugeFarbe) c.fugeFarbe = t.fugeFarbe;
      c.aktiv = true;
      if (ziel.startsWith('wand:')) { c.eigeneFliese = true; c.aktiv = true; const w = this.cfg('wand', true); w.aktiv = true; }
      if (ziel === 'sockel') { c.quelle = 'eigen'; if (t.sockelH) c.hoehe = t.sockelH; else if (t.bereich === 'sockel') c.hoehe = Math.min(t.L, t.B); }
      if (ziel === 'rand') { c.eigeneFliese = true; const b = this.cfg('boden', true); b.aktiv = true; }
      if (ziel === 'oben' || ziel === 'fries') { const w = this.cfg('wand', true); w.aktiv = true; }
      if (ziel === 'fries' && !c.breite) c.breite = Math.min(t.L, t.B);
      if (ziel.startsWith('bt:')) c.eigeneFliese = true;
    });
    this.app.toast(`${this.zielName(ziel)}: ${t.name || 'Fliese'} ✓`);
  }
  /** Bibliotheksfliese ändern → in allen Räumen übernehmen */
  libAendern(t, fn) {
    this.ch('Fliese bearbeiten', () => {
      fn(t);
      const upd = (c) => { if (c && c.libId === t.id) for (const k of K.FLIESEN_FELDER) if (k !== 'libId' && k !== 'bereich' && t[k] !== undefined) c[k] = clone(t[k]); };
      for (const r of this.rooms()) { const tt = r.tiles; if (!tt) continue; if (r.type === 'tilezone') { upd(tt); continue; } upd(tt.boden); upd(tt.boden && tt.boden.rand); upd(tt.wand); upd(tt.wand && tt.wand.oben); upd(tt.wand && tt.wand.fries); upd(tt.sockel); if (r.type === 'room') raumBauteile(this.doc, r).forEach(sy => upd(sy.fliesen)); if (tt.wand && tt.wand.einzeln) Object.values(tt.wand.einzeln).forEach(upd); }
    });
  }
  libNeu(t) {
    const lib = this.doc.p.tileLib;
    const gleich = lib.find(x => x.L === t.L && x.B === t.B && (x.farbe || '') === (t.farbe || '') && (x.material || '') === (t.material || '') && (x.name || '') === (t.name || ''));
    if (gleich) return gleich;
    const n = Object.assign({ id: uid('t') }, t); this.doc.change('Fliese in Bibliothek', () => lib.push(n)); return n;
  }
  /* ───────── Aufbau ───────── */
  alles() {
    const sc = [this.links, this.wahl.querySelector('.fs-liste'), this.rechts].map(e => e ? e.scrollTop : 0);
    if (!this.room && this.app.raeumeErkennen) { const n = this.app.raeumeErkennen(); if (n) { const r0 = this.rooms()[0]; if (r0) this.roomId = r0.id; this.app.toast(n === 1 ? 'Ein Raum aus den Wänden erkannt.' : `${n} Räume aus den Wänden erkannt.`); } }
    if (!this.room) { this.kopfBauen(); this.links.innerHTML = ''; ap(this.links, h('div', { class: 'note' }, 'Noch kein Raum: Die Wände umschließen noch keinen Bereich. Wandecken im Grundriss schließen (Wand an Wand ansetzen) – dann erkennt das Fliesen-Studio den Raum von selbst.')); this.rechts.innerHTML = ''; this.wahl.innerHTML = ''; return; }
    const psc = this.panel.scrollTop;
    this.kopfBauen(); this.linksBauen(); this.wahlBauen(); this.rechtsBauen(); this.vorschauBauen(); this.schrittBauen(); this.vorschauExtra();
    requestAnimationFrame(() => { this.panel.scrollTop = psc; });
  }
  kopfBauen() {
    const k = this.kopf; k.innerHTML = '';
    const sel = h('select', { class: 'fs-raum', title: 'Raum wechseln', onchange: () => { this.roomId = sel.value; if (this.istZone()) this.ziel = 'zone'; else if (this.ziel === 'zone') this.ziel = 'boden'; this.planNeu = true; this.alles(); } });
    for (const r of this.rooms()) { const st = this.doc.storeyById(r.storey); ap(sel, h('option', { value: r.id, selected: r.id === this.roomId }, this.raumName(r) + (st && this.doc.p.storeys.length > 1 ? ` · ${st.name}` : ''))); }
    ap(k, h('b', { class: 'fs-titel' }, '🧱 Fliesen-Studio'), sel,
      h('span', { class: 'fs-hinweis' }),
      h('button', { class: 'btn sm', title: 'Rückgängig (Strg+Z)', onclick: () => { this.app.undo(); this.alles(); } }, '↶'),
      h('button', { class: 'btn sm', title: 'Wiederholen', onclick: () => { this.app.redo(); this.alles(); } }, '↷'),
      h('button', { class: 'btn sm', onclick: () => this.materialliste() }, '📋 Materialliste'),
      h('button', { class: 'btn sm', onclick: () => this.pdf() }, '📄 Verlegeplan PDF'),
      !this.istZone() ? h('button', { class: 'btn sm', title: 'Raum in 3D von innen ansehen – Boden, Wände, Vorwände', onclick: async () => { const id = this.roomId; const app = this.app; this.schliessen(); await app.setMode('3d'); for (let i = 0; i < 40 && !(app.modeView && app.modeView.raumInnen); i++) await new Promise(r => setTimeout(r, 100)); setTimeout(() => app.modeView && app.modeView.raumInnen && app.modeView.raumInnen(id), 300); } }, '🧊 3D von innen') : null,
      h('button', { class: 'ib help', title: 'Hilfe zum Fliesen-Studio', onclick: () => import('./help.js?v=20261123-0837').then(H => H.open('fliesenstudio')) }, '?'),
      h('button', { class: 'btn', 'data-fs': 'fertig', onclick: () => this.schliessen() }, '✓ Fertig'));
  }
  /* ── links: Wohin? ── */
  linksBauen() {
    const L = this.links; L.innerHTML = ''; const r = this.room;
    ap(L, h('div', { class: 'fs-l nur1' }, 'Welche Flächen im Raum werden gefliest?'));
    const knopf = (z, icon, label, sub, eingerueckt = false) => {
      const f = this.fliese(z); const an = this.aktiv(z);
      return h('button', { class: 'fs-ziel' + (this.ziel === z ? ' an' : '') + (eingerueckt ? ' ein' : '') + (an ? '' : ' aus') + (['boden', 'rand', 'sockel', 'zone'].includes(z) ? ' nur1' : ''), 'data-ziel': z, onclick: () => { this.ziel = z; this.edit = null; this.alles(); } },
        h('span', { class: 'fs-sw' }, an && f ? swatch(f, 34) : h('span', { class: 'fs-leer' }, icon)),
        h('span', { class: 'fs-zt' }, h('b', {}, label), h('small', {}, an && f ? `${f.name || 'Fliese'} · ${K.formatText(f)}${sub ? ' · ' + sub : ''}` : (sub || 'nicht gefliest'))));
    };
    if (this.istZone()) { ap(L, knopf('zone', '▦', 'Fliesenfläche', '')); return this.linksRaumInfo(L); }
    ap(L, knopf('boden', '⬛', 'Boden', ''));
    ap(L, knopf('rand', '▣', 'Randfries / Bordüre Boden', this.aktiv('rand') ? `${G.fmtCm(this.cfg('rand').breite)} cm breit` : 'optional', true));
    ap(L, knopf('wand', '▭', 'Alle Wände', this.aktiv('wand') ? (this.cfg('wand').hoehe === 'tuer' ? 'bis Türhöhe' : this.cfg('wand').hoehe > 0 ? `bis ${G.fmtCm(this.cfg('wand').hoehe)} cm` : 'raumhoch') : ''));
    const ws = this.waende();
    if (ws.length) {
      const grid = h('div', { class: 'fs-wandgrid' });
      ws.forEach((s, k) => {
        const z = 'wand:' + k; const c = this.cfg(z); const w = this.cfg('wand'); const an = this.aktiv(z); const f = this.fliese(z);
        const eig = c && (c.eigeneFliese || c.hoehe !== undefined);
        ap(grid, h('button', { class: 'fs-wand' + (this.ziel === z ? ' an' : '') + (an ? '' : ' aus'), 'data-ziel': z, title: `Wand ${k + 1}: ${G.fmtCm(s.len)} cm${s.openings.length ? ' · ' + s.openings.length + ' Öffnung(en)' : ''}`, onclick: () => { this.ziel = z; this.alles(); } },
          h('span', { class: 'fs-wsw', style: `background:${an && f ? f.farbe : 'transparent'}` }), h('b', {}, `W${k + 1}`), h('small', {}, G.fmtCm(s.len)), eig ? h('i', {}, '✎') : null, !w || !w.aktiv ? null : null));
      });
      ap(L, h('div', { class: 'fs-sub' }, 'Jede Wand einzeln (antippen):'), grid);
    }
    ap(L, knopf('oben', '⬒', 'Wand oben – 2. Fliese', this.aktiv('oben') ? `ab ${G.fmtCm(this.cfg('oben').ab)} cm` : 'optional', true));
    ap(L, knopf('fries', '═', 'Bordüre / Fries Wand', this.aktiv('fries') ? `auf ${G.fmtCm(this.cfg('fries').z)} cm` : 'optional', true));
    const bts = this.bauteile();
    if (bts.length) {
      ap(L, h('div', { class: 'fs-sub' }, 'Bauteile im Raum (Vorwand, Schacht, Wanne …):'));
      for (const sy of bts) { const d = K.BAUTEIL_FLIESEN[sy.kind]; const c = sy.fliesen; ap(L, knopf('bt:' + sy.id, d.icon, (sy.name || d.name) + ` ${G.fmtCm(sy.w)}×${G.fmtCm(sy.d)}`, c && c.aktiv ? `Höhe ${c.hoehe > 0 ? G.fmtCm(c.hoehe) + ' cm' : 'raumhoch'}${c.eigeneFliese ? '' : ' · wie Wand'}` : 'nicht gefliest', true)); }
    }
    ap(L, knopf('sockel', '▁', 'Sockel', this.aktiv('sockel') ? `${G.fmtCm(this.cfg('sockel').hoehe)} cm${this.cfg('sockel').quelle === 'boden' ? ' aus Bodenfliese' : ''}` : 'wo nicht gefliest'));
    this.linksRaumInfo(L);
  }
  linksRaumInfo(L) {
    const r = this.room; const doc = this.doc;
    let fl = 0, um = 0; if (r.poly) { fl = G.polyArea(r.poly) / 1e6; um = G.polyPerimeter(r.poly) / 1000; }
    const kv = h('div', { class: 'kv', style: 'margin-top:6px' }, h('span', {}, 'Fläche'), h('b', {}, m2(fl)), h('span', {}, 'Umfang'), h('b', {}, zahl(um) + ' m'));
    if (!this.istZone()) { const st = doc.storeyById(r.storey); ap(kv, h('span', {}, 'Raumhöhe'), h('b', {}, G.fmtCm(r.height || (st && st.roomHeight) || 2500) + ' cm')); const ws = this.waende(); ap(kv, h('span', {}, 'Wände / Öffnungen'), h('b', {}, `${ws.length} / ${ws.reduce((a, s) => a + s.openings.length, 0)}`)); }
    ap(L, h('div', { class: 'fs-l nur1', style: 'margin-top:16px' }, 'Raum'), h('div', { class: 'nur1' }, kv));
    const rooms = this.rooms(); const i = rooms.findIndex(x => x.id === this.roomId);
    ap(L, h('div', { class: 'btns nur1', style: 'margin-top:10px' },
      h('button', { class: 'btn sm', disabled: i <= 0, onclick: () => { this.roomId = rooms[i - 1].id; if (this.istZone()) this.ziel = 'zone'; else if (this.ziel === 'zone') this.ziel = 'boden'; this.planNeu = true; this.alles(); } }, '◀ voriger Raum'),
      h('button', { class: 'btn sm', disabled: i >= rooms.length - 1, onclick: () => { this.roomId = rooms[i + 1].id; if (this.istZone()) this.ziel = 'zone'; else if (this.ziel === 'zone') this.ziel = 'boden'; this.planNeu = true; this.alles(); } }, 'nächster Raum ▶')));
  }
  /* ── Mitte: Vorschau ── */
  vorschauBauen() {
    const vk = this.vorschauKopf; vk.innerHTML = '';
    const seg = (vals, get, set) => { const s = h('div', { class: 'seg' }); for (const [v, l] of vals) ap(s, h('button', { class: get() === v ? 'on' : '', onclick: () => { set(v); this.vorschauBauen(); } }, l)); return s; };
    if (!this.istZone()) ap(vk, seg([['auto', 'Auto'], ['boden', 'Boden'], ['wand', 'Wände'], ['beides', 'Beides']], () => this.ansicht, v => { this.ansicht = v; this.planNeu = true; }));
    ap(vk, seg([['plan', 'Verlegeplan'], ['kunde', 'Kundenansicht']], () => this.mode, v => { this.mode = v; }));
    ap(vk, h('button', { class: 'btn sm', onclick: () => this.plan && this.plan.fit() }, '⤢ Einpassen'));
    ap(vk, h('button', { class: 'btn sm', title: 'Vorschau größer/kleiner', onclick: () => { this.gross = !this.gross; this.vorschau.classList.toggle('gross', this.gross); this.vorschauBauen(); setTimeout(() => this.plan && this.plan.fit(), 60); } }, this.gross ? '⇱ Vorschau klein' : '⇲ Vorschau groß'));
    ap(vk, h('span', { class: 'fs-legende' }, h('i', { style: 'background:#fff' }), 'ganz', h('i', { style: 'background:#dbeafe' }), '≥ ½', h('i', { style: 'background:#fde68a' }), '< ½', h('i', { style: 'background:#fca5a5' }), 'zu klein', h('b', { style: 'color:#dc2626' }, ' ⊕'), ' Startpunkt ziehen'));
    const fl = this.istZone() ? 'boden' : this.ansicht !== 'auto' ? this.ansicht : (['boden', 'rand'].includes(this.ziel) ? 'boden' : 'wand');
    if (!this.plan || this.plan.roomId !== this.roomId || this.planNeu) {
      if (this.plan && this.plan._ro) this.plan._ro.disconnect();
      this.vorschau.innerHTML = '';
      this.plan = mountPlanEmbedded(this.app, this.vorschau, { roomId: this.roomId, flaeche: fl, mode: this.mode, onChange: () => this.alles() });
      this.plan.hervor = this.hervor(); this.plan.draw();
      this.planNeu = false;
    } else {
      const neuFl = this.plan.flaeche !== fl; this.plan.flaeche = fl; this.plan.mode = this.mode; this.plan.hervor = this.hervor(); this.plan.refresh(); if (neuFl) this.plan.fit();
    }
  }
  vorschauExtra() {
    const ov = this.vorschau.querySelector('.fs-abd-bild'); if (ov) ov.remove();
    if (this.plan) { const zw = this.schritt === 4 && this.ziel.startsWith('wand:') ? +this.ziel.slice(5) : null; if (this.plan.zoomWand !== zw) { this.plan.zoomWand = zw; setTimeout(() => this.plan && this.plan.fit(), 30); } }
    if (this.schritt === 5 && this.room && !this.istZone()) {
      const box = h('div', { class: 'fs-abd-bild', 'data-tw': 'abd-bild' }); const cv = h('canvas', {}); ap(box, cv); ap(this.vorschau, box);
      requestAnimationFrame(() => { try { abdBild(cv, this.room, this.abdRechnen()); } catch (e) { console.error(e); } });
    }
  }
  hervor() { const z = this.ziel; if (z.startsWith('wand:')) return { wand: +z.slice(5) }; if (z.startsWith('bt:')) return { bt: z.slice(3) }; return null; }
  /* ── Mitte: Welche Fliese? ── */
  wahlBauen() {
    const W0 = this.wahl; W0.innerHTML = '';
    const lib = this.doc.p.tileLib; const lv = lib.filter(t => t.quelle === 'lv' || t.pos);
    const tabs = h('div', { class: 'fs-tabs' }, h('span', { class: 'fs-l' }, `② Welche Fliese? → ${this.zielName()}`));
    if (this.tab === 'lv' && einstieg()) this.tab = lib.length ? 'projekt' : 'katalog';
    for (const [id, l] of [['projekt', `Im Projekt (${lib.length})`], ['lv', `📋 Aus dem LV (${lv.length})`], ['katalog', '📚 Bibliothek'], ['eigene', FREI ? '✎ Eigene / Foto' : '✎ Eigene / Foto / Internet']]) ap(tabs, h('button', { class: 'fs-tab' + (this.tab === id ? ' an' : ''), 'data-tab': id, 'data-stufe': id === 'lv' ? 'profi' : null, onclick: () => { this.tab = id; this.edit = null; this.wahlBauen(); } }, l));
    const liste = h('div', { class: 'fs-liste' });
    ap(W0, tabs, liste);
    if (this.ziel === 'sockel' && this.cfg('sockel') && this.cfg('sockel').quelle === 'boden') ap(liste, h('div', { class: 'note' }, 'Der Sockel wird aus der Bodenfliese geschnitten. Eine eigene Sockelfliese antippen = Sockel aus dieser Fliese.'));
    if (this.tab === 'projekt') return this.tabProjekt(liste, lib);
    if (this.tab === 'lv') return this.tabLV(liste, lv);
    if (this.tab === 'katalog') return this.tabKatalog(liste);
    return this.tabEigene(liste);
  }
  karte(t, opt = {}) {
    const akt = this.fliese(); const istAkt = akt && (akt.libId === t.id || (akt.name === t.name && akt.L === t.L && akt.B === t.B && akt.farbe === t.farbe));
    const nutz = this.verwendet(t);
    const info = [K.formatText(t) + ' cm', t.fuge ? 'Fuge ' + zahl(t.fuge, t.fuge % 1 ? 1 : 0) + ' mm' : '', (K.MATERIALIEN.find(m => m[0] === t.material) || [0, ''])[1], t.oberflaeche ? (K.OBERFLAECHEN.find(m => m[0] === t.oberflaeche) || [0, t.oberflaeche])[1] : '', t.rutsch, t.hersteller, t.serie, t.preisM2 ? eur(t.preisM2) + '/m²' : ''].filter(Boolean).join(' · ');
    const k = h('div', { class: 'fs-karte' + (istAkt ? ' an' : ''), 'data-lib': t.id || '' },
      h('button', { class: 'fs-wahlknopf', title: 'Für „' + this.zielName() + '“ übernehmen', onclick: () => this.zuweisen(t) },
        swatch(t, 56),
        h('span', { class: 'fs-kt' },
          h('b', {}, (t.pos ? 'Pos. ' + t.pos + ' · ' : '') + (t.name || 'Fliese')),
          h('small', {}, info),
          t.bereich ? h('span', { class: 'fs-badge b-' + t.bereich }, { boden: 'Boden', wand: 'Wand', sockel: 'Sockel', vorwand: 'Vorwand', dusche: 'Dusche', treppe: 'Treppe', aussen: 'Außen' }[t.bereich] || t.bereich) : null,
          t.menge ? h('span', { class: 'fs-badge' }, `LV: ${zahl(t.menge, t.menge % 1 ? 2 : 0)} ${t.einheit || ''}`) : null,
          nutz.length ? h('small', { class: 'fs-nutz' }, '✓ ' + nutz.slice(0, 4).join(', ') + (nutz.length > 4 ? ` +${nutz.length - 4}` : '')) : null),
        h('span', { class: 'fs-pfeil' }, istAkt ? '✓' : '→')),
      opt.edit === false ? null : h('div', { class: 'fs-kbtn' },
        h('button', { class: 'btn sm', title: 'bearbeiten', onclick: () => { this.edit = this.edit === t.id ? null : t.id; this.wahlBauen(); } }, '✎'),
        h('button', { class: 'btn sm', title: 'kopieren (z. B. andere Farbe)', onclick: () => { const n = Object.assign(clone(t), { id: uid('t'), name: (t.name || 'Fliese') + ' (Kopie)', pos: '' }); this.ch('Fliese kopieren', () => this.doc.p.tileLib.push(n), false); this.edit = n.id; this.wahlBauen(); } }, '⧉'),
        h('button', { class: 'btn sm red', title: nutz.length ? 'wird verwendet – erst in den Räumen ersetzen' : 'aus Bibliothek löschen', disabled: nutz.length > 0, onclick: () => this.ch('Fliese löschen', () => { const l = this.doc.p.tileLib; const i = l.indexOf(t); if (i >= 0) l.splice(i, 1); }) }, '🗑')));
    if (this.edit === t.id) ap(k, this.editor(t));
    return k;
  }
  tabProjekt(liste, lib) {
    const such = h('input', { type: 'search', class: 'fs-such', placeholder: 'Suchen (Name, Hersteller, Format, Farbe) …', value: this.suche, oninput: () => { this.suche = such.value; this.listeFiltern(liste); } });
    ap(liste, h('div', { class: 'fs-zeile' }, such, h('button', { class: 'btn sm', onclick: () => { this.tab = 'katalog'; this.wahlBauen(); } }, '+ aus Katalog'), h('button', { class: 'btn sm', onclick: () => { this.tab = 'eigene'; this.wahlBauen(); } }, '+ eigene Fliese')));
    if (!lib.length) ap(liste, h('div', { class: 'note' }, 'Noch keine Fliesen im Projekt. Aus dem LV übernehmen, im Katalog antippen oder eine eigene Fliese anlegen.'));
    const gr = [['boden', 'Boden'], ['wand', 'Wand'], ['sockel', 'Sockel'], ['', 'Sonstige']];
    for (const [b, l] of gr) {
      const ts = lib.filter(t => b ? t.bereich === b : !['boden', 'wand', 'sockel'].includes(t.bereich)); if (!ts.length) continue;
      ap(liste, h('div', { class: 'fs-gruppe' }, l));
      for (const t of ts) ap(liste, this.karte(t));
    }
    this.listeFiltern(liste);
  }
  listeFiltern(liste) {
    const q = this.suche.trim().toLowerCase(); for (const k of liste.querySelectorAll('.fs-karte')) k.style.display = !q || k.textContent.toLowerCase().includes(q) ? '' : 'none';
  }
  tabLV(liste, lv) {
    const meta = this.doc.p.meta || {};
    ap(liste, h('div', { class: 'fs-zeile wrap' },
      FREI ? null : h('button', { class: 'btn sm pri', onclick: () => this.lvDatei() }, '📄 LV-Datei lesen (KI)'),
      meta.baustelle && !FREI ? h('button', { class: 'btn sm', onclick: () => this.lvDrive() }, '☁ LV aus Baustellen-Ordner') : null,
      h('button', { class: 'btn sm', onclick: () => this.lvText() }, '📋 LV-Text einfügen (ohne KI)'),
      lv.length ? h('button', { class: 'btn sm', 'data-fs': 'auto', onclick: () => this.autoBelegen() }, '⚡ Alle Räume automatisch belegen') : null));
    if (!lv.length && FREI) { ap(liste, h('div', { class: 'note' }, 'Noch keine Fliesen aus einem Leistungsverzeichnis. Kopiere den LV-Text (aus PDF oder GAEB als Text) über „LV-Text einfügen“ hinein – Positionen mit Format, Hersteller, Farbe, Rutschhemmung und Bereich (Boden/Wand/Sockel) werden erkannt.')); return; }
    if (!lv.length) { ap(liste, h('div', { class: 'note' }, 'Noch keine Fliesen aus dem LV. Wege: LV-Datei (PDF/GAEB) von der KI lesen lassen, direkt aus dem Baustellen-Ordner holen oder den LV-Text hineinkopieren – die Fliesenpositionen mit Format, Hersteller, Farbe, Rutschhemmung und Bereich (Boden/Wand/Sockel) werden erkannt.')); return; }
    ap(liste, h('div', { class: 'muted', style: 'margin:4px 0 8px' }, 'Antippen = für „' + this.zielName() + '“ übernehmen. „Automatisch belegen“: Boden ← Bodenfliese, Wände ← Wandfliese, Sockel ← Sockelposition; passt der Raumname zu einer Position (z. B. „Bad“), wird diese genommen.'));
    for (const t of lv) ap(liste, this.karte(t));
  }
  /* ── Fliesen-Bibliothek mit Bildern (Thomas 22.11.2026): Optik → Format → Raum → Fliese antippen ── */
  tabBibliothek(liste) {
    const boden = ['boden', 'rand', 'zone', 'sockel'].includes(this.ziel);
    if (!this.bibOptik) this.bibOptik = boden ? 'beton' : 'uni';
    const op = OPTIK.find(o => o[0] === this.bibOptik) || OPTIK[0];
    const kats = op[2].map(id => K.KATEGORIEN.find(k => k.id === id)).filter(Boolean);
    const formate = []; for (const k of kats) for (const f of k.formate) { const key = Math.min(f[0], f[1]) + 'x' + Math.max(f[0], f[1]); if (!formate.some(x => x[0] === key)) formate.push([key, f]); }
    formate.sort((a, b) => a[1][0] * a[1][1] - b[1][0] * b[1][1]);
    const std = boden ? ['60x60', '30x60', '60x120', '20x120'] : ['30x60', '20x60', '7.5x15', '30x90'];
    if (!this.bibFormat || !formate.some(f => f[0] === this.bibFormat)) this.bibFormat = (std.find(s0 => formate.some(f => f[0] === s0)) || (formate[Math.floor(formate.length / 2)] || [''])[0]);
    const chips = (vals, cur, fn, tw) => { const d = h('div', { class: 'fs-chips fs-bibchips' }); for (const [v, l] of vals) ap(d, h('button', { class: 'chip' + (cur === v ? ' on' : ''), 'data-tw': tw ? tw + '-' + v : null, onclick: () => { fn(v); this.wahlBauen(); } }, l)); return d; };
    ap(liste, h('div', { class: 'fs-sub' }, 'Optik'), chips(OPTIK.map(o => [o[0], o[1]]), this.bibOptik, v => { this.bibOptik = v; this.bibFormat = null; }, 'bib-optik'),
      h('div', { class: 'fs-sub' }, 'Format (cm)'), chips(formate.map(([k, f]) => [k, `${K.cm(Math.min(f[0], f[1]) * 10)}×${K.cm(Math.max(f[0], f[1]) * 10)}`]), this.bibFormat, v => { this.bibFormat = v; }, 'bib-format'),
      h('div', { class: 'fs-sub' }, 'Rutschhemmung und Oberfläche'), chips([['', 'wie Fliese'], ['R9', 'R9'], ['R10', 'R10 Bad'], ['R11', 'R11'], ['B', 'B barfuß/Dusche'], ['C', 'C Becken']], this.katR, v => { this.katR = v; }),
      chips([['', 'wie Fliese'], ['matt', 'matt'], ['glaenzend', 'glänzend'], ['poliert', 'poliert'], ['strukturiert', 'strukturiert']], this.katOber, v => { this.katOber = v; }));
    const fm = (formate.find(f => f[0] === this.bibFormat) || formate[0] || [0, [30, 60]])[1];
    const kat = kats.find(k => k.formate.some(f => Math.min(f[0], f[1]) === Math.min(fm[0], fm[1]) && Math.max(f[0], f[1]) === Math.max(fm[0], fm[1]))) || kats[0];
    const extra = {}; if (this.katOber) extra.oberflaeche = this.katOber; if (this.katR) extra.rutsch = this.katR;
    const gitter = h('div', { class: 'fs-bib' });
    for (const f of K.FARBEN.filter(op[3])) {
      const farbe = op[4] && !f[3] ? [f[0], f[1], f[2] || '', op[4]] : f;
      const t = K.ausKatalog(kat, fm, farbe, extra); t.name = (f[0].toLowerCase().includes(op[1].toLowerCase().split(' ')[0]) ? f[0][0].toUpperCase() + f[0].slice(1) : `${op[1].split(' ')[0]} ${f[0]}`) + ` ${K.formatText(t)}`;
      const akt = this.fliese(); const an = akt && akt.L === t.L && akt.B === t.B && akt.farbe === t.farbe && akt.textur === t.textur;
      ap(gitter, h('button', { class: 'fs-bibk' + (an ? ' an' : ''), 'data-tw': 'bib-fliese', title: `${t.name} – für „${this.zielName()}“ übernehmen`, onclick: () => { const n = this.libNeu(t); this.zuweisen(n); } },
        bibBild(t), h('b', {}, t.name), h('small', {}, [K.formatText(t) + ' cm', t.rutsch, (K.OBERFLAECHEN.find(o => o[0] === t.oberflaeche) || [0, ''])[1]].filter(Boolean).join(' · '))));
    }
    ap(liste, h('div', { class: 'fs-sub' }, `Fliese antippen = für „${this.zielName()}“ übernehmen`), gitter,
      h('button', { class: 'btn sm', 'data-tw': 'bib-frei', onclick: () => { this.katFrei = true; this.wahlBauen(); } }, '✎ Sorte, Farbe und Format frei zusammenstellen …'),
      kat && kat.id === 'gross' ? h('div', { class: 'note warn' }, 'Großformat: Untergrund-Ebenheit nach DIN 18202 Zeile 4 prüfen, Buttering-Floating, Kleber C2 S1/S2, Fuge mind. 3 mm, kein Halbverband.') : null,
      kat && kat.matte ? h('div', { class: 'note' }, `Mosaik wird als Einzelsteine gerechnet (Matten meist ${kat.matte / 10}×${kat.matte / 10} cm).`) : null);
  }
  tabKatalog(liste) {
    if (!this.katFrei) return this.tabBibliothek(liste);
    ap(liste, h('button', { class: 'btn sm', style: 'margin-bottom:8px', onclick: () => { this.katFrei = false; this.wahlBauen(); } }, '◀ zurück zur Bibliothek mit Bildern'));
    const kats = h('div', { class: 'fs-kats' });
    for (const k of K.KATEGORIEN) ap(kats, h('button', { class: 'fs-kat' + (this.katId === k.id ? ' an' : ''), onclick: () => { this.katId = k.id; const f = K.FARBEN.find(x => x[3] && x[3] === k.textur); if (f && ['holz', 'marmor', 'beton', 'naturstein', 'schiefer'].includes(k.textur)) this.katFarbe = f; this.wahlBauen(); } }, k.icon + ' ' + k.name));
    const kat = K.KATEGORIEN.find(k => k.id === this.katId) || K.KATEGORIEN[0];
    const farben = h('div', { class: 'fs-farben' });
    for (const f of K.FARBEN) ap(farben, h('button', { class: 'fs-farbe' + (this.katFarbe === f ? ' an' : ''), title: f[0], onclick: () => { this.katFarbe = f; this.wahlBauen(); } }, swatch({ farbe: f[1], farbe2: f[2], textur: f[3] || 'uni', L: 300, B: 300 }, 30), h('small', {}, f[0])));
    const eigF = h('input', { type: 'color', value: this.katFarbe[1], title: 'eigene Farbe', onchange: () => { this.katFarbe = ['eigene Farbe', eigF.value, '', this.katFarbe[3] || '']; this.wahlBauen(); } });
    const ober = h('select', { onchange: () => { this.katOber = ober.value; } }); for (const [v, l] of K.OBERFLAECHEN) ap(ober, h('option', { value: v, selected: v === this.katOber }, v ? l : 'Oberfläche wie Sorte'));
    const rs = h('select', { onchange: () => { this.katR = rs.value; } }); for (const [v, l] of K.RUTSCH) ap(rs, h('option', { value: v, selected: v === this.katR }, v ? l : 'Rutschhemmung wie Sorte'));
    const formate = h('div', { class: 'fs-formate' });
    const extra = () => { const e = {}; if (this.katOber) e.oberflaeche = this.katOber; if (this.katR) e.rutsch = this.katR; return e; };
    for (const fm of kat.formate) {
      const sk = 52 / Math.max(fm[0], fm[1]);
      ap(formate, h('button', { class: 'fs-format', 'data-format': fm.join('x'), title: `${K.cm(fm[0] * 10)}×${K.cm(fm[1] * 10)} cm übernehmen`, onclick: () => { const t = this.libNeu(K.ausKatalog(kat, fm, this.katFarbe, extra())); this.zuweisen(t); } },
        h('span', { class: 'fs-fbox' }, kat.verband === 'sechseck' ? h('span', { style: `width:46px;height:40px;background:${this.katFarbe[1]};border:0;clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)` }) : kat.verband === 'chevron' ? h('span', { style: `width:22px;height:50px;background:${this.katFarbe[1]};border:0;clip-path:polygon(0 0,100% 30%,100% 100%,0 70%)` }) : h('span', { style: `width:${Math.max(5, fm[0] * sk)}px;height:${Math.max(5, fm[1] * sk)}px;background:${this.katFarbe[1]}` })),
        h('b', {}, `${K.cm(fm[0] * 10)}×${K.cm(fm[1] * 10)}`)));
    }
    const eb = h('input', { type: 'number', step: 0.5, placeholder: 'B cm', style: 'width:70px' }), el = h('input', { type: 'number', step: 0.5, placeholder: 'L cm', style: 'width:70px' });
    ap(liste, h('div', { class: 'fs-sub' }, 'Sorte'), kats, h('div', { class: 'fs-sub' }, 'Farbe / Optik ', h('b', {}, this.katFarbe[0]), ' ', eigF), farben,
      h('div', { class: 'fs-zeile wrap' }, ober, rs),
      h('div', { class: 'fs-sub' }, `Format (cm) – antippen = für „${this.zielName()}“ übernehmen`), formate,
      h('div', { class: 'fs-zeile' }, h('span', { class: 'muted' }, 'Eigenes Format:'), eb, h('span', {}, '×'), el, h('button', { class: 'btn sm', onclick: () => { const b = parseFloat(String(eb.value).replace(',', '.')), l = parseFloat(String(el.value).replace(',', '.')); if (!(b > 0 && l > 0)) return this.app.toast('Breite und Länge in cm eingeben', true); const t = this.libNeu(K.ausKatalog(kat, [b, l], this.katFarbe, extra())); this.zuweisen(t); } }, 'übernehmen')),
      kat.matte ? h('div', { class: 'note' }, `Mosaik wird als Einzelsteine gerechnet und gezeichnet (Matten meist ${kat.matte / 10}×${kat.matte / 10} cm). Bestellmenge in m² steht bei den Mengen.`) : null,
      kat.id === 'gross' ? h('div', { class: 'note warn' }, 'Großformat: Untergrund-Ebenheit nach DIN 18202 Zeile 4 prüfen, Buttering-Floating, Kleber C2 S1/S2, Fuge mind. 3 mm, kein Halbverband.') : null);
  }
  tabEigene(liste) {
    const neu = () => { const t = Object.assign({ id: uid('t'), quelle: 'eigen', bereich: ['boden', 'rand'].includes(this.ziel) ? 'boden' : this.ziel === 'sockel' ? 'sockel' : 'wand' }, ['boden', 'rand', 'zone'].includes(this.ziel) ? BODEN_STD : WAND_STD, { name: 'Neue Fliese' }); delete t.hoehe; delete t.xModus; delete t.yModus; this.ch('Neue Fliese', () => this.doc.p.tileLib.push(t), false); this.edit = t.id; this.tab = 'projekt'; this.wahlBauen(); };
    const foto = async () => {
      const f = await this.app.pickFile('image/*'); if (!f) return; const url = await shrinkImage(f, 384);
      const r = await this.app.prompt('Fliese aus Foto', [{ key: 'name', label: 'Bezeichnung', value: 'Fliese (Foto)' }, { key: 'b', label: 'Breite (cm)', value: '30' }, { key: 'l', label: 'Länge (cm)', value: '60' }]); if (!r) return;
      const b = parseFloat(String(r.b).replace(',', '.')) || 30, l = parseFloat(String(r.l).replace(',', '.')) || 60;
      const t = { id: uid('t'), name: r.name || 'Fliese', L: Math.round(Math.max(b, l) * 10), B: Math.round(Math.min(b, l) * 10), fuge: Math.max(b, l) >= 60 ? 3 : 2, bildData: url, textur: 'bild', farbe: await mittelFarbe(url), quelle: 'foto', bereich: ['boden', 'rand'].includes(this.ziel) ? 'boden' : 'wand' };
      this.ch('Fliese aus Foto', () => this.doc.p.tileLib.push(t), false); this.zuweisen(t);
    };
    const internet = async () => {
      const t = { id: uid('t'), name: 'Fliese aus Internet', L: 600, B: 300, fuge: 2, farbe: '#d9d4cc', textur: 'uni', quelle: 'internet', bereich: ['boden', 'rand'].includes(this.ziel) ? 'boden' : 'wand' };
      const M = await import('./ai.js?v=20261123-0837');
      M.searchTile(this.app, t, () => { if (t.hersteller || t.artikel) t.name = [t.hersteller, t.artikel].filter(Boolean).join(' '); this.ch('Fliese aus Internet', () => this.doc.p.tileLib.push(t), false); this.zuweisen(t); });
    };
    ap(liste, 
      h('div', { class: 'fs-gross' },
        h('button', { class: 'fs-grossk', onclick: neu }, h('b', {}, '✎ Neue Fliese anlegen'), h('small', {}, 'alle Angaben selbst eintragen: Hersteller, Serie, Format, Stärke, Farbe, Rutschhemmung, Preis, Paketinhalt …')),
        h('button', { class: 'fs-grossk', onclick: foto }, h('b', {}, '📷 Aus Foto'), h('small', {}, 'Foto der Fliese oder vom Muster – wird in Kundenansicht und 3D verwendet')),
        FREI ? null : h('button', { class: 'fs-grossk', onclick: internet }, h('b', {}, '🔎 Im Internet suchen (KI)'), h('small', {}, 'Hersteller + Serie eingeben, die KI holt Farbe, Optik, Format und – wenn erlaubt – das Produktbild'))));
    const fl = this.fliese(); if (fl && this.aktiv(this.ziel)) {
      ap(liste, h('div', { class: 'fs-sub' }, 'Fliese von „' + this.zielName() + '“ in die Bibliothek aufnehmen (zum Wiederverwenden in anderen Räumen):'),
        h('button', { class: 'btn sm', onclick: () => { const t = {}; for (const k of K.FLIESEN_FELDER) if (fl[k] !== undefined) t[k] = clone(fl[k]); delete t.libId; const n = this.libNeu(t); this.ch('Verknüpfen', () => { this.cfg(this.ziel, true).libId = n.id; }); this.app.toast('In Bibliothek: ' + (n.name || 'Fliese')); } }, '⇩ ' + (fl.name || 'Fliese') + ' aufnehmen'));
    }
  }
  /** Bearbeiten einer Bibliotheksfliese (alle Angaben) */
  editor(t) {
    const box = h('div', { class: 'fs-editor' });
    const set = (k, v) => this.libAendern(t, (x) => { x[k] = v; });
    const inp = (k, label, type = 'text', step) => { const i = h('input', { type, step, value: t[k] ?? '' }); i.onchange = () => set(k, type === 'number' ? (parseFloat(String(i.value).replace(',', '.')) || 0) : i.value); return h('label', { class: 'fs-feld' }, h('span', {}, label), i); };
    const sel = (k, label, vals) => { const s = h('select', {}); for (const [v, l] of vals) ap(s, h('option', { value: v, selected: String(t[k] ?? '') === String(v) }, l)); s.onchange = () => set(k, s.value); return h('label', { class: 'fs-feld' }, h('span', {}, label), s); };
    const chk = (k, label) => { const c = h('input', { type: 'checkbox', checked: !!t[k] }); c.onchange = () => set(k, c.checked); return h('label', { class: 'fs-feld chk' }, c, h('span', {}, label)); };
    const fmt = h('select', {}); ap(fmt, h('option', { value: '' }, 'Format …')); for (const k of K.KATEGORIEN) for (const f of k.formate) { const v = Math.round(Math.min(...f) * 10) + 'x' + Math.round(Math.max(...f) * 10); if (!fmt.querySelector(`option[value="${v}"]`)) ap(fmt, h('option', { value: v, selected: t.B === Math.round(Math.min(...f) * 10) && t.L === Math.round(Math.max(...f) * 10) }, `${K.cm(Math.min(...f) * 10)} × ${K.cm(Math.max(...f) * 10)} cm`)); }
    fmt.onchange = () => { if (!fmt.value) return; const [b, l] = fmt.value.split('x').map(Number); this.libAendern(t, (x) => { x.L = l; x.B = b; }); };
    const file = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    file.onchange = async () => { const f = file.files[0]; if (!f) return; const url = await shrinkImage(f, 384); const mf = await mittelFarbe(url); this.libAendern(t, (x) => { x.bildData = url; x.textur = 'bild'; if (!x.farbe || x.farbe === '#d9d4cc') x.farbe = mf; }); };
    ap(box, 
      h('div', { class: 'fs-eg' }, inp('name', 'Bezeichnung'), inp('hersteller', 'Hersteller'), inp('serie', 'Serie'), inp('artNr', 'Artikel-Nr.'), inp('link', 'Produktseite (Link)')),
      h('div', { class: 'fs-eg' }, h('label', { class: 'fs-feld' }, h('span', {}, 'Format'), fmt), inp('B', 'Breite (mm)', 'number', 1), inp('L', 'Länge (mm)', 'number', 1), sel('staerke', 'Stärke (mm)', [['', '–'], ...K.STAERKEN.map(s => [s, s + ' mm'])]), inp('fuge', 'Fuge (mm)', 'number', 0.5)),
      h('div', { class: 'fs-eg' }, sel('material', 'Material', K.MATERIALIEN), sel('oberflaeche', 'Oberfläche', K.OBERFLAECHEN), sel('rutsch', 'Rutschhemmung', K.RUTSCH), sel('verdraengung', 'Verdrängung', K.VERDRAENGUNG), sel('abrieb', 'Abrieb (PEI)', K.ABRIEB)),
      h('div', { class: 'fs-eg' }, chk('rektifiziert', 'rektifiziert (kalibrierte Kanten)'), chk('frost', 'frostsicher'), sel('bereich', 'Bereich', [['', '–'], ['boden', 'Boden'], ['wand', 'Wand'], ['sockel', 'Sockel'], ['vorwand', 'Vorwand'], ['dusche', 'Dusche'], ['treppe', 'Treppe'], ['aussen', 'Außen']])),
      h('div', { class: 'fs-eg' }, inp('farbname', 'Farbname'), inp('farbe', 'Farbe', 'color'), inp('farbe2', 'Zweitfarbe / Äderung', 'color'), sel('textur', 'Optik', [...Object.entries(TILE_TEXTUREN), ['bild', 'Foto der Fliese']]), inp('fugeFarbe', 'Fugenfarbe (Vorschlag)', 'color')),
      h('div', { class: 'fs-eg' }, inp('preisM2', 'Preis €/m² (netto)', 'number', 0.01), inp('paketM2', 'm² je Paket', 'number', 0.01), inp('stkPaket', 'Stück je Paket', 'number', 1), inp('pos', 'LV-Position'), inp('notiz', 'Notiz')),
      h('div', { class: 'fs-zeile wrap' }, h('button', { class: 'btn sm', onclick: () => file.click() }, '📷 Foto hochladen'), t.bildData ? h('button', { class: 'btn sm', onclick: () => this.libAendern(t, x => { x.bildData = null; if (x.textur === 'bild') x.textur = 'uni'; }) }, 'Foto entfernen') : null,
        FREI ? null : h('button', { class: 'btn sm', onclick: async () => { const M = await import('./ai.js?v=20261123-0837'); const tmp = clone(t); M.searchTile(this.app, tmp, () => this.libAendern(t, (x) => { for (const k of ['hersteller', 'artikel', 'farbe', 'farbe2', 'textur', 'L', 'B', 'bildData', 'quelle']) if (tmp[k] !== undefined) x[k] = tmp[k]; if (tmp.artikel && !x.serie) x.serie = tmp.artikel; })); } }, '🔎 Optik im Internet suchen (KI)'),
        t.link ? h('a', { href: t.link, target: '_blank', class: 'btn sm' }, '↗ Produktseite') : null, file),
      t.lvText ? h('details', {}, h('summary', {}, 'LV-Text'), h('div', { class: 'muted', style: 'white-space:pre-wrap;font-size:11.5px' }, t.lvText)) : null,
      h('div', { class: 'muted' }, 'Änderungen gelten sofort in allen Räumen, die diese Fliese verwenden.'));
    return box;
  }
  /* ── rechts: Wie verlegen? ── */
  /* ── Entwurf F1: Schritt-Leiste und rechte Spalte ── */
  schrittStand() {
    const fb = this.aktiv('boden') || this.aktiv('zone'), fw = this.aktiv('wand');
    const f = (z) => { const t = this.fliese(z); return t ? `${t.name || 'Fliese'}` : ''; };
    return {
      1: [!!this.room, this.room ? `${this.raumName(this.room)} · ${m2(this.room.poly ? G.polyArea(this.room.poly) / 1e6 : 0)}` : 'Raum wählen'],
      2: [fb || fw, fb || fw ? [fb ? 'Boden ✓' : '', fw ? 'Wand ✓' : ''].filter(Boolean).join(' · ') : 'Boden, Wand, Sockel'],
      3: [fb || fw, fb ? (K.VERBAENDE || []).length ? 'Muster, Start, Fuge' : 'Muster, Start, Fuge' : 'Muster, Start, Fuge'],
      4: [fw, fw ? (this.cfg('wand').hoehe === 'tuer' ? 'bis Türhöhe' : this.cfg('wand').hoehe > 0 ? `bis ${G.fmtCm(this.cfg('wand').hoehe)} cm` : 'raumhoch') : 'jede Wand einzeln'],
      5: (() => { const ab = this.room && this.room.abdichtung; if (!ab) return [false, 'Gefälle, DIN 18534']; return [true, [{ punkt: 'Punktablauf', rinne: 'Rinne', wand: 'Wandablauf', keine: 'ohne Ablauf' }[ab.ablauf] || '', ab.ablauf !== 'keine' ? zahl(ab.gefaelle, 1) + ' %' : '', ab.klDusche].filter(Boolean).join(' · ')]; })(),
      6: [false, 'Material, Plan als PDF'] };
  }
  schrittWahl(n) {
    this.schritt = n;
    const z = this.ziel; const wandZiel = z === 'wand' || z.startsWith('wand:') || z === 'oben' || z === 'fries' || z.startsWith('bt:');
    if (n === 4 && !this.istZone() && !wandZiel) this.ziel = 'wand';
    if ((n === 2 || n === 3) && (z.startsWith('wand:') || z.startsWith('bt:'))) this.ziel = 'wand';
    this.edit = null; this.panel.scrollTop = 0; this.alles();
  }
  schrittBauen() {
    const L = this.leiste; L.innerHTML = ''; const st = this.schrittStand();
    for (const [n, titel] of SCHRITTE) {
      const [ok, sub] = st[n];
      ap(L, h('button', { class: 'fs-st' + (this.schritt === n ? ' akt' : '') + (ok && this.schritt !== n ? ' ok' : ''), 'data-schritt': n, onclick: () => this.schrittWahl(n) },
        h('i', {}, ok && this.schritt !== n ? '✓' : String(n)), h('span', {}, h('b', {}, titel), h('small', {}, sub))));
    }
    const P = this.panel; P.innerHTML = ''; P.dataset.s = this.schritt; const n = this.schritt; const zone = this.istZone();
    const titel = { 1: 'Raum und Flächen', 2: `Welche Fliese für ${this.zielName()}?`, 3: `Verlegung · ${this.zielName()}`, 4: 'Wände – jede Wand einzeln', 5: 'Dusche & Abdichtung', 6: 'Mengen & Plan' }[n];
    ap(P, h('div', { class: 'fs-ptitel' }, titel));
    const zielChips = (liste) => { const d = h('div', { class: 'fs-zielchips' }); for (const [z, l] of liste) ap(d, h('button', { class: 'chip' + (this.ziel === z ? ' on' : ''), 'data-ziel': z, onclick: () => { this.ziel = z; this.edit = null; this.alles(); } }, l, this.aktiv(z) ? ' ✓' : '')); return d; };
    const flaechen = zone ? [['zone', 'Fliesenfläche']] : [['boden', 'Boden'], ['wand', 'Alle Wände'], ['sockel', 'Sockel'], ['oben', 'Wand oben (2. Fliese)'], ['fries', 'Fries / Bordüre'], ['rand', 'Randfries Boden']];
    if (n === 1) {
      const rooms = this.rooms(); const rl = h('div', { class: 'fs-raeume' });
      for (const r of rooms) { const fl = r.poly ? G.polyArea(r.poly) / 1e6 : 0; const t = r.tiles || {}; const bel = [t.boden && t.boden.aktiv ? 'Boden' : '', t.wand && t.wand.aktiv ? 'Wand' : ''].filter(Boolean).join(' + ');
        ap(rl, h('button', { class: 'fs-raumk' + (r.id === this.roomId ? ' an' : ''), 'data-raum': r.id, onclick: () => { this.roomId = r.id; if (this.istZone()) this.ziel = 'zone'; else if (this.ziel === 'zone') this.ziel = 'boden'; this.planNeu = true; this.alles(); } }, h('b', {}, this.raumName(r)), h('small', {}, `${m2(fl)}${bel ? ' · ' + bel + ' gefliest' : ' · noch nicht gefliest'}`))); }
      ap(P, h('div', { class: 'fs-sub' }, 'Raum antippen:'), rl, this.links);
    } else if (n === 2) {
      ap(P, zielChips(flaechen), this.rechts, this.wahl);
    } else if (n === 3) {
      ap(P, zielChips(zone ? flaechen : flaechen.filter(([z]) => z === 'boden' || z === 'wand' || this.aktiv(z))), this.rechts);
    } else if (n === 4) {
      if (zone) ap(P, h('div', { class: 'note' }, 'Eine Fliesenfläche hat keine Wände – Wände gibt es bei Räumen.'));
      else ap(P, h('div', { class: 'muted' }, 'Wand antippen – dann eigene Höhe, eigene Fliese oder Verlegung nur für diese Wand. Die Vorschau zeigt die Wandabwicklung, eine angetippte Wand groß.'), this.links, this.wandBauteile(), this.rechts);
    } else if (n === 5) {
      if (zone) ap(P, h('div', { class: 'note' }, 'Dusche und Abdichtung plant man in einem Raum – eine Fliesenfläche hat keine Wände.'));
      else this.abdPanel(P);
    } else if (n === 6) {
      ap(P, h('div', { class: 'fs-zeile wrap' }, h('button', { class: 'btn', onclick: () => this.materialliste() }, '📋 Materialliste'), h('button', { class: 'btn', onclick: () => this.pdf() }, '📄 Verlegeplan PDF')), this.rechts);
      if (!zone && this.room.abdichtung) { const R = this.abdRechnen(); ap(P, h('div', { class: 'karte fs-abd-k', 'data-tw': 'abd-mengen6' }, h('b', {}, 'Abdichtung und Dusche (aus Schritt 5)'), h('div', { class: 'fs-abd-z' }, h('span', {}, 'Abdichtung gesamt'), h('b', {}, m2((R.tasse ? 0 : R.Ad) + R.Adw + R.Arb + R.Ahz))), h('div', { class: 'fs-abd-z' }, h('span', {}, 'Dichtband'), h('b', {}, zahl(R.band / 1000, 1) + ' m')), h('div', { class: 'fs-abd-z' }, h('span', {}, 'Dichtecken innen / außen · Manschetten Boden / Wand'), h('b', {}, `${R.eI} / ${R.eA} · ${R.manB} / ${R.a.manW}`)), R.bodengleich && R.a.ablauf === 'rinne' ? h('div', { class: 'fs-abd-z' }, h('span', {}, 'Duschrinne'), h('b', {}, G.fmtCm(R.a.rinneL) + ' cm')) : null)); }
    }
    const vor = n < 6 ? h('button', { class: 'btn pri fs-weiter', 'data-tw': 'fs-weiter', onclick: () => this.schrittWahl(n + 1) }, `Weiter: ${SCHRITTE[n][1]} ▶`) : h('button', { class: 'btn pri fs-weiter', onclick: () => this.schliessen() }, '✓ Fertig');
    ap(P, h('div', { class: 'fs-pfuss' }, n > 1 ? h('button', { class: 'btn', 'data-tw': 'fs-zurueck', onclick: () => this.schrittWahl(n - 1) }, `◀ ${SCHRITTE[n - 2][1]}`) : h('span'), vor));
  }
  /* ── Schritt 4: Bauteile direkt an die angetippte Wand setzen ── */
  wandBauteile() {
    if (!this.ziel.startsWith('wand:')) return null;
    const k = +this.ziel.slice(5); const sf = this.waende()[k]; if (!sf) return null;
    const setzen = (art, w0) => {
      const d0 = SYMBOLE[art]; const w = Math.min(w0 || d0.w, Math.max(300, sf.len - 100)); const d = d0.d;
      const u = G.norm ? G.norm(G.sub(sf.b, sf.a)) : (() => { const v = G.sub(sf.b, sf.a); const l = Math.hypot(v.x, v.y) || 1; return { x: v.x / l, y: v.y / l }; })();
      let n = { x: -u.y, y: u.x }; const mid = G.add(G.mul(G.add(sf.a, sf.b), 0.5), G.mul(n, 20)); if (!G.pointInPoly(mid, this.room.poly)) n = { x: u.y, y: -u.x };
      const p = G.add(G.add(G.mul(G.add(sf.a, sf.b), 0.5), G.mul(n, d / 2)), { x: 0, y: 0 });
      const rot = G.deg(Math.atan2(n.y, n.x)) - 90; let neu = null;
      this.ch(d0.name, () => { neu = this.doc.add({ type: 'symbol', kind: art, p, w, d, rot, aussparen: true, storey: this.room.storey }); }, false);
      if (neu) { this.ziel = 'bt:' + neu.id; this.app.toast(`${d0.name} an Wand ${k + 1} gesetzt – Maße und Höhe rechts einstellen.`); }
      this.alles();
    };
    return h('div', { class: 'fs-zeile wrap fs-wandbt', 'data-tw': 'wand-bauteile' }, h('span', { class: 'muted' }, `An Wand ${k + 1} setzen:`),
      h('button', { class: 'btn sm', 'data-tw': 'bt-vorwand', onclick: () => setzen('vorwand', 1200) }, '+ Vorwand'),
      h('button', { class: 'btn sm', 'data-tw': 'bt-nische', onclick: () => setzen('nische', 600) }, '+ Ablage / Nische'),
      h('button', { class: 'btn sm', 'data-tw': 'bt-sitzbank', onclick: () => setzen('sitzbank', 1500) }, '+ Sitzbank'),
      h('button', { class: 'btn sm', onclick: () => setzen('schacht', 400) }, '+ Schacht'));
  }
  /* ── Schritt 5: Dusche, Gefälle, Abdichtung nach DIN 18534, Bewegungsfugen ── */
  abd() { const r = this.room; return Object.assign({ ablauf: 'rinne', rinneL: 800, gefaelle: 2, klDusche: 'W2-I', klRaum: 'W1-I', wandH: 2000, hochzug: 300, manW: 2, randfuge: true }, r.abdichtung || {}); }
  abdSetzen(label, fn) { this.ch(label, () => { const r = this.room; r.abdichtung = Object.assign(this.abd(), r.abdichtung || {}); fn(r.abdichtung); }); }
  abdRechnen() {
    const r = this.room; const a = this.abd(); const poly = r.poly;
    const sy = this.doc.all('symbol', r.storey).find(x => DUSCHEN.includes(x.kind) && G.pointInPoly(x.p, poly));
    const tasse = sy && (sy.kind === 'duschtasse' || sy.kind === 'duschviertel');
    const ganz = !sy && a.ganzRaum;
    const fp = sy ? symbolFootprint(sy) : ganz ? poly : null;
    const A = G.polyArea(poly) / 1e6; const ws = this.waende();
    const tuerB = ws.reduce((m, s0) => m + s0.openings.filter(o => o.kind !== 'window' && (o.sill || 0) < 50).reduce((q, o) => q + (o.x1 - o.x0), 0), 0);
    const umfang = G.polyPerimeter(poly); const umfangN = Math.max(0, umfang - tuerB);
    let Ad = 0, Lw = 0, ecken = 0, dist = 0, touch = [], kante = 0;
    if (fp) {
      Ad = G.polyArea(fp) / 1e6;
      if (sy) { for (let i = 0; i < 4; i++) { const p0 = fp[i], p1 = fp[(i + 1) % 4]; const m = G.mul(G.add(p0, p1), 0.5); let dmin = Infinity; for (let j = 0; j < poly.length; j++) dmin = Math.min(dmin, G.closestOnSeg(m, poly[j], poly[(j + 1) % poly.length]).d); touch.push(dmin < 80); if (dmin < 80) Lw += G.dist(p0, p1); } for (let i = 0; i < 4; i++) if (touch[i] && touch[(i + 1) % 4]) ecken++; }
      else { Lw = umfangN; ecken = ws.filter(s0 => s0.eckeRechts === 'innen').length; }
      if (a.ablauf === 'punkt') { const bb = G.bbox(fp); dist = sy ? Math.hypot(sy.w / 2, sy.d / 2) : Math.hypot(bb.w / 2, bb.h / 2); }
      else if (a.ablauf === 'rinne' || a.ablauf === 'wand') { if (sy) { let bi = -1, bl = 0; for (let i = 0; i < 4; i++) if (touch[i]) { const l = G.dist(fp[i], fp[(i + 1) % 4]); if (l > bl + 1) { bl = l; bi = i; } } kante = bi < 0 ? 0 : bi; if (a.rinneKante != null && touch[a.rinneKante]) kante = a.rinneKante; dist = G.dist(fp[(kante + 1) % 4], fp[(kante + 2) % 4]); } else dist = Math.min(G.bbox(fp).w, G.bbox(fp).h); }
    }
    const bodengleich = fp && !tasse && a.ablauf !== 'keine';
    const dh = bodengleich ? dist * (a.gefaelle || 0) / 100 : 0;
    const wandH = a.wandH === 0 ? (r.height || (this.doc.storeyById(r.storey) || {}).roomHeight || 2500) : a.wandH;
    const Adw = Lw * wandH / 1e6;
    const raumKl = a.klRaum !== 'keine';
    const Arb = raumKl ? Math.max(0, A - (ganz ? A : Ad)) : 0;
    const Lhz = raumKl ? Math.max(0, umfangN - Lw) : 0; const Ahz = Lhz * a.hochzug / 1e6;
    const band = (raumKl ? umfangN : Lw) + ecken * wandH;
    const eI = raumKl ? ws.filter(s0 => s0.eckeRechts === 'innen').length : ecken, eA = raumKl ? ws.filter(s0 => s0.eckeRechts === 'aussen').length : 0;
    const bb = G.bbox(poly); const feld = A > 40 || Math.max(bb.w, bb.h) > 8000;
    let gefHinweis = '';
    if (bodengleich) { const f = this.fliese('boden'); const fmax = f ? Math.max(f.L, f.B) : 0;
      if (a.ablauf === 'punkt') gefHinweis = fmax > 300 ? `Punktablauf mit Fliese ${K.formatText(f)} cm: Kuvertschnitt (Briefumschlag) nötig – besser Fliesen bis 30×30 oder Rinne` : 'Punktablauf: Gefälle zu allen Seiten (Kuvertschnitt), Fliesen bis 30×30 verlegen sich sauber';
      else gefHinweis = a.ablauf === 'wand' ? 'Einseitiges Gefälle zur Wand – große Fliesen bleiben eben, kein Kuvertschnitt' : 'Einseitiges Gefälle zur Rinne – große Fliesen bleiben eben, kein Kuvertschnitt';
      if ((a.gefaelle || 0) < 1) gefHinweis += ' · Gefälle unter 1 % – Wasser läuft schlecht ab'; }
    const kanten = []; if (sy && fp) for (let i = 0; i < 4; i++) if (touch[i]) { const m = G.mul(G.add(fp[i], fp[(i + 1) % 4]), 0.5); let bk = 0, bd = Infinity; ws.forEach((s0, k) => { const d = G.closestOnSeg(m, s0.a, s0.b).d; if (d < bd) { bd = d; bk = k; } }); kanten.push([i, bk]); }
    return { a, sy, tasse, ganz, fp, kante, kanten, A, Ad, Lw, ecken, dist, dh, wandH, Adw, Arb, Lhz, Ahz, band, eI, eA, umfangN, tuerB, feld, gefHinweis, bodengleich, manB: bodengleich ? 1 : 0 };
  }
  abdPanel(P) {
    const R = this.abdRechnen(); const a = R.a; const r = this.room;
    const chips = (vals, cur, fn, tw) => { const d = h('div', { class: 'fs-chips fs-bibchips' }); for (const [v, l] of vals) ap(d, h('button', { class: 'chip' + (String(cur) === String(v) ? ' on' : ''), 'data-tw': tw ? tw + '-' + v : null, onclick: () => fn(v) }, l)); return d; };
    const zahl2 = (v, n = 2) => zahl(v, n);
    // Dusche
    if (R.sy) ap(P, h('div', { class: 'fs-sub' }, 'Dusche im Raum'), h('div', { class: 'karte fs-abd-k' }, h('div', {}, h('b', {}, (SYMBOLE[R.sy.kind] || {}).name || 'Dusche'), ` · ${G.fmtCm(R.sy.w)}×${G.fmtCm(R.sy.d)} cm`), R.tasse ? h('div', { class: 'muted' }, 'Duschtasse: kein Gefälle im Boden – Abdichtung der Wände im Duschbereich.') : null));
    else {
      const setz = (art) => { const sf = this.waende()[0]; if (!sf) return; const d0 = SYMBOLE[art]; const v = G.sub(sf.b, sf.a); const l = Math.hypot(v.x, v.y) || 1; const u = { x: v.x / l, y: v.y / l }; let n = { x: -u.y, y: u.x }; const mid = G.add(G.mul(G.add(sf.a, sf.b), 0.5), G.mul(n, 20)); if (!G.pointInPoly(mid, r.poly)) n = { x: u.y, y: -u.x }; const w = Math.min(d0.w, sf.len); const p = G.add(G.add(sf.a, G.mul(u, w / 2)), G.mul(n, d0.d / 2)); const rot = G.deg(Math.atan2(n.y, n.x)) - 90; this.ch('Dusche', () => this.doc.add({ type: 'symbol', kind: art, p, w, d: d0.d, rot, storey: r.storey })); };
      ap(P, h('div', { class: 'fs-sub' }, 'Im Raum ist noch keine Dusche eingezeichnet:'), h('div', { class: 'fs-zeile wrap' },
        h('button', { class: 'btn sm', 'data-tw': 'abd-dusche', onclick: () => setz('dusche') }, '+ Dusche bodengleich 90×90 in die Ecke'),
        h('button', { class: 'btn sm', onclick: () => setz('walkin') }, '+ Walk-in 140×90'),
        h('button', { class: 'btn sm' + (a.ganzRaum ? ' on' : ''), 'data-tw': 'abd-ganz', onclick: () => this.abdSetzen('Ganzer Raum mit Gefälle', x => { x.ganzRaum = !x.ganzRaum; if (x.ganzRaum && x.ablauf === 'rinne') x.ablauf = 'punkt'; }) }, a.ganzRaum ? '✓ ganzer Raum mit Gefälle' : 'ganzer Raum mit Gefälle (Nassraum)')),
        h('div', { class: 'muted' }, 'Die Dusche lässt sich im Grundriss verschieben und in der Größe ändern (Objekte › Duschen).'));
    }
    if (R.fp && !R.tasse) {
      ap(P, h('div', { class: 'fs-sub' }, 'Ablauf'), chips([['punkt', 'Punktablauf'], ['rinne', 'Duschrinne'], ['wand', 'Wandablauf'], ['keine', 'kein Ablauf']], a.ablauf, v => this.abdSetzen('Ablauf', x => x.ablauf = v), 'abd-ablauf'));
      if ((a.ablauf === 'rinne' || a.ablauf === 'wand') && R.kanten.length > 1) ap(P, h('div', { class: 'fs-sub' }, a.ablauf === 'rinne' ? 'Rinne an welcher Wand?' : 'Wandablauf an welcher Wand?'), chips(R.kanten.map(([i, k]) => [i, `Wand ${k + 1}`]), R.kante, v => this.abdSetzen('Rinne an Wand', x => x.rinneKante = +v), 'abd-kante'));
      if (a.ablauf === 'rinne') ap(P, h('div', { class: 'fs-sub' }, 'Rinne an der Wand – Länge'), chips([[700, '70 cm'], [800, '80 cm'], [900, '90 cm'], [1000, '100 cm'], [1200, '120 cm']], a.rinneL, v => this.abdSetzen('Rinne', x => x.rinneL = +v), 'abd-rinne'));
      if (a.ablauf !== 'keine') ap(P, h('div', { class: 'fs-sub' }, 'Gefälle'), h('div', { class: 'fs-zeile' }, chips([[1, '1 %'], [1.5, '1,5 %'], [2, '2 %']], a.gefaelle, v => this.abdSetzen('Gefälle', x => x.gefaelle = +v), 'abd-gef'), this.num(a.gefaelle, v => this.abdSetzen('Gefälle', x => x.gefaelle = v), { step: 0.1, w: 70 }), h('span', { class: 'muted' }, '%')));
    }
    if (R.bodengleich) ap(P, h('div', { class: 'karte fs-abd-k', 'data-tw': 'abd-ergebnis' }, h('b', {}, 'Ergebnis'),
      h('div', {}, `Weg zum Ablauf: ${G.fmtCm(R.dist)} cm · Höhenunterschied am Rand: `, h('b', {}, `${zahl2(R.dh, 0)} mm`)),
      h('div', { class: R.gefHinweis.includes('nötig') || R.gefHinweis.includes('schlecht') ? 'fs-warn' : 'fs-gut' }, R.gefHinweis),
      h('div', { class: 'muted' }, 'Bodenaufbau prüfen: Estrich im Gefälle oder Gefällekeil, Ablauf-Höhe und Aufbauhöhe am Einstieg.')));
    // Abdichtung
    ap(P, h('div', { class: 'fs-sub' }, 'Abdichtung nach DIN 18534 – Dusche (Boden und Wand)'), chips([['W1-I', 'W1-I'], ['W2-I', 'W2-I (Dusche privat)'], ['W3-I', 'W3-I (gewerblich)']], a.klDusche, v => this.abdSetzen('Abdichtung Dusche', x => x.klDusche = v), 'abd-kld'),
      h('div', { class: 'fs-sub' }, 'Abdichtung Raumboden außerhalb der Dusche'), chips([['keine', 'keine'], ['W0-I', 'W0-I'], ['W1-I', 'W1-I (Bad privat)'], ['W2-I', 'W2-I'], ['W3-I', 'W3-I']], a.klRaum, v => this.abdSetzen('Abdichtung Raum', x => x.klRaum = v), 'abd-klr'),
      h('div', { class: 'fs-sub' }, 'Wandhöhe im Duschbereich'), chips([[2000, '2,00 m'], [2100, '2,10 m'], [2250, '2,25 m'], [0, 'raumhoch']], a.wandH, v => this.abdSetzen('Wandhöhe Dusche', x => x.wandH = +v), 'abd-wh'),
      a.klRaum !== 'keine' ? [h('div', { class: 'fs-sub' }, 'Hochzug an den übrigen Wänden'), chips([[100, '10 cm'], [150, '15 cm'], [200, '20 cm'], [300, '30 cm']], a.hochzug, v => this.abdSetzen('Hochzug', x => x.hochzug = +v), 'abd-hz')] : null,
      h('div', { class: 'fs-sub' }, 'Wandmanschetten (Armatur, Brause …)'), chips([[0, '0'], [1, '1'], [2, '2'], [3, '3'], [4, '4']], a.manW, v => this.abdSetzen('Manschetten', x => x.manW = +v), 'abd-man'));
    const zeile = (l, v) => h('div', { class: 'fs-abd-z' }, h('span', {}, l), h('b', {}, v));
    ap(P, h('div', { class: 'karte fs-abd-k', 'data-tw': 'abd-mengen' }, h('b', {}, 'Abdichtung – Mengen'),
      R.fp ? zeile(`Dusche Boden (${a.klDusche})`, R.tasse ? '– (Duschtasse)' : m2(R.Ad)) : null,
      R.Lw ? zeile(`Dusche Wand ${G.fmtCm(R.Lw)} cm × ${G.fmtCm(R.wandH)} cm`, m2(R.Adw)) : null,
      a.klRaum !== 'keine' ? zeile(`Raumboden (${a.klRaum})`, m2(R.Arb)) : null,
      a.klRaum !== 'keine' ? zeile(`Hochzug ${G.fmtCm(a.hochzug)} cm · ${zahl2(R.Lhz / 1000)} m`, m2(R.Ahz)) : null,
      zeile('Dichtband', `${zahl2(R.band / 1000, 1)} m`), zeile('Dichtecken innen / außen', `${R.eI} / ${R.eA}`),
      zeile('Bodenmanschette (Ablauf) / Wandmanschetten', `${R.manB} / ${a.manW}`),
      R.bodengleich && a.ablauf === 'rinne' ? zeile('Duschrinne', `1 × ${G.fmtCm(a.rinneL)} cm`) : null,
      zeile('Abdichtung gesamt', m2((R.tasse ? 0 : R.Ad) + R.Adw + R.Arb + R.Ahz))));
    // Bewegungsfugen
    ap(P, h('div', { class: 'fs-sub' }, 'Bewegungsfugen'), h('label', { class: 'fs-schalter' }, h('input', { type: 'checkbox', checked: a.randfuge, onchange: (e) => this.abdSetzen('Randfuge', x => x.randfuge = e.target.checked) }), h('span', {}, `Randfuge ringsum (Boden/Wand, Wandecken): ${zahl2((R.umfangN + R.ecken * 0) / 1000, 1)} m dauerelastisch`)),
      R.feld ? h('div', { class: 'note warn' }, 'Raum über 40 m² oder länger als 8 m: Feldbegrenzungsfugen einplanen und Bewegungsfugen des Estrichs übernehmen.') : h('div', { class: 'muted' }, 'Feldbegrenzungsfugen sind bei dieser Raumgröße nicht nötig – Fugen des Estrichs immer übernehmen.'),
      h('div', { class: 'muted' }, 'Planungshilfe – die Wassereinwirkungsklasse legt der Planer nach DIN 18534-1 fest. Mengen gehen in „Mengen & Plan“ und die Materialliste.'));
  }
  abdTabelle() {
    const rows = []; const alt = this.roomId;
    for (const r of this.rooms()) { if (r.type === 'tilezone' || !r.abdichtung) continue; this.roomId = r.id; try { const R = this.abdRechnen(); rows.push([this.raumName(r), R]); } catch (e) { } }
    this.roomId = alt; if (!rows.length) return null;
    const t = h('table', { class: 'fs-tab-mat' }); ap(t, h('tr', {}, ...['Raum', 'Abdichtung m²', 'Dichtband m', 'Ecken innen/außen', 'Manschetten Boden/Wand', 'Rinne'].map(x => h('th', {}, x))));
    for (const [n, R] of rows) ap(t, h('tr', {}, h('td', {}, n), h('td', {}, zahl((R.tasse ? 0 : R.Ad) + R.Adw + R.Arb + R.Ahz)), h('td', {}, zahl(R.band / 1000, 1)), h('td', {}, `${R.eI}/${R.eA}`), h('td', {}, `${R.manB}/${R.a.manW}`), h('td', {}, R.bodengleich && R.a.ablauf === 'rinne' ? G.fmtCm(R.a.rinneL) + ' cm' : '–')));
    return h('div', { style: 'margin-top:14px' }, h('b', {}, 'Abdichtung (DIN 18534)'), t);
  }
  rechtsBauen() {
    const R = this.rechts; R.innerHTML = '';
    const z = this.ziel; const c = this.cfg(z) || (z.startsWith('wand:') ? {} : null); const an = this.aktiv(z); const f = this.fliese(z);
    ap(R, h('div', { class: 'fs-l', 'data-teil': 'kopf' }, this.zielName()));
    // An/Aus + aktuelle Fliese
    const schalter = (txt, val, fn) => h('label', { class: 'fs-schalter' }, h('input', { type: 'checkbox', checked: !!val, onchange: (e) => fn(e.target.checked) }), h('span', {}, txt));
    const kopf = h('div', { class: 'fs-akt', 'data-teil': 'kopf' });
    if (z.startsWith('wand:')) {
      const k = +z.slice(5); const w = this.cfg('wand');
      if (!w || !w.aktiv) ap(kopf, h('div', { class: 'note' }, 'Für die Wände ist noch keine Fliese gewählt. Erst „Alle Wände“ belegen oder hier direkt eine Fliese antippen (dann wird nur diese Wand gefliest).'));
      ap(kopf, schalter(`Wand ${k + 1} fliesen`, an, (v) => this.ch('Wand fliesen', () => { const cc = this.cfg(z, true); cc.aktiv = v; const ww = this.cfg('wand', true); if (v) ww.aktiv = true; })));
      ap(kopf, schalter('eigene Fliese / Verlegung für diese Wand', c && c.eigeneFliese, (v) => this.ch('Eigene Fliese', () => { const cc = this.cfg(z, true); cc.eigeneFliese = v; if (v && w) for (const kk of K.FLIESEN_FELDER) if (cc[kk] === undefined && w[kk] !== undefined) cc[kk] = clone(w[kk]); if (v && w) cc.verband = cc.verband || w.verband; })));
      ap(kopf, schalter('eigene Höhe für diese Wand', c && c.hoehe !== undefined, (v) => this.ch('Eigene Höhe', () => { const cc = this.cfg(z, true); if (v) cc.hoehe = w ? (w.hoehe || 0) : 0; else delete cc.hoehe; })));
    } else if (z === 'rand' || z === 'oben' || z === 'fries') {
      ap(kopf, schalter(`${this.zielName()} verwenden`, an, (v) => this.ch(this.zielName(), () => { const cc = this.cfg(z, true); cc.aktiv = v; this.cfg(z === 'rand' ? 'boden' : 'wand', true).aktiv = true; })));
    } else if (z !== 'zone' && !z.startsWith('bt:')) {
      ap(kopf, schalter(z === 'boden' ? 'Boden fliesen' : z === 'wand' ? 'Wände fliesen' : 'Sockel', an, (v) => this.ch(this.zielName(), () => { const cc = this.cfg(z, true); cc.aktiv = v; })));
    }
    if (f && an) ap(kopf, h('div', { class: 'fs-aktf' }, swatch(f, 64), h('div', {}, h('b', {}, f.name || 'Fliese'), h('small', {}, [K.formatText(f) + ' cm', f.staerke ? f.staerke + ' mm stark' : '', f.hersteller, f.serie, f.rutsch, f.lvPos ? 'LV ' + f.lvPos : ''].filter(Boolean).join(' · ')), h('small', { class: 'muted' }, 'Andere Fliese: in der Mitte antippen.'))));
    else if (!an) ap(kopf, h('div', { class: 'muted', style: 'margin-top:6px' }, 'Tipp: einfach in der Mitte eine Fliese antippen – dann wird „' + this.zielName() + '“ automatisch eingeschaltet.'));
    ap(R, kopf);
    if (z.startsWith('bt:')) { ap(R, this.secBauteil(z, c, an)); if (an && c && c.eigeneFliese) { ap(R, this.secVerband(c, 'wand')); ap(R, this.secFuge(c)); } ap(R, this.mengen()); return; }
    if (!an || !c) { ap(R, this.mengen()); return; }
    if (z === 'sockel') { ap(R, this.secSockel(c)); ap(R, this.mengen()); ap(R, this.secUebertragen()); return; }
    if (z === 'fries') { ap(R, this.secFries(c)); ap(R, this.mengen()); return; }
    const vc = z.startsWith('wand:') ? (c.eigeneFliese ? c : null) : c;
    if (z === 'oben') ap(R, this.secOben(c));
    if (z === 'rand') ap(R, this.secRand(c));
    if (vc) ap(R, this.secVerband(vc, z));
    if (['boden', 'zone'].includes(z)) ap(R, this.secStart(c));
    if (z === 'wand' || z.startsWith('wand:')) ap(R, this.secWand(z));
    if (vc) ap(R, this.secFuge(vc));
    if (['boden', 'zone', 'wand'].includes(z)) ap(R, this.secKante(c, z));
    ap(R, this.mengen());
    if (['boden', 'wand', 'zone'].includes(z)) ap(R, this.secUebertragen());
  }
  sec(titel, ...kids) { return h('details', { class: 'fs-sec', 'data-teil': TEIL[titel] || 'flaeche', open: (this._zu || {})[titel] ? null : true, ontoggle: (e) => { this._zu = this._zu || {}; this._zu[titel] = !e.target.open; } }, h('summary', {}, titel), ...kids); }
  chips(vals, cur, fn, opt = {}) { const d = h('div', { class: 'fs-chips' }); for (const [v, l] of vals) ap(d, h('button', { class: 'chip' + (String(cur) === String(v) ? ' on' : ''), title: opt.title ? opt.title(v) : null, onclick: () => fn(v) }, l)); return d; }
  num(val, fn, opt = {}) { const i = h('input', { type: 'number', value: val ?? '', step: opt.step || 1, min: opt.min, style: `width:${opt.w || 80}px` }); i.onchange = () => { const v = parseFloat(String(i.value).replace(',', '.')); if (isFinite(v)) fn(v); }; return i; }
  zeile(label, ...el) { return h('div', { class: 'fs-zl' }, h('span', {}, label), h('div', {}, ...el)); }
  secVerband(c, z) {
    const g = h('div', { class: 'fs-verbaende' });
    const istWand = z === 'wand' || z === 'oben' || z.startsWith('wand:');
    for (const [k, l] of Object.entries(T.VERBAENDE)) ap(g, h('button', { class: 'fs-verband' + ((c.verband || 'kreuz') === k ? ' an' : ''), 'data-verband': k, title: l, onclick: () => this.ch('Verband', () => { c.verband = k; c._verbandVonHand = true; }) }, verbandBild(k, c), h('span', {}, l.replace(/ \(.*\)/, ''))));
    const kids = [g];
    if (c.verband === 'versatz') kids.push(this.zeile('Versatz', this.chips([[0.1, '10 %'], [0.15, '15 %'], [0.2, '20 %'], [0.25, '25 %'], [0.3, '30 %'], [0.4, '40 %']], c.versatz ?? 0.2, v => this.ch('Versatz', () => c.versatz = v)), h('small', { class: 'muted' }, ` = ${G.fmtCm((c.L + c.fuge) * (c.versatz ?? 0.2))} cm`)));
    if (c.verband === 'chevron') kids.push(this.zeile('Gehrungswinkel', this.chips([[30, '30°'], [40, '40°'], [45, '45°'], [50, '50°'], [60, '60°']], c.chevronWinkel ?? 45, v => this.ch('Chevron-Winkel', () => c.chevronWinkel = v))), h('div', { class: 'muted' }, 'Chevron: die Fliesen sind an den Enden schräg geschnitten (Chevron-Fliesen), Länge = Spitze bis Spitze. Spitzen zeigen in Richtung „längs“ – mit „quer“ drehen.'));
    if (c.verband === 'sechseck') kids.push(h('div', { class: 'muted' }, `Sechseck: Breite = Schlüsselweite (Kante zu Kante) ${G.fmtCm(Math.min(c.L, c.B))} cm, Eckmaß ${G.fmtCm(Math.min(c.L, c.B) * 2 / Math.sqrt(3))} cm. Nur mit Sechseck-Fliesen verwenden.`));
    if (c.verband === 'wild') kids.push(this.zeile('Muster', h('button', { class: 'btn sm', onclick: () => this.ch('Neu mischen', () => c.seed = Math.floor(Math.random() * 9999) + 1) }, '🎲 neu mischen')));
    if (c.verband === 'halb' && Math.max(c.L, c.B) >= 600) kids.push(h('div', { class: 'note warn' }, 'Großformat ab 60 cm im Halbverband: Gefahr von Überzähnen durch Schüsselung – Fachregeln empfehlen max. ⅓-Versatz (Drittelverband) oder Kreuzfuge.'));
    // Richtung
    const ak = istWand ? 'angleWand' : 'angle';
    kids.push(this.zeile('Richtung', this.chips([[0, '⟷ längs'], [90, '↕ quer'], [45, '⤢ 45°'], [-45, '⤡ −45°']], c[ak] || 0, v => this.ch('Richtung', () => c[ak] = v)), this.num(c[ak] || 0, v => this.ch('Winkel', () => c[ak] = v), { step: 5, w: 64 }), h('small', { class: 'muted' }, ' °')));
    if (!istWand && this.room && this.room.poly && !this.istZone()) {
      const ws = this.waende(); if (ws.length) {
        const s = h('select', { onchange: () => { const w = ws[+s.value]; if (!w) return; const a = Math.round(G.deg(Math.atan2(w.u.y, w.u.x)) * 10) / 10; this.ch('Richtung an Wand', () => c[ak] = ((a % 180) + 180) % 180); } });
        ap(s, h('option', { value: '' }, 'längs zu Wand …')); ws.forEach((w, k) => ap(s, h('option', { value: k }, `Wand ${k + 1} (${G.fmtCm(w.len)} cm)`)));
        kids.push(this.zeile('', s));
      }
    }
    return this.sec('Verlegemuster & Richtung', ...kids);
  }
  secStart(c) {
    const r = this.room; const res = this.istZone() ? zoneTiles(r) : floorTiles(this.doc, W.storeyGeometry(this.doc, r.storey), r);
    const mode = c.originMode || 'optimal';
    const kids = [this.chips([['optimal', '★ Optimal'], ['mitteFuge', 'Fuge mittig'], ['mitteFliese', 'Fliese mittig'], ['frei', 'Frei (gezogen)']], ['ecke', 'tuer'].includes(mode) ? '' : mode, v => this.ch('Startpunkt', () => { c.originMode = v; c.eckeName = null; if (v !== 'frei') c.origin = null; else if (!c.origin && res) c.origin = G.clone(res.origin); }))];
    // Ecken
    const bb = G.bbox(r.poly); const fu = c.fuge || 3; const ecken = [['ol', 'oben links', bb.x0, bb.y1, -1, 1], ['or', 'oben rechts', bb.x1, bb.y1, 1, 1], ['ul', 'unten links', bb.x0, bb.y0, -1, -1], ['ur', 'unten rechts', bb.x1, bb.y0, 1, -1]];
    const eg = h('div', { class: 'fs-ecken' });
    for (const [id, nm, x, y, sx, sy] of ecken) ap(eg, h('button', { class: 'chip' + (mode === 'ecke' && c.eckeName === id ? ' on' : ''), title: 'ganze Fliese in der Ecke ' + nm, onclick: () => this.ch('Start in Ecke', () => {
      const kx = x + (sx < 0 ? -fu / 2 : fu / 2), ky = y + (sy < 0 ? -fu / 2 : fu / 2);
      c.originMode = 'ecke'; c.eckeName = id; c.origin = null; c.ecke = { x: kx + fu / 2, y: ky + fu / 2 };
    }) }, { ol: '◤', or: '◥', ul: '◣', ur: '◢' }[id] + ' ' + nm));
    kids.push(this.zeile('Ab Ecke', eg));
    // Türen
    if (!this.istZone()) {
      const tueren = []; this.waende().forEach((s, k) => s.openings.forEach(o => { if (o.kind !== 'window') tueren.push({ s, o, k }); }));
      if (tueren.length) {
        const tg = h('div', { class: 'fs-chips' });
        tueren.forEach((t, i) => ap(tg, h('button', { class: 'chip' + (mode === 'frei' && c.tuerStart === i ? ' on' : ''), title: 'Fliese mittig in der Tür, ganze Reihe an der Schwelle', onclick: () => this.ch('Start an Tür', () => {
          const p = G.add(t.s.a, G.mul(t.s.u, (t.o.x0 + t.o.x1) / 2));
          const ang = G.rad(c.angle || 0); const ex = { x: Math.cos(ang), y: Math.sin(ang) }, ey = { x: -Math.sin(ang), y: Math.cos(ang) };
          const ce = T.VERBAENDE && c.verband === 'stapel' ? { L: Math.min(c.L, c.B), B: Math.max(c.L, c.B) } : c;
          const alongX = Math.abs(G.dot(t.s.u, ex)) > 0.7; const ax = alongX ? ex : ey; const pitch = (alongX ? ce.L : ce.B) + c.fuge;
          c.origin = G.sub(p, G.mul(ax, pitch / 2)); c.originMode = 'frei'; c.tuerStart = i; c.eckeName = null;
        }) }, `🚪 Tür ${i + 1} (Wand ${t.k + 1}, ${G.fmtCm(t.o.x1 - t.o.x0)})`)));
        kids.push(this.zeile('An Tür', tg));
      }
    }
    // Feinjustage
    const schieb = (dx, dy) => this.ch('Startpunkt verschieben', () => { const o = c.origin && c.originMode === 'frei' ? c.origin : res ? G.clone(res.origin) : G.polyCentroid(r.poly); c.origin = { x: Math.round(o.x + dx), y: Math.round(o.y + dy) }; c.originMode = 'frei'; c.eckeName = null; });
    const fj = h('div', { class: 'fs-fein' }, h('button', { class: 'btn sm', onclick: () => schieb(-50, 0) }, '◀◀'), h('button', { class: 'btn sm', onclick: () => schieb(-5, 0) }, '◀'), h('button', { class: 'btn sm', onclick: () => schieb(0, 5) }, '▲'), h('button', { class: 'btn sm', onclick: () => schieb(0, -5) }, '▼'), h('button', { class: 'btn sm', onclick: () => schieb(5, 0) }, '▶'), h('button', { class: 'btn sm', onclick: () => schieb(50, 0) }, '▶▶'), h('button', { class: 'btn sm', onclick: () => schieb(0, 50) }, '▲▲'), h('button', { class: 'btn sm', onclick: () => schieb(0, -50) }, '▼▼'));
    kids.push(this.zeile('Feinjustage', fj, h('small', { class: 'muted' }, ' 5 mm / 50 mm – oder ⊕ in der Vorschau ziehen')));
    kids.push(this.zeile('Mind. Randstück', this.chips([[0.5, '½ Fliese'], [0.33, '⅓'], [0.25, '¼']], c.minRand ?? 0.5, v => this.ch('Mindest-Randstück', () => { c.minRand = v; c.warnRand = Math.min(0.33, v * 0.66); })), this.num(c.minAbs ?? 50, v => this.ch('Mindestmaß', () => c.minAbs = v), { w: 60 }), h('small', { class: 'muted' }, ' mm mind.')));
    if (res) { const s = res.stats; kids.push(h('div', { class: 'fs-ampel ' + (s.krit ? 'bad' : s.warn ? 'warn' : 'ok') }, s.krit ? `⚠ ${s.krit} Randstück(e) zu klein – „★ Optimal“ oder Startpunkt verschieben.` : s.warn ? `${s.warn} Randstück(e) unter ½ Fliese.` : '✓ keine kleinen Randstücke')); }
    return this.sec('Startpunkt (Fugenkreuz)', ...kids);
  }
  secWand(z) {
    const base = this.cfg('wand'); const c = z === 'wand' ? base : this.cfg(z);
    const hoeheObj = z === 'wand' ? base : (c && c.hoehe !== undefined ? c : null);
    const kids = [];
    if (hoeheObj) {
      const surfaces = this.waende(); const maxTuer = Math.max(0, ...surfaces.flatMap(s => s.openings.filter(o => o.kind !== 'window').map(o => o.sill + o.height)));
      kids.push(this.zeile('Fliesenhöhe', this.chips(K.WANDHOEHEN.map(([v, l]) => [v, l]), hoeheObj.hoehe || 0, v => this.ch('Fliesenhöhe', () => hoeheObj.hoehe = v)), h('span', {}, this.num(hoeheObj.hoehe === 'tuer' ? maxTuer : (hoeheObj.hoehe || ''), v => this.ch('Fliesenhöhe', () => hoeheObj.hoehe = v), { w: 80 }), h('small', { class: 'muted' }, ' mm (0 = raumhoch)'))));
      const fl = this.fliese(z); if (fl && hoeheObj.hoehe && hoeheObj.hoehe !== 'tuer') {
        const reihe = fl.B + fl.fuge; const n = Math.max(1, Math.round(hoeheObj.hoehe / reihe)); const ganz = n * reihe - fl.fuge;
        kids.push(this.zeile('', h('button', { class: 'btn sm', onclick: () => this.ch('Höhe auf ganze Reihe', () => hoeheObj.hoehe = Math.round(ganz)) }, `↧ auf ganze Fliesenreihe: ${G.fmtCm(ganz)} cm (${n} Reihen)`)));
      }
      kids.push(this.zeile('Fliesen ab Höhe', this.num(hoeheObj.unten || 0, v => this.ch('Fliesen ab', () => hoeheObj.unten = v), { w: 80 }), h('small', { class: 'muted' }, ' mm (z. B. über Sockel / Vorwand-Ablage)')));
    }
    const fc = z === 'wand' ? base : (c && c.eigeneFliese ? c : base);
    if (fc) {
      kids.push(this.zeile('Senkrechte Fugen', this.chips([['boden', 'wie Boden'], ['ecke', 'um die Ecke'], ['optimal', '★ optimal'], ['mitte', 'Fuge mittig'], ['mitteFliese', 'Fliese mittig']], fc.xModus || 'ecke', v => this.ch('Senkrechte Fugen', () => { const t = z === 'wand' ? base : this.cfg(z, true); t.xModus = v; }))));
      kids.push(this.zeile('Waagrechte Fugen', this.chips([['unten', 'unten ganz'], ['oben', 'oben ganz'], ['hoehe', 'Fuge auf Höhe'], ['optimal', '★ optimal']], fc.yModus || 'unten', v => this.ch('Waagrechte Fugen', () => { const t = z === 'wand' ? base : this.cfg(z, true); t.yModus = v; }))));
      if ((fc.yModus || 'unten') === 'hoehe') kids.push(this.zeile('Fuge auf', this.num(fc.yHoehe || 1000, v => this.ch('Fugenhöhe', () => { const t = z === 'wand' ? base : this.cfg(z, true); t.yHoehe = v; })), h('small', { class: 'muted' }, ' mm (z. B. Waschtisch-Oberkante, Fensterbank)')));
    }
    if (z === 'wand') {
      kids.push(h('div', { class: 'fs-zeile wrap' },
        h('button', { class: 'btn sm', onclick: () => { this.ziel = 'oben'; this.alles(); } }, this.aktiv('oben') ? '⬒ Wand oben bearbeiten' : '+ 2. Fliese oben (Zweiteilung)'),
        h('button', { class: 'btn sm', onclick: () => { this.ziel = 'fries'; this.alles(); } }, this.aktiv('fries') ? '═ Fries bearbeiten' : '+ Bordüre / Fries'),
        base && base.wandOrigin ? h('button', { class: 'btn sm', onclick: () => this.ch('Wand-Startpunkte', () => base.wandOrigin = null) }, 'Wand-Startpunkte zurücksetzen') : null,
        base && base.einzeln && Object.keys(base.einzeln).length ? h('button', { class: 'btn sm', onclick: () => this.ch('Einzelwände zurücksetzen', () => base.einzeln = {}) }, 'alle Wände wieder gleich') : null));
    }
    return this.sec(z === 'wand' ? 'Höhe & Fugenlage Wände' : 'Höhe & Fugenlage dieser Wand', ...kids);
  }
  secBauteil(z, c, an) {
    const sy = this.doc.byId(z.slice(3)); if (!sy) return h('div', {});
    const d = K.BAUTEIL_FLIESEN[sy.kind]; const H = raumHoehe(this.doc, this.room); const w = this.cfg('wand');
    const kids = [];
    const sch = (txt, val, fn) => h('label', { class: 'fs-schalter' }, h('input', { type: 'checkbox', checked: !!val, onchange: (e) => fn(e.target.checked) }), h('span', {}, txt));
    kids.push(sch(`${d.name} fliesen`, an, v => this.ch(d.name, () => { const cc = this.cfg(z, true); cc.aktiv = v; })));
    if (!an) { kids.push(h('div', { class: 'muted' }, 'Haken setzen oder in der Mitte eine Fliese antippen. Ohne eigene Fliese wird die Wandfliese verwendet. Die Wand dahinter wird bis zur Bauteilhöhe automatisch abgezogen.')); return this.sec('Bauteil', ...kids); }
    kids.push(sch('eigene Fliese / Verlegung (sonst wie die Wände)', c.eigeneFliese, v => this.ch('Eigene Fliese', () => { c.eigeneFliese = v; if (v && w) for (const kk of K.FLIESEN_FELDER) if (c[kk] === undefined && w[kk] !== undefined) c[kk] = clone(w[kk]); if (v && w && !c.verband) c.verband = w.verband; })));
    if (!w && !c.eigeneFliese) kids.push(h('div', { class: 'note warn' }, 'Für die Wände ist noch keine Fliese gewählt – bitte eigene Fliese wählen (Mitte antippen).'));
    kids.push(this.zeile('Höhe', this.chips(K.BAUTEIL_HOEHEN, c.hoehe ?? d.h, v => this.ch('Bauteilhöhe', () => c.hoehe = v)), this.num(c.hoehe > 0 ? c.hoehe : '', v => this.ch('Bauteilhöhe', () => c.hoehe = v), { w: 80 }), h('small', { class: 'muted' }, ' mm')));
    const fl = this.fliese(z); if (fl && fl.B && c.hoehe > 0) { const reihe = fl.B + fl.fuge; const n = Math.max(1, Math.round(c.hoehe / reihe)); kids.push(this.zeile('', h('button', { class: 'btn sm', onclick: () => this.ch('Höhe auf Fliesenreihe', () => c.hoehe = Math.round(n * reihe - fl.fuge)) }, `↧ auf ganze Fliesenreihe: ${G.fmtCm(n * reihe - fl.fuge)} cm`))); }
    const seiten = bauteilSeiten(sy, this.room); const sg = h('div', { class: 'fs-chips' });
    for (const sd of seiten) {
      if (sd.anliegend) { ap(sg, h('span', { class: 'chip', style: 'opacity:.5', title: 'liegt an der Wand an' }, `${sd.name} (an Wand)`)); continue; }
      const an2 = !(c.seiten && c.seiten[sd.name] === false);
      ap(sg, h('button', { class: 'chip' + (an2 ? ' on' : ''), onclick: () => this.ch('Seite', () => { c.seiten = c.seiten || {}; c.seiten[sd.name] = !an2; }) }, `${an2 ? '✓' : '○'} ${sd.name} ${G.fmtCm(sd.len)}`));
    }
    kids.push(this.zeile('Seiten', sg));
    const hh = bauteilHoehe(sy, H);
    if (hh < H - 10) kids.push(this.zeile('Ablage oben', this.chips([[true, 'gefliest'], [false, 'nicht gefliest (z. B. Abdeckplatte)']], c.oben ?? d.oben, v => this.ch('Ablage oben', () => c.oben = v))));
    kids.push(this.zeile('Fugenlage', this.chips([['optimal', '★ optimal'], ['links', 'ganze Fliese links'], ['mitte', 'Fuge mittig']], c.xStart || 'optimal', v => this.ch('Fugenlage', () => c.xStart = v))));
    const ps = h('select', {}); for (const [v, l] of K.PROFILE) ps.append(h('option', { value: v, selected: (c.profil || '') === v }, l)); ps.onchange = () => this.ch('Eckprofil', () => c.profil = ps.value);
    kids.push(this.zeile('Außenecken', ps));
    kids.push(this.zeile('Bezeichnung', (() => { const i = h('input', { type: 'text', value: sy.name || '', placeholder: d.name }); i.onchange = () => this.ch('Bezeichnung', () => sy.name = i.value); return i; })()));
    kids.push(h('div', { class: 'muted' }, `Maße ${G.fmtCm(sy.w)} × ${G.fmtCm(sy.d)} cm (im Grundriss ändern). Die Wand dahinter ist bis ${G.fmtCm(hh)} cm abgezogen; Außenecken und Silikonfugen werden mitgerechnet.`));
    return this.sec(this.zielName(z), ...kids);
  }
  secOben(c) {
    const w = this.cfg('wand'); const surfaces = this.waende(); const maxTuer = Math.max(0, ...surfaces.flatMap(s => s.openings.filter(o => o.kind !== 'window').map(o => o.sill + o.height)));
    const f = this.fliese('wand'); const reihe = f ? f.B + f.fuge : 0;
    const kids = [this.zeile('Wechsel ab', this.chips([[900, '0,90 m'], [1000, '1,00 m'], [1200, '1,20 m'], [1500, '1,50 m'], [maxTuer || 2010, 'Türhöhe']], c.ab, v => this.ch('Zweiteilung ab', () => c.ab = v)), this.num(c.ab, v => this.ch('Zweiteilung ab', () => c.ab = v)), h('small', { class: 'muted' }, ' mm'))];
    if (reihe) { const n = Math.max(1, Math.round(c.ab / reihe)); kids.push(this.zeile('', h('button', { class: 'btn sm', onclick: () => this.ch('Auf Fugenschnitt', () => c.ab = Math.round(n * reihe - (f.fuge / 2))) }, `↧ auf Fuge der unteren Fliese: ${G.fmtCm(n * reihe)} cm`))); }
    kids.push(h('div', { class: 'muted' }, 'Unten bis zur Wechselhöhe die Fliese von „Alle Wände“, darüber diese Fliese bis zur Fliesenhöhe. Oben beginnt mit ganzer Reihe.'));
    if (!w || !(w.hoehe === 0 || !w.hoehe || w.hoehe > c.ab)) kids.push(h('div', { class: 'note warn' }, 'Die Fliesenhöhe der Wände liegt unter der Wechselhöhe – Fliesenhöhe erhöhen.'));
    return this.sec('Zweiteilung', ...kids);
  }
  secRand(c) {
    return this.sec('Randfries Boden',
      this.zeile('Breite', this.chips([[50, '5 cm'], [100, '10 cm'], [150, '15 cm'], [200, '20 cm'], [300, '30 cm']], c.breite, v => this.ch('Randbreite', () => c.breite = v)), this.num(c.breite, v => this.ch('Randbreite', () => c.breite = v)), h('small', { class: 'muted' }, ' mm')),
      this.zeile('Ecken', this.chips([['gehrung', '◸ auf Gehrung (45°)'], ['durchlaufend', '▦ durchlaufend (Raster)']], c.ecken || 'gehrung', v => this.ch('Randfries-Ecken', () => c.ecken = v))),
      h('div', { class: 'muted' }, 'Ein umlaufendes Band an den Wänden mit eigener Fliese (z. B. dunkler Rahmen), innen die Bodenfliese. Je Wand läuft die Fliese längs, Start mit ganzer Fliese in der Ecke.'));
  }
  secFries(c) {
    const w = this.cfg('wand'); const f = this.fliese('wand'); const reihe = f ? f.B + f.fuge : 0;
    const kids = [
      this.zeile('Unterkante', this.chips([[900, '0,90'], [1000, '1,00'], [1200, '1,20'], [1500, '1,50'], [1800, '1,80']], c.z, v => this.ch('Fries-Höhe', () => c.z = v)), this.num(c.z, v => this.ch('Fries-Höhe', () => c.z = v)), h('small', { class: 'muted' }, ' mm')),
      reihe ? this.zeile('', h('button', { class: 'btn sm', onclick: () => this.ch('Fries auf Fuge', () => c.z = Math.round(Math.max(1, Math.round(c.z / reihe)) * reihe)) }, '↧ auf nächste Fuge der Wandfliese')) : null,
      this.zeile('Fries-Höhe', this.chips([[20, '2 cm'], [30, '3 cm'], [50, '5 cm'], [75, '7,5 cm'], [100, '10 cm'], [150, '15 cm']], c.breite, v => this.ch('Fries-Breite', () => c.breite = v)), this.num(c.breite, v => this.ch('Fries-Breite', () => c.breite = v), { w: 64 })),
      this.zeile('Stücklänge', this.num(c.L || 250, v => this.ch('Fries-Länge', () => c.L = v)), h('small', { class: 'muted' }, ' mm')),
      this.zeile('Bezeichnung', (() => { const i = h('input', { type: 'text', value: c.name || '' }); i.onchange = () => this.ch('Fries', () => c.name = i.value); return i; })()),
      this.zeile('Farbe', (() => { const i = h('input', { type: 'color', value: c.farbe || '#4d5258' }); i.onchange = () => this.ch('Fries-Farbe', () => c.farbe = i.value); return i; })()),
      this.zeile('Profil', (() => { const s = h('select', {}); for (const [v, l] of [['', 'kein'], ...K.PROFILE.slice(1)]) ap(s, h('option', { value: v, selected: (c.profil || '') === v }, l)); s.onchange = () => this.ch('Fries-Profil', () => c.profil = s.value); return s; })()),
      h('div', { class: 'muted' }, 'Bordüre/Fries, Listello, Glasmosaik-Streifen oder Edelstahl-Profilband. Darüber geht es mit ganzer Fliesenreihe weiter.')];
    if (w && w.hoehe && w.hoehe < c.z) kids.push(h('div', { class: 'note warn' }, 'Der Fries liegt über der Fliesenhöhe.'));
    return this.sec('Bordüre / Fries', ...kids);
  }
  secSockel(c) {
    const b = this.cfg('boden');
    return this.sec('Sockel',
      this.zeile('Höhe', this.chips(K.SOCKELHOEHEN.map(v => [v, G.fmtCm(v) + ' cm']), c.hoehe, v => this.ch('Sockelhöhe', () => { c.hoehe = v; if (c.quelle !== 'boden') c.B = v; })), this.num(c.hoehe, v => this.ch('Sockelhöhe', () => { c.hoehe = v; if (c.quelle !== 'boden') c.B = v; }), { w: 64 })),
      this.zeile('Woraus', this.chips([['boden', 'aus Bodenfliese schneiden'], ['eigen', 'eigene Sockelfliese']], c.quelle || 'eigen', v => this.ch('Sockel aus', () => c.quelle = v))),
      c.quelle === 'boden' && !(b && b.aktiv) ? h('div', { class: 'note warn' }, 'Für den Boden ist noch keine Fliese gewählt.') : null,
      c.quelle !== 'boden' ? this.zeile('Stücklänge', this.num(Math.max(c.L || 600, c.B || 60), v => this.ch('Sockel-Länge', () => c.L = v)), h('small', { class: 'muted' }, ' mm')) : null,
      this.zeile('Fuge', this.chips([[2, '2'], [3, '3'], [4, '4'], [5, '5']], c.fuge || 3, v => this.ch('Sockelfuge', () => c.fuge = v)), h('small', { class: 'muted' }, ' mm')),
      this.zeile('Oberkante', this.chips([['', 'Fliese gefast/glasiert'], ['profil', 'Abschlussprofil'], ['silikon', 'Silikon-Anschluss']], c.oben || '', v => this.ch('Sockel-Oberkante', () => c.oben = v))),
      this.zeile('Reserve', this.num(c.reserve ?? 10, v => this.ch('Reserve', () => c.reserve = v), { w: 60 }), h('small', { class: 'muted' }, ' %')),
      h('div', { class: 'muted' }, 'Der Sockel läuft an allen Wänden, die nicht ab Boden gefliest sind – Türen werden abgezogen. In der Wandabwicklung gelb dargestellt.'));
  }
  secFuge(c) {
    const kids = [
      this.zeile('Breite', this.chips(K.FUGENBREITEN.map(v => [v, zahl(v, v % 1 ? 1 : 0)]), c.fuge, v => this.ch('Fugenbreite', () => c.fuge = v)), this.num(c.fuge, v => this.ch('Fugenbreite', () => c.fuge = v), { step: 0.5, w: 60 }), h('small', { class: 'muted' }, ' mm'))];
    const fg = h('div', { class: 'fs-fugen' });
    for (const [n, hex] of K.FUGENFARBEN) ap(fg, h('button', { class: 'fs-fugef' + ((c.fugeFarbe || '').toLowerCase() === hex ? ' an' : ''), title: n, style: `background:${hex}`, onclick: () => this.ch('Fugenfarbe', () => { c.fugeFarbe = hex; c.fugeName = n; }) }));
    const eig = h('input', { type: 'color', value: c.fugeFarbe || '#a8a29a', title: 'eigene Fugenfarbe' }); eig.onchange = () => this.ch('Fugenfarbe', () => { c.fugeFarbe = eig.value; c.fugeName = ''; });
    kids.push(this.zeile('Farbe', fg, eig, h('small', { class: 'muted' }, ' ' + (c.fugeName || ''))));
    const ms = h('select', {}); for (const [v, l] of K.FUGENMATERIAL) ap(ms, h('option', { value: v, selected: (c.fugeMaterial || 'zement') === v }, l)); ms.onchange = () => this.ch('Fugenmaterial', () => c.fugeMaterial = ms.value);
    kids.push(this.zeile('Material', ms));
    kids.push(this.zeile('Fugentiefe', this.num(c.fugeTiefe || Math.round(K.FUGENTIEFE(c.staerke)), v => this.ch('Fugentiefe', () => c.fugeTiefe = v), { w: 60 }), h('small', { class: 'muted' }, ' mm (für Fugenmörtel-Menge)')));
    const m = Math.max(c.L, c.B); if (c.fuge < 2 && !c.rektifiziert && m > 100) kids.push(h('div', { class: 'note warn' }, 'Unter 2 mm nur bei rektifizierten Fliesen – sonst sieht man Kalibertoleranzen.'));
    if (m >= 600 && c.fuge < 3) kids.push(h('div', { class: 'note warn' }, 'Großformat: Fuge mind. 3 mm empfohlen.'));
    return this.sec('Fugen', ...kids);
  }
  secKante(c, z) {
    const ps = h('select', {}); for (const [v, l] of K.PROFILE) ap(ps, h('option', { value: v, selected: (c.profil || '') === v }, l)); ps.onchange = () => this.ch('Profil', () => c.profil = ps.value);
    const pf = h('select', {}); for (const [v, l] of K.PROFIL_FORM) ap(pf, h('option', { value: v, selected: (c.profilForm || 'l') === v }, l)); pf.onchange = () => this.ch('Profilform', () => c.profilForm = pf.value);
    const va = h('select', {}); for (const [v, l] of K.VERLEGEART) ap(va, h('option', { value: v, selected: (c.verlegeart || (Math.max(c.L, c.B) >= 600 ? 'buttering' : 'duenn')) === v }, l)); va.onchange = () => this.ch('Verlegeart', () => c.verlegeart = va.value);
    const kl = h('select', {}); for (const [v, l] of K.KLEBER) ap(kl, h('option', { value: v, selected: (c.kleber || (Math.max(c.L, c.B) >= 600 ? 'c2es2' : 'c2te')) === v }, l)); kl.onchange = () => this.ch('Kleber', () => c.kleber = kl.value);
    const ke = K.kleberEmpfehlung(c.L, c.B, c.verlegeart || (Math.max(c.L, c.B) >= 600 ? 'buttering' : 'duenn'));
    return this.sec('Kanten, Verlegeart & Kleber',
      this.zeile(z === 'boden' ? 'Übergänge / Kanten' : 'Außenkanten / Abschluss', ps), c.profil ? this.zeile('Profilform', pf) : null,
      this.zeile('Verlegeart', va), this.zeile('Kleber', kl),
      h('div', { class: 'muted' }, ke.zahn ? `Empfehlung: Zahnspachtel ${ke.zahn} mm · ca. ${zahl(ke.kg, 1)} kg/m²` : `Mörtelbett ca. ${ke.kg} kg/m²`),
      z === 'wand' ? h('div', { class: 'muted' }, 'Silikon an Boden/Wand-Anschluss und Innenecken wird automatisch mitgerechnet; Kantenschutz an Laibungen ebenso.') : null);
  }
  /** Mengen & Kosten des Raums (live) */
  mengen() {
    const r = this.room; const box = h('div', { 'data-teil': 'mengen' });
    const kv = h('div', { class: 'kv' }); const add = (k, v, cls) => ap(kv, h('span', {}, k), h('b', {}, cls ? h('span', { class: 'pill ' + cls }, v) : v));
    let fr = null, wp = null;
    try {
      if (this.istZone()) fr = zoneTiles(r); else { fr = floorTiles(this.doc, W.storeyGeometry(this.doc, r.storey), r); wp = wallTilePlan(this.doc, r, fr); }
    } catch (e) { console.error(e); }
    let kosten = 0, kleber = 0, fuge = 0;
    const zeig = (titel, cfg, s, extra = {}) => {
      ap(kv, h('span', { class: 'fs-kvh' }, titel), h('b', { class: 'fs-kvh' }, cfg.name || ''));
      add('Fläche netto', m2(s.m2 + (extra.laibung || 0)) + (extra.laibung ? ` (inkl. ${zahl(extra.laibung)} Laibung)` : ''));
      add('ganze / geschnitten', `${s.full} / ${s.cut}`);
      if (s.krit || s.warn) add('kleine Randstücke', `${s.warn} < ½ · ${s.krit} zu klein`, s.krit ? 'bad' : 'warn');
      add(`Bestellung (+${cfg.reserve ?? 5} %)`, `${s.bedarf} Stk = ${m2(s.m2Bestell)}`);
      if (s.pakete) add('Pakete', String(s.pakete)); else if (cfg.stkPaket > 0) add('Pakete', String(Math.ceil(s.bedarf / cfg.stkPaket)));
      if (s.verschnitt !== undefined) add('Verschnitt', zahl(s.verschnitt || 0, 1) + ' %');
      if (cfg.matte) add('Matten (≈ 30×30)', String(Math.ceil(s.m2Bestell / 0.09)));
      const kk = T.materialRichtwerte(s.m2 + (extra.laibung || 0), cfg).kleberKg; kleber += kk; fuge += s.fugeKg || 0;
      if (cfg.preisM2 > 0) { const k = s.m2Bestell * cfg.preisM2; kosten += k; add('Material', eur(k)); }
    };
    if (fr) { zeig(this.istZone() ? 'Fläche' : 'Boden', this.istZone() ? r.tiles : r.tiles.boden, fr.stats); if (fr.rand) zeig('Randfries', fr.rand.cfg, fr.rand.stats); }
    if (wp) for (const rw of wp.rows) {
      if (rw.art === 'wand' || rw.art === 'oben' || rw.art === 'bauteil') { const tileM2 = rw.cfg.L * rw.cfg.B / 1e6; zeig(rw.art === 'oben' ? 'Wand oben' : rw.art === 'bauteil' ? 'Bauteile: ' + (rw.bauteile || []).join(', ') : 'Wände', rw.cfg, { m2: rw.m2, full: rw.full, cut: rw.cut, krit: rw.krit, warn: rw.warn, bedarf: rw.bedarf, m2Bestell: rw.m2Bestell, pakete: rw.pakete, fugeKg: rw.fugeKg, verschnitt: rw.m2 > 0 ? ((rw.bedarf * tileM2) / (rw.m2 + rw.laibung) - 1) * 100 : 0 }, { laibung: rw.laibung }); }
      else if (rw.art === 'sockel') { ap(kv, h('span', { class: 'fs-kvh' }, 'Sockel'), h('b', { class: 'fs-kvh' }, rw.ausBoden ? 'aus Bodenfliese' : (rw.cfg.name || ''))); add('Länge', zahl(rw.lfm, 1) + ' lfm'); add('Stücke', String(rw.stuecke)); add(rw.ausBoden ? `Bodenfliesen dafür (${rw.streifen} Streifen/Fliese)` : 'Bestellung', `${rw.bedarf} Stk`); if (!rw.ausBoden && rw.cfg.preisM2 > 0) { const k = rw.bedarf * rw.cfg.L * rw.cfg.B / 1e6 * rw.cfg.preisM2; kosten += k; add('Material', eur(k)); } }
      else if (rw.art === 'fries') { ap(kv, h('span', { class: 'fs-kvh' }, 'Fries'), h('b', { class: 'fs-kvh' }, rw.cfg.name || '')); add('Länge', zahl(rw.lfm, 1) + ' lfm'); add('Stücke', `${rw.bedarf} Stk`); }
    }
    if (!fr && !wp) { ap(box, this.sec('Mengen & Kosten (Raum)', h('div', { class: 'muted' }, 'Noch nichts gefliest.'))); return box; }
    ap(kv, h('span', { class: 'fs-kvh' }, 'Zubehör'), h('b', { class: 'fs-kvh' }, ''));
    add('Fliesenkleber ca.', `${Math.round(kleber)} kg ≈ ${Math.ceil(kleber / 25)} Sack à 25 kg`);
    add('Fugenmörtel ca.', `${zahl(fuge, 1)} kg ≈ ${Math.ceil(fuge / 5) || 0} Eimer à 5 kg`);
    if (wp) { add('Silikon (Boden/Wand, Innenecken)', `${zahl(wp.sum.silikonLfm, 1)} lfm ≈ ${Math.ceil(wp.sum.silikonLfm / 8)} Kartusche(n)`); if (wp.sum.schiene) add('Kantenschutz Laibungen', `${zahl(wp.sum.schiene, 1)} lfm ≈ ${Math.ceil(wp.sum.schiene / 2.5)} Stangen à 2,5 m`); if (wp.sum.profilLfm) add('Abschlussprofil', `${zahl(wp.sum.profilLfm, 1)} lfm ≈ ${Math.ceil(wp.sum.profilLfm / 2.5)} Stangen`); }
    if (kosten) add('Fliesen-Material gesamt', eur(kosten));
    // Eingaben für das aktuelle Ziel
    const c = this.cfg(this.ziel); const ein = [];
    if (c && this.aktiv(this.ziel) && !['fries', 'sockel'].includes(this.ziel) && !(this.ziel.startsWith('wand:') && !c.eigeneFliese)) {
      ein.push(this.zeile('Reserve', this.num(c.reserve ?? 5, v => this.ch('Reserve', () => c.reserve = v), { w: 60 }), h('small', { class: 'muted' }, ' %')));
      ein.push(this.zeile('Preis', this.num(c.preisM2 || '', v => this.ch('Preis', () => c.preisM2 = v), { step: 0.01, w: 80 }), h('small', { class: 'muted' }, ' €/m² netto')));
      ein.push(this.zeile('Paket', this.num(c.paketM2 || '', v => this.ch('Paket', () => c.paketM2 = v), { step: 0.01, w: 70 }), h('small', { class: 'muted' }, ' m² oder '), this.num(c.stkPaket || '', v => this.ch('Paket', () => c.stkPaket = v), { w: 60 }), h('small', { class: 'muted' }, ' Stk')));
    }
    ap(box, this.sec('Mengen & Kosten (Raum)', kv, ...ein));
    return box;
  }
  secUebertragen() {
    const z = this.ziel;
    return this.sec('Übertragen & Entfernen',
      h('div', { class: 'fs-zeile wrap' },
        h('button', { class: 'btn sm', onclick: () => this.uebertragen(z === 'boden' || z === 'zone' ? ['boden'] : z === 'sockel' ? ['sockel'] : ['wand']) }, `„${this.zielName()}“ auf andere Räume …`),
        !this.istZone() ? h('button', { class: 'btn sm', onclick: () => this.uebertragen(['boden', 'wand', 'sockel']) }, 'ganzen Raum (Boden + Wände + Sockel) …') : null,
        h('button', { class: 'btn sm red', onclick: () => this.ch('Fliesen entfernen', () => { const c = this.cfg(z); if (c) c.aktiv = false; }) }, 'Fliesen hier entfernen')));
  }
  uebertragen(teile) {
    const app = this.app; const quelle = this.room; const ziele = this.rooms().filter(r => r.type === 'room' && r.id !== this.roomId);
    if (!ziele.length) return app.toast('Keine weiteren Räume vorhanden.', true);
    const body = h('div', {}); const checks = [];
    ap(body, h('div', { class: 'muted', style: 'margin-bottom:8px' }, `Übernimmt ${teile.map(t => ({ boden: 'Boden (inkl. Randfries)', wand: 'Wände (inkl. Zweiteilung, Fries)', sockel: 'Sockel' }[t])).join(', ')} von „${this.raumName(quelle)}“. Startpunkte werden je Raum neu optimiert.`));
    const alle = h('input', { type: 'checkbox' }); alle.onchange = () => checks.forEach(([c]) => c.checked = alle.checked);
    ap(body, h('label', { class: 'li' }, alle, h('b', {}, 'alle Räume')));
    for (const r of ziele) { const c = h('input', { type: 'checkbox' }); checks.push([c, r]); ap(body, h('label', { class: 'li' }, c, h('span', { class: 'grow' }, this.raumName(r)), r.tiles && (r.tiles.boden || r.tiles.wand) ? h('span', { class: 'pill warn' }, 'hat schon Fliesen') : null)); }
    const close = app.modal('Auf andere Räume übertragen', body, [h('button', { class: 'btn', onclick: () => close() }, 'Abbrechen'), h('button', { class: 'btn pri', onclick: () => {
      let n = 0; const src = quelle.type === 'tilezone' ? { boden: quelle.tiles } : quelle.tiles || {};
      this.ch('Fliesen übertragen', () => { for (const [c, r] of checks) if (c.checked) { r.tiles = r.tiles || {}; n++; for (const t of teile) { if (!src[t]) continue; const x = clone(src[t]); x.origin = null; if (x.originMode === 'frei') x.originMode = 'optimal'; x.wandOrigin = null; x.einzeln = {}; x.tuerStart = null; r.tiles[t] = x; } } });
      close(); app.toast(`Auf ${n} Raum/Räume übertragen ✓`);
    } }, 'Übertragen')]);
  }
  /* ───────── LV ───────── */
  async lvDatei(file = null) {
    if (FREI) return;
    const M = await import('./ai.js?v=20261123-0837');
    const n0 = this.doc.p.tileLib.length;
    await M.readLV(this.app, file);
    if (this.doc.p.tileLib.length > n0) { this.tab = 'lv'; this.alles(); this.angebotAuto(); }
  }
  async lvDrive() {
    if (FREI) return;
    const D = await import('./drive.js?v=20261123-0837'); const b = this.doc.p.meta.baustelle; const app = this.app;
    if (!D.token()) { try { await D.anmelden(); } catch (e) { return app.toast('Google Drive: ' + e.message, true); } }
    app.toast('Suche LV-Dateien im Baustellen-Ordner …');
    let liste = [];
    try { liste = await D.lvDateien(b.id); } catch (e) { return app.toast(e.message, true); }
    if (!liste.length) return app.toast('Im Baustellen-Ordner wurde kein LV gefunden (Dateiname mit „LV“, „Leistungsverzeichnis“ oder GAEB X83/D83).', true);
    const body = h('div', { class: 'list' });
    const close = app.modal('LV aus „' + b.name + '“ wählen', body);
    for (const d of liste) ap(body, h('div', { class: 'li', onclick: async () => { close(); app.toast('Lade ' + d.name + ' …'); try { const dd = await D.dateiDaten(d); const f = new File([dd.buf], d.name, { type: dd.mime || d.mimeType || '' }); await this.lvDatei(f); } catch (e) { app.toast(e.message, true); } } },
      h('span', { class: 'grow' }, d.name), h('span', { class: 'mut' }, d.ordner || '')));
  }
  lvText() {
    const app = this.app; const ta = h('textarea', { class: 'big', style: 'width:100%;height:320px', placeholder: 'LV-Text hier einfügen (aus PDF kopiert oder GAEB als Text). Beispiel:\n02.01.0010 Bodenfliesen Feinsteinzeug 30x60 cm, R10, Fabrikat: Agrob Buchtal, Serie: Valley, Farbe: grau, Fugenbreite 3 mm  85,00 m²' });
    const close = app.modal('LV-Text auslesen (ohne KI)', h('div', {}, ta, h('div', { class: 'muted', style: 'margin-top:6px' }, 'Erkannt werden Positionsnummer, Format, Bereich (Boden/Wand/Sockel/Vorwand/Dusche), Hersteller/Fabrikat, Serie, Farbe, Rutschhemmung, Fugenbreite und Menge. Für schwierige LVs besser „LV-Datei lesen (KI)“.')), [h('button', { class: 'btn', onclick: () => close() }, 'Abbrechen'), h('button', { class: 'btn pri', onclick: () => {
      const list = K.lvTextAuslesen(ta.value); if (!list.length) return app.toast('Keine Fliesenposition mit Format gefunden.', true);
      this.ch('Fliesen aus LV-Text', () => { for (const t of list) { const da = this.doc.p.tileLib.find(x => x.pos && x.pos === t.pos); if (da) Object.assign(da, t); else this.doc.p.tileLib.push(Object.assign({ id: uid('t') }, t)); } }, false);
      close(); app.toast(`${list.length} Fliesenposition(en) erkannt ✓`); this.tab = 'lv'; this.alles(); this.angebotAuto();
    } }, 'Auslesen')]);
  }
  angebotAuto() {
    const leer = this.rooms().filter(r => r.type === 'room' && !(r.tiles && ((r.tiles.boden && r.tiles.boden.aktiv) || (r.tiles.wand && r.tiles.wand.aktiv))));
    if (!leer.length) return;
    const close = this.app.modal('Räume automatisch belegen?', h('div', {}, `${leer.length} Raum/Räume haben noch keine Fliesen. Sollen Boden, Wände und Sockel jetzt automatisch aus dem LV belegt werden? (Bodenfliese → Boden, Wandfliese → Wände, Sockel → Sockel; passt der Raumname zu einer Position, wird diese genommen.)`), [h('button', { class: 'btn', onclick: () => close() }, 'Nein, selbst zuordnen'), h('button', { class: 'btn pri', onclick: () => { close(); this.autoBelegen(false); } }, 'Ja, automatisch belegen')]);
  }
  autoBelegen(ueberschreiben = null) {
    const lib = this.doc.p.tileLib.filter(t => t.L > 0);
    const gross = (l) => l.slice().sort((a, b) => b.L * b.B - a.L * a.B);
    const wahl = (bereiche, r) => { let l = lib.filter(t => bereiche.includes(t.bereich) && (t.pos || t.quelle === 'lv')); if (!l.length) l = lib.filter(t => bereiche.includes(t.bereich)); if (!l.length) return null; const p = l.filter(t => K.raumPasst(t, r.name)); return gross(p.length ? p : l)[0]; };
    const rooms = this.rooms().filter(r => r.type === 'room');
    const doIt = (uw) => {
      let n = 0;
      this.ch('LV automatisch zuordnen', () => {
        for (const r of rooms) {
          r.tiles = r.tiles || {}; let hit = false;
          const setz = (key, t, std) => { if (!t) return; const c = r.tiles[key]; if (c && c.aktiv && !uw) return; const n0 = T.defaultTileCfg(Object.assign({ aktiv: true }, std)); const x = c && !uw ? c : n0; for (const k of K.FLIESEN_FELDER) if (t[k] !== undefined && t[k] !== '' && k !== 'bereich') x[k] = clone(t[k]); x.libId = t.id; x.lvPos = t.pos; x.aktiv = true; r.tiles[key] = x; hit = true; };
          setz('boden', wahl(['boden', 'dusche'], r), BODEN_STD);
          setz('wand', wahl(['wand'], r), WAND_STD);
          const so = wahl(['sockel'], r);
          if (so && (!r.tiles.sockel || !r.tiles.sockel.aktiv || uw)) { r.tiles.sockel = { aktiv: true, hoehe: so.sockelH || Math.min(so.L, so.B), quelle: 'eigen', L: Math.max(so.L, so.B), B: Math.min(so.L, so.B), fuge: so.fuge || 3, name: so.name, farbe: so.farbe, libId: so.id, lvPos: so.pos, reserve: 10 }; hit = true; }
          const vw = wahl(['vorwand'], r);
          for (const sy of raumBauteile(this.doc, r)) {
            if (sy.fliesen && sy.fliesen.aktiv && !uw) continue;
            const d = K.BAUTEIL_FLIESEN[sy.kind]; if (!r.tiles.wand && !vw) continue;
            const f = { aktiv: true, hoehe: d.h, oben: d.oben, eigeneFliese: false };
            if (vw && ['vorwand', 'schacht'].includes(sy.kind)) { for (const k of K.FLIESEN_FELDER) if (vw[k] !== undefined && vw[k] !== '' && k !== 'bereich') f[k] = clone(vw[k]); f.eigeneFliese = true; f.libId = vw.id; f.lvPos = vw.pos; }
            sy.fliesen = f; hit = true;
          }
          if (hit) n++;
        }
      });
      this.app.toast(n ? `${n} Raum/Räume aus dem LV belegt ✓ – bitte prüfen.` : 'Nichts zugeordnet (keine passenden LV-Fliesen oder schon belegt).', !n);
    };
    const schon = rooms.some(r => r.tiles && ((r.tiles.boden && r.tiles.boden.aktiv) || (r.tiles.wand && r.tiles.wand.aktiv)));
    if (ueberschreiben === null && schon) {
      const close = this.app.modal('Automatisch belegen', h('div', {}, 'Einige Räume haben schon Fliesen. Was soll passieren?'), [h('button', { class: 'btn', onclick: () => { close(); doIt(false); } }, 'Nur leere Räume belegen'), h('button', { class: 'btn pri', onclick: () => { close(); doIt(true); } }, 'Alle Räume neu belegen')]);
    } else doIt(!!ueberschreiben);
  }
  /* ───────── Ausgabe ───────── */
  materialliste() {
    const app = this.app; const S = tileSummary(this.doc);
    if (!S.rows.length) return app.toast('Noch keine Fliesen in den Räumen.', true);
    const t = h('table', { class: 'fs-tab-mat' });
    ap(t, h('tr', {}, ...['Fliese', 'Art', 'Format', 'Menge netto', 'Bestellung', 'Pakete', 'Fugenmörtel', 'Kleber', 'Kosten', 'Räume'].map(x => h('th', {}, x))));
    let summe = 0;
    for (const r of S.rows) { summe += r.kosten || 0; const pak = r.cfg.paketM2 > 0 ? Math.ceil(r.stuck * r.L * r.B / 1e6 / r.cfg.paketM2) : r.cfg.stkPaket > 0 ? Math.ceil(r.stuck / r.cfg.stkPaket) : ''; ap(t, h('tr', {}, h('td', {}, swatch(r.cfg, 22), ' ', `${r.name}${r.hersteller ? ' – ' + r.hersteller : ''}${r.cfg.lvPos ? ' (LV ' + r.cfg.lvPos + ')' : ''}`), h('td', {}, r.art), h('td', {}, K.formatText(r)), h('td', {}, r.lfm ? zahl(r.lfm, 1) + ' lfm' : m2(r.m2)), h('td', {}, r.stuck + ' Stk'), h('td', {}, String(pak)), h('td', {}, zahl(r.fugeKg, 1) + ' kg'), h('td', {}, Math.round(r.kleberKg || 0) + ' kg'), h('td', {}, r.kosten ? eur(r.kosten) : '–'), h('td', { class: 'muted' }, r.raeume.join(', ')))); }
    const csv = () => { const lines = ['Fliese;Art;Hersteller;Serie;Artikel-Nr;LV-Pos;Format cm;Menge;Einheit;Bestellung Stk;Fugenmoertel kg;Kleber kg;Kosten EUR;Raeume']; for (const r of S.rows) lines.push([r.name, r.art, r.hersteller, r.cfg.serie || '', r.cfg.artNr || '', r.cfg.lvPos || '', K.formatText(r), (r.lfm || r.m2).toFixed(2).replace('.', ','), r.lfm ? 'lfm' : 'm2', r.stuck, r.fugeKg.toFixed(1).replace('.', ','), Math.round(r.kleberKg || 0), (r.kosten || 0).toFixed(2).replace('.', ','), r.raeume.join(', ')].join(';')); app.downloadBlob(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' }), 'Fliesen-Materialliste.csv'); };
    app.modal('Materialliste Fliesen – alle Räume', h('div', {}, t, this.abdTabelle(), summe ? h('div', { style: 'text-align:right;margin-top:8px;font-weight:700' }, 'Fliesen-Material gesamt (netto): ' + eur(summe)) : null, h('div', { class: 'muted', style: 'margin-top:8px' }, 'Bestellmengen inkl. Reserve und Reststückverwertung; Laibungen sind bei den Wänden enthalten. Kleber nach Format und Verlegeart.')), [h('button', { class: 'btn', onclick: csv }, 'Als CSV (Excel)'), h('button', { class: 'btn pri', onclick: () => this.pdf(true) }, 'Als PDF (dieser Raum)')]);
  }
  async pdf(nurMaterial = false) {
    const M = await import('./print.js?v=20261123-0837');
    const holder = h('div', { style: 'position:fixed;left:-9999px;top:0;width:800px;height:600px' }); ap(document.body, holder);
    const v = mountPlanEmbedded(this.app, holder, { roomId: this.roomId, flaeche: 'beides', mode: 'plan' });
    try { await M.printTilePlan(this.app, v, { nurMaterial }); } finally { if (v._ro) v._ro.disconnect(); holder.remove(); }
  }
}

function mountPlanEmbedded(app, el, opt) { return mountPlan(app, el, Object.assign({ embedded: true }, opt)); }

/* ───────── Bild für Schritt 5: Dusche, Gefälle, Abdichtungsklassen ───────── */
function schild(x, t, cx, cy, farbe) { const w = x.measureText(t).width; x.save(); x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(cx - (x.textAlign === 'center' ? w / 2 : 0) - 4, cy - 12, w + 8, 17); x.restore(); x.fillStyle = farbe; x.fillText(t, cx, cy); }
function abdBild(cv, room, R) {
  const box = cv.parentElement.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(10, box.width * dpr); cv.height = Math.max(10, box.height * dpr); cv.style.width = box.width + 'px'; cv.style.height = box.height + 'px';
  const x = cv.getContext('2d'); x.scale(dpr, dpr); const W = box.width, H = box.height;
  x.fillStyle = '#f6f5f2'; x.fillRect(0, 0, W, H);
  const bb = G.bbox(room.poly); const s = Math.min((W - 120) / bb.w, (H - 140) / bb.h); const ox = (W - bb.w * s) / 2 - bb.x0 * s, oy = (H - bb.h * s) / 2 + bb.y1 * s + 10;
  const P = (p) => [ox + p.x * s, oy - p.y * s]; const pfad = (poly) => { x.beginPath(); poly.forEach((q, i) => { const [a, b] = P(q); i ? x.lineTo(a, b) : x.moveTo(a, b); }); x.closePath(); };
  x.lineWidth = 14; x.strokeStyle = '#3b3f45'; pfad(room.poly); x.stroke();
  const kl = R.a.klRaum; x.fillStyle = kl === 'keine' ? '#eceae5' : 'rgba(39,174,96,.22)'; pfad(room.poly); x.fill();
  if (R.fp && !R.ganz) { x.fillStyle = 'rgba(77,166,255,.38)'; pfad(R.fp); x.fill(); x.lineWidth = 2; x.setLineDash([7, 5]); x.strokeStyle = '#1d6fb8'; pfad(R.fp); x.stroke(); x.setLineDash([]); }
  else if (R.ganz) { x.fillStyle = 'rgba(77,166,255,.30)'; pfad(room.poly); x.fill(); }
  x.font = 'bold 14px Arial'; x.textAlign = 'center';
  const c = R.fp ? G.polyCentroid(R.fp) : null;
  if (R.fp) { const [cx, cy] = P(c); schild(x, `${R.tasse ? 'Duschtasse' : 'Dusche'} ${R.a.klDusche}`, cx, cy - 8, '#123f6b'); }
  if (kl !== 'keine' && !R.ganz) { const rc = G.polyCentroid(room.poly); const [a, b] = P(rc); schild(x, `Raumboden ${kl}`, a, b + (R.fp ? 40 : 0), '#1d6b3d'); }
  // Ablauf und Gefälle
  if (R.bodengleich && R.sy) {
    const sy = R.sy; const fp = R.fp; const k = R.kante || 0; const back0 = fp[k], back1 = fp[(k + 1) % 4], front0 = fp[(k + 3) % 4], front1 = fp[(k + 2) % 4];
    x.strokeStyle = '#C41E1E'; x.fillStyle = '#C41E1E'; x.lineWidth = 2.5;
    const pfeil = (from, to) => { const [a, b] = P(from), [c2, d] = P(to); x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); const ang = Math.atan2(d - b, c2 - a); x.beginPath(); x.moveTo(c2, d); x.lineTo(c2 - 11 * Math.cos(ang - .4), d - 11 * Math.sin(ang - .4)); x.lineTo(c2 - 11 * Math.cos(ang + .4), d - 11 * Math.sin(ang + .4)); x.closePath(); x.fill(); };
    if (R.a.ablauf === 'punkt') { for (const q of fp) pfeil(G.lerp(q, c, 0.15), G.lerp(q, c, 0.8)); const [a, b] = P(c); x.fillStyle = '#333'; x.beginPath(); x.arc(a, b, 7, 0, 7); x.fill(); }
    else { const kl0 = G.dist(back0, back1) || 1; const rl = R.a.ablauf === 'rinne' ? Math.min(R.a.rinneL, kl0) / kl0 : 0.15; const m = G.lerp(back0, back1, 0.5); const r0 = G.lerp(m, back0, rl), r1 = G.lerp(m, back1, rl); const inn = G.sub(G.lerp(front0, front1, 0.5), m); const L = Math.hypot(inn.x, inn.y) || 1; const nn = G.mul(inn, 60 / L);
      const [a, b] = P(G.add(r0, nn)), [c2, d] = P(G.add(r1, nn)); x.strokeStyle = '#333'; x.lineWidth = 7; x.beginPath(); x.moveTo(a, b); x.lineTo(c2, d); x.stroke(); x.strokeStyle = '#C41E1E'; x.lineWidth = 2.5;
      for (const t of [0.25, 0.5, 0.75]) { const f = G.lerp(front0, front1, t); const bk = G.lerp(back0, back1, t); pfeil(G.lerp(f, bk, 0.1), G.lerp(f, bk, 0.82)); } }
    const [a, b] = P(c); schild(x, `${zahl(R.a.gefaelle, 1)} % · ${zahl(R.dh, 0)} mm`, a, b + 14, '#C41E1E');
  }
  if (R.a.randfuge) { x.setLineDash([9, 6]); x.strokeStyle = '#e67e22'; x.lineWidth = 2; pfad(G.offsetPolys ? (G.offsetPolys([G.ensureCCW(room.poly)], -60)[0] || room.poly) : room.poly); x.stroke(); x.setLineDash([]); }
  x.textAlign = 'left'; x.font = '12px Arial'; x.fillStyle = '#333';
  const leg = [['rgba(77,166,255,.6)', `Dusche ${R.a.klDusche}`], [kl === 'keine' ? '#dcd9d2' : 'rgba(39,174,96,.5)', kl === 'keine' ? 'Raumboden ohne Abdichtung' : `Raumboden ${kl}`], ['#e67e22', R.a.randfuge ? 'Randfuge / Dichtband ringsum' : '']].filter(l => l[1]);
  leg.forEach(([f, t], i) => { x.fillStyle = f; x.fillRect(14, H - 22 - i * 20, 14, 12); x.fillStyle = '#333'; x.fillText(t, 34, H - 12 - i * 20); });
}

/* ───────── kleine Bilder ───────── */
/** Bild für die Bibliothek: mehrere Fliesen im Verband mit Fuge */
function bibBild(t, w = 150, hh = 96) {
  const c = h('canvas', { class: 'fs-bibbild', width: w * 2, height: hh * 2 });
  try {
    const x = c.getContext('2d'); x.fillStyle = t.fugeFarbe || '#c9c5bd'; x.fillRect(0, 0, c.width, c.height);
    const s = tileSurface(Object.assign({}, t), 256); const ratio = (t.B || 300) / (t.L || 600);
    const quer = ratio > 0.98 ? 2.3 : 1.6; let tl = c.width / quer, tb = tl * ratio; if (tb > c.height * 0.9) { tb = c.height * 0.6; tl = tb / ratio; }
    const g = 3; let row = 0;
    for (let y = -tb * 0.25; y < c.height; y += tb + g, row++) { const off = ratio < 0.98 && row % 2 ? tl / 2 : 0; for (let xx = -off - g; xx < c.width; xx += tl + g) x.drawImage(s, xx, y, tl, tb); }
  } catch (e) { }
  return c;
}
function swatch(t, px = 40) {
  const ratio = t.L && t.B ? Math.min(1.6, Math.max(0.45, t.B / t.L)) : 1;
  const w = px, hh = Math.max(14, Math.round(px * Math.min(1, ratio + 0.15)));
  const c = h('canvas', { class: 'fs-swc', width: w * 2, height: hh * 2, style: `width:${w}px;height:${hh}px` });
  try {
    const x = c.getContext('2d');
    if (t.textur === 'bild' && t.bildData) { const img = new Image(); img.onload = () => x.drawImage(img, 0, 0, c.width, c.height); img.src = t.bildData; x.fillStyle = t.farbe || '#ddd'; x.fillRect(0, 0, c.width, c.height); }
    else { const s = tileSurface(Object.assign({ L: 300, B: 300 }, t, { L: 300, B: 300 * (c.height / c.width) }), 128); x.drawImage(s, 0, 0, c.width, c.height); }
    x.strokeStyle = t.fugeFarbe || 'rgba(0,0,0,.35)'; x.lineWidth = 2; x.strokeRect(1, 1, c.width - 2, c.height - 2);
  } catch (e) { }
  return c;
}
function verbandBild(k, c) {
  const cv = h('canvas', { width: 120, height: 72, class: 'fs-vb' });
  try {
    const x = cv.getContext('2d'); x.fillStyle = '#6b7280'; x.fillRect(0, 0, 120, 72);
    const cfg = { L: 40, B: 20, fuge: 2, verband: k, angle: 0, seed: 3, versatz: c && c.versatz };
    if (k === 'fischgrat') { cfg.L = 36; cfg.B = 12; }
    const r = T.layTiles({ outer: [{ x: 0, y: 0 }, { x: 120, y: 0 }, { x: 120, y: 72 }, { x: 0, y: 72 }], holes: [] }, Object.assign({}, cfg, { origin: { x: 0, y: 0 } }));
    let i = 0;
    for (const p of r.pieces) { x.beginPath(); p.poly.forEach((q, j) => j ? x.lineTo(q.x, 72 - q.y) : x.moveTo(q.x, 72 - q.y)); x.closePath(); x.fillStyle = (i++ % 3 === 0) ? '#e5e7eb' : (i % 3 === 1 ? '#d1d5db' : '#f3f4f6'); x.fill(); }
  } catch (e) { }
  return cv;
}
function mittelFarbe(url) {
  return new Promise(res => { const i = new Image(); i.onload = () => { try { const c = document.createElement('canvas'); c.width = 8; c.height = 8; const x = c.getContext('2d'); x.drawImage(i, 0, 0, 8, 8); const d = x.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0; for (let k = 0; k < d.length; k += 4) { r += d[k]; g += d[k + 1]; b += d[k + 2]; } const n = d.length / 4; res('#' + [r, g, b].map(v => Math.round(v / n).toString(16).padStart(2, '0')).join('')); } catch (e) { res('#d9d4cc'); } }; i.onerror = () => res('#d9d4cc'); i.src = url; });
}
