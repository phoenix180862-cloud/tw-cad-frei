// TW-CAD – Zeichen-Abstraktion: gleiche Zeichenbefehle für Bildschirm (Canvas) und PDF (jsPDF, vektoriell)
// Alle Koordinaten in Welt-mm. Strichstärken/Schrift in Papier-mm.

export class CanvasPainter {
  /** tf: {s (px pro mm), ox, oy} → screen = (x*s+ox, -y*s+oy); paperScale: z. B. 50 für 1:50 */
  constructor(ctx, tf, paperScale = 50, dpr = 1) {
    this.ctx = ctx; this.tf = tf; this.ps = paperScale; this.kind = 'screen'; this.dpr = dpr;
  }
  X(p) { return p.x * this.tf.s + this.tf.ox; }
  Y(p) { return -p.y * this.tf.s + this.tf.oy; }
  /** Papier-mm → Pixel (für Linien gedämpft, damit beim Reinzoomen nicht zu dick) */
  lw(paperMm) { const px = paperMm * this.ps * this.tf.s; return Math.max(0.6, Math.min(px, paperMm * 9)) * 1; }
  fs(paperMm) { return paperMm * this.ps * this.tf.s; }
  style(st) {
    const c = this.ctx; c.strokeStyle = st.color || '#111'; c.lineWidth = this.lw(st.w ?? 0.25);
    c.setLineDash(st.dash ? st.dash.map(d => Math.max(1, d * this.ps * this.tf.s)) : []);
    c.globalAlpha = st.alpha ?? 1; c.lineCap = st.cap || 'butt'; c.lineJoin = 'miter';
  }
  line(a, b, st = {}) { const c = this.ctx; this.style(st); c.beginPath(); c.moveTo(this.X(a), this.Y(a)); c.lineTo(this.X(b), this.Y(b)); c.stroke(); c.globalAlpha = 1; }
  polyline(pts, st = {}, closed = false) {
    if (pts.length < 2) return; const c = this.ctx; this.style(st); c.beginPath();
    c.moveTo(this.X(pts[0]), this.Y(pts[0])); for (let i = 1; i < pts.length; i++) c.lineTo(this.X(pts[i]), this.Y(pts[i]));
    if (closed) c.closePath(); c.stroke(); c.globalAlpha = 1;
  }
  /** polys: Liste von Ringen (Löcher über Even-Odd) */
  fill(polys, color, alpha = 1, stroke = null) {
    const c = this.ctx; c.beginPath();
    for (const p of polys) { if (p.length < 3) continue; c.moveTo(this.X(p[0]), this.Y(p[0])); for (let i = 1; i < p.length; i++) c.lineTo(this.X(p[i]), this.Y(p[i])); c.closePath(); }
    if (color) { c.globalAlpha = alpha; c.fillStyle = color; c.fill('evenodd'); c.globalAlpha = 1; }
    if (stroke) { this.style(stroke); c.stroke(); c.globalAlpha = 1; }
  }
  fillPattern(polys, pattern, alpha = 1) {
    const c = this.ctx; c.save(); c.beginPath();
    for (const p of polys) { if (p.length < 3) continue; c.moveTo(this.X(p[0]), this.Y(p[0])); for (let i = 1; i < p.length; i++) c.lineTo(this.X(p[i]), this.Y(p[i])); c.closePath(); }
    c.globalAlpha = alpha; c.fillStyle = pattern; c.fill('evenodd'); c.restore();
  }
  arc(cen, r, a0, a1, st = {}) {
    const c = this.ctx; this.style(st); c.beginPath();
    c.arc(this.X(cen), this.Y(cen), r * this.tf.s, -a0, -a1, a1 > a0); c.stroke(); c.globalAlpha = 1;
  }
  circle(cen, r, st = {}, fillColor = null) {
    const c = this.ctx; c.beginPath(); c.arc(this.X(cen), this.Y(cen), Math.max(0.5, r * this.tf.s), 0, Math.PI * 2);
    if (fillColor) { c.fillStyle = fillColor; c.fill(); }
    if (st) { this.style(st); c.stroke(); } c.globalAlpha = 1;
  }
  /** Text: size in Papier-mm; rot in Rad; align left|center|right; base: bottom|middle|top */
  text(p, str, size = 2.5, opt = {}) {
    const px = this.fs(size); if (px < 3.5 && !opt.force) return;
    const c = this.ctx; c.save(); c.translate(this.X(p), this.Y(p)); if (opt.rot) c.rotate(-opt.rot);
    c.font = `${opt.bold ? '600 ' : ''}${px}px ${opt.font || 'Inter, "Segoe UI", Arial, sans-serif'}`;
    c.fillStyle = opt.color || '#111'; c.textAlign = opt.align || 'left'; c.textBaseline = opt.base === 'middle' ? 'middle' : opt.base === 'top' ? 'top' : 'alphabetic';
    if (opt.bg) { const w = c.measureText(str).width; const x0 = opt.align === 'center' ? -w / 2 : opt.align === 'right' ? -w : 0; c.fillStyle = opt.bg; const y0 = opt.base === 'middle' ? -px * 0.6 : opt.base === 'top' ? 0 : -px * 0.95; c.fillRect(x0 - 2, y0, w + 4, px * 1.2); c.fillStyle = opt.color || '#111'; }
    c.fillText(str, 0, 0);
    if (opt.sup) { const w = c.measureText(str).width; c.font = `${px * 0.62}px Inter, Arial, sans-serif`; const ox = opt.align === 'center' ? w / 2 : opt.align === 'right' ? 0 : w; c.textAlign = 'left'; c.fillText(opt.sup, ox + px * 0.05, -px * 0.42); }
    c.restore();
  }
  textWidth(str, size) { const c = this.ctx; c.font = `${this.fs(size)}px Inter, Arial, sans-serif`; return c.measureText(str).width / this.tf.s; }
  image(img, x, y, w, h, alpha = 1, rot = 0) {
    const c = this.ctx; c.save(); c.globalAlpha = alpha;
    c.translate(this.X({ x, y }), this.Y({ x, y })); if (rot) c.rotate(-rot);
    c.drawImage(img, 0, -h * this.tf.s, w * this.tf.s, h * this.tf.s); c.restore();
  }
  clip(polys, fn) {
    const c = this.ctx; c.save(); c.beginPath();
    for (const p of polys) { c.moveTo(this.X(p[0]), this.Y(p[0])); for (let i = 1; i < p.length; i++) c.lineTo(this.X(p[i]), this.Y(p[i])); c.closePath(); }
    c.clip('evenodd'); fn(); c.restore();
  }
  get pxPerMm() { return this.tf.s; }
}

/** PDF-Ausgabe mit jsPDF (Einheit mm). Welt → Papier: (x - wx0)/scale + px0 ; y gespiegelt */
export class PdfPainter {
  constructor(pdf, view) { // view: {wx0, wy1, scale, px0, py0, clipRect}
    this.pdf = pdf; this.v = view; this.ps = view.scale; this.kind = 'pdf'; this.tf = { s: 1 / view.scale };
  }
  X(p) { return (p.x - this.v.wx0) / this.v.scale + this.v.px0; }
  Y(p) { return (this.v.wy1 - p.y) / this.v.scale + this.v.py0; }
  col(c) { return hexToRgb(c || '#000'); }
  style(st) {
    const [r, g, b] = this.col(st.color || '#111'); this.pdf.setDrawColor(r, g, b);
    this.pdf.setLineWidth(Math.max(0.05, st.w ?? 0.25));
    this.pdf.setLineDashPattern(st.dash ? st.dash : [], 0);
    this.alpha(st.alpha ?? 1);
  }
  alpha(a) { try { this.pdf.setGState(new this.pdf.GState({ opacity: a, 'stroke-opacity': a })); } catch (e) { } }
  line(a, b, st = {}) { this.style(st); this.pdf.line(this.X(a), this.Y(a), this.X(b), this.Y(b)); }
  polyline(pts, st = {}, closed = false) {
    if (pts.length < 2) return; this.style(st);
    this.pdf.moveTo(this.X(pts[0]), this.Y(pts[0])); for (let i = 1; i < pts.length; i++) this.pdf.lineTo(this.X(pts[i]), this.Y(pts[i]));
    if (closed) this.pdf.close(); this.pdf.stroke(); this.alpha(1);
  }
  fill(polys, color, alpha = 1, stroke = null) {
    const ok = polys.filter(p => p.length >= 3); if (!ok.length) return;
    for (const p of ok) { this.pdf.moveTo(this.X(p[0]), this.Y(p[0])); for (let i = 1; i < p.length; i++) this.pdf.lineTo(this.X(p[i]), this.Y(p[i])); this.pdf.close(); }
    if (color) { const [r, g, b] = this.col(color); this.pdf.setFillColor(r, g, b); this.alpha(alpha); }
    if (color && stroke) { this.style(stroke); this.pdf.fillStrokeEvenOdd ? this.pdf.fillStrokeEvenOdd() : this.pdf.fillEvenOdd(); }
    else if (color) this.pdf.fillEvenOdd();
    else if (stroke) { this.style(stroke); this.pdf.stroke(); }
    this.alpha(1);
    if (color && stroke && !this.pdf.fillStrokeEvenOdd) for (const p of ok) this.polyline(p, stroke, true);
  }
  fillPattern(polys, pattern, alpha = 1) { this.fill(polys, pattern && pattern.pdfColor ? pattern.pdfColor : '#dddddd', alpha); }
  arc(cen, r, a0, a1, st = {}) {
    const n = Math.max(8, Math.ceil(Math.abs(a1 - a0) / (Math.PI / 36))); const pts = [];
    for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; pts.push({ x: cen.x + Math.cos(a) * r, y: cen.y + Math.sin(a) * r }); }
    this.polyline(pts, st);
  }
  circle(cen, r, st = {}, fillColor = null) {
    if (fillColor) { const [rr, g, b] = this.col(fillColor); this.pdf.setFillColor(rr, g, b); }
    if (st) this.style(st);
    this.pdf.circle(this.X(cen), this.Y(cen), r / this.v.scale, fillColor && st ? 'FD' : fillColor ? 'F' : 'S'); this.alpha(1);
  }
  text(p, str, size = 2.5, opt = {}) {
    str = pdfSafe(str); if (opt.sup) opt = { ...opt, sup: pdfSafe(opt.sup) };
    const pt = size / 0.3528 * 1.0; this.pdf.setFontSize(pt); this.pdf.setFont('helvetica', opt.bold ? 'bold' : 'normal');
    const [r, g, b] = this.col(opt.color || '#111'); this.pdf.setTextColor(r, g, b);
    const base = opt.base === 'middle' ? 'middle' : opt.base === 'top' ? 'top' : 'alphabetic';
    const deg = opt.rot ? opt.rot * 180 / Math.PI : 0;
    if (opt.bg) { const w = this.pdf.getTextWidth(str); /* Hintergrund nur waagrecht */ if (!deg) { const [br, bg, bb] = this.col(opt.bg); this.pdf.setFillColor(br, bg, bb); const x0 = opt.align === 'center' ? this.X(p) - w / 2 : opt.align === 'right' ? this.X(p) - w : this.X(p); const y0 = base === 'middle' ? this.Y(p) - size * 0.6 : base === 'top' ? this.Y(p) : this.Y(p) - size * 0.95; this.pdf.rect(x0 - 0.4, y0, w + 0.8, size * 1.2, 'F'); } }
    this.pdf.text(str, this.X(p), this.Y(p), { align: opt.align || 'left', baseline: base, angle: deg });
    if (opt.sup) {
      const w = this.pdf.getTextWidth(str); const ang = opt.rot || 0;
      const ox = opt.align === 'center' ? w / 2 : opt.align === 'right' ? 0 : w;
      this.pdf.setFontSize(pt * 0.62);
      const dx = (ox + 0.2) * Math.cos(ang) - (size * 0.42) * Math.sin(ang), dy = (ox + 0.2) * Math.sin(ang) + (size * 0.42) * Math.cos(ang);
      this.pdf.text(opt.sup, this.X(p) + dx, this.Y(p) - dy, { baseline: base, angle: deg });
    }
  }
  textWidth(str, size) { this.pdf.setFontSize(size / 0.3528); return this.pdf.getTextWidth(str) * this.v.scale; }
  image(img, x, y, w, h, alpha = 1) {
    try { this.alpha(alpha); this.pdf.addImage(img, 'PNG', this.X({ x, y: y + h }), this.Y({ x, y: y + h }), w / this.v.scale, h / this.v.scale); this.alpha(1); } catch (e) { }
  }
  clip(polys, fn) {
    const pdf = this.pdf;
    try {
      pdf.saveGraphicsState();
      for (const p of polys) { pdf.moveTo(this.X(p[0]), this.Y(p[0])); for (let i = 1; i < p.length; i++) pdf.lineTo(this.X(p[i]), this.Y(p[i])); pdf.close(); }
      pdf.clipEvenOdd(); pdf.discardPath(); fn(); pdf.restoreGraphicsState();
    } catch (e) { fn(); }
  }
  get pxPerMm() { return 1 / this.v.scale * 4; }
}

export function hexToRgb(c) {
  if (Array.isArray(c)) return c;
  if (c.startsWith('rgb')) { const m = c.match(/\d+(\.\d+)?/g).map(Number); return [m[0], m[1], m[2]]; }
  let h = c.replace('#', ''); if (h.length === 3) h = h.split('').map(x => x + x).join('');
  const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function shade(hex, f) { // f -1..1
  const [r, g, b] = hexToRgb(hex); const t = f < 0 ? 0 : 255, p = Math.abs(f);
  const m = (x) => Math.round((t - x) * p + x);
  return '#' + [m(r), m(g), m(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

const PDF_MAP = { '≥': '>=', '≤': '<=', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '−': '-', '→': '->', '←': '<-', '⊕': '+', '…': '...', '„': '"', '“': '"', '”': '"', '‚': "'", '‘': "'", '’': "'", '⁵': '5', '≈': 'ca.', '↔': '<->', '✓': 'ok' };
export function pdfSafe(s) { if (globalThis.__twPdfUnicode) return String(s); /* eingebettete Unicode-Schrift (i18n.pdfVorbereiten) kann alle Zeichen */ return String(s).replace(/[≥≤⅓⅔−→←⊕…„“”‚‘’≈↔✓]/g, c => PDF_MAP[c] || '?'); }
