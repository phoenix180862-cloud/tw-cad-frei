// TW-CAD – Datenmodell, Rückgängig/Wiederholen, Speichern (IndexedDB)
import { normalisiere } from './bauteile.js?v=20261028-0429';
import { FREI } from './frei.js?v=20261028-0429';
import { FIRMA } from './firma.js?v=20261028-0429';
import { t } from './i18n.js?v=20261028-0429';

let _id = Date.now() % 1e7;
export const uid = (p = 'e') => p + (++_id).toString(36) + Math.random().toString(36).slice(2, 5);

export const VERSION = 1;

export function defaultSettings() {
  return {
    einheit: 'mm', raster: 125, rasterAn: true, fangAn: true, orthoAn: false, spurAn: true, abstandAn: true, winkelRaster: 15,
    wandStaerke: 240, wandInnenStaerke: 115, wandHoehe: null, wandBezug: 'mitte', wandArt: 'aussen',
    tuerBreite: 885, tuerHoehe: 2130, fensterBreite: 1010, fensterHoehe: 1385, bruestung: 875,
    textHoehe: 250, massAbstand: 500, minRandstueck: 0.5, warnRandstueck: 0.33, fugenFarbe: '#9aa0a6'
  };
}

export function newProject(name = t('Neues Projekt')) {
  const eg = { id: uid('g'), name: t('EG'), elevation: 0, height: 2750, slab: 200, roomHeight: 2500 };
  return {
    format: 'tw-cad', version: VERSION, id: uid('p'), name,
    meta: { bauvorhaben: '', bauherr: '', ort: '', planer: FREI ? '' : FIRMA.name, planNr: '', index: '', datum: new Date().toISOString().slice(0, 10) },
    settings: defaultSettings(),
    storeys: [eg], activeStorey: eg.id,
    layers: [
      { id: 'L_konstr', name: t('Konstruktion'), color: '#1b1f24', visible: true, locked: false },
      { id: 'L_mass', name: t('Bemaßung'), color: '#1452a8', visible: true, locked: false },
      { id: 'L_text', name: t('Beschriftung'), color: '#1b1f24', visible: true, locked: false },
      { id: 'L_fliesen', name: t('Fliesen'), color: '#0e7c6b', visible: true, locked: false },
      { id: 'L_moebel', name: t('Einrichtung'), color: '#5b6470', visible: true, locked: false },
      { id: 'L_hilfs', name: t('Hilfslinien'), color: '#d0427f', visible: true, locked: false }
    ],
    elements: [],
    underlays: [],
    tileLib: [],
    site: { aktiv: false, nnEG: 0, punkte: [], grenze: null, nachbarn: [], nord: 0 },
    roofs: [],
    view: null
  };
}

export const LAYER_FOR = {
  wall: 'L_konstr', opening: 'L_konstr', room: 'L_konstr', column: 'L_konstr', stair: 'L_konstr', slabhole: 'L_konstr',
  dim: 'L_mass', level: 'L_mass', text: 'L_text', symbol: 'L_moebel', line: 'L_hilfs', poly: 'L_hilfs', circle: 'L_hilfs',
  guide: 'L_hilfs', tilezone: 'L_fliesen', joint: 'L_fliesen', section: 'L_mass', koerper: 'L_konstr', durchbruch: 'L_konstr', balken: 'L_konstr', dachfenster: 'L_konstr', gaube: 'L_konstr'
};

/** Zentrale Dokumentverwaltung mit Undo-Stapel */
export class Doc {
  constructor(project) {
    this.p = project || newProject();
    this.undoStack = []; this.redoStack = []; this.listeners = new Set(); this.dirty = false;
    this._batch = null; this.cacheVersion = 0;
  }
  on(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit(what = 'change') { this.cacheVersion++; for (const f of this.listeners) try { f(what); } catch (e) { console.error(e); } }
  snapshot() { return JSON.stringify({ elements: this.p.elements, storeys: this.p.storeys, layers: this.p.layers, site: this.p.site, roofs: this.p.roofs, tileLib: this.p.tileLib, meta: this.p.meta, kameras: this.p.kameras || [], underlays: this.p.underlays.map(u => ({ ...u, src: undefined })) }); }
  restore(s) {
    const o = JSON.parse(s);
    const srcs = new Map(this.p.underlays.map(u => [u.id, u.src]));
    Object.assign(this.p, o);
    this.p.underlays = (o.underlays || []).map(u => ({ ...u, src: srcs.get(u.id) }));
    if (!this.p.storeys.find(s => s.id === this.p.activeStorey)) this.p.activeStorey = this.p.storeys[0].id;
  }
  /** Änderung mit Rückgängig-Punkt ausführen */
  change(label, fn) {
    if (this._batch) { fn(); return; }
    const before = this.snapshot();
    let res;
    try { res = fn(); } catch (e) { this.restore(before); throw e; }
    const after = this.snapshot();
    if (after !== before) {
      this.undoStack.push({ label, before }); if (this.undoStack.length > 200) this.undoStack.shift();
      this.redoStack = []; this.dirty = true; this.emit('change');
    }
    return res;
  }
  undo() { const u = this.undoStack.pop(); if (!u) return null; this.redoStack.push({ label: u.label, before: this.snapshot() }); this.restore(u.before); this.dirty = true; this.emit('undo'); return u.label; }
  redo() { const r = this.redoStack.pop(); if (!r) return null; this.undoStack.push({ label: r.label, before: this.snapshot() }); this.restore(r.before); this.dirty = true; this.emit('redo'); return r.label; }

  get storey() { return this.p.storeys.find(s => s.id === this.p.activeStorey) || this.p.storeys[0]; }
  storeyById(id) { return this.p.storeys.find(s => s.id === id); }
  storeyIndex(id) { return this.p.storeys.findIndex(s => s.id === id); }
  storeyBelow(id) { const i = this.storeyIndex(id); return i > 0 ? this.p.storeys[i - 1] : null; }
  layer(id) { return this.p.layers.find(l => l.id === id); }
  byId(id) { return this.p.elements.find(e => e.id === id); }
  all(type, storeyId) { return this.p.elements.filter(e => (!type || e.type === type) && (storeyId === undefined || e.storey === storeyId)); }
  visible(e) { const l = this.layer(e.layer); return !l || l.visible; }
  locked(e) { const l = this.layer(e.layer); return l && l.locked; }
  add(el) {
    if (!el.id) el.id = uid(el.type ? el.type[0] : 'e');
    if (el.storey === undefined && !['section'].includes(el.type)) el.storey = this.p.activeStorey;
    if (!el.layer) el.layer = LAYER_FOR[el.type] || 'L_konstr';
    this.p.elements.push(el); return el;
  }
  remove(ids) {
    const set = new Set(Array.isArray(ids) ? ids : [ids]);
    // abhängige Öffnungen mitlöschen
    for (const e of this.p.elements) if (e.type === 'opening' && set.has(e.wall)) set.add(e.id);
    this.p.elements = this.p.elements.filter(e => !set.has(e.id));
    return set;
  }
  addStorey(name, height = 2750) {
    const last = this.p.storeys[this.p.storeys.length - 1];
    const s = { id: uid('g'), name, elevation: last ? last.elevation + last.height : 0, height, slab: 200, roomHeight: height - 250 };
    this.p.storeys.push(s); return s;
  }
  recalcElevations() {
    let z = this.p.storeys[0].elevation;
    for (const s of this.p.storeys) { s.elevation = z; z += s.height; }
  }
}

/* ───────── Speicher (IndexedDB) ───────── */
const DB = 'tw-cad', STORE = 'projekte';
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { r.result.createObjectStore(STORE, { keyPath: 'id' }); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
export async function saveProject(p) {
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put({ id: p.id, name: p.name, changed: Date.now(), data: JSON.stringify(p) });
    tx.oncomplete = () => res(true); tx.onerror = () => rej(tx.error);
  });
}
export async function listProjects() {
  const db = await idb();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).getAll();
    r.onsuccess = () => res(r.result.map(x => ({ id: x.id, name: x.name, changed: x.changed })).sort((a, b) => b.changed - a.changed));
    r.onerror = () => rej(r.error);
  });
}
export async function loadProject(id) {
  const db = await idb();
  return new Promise((res, rej) => {
    const r = db.transaction(STORE).objectStore(STORE).get(id);
    r.onsuccess = () => res(r.result ? migrate(JSON.parse(r.result.data)) : null); r.onerror = () => rej(r.error);
  });
}
export async function deleteProject(id) {
  const db = await idb();
  return new Promise((res) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).delete(id); tx.oncomplete = () => res(true); });
}
export function migrate(p) {
  const d = newProject(p.name);
  for (const k of Object.keys(d)) if (p[k] === undefined) p[k] = d[k];
  p.settings = Object.assign(defaultSettings(), p.settings || {});
  p.site = Object.assign(d.site, p.site || {});
  for (const e of p.elements || []) if (e.type === 'opening') normalisiere(e);
  return p;
}
