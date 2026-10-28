// TW-CAD – Seitenleiste: Eigenschaften, Geschosse, Ebenen, Projekt
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import * as E from './edit.js?v=20261028-0429';
import { SYMBOLE, SYMBOL_KATEGORIEN, symboleIn } from './render2d.js?v=20261028-0429';
import { icon } from './icons.js?v=20261028-0429';
import { MATERIALIEN, matById } from './material-db.js?v=20261028-0429';
import { pickMaterial } from './matpicker.js?v=20261028-0429';
import * as K from './katalog.js?v=20261028-0429';
import * as B from './bauteile.js?v=20261028-0429';
import * as T from './treppe.js?v=20261028-0429';
import { WAND_MATERIAL } from './tools.js?v=20261028-0429';
import * as AB from './aufbau.js?v=20261028-0429';
import { FREI, profi } from './frei.js?v=20261028-0429';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };

function row(label, input) { return h('div', { class: 'row' }, h('label', {}, label), input); }
function num(app, label, get, set, opt = {}) {
  const i = h('input', { type: 'number', step: opt.step || 1, value: Math.round(get() * 10) / 10 });
  i.onchange = () => { const v = parseFloat(i.value); if (!isFinite(v)) return; app.doc.change(label, () => set(v)); app.autoRooms(); };
  return row(label + (opt.unit ? ` (${opt.unit})` : ''), i);
}
/** Zahl mit Vorschlagsliste (DIN-Maße) */
function numList(app, label, get, set, values) {
  const id = 'nl' + Math.random().toString(36).slice(2); const i = h('input', { type: 'number', list: id, value: Math.round(get()) });
  const dl = h('datalist', { id }); for (const [v, l] of values) dl.append(h('option', { value: v }, /^[\d,.]+$/.test(String(l)) ? l + ' cm' : l));
  i.onchange = () => { const v = parseFloat(i.value); if (!isFinite(v)) return; app.doc.change(label, () => set(v)); app.autoRooms(); };
  return row(label + ' (mm)', h('div', { style: 'display:flex;flex:1' }, i, dl));
}
function txt(app, label, get, set) { const i = h('input', { type: 'text', value: get() || '' }); i.onchange = () => app.doc.change(label, () => set(i.value)); return row(label, i); }
function sel(app, label, values, get, set) { const s = h('select', {}); for (const [v, l] of values) s.append(h('option', { value: v, selected: String(get()) === String(v) }, l)); s.onchange = () => app.doc.change(label, () => set(s.value)); return row(label, s); }
function chk(app, label, get, set) { const c = h('input', { type: 'checkbox' }); c.checked = !!get(); c.onchange = () => app.doc.change(label, () => set(c.checked)); return row(label, c); }
function kv(pairs) { const d = h('div', { class: 'kv' }); for (const [k, v] of pairs) d.append(h('span', {}, k), h('b', {}, v)); return d; }
const m2 = (v) => (v / 1e6).toFixed(2).replace('.', ',') + ' m²';
const m = (v) => (v / 1000).toFixed(3).replace('.', ',') + ' m';

function matButton(app, label, id, color, onPick, gruppen) {
  const mat = id ? matById(id) : null;
  const b = h('button', { class: 'btn sm', style: 'width:100%;justify-content:flex-start' },
    h('span', { class: 'sw', style: `background:${color || (mat && mat.farben[0].hex) || '#ccc'}` }), mat ? `${mat.hersteller === 'herstellerneutral' ? '' : mat.hersteller + ' '}${mat.produkt}` : 'Wählen …');
  b.onclick = () => pickMaterial(app, { gruppen, current: id, color, onPick });
  return row(label, b);
}

export function renderProps(app, body) {
  const doc = app.doc; const ids = [...app.selection];
  if (app.mode === 'lageplan') return renderSiteProps(app, body);
  if (!ids.length) return renderOverview(app, body);
  if (ids.length > 1) {
    body.append(h('div', { class: 'sec' }, h('h4', {}, `${ids.length} Elemente gewählt`),
      h('div', { class: 'btns' }, h('button', { class: 'btn red', onclick: () => app.deleteSelection(), html: icon('trash') + 'Löschen' }), h('button', { class: 'btn', onclick: () => app.setTool('move') }, 'Verschieben'), h('button', { class: 'btn', onclick: () => app.setTool('copy') }, 'Kopieren'), h('button', { class: 'btn', onclick: () => app.setTool('rotate') }, 'Drehen'))));
    const walls = ids.map(id => doc.byId(id)).filter(e => e && e.type === 'wall');
    if (walls.length) body.append(h('div', { class: 'sec' }, h('h4', {}, `${walls.length} Wände`), num(app, 'Stärke', () => walls[0].thickness, v => walls.forEach(w => w.thickness = v), { unit: 'mm' }), matButton(app, 'Fassade außen', walls[0].facade, walls[0].facadeColor, (id, col) => doc.change('Fassade', () => walls.forEach(w => { w.facade = id; w.facadeColor = col; })), ['Putz', 'Klinker', 'Holz', 'Metall', 'Faserzement', 'HPL', 'Naturstein', 'Keramik', 'Glas'])));
    return;
  }
  const e = doc.byId(ids[0]); if (!e) return renderOverview(app, body);
  const sec = h('div', { class: 'sec' }); body.append(sec);
  const title = { wall: 'Wand', opening: e.kind === 'window' ? 'Fenster' : e.kind === 'door' ? 'Tür' : 'Öffnung', room: 'Raum', symbol: 'Objekt', text: 'Text', dim: 'Bemaßung', line: 'Linie', poly: 'Polylinie', circle: 'Kreis', column: 'Stütze', stair: 'Treppe', level: 'Höhenkote', section: 'Schnittlinie', tilezone: 'Fliesenfläche', joint: 'Bewegungsfuge', guide: 'Hilfslinie', koerper: 'Körper / Podest', durchbruch: 'Deckendurchbruch', balken: 'Unterzug', dachfenster: 'Dachfenster', gaube: 'Gaube' }[e.type] || e.type;
  sec.append(h('h4', {}, title));
  if (e.type === 'wall') {
    const L = G.dist(e.a, e.b);
    sec.append(num(app, 'Länge (Achse)', () => L, v => E.setWallLength(doc, e, v), { unit: 'mm' }), num(app, 'Stärke', () => e.thickness, v => e.thickness = v, { unit: 'mm' }), num(app, 'Höhe', () => e.height || doc.storeyById(e.storey).height, v => e.height = v, { unit: 'mm' }),
      sel(app, 'Art', [['aussen', 'Außenwand'], ['innen', 'Innenwand']], () => e.art || 'innen', v => e.art = v),
      sel(app, 'Material', WAND_MATERIAL, () => e.material || 'mauerwerk', v => e.material = v),
      num(app, 'Winkel', () => (G.deg(Math.atan2(e.b.y - e.a.y, e.b.x - e.a.x)) + 360) % 360, v => { const L2 = G.dist(e.a, e.b); E.moveWallEnd(doc, e, 'b', G.add(e.a, G.fromAngle(G.rad(v), L2))); }, { unit: '°', step: 0.5 }));
    const geo = W.storeyGeometry(doc, e.storey); const g = geo.wg.get(e.id);
    // Wandaufbau (Schichten)
    {
      const ab = profi(h('div', { class: 'sec', style: 'margin-top:10px' }, h('h4', {}, 'Wandaufbau (Schichten)')));
      const sa = h('select', {}); sa.append(h('option', { value: '' }, 'einschalig (ohne Schichten)')); for (const a of AB.AUFBAUTEN) sa.append(h('option', { value: a.id, selected: e.aufbau === a.id }, `${a.name} (${G.fmtCm(AB.summe(a.schichten))} cm)`)); if (AB.schichten(e) && !AB.aufbauById(e.aufbau)) sa.append(h('option', { value: '__eigen', selected: true }, 'eigener Aufbau'));
      sa.onchange = () => { if (sa.value === '__eigen') return; doc.change('Wandaufbau', () => AB.aufbauSetzen(e, AB.aufbauById(sa.value))); };
      ab.append(row('Aufbau', sa));
      const sch = AB.schichten(e);
      if (sch) {
        const t = h('div', { class: 'schichten' });
        sch.forEach((x, i) => {
          const ms = h('select', {}); for (const [k, l] of AB.SCHICHT_LISTE) ms.append(h('option', { value: k, selected: x[0] === k }, l)); ms.onchange = () => doc.change('Schicht', () => { e.schichten[i][0] = ms.value; e.aufbau = null; e.material = AB.hauptMaterial(e.schichten); });
          const di = h('input', { type: 'number', value: x[1], step: 5, style: 'width:64px' }); di.onchange = () => { const v = parseFloat(di.value); if (v > 0) doc.change('Schichtdicke', () => { e.schichten[i][1] = v; e.aufbau = null; e.thickness = AB.summe(e.schichten); }); };
          t.append(h('div', { class: 'schicht' }, h('span', { class: 'sw', style: `background:${(AB.SCHICHT_MAT[x[0]] || {}).fill}` }), ms, di, h('span', { class: 'muted' }, 'mm'),
            h('button', { class: 'ib', title: 'nach innen', onclick: () => i > 0 && doc.change('Schicht verschieben', () => { const a = e.schichten; [a[i - 1], a[i]] = [a[i], a[i - 1]]; e.aufbau = null; }) }, '↑'),
            h('button', { class: 'ib', title: 'Schicht entfernen', onclick: () => doc.change('Schicht entfernen', () => { e.schichten.splice(i, 1); e.aufbau = null; if (!e.schichten.length) delete e.schichten; else e.thickness = AB.summe(e.schichten); }) }, '✕')));
        });
        t.append(h('button', { class: 'btn sm', onclick: () => doc.change('Schicht hinzufügen', () => { e.schichten.push(['putz', 10]); e.aufbau = null; e.thickness = AB.summe(e.schichten); }) }, '+ Schicht'));
        ab.append(h('div', { class: 'muted', style: 'margin:4px 0' }, 'Reihenfolge: innen → außen (Innenwand: Seite links → rechts).'), t,
          kv([['Gesamtstärke', G.fmtCm(AB.summe(sch)) + ' cm'], ['U-Wert ca.', AB.uWert(sch).toFixed(2).replace('.', ',') + ' W/m²K']]),
          e.art !== 'aussen' ? row('Schichtseite', h('div', { class: 'seg' }, ...[['L', 'links zuerst'], ['R', 'rechts zuerst']].map(([v, l]) => h('button', { class: (e.schichtSeite || 'L') === v ? 'on' : '', onclick: () => doc.change('Schichtseite', () => e.schichtSeite = v) }, l)))) : '');
      } else ab.append(h('button', { class: 'btn sm', onclick: () => doc.change('Schichten', () => { e.schichten = [['putz', 10], [e.material === 'trockenbau' ? 'staender' : (e.material === 'mauerwerk' ? 'ks' : (e.material || 'ks')), Math.max(50, e.thickness - 20)], ['putz', 10]]; }) }, 'Schichten selbst festlegen'));
      body.append(ab);
    }
    if (g) { const os = W.outsideSide(geo, g); sec.append(kv([['Seite außen', os === 'L' ? 'links' : os === 'R' ? 'rechts' : os === 'beide' ? 'freistehend' : 'innen (Innenwand)'], ['Fläche je Seite', m2(L * (e.height || doc.storeyById(e.storey).height))]])); }
    body.append(profi(h('div', { class: 'sec' }, h('h4', {}, 'Fassade & Oberfläche'),
      matButton(app, 'Außen', e.facade, e.facadeColor, (id, col) => doc.change('Fassade', () => { e.facade = id; e.facadeColor = col; }), ['Putz', 'Klinker', 'Holz', 'Metall', 'Faserzement', 'HPL', 'Naturstein', 'Keramik', 'Glas']),
      matButton(app, 'Sockel', e.sockel, e.sockelColor, (id, col) => doc.change('Sockel', () => { e.sockel = id; e.sockelColor = col; }), ['Putz', 'Klinker', 'Naturstein', 'Faserzement', 'Metall']),
      num(app, 'Sockelhöhe', () => e.sockelH || 0, v => e.sockelH = v, { unit: 'mm' }))));
    body.append(h('div', { class: 'sec' }, h('h4', {}, 'Wand versetzen'), h('div', { class: 'btns' },
      h('button', { class: 'btn', onclick: async () => { const r = await app.prompt('Wand versetzen', [{ key: 'd', label: 'Abstand (mm), + = nach links, − = nach rechts', value: '100' }]); if (r) { const d = G.parseLen(r.d, 'mm'); if (isFinite(d)) { doc.change('Wand versetzen', () => E.shiftWall(doc, e, d)); app.autoRooms(); } } } }, 'Um Maß versetzen …'),
      h('button', { class: 'btn', onclick: () => { doc.change('Wand umdrehen', () => { const a = e.a; e.a = e.b; e.b = a; for (const o of doc.all('opening')) if (o.wall === e.id) { o.pos = G.dist(e.a, e.b) - o.pos; o.side = -(o.side || 1); } }); } }, 'Richtung umdrehen'),
      h('button', { class: 'btn red', onclick: () => app.deleteSelection(), html: icon('trash') + 'Löschen' }))));
  } else if (e.type === 'opening') {
    B.normalisiere(e);
    const w = doc.byId(e.wall); const L = w ? G.dist(w.a, w.b) : 0;
    sec.append(sel(app, 'Bauteil', [['door', 'Tür'], ['window', 'Fenster'], ['opening', 'Durchgang']], () => e.kind, v => { e.kind = v; if (v === 'window') { if (!e.sill) e.sill = 875; e.typ = e.typ || 'dk1'; } else e.sill = 0; if (v === 'door') e.art = e.art || 'dreh1'; }));
    if (e.kind === 'door') {
      sec.append(sel(app, 'Türart', K.TUER_ARTEN, () => e.art || 'dreh1', v => e.art = v),
        numList(app, 'Breite (Rohbau)', () => e.width, v => e.width = v, K.tuerBreitenListe(e.art)), numList(app, 'Höhe (Rohbau)', () => e.height, v => e.height = v, K.tuerHoehenListe(e.art)),
        kv(K.tuerInfo(e.width, e.height, e.art)));
      if (!/^schiebe|garagentor|falt/.test(e.art || '')) sec.append(sel(app, 'Anschlag', [['links', 'DIN links'], ['rechts', 'DIN rechts']], () => e.hinge || 'links', v => e.hinge = v));
      sec.append(h('button', { class: 'btn sm', onclick: () => doc.change('Aufschlag', () => e.side = -(e.side || 1)) }, /^schiebe/.test(e.art || '') ? 'Seite wechseln' : 'Aufschlagseite wechseln'));
    } else if (e.kind === 'window') {
      sec.append(sel(app, 'Fenstertyp', K.FENSTER_TYPEN, () => e.typ || 'dk1', v => { e.typ = v; if (K.istBodentief(v)) e.sill = 0; }),
        numList(app, 'Breite (Rohbau)', () => e.width, v => e.width = v, K.FENSTER_BREITEN.map(v => [v, String(v / 10).replace('.', ',')])),
        numList(app, 'Höhe (Rohbau)', () => e.height, v => e.height = v, K.FENSTER_HOEHEN.map(v => [v, String(v / 10).replace('.', ',')])),
        numList(app, 'Brüstungshöhe', () => e.sill, v => e.sill = v, K.BRUESTUNGEN));
    } else {
      sec.append(numList(app, 'Breite', () => e.width, v => e.width = v, [635, 760, 885, 1010, 1135, 1260, 1510, 2010].map(v => [v, String(v / 10).replace('.', ',')])), numList(app, 'Höhe', () => e.height, v => e.height = v, [2005, 2130, 2255, 2380, 2505].map(v => [v, String(v / 10).replace('.', ',')])));
    }
    sec.append(num(app, 'Abstand vom Wandanfang', () => e.pos - e.width / 2, v => e.pos = Math.max(e.width / 2, Math.min(L - e.width / 2, v + e.width / 2)), { unit: 'mm' }),
      kv([['Abstand bis Wandende', G.fmtCm(L - e.pos - e.width / 2) + ' cm'], ['Fläche', m2(e.width * e.height)]]));
    body.append(h('div', { class: 'sec' }, h('h4', {}, e.kind === 'window' ? 'Ausführung Fenster' : e.kind === 'door' ? 'Ausführung Tür' : 'Ausführung'), B.eigenschaften(app, e),
      e.kind !== 'opening' && (e.kind === 'window' || /haustuer|nebeneingang/.test(e.art || '')) ? matButton(app, e.kind === 'window' ? 'Hersteller-Modell' : 'Haustür-Modell', e.stil, e.stilColor, (id, col) => doc.change('Ausführung', () => { e.stil = id; e.stilColor = col; if (e.kind === 'window' && col) e.farbeA = col; }), e.kind === 'window' ? ['Fenster'] : ['Haustür']) : null,
      h('button', { class: 'btn sm', style: 'margin-top:6px', onclick: () => { const keys = (B.FELDER[e.kind] || []).map(f => f.key).concat(e.kind === 'window' ? ['typ', 'stil', 'stilColor'] : e.kind === 'door' ? ['stil', 'stilColor'] : []); doc.change('Auf alle übertragen', () => { for (const o of doc.all('opening').filter(o => o.kind === e.kind && o.id !== e.id)) for (const k of keys) o[k] = e[k]; }); app.toast('Ausführung auf alle ' + (e.kind === 'window' ? 'Fenster' : 'Türen') + ' übertragen'); } }, e.kind === 'window' ? 'Ausführung auf alle Fenster übertragen' : 'Ausführung auf alle Türen übertragen')));
    body.append(h('button', { class: 'btn red', onclick: () => app.deleteSelection(), html: icon('trash') + 'Löschen' }));
  } else if (e.type === 'room') {
    const st = doc.storeyById(e.storey); const height = e.height || st.roomHeight || 2500;
    const geo = W.storeyGeometry(doc, e.storey); const stats = e.poly ? W.roomStats(geo, e.poly, height) : null;
    sec.append(txt(app, 'Raum-Nr.', () => e.nr, v => e.nr = v), txt(app, 'Bezeichnung', () => e.name, v => e.name = v), num(app, 'Lichte Höhe', () => height, v => e.height = v, { unit: 'mm' }), chk(app, 'Raummaße zeigen', () => e.showDims, v => e.showDims = v),
      row('Füllfarbe', (() => { const i = h('input', { type: 'color', value: e.fill || '#ffffff' }); i.onchange = () => doc.change('Farbe', () => e.fill = i.value); return i; })()));
    if (stats) sec.append(kv([['Bodenfläche', m2(stats.area)], ['Umfang', m(stats.perim)], ['Wandfläche brutto', m2(stats.wallGross)], ['Öffnungen (> 0,1 m²)', m2(stats.openArea)], ['Wandfläche netto', m2(stats.wallNet)], ['Türbreiten (Sockel-Abzug)', m(stats.doorWidth)], ['Sockel lfm', m(stats.perim - stats.doorWidth)]]));
    body.append(h('div', { class: 'sec' }, h('h4', {}, 'Fliesen'), h('div', { class: 'btns' }, h('button', { class: 'btn studio-btn', onclick: () => app.openStudio(e.id) }, '🧱 Fliesen-Studio'), h('button', { class: 'btn pri', onclick: () => app.openTiles(e.id), html: icon('tiles') + 'Fliesenplan öffnen' })),
      e.tiles && e.tiles.boden && e.tiles.boden.aktiv ? h('div', { class: 'muted', style: 'margin-top:6px' }, `Boden: ${e.tiles.boden.name || ''} ${G.fmtCm(e.tiles.boden.L)}×${G.fmtCm(e.tiles.boden.B)} · ${e.tiles.boden.verband}`) : h('div', { class: 'muted', style: 'margin-top:6px' }, 'Noch keine Fliesen eingestellt.')));
  } else if (e.type === 'symbol') {
    const sd = SYMBOLE[e.kind] || {};
    sec.append(sel(app, 'Objekt', SYMBOL_KATEGORIEN.flatMap(([kk, kl]) => symboleIn(kk).map(([k, v]) => [k, kl + ': ' + v.name])), () => e.kind, v => { e.kind = v; const x = SYMBOLE[v]; e.w = x.w; e.d = x.d; e.aussparen = !!x.aussparen; }),
      sd.g ? sel(app, 'Größe', [['', '– frei –'], ...sd.g.map(([w, dd, l]) => [w + 'x' + dd, `${l} (${w / 10} × ${dd / 10} cm)`])], () => e.w + 'x' + e.d, v => { if (!v) return; const [w, dd] = v.split('x').map(Number); e.w = w; e.d = dd; }) : '', num(app, 'Breite', () => e.w, v => e.w = v, { unit: 'mm' }), num(app, 'Tiefe', () => e.d, v => e.d = v, { unit: 'mm' }), num(app, 'Drehung', () => e.rot || 0, v => e.rot = v, { unit: '°' }), chk(app, 'Fliesen aussparen', () => e.aussparen, v => e.aussparen = v));
  } else if (e.type === 'text') {
    sec.append(txt(app, 'Text', () => e.text, v => e.text = v), num(app, 'Schrift (mm Papier)', () => e.size || 3.5, v => e.size = v, { step: 0.5 }), num(app, 'Drehung', () => e.rot || 0, v => e.rot = v, { unit: '°' }), chk(app, 'Fett', () => e.bold, v => e.bold = v));
  } else if (e.type === 'dim') {
    sec.append(chk(app, 'Gesamtmaß', () => e.total, v => e.total = v), num(app, 'Abstand Maßlinie', () => e.off || 0, v => e.off = v, { unit: 'mm' }));
  } else if (e.type === 'column') {
    sec.append(num(app, 'Breite', () => e.w, v => e.w = v, { unit: 'mm' }), num(app, 'Tiefe', () => e.d || e.w, v => e.d = v, { unit: 'mm' }), chk(app, 'Rund', () => e.round, v => e.round = v), num(app, 'Drehung', () => e.rot || 0, v => e.rot = v, { unit: '°' }));
  } else if (e.type === 'stair') {
    const f = e.form || 'gerade'; const st = doc.storeyById(e.storey); const hoehe = e.hoehe || (st ? st.height : 2750);
    sec.append(sel(app, 'Form', K.TREPPEN_FORMEN, () => f, v => { e.form = v; if ((v === 'spindel' || v === 'wendel') && !e.durchmesser) e.durchmesser = 2000; if (v === 'wendel' && (!e.auge || e.auge < 300)) e.auge = 600; Object.assign(e, T.autoMasse(e, hoehe)); }));
    if (f !== 'gerade' && f !== 'podest_gerade') sec.append(sel(app, 'Drehrichtung', [['links', 'links herum'], ['rechts', 'rechts herum']], () => e.dreh || 'links', v => e.dreh = v));
    if (f === 'spindel' || f === 'wendel') {
      sec.append(numList(app, 'Durchmesser', () => e.durchmesser || 2000, v => e.durchmesser = v, [1200, 1400, 1600, 1800, 2000, 2200, 2400].map(v => [v, String(v / 10)])), num(app, f === 'spindel' ? 'Spindel Ø' : 'Treppenauge Ø', () => f === 'spindel' ? (e.spindel || 160) : (e.auge || 600), v => { if (f === 'spindel') e.spindel = v; else e.auge = v; }, { unit: 'mm' }), num(app, 'Drehwinkel', () => e.winkel || 360, v => e.winkel = v, { unit: '°' }));
    } else {
      sec.append(numList(app, 'Laufbreite', () => e.w, v => e.w = v, K.LAUFBREITEN), num(app, f.startsWith('viertel_u') ? 'Länge oberer Lauf' : 'Länge Lauf 1', () => e.len, v => e.len = v, { unit: 'mm' }));
      if (f !== 'gerade') sec.append(num(app, f === 'podest_gerade' ? 'Länge Lauf 2' : f.startsWith('viertel') ? 'Länge kurzer Lauf' : 'Länge Lauf 2', () => e.len2 ?? (f.startsWith('viertel') ? 300 : e.len), v => e.len2 = v, { unit: 'mm' }));
      if (['halb', 'podest_u', 'zweiviertel'].includes(f)) sec.append(num(app, 'Treppenauge', () => e.auge ?? 150, v => e.auge = v, { unit: 'mm' }));
      if (f === 'podest_gerade') sec.append(num(app, 'Podestlänge', () => e.podest || e.w, v => e.podest = v, { unit: 'mm' }));
    }
    sec.append(num(app, 'Steigungen', () => e.steps, v => e.steps = Math.max(3, Math.round(v))), num(app, 'Höhe (Geschoss)', () => hoehe, v => e.hoehe = v, { unit: 'mm' }), sel(app, 'Belag', K.TREPPEN_MATERIAL, () => e.material || 'beton', v => e.material = v), num(app, 'Drehung', () => e.rot || 0, v => e.rot = v, { unit: '°' }));
    const k = T.kennwerte(e, hoehe);
    sec.append(kv([['Steigung h', G.fmtCm(k.h) + ' cm (14–20)'], ['Auftritt a (Lauflinie)', G.fmtCm(k.a) + ' cm (23–37)'], ['Schrittmaß 2h + a', G.fmtCm(k.sm) + ' cm (59–65)'], ['Lauflinie', m(k.g.laufLinienLaenge)], ['DIN 18065', k.ok ? '✓ eingehalten' : '⚠ bitte prüfen']]),
      h('button', { class: 'btn sm', onclick: () => doc.change('Treppe nach DIN', () => Object.assign(e, T.autoMasse({ ...e, steps: T.steigungenFuer(hoehe) }, hoehe))) }, 'Maße nach DIN neu berechnen'));
  } else if (e.type === 'section') {
    sec.append(txt(app, 'Bezeichnung', () => e.name, v => e.name = v), chk(app, 'Blickrichtung umkehren', () => e.flip, v => e.flip = v), h('button', { class: 'btn pri', onclick: () => { app.sectionId = e.id; app.setMode('schnitt'); } }, 'Schnitt anzeigen'));
  } else if (e.type === 'koerper') {
    const KA = [['podest', 'Podest / Sockel'], ['sitzbank', 'Sitzbank'], ['stufe', 'Stufe'], ['kamin', 'Kamin'], ['ablage', 'Ablage / Mauerscheibe'], ['brunnen', 'Beckenrand / Brüstung'], ['koerper', 'freier Körper'], ['decke', 'Decke / Platte']];
    sec.append(sel(app, 'Art', KA, () => e.art || 'koerper', v => e.art = v), num(app, 'Unterkante', () => e.z0 || 0, v => e.z0 = v, { unit: 'mm' }), num(app, 'Oberkante', () => e.z1 ?? '', v => e.z1 = v, { unit: 'mm' }),
      kv([['Grundfläche', m2(G.polyArea(e.pts))], ['Umfang', m(G.polyPerimeter(e.pts))], ['Ansichtsflächen (Seiten)', e.z1 != null ? m2(G.polyPerimeter(e.pts) * (e.z1 - (e.z0 || 0))) : '–']]),
      h('div', { class: 'muted' }, 'Ecken mit den Griffen ziehen. Fliesen auf der Oberseite: Werkzeug „Fliesenfläche“ darüber legen.'));
  } else if (e.type === 'durchbruch') {
    sec.append(sel(app, 'Durchbruch in', [['boden', 'Boden (Decke darunter)'], ['decke', 'Decke darüber']], () => e.in || 'boden', v => e.in = v), kv([['Fläche', m2(G.polyArea(e.pts))]]));
  } else if (e.type === 'balken') {
    sec.append(num(app, 'Breite', () => e.breite || 240, v => e.breite = v, { unit: 'mm' }), num(app, 'Höhe unter Decke', () => e.hoehe || 300, v => e.hoehe = v, { unit: 'mm' }), sel(app, 'Material', [['beton', 'Stahlbeton'], ['stahl', 'Stahlträger'], ['holz', 'Holz']], () => e.material || 'beton', v => e.material = v), kv([['Länge', m(G.dist(e.a, e.b))]]));
  } else if (e.type === 'dachfenster') {
    sec.append(num(app, 'Breite', () => e.breite, v => e.breite = v, { unit: 'mm' }), num(app, 'Länge (in Dachneigung)', () => e.laenge, v => e.laenge = v, { unit: 'mm' }), sel(app, 'Ausführung', [['schwing', 'Schwingfenster'], ['klapp', 'Klapp-Schwing'], ['ausstieg', 'Ausstiegsfenster'], ['fest', 'Festverglasung']], () => e.art || 'schwing', v => e.art = v));
  } else if (e.type === 'gaube') {
    sec.append(sel(app, 'Form', [['schlepp', 'Schleppgaube'], ['sattel', 'Satteldachgaube'], ['flach', 'Flachdachgaube'], ['walm', 'Walmgaube']], () => e.typ || 'schlepp', v => e.typ = v), num(app, 'Breite', () => e.breite, v => e.breite = v, { unit: 'mm' }), num(app, 'Wandhöhe vorne', () => e.hoehe, v => e.hoehe = v, { unit: 'mm' }), chk(app, 'mit Fenster', () => e.fenster !== false, v => e.fenster = v));
  } else if (e.type === 'tilezone') {
    sec.append(kv([['Fläche', m2(G.polyArea(e.poly))]]), h('div', { class: 'btns' }, h('button', { class: 'btn studio-btn', onclick: () => app.openStudio(e.id) }, '🧱 Fliesen-Studio'), h('button', { class: 'btn pri', onclick: () => { app.tileZone = e.id; app.setMode('fliesen'); } }, 'Fliesenplan')));
  } else if (e.type === 'line' || e.type === 'poly' || e.type === 'circle' || e.type === 'joint') {
    if (e.type === 'line') sec.append(kv([['Länge', m(G.dist(e.a, e.b))]]));
    if (e.type === 'poly' || e.type === 'joint') { let L = 0; for (let i = 1; i < e.pts.length; i++) L += G.dist(e.pts[i - 1], e.pts[i]); if (e.closed) L += G.dist(e.pts[0], e.pts[e.pts.length - 1]); sec.append(kv([['Länge', m(L)], ...(e.closed ? [['Fläche', m2(G.polyArea(e.pts))]] : [])])); }
    if (e.type === 'circle') sec.append(num(app, 'Radius', () => e.r, v => e.r = v, { unit: 'mm' }));
    sec.append(row('Farbe', (() => { const i = h('input', { type: 'color', value: e.color || '#333333' }); i.onchange = () => doc.change('Farbe', () => e.color = i.value); return i; })()), num(app, 'Strich (mm Papier)', () => e.w || 0.25, v => e.w = v, { step: 0.05 }));
  } else if (e.type === 'level') {
    sec.append(num(app, 'Höhe', () => (e.value || 0), v => e.value = v, { unit: 'mm' }), txt(app, 'Zusatz', () => e.label, v => e.label = v));
  }
  if (e.type !== 'wall' && e.type !== 'opening') body.append(h('button', { class: 'btn red', onclick: () => app.deleteSelection(), html: icon('trash') + 'Löschen' }));
  body.append(profi(h('div', { class: 'sec', style: 'margin-top:14px' }, sel(app, 'Ebene', doc.p.layers.map(l => [l.id, l.name]), () => e.layer, v => e.layer = v))));
}

function renderOverview(app, body) {
  const doc = app.doc; const st = doc.storey; const geo = W.storeyGeometry(doc, st.id);
  const rooms = doc.all('room', st.id);
  body.append(h('div', { class: 'sec' }, h('h4', {}, `Geschoss ${st.name}`), kv([['Wände', String(doc.all('wall', st.id).length)], ['Öffnungen', String(doc.all('opening', st.id).length)], ['Räume', String(rooms.length)], ['Bruttogrundfläche', m2(geo.outers.reduce((s, o) => s + G.polyArea(o), 0))]])));
  if (rooms.length) {
    const l = h('div', { class: 'list' });
    let sum = 0;
    for (const r of rooms) { const A = r.poly ? G.polyArea(r.poly) : 0; sum += A; l.append(h('div', { class: 'li', onclick: () => app.select([r.id]) }, h('span', { class: 'mut' }, r.nr || ''), h('span', { class: 'grow' }, r.name), h('b', {}, m2(A)), h('button', { class: 'ib', title: 'Fliesenplan', html: icon('tiles'), onclick: (ev) => { ev.stopPropagation(); app.openTiles(r.id); } }))); }
    body.append(h('div', { class: 'sec' }, h('h4', {}, `Raumliste · ${m2(sum)}`), l));
  } else body.append(h('div', { class: 'note' }, 'Schnellstart: Werkzeug „Raum aus Wänden“ (Shift+W) wählen, zwei Ecken klicken oder das Innenmaß tippen (z. B. 3510;2800 + Enter). Danach mit „Raum“ hineinklicken.'));
  body.append(h('div', { class: 'sec' }, h('h4', {}, 'Darstellung'), h('div', { class: 'btns' },
    h('button', { class: 'chip' + (app.tileMode === 'aus' ? ' on' : ''), onclick: () => { app.tileMode = 'aus'; app.renderSide(); app.redraw(); } }, 'ohne Fliesen'),
    h('button', { class: 'chip' + (app.tileMode === 'plan' ? ' on' : ''), onclick: () => { app.tileMode = 'plan'; app.renderSide(); app.redraw(); } }, 'Verlegeplan'),
    h('button', { class: 'chip' + (app.tileMode === 'kunde' ? ' on' : ''), onclick: () => { app.tileMode = 'kunde'; app.renderSide(); app.redraw(); } }, 'Kundenansicht'),
    profi(h('button', { class: 'chip' + (app.ghost ? ' on' : ''), onclick: () => { app.ghost = !app.ghost; app.renderSide(); app.redraw(); } }, 'Geschoss darunter')))));
  if (doc.p.underlays.length) {
    const l = h('div', { class: 'list' });
    for (const u of doc.p.underlays) {
      const op = h('input', { type: 'range', min: 0.1, max: 1, step: 0.05, value: u.opacity ?? 0.5, style: 'width:80px' }); op.oninput = () => { u.opacity = +op.value; app.redraw(); };
      const vis = h('input', { type: 'checkbox' }); vis.checked = u.visible; vis.onchange = () => { u.visible = vis.checked; app.redraw(); };
      l.append(h('div', { class: 'li' }, vis, h('span', { class: 'grow' }, u.name || 'Plan'), op, h('button', { class: 'ib', html: icon('trash'), onclick: () => doc.change('Unterlage entfernt', () => { doc.p.underlays = doc.p.underlays.filter(x => x !== u); }) })));
    }
    body.append(h('div', { class: 'sec' }, h('h4', {}, 'Plan-Unterlagen'), l));
  }
}

function renderSiteProps(app, body) {
  const doc = app.doc; const s = doc.p.site;
  const sec = h('div', { class: 'sec' }, h('h4', {}, 'Lageplan & Gelände'));
  const nn = h('input', { type: 'number', step: 0.01, value: s.nnEG || 0 }); nn.onchange = () => doc.change('OKFF EG', () => s.nnEG = parseFloat(nn.value) || 0);
  const nord = h('input', { type: 'number', value: s.nord || 0 }); nord.onchange = () => doc.change('Nordrichtung', () => s.nord = +nord.value || 0);
  const hl = h('input', { type: 'number', step: 0.05, value: s.hlAbstand || 0.25 }); hl.onchange = () => doc.change('Höhenlinien', () => s.hlAbstand = +hl.value || 0.25);
  sec.append(row('OKFF EG (m ü. NN)', nn), row('Nordpfeil (° Drehung)', nord), row('Höhenlinien alle (m)', hl));
  sec.append(kv([['Höhenpunkte', String(s.punkte.length)], ['Nachbargebäude', String(s.nachbarn.length)], ['Grundstück', s.grenze ? m2(G.polyArea(s.grenze)) : '–']]));
  body.append(sec);
  const sp = [...app.selection].map(id => s.punkte.find(p => p.id === id)).filter(Boolean);
  if (sp.length === 1) { const p = sp[0]; const i = h('input', { type: 'number', step: 0.01, value: p.z }); i.onchange = () => doc.change('Höhe', () => p.z = parseFloat(i.value)); body.append(h('div', { class: 'sec' }, h('h4', {}, 'Höhenpunkt'), row('Höhe ü. NN', i), h('button', { class: 'btn red', onclick: () => app.deleteSelection() }, 'Löschen'))); }
  const nb = [...app.selection].map(id => s.nachbarn.find(p => p.id === id)).filter(Boolean);
  if (nb.length === 1) { const n = nb[0]; const i = h('input', { type: 'number', value: n.hoehe }); i.onchange = () => doc.change('Höhe', () => n.hoehe = +i.value); const t = h('input', { type: 'text', value: n.name }); t.onchange = () => doc.change('Name', () => n.name = t.value); body.append(h('div', { class: 'sec' }, h('h4', {}, 'Nachbargebäude'), row('Name', t), row('Höhe (mm)', i), h('button', { class: 'btn red', onclick: () => app.deleteSelection() }, 'Löschen'))); }
  body.append(h('div', { class: 'note' }, 'So geht’s: Lageplan als PDF über „Plan importieren“ hinterlegen (Ziel: Lageplan), maßstäblich einstellen. Dann Grundstücksgrenze, Nachbargebäude und möglichst viele Höhenpunkte aus dem Plan eintragen. Das 3D-Gelände entsteht automatisch – Ansicht „3D & Fassade“.'));
  body.append(h('button', { class: 'btn', style: 'margin-top:8px', onclick: async () => { const r = await app.prompt('Höhenpunkte als Liste einfügen', [{ key: 't', label: 'je Zeile: x;y;z (x,y in m, z in m ü. NN)', type: 'area', value: '' }]); if (!r) return; const pts = []; for (const line of r.t.split(/\n/)) { const p = line.split(/[;\t ]+/).map(v => parseFloat(v.replace(',', '.'))); if (p.length >= 3 && p.every(isFinite)) pts.push({ id: 'h' + Math.random().toString(36).slice(2, 8), x: p[0] * 1000, y: p[1] * 1000, z: p[2] }); } doc.change('Höhenpunkte', () => s.punkte.push(...pts)); app.toast(`${pts.length} Höhenpunkte übernommen`); app.zoomFit(); } }, 'Höhenpunkte aus Liste (Vermesser) …'));
}

export function renderStoreys(app, body) {
  const doc = app.doc; const l = h('div', { class: 'list' });
  for (const s of doc.p.storeys.slice().reverse()) {
    l.append(h('div', { class: 'li' + (s.id === doc.p.activeStorey ? ' on' : ''), onclick: () => { doc.p.activeStorey = s.id; app.selection.clear(); doc.emit('storey'); app.renderSide(); app.zoomFit(); } },
      h('span', { class: 'grow' }, s.name), h('span', { class: 'mut' }, `${(s.elevation / 1000).toFixed(2).replace('.', ',')} m · H ${(s.height / 1000).toFixed(2).replace('.', ',')}`)));
  }
  body.append(h('div', { class: 'sec' }, h('h4', {}, 'Geschosse'), l));
  const s = doc.storey;
  body.append(h('div', { class: 'sec' }, h('h4', {}, `Aktiv: ${s.name}`),
    txt(app, 'Name', () => s.name, v => s.name = v),
    num(app, 'Geschosshöhe', () => s.height, v => { s.height = v; doc.recalcElevations(); }, { unit: 'mm' }),
    num(app, 'Lichte Raumhöhe', () => s.roomHeight || s.height - 250, v => s.roomHeight = v, { unit: 'mm' }),
    num(app, 'Deckenstärke', () => s.slab || 200, v => s.slab = v, { unit: 'mm' }),
    num(app, 'OKFF (relativ)', () => s.elevation, v => { s.elevation = v; }, { unit: 'mm' })));
  body.append(h('div', { class: 'btns' },
    h('button', { class: 'btn pri', onclick: async () => { const r = await app.prompt('Neues Geschoss', [{ key: 'n', label: 'Name', value: ['KG', 'EG', 'OG', 'DG', '2.OG'][doc.p.storeys.length] || 'OG' }, { key: 'h', label: 'Geschosshöhe (mm)', value: '2750' }, { key: 'c', label: 'Außenwände vom aktuellen Geschoss übernehmen', type: 'sel', values: [['ja', 'Ja'], ['nein', 'Nein']], value: 'ja' }]); if (!r) return; doc.change('Geschoss', () => { const ns = doc.addStorey(r.n, +r.h || 2750); if (r.c === 'ja') for (const w of doc.all('wall', s.id).filter(w => w.art === 'aussen')) { const c = JSON.parse(JSON.stringify(w)); c.id = 'w' + Math.random().toString(36).slice(2, 9); c.storey = ns.id; c.height = null; doc.p.elements.push(c); } doc.p.activeStorey = ns.id; }); app.renderSide(); } }, '+ Geschoss darüber'),
    h('button', { class: 'btn', onclick: async () => { const r = await app.prompt('Geschoss darunter (Keller)', [{ key: 'n', label: 'Name', value: 'KG' }, { key: 'h', label: 'Geschosshöhe (mm)', value: '2500' }]); if (!r) return; doc.change('Geschoss', () => { const ns = { id: 'g' + Math.random().toString(36).slice(2, 9), name: r.n, height: +r.h || 2500, slab: 200, roomHeight: (+r.h || 2500) - 250, elevation: doc.p.storeys[0].elevation - (+r.h || 2500) }; doc.p.storeys.unshift(ns); doc.p.activeStorey = ns.id; }); app.renderSide(); } }, '+ darunter'),
    h('button', { class: 'btn red', onclick: () => { if (doc.p.storeys.length < 2) return app.toast('Mindestens ein Geschoss nötig', true); if (!confirm(`Geschoss ${s.name} mit allen Elementen löschen?`)) return; doc.change('Geschoss gelöscht', () => { doc.p.elements = doc.p.elements.filter(e => e.storey !== s.id); doc.p.storeys = doc.p.storeys.filter(x => x !== s); doc.p.activeStorey = doc.p.storeys[0].id; }); app.renderSide(); } }, 'Löschen')));
  // Dach
  const roofs = doc.p.roofs;
  const rs = h('div', { class: 'sec', style: 'margin-top:16px' }, h('h4', {}, 'Dach'));
  if (!roofs.length) rs.append(h('button', { class: 'btn', onclick: () => { doc.change('Dach', () => roofs.push({ id: 'r' + Date.now(), storey: doc.p.storeys[doc.p.storeys.length - 1].id, typ: 'sattel', neigung: 35, ueberstand: 500, traufe: 0, richtung: 'auto', material: 'dach-braas-rubin13v', farbe: null, kniestock: 0 })); app.renderSide(); } }, '+ Dach auf oberstes Geschoss'));
  for (const r of roofs) {
    rs.append(sel(app, 'Dachform', [['sattel', 'Satteldach'], ['walm', 'Walmdach'], ['krueppelwalm', 'Krüppelwalmdach'], ['pult', 'Pultdach'], ['zelt', 'Zeltdach'], ['mansard', 'Mansarddach'], ['flach', 'Flachdach (Attika)']], () => r.typ, v => r.typ = v),
      sel(app, 'Auf Geschoss', doc.p.storeys.map(s => [s.id, s.name]), () => r.storey, v => r.storey = v),
      num(app, 'Neigung', () => r.neigung, v => r.neigung = v, { unit: '°' }), num(app, 'Überstand', () => r.ueberstand, v => r.ueberstand = v, { unit: 'mm' }), num(app, 'Kniestock', () => r.kniestock || 0, v => r.kniestock = v, { unit: 'mm' }),
      sel(app, 'Firstrichtung', [['auto', 'automatisch (lange Seite)'], ['x', 'Ost–West'], ['y', 'Nord–Süd']], () => r.richtung || 'auto', v => r.richtung = v),
      matButton(app, 'Eindeckung', r.material, r.farbe, (id, col) => doc.change('Eindeckung', () => { r.material = id; r.farbe = col; }), ['Dach']),
      h('button', { class: 'btn red sm', onclick: () => { doc.change('Dach entfernt', () => { doc.p.roofs = doc.p.roofs.filter(x => x !== r); }); app.renderSide(); } }, 'Dach entfernen'));
  }
  body.append(rs);
}

export function renderLayers(app, body) {
  const doc = app.doc; const l = h('div', { class: 'list' });
  for (const L of doc.p.layers) {
    const vis = h('input', { type: 'checkbox', title: 'sichtbar' }); vis.checked = L.visible; vis.onchange = () => { L.visible = vis.checked; doc.emit('layer'); };
    const lock = h('button', { class: 'ib', title: 'sperren', style: L.locked ? 'color:#f59e0b' : '', html: icon('lock'), onclick: () => { L.locked = !L.locked; app.renderSide(); } });
    const col = h('input', { type: 'color', value: L.color, style: 'width:26px;height:22px;padding:0;border:0;background:none' }); col.onchange = () => { L.color = col.value; doc.emit('layer'); };
    const n = h('span', { class: 'grow' }, L.name); n.ondblclick = async () => { const r = await app.prompt('Ebene umbenennen', [{ key: 'n', label: 'Name', value: L.name }]); if (r) { L.name = r.n; app.renderSide(); } };
    l.append(h('div', { class: 'li' }, vis, col, n, h('span', { class: 'mut' }, String(doc.p.elements.filter(e => e.layer === L.id).length)), lock));
  }
  body.append(h('div', { class: 'sec' }, h('h4', {}, 'Ebenen (Layer)'), l, h('button', { class: 'btn sm', style: 'margin-top:8px', onclick: async () => { const r = await app.prompt('Neue Ebene', [{ key: 'n', label: 'Name', value: 'Ebene' }]); if (r) { doc.p.layers.push({ id: 'L' + Date.now(), name: r.n, color: '#333333', visible: true, locked: false }); app.renderSide(); } } }, '+ Ebene')));
}

export function renderProject(app, body) {
  const doc = app.doc; const M = doc.p.meta;
  if (!FREI) body.append(h('div', { class: 'sec' }, h('h4', {}, 'Baustelle (Google Drive)'),
    h('div', { class: 'kv' }, h('span', {}, 'Zugeordnet'), h('b', {}, M.baustelle ? M.baustelle.name : '– noch keine –')),
    h('div', { class: 'btns', style: 'margin-top:6px' },
      h('button', { class: 'btn sm', onclick: () => app.importDialog() }, 'Plan aus der Baustelle …'),
      M.baustelle ? h('button', { class: 'btn sm', onclick: () => { doc.change('Baustelle gelöst', () => { delete M.baustelle; }); app.renderSide(); } }, 'Zuordnung lösen') : null)));
  body.append(h('div', { class: 'sec' }, h('h4', {}, 'Plankopf / Projektdaten'),
    txt(app, 'Bauvorhaben', () => M.bauvorhaben, v => M.bauvorhaben = v), txt(app, 'Bauherr', () => M.bauherr, v => M.bauherr = v), txt(app, 'Ort', () => M.ort, v => M.ort = v),
    txt(app, 'Planverfasser', () => M.planer, v => M.planer = v), FREI ? txt(app, 'Anschrift / Kontakt', () => M.planerKontakt, v => M.planerKontakt = v) : null, txt(app, 'Plan-Nr.', () => M.planNr, v => M.planNr = v), txt(app, 'Index', () => M.index, v => M.index = v), txt(app, 'Datum', () => M.datum, v => M.datum = v)));
  body.append(profi(h('div', { class: 'sec' }, h('h4', {}, 'Standard-Ausführung (neue Bauteile)'),
    matButton(app, 'Fassade', doc.p.settings.stdFassade || 'putz-scheibenputz', null, (id) => { doc.p.settings.stdFassade = id; app.renderSide(); }, ['Putz', 'Klinker', 'Holz', 'Metall', 'Faserzement', 'HPL', 'Naturstein', 'Keramik', 'Glas']),
    matButton(app, 'Fenster', doc.p.settings.stdFenster || 'fenster-kst-7016-aussen', null, (id) => { doc.p.settings.stdFenster = id; app.renderSide(); }, ['Fenster']),
    matButton(app, 'Haustür', doc.p.settings.stdHaustuer || 'tuer-hoermann-700b', null, (id) => { doc.p.settings.stdHaustuer = id; app.renderSide(); }, ['Haustür']))));
  body.append(h('div', { class: 'sec' }, h('h4', {}, FREI ? 'Projekt als Datei (Sicherung)' : 'Datei'), h('div', { class: 'btns' }, h('button', { class: 'btn', title: 'ganzes Projekt als .twcad-Datei herunterladen – zum Sichern oder Weitergeben', onclick: () => app.downloadProject() }, 'Als .twcad sichern'), h('button', { class: 'btn', title: '.twcad-Datei öffnen', onclick: () => app.openFile() }, 'Öffnen …'), h('button', { class: 'btn', 'data-stufe': 'profi', onclick: async () => { const M = await import('./dxf.js?v=20261028-0429'); M.exportDXF(app); }, html: icon('dxf') + 'DXF-Export' }))));
}
