// TW-CAD – Baukasten 3D: Darstellungsstil, Fassade mit Pinsel, Sockel, Fenster & Türen, Dach, Umgebung (Thomas 22.11.2026)
// Alles zum Antippen: Material und Farbe antippen = sofort im Haus zu sehen. Einzelne Wände mit dem Pinsel.
import * as THREE from 'three';
import { MATERIALIEN, matById, FASSADE_GRUPPEN } from './material-db.js?v=20261122-2150';
import { thumb } from './matpicker.js?v=20261122-2150';
import * as K from './katalog.js?v=20261122-2150';
import * as X from './view3d-plus.js?v=20261122-2150';
import { profi } from './frei.js?v=20261122-2150';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== false && v != null) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) e.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c); return e; };

/* ───────── Darstellungsstile ───────── */
export const STILE = [['real', 'Realistisch'], ['modell', 'Architektenmodell'], ['skizze', 'Skizze'], ['abend', 'Abendstimmung']];
const STIL_INFO = { real: 'Materialien, Licht und Schatten wie gewählt', modell: 'weißes Modell – zeigt Baukörper und Dach', skizze: 'weiß mit Kanten – wie eine Handskizze', abend: 'warmes Abendlicht, Fenster leuchten' };

export function stilAnwenden(v) {
  const s = v.opt.stil || 'real';
  if (v.scene.fog) { v.scene.fog.near = 120; v.scene.fog.far = 420; }
  v.hemi.color.set('#ffffff'); v.hemi.groundColor.set('#9a9686'); v.renderer.toneMappingExposure = 1.05;
  if (s === 'real') return;
  if (s === 'abend') {
    const bg = new THREE.Color('#2b3552'); v.scene.background = bg; if (v.scene.fog) v.scene.fog.color = bg;
    const c = v.sun.target.position; v.sun.position.set(c.x - 80, c.y + 22, c.z + 70);
    v.sun.color.set('#ffae66'); v.sun.intensity = 1.5; v.hemi.color.set('#8ea3d6'); v.hemi.groundColor.set('#3b3326'); v.hemi.intensity = 0.7;
    v.root.traverse(o => { if (!o.isMesh) return; for (const m of [].concat(o.material)) if (m && m.transparent && m.opacity < 0.95 && m.emissive) { m.emissive.set('#ffc56b'); m.emissiveIntensity = 1.3; m.opacity = 0.9; } });
    return;
  }
  const weiss = new THREE.MeshStandardMaterial({ color: '#f2f1ed', roughness: 0.92, side: THREE.DoubleSide });
  const glas = new THREE.MeshStandardMaterial({ color: '#b8c7d1', roughness: 0.2, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
  const kanten = []; const um = (m) => m && m.transparent ? glas : weiss;
  v.root.traverse(o => {
    if (o.isMesh) { o.material = Array.isArray(o.material) ? o.material.map(um) : um(o.material); if (s === 'skizze' && o.geometry && o.geometry.attributes.position && o.geometry.attributes.position.count < 60000) kanten.push(o); }
    else if (o.isLine && !o.userData.kante) o.material = new THREE.LineBasicMaterial({ color: '#9aa0a6' });
  });
  if (s === 'skizze') {
    const lm = new THREE.LineBasicMaterial({ color: '#30343a' });
    for (const o of kanten) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(o.geometry, 28), lm); e.userData.kante = true; e.raycast = () => { }; o.add(e); }
    const bg = new THREE.Color('#fbfaf7'); v.scene.background = bg; if (v.scene.fog) { v.scene.fog.color = bg; v.scene.fog.far = 2000; }
    v.renderer.toneMappingExposure = 1.2;
  } else { const bg = new THREE.Color('#e9edf1'); v.scene.background = bg; if (v.scene.fog) v.scene.fog.color = bg; }
}

/* ───────── Pinsel: einzelne Wand im Bild antippen ───────── */
export function pinselAuf(v, wandId) {
  const p = v.pinsel; const doc = v.app.doc; const w = doc.byId(wandId); if (!p || !w) return false;
  if (p.art === 'sockel') doc.change('Sockel (Pinsel)', () => { w.sockel = p.id; w.sockelColor = p.farbe; if (!w.sockelH) w.sockelH = 400; });
  else doc.change('Fassade (Pinsel)', () => { w.facade = p.id; w.facadeColor = p.farbe; });
  const m = matById(p.id); v.app.toast(`Wand gestrichen: ${m ? m.produkt : ''}`); return true;
}
export function pinselLeiste(v) {
  let b = v.el.querySelector('.v3-pinsel');
  if (!v.pinsel) { if (b) b.remove(); v.renderer.domElement.style.cursor = ''; return; }
  if (!b) { b = h('div', { class: 'v3-pinsel', 'data-tw': 'pinsel-leiste' }); v.el.append(b); }
  const m = matById(v.pinsel.id); b.innerHTML = '';
  b.append(h('span', { class: 'v3p-sw', style: `background:${v.pinsel.farbe || (m && m.farben[0].hex) || '#ccc'}` }),
    h('span', { class: 'v3p-t' }, h('b', {}, v.pinsel.art === 'sockel' ? 'Pinsel Sockel' : 'Pinsel Fassade'), ' – Wand im Bild antippen'),
    h('button', { class: 'btn sm pri', 'data-tw': 'pinsel-fertig', onclick: () => { v.pinsel = null; pinselLeiste(v); v.app.renderSide(); } }, 'Fertig'));
  v.renderer.domElement.style.cursor = 'crosshair';
}

/* Handy: nach der Wahl im Pinsel-Modus Schublade zu, damit die Wand im Bild frei ist */
const handyZu = (app) => { if (window.innerWidth <= 760 && app.handySeite) setTimeout(() => app.handySeite(false), 250); };

/* ───────── Baukasten (linke Spalte in 3D) ───────── */
const OFFEN_KEY = 'twcad_bk_offen';
function offenSet() { try { const a = JSON.parse(localStorage.getItem(OFFEN_KEY) || 'null'); if (Array.isArray(a)) return new Set(a); } catch (e) { } return new Set(['stil', 'fassade', 'dach']); }

export function baukasten(v, body) {
  const doc = v.app.doc, app = v.app;
  if (!v.bk) v.bk = { offen: offenSet() };
  const bk = v.bk;
  const waende = () => doc.all('wall');
  const aussen = waende().find(w => w.art === 'aussen' && w.facade) || waende().find(w => w.facade) || waende().find(w => w.art === 'aussen') || waende()[0];
  const fenster = () => doc.all('opening').filter(o => o.kind === 'window');
  const tueren = () => doc.all('opening').filter(o => o.kind === 'door' && /haustuer|nebeneingang/.test(o.art || ''));
  const merke = () => { try { localStorage.setItem(OFFEN_KEY, JSON.stringify([...bk.offen])); } catch (e) { } };

  const teil = (key, symbol, titel, kurz, ...inhalt) => {
    const d = h('details', { class: 'bk', 'data-bk': key, open: bk.offen.has(key) },
      h('summary', {}, h('span', { class: 'bk-sy' }, symbol), h('span', { class: 'bk-ti' }, titel), kurz ? h('span', { class: 'bk-kurz' }, kurz) : null),
      h('div', { class: 'bk-in' }, ...inhalt));
    d.addEventListener('toggle', () => { if (d.open) bk.offen.add(key); else bk.offen.delete(key); merke(); });
    return d;
  };
  const chips = (liste, akt, fn, tw) => h('div', { class: 'bk-chips' }, liste.map(([w, l]) => h('button', { class: 'chip' + (String(akt) === String(w) ? ' on' : ''), 'data-tw': tw ? tw + '-' + w : null, onclick: () => fn(w) }, l)));
  const farbFelder = (farben, akt, fn, eigen = true) => {
    const sw = h('div', { class: 'swatches bk-sw' });
    for (const f of farben) sw.append(h('button', { class: 's' + (akt && akt.toLowerCase() === f.hex.toLowerCase() ? ' on' : ''), title: f.name, 'aria-label': f.name, style: `background:${f.hex}`, onclick: () => fn(f.hex) }));
    if (eigen) { const own = h('input', { type: 'color', value: akt || (farben[0] && farben[0].hex) || '#ffffff', title: 'Eigene Farbe (RAL/NCS)', 'aria-label': 'Eigene Farbe' }); own.onchange = () => fn(own.value); sw.append(h('label', { class: 'bk-eigen' }, own, 'eigene')); }
    return sw;
  };
  const kacheln = (gruppe, aktId, aktFarbe, fn, tw) => {
    const g = h('div', { class: 'bk-mat', lang: 'de' });
    for (const m of MATERIALIEN.filter(m => m.gruppe === gruppe)) {
      const col = m.id === aktId && aktFarbe ? aktFarbe : m.farben[0].hex;
      g.append(h('button', { class: 'bk-mk' + (m.id === aktId ? ' on' : ''), 'data-tw': tw, title: `${m.hersteller} ${m.produkt}`, onclick: () => fn(m.id, m.id === aktId && aktFarbe ? aktFarbe : m.farben[0].hex) }, thumb(m, col, 30), h('span', {}, m.produkt)));
    }
    return g;
  };
  const mName = (id, farbe) => { const m = matById(id); if (!m) return ''; const f = farbe && m.farben.find(f => f.hex.toLowerCase() === farbe.toLowerCase()); return m.produkt + (f ? ' · ' + f.name : ''); };

  /* 1 Stil */
  const stil = v.opt.stil || 'real';
  const stilTeil = teil('stil', '🎨', 'Stil der Darstellung', (STILE.find(s => s[0] === stil) || [])[1],
    h('div', { class: 'bk-stile' }, STILE.map(([k, l]) => h('button', { class: 'bk-stil' + (stil === k ? ' on' : ''), 'data-tw': 'stil-' + k, 'data-stil': k, onclick: () => { v.opt.stil = k; v.build(); app.renderSide(); } }, h('i', {}), h('b', {}, l), h('small', {}, STIL_INFO[k])))));

  /* 2 Fassade */
  const fasGruppen = FASSADE_GRUPPEN.filter(g => MATERIALIEN.some(m => m.gruppe === g));
  const fasId = aussen && aussen.facade || doc.p.settings.stdFassade || 'putz-scheibenputz';
  const fasM = matById(fasId);
  if (!bk.fasGruppe) bk.fasGruppe = (fasM && fasM.gruppe) || 'Putz';
  const anwendenFas = (id, farbe) => {
    if (v.pinsel && v.pinsel.art === 'fassade') { v.pinsel = { art: 'fassade', id, farbe }; pinselLeiste(v); app.renderSide(); handyZu(app); return; }
    doc.change('Fassade alle Außenwände', () => { for (const w of waende()) { w.facade = id; w.facadeColor = farbe; } doc.p.settings.stdFassade = id; });
  };
  const fasAkt = v.pinsel && v.pinsel.art === 'fassade' ? v.pinsel : { id: fasId, farbe: aussen && aussen.facadeColor };
  const fasMat = matById(fasAkt.id);
  const fassadeTeil = teil('fassade', '🧱', 'Fassade', mName(fasAkt.id, fasAkt.farbe),
    h('div', { class: 'bk-seg' },
      h('button', { class: !v.pinsel || v.pinsel.art !== 'fassade' ? 'on' : '', 'data-tw': 'fas-alle', onclick: () => { v.pinsel = null; pinselLeiste(v); app.renderSide(); } }, 'Alle Außenwände'),
      h('button', { class: v.pinsel && v.pinsel.art === 'fassade' ? 'on' : '', 'data-tw': 'fas-pinsel', onclick: () => { v.pinsel = { art: 'fassade', id: fasAkt.id, farbe: fasAkt.farbe || (fasMat && fasMat.farben[0].hex) }; pinselLeiste(v); app.renderSide(); } }, '🖌 Pinsel: einzelne Wand')),
    h('div', { class: 'muted bk-hin' }, v.pinsel && v.pinsel.art === 'fassade' ? 'Material und Farbe wählen, dann die Wand im 3D-Bild antippen.' : 'Antippen ändert sofort alle Außenwände.'),
    chips(fasGruppen.map(g => [g, g]), bk.fasGruppe, (g) => { bk.fasGruppe = g; app.renderSide(); }, 'fas-gr'),
    kacheln(bk.fasGruppe, fasAkt.id, fasAkt.farbe, anwendenFas, 'fas-mat'),
    fasMat && fasMat.gruppe === bk.fasGruppe ? h('div', { class: 'bk-farbe' }, h('div', { class: 'bk-lbl' }, 'Farbe ' + fasMat.produkt), farbFelder(fasMat.farben, fasAkt.farbe || fasMat.farben[0].hex, (c) => anwendenFas(fasMat.id, c))) : null);

  /* 3 Sockel */
  const sH = (aussen && aussen.sockelH) || 0;
  const sockId = (aussen && aussen.sockel) || 'putz-scheibenputz'; const sockM = matById(sockId);
  if (!bk.sockGruppe) bk.sockGruppe = (sockM && ['Putz', 'Klinker', 'Naturstein'].includes(sockM.gruppe) && sockM.gruppe) || 'Putz';
  const anwendenSock = (id, farbe) => {
    if (v.pinsel && v.pinsel.art === 'sockel') { v.pinsel = { art: 'sockel', id, farbe }; pinselLeiste(v); app.renderSide(); handyZu(app); return; }
    doc.change('Sockel alle Außenwände', () => { for (const w of waende()) { w.sockel = id; w.sockelColor = farbe; if (!w.sockelH) w.sockelH = 400; } });
  };
  const sockelTeil = teil('sockel', '▁', 'Fassadensockel', sH ? `${sH / 10} cm · ${mName(sockId, aussen && aussen.sockelColor)}` : 'ohne',
    h('div', { class: 'bk-lbl' }, 'Höhe'),
    chips([[0, 'ohne'], [300, '30 cm'], [400, '40 cm'], [500, '50 cm'], [600, '60 cm']], sH, (w) => doc.change('Sockelhöhe', () => { for (const x of waende()) x.sockelH = +w; }), 'sockel-h'),
    sH ? [
      h('div', { class: 'bk-seg' },
        h('button', { class: !v.pinsel || v.pinsel.art !== 'sockel' ? 'on' : '', onclick: () => { v.pinsel = null; pinselLeiste(v); app.renderSide(); } }, 'Alle Außenwände'),
        h('button', { class: v.pinsel && v.pinsel.art === 'sockel' ? 'on' : '', 'data-tw': 'sockel-pinsel', onclick: () => { v.pinsel = { art: 'sockel', id: sockId, farbe: (aussen && aussen.sockelColor) || '#4A4D4F' }; pinselLeiste(v); app.renderSide(); } }, '🖌 Pinsel')),
      chips(['Putz', 'Klinker', 'Naturstein'].map(g => [g, g]), bk.sockGruppe, (g) => { bk.sockGruppe = g; app.renderSide(); }),
      kacheln(bk.sockGruppe, sockId, aussen && aussen.sockelColor, anwendenSock, 'sockel-mat'),
      sockM && sockM.gruppe === bk.sockGruppe ? farbFelder(sockM.farben.concat(sockM.farben.some(f => f.hex.toLowerCase() === '#4a4d4f') ? [] : [{ name: 'Anthrazit', hex: '#4A4D4F' }]), (aussen && aussen.sockelColor) || '', (c) => anwendenSock(sockM.id, c)) : null] : null);

  /* 4 Fenster & Türen */
  const f0 = fenster()[0] || {}; const fCol = f0.farbeA || f0.stilColor || '';
  const RAHMEN = [{ name: 'Weiß', hex: '#F4F4F2' }, { name: 'Cremeweiß', hex: '#EAE6CA' }, { name: 'Grau (RAL 7039)', hex: '#6C6960' }, { name: 'Anthrazit (RAL 7016)', hex: '#383E42' }, { name: 'Schwarz (RAL 9005)', hex: '#1E1E1E' }, { name: 'Braun', hex: '#4E3B31' }, { name: 'Eiche', hex: '#8A5A32' }];
  const ssWahl = [['ohne', 'ohne'], ['rl_aufsatz', 'Rollladen'], ['raffstore', 'Raffstore'], ['klappladen', 'Klappläden']].filter(([k]) => K.SONNENSCHUTZ.some(s => s[0] === k));
  const t0 = tueren()[0] || {};
  const fensterTeil = teil('fenster', '🪟', 'Fenster & Türen', fenster().length ? `${fenster().length} Fenster` : 'keine Fenster',
    fenster().length ? [
      h('div', { class: 'bk-lbl' }, 'Rahmenfarbe außen – alle Fenster'),
      farbFelder(RAHMEN, fCol, (c) => doc.change('Fensterfarbe alle', () => { for (const o of fenster()) { o.farbeA = c; } })),
      h('div', { class: 'bk-lbl' }, 'Sonnenschutz – alle Fenster'),
      chips(ssWahl, f0.sonnenschutz || 'ohne', (k) => doc.change('Sonnenschutz alle', () => { for (const o of fenster()) o.sonnenschutz = k; }), 'ss'),
      h('div', { class: 'bk-lbl' }, 'Fenster-Modell'),
      kacheln('Fenster', f0.stil, f0.stilColor, (i, c) => doc.change('Fenster alle', () => { for (const o of fenster()) { o.stil = i; o.stilColor = c; o.farbeA = c; } }), 'fen-mat')]
      : h('div', { class: 'muted' }, 'Im Grundriss sind noch keine Fenster gesetzt.'),
    tueren().length ? [
      h('div', { class: 'bk-lbl' }, 'Haustür'),
      kacheln('Haustür', t0.stil, t0.stilColor, (i, c) => doc.change('Haustür', () => { for (const o of tueren()) { o.stil = i; o.stilColor = c; o.farbe = c; } }), 'tuer-mat'),
      farbFelder(RAHMEN, t0.farbe || t0.stilColor || '', (c) => doc.change('Haustür Farbe', () => { for (const o of tueren()) o.farbe = c; }))] : null,
    h('div', { class: 'muted bk-hin' }, 'Einzelnes Fenster anders: im 3D-Bild antippen.'));

  /* 5 Dach */
  const dachTeil = (() => {
    const rf = (v.sel && v.sel.kind === 'roof' && doc.p.roofs.find(r => r.id === v.sel.id)) || doc.p.roofs[0];
    const alle = (fn, l) => doc.change(l, () => { for (const r of (v.sel && v.sel.kind === 'roof' ? [rf] : doc.p.roofs)) fn(r); });
    if (!rf) return teil('dach', '🏠', 'Dach', 'noch keins', h('div', { class: 'muted' }, 'Das Haus hat noch kein Dach.'),
      h('button', { class: 'btn pri bk-gross', 'data-tw': 'dach-auf', onclick: () => { doc.change('Dach', () => doc.p.roofs.push({ id: 'r' + Date.now(), storey: doc.p.storeys[doc.p.storeys.length - 1].id, typ: 'sattel', neigung: 35, ueberstand: 500, kniestock: 0, richtung: 'auto', material: 'dach-braas-rubin13v', farbe: null })); v.opt.dach = true; } }, '🏠 Dach aufsetzen'));
    const dm = matById(rf.material);
    const FORMEN = [['sattel', 'Sattel'], ['walm', 'Walm'], ['krueppelwalm', 'Krüppelwalm'], ['pult', 'Pult'], ['zelt', 'Zelt'], ['mansard', 'Mansarde'], ['flach', 'Flach']];
    if (!bk.dachGruppe) bk.dachGruppe = 'Dach';
    const DNAME = { sattel: 'Satteldach', walm: 'Walmdach', krueppelwalm: 'Krüppelwalmdach', pult: 'Pultdach', zelt: 'Zeltdach', mansard: 'Mansarddach', flach: 'Flachdach (Attika)' };
    return teil('dach', '🏠', 'Dach', [h('span', {}, DNAME[rf.typ] || 'Dach'), rf.typ !== 'flach' ? ` · ${rf.neigung || 0}°` : ''],
      doc.p.roofs.length > 1 ? h('div', { class: 'muted bk-hin' }, v.sel && v.sel.kind === 'roof' ? 'Gilt für das angetippte Dach.' : 'Gilt für alle Dächer – ein Dach antippen, um nur dieses zu ändern.') : null,
      h('div', { class: 'bk-lbl' }, 'Form'), chips(FORMEN, rf.typ, (t) => alle(r => { r.typ = t; }, 'Dachform'), 'dach-form'),
      rf.typ !== 'flach' ? [h('div', { class: 'bk-lbl' }, 'Neigung'), chips([[15, '15°'], [22, '22°'], [30, '30°'], [35, '35°'], [40, '40°'], [45, '45°']], rf.neigung, (n) => alle(r => { r.neigung = +n; }, 'Dachneigung'), 'dach-n')] : null,
      h('div', { class: 'bk-lbl' }, 'Dachüberstand'), chips([[0, 'ohne'], [300, '30 cm'], [500, '50 cm'], [800, '80 cm']], rf.ueberstand, (n) => alle(r => { r.ueberstand = +n; }, 'Dachüberstand'), 'dach-ue'),
      rf.typ !== 'flach' && rf.typ !== 'zelt' ? [h('div', { class: 'bk-lbl' }, 'First'), chips([['auto', 'automatisch'], ['x', 'quer'], ['y', 'längs']], rf.richtung || 'auto', (n) => alle(r => { r.richtung = n; }, 'Firstrichtung'))] : null,
      h('div', { class: 'bk-lbl' }, 'Eindeckung'),
      kacheln('Dach', rf.material, rf.farbe, (i, c) => alle(r => { r.material = i; r.farbe = c; }, 'Eindeckung'), 'dach-mat'),
      dm ? farbFelder(dm.farben, rf.farbe || dm.farben[0].hex, (c) => alle(r => { r.material = dm.id; r.farbe = c; }, 'Dachfarbe')) : null);
  })();

  /* 6 Umgebung */
  const bis = h('select', {}); bis.append(h('option', { value: '' }, 'alle Geschosse')); doc.p.storeys.forEach((s, i) => bis.append(h('option', { value: i, selected: v.opt.bis === i }, 'bis ' + s.name))); bis.onchange = () => { v.opt.bis = bis.value === '' ? null : +bis.value; v.build(); };
  const schalter = (an, l, fn, tw) => h('button', { class: 'chip' + (an ? ' on' : ''), 'data-tw': tw, onclick: () => { fn(); v.build(); v.renderBar(); app.renderSide(); } }, l);
  const umgebungTeil = teil('umgebung', '🌳', 'Gelände & Umgebung', null,
    h('div', { class: 'bk-chips' },
      schalter(v.opt.gelaende, 'Gelände', () => { v.opt.gelaende = !v.opt.gelaende; }, 'um-gelaende'),
      schalter(v.opt.nachbarn, 'Nachbargebäude', () => { v.opt.nachbarn = !v.opt.nachbarn; }),
      schalter(v.opt.hoehenlinien, 'Höhenlinien', () => { v.opt.hoehenlinien = !v.opt.hoehenlinien; }),
      schalter(v.opt.objekte !== false, 'Einrichtung', () => { v.opt.objekte = v.opt.objekte === false; }),
      schalter(v.opt.dach, 'Dach zeigen', () => { v.opt.dach = !v.opt.dach; })),
    h('div', { class: 'row' }, h('label', {}, 'Geschosse'), bis),
    h('div', { class: 'muted bk-hin' }, 'Gelände, Wege und Terrasse zeichnest du im Lageplan.'));

  /* 7–9 aus dem Zusatz-Baustein (Sonne, Kamera/Schnitt, Bild) */
  const aus = (fn) => { const c = h('div', {}); try { fn(c); } catch (e) { console.error(e); } for (const s of c.querySelectorAll(':scope > .sec > h4')) s.remove(); return c; };
  const sonneTeil = teil('sonne', '☀️', 'Sonne & Licht', null, aus(c => X.sonnenPanel(v, c)));
  const kameraTeil = teil('kamera', '🎥', 'Kamera & Schnitt', null, aus(c => { X.kameraPanel(v, c); X.schnittPanel(v, c); }));
  const bildTeil = teil('bild', '🖼', 'Bild & Export', null, aus(c => X.exportPanel(v, c)));

  body.append(h('div', { class: 'bk-kopf' }, h('b', {}, 'Baukasten 3D'), h('span', { class: 'muted' }, 'Antippen – sofort im Bild')),
    stilTeil, fassadeTeil, sockelTeil, fensterTeil, dachTeil, umgebungTeil, profi(sonneTeil), profi(kameraTeil), profi(bildTeil));
}
