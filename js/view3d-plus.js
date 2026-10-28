// TW-CAD – 3D-Erweiterungen: 3D-Schnitt/Puppenhaus, Kameras & Rundgang-Video, Export OBJ/glTF/IFC, Sonnenstudie
import * as THREE from 'three';
import * as G from './geom.js?v=20261028-0429';
import * as S from './sonne.js?v=20261028-0429';
import { icon } from './icons.js?v=20261028-0429';
import { FREI, WERBUNG } from './frei.js?v=20261028-0429';
import { pdfVorbereiten } from './i18n.js?v=20261028-0429';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
const M = 0.001;
const row = (l, el) => h('div', { class: 'row' }, h('label', {}, l), el);
const heute = () => new Date().toISOString().slice(0, 10);

/* ───────── Sonne ───────── */
export function ort(doc) { const s = doc.p.site || {}; return { lat: s.lat ?? S.ORT_STANDARD.lat, lon: s.lon ?? S.ORT_STANDARD.lon, name: s.ortName || (s.lat == null ? S.ORT_STANDARD.name : 'eigener Ort'), nord: s.nord || 0 }; }
/** Sonnenrichtung (three-Koordinaten, normiert) + Kennwerte */
export function sonne(v) {
  const o = ort(v.app.doc); const datum = v.opt.datum || heute(); const p = S.sonneOrtszeit(datum, v.opt.stunde, o.lat, o.lon);
  const d = S.sonnenVektor(p.az, Math.max(p.el, -5), o.nord); return { ...p, dir: new THREE.Vector3(d.x, d.z, -d.y).normalize(), datum, ort: o };
}
export function setSun(v) {
  const s = sonne(v); const c = v.sun.target.position; const R = 120;
  v.sun.position.set(c.x + s.dir.x * R, c.y + s.dir.y * R, c.z + s.dir.z * R);
  const tag = Math.max(0, Math.min(1, (s.el + 2) / 10));
  v.sun.intensity = 2.4 * tag; v.hemi.intensity = 0.35 + 1.15 * Math.max(0.15, tag);
  const warm = Math.max(0, Math.min(1, (s.el - 2) / 20)); v.sun.color.setRGB(1, 0.78 + 0.2 * warm, 0.6 + 0.3 * warm);
  const himmel = new THREE.Color('#cfe1f1').lerp(new THREE.Color('#1c2433'), 1 - Math.max(0.12, tag)); v.scene.background = himmel; if (v.scene.fog) v.scene.fog.color = himmel;
  v._sonne = s; if (v._sonnenInfo) v._sonnenInfo.textContent = sonnenText(s);
}
const sonnenText = (s) => s.el < -0.833 ? `Sonne unter dem Horizont (${S.richtung(s.az)})` : `Sonne ${s.el.toFixed(0)}° hoch aus ${S.richtung(s.az)} (Azimut ${s.az.toFixed(0)}°)`;

export function sonnenPanel(v, body) {
  const doc = v.app.doc; const o = ort(doc); v.opt.datum = v.opt.datum || heute();
  const tb = S.tagesbogen(v.opt.datum, o.lat, o.lon);
  const dat = h('input', { type: 'date', value: v.opt.datum }); dat.onchange = () => { v.opt.datum = dat.value || heute(); setSun(v); v.app.renderSide(); };
  const uhr = h('input', { type: 'range', min: 4, max: 22, step: 0.25, value: v.opt.stunde }); const uz = h('b', {}, S.uhrzeit(v.opt.stunde));
  uhr.oninput = () => { v.opt.stunde = +uhr.value; uz.textContent = S.uhrzeit(v.opt.stunde); setSun(v); };
  const ortSel = h('select', {}); ortSel.append(h('option', { value: '' }, o.name + ` (${o.lat.toFixed(3)}° N, ${o.lon.toFixed(3)}° O)`)); for (const [n, la, lo] of S.ORTE) ortSel.append(h('option', { value: `${la}|${lo}|${n}` }, n)); ortSel.append(h('option', { value: 'eigen' }, 'Koordinaten eingeben …'));
  ortSel.onchange = async () => { let la, lo, n; if (ortSel.value === 'eigen') { const r = await v.app.prompt('Standort (Grad, z. B. aus Google Maps)', [{ key: 'la', label: 'Breite (N)', value: String(o.lat) }, { key: 'lo', label: 'Länge (O)', value: String(o.lon) }]); if (!r) { v.app.renderSide(); return; } la = parseFloat(String(r.la).replace(',', '.')); lo = parseFloat(String(r.lo).replace(',', '.')); n = 'eigener Ort'; } else if (ortSel.value) [la, lo, n] = ortSel.value.split('|'); else return; doc.change('Standort', () => { doc.p.site.lat = +la; doc.p.site.lon = +lo; doc.p.site.ortName = n; }); setSun(v); v.app.renderSide(); };
  const tage = h('div', { class: 'btns' }, ...[['21.03.', '03-20', 'Frühlingsanfang'], ['21.06.', '06-21', 'Sommeranfang – längster Tag'], ['23.09.', '09-23', 'Herbstanfang'], ['21.12.', '12-21', 'Winteranfang – kürzester Tag'], ['heute', null, '']].map(([l, md, t]) => h('button', { class: 'chip' + ((md ? v.opt.datum.slice(5) === md : v.opt.datum === heute()) ? ' on' : ''), title: t, onclick: () => { v.opt.datum = md ? `${new Date().getFullYear()}-${md}` : heute(); setSun(v); v.app.renderSide(); } }, l)));
  const info = h('div', { class: 'muted', style: 'margin:4px 0' }); v._sonnenInfo = info; info.textContent = sonnenText(sonne(v));
  const play = h('button', { class: 'btn sm', html: icon('sun') + (v._tagAnim ? 'Stopp' : 'Tagesverlauf abspielen') }); play.onclick = () => { if (v._tagAnim) { cancelAnimationFrame(v._tagAnim); v._tagAnim = null; v.app.renderSide(); return; } const a = tb.auf ?? 6, b = tb.unter ?? 20; v.opt.stunde = a; const t0 = performance.now(); const step = () => { const t = (performance.now() - t0) / 12000; v.opt.stunde = a + (b - a) * Math.min(1, t); uhr.value = v.opt.stunde; uz.textContent = S.uhrzeit(v.opt.stunde); setSun(v); if (t < 1) v._tagAnim = requestAnimationFrame(step); else { v._tagAnim = null; v.app.renderSide(); } }; v._tagAnim = requestAnimationFrame(step); v.app.renderSide(); };
  body.append(h('div', { class: 'sec' }, h('h4', {}, 'Sonnenstudie'),
    row('Ort', ortSel), row('Datum', dat), tage, row(h('span', {}, 'Uhrzeit ', uz), uhr), info,
    h('div', { class: 'muted' }, `Aufgang ${S.uhrzeit(tb.auf)} · Mittag ${S.uhrzeit(tb.mittag)} (${tb.maxEl.toFixed(0)}°) · Untergang ${S.uhrzeit(tb.unter)} Uhr${S.sommerzeit(v.opt.datum) ? ' (Sommerzeit)' : ''}`),
    h('div', { class: 'btns', style: 'margin-top:6px' }, play, h('button', { class: 'btn sm', onclick: () => verschattungsPdf(v), html: icon('pdf') + 'Verschattungsstudie (PDF)' })),
    h('div', { class: 'muted' }, 'Nordrichtung kommt aus dem Lageplan (Nordpfeil).')));
}
/** Verschattungsstudie: 3 Stichtage × 3 Uhrzeiten als Draufsicht auf A3 */
export async function verschattungsPdf(v) {
  await pdfVorbereiten();
  const { jsPDF } = window.jspdf; v.app.toast('Verschattungsstudie wird gerechnet …');
  const alt = { datum: v.opt.datum, stunde: v.opt.stunde }; const y = new Date().getFullYear(); const o = ort(v.app.doc);
  const tage = [[`${y}-03-20`, '20. März (Tag-und-Nacht-Gleiche)'], [`${y}-06-21`, '21. Juni (Sommeranfang)'], [`${y}-12-21`, '21. Dezember (Winteranfang)']]; const zeiten = [9, 12, 15];
  const pdf = new jsPDF({ unit: 'mm', format: 'a3', orientation: 'landscape', compress: true });
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(16); pdf.text('Verschattungsstudie', 15, 16); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
  pdf.text(`${v.app.doc.p.meta.bauvorhaben || v.app.doc.p.name} · Standort ${o.name} (${o.lat.toFixed(3)}° N, ${o.lon.toFixed(3)}° O) · Draufsicht, Norden laut Lageplan · Ortszeit (MEZ/MESZ)`, 15, 22);
  const W0 = 128, H0 = 80; const imgW = 1280, imgH = 800;
  for (let i = 0; i < tage.length; i++) for (let j = 0; j < zeiten.length; j++) {
    v.opt.datum = tage[i][0]; v.opt.stunde = zeiten[j] + (S.sommerzeit(tage[i][0]) ? 1 : 0); setSun(v);
    const url = v.snapshot(imgW, imgH, 'top'); const x = 15 + j * (W0 + 5), yy = 30 + i * (H0 + klein());
    pdf.addImage(url, 'PNG', x, yy, W0, H0); const s = v._sonne; pdf.setFontSize(8.5); pdf.setTextColor(30, 30, 30);
    pdf.text(`${tage[i][1]} · ${S.uhrzeit(v.opt.stunde)} Uhr · Sonne ${s.el.toFixed(0)}° aus ${S.richtung(s.az)}`, x, yy + H0 + 4);
  }
  function klein() { return 9; }
  pdf.setFontSize(7); pdf.setTextColor(120, 120, 120); pdf.text('Erstellt mit TW-CAD · Sonnenstand nach astronomischer Näherung (ca. 0,5°), Gelände und Nachbarbebauung nur soweit im Modell erfasst.' + (FREI ? ' · ' + WERBUNG : ''), 15, 287);
  v.opt.datum = alt.datum; v.opt.stunde = alt.stunde; setSun(v); v.view('persp');
  pdf.save(`${v.app.doc.p.name || 'Projekt'} – Verschattungsstudie.pdf`); v.app.toast('Verschattungsstudie gespeichert');
}

/* ───────── 3D-Schnitt ───────── */
export function clipAnwenden(v) {
  const c = v.opt.schnitt; const r = v.renderer;
  if (!c || !c.an || !v.bb) { r.clippingPlanes = []; return; }
  const bb = v.bb; const pl = [];
  const x0 = bb.x0 + (bb.x1 - bb.x0) * c.x0, x1 = bb.x0 + (bb.x1 - bb.x0) * c.x1, y0 = bb.y0 + (bb.y1 - bb.y0) * c.y0, y1 = bb.y0 + (bb.y1 - bb.y0) * c.y1;
  if (c.x0 > 0.001) pl.push(new THREE.Plane(new THREE.Vector3(1, 0, 0), -x0 * M)); if (c.x1 < 0.999) pl.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), x1 * M));
  if (c.y0 > 0.001) pl.push(new THREE.Plane(new THREE.Vector3(0, 0, -1), -y0 * M)); if (c.y1 < 0.999) pl.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), y1 * M)); // Plan-y → three −z
  if (c.z != null) pl.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), c.z * M));
  r.clippingPlanes = pl;
}
export function schnittPanel(v, body) {
  const doc = v.app.doc; const c = v.opt.schnitt = v.opt.schnitt || { an: false, x0: 0, x1: 1, y0: 0, y1: 1, z: null };
  const upd = () => { clipAnwenden(v); };
  const zMax = Math.max(...doc.p.storeys.map(s => (s.elevation || 0) + s.height)) + 6000;
  const sl = (key, min, max, step, val, fn) => { const i = h('input', { type: 'range', min, max, step, value: val }); i.oninput = () => { fn(+i.value); upd(); }; return i; };
  const sec = h('div', { class: 'sec' }, h('h4', {}, '3D-Schnitt / Puppenhaus'));
  sec.append(h('div', { class: 'btns' }, h('button', { class: 'chip' + (c.an ? ' on' : ''), onclick: () => { c.an = !c.an; if (c.an && c.z == null) c.z = null; upd(); v.app.renderSide(); } }, c.an ? 'Schnitt an' : 'Schnitt aus'),
    ...doc.p.storeys.map(st => h('button', { class: 'chip', title: `Geschoss ${st.name} in 1,50 m Höhe aufschneiden`, onclick: () => { c.an = true; c.z = (st.elevation || 0) + 1500; v.opt.bis = doc.p.storeys.indexOf(st); v.build(); upd(); v.app.renderSide(); } }, `${st.name} aufschneiden`)),
    h('button', { class: 'chip', onclick: () => { Object.assign(c, { an: false, x0: 0, x1: 1, y0: 0, y1: 1, z: null }); v.opt.bis = null; v.build(); upd(); v.app.renderSide(); } }, 'zurücksetzen')));
  if (c.an) {
    const zl = h('b', {}, c.z == null ? 'aus' : G.fmtM(c.z) + ' m');
    sec.append(row(h('span', {}, 'Höhe ', zl), sl('z', 0, zMax, 50, c.z ?? zMax, (val) => { c.z = val >= zMax - 1 ? null : val; zl.textContent = c.z == null ? 'aus' : G.fmtM(c.z) + ' m'; })),
      row('West ↔ Ost', h('div', { class: 'dual' }, sl('x0', 0, 1, 0.01, c.x0, val => c.x0 = Math.min(val, c.x1 - 0.02)), sl('x1', 0, 1, 0.01, c.x1, val => c.x1 = Math.max(val, c.x0 + 0.02)))),
      row('Süd ↔ Nord', h('div', { class: 'dual' }, sl('y0', 0, 1, 0.01, c.y0, val => c.y0 = Math.min(val, c.y1 - 0.02)), sl('y1', 0, 1, 0.01, c.y1, val => c.y1 = Math.max(val, c.y0 + 0.02)))),
      h('div', { class: 'muted' }, 'Höhe: waagrechter Schnitt (Puppenhaus). Die Regler darunter schneiden das Haus seitlich auf – wie eine Schnittbox.'));
  }
  body.append(sec);
}

/* ───────── Kameras & Rundgang ───────── */
const camState = (v) => ({ pos: v.cam.position.toArray().map(x => +x.toFixed(3)), target: v.controls.target.toArray().map(x => +x.toFixed(3)), fov: v.cam.fov });
export function flyTo(v, k, ms = 1400) {
  return new Promise(res => {
    v.active = v.cam; const p0 = v.cam.position.clone(), t0 = v.controls.target.clone(), f0 = v.cam.fov; const p1 = new THREE.Vector3(...k.pos), t1 = new THREE.Vector3(...k.target), f1 = k.fov || 40; const s = performance.now();
    const step = () => { const t = Math.min(1, (performance.now() - s) / ms); const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
      v.cam.position.lerpVectors(p0, p1, e); v.controls.target.lerpVectors(t0, t1, e); v.cam.fov = f0 + (f1 - f0) * e; v.cam.updateProjectionMatrix(); v.controls.update(); if (t < 1) requestAnimationFrame(step); else res(); };
    requestAnimationFrame(step);
  });
}
/** Rundgang durch gespeicherte Kameras (Catmull-Rom) oder Umlauf um das Haus */
export function rundgang(v, { sekProKamera = 4, umlaufSek = 16 } = {}) {
  const ks = v.app.doc.p.kameras || []; v.active = v.cam; v.controls.enabled = false;
  return new Promise(res => {
    const s = performance.now(); let fn;
    if (ks.length >= 2) {
      const pc = new THREE.CatmullRomCurve3(ks.map(k => new THREE.Vector3(...k.pos)), false, 'centripetal'); const tc = new THREE.CatmullRomCurve3(ks.map(k => new THREE.Vector3(...k.target)), false, 'centripetal'); const dauer = (ks.length - 1) * sekProKamera * 1000;
      fn = (t) => { const u = Math.min(1, t / dauer); const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; v.cam.position.copy(pc.getPoint(e)); v.controls.target.copy(tc.getPoint(e)); return u >= 1; };
    } else {
      const c = v.controls.target.clone(); const off = v.cam.position.clone().sub(c); const r = Math.hypot(off.x, off.z), y = off.y, a0 = Math.atan2(off.z, off.x); const dauer = umlaufSek * 1000;
      fn = (t) => { const u = Math.min(1, t / dauer); const a = a0 + u * Math.PI * 2; v.cam.position.set(c.x + Math.cos(a) * r, c.y + y, c.z + Math.sin(a) * r); v.cam.lookAt(c); return u >= 1; };
    }
    const step = () => { if (v.dead || v._stopRundgang) { v._stopRundgang = false; v.controls.enabled = true; res(); return; } const fertig = fn(performance.now() - s); v.cam.lookAt(v.controls.target); if (fertig) { v.controls.enabled = true; res(); } else requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}
export async function rundgangVideo(v) {
  const cv = v.renderer.domElement; if (!cv.captureStream || typeof MediaRecorder === 'undefined') { v.app.toast('Dieser Browser kann kein Video aufnehmen – bitte Chrome oder Edge verwenden.', true); return; }
  const typ = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
  const rec = new MediaRecorder(cv.captureStream(30), { mimeType: typ, videoBitsPerSecond: 8e6 }); const teile = []; rec.ondataavailable = (e) => e.data.size && teile.push(e.data);
  const fertig = new Promise(res => rec.onstop = res); v._aufnahme = true; v.app.renderSide(); rec.start(250);
  if ((v.app.doc.p.kameras || []).length >= 2) await flyTo(v, v.app.doc.p.kameras[0], 600);
  await rundgang(v); rec.stop(); await fertig; v._aufnahme = false; v.app.renderSide();
  const blob = new Blob(teile, { type: typ.split(';')[0] }); v.app.downloadBlob(blob, `${v.app.doc.p.name || 'Projekt'} – Rundgang.${typ.includes('mp4') ? 'mp4' : 'webm'}`); v.app.toast('Rundgang-Video gespeichert');
}
export function kameraPanel(v, body) {
  const doc = v.app.doc; const ks = doc.p.kameras || [];
  const sec = h('div', { class: 'sec' }, h('h4', {}, 'Kameras & Rundgang'));
  const list = h('div', { class: 'list' });
  ks.forEach((k, i) => list.append(h('div', { class: 'li' }, h('span', { class: 'grow', title: 'Ansicht anfliegen', onclick: () => flyTo(v, k) }, `${i + 1}. ${k.name}`),
    h('button', { class: 'ib', title: 'mit aktueller Ansicht überschreiben', onclick: () => doc.change('Kamera', () => { Object.assign(doc.p.kameras[i], camState(v)); }), html: icon('save') }),
    h('button', { class: 'ib', title: 'nach oben', onclick: () => i > 0 && doc.change('Kamera', () => { const a = doc.p.kameras; [a[i - 1], a[i]] = [a[i], a[i - 1]]; }) }, '↑'),
    h('button', { class: 'ib', title: 'löschen', onclick: () => doc.change('Kamera löschen', () => doc.p.kameras.splice(i, 1)), html: icon('trash') }))));
  sec.append(list, h('div', { class: 'btns' },
    h('button', { class: 'btn sm', html: icon('kamera') + 'Ansicht speichern', onclick: async () => { const r = await v.app.prompt('Kamera speichern', [{ key: 'n', label: 'Name', value: `Ansicht ${ks.length + 1}` }]); if (!r) return; doc.change('Kamera', () => { doc.p.kameras = doc.p.kameras || []; doc.p.kameras.push({ name: r.n, ...camState(v) }); }); } }),
    h('button', { class: 'btn sm', disabled: v._aufnahme, html: icon('video') + (ks.length >= 2 ? 'Rundgang abspielen' : 'Umlauf abspielen'), onclick: () => rundgang(v) }),
    h('button', { class: 'btn sm pri', disabled: v._aufnahme, html: icon('video') + (v._aufnahme ? 'Aufnahme läuft …' : 'Als Video speichern'), onclick: () => rundgangVideo(v) })),
    h('div', { class: 'muted' }, ks.length >= 2 ? 'Der Rundgang fährt weich durch alle gespeicherten Ansichten (Reihenfolge mit ↑ ändern).' : 'Tipp: zwei oder mehr Ansichten speichern – dann fährt der Rundgang durch sie hindurch. Sonst kreist die Kamera einmal ums Haus.'));
  body.append(sec);
}

/* ───────── Export ───────── */
export function exportPanel(v, body) {
  body.append(h('div', { class: 'sec' }, h('h4', {}, 'Export (BIM & 3D)'), h('div', { class: 'btns' },
    h('button', { class: 'btn sm pri', html: icon('ifc') + 'IFC (BIM)', onclick: () => exportIfc(v) }),
    h('button', { class: 'btn sm', html: icon('cube') + 'glTF / GLB', onclick: () => exportGlb(v) }),
    h('button', { class: 'btn sm', html: icon('cube') + 'OBJ', onclick: () => exportObj(v) }),
    FREI ? null : h('button', { class: 'btn sm ki', html: icon('ki') + 'KI-Visualisierung', onclick: async () => { const K = await import('./ki-plus.js?v=20261028-0429'); K.visualisierung(v); } })),
    h('div', { class: 'muted' }, 'IFC4 für Architekten, Statiker und BIM-Programme (ArchiCAD, Revit, Allplan, Vectorworks): Geschosse, Wände mit Schichten, Türen, Fenster, Decken, Räume mit Flächen, Stützen, Unterzüge, Dach. GLB/OBJ für SketchUp, Blender, Twinmotion oder AR-Apps.')));
}
async function exportIfc(v) { try { const I = await import('./ifc.js?v=20261028-0429'); const r = I.exportIFC(v.app.doc); v.app.downloadBlob(new Blob([r.text], { type: 'application/x-step' }), `${v.app.doc.p.name || 'Projekt'}.ifc`); v.app.toast(`IFC gespeichert: ${r.stats.waende} Wände, ${r.stats.tueren} Türen, ${r.stats.fenster} Fenster, ${r.stats.raeume} Räume`); } catch (e) { console.error(e); v.app.toast('IFC-Export fehlgeschlagen: ' + e.message, true); } }
function exportWurzel(v) { const g = v.root.clone(true); g.traverse(o => { if (o.isLight) o.visible = false; }); return g; }
async function exportGlb(v) {
  try { const { GLTFExporter } = await import('../lib/GLTFExporter.js?v=20261028-0429'); const ex = new GLTFExporter(); const scene = new THREE.Scene(); scene.add(exportWurzel(v));
    const buf = await ex.parseAsync(scene, { binary: true, onlyVisible: true, maxTextureSize: 2048 }); v.app.downloadBlob(new Blob([buf], { type: 'model/gltf-binary' }), `${v.app.doc.p.name || 'Projekt'}.glb`); v.app.toast('GLB gespeichert'); }
  catch (e) { console.error(e); v.app.toast('glTF-Export fehlgeschlagen: ' + e.message, true); }
}
async function exportObj(v) {
  try { const { OBJExporter } = await import('../lib/OBJExporter.js?v=20261028-0429'); const txt = new OBJExporter().parse(exportWurzel(v)); v.app.downloadBlob(new Blob([txt], { type: 'text/plain' }), `${v.app.doc.p.name || 'Projekt'}.obj`); v.app.toast('OBJ gespeichert (Maßeinheit Meter)'); }
  catch (e) { console.error(e); v.app.toast('OBJ-Export fehlgeschlagen: ' + e.message, true); }
}
