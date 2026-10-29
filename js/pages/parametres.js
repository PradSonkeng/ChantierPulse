/* Paramètres : projet, planning, activités, engins, modèle de simulation, utilisateurs, données, compte, manuel. */
import { store } from '../store.js';
import { ic, spinner, errorToast } from '../ui.js';
import { pageHead } from './_common.js';
import { esc } from '../format.js';

export const TABS = [
  { key: 'projet', label: 'Projet', icon: 'pin', mod: './param/projet.js' },
  { key: 'planning', label: 'Planning', icon: 'layers', mod: './param/planning.js' },
  { key: 'activites', label: 'Activités', icon: 'activity', mod: './param/listes.js' },
  { key: 'engins', label: 'Engins', icon: 'wrench', mod: './param/listes.js' },
  { key: 'modele', label: 'Modèle', icon: 'dice', mod: './param/modele.js' },
  { key: 'utilisateurs', label: 'Utilisateurs', icon: 'users', mod: './param/utilisateurs.js', admin: true },
  { key: 'donnees', label: 'Données', icon: 'db', mod: './param/donnees.js' },
  { key: 'compte', label: 'Compte', icon: 'user', mod: './param/compte.js' },
  { key: 'manuel', label: 'Manuel d’utilisation', icon: 'book', mod: '../manual/manual.js' },
];

export const readOnlyNote = () => store.can('plan') ? '' : `<div class="note info">${ic('lock', 17)}<div>Lecture seule : seuls le conducteur de travaux et la direction peuvent modifier cette section.</div></div>`;

export async function render(root, ctx) {
  const visible = TABS.filter((t) => !t.admin || store.can('admin'));
  const key = visible.some((t) => t.key === ctx.params[0]) ? ctx.params[0] : 'projet';
  const tab = TABS.find((t) => t.key === key);
  const printing = key === 'manuel' && ctx.query.print === '1';

  root.innerHTML = (printing ? '' : pageHead('Paramètres', 'Chantier, planning, modèle de calcul, utilisateurs et manuel d’utilisation')
    + `<nav class="tabs no-print" aria-label="Sections des paramètres">${visible.map((t) => `<a href="#/parametres/${t.key}" class="${t.key === key ? 'on' : ''}" ${t.key === key ? 'aria-current="page"' : ''}>${esc(t.label)}</a>`).join('')}</nav>`)
    + `<div id="tabbody" style="display:flex;flex-direction:column;gap:20px">${spinner()}</div>`;
  const box = root.querySelector('#tabbody');
  try {
    const mod = await import(tab.mod);
    if (!root.isConnected) return;
    box.innerHTML = '';
    let paint = () => mod.render(box, ctx, { tab: key });
    await paint();
    // Réaffichage après chaque modification des données, sauf si l'utilisateur est en train de taper.
    let t = null;
    ctx.subscribe(() => {
      clearTimeout(t);
      t = setTimeout(() => {
        const a = document.activeElement;
        if (!root.isConnected || (a && root.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) || document.querySelector('.overlay')) return;
        if (mod.live === false) return;
        Promise.resolve(paint()).catch(errorToast);
      }, 150);
    });
  } catch (e) { console.error(e); box.innerHTML = `<div class="card"><div class="empty"><b>Section indisponible</b>${esc(e.message || e)}</div></div>`; }
}
