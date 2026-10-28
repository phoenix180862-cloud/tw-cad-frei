// TW-CAD – Plan vom Kunden übernehmen: PDF/Bild laden, Maßstab bestimmen, Wände aus Maßen aufbauen
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import * as V from './pdfvec.js?v=20261028-0429';
import { uid } from './model.js?v=20261028-0429';
import { icon } from './icons.js?v=20261028-0429';
import { FREI } from './frei.js?v=20261028-0429';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
const MMPT = 25.4 / 72;

function pdfjs() { const p = window.pdfjsLib; if (!p) throw new Error('PDF-Leser nicht geladen'); p.GlobalWorkerOptions.workerSrc = 'lib/pdf.worker.min.js'; return p; }

export function hydrateUnderlays(doc, onload) {
  for (const u of doc.p.underlays) if (u.src && !u.img) { const i = new Image(); i.onload = () => { u.img = i; onload && onload(); }; i.src = u.src; }
}

export async function openImport(app, preset = {}) {
  const st = { file: null, pdf: null, pageNo: 1, page: null, analysis: null, scale: null, k: null, img: null, imgW: 0, imgH: 0, calib: null, target: app.doc.p.activeStorey, modus: 'raeume', sel: new Set(), rect: null, hover: -1 };
  app._import = st; // für Tests/Diagnose
  const body = h('div', {});
  const info = h('div', { class: 'note' }, 'PDF des Architekten (am besten direkt aus dem CAD exportiert) oder ein Bild/Scan. Bei CAD-PDFs liest TW-CAD die echten Linien und Maßzahlen und baut die Wände maßgenau auf – nichts wird abgepaust. Du kannst den ganzen Plan oder nur einzelne Räume übernehmen.');
  const fileBtn = h('button', { class: 'btn', html: icon('folder') + 'Datei vom Computer …' });
  const baustBtn = h('button', { class: 'btn pri', html: icon('importpdf') + 'Aus Baustelle wählen …' }); if (FREI) baustBtn.style.display = 'none';
  const fileName = h('span', { class: 'muted', style: 'max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap' }, '');
  const pageSel = h('select', { style: 'width:auto' }); const tgt = h('select', { style: 'width:auto' });
  for (const s of app.doc.p.storeys) tgt.append(h('option', { value: s.id, selected: s.id === st.target }, 'Geschoss ' + s.name)); tgt.append(h('option', { value: 'site' }, 'Lageplan'));
  tgt.onchange = () => st.target = tgt.value;
  const scaleSel = h('select', { style: 'width:auto' }); for (const m of ['auto', 20, 25, 50, 75, 100, 200, 250, 500, 1000]) scaleSel.append(h('option', { value: m }, m === 'auto' ? 'automatisch' : '1:' + m));
  // Auswahl-Modus: ganzer Plan / Räume anklicken / Bereich aufziehen
  const modusBox = h('div', { class: 'seg' });
  const modi = [['raeume', '☐ Räume anklicken'], ['bereich', '▭ Bereich aufziehen'], ['ganz', '▣ ganzer Plan']];
  const selInfo = h('span', { class: 'imp-selinfo' }, '');
  const zoomBtns = h('div', { class: 'btns', style: 'gap:4px' },
    h('button', { class: 'btn sm', title: 'vergrößern', onclick: () => zoom(1.4) }, '+'), h('button', { class: 'btn sm', title: 'verkleinern', onclick: () => zoom(1 / 1.4) }, '−'),
    h('button', { class: 'btn sm', onclick: () => { st.z = null; draw(); } }, 'Einpassen'), h('button', { class: 'btn sm', onclick: () => { st.sel.clear(); st.rect = null; draw(); showSel(); } }, 'Auswahl leeren'));
  const setModus = (m) => { st.modus = m; chkUnder.disabled = m !== 'ganz'; if (m !== 'ganz') chkUnder.checked = false; modusBox.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.m === m)); cv.style.cursor = m === 'bereich' ? 'crosshair' : m === 'raeume' ? 'pointer' : 'grab'; draw(); showSel(); };
  for (const [m, l] of modi) modusBox.append(h('button', { 'data-m': m, onclick: (e) => { e.preventDefault(); setModus(m); } }, l));
  const cv = h('canvas', { class: 'imp-cv', style: 'width:100%;background:#fff;border-radius:8px;display:block;touch-action:none' });
  const stat = h('div', { class: 'kv', style: 'margin-top:8px' });
  const chkWalls = h('input', { type: 'checkbox', checked: true }), chkUnder = h('input', { type: 'checkbox', checked: false }), chkRooms = h('input', { type: 'checkbox', checked: true });
  body.append(info, h('div', { class: 'btns', style: 'margin:10px 0;align-items:center' }, baustBtn, fileBtn, fileName, h('label', { class: 'opt' }, 'Seite ', pageSel), h('label', { class: 'opt' }, 'Ziel ', tgt), h('label', { class: 'opt' }, 'Maßstab ', scaleSel),
    h('button', { class: 'btn sm', onclick: () => { st.calib = []; app.toast('Kalibrieren: Anfang und Ende einer bekannten Strecke im Plan anklicken'); } }, 'Mit 2 Punkten kalibrieren')),
    h('div', { class: 'btns imp-leiste', style: 'margin:0 0 8px;align-items:center' }, h('b', { style: 'font-size:12.5px' }, 'Übernehmen:'), modusBox, selInfo, h('span', { style: 'flex:1' }), zoomBtns),
    cv, stat,
    h('div', { class: 'btns', style: 'margin-top:10px' }, h('label', { class: 'opt' }, chkWalls, 'erkannte Wände/Öffnungen übernehmen'), h('label', { class: 'opt' }, chkRooms, 'Räume anlegen (Namen aus dem Plan)'), h('label', { class: 'opt', title: 'Nur bei „ganzer Plan“. Bei Räumen/Bereich wird nichts vom alten Plan übernommen – nur die neu konstruierten Wände, Türen, Fenster und Räume.' }, chkUnder, 'ganzen Plan als Unterlage hinterlegen (nur bei „ganzer Plan“)')));
  let view = { s: 1, ox: 0, oy: 0 };
  // Koordinaten: Bild-Pixel ↔ Plan-mm (x = px/pxPerPt*k, y = −py/pxPerPt*k)
  const pxToMM = (ix, iy) => ({ x: ix / st.pxPerPt * st.k, y: -iy / st.pxPerPt * st.k });
  const mmToPx = (p) => ({ x: p.x / st.k * st.pxPerPt, y: -p.y / st.k * st.pxPerPt });
  const toScr = (ix, iy) => ({ x: view.ox + ix * view.s, y: view.oy + iy * view.s });
  const toImgPx = (sx, sy) => ({ x: (sx - view.ox) / view.s, y: (sy - view.oy) / view.s });
  function zoom(f, cx, cy) { const r = cv.getBoundingClientRect(); cx = cx ?? r.width / 2; cy = cy ?? r.height / 2; const z = st.z || { ...view }; const ns = Math.max(0.02, Math.min(40, z.s * f)); st.z = { s: ns, ox: cx - (cx - z.ox) * ns / z.s, oy: cy - (cy - z.oy) * ns / z.s }; draw(); }
  // Räume aus den erkannten Wänden (Löcher der Wandvereinigung)
  const raeumeBerechnen = () => {
    const A = st.analysis; if (!A || !A.walls.length) { if (A) A.rooms = []; return; }
    try {
      const wg = W.wallGeometry(A.walls.map((w, i) => ({ id: 'iw' + i, a: w.a, b: w.b, thickness: w.thickness })));
      const body = G.unionTree([...wg.values()].map(g => G.ensureCCW(g.poly)));
      A.rooms = body.flatMap(it => it.holes).map(p => G.ensureCCW(G.cleanPoly(p))).filter(p => G.polyArea(p) > 0.4e6).map(poly => {
        const inside = (A.texts || []).map(t => ({ ...t, p: { x: t.x * st.k, y: -t.y * st.k } })).filter(t => G.pointInPoly(t.p, poly));
        const nameT = inside.filter(t => /[A-Za-zÄÖÜäöüß]{3,}/.test(t.str) && !/m²|m2|qm|BRH|OKFF|RH|LH/i.test(t.str)).sort((a, b) => b.size - a.size)[0];
        const nrT = inside.find(t => /^[A-Z]{0,2}\d{1,2}\.\d{2,3}$|^[A-Z]{1,2}[ .-]?\d{1,3}$/.test(t.str) && t !== nameT);
        return { poly, name: nameT ? nameT.str : '', nr: nrT ? nrT.str : '', area: G.polyArea(poly) };
      });
    } catch (e) { console.error(e); A.rooms = []; }
  };
  const draw = () => {
    const r = cv.getBoundingClientRect(); const d = window.devicePixelRatio || 1; cv.width = r.width * d; cv.height = r.height * d; const c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = '#f4f4f2'; c.fillRect(0, 0, r.width, r.height);
    if (!st.img) { c.fillStyle = '#666'; c.font = '14px Inter'; c.fillText('Noch keine Datei gewählt.', 20, 30); return; }
    const s0 = Math.min(r.width / st.imgW, r.height / st.imgH); view = st.z || { s: s0, ox: (r.width - st.imgW * s0) / 2, oy: (r.height - st.imgH * s0) / 2 };
    c.drawImage(st.img, view.ox, view.oy, st.imgW * view.s, st.imgH * view.s); st.view = view;
    const A = st.analysis;
    const path = (pts) => { c.beginPath(); pts.forEach((p, i) => { const q = mmToPx(p); const S = toScr(q.x, q.y); i ? c.lineTo(S.x, S.y) : c.moveTo(S.x, S.y); }); c.closePath(); };
    let region = st.k ? regionPolys() : null; if (region && st.modus === 'raeume') region = region.map(rp => G.offsetPolys([rp], 250)[0] || rp);
    if (A && st.k && chkWalls.checked) {
      for (const w of A.walls) {
        const n = G.perp(G.norm(G.sub(w.b, w.a))); const t = w.thickness / 2;
        const inReg = !region || region.some(rp => G.clipLines([[w.a, w.b]], [rp], true).length);
        path([G.add(w.a, G.mul(n, t)), G.add(w.b, G.mul(n, t)), G.sub(w.b, G.mul(n, t)), G.sub(w.a, G.mul(n, t))]);
        c.fillStyle = inReg ? 'rgba(37,99,235,.35)' : 'rgba(120,130,140,.12)'; c.fill(); c.lineWidth = 1.5; c.strokeStyle = inReg ? '#1d4ed8' : 'rgba(120,130,140,.35)'; c.stroke();
        const u = G.norm(G.sub(w.b, w.a));
        if (inReg) for (const o of w.ops) { const p0 = toScr(...Object.values(mmToPx(G.add(w.a, G.mul(u, o.s0))))), p1 = toScr(...Object.values(mmToPx(G.add(w.a, G.mul(u, o.s1))))); c.strokeStyle = o.kind === 'door' ? '#dc2626' : o.kind === 'window' ? '#16a34a' : '#a855f7'; c.lineWidth = 5; c.beginPath(); c.moveTo(p0.x, p0.y); c.lineTo(p1.x, p1.y); c.stroke(); }
      }
      if (st.modus === 'raeume' && A.rooms) A.rooms.forEach((rm, i) => {
        const on = st.sel.has(i), hov = st.hover === i; if (!on && !hov) return;
        path(rm.poly); c.fillStyle = on ? 'rgba(234,88,12,.32)' : 'rgba(234,88,12,.12)'; c.fill(); c.lineWidth = on ? 3 : 2; c.strokeStyle = '#ea580c'; c.stroke();
        const cc = mmToPx(G.polyCentroid(rm.poly)); const S = toScr(cc.x, cc.y); c.font = '600 13px Inter, Arial'; c.textAlign = 'center'; c.fillStyle = '#7c2d12';
        c.fillText(`${rm.nr ? rm.nr + ' ' : ''}${rm.name || 'Raum'} · ${(rm.area / 1e6).toFixed(2).replace('.', ',')} m²`, S.x, S.y); c.textAlign = 'left';
      });
    }
    if (st.rect) { const a = toScr(st.rect.x0, st.rect.y0), b = toScr(st.rect.x1, st.rect.y1); c.fillStyle = 'rgba(234,88,12,.10)'; c.fillRect(a.x, a.y, b.x - a.x, b.y - a.y); c.setLineDash([6, 4]); c.strokeStyle = '#ea580c'; c.lineWidth = 2; c.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y); c.setLineDash([]); }
    if (st.calib && st.calib.length) { c.fillStyle = '#dc2626'; for (const p of st.calib) { const S = toScr(p.x, p.y); c.beginPath(); c.arc(S.x, S.y, 5, 0, 7); c.fill(); } }
    if (st.modus === 'raeume' && A && st.k && !(A.rooms || []).length) { c.fillStyle = 'rgba(17,24,39,.8)'; c.fillRect(10, 10, 430, 30); c.fillStyle = '#fff'; c.font = '13px Inter, Arial'; c.fillText('Keine geschlossenen Räume erkannt – „Bereich aufziehen“ nutzen.', 20, 30); }
  };
  /** Übernahme-Bereich in Plan-mm (null = ganzer Plan) */
  function regionPolys() {
    const A = st.analysis;
    if (st.modus === 'raeume' && A && A.rooms && st.sel.size) return [...st.sel].map(i => A.rooms[i]).filter(Boolean).map(r => r.poly);
    if (st.modus === 'bereich' && st.rect) { const a = pxToMM(Math.min(st.rect.x0, st.rect.x1), Math.min(st.rect.y0, st.rect.y1)), b = pxToMM(Math.max(st.rect.x0, st.rect.x1), Math.max(st.rect.y0, st.rect.y1)); return [[{ x: a.x, y: b.y }, { x: b.x, y: b.y }, { x: b.x, y: a.y }, { x: a.x, y: a.y }]]; }
    return null;
  }
  const showSel = () => {
    const A = st.analysis;
    if (st.modus === 'ganz') selInfo.textContent = 'der komplette Plan wird übernommen';
    else if (st.modus === 'raeume') { const l = [...st.sel].map(i => A && A.rooms && A.rooms[i]).filter(Boolean); selInfo.textContent = l.length ? `${l.length} Raum/Räume gewählt: ${l.map(r => (r.nr ? r.nr + ' ' : '') + (r.name || 'Raum')).join(', ')} – ${(l.reduce((a, r) => a + r.area, 0) / 1e6).toFixed(2).replace('.', ',')} m²` : 'Räume im Plan anklicken (nochmal klicken = abwählen) · Mausrad zoomt, Ziehen verschiebt'; }
    else selInfo.textContent = st.rect ? 'Bereich gewählt – Übernehmen oder neu aufziehen' : 'Mit der Maus ein Rechteck um den gewünschten Bereich ziehen · Mausrad zoomt, rechte Maustaste verschiebt';
  };
  const showStats = () => {
    stat.innerHTML = ''; const A = st.analysis; const add = (k, v, cls) => stat.append(h('span', {}, k), h('b', {}, cls ? h('span', { class: 'pill ' + cls }, v) : v));
    if (!st.page && st.img) { add('Art', 'Bild/Scan – keine Vektoren'); add('Maßstab', st.k ? `kalibriert (${(st.k).toFixed(3)} mm je Bildpunkt)` : 'bitte kalibrieren', st.k ? 'ok' : 'warn'); return; }
    if (!A) return;
    add('Maßstab', `1:${st.scale}${A.scaleSource ? ' (' + A.scaleSource + ')' : ''}`, 'ok');
    add('Maßzahlen geprüft', `${A.check.hits} von ${A.check.of} Maßen passen exakt zu Linien`, A.check.of && A.check.hits / A.check.of > 0.4 ? 'ok' : 'warn');
    add('Wände erkannt', String(A.walls.length)); add('Räume erkannt', String((A.rooms || []).length)); add('Öffnungen', `${A.walls.reduce((s, w) => s + w.ops.filter(o => o.kind === 'door').length, 0)} Türen · ${A.walls.reduce((s, w) => s + w.ops.filter(o => o.kind === 'window').length, 0)} Fenster · ${A.walls.reduce((s, w) => s + w.ops.filter(o => o.kind === 'opening').length, 0)} Durchgänge`);
    add('Wandstärken', [...new Set(A.walls.map(w => w.thickness))].sort((a, b) => a - b).map(t => G.fmtCm(t)).join(' / ') + ' cm');
    if (!A.walls.length) stat.append(h('div', { class: 'note warn', style: 'grid-column:1/3' }, 'Keine Wände erkannt. Vermutlich ein gescannter Plan oder Wände als Füllflächen. Tipp: Bereich aufziehen, als Unterlage übernehmen und mit „Raum aus Wänden“ nachzeichnen – oder „KI: Plan lesen“ nutzen.'));
  };
  const analyse = async () => {
    if (!st.page) return; const P = pdfjs();
    const vp = st.page.getViewport({ scale: 1 });
    const ol = await st.page.getOperatorList(); const tc = await st.page.getTextContent();
    const paths = V.extractPaths(ol, P.OPS, vp.transform); const texts = V.textItems(tc, vp.transform);
    const linesPt = V.mergeCollinear(paths.segs); const nums = V.dimNumbers(texts); const tScale = V.detectScaleText(texts);
    let scale, src;
    if (scaleSel.value !== 'auto') { scale = +scaleSel.value; src = 'manuell'; }
    else if (st.calibK) { scale = null; src = 'kalibriert'; }
    else { const bs = V.bestScale(linesPt, nums, tScale); if (tScale && (!bs || bs.sc === tScale || bs.hits <= 1)) { scale = tScale; src = 'aus Plantext'; } else if (bs && bs.hits > 1) { scale = bs.sc; src = tScale ? `Maßzahlen statt Text 1:${tScale}` : 'aus Maßzahlen ermittelt'; } else { scale = 50; src = 'Annahme – bitte prüfen'; } }
    st.k = st.calibK || MMPT * scale; st.scale = scale || Math.round(st.k / MMPT);
    const mm = V.toMM(paths, st.k); const lines = V.mergeCollinear(mm.segs);
    const res = V.detectWalls(lines, mm.curves);
    st.analysis = { ...res, texts, lines, scaleSource: src, check: V.scoreScale(linesPt, nums, st.k) };
    raeumeBerechnen(); st.sel.clear(); showStats(); showSel(); draw();
  };
  const loadPage = async () => {
    st.page = await st.pdf.getPage(st.pageNo); const vp1 = st.page.getViewport({ scale: 1 });
    const scale = Math.min(4, 4000 / Math.max(vp1.width, vp1.height)); const vp = st.page.getViewport({ scale });
    const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height; const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await st.page.render({ canvasContext: ctx, viewport: vp }).promise;
    st.img = c; st.imgW = c.width; st.imgH = c.height; st.pxPerPt = scale; st.pageW = vp1.width; st.pageH = vp1.height; st.z = null; st.rect = null;
    await analyse();
  };
  const loadFile = async (f, page = 1) => {
    st.file = f; st.calibK = null; st.page = null; st.analysis = null; st.sel.clear(); st.rect = null; st.z = null; fileName.textContent = f.name;
    if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
      try { st.pdf = await pdfjs().getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise; } catch (e) { app.toast('PDF konnte nicht gelesen werden: ' + e.message, true); return; }
      pageSel.innerHTML = ''; for (let i = 1; i <= st.pdf.numPages; i++) pageSel.append(h('option', { value: i }, `${i} / ${st.pdf.numPages}`));
      st.pageNo = Math.min(Math.max(1, page || 1), st.pdf.numPages); pageSel.value = st.pageNo; await loadPage();
    } else {
      const img = new Image(); img.src = URL.createObjectURL(f); await img.decode(); st.img = img; st.imgW = img.naturalWidth; st.imgH = img.naturalHeight; st.k = null; st.pxPerPt = 1; if (st.modus === 'raeume') setModus('bereich'); showStats(); showSel(); draw();
    }
  };
  fileBtn.onclick = async () => { const f = await app.pickFile('application/pdf,image/*'); if (f) loadFile(f); };
  baustBtn.onclick = async () => {
    if (FREI) return fileBtn.onclick();
    const M = await import('./planwahl.js?v=20261028-0429');
    M.openPlanwahl(app, { titel: 'Plan aus der Baustelle', onWahl: (f, page, datei, b) => { app.linkBaustelle && app.linkBaustelle(b); loadFile(f, page); }, onEigeneDatei: () => fileBtn.onclick() });
  };
  pageSel.onchange = async () => { st.pageNo = +pageSel.value; await loadPage(); };
  scaleSel.onchange = () => { st.calibK = null; analyse(); };
  chkWalls.onchange = draw;
  // Maus: Zoom, Verschieben, Räume anklicken, Bereich aufziehen, Kalibrieren
  cv.addEventListener('wheel', (e) => { if (!st.img) return; e.preventDefault(); const r = cv.getBoundingClientRect(); zoom(Math.pow(1.0015, -e.deltaY), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
  cv.addEventListener('contextmenu', (e) => e.preventDefault());
  let drag = null;
  cv.addEventListener('pointerdown', async (e) => {
    if (!st.img) return; const r = cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top; const p = toImgPx(sx, sy);
    cv.setPointerCapture(e.pointerId);
    if (st.calib) {
      st.calib.push(p); draw();
      if (st.calib.length === 2) {
        const res = await app.prompt('Bekanntes Maß', [{ key: 'l', label: 'Länge der Strecke (z. B. 3,51 m oder 351 cm)', value: '' }]);
        const L = res ? G.parseLen(res.l, /m$/.test(res.l.trim()) || /,/.test(res.l) ? 'm' : 'cm') : NaN; const pxLen = G.dist(st.calib[0], st.calib[1]); st.calib = null;
        if (!isFinite(L) || pxLen < 2) { draw(); return; }
        const ptLen = pxLen / (st.pxPerPt || 1); st.calibK = L / ptLen; app.toast(`Kalibriert: ${G.fmtCm(L)} cm`);
        if (st.page) analyse(); else { st.k = st.calibK; showStats(); draw(); }
      }
      return;
    }
    const pan = e.button === 1 || e.button === 2 || st.modus === 'ganz';
    drag = { sx, sy, p, pan, moved: false, z0: { ...view } };
    if (!pan && st.modus === 'bereich') st.rect = { x0: p.x, y0: p.y, x1: p.x, y1: p.y };
  });
  cv.addEventListener('pointermove', (e) => {
    if (!st.img) return; const r = cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
    if (!drag) { // Raum unter der Maus hervorheben
      if (st.modus === 'raeume' && st.analysis && st.analysis.rooms && st.k) { const q = toImgPx(sx, sy); const mm = pxToMM(q.x, q.y); let best = -1, ba = Infinity; st.analysis.rooms.forEach((rm, i) => { if (rm.area < ba && G.pointInPoly(mm, rm.poly)) { ba = rm.area; best = i; } }); if (best !== st.hover) { st.hover = best; draw(); } }
      return;
    }
    if (Math.hypot(sx - drag.sx, sy - drag.sy) > 4) drag.moved = true;
    if (drag.pan || (st.modus === 'raeume' && drag.moved)) { st.z = { s: drag.z0.s, ox: drag.z0.ox + sx - drag.sx, oy: drag.z0.oy + sy - drag.sy }; draw(); return; }
    if (st.modus === 'bereich' && st.rect) { const q = toImgPx(sx, sy); st.rect.x1 = q.x; st.rect.y1 = q.y; draw(); }
  });
  cv.addEventListener('pointerup', (e) => {
    const d = drag; drag = null; if (!d || !st.img) return;
    if (st.modus === 'raeume' && !d.moved && !d.pan && st.analysis && st.analysis.rooms && st.k) {
      const mm = pxToMM(d.p.x, d.p.y); let best = -1, ba = Infinity;
      st.analysis.rooms.forEach((rm, i) => { if (rm.area < ba && G.pointInPoly(mm, rm.poly)) { ba = rm.area; best = i; } });
      if (best >= 0) { if (st.sel.has(best)) st.sel.delete(best); else st.sel.add(best); } else app.toast('Dort ist kein geschlossener Raum erkannt – „Bereich aufziehen“ nutzen.', true);
      showSel(); draw();
    }
    if (st.modus === 'bereich' && st.rect && !d.pan) { if (Math.abs(st.rect.x1 - st.rect.x0) * view.s < 8 || Math.abs(st.rect.y1 - st.rect.y0) * view.s < 8) st.rect = null; showSel(); draw(); }
  });
  /** Wände auf den Bereich zuschneiden: je Wand die Achsabschnitte im Bereich (Räume: Raum + eigene halbe Wandstärke) */
  const teile = (A, region) => {
    if (!region) return A.walls.map(w => ({ w, a: w.a, b: w.b, s0: 0 }));
    const out = [];
    for (const w of A.walls) {
      const L = G.dist(w.a, w.b); if (L < 1) continue; const u = G.norm(G.sub(w.b, w.a)); const iv = [];
      const regs = st.modus === 'raeume' ? region.map(rp => G.offsetPolys([rp], w.thickness / 2 + 15)[0]).filter(Boolean) : region;
      for (const rp of regs) for (const l of G.clipLines([[w.a, w.b]], [rp], true)) { const ts = l.map(p => G.dot(G.sub(p, w.a), u)); iv.push([Math.max(0, Math.min(...ts)), Math.min(L, Math.max(...ts))]); }
      iv.sort((x, y) => x[0] - y[0]); const m = [];
      for (const v of iv) { if (m.length && v[0] <= m[m.length - 1][1] + 5) m[m.length - 1][1] = Math.max(m[m.length - 1][1], v[1]); else m.push([...v]); }
      for (const [s0, s1] of m) { if (s1 - s0 < Math.max(300, w.thickness * 1.2)) continue; out.push({ w, a: G.add(w.a, G.mul(u, s0)), b: G.add(w.a, G.mul(u, s1)), s0, s1 }); }
    }
    return out;
  };
  const apply = () => {
    if (!st.img || !st.k) { app.toast('Erst Datei laden und Maßstab festlegen', true); return; }
    if (st.modus === 'raeume' && !st.sel.size) { app.toast('Bitte zuerst Räume im Plan anklicken – oder oben „ganzer Plan“ wählen.', true); return; }
    if (st.modus === 'bereich' && !st.rect) { app.toast('Bitte zuerst einen Bereich aufziehen – oder oben „ganzer Plan“ wählen.', true); return; }
    const doc = app.doc; const A = st.analysis; const target = st.target; const region = regionPolys();
    // gleiche Verschiebung wie beim ganzen Plan → mehrere Räume aus demselben Plan passen zusammen
    let shift = { x: 0, y: 0 };
    if (A && A.walls.length) { const bb = G.bbox(A.walls.flatMap(w => [w.a, w.b])); shift = { x: -Math.round(bb.x0 / 10) * 10, y: -Math.round(bb.y0 / 10) * 10 }; }
    else if (region) { const bb = G.bbox(region.flat()); shift = { x: -Math.round(bb.x0 / 10) * 10, y: -Math.round(bb.y0 / 10) * 10 }; }
    const pageWmm = (st.page ? st.pageW : st.imgW) * st.k, pageHmm = (st.page ? st.pageH : st.imgH) * st.k;
    const stuecke = A && chkWalls.checked && target !== 'site' ? teile(A, region) : [];
    const vorher = new Set(doc.all('room', target === 'site' ? undefined : target).map(r => r.id));
    doc.change(region ? 'Räume aus Plan übernommen' : 'Plan übernommen', () => {
      // 25.10.2026 (Thomas): bei Räumen/Bereich NICHTS vom alten Plan zeigen – nur neu konstruierte Bauteile
      if (chkUnder.checked && !region) {
        // Unterlage: nur beim ganzen Plan
        let x0 = 0, y0 = 0, x1 = st.imgW, y1 = st.imgH;
        if (region) { const bb = G.bbox(region.flat()); const m = 1000; const a = mmToPx({ x: bb.x0 - m, y: bb.y1 + m }), b = mmToPx({ x: bb.x1 + m, y: bb.y0 - m }); x0 = Math.max(0, a.x); y0 = Math.max(0, a.y); x1 = Math.min(st.imgW, b.x); y1 = Math.min(st.imgH, b.y); }
        const cw = x1 - x0, ch = y1 - y0; const sc = Math.min(1, 3000 / Math.max(cw, ch));
        const c = document.createElement('canvas'); c.width = Math.max(1, cw * sc); c.height = Math.max(1, ch * sc); c.getContext('2d').drawImage(st.img, x0, y0, cw, ch, 0, 0, c.width, c.height);
        const src = c.toDataURL('image/jpeg', 0.82); const img = new Image(); img.src = src;
        const tl = pxToMM(x0, y0), br = pxToMM(x1, y1);
        const inBB = (p) => p.x >= tl.x && p.x <= br.x && p.y <= tl.y && p.y >= br.y;
        const snapLines = A ? A.lines.filter(l => l.len > 150 && (!region || inBB(l.pa) || inBB(l.pb))).slice(0, 4000).map(l => [G.add(l.pa, shift), G.add(l.pb, shift)]) : null;
        const nm = st.file.name + (st.page ? ` S. ${st.pageNo}` : '') + (region ? ' (Ausschnitt)' : '');
        doc.p.underlays.push({ id: uid('u'), name: nm, storey: target, src, img, x: tl.x + shift.x, y: br.y + shift.y, w: br.x - tl.x, h: tl.y - br.y, opacity: 0.45, visible: true, snapLines });
        void pageWmm; void pageHmm;
      }
      // vorhandene Wände (z. B. vom Nachbarraum aus demselben Plan) nicht doppelt anlegen
      const alt = doc.all('wall', target);
      for (const sw of stuecke) {
        const w = sw.w; const A0 = G.add(sw.a, shift), B0 = G.add(sw.b, shift); const L = G.dist(A0, B0); const u = G.norm(G.sub(B0, A0));
        const belegt = [];
        for (const e of alt) {
          const ue = G.norm(G.sub(e.b, e.a)); if (Math.abs(G.cross(u, ue)) > 0.02 || Math.abs(e.thickness - w.thickness) > 30) continue;
          if (Math.abs(G.cross(u, G.sub(e.a, A0))) > 15) continue;
          const t0 = G.dot(G.sub(e.a, A0), u), t1 = G.dot(G.sub(e.b, A0), u); const lo = Math.max(0, Math.min(t0, t1)), hi = Math.min(L, Math.max(t0, t1)); if (hi - lo > 1) belegt.push([lo, hi]);
        }
        belegt.sort((x, y) => x[0] - y[0]); const frei = []; let c0 = 0;
        for (const [lo, hi] of belegt) { if (lo > c0 + 1) frei.push([c0, lo]); c0 = Math.max(c0, hi); } if (L > c0 + 1) frei.push([c0, L]);
        for (const [f0, f1] of frei) {
          if (f1 - f0 < Math.max(300, w.thickness * 1.2) && belegt.length) continue;
          const wall = doc.add({ type: 'wall', storey: target, a: G.add(A0, G.mul(u, f0)), b: G.add(A0, G.mul(u, f1)), thickness: w.thickness, height: null, art: w.thickness >= 240 ? 'aussen' : 'innen', material: 'mauerwerk', facade: w.thickness >= 240 ? 'putz-scheibenputz' : null, quelle: 'plan' });
          for (const o of w.ops) { const m0 = o.s0 - sw.s0, m1 = o.s1 - sw.s0; if (m0 < f0 - 1 || m1 > f1 + 1) continue; doc.add({ type: 'opening', storey: target, wall: wall.id, kind: o.kind, pos: (m0 + m1) / 2 - f0, width: Math.round(o.width), height: o.kind === 'window' ? 1385 : 2130, sill: o.kind === 'window' ? 875 : 0, side: 1, hinge: 'links' }); }
        }
      }
    });
    if (stuecke.length) {
      const geo = W.storeyGeometry(doc, target);
      doc.change('Außenwände bestimmt', () => { for (const g of geo.wg.values()) { if (g.w.quelle !== 'plan') continue; const os = W.outsideSide(geo, g); g.w.art = os ? 'aussen' : 'innen'; if (os && !g.w.facade) g.w.facade = 'putz-scheibenputz'; for (const oi of geo.openings.filter(x => x.g === g)) if (os === 'L' || os === 'R') oi.o.aussen = os; } });
      if (chkRooms.checked) {
        const geo2 = W.storeyGeometry(doc, target); let n = doc.all('room', target).length;
        const shiftedRegion = region ? region.map(rp => rp.map(p => G.add(p, shift))) : null;
        const vorhandene = doc.all('room', target).filter(r => r.poly);
        doc.change('Räume aus Plan', () => {
          for (const poly of geo2.rooms) {
            const cen = G.polyCentroid(poly); const s2 = G.pointInPoly(cen, poly) ? cen : poly[0];
            if (vorhandene.some(r => G.pointInPoly(s2, r.poly))) continue; // gibt es schon
            if (shiftedRegion && !shiftedRegion.some(rp => G.pointInPoly(s2, rp))) continue; // nur gewählte Räume / Bereich
            const inside = (A.texts || []).map(t => ({ ...t, p: { x: t.x * st.k + shift.x, y: -t.y * st.k + shift.y } })).filter(t => G.pointInPoly(t.p, poly));
            const nameT = inside.filter(t => /[A-Za-zÄÖÜäöüß]{3,}/.test(t.str) && !/m²|m2|qm|BRH|OKFF|RH|LH/i.test(t.str)).sort((a, b) => b.size - a.size)[0];
            const nrT = inside.find(t => /^[A-Z]{0,2}\d{1,2}\.\d{2,3}$|^[A-Z]{1,2}[ .-]?\d{1,3}$/.test(t.str) && t !== nameT);
            doc.add({ type: 'room', storey: target, seed: s2, poly, name: nameT ? nameT.str : 'Raum', nr: nrT ? nrT.str : String(++n).padStart(2, '0'), showDims: false, tiles: null });
          }
        });
      }
    }
    void vorher;
    if (target !== 'site' && target !== doc.p.activeStorey) { doc.p.activeStorey = target; doc.emit('storey'); }
    close(); if (target === 'site') app.setMode('lageplan'); app.zoomFit();
    const nR = st.modus === 'raeume' ? st.sel.size : 0;
    app.toast(stuecke.length ? (nR ? `${nR} Raum/Räume mit ${stuecke.length} Wänden aus den Planmaßen nachgebaut – weitere Räume aus demselben Plan passen genau daneben.` : `${stuecke.length} Wände aus den Planmaßen übernommen – bitte stichprobenartig nachmessen (Messen-Werkzeug).`) : 'Plan als Unterlage hinterlegt – jetzt nachzeichnen (Fang auf Planlinien aktiv).');
  };
  const close = app.modal('Plan übernehmen – ganz oder einzelne Räume', body, [
    FREI ? null : h('button', { class: 'btn', onclick: async () => { if (!st.img) return app.toast('Erst eine Datei wählen', true); const M = await import('./ai.js?v=20261028-0429'); M.readPlanAI(app, st); }, html: icon('ki') + 'KI: Plan lesen (Räume & Maße)' }),
    h('button', { class: 'btn', onclick: () => close() }, 'Abbrechen'), h('button', { class: 'btn pri', onclick: apply }, 'Übernehmen')]);
  const box = document.getElementById('modalBox'); box.classList.add('wide');
  const closeOrig = close; const mo = document.getElementById('modal'); const obs = new MutationObserver(() => { if (mo.classList.contains('hidden')) { box.classList.remove('wide'); obs.disconnect(); } }); obs.observe(mo, { attributes: true, attributeFilter: ['class'] }); void closeOrig;
  setModus('raeume');
  setTimeout(draw, 50);
  if (preset.file) loadFile(preset.file, preset.page); else if (preset.pick) fileBtn.onclick(); else if (preset.baustelle) baustBtn.onclick();
}
