// TW-CAD – 2D-Ansicht: Zoom, Verschieben, Raster, Ereignisse
import * as G from './geom.js?v=20261028-0429';
import { CanvasPainter } from './painter.js?v=20261028-0429';
import { drawPlan } from './render2d.js?v=20261028-0429';
import { drawSite } from './site.js?v=20261028-0429';
import { gridStep } from './snap.js?v=20261028-0429';
import { tr } from './i18n.js?v=20261028-0429';

export class View2D {
  constructor(app, canvas) {
    this.app = app; this.cv = canvas; this.ctx = canvas.getContext('2d');
    this.tf = { s: 0.12, ox: 400, oy: 400 }; this.dpr = window.devicePixelRatio || 1;
    this.mouse = { x: 0, y: 0, world: { x: 0, y: 0 }, inside: false };
    this.need = true; this.pointers = new Map(); this.panning = null;
    new ResizeObserver(() => this.resize()).observe(canvas.parentElement);
    this.bind(); this.resize();
    const loop = () => { if (this.need && !this.cv.parentElement.classList.contains('hidden') && this.cv.offsetParent !== null) { this.need = false; this.draw(); } requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  }
  resize() {
    const r = this.cv.parentElement.getBoundingClientRect(); this.dpr = window.devicePixelRatio || 1;
    this.w = r.width; this.h = r.height; this.cv.width = Math.max(1, r.width * this.dpr); this.cv.height = Math.max(1, r.height * this.dpr); this.need = true;
  }
  redraw() { this.need = true; }
  toWorld(sx, sy) { return { x: (sx - this.tf.ox) / this.tf.s, y: -(sy - this.tf.oy) / this.tf.s }; }
  toScreen(p) { return { x: p.x * this.tf.s + this.tf.ox, y: -p.y * this.tf.s + this.tf.oy }; }
  zoomAt(sx, sy, f) {
    const w = this.toWorld(sx, sy); const s = Math.max(0.002, Math.min(20, this.tf.s * f));
    this.tf.s = s; this.tf.ox = sx - w.x * s; this.tf.oy = sy + w.y * s; this.need = true; this.app.onViewChange && this.app.onViewChange();
  }
  fit(bb, pad = 60) {
    if (!bb || !isFinite(bb.x0) || bb.w + bb.h < 1) bb = { x0: -1000, y0: -1000, x1: 9000, y1: 7000, w: 10000, h: 8000 };
    const s = Math.min((this.w - pad * 2) / Math.max(bb.w, 500), (this.h - pad * 2) / Math.max(bb.h, 500));
    this.tf.s = Math.max(0.002, Math.min(5, s));
    this.tf.ox = this.w / 2 - (bb.x0 + bb.w / 2) * this.tf.s; this.tf.oy = this.h / 2 + (bb.y0 + bb.h / 2) * this.tf.s; this.need = true;
  }
  draw() {
    const c = this.ctx, app = this.app;
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.fillStyle = '#fbfbf9'; c.fillRect(0, 0, this.w, this.h);
    this.drawGrid(c);
    const ms = app.massstab ? app.massstab() : (app.doc.p.settings.massstab || 50);
    const P = new CanvasPainter(c, this.tf, ms, this.dpr);
    const opt = { selection: app.selection, tiles: app.tileMode, ghost: app.ghost, paperScale: ms };
    try {
      if (app.mode === 'lageplan') drawSite(P, app.doc, opt);
      else drawPlan(P, app.doc, opt);
    } catch (e) { console.error(e); }
    app.drawOverlay(P, c);
    this.massstabsleiste(c, ms);
  }
  /** Maßstabsleiste unten links + Anzeige „Ansicht ≈ 1:x“ */
  massstabsleiste(c, ms) {
    c.save(); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0); c.setLineDash([]); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'; c.shadowBlur = 0;
    const s = this.tf.s; const ziel = 130 / s; const stufen = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 200000];
    const L = stufen.find(v => v >= ziel * 0.7) || stufen[stufen.length - 1]; const px = L * s; const x = 18, y = this.h - 34, n = 5;
    c.fillStyle = 'rgba(255,255,255,.92)'; c.fillRect(x - 10, y - 20, px + 100, 34); c.strokeStyle = 'rgba(0,0,0,.15)'; c.strokeRect(x - 9.5, y - 19.5, px + 99, 33);
    for (let i = 0; i < n; i++) { c.fillStyle = i % 2 ? '#fff' : '#1b1f24'; c.fillRect(x + i * px / n, y, px / n, 6); }
    c.strokeStyle = '#1b1f24'; c.lineWidth = 1; c.strokeRect(x + 0.5, y + 0.5, px, 6);
    const txt = (v) => v >= 1000 ? String(v / 1000).replace('.', ',') + ' m' : v >= 10 ? (v / 10) + ' cm' : v + ' mm';
    c.fillStyle = '#1b1f24'; c.font = '600 11px Inter, Segoe UI, Arial'; c.textAlign = 'left'; c.fillText('0', x - 3, y - 4); c.textAlign = 'center'; c.fillText(txt(L), x + px, y - 4);
    c.textAlign = 'left'; c.font = '700 12px Inter, Segoe UI, Arial'; c.fillText('M 1:' + ms, x + px + 14, y + 7); c.restore();
    const ansicht = Math.round((96 / 25.4) / s); const el = (this.app.uiDoc || document).getElementById ? document.getElementById('msAnsicht') : null;
    const t = tr('Ansicht ≈ 1:' + (ansicht >= 100 ? Math.round(ansicht / 5) * 5 : ansicht)); if (el && el.textContent !== t) el.textContent = t;
    try { const w = this.app.wz; if (w && !w.closed) { const e2 = w.document.getElementById('msAnsicht'); if (e2 && e2.textContent !== t) e2.textContent = t; } } catch (e) { }
  }
  drawGrid(c) {
    const st = this.app.doc.p.settings; if (!st.rasterAn) return;
    const gs = gridStep(this.app); const s = this.tf.s; const step = gs * s;
    const w0 = this.toWorld(0, this.h), w1 = this.toWorld(this.w, 0);
    const x0 = Math.floor(w0.x / gs) * gs, y0 = Math.floor(w0.y / gs) * gs;
    c.beginPath();
    if (step > 9) {
      for (let x = x0; x <= w1.x; x += gs) { const sx = Math.round(x * s + this.tf.ox) + 0.5; c.moveTo(sx, 0); c.lineTo(sx, this.h); }
      for (let y = y0; y <= w1.y; y += gs) { const sy = Math.round(-y * s + this.tf.oy) + 0.5; c.moveTo(0, sy); c.lineTo(this.w, sy); }
      c.strokeStyle = '#eceef0'; c.lineWidth = 1; c.stroke();
    }
    const big = gs * 8; c.beginPath();
    const bx0 = Math.floor(w0.x / big) * big, by0 = Math.floor(w0.y / big) * big;
    for (let x = bx0; x <= w1.x; x += big) { const sx = Math.round(x * s + this.tf.ox) + 0.5; c.moveTo(sx, 0); c.lineTo(sx, this.h); }
    for (let y = by0; y <= w1.y; y += big) { const sy = Math.round(-y * s + this.tf.oy) + 0.5; c.moveTo(0, sy); c.lineTo(this.w, sy); }
    c.strokeStyle = '#e0e3e7'; c.stroke();
    // Ursprung
    const o = this.toScreen({ x: 0, y: 0 }); c.strokeStyle = '#c8102e55'; c.beginPath(); c.moveTo(o.x - 12, o.y); c.lineTo(o.x + 12, o.y); c.moveTo(o.x, o.y - 12); c.lineTo(o.x, o.y + 12); c.stroke();
  }
  bind() {
    const cv = this.cv;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('wheel', e => { e.preventDefault(); const r = cv.getBoundingClientRect(); const f = Math.pow(1.0015, -e.deltaY * (e.deltaMode ? 30 : 1)); this.zoomAt(e.clientX - r.left, e.clientY - r.top, f); this.app.pointerMove(this.mouseEv(e)); }, { passive: false });
    cv.addEventListener('pointerdown', e => {
      cv.setPointerCapture(e.pointerId); this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) { this.app.cancelPress && this.app.cancelPress(); this.pinch = this.pinchState(); return; }
      if (e.button === 1 || (e.button === 0 && this.app.spaceDown) || (e.button === 2 && e.shiftKey)) { this.panning = { x: e.clientX, y: e.clientY, ox: this.tf.ox, oy: this.tf.oy }; cv.style.cursor = 'grabbing'; return; }
      this.app.pointerDown(this.mouseEv(e));
    });
    cv.addEventListener('pointermove', e => {
      if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pinch && this.pointers.size === 2) { this.doPinch(); return; }
      if (this.panning) { this.tf.ox = this.panning.ox + e.clientX - this.panning.x; this.tf.oy = this.panning.oy + e.clientY - this.panning.y; this.need = true; return; }
      this.app.pointerMove(this.mouseEv(e));
    });
    const up = e => {
      this.pointers.delete(e.pointerId);
      if (this.pinch) { if (this.pointers.size < 2) this.pinch = null; return; }
      if (this.panning) { this.panning = null; cv.style.cursor = ''; return; }
      this.app.pointerUp(this.mouseEv(e));
    };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('pointerleave', () => { this.mouse.inside = false; this.need = true; });
    cv.addEventListener('dblclick', e => this.app.dblClick(this.mouseEv(e)));
  }
  pinchState() { const [a, b] = [...this.pointers.values()]; return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, s: this.tf.s, ox: this.tf.ox, oy: this.tf.oy }; }
  doPinch() {
    const [a, b] = [...this.pointers.values()]; const r = this.cv.getBoundingClientRect();
    const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2; const p = this.pinch;
    const s = Math.max(0.002, Math.min(20, p.s * d / p.d));
    const w = { x: (p.cx - r.left - p.ox) / p.s, y: -(p.cy - r.top - p.oy) / p.s };
    this.tf.s = s; this.tf.ox = cx - r.left - w.x * s; this.tf.oy = cy - r.top + w.y * s; this.need = true;
  }
  mouseEv(e) {
    const r = this.cv.getBoundingClientRect(); const sx = e.clientX - r.left, sy = e.clientY - r.top;
    const world = this.toWorld(sx, sy); this.mouse = { x: sx, y: sy, world, inside: true };
    return { sx, sy, world, button: e.button, shift: e.shiftKey, ctrl: e.ctrlKey || e.metaKey, alt: e.altKey, pointerType: e.pointerType, detail: e.detail };
  }
}
