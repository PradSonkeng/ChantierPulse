/* Fiabilité des engins : pannes par semaine (loi de Poisson), temps entre pannes (loi exponentielle), MTBF. */
import { store } from '../store.js';
import { analyzeReliability } from '../analysis.js';
import { poissonChart, expChart } from '../charts.js';
import { ic, spinner, toast, errorToast, chip, confirmDialog } from '../ui.js';
import { pageHead, kpi, selectBox, sourceTag, live } from './_common.js';
import { nf, pct, pval, esc, dateShort, money } from '../format.js';
import { settingsOf, estimateBreakdownRate, meanRepairHours, weeklyFailureCounts } from '../model.js';
import { openFailureModal } from './failure-modal.js';

const RANGES = [[12, '12 dernières semaines'], [26, '26 dernières semaines'], [0, 'Tout l’historique']];

export async function render(root, ctx) {
  const st = store.state, today = store.today;
  let sel = ctx.query.e || '', weeks = ctx.query.w !== undefined ? Number(ctx.query.w) : 26, token = 0;
  const cur = st.project.currency;

  async function paint() {
    const my = ++token, eqs = st.data.equipment;
    if (!eqs.length) {
      root.innerHTML = pageHead('Fiabilité des engins', 'Pannes, MTBF et disponibilité') + `<div class="card"><div class="empty"><b>Aucun engin déclaré</b>Ajoutez les engins du chantier (grue, bétonnière, groupe électrogène…) pour suivre leurs pannes.<br><br>${store.can('plan') ? `<a class="btn pri" href="#/parametres/engins">${ic('plus', 16)}Ajouter des engins</a>` : 'Demandez au conducteur de travaux de les déclarer (Paramètres › Engins).'}</div></div>`;
      return;
    }
    if (sel && !eqs.some((e) => e.id === sel)) sel = '';
    const lastWeeks = weeks || null;
    const [fleet, ...per] = await Promise.all([analyzeReliability(st, { lastWeeks }), ...eqs.map((e) => analyzeReliability(st, { equipmentId: e.id, lastWeeks }))]);
    if (my !== token || !root.isConnected) return;
    const rel = sel ? per[eqs.findIndex((e) => e.id === sel)] : fleet;
    const eq = eqs.find((e) => e.id === sel) || null;
    const label = eq ? eq.name : 'Parc complet';

    /* ── cartes engins ── */
    const cardOf = (e, r) => {
      const ok = r && !r.error, n = r?.weekly ? r.weekly.reduce((a, b) => a + b, 0) : 0, risky = ok && (r.result.lambda >= 1 || (r.result.mtbf && r.result.mtbf < 40));
      return `<button type="button" class="card eqcard${(e?.id || '') === sel ? ' on' : ''}" data-eq="${e?.id || ''}" aria-pressed="${(e?.id || '') === sel}">
        <div class="hstack" style="justify-content:space-between;gap:6px"><b style="font-size:14px;font-weight:620;text-align:left;min-width:0">${esc(e ? e.name : 'Parc complet')}</b>${ok ? (risky ? chip('warn', 'alert', 'À surveiller') : chip('good', 'check', 'Stable')) : chip('neutral', 'info', 'Peu de données')}</div>
        <div class="muted" style="font-size:12.5px;text-align:left">${esc(e ? e.kind || 'Engin' : `${eqs.length} engins`)}</div>
        <div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:8px;text-align:left"><div><div class="muted" style="font-size:11.5px">MTBF</div><b class="mono">${ok && r.result.mtbf ? `${nf(r.result.mtbf, 0)} h` : '—'}</b></div><div><div class="muted" style="font-size:11.5px">Dispo.</div><b class="mono">${ok && r.result.availability ? pct(r.result.availability, 1) : '—'}</b></div><div><div class="muted" style="font-size:11.5px">Pannes</div><b class="mono">${n}</b></div></div></button>`;
    };
    const cards = `<div class="eqrow">${cardOf(null, fleet)}${eqs.map((e, i) => cardOf(e, per[i])).join('')}</div>`;

    /* ── analyse de la sélection ── */
    let body = '';
    if (rel.error) {
      body = `<div class="card"><div class="empty"><b>Analyse impossible pour « ${esc(label)} »</b>${esc(rel.error)}<br>Elle apparaîtra dès que l’historique couvrira assez de semaines.</div></div>`;
    } else {
      const r = rel.result, po = r.poisson, nFail = rel.weekly.reduce((a, b) => a + b, 0), repair = meanRepairHours(rel.failures, eq ? [eq] : eqs);
      const fit = po.p_gof === null ? null : po.p_gof >= 0.05;
      const k = [
        kpi({ label: 'Taux de pannes λ', icon: 'wrench', value: nf(r.lambda, 2), unit: 'par semaine', foot: `${nFail} pannes sur ${r.weeks} semaines`, delta: '' }),
        kpi({ label: 'MTBF', icon: 'clock', value: r.mtbf ? nf(r.mtbf, 0) : '—', unit: 'h', foot: r.mtbf ? 'Heures de marche moyennes entre deux pannes' : 'Renseignez les heures de marche des pannes', delta: '' }),
        kpi({ label: 'Réparation moyenne (MTTR)', icon: 'refresh', value: nf(repair, 1), unit: 'h', foot: 'Durée moyenne d’arrêt par panne', delta: '' }),
        kpi({ label: 'Disponibilité', icon: 'gauge', value: r.availability ? nf(r.availability * 100, 1) : '—', unit: '%', right: r.availability ? `<div class="meter" style="flex:1 1 80px"><i style="width:${r.availability * 100}%"></i></div>` : '', foot: 'MTBF / (MTBF + MTTR)', delta: '' }),
      ];
      const pc = r.probs;
      const probs = `<div class="card"><div class="ch"><div><h3>Probabilités utiles</h3><div class="sub">Déduites des deux lois, pour ${esc(label.toLowerCase() === 'parc complet' ? 'le parc' : label)}</div></div></div>
        <div class="stack" style="gap:0">${[
          ['Aucune panne la semaine prochaine', pc.p0_next_week, 'e^(−λ)'],
          ['Trois pannes ou plus la semaine prochaine', pc.p_ge3_next_week, 'loi de Poisson'],
          ['Une machine tient 40 h sans panne', pc.r_40h, 'e^(−t/MTBF)'],
          ['Une machine tient 100 h sans panne', pc.r_100h, 'e^(−t/MTBF)'],
        ].map(([t, v, f]) => `<div class="li"><div><div>${t}</div><div class="muted eq" style="font-size:12.5px">${f}</div></div><b style="font-size:20px" class="mono">${v === null || v === undefined ? '—' : pct(v, 0)}</b></div>`).join('')}</div></div>`;
      const worst = per.map((p, i) => ({ e: eqs[i], p })).filter((x) => !x.p.error && x.p.result.mtbf).sort((a, b) => a.p.result.mtbf - b.p.result.mtbf)[0];
      const advice = [];
      if (fit === false) advice.push(['warn', 'alert', `Les pannes ne suivent pas bien une loi de Poisson (χ², p = ${pval(po.p_gof)}) : elles arrivent plutôt par séries, souvent à cause d’une cause commune (même pièce, même conducteur, même chantier). Le taux moyen reste indicatif.`]);
      else if (fit === true) advice.push(['good', 'check', `Les pannes suivent bien une loi de Poisson (χ², p = ${pval(po.p_gof)}) : le taux λ est un bon résumé et la simulation de Monte Carlo peut l’utiliser.`]);
      if (r.lambda >= 1) advice.push(['warn', 'alert', `En moyenne ${nf(r.lambda, 1)} panne${r.lambda >= 2 ? 's' : ''} par semaine : le parc perd régulièrement du temps. Une maintenance préventive est justifiée.`]);
      if (worst && !eq) advice.push(['info', 'wrench', `Priorité maintenance : ${worst.e.name} (MTBF ${nf(worst.p.result.mtbf, 0)} h, disponibilité ${pct(worst.p.result.availability, 0)}).`]);
      if (rel.weekly.length < 8) advice.push(['info', 'info', `Seulement ${rel.weekly.length} semaines d’historique : visez au moins 8 semaines pour des conclusions fiables.`]);
      const reco = `<div class="card"><div class="ch"><div><h3>Recommandations</h3></div></div><div class="stack" style="gap:8px">${advice.map(([kd, i, t]) => `<div class="note ${kd}">${ic(i, 17)}<div>${esc(t)}</div></div>`).join('') || '<div class="muted">Rien à signaler.</div>'}</div>
        ${store.can('plan') ? `<div style="margin-top:14px"><button class="btn sm" id="feed" type="button">${ic('dice', 15)}Utiliser ces taux dans la simulation</button><div class="muted" style="font-size:12.5px;margin-top:6px">Met à jour le taux de pannes et la durée de réparation du modèle de Monte Carlo.</div></div>` : ''}</div>`;
      body = `<div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:16px" id="kg">${k.map((x) => `<div>${x}</div>`).join('')}</div>
        <div class="grid g12" style="align-items:start"><div class="c6"><div class="card"><div class="ch"><div><h3>Pannes par semaine</h3><div class="sub">Barres : semaines observées · courbe : loi de Poisson (λ = ${nf(r.lambda, 2)})</div></div><div class="r">${sourceTag(rel.source)}</div></div><div class="chartbox">${poissonChart(po, { w: 560, h: 330 })}</div>
          <div class="muted" style="font-size:12.5px;margin-top:6px">Ajustement : χ² = ${nf(po.chi2, 2)} · ${po.dof} degré${po.dof > 1 ? 's' : ''} de liberté · p = ${pval(po.p_gof)}</div></div></div>
        <div class="c6"><div class="card"><div class="ch"><div><h3>Temps entre pannes</h3><div class="sub">Heures de marche entre deux pannes · loi exponentielle</div></div></div>
          ${r.exp ? `<div class="chartbox">${expChart(r.exp, r.mtbf, { w: 560, h: 330 })}</div><div class="muted" style="font-size:12.5px;margin-top:6px">${r.exp.n} intervalles · MTBF = ${nf(r.mtbf, 1)} h</div>` : `<div class="empty">Il faut au moins 3 pannes avec les heures de marche renseignées pour tracer cette courbe.</div>`}</div></div></div>
        <div class="grid g12" style="align-items:start"><div class="c5">${probs}</div><div class="c7">${reco}</div></div>`;
    }

    /* ── journal ── */
    const log = rel.failures.slice().sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : -1)).slice(0, 12);
    const eqName = (id) => eqs.find((e) => e.id === id)?.name || 'Engin';
    const journal = `<div class="card"><div class="ch"><div><h3>Journal des pannes</h3><div class="sub">${esc(label)} · ${log.length} dernière${log.length > 1 ? 's' : ''}</div></div></div>
      <div class="tw"><table><thead><tr><th>Date</th><th>Engin</th><th>Cause</th><th class="num">Arrêt</th><th class="num">Marche depuis la précédente</th><th class="num">Coût</th><th></th></tr></thead><tbody>
      ${log.map((f) => `<tr><td>${esc(dateShort(f.occurred_at.slice(0, 10)))} <span class="muted">${esc(f.occurred_at.slice(11, 16))}</span></td><td>${esc(eqName(f.equipment_id))}</td><td>${esc(f.cause || '—')}</td><td class="num">${nf(f.downtime_hours * 60, 0)} min</td><td class="num">${f.run_hours_since_last === null || f.run_hours_since_last === undefined ? '—' : `${nf(f.run_hours_since_last, 0)} h`}</td><td class="num">${Number(f.repair_cost) > 0 ? esc(money(f.repair_cost, cur)) : '—'}</td>
        <td><div class="hstack" style="gap:2px;justify-content:flex-end;flex-wrap:nowrap">${store.canEditRow(f) ? `<button class="iconbtn sm" data-edit="${f.id}" aria-label="Modifier">${ic('edit', 15)}</button><button class="iconbtn sm" data-del="${f.id}" aria-label="Supprimer">${ic('trash', 15)}</button>` : ''}</div></td></tr>`).join('') || '<tr><td colspan="7" class="muted">Aucune panne enregistrée.</td></tr>'}</tbody></table></div></div>`;

    root.innerHTML = pageHead('Fiabilité des engins', 'Combien de pannes attendre, et avec quelle probabilité ?',
      `${selectBox('wsel', 'calendar', RANGES, weeks)}<button class="btn pri" id="addfail" type="button">${ic('plus', 16)}Déclarer une panne</button>`) +
      `<div style="display:flex;flex-direction:column;gap:20px">${cards}${body}${journal}</div>`;
    const kg = root.querySelector('#kg'); if (kg && window.matchMedia('(max-width:1180px)').matches) kg.style.gridTemplateColumns = window.matchMedia('(max-width:860px)').matches ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))';
    root.querySelectorAll('[data-eq]').forEach((b) => { b.onclick = () => { sel = b.dataset.eq; paint().catch(errorToast); }; });
    root.querySelector('#wsel').onchange = (e) => { weeks = Number(e.target.value); paint().catch(errorToast); };
    root.querySelector('#addfail').onclick = () => openFailureModal({ date: today, equipmentId: sel || null });
    root.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => openFailureModal({ failure: st.data.failures.find((f) => f.id === b.dataset.edit) }); });
    root.querySelectorAll('[data-del]').forEach((b) => { b.onclick = async () => { if (await confirmDialog('Supprimer cette panne ? Cette action est définitive.', { title: 'Supprimer', ok: 'Supprimer', danger: true })) store.remove('failures', b.dataset.del).then(() => toast('Panne supprimée.', 'ok')).catch(errorToast); }; });
    const feed = root.querySelector('#feed');
    if (feed) feed.onclick = async () => {
      const lam = estimateBreakdownRate(st.data.failures, st.data.equipment, st.project.start_date, today);
      if (lam === null) { toast('Historique insuffisant pour estimer le taux de pannes (2 semaines minimum).', 'err'); return; }
      const mttr = meanRepairHours(st.data.failures, st.data.equipment) / 8;
      const cur0 = settingsOf(st.project).breakdowns;
      if (!(await confirmDialog(`Le taux de pannes passera de <b>${nf(cur0.lambda_per_day, 3)}</b> à <b>${nf(lam, 3)}</b> par jour et par tâche, et la réparation de <b>${nf(cur0.mttr_days, 2)}</b> à <b>${nf(mttr, 2)}</b> jour. Confirmer ?`, { title: 'Mettre à jour la simulation', ok: 'Mettre à jour' }))) return;
      try { await store.setSettings({ breakdowns: { on: true, lambda_per_day: Math.round(lam * 1000) / 1000, mttr_days: Math.round(mttr * 100) / 100 } }); toast('Modèle de simulation mis à jour.', 'ok'); } catch (e) { errorToast(e); }
    };
  }
  root.innerHTML = spinner('Analyse des pannes…');
  await paint();
  live(ctx, () => paint().catch(errorToast), 250);
}
