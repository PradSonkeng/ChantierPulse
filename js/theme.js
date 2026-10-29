/* Thème clair / sombre / automatique.
 * - Le choix est mémorisé dans ce navigateur (clé « Chantierpulse.theme ») ; « automatique » suit l'appareil en direct.
 * - L'attribut data-theme de <html> vaut toujours « light » ou « dark » : toutes les couleurs viennent des variables CSS
 *   (css/app.css), les graphiques SVG n'ont donc rien à redessiner quand le thème change.
 * - À l'impression, on repasse toujours en clair (papier, PDF), puis on rétablit le thème à la fin. */
import { ic } from './ui.js';

const KEY = 'Chantierpulse.theme';
export const THEMES = [['system', 'Automatique', 'monitor'], ['light', 'Clair', 'sun'], ['dark', 'Sombre', 'moon']];
const META = { light: '#fcfcfb', dark: '#0e1013' };   // couleur de la barre du navigateur sur mobile
const root = document.documentElement;
const mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
let hostTheme = window.__cpHostTheme === 'light' || window.__cpHostTheme === 'dark' ? window.__cpHostTheme : null;
let lastSet = root.getAttribute('data-theme'), printing = false;

export function getPref() {
  try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; } catch { return 'system'; }
}
export function resolved(pref = getPref()) {
  if (pref === 'light' || pref === 'dark') return pref;
  return hostTheme || (mq && mq.matches ? 'dark' : 'light');
}
function write(theme) {
  lastSet = theme;
  if (root.getAttribute('data-theme') !== theme) root.setAttribute('data-theme', theme);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', META[theme]);
}
export function apply(pref = getPref()) {
  if (printing) return;
  const r = resolved(pref); write(r);
  window.dispatchEvent(new CustomEvent('themechange', { detail: { pref, resolved: r } }));
}
export function setPref(pref) {
  try { if (pref === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, pref); } catch { /* le choix vaut pour cette visite seulement */ }
  apply(pref);
}
export function nextPref(pref = getPref()) { return { system: 'light', light: 'dark', dark: 'system' }[pref]; }
export const themeLabel = (pref) => (THEMES.find((t) => t[0] === pref) || THEMES[0])[1];

/** Bouton rond de la barre du haut : change de thème à chaque clic (Automatique → Clair → Sombre). */
export function themeButton(cls = '') {
  const p = getPref(), icon = THEMES.find((t) => t[0] === p)[2];
  return `<button class="iconbtn ${cls}" type="button" data-theme-cycle title="Thème : ${themeLabel(p)} (cliquer pour changer)" aria-label="Thème : ${themeLabel(p)}. Changer de thème">${ic(icon, 18)}</button>`;
}
/** Sélecteur à trois choix (Paramètres, connexion). */
export function themeSeg() {
  const p = getPref();
  return `<div class="seg" role="radiogroup" aria-label="Apparence">${THEMES.map(([k, l, i]) => `<button type="button" role="radio" aria-checked="${k === p}" data-theme-pref="${k}" class="${k === p ? 'on' : ''}">${ic(i, 16)}${l}</button>`).join('')}</div>`;
}

/** Branche tous les boutons de thème de la page (délégation d'événements) et garde leur apparence à jour. */
export function initTheme(toast) {
  apply();
  document.addEventListener('click', (e) => {
    const cyc = e.target.closest('[data-theme-cycle]'), pick = e.target.closest('[data-theme-pref]');
    if (cyc) { const n = nextPref(); setPref(n); if (toast) toast(`Thème : ${themeLabel(n)}${n === 'system' ? ` (${resolved() === 'dark' ? 'sombre' : 'clair'} en ce moment)` : ''}.`, 'ok', 1800); }
    else if (pick) setPref(pick.dataset.themePref);
  });
  window.addEventListener('themechange', () => {
    const p = getPref(), icon = THEMES.find((t) => t[0] === p)[2];
    document.querySelectorAll('[data-theme-cycle]').forEach((b) => {
      b.title = `Thème : ${themeLabel(p)} (cliquer pour changer)`; b.setAttribute('aria-label', `Thème : ${themeLabel(p)}. Changer de thème`);
      b.innerHTML = ic(icon, 18);
    });
    document.querySelectorAll('[data-theme-pref]').forEach((b) => { const on = b.dataset.themePref === p; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
  });
  const onSys = () => { if (getPref() === 'system') apply(); };
  if (mq) (mq.addEventListener ? mq.addEventListener('change', onSys) : mq.addListener(onSys));
  window.addEventListener('storage', (e) => { if (e.key === KEY) apply(); });     // autre onglet
  // thème imposé par une page hôte (aperçu intégré) : on le suit tant que le choix est « automatique »
  new MutationObserver(() => {
    const v = root.getAttribute('data-theme');
    if (printing || v === lastSet) return;
    hostTheme = v === 'light' || v === 'dark' ? v : null; apply();
  }).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  // impression : toujours en clair
  const before = () => { if (printing) return; printing = true; write('light'); };
  const after = () => { if (!printing) return; printing = false; apply(); };
  window.addEventListener('beforeprint', before); window.addEventListener('afterprint', after);
  const pm = window.matchMedia && window.matchMedia('print');
  if (pm) (pm.addEventListener ? pm.addEventListener('change', (e) => (e.matches ? before() : after())) : 0);
}
