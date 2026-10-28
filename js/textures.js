// TW-CAD – Prozedurale Texturen (Fliesen, Fassaden, Dächer) – nur im Browser
import { hexToRgb, shade } from './painter.js?v=20261028-0429';

const cache = new Map();
const imgs = new Map();
export function imageFor(src) { let i = imgs.get(src); if (!i) { i = new Image(); i.crossOrigin = 'anonymous'; i.src = src; imgs.set(src, i); } return i; }
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rng(seed) { let s = seed >>> 0 || 1; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 100000) / 100000; }; }
function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** Wertrauschen (glatt), periodisch */
function noiseField(w, h, cell, seed) {
  const r = rng(seed); const gw = Math.ceil(w / cell) + 1, gh = Math.ceil(h / cell) + 1;
  const g = new Float32Array(gw * gh); for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => {
    const fx = x / cell, fy = y / cell; const x0 = Math.floor(fx), y0 = Math.floor(fy); const tx = fx - x0, ty = fy - y0;
    const at = (i, j) => g[((j % (gh - 1)) * gw) + (i % (gw - 1))];
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}
function fbm(w, h, seed, base = 64, oct = 4) {
  const fs = []; for (let o = 0; o < oct; o++) fs.push(noiseField(w, h, Math.max(2, base / Math.pow(2, o)), seed + o * 101));
  return (x, y) => { let s = 0, a = 1, n = 0; for (const f of fs) { s += f(x, y) * a; n += a; a *= 0.5; } return s / n; };
}
function pixelFill(c, fn) {
  const ctx = c.getContext('2d'); const img = ctx.getImageData(0, 0, c.width, c.height); const d = img.data;
  for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) { const [r, g, b] = fn(x, y); const i = (y * c.width + x) * 4; d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
}
const clamp = (v) => Math.max(0, Math.min(255, v));

/* ───────── Fliesen-Oberflächen ───────── */
export const TILE_TEXTUREN = { uni: 'Uni / einfarbig', marmor: 'Marmor', beton: 'Betonoptik', holz: 'Holzoptik', naturstein: 'Naturstein / Travertin', terrazzo: 'Terrazzo', schiefer: 'Schiefer', zement: 'Zementfliese (Muster)', glanz: 'Glänzend (Wand)' };

export function tileSurface(cfg, pxW = 256) {
  const key = ['t', cfg.textur, cfg.farbe, cfg.farbe2, cfg.L, cfg.B, (cfg.bildData || '').length + (cfg.bildData || '').slice(-40), pxW].join('|');
  if (cache.has(key)) return cache.get(key);
  const ratio = (cfg.B || 300) / (cfg.L || 600); const W = pxW, H = Math.max(8, Math.round(pxW * ratio));
  const c = mk(W, H); const base = hexToRgb(cfg.farbe || '#d9d4cc'); const alt = hexToRgb(cfg.farbe2 || shade(cfg.farbe || '#d9d4cc', -0.35));
  const seed = hash(key);
  const t = cfg.textur || 'uni';
  if (t === 'bild' && cfg.bildData) {
    const img = imageFor(cfg.bildData);
    if (img.complete && img.naturalWidth) { c.getContext('2d').drawImage(img, 0, 0, W, H); }
    else { const ctx = c.getContext('2d'); ctx.fillStyle = cfg.farbe || '#ddd'; ctx.fillRect(0, 0, W, H); img.addEventListener('load', () => { cache.delete(key); window.TWCAD && window.TWCAD.redraw(); window.TWCAD && window.TWCAD.modeView && window.TWCAD.modeView.draw && window.TWCAD.modeView.draw(); }, { once: true }); return c; }
  }
  else if (t === 'marmor') {
    const n = fbm(W, H, seed, W / 3, 5);
    pixelFill(c, (x, y) => { const v = Math.abs(Math.sin((x * 0.6 + y * 0.9) / W * 6 + n(x, y) * 9)); const vein = Math.pow(1 - v, 18); const k = 0.96 + n(x * 2, y * 2) * 0.06; return [clamp(base[0] * k * (1 - vein) + alt[0] * vein), clamp(base[1] * k * (1 - vein) + alt[1] * vein), clamp(base[2] * k * (1 - vein) + alt[2] * vein)]; });
  } else if (t === 'beton' || t === 'schiefer') {
    const n = fbm(W, H, seed, W / 4, 5), m = fbm(W, H, seed + 7, 4, 2);
    pixelFill(c, (x, y) => { const k = 0.82 + n(x, y) * 0.3 + (m(x, y) - 0.5) * 0.08 + (t === 'schiefer' ? Math.sin(y * 0.4 + n(x, y) * 6) * 0.04 : 0); return [clamp(base[0] * k), clamp(base[1] * k), clamp(base[2] * k)]; });
  } else if (t === 'holz') {
    const n = fbm(W, H, seed, W / 6, 4);
    pixelFill(c, (x, y) => { const g = Math.sin((y + n(x, y) * 30) * 0.35) * 0.5 + 0.5; const k = 0.85 + g * 0.15 + (n(x * 3, y) - 0.5) * 0.1; return [clamp(base[0] * k), clamp(base[1] * k), clamp(base[2] * k)]; });
  } else if (t === 'naturstein') {
    const n = fbm(W, H, seed, W / 5, 5);
    pixelFill(c, (x, y) => { const l = Math.sin((y + n(x, y) * 40) * 0.12); const k = 0.9 + l * 0.05 + (n(x * 3, y * 3) - 0.5) * 0.14; return [clamp(base[0] * k), clamp(base[1] * k), clamp(base[2] * k)]; });
  } else if (t === 'terrazzo') {
    const ctx = c.getContext('2d'); ctx.fillStyle = cfg.farbe || '#e5e1da'; ctx.fillRect(0, 0, W, H); const r = rng(seed);
    const cols = [alt, hexToRgb(shade(cfg.farbe || '#e5e1da', -0.55)), hexToRgb(shade(cfg.farbe || '#e5e1da', 0.4)), [170, 120, 90]];
    for (let i = 0; i < W * H / 60; i++) { const cc = cols[Math.floor(r() * cols.length)]; ctx.fillStyle = `rgb(${cc})`; const x = r() * W, y = r() * H, s = 1 + r() * W / 40; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 5; k++) ctx.lineTo(x + (r() - 0.5) * s * 2, y + (r() - 0.5) * s * 2); ctx.fill(); }
  } else if (t === 'zement') {
    const ctx = c.getContext('2d'); ctx.fillStyle = cfg.farbe || '#e9e4da'; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgb(${alt})`; ctx.save(); ctx.translate(W / 2, H / 2);
    for (let k = 0; k < 4; k++) { ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(W * 0.25, -H * 0.05, W * 0.48, -H * 0.48); ctx.quadraticCurveTo(W * 0.05, -H * 0.25, 0, 0); ctx.fill(); }
    ctx.restore(); ctx.strokeStyle = `rgb(${alt})`; ctx.lineWidth = W / 40; ctx.strokeRect(W * 0.04, H * 0.04, W * 0.92, H * 0.92);
  } else {
    const n = fbm(W, H, seed, W / 3, 3);
    pixelFill(c, (x, y) => { const k = 0.975 + n(x, y) * 0.05 + (t === 'glanz' ? (1 - (x + y) / (W + H)) * 0.06 : 0); return [clamp(base[0] * k), clamp(base[1] * k), clamp(base[2] * k)]; });
  }
  cache.set(key, c); return c;
}

/** Füllmuster je Fliesenstück für Canvas-Painter (Kundenansicht) */
export function tilePatternFor(ctx, cfg) {
  if (typeof document === 'undefined' || !ctx) return null;
  const surf = tileSurface(cfg, 256); const pat = ctx.createPattern(surf, 'repeat');
  return {
    forPiece(P, piece, k) {
      const r = piece.rect; if (!r) { P.fill([piece.poly], cfg.farbe, 1); return; }
      // Lokale Fliese (r.x,r.y,w,h im Fliesensystem) → Bildschirm über 3 Punkte
      const toW = piece._toW; const res = piece;
      const corner = res.worldRect || null;
      const p0 = piece.wr0, p1 = piece.wr1, p2 = piece.wr2;
      if (!p0) { P.fill([piece.poly], cfg.farbe, 1); return; }
      const X = (p) => P.X(p), Y = (p) => P.Y(p);
      const sw = surf.width, sh = surf.height;
      const a = (X(p1) - X(p0)) / sw, b = (Y(p1) - Y(p0)) / sw, c = (X(p2) - X(p0)) / sh, d = (Y(p2) - Y(p0)) / sh;
      // Variation: Bild horizontal spiegeln/versetzen je nach Index
      const flip = (k * 2654435761 >>> 0) % 4;
      let m = new DOMMatrix([a, b, c, d, X(p0), Y(p0)]);
      if (flip === 1) m = m.translate(sw, 0).scale(-1, 1); else if (flip === 2) m = m.translate(0, sh).scale(1, -1); else if (flip === 3) m = m.translate(sw, sh).scale(-1, -1);
      pat.setTransform(m);
      P.fillPattern([piece.poly], pat, 1);
    }
  };
}

/* ───────── Fassaden / Dach / Boden für 3D ───────── */
/** Liefert {canvas, w, h} – w/h = abgebildete Größe in mm */
export function surfaceTexture(mat, farbeHex) {
  const col = farbeHex || (mat && mat.farben && mat.farben[0] && mat.farben[0].hex) || '#d8d4cc';
  const muster = (mat && mat.muster) || 'putz';
  const r = (mat && mat.rasterMm) || [];
  const fuge = (mat && mat.fugeMm) || 0;
  const key = ['f', muster, col, r.join('x'), fuge].join('|');
  if (cache.has(key)) return cache.get(key);
  const base = hexToRgb(col); const dark = shade(col, -0.3), light = shade(col, 0.15);
  const seed = hash(key); const R = rng(seed);
  let out;
  const solid = (W, H, fn) => { const c = mk(W, H); const ctx = c.getContext('2d'); fn(ctx, W, H); return c; };
  switch (muster) {
    case 'klinker': {
      const bw = r[0] || 240, bh = r[1] || 71, f = fuge || 12; const nx = 2, ny = 4; const Wm = nx * (bw + f), Hm = ny * (bh + f);
      const sc = 512 / Wm; const c = mk(512, Math.round(Hm * sc)); const ctx = c.getContext('2d');
      ctx.fillStyle = mat.fugenFarbe || '#b9b3aa'; ctx.fillRect(0, 0, c.width, c.height);
      for (let j = 0; j < ny; j++) for (let i = -1; i <= nx; i++) {
        const x = (i * (bw + f) + (j % 2 ? (bw + f) / 2 : 0)) * sc, y = (j * (bh + f)) * sc;
        const v = (R() - 0.5) * 0.18; ctx.fillStyle = shade(col, v); ctx.fillRect(x, y, bw * sc, bh * sc);
        ctx.fillStyle = 'rgba(0,0,0,0.06)'; ctx.fillRect(x, y + bh * sc * 0.75, bw * sc, bh * sc * 0.25);
      }
      out = { canvas: c, w: Wm, h: Hm }; break;
    }
    case 'schalung_h': case 'schalung_v': case 'boden_deckel': case 'rhombus': case 'holzschindel': {
      const pos = r.filter(x => x > 0); const bw = muster === 'boden_deckel' ? (r[0] || 200) : (pos.length ? Math.min(...pos) : (muster === 'rhombus' ? 68 : 146)), f = fuge || (muster === 'rhombus' ? 12 : 4); const n = 6; const Wm = n * (bw + f), Hm = 1200;
      const c = mk(512, 512); const ctx = c.getContext('2d'); const sx = 512 / Wm, sy = 512 / Hm;
      ctx.fillStyle = '#1d1a17'; ctx.fillRect(0, 0, 512, 512);
      const nf = fbm(512, 512, seed, 40, 4);
      for (let i = 0; i < n; i++) {
        const x0 = i * (bw + f) * sx, x1 = x0 + bw * sx; const v = (R() - 0.5) * 0.16;
        const bc = hexToRgb(shade(col, v)); const img = ctx.getImageData(Math.floor(x0), 0, Math.max(1, Math.ceil(x1 - x0)), 512);
        for (let y = 0; y < 512; y++) for (let x = 0; x < img.width; x++) { const g = Math.sin((x * 0.9 + nf(x + x0, y) * 25) * 0.6) * 0.06 + (nf(x * 4 + x0, y * 0.3) - 0.5) * 0.12; const k = 1 + g; const id = (y * img.width + x) * 4; img.data[id] = clamp(bc[0] * k); img.data[id + 1] = clamp(bc[1] * k); img.data[id + 2] = clamp(bc[2] * k); img.data[id + 3] = 255; }
        ctx.putImageData(img, Math.floor(x0), 0);
        if (muster === 'boden_deckel' && i % 2 === 1) { ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x0 - 3, 0, 3, 512); ctx.fillRect(x1, 0, 3, 512); }
        if (muster === 'rhombus') { ctx.fillStyle = 'rgba(255,255,255,0.08)'; ctx.fillRect(x0, 0, (x1 - x0) * 0.3, 512); }
      }
      if (muster === 'holzschindel') { ctx.fillStyle = 'rgba(0,0,0,0.35)'; for (let y = 0; y < 512; y += 64) { ctx.fillRect(0, y, 512, 4); } }
      if (muster === 'schalung_h') { const c2 = mk(512, 512); const x2 = c2.getContext('2d'); x2.translate(256, 256); x2.rotate(Math.PI / 2); x2.drawImage(c, -256, -256); out = { canvas: c2, w: Hm, h: Wm }; }
      else out = { canvas: c, w: Wm, h: Hm };
      break;
    }
    case 'paneel': case 'platte': case 'stehfalz': case 'trapez': case 'welle': {
      const prof = muster === 'stehfalz' || muster === 'trapez' || muster === 'welle';
      const pw = r[0] || (muster === 'stehfalz' ? 430 : muster === 'trapez' ? 207 : muster === 'welle' ? 177 : 1250), ph = prof ? 3000 : (r[1] || (muster === 'platte' ? 2500 : 400)), f = prof ? 0 : (fuge ?? (muster === 'platte' ? 8 : 0));
      const nx = muster === 'platte' ? 2 : 4, ny = muster === 'platte' ? 2 : (muster === 'paneel' ? 6 : 1);
      const Wm = nx * (pw + f), Hm = ny * (ph + f); const c = mk(512, 512); const ctx = c.getContext('2d'); const sx = 512 / Wm, sy = 512 / Hm;
      const n = fbm(512, 512, seed, 80, 3);
      pixelFill(c, (x, y) => { const k = 0.97 + n(x, y) * 0.05; return [clamp(base[0] * k), clamp(base[1] * k), clamp(base[2] * k)]; });
      if (muster === 'platte' || muster === 'paneel') { ctx.fillStyle = 'rgba(0,0,0,0.55)'; for (let i = 0; i <= nx; i++) ctx.fillRect(i * (pw + f) * sx - Math.max(1, f * sx) / 2, 0, Math.max(1.5, f * sx), 512); for (let j = 0; j <= ny; j++) ctx.fillRect(0, j * (ph + f) * sy - Math.max(1, f * sy) / 2, 512, Math.max(1.5, f * sy)); if (muster === 'paneel') { ctx.fillStyle = 'rgba(255,255,255,0.10)'; for (let j = 0; j < ny; j++) ctx.fillRect(0, (j * (ph + f) + 6) * sy, 512, 4 * sy + 1); } }
      if (muster === 'stehfalz') { for (let i = 0; i <= nx; i++) { const x = i * pw * sx; ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(x - 3, 0, 3, 512); ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(x, 0, 2, 512); } }
      if (muster === 'trapez' || muster === 'welle') { for (let x = 0; x < 512; x++) { const ph2 = (x / sx) % pw / pw; const k = muster === 'welle' ? Math.sin(ph2 * Math.PI * 2) * 0.18 : (ph2 < 0.25 ? 0.18 : ph2 < 0.5 ? -0.05 : ph2 < 0.75 ? -0.18 : 0.05); ctx.fillStyle = k > 0 ? `rgba(255,255,255,${k})` : `rgba(0,0,0,${-k})`; ctx.fillRect(x, 0, 1, 512); } }
      out = { canvas: c, w: Wm, h: Hm }; break;
    }
    case 'schindel': case 'raute': case 'ziegel': {
      const sw = r[0] || (muster === 'ziegel' ? 300 : muster === 'raute' ? 290 : 420), sh = r[1] || (muster === 'ziegel' ? 380 : muster === 'raute' ? 290 : 240);
      const nx = 4, ny = 6; const Wm = nx * sw, Hm = ny * sh * (muster === 'ziegel' ? 0.85 : 0.5); const c = mk(512, 512); const ctx = c.getContext('2d'); const sx = 512 / Wm, sy = 512 / Hm;
      ctx.fillStyle = dark; ctx.fillRect(0, 0, 512, 512);
      const rowH = muster === 'ziegel' ? sh * 0.85 : sh * 0.5;
      for (let j = -1; j <= ny; j++) for (let i = -1; i <= nx; i++) {
        const x = (i * sw + (j % 2 && muster !== 'ziegel' ? sw / 2 : 0)) * sx, y = j * rowH * sy; const v = (R() - 0.5) * 0.12;
        ctx.fillStyle = shade(col, v);
        if (muster === 'raute') { ctx.beginPath(); ctx.moveTo(x + sw * sx / 2, y); ctx.lineTo(x + sw * sx, y + rowH * sy); ctx.lineTo(x + sw * sx / 2, y + rowH * 2 * sy); ctx.lineTo(x, y + rowH * sy); ctx.closePath(); ctx.fill(); }
        else if (muster === 'ziegel') { const g = ctx.createLinearGradient(x, 0, x + sw * sx, 0); g.addColorStop(0, shade(col, v - 0.15)); g.addColorStop(0.5, shade(col, v + 0.08)); g.addColorStop(1, shade(col, v - 0.15)); ctx.fillStyle = g; ctx.fillRect(x + 1, y, sw * sx - 2, rowH * sy - 2); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x, y + rowH * sy - 4, sw * sx, 3); }
        else { ctx.fillRect(x + 1, y, sw * sx - 2, rowH * sy * 1.9); ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x, y + rowH * sy * 1.9, sw * sx, 2); }
      }
      out = { canvas: c, w: Wm, h: Hm }; break;
    }
    case 'naturstein': {
      const c = mk(512, 512); const ctx = c.getContext('2d'); ctx.fillStyle = '#8f8a82'; ctx.fillRect(0, 0, 512, 512);
      let y = 0; while (y < 512) { const h = 40 + R() * 60; let x = -R() * 80; while (x < 512) { const w = 60 + R() * 140; ctx.fillStyle = shade(col, (R() - 0.5) * 0.3); ctx.beginPath(); ctx.roundRect ? ctx.roundRect(x + 3, y + 3, w - 6, h - 6, 6) : ctx.rect(x + 3, y + 3, w - 6, h - 6); ctx.fill(); x += w; } y += h; }
      out = { canvas: c, w: 1600, h: 1600 }; break;
    }
    case 'glas': {
      const c = solid(256, 256, (ctx, W, H) => { const g = ctx.createLinearGradient(0, 0, W, H); g.addColorStop(0, shade(col, 0.35)); g.addColorStop(0.5, col); g.addColorStop(1, shade(col, -0.25)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.fillStyle = 'rgba(30,35,40,0.8)'; ctx.fillRect(0, 0, W, 4); ctx.fillRect(0, 0, 4, H); });
      out = { canvas: c, w: 1500, h: 1500 }; break;
    }
    case 'gruendach': {
      const c = mk(256, 256); const n = fbm(256, 256, seed, 20, 4); pixelFill(c, (x, y) => { const k = 0.6 + n(x, y) * 0.6; return [clamp(80 * k), clamp(120 * k), clamp(55 * k)]; }); out = { canvas: c, w: 2000, h: 2000 }; break;
    }
    case 'flach': {
      const c = mk(256, 256); const n = fbm(256, 256, seed, 6, 3); pixelFill(c, (x, y) => { const k = 0.85 + n(x, y) * 0.3; return [clamp(base[0] * k), clamp(base[1] * k), clamp(base[2] * k)]; }); out = { canvas: c, w: 1000, h: 1000 }; break;
    }
    case 'gras': {
      const c = mk(256, 256); const n = fbm(256, 256, seed, 32, 5), m2 = fbm(256, 256, seed + 9, 3, 2); pixelFill(c, (x, y) => { const k = 0.86 + n(x, y) * 0.2 + (m2(x, y) - 0.5) * 0.14; return [clamp(98 * k), clamp(132 * k), clamp(70 * k)]; }); out = { canvas: c, w: 2500, h: 2500 }; break;
    }
    default: { // putz & uni
      const c = mk(256, 256); const n = fbm(256, 256, seed, muster === 'putz' ? 3 : 32, 3), m = fbm(256, 256, seed + 3, 48, 2);
      pixelFill(c, (x, y) => { const k = (muster === 'putz' ? 0.93 + n(x, y) * 0.12 : 0.98 + n(x, y) * 0.03) + (m(x, y) - 0.5) * 0.04; return [clamp(base[0] * k), clamp(base[1] * k), clamp(base[2] * k)]; });
      out = { canvas: c, w: 800, h: 800 };
    }
  }
  cache.set(key, out); return out;
}
