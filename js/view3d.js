// TW-CAD – 3D-Ansicht: Gebäude aus Grundriss, Fassaden, Fenster/Türen, Dach, Gelände, Nachbarn
import * as THREE from 'three';
import { OrbitControls } from '../lib/OrbitControls.js?v=20261028-0429';
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import { buildRoof } from './roof.js?v=20261028-0429';
import { buildTerrain, contours } from './terrain.js?v=20261028-0429';
import { surfaceTexture, tileSurface } from './textures.js?v=20261028-0429';
import * as K from './katalog.js?v=20261028-0429';
import { normalisiere, eigenschaften } from './bauteile.js?v=20261028-0429';
import { treppe } from './treppe.js?v=20261028-0429';
import { matById, MATERIALIEN } from './material-db.js?v=20261028-0429';
import { pickMaterial, thumb } from './matpicker.js?v=20261028-0429';
import { floorTiles, roomRegion, symbolFootprint, SYMBOLE } from './render2d.js?v=20261028-0429';
import { wallTilePlan, bauteilSeiten, raumBauteile, bauteilHoehe, raumHoehe } from './tilecalc.js?v=20261028-0429';
import { BAUTEIL_FLIESEN } from './fliesenkatalog.js?v=20261028-0429';
import { objekt3D } from './objekte3d.js?v=20261028-0429';
import { footprint } from './site.js?v=20261028-0429';
import { icon } from './icons.js?v=20261028-0429';
import * as X from './view3d-plus.js?v=20261028-0429';
import { profi, profiAb } from './frei.js?v=20261028-0429';

const h = (tag, attrs = {}, ...kids) => { const e = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k === 'html') e.innerHTML = v; else if (v !== undefined && v !== null && v !== false) e.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat()) if (c != null) e.append(c.nodeType ? c : document.createTextNode(c)); return e; };
const M = 0.001; // mm → m
const V3 = (x, y, z) => new THREE.Vector3(x * M, z * M, -y * M); // Plan (x,y) + Höhe z → three

export function mount(app, el) { return new View3D(app, el); }

/* ───────── Materialien ───────── */
const texCache = new Map();
function texFromCanvas(canvas, key) {
  if (texCache.has(key)) return texCache.get(key);
  const t = new THREE.CanvasTexture(canvas); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; texCache.set(key, t); return t;
}
function surfMat(matId, color, fallbackMuster = 'putz') {
  const mat = matById(matId) || { muster: fallbackMuster, farben: [{ hex: color || '#ece9e2' }] };
  const col = color || mat.farben[0].hex; const st = surfaceTexture(mat, col);
  const key = 'm|' + matId + '|' + col;
  const tex = texFromCanvas(st.canvas, key);
  const glossy = ['glas', 'stehfalz', 'paneel', 'trapez', 'welle'].includes(mat.muster);
  const m = new THREE.MeshStandardMaterial({ map: tex, roughness: mat.muster === 'glas' ? 0.15 : glossy ? 0.45 : 0.9, metalness: ['stehfalz', 'trapez', 'welle'].includes(mat.muster) || mat.gruppe === 'Metall' ? 0.35 : 0.0, side: THREE.DoubleSide });
  m.userData.texW = st.w; m.userData.texH = st.h; return m;
}
const plain = (color, rough = 0.9, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, side: THREE.DoubleSide, ...extra });

/* ───────── Geometrie-Helfer ───────── */
class GeoBuilder {
  constructor() { this.pos = []; this.uv = []; this.groups = new Map(); this.idx = 0; }
  quad(mi, a, b, c, d, ua, ub, uc, ud) { // a,b,c,d: THREE.Vector3 gegen Uhrzeigersinn
    const arr = this.groups.get(mi) || []; this.groups.set(mi, arr);
    arr.push([a, b, c, ua, ub, uc], [a, c, d, ua, uc, ud]);
  }
  tri(mi, a, b, c, ua, ub, uc) { const arr = this.groups.get(mi) || []; this.groups.set(mi, arr); arr.push([a, b, c, ua, ub, uc]); }
  build(materials) {
    const g = new THREE.BufferGeometry(); const pos = [], uv = []; let start = 0; const groups = [];
    for (const [mi, tris] of this.groups) { for (const [a, b, c, ua, ub, uc] of tris) { pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z); uv.push(ua[0], ua[1], ub[0], ub[1], uc[0], uc[1]); } groups.push([start, tris.length * 3, mi]); start += tris.length * 3; }
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    for (const [s, c, mi] of groups) g.addGroup(s, c, mi); g.computeVertexNormals();
    return new THREE.Mesh(g, materials);
  }
}
function clipHalf(poly, fn) { const out = []; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length]; const fa = fn(a), fb = fn(b); if (fa >= 0) out.push(a); if ((fa >= 0) !== (fb >= 0)) { const t = fa / (fa - fb); out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }); } } return out; }
function capTris(poly) { const pts = poly.map(p => new THREE.Vector2(p.x, p.y)); if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse(); const tri = THREE.ShapeUtils.triangulateShape(pts, []); return { pts, tri }; }

class View3D {
  constructor(app, el) {
    this.app = app; this.el = el; el.innerHTML = ''; this.sideTitle = '3D & Fassade';
    this.opt = { dach: true, gelaende: true, nachbarn: true, bis: null, schatten: true, stunde: 15, innen: false, hoehenlinien: true };
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.05;
    el.append(this.renderer.domElement);
    this.scene = new THREE.Scene(); this.scene.background = new THREE.Color('#cfe1f1'); this.scene.fog = new THREE.Fog('#cfe1f1', 120, 420);
    this.cam = new THREE.PerspectiveCamera(40, 1, 0.1, 2000); this.cam.position.set(18, 12, 22);
    this.ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, -500, 500); this.active = this.cam;
    this.controls = new OrbitControls(this.cam, this.renderer.domElement); this.controls.enableDamping = true; this.controls.target.set(5, 2, -4.5);
    this.hemi = new THREE.HemisphereLight('#ffffff', '#9a9686', 1.5); this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4e0', 2.2); this.sun.castShadow = true; this.sun.shadow.mapSize.set(2048, 2048); const sc = this.sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 260; sc.updateProjectionMatrix(); this.sun.shadow.bias = -0.0004; this.sun.shadow.normalBias = 0.035; this.scene.add(this.sun); this.scene.add(this.sun.target);
    this.root = new THREE.Group(); this.scene.add(this.root);
    this.bar = h('div', { class: 'v3-bar' }); el.append(this.bar); this.renderBar();
    this.ray = new THREE.Raycaster();
    new ResizeObserver(() => this.resize()).observe(el); this.resize();
    this.bindPick();
    this.build(true);
    const loop = () => { if (this.dead) return; if (!el.classList.contains('hidden')) { if (this.active === this.cam) this.controls.update(); this.renderer.render(this.scene, this.active); } this.raf = requestAnimationFrame(loop); };
    loop();
  }
  hide() { this.dead = true; cancelAnimationFrame(this.raf); this.renderer.dispose(); this.el.innerHTML = ''; }
  refresh() { clearTimeout(this._rb); this._rb = setTimeout(() => this.build(false), 120); }
  resize() { const r = this.el.getBoundingClientRect(); if (!r.width) return; this.renderer.setSize(r.width, r.height, false); this.renderer.domElement.style.width = '100%'; this.renderer.domElement.style.height = '100%'; this.cam.aspect = r.width / r.height; this.cam.updateProjectionMatrix(); this.aspect = r.width / r.height; this.setOrtho(); }
  renderBar() {
    const b = this.bar; b.innerHTML = '';
    const btn = (l, fn, on) => h('button', { class: 'btn sm' + (on ? ' on' : ''), onclick: fn }, l);
    b.append(btn('Perspektive', () => this.view('persp'), this.active === this.cam), btn('Süd', () => this.view('S')), btn('Nord', () => this.view('N')), btn('Ost', () => this.view('O')), btn('West', () => this.view('W')), btn('Draufsicht', () => this.view('top')),
      btn('Dach', () => { this.opt.dach = !this.opt.dach; this.build(); this.renderBar(); }, this.opt.dach),
      btn('Einrichtung', () => { this.opt.objekte = this.opt.objekte === false; this.build(); this.renderBar(); }, this.opt.objekte !== false), profi(btn('Gelände', () => { this.opt.gelaende = !this.opt.gelaende; this.build(); this.renderBar(); }, this.opt.gelaende)),
      h('button', { class: 'btn sm', onclick: () => this.savePng(), html: icon('png') + 'Bild (PNG)' }));
    const rooms = this.app.doc.p.storeys.flatMap(st => this.app.doc.all('room', st.id).filter(r => r.poly));
    if (rooms.length) {
      const sel = h('select', { class: 'btn sm', title: 'Raum von innen ansehen (Fliesen an den Wänden)', onchange: () => { if (sel.value) this.raumInnen(sel.value); } });
      sel.append(h('option', { value: '' }, '👁 Raum von innen …'));
      for (const r of rooms) sel.append(h('option', { value: r.id, selected: this.innenRaum === r.id }, `${r.nr ? r.nr + ' ' : ''}${r.name || 'Raum'}`));
      b.append(sel);
    }
  }
  /* ───── Szene aufbauen ───── */
  build(fit) {
    const doc = this.app.doc; const root = this.root;
    while (root.children.length) { const c = root.children.pop(); c.traverse(o => { if (o.geometry) o.geometry.dispose(); }); }
    this.pick = [];
    const storeys = doc.p.storeys; const bisIdx = this.opt.bis == null ? storeys.length - 1 : this.opt.bis;
    let bbAll = null;
    storeys.forEach((st, si) => {
      if (si > bisIdx) return;
      const geo = W.storeyGeometry(doc, st.id); const lowest = si === 0;
      for (const g of geo.wg.values()) { const m = this.wallMesh(doc, geo, st, g, lowest); if (m) { root.add(m); } }
      for (const oi of geo.openings) { const m = this.openingMesh(doc, st, oi); if (m) root.add(m); }
      // Decke/Bodenplatte
      const unter = si > 0 ? storeys[si - 1] : null;
      const loecher = doc.all('durchbruch', st.id).filter(d => d.in !== 'decke').map(d => d.pts)
        .concat(unter ? doc.all('durchbruch', unter.id).filter(d => d.in === 'decke').map(d => d.pts) : [])
        .concat(unter ? doc.all('stair', unter.id).filter(tr => doc.visible(tr)).map(tr => treppe(tr).umriss) : []);
      for (const it of geo.body) {
        const inner = G.offsetPolys([G.ensureCCW(it.outer)], -60)[0] || it.outer;
        const teile = loecher.length ? G.differenceTree([G.ensureCCW(inner)], loecher.map(G.ensureCCW)) : [{ outer: inner, holes: [] }];
        for (const tl of teile) {
          const shape = new THREE.Shape(G.ensureCCW(tl.outer).map(p => new THREE.Vector2(p.x * M, p.y * M)));
          for (const hh of tl.holes) shape.holes.push(new THREE.Path(hh.map(p => new THREE.Vector2(p.x * M, p.y * M))));
          const eg = new THREE.ExtrudeGeometry(shape, { depth: (st.slab || 200) * M, bevelEnabled: false });
          const slab = new THREE.Mesh(eg, plain('#b9b6ae', 0.95)); slab.rotation.x = -Math.PI / 2; slab.position.y = (st.elevation - (st.slab || 200)) * M; slab.receiveShadow = true; slab.castShadow = true; root.add(slab);
        }
        bbAll = G.bboxUnion(bbAll, G.bbox(it.outer));
      }
      // Körper/Podeste/freie Decken, Unterzüge
      for (const k of doc.all('koerper', st.id)) { if (!doc.visible(k)) continue; const z0 = k.z0 || 0, z1 = k.z1 != null ? k.z1 : (st.roomHeight || 2500); if (z1 - z0 < 1) continue;
        const sh = new THREE.Shape(G.ensureCCW(k.pts).map(p => new THREE.Vector2(p.x * M, p.y * M))); const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: (z1 - z0) * M, bevelEnabled: false }), plain(k.art === 'kamin' ? '#b5654a' : k.art === 'decke' ? '#c9c6be' : '#dedad2', 0.85)); m.rotation.x = -Math.PI / 2; m.position.y = (st.elevation + z0) * M; m.castShadow = true; m.receiveShadow = true; m.userData = { kind: 'koerper', id: k.id }; this.pick.push(m); root.add(m); }
      for (const bk of doc.all('balken', st.id)) { if (!doc.visible(bk)) continue; const L = G.dist(bk.a, bk.b); const hh = bk.hoehe || 300, bw = bk.breite || 240; const top = st.roomHeight || 2500;
        const m = new THREE.Mesh(new THREE.BoxGeometry(L * M, hh * M, bw * M), plain(bk.material === 'stahl' ? '#4b5563' : bk.material === 'holz' ? '#b58a5c' : '#c9c6be', bk.material === 'stahl' ? 0.4 : 0.85)); const c = G.mid(bk.a, bk.b); m.position.copy(V3(c.x, c.y, st.elevation + top - hh / 2)); m.rotation.y = Math.atan2(bk.b.y - bk.a.y, bk.b.x - bk.a.x); m.castShadow = true; m.userData = { kind: 'balken', id: bk.id }; this.pick.push(m); root.add(m); }
      for (const tr of doc.all('stair', st.id)) if (doc.visible(tr)) root.add(this.stairMesh(doc, st, tr));
      // Einrichtung / Sanitär / Küche / Außenobjekte
      if (this.opt.objekte !== false) {
        const raeume = doc.all('room', st.id).filter(r => r.poly);
        for (const sy of doc.all('symbol', st.id)) {
          if (!doc.visible(sy)) continue;
          const raum = raeume.find(r => G.pointInPoly(sy.p, r.poly)); const H = raum ? raumHoehe(doc, raum) : (st.roomHeight || 2500);
          const o = objekt3D(sy, H, BAUTEIL_FLIESEN[sy.kind] && !/wanne|duschtasse/.test(sy.kind) ? bauteilHoehe(sy, H) : null);
          if (o) { o.position.y = st.elevation * M; root.add(o); o.traverse(c => { if (c.isMesh) this.pick.push(c); }); }
        }
      }
      // Böden mit Fliesen
      for (const r of doc.all('room', st.id)) if (r.poly) { root.add(this.floorMesh(doc, geo, st, r)); try { const g2 = this.wandFliesenMesh(doc, geo, st, r); if (g2) root.add(g2); } catch (e) { console.error('Wandfliesen 3D', e); } }
      // oberste Decke unter Dach
      if (si === bisIdx && this.opt.dach && (!doc.p.roofs.find(rf => rf.storey === st.id) || (doc.p.roofs.find(rf => rf.storey === st.id) || {}).typ === 'flach')) {
        for (const it of geo.body) { const shape = new THREE.Shape(G.ensureCCW(G.offsetPolys([G.ensureCCW(it.outer)], -60)[0] || it.outer).map(p => new THREE.Vector2(p.x * M, p.y * M))); const eg = new THREE.ExtrudeGeometry(shape, { depth: (st.slab || 200) * M, bevelEnabled: false }); const slab = new THREE.Mesh(eg, plain('#9b9890', 0.95)); slab.rotation.x = -Math.PI / 2; slab.position.y = (st.elevation + st.height - (st.slab || 200)) * M; slab.castShadow = true; root.add(slab); }
      }
    });
    if (this.opt.dach) for (const rf of doc.p.roofs) { const si = storeys.findIndex(s => s.id === rf.storey); if (si >= 0 && si <= bisIdx) this.roofMesh(doc, rf); }
    this.siteMesh(doc, bbAll);
    this.bb = bbAll || { x0: 0, y0: 0, x1: 10000, y1: 8000, w: 10000, h: 8000 };
    const c = { x: (this.bb.x0 + this.bb.x1) / 2, y: (this.bb.y0 + this.bb.y1) / 2 };
    this.sun.target.position.copy(V3(c.x, c.y, 0)); { const sc = this.sun.shadow.camera; const R = Math.min(90, Math.max(this.bb.w, this.bb.h) * M * 0.5 + 28); sc.left = -R; sc.right = R; sc.top = R; sc.bottom = -R; sc.updateProjectionMatrix(); }
    this.setSun();
    X.clipAnwenden(this);
    if (fit) { this.controls.target.copy(V3(c.x, c.y, 2800)); const R = Math.max(this.bb.w, this.bb.h); this.cam.position.copy(V3(c.x - R * 1.05, c.y - R * 1.9, R * 1.05)); this.controls.update(); }
  }
  setSun() { X.setSun(this); }
  wallMesh(doc, geo, st, g, lowest) {
    const w = g.w; const H = w.height || st.height; const z0 = st.elevation, z1 = st.elevation + H;
    const os = W.outsideSide(geo, g);
    const facade = os ? surfMat(w.facade || doc.p.settings.stdFassade || 'putz-scheibenputz', w.facadeColor, 'putz') : null;
    const sockel = os && lowest && w.sockelH ? surfMat(w.sockel || 'putz-scheibenputz', w.sockelColor || '#4A4D4F', 'putz') : null;
    const innen = plain('#f4f2ee', 0.95), cap = plain('#8f8b84', 0.95), laibung = plain('#ebe8e2', 0.95);
    const mats = [cap, innen, facade || innen, laibung, sockel || facade || innen];
    // Intervalle entlang der Achse
    const ops = geo.openings.filter(o => o.g === g).sort((a, b) => a.s0 - b.s0);
    const cuts = []; let s = -1e6;
    for (const o of ops) { cuts.push({ s0: s, s1: o.s0, z: [[z0, z1]] }); const top = Math.min(z1, z0 + o.o.sill + o.o.height); const parts = []; if (o.o.sill > 1) parts.push([z0, z0 + o.o.sill]); if (top < z1 - 1) parts.push([top, z1]); cuts.push({ s0: o.s0, s1: o.s1, z: parts, open: true }); s = o.s1; }
    cuts.push({ s0: s, s1: 1e6, z: [[z0, z1]] });
    const B = new GeoBuilder(); const u = g.u, n = g.n; const a = g.a;
    const sOf = (p) => G.dot(G.sub(p, a), u), dOf = (p) => G.dot(G.sub(p, a), n);
    const sideOf = (p, q) => { const d1 = dOf(p), d2 = dOf(q); const ht = w.thickness / 2; if (Math.abs(d1 - d2) < 1 && Math.abs(Math.abs(d1) - ht) < 2) return d1 > 0 ? 'L' : 'R'; return null; };
    const fW = facade ? facade.userData.texW : 1000, fH = facade ? facade.userData.texH : 1000; const sW = sockel ? sockel.userData.texW : fW, sH = sockel ? sockel.userData.texH : fH;
    for (const c of cuts) {
      let poly = clipHalf(g.poly, p => sOf(p) - c.s0); poly = clipHalf(poly, p => c.s1 - sOf(p));
      if (poly.length < 3 || G.polyArea(poly) < 1) continue;
      poly = G.ensureCCW(poly);
      for (const [za, zb] of c.z) {
        // Deckel
        const { pts, tri } = capTris(poly);
        for (const [i, j, k] of tri) { B.tri(0, V3(pts[i].x, pts[i].y, zb), V3(pts[j].x, pts[j].y, zb), V3(pts[k].x, pts[k].y, zb), [0, 0], [0, 0], [0, 0]); B.tri(0, V3(pts[i].x, pts[i].y, za), V3(pts[k].x, pts[k].y, za), V3(pts[j].x, pts[j].y, za), [0, 0], [0, 0], [0, 0]); }
        for (let i = 0; i < poly.length; i++) {
          const p = poly[i], q = poly[(i + 1) % poly.length]; if (G.dist(p, q) < 0.5) continue;
          const side = sideOf(p, q);
          let mi = 3; if (side) mi = side === os || os === 'beide' ? 2 : 1;
          const sp = sOf(p), sq = sOf(q);
          const quad = (mi2, zA, zB, tw, th) => B.quad(mi2, V3(p.x, p.y, zA), V3(q.x, q.y, zA), V3(q.x, q.y, zB), V3(p.x, p.y, zB), [sp / tw, zA / th], [sq / tw, zA / th], [sq / tw, zB / th], [sp / tw, zB / th]);
          if (mi === 2 && sockel && za < z0 + w.sockelH) { const zs = Math.min(zb, z0 + w.sockelH); quad(4, za, zs, sW, sH); if (zb > zs) quad(2, zs, zb, fW, fH); }
          else if (mi === 2) quad(2, za, zb, fW, fH);
          else quad(mi, za, zb, 1000, 1000);
        }
      }
    }
    const mesh = B.build(mats); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData = { kind: 'wall', id: w.id };
    this.pick.push(mesh); return mesh;
  }
  openingMesh(doc, st, oi) {
    const o = normalisiere(oi.o), g = oi.g; const grp = new THREE.Group(); const z0 = st.elevation + (o.sill || 0); const H = o.height; const Wd = o.width;
    const stil = matById(o.stil);
    const geo = W.storeyGeometry(doc, st.id); const os = o.aussen || W.outsideSide(geo, g); const outSign = os === 'R' ? -1 : 1;
    const t = g.w.thickness; const isWin = o.kind === 'window';
    const offN = os && isWin ? outSign * (t / 2 - 120) : os ? outSign * (t / 2 - 80) : 0; // Fenster ca. 12 cm, Haustür ca. 8 cm hinter Außenkante
    const center = G.add(oi.center, G.mul(g.n, offN));
    const ang = Math.atan2(g.u.y, g.u.x);
    grp.position.copy(V3(center.x, center.y, z0)); grp.rotation.y = ang;
    const zAus = -outSign * 1; // lokale z-Richtung zur Außenseite
    const box = (w, hh, d, x, y, mat, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w * M, hh * M, d * M), mat); m.position.set(x * M, y * M, z * M); m.castShadow = true; grp.add(m); return m; };
    const ext = (items, depth, mat, z = 0, uvScale = 0) => { // items: [{outer, holes}] in mm (x quer, y hoch)
      for (const it of items) {
        if (!it.outer || it.outer.length < 3 || G.polyArea(it.outer) < 10) continue;
        const sh = new THREE.Shape(G.ensureCCW(it.outer).map(p => new THREE.Vector2(p.x * M, p.y * M)));
        for (const hh of it.holes || []) sh.holes.push(new THREE.Path(G.ensureCW(hh).map(p => new THREE.Vector2(p.x * M, p.y * M))));
        const eg = new THREE.ExtrudeGeometry(sh, { depth: depth * M, bevelEnabled: false, curveSegments: 1 }); eg.translate(0, 0, -depth * M / 2 + z * M);
        if (uvScale) { const uv = eg.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * uvScale, uv.getY(i) * uvScale); }
        const m = new THREE.Mesh(eg, mat); m.castShadow = true; grp.add(m);
      }
    };
    const flat = (poly, mat, z = 0) => { if (!poly || poly.length < 3) return; const sg = new THREE.ShapeGeometry(new THREE.Shape(G.ensureCCW(poly).map(p => new THREE.Vector2(p.x * M, p.y * M)))); sg.translate(0, 0, z * M); const m = new THREE.Mesh(sg, mat); grp.add(m); return m; };
    const rect = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];
    // Wand-Zwickel bei runden/schrägen Öffnungen (Wand bleibt sonst rechteckig offen)
    const zwickel = (outline) => {
      const rest = G.differenceTree([rect(-Wd / 2, 0, Wd / 2, H)], [outline]); if (!rest.length) return;
      const w = g.w; let mat = plain('#ece9e2', 0.95), sc = 0;
      if (os) { mat = surfMat(w.facade || doc.p.settings.stdFassade || 'putz-scheibenputz', w.facadeColor, 'putz'); sc = 1000 / (mat.userData.texW || 1000); }
      ext(rest, t - 4, mat, offN, sc); // offN: lokale z zeigt nach -n → Wandmitte liegt bei +offN
    };
    if (isWin) {
      const typ = o.typ || 'dk1'; const f = 70, fs = 55;
      const colA = o.farbeA || o.stilColor || (stil ? stil.farben[0].hex : '#f1f0ea');
      const frameMat = plain(colA, 0.5);
      const gl = o.glas || '3fach'; const truebe = gl === 'ornament' || gl === 'satiniert';
      const glass = new THREE.MeshPhysicalMaterial({ color: truebe ? '#e9eff1' : gl === 'sonnen' ? '#6f8796' : '#9fb8c8', roughness: truebe ? 0.6 : 0.05, metalness: 0.1, transparent: true, opacity: truebe ? 0.88 : 0.45, side: THREE.DoubleSide });
      // Umriss
      let outline = rect(-Wd / 2, 0, Wd / 2, H); const arc = (cx, cy, r, a0, a1, n = 28) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); } return p; };
      if (typ === 'rundbogen') { const r = Wd / 2, yb = Math.max(0, H - r); outline = [{ x: -Wd / 2, y: 0 }, { x: Wd / 2, y: 0 }, { x: Wd / 2, y: yb }, ...arc(0, yb, r, 0, Math.PI).slice(1, -1), { x: -Wd / 2, y: yb }]; }
      else if (typ === 'segmentbogen') { const rise = Math.min(Wd / 5, H * 0.3); const R = (Wd * Wd / 4 + rise * rise) / (2 * rise); const cy = H - R; const a = Math.asin(Math.min(1, (Wd / 2) / R)); outline = [{ x: -Wd / 2, y: 0 }, { x: Wd / 2, y: 0 }, ...arc(0, cy, R, Math.PI / 2 - a, Math.PI / 2 + a)]; }
      else if (typ === 'rund') { const r = Math.min(Wd, H) / 2; outline = arc(0, H / 2, r, 0, Math.PI * 2, 40).slice(0, -1); }
      else if (typ === 'dreieck') outline = [{ x: -Wd / 2, y: 0 }, { x: Wd / 2, y: 0 }, { x: 0, y: H }];
      const eckig = !['rundbogen', 'segmentbogen', 'rund', 'dreieck'].includes(typ);
      if (!eckig) zwickel(outline);
      const inner = G.offsetPolys([outline], -f)[0] || outline;
      ext(G.differenceTree([outline], [inner]), 80, frameMat);
      // Felder: Ober-/Unterlicht und Flügel
      const auf = o.aufteilung || 'ohne'; const oh = Math.min(o.oberlichtH || 450, H * 0.4);
      const ib = G.bbox(inner); let bars = [];
      const ys = [ib.y0]; if (eckig && (auf === 'unterlicht' || auf === 'beides')) ys.push(ib.y0 + oh); if (eckig && (auf === 'oberlicht' || auf === 'beides')) ys.push(ib.y1 - oh); ys.push(ib.y1);
      for (let i = 1; i < ys.length - 1; i++) bars.push(rect(ib.x0, ys[i] - 40, ib.x1, ys[i] + 40));
      const nF = eckig ? K.fluegel(typ, Wd) : 1; const schiebe = typ === 'hs' || typ === 'psk' || typ === 'schiebe';
      const xs = [ib.x0]; for (let i = 1; i < nF; i++) xs.push(ib.x0 + (ib.x1 - ib.x0) * i / nF); xs.push(ib.x1);
      const hauptY0 = auf === 'unterlicht' || auf === 'beides' ? ys[1] : ib.y0, hauptY1 = auf === 'oberlicht' || auf === 'beides' ? ys[ys.length - 2] : ib.y1;
      if (!schiebe) for (let i = 1; i < xs.length - 1; i++) bars.push(rect(xs[i] - (typ === 'dk2' || typ === 'fenstertuer2' ? 45 : 55), hauptY0, xs[i] + (typ === 'dk2' || typ === 'fenstertuer2' ? 45 : 55), hauptY1));
      if (bars.length) ext(G.unionTree(bars).map(it => ({ outer: it.outer, holes: it.holes })).flatMap(it => G.intersectTree([it.outer], [inner])), 76, frameMat);
      // Felder (Glas + Flügelrahmen)
      const felder = [];
      for (let yi = 0; yi < ys.length - 1; yi++) {
        const ya = ys[yi] + (yi > 0 ? 40 : 0), yb = ys[yi + 1] - (yi < ys.length - 2 ? 40 : 0);
        const haupt = ys[yi] >= hauptY0 - 1 && ys[yi + 1] <= hauptY1 + 1;
        if (haupt && !schiebe) for (let xi = 0; xi < xs.length - 1; xi++) felder.push({ poly: rect(xs[xi] + (xi > 0 ? 50 : 0), ya, xs[xi + 1] - (xi < xs.length - 2 ? 50 : 0), yb), sash: typ !== 'fest', haupt: true });
        else if (haupt && schiebe) { const mid = (ib.x0 + ib.x1) / 2; felder.push({ poly: rect(ib.x0, ya, mid + 40, yb), sash: true, haupt: true, z: zAus * 18 }, { poly: rect(mid - 40, ya, ib.x1, yb), sash: true, haupt: true, z: -zAus * 18 }); }
        else felder.push({ poly: rect(ib.x0, ya, ib.x1, yb), sash: false });
      }
      if (!eckig) { felder.length = 0; felder.push({ poly: inner, sash: typ !== 'dreieck', haupt: true }); }
      const sprArt = o.sprossen || 'keine'; const bild = o.sprossenBild || 'kreuz';
      const sprMat = sprArt === 'innen' ? plain(shadeHex(colA, 0.15), 0.6) : frameMat;
      for (const fe of felder) {
        let glassPoly = fe.poly;
        if (fe.sash) { const inn = G.offsetPolys([fe.poly], -fs)[0]; if (inn) { ext(G.differenceTree([fe.poly], [inn]), 66, frameMat, (fe.z || 0) + zAus * 4); glassPoly = inn; } }
        flat(glassPoly, glass, fe.z || 0);
        if (sprArt !== 'keine' && fe.haupt) {
          const bb = G.bbox(glassPoly); const bw = sprArt === 'echt' ? 45 : sprArt === 'innen' ? 18 : 28; const sb = [];
          const [cols, rows] = { kreuz: [2, 2], '2x3': [2, 3], '3x3': [3, 3], '2x4': [2, 4], quer1: [1, 2], quer2: [1, 3], senk1: [2, 1], oben: [1, 1] }[bild] || [2, 2];
          for (let i = 1; i < cols; i++) { const x = bb.x0 + bb.w * i / cols; sb.push(rect(x - bw / 2, bb.y0, x + bw / 2, bb.y1)); }
          for (let j = 1; j < rows; j++) { const y = bb.y0 + bb.h * j / rows; sb.push(rect(bb.x0, y - bw / 2, bb.x1, y + bw / 2)); }
          if (bild === 'oben') { const y = bb.y0 + bb.h * 2 / 3; sb.push(rect(bb.x0, y - bw / 2, bb.x1, y + bw / 2)); for (let i = 1; i < 3; i++) { const x = bb.x0 + bb.w * i / 3; sb.push(rect(x - bw / 2, y, x + bw / 2, bb.y1)); } }
          if (sb.length) { const cut = G.intersectTree(G.unionTree(sb).map(it => it.outer), [glassPoly]); if (sprArt === 'innen') ext(cut, 8, sprMat, fe.z || 0); else { ext(cut, 14, sprMat, (fe.z || 0) + zAus * 10); ext(cut, 14, sprMat, (fe.z || 0) - zAus * 10); } }
        }
      }
      // Fensterbänke
      const fbFarbe = { alu: '#a7acb0', naturstein: '#cfc8bb', klinker: '#8b4a35', beton: '#bdbab3', holz: '#b9895a', fliesen: '#d9d6cf', kunststein: '#e3e0d8' };
      if (os && !K.istBodentief(typ) && (o.fbA || 'alu') !== 'ohne') box(Wd + 60, 30, 210, 0, -15, plain(fbFarbe[o.fbA || 'alu'] || '#a7acb0', 0.4), zAus * 110);
      if (!K.istBodentief(typ) && o.sill > 50 && (o.fbI || 'naturstein') !== 'ohne') box(Wd + 40, 25, Math.max(120, t - 230), 0, -12, plain(fbFarbe[o.fbI || 'naturstein'] || '#cfc8bb', 0.5), -zAus * (t - 230) / 2 - zAus * 20);
      // Sonnenschutz
      const ss = o.sonnenschutz || 'ohne'; const ssMat = plain(colA, 0.6);
      if (ss === 'rl_aufsatz') { box(Wd, 220, 60, 0, H + 110, ssMat, zAus * 20); for (const sx of [-1, 1]) box(30, H, 40, sx * (Wd / 2 - 15), H / 2, plain('#9aa0a6', 0.4), zAus * 70); }
      if (ss === 'rl_vorbau' || ss === 'raffstore') { const bh = ss === 'raffstore' ? 160 : 220; box(Wd + 40, bh, bh, 0, H + bh / 2, ssMat, zAus * (120 + bh / 2)); for (const sx of [-1, 1]) box(30, H, 40, sx * (Wd / 2 + 5), H / 2, plain('#9aa0a6', 0.4), zAus * 135); }
      if (ss === 'klappladen' || ss === 'schiebeladen') {
        const lm = new THREE.MeshStandardMaterial({ map: ladenTexture(colA), roughness: 0.7 });
        const lw = Wd / 2; const sides = ss === 'klappladen' ? [-1, 1] : [1];
        for (const sx of sides) box(ss === 'klappladen' ? lw : Wd, H, 30, sx * (Wd / 2 + (ss === 'klappladen' ? lw : Wd) / 2 + 25), H / 2, lm, zAus * 140);
      }
    } else if (o.kind === 'door' || o.kind === 'schiebetuer') {
      const art = o.art || 'dreh1'; const f = 60;
      const aussenTuer = !!os && /haustuer|nebeneingang|garagentor/.test(art);
      const col = o.farbe || o.stilColor || (stil ? stil.farben[0].hex : aussenTuer ? '#383e42' : '#f4f3ee');
      const frameMat = plain(col, 0.5);
      if (art !== 'garagentor') { box(Wd, f, aussenTuer ? 80 : Math.max(60, t), 0, H - f / 2, frameMat); box(f, H, aussenTuer ? 80 : Math.max(60, t), -Wd / 2 + f / 2, H / 2, frameMat); box(f, H, aussenTuer ? 80 : Math.max(60, t), Wd / 2 - f / 2, H / 2, frameMat); }
      const leafH = H - f; const L0 = -Wd / 2 + f, L1 = Wd / 2 - f;
      const glas = new THREE.MeshPhysicalMaterial({ color: '#cfdde6', roughness: 0.15, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
      const blatt = (x0, x1, design) => {
        const w = x1 - x0, cx = (x0 + x1) / 2; let mat;
        if (aussenTuer && stil && art !== 'garagentor') mat = new THREE.MeshStandardMaterial({ map: doorTexture(stil, col, w, leafH), roughness: 0.5 });
        else if (design === 'ganzglas') mat = glas; else mat = plain(col, 0.55);
        const lf = box(w - 4, leafH, 42, cx, leafH / 2, mat); lf.userData = { kind: 'opening', id: o.id }; this.pick.push(lf);
        if (design === 'glasausschnitt') { flat(rect(cx - w * 0.28, leafH * 0.38, cx + w * 0.28, leafH * 0.85), glas, 22); flat(rect(cx - w * 0.28, leafH * 0.38, cx + w * 0.28, leafH * 0.85), glas, -22); }
        if (design === 'lisenen') for (let i = 0; i < 5; i++) for (const zz of [22, -22]) box(w * 0.7, 8, 3, cx, leafH * (0.25 + i * 0.12), plain(shadeHex(col, 0.12), 0.6), zz);
        if (design === 'kassette' || design === 'stil') for (const [yy, hh] of [[0.12, 0.33], [0.55, 0.38]]) for (const zz of [23, -23]) box(w * 0.62, leafH * hh, 8, cx, leafH * (yy + hh / 2), plain(shadeHex(col, 0.06), 0.55), zz);
        if (art !== 'garagentor' && !/^schiebe|falt/.test(art)) { const hx = o.hinge === 'rechts' ? x0 + 70 : x1 - 70; for (const zz of [30, -30]) box(120, 18, 18, hx + (o.hinge === 'rechts' ? 50 : -50), 1050, plain('#b9bec3', 0.3, { metalness: 0.6 }), zz); }
      };
      const design = o.blatt || 'glatt';
      if (art === 'dreh2' || art === 'dreh2sym') { const b = K.TUER_BREITEN_2.find(x => x.rb === Wd); const geh = art === 'dreh2sym' || !b ? 0.5 : b.geh / (b.geh + b.stand); const xm = L0 + (L1 - L0) * (o.hinge === 'rechts' ? 1 - geh : geh); blatt(L0, xm, design); blatt(xm, L1, design); }
      else if (art === 'falt') { const k = 4; for (let i = 0; i < k; i++) blatt(L0 + (L1 - L0) * i / k, L0 + (L1 - L0) * (i + 1) / k, design); }
      else if (art === 'schiebe2') { const xm = (L0 + L1) / 2; blatt(L0, xm, design); blatt(xm, L1, design); }
      else if (art === 'haustuer_st') {
        const stw = Math.min((L1 - L0) * 0.45, o.seitenteil || 400); const re = o.hinge === 'rechts';
        const sx0 = re ? L0 : L1 - stw, sx1 = re ? L0 + stw : L1; box(50, leafH, 70, re ? sx1 + 25 : sx0 - 25, leafH / 2, frameMat);
        flat(rect(sx0 + 20, 20, sx1 - 20, leafH - 20), glas, 0); blatt(re ? sx1 + 50 : L0, re ? L1 : sx0 - 50, design);
      } else if (art === 'garagentor') {
        const tm = new THREE.MeshStandardMaterial({ map: torTexture(col, Wd, H), roughness: 0.6 }); const tor = box(Wd - 20, H - 10, 40, 0, (H - 10) / 2, tm); tor.userData = { kind: 'opening', id: o.id }; this.pick.push(tor);
      } else blatt(L0, L1, design);
      if (o.schwelle && o.schwelle !== 'ohne') box(Wd, o.schwelle === 'flach' ? 15 : 25, Math.max(80, t * 0.6), 0, 8, plain('#8d9196', 0.4));
    } else if (o.form === 'rundbogen' || o.form === 'segmentbogen') {
      const arcPts = (cx, cy, r, a0, a1, n = 24) => { const p = []; for (let i = 0; i <= n; i++) { const a = a0 + (a1 - a0) * i / n; p.push({ x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r }); } return p; };
      let outline;
      if (o.form === 'rundbogen') { const r = Wd / 2, yb = Math.max(0, H - r); outline = [{ x: -Wd / 2, y: 0 }, { x: Wd / 2, y: 0 }, { x: Wd / 2, y: yb }, ...arcPts(0, yb, r, 0, Math.PI).slice(1, -1), { x: -Wd / 2, y: yb }]; }
      else { const rise = Math.min(Wd / 5, H * 0.3); const R = (Wd * Wd / 4 + rise * rise) / (2 * rise); const a = Math.asin(Math.min(1, (Wd / 2) / R)); outline = [{ x: -Wd / 2, y: 0 }, { x: Wd / 2, y: 0 }, ...arcPts(0, H - R, R, Math.PI / 2 - a, Math.PI / 2 + a)]; }
      zwickel(outline);
    }
    grp.traverse(m => { if (m.isMesh && !m.userData.kind) { m.userData = { kind: 'opening', id: o.id }; this.pick.push(m); } });
    return grp;
  }
  stairMesh(doc, st, s) {
    const g = treppe(s); const n = g.linien.length; const hoehe = s.hoehe || st.height || 2750; const hh = hoehe / n;
    const grp = new THREE.Group(); const mat = plain(K.TREPPEN_FARBE[s.material || 'beton'] || '#a9a59c', s.material === 'stahl' ? 0.4 : 0.8, s.material === 'stahl' ? { metalness: 0.5 } : {});
    g.flaechen.forEach((f, k) => {
      if (f.length < 3 || G.polyArea(f) < 100) return;
      const shape = new THREE.Shape(G.ensureCCW(f).map(p => new THREE.Vector2(p.x * M, p.y * M)));
      const dick = g.rund || s.material === 'stahl' || s.material === 'holz' ? Math.min(hh, 60) : hh * (k + 1);
      const eg = new THREE.ExtrudeGeometry(shape, { depth: dick * M, bevelEnabled: false });
      const m = new THREE.Mesh(eg, mat); m.rotation.x = -Math.PI / 2; m.position.y = (st.elevation + (k + 1) * hh - dick) * M; m.castShadow = true; m.receiveShadow = true; m.userData = { kind: 'stair', id: s.id }; grp.add(m);
    });
    if (g.spindel) { const c = g.spindel.c; const cy = new THREE.Mesh(new THREE.CylinderGeometry(g.spindel.r * M, g.spindel.r * M, hoehe * M, 20), plain('#6b6f74', 0.4, { metalness: 0.5 })); cy.position.copy(V3(c.x, c.y, st.elevation + hoehe / 2)); grp.add(cy); }
    return grp;
  }
  floorMesh(doc, geo, st, r) {
    const res = floorTiles(doc, geo, r); const bb = G.bbox(r.poly);
    let mat;
    if (res && r.tiles && r.tiles.boden) {
      const cfg = r.tiles.boden; const px = 0.25; // px pro mm (max 2048)
      const sc = Math.min(px, 2048 / Math.max(bb.w, bb.h)); const cv = document.createElement('canvas'); cv.width = Math.ceil(bb.w * sc); cv.height = Math.ceil(bb.h * sc); const c = cv.getContext('2d');
      c.fillStyle = cfg.fugeFarbe || '#a8a29a'; c.fillRect(0, 0, cv.width, cv.height);
      const surf = tileSurface(cfg, 256);
      for (const p of res.pieces) {
        c.save(); c.beginPath(); p.poly.forEach((q, i) => { const X = (q.x - bb.x0) * sc, Y = (bb.y1 - q.y) * sc; i ? c.lineTo(X, Y) : c.moveTo(X, Y); }); c.closePath(); c.clip();
        const sf = p.zcfg && p.zcfg !== cfg ? tileSurface(p.zcfg, 256) : surf;
        if (p.wr0) { const X = (q) => (q.x - bb.x0) * sc, Y = (q) => (bb.y1 - q.y) * sc; const a = (X(p.wr1) - X(p.wr0)) / sf.width, b = (Y(p.wr1) - Y(p.wr0)) / sf.width, cc = (X(p.wr2) - X(p.wr0)) / sf.height, d = (Y(p.wr2) - Y(p.wr0)) / sf.height; c.setTransform(a, b, cc, d, X(p.wr0), Y(p.wr0)); c.drawImage(sf, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0); }
        c.restore();
      }
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      mat = new THREE.MeshStandardMaterial({ map: tex, roughness: cfg.textur === 'glanz' ? 0.25 : 0.6 });
    } else mat = plain('#d8cdb9', 0.8);
    const shape = new THREE.Shape(G.ensureCCW(r.poly).map(p => new THREE.Vector2(p.x * M, p.y * M)));
    const g = new THREE.ShapeGeometry(shape);
    const pos = g.attributes.position; const uv = [];
    for (let i = 0; i < pos.count; i++) { const x = pos.getX(i) / M, y = pos.getY(i) / M; uv.push((x - bb.x0) / bb.w, (y - bb.y0) / bb.h); }
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const m = new THREE.Mesh(g, mat); m.rotation.x = -Math.PI / 2; m.position.y = (st.elevation + 2) * M; m.receiveShadow = true; m.userData = { kind: 'room', id: r.id }; this.pick.push(m);
    return m;
  }
  /** Wandfliesen, Fries/Sockel und geflieste Bauteile (Vorwand, Schacht, Wannenschürze) eines Raums */
  wandFliesenMesh(doc, geo, st, r) {
    const grp = new THREE.Group(); const z0 = st.elevation; const H = raumHoehe(doc, r);
    const wp = wallTilePlan(doc, r, floorTiles(doc, geo, r)); if (!wp) return grp.children.length ? grp : null;
    const baseCfg = wp.cfg;
    // Fläche (Pieces in lokalen x/y-Koordinaten) als Textur auf ein Viereck legen
    const panel = (len, top, pieces, regionsFn, baender, cfg, ecken) => {
      const sc = Math.min(0.3, 2048 / Math.max(len, top, 1)); const cv = document.createElement('canvas'); cv.width = Math.max(2, Math.ceil(len * sc)); cv.height = Math.max(2, Math.ceil(top * sc)); const c = cv.getContext('2d');
      const X = (q) => q.x * sc, Y = (q) => (top - q.y) * sc;
      const pfad = (poly) => { poly.forEach((q, i) => i ? c.lineTo(X(q), Y(q)) : c.moveTo(X(q), Y(q))); c.closePath(); };
      regionsFn(c, pfad);
      for (const b of baender || []) { c.fillStyle = b.farbe; c.fillRect(0, Y({ y: b.z1 }), cv.width, (b.z1 - b.z0) * sc); }
      const cache = new Map();
      for (const p of pieces) {
        const pc = p.zcfg || cfg; let sf = cache.get(pc); if (!sf) { sf = tileSurface(pc, 192); cache.set(pc, sf); }
        c.save(); c.beginPath(); pfad(p.poly); c.clip();
        if (p.wr0) { const a = (X(p.wr1) - X(p.wr0)) / sf.width, b = (Y(p.wr1) - Y(p.wr0)) / sf.width, cc = (X(p.wr2) - X(p.wr0)) / sf.height, d = (Y(p.wr2) - Y(p.wr0)) / sf.height; c.setTransform(a, b, cc, d, X(p.wr0), Y(p.wr0)); c.drawImage(sf, 0, 0); c.setTransform(1, 0, 0, 1, 0, 0); }
        else { c.fillStyle = pc.farbe || '#ddd'; c.fill(); }
        c.restore();
      }
      const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const mat = new THREE.MeshStandardMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, roughness: cfg.textur === 'glanz' ? 0.22 : 0.6 });
      const g = new THREE.BufferGeometry(); const v = ecken.flatMap(e => [e.x, e.y, e.z]);
      g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2)); g.setIndex([0, 1, 2, 0, 2, 3]); g.computeVertexNormals();
      const m = new THREE.Mesh(g, mat); m.receiveShadow = true; m.userData = { kind: 'room', id: r.id }; return m;
    };
    const fuellen = (regions, farbe) => (c, pfad) => { c.fillStyle = farbe; for (const rg of regions) { c.beginPath(); pfad(rg.outer); for (const hh of rg.holes) pfad(hh); c.fill('evenodd'); } };
    for (const w of wp.walls) {
      const s = w.s; let nIn = G.perp(s.u); const mid = G.add(s.a, G.mul(s.u, s.len / 2)); if (!G.pointInPoly(G.add(mid, G.mul(nIn, 60)), r.poly)) nIn = G.mul(nIn, -1);
      const top = Math.max(w.top || 0, ...w.baender.map(b => b.z1)); if (top <= 0) continue;
      const pieces = w.zonen.flatMap(z => z.pieces); if (!pieces.length && !w.baender.length) continue;
      const fz = (c, pfad) => { for (const z of w.zonen) fuellen(z.regions, z.cfg.fugeFarbe || '#b9b3aa')(c, pfad); };
      const bd = w.baender.map(b => ({ z0: b.z0, z1: b.z1, farbe: b.art === 'sockel' && b.cfg.quelle === 'boden' && r.tiles.boden ? r.tiles.boden.farbe : (b.cfg.farbe || '#9ca3af') }));
      const off = G.mul(nIn, 3); const A = G.add(s.a, off), B = G.add(s.b, off);
      grp.add(panel(s.len, top, pieces, fz, bd, w.cfg || baseCfg, [V3(A.x, A.y, z0), V3(B.x, B.y, z0), V3(B.x, B.y, z0 + top), V3(A.x, A.y, z0 + top)]));
    }
    // geflieste Bauteile
    for (const bt of wp.bauteile || []) {
      const seiten = bauteilSeiten(bt.sy, r); const fp = symbolFootprint(bt.sy); const ccw = G.polyAreaSigned(fp) > 0;
      for (const f of bt.faces) {
        const sd = seiten.find(x => x.name === f.name); if (!sd) continue;
        const d = G.norm(G.sub(sd.b, sd.a)); const nOut = ccw ? { x: d.y, y: -d.x } : { x: -d.y, y: d.x }; const off = G.mul(nOut, 3);
        const A = G.add(sd.a, off), B = G.add(sd.b, off);
        grp.add(panel(f.len, f.h, f.pieces, fuellen([f.region], bt.cfg.fugeFarbe || '#b9b3aa'), null, bt.cfg, [V3(A.x, A.y, z0), V3(B.x, B.y, z0), V3(B.x, B.y, z0 + f.h), V3(A.x, A.y, z0 + f.h)]));
      }
      if (bt.oben) { const zz = z0 + bt.h + 3; grp.add(panel(bt.oben.len, bt.oben.h, bt.oben.pieces, fuellen([bt.oben.region], bt.cfg.fugeFarbe || '#b9b3aa'), null, bt.cfg, [V3(fp[0].x, fp[0].y, zz), V3(fp[1].x, fp[1].y, zz), V3(fp[2].x, fp[2].y, zz), V3(fp[3].x, fp[3].y, zz)])); }
    }
    return grp;
  }
  /** Dachfenster und Gauben auf einer Dachfläche */
  dachAufbauten(doc, rf, R, mat, st) {
    const faceAt = (p) => { let best = null, bz = Infinity; for (const f of R.faces) { const pl = f.plane; const z = pl.z0 + pl.k * G.dot(G.sub(p, pl.q), pl.n); if (G.pointInPoly(p, f.poly) && z < bz) { bz = z; best = pl; } } if (!best) for (const f of R.faces) { const pl = f.plane; const z = pl.z0 + pl.k * G.dot(G.sub(p, pl.q), pl.n); if (z < bz) { bz = z; best = pl; } } return best; };
    const quad = (pts, m, uvs) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flatMap(v => [v.x, v.y, v.z]), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs || pts.flatMap((_, i) => [[0, 0], [1, 0], [1, 1], [0, 1]][i % 4] || [0, 0]), 2)); g.setIndex(pts.length === 4 ? [0, 1, 2, 0, 2, 3] : [0, 1, 2]); g.computeVertexNormals(); const me = new THREE.Mesh(g, m); me.castShadow = true; me.receiveShadow = true; return me; };
    const glas = plain('#1f2a33', 0.1, { metalness: 0.3 }), rahmen = plain('#4b5563', 0.5);
    const gw = doc.all('wall', st.id).find(w => w.art === 'aussen'); const wm = surfMat((gw && gw.facade) || 'putz-scheibenputz', gw && gw.facadeColor, 'putz');
    for (const df of doc.all('dachfenster').filter(x => x.roof === rf.id && doc.visible(x))) {
      const pl = faceAt(df.p); if (!pl) continue; const n = pl.n, t = G.perp(n); const cosA = 1 / Math.sqrt(1 + pl.k * pl.k); const lp = (df.laenge || 1180) * cosA; const w = df.breite || 780;
      const pt = (along, up, dz) => { const q = G.add(G.add(df.p, G.mul(t, along)), G.mul(n, up)); return V3(q.x, q.y, pl.z0 + pl.k * G.dot(G.sub(q, pl.q), pl.n) + dz); };
      const g = new THREE.Group(); g.userData = { kind: 'dachfenster', id: df.id };
      g.add(quad([pt(-w / 2 - 40, -40, 240), pt(w / 2 + 40, -40, 240), pt(w / 2 + 40, lp + 40, 240), pt(-w / 2 - 40, lp + 40, 240)], rahmen));
      g.add(quad([pt(-w / 2 + 50, 50, 252), pt(w / 2 - 50, 50, 252), pt(w / 2 - 50, lp - 50, 252), pt(-w / 2 + 50, lp - 50, 252)], glas));
      g.traverse(c => { if (c.isMesh) this.pick.push(c); }); this.root.add(g);
    }
    for (const gb of doc.all('gaube').filter(x => x.roof === rf.id && doc.visible(x))) {
      const pl = faceAt(gb.p); if (!pl) continue; const n = pl.n, t = G.perp(n); const k = pl.k; const b = gb.breite || 2000, H = gb.hoehe || 1600;
      const zb = pl.z0 + k * G.dot(G.sub(gb.p, pl.q), pl.n);
      const P3 = (along, up, z) => { const q = G.add(G.add(gb.p, G.mul(t, along)), G.mul(n, up)); return V3(q.x, q.y, z); };
      const grp = new THREE.Group(); grp.userData = { kind: 'gaube', id: gb.id };
      const typ = gb.typ || 'schlepp'; const k2 = typ === 'schlepp' ? Math.tan(G.rad(12)) : 0; const rise = (typ === 'sattel' || typ === 'walm') ? (b / 2) * Math.tan(G.rad(40)) : 0;
      const sE = k > k2 + 0.01 ? H / (k - k2) : 3000; // Traufe trifft Hauptdach
      // Vorderwand (bei Satteldachgaube mit Giebeldreieck)
      const front = [P3(-b / 2, 0, zb - 50), P3(b / 2, 0, zb - 50), P3(b / 2, 0, zb + H), P3(-b / 2, 0, zb + H)];
      grp.add(quad(front, wm));
      if (rise) grp.add(quad([P3(-b / 2, 0, zb + H), P3(b / 2, 0, zb + H), P3(0, 0, zb + H + rise)], wm));
      // Seitenwangen
      for (const s of [-1, 1]) grp.add(quad([P3(s * b / 2, 0, zb - 50), P3(s * b / 2, sE, zb + k * sE - 50), P3(s * b / 2, sE, zb + H + k2 * sE), P3(s * b / 2, 0, zb + H)], wm));
      // Gaubendach
      const ue = 250; const dm = mat;
      if (typ === 'schlepp' || typ === 'flach') grp.add(quad([P3(-b / 2 - ue, -ue, zb + H - k2 * ue), P3(b / 2 + ue, -ue, zb + H - k2 * ue), P3(b / 2 + ue, sE + 200, zb + H + k2 * (sE + 200) + 60), P3(-b / 2 - ue, sE + 200, zb + H + k2 * (sE + 200) + 60)], typ === 'flach' ? plain('#5b5f63', 0.6) : dm));
      else { const sR = (H + rise) / k; for (const s of [-1, 1]) grp.add(quad([P3(s * (b / 2 + ue), -ue, zb + H - ue * Math.tan(G.rad(40))), P3(0, -ue, zb + H + rise), P3(0, sR, zb + H + rise), P3(s * (b / 2 + ue), sE, zb + H - ue * Math.tan(G.rad(40)))], dm)); }
      // Fenster
      if (gb.fenster !== false) { const fw = Math.max(400, b - 500), fh = Math.max(400, H - 450); grp.add(quad([P3(-fw / 2, -15, zb + 250), P3(fw / 2, -15, zb + 250), P3(fw / 2, -15, zb + 250 + fh), P3(-fw / 2, -15, zb + 250 + fh)], glas)); grp.add(quad([P3(-fw / 2 - 60, -10, zb + 190), P3(fw / 2 + 60, -10, zb + 190), P3(fw / 2 + 60, -10, zb + 310 + fh), P3(-fw / 2 - 60, -10, zb + 310 + fh)], rahmen)); }
      grp.traverse(c => { if (c.isMesh) this.pick.push(c); }); this.root.add(grp);
    }
  }
  /** Kamera in einen Raum setzen (Rundumblick von innen) */
  raumInnen(id) {
    const doc = this.app.doc; const r = doc.byId(id); if (!r || !r.poly) return;
    const st = doc.storeyById(r.storey); const c = G.polyCentroid(r.poly); const z = st.elevation + 1550;
    if (this.opt.bis != null) { const si = doc.p.storeys.findIndex(x => x.id === st.id); if (si > this.opt.bis) { this.opt.bis = si; this.build(); } }
    this.active = this.cam; this.cam.fov = 75; this.cam.near = 0.02; this.cam.updateProjectionMatrix();
    this.controls.target.copy(V3(c.x, c.y, z)); this.cam.position.copy(V3(c.x, c.y - 12, z + 1));
    this.controls.minDistance = 0.01; this.controls.update(); this.innenRaum = id;
    if (!this.innenLicht) { this.innenLicht = new THREE.PointLight(0xfff6ea, 1.6, 0, 0); this.scene.add(this.innenLicht); } this.innenLicht.visible = true; this.innenLicht.position.copy(V3(c.x, c.y, st.elevation + Math.min(2400, raumHoehe(doc, r) - 150)));
    this.renderBar();
    this.app.toast('Raum von innen: Maus ziehen = umschauen, Mausrad = vor/zurück, „Perspektive“ = wieder außen');
  }
  roofMesh(doc, rf) {
    const st = doc.storeyById(rf.storey); if (!st) return; const geo = W.storeyGeometry(doc, st.id);
    const pts = geo.outers.flat(); if (!pts.length) return; const bb = G.bbox(pts);
    const ze = st.elevation + st.height + (rf.kniestock || 0);
    const R = buildRoof(rf, bb, ze);
    const mat = matById(rf.material) ? surfMat(rf.material, rf.farbe, 'ziegel') : surfMat('dach-braas-rubin13v', rf.farbe || '#8A3B25', 'ziegel');
    const B = new GeoBuilder(); const tw = mat.userData.texW, th = mat.userData.texH;
    if (R.flat) {
      const s = new THREE.Shape(R.footprint.map(p => new THREE.Vector2(p.x * M, p.y * M))); const hole = new THREE.Path(G.offsetPolys([R.footprint], -250)[0].map(p => new THREE.Vector2(p.x * M, p.y * M))); s.holes.push(hole);
      const at = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 400 * M, bevelEnabled: false }), plain('#5b5f63', 0.6)); at.rotation.x = -Math.PI / 2; at.position.y = ze * M; at.castShadow = true; this.root.add(at);
      const fl = surfMat(rf.material || 'dach-flach-bitumen', rf.farbe, 'flach');
      const top = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(R.footprint.map(p => new THREE.Vector2(p.x * M, p.y * M)))), fl); top.rotation.x = -Math.PI / 2; top.position.y = (ze + 5) * M; this.root.add(top);
      return;
    }
    for (const f of R.faces) {
      const pl = f.plane; const n = pl.n; const t = G.perp(n);
      const { pts, tri } = capTris(f.poly);
      const zOf = (p) => R.zAt(p) || 0;
      const zz = (x, y) => { const pp = { x, y }; return pl.z0 + pl.k * G.dot(G.sub(pp, pl.q), pl.n); };
      for (const [i, j, k] of tri) {
        const P = [pts[i], pts[j], pts[k]].map(v => ({ x: v.x, y: v.y, z: zz(v.x, v.y) }));
        const uvs = P.map(p => { const along = G.dot(p, t); const up = G.dot(p, n) * Math.sqrt(1 + pl.k * pl.k); return [along / tw, up / th]; });
        B.tri(0, V3(P[0].x, P[0].y, P[0].z + 220), V3(P[1].x, P[1].y, P[1].z + 220), V3(P[2].x, P[2].y, P[2].z + 220), ...uvs);
        B.tri(1, V3(P[0].x, P[0].y, P[0].z), V3(P[2].x, P[2].y, P[2].z), V3(P[1].x, P[1].y, P[1].z), [0, 0], [0, 0], [0, 0]);
      }
    }
    // Stirnbretter
    const fp = R.footprint; for (let i = 0; i < fp.length; i++) { const a = fp[i], b = fp[(i + 1) % fp.length]; const nseg = 24; for (let k = 0; k < nseg; k++) { const p = G.lerp(a, b, k / nseg), q = G.lerp(a, b, (k + 1) / nseg); const zp = R.zAt(p), zq = R.zAt(q); B.quad(2, V3(p.x, p.y, zp), V3(q.x, q.y, zq), V3(q.x, q.y, zq + 220), V3(p.x, p.y, zp + 220), [0, 0], [0, 0], [0, 0], [0, 0]); } }
    const mesh = B.build([mat, plain('#c9b79a', 0.9), plain('#3b3f44', 0.7)]); mesh.castShadow = true; mesh.receiveShadow = true; mesh.userData = { kind: 'roof', id: rf.id }; this.pick.push(mesh); this.root.add(mesh);
    try { this.dachAufbauten(doc, rf, R, mat, st); } catch (e) { console.error('Dachaufbauten', e); }
    // Giebel
    const gw = doc.all('wall', st.id).find(w => w.art === 'aussen');
    const gm = surfMat((gw && gw.facade) || 'putz-scheibenputz', gw && gw.facadeColor, 'putz'); const t2 = (gw && gw.thickness) || 365;
    const GB = new GeoBuilder();
    for (const gb of R.gables) {
      const u = G.norm(G.sub(gb.b, gb.a)); const inward = G.perp(u);
      const prof = gb.profile; const L = G.dist(gb.a, gb.b);
      for (let i = 0; i < prof.length - 1; i++) {
        const p = prof[i], q = prof[i + 1]; const zp = Math.max(ze, p.z), zq = Math.max(ze, q.z);
        if (zp - ze < 1 && zq - ze < 1) continue;
        const sp = G.dot(G.sub(p, gb.a), u), sq = G.dot(G.sub(q, gb.a), u);
        GB.quad(0, V3(p.x, p.y, ze), V3(q.x, q.y, ze), V3(q.x, q.y, zq), V3(p.x, p.y, zp), [sp / gm.userData.texW, ze / gm.userData.texH], [sq / gm.userData.texW, ze / gm.userData.texH], [sq / gm.userData.texW, zq / gm.userData.texH], [sp / gm.userData.texW, zp / gm.userData.texH]);
        const pi = G.add(p, G.mul(inward, t2)), qi = G.add(q, G.mul(inward, t2));
        GB.quad(1, V3(pi.x, pi.y, ze), V3(pi.x, pi.y, zp), V3(qi.x, qi.y, zq), V3(qi.x, qi.y, ze), [0, 0], [0, 0], [0, 0], [0, 0]);
      }
    }
    if (R.gables.length) { const gmesh = GB.build([gm, plain('#f4f2ee')]); gmesh.castShadow = true; this.root.add(gmesh); }
  }
  siteMesh(doc, bb) {
    if (!this.opt.gelaende) return;
    const s = doc.p.site; const nn = s.nnEG || 0;
    const fps = footprint(doc);
    const grassSt = surfaceTexture({ muster: 'gras' }, '#5c8a3e'); const grassTex = texFromCanvas(grassSt.canvas, 'gras'); const grass = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 });
    const model = buildTerrain(s.punkte, s.grenze);
    if (model.flat || model.tris.length === 0) {
      const z = model.flat && s.punkte.length ? (model.z0 - nn) * 1000 : -250;
      const size = Math.max(80000, bb ? Math.max(bb.w, bb.h) * 8 : 80000); const c = bb ? { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 } : { x: 0, y: 0 };
      const g = new THREE.PlaneGeometry(size * M, size * M); const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * size / grassSt.w, uv.getY(i) * size / grassSt.h);
      const m = new THREE.Mesh(g, grass); m.rotation.x = -Math.PI / 2; m.position.copy(V3(c.x, c.y, z)); m.receiveShadow = true; this.root.add(m);
    } else {
      const pos = [], uv = [];
      const fpsCCW = fps.map(f => G.ensureCCW(f)); const fpBB = fps.map(f => G.bbox(f));
      // Dreieck mit Normale nach oben anlegen (Plan gegen den Uhrzeigersinn → three: [a, c, b])
      const triAuf = (a, b, c) => { const ccw = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x) > 0; for (const p of ccw ? [a, b, c] : [a, c, b]) { const v = V3(p.x, p.y, (p.z - nn) * 1000 - 30); pos.push(v.x, v.y, v.z); uv.push(p.x / grassSt.w, p.y / grassSt.h); } };
      for (const [a, b, c] of model.tris) {
        const P = [model.pts[a], model.pts[b], model.pts[c]];
        const cen = { x: (P[0].x + P[1].x + P[2].x) / 3, y: (P[0].y + P[1].y + P[2].y) / 3 };
        const tb = G.bbox(P); const beruehrt = fpBB.some(b => b.x0 < tb.x1 && b.x1 > tb.x0 && b.y0 < tb.y1 && b.y1 > tb.y0);
        if (!beruehrt) { triAuf(P[0], P[1], P[2]); continue; }
        // Dreieck exakt um den Gebäudegrundriss beschneiden (kein Gelände im Haus)
        const zEb = (q) => { const d = (P[1].y - P[2].y) * (P[0].x - P[2].x) + (P[2].x - P[1].x) * (P[0].y - P[2].y); if (Math.abs(d) < 1e-9) return P[0].z; const l1 = ((P[1].y - P[2].y) * (q.x - P[2].x) + (P[2].x - P[1].x) * (q.y - P[2].y)) / d, l2 = ((P[2].y - P[0].y) * (q.x - P[2].x) + (P[0].x - P[2].x) * (q.y - P[2].y)) / d; return l1 * P[0].z + l2 * P[1].z + (1 - l1 - l2) * P[2].z; };
        for (const it of G.differenceTree([G.ensureCCW(P.map(p => ({ x: p.x, y: p.y })))], fpsCCW)) {
          const sh = G.ensureCCW(it.outer).map(q => new THREE.Vector2(q.x, q.y)); const ho = it.holes.map(hh => G.ensureCW(hh).map(q => new THREE.Vector2(q.x, q.y))); const all = sh.concat(...ho);
          for (const tri of THREE.ShapeUtils.triangulateShape(sh, ho)) { const [a2, b2, c2] = tri.map(k => ({ x: all[k].x, y: all[k].y, z: zEb(all[k]) })); triAuf(a2, b2, c2); }
        }
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.computeVertexNormals();
      const m = new THREE.Mesh(g, grass); m.receiveShadow = true; this.root.add(m);
      if (this.opt.hoehenlinien) { const lines = contours(model, s.hlAbstand || 0.25); const lp = []; for (const l of lines) for (const [a, b] of l.segs) { const va = V3(a.x, a.y, (l.z - nn) * 1000 + 15), vb = V3(b.x, b.y, (l.z - nn) * 1000 + 15); lp.push(va.x, va.y, va.z, vb.x, vb.y, vb.z); } const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); this.root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#6b4f2a', transparent: true, opacity: 0.55 }))); }
      // umgebende Fläche
      const ext = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), plain('#7d9a5e', 1)); ext.rotation.x = -Math.PI / 2; ext.receiveShadow = true; const zmin = Math.min(...model.pts.map(p => p.z)); ext.position.copy(V3((model.bbox.x0 + model.bbox.x1) / 2, (model.bbox.y0 + model.bbox.y1) / 2, (zmin - nn) * 1000 - 200)); this.root.add(ext);
    }
    if (s.grenze && s.grenze.length > 2) { const lp = []; const zf = (p) => (model.at ? model.at(p.x, p.y) - nn : 0) * 1000 + 40; for (let i = 0; i < s.grenze.length; i++) { const a = s.grenze[i], b = s.grenze[(i + 1) % s.grenze.length]; for (let k = 0; k < 20; k++) { const p = G.lerp(a, b, k / 20), q = G.lerp(a, b, (k + 1) / 20); const va = V3(p.x, p.y, zf(p)), vb = V3(q.x, q.y, zf(q)); lp.push(va.x, va.y, va.z, vb.x, vb.y, vb.z); } } const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lp, 3)); this.root.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: '#b91c1c' }))); }
    if (this.opt.nachbarn) for (const nb of s.nachbarn) {
      const c = G.polyCentroid(nb.poly); const zb = ((model.at ? model.at(c.x, c.y) : nn) - nn) * 1000; const Hh = nb.hoehe || 8000;
      const bbn = G.bbox(nb.poly); const traufe = nb.dach === 'flach' ? Hh : Hh * 0.62;
      const shape = new THREE.Shape(G.ensureCCW(nb.poly).map(p => new THREE.Vector2(p.x * M, p.y * M)));
      const body = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: traufe * M, bevelEnabled: false }), plain('#d6d3cc', 0.9)); body.rotation.x = -Math.PI / 2; body.position.y = zb * M; body.castShadow = true; body.receiveShadow = true; this.root.add(body);
      if (nb.dach !== 'flach') { const R = buildRoof({ typ: nb.dach === 'walm' ? 'walm' : 'sattel', neigung: Math.atan((Hh - traufe) / (Math.min(bbn.w, bbn.h) / 2)) * 180 / Math.PI, ueberstand: 300 }, bbn, zb + traufe); const B = new GeoBuilder(); for (const f of R.faces) { const { pts, tri } = capTris(f.poly); const pl = f.plane; const zz = (p) => pl.z0 + pl.k * G.dot(G.sub(p, pl.q), pl.n); for (const [i, j, k] of tri) B.tri(0, V3(pts[i].x, pts[i].y, zz(pts[i])), V3(pts[j].x, pts[j].y, zz(pts[j])), V3(pts[k].x, pts[k].y, zz(pts[k])), [0, 0], [0, 0], [0, 0]); } for (const gb of R.gables) for (let i = 0; i < gb.profile.length - 1; i++) { const p = gb.profile[i], q = gb.profile[i + 1]; B.quad(1, V3(p.x, p.y, zb + traufe), V3(q.x, q.y, zb + traufe), V3(q.x, q.y, Math.max(zb + traufe, q.z)), V3(p.x, p.y, Math.max(zb + traufe, p.z)), [0, 0], [0, 0], [0, 0], [0, 0]); } const rm = B.build([plain('#7a4a3a', 0.8), plain('#d6d3cc', 0.9)]); rm.castShadow = true; this.root.add(rm); }
    }
  }
  /* ───── Kamera ───── */
  setOrtho() { const R = this.bb ? Math.max(this.bb.w, this.bb.h) * M * 0.75 : 10; const a = this.aspect || 1.5; this.ortho.left = -R * a; this.ortho.right = R * a; this.ortho.top = R; this.ortho.bottom = -R; this.ortho.updateProjectionMatrix(); }
  view(v) {
    const bb = this.bb; const c = { x: (bb.x0 + bb.x1) / 2, y: (bb.y0 + bb.y1) / 2 }; const ctr = V3(c.x, c.y, 4000);
    if (v === 'persp') { this.active = this.cam; if (this.innenRaum) { this.innenRaum = null; if (this.innenLicht) this.innenLicht.visible = false; this.cam.fov = 40; this.cam.near = 0.1; this.cam.updateProjectionMatrix(); this.controls.minDistance = 0; this.build(true); } this.renderBar(); return; }
    this.setOrtho(); const D = 100;
    const dirs = { S: [0, -1, 0], N: [0, 1, 0], O: [1, 0, 0], W: [-1, 0, 0], top: [0, 0, 1] };
    const [dx, dy, dz] = dirs[v]; const p = V3(c.x + dx * D / M, c.y + dy * D / M, 4000 + dz * D / M);
    this.ortho.position.copy(p); this.ortho.up.set(v === 'top' ? 0 : 0, v === 'top' ? 0 : 1, v === 'top' ? -1 : 0); this.ortho.lookAt(ctr); this.active = this.ortho; this.renderBar();
  }
  savePng() {
    this.renderer.render(this.scene, this.active);
    this.renderer.domElement.toBlob(b => this.app.downloadBlob(b, (this.app.doc.p.name || 'Ansicht') + ' – 3D.png'));
  }
  snapshot(w = 1600, hh = 1000, viewName = null) {
    const old = this.active; if (viewName) this.view(viewName);
    const size = new THREE.Vector2(); this.renderer.getSize(size);
    this.renderer.setSize(w, hh, false); const cam = this.active; if (cam.isPerspectiveCamera) { cam.aspect = w / hh; cam.updateProjectionMatrix(); } else { const R = this.ortho.top; this.ortho.left = -R * w / hh; this.ortho.right = R * w / hh; this.ortho.updateProjectionMatrix(); }
    this.renderer.render(this.scene, cam); const url = this.renderer.domElement.toDataURL('image/png');
    this.renderer.setSize(size.x, size.y, false); this.active = old; this.resize(); return url;
  }
  /* ───── Auswahl im 3D ───── */
  bindPick() {
    const cv = this.renderer.domElement; let down = null;
    cv.addEventListener('pointerdown', e => down = { x: e.clientX, y: e.clientY });
    cv.addEventListener('pointerup', e => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 4) return; const r = cv.getBoundingClientRect();
      const m = new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
      this.ray.setFromCamera(m, this.active); const hit = this.ray.intersectObjects(this.pick, true)[0];
      this.sel = null; if (hit) { let o = hit.object; while (o && !o.userData.kind) o = o.parent; if (o) this.sel = o.userData; }
      this.app.renderSide();
    });
  }
  renderSide(body) {
    const doc = this.app.doc; const app = this.app;
    const row = (l, el) => h('div', { class: 'row' }, h('label', {}, l), el);
    const facG = ['Putz', 'Klinker', 'Holz', 'Metall', 'Faserzement', 'HPL', 'Naturstein', 'Keramik', 'Glas'];
    const mbtn = (id, col, gruppen, onPick, label = 'Wählen …') => { const m = matById(id); const b = h('button', { class: 'btn sm', style: 'width:100%;justify-content:flex-start' }, h('span', { class: 'sw', style: `background:${col || (m && m.farben[0].hex) || '#ccc'}` }), m ? `${m.hersteller === 'herstellerneutral' ? '' : m.hersteller + ' '}${m.produkt}` : label); b.onclick = () => pickMaterial(app, { gruppen, current: id, color: col, onPick: (i, c) => { onPick(i, c); this.build(); app.renderSide(); } }); return b; };
    const sel = this.sel;
    if (sel) {
      const e = sel.kind === 'roof' ? doc.p.roofs.find(r => r.id === sel.id) : doc.byId(sel.id);
      if (e && sel.kind === 'wall') body.append(h('div', { class: 'sec' }, h('h4', {}, 'Gewählte Wand'), row('Fassade', mbtn(e.facade, e.facadeColor, facG, (i, c) => doc.change('Fassade', () => { e.facade = i; e.facadeColor = c; }))), row('Sockel', mbtn(e.sockel, e.sockelColor, facG, (i, c) => doc.change('Sockel', () => { e.sockel = i; e.sockelColor = c; if (!e.sockelH) e.sockelH = 400; }))), h('button', { class: 'btn sm', onclick: () => { doc.change('Fassade alle', () => { for (const w of doc.all('wall').filter(w => w.art === 'aussen')) { w.facade = e.facade; w.facadeColor = e.facadeColor; } }); this.build(); } }, 'Auf alle Außenwände übertragen')));
      else if (e && sel.kind === 'opening') { normalisiere(e); body.append(h('div', { class: 'sec' }, h('h4', {}, e.kind === 'window' ? 'Gewähltes Fenster' : 'Gewählte Tür'),
        e.kind === 'window' ? row('Fenstertyp', (() => { const s2 = h('select', {}); for (const [v, l] of K.FENSTER_TYPEN) s2.append(h('option', { value: v, selected: (e.typ || 'dk1') === v }, l)); s2.onchange = () => doc.change('Fenstertyp', () => { e.typ = s2.value; }); return s2; })()) : e.kind === 'door' ? row('Türart', (() => { const s2 = h('select', {}); for (const [v, l] of K.TUER_ARTEN) s2.append(h('option', { value: v, selected: (e.art || 'dreh1') === v }, l)); s2.onchange = () => doc.change('Türart', () => { e.art = s2.value; }); return s2; })()) : null,
        eigenschaften(app, e),
        row(e.kind === 'window' ? 'Hersteller-Modell' : 'Modell', mbtn(e.stil, e.stilColor, e.kind === 'window' ? ['Fenster'] : ['Haustür'], (i, c) => doc.change('Ausführung', () => { e.stil = i; e.stilColor = c; if (e.kind === 'window' && c) e.farbeA = c; if (e.kind === 'door' && c) e.farbe = c; }))),
        h('button', { class: 'btn sm', onclick: () => { const keys = ['typ', 'stil', 'stilColor', 'farbeA', 'farbeI', 'sprossen', 'sprossenBild', 'material', 'glas', 'sonnenschutz', 'fbA', 'fbI', 'aufteilung', 'oberlichtH', 'farbe', 'zarge', 'blatt']; doc.change('Alle übernehmen', () => { for (const o of doc.all('opening').filter(o => o.kind === e.kind && o.id !== e.id && (e.kind !== 'door' || !!o.aussen === !!e.aussen))) for (const k of keys) if (e[k] !== undefined && (k !== 'typ' || e.kind === 'window')) o[k] = e[k]; }); this.build(); } }, e.kind === 'window' ? 'Auf alle Fenster übertragen' : 'Auf alle gleichartigen Türen übertragen'))); }
      else if (e && sel.kind === 'roof') body.append(h('div', { class: 'sec' }, h('h4', {}, 'Dach'), row('Eindeckung', mbtn(e.material, e.farbe, ['Dach'], (i, c) => doc.change('Eindeckung', () => { e.material = i; e.farbe = c; }))), h('div', { class: 'muted' }, 'Form, Neigung, Überstand: unter „Grundriss → Geschosse“.')));
      else if (e && sel.kind === 'symbol') { const sd = SYMBOLE[e.kind] || {}; body.append(h('div', { class: 'sec' }, h('h4', {}, sd.name || 'Objekt'),
        sd.g ? row('Größe', (() => { const s2 = h('select', {}); s2.append(h('option', { value: '' }, `${G.fmtCm(e.w)} × ${G.fmtCm(e.d)} cm`)); for (const [w, d2, l] of sd.g) s2.append(h('option', { value: w + 'x' + d2 }, `${l} (${w / 10} × ${d2 / 10} cm)`)); s2.onchange = () => { if (!s2.value) return; const [w, d2] = s2.value.split('x').map(Number); doc.change('Größe', () => { e.w = w; e.d = d2; }); }; return s2; })()) : '',
        row('Drehen', h('div', { class: 'btns' }, h('button', { class: 'btn sm', onclick: () => doc.change('Drehen', () => { e.rot = ((e.rot || 0) + 90) % 360; }) }, '↻ 90°'), h('button', { class: 'btn sm red', onclick: () => { doc.change('Löschen', () => doc.remove([e.id])); this.sel = null; } }, 'Löschen'))),
        h('div', { class: 'muted' }, 'Position und weitere Angaben im Grundriss (Objekt anklicken).'))); }
      else if (e && sel.kind === 'room') body.append(h('div', { class: 'sec' }, h('h4', {}, `Raum ${e.nr || ''} ${e.name}`), h('button', { class: 'btn sm pri', onclick: () => app.openTiles(e.id) }, 'Fliesenplan öffnen')));
    } else body.append(h('div', { class: 'note' }, 'Tipp: Wand, Fenster, Tür oder Dach im 3D anklicken – dann hier Material und Farbe wählen.'), h('div', { class: 'note', 'data-stufe': 'einstieg' }, 'Raum von innen: oben „👁 Raum von innen …“ aufklappen und den Raum wählen – dann siehst du die Fliesen an Boden und Wänden. Maus ziehen = umschauen, Mausrad = vor/zurück, „Perspektive“ = wieder außen.'));
    const any = doc.all('wall').find(w => w.art === 'aussen');
    body.append(profi(h('div', { class: 'sec' }, h('h4', {}, 'Ganzes Haus'),
      row('Fassade', mbtn(any && any.facade, any && any.facadeColor, facG, (i, c) => doc.change('Fassade alle', () => { for (const w of doc.all('wall').filter(w => w.art === 'aussen')) { w.facade = i; w.facadeColor = c; } }))),
      row('Sockel', mbtn(any && any.sockel, any && any.sockelColor, facG, (i, c) => doc.change('Sockel alle', () => { for (const w of doc.all('wall').filter(w => w.art === 'aussen')) { w.sockel = i; w.sockelColor = c; if (!w.sockelH) w.sockelH = 400; } }))),
      row('Sockelhöhe (mm)', (() => { const i = h('input', { type: 'number', value: (any && any.sockelH) || 0 }); i.onchange = () => { doc.change('Sockelhöhe', () => { for (const w of doc.all('wall').filter(w => w.art === 'aussen')) w.sockelH = +i.value; }); this.build(); }; return i; })()),
      row('Fenster', mbtn((doc.all('opening').find(o => o.kind === 'window') || {}).stil, (doc.all('opening').find(o => o.kind === 'window') || {}).stilColor, ['Fenster'], (i, c) => doc.change('Fenster alle', () => { for (const o of doc.all('opening').filter(o => o.kind === 'window')) { o.stil = i; o.stilColor = c; } }))),
      doc.p.roofs[0] ? row('Dach', mbtn(doc.p.roofs[0].material, doc.p.roofs[0].farbe, ['Dach'], (i, c) => doc.change('Eindeckung', () => { doc.p.roofs[0].material = i; doc.p.roofs[0].farbe = c; }))) : h('button', { class: 'btn sm', onclick: () => { doc.change('Dach', () => doc.p.roofs.push({ id: 'r' + Date.now(), storey: doc.p.storeys[doc.p.storeys.length - 1].id, typ: 'sattel', neigung: 35, ueberstand: 500, kniestock: 0, richtung: 'auto', material: 'dach-braas-rubin13v', farbe: null })); this.build(); app.renderSide(); } }, '+ Dach hinzufügen'))));
    const bis = h('select', {}); bis.append(h('option', { value: '' }, 'alle Geschosse')); doc.p.storeys.forEach((s, i) => bis.append(h('option', { value: i, selected: this.opt.bis === i }, 'bis ' + s.name))); bis.onchange = () => { this.opt.bis = bis.value === '' ? null : +bis.value; this.build(); };
    const n0 = body.children.length; X.sonnenPanel(this, body); X.schnittPanel(this, body); X.kameraPanel(this, body);
    body.append(h('div', { class: 'sec' }, h('h4', {}, 'Darstellung'), row('Geschosse', bis),
      h('div', { class: 'btns' }, h('button', { class: 'chip' + (this.opt.nachbarn ? ' on' : ''), onclick: () => { this.opt.nachbarn = !this.opt.nachbarn; this.build(); app.renderSide(); } }, 'Nachbargebäude'), h('button', { class: 'chip' + (this.opt.hoehenlinien ? ' on' : ''), onclick: () => { this.opt.hoehenlinien = !this.opt.hoehenlinien; this.build(); app.renderSide(); } }, 'Höhenlinien'))));
    X.exportPanel(this, body); profiAb(body, n0);
    body.append(h('div', { class: 'muted' }, 'Farben und Oberflächen sind Annäherungen an die Herstellerprodukte – für die endgültige Auswahl immer Originalmuster ansehen.'));
  }
}

function doorTexture(stil, col, w, hh) {
  const c = document.createElement('canvas'); c.width = 256; c.height = Math.round(256 * hh / w); const x = c.getContext('2d');
  x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  const g = x.createLinearGradient(0, 0, c.width, 0); g.addColorStop(0, 'rgba(255,255,255,.08)'); g.addColorStop(1, 'rgba(0,0,0,.08)'); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  x.fillStyle = 'rgba(210,225,235,.85)';
  if (stil.design === 'glasstreifen_seitlich') { for (let i = 0; i < 7; i++) x.fillRect(c.width * 0.18, c.height * (0.12 + i * 0.1), c.width * 0.08, c.height * 0.07); x.fillRect(c.width * 0.18, c.height * 0.1, c.width * 0.02, c.height * 0.72); }
  else if (stil.design === 'lisenen') { x.fillStyle = 'rgba(200,205,210,.9)'; for (let i = 0; i < 5; i++) x.fillRect(c.width * 0.12, c.height * (0.2 + i * 0.13), c.width * 0.62, c.height * 0.012); }
  else if (stil.design === 'seitenteil' || stil.design === 'oberlicht') { x.fillRect(c.width * 0.15, c.height * 0.15, c.width * 0.7, c.height * 0.25); }
  x.fillStyle = '#c9cdd1'; x.fillRect(c.width * 0.82, c.height * 0.3, c.width * 0.035, c.height * 0.38);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

function shadeHex(hex, amt) { const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl); c.setHSL(hsl.h, hsl.s, Math.max(0, Math.min(1, hsl.l + (hsl.l > 0.5 ? -amt : amt)))); return '#' + c.getHexString(); }
function ladenTexture(col) {
  const key = 'laden|' + col; if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = 64; c.height = 256; const x = c.getContext('2d');
  x.fillStyle = col; x.fillRect(0, 0, 64, 256); x.strokeStyle = shadeHex(col, 0.18); x.lineWidth = 3;
  x.strokeRect(3, 3, 58, 250); for (let y = 14; y < 250; y += 10) { x.beginPath(); x.moveTo(8, y); x.lineTo(56, y + 3); x.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); return t;
}
function torTexture(col, w, hh) {
  const key = 'tor|' + col; if (texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const x = c.getContext('2d');
  x.fillStyle = col; x.fillRect(0, 0, 256, 128); x.strokeStyle = shadeHex(col, 0.2); x.lineWidth = 2;
  for (let y = 0; y < 128; y += 32) { x.beginPath(); x.moveTo(0, y); x.lineTo(256, y); x.stroke(); }
  for (let y = 0; y < 128; y += 32) for (let yy = 8; yy < 32; yy += 8) { x.globalAlpha = 0.25; x.beginPath(); x.moveTo(0, y + yy); x.lineTo(256, y + yy); x.stroke(); x.globalAlpha = 1; }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(key, t); return t;
}
