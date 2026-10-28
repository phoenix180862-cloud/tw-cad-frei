// TW-CAD – Materialauswahl (Fassade, Fenster, Haustür, Dach) mit Vorschau
import { MATERIALIEN, matById } from './material-db.js?v=20261028-0429';
import { surfaceTexture } from './textures.js?v=20261028-0429';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };

export function thumb(mat, color, size = 46) {
  const c = document.createElement('canvas'); c.width = size * 2; c.height = size * 2; const x = c.getContext('2d');
  if (mat && ['fenster', 'haustuer'].includes(mat.muster)) {
    x.fillStyle = '#d9dde2'; x.fillRect(0, 0, c.width, c.height); x.fillStyle = color; const m = c.width * 0.18;
    x.fillRect(m, m * 0.6, c.width - 2 * m, c.height - m * 1.2);
    if (mat.muster === 'fenster') { x.fillStyle = '#9fc2d8'; x.fillRect(m + 10, m * 0.6 + 10, c.width - 2 * m - 20, c.height - m * 1.2 - 20); x.fillStyle = color; x.fillRect(c.width / 2 - 3, m * 0.6, 6, c.height - m * 1.2); }
    else { x.fillStyle = 'rgba(255,255,255,.65)'; if (mat.design === 'glasstreifen_seitlich') x.fillRect(m + 12, m, 10, c.height - 2.5 * m); if (mat.design === 'lisenen') for (let i = 0; i < 4; i++) x.fillRect(m + 8, m + i * 18 + 10, c.width - 2 * m - 16, 3); if (mat.design === 'seitenteil') x.fillRect(c.width - m - 18, m, 12, c.height - 2.2 * m); x.fillStyle = '#c0c4c8'; x.fillRect(c.width - m - 12, c.height / 2 - 12, 4, 24); }
    return c;
  }
  try { const t = surfaceTexture(mat, color); const pat = x.createPattern(t.canvas, 'repeat'); const s = (c.width / 1500) * (t.w / t.canvas.width) * 2.2; pat.setTransform(new DOMMatrix([s, 0, 0, s, 0, 0])); x.fillStyle = pat; x.fillRect(0, 0, c.width, c.height); } catch (e) { x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); }
  return c;
}

export function pickMaterial(app, { gruppen, current, color, onPick }) {
  let gruppe = (current && matById(current) && matById(current).gruppe) || gruppen[0];
  let selId = current, selCol = color;
  const body = h('div', {});
  const tabs = h('div', { class: 'btns', style: 'margin-bottom:10px' });
  const list = h('div', { style: 'display:grid;grid-template-columns:1fr 1fr;gap:6px' });
  const detail = h('div', { style: 'margin-top:10px' });
  const render = () => {
    tabs.innerHTML = ''; for (const g of gruppen) tabs.append(h('button', { class: 'chip' + (g === gruppe ? ' on' : ''), onclick: () => { gruppe = g; render(); } }, g));
    list.innerHTML = '';
    for (const m of MATERIALIEN.filter(m => m.gruppe === gruppe)) {
      const col = m.id === selId && selCol ? selCol : m.farben[0].hex;
      const card = h('div', { class: 'matcard' + (m.id === selId ? ' on' : ''), onclick: () => { selId = m.id; selCol = m.farben[0].hex; render(); } }, thumb(m, col), h('div', {}, h('div', { class: 't' }, m.produkt), h('div', { class: 'm' }, `${m.hersteller} · ${m.art}`)));
      list.append(card);
    }
    detail.innerHTML = '';
    const m = selId && matById(selId);
    if (m && m.gruppe === gruppe) {
      const sw = h('div', { class: 'swatches' });
      for (const f of m.farben) sw.append(h('div', { class: 's' + ((selCol || m.farben[0].hex).toLowerCase() === f.hex.toLowerCase() ? ' on' : ''), title: f.name, style: `background:${f.hex}`, onclick: () => { selCol = f.hex; render(); } }));
      const own = h('input', { type: 'color', value: selCol || m.farben[0].hex }); own.oninput = () => { selCol = own.value; };
      detail.append(h('div', { class: 'sec' }, h('h4', {}, `${m.hersteller} ${m.produkt} – Farbe`), sw, h('div', { class: 'row', style: 'margin-top:8px' }, h('label', {}, 'Eigene Farbe (RAL/NCS)'), own),
        h('div', { class: 'muted' }, (m.hinweis || '') + (m.rasterMm && m.rasterMm[0] ? ` · Raster ${m.rasterMm.join(' × ')} mm` : '')),
        h('div', { class: 'muted', style: 'margin-top:4px' }, 'Farben sind Annäherungen – verbindlich ist das Originalmuster des Herstellers.')));
    }
  };
  render();
  body.append(tabs, list, detail);
  const close = app.modal('Material wählen', body, [h('button', { class: 'btn', onclick: () => close() }, 'Abbrechen'), h('button', { class: 'btn pri', onclick: () => { if (selId) onPick(selId, selCol); close(); app.renderSide(); } }, 'Übernehmen')]);
}
