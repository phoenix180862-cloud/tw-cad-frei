// TW-CAD (öffentliche Fassung) – Platzhalter für „ai.js“: KI / Google Drive sind hier nicht enthalten.
// Gleiche Exporte wie das Original, damit nichts bricht – keine Netzwerkaufrufe, keine Schlüssel.
const melden = (a) => { try { if (a && typeof a.toast === "function") a.toast("Diese Funktion ist in der kostenlosen Fassung von TW-CAD nicht enthalten.", true); } catch (e) { } };
export function settings(a) { return { key: '', model: '' }; }
export function bereit(a) { return false; }
export async function claude(a) { melden(a); return null; }
export function parseJSON(a) { return null; }
export function openAI(a) { melden(a); return null; }
export function executeActions(a) { melden(a); return null; }
export async function readLV(a) { melden(a); return null; }
export async function searchTile(a) { melden(a); return null; }
export async function readPlanAI(a) { melden(a); return null; }
export const MODELLE = [];
export const LINKS = {};
