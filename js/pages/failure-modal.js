/* Fenêtre « Déclarer une panne » (saisie quotidienne et page Fiabilité). */
import { store } from '../store.js';
import { openModal, field, options, toast } from '../ui.js';
import { esc, parseNum, daysBetween, nf, isoDate, addDays } from '../format.js';

export const CAUSES = ['Fuite hydraulique', 'Flexible hydraulique percé', 'Défaut électrique', 'Courroie rompue', 'Surchauffe moteur', 'Pneu crevé', 'Filtre colmaté', 'Batterie déchargée', 'Capteur défaillant', 'Fin de course'];

/** Date + heure locales → ISO avec décalage horaire (« 2026-10-21T10:40:00+01:00 »). */
export function localIso(date, time) {
  const d = new Date(`${date}T${time || '08:00'}:00`);
  const off = -d.getTimezoneOffset(), sign = off >= 0 ? '+' : '-', a = Math.abs(off);
  return `${date}T${time || '08:00'}:00${sign}${String(Math.floor(a / 60)).padStart(2, '0')}:${String(a % 60).padStart(2, '0')}`;
}

/** Estimation des heures de marche depuis la dernière panne de l'engin (semaine de 6 jours). */
export function estimateRunHours(equipmentId, date) {
  const eq = store.state.data.equipment.find((e) => e.id === equipmentId); if (!eq) return null;
  const last = store.state.data.failures.filter((f) => f.equipment_id === equipmentId && f.occurred_at.slice(0, 10) <= date)
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1))[0];
  const from = last ? last.occurred_at.slice(0, 10) : store.state.project.start_date;
  const days = Math.max(0, daysBetween(from, date));
  return Math.round(days * 6 / 7 * Number(eq.hours_per_week) / 6 * 10) / 10;
}

export function openFailureModal({ date = store.today, equipmentId = null, failure = null, onSaved = null } = {}) {
  const st = store.state, eqs = st.data.equipment;
  if (!eqs.length) { toast('Ajoutez d’abord un engin (Paramètres › Engins).', 'err'); return null; }
  const f = failure || {};
  const eid = f.equipment_id || equipmentId || eqs[0].id;
  const d0 = f.occurred_at ? f.occurred_at.slice(0, 10) : date, t0 = f.occurred_at ? f.occurred_at.slice(11, 16) : '08:00';
  const m = openModal({
    title: failure ? 'Modifier la panne' : 'Déclarer une panne',
    sub: 'Chaque panne alimente le taux λ (loi de Poisson), le MTBF et la simulation du planning.',
    body: `<div class="row r2">
      ${field('Engin', `<select id="fe">${options(eqs.map((e) => [e.id, e.name]), eid)}</select>`, { id: 'fe' })}
      ${field('Date', `<input id="fd" type="date" value="${d0}" max="${isoDate(addDays(store.today, 0))}">`, { id: 'fd' })}
      ${field('Heure de la panne', `<input id="ft" type="time" value="${t0}">`, { id: 'ft' })}
      ${field('Durée d’arrêt (minutes)', `<input id="fm" inputmode="decimal" value="${f.downtime_hours !== undefined ? Math.round(f.downtime_hours * 60) : ''}" placeholder="ex. 95">`, { id: 'fm', hint: 'Temps de réparation (MTTR).' })}
      ${field('Heures de marche depuis la dernière panne', `<input id="fr" inputmode="decimal" value="${f.run_hours_since_last ?? ''}">`, { id: 'fr', hint: 'Compteur horaire si vous l’avez ; sinon une estimation est proposée.' })}
      ${field(`Coût de réparation (${esc(st.project.currency)})`, `<input id="fc" inputmode="decimal" value="${f.repair_cost || ''}" placeholder="0">`, { id: 'fc' })}
    </div>
    ${field('Cause', `<input id="fk" list="causes" value="${esc(f.cause || '')}" maxlength="120" placeholder="ex. flexible hydraulique"><datalist id="causes">${CAUSES.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`, { id: 'fk' })}`,
    actions: [{ label: 'Annuler' }, {
      label: failure ? 'Enregistrer' : 'Déclarer la panne', kind: 'pri',
      onClick: async (api) => {
        const v = (id) => api.$(id).value.trim();
        const mins = parseNum(v('#fm') || '0'), run = v('#fr') === '' ? null : parseNum(v('#fr')), cost = parseNum(v('#fc') || '0');
        if (!v('#fd')) throw new Error('Renseignez la date.');
        if (!(mins >= 0)) throw new Error('Durée d’arrêt invalide.');
        if (run !== null && !(run >= 0)) throw new Error('Heures de marche invalides.');
        if (!(cost >= 0)) throw new Error('Coût invalide.');
        const row = { ...(failure ? { id: failure.id } : {}), equipment_id: v('#fe'), occurred_at: localIso(v('#fd'), v('#ft')), downtime_hours: Math.round(mins / 60 * 100) / 100, run_hours_since_last: run, cause: v('#fk'), repair_cost: cost };
        const saved = await store.save('failures', row);
        toast(saved._queued ? 'Panne enregistrée hors connexion : elle sera envoyée au retour du réseau.' : 'Panne enregistrée.', 'ok');
        if (onSaved) onSaved(saved);
      },
    }],
    onMount(el) {
      const run = el.querySelector('#fr'), eq = el.querySelector('#fe'), dt = el.querySelector('#fd');
      const suggest = () => { if (failure || run.dataset.touched) return; const h = estimateRunHours(eq.value, dt.value); run.value = h === null ? '' : nf(h, 1).replace(/\s| /g, ''); };
      run.addEventListener('input', () => { run.dataset.touched = '1'; });
      eq.addEventListener('change', suggest); dt.addEventListener('change', suggest); suggest();
    },
  });
  return m;
}
