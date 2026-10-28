// TW-CAD (öffentliche Fassung) – Platzhalter für „planwahl.js“: KI / Google Drive sind hier nicht enthalten.
// Gleiche Exporte wie das Original, damit nichts bricht – keine Netzwerkaufrufe, keine Schlüssel.
const melden = (a) => { try { if (a && typeof a.toast === "function") a.toast("Diese Funktion ist in der kostenlosen Fassung von TW-CAD nicht enthalten.", true); } catch (e) { } };
export async function seiteCanvas(a) { melden(a); return null; }
export function openPlanwahl(a) { const opt = arguments[1] || {}; if (opt.onEigeneDatei) opt.onEigeneDatei(); return null; }
