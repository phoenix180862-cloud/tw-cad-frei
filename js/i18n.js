// TW-CAD – Mehrsprachigkeit (Deutsch, English, Čeština, Slovenčina, Українська, Polski)
// Prinzip wie gettext: Der deutsche Text im Programm ist der Schlüssel. Die Wörterbücher js/lang/<code>.js
// ordnen jedem deutschen Text die Übersetzung zu (Platzhalter {0}, {1} … für Zahlen/Namen).
// Übersetzt wird beim Anzeigen: Oberfläche (Text, title, placeholder), Zeichenfläche (Canvas-Text),
// PDF-Ausgabe und Meldungsfenster. Projektdaten (Raumnamen usw.) bleiben, wie der Nutzer sie eingibt.
import { FREI } from './frei.js?v=20261028-0429';

const WIN = typeof window !== 'undefined' ? window : null;
export const SPRACHEN = [['de', 'Deutsch'], ['en', 'English'], ['cs', 'Čeština'], ['sk', 'Slovenčina'], ['uk', 'Українська'], ['pl', 'Polski']];
const CODES = new Set(SPRACHEN.map(s => s[0]));
const KEY = 'twcad_sprache';

let lang = 'de', dict = null, daten = null, muster = [], cache = new Map();
const norm = (s) => String(s).replace(/­/g, '').replace(/\s+/g, ' ').trim();
const DEUTSCH = /[A-Za-zÄÖÜäöüß]/;

function lsGet() { try { return WIN && WIN.localStorage ? WIN.localStorage.getItem(KEY) : null; } catch (e) { return null; } }
/** Sprache beim Start: gespeichert > (öffentliche Fassung) Browsersprache > Deutsch */
export function ermitteln() {
  if (!WIN) return 'de';
  try { const q = new URLSearchParams(WIN.location.search).get('sprache'); if (q && CODES.has(q)) return q; } catch (e) { }
  const s = lsGet(); if (s && CODES.has(s)) return s;
  if (FREI) for (const l of (WIN.navigator.languages || [WIN.navigator.language || ''])) { const c = String(l).slice(0, 2).toLowerCase(); if (CODES.has(c)) return c; }
  return 'de';
}
export function sprache() { return lang; }
export function setSprache(code) { if (!CODES.has(code)) return; try { WIN.localStorage.setItem(KEY, code); } catch (e) { } }

/** Wörterbuch der gewählten Sprache laden (vor dem Aufbau der Oberfläche aufrufen) */
export async function laden(code) {
  lang = code || ermitteln();
  if (lang !== 'de') {
    try { const v = new URL(import.meta.url).search; const M = await import(`./lang/${lang}.js${v}`); aufbauen(M.default || {}, M.DATEN || {}); }
    catch (e) { console.warn('Sprache nicht geladen:', lang, e.message); lang = 'de'; dict = null; }
  }
  if (WIN && WIN.document) { WIN.document.documentElement.lang = lang; if (dict) { canvasUebersetzen(WIN); dialogeUebersetzen(WIN); } }
  return lang;
}
/** für Tests (Node): Wörterbuch direkt setzen */
export function setzeWoerterbuch(code, obj, dat) { lang = code; if (code === 'de') { dict = null; return; } aufbauen(obj, dat); }

function aufbauen(obj, dat) {
  dict = new Map(); muster = []; cache = new Map();
  for (const [k, v] of Object.entries(obj)) {
    if (v == null || v === '') continue; const nk = norm(k);
    if (/\{\d+\}/.test(nk)) {
      const idx = []; const src = nk.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\\?\{(\d+)\\?\}/g, (m, i, o, s) => { idx.push(+i); return o + m.length === s.length && /\S/.test(s[o - 1] || ' ') && s[o - 1] !== '\\' ? '([\\s\\S]*?)' : '([\\s\\S]+?)'; });  // „…Uhr{4}“: angehängter Platzhalter darf leer sein
      // zwei Lesarten: kurz (lazy) und lang (greedy) – z. B. „A (KfW) (40 cm)“ passt nur gierig richtig auf „{0} ({1} cm)“
      try { muster.push({ re: new RegExp('^' + src + '$'), reG: new RegExp('^' + src.replace(/\(\[\\s\\S\]\+\?\)/g, '([\\s\\S]+)') + '$'), v, len: nk.replace(/\{\d+\}/g, '').length, idx }); } catch (e) { }
    } else dict.set(nk, v);
  }
  muster.sort((a, b) => b.len - a.len);
  daten = new Map(Object.entries(dat || {}).map(([k, v]) => [norm(k), v]));
}

/** Text übersetzen (deutscher Text → gewählte Sprache); {0} … werden mit den Argumenten gefüllt */
export function t(s, ...args) {
  let r = s;
  if (dict) { const n = norm(s); r = daten.get(n) ?? dict.get(n) ?? kern(n, 0) ?? s; }
  return args.length ? String(r).replace(/\{(\d+)\}/g, (_, i) => args[+i] ?? '') : r;
}
/** beliebigen angezeigten Text übersetzen (mit Zwischenspeicher) */
export function tr(s) {
  if (!dict || s == null) return s;
  if (typeof s !== 'string') { if (Array.isArray(s)) return s.map(tr); return s; }
  const c = cache.get(s); if (c !== undefined) return c;
  let r = s;
  const m = /^(\s*)([\s\S]*?)(\s*)$/.exec(s);
  if (m[2] && DEUTSCH.test(m[2]) && (m[2].match(/[A-Za-zÄÖÜäöüß]/g) || []).length >= 2) { const x = kern(norm(m[2]), 0); if (x != null) r = m[1] + String(x).trim() + m[3]; }
  if (cache.size > 30000) cache.clear(); cache.set(s, r); return r;
}
const BUCHST = /[A-Za-zÄÖÜäöüß]{2}/;
const rest = (s) => (String(s).match(/[A-Za-zÄÖÜäöüß]/g) || []).length; // unübersetzte Buchstaben
function kern(n, tiefe) { const r = kern2(n, tiefe); return r ? r[0] : null; }
/** liefert [Übersetzung, Anzahl unübersetzter Buchstaben] oder null – unter mehreren Lesarten gewinnt die vollständigste */
function kern2(n, tiefe) {
  const v = dict.get(n); if (v != null) return [v, 0];
  let best = null; const nimm = (k) => { if (k && (!best || k[1] < best[1])) best = k; return best && best[1] === 0; };
  const teil = (g) => { if (!BUCHST.test(g)) return [g, 0]; if (tiefe >= 3) return [g, rest(g)]; const x = kern2(norm(g), tiefe + 1); return x || [g, rest(g)]; };
  let treffer = 0;
  for (const mu of muster) {
    for (const re of [mu.re, mu.reG]) {
      const mm = re.exec(n); if (!mm) continue;
      let bad = 0;
      const out = mu.v.replace(/\{(\d+)\}/g, (_, i) => { const p = mu.idx.indexOf(+i); const g = p >= 0 ? mm[p + 1] : ''; if (g == null) return ''; const x = teil(g); bad += x[1]; return x[0]; });
      if (nimm([out, bad])) return best;
      if (re === mu.reG || mm[0] === n) treffer++;
    }
    if (treffer >= 6) break;
  }
  if (tiefe > 2) return best;
  // Satzzeichen am Ende/Anfang
  const e = /^(.*?)(\s*(?:…|\.\.\.|:|\?|!|\.|,|\*|·|–))$/.exec(n); if (e && e[1] && e[1] !== n) { const x = kern2(e[1], tiefe + 1); if (x && nimm([x[0] + e[2], x[1]])) return best; }
  // Symbol/Ziffer davor („③ Boden“, „⬛ Feinsteinzeug“, „+ Ebene“)
  const a = /^([^\p{L}\p{Nd}„“"'(\[]+\s*)(.+)$/u.exec(n); if (a) { const x = kern2(a[2], tiefe + 1); if (x && nimm([a[1] + x[0], x[1]])) return best; }
  // Maße/Zahlen dahinter („Drehtür einflügelig 101 × 213,5“, „Wannenschürze 170×75“)
  const z = /^(.*?\p{L}.*?)(\s+[\d.,×x/ ]*\d[\d.,×x/ ]*(?:mm|cm|m|m²|°|%)?)$/u.exec(n); if (z) { const x = kern2(z[1], tiefe + 1); if (x && nimm([x[0] + z[2], x[1]])) return best; }
  // Klammerzusatz „X (Y)“ – auch verschachtelt „213 (DIN Standard (Neubau üblich))“
  for (const kre of [/^(.+?)\s*\(([^()]+)\)$/, /^([^()]+?)\s*\((.+)\)$/]) {
    const k = kre.exec(n); if (!k) continue;
    const x = BUCHST.test(k[1]) ? kern2(k[1], tiefe + 1) : [k[1], 0], y = BUCHST.test(k[2]) ? kern2(k[2], tiefe + 1) : [k[2], 0];
    if ((x && x[0] !== k[1]) || (y && y[0] !== k[2])) if (nimm([`${x ? x[0] : k[1]} (${y ? y[0] : k[2]})`, (x ? x[1] : rest(k[1])) + (y ? y[1] : rest(k[2]))])) return best;
  }
  // zusammengesetzte Anzeigen „A · B“, „A – B“, „A: B“, „A / B“
  for (const sep of [' · ', ' – ', ' | ', ': ', ' / ', ', ']) {
    if (!n.includes(sep)) continue;
    let ok = false, bad = 0;
    const neu = n.split(sep).map(p => { if (!BUCHST.test(p)) return p; const x = kern2(p, tiefe + 1); if (x) { ok = true; bad += x[1]; return x[0]; } bad += rest(p); return p; });
    if (ok && nimm([neu.join(sep), bad])) return best;
  }
  return best;
}

/* ───── Oberfläche: Texte, title, placeholder automatisch übersetzen ───── */
const ATTR = ['title', 'placeholder', 'aria-label', 'alt'];
// zuletzt selbst gesetzte Werte merken – sonst könnte eine Übersetzung, die sich selbst wieder übersetzen lässt, endlos weiterlaufen
const gesetzt = new WeakMap(), gesetztAttr = new WeakMap();
function attr(el, a) {
  const v = el.getAttribute(a); if (!v) return;
  let m = gesetztAttr.get(el); if (m && m[a] === v) return;
  const x = tr(v); if (x === v) return;
  if (!m) gesetztAttr.set(el, m = {}); m[a] = x; el.setAttribute(a, x);
}
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'svg']);
function knoten(n) {
  if (!n) return;
  if (n.nodeType === 3) {
    const p = n.parentNode; if (!p || SKIP.has(p.nodeName) || (p.closest && p.closest('[data-i18n="aus"]'))) return;
    const v = n.nodeValue; if (gesetzt.get(n) === v) return; const x = tr(v); if (x !== v) { gesetzt.set(n, x); n.nodeValue = x; } return;
  }
  if (n.nodeType !== 1 && n.nodeType !== 9 && n.nodeType !== 11) return;
  if (n.nodeType === 1) {
    if (SKIP.has(n.nodeName)) return; if (n.getAttribute('data-i18n') === 'aus') return;
    for (const a of ATTR) if (n.hasAttribute(a)) attr(n, a);
  }
  for (const c of n.childNodes) knoten(c);
}
const beobachtet = new WeakSet();
/** Dokument (Hauptfenster, Werkzeug-Fenster, Hilfe) übersetzen und künftig mitübersetzen */
export function beobachten(doc) {
  if (!dict || !doc || !doc.body || beobachtet.has(doc)) return; beobachtet.add(doc);
  knoten(doc.body);
  const MO = (doc.defaultView || WIN).MutationObserver;
  new MO((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData') knoten(m.target);
      else if (m.type === 'attributes') attr(m.target, m.attributeName);
      else for (const a of m.addedNodes) knoten(a);
    }
  }).observe(doc.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTR });
}

/* ───── Zeichenfläche (Canvas) und Meldungsfenster ───── */
function canvasUebersetzen(w) {
  const P = w.CanvasRenderingContext2D && w.CanvasRenderingContext2D.prototype; if (!P || P.__twI18n) return; P.__twI18n = true;
  const f = P.fillText, s = P.strokeText, m = P.measureText;
  P.fillText = function (txt, ...a) { return f.call(this, tr(String(txt)), ...a); };
  P.strokeText = function (txt, ...a) { return s.call(this, tr(String(txt)), ...a); };
  P.measureText = function (txt) { return m.call(this, tr(String(txt))); };
}
function dialogeUebersetzen(w) {
  if (w.__twDialoge) return; w.__twDialoge = true;
  const c = w.confirm, a = w.alert, p = w.prompt;
  w.confirm = (msg) => c.call(w, tr(msg)); w.alert = (msg) => a.call(w, tr(msg)); w.prompt = (msg, def) => p.call(w, tr(msg), def);
}

/* ───── PDF (jsPDF): Unicode-Schrift einbetten (Umlaute, Č/Ł/Ž, Kyrillisch, m²) und Texte übersetzen ───── */
let schriftLaden = null;
export function pdfVorbereiten() {
  if (schriftLaden) return schriftLaden;
  schriftLaden = (async () => {
    const J = WIN && WIN.jspdf; if (!J) return;
    const holen = async (f) => {
      const b = new Uint8Array(await (await fetch(new URL('../lib/fonts/' + f, import.meta.url))).arrayBuffer());
      let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return WIN.btoa(s);
    };
    let normal = null, fett = null;
    try { [normal, fett] = await Promise.all([holen('DejaVuSansCondensed.ttf'), holen('DejaVuSansCondensed-Bold.ttf')]); } catch (e) { console.warn('PDF-Schrift nicht geladen:', e.message); }
    const API = J.jsPDF.API;
    if (normal) WIN.__twPdfUnicode = true;
    if (normal) API.events.push(['addFonts', function () { this.addFileToVFS('TWSans.ttf', normal); this.addFont('TWSans.ttf', 'twsans', 'normal'); this.addFileToVFS('TWSans-Bold.ttf', fett); this.addFont('TWSans-Bold.ttf', 'twsans', 'bold'); }]);
    API.events.push(['initialized', function () {
      const d = this;
      if (normal) {
        const sf = d.setFont; d.setFont = function (name, style, wt) { if (!name || /helvetica|arial|inter/i.test(name)) name = 'twsans'; if (name === 'twsans') style = /bold/.test(style || '') ? 'bold' : 'normal'; return sf.call(d, name, style, wt); };
        try { d.setFont('twsans', 'normal'); } catch (e) { }
      }
      if (dict) {
        const tx = d.text, sp = d.splitTextToSize, gw = d.getTextWidth;
        d.text = function (txt, ...a) { return tx.call(d, tr(txt), ...a); };
        d.splitTextToSize = function (txt, ...a) { return sp.call(d, tr(txt), ...a); };
        d.getTextWidth = function (txt) { return gw.call(d, tr(txt)); };
      }
    }]);
  })();
  return schriftLaden;
}
