// TW-CAD – Bauteil-Einstellungen für Türen, Fenster, Durchgänge (Werkzeugleiste, Dialog, Eigenschaften)
import * as K from './katalog.js?v=20261028-0429';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (k === 'style') e.style.cssText = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };

/* ───────── Felder je Bauteil ───────── */
// key = Feld am Element, skey = Vorgabe in den Einstellungen, def = Standardwert
export const FELDER = {
  door: [
    { key: 'zarge', skey: 'tuerZarge', label: 'Zarge', values: K.ZARGEN, def: 'umfassung' },
    { key: 'blatt', skey: 'tuerBlatt', label: 'Türblatt', values: K.TUER_BLATT, def: 'glatt' },
    { key: 'farbe', skey: 'tuerFarbe', label: 'Oberfläche / Farbe', values: K.TUER_OBERFLAECHE, def: '#f4f3ee', color: true },
    { key: 'schwelle', skey: 'tuerSchwelle', label: 'Schwelle', values: K.SCHWELLEN, def: 'ohne' },
    { key: 'brand', skey: 'tuerBrand', label: 'Brand-/Rauchschutz', values: K.BRANDSCHUTZ, def: '' },
    { key: 'seitenteil', skey: 'tuerSeitenteil', label: 'Seitenteil-Breite', num: true, unit: 'mm', def: 400, nur: (o) => o.art === 'haustuer_st' }
  ],
  window: [
    { key: 'aufteilung', skey: 'fensterAufteilung', label: 'Ober-/Unterlicht', values: K.AUFTEILUNG, def: 'ohne' },
    { key: 'oberlichtH', skey: 'fensterOberlichtH', label: 'Höhe Ober-/Unterlicht', num: true, unit: 'mm', def: 450, nur: (o) => o.aufteilung && o.aufteilung !== 'ohne' },
    { key: 'sprossen', skey: 'fensterSprossen', label: 'Sprossen', values: K.SPROSSEN_ART, def: 'keine' },
    { key: 'sprossenBild', skey: 'fensterSprossenBild', label: 'Sprossenbild', values: K.SPROSSEN_BILD, def: 'kreuz', nur: (o) => o.sprossen && o.sprossen !== 'keine' },
    { key: 'material', skey: 'fensterMaterial', label: 'Material', values: K.FENSTER_MATERIAL, def: 'kunststoff' },
    { key: 'farbeA', skey: 'fensterFarbeA', label: 'Farbe außen (Fassade)', values: K.FENSTER_FARBEN, def: '#383e42', color: true },
    { key: 'farbeI', skey: 'fensterFarbeI', label: 'Farbe innen', values: K.FENSTER_FARBEN, def: '#f6f6f4', color: true },
    { key: 'glas', skey: 'fensterGlas', label: 'Verglasung', values: K.GLAS, def: '3fach' },
    { key: 'sonnenschutz', skey: 'fensterSonnenschutz', label: 'Sonnenschutz', values: K.SONNENSCHUTZ, def: 'ohne' },
    { key: 'fbA', skey: 'fensterFbA', label: 'Fensterbank außen', values: K.FENSTERBANK_AUSSEN, def: 'alu' },
    { key: 'fbI', skey: 'fensterFbI', label: 'Fensterbank innen', values: K.FENSTERBANK_INNEN, def: 'naturstein' }
  ],
  opening: [
    { key: 'form', skey: 'durchgangForm', label: 'Form', values: [['rechteck', 'rechteckig'], ['rundbogen', 'Rundbogen'], ['segmentbogen', 'Segmentbogen'], ['raumhoch', 'raumhoch (bis Decke)']], def: 'rechteck' }
  ]
};

/** Vorgaben aus den Einstellungen für ein neues Bauteil */
export function vorgaben(S, kind) {
  const o = {};
  for (const f of FELDER[kind] || []) o[f.key] = S[f.skey] ?? f.def;
  return o;
}
/** Altdaten (schiebetuer, teilung, rollladen, schwelle=true) auf neue Felder heben */
export function normalisiere(o) {
  if (o.type !== 'opening') return o;
  if (o.kind === 'schiebetuer') { o.kind = 'door'; o.art = o.art || 'schiebe_vor'; }
  if (o.kind === 'door' && !o.art) o.art = o.aussen ? 'haustuer' : 'dreh1';
  if (o.schwelle === true) o.schwelle = 'mit'; else if (o.schwelle === false) o.schwelle = 'ohne';
  if (o.kind === 'window') {
    if (!o.typ) o.typ = o.teilung === '2' ? 'dk2' : o.teilung === '3' ? 'dk3' : o.teilung === 'fest' ? 'fest' : (o.width > 1200 ? 'dk2' : 'dk1');
    if (o.rollladen && !o.sonnenschutz) o.sonnenschutz = 'rl_aufsatz';
    if (!o.farbeA && o.stilColor) o.farbeA = o.stilColor;
  }
  return o;
}

/* ───────── Eingabefelder ───────── */
function feldElement(f, get, set) {
  if (f.num) { const i = h('input', { type: 'number', value: get() ?? f.def, step: 5 }); i.onchange = () => { const v = parseFloat(i.value); if (isFinite(v)) set(v); }; return i; }
  const s = h('select', {});
  for (const [v, l] of f.values) s.append(h('option', { value: v, selected: String(get() ?? f.def) === String(v) }, l));
  // eigene Farbe zulassen
  if (f.color) { s.append(h('option', { value: '__eigen' }, 'eigene Farbe …')); const cur = get(); if (cur && !f.values.some(([v]) => v === cur)) s.insertBefore(h('option', { value: cur, selected: true }, 'eigene: ' + cur), s.lastChild); }
  s.onchange = () => {
    if (s.value === '__eigen') { const c = h('input', { type: 'color', value: get() || '#ffffff' }); c.onchange = () => set(c.value); c.click(); return; }
    set(s.value);
  };
  if (!f.color) return s;
  const sw = h('span', { class: 'sw', style: `background:${get() ?? f.def}` });
  const wrap = h('div', { style: 'display:flex;gap:6px;align-items:center' }, sw, s); return wrap;
}
const zeile = (label, el) => h('div', { class: 'row' }, h('label', {}, label), el);

/** Seitenleiste: alle Ausführungsfelder eines Elements */
export function eigenschaften(app, o) {
  const kind = o.kind === 'schiebetuer' ? 'door' : o.kind;
  const box = h('div', {});
  for (const f of FELDER[kind] || []) {
    if (f.nur && !f.nur(o)) continue;
    box.append(zeile(f.label + (f.unit ? ` (${f.unit})` : ''), feldElement(f, () => o[f.key], (v) => { app.doc.change(f.label, () => { o[f.key] = v; }); })));
  }
  return box;
}

/** Dialog „Weitere Einstellungen“ für neue Bauteile (Vorgaben) */
export function vorgabenDialog(app, kind) {
  const S = app.doc.p.settings; const body = h('div', {});
  const titel = kind === 'window' ? 'Fenster – Ausführung für neue Fenster' : kind === 'door' ? 'Türen – Ausführung für neue Türen' : 'Durchgang';
  const neu = () => {
    body.innerHTML = '';
    body.append(h('div', { class: 'note' }, 'Diese Einstellungen gelten für die nächsten Bauteile, die du setzt. Bereits gesetzte änderst du rechts in den Eigenschaften (anklicken).'));
    const tmp = vorgaben(S, kind);
    for (const f of FELDER[kind] || []) {
      if (f.nur && !f.nur(tmp)) continue;
      body.append(zeile(f.label + (f.unit ? ` (${f.unit})` : ''), feldElement(f, () => S[f.skey] ?? f.def, (v) => { S[f.skey] = v; neu(); })));
    }
  };
  neu();
  app.modal(titel, body, [h('button', { class: 'btn pri', onclick: () => { document.getElementById('modal').classList.add('hidden'); app.refreshOpt(); app.redraw(); } }, 'Fertig')]);
}

export const tuerArtName = (a) => (K.TUER_ARTEN.find(x => x[0] === a) || [0, 'Tür'])[1];
export const fensterTypName = (t) => (K.FENSTER_TYPEN.find(x => x[0] === t) || [0, 'Fenster'])[1];
