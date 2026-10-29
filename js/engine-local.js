/* ChantierPulse — moteur de calcul local (JavaScript).
 *
 * Reproduit EXACTEMENT les calculs du serveur Python (backend/engine) : mêmes formules,
 * mêmes noms de champs, mêmes messages d'erreur. Il sert :
 *   - d'exemplaire de démonstration autonome (aucun serveur nécessaire) ;
 *   - de secours si le serveur Python n'est pas joignable (mode « auto »).
 * Les tirages aléatoires diffèrent de ceux de numpy (autre générateur) : les résultats
 * de Monte Carlo concordent à la précision statistique près (~1 %), les tests (Student,
 * Poisson, Erlang…) concordent à l'identique.
 */

export class ModelError extends Error {}

/* ────────────────────────── aléatoire ────────────────────────── */
export function makeRng(seed) {
  let s = (seed === null || seed === undefined ? (Math.random() * 4294967296) : seed) >>> 0;
  const next = () => {            // mulberry32
    s = (s + 0x6D2B79F5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  const rng = {
    random: () => { let u = next(); while (u === 0) u = next(); return u; },
    normal() {
      if (spare !== null) { const v = spare; spare = null; return v; }
      const u = rng.random(), v = rng.random();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return r * Math.cos(2 * Math.PI * v);
    },
    exponential: (scale) => -Math.log(rng.random()) * scale,
    gamma(shape, scale = 1) {                      // Marsaglia–Tsang
      if (shape < 1) return rng.gamma(shape + 1, scale) * Math.pow(rng.random(), 1 / shape);
      const d = shape - 1 / 3, c = 1 / Math.sqrt(9 * d);
      for (;;) {
        let x, v;
        do { x = rng.normal(); v = 1 + c * x; } while (v <= 0);
        v = v * v * v;
        const u = rng.random();
        if (u < 1 - 0.0331 * x * x * x * x || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * scale;
      }
    },
    beta(a, b) { const x = rng.gamma(a), y = rng.gamma(b); return x / (x + y); },
    poisson(lam) {
      if (lam <= 0) return 0;
      if (lam < 30) {                              // Knuth
        const L = Math.exp(-lam); let k = 0, p = 1;
        do { k++; p *= rng.random(); } while (p > L);
        return k - 1;
      }
      return Math.max(0, Math.round(lam + Math.sqrt(lam) * rng.normal()));
    },
  };
  return rng;
}

/* ──────────────────── fonctions spéciales ──────────────────── */
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313,
  -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
export function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1;
  let a = LG[0];
  const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LG[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function betacf(a, b, x) {
  const FPMIN = 1e-300, EPS = 3e-16;
  const qab = a + b, qap = a + 1, qam = a - 1;
  let c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 400; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}
/** Fonction bêta incomplète régularisée I_x(a, b). */
export function betai(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
/** Probabilité bilatérale P(|T| ≥ |t|) pour une loi de Student à df degrés de liberté. */
export function tTwoSided(t, df) { return betai(df / (df + t * t), df / 2, 0.5); }
export function tCdf(t, df) { const half = 0.5 * tTwoSided(t, df); return t > 0 ? 1 - half : half; }
export function tPpf(p, df) {
  if (p === 0.5) return 0;
  if (p < 0.5) return -tPpf(1 - p, df);
  let lo = 0, hi = 2;
  while (tCdf(hi, df) < p && hi < 1e12) { lo = hi; hi *= 2; }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < p) lo = mid; else hi = mid;
    if (hi - lo <= 1e-15 * Math.max(1, hi)) break;
  }
  return (lo + hi) / 2;
}
/** Densité de la loi de Student (pour les graphiques). */
export function tPdf(t, df) {
  return Math.exp(lgamma((df + 1) / 2) - lgamma(df / 2)) / Math.sqrt(df * Math.PI) * Math.pow(1 + t * t / df, -(df + 1) / 2);
}
/** Gamma incomplète régularisée supérieure Q(a, x). */
export function gammaQ(a, x) {
  if (x <= 0) return 1;
  if (x < a + 1) {
    let ap = a, sum = 1 / a, del = sum;
    for (let n = 0; n < 500; n++) { ap += 1; del *= x / ap; sum += del; if (Math.abs(del) < Math.abs(sum) * 1e-16) break; }
    return 1 - sum * Math.exp(-x + a * Math.log(x) - lgamma(a));
  }
  const FPMIN = 1e-300;
  let b = x + 1 - a, c = 1 / FPMIN, d = 1 / b, h = d;
  for (let i = 1; i < 500; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = b + an / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c; h *= del;
    if (Math.abs(del - 1) < 1e-16) break;
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h;
}
export const chi2Sf = (x, k) => gammaQ(k / 2, x / 2);
export const poissonPmf = (k, lam) => Math.exp(-lam + k * Math.log(lam) - lgamma(k + 1));
export function poissonSf(k, lam) {              // P(X > k)
  let cdf = 0;
  for (let i = 0; i <= k; i++) cdf += poissonPmf(i, lam);
  return Math.max(0, 1 - cdf);
}
const factorial = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
const sd1 = (a) => { const m = mean(a); return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1)); };
/** Arrondi « à la numpy / Python » (moitié vers le pair). */
function pyRound(x, nd = 0) {
  const f = Math.pow(10, nd), y = x * f, r = Math.round(y);
  return (Math.abs(y % 1) === 0.5 && r % 2 !== 0 ? r - 1 : r) / f;
}
function percentileSorted(srt, q) {               // interpolation linéaire (numpy)
  const idx = (q / 100) * (srt.length - 1), lo = Math.floor(idx), hi = Math.ceil(idx);
  return srt[lo] + (srt[hi] - srt[lo]) * (idx - lo);
}

/* ──────────────────────── Monte Carlo ──────────────────────── */
const PERCENTILE_LEVELS = Array.from({ length: 19 }, (_, i) => 5 + 5 * i);
const MAX_CELLS = 6_000_000;

export function pertParams(a, m, b, lam = 4) {
  return [1 + lam * (m - a) / (b - a), 1 + lam * (b - m) / (b - a)];
}
function checkTasks(tasks) {
  if (!tasks || !tasks.length) throw new ModelError('Aucune tâche à simuler.');
  const ids = tasks.map((t) => String(t.id));
  if (new Set(ids).size !== ids.length) throw new ModelError('Identifiants de tâches en double.');
  const known = new Set(ids);
  for (const t of tasks) {
    if (!(0 <= t.a && t.a <= t.m && t.m <= t.b)) throw new ModelError(`Tâche « ${t.name} » : il faut 0 ≤ minimum ≤ probable ≤ maximum.`);
    for (const p of t.preds || []) {
      if (!known.has(String(p))) throw new ModelError(`Tâche « ${t.name} » : prédécesseur inconnu (${p}).`);
      if (String(p) === String(t.id)) throw new ModelError(`Tâche « ${t.name} » : elle ne peut pas dépendre d'elle-même.`);
    }
  }
}
function topologicalOrder(tasks) {
  const index = new Map(tasks.map((t, k) => [String(t.id), k]));
  const preds = tasks.map((t) => [...new Set((t.preds || []).map(String))]);
  const indeg = preds.map((p) => p.length);
  const succ = tasks.map(() => []);
  preds.forEach((ps, k) => ps.forEach((p) => succ[index.get(p)].push(k)));
  const queue = [], order = [];
  indeg.forEach((d, k) => { if (d === 0) queue.push(k); });
  while (queue.length) {
    const k = queue.shift(); order.push(k);
    for (const s of succ[k]) if (--indeg[s] === 0) queue.push(s);
  }
  if (order.length !== tasks.length) throw new ModelError('Cycle détecté dans les dépendances entre tâches.');
  const predIdx = preds.map((ps) => ps.map((p) => index.get(p)));
  return { order, index, preds: predIdx, succ };
}

export function montecarlo({ tasks, n = 10000, target_day = null, seed = null, breakdowns = null, rain = null, pert_lambda = 4 }) {
  if (!Number.isInteger(n) || n < 100 || n > 50000) throw new ModelError('Le nombre de tirages doit être compris entre 100 et 50 000.');
  if (tasks && tasks.length > 200) throw new ModelError('Trop de tâches (200 maximum).');
  checkTasks(tasks);
  const T = tasks.length;
  if (T * n > MAX_CELLS) throw new ModelError('Simulation trop volumineuse : réduisez le nombre de tirages ou de tâches.');
  const { order, preds, succ } = topologicalOrder(tasks);
  const rng = makeRng(seed);

  const d = tasks.map(() => new Float64Array(n));
  tasks.forEach((t, k) => {
    const a = +t.a, m = +t.m, b = +t.b;
    if (b - a < 1e-12) { d[k].fill(a); return; }
    const [al, be] = pertParams(a, m, b, pert_lambda);
    for (let i = 0; i < n; i++) d[k][i] = a + (b - a) * rng.beta(al, be);
  });
  if (breakdowns && breakdowns.lambda_per_day > 0) {
    const lam = +breakdowns.lambda_per_day, mttr = breakdowns.mttr_days ?? 0.13;
    for (let k = 0; k < T; k++) for (let i = 0; i < n; i++) {
      const cnt = rng.poisson(lam * d[k][i]);
      if (cnt > 0) d[k][i] += rng.gamma(cnt, mttr);
    }
  }
  if (rain && rain.rate_per_day > 0) {
    const rate = +rain.rate_per_day, loss = rain.loss_days ?? 0.5;
    tasks.forEach((t, k) => { if (t.exposed) for (let i = 0; i < n; i++) d[k][i] += rng.poisson(rate * d[k][i]) * loss; });
  }

  const es = tasks.map(() => new Float64Array(n)), ef = tasks.map(() => new Float64Array(n));
  const total = new Float64Array(n);
  for (const k of order) {
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (const p of preds[k]) { const v = ef[p][i]; if (v > s) s = v; }
      es[k][i] = s; ef[k][i] = s + d[k][i];
      if (ef[k][i] > total[i]) total[i] = ef[k][i];
    }
  }
  const ls = tasks.map(() => new Float64Array(n));
  const crit = new Float64Array(T);
  for (const k of [...order].reverse()) {
    for (let i = 0; i < n; i++) {
      let lf = total[i];
      if (succ[k].length) { lf = Infinity; for (const s of succ[k]) if (ls[s][i] < lf) lf = ls[s][i]; }
      ls[k][i] = lf - d[k][i];
      if (ls[k][i] - es[k][i] <= 1e-9) crit[k] += 1;
    }
  }

  const srt = Float64Array.from(total).sort();
  const pct = {};
  for (const q of PERCENTILE_LEVELS) pct[String(q)] = percentileSorted(srt, q);
  const tmean = mean(Array.from(total));
  const tsd = Math.sqrt(Array.from(total).reduce((s, v) => s + (v - tmean) ** 2, 0) / n);
  const first = Math.floor(srt[0]), last = Math.floor(srt[n - 1]);
  const counts = new Array(last - first + 1).fill(0);
  for (let i = 0; i < n; i++) counts[Math.floor(total[i]) - first]++;
  const hist = { first_day: first, pct: counts.map((c) => pyRound(c / n * 100, 4)) };
  const days = [];
  for (let x = first - 1; x < last + 3; x++) days.push(x);
  const probs = []; let ptr = 0;
  for (const x of days) { while (ptr < n && srt[ptr] <= x) ptr++; probs.push(pyRound(ptr / n, 5)); }
  let pTarget = null;
  if (target_day !== null && target_day !== undefined) { let c = 0; for (let i = 0; i < n; i++) if (total[i] <= target_day) c++; pTarget = c / n; }
  return {
    n, mean: tmean, sd: tsd, p50: pct['50'], p85: pct['85'], p95: pct['95'], percentiles: pct,
    p_target: pTarget, target_day: target_day ?? null, histogram: hist, ecdf: { days, probs },
    tasks: tasks.map((t, k) => {
      const dm = mean(Array.from(d[k]));
      return { id: t.id, name: t.name, mean: dm, sd: Math.sqrt(Array.from(d[k]).reduce((s, v) => s + (v - dm) ** 2, 0) / n), criticality: crit[k] / n };
    }),
  };
}

/* ─────────────────────── Statistiques ─────────────────────── */
export function student({ values, mu0, alpha = 0.05 }) {
  const x = values.map(Number);
  const n = x.length;
  if (n < 2) throw new ModelError('Au moins 2 relevés sont nécessaires pour le test de Student.');
  if (!(alpha > 0 && alpha < 0.5)) throw new ModelError('Le seuil α doit être compris entre 0 et 0,5.');
  const m = mean(x), sd = sd1(x), df = n - 1, se = sd / Math.sqrt(n);
  const tcrit = tPpf(1 - alpha / 2, df);
  let t, p;
  if (sd === 0) { t = m === mu0 ? 0 : (m > mu0 ? Infinity : -Infinity); p = m === mu0 ? 1 : 0; }
  else { t = (m - mu0) / se; p = tTwoSided(t, df); }
  const significant = p < alpha;
  const verdict = !significant ? 'not_significant' : (m < mu0 ? 'significant_below' : 'significant_above');
  return {
    n, mean: m, sd, cv: m ? sd / m : null, se, mu0, gap: mu0 ? (m - mu0) / mu0 : null,
    t: Number.isFinite(t) ? t : null, df, p, alpha, tcrit, ci: [m - tcrit * se, m + tcrit * se],
    significant, verdict,
    warning: n < 8 ? `Seulement ${n} relevés : le test manque de puissance. Visez au moins 8 à 10 relevés pour une conclusion fiable.` : null,
  };
}

export function outlier({ history = [], value, level = 0.95 }) {
  const x = history.map(Number), n = x.length;
  if (n < 5) return { enough_data: false, n, is_outlier: false, lo: null, hi: null, mean: n ? mean(x) : null, sd: null, z: null, level };
  const m = mean(x), sd = sd1(x);
  const tcrit = tPpf(1 - (1 - level) / 2, n - 1);
  const half = tcrit * sd * Math.sqrt(1 + 1 / n);
  const lo = m - half, hi = m + half;
  return { enough_data: true, n, mean: m, sd, lo, hi, z: sd > 0 ? (value - m) / sd : null, is_outlier: value < lo || value > hi, level };
}

/* ─────────────────────── Fiabilité ─────────────────────── */
const NICE_STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 500];
const niceStep = (x) => NICE_STEPS.find((s) => s >= x) ?? NICE_STEPS[NICE_STEPS.length - 1];

export function reliability({ weekly_counts, gaps_hours = [], mttr_hours = 3, run_hours_per_week = 40, kmax = 6 }) {
  const wk = weekly_counts.map((v) => Math.trunc(v));
  if (wk.length < 4) throw new ModelError("Au moins 4 semaines d'historique sont nécessaires.");
  if (wk.some((v) => v < 0)) throw new ModelError('Les nombres de pannes doivent être positifs.');
  const lam = mean(wk), weeks = wk.length;
  const ks = Array.from({ length: kmax + 1 }, (_, k) => k);
  const obs = ks.slice(0, -1).map((k) => wk.filter((v) => v === k).length).concat([wk.filter((v) => v >= kmax).length]);
  const pmf = ks.slice(0, -1).map((k) => poissonPmf(k, lam)).concat([poissonSf(kmax - 1, lam)]);
  const O = [...obs], E = pmf.map((p) => weeks * p);
  while (E.length > 2 && E[E.length - 1] < 5) { const o = O.pop(), e = E.pop(); O[O.length - 1] += o; E[E.length - 1] += e; }
  let i = 0;
  while (E.length > 2 && i < E.length - 1) {
    if (E[i] < 5) { const o = O.splice(i, 1)[0], e = E.splice(i, 1)[0]; O[i] += o; E[i] += e; } else i++;
  }
  const chi2 = O.reduce((s, o, j) => s + (E[j] > 0 ? (o - E[j]) ** 2 / E[j] : 0), 0);
  const dof = E.length - 1 - 1;
  const poisson = { k: ks, observed: obs.map((o) => o / weeks), expected: pmf, chi2, dof, p_gof: dof >= 1 ? chi2Sf(chi2, dof) : null, weeks, grouped: { observed: O, expected: E } };

  const g = gaps_hours.filter((v) => v !== null && v !== undefined && v >= 0).map(Number);
  const mtbf = g.length ? mean(g) : null;
  let exp = null;
  if (g.length >= 3 && mtbf && mtbf > 0) {
    const step = niceStep(mtbf / 3.5);
    const nb = Math.ceil((Math.max(...g) + 1e-9) / step) + 1;
    const counts = [], expected = [];
    for (let b = 0; b < nb; b++) {
      counts.push(g.filter((v) => v >= b * step && v < (b + 1) * step).length);
      expected.push(g.length * (Math.exp(-b * step / mtbf) - Math.exp(-(b + 1) * step / mtbf)));
    }
    exp = { bin: step, counts, expected, n: g.length };
  }
  return {
    weeks, lambda: lam, poisson, mtbf, mttr: mttr_hours, availability: mtbf ? mtbf / (mtbf + mttr_hours) : null, exp,
    probs: {
      p0_next_week: Math.exp(-lam), p_ge3_next_week: poissonSf(2, lam),
      r_week: mtbf ? Math.exp(-run_hours_per_week / mtbf) : null,
      r_40h: mtbf ? Math.exp(-40 / mtbf) : null, r_100h: mtbf ? Math.exp(-100 / mtbf) : null,
    },
  };
}

/* ───────────────────── Files d'attente M/M/c ───────────────────── */
const WQ_CAP_MIN = 30;
export function erlangC(c, lam, mu) {
  const a = lam / mu;
  if (a >= c) return 1;
  let s = 0;
  for (let k = 0; k < c; k++) s += Math.pow(a, k) / factorial(k);
  const last = Math.pow(a, c) / (factorial(c) * (1 - a / c));
  return last / (s + last);
}
export function queueMetrics(c, lam, mu) {
  if (c < 1 || lam <= 0 || mu <= 0) throw new ModelError('Paramètres de file invalides (c ≥ 1, λ > 0, μ > 0).');
  const rho = lam / (c * mu);
  if (rho >= 1) return { rho, stable: false, pw: 1, wq_min: null, lq: null, w_min: null };
  const pw = erlangC(c, lam, mu), wq = pw / (c * mu - lam);
  return { rho, stable: true, pw, wq_min: wq * 60, lq: lam * wq, w_min: (wq + 1 / mu) * 60 };
}
export function stateProbabilities(c, lam, mu, nmax = 8) {
  const a = lam / mu, rho = a / c;
  if (rho >= 1) return new Array(nmax + 1).fill(0);
  let s = 0;
  for (let k = 0; k < c; k++) s += Math.pow(a, k) / factorial(k);
  const p0 = 1 / (s + Math.pow(a, c) / (factorial(c) * (1 - rho)));
  return Array.from({ length: nmax + 1 }, (_, n) => (n <= c ? p0 * Math.pow(a, n) / factorial(n) : p0 * Math.pow(a, n) / (factorial(c) * Math.pow(c, n - c))));
}
export function waitCurves(mu, servers, lamMax, step = 0.1) {
  const len = Math.trunc((lamMax - 0.2) / step) + 1;
  const lam = Array.from({ length: len }, (_, i) => pyRound(0.2 + i * step, 4));
  return {
    lam,
    series: servers.map((c) => ({ c, wq_min: lam.map((l) => { const v = queueMetrics(c, l, mu).wq_min; return v === null || v > WQ_CAP_MIN ? null : v; }) })),
  };
}
export function simulateDay(lam, mu, c, t0 = 7, t1 = 9.5, seed = null, maxTrucks = 60) {
  if (c < 1 || lam <= 0 || mu <= 0) throw new ModelError('Paramètres de file invalides.');
  const rng = makeRng(seed);
  let t = t0; const arrivals = [];
  while (arrivals.length < maxTrucks) { t += rng.exponential(1 / lam); if (t > t1) break; arrivals.push(t); }
  const free = new Array(c).fill(t0), trucks = [];
  arrivals.forEach((a, i) => {
    let k = 0; for (let j = 1; j < c; j++) if (free[j] < free[k]) k = j;
    const start = Math.max(a, free[k]);
    const dur = Math.max(4 / 60, rng.exponential(1 / mu));
    free[k] = start + dur;
    trucks.push({ id: i + 1, arrival: a, start, end: start + dur, server: k });
  });
  return trucks;
}
export function queue({ lam, mu, c, seed = null, t0 = 7, t1 = 9.5 }) {
  if (!(lam > 0 && lam <= 200 && mu > 0 && mu <= 200 && Number.isInteger(c) && c >= 1 && c <= 20)) throw new ModelError('Paramètres de file invalides (c ≥ 1, λ > 0, μ > 0).');
  const cur = queueMetrics(c, lam, mu);
  const lamMax = Math.min(Math.max((c + 2) * mu, lam * 1.5), 40);
  const lamAlt = Math.max(0.5, pyRound(lam * 5 / 6 * 2) / 2);
  const options = [
    { key: 'current', label: 'Situation actuelle', c, lam, ...queueMetrics(c, lam, mu) },
    { key: 'pace', label: `Cadencer à ${String(lamAlt).replace('.', ',')} camions/h`, c, lam: lamAlt, ...queueMetrics(c, lamAlt, mu) },
    { key: 'server', label: `Ajouter un ${c + 1}ᵉ poste`, c: c + 1, lam, ...queueMetrics(c + 1, lam, mu) },
  ];
  const trucks = simulateDay(lam, mu, c, t0, t1, seed);
  const q = [];
  for (let t = t0; t <= t1 + 1e-9; t += 5 / 60) q.push(trucks.filter((x) => x.arrival <= t && t < x.start).length);
  return {
    params: { lam, mu, c }, ...cur, pn: stateProbabilities(c, lam, mu, 8),
    curves: waitCurves(mu, [c, c + 1, c + 2], lamMax), options,
    day: { t0, t1, trucks, waits_min: trucks.map((x) => (x.start - x.arrival) * 60), queue_len: q },
  };
}

export const localEngine = { montecarlo, student, outlier, reliability, queue };
