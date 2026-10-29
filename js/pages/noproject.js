/* Affiché quand l'utilisateur n'a accès à aucun chantier. */
import { store } from '../store.js';
import { ic, openModal, field, errorToast, toast } from '../ui.js';
import { esc, localTodayIso, addDays, isoDate } from '../format.js';
import { go } from '../router.js';

export function projectForm(p = {}) {
  return `<div class="row r2">
    ${field('Nom du chantier', `<input id="pn" value="${esc(p.name || '')}" maxlength="120" required>`, { id: 'pn' })}
    ${field('Lieu', `<input id="pl" value="${esc(p.location || '')}" placeholder="Ville, quartier…">`, { id: 'pl' })}
    ${field('Date de début', `<input id="ps" type="date" value="${p.start_date || localTodayIso()}">`, { id: 'ps' })}
    ${field('Échéance à tenir', `<input id="pt" type="date" value="${p.target_date || isoDate(addDays(localTodayIso(), 120))}">`, { id: 'pt' })}
    ${field('Budget (facultatif)', `<input id="pb" inputmode="decimal" value="${p.budget ?? ''}" placeholder="0">`, { id: 'pb' })}
    ${field('Devise', `<input id="pc" value="${esc(p.currency || 'FCFA')}" maxlength="8">`, { id: 'pc' })}
  </div>`;
}
export function readProjectForm(root) {
  const v = (id) => root.querySelector(id).value.trim();
  const out = { name: v('#pn'), location: v('#pl'), start_date: v('#ps'), target_date: v('#pt'), currency: v('#pc') || 'FCFA' };
  const b = v('#pb').replace(/\s/g, '').replace(',', '.'); out.budget = b === '' ? null : Number(b);
  if (!out.name) throw new Error('Donnez un nom au chantier.');
  if (!out.start_date || !out.target_date) throw new Error('Renseignez les dates.');
  if (out.target_date < out.start_date) throw new Error('L’échéance doit suivre la date de début.');
  if (out.budget !== null && !(out.budget >= 0)) throw new Error('Budget invalide.');
  return out;
}

export async function render(root) {
  const admin = store.can('admin');
  root.innerHTML = `<div class="card" style="max-width:640px;margin:40px auto;text-align:center">
    <div class="empty"><b>Aucun chantier à afficher</b>
    ${admin ? 'Créez votre premier chantier pour commencer. Vous pourrez ensuite renseigner le planning, les activités et les engins dans Paramètres.' : 'Votre compte n’est rattaché à aucun chantier. Demandez à la direction de vous ajouter à un chantier (Paramètres › Utilisateurs), puis actualisez cette page.'}
    <div class="hstack" style="justify-content:center;margin-top:18px">${admin ? `<button class="btn pri" id="mk">${ic('plus', 16)}Créer un chantier</button>` : ''}<button class="btn" id="rf">${ic('refresh', 16)}Actualiser</button></div></div></div>`;
  root.querySelector('#rf').onclick = () => store.loadProjects().then(() => store.emit()).catch(errorToast);
  const mk = root.querySelector('#mk');
  if (mk) mk.onclick = () => openModal({
    title: 'Nouveau chantier', body: projectForm(),
    actions: [{ label: 'Annuler' }, { label: 'Créer le chantier', kind: 'pri', onClick: async (m) => { const data = readProjectForm(m.el); await store.createProject(data); toast('Chantier créé.', 'ok'); go('/parametres/planning'); } }],
  });
}
