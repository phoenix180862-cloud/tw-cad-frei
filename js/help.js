// TW-CAD – Hilfe: kleines eigenes Fenster (zweiter Bildschirm) oder schwebend, folgt dem Arbeitsschritt
import { HILFE_FUER } from './help-data.js?v=20261028-0429';

let kanal = null, fenster = null, floatEl = null, letzter = 'start';
export function init(app) {
  try { kanal = new BroadcastChannel('tw-cad-hilfe'); kanal.onmessage = (e) => { if (e.data && e.data.frage === 'kontext') senden({ kontext: letzter }); }; } catch (e) { }
}
function senden(m) { try { kanal && kanal.postMessage(m); } catch (e) { } try { floatEl && floatEl.querySelector('iframe').contentWindow.postMessage(m, location.origin); } catch (e) { } }
export function context(key) { const id = HILFE_FUER[key] || key || 'start'; if (id === letzter) return; letzter = id; senden({ kontext: id }); }
export function open(key) {
  const id = HILFE_FUER[key] || key || 'start'; letzter = id;
  const url = `hilfe.html?thema=${encodeURIComponent(id)}`;
  const touch = matchMedia('(pointer: coarse)').matches && innerWidth < 1100;
  if (!touch) {
    if (fenster && !fenster.closed) { fenster.focus(); senden({ kontext: id, zeigen: true }); return; }
    fenster = window.open(url, 'tw-cad-hilfe', 'popup=yes,width=560,height=520,left=' + (screen.availWidth - 600) + ',top=80');
    if (fenster) return;
  }
  if (floatEl) { floatEl.remove(); floatEl = null; }
  floatEl = document.createElement('div'); floatEl.className = 'helpfloat';
  floatEl.innerHTML = `<div class="hd">▶ Hilfe <span style="flex:1"></span><button class="ib" title="schließen">✕</button></div><iframe src="${url}&eingebettet=1"></iframe>`;
  document.body.append(floatEl);
  floatEl.querySelector('button').onclick = () => { floatEl.remove(); floatEl = null; };
  const hd = floatEl.querySelector('.hd'); let d = null;
  hd.onpointerdown = (e) => { d = { x: e.clientX, y: e.clientY, r: floatEl.getBoundingClientRect() }; hd.setPointerCapture(e.pointerId); };
  hd.onpointermove = (e) => { if (!d) return; floatEl.style.left = (d.r.left + e.clientX - d.x) + 'px'; floatEl.style.top = (d.r.top + e.clientY - d.y) + 'px'; floatEl.style.right = 'auto'; floatEl.style.bottom = 'auto'; };
  hd.onpointerup = () => d = null;
}
