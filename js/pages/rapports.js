/* Rapports : synthèse imprimable (PDF via « Imprimer ») et exports CSV des données du chantier. */
import { store } from '../store.js';
import { buildSummary, buildAlerts } from '../analysis.js';
import { ecdfChart } from '../charts.js';
import { alertRow } from '../shell.js';
import { ic, spinner, errorToast, toast, chip, downloadCsv, slug } from '../ui.js';
import { pageHead, verdictChip, live } from './_common.js';
import { nf, pct, signedPct, pval, money, esc, dateLong, dateShort, dateFull, isoWeek, mondayOf, isoDate, addDays, dateTimeFmt } from '../format.js';
import { settingsOf, dayToDate, hazardCosts, COST_CATEGORIES, WEATHER, ROLE_LABELS, isPending, weeklyFailureCounts } from '../model.js';

export async function render(root, ctx) {
  const st = store.state, today = store.today, p = st.project, cur = p.currency || 'FCFA', settings = settingsOf(p);
  const nameOf = (id) => st.profiles.find((x) => x.id === id)?.full_name || '';
  const act = (id) => st.data.activities.find((a) => a.id === id);
  const eq = (id) => st.data.equipment.find((e) => e.id === id);
  const fileBase = () => `${slug(p.name)}-${today}`;

  const EXPORTS = {
    productivite: ['Rendements journaliers', ['Date', 'Activité', 'Rendement', 'Unité', 'Quantité', 'Temps (h)', 'Statut', 'Saisi par', 'Remarque'],
      () => st.data.productivity_entries.slice().sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1)).map((e) => [e.entry_date, act(e.activity_id)?.name || '', Number(e.value), act(e.activity_id)?.unit || '', e.quantity ?? null, e.hours ?? null, e.excluded ? 'écartée' : isPending(e) ? 'à valider' : e.flagged ? 'atypique confirmée' : 'retenue', nameOf(e.created_by), e.note || ''])],
    pannes: ['Pannes d’engins', ['Date', 'Heure', 'Engin', 'Cause', 'Arrêt (h)', 'Marche depuis la précédente (h)', `Coût de réparation (${cur})`],
      () => st.data.failures.slice().sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1)).map((f) => [f.occurred_at.slice(0, 10), f.occurred_at.slice(11, 16), eq(f.equipment_id)?.name || '', f.cause || '', Number(f.downtime_hours), f.run_hours_since_last ?? null, Number(f.repair_cost) || 0])],
    journaliers: ['Rapports journaliers', ['Date', 'Météo', 'Pluie (mm)', 'Effectif présent', 'Effectif déclaré', 'Heures de poste', 'Heures perdues', 'Retard de livraison (h)', 'Camions reçus', 'Remarques'],
      () => st.data.daily_reports.slice().sort((a, b) => (a.report_date < b.report_date ? -1 : 1)).map((r) => [r.report_date, WEATHER[r.weather]?.label || r.weather, Number(r.rain_mm), r.workers ?? null, r.workers_declared ?? null, r.shift_hours ?? null, r.lost_hours ?? null, r.delivery_delay_hours ?? null, r.trucks_received ?? null, r.notes || ''])],
    couts: ['Surcoûts', ['Date', 'Catégorie', 'Libellé', `Montant (${cur})`, 'Tâche'],
      () => st.data.cost_events.slice().sort((a, b) => (a.event_date < b.event_date ? -1 : 1)).map((c) => [c.event_date, COST_CATEGORIES[c.category] || c.category, c.label, Number(c.amount), c.task_code || ''])],
    planning: ['Planning des tâches', ['Code', 'Tâche', 'Minimum (j)', 'Probable (j)', 'Maximum (j)', 'Prédécesseurs', 'Exposée à la pluie', 'Statut', 'Avancement (%)'],
      () => st.data.tasks.slice().sort((a, b) => a.sort_order - b.sort_order).map((t) => [t.code, t.name, Number(t.a), Number(t.m), Number(t.b), (t.preds || []).join(' '), t.exposed ? 'oui' : 'non', { todo: 'à faire', doing: 'en cours', done: 'terminée' }[t.status] || t.status, Number(t.progress) || 0])],
  };

  async function paint() {
    const [sum, alerts] = await Promise.all([buildSummary(st), buildAlerts(st)]);
    if (!root.isConnected) return;
    const mc = sum.mcr?.mc, mon = mondayOf(today), sun = addDays(mon, 6);
    const hc = hazardCosts(st.data.cost_events, st.data.failures, today);
    const weeks = weeklyFailureCounts(st.data.failures, p.start_date, today), thisWeek = weeks.length ? weeks[weeks.length - 1] : 0;
    const total = (new Date(p.target_date) - new Date(p.start_date)) / 86400000, elapsed = (new Date(today) - new Date(p.start_date)) / 86400000;
    const planned = Math.min(1, Math.max(0, total > 0 ? elapsed / total : 0)), gap = (sum.progress - planned) * 100;
    const below = sum.acts.filter((a) => a.result && a.result.verdict === 'significant_below').map((a) => a.activity.name.replace(/\s*\(.*\)/, ''));
    const pend = st.data.productivity_entries.filter(isPending).length;

    const brief = [];
    if (mc) brief.push(`La probabilité de terminer avant le <b>${esc(dateLong(p.target_date))}</b> est de <b>${pct(mc.p_target)}</b> ; avec ${nf(settings.n_sim === mc.n ? mc.n : mc.n, 0)} simulations, la date sûre à 85 % est le <b>${esc(dateLong(dayToDate(today, mc.p85)))}</b> (médiane : ${esc(dateLong(dayToDate(today, mc.p50)))}).`);
    brief.push(`L’avancement physique est de <b>${nf(sum.progress * 100, 0)} %</b> pour ${nf(planned * 100, 0)} % du temps écoulé (${gap >= 0 ? '+' : ''}${nf(gap, 1)} point${Math.abs(gap) >= 2 ? 's' : ''}).`);
    brief.push(below.length ? `Productivité significativement <b>sous la prévision</b> : ${esc(below.join(', '))}.` : 'Aucune activité n’est significativement sous la prévision.');
    brief.push(`${thisWeek} panne${thisWeek > 1 ? 's' : ''} cette semaine${sum.rel && !sum.rel.error ? ` (λ = ${nf(sum.rel.result.lambda, 1)} par semaine, MTBF ${nf(sum.rel.result.mtbf, 0)} h)` : ''} ; surcoût cumulé des aléas : <b>${esc(money(hc.total, cur, true))}</b>.`);
    if (pend) brief.push(`${pend} valeur${pend > 1 ? 's' : ''} atypique${pend > 1 ? 's' : ''} attend${pend > 1 ? 'ent' : ''} validation.`);

    const rel = sum.rel && !sum.rel.error ? sum.rel : null;
    root.innerHTML = pageHead('Rapports', 'Synthèse de pilotage imprimable et exports de données',
      `<button class="btn pri" id="print" type="button">${ic('printer', 16)}Imprimer / enregistrer en PDF</button>`) +
      `<div class="grid g12 no-print" style="align-items:start"><div class="c12"><div class="card"><div class="ch"><div><h3>Exporter les données (CSV)</h3><div class="sub">Fichiers lisibles dans Excel (séparateur « ; », accents conservés).</div></div></div>
        <div class="pillrow">${Object.entries(EXPORTS).map(([k, [label, , rows]]) => `<button type="button" class="pill" data-csv="${k}">${ic('download', 15)}${esc(label)} <span class="muted">(${rows().length})</span></button>`).join('')}</div></div></div></div>
      <article class="card report" id="report" style="display:flex;flex-direction:column;gap:22px;padding:28px 30px">
        <header style="display:flex;justify-content:space-between;gap:16px;align-items:flex-start;flex-wrap:wrap;border-bottom:2px solid var(--ink);padding-bottom:14px"><div><div class="muted" style="font-size:12.5px;letter-spacing:.06em;text-transform:uppercase;font-weight:600">Rapport de pilotage · semaine ${isoWeek(today)}</div><h2 style="font-size:26px;font-weight:650;letter-spacing:-.02em;margin-top:2px">${esc(p.name)}</h2><div class="ink2">${esc(p.location || '')} · du ${esc(dateShort(mon))} au ${esc(dateShort(sun))} · édité le ${esc(dateFull(today))}</div></div>
          <div style="text-align:right;font-size:12.5px" class="ink2">Échéance : <b style="color:var(--ink)">${esc(dateFull(p.target_date))}</b><br>Édité par ${esc(st.profile?.full_name || '')}<br>${esc(ROLE_LABELS[st.profile?.role] || '')}</div></header>
        <section><h3 style="font-size:16px;margin-bottom:8px">En bref</h3><ul style="margin-left:20px;display:flex;flex-direction:column;gap:5px">${brief.map((b) => `<li>${b}</li>`).join('')}</ul></section>
        ${mc ? `<section style="break-inside:avoid"><h3 style="font-size:16px;margin-bottom:8px">Tenir l’échéance</h3><div class="grid rg" style="grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:22px;align-items:center"><div class="chartbox">${ecdfChart(mc, { today, targetDay: sum.targetDay, marks: false, w: 620, h: 300 })}</div>
          <table><tbody>${[['Probabilité de tenir l’échéance', pct(mc.p_target)], ['Date médiane (P50)', dateLong(dayToDate(today, mc.p50))], ['Date sûre à 85 % (P85)', dateLong(dayToDate(today, mc.p85))], ['Date sûre à 95 % (P95)', dateLong(dayToDate(today, mc.p95))], ['Écart-type du délai', `${nf(mc.sd, 1)} jours`], ['Simulations', nf(mc.n, 0)]].map(([a, b]) => `<tr><td class="ink2">${a}</td><td class="num"><b>${esc(b)}</b></td></tr>`).join('')}</tbody></table></div></section>` : ''}
        <section style="break-inside:avoid"><h3 style="font-size:16px;margin-bottom:8px">Productivité : écart à la prévision (test de Student, ${settings.window_days} derniers jours)</h3>
          <div class="tw"><table><thead><tr><th>Activité</th><th class="num">Relevés</th><th class="num">Moyenne</th><th class="num">Prévu</th><th class="num">Écart</th><th class="num">p</th><th>Conclusion</th></tr></thead><tbody>${sum.acts.map((x) => { const r = x.result; return `<tr><td>${esc(x.activity.name)}</td><td class="num">${x.entries.length}</td><td class="num">${r ? `${nf(r.mean, 1)} ${esc(x.activity.unit)}` : '—'}</td><td class="num">${nf(x.activity.planned_rate, 1)}</td><td class="num">${r ? signedPct(r.gap) : '—'}</td><td class="num">${r ? pval(r.p) : '—'}</td><td>${r ? verdictChip(r.verdict) : chip('neutral', 'info', 'Relevés insuffisants')}</td></tr>`; }).join('')}</tbody></table></div></section>
        <section style="break-inside:avoid"><h3 style="font-size:16px;margin-bottom:8px">Fiabilité des engins</h3>
          ${rel ? `<div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">${[['Pannes cette semaine', nf(thisWeek, 0)], ['Taux λ', `${nf(rel.result.lambda, 2)} / sem.`], ['MTBF', `${nf(rel.result.mtbf, 0)} h`], ['Disponibilité', pct(rel.result.availability, 1)]].map(([a, b]) => `<div style="border:1px solid var(--border);border-radius:10px;padding:10px 12px"><div class="lbl">${a}</div><div class="big" style="font-size:20px">${esc(b)}</div></div>`).join('')}</div>` : '<div class="muted">Historique de pannes insuffisant.</div>'}</section>
        <section style="break-inside:avoid"><h3 style="font-size:16px;margin-bottom:8px">Aléas et surcoûts</h3>
          <table><thead><tr><th>Catégorie</th><th class="num">Montant cumulé</th><th class="num">Part</th></tr></thead><tbody>${Object.entries(hc.byCat).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<tr><td>${esc(COST_CATEGORIES[k] || k)}</td><td class="num">${esc(money(v, cur))}</td><td class="num">${nf(v / (hc.total || 1) * 100, 0)} %</td></tr>`).join('') || '<tr><td colspan="3" class="muted">Aucun surcoût enregistré.</td></tr>'}
          <tr><td><b>Total</b></td><td class="num"><b>${esc(money(hc.total, cur))}</b></td><td class="num"></td></tr></tbody></table></section>
        <section style="break-inside:avoid"><h3 style="font-size:16px;margin-bottom:8px">Alertes et recommandations</h3><div class="stack" style="gap:0">${alerts.filter((a) => a.kind !== 'info' || a.icon !== 'refresh').slice(0, 8).map((a) => `<div style="padding:10px 0;border-top:1px solid var(--grid)">${alertRow(a)}</div>`).join('') || '<div class="muted">Aucune alerte.</div>'}</div></section>
        <footer class="muted" style="font-size:11.5px;border-top:1px solid var(--grid);padding-top:10px">Rapport généré par ChantierPulse · données au ${esc(dateFull(today))}. Les probabilités proviennent de simulations de Monte Carlo sur le planning restant (lois Beta-PERT, pannes de Poisson, pluie) ; ce sont des estimations, pas des garanties.</footer>
      </article>`;
    root.querySelector('#print').onclick = () => window.print();
    root.querySelectorAll('[data-csv]').forEach((b) => { b.onclick = () => { const [label, header, rows] = EXPORTS[b.dataset.csv]; downloadCsv(`${fileBase()}-${b.dataset.csv}.csv`, header, rows()); toast(`« ${label} » exporté.`, 'ok'); }; });
    const rg = root.querySelector('.rg'); if (rg && window.matchMedia('(max-width:860px)').matches) rg.style.gridTemplateColumns = 'minmax(0,1fr)';
  }
  root.innerHTML = spinner('Préparation du rapport…');
  await paint();
  live(ctx, () => paint().catch(errorToast), 400);
}
