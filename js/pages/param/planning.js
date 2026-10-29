/* Paramètres › Planning : tâches, durées (minimum / probable / maximum), dépendances, avancement. */
import { store } from '../../store.js';
import { ic, openModal, toast, errorToast, field, options, confirmDialog, chip } from '../../ui.js';
import { esc, nf, parseNum } from '../../format.js';
import { validateTasks, progressOf, simTasks } from '../../model.js';
import { readOnlyNote } from '../parametres.js';
import { clearAnalysisCache } from '../../analysis.js';

const STATUS = { todo: 'À faire', doing: 'En cours', done: 'Terminée' };
const sorted = () => store.state.data.tasks.slice().sort((a, b) => a.sort_order - b.sort_order);

function nextCode(tasks) {
  let n = tasks.reduce((m, t) => Math.max(m, parseInt(String(t.code).replace(/\D/g, ''), 10) || 0), 0) + 1;
  while (tasks.some((t) => t.code === `T${n}`)) n++;
  return `T${n}`;
}

function openTaskModal(task = null) {
  const all = sorted(), t = task || {}, others = all.filter((x) => x.id !== t.id);
  const preds = new Set(t.preds || []);
  openModal({
    title: task ? `Modifier la tâche ${t.code}` : 'Ajouter une tâche', wide: true,
    sub: 'Trois durées estimées en jours calendaires (dimanches et jours fériés compris) : la loi Beta-PERT en déduit la durée probable et son incertitude.',
    body: `<div class="row r3"><div class="field"><label for="tc">Code</label><input id="tc" value="${esc(t.code || nextCode(all))}" maxlength="10" ${task ? 'disabled' : ''}></div>
        <div style="grid-column:span 2" class="field"><label for="tn">Intitulé de la tâche</label><input id="tn" value="${esc(t.name || '')}" maxlength="120" placeholder="ex. Coffrage-ferraillage dalle R+2"></div></div>
      <div class="row r3" style="margin-top:12px">${field('Durée minimale (optimiste)', `<div class="inp"><input id="ta" inputmode="decimal" value="${t.a ?? ''}"><span class="u">jours</span></div>`, { id: 'ta' })}
        ${field('Durée probable', `<div class="inp"><input id="tm" inputmode="decimal" value="${t.m ?? ''}"><span class="u">jours</span></div>`, { id: 'tm' })}
        ${field('Durée maximale (pessimiste)', `<div class="inp"><input id="tb" inputmode="decimal" value="${t.b ?? ''}"><span class="u">jours</span></div>`, { id: 'tb' })}</div>
      <div class="field" style="margin-top:12px"><span class="lab">Doit attendre la fin de… (prédécesseurs)</span>${others.length ? `<div class="pillrow" id="tpreds">${others.map((o) => `<button type="button" class="pill${preds.has(o.code) ? ' on' : ''}" data-code="${esc(o.code)}" aria-pressed="${preds.has(o.code)}">${esc(o.code)} · ${esc(o.name)}</button>`).join('')}</div>` : '<span class="muted">Aucune autre tâche pour le moment.</span>'}</div>
      <div class="row r3" style="margin-top:12px;align-items:end"><div class="field"><label for="ts">Statut</label><select id="ts">${options(Object.entries(STATUS), t.status || 'todo')}</select></div>
        <div class="field" id="tpw"><label for="tp">Avancement (%)</label><input id="tp" inputmode="numeric" value="${t.progress ?? 0}"></div>
        <label class="switch" style="min-height:42px"><input type="checkbox" id="te" ${t.exposed ? 'checked' : ''}><i></i><span>Exposée à la pluie</span></label></div>`,
    actions: [{ label: 'Annuler' }, { label: task ? 'Enregistrer' : 'Ajouter la tâche', kind: 'pri', onClick: async (m) => {
      const v = (s) => m.$(s).value.trim();
      const a = parseNum(v('#ta')), mm = parseNum(v('#tm')), b = parseNum(v('#tb'));
      if (!v('#tc')) throw new Error('Donnez un code à la tâche.');
      if (!v('#tn')) throw new Error('Donnez un intitulé à la tâche.');
      if (![a, mm, b].every(Number.isFinite)) throw new Error('Renseignez les trois durées (minimum, probable, maximum).');
      if (!(a >= 0 && a <= mm && mm <= b)) throw new Error('Il faut : minimum ≤ probable ≤ maximum.');
      if (b > 3650) throw new Error('Durée maximale irréaliste (plus de 3 650 jours).');
      const status = v('#ts'); let progress = Math.round(parseNum(v('#tp') || '0'));
      if (!(progress >= 0 && progress <= 100)) throw new Error('L’avancement doit être compris entre 0 et 100 %.');
      if (status === 'done') progress = 100; if (status === 'todo') progress = 0; if (status === 'doing' && (progress <= 0 || progress >= 100)) throw new Error('Une tâche « en cours » a un avancement entre 1 et 99 %.');
      const code = v('#tc');
      if (!task && all.some((x) => x.code === code)) throw new Error(`Le code « ${code} » est déjà utilisé.`);
      const pr = [...m.el.querySelectorAll('#tpreds .pill.on')].map((x) => x.dataset.code);
      const row = { ...(task ? { id: t.id } : {}), code, name: v('#tn'), a, m: mm, b, preds: pr, exposed: m.$('#te').checked, status, progress, sort_order: task ? t.sort_order : (all.length ? Math.max(...all.map((x) => x.sort_order)) + 1 : 0) };
      const err = validateTasks([...others, row]); if (err) throw new Error(err);
      await store.save('tasks', row); clearAnalysisCache(); toast('Tâche enregistrée.', 'ok');
    } }],
    onMount(el) {
      el.querySelector('#tpreds')?.addEventListener('click', (e) => { const b = e.target.closest('.pill'); if (b) { b.classList.toggle('on'); b.setAttribute('aria-pressed', b.classList.contains('on')); } });
      const st = el.querySelector('#ts'), pw = el.querySelector('#tpw'), tp = el.querySelector('#tp');
      const sync = () => { pw.style.display = st.value === 'doing' ? '' : 'none'; if (st.value === 'doing' && (!Number(tp.value) || Number(tp.value) >= 100)) tp.value = 50; };
      st.addEventListener('change', sync); pw.style.display = st.value === 'doing' ? '' : 'none';
    },
  });
}

async function move(t, dir) {
  const list = sorted(), i = list.findIndex((x) => x.id === t.id), j = i + dir;
  if (j < 0 || j >= list.length) return;
  const a = list[i], b = list[j];
  await store.save('tasks', { ...a, sort_order: b.sort_order }); await store.save('tasks', { ...b, sort_order: a.sort_order });
}

async function removeTask(t) {
  const refs = store.state.data.tasks.filter((x) => (x.preds || []).includes(t.code));
  if (!(await confirmDialog(`Supprimer la tâche <b>${esc(t.code)} · ${esc(t.name)}</b> ?${refs.length ? `<br><br>Elle sera retirée des prédécesseurs de ${refs.map((r) => esc(r.code)).join(', ')}.` : ''}`, { title: 'Supprimer la tâche', ok: 'Supprimer', danger: true }))) return;
  try {
    for (const r of refs) await store.save('tasks', { ...r, preds: r.preds.filter((c) => c !== t.code) });
    await store.remove('tasks', t.id); clearAnalysisCache(); toast('Tâche supprimée.', 'ok');
  } catch (e) { errorToast(e); }
}

export async function render(box) {
  const can = store.can('plan'), tasks = sorted(), err = validateTasks(tasks);
  const prog = progressOf(tasks), left = simTasks(tasks).length;
  box.innerHTML = `${readOnlyNote()}
    <div class="card"><div class="ch"><div><h3>Planning des tâches</h3><div class="sub">${tasks.length} tâche${tasks.length > 1 ? 's' : ''} · ${left} restante${left > 1 ? 's' : ''} à simuler · avancement ${nf(prog * 100, 0)} %</div></div>
      <div class="r">${err ? chip('crit', 'alert', 'Planning incohérent') : tasks.length ? chip('good', 'check', 'Planning cohérent') : ''}${can ? `<button class="btn pri" id="addt" type="button">${ic('plus', 16)}Ajouter une tâche</button>` : ''}</div></div>
      ${err ? `<div class="note crit" style="margin-bottom:12px">${ic('alert', 17)}<div>${esc(err)}</div></div>` : ''}
      ${tasks.length ? `<div class="tw"><table><thead><tr><th>Code</th><th>Tâche</th><th class="num">Min</th><th class="num">Probable</th><th class="num">Max</th><th>Après</th><th>Statut</th><th style="min-width:110px">Avancement</th>${can ? '<th></th>' : ''}</tr></thead><tbody>
      ${tasks.map((t, i) => `<tr><td><b class="mono">${esc(t.code)}</b></td><td>${esc(t.name)} ${t.exposed ? `<span title="Exposée à la pluie" style="color:var(--blue600)">${ic('rain', 14)}</span>` : ''}</td><td class="num">${nf(t.a, 1)}</td><td class="num">${nf(t.m, 1)}</td><td class="num">${nf(t.b, 1)}</td><td class="m">${esc((t.preds || []).join(', ') || '—')}</td>
        <td>${t.status === 'done' ? chip('good', 'check', 'Terminée') : t.status === 'doing' ? chip('info', 'clock', 'En cours') : chip('neutral', 'clock', 'À faire')}</td>
        <td><div style="display:flex;align-items:center;gap:8px"><div class="meter" style="flex:1;min-width:50px"><i style="width:${t.status === 'done' ? 100 : t.progress || 0}%"></i></div><span class="mono muted" style="font-size:12.5px">${t.status === 'done' ? 100 : t.progress || 0} %</span></div></td>
        ${can ? `<td><div class="hstack" style="gap:2px;justify-content:flex-end;flex-wrap:nowrap"><button class="iconbtn sm" data-up="${t.id}" aria-label="Monter" ${i === 0 ? 'disabled' : ''}>${ic('up', 14)}</button><button class="iconbtn sm" data-down="${t.id}" aria-label="Descendre" ${i === tasks.length - 1 ? 'disabled' : ''}>${ic('down', 14)}</button><button class="iconbtn sm" data-edit="${t.id}" aria-label="Modifier">${ic('edit', 15)}</button><button class="iconbtn sm" data-del="${t.id}" aria-label="Supprimer">${ic('trash', 15)}</button></div></td>` : ''}</tr>`).join('')}</tbody></table></div>`
      : `<div class="empty"><b>Aucune tâche</b>Ajoutez les tâches du gros œuvre avec leurs trois durées estimées pour lancer les simulations.</div>`}
      <div class="muted" style="font-size:12.5px;margin-top:12px">Durées en jours calendaires (la date de fin s’obtient en ajoutant ces jours à la date du jour). Une tâche « en cours » est simulée au prorata du reste à faire ; les tâches terminées sont ignorées.</div></div>`;
  const q = (s) => box.querySelector(s), byId = (id) => tasks.find((t) => t.id === id);
  const add = q('#addt'); if (add) add.onclick = () => openTaskModal();
  box.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => openTaskModal(byId(b.dataset.edit)); });
  box.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => removeTask(byId(b.dataset.del)); });
  box.querySelectorAll('[data-up]').forEach((b) => { b.onclick = () => move(byId(b.dataset.up), -1).then(clearAnalysisCache).catch(errorToast); });
  box.querySelectorAll('[data-down]').forEach((b) => { b.onclick = () => move(byId(b.dataset.down), 1).then(clearAnalysisCache).catch(errorToast); });
}
