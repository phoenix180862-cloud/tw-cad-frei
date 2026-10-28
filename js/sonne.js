// TW-CAD – Sonnenstand nach Datum, Uhrzeit und Ort (vereinfachter NOAA-Algorithmus, Genauigkeit ca. 0,5°)
import { FREI } from './frei.js?v=20261028-0429';
import { HEIMAT, ORTE_REGION } from './firma.js?v=20261028-0429';
// öffentliche Fassung: neutraler Standort in der Mitte Deutschlands (eigener Ort jederzeit wählbar)
export const ORT_STANDARD = FREI || !HEIMAT.name ? { name: 'Kassel (Mitte Deutschlands)', lat: 51.316, lon: 9.498 } : { name: HEIMAT.name, lat: HEIMAT.lat, lon: HEIMAT.lon };
const ORTE_TW = [...ORTE_REGION,
  ['Koblenz', 50.356, 7.594], ['Köln', 50.938, 6.960], ['Frankfurt am Main', 50.110, 8.682], ['Mainz', 49.993, 8.247], ['Bonn', 50.735, 7.098], ['Hamburg', 53.551, 9.994], ['Berlin', 52.520, 13.405], ['München', 48.137, 11.576], ['Stuttgart', 48.776, 9.183], ['Dresden', 51.050, 13.738]
];
const ORTE_FREI = [['Kassel', 51.316, 9.498], ['Berlin', 52.520, 13.405], ['Hamburg', 53.551, 9.994], ['München', 48.137, 11.576], ['Köln', 50.938, 6.960], ['Frankfurt am Main', 50.110, 8.682], ['Stuttgart', 48.776, 9.183], ['Düsseldorf', 51.227, 6.773], ['Leipzig', 51.340, 12.375], ['Dortmund', 51.514, 7.468], ['Essen', 51.456, 7.012], ['Bremen', 53.079, 8.802], ['Dresden', 51.050, 13.738], ['Hannover', 52.375, 9.732], ['Nürnberg', 49.452, 11.077], ['Koblenz', 50.356, 7.594], ['Mainz', 49.993, 8.247], ['Saarbrücken', 49.240, 6.997], ['Freiburg', 47.999, 7.842], ['Kiel', 54.323, 10.123], ['Rostock', 54.092, 12.099], ['Erfurt', 50.978, 11.029], ['Magdeburg', 52.121, 11.628], ['Potsdam', 52.391, 13.064], ['Schwerin', 53.636, 11.401], ['Wiesbaden', 50.078, 8.240], ['Wien (AT)', 48.208, 16.373], ['Zürich (CH)', 47.377, 8.541]];
export const ORTE = FREI ? ORTE_FREI : ORTE_TW;
const RAD = Math.PI / 180;

/** Sonnenstand: az = Azimut in Grad (0 = Nord, 90 = Ost, im Uhrzeigersinn), el = Höhe in Grad */
export function sonnenstand(dateUtc, lat, lon) {
  const jd = dateUtc.getTime() / 86400000 + 2440587.5; const n = jd - 2451545.0;
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360; const g = (((357.528 + 0.9856003 * n) % 360 + 360) % 360) * RAD;
  const lam = (L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g)) * RAD; const eps = (23.439 - 0.0000004 * n) * RAD;
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam)); const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const gmst = ((18.697374558 + 24.06570982441908 * n) % 24 + 24) % 24; const ha = (gmst * 15 + lon) * RAD - ra;
  const la = lat * RAD;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(ha));
  const az = Math.atan2(-Math.sin(ha), Math.tan(dec) * Math.cos(la) - Math.sin(la) * Math.cos(ha));
  return { az: ((az / RAD) % 360 + 360) % 360, el: el / RAD, dec: dec / RAD };
}

/** Mitteleuropäische Zeit inkl. Sommerzeit: Offset in Stunden für ein Datum (UTC) */
function letzterSonntag(jahr, monat) { const d = new Date(Date.UTC(jahr, monat + 1, 0, 1)); d.setUTCDate(d.getUTCDate() - d.getUTCDay()); return d; }
export function mezOffset(utc) { const y = utc.getUTCFullYear(); return utc >= letzterSonntag(y, 2) && utc < letzterSonntag(y, 9) ? 2 : 1; }
/** Ortszeit (Datum 'YYYY-MM-DD', Stunde dezimal) → UTC-Date */
export function ortszeitZuUtc(datum, stunde) {
  const [y, m, d] = datum.split('-').map(Number); const hh = Math.floor(stunde), mm = Math.round((stunde - hh) * 60);
  let t = new Date(Date.UTC(y, m - 1, d, hh, mm)); const off = mezOffset(new Date(t.getTime() - 3600e3)); return new Date(t.getTime() - off * 3600e3);
}
export const sommerzeit = (datum) => mezOffset(ortszeitZuUtc(datum, 12)) === 2;
/** Sonnenstand zur Ortszeit */
export function sonneOrtszeit(datum, stunde, lat, lon) { return sonnenstand(ortszeitZuUtc(datum, stunde), lat, lon); }
/** Auf- und Untergang (Ortszeit, dezimal) sowie Mittag */
export function tagesbogen(datum, lat, lon) {
  let auf = null, unter = null, mittag = 12, maxEl = -90; let prev = null;
  for (let m = 0; m <= 24 * 60; m += 2) { const s = m / 60; const p = sonneOrtszeit(datum, s, lat, lon); if (p.el > maxEl) { maxEl = p.el; mittag = s; }
    if (prev) { if (prev.el < -0.833 && p.el >= -0.833) auf = s; if (prev.el >= -0.833 && p.el < -0.833) unter = s; } prev = p; }
  return { auf, unter, mittag, maxEl };
}
export const uhrzeit = (s) => s == null ? '–' : `${Math.floor(s)}:${String(Math.round((s % 1) * 60) % 60).padStart(2, '0')}`;
/** Himmelsrichtung als Text */
export function richtung(az) { const r = ['N', 'NNO', 'NO', 'ONO', 'O', 'OSO', 'SO', 'SSO', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW']; return r[Math.round(az / 22.5) % 16]; }
/** Richtungsvektor zur Sonne im Plan (x rechts, y oben) + Höhe; nord = Winkel des Nordpfeils (Grad, gegen Uhrzeigersinn) */
export function sonnenVektor(az, el, nord = 0) {
  const a = (nord - az) * RAD; const c = Math.cos(el * RAD);
  return { x: -Math.sin(a) * c, y: Math.cos(a) * c, z: Math.sin(el * RAD) };
}
