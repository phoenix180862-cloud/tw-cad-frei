// TW-CAD – Objekte-Fenster (Thomas 22.11.2026): „wenn ich Objekte anwähle, ein Fenster aufgehen, das mir alle Objekte zeigt
// und wo ich dann in diesem Fenster alles einstelle“. Gruppen links, Bilder in der Mitte, Größe/Drehung/Fliesen rechts.
import { SYMBOLE, SYMBOL_KATEGORIEN, symboleIn, drawSymbol } from './render2d.js?v=20261123-0645';
import { CanvasPainter } from './painter.js?v=20261123-0645';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
const ZULETZT = 'twcad_obj_zuletzt';
const cm = (mm) => String(Math.round(mm) / 10).replace('.', ',');

/** Draufsicht eines Objekts in ein Canvas zeichnen (gleiche Zeichnung wie im Plan) */
export function objektBild(canvas, kind, w, d) {
  const dpr = window.devicePixelRatio || 1; const cw = canvas.clientWidth || canvas.width, ch = canvas.clientHeight || canvas.height;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  const ctx = canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
  const rand = 0.16; const s = Math.min(canvas.width * (1 - 2 * rand) / w, canvas.height * (1 - 2 * rand) / d);
  const tf = { s, ox: canvas.width / 2, oy: canvas.height / 2 };
  // Strichstärke am Bild ausrichten, nicht am Planmaßstab
  const P = new CanvasPainter(ctx, tf, 8 * dpr / s, dpr);
  try { drawSymbol(P, { kind, p: { x: 0, y: 0 }, w, d, rot: 180 }, '#1b2533'); } catch (e) { }
}

export function zuletzt() { try { return JSON.parse(localStorage.getItem(ZULETZT) || '[]').filter(k => SYMBOLE[k]); } catch (e) { return []; } }
function merke(k) { try { const l = [k, ...zuletzt().filter(x => x !== k)].slice(0, 12); localStorage.setItem(ZULETZT, JSON.stringify(l)); } catch (e) { } }

/** Fenster öffnen. app.doc.p.settings trägt die Wahl (symbolArt, symbolW, symbolD, symbolAuto, symbolAussparen). */
export function objektFenster(app, opt = {}) {
  document.querySelectorAll('.objekt-fenster').forEach(x => x.remove());
  const S = app.doc.p.settings;
  const lageplan = app.mode === 'lageplan';
  const kats = lageplan ? SYMBOL_KATEGORIEN.filter(([k]) => k === 'aussen') : SYMBOL_KATEGORIEN;
  let art = S.symbolArt && SYMBOLE[S.symbolArt] && (!lageplan || SYMBOLE[S.symbolArt].kat === 'aussen') ? S.symbolArt : symboleIn(kats[0][0])[0][0];
  let kat = zuletzt().length && !lageplan && !opt.kat ? '_zuletzt' : (opt.kat || SYMBOLE[art].kat);
  let W = S.symbolArt === art && S.symbolW ? S.symbolW : SYMBOLE[art].w, D = S.symbolArt === art && S.symbolD ? S.symbolD : SYMBOLE[art].d;
  let auto = S.symbolAuto !== false, rot = app.tool && app.tool.rot != null ? app.tool.rot : 0;
  let aussparen = S.symbolArt === art && S.symbolAussparen != null ? !!S.symbolAussparen : !!SYMBOLE[art].aussparen;
  let such = '';
  const zu = () => { f.remove(); document.removeEventListener('keydown', taste, true); if (opt.beiZu) opt.beiZu(); };
  const taste = (e) => { if (e.key === 'Escape') { e.stopPropagation(); zu(); } };

  const liste = () => {
    const q = such.trim().toLowerCase();
    if (q) return Object.entries(SYMBOLE).filter(([k, v]) => (!lageplan || v.kat === 'aussen') && (v.name.toLowerCase().includes(q) || (v.g || []).some(g => (v.name + ' ' + g[2]).toLowerCase().includes(q))));
    if (kat === '_zuletzt') return zuletzt().map(k => [k, SYMBOLE[k]]);
    return symboleIn(kat);
  };
  const waehle = (k) => { art = k; W = SYMBOLE[k].w; D = SYMBOLE[k].d; aussparen = !!SYMBOLE[k].aussparen; male(); };

  const links = h('div', { class: 'of-links' }); const mitte = h('div', { class: 'of-gitter' }); const rechts = h('div', { class: 'of-rechts' });
  const sucheIn = h('input', { class: 'of-suche', type: 'search', placeholder: 'Suchen, z. B. „Waschtisch 60“', 'data-tw-fokus-ok': '', oninput: (e) => { such = e.target.value; male(); } });

  function chip(text, an, fn, tw) { return h('button', { class: 'of-chip' + (an ? ' on' : ''), 'data-tw': tw, onclick: fn }, text); }
  function male() {
    links.innerHTML = '';
    if (!lageplan && zuletzt().length) links.append(h('button', { class: 'of-kat' + (kat === '_zuletzt' && !such ? ' on' : ''), onclick: () => { kat = '_zuletzt'; such = ''; sucheIn.value = ''; male(); } }, 'Zuletzt benutzt'));
    for (const [k, l] of kats) links.append(h('button', { class: 'of-kat' + (kat === k && !such ? ' on' : ''), 'data-kat': k, onclick: () => { kat = k; such = ''; sucheIn.value = ''; male(); } }, l));
    mitte.innerHTML = '';
    const L = liste();
    if (!L.length) mitte.append(h('div', { class: 'of-leer' }, 'Nichts gefunden.'));
    for (const [k, v] of L) {
      const cv = h('canvas', { class: 'of-bild' });
      const kachel = h('button', { class: 'of-kachel' + (k === art ? ' on' : ''), 'data-obj': k, onclick: () => waehle(k), ondblclick: () => { waehle(k); setzen(); } }, cv, h('span', {}, v.name));
      mitte.append(kachel); requestAnimationFrame(() => objektBild(cv, k, v.w, v.d));
    }
    // rechte Spalte
    const d = SYMBOLE[art]; rechts.innerHTML = '';
    const gross = h('canvas', { class: 'of-gross' });
    const groessen = (d.g || []).map(([w, dd, l]) => chip(`${l}`, w === W && dd === D, () => { W = w; D = dd; male(); }, 'of-g'));
    const feld = (wert, set) => h('input', { class: 'of-zahl', type: 'text', inputmode: 'decimal', value: cm(wert), 'data-tw-fokus-ok': '', onchange: (e) => { const v = parseFloat(String(e.target.value).replace(',', '.')); if (v > 0) { set(Math.round(v * 10)); male(); } } });
    rechts.append(
      h('div', { class: 'of-name' }, d.name),
      gross, h('div', { class: 'of-mass' }, `${cm(W)} × ${cm(D)} cm`),
      h('div', { class: 'of-t' }, 'Größe'),
      groessen.length ? h('div', { class: 'of-chips' }, ...groessen) : null,
      h('div', { class: 'of-eigen' }, h('label', {}, h('span', {}, 'Breite'), feld(W, v => W = v), h('span', {}, 'cm')), h('label', {}, h('span', {}, 'Tiefe'), feld(D, v => D = v), h('span', {}, 'cm'))),
      h('div', { class: 'of-t' }, 'Drehung'),
      h('div', { class: 'of-chips' }, chip('an der Wand von selbst', auto, () => { auto = true; male(); }, 'of-auto'), ...[0, 90, 180, 270].map(r => chip(r + '°', !auto && rot === r, () => { auto = false; rot = r; male(); }, 'of-rot'))),
      lageplan ? null : h('div', { class: 'of-t' }, 'Fliesen'),
      lageplan ? null : h('div', { class: 'of-chips' }, chip('Fliese läuft drunter', !aussparen, () => { aussparen = false; male(); }, 'of-drunter'), chip('wird ausgespart', aussparen, () => { aussparen = true; male(); }, 'of-aussparen')),
      h('button', { class: 'of-setzen', 'data-tw': 'of-setzen', onclick: setzen }, 'In den Plan setzen'),
      h('div', { class: 'of-hinweis' }, 'Danach nur noch an die Stelle tippen – nah an der Wand richtet es sich von selbst aus. Mehrere hintereinander möglich, Esc beendet.'));
    requestAnimationFrame(() => objektBild(gross, art, W, D));
  }
  function setzen() {
    S.symbolArt = art; S.symbolW = W; S.symbolD = D; S.symbolAuto = auto; S.symbolAussparen = aussparen; merke(art);
    f.remove(); document.removeEventListener('keydown', taste, true);
    if (app.toolName !== 'symbol') app.setTool('symbol', { ohneFenster: true });
    if (app.tool) app.tool.rot = auto ? 0 : rot;
    app.refreshOpt(); app.redraw();
    app.toast(`${SYMBOLE[art].name} ${cm(W)} × ${cm(D)} cm – jetzt an die Stelle im Plan tippen`);
    if (opt.beiSetzen) opt.beiSetzen();
  }
  const f = h('div', { class: 'objekt-fenster', role: 'dialog', 'aria-label': 'Objekte einsetzen', 'data-tw': 'objekt-fenster' },
    h('div', { class: 'of-kopf' }, h('b', {}, lageplan ? 'Objekte im Lageplan' : 'Objekte einsetzen'), h('span', { class: 'of-sp' }), sucheIn, h('button', { class: 'of-zu', 'data-tw': 'of-zu', onclick: zu }, 'Schließen ✕')),
    h('div', { class: 'of-rumpf' }, links, mitte, rechts));
  document.body.append(f); document.addEventListener('keydown', taste, true);
  male();
  return f;
}
