// TW-CAD – Maß-Leiste für Wände (03.11.2026)
// Schwebende Leiste über der Zeichenfläche, solange „Wand“ oder „Raum aus Wänden“ aktiv ist:
//  • Länge vorab fest eingeben → die nächste Wand stoppt genau bei diesem Maß, gezeigt wird nur noch die Richtung
//  • zuletzt gezeichnete Wand nachträglich exakt einstellen
//  • Längen-Schritt beim Ziehen (Auto nach Zoom / 1 / 5 / 10 / 50 cm) und Winkelfang (frei / 90° / 45° / 15°)
//  • Zurück, Schließen, Fertig – große Knöpfe für Tablet und Handy
//  • eigener Ziffernblock (keine Bildschirmtastatur, die die Zeichnung zuschiebt)
import * as G from './geom.js?v=20261104-1200';
import { laengenSchritt } from './snap.js?v=20261104-1200';

const $ = (s) => document.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'class') e.className = v; else if (k === 'html') e.innerHTML = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
const grob = () => { try { return matchMedia('(pointer: coarse)').matches; } catch (e) { return false; } };

export const SCHRITT_WAHL = [['auto', 'Auto'], [10, '1'], [50, '5'], [100, '10'], [500, '50']];
export const WINKEL_WAHL = [['frei', 'frei'], ['90', '90°'], ['45', '45°'], ['15', '15°']];

function aktiv(app) { return app.mode === 'grundriss' && (app.toolName === 'wall' || app.toolName === 'wallrect') && app.tool && (app.tool.mode === 'kette' || app.tool.mode === 'rechteck'); }
function masz(app) { return app.masz || (app.masz = { L: null, behalten: false, B: null, T: null }); }

export function winkelWert(S) { return S.orthoAn ? '90' : S.winkelFest ? String(S.winkelFest) : 'frei'; }
export function winkelSetzen(app, v) {
  const S = app.doc.p.settings;
  if (v === '90') { S.orthoAn = true; S.winkelFest = null; } else { S.orthoAn = false; S.winkelFest = v === 'frei' ? null : +v; }
  app.buildToggles && app.buildToggles(); app.scheduleSave && app.scheduleSave();
}

/** Leiste neu aufbauen bzw. ausblenden */
export function render(app) {
  let el = document.getElementById('maszLeiste');
  if (!el) { const st = $('#stage'); if (!st) return; el = h('div', { id: 'maszLeiste', class: 'masz-leiste hidden' }); st.append(el); }
  if (!app.doc || !aktiv(app)) { el.classList.add('hidden'); padZu(); return; }
  const t = app.tool, S = app.doc.p.settings, m = masz(app);
  el.classList.remove('hidden'); el.innerHTML = '';
  const zu = lsGet('twcad_massleiste_zu', '0') === '1';
  el.classList.toggle('zu', zu);
  el.append(h('button', { class: 'ml-klapp', title: zu ? 'Maß-Leiste aufklappen' : 'Maß-Leiste einklappen', onclick: () => { lsSet('twcad_massleiste_zu', zu ? '0' : '1'); render(app); } }, zu ? '📏 Maße ▴' : '▾'));
  if (zu) return;
  const gruppe = (titel, ...k) => h('div', { class: 'ml-g' }, titel ? h('span', { class: 'ml-t' }, titel) : null, ...k);
  const wert = (titel, v, onclick, extra) => h('button', { class: 'ml-wert' + (v > 0 ? ' fest' : ''), title: titel, onclick }, v > 0 ? '🔒 ' + G.fmtLaenge(v) : 'frei', h('span', { class: 'ml-tast' }, '⌨'), extra);

  if (t.mode === 'rechteck') {
    el.append(gruppe('Breite', wert('Breite fest eingeben – das Rechteck hat dann genau diese Breite', m.B, () => pad(app, 'B'))),
      gruppe('Tiefe', wert('Tiefe fest eingeben – das Rechteck hat dann genau diese Tiefe', m.T, () => pad(app, 'T'))));
    if (m.B > 0 || m.T > 0) el.append(h('button', { class: 'ml-btn klein', title: 'feste Maße löschen', onclick: () => { m.B = m.T = null; render(app); app.redraw(); } }, '✕'));
  } else {
    const ll = t.letzteLaenge && t.letzteLaenge();
    el.append(gruppe('Länge', wert('Länge der nächsten Wand fest eingeben – dann nur noch die Richtung zeigen', m.L, () => pad(app, 'L'))));
    if (m.L > 0) el.append(h('button', { class: 'ml-btn klein' + (m.behalten ? ' on' : ''), title: 'Länge für alle folgenden Wände behalten (sonst nur für die nächste Wand)', onclick: () => { m.behalten = !m.behalten; render(app); } }, '📌 behalten'),
      h('button', { class: 'ml-btn klein', title: 'feste Länge löschen', onclick: () => { m.L = null; m.behalten = false; render(app); app.redraw(); } }, '✕'));
    if (ll) el.append(gruppe('Letzte Wand', h('button', { class: 'ml-wert', title: 'Zuletzt gezeichnete Wand exakt auf Länge bringen', onclick: () => pad(app, 'letzte') }, G.fmtLaenge(ll), h('span', { class: 'ml-tast' }, '✎'))));
  }
  // Schritt
  const sw = String(S.laengenSchritt || 'auto'); const segS = h('div', { class: 'seg ml-seg' });
  for (const [v, l] of SCHRITT_WAHL) segS.append(h('button', { class: String(v) === sw ? 'on' : '', title: v === 'auto' ? `Auto: richtet sich nach dem Zoom (jetzt ${G.fmtCm(laengenSchritt(app))} cm)` : `Wandlänge beim Ziehen in ${l}-cm-Schritten`, onclick: () => { S.laengenSchritt = v; app.scheduleSave && app.scheduleSave(); render(app); } }, l));
  el.append(gruppe(sw === 'auto' ? `Schritt (${G.fmtCm(laengenSchritt(app))} cm)` : 'Schritt cm', segS));
  // Winkel
  if (t.mode !== 'rechteck') {
    const ww = winkelWert(S); const segW = h('div', { class: 'seg ml-seg' });
    for (const [v, l] of WINKEL_WAHL) segW.append(h('button', { class: v === ww ? 'on' : '', title: v === 'frei' ? 'Winkel frei (rastet bei 15° leicht ein)' : `Wände nur in ${l}-Schritten`, onclick: () => { winkelSetzen(app, v); render(app); } }, l));
    el.append(gruppe('Winkel', segW));
  }
  // Schreibhand (Lage des Maßfensters beim Stift)
  const hand = lsGet('twcad_hand', 'rechts');
  el.append(h('button', { class: 'ml-btn klein ml-hand', title: hand === 'rechts' ? 'Rechtshänder: Maßfenster beim Stift links der Spitze – tippen für Linkshänder' : 'Linkshänder: Maßfenster beim Stift rechts der Spitze – tippen für Rechtshänder', onclick: () => { lsSet('twcad_hand', hand === 'rechts' ? 'links' : 'rechts'); render(app); } }, hand === 'rechts' ? '✍ R' : '✍ L'));
  // Aktionen
  if (t.mode === 'kette' && t.pts.length) {
    const ak = h('div', { class: 'ml-g ml-ak' });
    if (t.pts.length >= 2) ak.append(h('button', { class: 'ml-btn', title: 'Letzte Wand entfernen (Rücktaste)', onclick: () => t.zurueck() }, '↶ Zurück'));
    if (t.pts.length >= 3) ak.append(h('button', { class: 'ml-btn', title: 'Wandzug zum Startpunkt schließen', onclick: () => t.schliessen() }, '⤾ Schließen'));
    ak.append(h('button', { class: 'ml-btn pri', title: 'Wandzug beenden (Esc)', onclick: () => { t.finish(); app.refreshHint(); } }, '✓ Fertig'));
    el.append(ak);
  } else if (t.mode === 'rechteck' && t.pts.length) {
    el.append(h('div', { class: 'ml-g ml-ak' }, h('button', { class: 'ml-btn', onclick: () => { t.cancel(); render(app); } }, '✕ Abbrechen')));
  }
}

/* ───────── Ziffernblock ───────── */
const ZIEL = { L: 'Länge der nächsten Wand', letzte: 'Letzte Wand – neue Länge', B: 'Breite des Rechtecks', T: 'Tiefe des Rechtecks' };
export function padZu() { const p = document.getElementById('maszPad'); if (p) p.remove(); }

/** Wert aus Ziffernblock lesen: Zahl in der gewählten Einheit, Einheit im Text („240cm“) hat Vorrang */
export function padWert(txt, einheit) {
  const s = String(txt || '').trim().toLowerCase().replace(/\s+/g, ''); if (!s) return NaN;
  if (/(mm|cm|m)$/.test(s)) return G.parseLen(s, 'mm');
  const v = parseFloat(s.replace(',', '.')); if (!isFinite(v)) return NaN;
  return v * (einheit === 'm' ? 1000 : einheit === 'cm' ? 10 : 1);
}

export function pad(app, ziel) {
  padZu();
  const t = app.tool, m = masz(app);
  let einheit = lsGet('twcad_pad_einheit', 'm');
  const start = ziel === 'letzte' ? (t.letzteLaenge && t.letzteLaenge()) : m[ziel];
  const zeig = (mm) => mm > 0 ? String(+(mm / (einheit === 'm' ? 1000 : einheit === 'cm' ? 10 : 1)).toFixed(einheit === 'm' ? 3 : 1)).replace('.', ',') : '';
  const inp = h('input', { class: 'mp-anz', type: 'text', inputmode: grob() ? 'none' : 'decimal', autocomplete: 'off', spellcheck: 'false', value: zeig(start) });
  if (grob()) inp.setAttribute('readonly', '');
  let neu = true; // erste Taste ersetzt den Vorschlag
  const segE = h('div', { class: 'seg mp-einheit' });
  const malE = () => { segE.innerHTML = ''; for (const e of ['m', 'cm', 'mm']) segE.append(h('button', { class: e === einheit ? 'on' : '', onclick: () => { const v = padWert(inp.value, einheit); einheit = e; lsSet('twcad_pad_einheit', e); if (isFinite(v)) inp.value = zeig(v); malE(); } }, e)); };
  malE();
  const taste = (k) => {
    if (k === '⌫') { inp.value = inp.value.slice(0, -1); neu = false; return; }
    if (neu) { inp.value = ''; neu = false; }
    if (k === ',' && inp.value.includes(',')) return;
    inp.value += k;
  };
  const ok = () => {
    const v = padWert(inp.value, einheit);
    if (!(v > 0)) { app.toast('Bitte ein Maß größer 0 eingeben', true); return; }
    if (ziel === 'letzte') { if (t.letzteSetzen(v)) app.toast(`Letzte Wand: ${G.fmtLaenge(v)}`); }
    else { m[ziel] = v; if (ziel === 'L') app.toast(`Länge ${G.fmtLaenge(v)} fest – jetzt die Richtung zeigen und tippen/klicken`); }
    padZu(); render(app); app.redraw();
  };
  const tasten = h('div', { class: 'mp-tasten' });
  for (const k of ['7', '8', '9', '4', '5', '6', '1', '2', '3', ',', '0', '⌫']) tasten.append(h('button', { class: 'mp-t' + (k === '⌫' ? ' del' : ''), onclick: (e) => { e.preventDefault(); taste(k); } }, k));
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); ok(); } else if (e.key === 'Escape') { e.preventDefault(); padZu(); } else neu = false; });
  const p = h('div', { id: 'maszPad', class: 'masz-pad', role: 'dialog', 'aria-label': ZIEL[ziel] },
    h('div', { class: 'mp-kopf' }, h('b', {}, ZIEL[ziel]), h('button', { class: 'mp-x', title: 'Schließen', onclick: padZu }, '✕')),
    h('div', { class: 'mp-zeile' }, inp, segE),
    tasten,
    h('div', { class: 'mp-fuss' }, h('button', { class: 'ml-btn', onclick: padZu }, 'Abbrechen'), h('button', { class: 'ml-btn pri', onclick: ok }, 'OK')));
  $('#stage').append(p);
  if (!grob()) setTimeout(() => { inp.focus(); inp.select(); }, 0);
}
