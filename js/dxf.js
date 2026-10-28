// TW-CAD – DXF-Export (AutoCAD R12, Einheit mm) über dieselben Zeichenbefehle wie Bildschirm/PDF
import { drawPlan } from './render2d.js?v=20261028-0429';
import { drawSite } from './site.js?v=20261028-0429';
import { hexToRgb } from './painter.js?v=20261028-0429';

function aci(hex) { // grobe Farbzuordnung auf AutoCAD-Farbindex
  const [r, g, b] = hexToRgb(hex || '#000'); if (r + g + b < 120) return 7; if (r > 180 && g < 90 && b < 90) return 1; if (r > 180 && g > 180 && b < 90) return 2; if (g > 140 && r < 120 && b < 120) return 3; if (b > 150 && r < 120) return 5; if (r > 150 && b > 150 && g < 120) return 6; if (r > 200 && g > 200 && b > 200) return 9; return 8;
}
class DxfPainter {
  constructor(ps) { this.out = []; this.kind = 'dxf'; this.ps = ps; this.tf = { s: 1 }; this.layer = 'TWCAD'; }
  e(...kv) { for (let i = 0; i < kv.length; i += 2) this.out.push(String(kv[i]), String(kv[i + 1])); }
  line(a, b, st = {}) { this.e(0, 'LINE', 8, st.layer || this.layer, 62, aci(st.color), 10, a.x.toFixed(2), 20, a.y.toFixed(2), 30, 0, 11, b.x.toFixed(2), 21, b.y.toFixed(2), 31, 0); }
  polyline(pts, st = {}, closed = false) { if (pts.length < 2) return; this.e(0, 'POLYLINE', 8, st.layer || this.layer, 62, aci(st.color), 66, 1, 70, closed ? 1 : 0); for (const p of pts) this.e(0, 'VERTEX', 8, st.layer || this.layer, 10, p.x.toFixed(2), 20, p.y.toFixed(2), 30, 0); this.e(0, 'SEQEND', 8, st.layer || this.layer); }
  fill(polys, color, alpha, stroke) { for (const p of polys) if (p.length > 2) this.polyline(p, stroke || { color: color }, true); }
  fillPattern(polys) { this.fill(polys, '#888'); }
  arc(c, r, a0, a1, st = {}) { let s = a0 * 180 / Math.PI, e = a1 * 180 / Math.PI; if (e < s) [s, e] = [e, s]; this.e(0, 'ARC', 8, this.layer, 62, aci(st.color), 10, c.x.toFixed(2), 20, c.y.toFixed(2), 30, 0, 40, r.toFixed(2), 50, s.toFixed(3), 51, e.toFixed(3)); }
  circle(c, r, st = {}) { this.e(0, 'CIRCLE', 8, this.layer, 62, aci(st && st.color), 10, c.x.toFixed(2), 20, c.y.toFixed(2), 30, 0, 40, r.toFixed(2)); }
  text(p, str, size = 2.5, opt = {}) { const hgt = size * this.ps; const al = opt.align === 'center' ? 1 : opt.align === 'right' ? 2 : 0; this.e(0, 'TEXT', 8, 'TEXT', 62, aci(opt.color), 10, p.x.toFixed(2), 20, p.y.toFixed(2), 30, 0, 40, hgt.toFixed(1), 1, String(str) + (opt.sup ? opt.sup : ''), 50, ((opt.rot || 0) * 180 / Math.PI).toFixed(2), 72, al, 11, p.x.toFixed(2), 21, p.y.toFixed(2), 31, 0); }
  textWidth(s, size) { return String(s).length * size * this.ps * 0.6; }
  image() { } clip(p, fn) { fn(); }
  get pxPerMm() { return 1; }
  X(p) { return p.x; } Y(p) { return p.y; }
  file() { return ['0', 'SECTION', '2', 'HEADER', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', '0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LAYER', '70', '2', '0', 'LAYER', '2', 'TWCAD', '70', '0', '62', '7', '6', 'CONTINUOUS', '0', 'LAYER', '2', 'TEXT', '70', '0', '62', '7', '6', 'CONTINUOUS', '0', 'ENDTAB', '0', 'ENDSEC', '0', 'SECTION', '2', 'ENTITIES', ...this.out, '0', 'ENDSEC', '0', 'EOF'].join('\r\n'); }
}
export function exportDXF(app, storeyId = null) {
  const doc = app.doc; const ps = doc.p.settings.massstab || 50; const P = new DxfPainter(ps);
  if (app.mode === 'lageplan' && !storeyId) drawSite(P, doc, { paperScale: ps });
  else drawPlan(P, doc, { storey: storeyId || doc.p.activeStorey, tiles: 'plan', paperScale: ps, underlays: false, cutLabels: false });
  const name = `${doc.p.name} – ${app.mode === 'lageplan' && !storeyId ? 'Lageplan' : 'Grundriss ' + doc.storeyById(storeyId || doc.p.activeStorey).name}.dxf`.replace(/[\\/:*?"<>|]/g, '_');
  app.downloadBlob(new Blob([P.file()], { type: 'application/dxf' }), name); app.toast('DXF exportiert (Einheit mm) ✓');
}
