// TW-CAD (öffentliche Fassung) – Platzhalter für „drive.js“: KI / Google Drive sind hier nicht enthalten.
// Gleiche Exporte wie das Original, damit nichts bricht – keine Netzwerkaufrufe, keine Schlüssel.
const melden = (a) => { try { if (a && typeof a.toast === "function") a.toast("Diese Funktion ist in der kostenlosen Fassung von TW-CAD nicht enthalten.", true); } catch (e) { } };
export function token(a) { return null; }
export function warSchonAngemeldet(a) { return false; }
export function ladeGIS(a) { melden(a); return null; }
export function anmelden(a) { melden(a); return null; }
export async function baustellen(a) { melden(a); return null; }
export function baustellenGemerkt(a) { return null; }
export async function plaene(a) { melden(a); return null; }
export async function lvDateien(a) { melden(a); return null; }
export function plaeneGemerkt(a) { return null; }
export function planIndex(a) { return {}; }
export async function istAufGeraet(a) { return false; }
export async function dateiDaten(a) { melden(a); return null; }
export async function vorschauGet(a) { return null; }
export function vorschauPut(a) { return null; }
export async function ordnerAnlegen(a) { melden(a); return null; }
export async function zeichnungsOrdner(a) { melden(a); return null; }
export async function hochladen(a) { melden(a); return null; }
export async function dateiMeta(a) { melden(a); return null; }
export async function ladeText(a) { melden(a); return null; }
export async function cadProjekte(a) { melden(a); return null; }
export async function ordnerName(a) { melden(a); return null; }
export const CLIENT_ID = '';
export const ROOT_BAUSTELLEN = '';
export const ROOT_ABGESCHLOSSEN = '';
export const kennung = () => null;
export const istPdf = () => null;
