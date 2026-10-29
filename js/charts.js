/* Graphiques SVG écrits à la main (aucune bibliothèque) : traits de 2 px, barres arrondies côté donnée,
 * grille fine, texte en encre. Chaque fonction renvoie une chaîne SVG « responsive » (viewBox). */
import { nf, pct as fpct, dateShort, addDays, esc } from './format.js';
import { tPdf } from './engine-local.js';

/* Couleurs = variables CSS (css/app.css) : elles changent avec le thème clair/sombre sans redessiner le graphique. */
export const C = { blue: 'var(--blue)', blue100: 'var(--blue100)', blue200: 'var(--blue200)', orange: 'var(--orange)', aqua: 'var(--aqua)', violet: 'var(--violet)', grey: 'var(--grey)', ink: 'var(--ink)', ink2: 'var(--ink2)', crit: 'var(--crit)', warn: 'var(--warn)' };
const RING = 'var(--surface)';
const f1 = (x) => (Math.round(x * 10) / 10).toString();

/** Graduations « rondes ». Avec cover = true, la dernière graduation est ≥ hi (l'axe contient toute la donnée). */
export function niceTicks(lo, hi, count = 5, cover = false) {
  if (!(hi > lo)) return [lo];
  const raw = (hi - lo) / count, p = Math.pow(10, Math.floor(Math.log10(raw))), m = raw / p;
  const step = (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p;
  const out = [];
  for (let v = Math.ceil(lo / step - 1e-9) * step; ; v += step) {
    out.push(Math.round(v / step) * step);
    if (!cover ? v + step > hi + 1e-9 : v >= hi - 1e-9) break;
  }
  return out;
}

export class Plot {
  constructor(w, h, { l = 46, r = 16, t = 10, b = 30 } = {}) {
    Object.assign(this, { w, h, l, r, t, b, el: [], x0: 0, x1: 1, y0: 0, y1: 1 });
  }
  sx(a, b) { this.x0 = a; this.x1 = b; return this; }
  sy(a, b) { this.y0 = a; this.y1 = b; return this; }
  X(v) { return this.l + (v - this.x0) / (this.x1 - this.x0) * (this.w - this.l - this.r); }
  Y(v) { return this.h - this.b - (v - this.y0) / (this.y1 - this.y0) * (this.h - this.t - this.b); }
  add(s) { this.el.push(s); return this; }
  text(x, y, s, { cls = 'tm', anchor = 'start', size = 11.5, weight = 400, extra = '' } = {}) {
    return this.add(`<text x="${f1(x)}" y="${f1(y)}" class="${cls}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" ${extra}>${esc(s)}</text>`);
  }
  gridy(ticks, fmt = (v) => nf(v, 0), labels = true) {
    for (const v of ticks) {
      const y = this.Y(v);
      this.add(`<line x1="${this.l}" x2="${this.w - this.r}" y1="${f1(y)}" y2="${f1(y)}" stroke="var(--grid)" stroke-width="1"/>`);
      if (labels) this.text(this.l - 9, y + 4, fmt(v), { anchor: 'end' });
    }
    return this;
  }
  gridx(ticks) {
    for (const v of ticks) { const x = this.X(v); this.add(`<line y1="${this.t}" y2="${this.h - this.b}" x1="${f1(x)}" x2="${f1(x)}" stroke="var(--grid)" stroke-width="1"/>`); }
    return this;
  }
  baseline(v = null) { const y = this.Y(v === null ? this.y0 : v); return this.add(`<line x1="${this.l}" x2="${this.w - this.r}" y1="${f1(y)}" y2="${f1(y)}" stroke="var(--axis)" stroke-width="1"/>`); }
  xticks(ticks, fmt, dy = 20, anchor = 'middle') { for (const v of ticks) this.text(this.X(v), this.h - this.b + dy, fmt(v), { anchor }); return this; }
  line(xs, ys, color = C.blue, w = 2, dash = null) {
    const pts = xs.map((x, i) => `${f1(this.X(x))},${f1(this.Y(ys[i]))}`).join(' ');
    return this.add(`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  }
  area(xs, ys, base = null, color = C.blue, op = 0.1) {
    const b = base === null ? this.y0 : base;
    const pts = [`${f1(this.X(xs[0]))},${f1(this.Y(b))}`, ...xs.map((x, i) => `${f1(this.X(x))},${f1(this.Y(ys[i]))}`), `${f1(this.X(xs[xs.length - 1]))},${f1(this.Y(b))}`];
    return this.add(`<polygon points="${pts.join(' ')}" fill="${color}" fill-opacity="${op}"/>`);
  }
  band(xs, lo, hi, color = C.blue, op = 0.12) {
    const top = xs.map((x, i) => `${f1(this.X(x))},${f1(this.Y(hi[i]))}`);
    const bot = xs.map((x, i) => `${f1(this.X(x))},${f1(this.Y(lo[i]))}`).reverse();
    return this.add(`<polygon points="${[...top, ...bot].join(' ')}" fill="${color}" fill-opacity="${op}"/>`);
  }
  rect(x0, x1, y0, y1, color, op = 0.12) {
    const xa = Math.min(this.X(x0), this.X(x1)), xb = Math.max(this.X(x0), this.X(x1)), ya = Math.min(this.Y(y0), this.Y(y1)), yb = Math.max(this.Y(y0), this.Y(y1));
    return this.add(`<rect x="${f1(xa)}" y="${f1(ya)}" width="${f1(xb - xa)}" height="${f1(yb - ya)}" fill="${color}" fill-opacity="${op}"/>`);
  }
  dot(x, y, color = C.blue, r = 4.5, ring = RING, tip = '') {
    const c = `<circle cx="${f1(this.X(x))}" cy="${f1(this.Y(y))}" r="${r}" fill="${color}" stroke="${ring}" stroke-width="2">${tip ? `<title>${esc(tip)}</title>` : ''}</circle>`;
    return this.add(c);
  }
  vline(x, color = C.ink2, w = 1.5, y0 = null, y1 = null, dash = null) {
    return this.add(`<line x1="${f1(this.X(x))}" x2="${f1(this.X(x))}" y1="${y0 === null ? this.t : y0}" y2="${y1 === null ? this.h - this.b : y1}" stroke="${color}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  }
  hline(y, color = C.ink2, w = 1.5, dash = null) {
    return this.add(`<line x1="${this.l}" x2="${this.w - this.r}" y1="${f1(this.Y(y))}" y2="${f1(this.Y(y))}" stroke="${color}" stroke-width="${w}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
  }
  vbar(xc, v, width, color, base = null, r = 4, tip = '') {
    const b = base === null ? this.y0 : base, x = this.X(xc) - width / 2, yt = this.Y(v), yb = this.Y(b);
    if (Math.abs(yb - yt) < 1) return this;
    const up = yt < yb, rr = Math.min(r, Math.abs(yb - yt), width / 2);
    const d = up
      ? `M${f1(x)},${f1(yb)}V${f1(yt + rr)}A${rr},${rr} 0 0 1 ${f1(x + rr)},${f1(yt)}H${f1(x + width - rr)}A${rr},${rr} 0 0 1 ${f1(x + width)},${f1(yt + rr)}V${f1(yb)}Z`
      : `M${f1(x)},${f1(yb)}V${f1(yt - rr)}A${rr},${rr} 0 0 0 ${f1(x + rr)},${f1(yt)}H${f1(x + width - rr)}A${rr},${rr} 0 0 0 ${f1(x + width)},${f1(yt - rr)}V${f1(yb)}Z`;
    return this.add(`<path d="${d}" fill="${color}">${tip ? `<title>${esc(tip)}</title>` : ''}</path>`);
  }
  hbar(yc, v, height, color, base = null, r = 4, tip = '') {
    const b = base === null ? this.x0 : base, y = this.Y(yc) - height / 2, xb = this.X(b), xe = this.X(v);
    if (Math.abs(xe - xb) < 1) return this;
    const rr = Math.min(r, Math.abs(xe - xb), height / 2);
    const d = `M${f1(xb)},${f1(y)}H${f1(xe - rr)}A${rr},${rr} 0 0 1 ${f1(xe)},${f1(y + rr)}V${f1(y + height - rr)}A${rr},${rr} 0 0 1 ${f1(xe - rr)},${f1(y + height)}H${f1(xb)}Z`;
    return this.add(`<path d="${d}" fill="${color}">${tip ? `<title>${esc(tip)}</title>` : ''}</path>`);
  }
  svg(label = '') {
    return `<svg class="chart" viewBox="0 0 ${this.w} ${this.h}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}">${this.el.join('')}</svg>`;
  }
}

/* ───────────── mini-courbes (tuiles KPI) ───────────── */
export function spark(vals, { w = 120, h = 36, color = C.blue, muted = C.blue200, bars = false, last = true } = {}) {
  if (!vals.length) return '';
  const p = new Plot(w, h, { l: 3, r: 5, t: 5, b: 5 });
  const lo = Math.min(...vals), hi = Math.max(...vals), pad = (hi - lo) * 0.12 || 1;
  if (bars) {
    p.sx(-0.6, vals.length - 0.4).sy(0, Math.max(...vals, 1) * 1.1);
    const bw = Math.max(2, (w - 8) / vals.length - 2);
    vals.forEach((v, i) => p.vbar(i, v, bw, i === vals.length - 1 ? color : muted, null, 2));
    return p.svg('Histogramme');
  }
  p.sx(0, Math.max(vals.length - 1, 1)).sy(lo - pad, hi + pad);
  const xs = vals.map((_, i) => i);
  p.area(xs, vals, lo - pad, color, 0.1).line(xs, vals, last ? muted : color, 2);
  if (last) { p.line(xs.slice(-3), vals.slice(-3), color, 2); p.dot(xs[xs.length - 1], vals[vals.length - 1], color, 4); }
  return p.svg('Tendance');
}

/* ───────────── Monte Carlo ───────────── */
function dayAxis(p, today, lo, hi, count = 6) {
  const ticks = niceTicks(lo, hi, count);
  p.xticks(ticks, (d) => dateShort(addDays(today, d)));
  return ticks;
}

/** Courbe de probabilité cumulée de la date de fin. */
export function ecdfChart(mc, { today, targetDay = null, marks = true, w = 640, h = 300 }) {
  const { days, probs } = mc.ecdf;
  const p = new Plot(w, h, { l: 50, r: 18, t: 14, b: 30 }).sx(days[0], days[days.length - 1]).sy(0, 1);
  p.gridy([0, 0.25, 0.5, 0.75, 1], (v) => fpct(v)).baseline();
  const ticks = dayAxis(p, today, days[0], days[days.length - 1]);
  p.gridx(ticks).area(days, probs, 0, C.blue, 0.1).line(days, probs, C.blue, 2);
  if (targetDay !== null && targetDay >= days[0] && targetDay <= days[days.length - 1]) {
    p.vline(targetDay, C.ink, 1.5);
    const pt = mc.p_target ?? 0;
    p.dot(targetDay, pt, C.blue, 5);
    const left = p.X(targetDay) > w * 0.55;
    p.text(p.X(targetDay) + (left ? -8 : 8), 24, `Échéance ${dateShort(addDays(today, targetDay))}`, { cls: 'ti', size: 12, weight: 600, anchor: left ? 'end' : 'start' });
    p.text(p.X(targetDay) + (left ? -8 : 8), p.Y(pt) + (pt > 0.5 ? 22 : -10), fpct(pt), { cls: 'ti', size: 13, weight: 650, anchor: left ? 'end' : 'start' });
  }
  if (marks) {
    for (const [k, q] of [['P50', mc.p50], ['P85', mc.p85], ['P95', mc.p95]]) {
      const pr = k === 'P50' ? 0.5 : k === 'P85' ? 0.85 : 0.95;
      p.vline(q, C.grey, 1, p.Y(pr), h - 30); p.dot(q, pr, C.blue, 4.5, RING, `${k} : ${dateShort(addDays(today, Math.ceil(q)))}`);
      // l'étiquette est omise quand l'échéance est tout près (elle porterait sur ses propres textes) ; le point garde son info-bulle
      if (targetDay !== null && Math.abs(p.X(q) - p.X(targetDay)) < 90) continue;
      p.text(p.X(q) - 8, p.Y(pr) - 8, `${k} · ${dateShort(addDays(today, Math.ceil(q)))}`, { cls: 'ti', size: 11.5, weight: 600, anchor: 'end' });
    }
  }
  return p.svg('Probabilité cumulée de finir à la date indiquée');
}

/** Histogramme de la date de fin (bleu : avant l'échéance, gris : après). */
export function histChart(mc, { today, targetDay = null, w = 760, h = 340 }) {
  const first = mc.histogram.first_day, pctv = mc.histogram.pct, last = first + pctv.length - 1;
  const ymax = Math.max(...pctv, 1) * 1.15, yticks = niceTicks(0, ymax, 4, true);
  const p = new Plot(w, h, { l: 50, r: 18, t: 30, b: 30 }).sx(first - 0.5, last + 1.5).sy(0, yticks[yticks.length - 1] || ymax);
  p.gridy(yticks, (v) => `${nf(v, 0)} %`).baseline();
  const bw = Math.min(24, (w - 70) / (pctv.length + 2) - 2);
  pctv.forEach((v, i) => {
    const d = first + i, before = targetDay === null || d + 1 <= targetDay + 1e-9;
    p.vbar(d + 0.5, v, bw, before ? C.blue : C.grey, null, 4, `${dateShort(addDays(today, d + 1))} : ${nf(v, 1)} % des simulations`);
  });
  dayAxis(p, today, first, last + 1);
  const lines = [['P50', mc.p50, 14], ['P85', mc.p85, 14], ['P95', mc.p95, 14]];
  if (targetDay !== null) lines.push(['Échéance', targetDay, 0]);
  const placed = [];
  for (const [k, v] of lines) {
    const x = p.X(v); p.vline(v, C.ink, k === 'Échéance' ? 2 : 1.2, 22);
    let row = 0; while (placed.some((q) => q.row === row && Math.abs(q.x - x) < 110)) row++;
    placed.push({ x, row });
    const label = k === 'Échéance' ? `Échéance ${dateShort(addDays(today, v))}` : `${k} · ${dateShort(addDays(today, Math.ceil(v)))}`;
    p.text(x + 6, 16 + row * 16, label, { cls: 'ti', size: 11.5, weight: 600 });
  }
  return p.svg('Distribution de la date de fin du chantier');
}

/* ───────────── Écarts de productivité ───────────── */
/** Rendement journalier, prévision et intervalle de confiance de la moyenne. */
export function trendChart(points, { mu0, ci, unit, today, w = 760, h = 340 }) {
  if (!points.length) return '';
  const vals = points.map((q) => q.v), lo0 = Math.min(...vals, mu0, ci ? ci[0] : Infinity), hi0 = Math.max(...vals, mu0, ci ? ci[1] : -Infinity);
  const pad = (hi0 - lo0) * 0.1 || 1, ticks = niceTicks(lo0 - pad, hi0 + pad, 5);
  const p = new Plot(w, h, { l: 46, r: 120, t: 12, b: 30 }).sx(0, Math.max(points.length - 1, 1)).sy(ticks[0], ticks[ticks.length - 1]);
  p.gridy(ticks, (v) => nf(v, 0)).baseline();
  const step = Math.max(1, Math.ceil(points.length / 7));
  points.forEach((q, i) => { if (i % step === 0) p.text(p.X(i), h - 8, dateShort(q.date), { anchor: 'middle' }); });
  if (ci) p.rect(0, points.length - 1, ci[0], ci[1], C.blue, 0.13);
  p.hline(mu0, C.ink2, 1.5);
  p.line(points.map((_, i) => i), vals, C.blue, 2);
  points.forEach((q, i) => p.dot(i, q.v, C.blue, 3.5, RING, `${dateShort(q.date)} : ${nf(q.v, 1)} ${unit}`));
  p.text(w - 112, p.Y(mu0) - 8, 'Prévision', { cls: 'ti', size: 12, weight: 600 });
  p.text(w - 112, p.Y(mu0) + 7, `${nf(mu0, 1)} ${unit}`, { cls: 'ti', size: 12, weight: 600 });
  if (ci) {
    const yc = p.Y((ci[0] + ci[1]) / 2) + 18;
    p.text(w - 112, yc, 'IC 95 % de la', { cls: 't2', size: 11.5 }); p.text(w - 112, yc + 14, 'moyenne', { cls: 't2', size: 11.5 });
    p.text(w - 112, yc + 28, `${nf(ci[0], 1)} – ${nf(ci[1], 1)}`, { cls: 't2', size: 11.5, weight: 600 });
  }
  return p.svg('Rendement journalier comparé à la prévision');
}

/** Densité de Student, zone de rejet et t observé. */
export function studentChart({ t, df, tcrit, alpha, w = 440, h = 300 }) {
  const lim = Math.max(4.2, Math.min(9, Math.abs(t ?? 0) + 1));
  const p = new Plot(w, h, { l: 14, r: 14, t: 34, b: 30 }).sx(-lim, lim).sy(0, tPdf(0, df) * 1.12);
  const xs = Array.from({ length: 161 }, (_, i) => -lim + (2 * lim * i) / 160), ys = xs.map((x) => tPdf(x, df));
  const tail = (sign) => {
    const pts = xs.filter((x) => sign * x > tcrit).map((x) => [x, tPdf(x, df)]);
    const edge = [sign * tcrit, tPdf(tcrit, df)];
    const all = sign > 0 ? [edge, ...pts] : [...pts, edge];
    if (all.length > 1) p.area(all.map((q) => q[0]), all.map((q) => q[1]), 0, C.orange, 0.3);
  };
  tail(1); tail(-1);
  p.baseline().line(xs, ys, C.blue, 2);
  p.vline(-tcrit, C.grey, 1.2, 28); p.vline(tcrit, C.grey, 1.2, 28);
  p.text(p.X(-tcrit), 20, nf(-tcrit, 2), { anchor: 'middle', size: 11.5 }); p.text(p.X(tcrit), 20, `+${nf(tcrit, 2)}`, { anchor: 'middle', size: 11.5 });
  const side = nf(alpha * 50, 1);
  p.text(p.X(-tcrit) - 6, h - 46, `${side} %`, { cls: 't2', anchor: 'end', size: 11.5 }); p.text(p.X(tcrit) + 6, h - 46, `${side} %`, { cls: 't2', size: 11.5 });
  for (const v of niceTicks(-lim, lim, 6)) p.text(p.X(v), h - 8, nf(v, 0), { anchor: 'middle' });
  if (t !== null && t !== undefined) {
    p.vline(t, C.ink, 2, 44, h - 30);
    p.dot(t, tPdf(t, df), C.ink, 4, RING);
    const left = p.X(t) > w * 0.6;
    p.text(p.X(t) + (left ? -8 : 8), 56, 't observé', { cls: 'ti', size: 12, weight: 650, anchor: left ? 'end' : 'start' });
    p.text(p.X(t) + (left ? -8 : 8), 71, nf(t, 2), { cls: 'ti', size: 12, weight: 650, anchor: left ? 'end' : 'start' });
  }
  return p.svg('Loi de Student et statistique t observée');
}

/** Bandeau de contrôle d'une saisie : valeur prévue, intervalle de prédiction et valeur saisie. */
export function rangeStrip({ mu0, lo, hi, value, unit, w = 440, h = 120 }) {
  const all = [mu0, lo, hi, value].filter((v) => v !== null && v !== undefined);
  const a = Math.min(...all), b = Math.max(...all), pad = (b - a) * 0.15 || 1;
  const ticks = niceTicks(a - pad, b + pad, 4, true);
  const p = new Plot(w, h, { l: 16, r: 16, t: 20, b: 22 }).sx(ticks[0], ticks[ticks.length - 1]).sy(0, 1);
  const yc = 56, bad = lo !== null && (value < lo || value > hi);
  p.add(`<line x1="${p.l}" x2="${w - p.r}" y1="${yc}" y2="${yc}" stroke="var(--grey)" stroke-width="1.5"/>`);
  if (lo !== null) p.add(`<rect x="${f1(p.X(lo))}" y="${yc - 20}" width="${f1(p.X(hi) - p.X(lo))}" height="40" rx="6" fill="${C.blue}" fill-opacity="0.16"/>`);
  p.add(`<line x1="${f1(p.X(mu0))}" x2="${f1(p.X(mu0))}" y1="${yc - 26}" y2="${yc + 26}" stroke="${C.ink}" stroke-width="2"/>`);
  p.text(p.X(mu0), 14, `Prévu ${nf(mu0, 1)}`, { cls: 'ti', anchor: 'middle', size: 12, weight: 600 });
  if (value !== null && value !== undefined) {
    p.add(`<circle cx="${f1(p.X(value))}" cy="${yc}" r="7" fill="${bad ? C.crit : C.aqua}" stroke="${RING}" stroke-width="2"/>`);
    p.text(Math.min(Math.max(p.X(value), 40), w - 40), 14, `Saisi : ${nf(value, 1)}`, { cls: 'ti', anchor: 'middle', size: 12, weight: 600 });
  }
  if (lo !== null) p.text(p.X((lo + hi) / 2), yc + 38, `IC 95 % : ${nf(lo, 0)} – ${nf(hi, 0)}`, { cls: 'ti', anchor: 'middle', size: 11.5, weight: 600 });
  for (const v of ticks) p.text(p.X(v), h - 4, nf(v, 0), { anchor: 'middle' });
  return p.svg(`Valeur saisie ${unit}`);
}

/* ───────────── Fiabilité ───────────── */
export function poissonChart(po, { w = 520, h = 320 }) {
  const n = po.k.length, ymax = Math.max(...po.observed, ...po.expected, 0.05) * 1.1, yt = niceTicks(0, ymax, 4, true);
  const p = new Plot(w, h, { l: 46, r: 14, t: 26, b: 44 }).sx(-0.6, n - 0.4).sy(0, yt[yt.length - 1]);
  p.gridy(yt, (v) => `${nf(v * 100, 0)} %`).baseline();
  po.observed.forEach((v, i) => p.vbar(i, v, Math.min(34, (w - 70) / n - 14), C.blue, null, 4, `${i === n - 1 ? n - 1 + ' et plus' : i} panne(s) : ${nf(v * 100, 0)} % des semaines`));
  const imax = po.observed.indexOf(Math.max(...po.observed));
  p.text(p.X(imax), p.Y(po.observed[imax]) - 8, `${nf(po.observed[imax] * 100, 0)} %`, { cls: 'ti', anchor: 'middle', size: 12, weight: 650 });
  p.line(po.k, po.expected, C.orange, 2);
  po.k.forEach((k, i) => p.dot(k, po.expected[i], C.orange, 4, RING, `Poisson : ${nf(po.expected[i] * 100, 1)} %`));
  po.k.forEach((k, i) => p.text(p.X(k), h - 24, i === n - 1 ? `${k}+` : String(k), { anchor: 'middle' }));
  p.text((p.l + w - p.r) / 2, h - 5, 'Nombre de pannes dans la semaine', { cls: 'ti', anchor: 'middle', size: 12, weight: 600 });
  return p.svg('Pannes par semaine : fréquences observées et loi de Poisson');
}

export function expChart(ex, mtbf, { w = 520, h = 320 }) {
  const nb = ex.counts.length, step = ex.bin, xmax = nb * step;
  const ymax = Math.max(...ex.counts, ...ex.expected, ex.n * step / mtbf, 1) * 1.1, yt = niceTicks(0, ymax, 4, true);
  const p = new Plot(w, h, { l: 40, r: 14, t: 26, b: 44 }).sx(0, xmax).sy(0, yt[yt.length - 1]);
  p.gridy(yt, (v) => nf(v, 0)).baseline();
  const bw = Math.max(6, Math.min(30, (w - 60) / nb - 4));
  ex.counts.forEach((c, i) => p.vbar((i + 0.5) * step, c, bw, C.blue, null, 4, `${nf(i * step, 0)} – ${nf((i + 1) * step, 0)} h : ${c} intervalle(s)`));
  const xs = Array.from({ length: 121 }, (_, i) => (xmax * i) / 120);
  p.line(xs, xs.map((x) => ex.n * step * Math.exp(-x / mtbf) / mtbf), C.orange, 2);
  p.vline(mtbf, C.ink, 1.5, p.Y(Math.min(yt[yt.length - 1], ex.n * step / mtbf * Math.exp(-1))) - 4, h - 44);
  p.text(p.X(mtbf) + 8, p.t + 4, `MTBF = ${nf(mtbf, 1)} h`, { cls: 'ti', size: 12, weight: 650 });
  for (const v of niceTicks(0, xmax, 6)) p.text(p.X(v), h - 24, nf(v, 0), { anchor: 'middle' });
  p.text((p.l + w - p.r) / 2, h - 5, 'Heures de marche entre deux pannes', { cls: 'ti', anchor: 'middle', size: 12, weight: 600 });
  return p.svg('Temps entre pannes : histogramme et loi exponentielle');
}

/* ───────────── Files d'attente ───────────── */
export function waitChart(curves, { lam, wq, c, w = 560, h = 340 }) {
  const lmax = curves.lam[curves.lam.length - 1], p = new Plot(w, h, { l: 40, r: 16, t: 24, b: 44 }).sx(0, lmax).sy(0, 30);
  p.gridy([0, 10, 20, 30]).baseline();
  const cols = [C.blue, C.orange, C.aqua];
  curves.series.forEach((s, i) => {
    const xs = [], ys = [];
    curves.lam.forEach((l, j) => { if (s.wq_min[j] !== null && s.wq_min[j] !== undefined) { xs.push(l); ys.push(s.wq_min[j]); } });
    if (xs.length > 1) p.line(xs, ys, cols[i % 3], 2);
    const k = Math.floor(xs.length * (i === 0 ? 0.82 : 0.9));
    if (xs.length) p.text(p.X(xs[Math.min(k, xs.length - 1)]) + (i === 0 ? -8 : -6), p.Y(ys[Math.min(k, ys.length - 1)]) - 6, `${s.c} poste${s.c > 1 ? 's' : ''}`, { cls: 'ti', size: 12, weight: 600, anchor: 'end' });
  });
  if (lam <= lmax) {
    p.vline(lam, C.ink, 1.5, 22);
    p.text(p.X(lam) + 6, 18, `Actuel : ${nf(lam, 1)} camions/h`, { cls: 'ti', size: 12, weight: 650 });
    curves.series.forEach((s, i) => {
      const j = curves.lam.findIndex((l) => Math.abs(l - lam) < 0.051);
      const v = j >= 0 ? s.wq_min[j] : null;
      if (v !== null && v !== undefined) p.dot(lam, v, cols[i % 3], 4.5, RING, `${s.c} poste(s) : ${nf(v, 1)} min`);
    });
  }
  for (const v of niceTicks(0, lmax, 7)) p.text(p.X(v), h - 24, nf(v, 0), { anchor: 'middle' });
  p.text((p.l + w - p.r) / 2, h - 5, 'Arrivées de camions par heure', { cls: 'ti', anchor: 'middle', size: 12, weight: 600 });
  return p.svg("Attente moyenne en file selon la cadence d'arrivée");
}

export function pnChart(pn, c, { w = 420, h = 320 }) {
  const ymax = Math.max(...pn, 0.05) * 1.12, yt = niceTicks(0, ymax, 4, true);
  const p = new Plot(w, h, { l: 46, r: 14, t: 18, b: 46 }).sx(-0.6, pn.length - 0.4).sy(0, yt[yt.length - 1]);
  p.gridy(yt, (v) => `${nf(v * 100, 0)} %`).baseline();
  pn.forEach((v, n) => p.vbar(n, v, Math.min(30, (w - 70) / pn.length - 8), n < c ? C.blue : C.orange, null, 4, `${n} camion(s) : ${nf(v * 100, 1)} %`));
  pn.forEach((_, n) => p.text(p.X(n), h - 26, String(n), { anchor: 'middle' }));
  p.text((p.l + w - p.r) / 2, h - 6, 'Camions présents au poste ou en file', { cls: 'ti', anchor: 'middle', size: 12, weight: 600 });
  return p.svg('Probabilité du nombre de camions sur le site');
}

const clock = (t) => `${Math.floor(t + 1e-9)}:${String(Math.round((t % 1) * 60)).padStart(2, '0')}`;
export function ganttChart(day, { w = 760 }) {
  const rows = day.trucks.length, rh = rows > 30 ? 14 : 20, top = 8, h = top + rows * rh + 34;
  const p = new Plot(w, h, { l: 80, r: 14, t: top, b: 34 }).sx(day.t0, day.t1 + 0.25).sy(0, rows);
  const ticks = []; for (let t = Math.ceil(day.t0 * 2) / 2; t <= day.t1 + 0.25; t += 0.5) ticks.push(t);
  p.gridx(ticks); ticks.forEach((t) => p.text(p.X(t), h - 12, clock(t), { anchor: 'middle' }));
  const cols = [C.blue, C.aqua, C.orange, C.violet, 'var(--blue500)'];
  day.trucks.forEach((tr, i) => {
    const y = top + i * rh + 3, hh = rh - 6, xa = p.X(tr.arrival), xs = p.X(tr.start), xe = p.X(tr.end);
    p.text(p.l - 8, y + hh / 2 + 4, `Camion ${tr.id}`, { cls: 't2', anchor: 'end', size: rh > 16 ? 11.5 : 10 });
    if (xs - xa > 0.8) p.add(`<rect x="${f1(xa)}" y="${y}" width="${f1(xs - xa)}" height="${hh}" rx="3" fill="var(--wait)"><title>Camion ${tr.id} : attente ${nf((tr.start - tr.arrival) * 60, 0)} min</title></rect>`);
    p.add(`<rect x="${f1(xs)}" y="${y}" width="${f1(Math.max(2, xe - xs))}" height="${hh}" rx="4" fill="${cols[tr.server % cols.length]}"><title>Camion ${tr.id} : déchargement au poste ${tr.server + 1}, ${nf((tr.end - tr.start) * 60, 0)} min</title></rect>`);
    const wait = (tr.start - tr.arrival) * 60;
    if (wait >= 10) p.text(xe + 8, y + hh / 2 + 4, `attente ${nf(wait, 0)} min`, { cls: 'ti', size: 11.5, weight: 600 });
  });
  return p.svg('Simulation de la matinée de coulage');
}

/** Barres hebdomadaires simples (pannes par semaine, etc.) */
export function weeklyBars(counts, { w = 520, h = 160, label = '' } = {}) {
  return spark(counts, { w, h, bars: true });
}
