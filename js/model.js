/* Logique métier : transforme les données du chantier en entrées pour les moteurs de calcul. */
import { addDays, daysBetween, isoDate, mondayOf, parseDate } from './format.js';

export const DEFAULT_SETTINGS = {
  n_sim: 10000, alpha: 0.05, outlier_level: 0.95, window_days: 30,
  breakdowns: { on: true, lambda_per_day: 0.05, mttr_days: 0.39 },
  rain: { on: true, rate_per_day: 0.10, loss_days: 0.5, threshold_mm: 10 },
  queue: { lam: 6, mu: 5, c: 2, t0: 7, t1: 9.5 },
};

export function settingsOf(project) {
  const s = (project && project.settings) || {};
  return {
    ...DEFAULT_SETTINGS, ...s,
    breakdowns: { ...DEFAULT_SETTINGS.breakdowns, ...(s.breakdowns || {}) },
    rain: { ...DEFAULT_SETTINGS.rain, ...(s.rain || {}) },
    queue: { ...DEFAULT_SETTINGS.queue, ...(s.queue || {}) },
  };
}

export const ROLE_LABELS = { chef_chantier: 'Chef de chantier', conducteur: 'Conducteur de travaux', direction: 'Direction' };
export const WEATHER = {
  soleil: { label: 'Ensoleillé', icon: 'sun' }, nuageux: { label: 'Nuageux', icon: 'cloud' },
  pluie: { label: 'Pluie', icon: 'rain' }, forte_pluie: { label: 'Forte pluie', icon: 'rain' },
};
export const COST_CATEGORIES = {
  intemperies: 'Intempéries', pannes: 'Pannes d’engins', livraisons: 'Retards de livraison',
  materiaux: 'Matériaux', main_oeuvre: 'Main-d’œuvre', sous_traitance: 'Sous-traitance', engins: 'Engins', autre: 'Autre',
};
export const HAZARD_CATEGORIES = ['intemperies', 'pannes', 'livraisons'];

/* ───────────────────────── planning ───────────────────────── */
/**
 * Tâches restantes à simuler : on écarte les tâches terminées, on réduit les durées des tâches
 * en cours au prorata du reste à faire, et on retire les prédécesseurs déjà terminés.
 * (Même règle que tools/gen_demo.py.)
 */
export function simTasks(tasks) {
  const done = new Set(tasks.filter((t) => t.status === 'done').map((t) => t.code));
  return tasks.filter((t) => t.status !== 'done').sort((a, b) => a.sort_order - b.sort_order).map((t) => {
    const f = 1 - (Number(t.progress) || 0) / 100;
    return {
      id: t.code, name: t.name, a: Number(t.a) * f, m: Number(t.m) * f, b: Number(t.b) * f,
      preds: (t.preds || []).filter((p) => !done.has(p)), exposed: !!t.exposed,
    };
  });
}

export function targetDay(project, today) {
  return Math.max(0, daysBetween(today, project.target_date));
}

/** Corps de requête /api/montecarlo. */
export function mcInput(project, tasks, today, opts = {}) {
  const s = settingsOf(project);
  const body = { tasks: simTasks(tasks), n: opts.n ?? s.n_sim, target_day: targetDay(project, today) };
  if (opts.seed !== undefined && opts.seed !== null) body.seed = opts.seed;
  const bd = opts.breakdowns ?? s.breakdowns, rn = opts.rain ?? s.rain;
  if (bd && bd.on && bd.lambda_per_day > 0) body.breakdowns = { lambda_per_day: bd.lambda_per_day, mttr_days: bd.mttr_days };
  if (rn && rn.on && rn.rate_per_day > 0) body.rain = { rate_per_day: rn.rate_per_day, loss_days: rn.loss_days };
  return body;
}

/** Avancement physique pondéré par la durée probable de chaque tâche. */
export function progressOf(tasks) {
  let w = 0, p = 0;
  for (const t of tasks) {
    const wt = Number(t.m) || 0; w += wt;
    p += wt * (t.status === 'done' ? 1 : t.status === 'doing' ? (Number(t.progress) || 0) / 100 : 0);
  }
  return w ? p / w : 0;
}

/** Date de fin prévue pour un nombre de jours à partir d'aujourd'hui. */
export const dayToDate = (today, day) => addDays(today, Math.ceil(day));

/** Vérifie la cohérence du planning (renvoie un message d'erreur ou null). */
export function validateTasks(tasks) {
  const codes = new Set(tasks.map((t) => t.code));
  if (codes.size !== tasks.length) return 'Deux tâches ont le même code.';
  for (const t of tasks) {
    if (!(t.a >= 0 && t.a <= t.m && t.m <= t.b)) return `« ${t.name} » : il faut minimum ≤ probable ≤ maximum.`;
    for (const p of t.preds || []) if (!codes.has(p)) return `« ${t.name} » : prédécesseur inconnu (${p}).`;
  }
  const rest = simTasks(tasks); const ids = new Map(rest.map((t) => [t.id, t]));
  const state = new Map();
  const visit = (id) => {
    if (state.get(id) === 2) return false;
    if (state.get(id) === 1) return true;
    state.set(id, 1);
    for (const p of ids.get(id).preds) if (ids.has(p) && visit(p)) return true;
    state.set(id, 2); return false;
  };
  for (const id of ids.keys()) if (visit(id)) return 'Les dépendances forment une boucle (une tâche dépend d’elle-même, directement ou non).';
  return null;
}

/* ───────────────────────── productivité ───────────────────────── */
export const isPending = (e) => !!e.flagged && !e.reviewed && !e.excluded;
export const isUsable = (e) => !e.excluded && !isPending(e);

/** Relevés exploitables d'une activité sur la fenêtre [aujourd'hui − fenêtre ; aujourd'hui], triés par date. */
export function windowEntries(entries, activityId, today, windowDays) {
  const from = windowDays ? isoDate(addDays(today, -windowDays)) : '0000-00-00';
  return entries
    .filter((e) => e.activity_id === activityId && isUsable(e) && e.entry_date >= from && e.entry_date <= today)
    .sort((a, b) => (a.entry_date < b.entry_date ? -1 : 1));
}

/** Historique de référence pour détecter une valeur atypique (fenêtre, sinon tout l'historique). */
export function outlierHistory(entries, activityId, today, windowDays, excludeId = null) {
  let h = windowEntries(entries, activityId, today, windowDays).filter((e) => e.id !== excludeId);
  if (h.length < 5) h = entries.filter((e) => e.activity_id === activityId && isUsable(e) && e.id !== excludeId);
  return h.map((e) => Number(e.value));
}

/* ───────────────────────── pannes ───────────────────────── */
/** Nombre de pannes par semaine (lundi → dimanche), de la semaine de début du chantier à la semaine en cours. */
export function weeklyFailureCounts(failures, startDate, today, lastWeeks = null) {
  const first = mondayOf(startDate), last = mondayOf(today);
  const nWeeks = Math.round((last - first) / (7 * 86400000)) + 1;
  const counts = new Array(Math.max(nWeeks, 0)).fill(0);
  for (const f of failures) {
    const d = (f.occurred_at || '').slice(0, 10);
    if (!d || d > today) continue;
    const idx = Math.floor((parseDate(d) - first) / (7 * 86400000));
    if (idx >= 0 && idx < counts.length) counts[idx]++;
  }
  return lastWeeks ? counts.slice(-lastWeeks) : counts;
}
export const failureGaps = (failures) => failures.map((f) => f.run_hours_since_last).filter((v) => v !== null && v !== undefined).map(Number);
export function meanRepairHours(failures, equipment) {
  const d = failures.map((f) => Number(f.downtime_hours)).filter((v) => v > 0);
  if (d.length) return d.reduce((a, b) => a + b, 0) / d.length;
  const e = equipment.map((q) => Number(q.mttr_hours)).filter((v) => v > 0);
  return e.length ? e.reduce((a, b) => a + b, 0) / e.length : 3;
}
export function failuresThisWeek(failures, today) {
  const mon = isoDate(mondayOf(today));
  return failures.filter((f) => f.occurred_at.slice(0, 10) >= mon && f.occurred_at.slice(0, 10) <= today);
}

/** Estimation du taux de pannes par jour calendaire et par tâche (les durées du planning sont en jours calendaires ; une machine par tâche). */
export function estimateBreakdownRate(failures, equipment, startDate, today) {
  const weeks = weeklyFailureCounts(failures, startDate, today);
  if (weeks.length < 2 || !equipment.length) return null;
  const lamWeek = weeks.reduce((a, b) => a + b, 0) / weeks.length;
  return lamWeek / 7 / equipment.length;
}
/** Estimation du taux de jours de pluie bloquants d'après les rapports journaliers. */
export function estimateRainRate(reports, thresholdMm) {
  if (reports.length < 10) return null;
  return reports.filter((r) => Number(r.rain_mm) >= thresholdMm).length / reports.length;
}

/* ───────────────────────── coûts ───────────────────────── */
/** Surcoût lié aux aléas : événements de coût (intempéries, livraisons…) + réparations de pannes. */
export function hazardCosts(costs, failures, today) {
  const mon = isoDate(mondayOf(today));
  const byCat = {}; let total = 0, week = 0;
  const add = (cat, amount, date) => {
    byCat[cat] = (byCat[cat] || 0) + amount; total += amount; if (date >= mon && date <= today) week += amount;
  };
  for (const c of costs) if (HAZARD_CATEGORIES.includes(c.category)) add(c.category, Number(c.amount), c.event_date);
  for (const f of failures) if (Number(f.repair_cost) > 0) add('pannes', Number(f.repair_cost), f.occurred_at.slice(0, 10));
  // courbe cumulée par mois pour la mini-courbe
  const events = [
    ...costs.filter((c) => HAZARD_CATEGORIES.includes(c.category)).map((c) => [c.event_date, Number(c.amount)]),
    ...failures.filter((f) => Number(f.repair_cost) > 0).map((f) => [f.occurred_at.slice(0, 10), Number(f.repair_cost)]),
  ].sort((a, b) => (a[0] < b[0] ? -1 : 1));
  let cum = 0; const series = events.map(([d, v]) => ({ date: d, cum: (cum += v) }));
  return { total, week, byCat, series };
}

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }));
