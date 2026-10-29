/* Fenêtre « Ajouter un surcoût » (intempéries, retard de livraison, matériaux…). */
import { store } from '../store.js';
import { openModal, field, options, toast } from '../ui.js';
import { esc, parseNum } from '../format.js';
import { COST_CATEGORIES } from '../model.js';

export function openCostModal({ date = store.today, cost = null, onSaved = null } = {}) {
  const st = store.state, c = cost || {};
  const tasks = st.data.tasks.slice().sort((a, b) => a.sort_order - b.sort_order);
  return openModal({
    title: cost ? 'Modifier le surcoût' : 'Ajouter un surcoût',
    sub: 'Les surcoûts d’intempéries, de pannes et de livraisons alimentent l’indicateur « Surcoût lié aux aléas ».',
    body: `<div class="row r2">
      ${field('Date', `<input id="cd" type="date" value="${c.event_date || date}" max="${store.today}">`, { id: 'cd' })}
      ${field('Catégorie', `<select id="cc">${options(Object.entries(COST_CATEGORIES), c.category || 'intemperies')}</select>`, { id: 'cc' })}
      ${field(`Montant (${esc(st.project.currency)})`, `<input id="ca" inputmode="decimal" value="${c.amount ?? ''}" placeholder="ex. 150 000">`, { id: 'ca' })}
      ${field('Tâche concernée (facultatif)', `<select id="ct"><option value="">—</option>${options(tasks.map((t) => [t.code, `${t.code} · ${t.name}`]), c.task_code || '')}</select>`, { id: 'ct' })}
    </div>
    ${field('Libellé', `<input id="cl" value="${esc(c.label || '')}" maxlength="160" placeholder="ex. Pluie : arrêt du coulage">`, { id: 'cl' })}`,
    actions: [{ label: 'Annuler' }, {
      label: cost ? 'Enregistrer' : 'Ajouter', kind: 'pri',
      onClick: async (api) => {
        const v = (id) => api.$(id).value.trim();
        const amount = parseNum(v('#ca'));
        if (!v('#cd')) throw new Error('Renseignez la date.');
        if (!(amount >= 0)) throw new Error('Montant invalide.');
        if (!v('#cl')) throw new Error('Donnez un libellé au surcoût.');
        const saved = await store.save('cost_events', { ...(cost ? { id: cost.id } : {}), event_date: v('#cd'), category: v('#cc'), label: v('#cl'), amount, task_code: v('#ct') || null });
        toast('Surcoût enregistré.', 'ok');
        if (onSaved) onSaved(saved);
      },
    }],
  });
}
