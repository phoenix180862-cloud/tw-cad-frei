// TW-CAD – öffentliche Fassung (window.TW_FREI aus frei-config.js) und Bedienstufe Profi / Einstieg
// Läuft auch unter Node (Tests): dort gibt es kein window → Thomas' Fassung, Profi.
const WIN = typeof window !== 'undefined' ? window : null;

/** true = öffentliche Fassung: keine KI, kein Google/Drive/Master-App, neutrale Vorgaben */
export const FREI = !!(WIN && WIN.TW_FREI === true);

/** Werbehinweis – bleibt in der öffentlichen Fassung immer sichtbar (Startdialog, Info, Plankopf, PDF-Fuß) */
export const WERBUNG = 'Ein kostenloses Programm von Thomas Willwacher Fliesenlegermeister e.K. – www.thomas-willwacher.de';
export const WERBUNG_KURZ = 'TW-CAD – kostenlos von Thomas Willwacher Fliesenlegermeister e.K. · www.thomas-willwacher.de';
export const WERBUNG_URL = 'https://www.thomas-willwacher.de';

/* ───── Bedienstufe ───── */
const KEY = 'twcad_modus';
export const STUFEN = [['einstieg', 'Einstieg'], ['profi', 'Profi']];
/** Werkzeuge, die im Einstieg sichtbar sind (alle anderen bleiben im Code und in den Daten erhalten) */
export const EINSTIEG_TOOLS = new Set(['select', 'wallrect', 'wall', 'room', 'door', 'window', 'opening', 'symbol', 'dim', 'measure', 'text', 'move', 'copy', 'rotate', 'studio', 'tilestart', 'erase']);
/** Ansichten im Einstieg */
export const EINSTIEG_VIEWS = new Set(['grundriss', 'fliesen', '3d', 'druck']);

function lsGet(k) { try { return WIN && WIN.localStorage ? WIN.localStorage.getItem(k) : null; } catch (e) { return null; } }
function lsSet(k, v) { try { WIN && WIN.localStorage && WIN.localStorage.setItem(k, v); } catch (e) { } }

let stufe = 'profi', urlStufe = null;
/** beim Start: ?modus=einstieg|profi (wird gemerkt) > gespeichert > Profi (Thomas' Standard) */
export function stufeLaden() {
  if (!WIN) return stufe;
  try { const q = new URLSearchParams(WIN.location.search).get('modus'); if (q === 'einstieg' || q === 'profi') urlStufe = q; } catch (e) { }
  const s = urlStufe || lsGet(KEY);
  stufe = s === 'einstieg' ? 'einstieg' : 'profi';
  if (urlStufe) lsSet(KEY, urlStufe);
  return stufe;
}
/** wurde schon einmal eine Stufe gewählt (gespeichert oder per Link)? */
export function stufeGewaehlt() { return !!(urlStufe || lsGet(KEY)); }
export function getStufe() { return stufe; }
export function einstieg() { return stufe === 'einstieg'; }
export function setStufe(s) { stufe = s === 'einstieg' ? 'einstieg' : 'profi'; lsSet(KEY, stufe); return stufe; }

/** Element als Profi-Bedienelement markieren (im Einstieg ausgeblendet, per CSS) */
export function profi(el) { if (el && el.setAttribute) el.setAttribute('data-stufe', 'profi'); return el; }
/** alle seit `n0` an `parent` angehängten Kinder als Profi markieren */
export function profiAb(parent, n0) { if (!parent) return; const k = [...parent.children]; for (let i = n0; i < k.length; i++) profi(k[i]); }
