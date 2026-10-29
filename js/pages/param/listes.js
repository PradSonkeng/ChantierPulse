/* Paramètres › Activités et Engins : listes simples avec fenêtre d'édition. */
import { store } from '../../store.js';
import { ic, openModal, toast, errorToast, field, confirmDialog } from '../../ui.js';
import { esc, nf, parseNum } from '../../format.js';
import { readOnlyNote } from '../parametres.js';
import { clearAnalysisCache } from '../../analysis.js';

const UNITS = ['m³/h', 'm²/j', 'm²/h', 'kg/h', 'ml/j', 'ml/h', 'm³/j', 'kg/j', 'u/j'];

function activityModal(a = null) {
  const x = a || {};
  openModal({
    title: a ? 'Modifier l’activité' : 'Ajouter une activité',
    sub: 'Une activité est ce que l’on mesure chaque jour : on note la quantité réalisée et le temps passé, le rendement s’en déduit.',
    body: `<div class="row r2">${field('Nom de l’activité', `<input id="an" value="${esc(x.name || '')}" maxlength="80" placeholder="ex. Coulage du béton">`, { id: 'an' })}
      ${field('Unité de rendement', `<input id="au" list="units" value="${esc(x.unit || '')}" maxlength="16" placeholder="ex. m³/h"><datalist id="units">${UNITS.map((u) => `<option value="${u}">`).join('')}</datalist>`, { id: 'au', hint: 'Quantité / temps : « m³/h », « m²/j »…' })}
      ${field('Rendement prévu μ₀', `<input id="ar" inputmode="decimal" value="${x.planned_rate ?? ''}" placeholder="ex. 24">`, { id: 'ar', hint: 'Valeur du planning, contre laquelle on teste l’écart.' })}</div>`,
    actions: [{ label: 'Annuler' }, { label: a ? 'Enregistrer' : 'Ajouter', kind: 'pri', onClick: async (m) => {
      const v = (s) => m.$(s).value.trim(), rate = parseNum(v('#ar'));
      if (!v('#an')) throw new Error('Donnez un nom à l’activité.');
      if (!v('#au')) throw new Error('Indiquez l’unité du rendement (ex. m³/h).');
      if (!(rate > 0)) throw new Error('Le rendement prévu doit être un nombre positif.');
      const list = store.state.data.activities;
      await store.save('activities', { ...(a ? { id: a.id } : {}), name: v('#an'), unit: v('#au'), planned_rate: rate, sort_order: a ? a.sort_order : (list.length ? Math.max(...list.map((q) => q.sort_order)) + 1 : 0) });
      clearAnalysisCache(); toast('Activité enregistrée.', 'ok');
    } }],
  });
}
function equipmentModal(e = null) {
  const x = e || {};
  openModal({
    title: e ? 'Modifier l’engin' : 'Ajouter un engin',
    body: `<div class="row r2">${field('Nom de l’engin', `<input id="en" value="${esc(x.name || '')}" maxlength="120" placeholder="ex. Grue à tour">`, { id: 'en' })}
      ${field('Type', `<input id="ek" value="${esc(x.kind || '')}" maxlength="40" placeholder="ex. Levage">`, { id: 'ek' })}
      ${field('Heures de marche par semaine', `<div class="inp"><input id="eh" inputmode="decimal" value="${x.hours_per_week ?? 40}"><span class="u">h</span></div>`, { id: 'eh', hint: 'Sert à convertir les pannes par semaine en heures de marche.' })}
      ${field('Durée moyenne de réparation', `<div class="inp"><input id="em" inputmode="decimal" value="${x.mttr_hours ?? 3}"><span class="u">h</span></div>`, { id: 'em', hint: 'Valeur par défaut tant qu’il n’y a pas de panne enregistrée.' })}</div>`,
    actions: [{ label: 'Annuler' }, { label: e ? 'Enregistrer' : 'Ajouter', kind: 'pri', onClick: async (m) => {
      const v = (s) => m.$(s).value.trim(), h = parseNum(v('#eh')), r = parseNum(v('#em'));
      if (!v('#en')) throw new Error('Donnez un nom à l’engin.');
      if (!(h > 0 && h <= 168)) throw new Error('Les heures par semaine doivent être comprises entre 0 et 168.');
      if (!(r > 0 && r <= 1000)) throw new Error('Durée de réparation invalide.');
      await store.save('equipment', { ...(e ? { id: e.id } : {}), name: v('#en'), kind: v('#ek'), hours_per_week: h, mttr_hours: r });
      clearAnalysisCache(); toast('Engin enregistré.', 'ok');
    } }],
  });
}

export async function render(box, ctx, { tab }) {
  const can = store.can('plan'), d = store.state.data;
  const rows = tab === 'activites' ? d.activities.slice().sort((a, b) => a.sort_order - b.sort_order) : d.equipment.slice().sort((a, b) => (a.created_at || '') < (b.created_at || '') ? -1 : 1);
  const isAct = tab === 'activites';
  const nEntries = (id) => d.productivity_entries.filter((e) => e.activity_id === id).length;
  const nFail = (id) => d.failures.filter((f) => f.equipment_id === id).length;
  box.innerHTML = `${readOnlyNote()}
    <div class="card"><div class="ch"><div><h3>${isAct ? 'Activités suivies' : 'Engins du chantier'}</h3><div class="sub">${isAct ? 'Chaque activité a un rendement prévu μ₀ : le test de Student compare vos relevés à cette valeur.' : 'Les pannes se déclarent par engin : elles alimentent le taux λ, le MTBF et la disponibilité.'}</div></div>
      <div class="r">${can ? `<button class="btn pri" id="add" type="button">${ic('plus', 16)}${isAct ? 'Ajouter une activité' : 'Ajouter un engin'}</button>` : ''}</div></div>
      ${rows.length ? `<div class="tw"><table><thead>${isAct ? '<tr><th>Activité</th><th>Unité</th><th class="num">Rendement prévu</th><th class="num">Relevés</th>' : '<tr><th>Engin</th><th>Type</th><th class="num">Heures / semaine</th><th class="num">Réparation</th><th class="num">Pannes</th>'}${can ? '<th></th>' : ''}</tr></thead><tbody>
      ${rows.map((r) => `${isAct
        ? `<tr><td><b style="font-weight:600">${esc(r.name)}</b></td><td>${esc(r.unit)}</td><td class="num">${nf(r.planned_rate, 1)}</td><td class="num">${nEntries(r.id)}</td>`
        : `<tr><td><b style="font-weight:600">${esc(r.name)}</b></td><td class="m">${esc(r.kind || '—')}</td><td class="num">${nf(r.hours_per_week, 0)} h</td><td class="num">${nf(r.mttr_hours, 1)} h</td><td class="num">${nFail(r.id)}</td>`}
        ${can ? `<td><div class="hstack" style="gap:2px;justify-content:flex-end;flex-wrap:nowrap"><button class="iconbtn sm" data-edit="${r.id}" aria-label="Modifier">${ic('edit', 15)}</button><button class="iconbtn sm" data-del="${r.id}" aria-label="Supprimer">${ic('trash', 15)}</button></div></td>` : ''}</tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><b>${isAct ? 'Aucune activité' : 'Aucun engin'}</b>${isAct ? 'Ajoutez les activités à mesurer (coulage, ferraillage, coffrage…).' : 'Ajoutez les engins dont vous voulez suivre les pannes.'}</div>`}</div>`;
  const by = (id) => rows.find((r) => r.id === id);
  const add = box.querySelector('#add'); if (add) add.onclick = () => (isAct ? activityModal() : equipmentModal());
  box.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => (isAct ? activityModal(by(b.dataset.edit)) : equipmentModal(by(b.dataset.edit))); });
  box.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      const r = by(b.dataset.del), n = isAct ? nEntries(r.id) : nFail(r.id);
      if (!(await confirmDialog(`Supprimer <b>${esc(r.name)}</b> ?${n ? `<br><br>Les ${n} ${isAct ? 'relevés de productivité' : 'pannes'} associé${n > 1 ? 'e' : ''}s seront aussi supprimé${n > 1 ? 'e' : ''}s.` : ''}`, { title: 'Supprimer', ok: 'Supprimer', danger: true }))) return;
      try { await store.remove(isAct ? 'activities' : 'equipment', r.id); await store.refresh(); clearAnalysisCache(); toast('Supprimé.', 'ok'); } catch (e) { errorToast(e); }
    };
  });
}
