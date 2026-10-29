/* Paramètres › Projet : informations générales, création et suppression de chantier. */
import { store } from '../../store.js';
import { ic, openModal, toast, errorToast, field } from '../../ui.js';
import { esc, dateFull } from '../../format.js';
import { projectForm, readProjectForm } from '../noproject.js';
import { readOnlyNote } from '../parametres.js';
import { clearAnalysisCache } from '../../analysis.js';
import { go } from '../../router.js';

export async function render(box) {
  const p = store.state.project, can = store.can('plan'), admin = store.can('admin');
  box.innerHTML = `${readOnlyNote()}
    <div class="card" style="max-width:860px"><div class="ch"><div><h3>Informations du chantier</h3><div class="sub">Ces dates servent de référence aux simulations : l’échéance est la date à tenir.</div></div></div>
      <form id="pform" class="stack" style="gap:18px" autocomplete="off">${projectForm(p)}
      ${can ? `<div class="hstack"><button class="btn pri" type="submit">${ic('save', 16)}Enregistrer</button></div>` : ''}</form></div>
    ${admin ? `<div class="card" style="max-width:860px"><div class="ch"><div><h3>Gérer les chantiers</h3><div class="sub">Réservé à la direction.</div></div></div>
      <div class="hstack"><button class="btn" id="newp" type="button">${ic('plus', 16)}Créer un nouveau chantier</button><button class="btn danger" id="delp" type="button">${ic('trash', 16)}Supprimer ce chantier</button></div></div>` : ''}`;
  const f = box.querySelector('#pform');
  if (!can) f.querySelectorAll('input,select,textarea').forEach((el) => { el.disabled = true; });
  f.onsubmit = async (e) => {
    e.preventDefault();
    try { const data = readProjectForm(f); await store.saveProject(data); clearAnalysisCache(); toast('Chantier enregistré.', 'ok'); } catch (er) { errorToast(er); }
  };
  const np = box.querySelector('#newp');
  if (np) np.onclick = () => openModal({
    title: 'Nouveau chantier', body: projectForm(),
    actions: [{ label: 'Annuler' }, { label: 'Créer le chantier', kind: 'pri', onClick: async (m) => { const data = readProjectForm(m.el); await store.createProject(data); clearAnalysisCache(); toast('Chantier créé. Ajoutez maintenant son planning.', 'ok'); go('/parametres/planning'); } }],
  });
  const dp = box.querySelector('#delp');
  if (dp) dp.onclick = () => openModal({
    title: 'Supprimer ce chantier', sub: 'Toutes les données du chantier (planning, saisies, pannes, coûts) seront définitivement supprimées.',
    body: field(`Pour confirmer, recopiez le nom : <b>${esc(p.name)}</b>`, '<input id="cn" autocomplete="off">', { id: 'cn' }),
    actions: [{ label: 'Annuler' }, { label: 'Supprimer définitivement', kind: 'danger', onClick: async (m) => {
      if (m.$('#cn').value.trim() !== p.name) throw new Error('Le nom saisi ne correspond pas.');
      await store.deleteProject(p.id); clearAnalysisCache(); toast('Chantier supprimé.', 'ok'); go('/');
    } }],
  });
}
