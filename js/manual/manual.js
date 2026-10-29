// Paramètres › Manuel d'utilisation/
import { store } from '../store.js';
import { ic, LOGO } from '../ui.js';
import { esc, dateFull, nf } from '../format.js';
import { ROLE_LABELS } from '../model.js';
import { Plot, C, niceTicks, rangeStrip, studentChart, ecdfChart, poissonChart } from '../charts.js';
import { montecarlo, lgamma, tPpf, reliability } from '../engine-local.js';
import { GROUPS, SECTIONS_1 } from './content.js';
import { SECTIONS_2 } from './content2.js';

export const APP_VERSION = '1.1';
export const PDF_URL = 'assets/manuel-utilisateur.pdf';
const SECTIONS = [...SECTIONS_1, ...SECTIONS_2];
/** Anciens noms de sections utilisés par les liens « Lire le manuel » des pages. */
const ALIASES = { files: 'm-files', modele: 'page-parametres', monte: 'm-monte', student: 'm-student', pert: 'm-pert', fiabilite: 'm-poisson' };

/* ───────────────────────── graphiques d'exemple ───────────────────────── */
function betaPdf(x, a, m, b) {
  const al = 1 + 4 * (m - a) / (b - a), be = 1 + 4 * (b - m) / (b - a);
  if (x <= a || x >= b) return 0;
  const lB = lgamma(al) + lgamma(be) - lgamma(al + be);
  return Math.exp((al - 1) * Math.log(x - a) + (be - 1) * Math.log(b - x) - lB - (al + be - 1) * Math.log(b - a));
}
function pertFigure() {
  const sets = [{ a: 6, m: 7, b: 8, c: C.grey, l: 'Serrée (6 – 7 – 8)' }, { a: 5, m: 7, b: 10, c: C.blue, l: 'Exemple (5 – 7 – 10)' }, { a: 3, m: 7, b: 16, c: C.orange, l: 'Étalée (3 – 7 – 16)' }];
  const xs = Array.from({ length: 161 }, (_, i) => 2 + (15 * i) / 160);
  const ys = sets.map((s) => xs.map((x) => betaPdf(x, s.a, s.m, s.b)));
  const ymax = Math.max(...ys.flat()) * 1.1, w = 560, h = 330;
  const p = new Plot(w, h, { l: 20, r: 16, t: 14, b: 68 }).sx(2, 17).sy(0, ymax);
  p.baseline();
  sets.forEach((s, i) => { p.area(xs, ys[i], 0, s.c, i === 1 ? 0.14 : 0.06).line(xs, ys[i], s.c, i === 1 ? 2.4 : 1.8); });
  p.vline(7, C.ink2, 1, 14, h - 68, '4 4');
  for (const v of niceTicks(2, 17, 5)) p.text(p.X(v), h - 50, nf(v, 0), { anchor: 'middle' });
  p.text((p.l + w - p.r) / 2, h - 32, 'Durée de la tâche (jours)', { cls: 'ti', anchor: 'middle', size: 12, weight: 600 });
  sets.forEach((s, i) => { const x = 20 + i * 178; p.add(`<rect x="${x}" y="${h - 15}" width="14" height="4" rx="2" fill="${s.c}"/>`); p.text(x + 20, h - 9, s.l, { size: 11.5 }); });
  return p.svg('Courbes Beta-PERT de trois tâches de durée probable 7 jours');
}
const EXAMPLE_TASKS = [
  { id: '1', name: 'Terrassement', a: 6, m: 8, b: 13, preds: [] },
  { id: '2', name: 'Fondations', a: 9, m: 12, b: 19, preds: ['1'] },
  { id: '3', name: 'Dalle R+1', a: 7, m: 9, b: 14, preds: ['2'] },
  { id: '4', name: 'Poteaux R+1', a: 6, m: 8, b: 12, preds: ['2'] },
  { id: '5', name: 'Dalle R+2', a: 7, m: 10, b: 15, preds: ['3', '4'] },
];
const FIGS = {
  range: () => rangeStrip({ mu0: 24, lo: 17, hi: 31, value: 28.5, unit: 'm³/j' }),
  range2: () => rangeStrip({ mu0: 24, lo: 17, hi: 31, value: 38, unit: 'm³/j' }),
  student: () => { const df = 11; return studentChart({ t: -3.1, df, tcrit: tPpf(0.975, df), alpha: 0.05, w: 520, h: 300 }); },
  mc: (today) => {
    const first = montecarlo({ tasks: EXAMPLE_TASKS, n: 4000, seed: 7 });
    const { days, probs } = first.ecdf;                       // échéance = le jour entier dont la probabilité est la plus proche de 85 %
    const target = days[probs.reduce((best, p, i) => (Math.abs(p - 0.85) < Math.abs(probs[best] - 0.85) ? i : best), 0)];
    const mc = montecarlo({ tasks: EXAMPLE_TASKS, n: 4000, seed: 7, target_day: target });
    return ecdfChart(mc, { today, targetDay: mc.target_day, w: 600, h: 320 });
  },
  pert: pertFigure,
  poisson: () => {
    const weekly = [0, 1, 2, 1, 0, 3, 1, 1, 2, 0, 1, 2, 1, 4, 1, 0, 2, 1, 1, 0, 2, 1, 3, 1, 0, 1, 2, 1, 1, 2, 0, 1, 1, 2, 3, 1];
    return poissonChart(reliability({ weekly_counts: weekly }).poisson, { w: 560, h: 320 });
  },
};

/* ───────────────────────── recherche : normalisation avec table de correspondance ───────────────────────── */
const MARKS = /[\u0300-\u036f]/g;
function norm(s) {
  let out = '';
  const map = [];
  for (let i = 0; i < s.length; i++) {
    let c = s[i];
    if (c === '’' || c === '‘') c = "'";
    else if (c === '\u00a0' || c === '\u202f' || c === '\u2009') c = ' ';
    const n = c.normalize('NFD').replace(MARKS, '').toLowerCase();
    for (let k = 0; k < n.length; k++) { out += n[k]; map.push(i); }
  }
  return { text: out, map };
}
const normText = (s) => norm(s).text;
const terms = (q) => normText(q).split(/\s+/).filter((t) => t.length >= 2);

function unmark(root) {
  root.querySelectorAll('mark.hit').forEach((m) => { m.replaceWith(document.createTextNode(m.textContent)); });
  root.normalize();
}
function highlight(root, ts) {
  if (!ts.length) return 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && !n.parentElement.closest('script,style,mark,svg') && n.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT) });
  const nodes = []; for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
  let count = 0;
  for (const node of nodes) {
    const { text, map } = norm(node.nodeValue), ranges = [];
    for (const t of ts) { for (let i = text.indexOf(t); i >= 0; i = text.indexOf(t, i + t.length)) ranges.push([map[i], map[i + t.length - 1] + 1]); }
    if (!ranges.length) continue;
    ranges.sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) { const l = merged[merged.length - 1]; if (l && r[0] <= l[1]) l[1] = Math.max(l[1], r[1]); else merged.push([...r]); }
    const frag = document.createDocumentFragment(); let pos = 0; const src = node.nodeValue;
    for (const [a, b] of merged) {
      if (a > pos) frag.append(src.slice(pos, a));
      const m = document.createElement('mark'); m.className = 'hit'; m.textContent = src.slice(a, b); frag.append(m); pos = b; count++;
    }
    if (pos < src.length) frag.append(src.slice(pos));
    node.replaceWith(frag);
  }
  return count;
}

/* ───────────────────────── affichage ───────────────────────── */
const getPref = (k, d) => { try { const v = localStorage.getItem(`Chantierpulse.manual.${k}`); return v === null ? d : v === '1'; } catch { return d; } };
const setPref = (k, v) => { try { localStorage.setItem(`Chantierpulse.manual.${k}`, v ? '1' : '0'); } catch { /* stockage indisponible */ } };
const href = (id) => `#/parametres/manuel?s=${encodeURIComponent(id)}`;

function resolveId(s) {
  if (!s) return null;
  const ids = new Set(SECTIONS.map((x) => x.id));
  return ids.has(s) ? s : ids.has(ALIASES[s]) ? ALIASES[s] : ids.has(`page-${s}`) ? `page-${s}` : ids.has(`m-${s}`) ? `m-${s}` : null;
}

export async function render(box, ctx) {
  const st = store.state, myRole = st.profile?.role || 'chef_chantier', today = store.today;
  const printing = ctx.query.print === '1';
  const hiddenForMe = SECTIONS.filter((s) => s.roles && !s.roles.includes(myRole));
  const S = { q: ctx.query.q || '', mine: printing ? ctx.query.all !== '1' : getPref('mine', true), target: resolveId(ctx.query.s) };
  const num = new Map(SECTIONS.map((s, i) => [s.id, i + 1]));
  const plain = new Map(SECTIONS.map((s) => { const d = document.createElement('div'); d.innerHTML = s.html; return [s.id, normText(`${s.title} ${s.keywords || ''} ${d.textContent}`)]; }));

  const secHtml = (s) => `<section id="sec-${s.id}" data-id="${s.id}" aria-labelledby="h-${s.id}">
      <h2 id="h-${s.id}"><span class="secnum">${num.get(s.id)}</span>${esc(s.title)}</h2>
      ${s.roles ? `<div class="roles"><span class="chip warn">${ic('lock', 13)}Réservé : ${s.roles.map((r) => esc(ROLE_LABELS[r] || r)).join(', ')}</span></div>` : ''}${s.html}</section>`;

  const tools = printing ? '' : `<div class="manual-tools no-print">
      <label class="search" for="mq">${ic('search', 16)}<input id="mq" type="search" placeholder="Rechercher dans le manuel" autocomplete="off" value="${esc(S.q)}" aria-label="Rechercher dans le manuel"></label>
      <span class="muted" id="mcount" role="status" aria-live="polite"></span>
      ${hiddenForMe.length ? `<label class="switch" style="margin-left:auto"><input type="checkbox" id="mine" ${S.mine ? 'checked' : ''}><i></i><span>Seulement ce qui concerne mon rôle</span></label>` : '<span style="margin-left:auto"></span>'}
      <a class="btn" id="pdf" href="${PDF_URL}" download="ChantierPulse-manuel-utilisateur.pdf">${ic('download', 16)}Télécharger en PDF</a>
      <button class="btn" id="prt" type="button">${ic('printer', 16)}Imprimer</button></div>`;

  const cover = `<div class="mancover"><div class="mc-logo">${LOGO}</div><h1>ChantierPulse</h1><div class="mc-sub">Manuel d’utilisation</div>
      <p>Suivi probabiliste de chantier : productivité, écarts, prévision de la date de fin, fiabilité des engins et files d’attente.</p>
      <div class="mc-meta">Version ${APP_VERSION} · ${esc(dateFull(today))}</div>
      <div class="mc-toc">${GROUPS.map((g) => `<div class="mc-grp">${esc(g)}</div>${SECTIONS.filter((s) => s.group === g && !(s.roles && !s.roles.includes(myRole) && S.mine)).map((s) => `<div class="mc-row"><span>${num.get(s.id)}</span>${esc(s.title)}</div>`).join('')}`).join('')}</div></div>`;

  box.innerHTML = `${tools}<div class="manual${printing ? ' printing' : ''}">
      <nav class="toc no-print" aria-label="Sommaire du manuel">${GROUPS.map((g) => `<div class="grp">${esc(g)}</div>${SECTIONS.filter((s) => s.group === g).map((s) => `<a href="${href(s.id)}" data-id="${s.id}">${esc(s.title)}</a>`).join('')}`).join('')}</nav>
      <article class="doc">${printing ? cover : ''}${SECTIONS.map(secHtml).join('')}<div class="empty" id="mnone" hidden><b>Aucun résultat</b>Essayez d’autres mots (par exemple « Student », « panne », « échéance »).</div></article></div>`;

  const q = (s) => box.querySelector(s), all = (s) => [...box.querySelectorAll(s)];
  const doc = q('.doc');

  // Tableaux : défilement horizontal sur petit écran (au lieu d'élargir la page)
  all('.doc table').forEach((t) => { const w = document.createElement('div'); w.className = 'tw'; t.replaceWith(w); w.append(t); });

  // Graphiques d'exemple
  all('[data-fig]').forEach((el) => {
    const sec = el.closest('section')?.dataset.id;
    const key = el.dataset.fig === 'range' && sec === 'm-atypique' ? 'range2' : el.dataset.fig;
    try { el.innerHTML = FIGS[key](today); } catch (e) { console.error('figure', key, e); el.innerHTML = ''; }
  });

  // Filtre (recherche + rôle)
  function apply() {
    unmark(doc);
    const ts = terms(S.q); let shown = 0, hits = 0;
    for (const s of SECTIONS) {
      const el = q(`#sec-${s.id}`), link = q(`.toc a[data-id="${s.id}"]`);
      const roleOk = !(S.mine && s.roles && !s.roles.includes(myRole));
      const textOk = ts.every((t) => plain.get(s.id).includes(t));
      const ok = roleOk && textOk;
      el.hidden = !ok; link.hidden = !ok; if (ok) shown++;
      if (ok && ts.length) { hits += highlight(el, ts); el.querySelectorAll('details.qa').forEach((d) => { d.open = !!d.querySelector('mark.hit'); }); }
    }
    all('.toc .grp').forEach((g) => { let n = g.nextElementSibling, any = false; while (n && !n.classList.contains('grp')) { if (!n.hidden) any = true; n = n.nextElementSibling; } g.hidden = !any; });
    q('#mnone').hidden = shown > 0;
    const c = q('#mcount'); if (c) c.textContent = ts.length ? (shown ? `${hits} occurrence${hits > 1 ? 's' : ''} dans ${shown} section${shown > 1 ? 's' : ''}` : '') : '';
    if (!ts.length) all('details.qa').forEach((d) => { d.open = false; });
  }
  apply();

  // Défilement vers une section sans relancer le routeur
  function goTo(id, push = true) {
    const el = q(`#sec-${id}`); if (!el || el.hidden) return false;
    el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    if (push) { try { history.replaceState(null, '', href(id)); } catch { /* ignoré */ } }
    mark(id); return true;
  }
  function mark(id) { all('.toc a').forEach((a) => { const on = a.dataset.id === id; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }
  box.querySelector('.toc')?.addEventListener('click', (e) => { const a = e.target.closest('a[data-id]'); if (a) { e.preventDefault(); goTo(a.dataset.id); } });

  // Surbrillance du sommaire au défilement
  if (!printing && 'IntersectionObserver' in window) {
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) { if (en.isIntersecting) seen.add(en.target.dataset.id); else seen.delete(en.target.dataset.id); }
      const first = SECTIONS.find((s) => seen.has(s.id)); if (first) mark(first.id);
    }, { rootMargin: '-90px 0px -65% 0px' });
    all('.doc section').forEach((s) => io.observe(s));
    ctx.onLeave(() => io.disconnect());
  }

  // Barre d'outils
  const mq = q('#mq');
  if (mq) {
    let t = null;
    mq.addEventListener('input', () => { clearTimeout(t); t = setTimeout(() => { S.q = mq.value; apply(); }, 120); });
    mq.addEventListener('keydown', (e) => { if (e.key === 'Escape' && mq.value) { mq.value = ''; S.q = ''; apply(); } });
  }
  q('#mine')?.addEventListener('change', (e) => { S.mine = e.target.checked; setPref('mine', S.mine); apply(); });
  q('#prt')?.addEventListener('click', () => window.print());
  const before = () => { S.saved = { q: S.q, mine: S.mine }; S.q = ''; apply(); all('details.qa').forEach((d) => { d.open = true; }); };
  const after = () => { if (S.saved) { S.q = S.saved.q; S.saved = null; apply(); } };
  window.addEventListener('beforeprint', before); window.addEventListener('afterprint', after);
  ctx.onLeave(() => { window.removeEventListener('beforeprint', before); window.removeEventListener('afterprint', after); });
  if (printing) all('details.qa').forEach((d) => { d.open = true; });

  // Arrivée sur une section précise
  if (S.target && !printing) requestAnimationFrame(() => goTo(S.target, false));
  else mark(SECTIONS.find((s) => !q(`#sec-${s.id}`).hidden)?.id);
  if (printing) document.title = 'ChantierPulse — Manuel d’utilisation';
  box.dataset.ready = '1';
}
