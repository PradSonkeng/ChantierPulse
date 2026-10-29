/* Analyses partagées par plusieurs pages (tableau de bord, cloche d'alertes, rapports). */
import { compute } from './engine.js';
import {
  settingsOf, mcInput, windowEntries, isPending, weeklyFailureCounts, failureGaps, meanRepairHours, failuresThisWeek,
  progressOf, dayToDate, targetDay, HAZARD_CATEGORIES,
} from './model.js';
import { nf, pct, signedPct, pval, dateShort, dateLong, addDays, isoDate, mondayOf } from './format.js';

const memo = new Map();
/** Calcul mémorisé : même requête = même résultat (les calculs sont déterministes quand une graine est fournie). */
export function cached(name, payload) {
  const key = `${name}:${JSON.stringify(payload)}`;
  if (memo.has(key)) return memo.get(key);
  const p = compute(name, payload).catch((e) => { memo.delete(key); throw e; });
  memo.set(key, p);
  if (memo.size > 60) memo.delete(memo.keys().next().value);
  return p;
}
export const clearAnalysisCache = () => memo.clear();

export const MC_SEED = 2026;

export async function runMonteCarlo(st, opts = {}) {
  const input = mcInput(st.project, st.data.tasks, st.today, { seed: MC_SEED, ...opts });
  if (!input.tasks.length) return null;
  const { result, source } = await cached('montecarlo', input);
  return { mc: result, source, input };
}

/** Test de Student de chaque activité sur la fenêtre choisie. */
export async function analyzeActivities(st, { windowDays = null, alpha = null } = {}) {
  const s = settingsOf(st.project);
  const wd = windowDays === null ? s.window_days : windowDays, al = alpha ?? s.alpha;
  const out = [];
  for (const act of st.data.activities) {
    const entries = windowEntries(st.data.productivity_entries, act.id, st.today, wd);
    const row = { activity: act, entries, result: null, source: null, error: null };
    if (entries.length >= 2) {
      try {
        const r = await cached('student', { values: entries.map((e) => Number(e.value)), mu0: Number(act.planned_rate), alpha: al });
        row.result = r.result; row.source = r.source;
      } catch (e) { row.error = e.message; }
    }
    out.push(row);
  }
  return out;
}

/** Fiabilité du parc (equipmentId = null) ou d'un engin. */
export async function analyzeReliability(st, { equipmentId = null, lastWeeks = null } = {}) {
  const fl = equipmentId ? st.data.failures.filter((f) => f.equipment_id === equipmentId) : st.data.failures;
  const eqs = equipmentId ? st.data.equipment.filter((e) => e.id === equipmentId) : st.data.equipment;
  const weekly = weeklyFailureCounts(fl, st.project.start_date, st.today, lastWeeks);
  const hours = eqs.length ? eqs.reduce((a, e) => a + Number(e.hours_per_week), 0) / eqs.length : 40;
  const body = { weekly_counts: weekly, gaps_hours: failureGaps(fl), mttr_hours: meanRepairHours(fl, eqs), run_hours_per_week: hours };
  if (weekly.length < 4) return { error: 'Au moins 4 semaines d’historique sont nécessaires.', failures: fl, weekly };
  try { const r = await cached('reliability', body); return { ...r, failures: fl, weekly, body }; }
  catch (e) { return { error: e.message, failures: fl, weekly }; }
}

/** Alertes et recommandations générées par les contrôles statistiques. */
export async function buildAlerts(st) {
  const alerts = [], today = st.today, cur = st.project?.currency || 'FCFA';
  if (!st.project) return alerts;
  const acts = await analyzeActivities(st);
  for (const a of acts) {
    const r = a.result;
    if (r && r.significant) {
      alerts.push({
        kind: r.verdict === 'significant_below' ? 'crit' : 'info', icon: r.verdict === 'significant_below' ? 'alert' : 'up',
        title: r.verdict === 'significant_below' ? 'Écart de productivité significatif' : 'Productivité supérieure à la prévision',
        text: `${a.activity.name} : ${signedPct(r.gap)} par rapport au prévu (test de Student, p = ${pval(r.p)}).`, when: 'calculé à l’instant', href: '#/ecarts',
      });
    }
  }
  for (const e of st.data.productivity_entries.filter(isPending)) {
    const act = st.data.activities.find((x) => x.id === e.activity_id);
    alerts.push({ kind: 'warn', icon: 'alert', title: 'Valeur atypique à valider', text: `${act?.name || 'Activité'} : ${nf(e.value, 1)} ${act?.unit || ''} saisi le ${dateShort(e.entry_date)}, hors de l’intervalle de confiance à 95 %.`, when: dateShort(e.entry_date), href: '#/saisie' });
  }
  const byEq = {};
  for (const f of failuresThisWeek(st.data.failures, today)) byEq[f.equipment_id] = (byEq[f.equipment_id] || 0) + 1;
  for (const [id, n] of Object.entries(byEq)) {
    if (n >= 2) alerts.push({ kind: 'warn', icon: 'wrench', title: 'Pannes répétées', text: `${st.data.equipment.find((q) => q.id === id)?.name || 'Engin'} : ${n} pannes cette semaine. Prévoyez une maintenance préventive.`, when: 'cette semaine', href: '#/fiabilite' });
  }
  const from = isoDate(addDays(today, -7));
  const rainy = st.data.daily_reports.filter((r) => r.report_date >= from && (r.weather === 'pluie' || r.weather === 'forte_pluie')).length;
  if (rainy >= 3) alerts.push({ kind: 'warn', icon: 'rain', title: 'Pluie fréquente', text: `${rainy} jours de pluie sur les 7 derniers jours : les tâches exposées aux intempéries risquent de glisser.`, when: '7 derniers jours', href: '#/monte-carlo' });
  const mcr = await runMonteCarlo(st).catch(() => null);
  if (mcr) {
    const p = mcr.mc.p_target;
    if (p !== null && p < 0.5) alerts.unshift({ kind: 'crit', icon: 'alert', title: 'Échéance menacée', text: `Seulement ${pct(p)} de chances de finir avant le ${dateLong(st.project.target_date)}. Date P85 : ${dateLong(dayToDate(today, mcr.mc.p85))}.`, when: 'simulation', href: '#/monte-carlo' });
    else if (p !== null && p < 0.8) alerts.unshift({ kind: 'warn', icon: 'alert', title: 'Marge faible sur l’échéance', text: `${pct(p)} de chances de tenir le ${dateLong(st.project.target_date)} : en dessous du seuil de confiance de 80 %.`, when: 'simulation', href: '#/monte-carlo' });
    alerts.push({ kind: 'info', icon: 'refresh', title: 'Simulation à jour', text: `${nf(mcr.mc.n, 0)} tirages · P85 : ${dateLong(dayToDate(today, mcr.mc.p85))}.`, when: mcr.source === 'serveur' ? 'serveur Python' : 'calcul local', href: '#/monte-carlo' });
  }
  return alerts;
}

/** Synthèse chiffrée utilisée par le tableau de bord et les rapports. */
export async function buildSummary(st) {
  const mcr = await runMonteCarlo(st).catch((e) => ({ error: e.message }));
  const acts = await analyzeActivities(st);
  const rel = await analyzeReliability(st, { lastWeeks: 26 });
  return { mcr, acts, rel, progress: progressOf(st.data.tasks), targetDay: targetDay(st.project, st.today) };
}
export { HAZARD_CATEGORIES, mondayOf };
