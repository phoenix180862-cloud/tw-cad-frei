// TW-CAD – IFC4-Export (Reference View): Geschosse, Wände mit Schichten, Öffnungen, Türen, Fenster, Decken, Räume, Stützen, Unterzüge, Körper, Dach
import * as G from './geom.js?v=20261028-0429';
import * as W from './walls.js?v=20261028-0429';
import * as AB from './aufbau.js?v=20261028-0429';
import { columnPoly } from './render2d.js?v=20261028-0429';
import { buildRoof } from './roof.js?v=20261028-0429';
import { FREI } from './frei.js?v=20261028-0429';
import { FIRMA } from './firma.js?v=20261028-0429';

const B64 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
export function ifcGuid() {
  const b = (globalThis.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(16)) : Uint8Array.from({ length: 16 }, () => Math.random() * 256 | 0);
  let n = 0n; for (const x of b) n = (n << 8n) | BigInt(x); let s = ''; for (let i = 0; i < 22; i++) { s = B64[Number(n % 64n)] + s; n /= 64n; } return s;
}
/** STEP-String mit Umlauten (\X2\…\X0\) */
export function str(s) {
  if (s == null || s === '') return '$';
  let o = ''; for (const ch of String(s)) { const c = ch.codePointAt(0); if (ch === "'") o += "''"; else if (ch === '\\') o += '\\\\'; else if (c > 126 || c < 32) o += '\\X2\\' + c.toString(16).toUpperCase().padStart(4, '0') + '\\X0\\'; else o += ch; }
  return `'${o}'`;
}
const R = (v) => { const r = Math.round(v * 1000) / 1000; const s = String(r); return /[.eE]/.test(s) ? s : s + '.'; };

class StepWriter {
  constructor() { this.lines = []; this.n = 0; }
  add(txt) { this.n++; this.lines.push(`#${this.n}=${txt};`); return `#${this.n}`; }
}

export function exportIFC(doc, opt = {}) {
  const w = new StepWriter(); const A = (t) => w.add(t);
  const now = new Date(); const ts = Math.floor(now.getTime() / 1000);
  const name = doc.p.name || 'Projekt'; const meta = doc.p.meta || {};
  // Kopf / Kontext
  // öffentliche Fassung: Ersteller = Planverfasser aus dem Projekt; Programm-Hersteller aus firma.js (öffentliches Paket: „TW-CAD“)
  const twOrg = `IFCORGANIZATION($,${str(FIRMA.name || 'TW-CAD')},$,$,$)`;
  const person = FREI ? A(`IFCPERSON($,${str(meta.planer || 'Planverfasser')},$,$,$,$,$,$)`) : A(`IFCPERSON($,${str(FIRMA.nachname)},${str(FIRMA.vorname)},$,$,$,$,$)`);
  const org = FREI ? A(`IFCORGANIZATION($,${str(meta.planer || 'Planverfasser')},$,$,$)`) : A(twOrg);
  const po = A(`IFCPERSONANDORGANIZATION(${person},${org},$)`);
  const app = A(`IFCAPPLICATION(${FREI ? A(twOrg) : org},'1.0','TW-CAD','TW-CAD')`);
  const oh = A(`IFCOWNERHISTORY(${po},${app},$,.ADDED.,$,$,$,${ts})`);
  const P0 = A(`IFCCARTESIANPOINT((0.,0.,0.))`); const DZ = A(`IFCDIRECTION((0.,0.,1.))`); const DX = A(`IFCDIRECTION((1.,0.,0.))`);
  const AX0 = A(`IFCAXIS2PLACEMENT3D(${P0},${DZ},${DX})`);
  const ctx = A(`IFCGEOMETRICREPRESENTATIONCONTEXT($,'Model',3,1.E-05,${AX0},$)`);
  const body = A(`IFCGEOMETRICREPRESENTATIONSUBCONTEXT('Body','Model',*,*,*,*,${ctx},$,.MODEL_VIEW.,$)`);
  const uL = A(`IFCSIUNIT(*,.LENGTHUNIT.,.MILLI.,.METRE.)`), uA = A(`IFCSIUNIT(*,.AREAUNIT.,$,.SQUARE_METRE.)`), uV = A(`IFCSIUNIT(*,.VOLUMEUNIT.,$,.CUBIC_METRE.)`), uW = A(`IFCSIUNIT(*,.PLANEANGLEUNIT.,$,.RADIAN.)`);
  const units = A(`IFCUNITASSIGNMENT((${uL},${uA},${uV},${uW}))`);
  const project = A(`IFCPROJECT('${ifcGuid()}',${oh},${str(name)},${str(meta.bauvorhaben || null)},$,$,$,(${ctx}),${units})`);
  // Standort
  const dms = (v) => { const s = v < 0 ? -1 : 1; v = Math.abs(v); const d = Math.floor(v), m = Math.floor((v - d) * 60), sec = Math.floor(((v - d) * 60 - m) * 60); return `(${s * d},${s * m},${s * sec})`; };
  const lat = (doc.p.site && doc.p.site.lat) ?? 50.666, lon = (doc.p.site && doc.p.site.lon) ?? 7.988;
  const sitePl = A(`IFCLOCALPLACEMENT($,${AX0})`);
  const site = A(`IFCSITE('${ifcGuid()}',${oh},${str(meta.ort || 'Grundstück')},$,$,${sitePl},$,$,.ELEMENT.,${dms(lat)},${dms(lon)},${R((doc.p.site && doc.p.site.nnEG) || 0)},$,$)`);
  const bldPl = A(`IFCLOCALPLACEMENT(${sitePl},${AX0})`);
  const bld = A(`IFCBUILDING('${ifcGuid()}',${oh},${str(meta.bauvorhaben || name)},$,$,${bldPl},$,$,.ELEMENT.,$,$,$)`);
  A(`IFCRELAGGREGATES('${ifcGuid()}',${oh},$,$,${project},(${site}))`);
  A(`IFCRELAGGREGATES('${ifcGuid()}',${oh},$,$,${site},(${bld}))`);

  // Geometrie-Helfer
  const pt2 = (p) => A(`IFCCARTESIANPOINT((${R(p.x)},${R(p.y)}))`);
  const profil = (poly) => { const q = G.ensureCCW(G.cleanPoly(poly)); const ids = q.map(pt2); ids.push(ids[0]); return A(`IFCARBITRARYCLOSEDPROFILEDEF(.AREA.,$,${A(`IFCPOLYLINE((${ids.join(',')}))`)})`); };
  const extr = (poly, z0, hoehe) => { const pos = z0 ? A(`IFCAXIS2PLACEMENT3D(${A(`IFCCARTESIANPOINT((0.,0.,${R(z0)}))`)},$,$)`) : A(`IFCAXIS2PLACEMENT3D(${P0},$,$)`); return A(`IFCEXTRUDEDAREASOLID(${profil(poly)},${pos},${DZ},${R(Math.max(1, hoehe))})`); };
  const shape = (solids, typ = 'SweptSolid') => A(`IFCPRODUCTDEFINITIONSHAPE($,$,(${A(`IFCSHAPEREPRESENTATION(${body},'Body','${typ}',(${solids.join(',')}))`)}))`);
  const pset = (objs, nameP, props) => { const ps = props.filter(([, v]) => v != null).map(([k, v]) => A(`IFCPROPERTYSINGLEVALUE(${str(k)},$,${v},$)`)); if (!ps.length) return; const s = A(`IFCPROPERTYSET('${ifcGuid()}',${oh},${str(nameP)},$,(${ps.join(',')}))`); A(`IFCRELDEFINESBYPROPERTIES('${ifcGuid()}',${oh},$,$,(${objs.join(',')}),${s})`); };
  const bool = (b) => `IFCBOOLEAN(${b ? '.T.' : '.F.'})`; const lbl = (s) => `IFCLABEL(${str(s)})`; const len = (v) => `IFCLENGTHMEASURE(${R(v)})`;
  const matCache = new Map(); const material = (nm) => { if (!matCache.has(nm)) matCache.set(nm, A(`IFCMATERIAL(${str(nm)},$,$)`)); return matCache.get(nm); };
  const matAssoc = new Map(); const assoc = (matId, obj) => { if (!matAssoc.has(matId)) matAssoc.set(matId, []); matAssoc.get(matId).push(obj); };
  const MATN = { mauerwerk: 'Mauerwerk', ziegel: 'Hochlochziegel', ks: 'Kalksandstein', poren: 'Porenbeton', beton: 'Stahlbeton', leicht: 'Leichtbeton', trockenbau: 'Gipskarton-Ständerwand', holz: 'Holzständer', glasbaustein: 'Glasbaustein', stahl: 'Stahl' };
  const stats = { waende: 0, oeffnungen: 0, tueren: 0, fenster: 0, decken: 0, raeume: 0, sonst: 0 };
  const storeyIds = [];
  for (const st of doc.p.storeys) {
    const stPl = A(`IFCLOCALPLACEMENT(${bldPl},${A(`IFCAXIS2PLACEMENT3D(${A(`IFCCARTESIANPOINT((0.,0.,${R(st.elevation || 0)}))`)},$,$)`)})`);
    const sto = A(`IFCBUILDINGSTOREY('${ifcGuid()}',${oh},${str(st.name)},$,$,${stPl},$,$,.ELEMENT.,${R(st.elevation || 0)})`); storeyIds.push(sto);
    const elPl = () => A(`IFCLOCALPLACEMENT(${stPl},${AX0})`);
    const inhalt = []; const raeume = [];
    const geo = W.storeyGeometry(doc, st.id);
    const wallIfc = new Map();
    for (const [id, g] of geo.wg) {
      const e = g.w; const H = e.height || st.height;
      const wl = A(`IFCWALL('${ifcGuid()}',${oh},${str(e.art === 'aussen' ? 'Außenwand' : 'Innenwand')},$,${str(AB.aufbauById(e.aufbau)?.name || MATN[e.material] || null)},${elPl()},${shape([extr(g.poly, 0, H)])},${str(id)},${e.art === 'aussen' ? '.SOLIDWALL.' : '.PARTITIONING.'})`);
      wallIfc.set(id, wl); inhalt.push(wl); stats.waende++;
      pset([wl], 'Pset_WallCommon', [['IsExternal', bool(e.art === 'aussen')], ['LoadBearing', bool(e.art === 'aussen' || e.thickness >= 175)], ['Reference', lbl(AB.aufbauById(e.aufbau)?.name || `${e.thickness} mm`)]]);
      const sch = AB.schichten(e);
      if (sch) { const key = 'LS|' + JSON.stringify(sch); if (!matCache.has(key)) { const ls = sch.map(([m, d]) => A(`IFCMATERIALLAYER(${material((AB.SCHICHT_MAT[m] || {}).name || m)},${R(d)},$,${str((AB.SCHICHT_MAT[m] || {}).name || m)},$,$,$)`)); matCache.set(key, A(`IFCMATERIALLAYERSET((${ls.join(',')}),${str(AB.aufbauById(e.aufbau)?.name || 'Wandaufbau')},$)`)); } assoc(matCache.get(key), wl); }
      else assoc(material(MATN[e.material] || 'Mauerwerk'), wl);
    }
    for (const op of geo.openings) {
      const o = op.o; const wl = wallIfc.get(op.g.w.id); if (!wl) continue; const sill = o.sill || 0;
      const rect = op.rect; const opn = A(`IFCOPENINGELEMENT('${ifcGuid()}',${oh},'Öffnung',$,$,${elPl()},${shape([extr(rect, sill, o.height)])},$,.OPENING.)`);
      A(`IFCRELVOIDSELEMENT('${ifcGuid()}',${oh},$,$,${wl},${opn})`); stats.oeffnungen++;
      if (o.kind === 'opening') continue;
      const t = Math.min(80, op.g.w.thickness * 0.4); const c0 = op.c0, c1 = op.c1, n = op.g.n;
      const blatt = [G.sub(c0, G.mul(n, t / 2)), G.sub(c1, G.mul(n, t / 2)), G.add(c1, G.mul(n, t / 2)), G.add(c0, G.mul(n, t / 2))];
      let fill;
      if (o.kind === 'window') { fill = A(`IFCWINDOW('${ifcGuid()}',${oh},${str('Fenster ' + (o.typ || ''))},$,$,${elPl()},${shape([extr(blatt, sill, o.height)])},$,${R(o.height)},${R(o.width)},.WINDOW.,$,$)`); stats.fenster++; pset([fill], 'Pset_WindowCommon', [['IsExternal', bool(op.g.w.art === 'aussen')], ['Reference', lbl(`${o.width} x ${o.height}`)]]); }
      else { const ot = (o.art || '').startsWith('dreh2') ? '.DOUBLE_DOOR_SINGLE_SWING.' : (o.art || '').startsWith('schiebe') ? '.SLIDING_TO_LEFT.' : (o.hinge === 'rechts' ? '.SINGLE_SWING_RIGHT.' : '.SINGLE_SWING_LEFT.');
        fill = A(`IFCDOOR('${ifcGuid()}',${oh},${str('Tür ' + (o.art || ''))},$,$,${elPl()},${shape([extr(blatt, sill, o.height)])},$,${R(o.height)},${R(o.width)},${(o.art || '').startsWith('garagentor') ? '.GATE.' : '.DOOR.'},${ot},$)`); stats.tueren++;
        pset([fill], 'Pset_DoorCommon', [['IsExternal', bool(op.g.w.art === 'aussen')], ['FireRating', o.brandschutz ? lbl(o.brandschutz) : null], ['Reference', lbl(`${o.width} x ${o.height}`)]]); }
      A(`IFCRELFILLSELEMENT('${ifcGuid()}',${oh},$,$,${opn},${fill})`); inhalt.push(fill);
    }
    // Boden-/Deckenplatte des Geschosses
    const si = doc.p.storeys.indexOf(st); const unter = si > 0 ? doc.p.storeys[si - 1] : null;
    const loecher = (unter ? doc.all('durchbruch', unter.id).filter(d => d.in === 'decke') : []).concat(doc.all('durchbruch', st.id).filter(d => d.in !== 'decke')).map(d => G.ensureCCW(d.pts));
    for (const it of geo.body) {
      const teile = loecher.length ? G.differencePolys([G.ensureCCW(it.outer)], loecher) : [it.outer];
      for (const tl of teile) { if (G.polyArea(tl) < 1e4) continue; const sl = A(`IFCSLAB('${ifcGuid()}',${oh},${str(si === 0 ? 'Bodenplatte' : 'Decke über ' + unter.name)},$,$,${elPl()},${shape([extr(tl, -(st.slab || 200), st.slab || 200)])},$,${si === 0 ? '.BASESLAB.' : '.FLOOR.'})`); inhalt.push(sl); assoc(material('Stahlbeton'), sl); stats.decken++; }
    }
    // Räume
    for (const r of doc.all('room', st.id)) {
      if (!r.poly || r.poly.length < 3) continue; const hh = r.height || st.roomHeight || st.height - 250;
      const sp = A(`IFCSPACE('${ifcGuid()}',${oh},${str(r.nr || r.name || 'Raum')},$,$,${elPl()},${shape([extr(r.poly, 0, hh)])},${str(r.name || null)},.ELEMENT.,.INTERNAL.,$)`); raeume.push(sp); stats.raeume++;
      const q = [A(`IFCQUANTITYAREA('NetFloorArea',$,$,${R(G.polyArea(r.poly) / 1e6)},$)`), A(`IFCQUANTITYLENGTH('NetPerimeter',$,$,${R(G.polyPerimeter(r.poly))},$)`), A(`IFCQUANTITYLENGTH('Height',$,$,${R(hh)},$)`)];
      A(`IFCRELDEFINESBYPROPERTIES('${ifcGuid()}',${oh},$,$,(${sp}),${A(`IFCELEMENTQUANTITY('${ifcGuid()}',${oh},'Qto_SpaceBaseQuantities',$,$,(${q.join(',')}))`)})`);
    }
    // Stützen, Unterzüge, Körper
    for (const c of doc.all('column', st.id)) { const cl = A(`IFCCOLUMN('${ifcGuid()}',${oh},'Stütze',$,$,${elPl()},${shape([extr(columnPoly(c), 0, st.height)])},$,.COLUMN.)`); inhalt.push(cl); assoc(material('Stahlbeton'), cl); stats.sonst++; }
    for (const b of doc.all('balken', st.id)) { const hh = b.hoehe || 300; const top = st.roomHeight || 2500; const bm = A(`IFCBEAM('${ifcGuid()}',${oh},'Unterzug',$,$,${elPl()},${shape([extr(G.stripPoly(b.a, b.b, (b.breite || 240) / 2), top - hh, hh)])},$,.BEAM.)`); inhalt.push(bm); assoc(material(MATN[b.material] || 'Stahlbeton'), bm); stats.sonst++; }
    for (const k of doc.all('koerper', st.id)) { if (!k.pts || k.pts.length < 3) continue; const z0 = k.z0 || 0, z1 = k.z1 ?? (st.roomHeight || 2500); const px = A(`IFCBUILDINGELEMENTPROXY('${ifcGuid()}',${oh},${str(k.art || 'Körper')},$,$,${elPl()},${shape([extr(k.pts, z0, z1 - z0)])},$,.ELEMENT.)`); inhalt.push(px); stats.sonst++; }
    // Dach (als Flächenmodell der Dachflächen, Dicke 250 mm)
    for (const rf of (doc.p.roofs || []).filter(x => x.storey === st.id)) {
      const pts = geo.outers.flat(); if (!pts.length) continue; let Rf; try { Rf = buildRoof(rf, G.bbox(pts), st.height + (rf.kniestock || 0)); } catch (e) { continue; }
      const solids = []; const d = 250;
      for (const f of Rf.faces) { // Dachfläche als vertikal extrudierte Platte über Facetten: Brep
        const top = f.poly.map(p => A(`IFCCARTESIANPOINT((${R(p.x)},${R(p.y)},${R(p.z)}))`)); const bot = f.poly.map(p => A(`IFCCARTESIANPOINT((${R(p.x)},${R(p.y)},${R(p.z - d)}))`));
        const face = (ids) => A(`IFCFACE((${A(`IFCFACEOUTERBOUND(${A(`IFCPOLYLOOP((${ids.join(',')}))`)},.T.)`)}))`);
        const faces = [face(top), face(bot.slice().reverse())]; for (let i = 0; i < top.length; i++) { const j = (i + 1) % top.length; faces.push(face([bot[i], bot[j], top[j], top[i]])); }
        solids.push(A(`IFCFACETEDBREP(${A(`IFCCLOSEDSHELL((${faces.join(',')}))`)})`));
      }
      if (solids.length) { const rfI = A(`IFCROOF('${ifcGuid()}',${oh},${str('Dach ' + (rf.typ || ''))},$,$,${elPl()},${shape(solids, 'Brep')},$,${({ sattel: '.GABLE_ROOF.', walm: '.HIP_ROOF.', pult: '.SHED_ROOF.', flach: '.FLAT_ROOF.', mansard: '.MANSARD_ROOF.', krueppelwalm: '.HIPPED_GABLE_ROOF.', zelt: '.PAVILION_ROOF.' })[rf.typ] || '.NOTDEFINED.'})`); inhalt.push(rfI); stats.sonst++; }
    }
    if (inhalt.length) A(`IFCRELCONTAINEDINSPATIALSTRUCTURE('${ifcGuid()}',${oh},$,$,(${inhalt.join(',')}),${sto})`);
    if (raeume.length) A(`IFCRELAGGREGATES('${ifcGuid()}',${oh},$,$,${sto},(${raeume.join(',')}))`);
  }
  if (storeyIds.length) A(`IFCRELAGGREGATES('${ifcGuid()}',${oh},$,$,${bld},(${storeyIds.join(',')}))`);
  for (const [m, objs] of matAssoc) A(`IFCRELASSOCIATESMATERIAL('${ifcGuid()}',${oh},$,$,(${objs.join(',')}),${m})`);
  const iso = now.toISOString().slice(0, 19);
  const head = ['ISO-10303-21;', 'HEADER;', `FILE_DESCRIPTION(('ViewDefinition [ReferenceView_V1.2]'),'2;1');`, `FILE_NAME(${str(name + '.ifc')},'${iso}',(${str(FREI ? (meta.planer || '') : FIRMA.inhaber)}),(${str(FREI ? (meta.planer || '') : FIRMA.name)}),'TW-CAD','TW-CAD','');`, `FILE_SCHEMA(('IFC4'));`, 'ENDSEC;', 'DATA;'];
  return { text: [...head, ...w.lines, 'ENDSEC;', 'END-ISO-10303-21;', ''].join('\n'), stats };
}
