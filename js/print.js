// TW-CAD – Plandruck: DIN A0–A4, maßstabsgetreu (Vektor-PDF), Plankopf, Maßstabsleiste, Fliesen-Verlegeplan
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import { PdfPainter, CanvasPainter } from './painter.js?v=20261028-0429';
import { drawPlan, PEN } from './render2d.js?v=20261028-0429';
import { drawSite } from './site.js?v=20261028-0429';
import { drawSection, drawElevation } from './section.js?v=20261028-0429';
import { tileSummary, wallTilePlan } from './tilecalc.js?v=20261028-0429';
import * as T from './tiles.js?v=20261028-0429';
import { icon } from './icons.js?v=20261028-0429';
import { FREI, WERBUNG, einstieg } from './frei.js?v=20261028-0429';
import { pdfVorbereiten } from './i18n.js?v=20261028-0429';
import { FIRMA } from './firma.js?v=20261028-0429';
export { FIRMA };

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };

const PLANSTATUS_NAME = { vorabzug: 'Vorabzug', entwurf: 'Entwurf', genehmigung: 'Genehmigung', ausfuehrung: 'Ausführung', werkplan: 'Werkplan', bestand: 'Bestand', revision: 'Revision' };
export const DIN = { A0: [841, 1189], A1: [594, 841], A2: [420, 594], A3: [297, 420], A4: [210, 297] };
export const MASSSTAEBE = [1, 2, 5, 10, 20, 25, 50, 75, 100, 125, 200, 250, 500, 1000];

let logoData = null;
async function logo() { if (FREI) return null; if (logoData) return logoData; try { const r = await fetch('img/tw-logo.jpg'); const b = await r.blob(); logoData = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }); } catch (e) { logoData = null; } return logoData; }

/** Inhalt zeichnen und Weltgrenzen liefern */
function contentFns(app, job) {
  const doc = app.doc;
  if (job.inhalt === 'grundriss') {
    const sid = job.storey || doc.p.activeStorey;
    const bbox = () => { let bb = null; for (const e of doc.all(null, sid)) { const b = app.elementBBox(e); if (b) bb = G.bboxUnion(bb, b); } return bb ? { ...bb, x0: bb.x0 - 1500, y0: bb.y0 - 1500, x1: bb.x1 + 1500, y1: bb.y1 + 1500 } : null; };
    return { bbox, draw: (P, ps) => drawPlan(P, doc, { storey: sid, tiles: job.fliesen || 'aus', paperScale: ps, underlays: false, ghost: false }), titel: `Grundriss ${doc.storeyById(sid).name}`, nord: true };
  }
  if (job.inhalt === 'lageplan') {
    const s = doc.p.site; const bbox = () => { const pts = [...s.punkte, ...(s.grenze || []), ...s.nachbarn.flatMap(n => n.poly)]; for (const st of doc.p.storeys) for (const o of W.storeyGeometry(doc, st.id).outers) pts.push(...o); if (!pts.length) return null; const bb = G.bbox(pts); return { x0: bb.x0 - 3000, y0: bb.y0 - 3000, x1: bb.x1 + 8000, y1: bb.y1 + 3000 }; };
    return { bbox, draw: (P, ps) => drawSite(P, doc, { paperScale: ps }), titel: 'Lageplan', nord: false };
  }
  if (job.inhalt === 'schnitt') { const sec = doc.byId(job.sec) || doc.p.elements.find(e => e.type === 'section'); if (!sec) return null; let bb = null; return { bbox: () => { const c = document.createElement('canvas').getContext('2d'); bb = drawSection(new CanvasPainter(c, { s: 1, ox: 0, oy: 0 }, 100), doc, sec, { ps: 100 }); return bb; }, draw: (P, ps) => drawSection(P, doc, sec, { ps }), titel: `Schnitt ${sec.name}–${sec.name}` }; }
  if (job.inhalt === 'ansicht') { const dir = job.dir || 'S'; return { bbox: () => { const c = document.createElement('canvas').getContext('2d'); return drawElevation(new CanvasPainter(c, { s: 1, ox: 0, oy: 0 }, 100), doc, dir, { ps: 100 }); }, draw: (P, ps) => drawElevation(P, doc, dir, { ps, farbig: job.farbig !== false }), titel: `Ansicht ${{ S: 'Süd', N: 'Nord', O: 'Ost', W: 'West' }[dir]}` }; }
  return null;
}

function fitScale(bb, w, hh) { const need = Math.max((bb.x1 - bb.x0) / w, (bb.y1 - bb.y0) / hh); return MASSSTAEBE.find(m => m >= need) || Math.ceil(need); }
/** Bester Maßstab: volle Höhe neben dem Plankopf oder volle Breite über dem Plankopf */
function fitArea(bb, frame) {
  const A = frame.area, K = frame.kopf; const full = { x: A.x, y: A.y, w: K.x - A.x - 5, h: A.h + K.h + (K.rh || 0) + 5 };
  const s1 = fitScale(bb, A.w, A.h - 12), s2 = fitScale(bb, full.w, full.h - 12);
  return s2 < s1 ? { scale: s2, A: full } : { scale: s1, A };
}

/** Seitenrahmen + Plankopf. Liefert nutzbaren Zeichenbereich {x,y,w,h} in mm */
function pageFrame(pdf, fmt, quer, meta, info, logoUrl) {
  let [pw, ph] = DIN[fmt]; if (quer) [pw, ph] = [ph, pw];
  const l = 20, r = 10, t = 10, b = 10; // DIN 824: Heftrand links 20 mm
  pdf.setDrawColor(17, 17, 17); pdf.setLineWidth(0.5); pdf.rect(l, t, pw - l - r, ph - t - b);
  // Plankopf unten rechts 180 × 62 mm
  const kw = Math.min(180, pw - l - r), kh = 62; const kx = pw - r - kw, ky = ph - b - kh;
  pdf.setFillColor(255, 255, 255); pdf.rect(kx, ky, kw, kh, 'FD'); pdf.setLineWidth(0.25);
  if (FREI) planerKopf(pdf, meta, kx, ky, kw);
  else {
    if (logoUrl) { try { pdf.addImage(logoUrl, 'JPEG', kx + 3, ky + 3, 60, 60 / 3.3989); } catch (e) { } }
    pdf.setTextColor(17, 17, 17); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5);
    const fl = [FIRMA.str + ' · ' + FIRMA.ort, `Tel. ${FIRMA.tel} · Mobil ${FIRMA.mobil}`, `${FIRMA.mail} · ${FIRMA.web}`];
    fl.forEach((s, i) => pdf.text(s, kx + kw - 3, ky + 5 + i * 3.6, { align: 'right' }));
  }
  pdf.setDrawColor(196, 30, 30); pdf.setLineWidth(0.6); pdf.line(kx, ky + 22, kx + kw, ky + 22); pdf.setDrawColor(17, 17, 17); pdf.setLineWidth(0.25);
  const rows = [['Bauvorhaben', meta.bauvorhaben || '–'], ['Bauherr', meta.bauherr || '–'], ['Planinhalt', info.titel], ['Maßstab', info.massstab], ['Format', `${fmt} ${quer ? 'quer' : 'hoch'}`], ['Datum', new Date().toLocaleDateString('de-DE')], ['Plan-Nr.', `${meta.planNr || '–'}${meta.index ? ' / Index ' + meta.index : ''}${meta.planstatus ? ' · ' + (PLANSTATUS_NAME[meta.planstatus] || '') : ''}`], ['Planverfasser', meta.planer || (FREI ? '–' : FIRMA.name)]];
  const cw = kw / 2; rows.forEach(([k, v], i) => { const col = i % 2, row = Math.floor(i / 2); const x = kx + col * cw + 3, y = ky + 27 + row * 8.6; pdf.setFontSize(6); pdf.setTextColor(120, 120, 120); pdf.text(k, x, y); pdf.setFontSize(8.6); pdf.setTextColor(17, 17, 17); pdf.setFont('helvetica', k === 'Planinhalt' ? 'bold' : 'normal'); pdf.text(String(v).slice(0, 52), x, y + 3.9); pdf.setFont('helvetica', 'normal'); });
  for (let i = 1; i < 4; i++) pdf.line(kx, ky + 22 + i * 8.6 + 0.4, kx + kw, ky + 22 + i * 8.6 + 0.4);
  pdf.line(kx + cw, ky + 22, kx + cw, ky + kh);
  // Änderungsindex über dem Plankopf (letzte 5)
  const revs = (meta.revisionen || []).slice(-5); let rh = 0;
  if (revs.length) {
    const zh = 4.2; rh = 5 + revs.length * zh; const ry = ky - rh; pdf.setFillColor(255, 255, 255); pdf.setDrawColor(17, 17, 17); pdf.rect(kx, ry, kw, rh, 'FD');
    pdf.setFontSize(6); pdf.setTextColor(120, 120, 120); const cx = [kx + 2, kx + 12, kx + 30, kx + kw - 14];
    pdf.text('Index', cx[0], ry + 3.4); pdf.text('Datum', cx[1], ry + 3.4); pdf.text('Änderung', cx[2], ry + 3.4); pdf.text('gez.', cx[3], ry + 3.4); pdf.line(kx, ry + 4.6, kx + kw, ry + 4.6);
    pdf.setTextColor(17, 17, 17); pdf.setFontSize(7.2);
    revs.slice().reverse().forEach((r, i) => { const yy = ry + 5 + (i + 0.78) * zh; pdf.setFont('helvetica', 'bold'); pdf.text(String(r.index || ''), cx[0], yy); pdf.setFont('helvetica', 'normal'); pdf.text(new Date(r.datum).toLocaleDateString('de-DE'), cx[1], yy); pdf.text(String(r.text || '').slice(0, 95), cx[2], yy); pdf.text(String(r.von || ''), cx[3], yy); });
  }
  pdf.setFontSize(6); pdf.setTextColor(110, 110, 110); pdf.text('Alle Maße vor Ausführung am Bau prüfen. Beim Drucken „Tatsächliche Größe / 100 %“ wählen.', l + 2, ph - b - 2);
  return { pw, ph, area: { x: l + 5, y: t + 5, w: pw - l - r - 10, h: ph - t - b - kh - rh - 10 }, kopf: { x: kx, y: ky, w: kw, h: kh, rh } };
}
/** Öffentliche Fassung: Kopf des Plankopfs mit den Angaben des Nutzers (Planverfasser, Kontakt) + Werbezeile von TW-CAD */
function planerKopf(pdf, meta, kx, ky, kw) {
  pdf.setTextColor(17, 17, 17); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5);
  pdf.text(String(meta.planer || 'Planverfasser: –').slice(0, 60), kx + 3, ky + 7);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5);
  const kontakt = String(meta.planerKontakt || '').split(/\n|\s*·\s*/).map(x => x.trim()).filter(Boolean);
  const zeilen = []; let z = ''; for (const t of kontakt) { const n = z ? z + ' · ' + t : t; if (n.length > 70 && z) { zeilen.push(z); z = t; } else z = n; } if (z) zeilen.push(z);
  zeilen.slice(0, 2).forEach((s, i) => pdf.text(s, kx + 3, ky + 11.2 + i * 3.4));
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8); const wCad = pdf.getTextWidth('-CAD'); pdf.setTextColor(200, 16, 46); pdf.text('TW', kx + kw - 3 - wCad, ky + 5.2, { align: 'right' }); pdf.setTextColor(17, 17, 17); pdf.text('-CAD', kx + kw - 3, ky + 5.2, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(5.2); pdf.setTextColor(110, 110, 110); pdf.text(WERBUNG, kx + 3, ky + 20.4); pdf.setTextColor(17, 17, 17);
}
function scaleBar(pdf, x, y, scale) {
  // Länge so wählen, dass Leiste ca. 50–100 mm lang
  const opts = [0.5, 1, 2, 5, 10, 20, 50, 100]; const m = opts.find(v => v * 1000 / scale >= 50) || 100; const L = m * 1000 / scale;
  pdf.setLineWidth(0.25); pdf.setDrawColor(17, 17, 17);
  for (let i = 0; i < 5; i++) { pdf.setFillColor(i % 2 ? 255 : 17, i % 2 ? 255 : 17, i % 2 ? 255 : 17); pdf.rect(x + i * L / 5, y, L / 5, 2, 'FD'); }
  pdf.setFontSize(7); pdf.setTextColor(17, 17, 17); pdf.text('0', x, y + 5.5, { align: 'center' }); pdf.text(`${String(m).replace('.', ',')} m`, x + L, y + 5.5, { align: 'center' }); pdf.text(`M 1:${scale}`, x + L + 8, y + 2);
}
function northArrow(pdf, x, y) { pdf.setFillColor(17, 17, 17); pdf.triangle(x, y - 8, x - 3, y + 2, x, y, 'F'); pdf.setDrawColor(17, 17, 17); pdf.triangle(x, y - 8, x + 3, y + 2, x, y, 'S'); pdf.setFontSize(9); pdf.setFont('helvetica', 'bold'); pdf.text('N', x, y - 10, { align: 'center' }); pdf.setFont('helvetica', 'normal'); }

/** Einzelplan als PDF */
export async function makePlanPdf(app, job) {
  await pdfVorbereiten();
  const { jsPDF } = window.jspdf; const doc = app.doc; const fn = contentFns(app, job); if (!fn) throw new Error('Kein Inhalt');
  let [pw, ph] = DIN[job.format]; if (job.quer) [pw, ph] = [ph, pw];
  const pdf = new jsPDF({ unit: 'mm', format: [pw, ph], orientation: job.quer ? 'landscape' : 'portrait', compress: true });
  const bb = fn.bbox(); if (!bb) throw new Error('Nichts zu drucken – Zeichnung ist leer.');
  const lg = await logo();
  const frame = pageFrame(pdf, job.format, job.quer, doc.p.meta, { titel: fn.titel, massstab: '…' }, lg);
  let A = frame.area; let scale; if (job.massstab === 'passend') { const fa = fitArea(bb, frame); scale = fa.scale; A = fa.A; } else { scale = +job.massstab; const fa = fitArea(bb, frame); if ((bb.x1 - bb.x0) / scale <= fa.A.w && (bb.y1 - bb.y0) / scale <= fa.A.h) A = fa.A; }
  // Plankopf-Maßstab nachtragen
  pdf.setFillColor(255, 255, 255); pdf.rect(frame.kopf.x + frame.kopf.w / 2 + 2, frame.kopf.y + 27 + 8.6 - 3.2, frame.kopf.w / 2 - 4, 4.8, 'F'); pdf.setFontSize(8.6); pdf.text(`1:${scale}`, frame.kopf.x + frame.kopf.w / 2 + 3, frame.kopf.y + 27 + 8.6 + 3.9);
  const ww = (bb.x1 - bb.x0) / scale, wh = (bb.y1 - bb.y0) / scale;
  if (ww > A.w + 1 || wh > A.h + 1) app.toast(`Hinweis: Bei 1:${scale} passt die Zeichnung nicht ganz auf ${job.format} – größeres Format oder Maßstab „passend“ wählen.`, true);
  const view = { wx0: bb.x0, wy1: bb.y1, scale, px0: A.x + Math.max(0, (A.w - ww) / 2), py0: A.y + Math.max(0, (A.h - 12 - wh) / 2) };
  const P = new PdfPainter(pdf, view);
  fn.draw(P, scale);
  scaleBar(pdf, frame.area.x + 2, frame.area.y + frame.area.h - 6, scale);
  if (fn.nord) northArrow(pdf, A.x + A.w - 8, A.y + 14);
  return pdf;
}

/** Fliesen-Verlegeplan (Boden, Wandabwicklung, Materialliste) */
export async function printTilePlan(app, view, opt = {}) {
  await pdfVorbereiten();
  try {
    const { jsPDF } = window.jspdf; const doc = app.doc; const r = view.room; const lg = await logo();
    const fmt = opt.format || 'A3', quer = true; let [pw, ph] = DIN[fmt]; [pw, ph] = [ph, pw];
    const pdf = new jsPDF({ unit: 'mm', format: [pw, ph], orientation: 'landscape', compress: true });
    let first = true;
    const page = (titel, L, painter) => {
      if (!first) pdf.addPage([pw, ph], 'landscape'); first = false;
      const frame = pageFrame(pdf, fmt, quer, doc.p.meta, { titel, massstab: '…' }, lg); const A = frame.area;
      const bb = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
      const add = (b) => { bb.x0 = Math.min(bb.x0, b.x0); bb.y0 = Math.min(bb.y0, b.y0); bb.x1 = Math.max(bb.x1, b.x1); bb.y1 = Math.max(bb.y1, b.y1); };
      if (L.floor) add({ x0: L.floor.bb.x0 - 700, y0: L.floor.bb.y0 - 650, x1: L.floor.bb.x1 + 700, y1: L.floor.bb.y1 + 1350 });
      if (L.wall) add({ x0: L.wall.bb.x0 - 1200, y0: L.wall.bb.y0 - 500, x1: L.wall.bb.x1 + 600, y1: L.wall.bb.y1 + 800 });
      const fa = fitArea(bb, frame); const scale = fa.scale; const AA = fa.A;
      pdf.setFillColor(255, 255, 255); pdf.rect(frame.kopf.x + frame.kopf.w / 2 + 2, frame.kopf.y + 27 + 8.6 - 3.2, frame.kopf.w / 2 - 4, 4.8, 'F'); pdf.setFontSize(8.6); pdf.setTextColor(17, 17, 17); pdf.text(`1:${scale}`, frame.kopf.x + frame.kopf.w / 2 + 3, frame.kopf.y + 27 + 8.6 + 3.9);
      const vw = (bb.x1 - bb.x0) / scale, vh = (bb.y1 - bb.y0) / scale;
      const P = new PdfPainter(pdf, { wx0: bb.x0, wy1: bb.y1, scale, px0: AA.x + (AA.w - vw) / 2, py0: AA.y + Math.max(0, (AA.h - 14 - vh) / 2) });
      painter(P, scale); scaleBar(pdf, A.x + 2, A.y + A.h - 6, scale);
      return { A, frame };
    };
    const legend = (A) => { const items = [['#ffffff', 'ganze Fliese'], ['#dbeafe', 'Schnittstück ab 1/2'], ['#fde68a', 'unter 1/2 Fliese'], ['#fca5a5', 'zu klein (unter 1/3 bzw. 5 cm)']]; let x = A.x + 118; pdf.setFontSize(7.5); for (const [c, t] of items) { const rgb = c.match(/\w\w/g).map(v => parseInt(v, 16)); pdf.setFillColor(...rgb); pdf.setDrawColor(140, 140, 140); pdf.rect(x, A.y + A.h - 7, 4, 3, 'FD'); pdf.setTextColor(17, 17, 17); pdf.text(t, x + 5.5, A.y + A.h - 4.6); x += 44; } pdf.setDrawColor(220, 38, 38); pdf.circle(x + 2, A.y + A.h - 5.5, 1.6); pdf.text('Startpunkt (Fugenkreuz) – Maße ab Wandoberfläche', x + 5.5, A.y + A.h - 4.6); };
    const saveFlaeche = view.flaeche;
    if (!opt.nurMaterial) {
      if (r.type === 'tilezone' || (r.tiles && r.tiles.boden && r.tiles.boden.aktiv)) { view.flaeche = 'boden'; const L = view.layout(); const { A } = page(`Fliesen-Verlegeplan Boden – ${r.nr || ''} ${r.name || ''}`, L, (P, s) => view.paint(P, L, { mode: 'plan', ps: s })); legend(A); }
      if (view.wp) { view.flaeche = 'wand'; const L = view.layout(); const { A } = page(`Wandabwicklung – ${r.nr || ''} ${r.name || ''}`, L, (P, s) => view.paint(P, L, { mode: 'plan', ps: s })); legend(A); }
      view.flaeche = saveFlaeche;
    }
    // Materialliste
    pdf.addPage([pw, ph], 'landscape'); const frame = pageFrame(pdf, fmt, quer, doc.p.meta, { titel: 'Materialliste Fliesen', massstab: '–' }, lg); const A = frame.area;
    let y = A.y + 6; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.text(`Material & Verlegeangaben – ${r.nr || ''} ${r.name || ''}`, A.x, y); y += 9;
    const row = (cells, widths, bold = false, fill = null) => { let x = A.x; if (fill) { pdf.setFillColor(...fill); pdf.rect(A.x, y - 4.2, widths.reduce((a, b) => a + b, 0), 6, 'F'); } pdf.setFont('helvetica', bold ? 'bold' : 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(fill ? 255 : 17, fill ? 255 : 17, fill ? 255 : 17); cells.forEach((c, i) => { pdf.text(String(c), x + 1.5, y, { maxWidth: widths[i] - 3 }); x += widths[i]; }); y += 6.2; pdf.setTextColor(17, 17, 17); };
    const surf = [];
    if (view.res) surf.push(['Boden', r.type === 'tilezone' ? r.tiles : r.tiles.boden, view.res.stats]);
    if (view.res && view.res.rand) surf.push(['Randfries', view.res.rand.cfg, view.res.rand.stats]);
    if (view.wp) for (const rw of view.wp.rows) {
      if (rw.art === 'wand' || rw.art === 'oben' || rw.art === 'bauteil') surf.push([rw.art === 'oben' ? 'Wand oben' : rw.art === 'bauteil' ? 'Bauteile' : 'Wand', rw.cfg, { m2: rw.m2, laibung: rw.laibung, full: rw.full, cut: rw.cut, bedarf: rw.bedarf, pakete: rw.pakete, fugeKg: rw.fugeKg }]);
      else surf.push([rw.art === 'sockel' ? 'Sockel' : 'Fries', rw.cfg, { m2: 0, full: rw.stuecke || 0, cut: 0, bedarf: rw.bedarf, fugeKg: 0, lfm: rw.lfm }]);
    }
    const wds = [28, 70, 26, 26, 22, 22, 22, 30, 30, 30];
    row(['Fläche', 'Fliese / Hersteller / Artikel', 'Format', 'Fuge', 'Verband', 'Fläche (qm)', 'Stück', 'Bestellung', 'Fugenmörtel', 'Kleber'], wds, true, [45, 52, 54]);
    for (const [n, c, s] of surf) row([n, `${c.name || ''} ${c.hersteller ? '– ' + c.hersteller : ''} ${c.artikel || ''}`, `${G.fmtCm(c.L)}×${G.fmtCm(c.B)} cm`, `${c.fuge} mm`, (T.VERBAENDE[c.verband] || c.verband || '–').replace(/ \(.*\)/, ''), (s.m2 + (s.laibung || 0)).toFixed(2).replace('.', ',') + (s.lfm ? ` (${s.lfm.toFixed(1).replace('.', ',')} lfm)` : ''), s.lfm ? `${s.full} Stücke` : `${s.full} + ${s.cut} Schnitt`, `${s.bedarf} Stk${s.pakete ? ' / ' + s.pakete + ' Pak.' : ''}`, `${(s.fugeKg || 0).toFixed(1).replace('.', ',')} kg`, `${T.materialRichtwerte(s.m2, c).kleberKg.toFixed(0)} kg`], wds);
    y += 4; pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.text('Hinweise für die Ausführung', A.x, y); y += 6; pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    const hints = [];
    if (view.res) { hints.push(`Boden: Startpunkt (Fugenkreuz) wie im Plan bemaßt anlegen und mit Schnurschlag/Laser in beide Richtungen übertragen. ${view.res.stats.krit ? `Achtung: ${view.res.stats.krit} sehr kleine Randstücke – vor Beginn mit Bauleitung abstimmen.` : 'Keine zu kleinen Randstücke.'}`); }
    if (view.wp && view.wp.walls.some(w => w.aktiv)) { const c = view.wp.cfg; hints.push(`Wand: Fliesenhöhe ${G.fmtCm(view.wp.walls[0] ? view.wp.walls[0].top : 0)} cm, ${c.yModus === 'oben' ? 'oberste Reihe ganz' : c.yModus === 'hoehe' ? 'Fuge auf ' + G.fmtCm(c.yHoehe) + ' cm' : 'unterste Reihe ganz'}, senkrechte Fugen ${c.xModus === 'boden' ? 'durchgehend wie Boden' : c.xModus === 'ecke' ? 'um die Ecke durchlaufend' : 'je Wand ausgemittelt'}.`); hints.push(`Silikonfugen ca. ${view.wp.sum.silikonLfm.toFixed(1).replace('.', ',')} lfm (Boden/Wand, Innenecken), Kantenschutz an Laibungen ca. ${view.wp.sum.schiene.toFixed(1).replace('.', ',')} lfm.`); }
    hints.push('Bewegungs- und Anschlussfugen nach Plan/DIN 18352 ausbilden; Fugenbreiten gleichmäßig. Maße vor Beginn am Bau prüfen.');
    for (const t of hints) { const lines = pdf.splitTextToSize('• ' + t, A.w - 10); pdf.text(lines, A.x, y); y += lines.length * 4.6 + 1.5; }
    const name = `Verlegeplan ${r.nr || ''} ${r.name || ''} – ${doc.p.name}`.replace(/[\\/:*?"<>|]/g, '_').trim() + '.pdf';
    pdf.save(name); app.toast('Verlegeplan als PDF erstellt ✓');
  } catch (e) { console.error(e); app.toast('PDF-Fehler: ' + e.message, true); }
}

/* ───────── Ansicht „Plandruck“ ───────── */
export function mount(app, el) { return new PrintView(app, el); }
export function openPrint(app, job) { app.printJob = job; app.setMode('druck'); }

class PrintView {
  constructor(app, el) {
    this.app = app; this.el = el; el.innerHTML = ''; el.style.background = '#2a313b'; this.sideTitle = 'Plandruck';
    const lp = app.mode === 'lageplan'; this.job = Object.assign({ inhalt: lp ? 'lageplan' : 'grundriss', storey: app.doc.p.activeStorey, format: 'A3', quer: true, massstab: String(app.massstab ? app.massstab() : (app.doc.p.settings.massstab || 50)), fliesen: 'aus', dir: 'S', farbig: true }, app.printJob || {}); app.printJob = null;
    this.cv = h('canvas', { style: 'position:absolute;inset:0;width:100%;height:100%' }); el.append(this.cv);
    new ResizeObserver(() => this.draw()).observe(el); setTimeout(() => this.draw(), 30);
  }
  refresh() { this.draw(); }
  stufeGeaendert() { if (einstieg()) this.job.inhalt = 'grundriss'; this.draw(); }
  draw() {
    if (einstieg() && this.job.inhalt !== 'grundriss') this.job.inhalt = 'grundriss';
    const r = this.el.getBoundingClientRect(); if (!r.width) return; const d = window.devicePixelRatio || 1; this.cv.width = r.width * d; this.cv.height = r.height * d;
    const c = this.cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0); c.fillStyle = '#2a313b'; c.fillRect(0, 0, r.width, r.height);
    let [pw, ph] = DIN[this.job.format]; if (this.job.quer) [pw, ph] = [ph, pw];
    const s = Math.min((r.width - 60) / pw, (r.height - 60) / ph); const ox = (r.width - pw * s) / 2, oy = (r.height - ph * s) / 2;
    c.fillStyle = '#fff'; c.shadowColor = 'rgba(0,0,0,.4)'; c.shadowBlur = 20; c.fillRect(ox, oy, pw * s, ph * s); c.shadowBlur = 0;
    const fn = contentFns(this.app, this.job); if (!fn) { c.fillStyle = '#333'; c.font = '14px Inter'; c.fillText('Kein Inhalt für diese Auswahl.', ox + 20, oy + 30); return; }
    const bb = fn.bbox(); if (!bb) return;
    let A = { x: 25, y: 15, w: pw - 40, h: ph - 20 - 62 - 10 }; const frame = { area: A, kopf: { x: pw - 10 - Math.min(180, pw - 30), y: ph - 10 - 62, w: Math.min(180, pw - 30), h: 62 } };
    let scale; const fa = fitArea(bb, frame);
    if (this.job.massstab === 'passend') { scale = fa.scale; A = fa.A; } else { scale = +this.job.massstab; if ((bb.x1 - bb.x0) / scale <= fa.A.w && (bb.y1 - bb.y0) / scale <= fa.A.h) A = fa.A; }
    this.scale = scale;
    const ww = (bb.x1 - bb.x0) / scale, wh = (bb.y1 - bb.y0) / scale; this.passt = ww <= A.w + 1 && wh <= A.h + 1;
    const px0 = A.x + Math.max(0, (A.w - ww) / 2), py0 = A.y + Math.max(0, (A.h - 12 - wh) / 2);
    const tf = { s: s / scale, ox: ox + (px0 - bb.x0 / scale) * s, oy: oy + (py0 + bb.y1 / scale) * s };
    c.save(); c.beginPath(); c.rect(ox + 20 * s, oy + 10 * s, (pw - 30) * s, (ph - 20) * s); c.clip();
    fn.draw(new CanvasPainter(c, tf, scale), scale); c.restore();
    c.strokeStyle = '#111'; c.lineWidth = 1; c.strokeRect(ox + 20 * s, oy + 10 * s, (pw - 30) * s, (ph - 20) * s);
    c.strokeRect(ox + (pw - 10 - 180) * s, oy + (ph - 10 - 62) * s, 180 * s, 62 * s); c.fillStyle = '#c41e1e'; c.fillRect(ox + (pw - 10 - 180) * s, oy + (ph - 10 - 40) * s, 180 * s, Math.max(1, 0.6 * s));
    c.fillStyle = '#111'; c.font = `${Math.max(8, 4 * s)}px Inter`; c.fillText(`${fn.titel} · M 1:${scale} · ${this.job.format}`, ox + (pw - 186) * s, oy + (ph - 10 - 30) * s);
    if (!this.passt) { c.fillStyle = 'rgba(220,38,38,.9)'; c.font = '600 13px Inter'; c.fillText(`Passt nicht auf ${this.job.format} bei 1:${scale}`, ox + 30, oy + 30); }
  }
  renderSide(body) {
    const app = this.app; const doc = app.doc; const j = this.job;
    const row = (l, el) => h('div', { class: 'row' }, h('label', {}, l), el);
    const sel = (key, values, cb) => { const s = h('select', {}); for (const [v, l] of values) s.append(h('option', { value: v, selected: String(j[key]) === String(v) }, l)); s.onchange = () => { j[key] = s.value === 'true' ? true : s.value === 'false' ? false : s.value; cb && cb(); this.draw(); app.renderSide(); }; return s; };
    body.append(h('div', { class: 'sec' }, h('h4', {}, 'Inhalt'),
      row('Plan', sel('inhalt', einstieg() ? [['grundriss', 'Grundriss']] : [['grundriss', 'Grundriss'], ['lageplan', 'Lageplan'], ['schnitt', 'Schnitt'], ['ansicht', 'Ansicht / Fassade']])),
      j.inhalt === 'grundriss' && !(einstieg() && doc.p.storeys.length < 2) ? row('Geschoss', sel('storey', doc.p.storeys.map(s => [s.id, s.name]))) : null,
      j.inhalt === 'grundriss' ? row('Fliesen', sel('fliesen', [['aus', 'ohne'], ['plan', 'Verlegeplan'], ['kunde', 'Kundenansicht (flächig)']])) : null,
      j.inhalt === 'schnitt' ? row('Schnitt', sel('sec', doc.p.elements.filter(e => e.type === 'section').map(s => [s.id, `${s.name}–${s.name}`]))) : null,
      j.inhalt === 'ansicht' ? row('Ansicht', sel('dir', [['S', 'Süd'], ['N', 'Nord'], ['O', 'Ost'], ['W', 'West']])) : null,
      j.inhalt === 'ansicht' ? row('Farbig', sel('farbig', [['true', 'ja (Materialien)'], ['false', 'schwarz/weiß']])) : null));
    body.append(h('div', { class: 'sec' }, h('h4', {}, 'Blatt'),
      row('Format', sel('format', Object.keys(DIN).map(k => [k, `DIN ${k} (${DIN[k][0]} × ${DIN[k][1]} mm)`]))),
      row('Ausrichtung', sel('quer', [['true', 'quer'], ['false', 'hoch']])),
      row('Maßstab', sel('massstab', [['passend', 'passend (größter Normmaßstab)'], ...MASSSTAEBE.map(m => [m, '1:' + m])]))),
      h('div', { class: this.passt === false ? 'note warn' : 'note' }, this.passt === false ? `Passt bei 1:${this.scale} nicht auf ${j.format} – größeres Format wählen oder Maßstab „passend“.` : `Maßstab 1:${this.scale || '…'} – vektorgenau. Drucken mit „Tatsächliche Größe / 100 %“.`));
    body.append(h('div', { class: 'btns' }, h('button', { class: 'btn pri', onclick: async () => { try { const pdf = await makePlanPdf(app, j); pdf.save(`${doc.p.name} – ${contentFns(app, j).titel} ${j.format}.pdf`.replace(/[\\/:*?"<>|]/g, '_')); app.toast('PDF erstellt ✓'); } catch (e) { app.toast(e.message, true); } }, html: icon('print') + 'PDF erzeugen' }),
      h('button', { class: 'btn', 'data-stufe': 'profi', onclick: async () => { const M = await import('./dxf.js?v=20261028-0429'); M.exportDXF(app, j.inhalt === 'grundriss' ? j.storey : null); }, html: icon('dxf') + 'DXF' })));
    body.append(h('div', { class: 'muted', style: 'margin-top:10px' }, 'Fliesen-Verlegepläne mit Wandabwicklung und Materialliste: im „Fliesenplan“ über „Verlegeplan als PDF“.'));
  }
}
