/* Formats français : nombres, pourcentages, dates. */
const NNBSP = ' ';
const nfCache = new Map();
function nfFor(d) {
  if (!nfCache.has(d)) nfCache.set(d, new Intl.NumberFormat('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  return nfCache.get(d);
}
/** Nombre à d décimales (virgule décimale, espace fine pour les milliers). */
export function nf(x, d = 0) {
  if (x === null || x === undefined || Number.isNaN(x)) return '—';
  if (!Number.isFinite(x)) return x > 0 ? '+∞' : '−∞';
  const v = Math.abs(x) < 0.5 * Math.pow(10, -d) ? 0 : x;     // évite « −0,0 »
  return nfFor(d).format(v).replace('-', '−');
}
/** Pourcentage à partir d'une proportion (0,85 → « 85 % »). */
export const pct = (p, d = 0) => (p === null || p === undefined ? '—' : `${nf(p * 100, d)}${NNBSP}%`);
/** Écart relatif signé (−0,086 → « −8,6 % »). */
export const signedPct = (p, d = 1) => (p === null || p === undefined ? '—' : `${p > 0 ? '+' : ''}${nf(p * 100, d)}${NNBSP}%`);
export const signed = (x, d = 1) => (x === null || x === undefined ? '—' : `${x > 0 ? '+' : ''}${nf(x, d)}`);
/** Valeur de p : « < 0,001 » ou « 0,013 ». */
export const pval = (p) => (p === null || p === undefined ? '—' : p < 0.001 ? '< 0,001' : nf(p, 3));
/** Argent : « 1,84 M FCFA », « 460 000 FCFA ». */
export function money(x, cur = 'FCFA', compact = false) {
  if (x === null || x === undefined) return '—';
  if (compact && Math.abs(x) >= 1e6) return `${nf(x / 1e6, 2)}${NNBSP}M${NNBSP}${cur}`;
  return `${nf(x, 0)}${NNBSP}${cur}`;
}

/* ───────────────────────── dates (calendrier, jour entier) ───────────────────────── */
/** « 2026-10-21 » → Date (midi UTC : insensible aux fuseaux et à l'heure d'été). */
export function parseDate(s) {
  if (s instanceof Date) return new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate(), 12));
  const [y, m, d] = String(s).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12));
}
export const isoDate = (d) => d.toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(parseDate(d).getTime() + n * 86400000);
export const daysBetween = (a, b) => Math.round((parseDate(b) - parseDate(a)) / 86400000);
export function localTodayIso() {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
}
const dfLong = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const dfLongY = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dfShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const dfWeekday = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' });
const dfDow = new Intl.DateTimeFormat('fr-FR', { weekday: 'short', timeZone: 'UTC' });
export const dateLong = (d) => dfLong.format(parseDate(d));
export const dateFull = (d) => dfLongY.format(parseDate(d));
export const dateShort = (d) => dfShort.format(parseDate(d));
export const dateWeekday = (d) => { const s = dfWeekday.format(parseDate(d)); return s.charAt(0).toUpperCase() + s.slice(1); };
export const dow = (d) => dfDow.format(parseDate(d));
/** Numéro de semaine ISO. */
export function isoWeek(d) {
  const t = parseDate(d); const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3);
  const first = new Date(Date.UTC(t.getUTCFullYear(), 0, 4, 12));
  return 1 + Math.round(((t - first) / 86400000 - 3 + ((first.getUTCDay() + 6) % 7)) / 7);
}
/** Lundi de la semaine de d. */
export const mondayOf = (d) => addDays(d, -((parseDate(d).getUTCDay() + 6) % 7));
export function timeFmt(ts) {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function dateTimeFmt(ts) {
  const d = new Date(ts);
  return `${dateShort(isoDate(new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12))))} ${timeFmt(ts)}`;
}
/** Heures décimales (7,5) → « 07 h 30 ». */
export function hourFmt(h) {
  const total = Math.round(h * 60); const hh = Math.floor(total / 60), mm = total % 60;
  return `${String(hh).padStart(2, '0')} h${mm ? ' ' + String(mm).padStart(2, '0') : ''}`;
}
/** Durée relative courte (« il y a 2 h »). */
export function ago(ts, now = Date.now()) {
  const m = Math.max(0, Math.round((now - new Date(ts).getTime()) / 60000));
  if (m < 1) return "à l'instant";
  if (m < 60) return `il y a ${m} min`;
  if (m < 1440) return `il y a ${Math.round(m / 60)} h`;
  return `il y a ${Math.round(m / 1440)} j`;
}

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Lit un nombre saisi par l'utilisateur (virgule ou point). */
export function parseNum(s) {
  if (typeof s === 'number') return s;
  const v = String(s ?? '').replace(/\s| /g, '').replace(',', '.');
  if (v === '' || v === '-' || v === '.') return NaN;
  return Number(v);
}
