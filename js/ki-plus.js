// TW-CAD (öffentliche Fassung) – Platzhalter für „ki-plus.js“: KI / Google Drive sind hier nicht enthalten.
// Gleiche Exporte wie das Original, damit nichts bricht – keine Netzwerkaufrufe, keine Schlüssel.
const melden = (a) => { try { if (a && typeof a.toast === "function") a.toast("Diese Funktion ist in der kostenlosen Fassung von TW-CAD nicht enthalten.", true); } catch (e) { } };
export function modellKurz(a) { return ''; }
export async function kiBefehl(a) { melden(a); return null; }
export function befehlsLeiste(a) { melden(a); return null; }
export function aufbauenAusVorschlag(a) { melden(a); return null; }
export function grundrissDialog(a) { melden(a); return null; }
export async function visualisierung(a) { melden(a); return null; }
