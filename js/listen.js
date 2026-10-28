// TW-CAD – Ansicht „Listen & Prüfung“: Raumbuch, Türen, Fenster, Bauteilmengen, Plan-Prüfung (mit KI-Erklärung), Planindex
import * as G from './geom.js?v=20261028-0429';
import * as A from './auswertung.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import { icon } from './icons.js?v=20261028-0429';
import { FIRMA } from './print.js?v=20261028-0429';
import { FREI, WERBUNG } from './frei.js?v=20261028-0429';
import { pdfVorbereiten } from './i18n.js?v=20261028-0429';
import { pdfSafe } from './painter.js?v=20261028-0429';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
const n2 = (v, d = 2) => (v || 0).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
const cm = (mm) => G.fmtCm(mm);
const TABS = [['raumbuch', 'Raumbuch', 'liste'], ['tueren', 'Türliste', 'door'], ['fenster', 'Fensterliste', 'window'], ['mengen', 'Bauteilmengen', 'wall'], ['pruefung', 'Plan-Prüfung', 'pruefen'], ['index', 'Planindex', 'print']];
const STUFE = { fehler: ['Fehler', 'bad'], warn: ['Hinweis', 'warn'], info: ['Info', 'info'], ok: ['OK', 'ok'] };

let logoData = null;
async function logo() { if (FREI) return null; if (logoData !== null) return logoData; try { const r = await fetch('img/tw-logo.jpg'); const b = await r.blob(); logoData = await new Promise(res => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(b); }); } catch (e) { logoData = ''; } return logoData; }

class Listen {
  constructor(app, el) {
    this.app = app; this.el = el; this.tab = this.tab || 'raumbuch'; this.sideTitle = 'Listen & Prüfung'; this.filter = 'alle'; this.kiText = '';
    try { this.tab = localStorage.getItem('twcad_listen_tab') || 'raumbuch'; } catch (e) { }
    this.render();
  }
  get doc() { return this.app.doc; }
  hide() { }
  refresh() { this.render(); }
  setTab(t) { this.tab = t; try { localStorage.setItem('twcad_listen_tab', t); } catch (e) { } this.render(); this.app.renderSide(); }
  render() {
    const el = this.el; const sc = el.querySelector('.ls-body'); const top = sc ? sc.scrollTop : 0; el.innerHTML = '';
    const bar = h('div', { class: 'ls-bar' }, ...TABS.map(([k, l, ic]) => h('button', { class: 'ls-tab' + (this.tab === k ? ' on' : ''), 'data-tab': k, onclick: () => this.setTab(k), html: icon(ic) + `<span>${l}</span>` })));
    const body = h('div', { class: 'ls-body' });
    try { body.append(this['tab_' + this.tab]()); } catch (e) { console.error(e); body.append(h('div', { class: 'note warn' }, 'Fehler in der Auswertung: ' + e.message)); }
    el.append(h('div', { class: 'ls' }, bar, body)); body.scrollTop = top;
  }
  /* ───── Werkzeuge ───── */
  kopf(titel, info, exp) {
    return h('div', { class: 'ls-kopf' }, h('div', {}, h('h2', {}, titel), info ? h('div', { class: 'muted' }, info) : null),
      h('div', { class: 'btns' }, exp.csv ? h('button', { class: 'btn sm', onclick: exp.csv, html: icon('download') + 'CSV (Excel)' }) : null, exp.pdf ? h('button', { class: 'btn sm pri', onclick: exp.pdf, html: icon('pdf') + 'PDF' }) : null));
  }
  tabelle(kopf, zeilen, opt = {}) {
    const t = h('table', { class: 'ls-tab-t' }); const tr = h('tr', {}); kopf.forEach((k, i) => tr.append(h('th', { class: opt.rechts && opt.rechts.includes(i) ? 'r' : '' }, k))); t.append(h('thead', {}, tr));
    const tb = h('tbody', {}); for (const z of zeilen) { const r = h('tr', { class: z.cls || '' }); (z.zellen || z).forEach((c, i) => r.append(h('td', { class: opt.rechts && opt.rechts.includes(i) ? 'r' : '' }, c))); if (z.id) { r.classList.add('klick'); r.title = 'Im Grundriss zeigen'; r.onclick = (ev) => { if (ev.target.closest('select,input,button')) return; this.zeige(z.id, z.storey); }; } tb.append(r); }
    t.append(tb); if (opt.fuss) { const f = h('tr', { class: 'summe' }); opt.fuss.forEach((c, i) => f.append(h('td', { class: opt.rechts && opt.rechts.includes(i) ? 'r' : '' }, c))); t.append(h('tfoot', {}, f)); }
    return h('div', { class: 'ls-scroll' }, t);
  }
  async zeige(id, storey) {
    const e = this.doc.byId(id); if (!e) return; const sid = storey || e.storey; if (sid && this.doc.p.activeStorey !== sid) this.doc.p.activeStorey = sid;
    await this.app.setMode('grundriss'); this.app.select([id]); let bb = this.app.elementBBox(e) || (e.pts ? G.bbox(e.pts) : null);
    if (!bb && e.type === 'opening') { const op = W.storeyGeometry(this.doc, sid || this.doc.p.activeStorey).openings.find(x => x.o.id === id); if (op) bb = G.bbox(op.rect); }
    if (bb) { const m = Math.max(1500, (bb.x1 - bb.x0) * 0.6, (bb.y1 - bb.y0) * 0.6); this.app.view.fit({ x0: bb.x0 - m, y0: bb.y0 - m, x1: bb.x1 + m, y1: bb.y1 + m, w: bb.x1 - bb.x0 + 2 * m, h: bb.y1 - bb.y0 + 2 * m }); }
    this.app.redraw(); this.app.renderSide();
  }
  download(name, text, type = 'text/csv;charset=utf-8') { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); this.app.toast(`„${name}“ gespeichert`); }
  dateiname(t, ext) { return `${(this.doc.p.name || 'Projekt').replace(/[^\wäöüÄÖÜß -]+/g, '').trim()} – ${t}.${ext}`; }
  async pdf(titel, abschnitte, quer = true) {
    await pdfVorbereiten();
    const { jsPDF } = window.jspdf; const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: quer ? 'landscape' : 'portrait', compress: true });
    { const t0 = pdf.text.bind(pdf), s0 = pdf.splitTextToSize.bind(pdf); pdf.text = (t, ...a) => t0(Array.isArray(t) ? t.map(pdfSafe) : pdfSafe(t), ...a); pdf.splitTextToSize = (t, ...a) => s0(pdfSafe(t), ...a); }
    const pw = quer ? 297 : 210, ph = quer ? 210 : 297, L = 15, R = pw - 12; const lg = await logo(); const meta = this.doc.p.meta || {};
    let y = 0; let seite = 0;
    const neueSeite = () => {
      if (seite) pdf.addPage(); seite++; y = 12;
      if (lg) { try { pdf.addImage(lg, 'JPEG', L, y - 2, 42, 42 / 3.3989); } catch (e) { } }
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(90, 90, 90);
      if (FREI) { pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(200, 16, 46); pdf.text('TW', L, y + 3); const wTw = pdf.getTextWidth('TW'); pdf.setTextColor(17, 17, 17); pdf.text('-CAD', L + wTw, y + 3); pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7.5); pdf.setTextColor(90, 90, 90); [meta.planer || '', ...String(meta.planerKontakt || '').split(/\n|\s*·\s*/).filter(Boolean).slice(0, 2)].filter(Boolean).forEach((s, i) => pdf.text(s, R, y + i * 3.5, { align: 'right' })); }
      else [FIRMA.name, `${FIRMA.str} · ${FIRMA.ort}`, `Tel. ${FIRMA.tel} · ${FIRMA.mail}`].forEach((s, i) => pdf.text(s, R, y + i * 3.5, { align: 'right' }));
      y += 16; pdf.setDrawColor(196, 30, 30); pdf.setLineWidth(0.5); pdf.line(L, y, R, y); y += 7;
      pdf.setTextColor(17, 17, 17); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(14); pdf.text(titel, L, y);
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(80, 80, 80);
      pdf.text([meta.bauvorhaben ? 'Bauvorhaben: ' + meta.bauvorhaben : 'Projekt: ' + (this.doc.p.name || ''), meta.bauherr ? 'Bauherr: ' + meta.bauherr : ''].filter(Boolean).join('   ·   '), L, y + 5);
      pdf.text(`Stand ${new Date().toLocaleDateString('de-DE')}${meta.planNr ? ' · Plan-Nr. ' + meta.planNr : ''}${meta.index ? ' · Index ' + meta.index : ''}`, R, y + 5, { align: 'right' }); y += 12;
      pdf.setFontSize(7); pdf.setTextColor(130, 130, 130); pdf.text(`Seite ${seite}`, R, ph - 6, { align: 'right' }); pdf.text(FREI ? 'Ohne Gewähr – vor Verwendung prüfen · ' + WERBUNG : 'Erstellt mit TW-CAD · Flächen aus dem CAD-Modell, ohne Gewähr – vor Verwendung prüfen.', L, ph - 6);
    };
    neueSeite();
    for (const ab of abschnitte) {
      if (ab.titel) { if (y > ph - 30) neueSeite(); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10); pdf.setTextColor(17, 17, 17); pdf.text(ab.titel, L, y); y += 5; }
      if (ab.text) { pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(40, 40, 40); for (const zl of pdf.splitTextToSize(ab.text, R - L)) { if (y > ph - 14) neueSeite(); pdf.text(zl, L, y); y += 4; } y += 2; }
      if (!ab.kopf) continue;
      const W0 = R - L; const gew = ab.breiten || ab.kopf.map(() => 1); const sum = gew.reduce((a, b) => a + b, 0); const bw = gew.map(g => g / sum * W0);
      const kopfZeile = () => { pdf.setFillColor(238, 240, 243); pdf.rect(L, y - 3.6, W0, 5.6, 'F'); pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.6); pdf.setTextColor(30, 30, 30); let x = L; ab.kopf.forEach((k, i) => { const r = ab.rechts && ab.rechts.includes(i); pdf.text(String(k), r ? x + bw[i] - 1.2 : x + 1.2, y, { align: r ? 'right' : 'left' }); x += bw[i]; }); y += 5; pdf.setFont('helvetica', 'normal'); };
      kopfZeile();
      const zeilen = [...ab.zeilen, ...(ab.fuss ? [{ fuss: true, z: ab.fuss }] : [])];
      for (const raw of zeilen) {
        const z = raw.fuss ? raw.z : raw; const cells = z.map((c, i) => pdf.splitTextToSize(String(c ?? ''), bw[i] - 2.4)); const hz = Math.max(1, ...cells.map(c => c.length)) * 3.4 + 1.4;
        if (y + hz > ph - 12) { neueSeite(); kopfZeile(); }
        if (raw.fuss) { pdf.setFont('helvetica', 'bold'); pdf.setDrawColor(60, 60, 60); pdf.setLineWidth(0.3); pdf.line(L, y - 3.4, R, y - 3.4); }
        pdf.setFontSize(7.6); pdf.setTextColor(25, 25, 25); let x = L; cells.forEach((c, i) => { const r = ab.rechts && ab.rechts.includes(i); pdf.text(c, r ? x + bw[i] - 1.2 : x + 1.2, y, { align: r ? 'right' : 'left' }); x += bw[i]; });
        y += hz; pdf.setDrawColor(225, 228, 232); pdf.setLineWidth(0.15); pdf.line(L, y - 3.6, R, y - 3.6); pdf.setFont('helvetica', 'normal');
      }
      y += 5;
    }
    pdf.save(this.dateiname(titel, 'pdf')); this.app.toast('PDF erstellt');
  }

  /* ───── Raumbuch ───── */
  tab_raumbuch() {
    const rb = A.raumbuch(this.doc); const doc = this.doc; const wrap = h('div', {});
    const kopf = ['Geschoss', 'Nr.', 'Raum', 'Nutzung DIN 277', 'Fläche m²', 'Umfang m', 'lichte Höhe m', 'WoFlV', 'Wohnfläche m²', 'Fenster m²'];
    const zeilenCsv = rb.zeilen.map(z => [z.geschoss, z.nr, z.name, A.DIN277_KURZ[z.nutzung], z.flaeche, z.umfang, z.schraege ? `${n2(z.hoeheMin / 1000)}–${n2(z.hoeheMax / 1000)}` : z.hoehe / 1000, z.wflRegel, z.wfl, z.fensterFlaeche]);
    const sumA = rb.zeilen.reduce((s, z) => s + z.flaeche, 0);
    const exp = {
      csv: () => this.download(this.dateiname('Raumbuch', 'csv'), A.csv(kopf, zeilenCsv)),
      pdf: () => this.pdf('Raumbuch / Flächenberechnung', [
        { titel: 'Kennwerte nach DIN 277', kopf: ['Geschoss', 'BGF m²', 'KGF m² (ca.)', 'NRF m²', 'Wohnfläche m² (WoFlV)', 'BRI m³ (ca.)', 'Räume'], rechts: [1, 2, 3, 4, 5, 6], zeilen: rb.geschosse.map(g => [g.name, n2(g.bgf), n2(g.kgf), n2(g.nrf), n2(g.wfl), n2(g.bri, 1), g.raeume]), fuss: ['Summe', n2(rb.summe.bgf), n2(rb.summe.kgf), n2(rb.summe.nrf), n2(rb.summe.wfl), n2(rb.summe.bri, 1), rb.zeilen.length] },
        { titel: 'Netto-Raumfläche nach Nutzungsgruppen', kopf: ['Nutzungsgruppe', 'Fläche m²'], rechts: [1], breiten: [4, 1], zeilen: A.DIN277.filter(([k]) => rb.din[k] > 0).map(([k, l]) => [l, n2(rb.din[k])]), fuss: ['NRF gesamt (inkl. Außenflächen)', n2(sumA)] },
        { titel: 'Raumliste', kopf, rechts: [4, 5, 6, 8, 9], breiten: [1.1, 0.6, 2, 1.1, 0.9, 0.9, 1, 2.6, 1, 0.9], zeilen: rb.zeilen.map(z => [z.geschoss, z.nr, z.name, A.DIN277_KURZ[z.nutzung], n2(z.flaeche), n2(z.umfang), z.schraege ? `${n2(z.hoeheMin / 1000)}–${n2(z.hoeheMax / 1000)}` : n2(z.hoehe / 1000), z.wflRegel, n2(z.wfl), n2(z.fensterFlaeche)]), fuss: ['Summe', '', '', '', n2(sumA), '', '', '', n2(rb.summe.wfl), ''] },
        { text: 'Flächen sind Netto-Raumflächen aus dem Modell (Innenmaß der Wände, ohne Putzabzug). Wohnfläche nach Wohnflächenverordnung (WoFlV): Raumteile ab 2 m lichter Höhe voll, 1–2 m zur Hälfte, unter 1 m nicht; Balkone/Terrassen in der Regel zu einem Viertel; Keller, Heizungsräume und Garagen zählen nicht zur Wohnfläche. BGF = Brutto-Grundfläche (Außenmaß), KGF = BGF − NRF, BRI ≈ BGF × Geschosshöhe.' }
      ])
    };
    wrap.append(this.kopf('Raumbuch – Flächen nach DIN 277 und WoFlV', `${rb.zeilen.length} Räume · Flächen live aus dem Grundriss · Zeile anklicken = im Plan zeigen`, exp));
    const karten = h('div', { class: 'ls-karten' });
    for (const [l, v, u, t] of [['Wohnfläche (WoFlV)', rb.summe.wfl, 'm²', 'Wohnflächenverordnung'], ['Netto-Raumfläche NRF', rb.summe.nrf, 'm²', 'DIN 277'], ['Nutzungsfläche NUF', rb.nuf, 'm²', 'NUF 1–7'], ['Verkehrsfläche VF', rb.vf, 'm²', 'Flure, Treppen'], ['Technikfläche TF', rb.tf, 'm²', 'Heizung, Hausanschluss'], ['Brutto-Grundfläche BGF', rb.summe.bgf, 'm²', 'Außenmaß'], ['Konstruktionsfläche KGF', rb.summe.kgf, 'm²', 'ca., BGF − NRF'], ['Brutto-Rauminhalt BRI', rb.summe.bri, 'm³', 'ca.']])
      karten.append(h('div', { class: 'ls-karte' }, h('div', { class: 'l' }, l), h('div', { class: 'v' }, n2(v, u === 'm³' ? 1 : 2) + ' ' + u), h('div', { class: 'muted' }, t)));
    wrap.append(karten);
    if (!rb.zeilen.length) { wrap.append(h('div', { class: 'note' }, 'Noch keine Räume. Im Grundriss mit dem Werkzeug „Raum“ (R) in die Räume klicken – dann erscheinen sie hier automatisch.')); return wrap; }
    const zeilen = rb.zeilen.map(z => {
      const nsel = h('select', { title: 'Nutzungsgruppe DIN 277' }); for (const [k, l] of A.DIN277) nsel.append(h('option', { value: k, selected: z.nutzung === k }, l)); nsel.onchange = () => doc.change('Nutzung', () => { const r = doc.byId(z.id); r.nutzung = nsel.value; });
      const wsel = h('select', { title: 'Anrechnung Wohnfläche' }); for (const [k, l] of [['auto', 'automatisch'], ['100', 'voll (100 %)'], ['50', 'halb (50 %)'], ['25', 'Viertel (25 %)'], ['0', 'keine Wohnfläche']]) wsel.append(h('option', { value: k, selected: z.woflv === k }, l)); wsel.onchange = () => doc.change('WoFlV', () => { doc.byId(z.id).woflv = wsel.value; });
      return { id: z.id, storey: z.storey, zellen: [z.geschoss, z.nr, z.name, h('div', { class: 'ls-sel' }, nsel, z.nutzungAuto ? h('span', { class: 'muted', title: 'aus dem Raumnamen vorgeschlagen' }, 'Vorschlag') : null), n2(z.flaeche), n2(z.umfang), z.schraege ? `${n2(z.hoeheMin / 1000)}–${n2(z.hoeheMax / 1000)}` : n2(z.hoehe / 1000), h('div', { class: 'ls-sel' }, wsel, h('span', { class: 'muted' }, z.wflRegel)), n2(z.wfl), z.fensterAnz ? `${n2(z.fensterFlaeche)} (${z.fensterAnz})` : '–'] };
    });
    wrap.append(this.tabelle(kopf, zeilen, { rechts: [4, 5, 6, 8, 9], fuss: ['Summe', '', '', '', n2(sumA), '', '', '', n2(rb.summe.wfl), ''] }));
    wrap.append(h('h3', {}, 'Je Geschoss'), this.tabelle(['Geschoss', 'BGF m²', 'KGF m² (ca.)', 'NRF m²', 'Wohnfläche m²', 'BRI m³ (ca.)', 'Räume'], rb.geschosse.map(g => [g.name, n2(g.bgf), n2(g.kgf), n2(g.nrf), n2(g.wfl), n2(g.bri, 1), g.raeume]), { rechts: [1, 2, 3, 4, 5, 6] }));
    wrap.append(h('div', { class: 'note', style: 'margin-top:12px' }, 'Nutzung wird aus dem Raumnamen vorgeschlagen (Bad → NUF 7, Flur → VF, Heizung → TF …) und lässt sich je Raum ändern. Dachschrägen werden aus dem Dach berechnet: Wohnfläche ≥ 2 m voll, 1–2 m halb, unter 1 m nicht (§ 4 WoFlV).'));
    return wrap;
  }

  /* ───── Türen ───── */
  tab_tueren() {
    const { tueren } = A.oeffnungsliste(this.doc); const wrap = h('div', {});
    const kopf = ['Pos.', 'Geschoss', 'von', 'nach', 'Art', 'Rohbaumaß B × H cm', 'lichter Durchgang cm (ca.)', 'Anschlag', 'Zarge', 'Schwelle', 'Brandschutz', 'Wand'];
    const z = tueren.map(t => [t.pos, t.geschoss, t.von, t.nach, t.art, `${cm(t.breite)} × ${cm(t.hoehe)}`, `${cm(t.licht)} × ${cm(t.lichtH)}`, t.anschlag, t.zarge, t.schwelle, t.brandschutz, t.wand]);
    wrap.append(this.kopf('Türliste', `${tueren.length} Türen und Durchgänge · Rohbaumaße nach DIN 18100 · Zeile anklicken = im Plan zeigen`, { csv: () => this.download(this.dateiname('Türliste', 'csv'), A.csv(kopf, z)), pdf: () => this.pdf('Türliste', [{ kopf, zeilen: z, breiten: [0.6, 0.8, 1.4, 1.4, 1.8, 1.2, 1.3, 0.9, 1.4, 1.4, 0.9, 0.7] }]) }));
    if (!tueren.length) { wrap.append(h('div', { class: 'note' }, 'Noch keine Türen im Plan.')); return wrap; }
    wrap.append(this.tabelle(kopf, tueren.map((t, i) => ({ id: t.id, zellen: z[i] }))));
    const gr = {}; for (const t of tueren) { const k = `${t.art} ${cm(t.breite)} × ${cm(t.hoehe)}`; gr[k] = (gr[k] || 0) + 1; }
    wrap.append(h('h3', {}, 'Bestellübersicht'), this.tabelle(['Türart und Rohbaumaß', 'Stück'], Object.entries(gr).sort().map(([k, v]) => [k, v]), { rechts: [1] }));
    return wrap;
  }
  /* ───── Fenster ───── */
  tab_fenster() {
    const { fenster } = A.oeffnungsliste(this.doc); const wrap = h('div', {});
    const kopf = ['Pos.', 'Geschoss', 'Raum', 'Typ', 'Rohbaumaß B × H cm', 'Brüstung cm', 'Fläche m²', 'Material', 'Glas', 'Sonnenschutz', 'Wand'];
    const z = fenster.map(f => [f.pos, f.geschoss, f.raum, f.typ, `${cm(f.breite)} × ${cm(f.hoehe)}`, cm(f.bruestung), n2(f.flaeche), f.material, f.glas, f.sonnenschutz, f.wand]);
    const sum = fenster.reduce((s, f) => s + f.flaeche, 0);
    wrap.append(this.kopf('Fensterliste', `${fenster.length} Fenster · ${n2(sum)} m² Rohbaumaß · Zeile anklicken = im Plan zeigen`, { csv: () => this.download(this.dateiname('Fensterliste', 'csv'), A.csv(kopf, z)), pdf: () => this.pdf('Fensterliste', [{ kopf, zeilen: z, rechts: [5, 6], fuss: ['Summe', '', '', '', '', '', n2(sum), '', '', '', ''], breiten: [0.6, 0.8, 1.6, 1.8, 1.2, 0.8, 0.8, 1.2, 1.6, 1.5, 1.4] }]) }));
    if (!fenster.length) { wrap.append(h('div', { class: 'note' }, 'Noch keine Fenster im Plan.')); return wrap; }
    wrap.append(this.tabelle(kopf, fenster.map((f, i) => ({ id: f.id, zellen: z[i] })), { rechts: [5, 6], fuss: ['Summe', '', '', '', '', '', n2(sum), '', '', '', ''] }));
    const df = this.doc.all('dachfenster'); if (df.length) wrap.append(h('h3', {}, 'Dachfenster'), this.tabelle(['Nr.', 'Größe cm', 'Ausführung'], df.map((d, i) => ({ id: d.id, zellen: [`DF${String(i + 1).padStart(2, '0')}`, `${cm(d.breite || 780)} × ${cm(d.laenge || 1180)}`, d.art || 'schwing'] }))));
    return wrap;
  }
  /* ───── Bauteilmengen ───── */
  tab_mengen() {
    const b = A.bauteilmengen(this.doc); const wrap = h('div', {});
    const secs = [
      ['Wände', ['Geschoss', 'Art', 'Aufbau / Material', 'Dicke cm', 'Anzahl', 'Länge m', 'Fläche brutto m²', 'Öffnungen m²', 'Fläche netto m²', 'Volumen m³'], b.waende.map(w => [w.geschoss, w.art, w.bez, cm(w.dicke), w.anz, n2(w.laenge), n2(w.brutto), n2(w.oeff), n2(w.netto), n2(w.vol, 2)]), [3, 4, 5, 6, 7, 8, 9]],
      ['Wandschichten (aus den Wandaufbauten)', ['Material', 'Dicke cm', 'Fläche m²', 'Volumen m³'], b.schichten.map(s => [s.name, cm(s.dicke), n2(s.flaeche), n2(s.vol, 2)]), [1, 2, 3]],
      ['Decken / Bodenplatten', ['Bauteil', 'Dicke cm', 'Fläche brutto m²', 'Durchbrüche m²', 'Fläche netto m²', 'Volumen m³'], b.decken.map(d => [d.art, cm(d.dicke), n2(d.brutto), n2(d.loch), n2(d.netto), n2(d.vol, 2)]), [1, 2, 3, 4, 5]],
      ['Körper, Podeste, Kamine', ['Geschoss', 'Art', 'Grundfläche m²', 'Höhe cm', 'Mantelfläche m²', 'Volumen m³'], b.koerper.map(k => [k.geschoss, k.art, n2(k.flaeche), cm(k.hoehe), n2(k.mantel), n2(k.vol, 3)]), [2, 3, 4, 5]],
      ['Unterzüge / Balken', ['Geschoss', 'Material', 'Querschnitt cm', 'Länge m', 'Volumen m³'], b.balken.map(k => [k.geschoss, k.material, k.querschnitt, n2(k.laenge), n2(k.vol, 3)]), [3, 4]],
      ['Weitere Bauteile', ['Geschoss', 'Bauteil', 'Menge', 'Einheit'], b.sonst.map(s => [s.geschoss, s.was + (s.zusatz ? ` (${s.zusatz})` : ''), s.einheit === 'Stk' ? String(s.menge) : n2(s.menge), s.einheit]), [2]]
    ].filter(s => s[2].length);
    wrap.append(this.kopf('Bauteilmengen', 'Mengen aus dem Modell – Wandflächen je Seite (Achslänge × Höhe), Öffnungen abgezogen', {
      csv: () => this.download(this.dateiname('Bauteilmengen', 'csv'), secs.map(([t, k, z]) => A.csv([t], []).replace('﻿', '') + '\r\n' + A.csv(k, z).replace('﻿', '')).reduce((a, s) => a + s + '\r\n\r\n', '﻿')),
      pdf: () => this.pdf('Bauteilmengen', secs.map(([t, k, z, r]) => ({ titel: t, kopf: k, zeilen: z, rechts: r })))
    }));
    if (!secs.length) wrap.append(h('div', { class: 'note' }, 'Noch keine Bauteile im Plan.'));
    for (const [t, k, z, r] of secs) wrap.append(h('h3', {}, t), this.tabelle(k, z, { rechts: r }));
    return wrap;
  }
  /* ───── Plan-Prüfung ───── */
  tab_pruefung() {
    const doc = this.doc; const E = A.pruefEinstellungen(doc); const res = A.planPruefung(doc); const wrap = h('div', {});
    const cnt = { fehler: 0, warn: 0, info: 0, ok: 0 }; for (const r of res) cnt[r.stufe]++;
    const exp = { csv: () => this.download(this.dateiname('Plan-Prüfung', 'csv'), A.csv(['Ergebnis', 'Bereich', 'Befund', 'Regel / Hinweis'], res.map(r => [STUFE[r.stufe][0], r.kat, r.text, r.regel]))),
      pdf: () => this.pdf('Plan-Prüfung', [{ text: `Regelwerk: ${A.REGELWERKE[E.regel].name} · Barrierefreiheit: ${A.BF_STUFEN.find(x => x[0] === E.bf)[1]} · ${cnt.fehler} Fehler, ${cnt.warn} Hinweise, ${cnt.ok} erfüllt. Vereinfachte Prüfung aus dem CAD-Modell – ersetzt keine bauaufsichtliche Prüfung.` }, { kopf: ['Ergebnis', 'Bereich', 'Befund', 'Regel / Hinweis'], breiten: [0.7, 1, 3.4, 4], zeilen: res.filter(r => r.stufe !== 'ok' || this.filter === 'alle').map(r => [STUFE[r.stufe][0], r.kat, r.text, r.regel]) }, ...(this.kiText ? [{ titel: 'KI-Erläuterung', text: this.kiText }] : [])]) };
    wrap.append(this.kopf('Plan-Prüfung', 'Raumhöhen, Belichtung, Türen, Treppen (DIN 18065), Absturzsicherung, Bewegungsflächen (DIN 18040-2) – Zeile anklicken = im Plan zeigen', exp));
    const set = (k, v) => { doc.p.settings[k] = v; this.app.scheduleSave && this.app.scheduleSave(); this.render(); this.app.renderSide(); };
    wrap.append(h('div', { class: 'ls-einst' },
      h('label', {}, 'Bauordnung ', h('div', { class: 'seg' }, ...Object.entries(A.REGELWERKE).map(([k, r]) => h('button', { class: E.regel === k ? 'on' : '', onclick: () => set('pruefRegel', k) }, r.name)))),
      h('label', {}, 'Barrierefreiheit ', h('div', { class: 'seg' }, ...A.BF_STUFEN.map(([k, l]) => h('button', { class: E.bf === k ? 'on' : '', onclick: () => set('pruefBF', k) }, l))))));
    const fl = h('div', { class: 'ls-zaehler' });
    for (const [k, [l, c]] of [['alle', ['alle', '']], ...Object.entries(STUFE)]) fl.append(h('button', { class: `ls-z ${c}` + (this.filter === k ? ' on' : ''), onclick: () => { this.filter = k; this.render(); } }, h('b', {}, k === 'alle' ? res.length : cnt[k]), ' ' + (k === 'alle' ? 'alle' : l + (k === 'warn' ? 'e' : k === 'fehler' ? '' : ''))));
    fl.append(h('div', { class: 'grow' })); if (!FREI) fl.append(h('button', { class: 'btn sm ki', onclick: () => this.kiErklaeren(res, E), html: icon('ki') + 'KI erklärt & schlägt Lösungen vor' }));
    wrap.append(fl);
    if (this.kiText) wrap.append(h('div', { class: 'ls-ki' }, h('div', { class: 'ls-ki-k' }, h('b', {}, '🤖 KI-Erläuterung'), h('button', { class: 'ib', title: 'schließen', onclick: () => { this.kiText = ''; this.render(); }, html: icon('close') })), h('div', { class: 'ls-ki-t' }, ...this.kiText.split(/\n+/).map(p => h('p', {}, p)))));
    const liste = res.filter(r => this.filter === 'alle' || r.stufe === this.filter).sort((a, b) => ['fehler', 'warn', 'info', 'ok'].indexOf(a.stufe) - ['fehler', 'warn', 'info', 'ok'].indexOf(b.stufe));
    if (!liste.length) wrap.append(h('div', { class: 'note' }, res.length ? 'Keine Einträge in dieser Auswahl.' : 'Noch nichts zu prüfen – zeichne Wände, Räume, Türen und Fenster.'));
    const ul = h('div', { class: 'ls-pr' });
    for (const r of liste) ul.append(h('div', { class: 'ls-pr-i ' + STUFE[r.stufe][1] + (r.id ? ' klick' : ''), onclick: () => r.id && this.zeige(r.id, r.storey) }, h('span', { class: 'ls-badge ' + STUFE[r.stufe][1] }, STUFE[r.stufe][0]), h('div', { class: 'grow' }, h('div', { class: 't' }, h('span', { class: 'muted' }, r.kat + ' · '), r.text), r.regel ? h('div', { class: 'muted r' }, r.regel) : null), r.id ? h('span', { class: 'muted', html: icon('target') }) : null));
    wrap.append(ul);
    wrap.append(h('div', { class: 'note', style: 'margin-top:12px' }, `Vereinfachte Prüfung aus dem Modell nach ${A.REGELWERKE[E.regel].quelle}, DIN 18065 und DIN 18040-2. Sie ersetzt keine bauaufsichtliche Prüfung; im Zweifel gilt der Normtext bzw. die Landesbauordnung. Räume ohne Aufenthalt (Bad, Flur, Abstellraum …) werden bei Raumhöhe und Belichtung nicht geprüft – die Nutzung stellst du im Raumbuch ein.`));
    return wrap;
  }
  async kiErklaeren(res, E) {
    if (FREI) return;
    const AI = await import('./ai.js?v=20261028-0429');
    if (!AI.bereit()) { this.app.toast('Erst KI einrichten (Stern-Knopf oben) – dann erklärt sie die Prüfung.', true); AI.openAI(this.app); return; }
    const offen = res.filter(r => r.stufe !== 'ok'); if (!offen.length) { this.kiText = 'Alles erfüllt – die Prüfung hat keine Fehler oder Hinweise gefunden. 👍'; this.render(); return; }
    this.app.toast('KI denkt nach …');
    const rb = A.raumbuch(this.doc);
    const prompt = `Bauordnung: ${A.REGELWERKE[E.regel].name}. Barrierefreiheit: ${E.bf}.\nRäume: ${rb.zeilen.map(z => `${z.nr} ${z.name} ${z.flaeche.toFixed(1)} m², h ${(z.hoehe / 1000).toFixed(2)} m, Fenster ${z.fensterFlaeche.toFixed(2)} m²`).join('; ')}\n\nBefunde der Plan-Prüfung:\n${offen.map(r => `- [${STUFE[r.stufe][0]}] ${r.kat}: ${r.text} (${r.regel})`).join('\n')}`;
    try {
      const r = await AI.claude({ system: 'Du bist erfahrener Bauleiter und Planer in Deutschland und hilfst einem Fliesenlegermeister, der mit seinem CAD-Programm Pläne zeichnet. Erkläre die Befunde der automatischen Plan-Prüfung kurz und verständlich (Du-Form, Deutsch). Ordne nach Wichtigkeit, nenne pro Befund in 1–2 Sätzen warum es wichtig ist und einen konkreten Lösungsvorschlag mit Maßen (z. B. Türbreite 1,01 m Rohbaumaß statt 88,5 cm, Fenster 1,26 × 1,385 m). Weise darauf hin, wenn ein Befund wahrscheinlich nur an der Nutzungseinstufung liegt. Keine Überschriften mit #, kurze Absätze, maximal 300 Wörter. Keine Rechtsberatung – bei Grenzfällen auf Bauamt/Architekt verweisen.', messages: [{ role: 'user', content: prompt }], max_tokens: 1500 });
      this.kiText = (r.text || '').replace(/\*\*/g, '').trim(); this.render();
    } catch (e) { this.app.toast(e.message, true); }
  }
  /* ───── Planindex ───── */
  tab_index() {
    const doc = this.doc; const meta = doc.p.meta; const revs = meta.revisionen || []; const wrap = h('div', {});
    wrap.append(this.kopf('Planindex & Plankopf', 'Änderungen dokumentieren – der aktuelle Index und die Änderungsliste stehen automatisch im Plankopf jedes Plandrucks', {}));
    const inp = (k, ph) => { const i = h('input', { type: 'text', value: meta[k] || '', placeholder: ph }); i.onchange = () => doc.change('Plankopf', () => { meta[k] = i.value; }); return i; };
    const st = h('select', {}); for (const [k, l] of A.PLANSTATUS) st.append(h('option', { value: k, selected: (meta.planstatus || '') === k }, l)); st.onchange = () => doc.change('Planstatus', () => { meta.planstatus = st.value; });
    wrap.append(h('div', { class: 'ls-form' },
      h('label', {}, 'Bauvorhaben', inp('bauvorhaben', 'z. B. Neubau EFH Muster, Hauptstr. 1')), h('label', {}, 'Bauherr', inp('bauherr', 'Name')),
      h('label', {}, 'Plan-Nr.', inp('planNr', 'z. B. 2026-014-01')), h('label', {}, 'Planstatus', st), h('label', {}, 'Planverfasser', inp('planer', FREI ? 'Name / Firma' : FIRMA.name)), FREI ? h('label', {}, 'Anschrift / Kontakt', inp('planerKontakt', 'Straße · PLZ Ort · Telefon · E-Mail')) : null));
    const z = revs.map((r, i) => ({ zellen: [h('b', {}, r.index), new Date(r.datum).toLocaleDateString('de-DE'), r.text, r.von || '', h('button', { class: 'ib', title: 'Eintrag löschen', html: icon('trash'), onclick: () => { if (confirm(`Index ${r.index} löschen?`)) doc.change('Planindex', () => { meta.revisionen.splice(i, 1); meta.index = meta.revisionen.length ? meta.revisionen[meta.revisionen.length - 1].index : ''; }); } })] }));
    wrap.append(h('h3', {}, 'Änderungsindex'));
    if (z.length) wrap.append(this.tabelle(['Index', 'Datum', 'Änderung', 'gezeichnet', ''], z)); else wrap.append(h('div', { class: 'note' }, 'Noch kein Index – der erste Plan hat keinen Index. Bei jeder Änderung nach Herausgabe einen Eintrag anlegen.'));
    const ix = h('input', { type: 'text', value: A.naechsterIndex(revs), style: 'width:60px' }); const tx = h('input', { type: 'text', placeholder: 'Was wurde geändert? z. B. Fenster Bad auf 1,01 m verbreitert', style: 'flex:1' }); const vn = h('input', { type: 'text', value: 'TW', style: 'width:70px' });
    const neu = () => { if (!tx.value.trim()) { tx.focus(); this.app.toast('Bitte die Änderung beschreiben', true); return; } doc.change('Planindex', () => { meta.revisionen = meta.revisionen || []; meta.revisionen.push({ index: ix.value.trim() || A.naechsterIndex(meta.revisionen), datum: new Date().toISOString().slice(0, 10), text: tx.value.trim(), von: vn.value.trim() }); meta.index = meta.revisionen[meta.revisionen.length - 1].index; }); this.app.toast('Index angelegt – steht ab jetzt im Plankopf'); };
    tx.onkeydown = (e) => { if (e.key === 'Enter') neu(); };
    wrap.append(h('div', { class: 'ls-neu' }, h('span', {}, 'Neuer Index'), ix, tx, vn, h('button', { class: 'btn pri sm', onclick: neu }, '+ Eintragen')));
    wrap.append(h('div', { class: 'note', style: 'margin-top:12px' }, 'Im Plandruck erscheinen über dem Plankopf die letzten fünf Änderungen (Index, Datum, Änderung, Zeichner); im Plankopf steht „Plan-Nr. / Index“ und der Planstatus.'));
    return wrap;
  }
  /* ───── rechte Seite ───── */
  renderSide(body) {
    const rb = A.raumbuch(this.doc); const res = A.planPruefung(this.doc); const f = res.filter(r => r.stufe === 'fehler').length, w = res.filter(r => r.stufe === 'warn').length;
    body.append(h('div', { class: 'sec' }, h('h4', {}, 'Auf einen Blick'),
      h('div', { class: 'kv' }, ...[['Wohnfläche', n2(rb.summe.wfl) + ' m²'], ['Netto-Raumfläche', n2(rb.summe.nrf) + ' m²'], ['Brutto-Grundfläche', n2(rb.summe.bgf) + ' m²'], ['Räume', rb.zeilen.length], ['Plan-Prüfung', `${f} Fehler · ${w} Hinweise`], ['Planindex', this.doc.p.meta.index || '–']].flatMap(([k, v]) => [h('span', {}, k), h('b', {}, String(v))]))),
      h('div', { class: 'sec' }, h('h4', {}, 'Listen'), ...TABS.map(([k, l, ic]) => h('div', { class: 'li' + (this.tab === k ? ' on' : ''), onclick: () => this.setTab(k), html: icon(ic) + `<span class="grow">${l}</span>` }))),
      h('div', { class: 'muted', style: 'padding:10px 12px' }, 'Alle Listen rechnen live aus dem Grundriss. Export als CSV (öffnet in Excel) oder als PDF mit Briefkopf.'));
  }
}
export function mount(app, el) { return new Listen(app, el); }
