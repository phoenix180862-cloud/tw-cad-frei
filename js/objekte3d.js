// TW-CAD – 3D-Modelle für alle Objekte (Sanitär, Barrierefrei, Installation, Küche, Großküche, Hauswirtschaft, Möbel, Außen)
// Modellraum in mm: x = Breite (−W/2 … +W/2), y = Höhe ab Fußboden, z = Tiefe (−D/2 = Wandseite/hinten … +D/2 = vorne).
// Der Aufrufer setzt das Modell an die Plan-Position (Spiegelung z, Drehung, Maßstab mm → m).
import * as THREE from 'three';

const mats = new Map();
const mat = (key, opt) => { let m = mats.get(key); if (!m) { m = new THREE.MeshStandardMaterial(Object.assign({ side: THREE.DoubleSide }, opt)); mats.set(key, m); } return m; };
const MAT = {
  keramik: () => mat('keramik', { color: '#f7f7f5', roughness: 0.18, metalness: 0 }),
  keramikInnen: () => mat('keramikInnen', { color: '#e9ebec', roughness: 0.25 }),
  chrom: () => mat('chrom', { color: '#d8dce0', roughness: 0.12, metalness: 0.95 }),
  edelstahl: () => mat('edelstahl', { color: '#b9bec3', roughness: 0.35, metalness: 0.85 }),
  glas: () => mat('glas', { color: '#cfe8ef', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, depthWrite: false }),
  wasser: () => mat('wasser', { color: '#bcd9e4', roughness: 0.1, transparent: true, opacity: 0.55 }),
  weiss: () => mat('weiss', { color: '#f2f2f0', roughness: 0.5 }),
  grau: () => mat('grau', { color: '#9aa1a8', roughness: 0.7 }),
  dunkel: () => mat('dunkel', { color: '#2f3337', roughness: 0.4 }),
  schwarzGlas: () => mat('schwarzGlas', { color: '#141618', roughness: 0.08, metalness: 0.2 }),
  holz: () => mat('holz', { color: '#b58a5c', roughness: 0.65 }),
  holzHell: () => mat('holzHell', { color: '#d6b98f', roughness: 0.6 }),
  front: () => mat('front', { color: '#e8e6e1', roughness: 0.45 }),
  frontGrau: () => mat('frontGrau', { color: '#7b8187', roughness: 0.5 }),
  arbeitsplatte: () => mat('arbeitsplatte', { color: '#3d4247', roughness: 0.35 }),
  stoff: () => mat('stoff', { color: '#8a8f96', roughness: 0.95 }),
  stoffHell: () => mat('stoffHell', { color: '#e7e3dc', roughness: 0.95 }),
  kissen: () => mat('kissen', { color: '#f4f1ec', roughness: 0.95 }),
  gruen: () => mat('gruen', { color: '#4d7a3a', roughness: 0.95 }),
  gruen2: () => mat('gruen2', { color: '#5f8f45', roughness: 0.95 }),
  stamm: () => mat('stamm', { color: '#6b4f36', roughness: 0.95 }),
  reifen: () => mat('reifen', { color: '#1d1f21', roughness: 0.85 }),
  lack: () => mat('lack', { color: '#3f5f86', roughness: 0.3, metalness: 0.4 }),
  blau: () => mat('blau', { color: '#3f7fb5', roughness: 0.6 }),
  gelb: () => mat('gelb', { color: '#d7b13a', roughness: 0.6 }),
  braun: () => mat('braun', { color: '#6f4b2e', roughness: 0.6 }),
  flaeche: () => mat('flaeche', { color: '#4f8fd6', transparent: true, opacity: 0.18, depthWrite: false })
};

/* ───────── Bauhelfer (mm) ───────── */
function box(g, w, h, d, m, x = 0, y = 0, z = 0) { const me = new THREE.Mesh(new THREE.BoxGeometry(Math.max(1, w), Math.max(1, h), Math.max(1, d)), m); me.position.set(x, y + h / 2, z); g.add(me); return me; }
function cyl(g, r, h, m, x = 0, y = 0, z = 0, seg = 24, r2 = r) { const me = new THREE.Mesh(new THREE.CylinderGeometry(r2, r, h, seg), m); me.position.set(x, y + h / 2, z); g.add(me); return me; }
/** Rohr von a nach b */
function rohr(g, a, b, r, m) { const va = new THREE.Vector3(...a), vb = new THREE.Vector3(...b); const L = va.distanceTo(vb); const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 12), m); me.position.copy(va.clone().add(vb).multiplyScalar(0.5)); me.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize()); g.add(me); return me; }
function kugel(g, r, m, x, y, z, sx = 1, sy = 1, sz = 1) { const me = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 14), m); me.position.set(x, y, z); me.scale.set(sx, sy, sz); g.add(me); return me; }
/** Grundriss-Prisma: pts [[x,z],…] (Löcher optional), von y0 bis y1 */
function prisma(g, pts, y0, y1, m, holes = [], bevel = 0) {
  const sh = new THREE.Shape(pts.map(([x, z]) => new THREE.Vector2(x, -z)));
  for (const hpts of holes) sh.holes.push(new THREE.Path(hpts.map(([x, z]) => new THREE.Vector2(x, -z))));
  const geo = new THREE.ExtrudeGeometry(sh, { depth: Math.max(1, y1 - y0 - 2 * bevel), bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel, bevelSegments: 3, curveSegments: 24 });
  geo.rotateX(-Math.PI / 2); geo.translate(0, y0 + bevel, 0);
  const me = new THREE.Mesh(geo, m); g.add(me); return me;
}
const rr = (x0, z0, x1, z1, r, n = 6) => { // abgerundetes Rechteck
  r = Math.min(r, (x1 - x0) / 2, (z1 - z0) / 2); const p = [];
  const ecke = (cx, cz, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + i / n * Math.PI / 2; p.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]); } };
  ecke(x1 - r, z1 - r, 0); ecke(x0 + r, z1 - r, Math.PI / 2); ecke(x0 + r, z0 + r, Math.PI); ecke(x1 - r, z0 + r, Math.PI * 1.5); return p;
};
const ellipse = (cx, cz, rx, rz, n = 32, a0 = 0, a1 = Math.PI * 2) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push([cx + Math.cos(a) * rx, cz + Math.sin(a) * rz]); } if (a1 - a0 >= Math.PI * 2 - 1e-6) p.pop(); return p; };
/** WC-Schüssel-Umriss (hinten gerade, vorne oval) */
const wcForm = (W, z0, z1) => { const rx = W / 2, rz = (z1 - z0) * 0.62; const cz = z1 - rz; const p = [[-rx * 0.92, z0], [rx * 0.92, z0]]; for (let i = 0; i <= 20; i++) { const a = i / 20 * Math.PI; p.push([Math.cos(a) * rx, cz + Math.sin(a) * rz]); } return p; };

/* ───────── Bausteine ───────── */
function armatur(g, x, y, z, ausl = 140) { cyl(g, 22, 120, MAT.chrom(), x, y, z); rohr(g, [x, y + 110, z], [x, y + 110, z + ausl], 12, MAT.chrom()); box(g, 16, 40, 60, MAT.chrom(), x, y + 120, z - 10); }
function duschSet(g, x, D, h0 = 1100, kopf = 2100, rund = 120) {
  const zw = -D / 2 + 45; box(g, 160, 90, 40, MAT.chrom(), x, h0, -D / 2 + 20);
  rohr(g, [x, h0 + 90, zw], [x, kopf, zw], 12, MAT.chrom()); rohr(g, [x, kopf, zw], [x, kopf, zw + 260], 10, MAT.chrom());
  cyl(g, rund, 12, MAT.chrom(), x, kopf - 20, zw + 260, 32);
  rohr(g, [x + 70, h0 + 300, zw], [x + 70, h0 + 500, zw + 20], 14, MAT.dunkel());
}
function basin(g, W, D, top, dicke = 150, form = 'rund', becken = 1, zOff = 0) {
  prisma(g, rr(-W / 2, -D / 2 + zOff, W / 2, D / 2, 30), top - dicke, top, MAT.keramik(), [], 4);
  const bw = W / becken; for (let i = 0; i < becken; i++) {
    const cx = -W / 2 + bw * (i + 0.5); const rx = Math.min(bw * 0.36, 260), rz = (D - zOff) * 0.3;
    prisma(g, form === 'eckig' ? rr(cx - rx, zOff * 0.5 - rz + 20, cx + rx, zOff * 0.5 + rz + 20, 40) : ellipse(cx, 30 + zOff * 0.5, rx, rz), top - 2, top + 1, MAT.keramikInnen());
    armatur(g, cx, top, -D / 2 + 70 + zOff, Math.min(140, D * 0.3));
  }
  cyl(g, 20, top - dicke - 350, MAT.chrom(), 0, 350, -D / 2 + 120);
}
function schrankKorpus(g, W, H, D, y0, front = MAT.front(), teilung = 1, horizontal = false, zo = 0) {
  const gg = new THREE.Group(); gg.position.z = zo; g.add(gg); g = gg;
  box(g, W, H, D - 20, MAT.weiss(), 0, y0, -10);
  const n = Math.max(1, teilung); const fw = (W - (n + 1) * 3) / n;
  for (let i = 0; i < n; i++) {
    if (horizontal) { const fh = (H - (n + 1) * 3) / n; box(g, W - 6, fh, 18, front, 0, y0 + 3 + i * (fh + 3), D / 2 - 9); box(g, Math.min(200, W * 0.4), 12, 20, MAT.edelstahl(), 0, y0 + 3 + i * (fh + 3) + fh - 40, D / 2 + 8); }
    else { const x = -W / 2 + 3 + fw / 2 + i * (fw + 3); box(g, fw, H - 6, 18, front, x, y0 + 3, D / 2 - 9); box(g, 12, Math.min(220, H * 0.3), 20, MAT.edelstahl(), x + (i % 2 ? -1 : 1) * (fw / 2 - 40), y0 + H - Math.min(260, H * 0.4), D / 2 + 8); }
  }
}
function beine(g, W, D, H, r = 20, m = MAT.edelstahl(), rand = 40) { for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) cyl(g, r, H, m, sx * (W / 2 - rand), 0, sz * (D / 2 - rand), 12); }
function tuerRund(g, x, y, z, r) { const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 20, 32), MAT.schwarzGlas()); me.rotation.x = Math.PI / 2; me.position.set(x, y, z); g.add(me); const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 18, 8, 32), MAT.chrom()); ring.position.set(x, y, z + 6); g.add(ring); }
function rad(g, x, y, z, r, b) { const me = new THREE.Mesh(new THREE.CylinderGeometry(r, r, b, 28), MAT.reifen()); me.rotation.z = Math.PI / 2; me.position.set(x, y, z); g.add(me); const f = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.6, r * 0.6, b + 4, 20), MAT.chrom()); f.rotation.z = Math.PI / 2; f.position.set(x, y, z); g.add(f); }

/* ───────── Modelle ───────── */
const MODELLE = {
  wc(g, W, D) { prisma(g, wcForm(W, -D / 2, D / 2), 180, 400, MAT.keramik(), [], 8); prisma(g, wcForm(W * 0.94, -D / 2 + 60, D / 2 - 10), 405, 425, MAT.weiss(), [ellipse(0, D * 0.12, W * 0.3, D * 0.27)]); box(g, 250, 160, 12, MAT.weiss(), 0, 1000, -D / 2 + 6); box(g, 80, 60, 4, MAT.chrom(), 0, 1050, -D / 2 + 14); },
  wcstand(g, W, D) { prisma(g, rr(-W * 0.28, -D / 2 + 180, W * 0.28, D / 2 - 120, 60), 0, 380, MAT.keramik()); prisma(g, wcForm(W, -D / 2 + 160, D / 2), 260, 400, MAT.keramik(), [], 8); prisma(g, wcForm(W * 0.94, -D / 2 + 200, D / 2 - 10), 405, 425, MAT.weiss(), [ellipse(0, D * 0.15, W * 0.3, D * 0.22)]); prisma(g, rr(-W / 2 - 20, -D / 2, W / 2 + 20, -D / 2 + 170, 20), 400, 800, MAT.keramik(), [], 6); cyl(g, 18, 12, MAT.chrom(), 0, 800, -D / 2 + 85); },
  wcdusch(g, W, D) { MODELLE.wc(g, W, D); box(g, W * 0.9, 60, 120, MAT.keramik(), 0, 425, -D / 2 + 60); },
  wcbf(g, W, D) { MODELLE.wc(g, W, D); for (const s of [-1, 1]) { rohr(g, [s * 350, 850, -D / 2 + 60], [s * 350, 850, D / 2 + 150], 16, MAT.grau()); rohr(g, [s * 350, 850, -D / 2 + 60], [s * 350, 850, -D / 2], 30, MAT.grau()); } },
  bidet(g, W, D) { prisma(g, wcForm(W, -D / 2, D / 2), 150, 400, MAT.keramik(), [], 8); prisma(g, ellipse(0, D * 0.12, W * 0.3, D * 0.3), 401, 403, MAT.keramikInnen()); armatur(g, 0, 400, -D / 2 + 60, 90); },
  urinal(g, W, D) { prisma(g, [...ellipse(0, -D / 2 + 1, W / 2, D - 2, 24, 0, Math.PI)], 350, 1050, MAT.keramik(), [], 6); prisma(g, ellipse(0, -D / 2 + 20, W * 0.38, D * 0.75, 20, 0, Math.PI), 360, 1000, MAT.keramikInnen()); cyl(g, 15, 150, MAT.chrom(), 0, 1060, -D / 2 + 30); },
  urinaltrennwand(g, W, D) { box(g, Math.max(W, 15), 1150, D, MAT.weiss(), 0, 350, 0); },
  waschtisch(g, W, D) { basin(g, W, D, 850); },
  wtunterschrank(g, W, D) { schrankKorpus(g, W - 10, 400, D - 20, 300, MAT.holz(), 1, true); basin(g, W, D, 860, 160, 'eckig'); },
  doppelwt(g, W, D) { basin(g, W, D, 850, 150, 'rund', 2); },
  aufsatzwb(g, W, D) { box(g, W, 40, D, MAT.holz(), 0, 800, 0); const r = Math.min(W, D) * 0.38; const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector2(r * (0.55 + 0.45 * Math.sin(t * Math.PI / 2)), t * 130)); } pts.push(new THREE.Vector2(r - 8, 130)); for (let i = 10; i >= 1; i--) { const t = i / 10; pts.push(new THREE.Vector2((r - 8) * (0.55 + 0.45 * Math.sin(t * Math.PI / 2)) * 0.98, 8 + t * 120)); } const me = new THREE.Mesh(new THREE.LatheGeometry(pts, 40), MAT.keramik()); me.position.set(0, 840, 20); g.add(me); cyl(g, 18, 300, MAT.chrom(), 0, 840, -D / 2 + 60); rohr(g, [0, 1130, -D / 2 + 60], [0, 1130, -D / 2 + 60 + r * 0.8], 12, MAT.chrom()); },
  handwb(g, W, D) { basin(g, W, D, 850, 130); },
  eckwb(g, W, D) { prisma(g, [[-W / 2, -D / 2], [W / 2, -D / 2], [-W / 2, D / 2]], 720, 850, MAT.keramik(), [], 4); prisma(g, ellipse(-W * 0.18, -D * 0.18, W * 0.2, D * 0.2), 849, 852, MAT.keramikInnen()); armatur(g, -W / 2 + 70, 850, -D / 2 + 70, 100); },
  ausguss(g, W, D) { prisma(g, rr(-W / 2, -D / 2, W / 2, D / 2, 20), 400, 700, MAT.keramik(), [rr(-W / 2 + 40, -D / 2 + 40, W / 2 - 40, D / 2 - 40, 15)]); box(g, W - 80, 10, D - 80, MAT.keramikInnen(), 0, 420, 0); box(g, W - 60, 8, 120, MAT.edelstahl(), 0, 700, D / 2 - 80); armatur(g, 0, 1000, -D / 2 + 30, 160); },
  waschrinne(g, W, D) { prisma(g, rr(-W / 2, -D / 2, W / 2, D / 2, 20), 700, 850, MAT.keramik(), [rr(-W / 2 + 50, -D / 2 + 90, W / 2 - 50, D / 2 - 40, 30)]); box(g, W - 100, 10, D - 130, MAT.keramikInnen(), 0, 720, 25); const n = Math.max(1, Math.round(W / 600)); for (let i = 0; i < n; i++) armatur(g, -W / 2 + W / n * (i + 0.5), 850, -D / 2 + 45, 120); },
  dusche(g, W, D) { box(g, Math.min(W, 800), 2, 60, MAT.edelstahl(), 0, 0, D / 2 - 60); duschSet(g, 0, D); },
  duschtasse(g, W, D) { prisma(g, rr(-W / 2, -D / 2, W / 2, D / 2, 15), 0, 60, MAT.keramik(), [rr(-W / 2 + 40, -D / 2 + 40, W / 2 - 40, D / 2 - 40, 30)]); box(g, W - 80, 30, D - 80, MAT.keramikInnen(), 0, 0, 0); cyl(g, 45, 32, MAT.chrom(), 0, 0, 0); duschSet(g, W / 2 - 200, D); },
  duschviertel(g, W, D) { const R = Math.min(W, D); const pts = [[-W / 2, -D / 2], [-W / 2 + R, -D / 2]]; for (let i = 0; i <= 16; i++) { const a = i / 16 * Math.PI / 2; pts.push([-W / 2 + R * Math.cos(a), -D / 2 + R * Math.sin(a)]); } prisma(g, pts, 0, 50, MAT.keramik()); const gl = new THREE.Mesh(new THREE.CylinderGeometry(R - 20, R - 20, 1950, 32, 1, true, Math.PI / 2, Math.PI / 2), MAT.glas()); gl.position.set(-W / 2, 50 + 975, -D / 2); g.add(gl); duschSet(g, -W / 2 + 250, D); },
  walkin(g, W, D) { box(g, 10, 2000, D * 0.85, MAT.glas(), W / 2 - 40, 0, -D * 0.075); rohr(g, [W / 2 - 40, 2000, D * 0.35], [W / 2 - 40, 2000, -D / 2], 10, MAT.chrom()); box(g, W * 0.6, 2, 60, MAT.edelstahl(), -W * 0.1, 0, -D / 2 + 60); duschSet(g, -W * 0.15, D); },
  duschwand(g, W, D) { box(g, W, 2000, Math.max(8, D), MAT.glas(), 0, 0, 0); box(g, 20, 2000, 25, MAT.chrom(), -W / 2 + 10, 0, 0); },
  reihendusche(g, W, D) { const n = Math.max(1, Math.round(W / 1000)); for (let i = 0; i < n; i++) { const x = -W / 2 + W / n * (i + 0.5); duschSet(g, x, D, 1150, 2000, 70); if (i) box(g, 25, 1600, D * 0.6, MAT.grau(), -W / 2 + W / n * i, 200, -D / 2 + D * 0.3); } box(g, W * 0.95, 2, 60, MAT.edelstahl(), 0, 0, D / 2 - 80); },
  wanne(g, W, D, sy) { tub(g, W, D); },
  duschwanne(g, W, D) { tub(g, W, D); box(g, Math.min(900, W * 0.5), 1450, 8, MAT.glas(), W / 2 - Math.min(900, W * 0.5) / 2, 580, D / 2 - 30); },
  eckwanne(g, W, D) { const p = [[-W / 2, -D / 2], [W / 2, -D / 2], [W / 2, -D / 2 + D * 0.35], [-W / 2 + W * 0.35, D / 2], [-W / 2, D / 2]]; prisma(g, p, 0, 460, MAT.keramik()); const inn = []; for (let i = 0; i <= 18; i++) { const a = i / 18 * Math.PI / 2; inn.push([-W / 2 + 90 + Math.cos(a) * (W * 0.62), -D / 2 + 90 + Math.sin(a) * (D * 0.62)]); } inn.push([-W / 2 + 90, -D / 2 + 90]); prisma(g, p, 460, 580, MAT.keramik(), [inn]); prisma(g, inn, 300, 462, MAT.keramikInnen()); prisma(g, inn, 420, 470, MAT.wasser()); armatur(g, -W / 2 + 120, 580, -D / 2 + 40, 120); },
  wannefrei(g, W, D) { const o = ellipse(0, 0, W / 2, D / 2, 40); const i2 = ellipse(0, 0, W / 2 - 60, D / 2 - 60, 40); prisma(g, ellipse(0, 0, W / 2 - 40, D / 2 - 40, 40), 0, 420, MAT.keramik(), [], 30); prisma(g, o, 420, 600, MAT.keramik(), [i2]); prisma(g, i2, 260, 422, MAT.keramikInnen()); prisma(g, i2, 380, 430, MAT.wasser()); cyl(g, 18, 900, MAT.chrom(), W / 2 + 120, 0, 0); rohr(g, [W / 2 + 120, 900, 0], [W / 2 - 80, 900, 0], 12, MAT.chrom()); },
  ablauf(g, W, D) { box(g, W, 3, D, MAT.edelstahl(), 0, 0, 0); for (let i = 1; i < 5; i++) box(g, W * 0.8, 4, 4, MAT.dunkel(), 0, 0, -D / 2 + D / 5 * i); },
  rinne(g, W, D) { box(g, W, 3, D, MAT.edelstahl(), 0, 0, 0); box(g, W - 40, 4, Math.max(6, D * 0.25), MAT.dunkel(), 0, 0, 0); },
  wandrinne(g, W, D) { MODELLE.rinne(g, W, D); },
  kastenrinne(g, W, D) { box(g, W, 3, D, MAT.edelstahl(), 0, 0, 0); for (let x = -W / 2 + 30; x < W / 2 - 20; x += 30) box(g, 6, 4, D * 0.8, MAT.dunkel(), x, 0, 0); },
  schlitzrinne(g, W, D) { box(g, W, 3, D, MAT.edelstahl(), 0, 0, 0); box(g, W - 20, 4, 10, MAT.dunkel(), 0, 0, 0); },
  gewerbeablauf(g, W, D) { box(g, W, 3, D, MAT.edelstahl(), 0, 0, 0); for (let i = 1; i < 6; i++) box(g, W * 0.85, 4, 5, MAT.dunkel(), 0, 0, -D / 2 + D / 6 * i); },
  ueberlaufrinne(g, W, D) { box(g, W, 4, D, MAT.weiss(), 0, 0, 0); for (let x = -W / 2 + 25; x < W / 2; x += 25) box(g, 8, 5, D * 0.85, MAT.grau(), x, 0, 0); },
  fettabscheider(g, W, D) { box(g, W, 3, D, MAT.edelstahl(), 0, 0, 0); cyl(g, Math.min(W, D) * 0.35, 4, MAT.grau(), 0, 0, 0, 32); },
  bewegung(g, W, D) { box(g, W, 2, D, MAT.flaeche(), 0, 1, 0); },
  stuetzgriff(g, W, D) { box(g, 80, 200, 12, MAT.grau(), 0, 760, -D / 2 + 6); rohr(g, [0, 850, -D / 2 + 12], [0, 850, D / 2], 16, MAT.grau()); rohr(g, [0, 770, -D / 2 + 12], [0, 770, D / 2 - 60], 16, MAT.grau()); rohr(g, [0, 850, D / 2], [0, 770, D / 2 - 60], 16, MAT.grau()); },
  haltegriff(g, W, D) { rohr(g, [-W / 2, 850, 0], [W / 2, 850, 0], 16, MAT.grau()); for (const s of [-1, 1]) rohr(g, [s * W / 2, 850, 0], [s * W / 2, 850, -D / 2], 16, MAT.grau()); },
  wtbf(g, W, D) { prisma(g, rr(-W / 2, -D / 2, W / 2, D / 2, 40), 720, 800, MAT.keramik(), [], 4); prisma(g, ellipse(0, 40, W * 0.33, D * 0.3), 799, 802, MAT.keramikInnen()); armatur(g, 0, 800, -D / 2 + 70, 130); rohr(g, [W * 0.25, 680, -D / 2 + 30], [W * 0.25, 500, -D / 2 + 30], 18, MAT.chrom()); },
  duschsitz(g, W, D) { box(g, W, 30, D, MAT.weiss(), 0, 470, 0); box(g, W, 120, 20, MAT.grau(), 0, 380, -D / 2 + 10); for (const s of [-1, 1]) rohr(g, [s * (W / 2 - 30), 470, D / 2 - 30], [s * (W / 2 - 30), 380, -D / 2 + 20], 12, MAT.grau()); },
  vorwand(g, W, D, sy, H) { box(g, W, H, D, MAT.grau(), 0, 0, 0); },
  schacht(g, W, D, sy, H) { box(g, W, H, D, MAT.grau(), 0, 0, 0); },
  podest(g, W, D, sy, H) { box(g, W, H, D, MAT.grau(), 0, 0, 0); },
  sitzbank(g, W, D, sy, H) { box(g, W, H, D, MAT.grau(), 0, 0, 0); },
  mauerscheibe(g, W, D, sy, H) { box(g, W, H, D, MAT.grau(), 0, 0, 0); },
  stufe(g, W, D, sy, H) { box(g, W, H, D, MAT.grau(), 0, 0, 0); },
  nische(g, W, D, sy, H) { box(g, W, H, D, MAT.grau(), 0, 0, 0); },
  heizkoerper(g, W, D) { const h = 600; for (const z of [-D / 2 + 30, D / 2 - 20]) box(g, W, h, 18, MAT.weiss(), 0, 150, z); for (let x = -W / 2 + 25; x < W / 2; x += 50) box(g, 3, h - 20, D - 50, MAT.weiss(), x, 160, 5); box(g, 30, 40, 30, MAT.chrom(), W / 2 - 15, 150 + h, D / 2 - 20); },
  badheizkoerper(g, W, D) { const y0 = 300, h = 1200; for (const s of [-1, 1]) rohr(g, [s * (W / 2 - 15), y0, 0], [s * (W / 2 - 15), y0 + h, 0], 15, MAT.weiss()); for (let y = y0 + 40; y < y0 + h; y += y < y0 + 400 ? 55 : 90) rohr(g, [-W / 2 + 15, y, 0], [W / 2 - 15, y, 0], 11, MAT.weiss()); },
  fbhverteiler(g, W, D) { box(g, W, 750, D, MAT.weiss(), 0, 300, 0); box(g, W - 40, 700, 4, MAT.grau(), 0, 325, D / 2); },
  therme(g, W, D) { box(g, W, 720, D, MAT.weiss(), 0, 1250, 0); box(g, W * 0.7, 60, 4, MAT.dunkel(), 0, 1330, D / 2); for (let i = 0; i < 4; i++) rohr(g, [-W / 3 + i * W / 4.5, 1250, 0], [-W / 3 + i * W / 4.5, 1050, 0], 11, MAT.chrom()); },
  speicher(g, W, D) { const r = Math.min(W, D) / 2 - 10; cyl(g, r, 1650, MAT.weiss(), 0, 0, 0, 32); kugel(g, r, MAT.weiss(), 0, 1650, 0, 1, 0.25, 1); box(g, 120, 160, 6, MAT.grau(), 0, 1200, r); },
  spuele(g, W, D) { schrankKorpus(g, W, 750, D, 120, MAT.front(), 2); box(g, W, 120, D - 60, MAT.dunkel(), 0, 0, -30); box(g, W + 10, 40, D + 20, MAT.arbeitsplatte(), 0, 870, 10); prisma(g, rr(-W * 0.35, -D * 0.25, W * 0.2, D * 0.3, 30), 908, 912, MAT.edelstahl()); armatur(g, 0, 910, -D / 2 + 60, 200); },
  herd(g, W, D) { schrankKorpus(g, W, 750, D, 120, MAT.front(), 1, true); box(g, W - 20, 500, 10, MAT.schwarzGlas(), 0, 300, D / 2 + 2); box(g, W - 80, 20, 20, MAT.edelstahl(), 0, 760, D / 2 + 12); box(g, W + 10, 40, D + 20, MAT.arbeitsplatte(), 0, 870, 10); box(g, W - 60, 6, D - 100, MAT.schwarzGlas(), 0, 910, 0); },
  kuechenzeile(g, W, D) { kueche(g, W, D, true); },
  kochinsel(g, W, D) { schrankKorpus(g, W, 750, D, 120, MAT.frontGrau(), Math.max(2, Math.round(W / 600))); box(g, W + 60, 40, D + 60, MAT.arbeitsplatte(), 0, 870, 0); box(g, 600, 6, 480, MAT.schwarzGlas(), 0, 910, 0); },
  unterschrank(g, W, D) { schrankKorpus(g, W, 750, D, 120, MAT.front(), W > 500 ? 2 : 1); box(g, W, 120, D - 60, MAT.dunkel(), 0, 0, -30); box(g, W + 10, 40, D + 20, MAT.arbeitsplatte(), 0, 870, 10); },
  hochschrank(g, W, D) { schrankKorpus(g, W, 2030, D, 120, MAT.front(), 1); box(g, W, 120, D - 60, MAT.dunkel(), 0, 0, -30); },
  kuehlschrank(g, W, D) { box(g, W, 1850, D - 20, MAT.edelstahl(), 0, 0, -10); box(g, 4, 1830, 4, MAT.dunkel(), W > 800 ? 0 : -W / 2 + 4, 10, D / 2); box(g, 20, 500, 25, MAT.chrom(), W > 800 ? 40 : W / 2 - 40, 900, D / 2 + 10); if (W > 800) box(g, 20, 500, 25, MAT.chrom(), -40, 900, D / 2 + 10); box(g, W, 4, 4, MAT.dunkel(), 0, 1250, D / 2); },
  spuelmaschine(g, W, D) { box(g, W, 850, D - 20, MAT.edelstahl(), 0, 0, -10); box(g, W - 40, 60, 6, MAT.dunkel(), 0, 760, D / 2); box(g, W * 0.6, 16, 20, MAT.chrom(), 0, 720, D / 2 + 8); },
  gastroherd(g, W, D) { box(g, W, 850, D, MAT.edelstahl(), 0, 0, 0); const n = Math.max(2, Math.round(W / 400)); for (let i = 0; i < n; i++) for (const z of [-D / 4, D / 4]) cyl(g, 110, 14, MAT.dunkel(), -W / 2 + W / n * (i + 0.5), 850, z, 24); box(g, W - 40, 30, 30, MAT.chrom(), 0, 700, D / 2 + 20); },
  kombidaempfer(g, W, D) { beine(g, W, D, 700, 20); box(g, W - 40, 40, D - 40, MAT.edelstahl(), 0, 250, 0); box(g, W, 950, D, MAT.edelstahl(), 0, 700, 0); box(g, W * 0.65, 650, 8, MAT.schwarzGlas(), -W * 0.12, 850, D / 2 + 2); box(g, W * 0.2, 500, 6, MAT.dunkel(), W * 0.36, 900, D / 2 + 2); },
  gastrospuele(g, W, D) { beine(g, W, D, 850, 20); box(g, W, 40, D, MAT.edelstahl(), 0, 850, 0); box(g, W, 120, 30, MAT.edelstahl(), 0, 890, -D / 2 + 15); const n = W >= 1400 ? 2 : 1; for (let i = 0; i < n; i++) box(g, 500, 4, D * 0.6, MAT.dunkel(), -W / 2 + 320 + i * 560, 891, 30); armatur(g, -W / 2 + 320, 890, -D / 2 + 60, 250); box(g, W - 80, 25, D - 80, MAT.edelstahl(), 0, 180, 0); },
  durchschub(g, W, D) { beine(g, W, D, 300, 22); box(g, W, 1150, D, MAT.edelstahl(), 0, 300, 0); box(g, W - 60, 500, 8, MAT.grau(), 0, 800, D / 2 + 2); box(g, W + 40, 40, D + 40, MAT.edelstahl(), 0, 1450, 0); },
  arbeitstisch(g, W, D) { beine(g, W, D, 850, 20); box(g, W, 40, D, MAT.edelstahl(), 0, 850, 0); box(g, W, 100, 25, MAT.edelstahl(), 0, 890, -D / 2 + 12); box(g, W - 80, 25, D - 80, MAT.edelstahl(), 0, 180, 0); },
  kuehlzelle(g, W, D) { box(g, W, 2200, D, MAT.weiss(), 0, 0, 0); box(g, 800, 1950, 20, MAT.weiss(), W / 2 - 600, 50, D / 2 + 10); box(g, 30, 300, 40, MAT.chrom(), W / 2 - 280, 950, D / 2 + 30); box(g, 200, 120, 15, MAT.dunkel(), W / 2 - 600, 2050, D / 2 + 12); },
  waschm(g, W, D) { waschgeraet(g, W, D, 0); },
  trockner(g, W, D) { waschgeraet(g, W, D, 0); },
  waschtm(g, W, D) { waschgeraet(g, W, D, 0); box(g, W, 20, D, MAT.grau(), 0, 850, 0); waschgeraet(g, W, D, 870); },
  bett(g, W, D) { box(g, W, 250, D, MAT.holz(), 0, 50, 0); for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(g, 50, 50, 50, MAT.holz(), sx * (W / 2 - 50), 0, sz * (D / 2 - 50)); prisma(g, rr(-W / 2 + 20, -D / 2 + 60, W / 2 - 20, D / 2 - 10, 40), 300, 500, MAT.kissen(), [], 15); box(g, W, 950, 70, MAT.holz(), 0, 50, -D / 2 + 35); const n = W > 1200 ? 2 : 1; for (let i = 0; i < n; i++) kugel(g, 1, MAT.stoffHell(), -W / 2 + W / n * (i + 0.5), 540, -D / 2 + 260, Math.min(330, W / n * 0.42), 70, 180); box(g, W - 30, 60, D * 0.55, MAT.stoffHell(), 0, 500, D * 0.17); },
  tisch(g, W, D) { box(g, W, 30, D, MAT.holzHell(), 0, 720, 0); beine(g, W, D, 720, 25, MAT.holz(), 60); },
  tischrund(g, W, D) { cyl(g, W / 2, 30, MAT.holzHell(), 0, 720, 0, 40); cyl(g, 50, 720, MAT.holz(), 0, 0, 0); cyl(g, W * 0.25, 20, MAT.holz(), 0, 0, 0, 30); },
  stuhl(g, W, D) { box(g, W, 40, D * 0.85, MAT.holz(), 0, 430, D * 0.07); beine(g, W, D, 430, 15, MAT.holz(), 30); box(g, W, 420, 30, MAT.holz(), 0, 470, -D / 2 + 20); },
  sofa(g, W, D) { const T = Math.min(D, 950); box(g, W, 220, T, MAT.stoff(), 0, 80, -D / 2 + T / 2); box(g, W, 450, 200, MAT.stoff(), 0, 80, -D / 2 + 100); for (const s of [-1, 1]) box(g, 180, 380, T, MAT.stoff(), s * (W / 2 - 90), 80, -D / 2 + T / 2); const n = Math.max(1, Math.round((W - 360) / 700)); for (let i = 0; i < n; i++) prisma(g, rr(-W / 2 + 180 + (W - 360) / n * i + 8, -D / 2 + 210, -W / 2 + 180 + (W - 360) / n * (i + 1) - 8, -D / 2 + T - 20, 40), 300, 440, MAT.stoffHell(), [], 12); if (D > T + 300) { box(g, T, 220, D - T, MAT.stoff(), W / 2 - T / 2, 80, -D / 2 + T + (D - T) / 2); prisma(g, rr(W / 2 - T + 20, -D / 2 + T, W / 2 - 200, D / 2 - 20, 40), 300, 440, MAT.stoffHell(), [], 12); } beine(g, W, D, 80, 15, MAT.dunkel(), 60); },
  sessel(g, W, D) { box(g, W, 220, D, MAT.stoff(), 0, 100, 0); box(g, W, 500, 180, MAT.stoff(), 0, 100, -D / 2 + 90); for (const s of [-1, 1]) box(g, 150, 380, D, MAT.stoff(), s * (W / 2 - 75), 100, 0); prisma(g, rr(-W / 2 + 150, -D / 2 + 180, W / 2 - 150, D / 2 - 20, 30), 320, 450, MAT.stoffHell(), [], 12); beine(g, W, D, 100, 15, MAT.dunkel(), 50); },
  schrank(g, W, D) { schrankKorpus(g, W, 2200, D, 0, MAT.front(), Math.max(1, Math.round(W / 500))); },
  regal(g, W, D) { for (const s of [-1, 1]) box(g, 20, 1900, D, MAT.holzHell(), s * (W / 2 - 10), 0, 0); for (let y = 0; y <= 1880; y += 376) box(g, W - 40, 20, D, MAT.holzHell(), 0, y, 0); box(g, W, 1900, 6, MAT.holzHell(), 0, 0, -D / 2 + 3); },
  schreibtisch(g, W, D) { box(g, W, 30, D, MAT.holzHell(), 0, 720, 0); for (const s of [-1, 1]) box(g, 25, 720, D - 40, MAT.weiss(), s * (W / 2 - 30), 0, 0); box(g, 400, 600, D - 60, MAT.weiss(), W / 2 - 260, 80, 0); },
  auto(g, W, D) { box(g, W, 560, D, MAT.lack(), 0, 300, 0); prisma(g, rr(-W / 2 + 60, -D * 0.28, W / 2 - 60, D * 0.22, 120), 860, 1420, MAT.lack(), [], 40); box(g, W - 110, 420, D * 0.48, MAT.schwarzGlas(), 0, 900, -D * 0.03); for (const sz of [-1, 1]) for (const sx of [-1, 1]) rad(g, sx * (W / 2 - 110), 320, sz * (D / 2 - 750), 320, 220); },
  baum(g, W, D) { const r = Math.min(W, D) / 2; const h = Math.max(3000, r * 2.2); cyl(g, Math.max(80, r * 0.08), h * 0.5, MAT.stamm(), 0, 0, 0, 12, Math.max(60, r * 0.06)); kugel(g, 1, MAT.gruen(), 0, h * 0.62, 0, r, r * 0.85, r); kugel(g, 1, MAT.gruen2(), r * 0.35, h * 0.75, r * 0.2, r * 0.6, r * 0.55, r * 0.6); },
  strauch(g, W, D) { kugel(g, 1, MAT.gruen2(), 0, Math.min(W, D) * 0.35, 0, W / 2, Math.min(W, D) * 0.4, D / 2); },
  muell(g, W, D) { const n = 3; const bw = W / n - 40; const farben = [MAT.dunkel(), MAT.blau(), MAT.braun()]; for (let i = 0; i < n; i++) { const x = -W / 2 + W / n * (i + 0.5); box(g, bw, 1000, D - 40, farben[i], x, 0, 0); box(g, bw + 20, 50, D, farben[i], x, 1000, 0); rad(g, x, 80, -D / 2 + 60, 80, bw * 0.8); } },
  fahrrad(g, W, D) { for (const z of [-D / 2 + 340, D / 2 - 340]) { const t = new THREE.Mesh(new THREE.TorusGeometry(320, 18, 8, 32), MAT.reifen()); t.rotation.y = Math.PI / 2; t.position.set(0, 340, z); g.add(t); } rohr(g, [0, 340, -D / 2 + 340], [0, 700, -60], 14, MAT.lack()); rohr(g, [0, 340, D / 2 - 340], [0, 340, -60], 14, MAT.lack()); rohr(g, [0, 700, -60], [0, 340, -60], 14, MAT.lack()); rohr(g, [0, 700, -60], [0, 820, D / 2 - 420], 14, MAT.lack()); rohr(g, [0, 820, D / 2 - 420], [0, 340, D / 2 - 340], 12, MAT.lack()); box(g, 90, 30, 250, MAT.dunkel(), 0, 720, -80); rohr(g, [-240, 980, D / 2 - 400], [240, 980, D / 2 - 400], 12, MAT.chrom()); rohr(g, [0, 820, D / 2 - 420], [0, 980, D / 2 - 400], 12, MAT.chrom()); }
};
function tub(g, W, D) {
  const o = rr(-W / 2, -D / 2, W / 2, D / 2, 25), i2 = rr(-W / 2 + 70, -D / 2 + 70, W / 2 - 70, D / 2 - 70, Math.min(W, D) * 0.3);
  prisma(g, o, 0, 460, MAT.keramik()); prisma(g, o, 460, 580, MAT.keramik(), [i2]); prisma(g, i2, 280, 462, MAT.keramikInnen()); prisma(g, i2, 400, 440, MAT.wasser());
  armatur(g, 0, 580, -D / 2 + 35, 100); cyl(g, 30, 10, MAT.chrom(), -W / 2 + 160, 460, 0);
}
function kueche(g, W, D, oben) {
  const n = Math.max(1, Math.round(W / 600)); const fw = W / n;
  schrankKorpus(g, W, 750, D, 120, MAT.front(), n); box(g, W, 120, D - 60, MAT.dunkel(), 0, 0, -30);
  box(g, W + 10, 40, D + 20, MAT.arbeitsplatte(), 0, 870, 10);
  // Spüle links, Kochfeld rechts
  prisma(g, rr(-W / 2 + fw * 0.2, -D * 0.25, -W / 2 + fw * 0.85, D * 0.3, 30), 908, 912, MAT.edelstahl()); armatur(g, -W / 2 + fw * 0.52, 910, -D / 2 + 60, 200);
  if (n > 1) box(g, Math.min(fw - 60, 600), 6, D - 100, MAT.schwarzGlas(), W / 2 - fw / 2, 910, 0);
  if (oben) schrankKorpus(g, W, 700, 350, 1450, MAT.front(), n, false, -D / 2 + 175);
}
function waschgeraet(g, W, D, y0) { box(g, W, 850, D - 20, MAT.weiss(), 0, y0, -10); box(g, W - 20, 90, 4, MAT.grau(), 0, y0 + 740, D / 2); tuerRund(g, 0, y0 + 420, D / 2 + 4, Math.min(W, 850) * 0.3); }

/** 3D-Modell eines Objekts; H = Raumhöhe (für raumhohe Teile). Rückgabe: THREE.Group in Metern, an Plan-Position, oder null */
export function objekt3D(sy, H = 2500, hoehe = null) {
  const f = MODELLE[sy.kind]; if (!f) return null;
  const inner = new THREE.Group(); const W = sy.w || 500, D = sy.d || 500;
  try { f(inner, W, D, sy, hoehe != null ? hoehe : H); } catch (e) { console.error('Objekt 3D', sy.kind, e); return null; }
  inner.traverse(o => { if (o.isMesh) { o.castShadow = !o.material.transparent; o.receiveShadow = true; } });
  inner.scale.set(0.001, 0.001, -0.001);
  const outer = new THREE.Group(); outer.add(inner); outer.rotation.y = (sy.rot || 0) * Math.PI / 180;
  outer.position.set(sy.p.x * 0.001, 0, -sy.p.y * 0.001);
  outer.userData = { kind: 'symbol', id: sy.id };
  return outer;
}
export const HAT_3D = new Set(Object.keys(MODELLE));
