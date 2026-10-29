/* Tableau de bord : probabilité de tenir l'échéance, indicateurs clés, tâches critiques, alertes. */
import { buildSummary, buildAlerts, clearAnalysisCache } from '../analysis.js';
import { ecdfChart, spark } from '../charts.js';
import { alertRow } from '../shell.js';
import { ic, spinner, toast, errorToast } from '../ui.js';
import { pageHead, kpi, delta, live, sourceTag } from './_common.js';
import { nf, pct, signedPct, money, dateWeekday, dateLong, dateShort, isoWeek, esc, timeFmt } from '../format.js';
import { dayToDate, estimateBreakdownRate, hazardCosts, weeklyFailureCounts, progressOf, ROLE_LABELS, COST_CATEGORIES } from '../model.js';
import { store } from '../store.js';
import { go } from '../router.js';

export async function render(root, ctx) {
  async function paint() {
    const st = store.state, today = store.today, p = st.project;
    if (!p) return;
    const [sum, alerts] = await Promise.all([buildSummary(st), buildAlerts(st)]);
    if (!root.isConnected) return;
    const mc = sum.mcr?.mc, cur = p.currency || 'FCFA';
    const days = sum.targetDay;
    const nTasks = st.data.tasks.filter((t) => t.status !== 'done').length;

    /* ── carte principale ── */
    let hero;
    if (!mc) {
      hero = `<div class="card"><div class="empty"><b>${sum.mcr?.error ? 'Simulation impossible' : 'Aucune tâche restante à simuler'}</b>${esc(sum.mcr?.error || 'Ajoutez les tâches restantes de votre planning pour obtenir la probabilité de tenir l’échéance.')}<br><br><a class="btn pri" href="#/parametres/planning">${ic('layers', 16)}Ouvrir le planning</a></div></div>`;
    } else {
      const pt = mc.p_target;
      hero = `<div class="card"><div class="grid" style="grid-template-columns:minmax(220px,300px) minmax(0,1fr) minmax(190px,230px);gap:28px;align-items:center" id="herogrid">
        <div class="stack" style="gap:10px"><div class="hstack" style="color:var(--ink2)">${ic('calendar', 18)}<span>Fin du gros œuvre avant le ${esc(dateLong(p.target_date))}</span></div>
          <div class="hero">${nf(pt * 100, 0)}<small>&nbsp;%</small></div>
          <div class="ink2" style="font-size:14px">de chance de tenir l’échéance, d’après ${nf(mc.n, 0)} simulations de Monte Carlo sur les ${nTasks} tâche${nTasks > 1 ? 's' : ''} restante${nTasks > 1 ? 's' : ''}.</div>
          <div><span class="chip info">${ic('refresh', 14)}Mis à jour à ${timeFmt(Date.now())}</span> ${sourceTag(sum.mcr.source)}</div></div>
        <div class="chartbox">${ecdfChart(mc, { today, targetDay: days, marks: false, w: 700, h: 270 })}</div>
        <div class="stack" style="gap:6px"><div class="ink2" style="font-size:13.5px">Date de fin selon le niveau de confiance</div>
          ${[['P50', mc.p50], ['P85', mc.p85], ['P95', mc.p95]].map(([k, v]) => `<div style="display:flex;align-items:baseline;gap:10px;border-top:1px solid var(--grid);padding:9px 0"><span class="tag">${k}</span><b style="font-size:19px;font-weight:640">${esc(dateShort(dayToDate(today, v)))}</b><span class="ink2 mono" style="margin-left:auto;font-size:12.5px">J+${Math.ceil(v)}</span></div>`).join('')}
          <div style="border-top:1px solid var(--grid);padding-top:10px;font-size:13px" class="ink2">Écart-type du délai : <b style="color:var(--ink)">${nf(mc.sd, 1)} j</b></div></div>
      </div></div>`;
    }

    /* ── indicateurs ── */
    const prog = sum.progress;
    const total = (new Date(p.target_date) - new Date(p.start_date)) / 86400000, elapsed = (new Date(today) - new Date(p.start_date)) / 86400000;
    const planned = Math.min(1, Math.max(0, total > 0 ? elapsed / total : 0)), gapPts = (prog - planned) * 100;
    const k1 = kpi({ label: 'Avancement physique', icon: 'gauge', value: nf(prog * 100, 0), unit: '%', right: `<div class="meter" style="flex:1 1 90px"><i style="width:${prog * 100}%"></i></div>`,
      delta: delta(gapPts >= -1 ? 'ok' : 'bad', gapPts >= 0 ? 'up' : 'down', `${gapPts > 0 ? '+' : ''}${nf(gapPts, 1)} pts vs calendrier`), foot: 'Cumul pondéré par les durées des tâches' });

    const watch = sum.acts.filter((a) => a.result).sort((a, b) => a.result.p - b.result.p)[0];
    let k2;
    if (watch) {
      const r = watch.result, u = watch.activity.unit, bad = r.verdict === 'significant_below';
      k2 = kpi({ label: `Productivité · ${esc(watch.activity.name.replace(/\s*\(.*\)/, ''))}`, icon: 'activity', value: nf(r.mean, 1), unit: u, right: `<div class="sp">${spark(watch.entries.map((e) => Number(e.value)))}</div>`,
        delta: delta(r.significant ? (bad ? 'bad' : 'ok') : 'flat', r.gap < 0 ? 'down' : 'up', `${signedPct(r.gap)} vs prévu (${nf(r.mu0, 1)})`), foot: `σ = ${nf(r.sd, 1)} · CV = ${nf(r.cv * 100, 0)} % · ${r.n} relevés` });
    } else k2 = kpi({ label: 'Productivité', icon: 'activity', value: '—', foot: 'Pas encore assez de relevés (2 minimum)', delta: '' });

    const rel = sum.rel, weeks = weeklyFailureCounts(st.data.failures, p.start_date, today);
    const thisWeek = weeks.length ? weeks[weeks.length - 1] : 0;
    const k3 = kpi({ label: 'Pannes cette semaine', icon: 'wrench', value: nf(thisWeek, 0), unit: thisWeek > 1 ? 'pannes' : 'panne', right: `<div class="sp">${spark(weeks.slice(-12), { bars: true })}</div>`,
      delta: '', foot: rel && !rel.error ? `<span style="color:var(--ink);font-weight:520">λ = ${nf(rel.result.lambda, 1)} /sem · MTBF ${nf(rel.result.mtbf, 0)} h</span><br>12 dernières semaines · loi de Poisson` : 'Historique insuffisant' });

    const hc = hazardCosts(st.data.cost_events, st.data.failures, today), tot = hc.total || 1;
    const share = ['intemperies', 'pannes', 'livraisons'].filter((k) => hc.byCat[k]).map((k) => `${COST_CATEGORIES[k].split(' ')[0]} ${nf((hc.byCat[k] || 0) / tot * 100, 0)} %`).join(' · ');
    const k4 = kpi({ label: 'Surcoût lié aux aléas', icon: 'rain', value: nf(hc.total / 1e6, 2), unit: `M ${cur}`, right: `<div class="sp">${spark(hc.series.map((s) => s.cum))}</div>`,
      delta: hc.week ? delta('bad', 'up', `+${nf(hc.week / 1e6, 2)} M cette semaine`) : delta('flat', 'check', 'Aucun cette semaine'), foot: share || 'Aucun aléa enregistré' });

    /* ── tâches critiques ── */
    const tasks = mc ? [...mc.tasks].sort((a, b) => b.criticality - a.criticality).slice(0, 8) : [];
    const crit = `<div class="card"><div class="ch"><div><h3>Tâches les plus susceptibles de retarder le chantier</h3><div class="sub">Indice de criticité : part des simulations où la tâche est sur le chemin critique</div></div><div class="r"><span class="tag">durée moy. ± σ</span></div></div>
      ${tasks.length ? `<div class="stack" style="gap:9px">${tasks.map((t) => `<div style="display:grid;grid-template-columns:minmax(120px,210px) 1fr 52px 92px;gap:12px;align-items:center;font-size:13.5px"><span style="text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(t.name)}">${esc(t.name)}</span>
        <div class="meter" style="height:20px;border-radius:5px;background:var(--blue100)"><i style="width:${t.criticality * 100}%;border-radius:5px;background:${t.criticality > 0.9 ? 'var(--blue)' : 'var(--blue250)'}"></i></div><b class="mono" style="text-align:right">${nf(t.criticality * 100, 0)} %</b><span class="ink2 mono" style="text-align:right">${nf(t.mean, 1)} j ± ${nf(t.sd, 1)}</span></div>`).join('')}</div>` : '<div class="empty">Aucune donnée.</div>'}</div>`;

    const news = alerts.filter((a) => a.kind !== 'info').length;
    const al = `<div class="card"><div class="ch"><div><h3>Alertes et recommandations</h3><div class="sub">Générées par les contrôles statistiques</div></div><div class="r"><span class="tag">${news} nouvelle${news > 1 ? 's' : ''}</span></div></div>
      <div class="stack" style="gap:0">${alerts.slice(0, 5).map((a) => `<div style="padding:12px 0;border-top:1px solid var(--grid)">${alertRow(a)}</div>`).join('') || '<div class="empty">Aucune alerte.</div>'}</div></div>`;

    root.innerHTML = pageHead('Tableau de bord', `${esc(dateWeekday(today))} · Semaine ${isoWeek(today)} · ${esc(p.location || p.name)}`,
      `<a class="btn" href="#/rapports">${ic('download', 16)}Exporter le rapport</a><button class="btn pri" id="relaunch">${ic('play', 16)}Relancer la simulation</button>`) +
      `<div class="page-grid" style="display:flex;flex-direction:column;gap:20px">${hero}
      <div class="grid g12">${[k1, k2, k3, k4].map((k) => `<div class="c3">${k}</div>`).join('')}</div>
      <div class="grid g12"><div class="c8">${crit}</div><div class="c4">${al}</div></div></div>`;
    const hg = root.querySelector('#herogrid');
    if (hg && window.matchMedia('(max-width:1180px)').matches) hg.style.gridTemplateColumns = 'minmax(0,1fr)';
    root.querySelector('#relaunch').onclick = async (e) => {
      e.currentTarget.disabled = true; clearAnalysisCache();
      try { await store.refresh(); toast('Simulation recalculée avec les dernières données.', 'ok'); } catch (err) { errorToast(err); }
    };
  }
  root.innerHTML = spinner('Calcul des indicateurs…');
  await paint();
  live(ctx, () => paint().catch(errorToast), 200);
}
