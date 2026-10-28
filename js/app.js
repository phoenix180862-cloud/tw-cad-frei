// TW-CAD – Hauptprogramm
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import * as E from './edit.js?v=20261028-0429';
import { Doc, newProject, saveProject, loadProject, listProjects, deleteProject, migrate, uid } from './model.js?v=20261028-0429';
import { View2D } from './view2d.js?v=20261028-0429';
import { snap, SNAP_LABEL } from './snap.js?v=20261028-0429';
import { makeTool } from './tools.js?v=20261028-0429';
import { icon } from './icons.js?v=20261028-0429';
import { symbolFootprint, columnPoly, dimGeometry, drawDim, drawSymbol, floorTiles, SYMBOLE } from './render2d.js?v=20261028-0429';
import { CanvasPainter } from './painter.js?v=20261028-0429';
import { renderProps, renderStoreys, renderLayers, renderProject } from './props.js?v=20261028-0429';
import { demoProject } from './demo.js?v=20261028-0429';
import * as Help from './help.js?v=20261028-0429';
import { makeTool2 } from './tools2.js?v=20261028-0429';
import { hydrateUnderlays } from './pdfimport.js?v=20261028-0429';
import * as AB from './abstand.js?v=20261028-0429';
import { treppe } from './treppe.js?v=20261028-0429';
import * as F from './frei.js?v=20261028-0429';
import * as I18N from './i18n.js?v=20261028-0429';
const { t } = I18N;

// Zwei-Bildschirm-Modus: Bedienelemente können im Werkzeug-Fenster (zweiter Bildschirm) liegen
let uiDoc = null;
const UI_SEL = new Set(['#views', '#topActions', '#toggles', '#toolbox', '#optbar', '#sideTabs', '#sideBody', '#projName']);
const $ = (s) => (uiDoc && UI_SEL.has(s) && uiDoc.querySelector(s)) || document.querySelector(s);
const $$ = (s) => (uiDoc || document).querySelectorAll(s);
const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
export { h };

const TOOLS = [
  { g: 'Bauteile', items: [['select', 'Auswahl', 'select', 'V'], ['wall', 'Wand', 'wall', 'W'], ['wallrect', 'Raum aus Wänden', 'wallrect', 'Shift+W'], ['bogenwand', 'Bogen­wand', 'bogenwand'], ['room', 'Raum', 'room', 'R'], ['door', 'Tür', 'door', 'T'], ['window', 'Fenster', 'window', 'F'], ['opening', 'Durch­gang', 'opening'], ['column', 'Stütze', 'column'], ['stair', 'Treppe', 'stair'], ['symbol', 'Objekte Sanitär', 'symbol', 'O'], ['section', 'Schnitt­linie', 'section']] },
  { g: 'Rohbau & Dach', items: [['koerper', 'Podest / Körper', 'koerper'], ['durchbruch', 'Decken­durchbruch', 'durchbruch'], ['balken', 'Unter­zug', 'balken'], ['dachfenster', 'Dach­fenster', 'dachfenster'], ['gaube', 'Gaube', 'gaube']] },
  { g: 'Bemaßung', items: [['dim', 'Maßkette', 'chain', 'M'], ['autodim', 'Auto-Maß', 'autodim'], ['level', 'Höhen­kote', 'level'], ['measure', 'Messen', 'measure', 'Shift+M']] },
  { g: 'Zeichnen', items: [['line', 'Linie', 'line', 'L'], ['poly', 'Poly­linie', 'poly', 'P'], ['rect', 'Recht­eck', 'rect'], ['circle', 'Kreis', 'circle', 'C'], ['guide', 'Hilfs­linie', 'guide', 'H'], ['text', 'Text', 'text', 'X']] },
  { g: 'Ändern', items: [['move', 'Ver­schieben', 'move', 'Shift+V'], ['copy', 'Kopieren', 'copy', 'Shift+C'], ['rotate', 'Drehen', 'rotate'], ['mirror', 'Spiegeln', 'mirror'], ['offset', 'Versatz / Wand versetzen', 'offset', 'Shift+O'], ['trim', 'Verlängern / Kürzen', 'trim'], ['join', 'Ecke verbinden', 'join'], ['split', 'Teilen', 'split']] },
  { g: 'Fliesen', items: [['studio', 'Fliesen-­Studio', 'tile3'], ['tilestart', 'Start­punkt', 'tilestart'], ['tilezone', 'Fliesen­fläche', 'tilezone'], ['joint', 'Bewe­gungs­fuge', 'joint']] }
];
const KURZ = { offset: 'Versatz', trim: 'Verlän­gern', wallrect: 'Raum aus Wänden', symbol: 'Objekte', join: 'Ecke ver­binden', durchbruch: 'Durch­bruch', koerper: 'Podest / Körper' };
const GRUPPEN_FARBE = { 'Auswahl': '#e5e7eb', 'Bauteile': '#60a5fa', 'Rohbau & Dach': '#fb923c', 'Bemaßung': '#22d3ee', 'Zeichnen': '#c084fc', 'Ändern': '#facc15', 'Fliesen': '#34d399', 'Schnitt': '#f87171', 'Gelände': '#86efac' };
const SITE_TOOLS = [
  { g: 'Auswahl', items: [['select', 'Auswahl', 'select', 'V']] },
  { g: 'Gelände', items: [['heightpt', 'Höhen­punkt', 'heightpt'], ['boundary', 'Grund­stück', 'boundary'], ['neighbor', 'Nachbar­gebäude', 'neighbor'], ['measure', 'Messen', 'measure'], ['line', 'Linie', 'line'], ['text', 'Text', 'text'], ['symbol', 'Objekt (Baum, PKW)', 'symbol']] }
];
const VIEWS = [['grundriss', 'Grundriss', 'plan'], ['lageplan', 'Lageplan & Gelände', 'site'], ['fliesen', 'Fliesenplan', 'tile3'], ['3d', '3D & Fassade', 'cube'], ['schnitt', 'Schnitt & Ansicht', 'section'], ['listen', 'Listen & Prüfung', 'liste'], ['druck', 'Plandruck', 'print']];

class App {
  constructor() {
    this.doc = null; this.mode = 'grundriss'; this.selection = new Set(); this.tileMode = 'plan'; this.ghost = true;
    this.cursor = null; this.ab = { manual: null, lock: null }; this.track = []; this.spaceDown = false; this.sideTabName = 'props';
  }
  async init() {
    window.TWCAD = this;
    await I18N.laden(); I18N.beobachten(document);
    F.stufeLaden(); document.body.classList.toggle('einstieg', F.einstieg()); document.body.classList.toggle('frei', F.FREI);
    if (F.FREI) { const br = document.querySelector('#top .brand'); if (br) { br.title = 'Über TW-CAD – ' + F.WERBUNG; br.style.cursor = 'pointer'; br.onclick = () => this.infoDialog(); } }
    let p = null;
    try { const last = localStorage.getItem('twcad_last'); if (last) p = await loadProject(last); } catch (e) { }
    if (!p) p = demoProject();
    this.setDoc(new Doc(migrate(p)));
    this.view = new View2D(this, $('#cv'));
    this.buildTop(); this.buildToggles(); this.bindKeys(); this.bindCmd();
    this.setMode('grundriss'); this.setTool('select');
    if (!F.FREI) import('./driveprojekt.js?v=20261028-0429').then(DP => DP.autoSichern(this)).catch(() => { });
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); this._installEvt = e; if (F.FREI) this.buildTop(); });
    window.addEventListener('appinstalled', () => { this._installEvt = null; if (F.FREI) { this.buildTop(); this.toast('TW-CAD ist installiert – du findest es jetzt im Startmenü / auf dem Home-Bildschirm.'); } });
    $('#cmd').placeholder = this.cmdPlatzhalter();
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) this.offlineEinrichten();
    setTimeout(() => this.zoomFit(), 30);
    Help.init(this);
    window.addEventListener('beforeunload', () => { if (this.doc.dirty) this.saveNow(); try { this.wz && this.wz.close(); } catch (e) { } });
    const sk = document.getElementById('stageKnoepfe');
    if (sk) sk.append(h('button', { class: 'neu-btn', title: 'Neuer Plan – leeres Blatt', onclick: () => this.neuerPlan(), html: icon('plus') + '<span>Neu</span>' }), h('button', { class: 'del-btn', title: 'Löschen (Entf)', onclick: () => this.loeschen(), html: icon('trash') + '<span>Löschen</span>' }), h('button', { class: 'stage-k', title: 'Rückgängig (Strg+Z)', onclick: () => this.undo(), html: icon('undo') }), h('button', { class: 'stage-k', title: 'Wiederholen (Strg+Y)', onclick: () => this.redo(), html: icon('redo') }));
    const zb = document.getElementById('zweiAus'), vb = document.getElementById('vollbildBtn');
    if (zb) zb.onclick = () => this.toggleZweiBildschirm(); if (vb) vb.onclick = () => this.vollbild();
    if (F.FREI && !F.stufeGewaehlt()) setTimeout(() => this.startDialog(), 300);
  }
  setDoc(doc) {
    this.doc = doc; this.selection.clear();
    doc.on((what) => { this.syncRooms(); hydrateUnderlays(doc, () => this.redraw()); this.redraw(); if (what !== 'live') { this.renderSide(); this.scheduleSave(); this.modeView && this.modeView.refresh && this.modeView.refresh(); } });
    this.syncRooms(); hydrateUnderlays(doc, () => this.redraw());
    if (this.view) { this.renderSide(); this.zoomFit(); this.refreshTitle(); }
  }
  /* ───── Räume mitführen ───── */
  syncRooms() {
    const d = this.doc; let changed = false;
    for (const st of d.p.storeys) {
      const rooms = d.all('room', st.id).filter(r => r.seed); if (!rooms.length) continue;
      const geo = W.storeyGeometry(d, st.id);
      for (const r of rooms) {
        const poly = W.roomAt(geo, r.seed);
        if (poly && JSON.stringify(poly) !== JSON.stringify(r.poly)) { r.poly = poly; changed = true; }
        if (!poly) { // Saatpunkt nachführen: Schwerpunkt alter Fläche probieren
          if (r.poly) { const c = G.polyCentroid(r.poly); const p2 = W.roomAt(geo, c); if (p2) { r.seed = c; r.poly = p2; changed = true; } }
        }
      }
    }
    if (changed) d.cacheVersion++;
  }
  autoRooms() { this.syncRooms(); this.redraw(); }

  /* ───── Kopfzeile ───── */
  buildTop() {
    const nav = $('#views'); nav.innerHTML = '';
    for (const [k, l, ic] of VIEWS) { const vb = h('button', { 'data-v': k, title: l, onclick: () => this.setMode(k), html: icon(ic) + `<span>${l}</span>` }); if (!F.EINSTIEG_VIEWS.has(k)) F.profi(vb); nav.append(vb); }
    const pn = $('#projName'); pn.value = this.doc.p.name; pn.onchange = () => { this.doc.change('Projektname', () => { this.doc.p.name = pn.value || 'Projekt'; }); };
    const acts = $('#topActions'); acts.innerHTML = '';
    const b = (ic, title, fn, cls = '') => h('button', { class: 'ib ' + cls, title, onclick: fn, html: icon(ic) });
    const stufe = h('div', { class: 'stufe-seg', title: 'Bedienstufe – Einstieg: nur das Nötigste (Raum zeichnen, Fliesen planen, fertig) · Profi: das volle CAD. Wird gemerkt, Projekte bleiben in beiden Stufen vollständig.' },
      ...F.STUFEN.map(([k, l]) => h('button', { class: F.getStufe() === k ? 'on' : '', 'data-stufe-wahl': k, onclick: () => this.stufeSetzen(k) }, l)));
    acts.append(stufe, this.sprachKnopf());
    if (F.FREI && this.installStatus() !== 'installiert') acts.append(h('button', { class: 'ib install-btn', title: 'TW-CAD als App auf diesem Gerät installieren (Startmenü/Desktop bzw. Home-Bildschirm, funktioniert dann auch offline)', onclick: () => this.installieren(), html: icon('download') + '<span>App installieren</span>' }));
    acts.append(...[
      h('button', { class: 'neu-btn', title: 'Neuer Plan – leeres Blatt (der jetzige Plan wird vorher gespeichert oder verworfen, du wirst gefragt)', onclick: () => this.neuerPlan(), html: icon('plus') + '<span>Neuer Plan</span>' }),
      h('button', { class: 'del-btn', title: 'Löschen (Entf) – mit Auswahl: Auswahl löschen · ohne Auswahl: Lösch-Modus, dann Elemente anklicken · Strg+Z holt alles zurück', onclick: () => this.loeschen(), html: icon('trash') + '<span>Löschen</span>' }),
      b('undo', 'Rückgängig (Strg+Z)', () => this.undo()), b('redo', 'Wiederholen (Strg+Y)', () => this.redo()),
      b('folder', 'Projekte öffnen / neu', () => this.projectsDialog()), b('save', 'Speichern (Strg+S)', () => this.saveNow(true)),
      F.profi(b('importpdf', 'Plan (PDF/Bild) importieren und Grundriss aus Maßen aufbauen', () => this.importDialog())),
      F.FREI ? null : F.profi(b('ki', 'KI-Assistent', () => this.aiDialog(), 'ki')),
      F.profi(b('gear', 'Einstellungen', () => this.settingsDialog())),
      F.FREI ? h('button', { class: 'ib info-btn', title: 'Über TW-CAD – ' + F.WERBUNG, onclick: () => this.infoDialog() }, 'ⓘ') : null,
      F.profi(h('button', { class: 'ib zwei-btn' + (this.wz ? ' on' : ''), title: this.wz ? 'Werkzeug-Fenster schließen – alles wieder in einem Fenster' : 'Zwei Bildschirme: Werkzeuge in eigenem Fenster (zweiter Bildschirm), Zeichnung groß', onclick: () => this.toggleZweiBildschirm(), html: icon('screens') + `<span>${this.wz ? 'Ein Fenster' : '2 Bildschirme'}</span>` })),
      h('button', { class: 'ib help', title: 'Hilfe-Video zu diesem Arbeitsschritt', onclick: () => Help.open(this.helpContext()), html: icon('help') + '<span>Hilfe</span>' })
    ].filter(Boolean));
  }
  refreshTitle() { $('#projName').value = this.doc.p.name; document.title = this.doc.p.name + ' – TW-CAD'; if (uiDoc) uiDoc.title = 'Werkzeuge – ' + this.doc.p.name; }
  buildToggles() {
    const t = $('#toggles'); t.innerHTML = ''; const S = () => this.doc.p.settings;
    const mk = (key, label, title) => { const btn = h('button', { title, onclick: () => { S()[key] = !S()[key]; btn.classList.toggle('on', !!S()[key]); this.redraw(); } }, label); btn.classList.toggle('on', !!S()[key]); return btn; };
    t.append(mk('rasterAn', 'RASTER', 'Raster/Rasterfang (F7)'), mk('fangAn', 'FANG', 'Objektfang (F3)'), mk('orthoAn', 'ORTHO', 'Nur waagrecht/senkrecht (F8)'), mk('spurAn', 'SPUR', 'Spurlinien (F10)'), mk('abstandAn', 'ABSTAND', 'Abstandsmaße zu den Wänden beim Zeichnen (F9) · Tab wählt das Maß · Zahl + Enter setzt den Punkt exakt'));
    const MS = [1, 5, 10, 20, 25, 50, 75, 100, 200, 250, 500, 1000]; const akt = this.massstab();
    const sel = h('select', { class: 'ms-sel', title: 'Bezugsmaßstab der Zeichnung – bestimmt Schrift-, Maß- und Liniengrößen und den Plandruck (wie in ArchiCAD/Allplan). Gezeichnet wird immer in echten Maßen.', onchange: (e) => this.massstabSetzen(e.target.value) });
    for (const m of MS) sel.append(h('option', { value: m, selected: m === akt }, '1:' + m));
    t.append(h('span', { class: 'ms-zone' }, h('span', { class: 'ms-l' }, 'Maßstab'), sel, h('button', { class: 'ms-papier', title: 'Zoom auf Papiergröße: so groß wie später auf dem Ausdruck', onclick: () => this.papierZoom() }, '1:1 Papier'), h('span', { class: 'ms-ansicht', id: 'msAnsicht', title: 'Bildschirm-Zoom entspricht ungefähr diesem Maßstab' }, '')));
  }
  /* ───── Modus / Ansicht ───── */
  async setMode(m) {
    if (F.einstieg() && !F.EINSTIEG_VIEWS.has(m)) m = 'grundriss';
    this.mode = m; try { const ms = $('#toggles') && $('#toggles').querySelector('.ms-sel'); if (ms) ms.value = String(this.massstab()); } catch (e) { }
    $$('#views button').forEach(b => b.classList.toggle('on', b.dataset.v === m));
    for (const id of ['view3d', 'viewTiles', 'viewSection', 'viewPrint', 'viewListen']) $('#' + id).classList.add('hidden');
    if (this.modeView && this.modeView.hide) this.modeView.hide();
    this.modeView = null;
    const twoD = m === 'grundriss' || m === 'lageplan';
    $('#toolbox').classList.toggle('hidden', !twoD); $('#optbar').classList.toggle('hidden', !twoD);
    $('#app').classList.toggle('no2d', !twoD); if (uiDoc) uiDoc.body.classList.toggle('no2d', !twoD);
    if (twoD) { this.buildToolbox(); this.setTool('select'); if (m === 'lageplan') { this.doc.p.settings.massstab = this.doc.p.settings.massstab; } this.view.resize(); this.zoomFit(); }
    else {
      const map = { fliesen: ['viewTiles', './tileplan.js'], '3d': ['view3d', './view3d.js'], schnitt: ['viewSection', './section.js'], druck: ['viewPrint', './print.js'], listen: ['viewListen', './listen.js'] };
      const [el, mod] = map[m]; $('#' + el).classList.remove('hidden');
      try { const M = await import(mod + new URL(import.meta.url).search); this.modeView = M.mount(this, $('#' + el)); } catch (e) { console.error(e); this.toast('Ansicht konnte nicht geladen werden: ' + e.message, true); }
    }
    this.renderSide(); Help.context(this.helpContext());
  }
  buildToolbox() {
    const tb = $('#toolbox'); tb.innerHTML = '';
    for (const grp of (this.mode === 'lageplan' ? SITE_TOOLS : TOOLS)) {
      const g = h('div', { class: 'tgroup', style: `--gc:${GRUPPEN_FARBE[grp.g] || '#93c5fd'}` }, h('h6', {}, grp.g));
      for (const [k, l, ic, key] of grp.items) { const tbn = h('button', { class: 'tool', 'data-t': k, title: l.replace(/­/g, '') + (key ? ` (${key})` : ''), onclick: () => this.setTool(k), html: icon(ic) + `<span>${KURZ[k] || l}</span>` + (key && key.length <= 7 ? `<kbd>${key.replace('Shift+', '⇧')}</kbd>` : '') }); if (!F.EINSTIEG_TOOLS.has(k)) F.profi(tbn); g.append(tbn); }
      if (!grp.items.some(it => F.EINSTIEG_TOOLS.has(it[0]))) F.profi(g);
      tb.append(g);
    }
  }
  setTool(name, opt) {
    if (name === 'studio') { this.openStudio(); return; }
    this.abPending = null;
    if (this.tool) this.tool.cancel();
    this.toolName = name; this.tool = makeTool2(this, name, opt) || makeTool(this, name, opt); this.ab = { manual: null, lock: null };
    $$('#toolbox .tool').forEach(b => b.classList.toggle('on', b.dataset.t === name));
    this.refreshOpt(); this.refreshHint(); this.redraw(); this.dyn(null);
    Help.context(this.helpContext());
    $('#cv').style.cursor = name === 'select' ? 'default' : name === 'erase' ? 'not-allowed' : 'crosshair'; this.updateDelBtn && this.updateDelBtn();
  }
  toggleAbstand() { const S = this.doc.p.settings; S.abstandAn = !S.abstandAn; this.ab = { manual: null, lock: null }; this.buildToggles(); this.refreshOpt(); this.refreshHint(); this.redraw(); this.toast(S.abstandAn ? 'Abstandsmaße an – Tab wählt das Maß, Zahl + Enter setzt den Punkt' : 'Abstandsmaße aus'); }
  abstandAktiv() { return !!(this.doc.p.settings.abstandAn && this.mode === 'grundriss' && AB.ABSTAND_TOOLS.has(this.toolName)); }
  abstandFrei() { return this.abstandAktiv() && !(this.tool.pts && this.tool.pts.length); }
  /** aktuelle Abstandsmaße am Mauszeiger (bei laufender Wand: lichte Maße ab den neuen Wandflächen) */
  abstandListe() {
    const cur = this.cursor; if (!cur) return [];
    const t = this.tool;
    if (t && t.pts && t.pts.length && this.toolName === 'wall' && t.mode === 'kette') {
      const sh = this.abstandShift(t, cur.p); const a = G.add(t.pts[t.pts.length - 1], sh), b = G.add(cur.p, sh); const L = G.dist(a, b);
      if (L > 50) {
        const dir = G.norm(G.sub(b, a)), n = G.perp(dir); const off = t.refOff(), th = this.doc.p.settings.wandStaerke;
        const pL = G.add(b, G.mul(n, off + th / 2)), pR = G.add(b, G.mul(n, off - th / 2));
        const out = [];
        const r0 = AB.ray(this, b, dir); if (r0) out.push({ ...r0, from: b, dir });
        const r1 = AB.ray(this, pL, n); if (r1) out.push({ ...r1, from: pL, dir: n, licht: true });
        const mn = G.mul(n, -1); const r2 = AB.ray(this, pR, mn); if (r2) out.push({ ...r2, from: pR, dir: mn, licht: true });
        return out;
      }
    }
    return AB.messen(this, cur.p);
  }
  abstandAktivesMass(list) {
    if (!this.abstandFrei()) return null;
    const m = this.ab.manual; if (m != null && list[m]) return list[m];
    let best = null; for (const x of list) if (x && (!best || x.t < best.t)) best = x; return best;
  }
  abstandTab(back) {
    const list = AB.messen(this, this.cursor ? this.cursor.p : { x: 0, y: 0 }); const idx = list.map((x, i) => x ? i : -1).filter(i => i >= 0); if (!idx.length) return;
    const curA = this.abstandAktivesMass(list); let k = curA ? idx.indexOf(curA.i) : -1; k = (k + (back ? -1 : 1) + idx.length) % idx.length; this.ab.manual = idx[k]; this.redraw();
    this.dyn(`Abstand ${list[idx[k]].name} gewählt – Zahl tippen + Enter`);
  }
  /** Eingetippter Abstand (vor dem ersten Punkt) – true, wenn verarbeitet */
  abstandEnter(txt) {
    if (!this.abstandFrei() || !this.cursor) return false;
    const parts = String(txt).split(/[;:]/).map(x => x.trim()).filter(Boolean); if (!parts.length || parts.length > 2) return false;
    const vals = parts.map(AB.parseAbstand); if (!vals.every(v => isFinite(v) && v >= 0)) return false;
    for (const val of vals) { if (!this.abstandSetze(val)) return true; }
    return true;
  }
  abstandSetze(val) {
    const p = this.cursor.p; const list = AB.messen(this, p); const m = this.abstandAktivesMass(list);
    if (!m) { this.toast('Keine Wand in dieser Richtung gefunden – Mauszeiger in den Raum bewegen.', true); return false; }
    const lock = this.ab.lock;
    if (lock && Math.abs(G.cross(lock.d, m.dir)) < 0.5) {
      // zweites Maß entlang der Fanglinie → Punkt setzen
      const np = G.add(p, G.mul(m.dir, m.t - val)); this.ab = { manual: null, lock: null };
      this.placeAt(np, `Punkt gesetzt: ${G.fmtCm(lock.val)} cm ${lock.name} · ${G.fmtCm(val)} cm ${m.name}`);
      this.abstandMerken([{ dir: lock.dir, val: lock.val }, { dir: m.dir, val }]); return true;
    }
    const fd = m.seg ? G.norm(G.sub(m.seg[1], m.seg[0])) : G.perp(m.dir);
    const p0 = G.add(m.q, G.mul(m.dir, -val));
    this.ab.lock = { p0, d: fd, val, name: m.name, dir: m.dir };
    // als Nächstes das kürzere Maß quer dazu wählen
    let next = null; for (const x of list) if (x && Math.abs(G.cross(x.dir, m.dir)) > 0.5 && (!next || x.t < next.t)) next = x;
    this.ab.manual = next ? next.i : null;
    const c = G.closestOnLine(p, p0, G.add(p0, fd)); this.cursor = { ...this.cursor, p: c.p, kind: 'abstand', guides: [] };
    this.toast(`${G.fmtCm(val)} cm ${m.name} fest – jetzt Maß ${next ? next.name : 'quer'} tippen oder entlang der Linie klicken`);
    this.refreshHint(); this.redraw(); return true;
  }
  /** Getippte Abstände für den Wandanfang merken: ist die Richtung der Wand bekannt, wird so verschoben, dass die Wandkante (nicht die Achse) im Abstand liegt */
  abstandMerken(measures) {
    const t = this.tool; this.abPending = null;
    if (this.toolName !== 'wall' || t.mode !== 'kette' || !t.pts || t.pts.length !== 1) return;
    if ((this.doc.p.settings.abstandBezug || 'kante') !== 'kante') return;
    this.abPending = { start: G.clone(t.pts[0]), measures };
  }
  /** Verschiebung des ersten Wandstücks (Wandkante statt Bezugslinie im getippten Abstand) */
  abstandShift(tool, b) {
    const pd = this.abPending; if (!pd || tool !== this.tool || !tool.pts || !tool.pts.length || G.dist(tool.pts[0], pd.start) > 0.01 || (tool.chain && tool.chain.length > 1)) return { x: 0, y: 0 };
    const a = tool.pts[0]; if (G.dist(a, b) < 1) return { x: 0, y: 0 };
    const d = G.norm(G.sub(b, a)), n = G.perp(d); const off = tool.refOff(), th = this.doc.p.settings.wandStaerke;
    let sh = { x: 0, y: 0 };
    for (const m of pd.measures) {
      if (Math.abs(G.cross(d, m.dir)) < 0.5) continue; // Maß in Wandrichtung → keine Kantenkorrektur
      const k = G.dot(n, m.dir); const kmax = Math.max((off - th / 2) * k, (off + th / 2) * k);
      sh = G.add(sh, G.mul(m.dir, -kmax));
    }
    return sh;
  }
  placeAt(p, msg) {
    this.cursor = { p: G.clone(p), raw: G.clone(p), kind: 'abstand', guides: [] };
    const s = this.view.toScreen(p); const ev = { sx: s.x, sy: s.y, world: G.clone(p), button: 0, shift: false, ctrl: false, alt: false, pointerType: 'mouse', detail: 1 };
    this.tool.down(ev); if (this.tool.up) this.tool.up(ev);
    if (msg) this.toast(msg); this.refreshHint(); this.redraw();
  }
  refreshHint() { $('#hint').textContent = this.tool ? (this.tool.hint() || '') + (this.abstandFrei() ? (this.ab.lock ? ' · Abstand fest: entlang der orangen Linie klicken oder 2. Maß tippen' : ' · ABSTAND: Tab wählt Maß, Zahl + Enter (2400 = mm, 240cm, 2,40 = m, oder 240cm;120cm)') : '') : ''; $('#cmdLabel').textContent = this.tool && this.tool.pts && this.tool.pts.length ? 'Länge/Punkt' : (F.einstieg() ? 'Maß' : 'Befehl'); }
  refreshOpt() {
    const bar = $('#optbar'); bar.innerHTML = ''; if (!this.tool) return;
    const all = TOOLS.concat(SITE_TOOLS).flatMap(g => g.items); const def = all.find(x => x[0] === this.toolName);
    bar.append(h('div', { class: 'tname', html: icon(def ? def[2] : 'select') + `<span>${def ? def[1].replace(/­/g, '') : 'Auswahl'}</span>` }));
    if (AB.ABSTAND_TOOLS.has(this.toolName) && this.mode === 'grundriss') {
      const S = this.doc.p.settings; bar.append(h('div', { class: 'sep' }));
      bar.append(h('button', { class: 'abbtn' + (S.abstandAn ? ' on' : ''), title: 'Zeigt beim Zeichnen ständig die Entfernung zu den Wänden (F9). Tab wählt das Maß, Zahl + Enter setzt den Punkt exakt.', onclick: () => this.toggleAbstand(), html: icon('dim') + '<span>Abstände zu Wänden</span>' }));
      bar.append(h('button', { class: 'abhelp', title: 'Hilfe-Video: Innenwand exakt platzieren', onclick: () => Help.open('abstand') }, '?'));
    }
    for (const o of this.tool.options()) {
      bar.append(h('div', { class: 'sep' }));
      const wrap = h('label', { class: 'opt' }, o.label);
      if (o.type === 'seg') { const seg = h('div', { class: 'seg' }); for (const [v, l] of o.values) seg.append(h('button', { class: o.get() === v ? 'on' : '', onclick: (e) => { e.preventDefault(); o.set(v); this.refreshOpt(); this.refreshHint(); } }, l)); wrap.append(seg); }
      else if (o.type === 'sel') { const s = h('select', { onchange: (e) => { o.set(e.target.value); } }); for (const [v, l] of o.values) s.append(h('option', { value: v, selected: String(o.get()) === String(v) }, l)); wrap.append(s); }
      else if (o.type === 'btn') { bar.append(h('button', { class: 'btn sm', title: o.title || '', onclick: o.onclick }, o.label)); continue; }
      else if (o.type === 'info') { bar.append(h('span', { class: 'optinfo' }, typeof o.text === 'function' ? o.text() : o.text)); continue; }
      else if (o.type === 'chk') { const c = h('input', { type: 'checkbox', onchange: (e) => o.set(e.target.checked) }); c.checked = !!o.get(); wrap.append(c); }
      else if (o.type === 'combo') {
        // Schnellwahl (DIN-Maße) + Liste + freies Maß – ohne Pfeil-Klickerei
        const cm = o.anzeige === 'cm'; const zeig = (v) => cm ? String(+v / 10).replace('.', ',') : String(v); const lies = (t) => { const n = parseFloat(String(t).replace(',', '.')); return isFinite(n) ? (cm ? Math.round(n * 10) : n) : null; };
        const cur = +o.get();
        if (o.chips) { const ch = h('div', { class: 'seg chips' }); for (const v of o.chips) ch.append(h('button', { class: +v === cur ? 'on' : '', title: `${zeig(v)} ${cm ? 'cm' : o.unit || ''}`, onclick: (e) => { e.preventDefault(); o.set(v); this.refreshOpt(); } }, zeig(v))); wrap.append(ch); }
        const sel = h('select', { title: 'alle Maße', onchange: (e) => { if (e.target.value === '') return; o.set(+e.target.value); this.refreshOpt(); } }); sel.append(h('option', { value: '' }, o.chips ? 'mehr …' : 'Liste …'));
        for (const [v, l] of o.values) sel.append(h('option', { value: v, selected: +v === cur && !(o.chips || []).includes(+v) }, /^[\d,.]+$/.test(String(l)) ? l + ' cm' : l)); wrap.append(sel);
        const i = h('input', { type: 'text', inputmode: 'decimal', class: 'maszfeld', value: zeig(cur), title: 'eigenes Maß eintippen + Enter', onchange: (e) => { const v = lies(e.target.value); if (v != null && v > 0) { o.set(v); this.refreshOpt(); } } });
        i.onfocus = () => i.select(); wrap.append(i, h('span', { class: 'muted' }, cm ? 'cm' : (o.unit || '')));
      }
      else { const num = o.type !== 'text'; const i = h('input', { type: 'text', inputmode: num ? 'decimal' : 'text', value: o.get(), placeholder: o.placeholder || '', onchange: (e) => { let v = e.target.value; if (num && v !== '') { v = String(v).replace(',', '.'); if (!isFinite(parseFloat(v))) return; } o.set(v); } }); i.onfocus = () => i.select(); wrap.append(i); if (o.unit) wrap.append(h('span', { class: 'muted' }, o.unit)); }
      bar.append(wrap);
    }
    bar.append(h('button', { class: 'helpmini', title: 'Hilfe-Video zu diesem Werkzeug', onclick: () => Help.open(this.helpContext()) }, '▶ Hilfe', h('span', { class: 'hm-lang' }, ' zu diesem Werkzeug')));
  }
  helpContext() {
    if (this.studio) return 'fliesenstudio';
    if (this.mode !== 'grundriss' && this.mode !== 'lageplan') return this.mode;
    if (F.einstieg() && (!this.toolName || this.toolName === 'select')) return 'einstieg';
    return this.toolName && this.toolName !== 'select' ? this.toolName : this.mode;
  }
  /* ───── Seitenleiste ───── */
  sideTab(n) { this.sideTabName = n; this.renderSide(); }
  renderSide() {
    const tabs = $('#sideTabs'), body = $('#sideBody');
    if (this.modeView && this.modeView.renderSide) { tabs.innerHTML = ''; tabs.append(h('button', { class: 'on' }, this.modeView.sideTitle || 'Einstellungen')); body.innerHTML = ''; try { this.modeView.renderSide(body); } catch (e) { console.error(e); body.append(h('div', { class: 'note warn' }, 'Fehler: ' + e.message)); } return; }
    const list = [['props', 'Eigenschaften'], ['storeys', 'Geschosse'], ['layers', 'Ebenen'], ['project', 'Projekt']];
    if (F.einstieg() && (this.sideTabName === 'storeys' || this.sideTabName === 'layers')) this.sideTabName = 'props';
    tabs.innerHTML = ''; for (const [k, l] of list) { const tbt = h('button', { class: this.sideTabName === k ? 'on' : '', onclick: () => this.sideTab(k) }, l); if (k === 'storeys' || k === 'layers') F.profi(tbt); tabs.append(tbt); }
    body.innerHTML = '';
    try {
      if (this.sideTabName === 'props') renderProps(this, body);
      else if (this.sideTabName === 'storeys') renderStoreys(this, body);
      else if (this.sideTabName === 'layers') renderLayers(this, body);
      else renderProject(this, body);
    } catch (e) { console.error(e); body.append(h('div', { class: 'note warn' }, 'Fehler: ' + e.message)); }
  }
  select(ids) { this.selection = new Set(ids); this.selChanged(); }
  selChanged() { if (this.sideTabName !== 'props') this.sideTabName = 'props'; this.renderSide(); this.redraw(); this.updateDelBtn(); }
  deleteSelection() {
    const ids = [...this.selection].filter(id => { const e = this.doc.byId(id); return e && !this.doc.locked(e); });
    if (this.mode === 'lageplan') { const s = this.doc.p.site; this.doc.change('Löschen', () => { s.punkte = s.punkte.filter(p => !this.selection.has(p.id)); s.nachbarn = s.nachbarn.filter(n => !this.selection.has(n.id)); if (this.selection.has('grenze')) s.grenze = null; }); }
    if (ids.length) this.doc.change('Löschen', () => this.doc.remove(ids));
    this.selection.clear(); this.selChanged();
  }
  /* ───── Zeiger ───── */
  snapAt(ev, from, exclude) {
    const S = this.doc.p.settings;
    const r = snap(this, ev.world, { from, ortho: ev.shift ? !S.orthoAn : S.orthoAn, exclude, noSnap: ev.alt });
    if (exclude === undefined && this.abstandAktiv() && !ev.alt) {
      try {
        const hard = ['end', 'ecke', 'schnitt', 'mitte', 'zentrum', 'lot', 'spur'].includes(r.kind);
        const lock = this.abstandFrei() ? this.ab.lock : null;
        if (lock) {
          let q = null;
          if (r.kind === 'naechster' && r.seg) q = G.lineIntersect(lock.p0, lock.d, r.seg.a, G.sub(r.seg.b, r.seg.a));
          if (!q) { q = G.closestOnLine(r.p, lock.p0, G.add(lock.p0, lock.d)).p; if (!hard) q = AB.runden(this, q, lock.d); }
          r.p = q; r.kind = 'abstand'; r.guides = [];
        } else if (!from) {
          if (r.kind === 'naechster' && r.seg) r.p = AB.runden(this, r.p, G.norm(G.sub(r.seg.b, r.seg.a)));
          else if (!hard) { r.p = AB.runden(this, r.p); if (r.kind === 'raster') r.kind = null; }
        }
      } catch (e) { console.error(e); }
    }
    this.cursor = r; return r;
  }
  pointerDown(ev) { this.snapAt(ev, this.tool.from ? this.tool.from() : null); const lock = this.ab.lock; this.tool.down(ev); if (lock && ev.button !== 2) { this.ab = { manual: null, lock: null }; this.abstandMerken([{ dir: lock.dir, val: lock.val }]); } this.refreshHint(); this.redraw(); }
  pointerMove(ev) {
    this.snapAt(ev, this.tool.from ? this.tool.from() : null);
    this.tool.move(ev);
    const p = this.cursor.p; $('#coords').textContent = `x ${G.fmtCm(p.x)} · y ${G.fmtCm(p.y)} cm`;
    if (!this.tool.pts || !this.tool.pts.length) this.dyn(null, true);
    this.redraw();
  }
  pointerUp(ev) { this.tool.up(ev); this.redraw(); }
  dblClick(ev) { this.tool.dbl(ev); }
  cancelPress() { if (this.tool && this.tool.drag) this.tool.drag = null; }
  trackPush(p) { if (this.track.some(q => G.dist(q, p) < 1)) return; this.track.push(G.clone(p)); if (this.track.length > 4) this.track.shift(); }
  dyn(txt, keep) {
    const el = $('#dynIn'); if (!txt) { if (!keep) el.classList.add('hidden'); else el.classList.add('hidden'); return; }
    el.classList.remove('hidden'); el.textContent = txt; el.style.left = this.view.mouse.x + 'px'; el.style.top = this.view.mouse.y + 'px';
  }
  toast(msg, err = false) { const t = $('#toast'); t.textContent = msg; t.classList.toggle('err', !!err); t.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => t.classList.remove('show'), 3200); }
  redraw() { this.view && this.view.redraw(); }
  onViewChange() { }
  /** Bezugsmaßstab der aktuellen Zeichnung (Grundriss/Fliesen 1:50, Lageplan 1:200 …) */
  massstab() { const S = this.doc.p.settings; return this.mode === 'lageplan' ? (S.massstabLage || 200) : (S.massstab || 50); }
  massstabSetzen(m) { const S = this.doc.p.settings; if (this.mode === 'lageplan') S.massstabLage = +m; else S.massstab = +m; this.scheduleSave(); this.buildToggles(); this.redraw(); this.toast(`Maßstab 1:${m} – Texte, Maße, Linienstärken und Plandruck richten sich danach`); }
  /** Zoom auf echte Papiergröße: 1 cm auf dem Bildschirm = 1 cm auf dem Ausdruck */
  papierZoom() { const v = this.view; const px = 96 / 25.4; const c = v.toWorld(v.w / 2, v.h / 2); v.tf.s = px / this.massstab(); v.tf.ox = v.w / 2 - c.x * v.tf.s; v.tf.oy = v.h / 2 + c.y * v.tf.s; v.need = true; }
  zoomFit() {
    if (!this.view) return; let bb = null;
    if (this.mode === 'lageplan') { const s = this.doc.p.site; const pts = [...s.punkte, ...(s.grenze || []), ...s.nachbarn.flatMap(n => n.poly)]; if (pts.length) bb = G.bbox(pts); }
    for (const e of this.doc.all(null, this.doc.p.activeStorey)) { const b = this.elementBBox(e); if (b) bb = G.bboxUnion(bb, b); }
    for (const u of this.doc.p.underlays) if (u.visible && (u.storey === this.doc.p.activeStorey || (this.mode === 'lageplan' && u.storey === 'site'))) bb = G.bboxUnion(bb, { x0: u.x, y0: u.y, x1: u.x + u.w, y1: u.y + u.h, w: u.w, h: u.h });
    this.view.fit(bb);
  }
  /* ───── Overlay: Auswahl, Griffe, Fang ───── */
  drawOverlay(P, c) {
    const sel = this.selection;
    for (const id of sel) { const e = this.doc.byId(id); if (e) this.drawHighlight(P, e); }
    if (this.mode === 'lageplan') for (const id of sel) { const sp = this.doc.p.site.punkte.find(p => p.id === id); if (sp) P.circle(sp, 300, { color: '#2563eb', w: 0.35 }); }
    for (const g of this.grips()) { const s = this.view.toScreen(g.p); c.fillStyle = g.kind === 'origin' ? '#dc2626' : '#fff'; c.strokeStyle = '#2563eb'; c.lineWidth = 1.5; c.beginPath(); if (g.kind === 'rot') c.arc(s.x, s.y, 5, 0, 7); else c.rect(s.x - 4.5, s.y - 4.5, 9, 9); c.fill(); c.stroke(); }
    try { this.tool && this.tool.draw(P); } catch (e) { console.error(e); }
    const cur = this.cursor; if (!cur || !this.view.mouse.inside) return;
    if (this.abstandAktiv()) {
      try {
        const lock = this.abstandFrei() ? this.ab.lock : null;
        if (lock) { const A = this.view.toScreen(G.add(lock.p0, G.mul(lock.d, -1e5))), B = this.view.toScreen(G.add(lock.p0, G.mul(lock.d, 1e5))); c.save(); c.strokeStyle = '#ea580c'; c.lineWidth = 1.2; c.setLineDash([8, 4]); c.beginPath(); c.moveTo(A.x, A.y); c.lineTo(B.x, B.y); c.stroke(); c.restore(); }
        const list = this.abstandListe(); AB.zeichne(this, c, list, { active: this.abstandAktivesMass(list) });
      } catch (e) { console.error(e); }
    }
    for (const [a, b] of cur.guides || []) P.line(a, b, { color: '#16a34a', w: 0.13, dash: [1.5, 1] });
    const s = this.view.toScreen(cur.p);
    if (cur.kind && !['raster', 'polar', 'ortho'].includes(cur.kind)) {
      c.strokeStyle = '#16a34a'; c.lineWidth = 2; c.beginPath();
      if (cur.kind === 'mitte') { c.moveTo(s.x, s.y - 7); c.lineTo(s.x + 7, s.y + 5); c.lineTo(s.x - 7, s.y + 5); c.closePath(); }
      else if (cur.kind === 'schnitt') { c.moveTo(s.x - 6, s.y - 6); c.lineTo(s.x + 6, s.y + 6); c.moveTo(s.x + 6, s.y - 6); c.lineTo(s.x - 6, s.y + 6); }
      else if (cur.kind === 'lot') { c.moveTo(s.x - 6, s.y + 6); c.lineTo(s.x + 6, s.y + 6); c.moveTo(s.x - 6, s.y + 6); c.lineTo(s.x - 6, s.y - 6); }
      else c.rect(s.x - 6, s.y - 6, 12, 12);
      c.stroke(); c.fillStyle = '#16a34a'; c.font = '600 11px Inter, Arial'; c.fillText(SNAP_LABEL[cur.kind] || '', s.x + 10, s.y - 9);
    }
    if (this.toolName !== 'select') { c.strokeStyle = 'rgba(17,24,39,.55)'; c.lineWidth = 1; c.beginPath(); c.moveTo(s.x - 14, s.y); c.lineTo(s.x + 14, s.y); c.moveTo(s.x, s.y - 14); c.lineTo(s.x, s.y + 14); c.stroke(); }
  }
  drawHighlight(P, e) {
    const st = { color: '#2563eb', w: 0.5 };
    if (e.type === 'wall') { const geo = W.storeyGeometry(this.doc, e.storey); const g = geo.wg.get(e.id); if (g) P.fill([g.poly], '#3b82f6', 0.25, st); }
    else if (e.type === 'opening') { const geo = W.storeyGeometry(this.doc, e.storey); const oi = geo.openings.find(o => o.o.id === e.id); if (oi) P.fill([oi.rect], '#3b82f6', 0.3, st); }
    else if (e.type === 'room' && e.poly) P.fill([e.poly], '#3b82f6', 0.08, { color: '#2563eb', w: 0.35, dash: [2, 1] });
    else if (e.type === 'line' || e.type === 'guide') P.line(e.a, e.b, st);
    else if (e.type === 'poly' || e.type === 'joint') P.polyline(e.pts, st, e.closed);
    else if (e.type === 'circle') P.circle(e.c, e.r, st);
    else if (e.type === 'symbol') P.polyline(symbolFootprint(e), st, true);
    else if (e.type === 'column') P.polyline(columnPoly(e), st, true);
    else if (e.type === 'tilezone') P.polyline(e.poly, st, true);
    else if (e.type === 'dim') { const g = dimGeometry(e); if (g) P.polyline(g.proj.map(s => s.q), st); }
    else if (e.type === 'section') P.line(e.a, e.b, st);
    else { const b = this.elementBBox(e); if (b) P.polyline([{ x: b.x0, y: b.y0 }, { x: b.x1, y: b.y0 }, { x: b.x1, y: b.y1 }, { x: b.x0, y: b.y1 }], st, true); }
  }
  drawGhost(P, ids, f) {
    for (const id of ids) {
      const e = this.doc.byId(id); if (!e) continue; const c = JSON.parse(JSON.stringify(e)); E.transformElement(c, f);
      if (c.type === 'wall') P.fill([G.stripPoly(c.a, c.b, c.thickness / 2)], '#93c5fd', 0.5, { color: '#2563eb', w: 0.18 });
      else this.drawHighlight(P, c);
    }
  }
  drawDimPreview(P, d) { drawDim(P, d, '#2563eb', { paperScale: this.massstab() }); }
  drawSymbolPreview(P, s) { drawSymbol(P, s, '#2563eb'); }

  /* ───── Treffer, Rahmen, Griffe ───── */
  selectable() { return this.doc.all(null, this.doc.p.activeStorey).filter(e => this.doc.visible(e)).concat(this.doc.p.elements.filter(e => e.type === 'section')); }
  hitTest(p) {
    const tol = 8 / this.view.tf.s; const doc = this.doc;
    if (this.mode === 'lageplan') {
      const s = doc.p.site; const hp = s.punkte.find(q => G.dist(q, p) < tol * 1.5); if (hp) return { id: hp.id, type: 'heightpt', ref: hp };
      const nb = s.nachbarn.find(n => G.pointInPoly(p, n.poly)); if (nb) return { id: nb.id, type: 'neighbor', ref: nb };
    }
    const geo = W.storeyGeometry(doc, doc.p.activeStorey);
    const els = this.selectable();
    const order = ['opening', 'symbol', 'column', 'text', 'level', 'dim', 'dachfenster', 'gaube', 'durchbruch', 'balken', 'line', 'poly', 'circle', 'joint', 'section', 'guide', 'stair', 'koerper', 'wall', 'tilezone', 'room'];
    for (const type of order) {
      for (const e of els.filter(x => x.type === type).reverse()) {
        if (doc.locked(e)) continue;
        if (type === 'opening') { const oi = geo.openings.find(o => o.o.id === e.id); if (oi && G.pointInPoly(p, G.offsetPolys([oi.rect], tol)[0] || oi.rect)) return e; }
        else if (type === 'symbol') { if (G.pointInPoly(p, symbolFootprint(e))) return e; }
        else if (type === 'column') { if (G.pointInPoly(p, columnPoly(e))) return e; }
        else if (type === 'text') { if (G.dist(p, e.p) < Math.max(tol * 2, (e.size || 3.5) * this.massstab())) return e; }
        else if (type === 'level') { if (G.dist(p, e.p) < tol * 2.5) return e; }
        else if (type === 'dim') { const g = dimGeometry(e); if (g) { const q = g.proj.map(s => s.q).sort((a, b) => G.dot(a, g.dir) - G.dot(b, g.dir)); if (G.closestOnSeg(p, q[0], q[q.length - 1]).d < tol) return e; } }
        else if (type === 'line' || type === 'section') { if (G.closestOnSeg(p, e.a, e.b).d < tol) return e; }
        else if (type === 'guide') { if (G.closestOnLine(p, e.a, e.b).d < tol) return e; }
        else if (type === 'poly' || type === 'joint') { for (let i = 0; i < e.pts.length - (e.closed ? 0 : 1); i++) if (G.closestOnSeg(p, e.pts[i], e.pts[(i + 1) % e.pts.length]).d < tol) return e; }
        else if (type === 'circle') { if (Math.abs(G.dist(p, e.c) - e.r) < tol) return e; }
        else if (type === 'stair') { const g = treppe(e); if (G.pointInPoly(p, g.umriss) || (g.spindel && G.dist(p, g.spindel.c) < g.spindel.r)) return e; }
        else if (type === 'wall') { const g = geo.wg.get(e.id); if (g && G.pointInPoly(p, g.poly)) return e; }
        else if (type === 'tilezone') { if (G.pointInPoly(p, e.poly)) return e; }
        else if (type === 'koerper' || type === 'durchbruch') { if (G.pointInPoly(p, e.pts)) return e; }
        else if (type === 'balken') { if (G.closestOnSeg(p, e.a, e.b).d < (e.breite || 240) / 2 + tol) return e; }
        else if (type === 'dachfenster' || type === 'gaube') { if (G.dist(p, e.p) < Math.max(tol * 3, (e.breite || 800) / 2)) return e; }
        else if (type === 'room') { if (e.poly && G.pointInPoly(p, e.poly)) return e; }
      }
    }
    return null;
  }
  elementBBox(e) {
    switch (e.type) {
      case 'wall': return G.bbox(G.stripPoly(e.a, e.b, e.thickness / 2));
      case 'line': case 'section': return G.bbox([e.a, e.b]);
      case 'poly': case 'joint': return G.bbox(e.pts);
      case 'circle': return { x0: e.c.x - e.r, y0: e.c.y - e.r, x1: e.c.x + e.r, y1: e.c.y + e.r, w: 2 * e.r, h: 2 * e.r };
      case 'symbol': return G.bbox(symbolFootprint(e));
      case 'column': return G.bbox(columnPoly(e));
      case 'room': return e.poly ? G.bbox(e.poly) : null;
      case 'tilezone': return G.bbox(e.poly);
      case 'koerper': case 'durchbruch': return G.bbox(e.pts);
      case 'balken': return G.bbox(G.stripPoly(e.a, e.b, (e.breite || 240) / 2));
      case 'dachfenster': case 'gaube': return { x0: e.p.x - (e.breite || 800) / 2, y0: e.p.y, x1: e.p.x + (e.breite || 800) / 2, y1: e.p.y + 1200, w: e.breite || 800, h: 1200 };
      case 'text': case 'level': return { x0: e.p.x, y0: e.p.y, x1: e.p.x + 500, y1: e.p.y + 200, w: 500, h: 200 };
      case 'dim': return G.bbox(e.pts);
      case 'stair': return G.bbox(treppe(e).umriss);
      case 'opening': return null;
    }
    return null;
  }
  grips() {
    const out = []; if (this.toolName !== 'select') return out;
    for (const id of this.selection) {
      const e = this.doc.byId(id); if (!e) { if (this.mode === 'lageplan') { const n = this.doc.p.site.nachbarn.find(x => x.id === id); if (n) n.poly.forEach((p, i) => out.push({ e: n, kind: 'npt', i, p })); } continue; }
      if (this.doc.locked(e)) continue;
      if (e.type === 'wall') { out.push({ e, kind: 'a', p: e.a }, { e, kind: 'b', p: e.b }, { e, kind: 'mid', p: G.mid(e.a, e.b) }); }
      else if (e.type === 'line' || e.type === 'section' || e.type === 'guide') out.push({ e, kind: 'a', p: e.a }, { e, kind: 'b', p: e.b });
      else if (e.type === 'poly' || e.type === 'joint' || e.type === 'koerper' || e.type === 'durchbruch') e.pts.forEach((p, i) => out.push({ e, kind: 'pt', i, p }));
      else if (e.type === 'balken') out.push({ e, kind: 'a', p: e.a }, { e, kind: 'b', p: e.b });
      else if (e.type === 'dachfenster' || e.type === 'gaube') out.push({ e, kind: 'p', p: e.p });
      else if (e.type === 'tilezone') e.poly.forEach((p, i) => out.push({ e, kind: 'zpt', i, p }));
      else if (e.type === 'circle') out.push({ e, kind: 'c', p: e.c }, { e, kind: 'r', p: { x: e.c.x + e.r, y: e.c.y } });
      else if (e.type === 'symbol') { out.push({ e, kind: 'p', p: e.p }); const r = G.rad(e.rot || 0); out.push({ e, kind: 'rot', p: G.add(e.p, G.rot({ x: 0, y: e.d / 2 + 250 }, r)) }); }
      else if (['text', 'column', 'level', 'stair'].includes(e.type)) out.push({ e, kind: 'p', p: e.p });
      else if (e.type === 'dim') { const g = dimGeometry(e); if (g) { const q = g.proj.map(s => s.q); out.push({ e, kind: 'off', p: G.mid(q[0], q[q.length - 1]) }); e.pts.forEach((p, i) => out.push({ e, kind: 'dpt', i, p })); } }
      else if (e.type === 'opening') { const geo = W.storeyGeometry(this.doc, e.storey); const oi = geo.openings.find(o => o.o.id === e.id); if (oi) out.push({ e, kind: 'opos', p: oi.center }); }
      else if (e.type === 'room') {
        out.push({ e, kind: 'stamp', p: e.stampPos || G.polyCentroid(e.poly) });
        const res = this.tileMode !== 'aus' ? floorTiles(this.doc, W.storeyGeometry(this.doc, e.storey), e) : null; if (res) out.push({ e, kind: 'origin', p: res.origin });
      }
    }
    return out;
  }
  gripAt(sx, sy) { for (const g of this.grips()) { const s = this.view.toScreen(g.p); if (Math.abs(s.x - sx) < 8 && Math.abs(s.y - sy) < 8) return g; } return null; }
  applyGrip(g, ev, drag) {
    const e = g.e; const sp = this.snapAt(ev, g.kind === 'b' ? e.a : g.kind === 'a' ? e.b : null, new Set([e.id])); const p = sp.p;
    switch (g.kind) {
      case 'a': case 'b': if (e.type === 'wall') E.moveWallEnd(this.doc, e, g.kind, p, !ev.ctrl); else e[g.kind] = G.clone(p); this.dyn(e.type === 'wall' || e.type === 'line' ? `${G.fmtCm(G.dist(e.a, e.b))} cm` : null); break;
      case 'mid': { if (!drag.orig) drag.orig = { a: G.clone(e.a), b: G.clone(e.b) }; const n = G.perp(G.norm(G.sub(e.b, e.a))); const d = G.dot(G.sub(p, G.mid(drag.orig.a, drag.orig.b)), n); this.doc.restore(drag.before); const w = this.doc.byId(e.id); g.e = w; E.shiftWall(this.doc, w, d); this.dyn(`versetzt ${G.fmtCm(d)} cm`); break; }
      case 'pt': e.pts[g.i] = G.clone(p); break;
      case 'zpt': e.poly[g.i] = G.clone(p); break;
      case 'npt': e.poly[g.i] = G.clone(p); break;
      case 'c': e.c = G.clone(p); break;
      case 'r': e.r = G.dist(e.c, p); break;
      case 'p': e.p = G.clone(p); break;
      case 'rot': { let a = G.deg(Math.atan2(p.y - e.p.y, p.x - e.p.x)) - 90; if (!ev.shift) a = Math.round(a / 15) * 15; e.rot = (a + 360) % 360; this.dyn(`${Math.round(e.rot)}°`); break; }
      case 'off': { const gg = dimGeometry(e); const n = G.perp(gg.dir); e.off = G.dot(G.sub(p, e.pts[0]), n); break; }
      case 'dpt': e.pts[g.i] = G.clone(p); break;
      case 'opos': { const w = this.doc.byId(e.wall); if (w) { const L = G.dist(w.a, w.b); const t = G.projectT(p, w.a, w.b) * L; e.pos = Math.max(e.width / 2, Math.min(L - e.width / 2, Math.round(t / 5) * 5)); this.dyn(`← ${G.fmtCm(e.pos - e.width / 2)} | ${G.fmtCm(L - e.pos - e.width / 2)} → cm`); } break; }
      case 'stamp': e.stampPos = G.clone(p); break;
      case 'origin': { const cfg = e.tiles.boden; cfg.origin = G.clone(p); cfg.originMode = 'frei'; this.dyn('Startpunkt verschieben'); break; }
    }
  }
  commitLive(before, label) {
    const after = this.doc.snapshot(); if (after === before) return;
    this.doc.undoStack.push({ label, before }); this.doc.redoStack = []; this.doc.dirty = true; this.doc.emit('change');
  }
  /* ───── Tastatur & Befehlszeile ───── */
  bindKeys() {
    window.addEventListener('keydown', (e) => this.handleKey(e, false));
    window.addEventListener('keyup', (e) => { if (e.key === ' ') this.spaceDown = false; });
  }
  /** Tastatur – auch aus dem Werkzeug-Fenster weitergereicht (fremd = true) */
  handleKey(e, fremd) {
    {
      const tag = (e.target.tagName || '').toLowerCase(); const inField = tag === 'input' || tag === 'textarea' || tag === 'select';
      if (fremd && !inField && !e.ctrlKey && !e.metaKey) {
        const c = document.getElementById('cmd');
        if (c.value && e.key === 'Enter') { e.preventDefault(); this.runCmd(); return; }
        if (c.value && e.key === 'Backspace') { e.preventDefault(); c.value = c.value.slice(0, -1); return; }
        if (c.value && e.key === 'Escape') { c.value = ''; return; }
        if (/^[0-9@,.\-;:<]$/.test(e.key) && this.toolName !== 'select') { e.preventDefault(); c.value += e.key; return; }
      }
      if (e.key === ' ' && !inField) this.spaceDown = true;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !inField) { e.preventDefault(); this.undo(); return; }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z')) && !inField) { e.preventDefault(); this.redo(); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !F.FREI) { e.preventDefault(); import('./ki-plus.js?v=20261028-0429').then(K => K.befehlsLeiste(this)); return; }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's' && !F.FREI) { e.preventDefault(); import('./driveprojekt.js?v=20261028-0429').then(DP => DP.speichern(this)); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); this.saveNow(true); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && !inField) { this.clip = [...this.selection]; this.toast(`${this.clip.length} Element(e) kopiert`); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v' && !inField && this.clip) { const n = this.doc.change('Einfügen', () => E.copyElements(this.doc, this.clip, E.moveFn({ x: 500, y: -500 }))); this.select(n.map(x => x.id)); return; }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a' && !inField) { e.preventDefault(); this.select(this.selectable().map(x => x.id)); return; }
      if (inField && e.target.id !== 'cmd') return;
      if (e.key === 'F9') { e.preventDefault(); this.toggleAbstand(); return; }
      if (e.key === 'Tab' && this.abstandFrei() && !(e.target.id === 'cmd' && e.target.value)) { e.preventDefault(); this.abstandTab(e.shiftKey); return; }
      if (e.key === 'F11' && !fremd) return; // F11 = Vollbild des Browsers
      if (['F3', 'F7', 'F8', 'F10'].includes(e.key)) { e.preventDefault(); const k = { F3: 'fangAn', F7: 'rasterAn', F8: 'orthoAn', F10: 'spurAn' }[e.key]; this.doc.p.settings[k] = !this.doc.p.settings[k]; this.buildToggles(); this.redraw(); return; }
      if (this.mode !== 'grundriss' && this.mode !== 'lageplan') return;
      if (e.key === 'Escape' && this.ab.lock) { this.ab = { manual: null, lock: null }; this.refreshHint(); this.redraw(); return; }
      if (e.key === 'Escape') { if (!this.tool.cancel()) { if (this.toolName !== 'select') this.setTool('select'); else { this.selection.clear(); this.selChanged(); } } this.dyn(null); this.refreshHint(); return; }
      if (e.key === 'Enter' && e.target.id !== 'cmd') { if (this.tool.enter('')) { this.refreshHint(); return; } }
      if ((e.key === 'Delete') && this.selection.size && this.toolName !== 'select') { e.preventDefault(); this.loeschen(); return; }
      if (this.tool.key(e)) { e.preventDefault(); this.refreshHint(); return; }
      if (e.target.id === 'cmd') return;
      // Ziffern → Befehlszeile
      if (/^[0-9@,.\-]$/.test(e.key) && this.toolName !== 'select') { const c = $('#cmd'); c.focus(); return; }
      const k = e.key; const map = { v: 'select', w: 'wall', W: 'wallrect', r: 'room', t: 'door', f: 'window', m: 'dim', M: 'measure', l: 'line', p: 'poly', c: 'circle', h: 'guide', x: 'text', o: 'symbol', V: 'move', C: 'copy', O: 'offset' };
      if (!e.ctrlKey && !e.metaKey && !e.altKey && map[k] && this.mode === 'grundriss' && (!F.einstieg() || F.EINSTIEG_TOOLS.has(map[k]))) { this.setTool(map[k]); return; }
      if (k === 'z' && !e.ctrlKey) { this.zoomFit(); }
    }
  }
  bindCmd() {
    const c = $('#cmd');
    c.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.runCmd(); }
      if (e.key === 'Escape') { c.value = ''; c.blur(); }
    });
  }
  runCmd() {
    const c = document.getElementById('cmd'); const v = c.value; c.value = '';
    if (this.abstandEnter(v)) { this.refreshHint(); this.redraw(); c.blur(); return; }
    if (!this.tool.enter(v)) { if (v.trim()) this.command(v.trim()); }
    this.refreshHint(); this.redraw(); c.blur();
  }
  /* ───── Löschen (zentraler Knopf) ───── */
  loeschen() {
    if (this.selection.size) { const n = this.selection.size; this.deleteSelection(); this.toast(`${n === 1 ? '1 Element' : n + ' Elemente'} gelöscht – Strg+Z holt es zurück`); this.updateDelBtn(); return; }
    if (this.mode !== 'grundriss' && this.mode !== 'lageplan') { this.toast('Löschen: im Grundriss oder Lageplan das Element anklicken und dann Löschen drücken.', true); return; }
    if (this.toolName === 'erase') { this.setTool('select'); return; }
    this.setTool('erase'); this.toast('Lösch-Modus: Elemente anklicken – Esc oder nochmal „Löschen“ beendet');
  }
  updateDelBtn() {
    const n = this.selection.size, an = this.toolName === 'erase';
    $$('.del-btn').forEach(b => { b.classList.toggle('on', an); b.classList.toggle('bereit', n > 0); const sp = b.querySelector('span'); if (sp) sp.textContent = n ? `Löschen (${n})` : an ? 'Lösch-Modus an' : 'Löschen'; });
    document.querySelectorAll('#stageKnoepfe .del-btn').forEach(b => { b.classList.toggle('on', an); b.classList.toggle('bereit', n > 0); const sp = b.querySelector('span'); if (sp) sp.textContent = n ? `Löschen (${n})` : an ? 'Lösch-Modus an' : 'Löschen'; });
  }
  /* ───── Zwei-Bildschirm-Modus ───── */
  async toggleZweiBildschirm() {
    if (this.wz && !this.wz.closed) { const w = this.wz; this.werkzeugFensterZu(w); try { w.close(); } catch (e) { } return; }
    let geo = null; try { geo = JSON.parse(localStorage.getItem('twcad_wz_geo') || 'null'); } catch (e) { }
    const sw = window.screen; const w = geo ? geo.w : 640, hh = geo ? geo.h : (sw.availHeight || 900);
    const l = geo ? geo.l : ((sw.availLeft || 0) + (sw.availWidth || 1600) - w), t = geo ? geo.t : (sw.availTop || 0);
    const win = window.open('werkzeuge.html?v=20261027-1', 'twcad_werkzeuge', `popup=yes,width=${w},height=${hh},left=${l},top=${t}`);
    if (!win) { this.toast('Das Werkzeug-Fenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben (Symbol rechts in der Adressleiste) und nochmal klicken.', true); return; }
    this.wzOeffnet = win;
    // beim ersten Mal: auf den anderen Bildschirm schieben (fragt einmal nach „Fenster auf allen Bildschirmen verwalten“)
    if (!geo && window.getScreenDetails) {
      try {
        const sd = await window.getScreenDetails(); const cur = sd.currentScreen;
        const other = sd.screens.find(x => x !== cur && (x.availLeft !== cur.availLeft || x.availTop !== cur.availTop));
        if (other && !win.closed) { const ww = Math.min(760, Math.round(other.availWidth / 2)); win.moveTo(other.availLeft + other.availWidth - ww, other.availTop); win.resizeTo(ww, other.availHeight); }
      } catch (e) { }
    }
  }
  /** vom Werkzeug-Fenster aufgerufen, sobald es geladen ist */
  werkzeugFensterBereit(win) {
    this.wz = win; uiDoc = win.document; $('#app').classList.add('zwei'); I18N.beobachten(win.document);
    clearInterval(this._wzPoll);
    this._wzPoll = setInterval(() => {
      const w = this.wz; if (!w) return;
      if (w.closed) { this.werkzeugFensterZu(w); return; }
      try { localStorage.setItem('twcad_wz_geo', JSON.stringify({ l: w.screenX, t: w.screenY, w: w.outerWidth, h: w.outerHeight })); } catch (e) { }
    }, 1500);
    this.ui_neu(); this.toast('Werkzeuge im eigenen Fenster · F11 = Zeichnung im Vollbild');
  }
  werkzeugFensterZu(win) {
    if (!this.wz || (win && win !== this.wz)) return;
    try { const w = this.wz; if (!w.closed) localStorage.setItem('twcad_wz_geo', JSON.stringify({ l: w.screenX, t: w.screenY, w: w.outerWidth, h: w.outerHeight })); } catch (e) { }
    clearInterval(this._wzPoll); this.wz = null; uiDoc = null; $('#app').classList.remove('zwei');
    this.ui_neu(); this.toast('Alles wieder in einem Fenster');
  }
  /** alle Bedienelemente neu aufbauen (nach Wechsel Ein-/Zwei-Fenster) */
  ui_neu() {
    const twoD = this.mode === 'grundriss' || this.mode === 'lageplan';
    this.buildTop(); this.buildToggles();
    $$('#views button').forEach(b => b.classList.toggle('on', b.dataset.v === this.mode));
    $('#toolbox').classList.toggle('hidden', !twoD); $('#optbar').classList.toggle('hidden', !twoD); if (uiDoc) uiDoc.body.classList.toggle('no2d', !twoD);
    if (twoD) { this.buildToolbox(); $$('#toolbox .tool').forEach(b => b.classList.toggle('on', b.dataset.t === this.toolName)); this.refreshOpt(); }
    this.refreshHint(); this.renderSide(); this.refreshTitle(); this.updateDelBtn();
    requestAnimationFrame(() => { this.view && this.view.resize(); window.dispatchEvent(new Event('resize')); this.redraw(); });
  }
  vollbild() {
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen(); } catch (e) { this.toast('Vollbild nicht möglich – F11 drücken', true); }
  }
  command(v) {
    const map = { wand: 'wall', raum: 'room', tür: 'door', tuer: 'door', fenster: 'window', linie: 'line', maß: 'dim', mass: 'dim', text: 'text', messen: 'measure', kopieren: 'copy', verschieben: 'move', drehen: 'rotate', spiegeln: 'mirror', versatz: 'offset' };
    const t = map[v.toLowerCase()]; if (t) { this.setTool(t); return; }
    this.toast('Unbekannte Eingabe: ' + v, true);
  }
  undo() { const l = this.doc.undo(); if (l) this.toast('Rückgängig: ' + l); }
  redo() { const l = this.doc.redo(); if (l) this.toast('Wiederholt: ' + l); }
  /* ───── Speichern ───── */
  scheduleSave() { clearTimeout(this._st); this._st = setTimeout(() => this.saveNow(), 1500); }
  async saveNow(show) {
    try { this.doc.p.view = this.view ? { ...this.view.tf } : null; await saveProject(this.doc.p); localStorage.setItem('twcad_last', this.doc.p.id); this.doc.dirty = false; if (show) this.toast('Gespeichert ✓'); } catch (e) { if (show) this.toast('Speichern fehlgeschlagen: ' + e.message, true); }
  }
  downloadProject() {
    const blob = new Blob([JSON.stringify(this.doc.p)], { type: 'application/json' });
    this.downloadBlob(blob, (this.doc.p.name || 'Projekt').replace(/[^\wäöüÄÖÜß\- ]/g, '_') + '.twcad');
  }
  downloadBlob(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
  async openFile() {
    const f = await this.pickFile('.twcad,.json'); if (!f) return;
    try { const p = migrate(JSON.parse(await f.text())); this.setDoc(new Doc(p)); this.refreshTitle(); this.setMode('grundriss'); this.toast('Projekt geöffnet'); } catch (e) { this.toast('Datei ungültig: ' + e.message, true); }
  }
  pickFile(accept) { return new Promise(res => { const i = h('input', { type: 'file', accept }); i.onchange = () => res(i.files[0] || null); i.click(); }); }
  /* ───── Dialoge ───── */
  modal(title, body, foot) {
    const m = $('#modal'), box = $('#modalBox'); box.innerHTML = '';
    const close = () => m.classList.add('hidden');
    box.append(h('div', { class: 'modal-head' }, h('h3', {}, title), h('button', { class: 'ib', onclick: close, html: '✕' })), h('div', { class: 'modal-body' }, body));
    if (foot) box.append(h('div', { class: 'modal-foot' }, ...foot));
    m.classList.remove('hidden'); m.onclick = (e) => { if (e.target === m) close(); };
    return close;
  }
  prompt(title, fields) {
    return new Promise((res) => {
      const inputs = {}; const body = h('div', {});
      for (const f of fields) {
        let inp;
        if (f.type === 'sel') { inp = h('select', {}); for (const [v, l] of f.values) inp.append(h('option', { value: v, selected: v === f.value }, l)); }
        else if (f.type === 'area') inp = h('textarea', { class: 'big' }, f.value || '');
        else inp = h('input', { type: f.type || 'text', value: f.value ?? '' });
        inputs[f.key] = inp; body.append(h('div', { class: 'row' }, h('label', {}, f.label), inp));
      }
      let done = false;
      const ok = () => { done = true; const r = {}; for (const k in inputs) r[k] = inputs[k].value; close(); res(r); };
      const close = this.modal(title, body, [h('button', { class: 'btn', onclick: () => { close(); res(null); } }, 'Abbrechen'), h('button', { class: 'btn pri', onclick: ok }, 'OK')]);
      body.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName !== 'TEXTAREA') ok(); });
      setTimeout(() => { const f = Object.values(inputs)[0]; f && f.focus(); f && f.select && f.select(); }, 30);
      $('#modal').addEventListener('click', function once(e) { if (e.target.id === 'modal' && !done) { res(null); } }, { once: true });
    });
  }
  async editText(t) { const r = await this.prompt('Text ändern', [{ key: 't', label: 'Text', value: t.text }, { key: 's', label: 'Schrifthöhe (mm Papier)', value: t.size || 3.5 }]); if (r) this.doc.change('Text', () => { t.text = r.t; t.size = parseFloat(r.s) || 3.5; }); }
  openTiles(roomId) { this.tileRoom = roomId; this.setMode('fliesen'); }
  /** Fliesen-Studio (großes Fliesen-Fenster) – für Raum/Fliesenfläche (sonst ausgewählter oder erster Raum) */
  async openStudio(roomId, ziel) {
    if (!roomId) { const sel = [...this.selection].map(id => this.doc.byId(id)).find(e => e && (e.type === 'room' || e.type === 'tilezone')); roomId = sel ? sel.id : (this.mode === 'fliesen' && this.modeView ? this.modeView.roomId : null); }
    const M = await import('./fliesenstudio.js?v=20261028-0429');
    return M.openStudio(this, { roomId, ziel, onClose: () => { if (this.mode === 'fliesen' && this.modeView && this.modeView.refresh) this.modeView.refresh(); this.redraw(); this.renderSide(); } });
  }
  /** Neuer Plan: leeres Blatt – vorher fragen, ob der jetzige Plan behalten werden soll */
  neuerPlan() {
    const alt = this.doc; const leer = !alt.p.elements.length;
    const starten = async (behalten) => {
      close && close();
      const altJson = JSON.stringify(alt.p); const altId = alt.p.id; const altName = alt.p.name;
      if (behalten) { alt.p.name = name.value.trim() || altName; await this.saveNow(); if (!F.FREI && alt.p.meta && alt.p.meta.drive && alt.p.meta.drive.id) import('./driveprojekt.js?v=20261028-0429').then(DP => DP.speichern(this, { still: true })).catch(() => { }); }
      else { try { await deleteProject(altId); } catch (e) { } }
      const d = new Date(); const p = newProject(t('Plan') + ' ' + d.toLocaleDateString('de-DE') + ' ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
      p.settings = Object.assign(p.settings, JSON.parse(JSON.stringify(alt.p.settings || {}))); p.meta.planer = (alt.p.meta && alt.p.meta.planer) || p.meta.planer;
      this.setDoc(new Doc(p)); this.refreshTitle(); await this.setMode('grundriss'); this.setTool('select'); this.zoomFit(); await this.saveNow();
      if (behalten) this.toast(`„${alt.p.name}“ ist gespeichert (Ordner-Knopf → Projekte). Leeres Blatt – los geht's!`);
      else { this.toast('Leeres Blatt – der alte Plan wurde verworfen.'); this._verworfen = altJson; this.zeigeWiederherstellen(); }
    };
    if (leer) { this.toast('Das Blatt ist schon leer – einfach loslegen.'); return; }
    const name = h('input', { type: 'text', value: alt.p.name || 'Plan', style: 'width:100%' });
    const close = this.modal('Neuer Plan – leeres Blatt', h('div', {},
      h('p', { style: 'margin-top:0;font-size:15px' }, h('b', {}, 'Möchtest du den jetzigen Plan speichern?')),
      h('div', { class: 'row' }, h('label', {}, 'Name'), name),
      h('div', { class: 'muted' }, 'Ja: Der Plan bleibt unter „Projekte“ (Ordner-Knopf oben) erhalten. Nein: Der Plan wird verworfen – kurz danach kannst du ihn noch einmal zurückholen.')),
      [h('button', { class: 'btn', onclick: () => close() }, 'Abbrechen'), h('button', { class: 'btn rot', onclick: () => starten(false) }, 'Nein – verwerfen'), h('button', { class: 'btn pri', onclick: () => starten(true) }, 'Ja – speichern')]);
    setTimeout(() => name.focus(), 50);
  }
  zeigeWiederherstellen() {
    const t = h('div', { class: 'wieder-toast' }, h('span', {}, 'Alten Plan verworfen.'), h('button', { class: 'btn sm', onclick: async () => { if (!this._verworfen) return; if (!this.doc.p.elements.length) { try { await deleteProject(this.doc.p.id); } catch (e) { } } const p = migrate(JSON.parse(this._verworfen)); this._verworfen = null; t.remove(); this.setDoc(new Doc(p)); this.refreshTitle(); await this.setMode('grundriss'); await this.saveNow(); this.toast('Alter Plan ist wieder da.'); } }, '↶ Zurückholen'));
    document.body.append(t); setTimeout(() => { t.remove(); this._verworfen = null; }, 15000);
  }
  async projectsDialog() {
    const list = await listProjects(); const body = h('div', {});
    body.append(h('div', { class: 'btns', style: 'margin-bottom:12px' },
      h('button', { class: 'btn pri', onclick: async () => { const r = await this.prompt('Neues Projekt', [{ key: 'n', label: 'Name', value: t('Neues Projekt') }]); if (!r) return; await this.saveNow(); const p = newProject(r.n); this.setDoc(new Doc(p)); this.refreshTitle(); this.setMode('grundriss'); close(); } }, '+ Neues Projekt'),
      h('button', { class: 'btn', onclick: async () => { await this.saveNow(); this.setDoc(new Doc(demoProject())); this.refreshTitle(); this.setMode('grundriss'); close(); } }, 'Beispielprojekt laden'),
      h('button', { class: 'btn', onclick: () => { close(); this.openFile(); } }, 'Datei öffnen (.twcad)'),
      h('button', { class: 'btn', onclick: () => this.downloadProject() }, 'Aktuelles Projekt als Datei sichern'),
      h('button', { class: 'btn', onclick: async () => { close(); const X = await import('./dxfimport.js?v=20261028-0429'); X.openDxfImport(this); } }, 'DXF-Zeichnung importieren')));
    if (!F.FREI) { const DP = await import('./driveprojekt.js?v=20261028-0429'); body.append(DP.abschnitt(this, () => close())); }
    else body.append(h('div', { class: 'note' }, h('b', {}, 'Wichtig: '), 'Deine Projekte liegen nur in diesem Browser auf diesem Gerät. Sichere sie regelmäßig mit „Aktuelles Projekt als Datei sichern“ (.twcad-Datei, z. B. auf USB-Stick oder in deine Cloud) – mit „Datei öffnen“ holst du sie zurück, auch auf einem anderen Gerät.'));
    if (F.FREI) body.append(h('div', { class: 'sec' }, h('h4', {}, 'TW-CAD als App'), this.installStatus() === 'installiert' ? h('div', { class: 'muted' }, 'Läuft als installierte App – funktioniert auch ohne Internet (nur die Hilfe-Videos brauchen Internet).') : h('button', { class: 'btn', onclick: () => { close(); this.installieren(); } }, '⬇ Als App installieren (Startmenü/Desktop bzw. Home-Bildschirm, offline nutzbar)')));
    else body.append(h('div', { class: 'sec' }, h('h4', {}, 'TW-CAD als App'), matchMedia('(display-mode: standalone)').matches ? h('div', { class: 'muted' }, 'Läuft als installierte App – funktioniert auch ohne Internet (KI, Drive und Hilfe-Videos brauchen Internet).') :
      this._installEvt ? h('button', { class: 'btn', onclick: async () => { this._installEvt.prompt(); await this._installEvt.userChoice; this._installEvt = null; close(); } }, '⬇ Als App installieren (Startmenü/Desktop, offline nutzbar)') :
      h('div', { class: 'muted' }, /iPad|iPhone/.test(navigator.userAgent) ? 'iPad/iPhone: in Safari auf „Teilen“ → „Zum Home-Bildschirm“ tippen.' : 'Installieren: im Chrome/Edge-Menü „App installieren“ wählen. Die Programmdateien werden automatisch für den Offline-Betrieb gespeichert.')));
    const ul = h('div', { class: 'list' });
    for (const p of list) ul.append(h('div', { class: 'li' + (p.id === this.doc.p.id ? ' on' : '') }, h('span', { class: 'grow', onclick: async () => { await this.saveNow(); const pr = await loadProject(p.id); if (pr) { this.setDoc(new Doc(pr)); this.refreshTitle(); this.setMode('grundriss'); close(); } } }, p.name), h('span', { class: 'mut' }, new Date(p.changed).toLocaleString('de-DE')), h('button', { class: 'ib', title: 'Löschen', html: icon('trash'), onclick: async (e) => { e.stopPropagation(); if (confirm(`Projekt „${p.name}“ wirklich löschen?`)) { await deleteProject(p.id); e.target.closest('.li').remove(); } } })));
    body.append(h('div', { class: 'sec' }, h('h4', {}, 'Gespeicherte Projekte (in diesem Browser)'), list.length ? ul : h('div', { class: 'muted' }, 'Noch keine.')));
    body.append(h('div', { class: 'note' }, F.FREI ? 'Projekte werden automatisch in diesem Browser gespeichert. Für eine Sicherung oder zum Weitergeben: „Aktuelles Projekt als Datei sichern“.' : 'Projekte werden automatisch in diesem Browser gespeichert. Mit „Auf Drive speichern“ liegen sie zusätzlich in der Baustelle im Ordner „Zeichnungen“ und sind auf jedem Gerät verfügbar.'));
    if (F.FREI) body.append(h('div', { class: 'muted werbung', style: 'margin-top:8px' }, h('a', { href: F.WERBUNG_URL, target: '_blank', rel: 'noopener' }, F.WERBUNG)));
    const close = this.modal('Projekte', body);
  }
  async importDialog() {
    if (F.FREI) { const f = await this.pickFile('.pdf,.png,.jpg,.jpeg,.dxf'); if (!f) return; if (/\.(dxf|dwg)$/i.test(f.name)) { const X = await import('./dxfimport.js?v=20261028-0429'); X.openDxfImport(this, f); } else { const M = await import('./pdfimport.js?v=20261028-0429'); M.openImport(this, { file: f }); } return; }
    const M = await import('./pdfimport.js?v=20261028-0429'); const P = await import('./planwahl.js?v=20261028-0429');
    P.openPlanwahl(this, { titel: 'Plan aus der Baustelle', onWahl: (f, page, d, b) => { this.linkBaustelle(b); M.openImport(this, { file: f, page }); }, onEigeneDatei: async () => { const f = await this.pickFile('.pdf,.png,.jpg,.jpeg,.dxf,.dwg'); if (!f) return; if (/\.(dxf|dwg)$/i.test(f.name)) { const X = await import('./dxfimport.js?v=20261028-0429'); X.openDxfImport(this, f); } else M.openImport(this, { file: f }); } });
  }
  /** Offline-Fähigkeit: Service Worker registrieren und alle Programmdateien vorab speichern */
  async offlineEinrichten() {
    try {
      const reg = await navigator.serviceWorker.register('sw.js', { scope: './' }); await navigator.serviceWorker.ready;
      const v = new URL(import.meta.url).searchParams.get('v') || '';
      const mods = ['view3d', 'view3d-plus', 'listen', 'auswertung', 'tileplan', 'fliesenstudio', 'section', 'print', 'pdfimport', 'planwahl', 'ai', 'dxfimport', 'driveprojekt', 'ifc', 'ki-plus', 'sonne', 'frei', 'objekte3d', 'tools2', 'aufbau', 'help', 'help-data', 'fliesenkatalog', 'katalog', 'material-db', 'matpicker', 'textures', 'terrain', 'roof', 'treppe', 'site', 'dxf', 'pdfvec', 'demo', 'bauteile', 'abstand', 'tilecalc', 'tiles', 'i18n', ...I18N.SPRACHEN.filter(([c]) => c !== 'de').map(([c]) => 'lang/' + c)].map(m => `js/${m}.js?v=${v}`);
      const urls = [...new Set([...performance.getEntriesByType('resource').map(e => e.name).filter(u => u.startsWith(location.origin) && !u.includes('/hilfe/videos/')), ...mods.map(m => new URL(m, location.href).href), new URL('lib/GLTFExporter.js?v=' + v, location.href).href, new URL('lib/OBJExporter.js?v=' + v, location.href).href, new URL('lib/pdf.worker.min.js', location.href).href, new URL('lib/three.module.min.js', location.href).href, new URL('lib/fonts/DejaVuSansCondensed.ttf', location.href).href, new URL('lib/fonts/DejaVuSansCondensed-Bold.ttf', location.href).href, new URL('lib/OrbitControls.js?v=' + v, location.href).href, location.href.split('#')[0]])];
      (reg.active || navigator.serviceWorker.controller)?.postMessage({ typ: 'vorladen', urls: F.FREI ? urls.filter(u => !/\/js\/(ai|ki-plus|drive|driveprojekt|planwahl)\.js/.test(u)) : urls, v });
      // Updates: regelmäßig nach einer neuen Fassung sehen (Service Worker + Programmstempel in index.html)
      const pruefen = () => { try { reg.update(); } catch (e) { } this.versionPruefen(v); };
      setTimeout(pruefen, 8000); setInterval(pruefen, 30 * 60 * 1000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') pruefen(); });
    } catch (e) { console.warn('Offline-Modus nicht verfügbar:', e.message); }
  }
  /** neue Fassung auf dem Server? → Hinweis „Neue Version – aktualisieren“ */
  async versionPruefen(v) {
    if (!v || this._updateDa) return;
    try {
      const r = await fetch('index.html', { cache: 'no-store' }); if (!r.ok) return; const t = await r.text();
      const m = /js\/app\.js\?v=([^"'&]+)/.exec(t); if (m && m[1] !== v) this.updateHinweis();
    } catch (e) { }
  }
  updateHinweis() {
    if (document.querySelector('.update-banner')) return; this._updateDa = true;
    const b = h('div', { class: 'update-banner', role: 'status' }, h('span', {}, 'Es gibt eine neue Version von TW-CAD.'),
      h('button', { class: 'btn sm pri', onclick: async () => { try { await this.saveNow(); } catch (e) { } location.reload(); } }, 'Neue Version – aktualisieren'),
      h('button', { class: 'ib', title: 'später (beim nächsten Start wird sie automatisch geladen)', onclick: () => b.remove(), html: '✕' }));
    document.body.append(b);
  }
  /* ───── Sprache ───── */
  sprachKnopf() {
    const akt = I18N.sprache();
    const k = h('button', { class: 'ib sprach-btn', title: 'Sprache wählen · Language · Jazyk · Мова · Język', 'aria-haspopup': 'true', onclick: (e) => { e.stopPropagation(); this.sprachMenue(k); }, html: icon('globe') + `<span class="sprach-code">${akt.toUpperCase()}</span>` });
    return k;
  }
  sprachMenue(anker) {
    document.querySelectorAll('.sprach-menue').forEach(x => x.remove());
    const r = anker.getBoundingClientRect(); const akt = I18N.sprache();
    const m = h('div', { class: 'sprach-menue', role: 'menu', 'data-i18n': 'aus' }, ...I18N.SPRACHEN.map(([c, n]) => h('button', { class: c === akt ? 'on' : '', lang: c, role: 'menuitemradio', onclick: () => this.spracheSetzen(c) }, h('span', { class: 'sm-name' }, n), h('span', { class: 'sm-code' }, c.toUpperCase()))));
    const doc = anker.ownerDocument; doc.body.append(m);
    m.style.top = (r.bottom + 4) + 'px'; m.style.left = Math.max(8, Math.min(r.left, doc.documentElement.clientWidth - 200)) + 'px';
    setTimeout(() => doc.addEventListener('click', function zu() { m.remove(); doc.removeEventListener('click', zu); }), 0);
  }
  async spracheSetzen(code) {
    if (code === I18N.sprache()) return; I18N.setSprache(code);
    try { await this.saveNow(); } catch (e) { }
    try { this.wz && this.wz.close(); } catch (e) { }
    location.reload();
  }
  /* ───── Öffentliche Fassung & Bedienstufe ───── */
  cmdPlatzhalter() { return F.einstieg() ? 'Maß in mm tippen + Enter (z. B. 3510 = 3,51 m)' : 'Länge tippen + Enter · @dx;dy · L<Winkel'; }
  stufeSetzen(s) {
    const vorher = F.getStufe(); F.setStufe(s); document.body.classList.toggle('einstieg', F.einstieg());
    if (F.einstieg() && this.wz) { const w = this.wz; this.werkzeugFensterZu(w); try { w.close(); } catch (e) { } }
    $('#cmd').placeholder = this.cmdPlatzhalter();
    this.buildTop(); this.refreshTitle();
    if (F.einstieg() && !F.EINSTIEG_VIEWS.has(this.mode)) this.setMode('grundriss');
    else {
      if (this.mode === 'grundriss' || this.mode === 'lageplan') { this.buildToolbox(); if (F.einstieg() && !F.EINSTIEG_TOOLS.has(this.toolName)) this.setTool('select'); else { $$('#toolbox .tool').forEach(b => b.classList.toggle('on', b.dataset.t === this.toolName)); this.refreshHint(); } }
      $$('#views button').forEach(b => b.classList.toggle('on', b.dataset.v === this.mode));
      this.renderSide(); if (this.modeView && this.modeView.stufeGeaendert) this.modeView.stufeGeaendert();
      requestAnimationFrame(() => { this.view && this.view.resize(); window.dispatchEvent(new Event('resize')); this.redraw(); });
    }
    Help.context(this.helpContext());
    if (vorher !== F.getStufe()) this.toast(F.einstieg() ? 'Einstieg: nur das Nötigste – Raum zeichnen, Fliesen planen, fertig. Oben jederzeit auf „Profi“ umschaltbar.' : 'Profi: alle Werkzeuge und Ansichten von TW-CAD.');
  }
  /** Startdialog der öffentlichen Fassung (nur beim allerersten Start) */
  startDialog() {
    F.setStufe(F.getStufe()); // als gewählt merken – der Dialog kommt nur einmal
    const wahl = (s) => { close(); this.stufeSetzen(s); };
    const body = h('div', { class: 'start-wahl' },
      h('div', { class: 'start-sprache', 'data-i18n': 'aus' }, ...I18N.SPRACHEN.map(([c, n]) => h('button', { class: 'chip' + (c === I18N.sprache() ? ' on' : ''), lang: c, onclick: () => { if (c !== I18N.sprache()) { I18N.setSprache(c); location.reload(); } } }, n))),
      h('p', { class: 'start-intro' }, 'Willkommen! Wie möchtest du arbeiten? Du kannst jederzeit oben zwischen „Einstieg“ und „Profi“ umschalten – deine Zeichnung bleibt dabei vollständig erhalten.'),
      h('div', { class: 'start-karten' },
        h('button', { class: 'start-karte', 'data-wahl': 'einstieg', onclick: () => wahl('einstieg') }, h('b', {}, 'Einstieg'), h('span', {}, 'Raum zeichnen, Fliesen planen, fertig'), h('small', {}, 'Wände, Türen, Fenster, Bad- und Küchenobjekte, Fliesen-Studio mit Verlegeplan und Mengen, 3D-Ansicht und Ausdruck – nur das Nötigste.')),
        h('button', { class: 'start-karte', 'data-wahl': 'profi', onclick: () => wahl('profi') }, h('b', {}, 'Profi'), h('span', {}, 'Das volle CAD'), h('small', {}, 'Zusätzlich Geschosse, Ebenen, Lageplan & Gelände, Dächer und Gauben, Schnitte und Ansichten, Listen, Plan-Prüfung, DXF/IFC/OBJ/glTF.'))),
      h('div', { class: 'start-fuss' }, 'Kein Konto, keine Anmeldung: Alles bleibt in deinem Browser gespeichert. Sichere wichtige Projekte als Datei (Ordner-Knopf oben).', h('br'), h('a', { href: F.WERBUNG_URL, target: '_blank', rel: 'noopener' }, F.WERBUNG)));
    const close = this.modal('Willkommen bei TW-CAD', body);
  }
  infoDialog() {
    const v = new URL(import.meta.url).searchParams.get('v') || '–';
    const body = h('div', { class: 'info-tw' },
      h('div', { class: 'info-kopf' }, h('span', { class: 'logo' }, 'TW'), h('b', {}, 'TW-CAD'), h('span', { class: 'muted' }, ' – Grundriss, Fliesenplanung, 3D und Plandruck')),
      h('p', {}, h('a', { href: F.WERBUNG_URL, target: '_blank', rel: 'noopener' }, F.WERBUNG)),
      h('ul', {}, h('li', {}, 'Kostenlos, ohne Anmeldung und ohne Werbe-Tracking. Deine Projekte bleiben in diesem Browser auf deinem Gerät – es wird nichts hochgeladen.'), h('li', {}, 'Sichern und Weitergeben: Ordner-Knopf → „Aktuelles Projekt als Datei sichern“ / „Datei öffnen“.'), h('li', {}, 'Alle Maße ohne Gewähr – vor der Ausführung am Bau prüfen.')),
      h('div', { class: 'muted' }, `Programmstand ${v} · `, h('a', { href: 'LIZENZEN.txt', target: '_blank' }, 'Lizenzen der verwendeten Bibliotheken')));
    this.modal('Über TW-CAD', body, [h('button', { class: 'btn', onclick: () => Help.open('modus') }, 'Hilfe'), h('button', { class: 'btn pri', onclick: () => $('#modal').classList.add('hidden') }, 'Schließen')]);
  }
  installStatus() {
    if (matchMedia('(display-mode: standalone)').matches || navigator.standalone) return 'installiert';
    if (this._installEvt) return 'bereit';
    if (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
    return 'manuell';
  }
  async installieren() {
    const s = this.installStatus();
    if (s === 'installiert') { this.toast('TW-CAD läuft bereits als installierte App.'); return; }
    if (s === 'bereit') { const ev = this._installEvt; ev.prompt(); let r = null; try { r = await ev.userChoice; } catch (e) { } this._installEvt = null; if (r && r.outcome === 'accepted') this.toast('TW-CAD wird installiert …'); this.buildTop(); return; }
    const schritte = s === 'ios' ? ['In Safari unten (iPhone) bzw. oben (iPad) auf „Teilen“ (Quadrat mit Pfeil) tippen.', '„Zum Home-Bildschirm“ wählen und „Hinzufügen“ tippen.', 'TW-CAD startet dann vom Home-Bildschirm wie eine App – auch ohne Internet.']
      : ['Chrome / Edge: rechts in der Adressleiste auf das Symbol „App installieren“ (Bildschirm mit Pfeil) klicken – oder im Menü ⋮ „App installieren“ / „TW-CAD installieren“ wählen.', 'Android: im Chrome-Menü ⋮ „App installieren“ bzw. „Zum Startbildschirm hinzufügen“.', 'Firefox und manche andere Browser können Web-Apps nicht installieren – dann TW-CAD einfach als Lesezeichen speichern; es funktioniert genauso.'];
    this.modal('TW-CAD als App installieren', h('div', {}, h('ol', {}, ...schritte.map(t => h('li', { style: 'margin-bottom:6px' }, t))), h('div', { class: 'muted' }, 'Updates kommen automatisch: Gibt es eine neue Version, erscheint unten der Hinweis „Neue Version – aktualisieren“.')), [h('button', { class: 'btn pri', onclick: () => $('#modal').classList.add('hidden') }, 'OK')]);
  }
  /** Projekt mit Baustelle (Drive-Ordner) verknüpfen – Planauswahl öffnet dann direkt deren Pläne */
  linkBaustelle(b) {
    if (F.FREI || !b || !b.id) return; const m = this.doc.p.meta || (this.doc.p.meta = {});
    if (m.baustelle && m.baustelle.id === b.id) return;
    this.doc.change('Baustelle zugeordnet', () => { m.baustelle = { id: b.id, name: b.name }; if (!m.bauvorhaben) m.bauvorhaben = b.name; });
    this.toast('Projekt der Baustelle „' + b.name + '“ zugeordnet'); this.renderSide();
  }
  async aiDialog() { if (F.FREI) return; const M = await import('./ai.js?v=20261028-0429'); M.openAI(this); }
  settingsDialog() {
    const S = this.doc.p.settings; const body = h('div', { class: 'grid2' });
    const f = (label, key, type = 'number') => { const i = h('input', { type, value: S[key] ?? '' }); i.onchange = () => { S[key] = type === 'number' ? +i.value : i.value; this.redraw(); }; return h('div', { class: 'row' }, h('label', {}, label), i); };
    const sel = (label, key, values) => { const s = h('select', {}); for (const [v, l] of values) s.append(h('option', { value: v, selected: String(S[key]) === String(v) }, l)); s.onchange = () => { S[key] = isNaN(+s.value) ? s.value : +s.value; this.redraw(); }; return h('div', { class: 'row' }, h('label', {}, label), s); };
    if (!S.massstab) S.massstab = 50; if (!S.massstabLage) S.massstabLage = 200;
    body.append(f('Raster (mm)', 'raster'), f('Winkelfang (°)', 'winkelRaster'), sel('Maßstab Grundriss / Schnitt (Bezugsmaßstab)', 'massstab', [[1, '1:1'], [5, '1:5'], [10, '1:10'], [20, '1:20'], [25, '1:25'], [50, '1:50'], [75, '1:75'], [100, '1:100'], [200, '1:200'], [250, '1:250'], [500, '1:500'], [1000, '1:1000']]), sel('Maßstab Lageplan', 'massstabLage', [[1, '1:1'], [5, '1:5'], [10, '1:10'], [20, '1:20'], [25, '1:25'], [50, '1:50'], [75, '1:75'], [100, '1:100'], [200, '1:200'], [250, '1:250'], [500, '1:500'], [1000, '1:1000']]), sel('Wanddarstellung', 'wandDarstellung', [['schraffur', 'Schraffur'], ['grau', 'Grau gefüllt'], ['schwarz', 'Schwarz (Poché)']]),
      f('Mindest-Randstück (Anteil, 0,5 = halbe Fliese)', 'minRandstueck'), f('Kritisch unter (Anteil)', 'warnRandstueck'));
    this.modal('Einstellungen', body, [h('button', { class: 'btn pri', onclick: () => { $('#modal').classList.add('hidden'); this.redraw(); } }, 'Fertig')]);
  }
}

const app = new App();
app.init().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:auto 20px 20px auto;background:#7f1d1d;color:#fff;padding:12px;border-radius:8px;z-index:99">Startfehler: ${e.message}</div>`); });
export default app;
