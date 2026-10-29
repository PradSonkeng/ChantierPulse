/* Saisie quotidienne : contexte du jour, rendements par activité, contrôle de cohérence (valeurs atypiques),
 * pannes et surcoûts du jour. Brouillon enregistré automatiquement ; pas à pas sur mobile. */
import { store } from '../store.js';
import { cached } from '../analysis.js';
import { rangeStrip } from '../charts.js';
import { ic, chip, toast, errorToast, confirmDialog, openModal } from '../ui.js';
import { pageHead, live } from './_common.js';
import { openFailureModal } from './failure-modal.js';
import { openCostModal } from './cost-modal.js';
import { nf, signedPct, money, esc, parseNum, dateWeekday, dateShort, dateLong, addDays, isoDate, timeFmt, isoWeek } from '../format.js';
import { WEATHER, COST_CATEGORIES, settingsOf, windowEntries, outlierHistory, isPending, ROLE_LABELS } from '../model.js';
import { go } from '../router.js';

const STEPS = ['Contexte', 'Productivité', 'Contrôle', 'Validation'];
const draftKey = (pid, d) => `Chantierpulse.draft.${pid}.${d}`;
const show = (v, d = 1) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '' : String(Math.round(Number(v) * 10 ** d) / 10 ** d).replace('.', ','));
const numOrNull = (s) => { const t = String(s ?? '').trim(); if (t === '') return null; const v = parseNum(t); return Number.isFinite(v) ? v : NaN; };
const stats = (xs) => {
  const n = xs.length; if (!n) return { n: 0, mean: null, sd: null, cv: null };
  const mean = xs.reduce((a, b) => a + b, 0) / n, sd = n > 1 ? Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : null;
  return { n, mean, sd, cv: sd !== null && mean ? sd / mean : null };
};
const qUnit = (u) => String(u || '').split('/')[0].trim();
const nameOf = (id) => store.state.profiles.find((p) => p.id === id)?.full_name || (id === store.state.user?.id ? store.state.profile?.full_name : '') || '';

export async function render(root, ctx) {
  const st = store.state, d0 = st.data;
  const settings = settingsOf(st.project), today = store.today;
  const wanted = /^\d{4}-\d{2}-\d{2}$/.test(ctx.query.d || '') ? ctx.query.d : today;
  const date = wanted > today ? today : wanted < st.project.start_date ? st.project.start_date : wanted;
  const acts = d0.activities.slice().sort((a, b) => a.sort_order - b.sort_order);

  if (!acts.length) {
    root.innerHTML = pageHead('Saisie quotidienne', esc(dateWeekday(date))) + `<div class="card"><div class="empty"><b>Aucune activité à suivre</b>Définissez d’abord les activités mesurées (coulage, ferraillage, coffrage…) avec leur rendement prévu.<br><br>${store.can('plan') ? `<a class="btn pri" href="#/parametres/activites">${ic('plus', 16)}Ajouter des activités</a>` : 'Demandez au conducteur de travaux de les définir (Paramètres › Activités).'}</div></div>`;
    return;
  }

  /* ───────────── état du formulaire ───────────── */
  const existingReport = () => d0.daily_reports.find((r) => r.report_date === date) || null;
  const existingEntry = (aid) => d0.productivity_entries.find((e) => e.activity_id === aid && e.entry_date === date) || null;
  const lastReport = d0.daily_reports.filter((r) => r.report_date < date).sort((a, b) => (a.report_date < b.report_date ? 1 : -1))[0] || null;

  function fromSaved() {
    const r = existingReport();
    const c = r ? { weather: r.weather, rain_mm: show(r.rain_mm), workers: show(r.workers, 0), workers_declared: show(r.workers_declared, 0), shift_hours: show(r.shift_hours ?? 9), lost_hours: show(r.lost_hours ?? 0), delivery_delay_hours: show(r.delivery_delay_hours ?? 0), trucks_received: show(r.trucks_received, 0), notes: r.notes || '' }
      : { weather: 'soleil', rain_mm: '0', workers: show(lastReport?.workers, 0), workers_declared: '', shift_hours: show(lastReport?.shift_hours ?? 9), lost_hours: '0', delivery_delay_hours: '0', trucks_received: '', notes: '' };
    const rows = {};
    for (const a of acts) {
      const e = existingEntry(a.id);
      rows[a.id] = e ? { quantity: show(e.quantity), hours: show(e.hours, 2), value: show(e.value), note: e.note || '', confirm: !!(e.flagged && e.reviewed) } : { quantity: '', hours: '', value: '', note: '', confirm: false };
    }
    return { ctx: c, rows };
  }
  let S = fromSaved(); let restored = false;
  try {
    const dr = JSON.parse(localStorage.getItem(draftKey(st.projectId, date)) || 'null');
    if (dr && dr.ctx && dr.rows) { S = { ctx: { ...S.ctx, ...dr.ctx }, rows: Object.fromEntries(acts.map((a) => [a.id, { ...S.rows[a.id], ...(dr.rows[a.id] || {}) }])) }; restored = true; }
  } catch { /* brouillon illisible : ignoré */ }
  S.focus = acts.find((a) => S.rows[a.id].value !== '')?.id || acts[0].id;
  S.step = 1; S.chk = {}; S.dirty = restored; S.saving = false;
  let chkToken = 0, draftTimer = null, chkTimer = null;

  const locked = (aid) => { const e = existingEntry(aid); return !!(e && !store.canEditRow(e)); };
  const reportLocked = () => { const r = existingReport(); return !!(r && !store.canEditRow(r)); };

  /* ───────────── gabarit ───────────── */
  const canCost = store.can('plan');
  const weatherPills = Object.entries(WEATHER).map(([k, w]) => `<button type="button" class="pill${S.ctx.weather === k ? ' on' : ''}" data-w="${k}" aria-pressed="${S.ctx.weather === k}">${ic(w.icon, 16)}${w.label}</button>`).join('');
  const inp = (k, label, unit, opts = {}) => `<div class="field"><label for="k-${k}">${label}</label><div class="inp${reportLocked() ? ' ro' : ''}"><input id="k-${k}" data-k="${k}" inputmode="${opts.int ? 'numeric' : 'decimal'}" value="${esc(S.ctx[k])}" ${reportLocked() ? 'disabled' : ''} autocomplete="off">${unit ? `<span class="u">${unit}</span>` : ''}</div>${opts.hint ? `<span class="hint" id="h-${k}">${opts.hint}</span>` : ''}</div>`;

  function rowHtml(a) {
    const r = S.rows[a.id], qu = qUnit(a.unit), lk = locked(a.id), hasHours = /\/h$/i.test(String(a.unit).trim());
    return `<div class="prow" data-row="${a.id}"><div class="pname"><b>${esc(a.name)}</b><span class="muted">Prévu : ${nf(a.planned_rate, 1)} ${esc(a.unit)}</span></div>
      ${hasHours ? `<div class="field"><label class="sr" for="q-${a.id}">Quantité (${esc(qu)})</label><div class="inp"><input id="q-${a.id}" data-a="${a.id}" data-f="quantity" inputmode="decimal" placeholder="Qté" value="${esc(r.quantity)}" ${lk ? 'disabled' : ''} autocomplete="off"><span class="u">${esc(qu)}</span></div></div>
      <div class="field"><label class="sr" for="t-${a.id}">Temps passé (h)</label><div class="inp"><input id="t-${a.id}" data-a="${a.id}" data-f="hours" inputmode="decimal" placeholder="Temps" value="${esc(r.hours)}" ${lk ? 'disabled' : ''} autocomplete="off"><span class="u">h</span></div></div>` : '<div></div><div></div>'}
      <div class="field"><label class="sr" for="v-${a.id}">Rendement (${esc(a.unit)})</label><div class="inp" id="iv-${a.id}"><input id="v-${a.id}" data-a="${a.id}" data-f="value" inputmode="decimal" placeholder="Rdt" value="${esc(r.value)}" ${lk ? 'disabled' : ''} autocomplete="off"><span class="u">${esc(a.unit)}</span></div></div>
      <div class="pchk" id="chk-${a.id}"></div></div>
      ${lk ? `<div class="prow-note muted">Saisie faite par ${esc(nameOf(existingEntry(a.id).created_by) || 'un autre utilisateur')} : seul son auteur ou le conducteur peut la modifier.</div>` : ''}`;
  }

  root.innerHTML = pageHead('Saisie quotidienne', `${esc(dateWeekday(date))} · Semaine ${isoWeek(date)} · ${esc(st.project.location || st.project.name)}`,
    `<div class="hstack" style="gap:8px"><button class="iconbtn" id="dprev" aria-label="Jour précédent" title="Jour précédent">${ic('arrowleft', 18)}</button>
      <label class="select" for="dsel">${ic('calendar', 16)}<input id="dsel" type="date" value="${date}" min="${st.project.start_date}" max="${today}" style="border:none;background:none;outline:none;font:inherit;font-weight:520"></label>
      <button class="iconbtn" id="dnext" aria-label="Jour suivant" title="Jour suivant" ${date >= today ? 'disabled' : ''}>${ic('chevright', 18)}</button>
      ${date !== today ? `<a class="btn sm" href="#/saisie">Aujourd’hui</a>` : ''}</div>`) +
    `<div class="stepbar card no-print" id="stepbar" style="padding:12px 14px"></div>
    <div class="grid g12" style="align-items:start">
      <div class="c7 stack" style="gap:20px">
        <section class="card step" data-step="1"><div class="ch"><div><h3>Contexte du jour</h3><div class="sub">Saisi par ${esc(st.profile?.full_name || '')} · ${esc(ROLE_LABELS[st.profile?.role] || '')}</div></div><div class="r"><span class="tag" id="draftmsg">${restored ? 'Brouillon restauré' : existingReport() ? 'Saisie déjà enregistrée' : 'Nouvelle saisie'}</span></div></div>
          <div class="stack" style="gap:16px">
            <div class="row r3 keep">${inp('workers', 'Effectif présent', 'pers.', { int: true })}${inp('workers_declared', 'Effectif déclaré', 'pers.', { int: true, hint: 'Pointage officiel (facultatif)' })}${inp('shift_hours', 'Heures de poste', 'h')}</div>
            <div class="field"><span class="lab">Météo</span><div class="pillrow" id="weather">${weatherPills}</div></div>
            <div class="row r4 keep">${inp('rain_mm', 'Pluie', 'mm')}${inp('lost_hours', 'Heures perdues', 'h')}${inp('delivery_delay_hours', 'Retard livraison', 'h')}${inp('trucks_received', 'Camions reçus', '', { int: true })}</div>
            <div class="field"><label for="k-notes">Remarques</label><textarea id="k-notes" data-k="notes" maxlength="600" placeholder="Événement notable de la journée (facultatif)" ${reportLocked() ? 'disabled' : ''}>${esc(S.ctx.notes)}</textarea></div>
          </div></section>
        <section class="card step" data-step="2"><div class="ch"><div><h3>Productivité par activité</h3><div class="sub">Saisissez la quantité et le temps : le rendement se calcule seul. Vous pouvez aussi taper directement le rendement.</div></div></div>
          <div class="prow hd" aria-hidden="true"><span>Activité</span><span>Quantité</span><span>Temps</span><span>Rendement</span><span>Contrôle</span></div>
          ${acts.map(rowHtml).join('')}</section>
      </div>
      <div class="c5 stack" style="gap:20px">
        <section class="card step" data-step="3" id="coh"></section>
        <section class="card step" data-step="3" id="eff"></section>
        <section class="card step" data-step="3" id="pan"></section>
        <section class="card step" data-step="3" id="cos"></section>
      </div>
    </div>
    <section class="card step recap" data-step="4" id="recap"></section>
    <div class="card no-print nosteps" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><div class="ink2" style="font-size:13px;flex:1;min-width:220px" id="savehint"></div>
      <button class="btn" id="resetbtn" type="button">${ic('refresh', 16)}Revenir aux valeurs enregistrées</button>
      <button class="btn pri lg" id="savebtn" type="button">${ic('save', 18)}Enregistrer la saisie</button></div>
    <div class="stepnav no-print" id="stepnav"><button class="btn lg" id="sprev" type="button">Précédent</button><button class="btn pri lg" id="snext" type="button">Suivant</button></div>
    <section class="card no-print" id="hist"></section>`;

  /* ───────────── mode « pas à pas » (mobile) ───────────── */
  const mq = window.matchMedia('(max-width:860px)');
  const applyMode = () => { document.body.classList.toggle('has-steps', mq.matches); paintSteps(); };
  mq.addEventListener('change', applyMode); ctx.onLeave(() => { mq.removeEventListener('change', applyMode); clearTimeout(draftTimer); clearTimeout(chkTimer); });
  function paintSteps() {
    root.querySelectorAll('.step').forEach((el) => el.classList.toggle('on', +el.dataset.step === S.step));
    root.querySelector('#stepbar').innerHTML = `<div class="hstack" style="justify-content:space-between"><b>Étape ${S.step} sur 4 · ${STEPS[S.step - 1]}</b><span class="muted" style="font-size:12.5px">${esc(dateShort(date))}</span></div>
      <div class="segbar">${STEPS.map((_, i) => `<i class="${i < S.step ? 'on' : ''}"></i>`).join('')}</div>`;
    const prev = root.querySelector('#sprev'), next = root.querySelector('#snext');
    prev.style.visibility = S.step === 1 ? 'hidden' : 'visible';
    next.innerHTML = S.step === 4 ? `${ic('save', 18)}Enregistrer` : 'Suivant';
    if (S.step === 4) paintRecap();
  }
  root.querySelector('#sprev').onclick = () => { S.step = Math.max(1, S.step - 1); paintSteps(); window.scrollTo({ top: 0 }); };
  root.querySelector('#snext').onclick = () => { if (S.step === 4) submit(); else { S.step++; paintSteps(); window.scrollTo({ top: 0 }); } };

  /* ───────────── calculs ───────────── */
  const actOf = (id) => acts.find((a) => a.id === id);
  const valueOf = (aid) => numOrNull(S.rows[aid].value);
  const histFor = (a) => outlierHistory(d0.productivity_entries, a.id, date, settings.window_days, existingEntry(a.id)?.id || null);

  async function refreshChecks() {
    const my = ++chkToken;
    await Promise.all(acts.map(async (a) => {
      const v = valueOf(a.id);
      if (v === null || !(v >= 0)) { S.chk[a.id] = { value: v, res: null }; return; }
      try { const { result } = await cached('outlier', { history: histFor(a), value: v, level: settings.outlier_level }); S.chk[a.id] = { value: v, res: result }; }
      catch (e) { S.chk[a.id] = { value: v, res: null, error: e.message }; }
    }));
    if (my !== chkToken || !root.isConnected) return;
    paintChecks(); paintSide();
  }
  const scheduleChecks = () => { clearTimeout(chkTimer); chkTimer = setTimeout(() => refreshChecks().catch(errorToast), 160); };

  function verdictOf(a) {
    const c = S.chk[a.id], v = valueOf(a.id), r = S.rows[a.id];
    if (v === null) return { kind: 'empty' };
    if (Number.isNaN(v) || v < 0) return { kind: 'bad' };
    if (!c || !c.res) return { kind: c?.error ? 'err' : 'wait' };
    if (!c.res.enough_data) return { kind: 'few', n: c.res.n };
    return c.res.is_outlier ? { kind: 'out', res: c.res, confirmed: r.confirm } : { kind: 'ok', res: c.res };
  }
  function paintChecks() {
    for (const a of acts) {
      const el = root.querySelector(`#chk-${a.id}`); if (!el) continue;
      const vd = verdictOf(a), r = S.rows[a.id];
      let h = '';
      if (vd.kind === 'empty') h = '<span class="muted">À saisir</span>';
      else if (vd.kind === 'bad') h = chip('crit', 'alert', 'Valeur invalide');
      else if (vd.kind === 'wait') h = '<span class="muted">Contrôle…</span>';
      else if (vd.kind === 'err') h = chip('neutral', 'info', 'Contrôle indisponible');
      else if (vd.kind === 'few') h = chip('neutral', 'info', `Historique court (${vd.n})`);
      else if (vd.kind === 'ok') h = chip('good', 'check', 'Dans l’intervalle');
      else h = `${chip('warn', 'alert', 'Atypique')}<label class="check" style="margin-top:6px;font-size:12.5px"><input type="checkbox" data-a="${a.id}" data-f="confirm" ${r.confirm ? 'checked' : ''}>Je confirme cette valeur</label>`;
      el.innerHTML = h;
      const box = root.querySelector(`#iv-${a.id}`); if (box) { box.classList.toggle('warn', vd.kind === 'out'); box.classList.toggle('bad', vd.kind === 'bad'); }
    }
  }

  function coherenceItems() {
    const c = S.ctx, items = [];
    const w = numOrNull(c.workers), wd = numOrNull(c.workers_declared), sh = numOrNull(c.shift_hours), lost = numOrNull(c.lost_hours), rain = numOrNull(c.rain_mm);
    if (w !== null && wd !== null) items.push(w <= wd ? ['good', `Effectif présent (${nf(w, 0)}) ≤ effectif déclaré (${nf(wd, 0)}).`] : ['warn', `Effectif présent (${nf(w, 0)}) supérieur à l’effectif déclaré (${nf(wd, 0)}) : vérifiez le pointage.`]);
    if (sh !== null && lost !== null) items.push(lost <= sh ? ['good', `Heures perdues (${nf(lost, 1)} h) dans la durée du poste (${nf(sh, 1)} h).`] : ['crit', `Heures perdues (${nf(lost, 1)} h) supérieures à la durée du poste (${nf(sh, 1)} h).`]);
    if (c.weather === 'soleil' && rain > 5) items.push(['warn', `Météo « ensoleillé » mais ${nf(rain, 1)} mm de pluie : corrigez l’un des deux.`]);
    if ((c.weather === 'pluie' || c.weather === 'forte_pluie') && rain === 0) items.push(['info', 'Météo pluvieuse sans hauteur de pluie : renseignez les millimètres si vous les connaissez.']);
    for (const a of acts) {
      const r = S.rows[a.id], h = numOrNull(r.hours), v = valueOf(a.id);
      if (h !== null && sh !== null && h > sh) items.push(['warn', `${a.name} : ${nf(h, 1)} h de travail déclarées pour un poste de ${nf(sh, 1)} h.`]);
      if (v !== null && v >= 0 && v > 3 * a.planned_rate) items.push(['warn', `${a.name} : ${nf(v, 1)} ${a.unit} est plus de 3 fois le rendement prévu. Unité correcte ?`]);
      const vd = verdictOf(a);
      if (vd.kind === 'ok') items.push(['good', `${a.name} : ${nf(v, 1)} ${a.unit}, dans l’intervalle de prédiction à ${nf(settings.outlier_level * 100, 0)} % (${nf(vd.res.lo, 0)} – ${nf(vd.res.hi, 0)}).`]);
      if (vd.kind === 'out') items.push([vd.confirmed ? 'info' : 'warn', `${a.name} : ${nf(v, 1)} ${a.unit} hors de l’intervalle (${nf(vd.res.lo, 0)} – ${nf(vd.res.hi, 0)}). ${vd.confirmed ? 'Valeur confirmée : elle sera prise en compte.' : 'Confirmez-la ou corrigez-la.'}`]);
    }
    return items;
  }
  const lawStats = (a) => {
    const base = windowEntries(d0.productivity_entries, a.id, date, settings.window_days).filter((e) => e.id !== existingEntry(a.id)?.id).map((e) => Number(e.value));
    const v = valueOf(a.id);
    return { before: stats(base), after: v !== null && v >= 0 ? stats([...base, v]) : null };
  };

  function paintSide() {
    const a = actOf(S.focus), vd = verdictOf(a), v = valueOf(a.id), items = coherenceItems();
    const tabs = acts.length > 1 ? `<div class="tabs" style="margin-bottom:12px" role="tablist">${acts.map((x) => `<button type="button" role="tab" data-focus="${x.id}" class="${x.id === S.focus ? 'on' : ''}">${esc(x.name.replace(/\s*\(.*\)/, ''))}</button>`).join('')}</div>` : '';
    const strip = vd.res && vd.res.enough_data && v !== null && v >= 0
      ? `<div class="chartbox">${rangeStrip({ mu0: a.planned_rate, lo: vd.res.lo, hi: vd.res.hi, value: v, unit: a.unit, w: 440, h: 118 })}</div>`
      : `<div class="muted" style="font-size:13px;padding:6px 0 10px">${v === null ? `Saisissez un rendement pour ${esc(a.name)} pour le comparer à l’historique.` : 'Pas assez de relevés (5 minimum) pour tracer l’intervalle de prédiction.'}</div>`;
    root.querySelector('#coh').innerHTML = `<div class="ch"><div><h3>Contrôle de cohérence</h3><div class="sub">Comparaison avec l’historique récent (intervalle de prédiction à ${nf(settings.outlier_level * 100, 0)} %)</div></div></div>${tabs}${strip}
      <div class="stack" style="gap:8px;margin-top:6px">${items.length ? items.map(([k, t]) => `<div class="note ${k === 'good' ? 'good' : k === 'crit' ? 'crit' : k === 'warn' ? 'warn' : 'info'}">${ic(k === 'good' ? 'check' : k === 'info' ? 'info' : 'alert', 17)}<div>${esc(t)}</div></div>`).join('') : '<div class="muted" style="font-size:13px">Les contrôles apparaîtront au fil de la saisie.</div>'}</div>`;
    root.querySelectorAll('[data-focus]').forEach((b) => { b.onclick = () => { S.focus = b.dataset.focus; paintSide(); }; });

    const { before, after } = lawStats(a), cell = (x, d, f = nf) => (x === null || x === undefined ? '—' : f(x, d));
    const dl = (x, y, pctMode) => (x === null || y === null || x === undefined || y === undefined ? '' : `<span class="muted"> → </span><b>${pctMode ? `${nf(y * 100, 0)} %` : nf(y, 1)}</b>`);
    root.querySelector('#eff').innerHTML = `<div class="ch"><div><h3>Effet sur la loi de productivité</h3><div class="sub">${esc(a.name)} · ${settings.window_days} derniers jours</div></div></div>
      <table><thead><tr><th>Indicateur</th><th class="num">Avant</th><th class="num">Avec la saisie</th></tr></thead><tbody>
      <tr><td>Moyenne μ̂ <span class="muted">(${esc(a.unit)})</span></td><td class="num">${cell(before.mean, 1)}</td><td class="num"><b>${after ? cell(after.mean, 1) : '—'}</b></td></tr>
      <tr><td>Écart-type σ̂</td><td class="num">${cell(before.sd, 1)}</td><td class="num"><b>${after ? cell(after.sd, 1) : '—'}</b></td></tr>
      <tr><td>Coefficient de variation</td><td class="num">${before.cv === null ? '—' : `${nf(before.cv * 100, 0)} %`}</td><td class="num"><b>${after && after.cv !== null ? `${nf(after.cv * 100, 0)} %` : '—'}</b></td></tr>
      <tr><td>Relevés utilisés</td><td class="num">${before.n}</td><td class="num"><b>${after ? after.n : '—'}</b></td></tr></tbody></table>
      <div class="muted" style="font-size:12.5px;margin-top:8px">Une valeur atypique non confirmée n’entre pas dans les statistiques tant qu’elle n’est pas validée.</div>`;
  }

  /* ───────────── pannes, surcoûts, historique ───────────── */
  const eqName = (id) => d0.equipment.find((e) => e.id === id)?.name || 'Engin';
  function paintLists() {
    const fails = d0.failures.filter((f) => f.occurred_at.slice(0, 10) === date).sort((a, b) => (a.occurred_at < b.occurred_at ? -1 : 1));
    root.querySelector('#pan').innerHTML = `<div class="ch"><div><h3>Pannes du jour</h3><div class="sub">${fails.length ? `${fails.length} panne${fails.length > 1 ? 's' : ''} déclarée${fails.length > 1 ? 's' : ''}` : 'Aucune panne déclarée'}</div></div><div class="r"><button class="btn sm" id="addfail" type="button">${ic('plus', 15)}Déclarer une panne</button></div></div>
      ${fails.length ? `<div class="stack" style="gap:0">${fails.map((f) => `<div class="li"><div style="min-width:0"><b>${esc(eqName(f.equipment_id))}</b><div class="muted" style="font-size:12.5px">${esc(f.occurred_at.slice(11, 16))} · arrêt ${nf(f.downtime_hours * 60, 0)} min${f.cause ? ` · ${esc(f.cause)}` : ''}${Number(f.repair_cost) > 0 ? ` · ${esc(money(f.repair_cost, st.project.currency))}` : ''}</div></div>
        ${store.canEditRow(f) ? `<div class="hstack" style="gap:4px"><button class="iconbtn sm" data-editfail="${f.id}" aria-label="Modifier">${ic('edit', 15)}</button><button class="iconbtn sm" data-delfail="${f.id}" aria-label="Supprimer">${ic('trash', 15)}</button></div>` : ''}</div>`).join('')}</div>` : ''}`;
    root.querySelector('#addfail').onclick = () => openFailureModal({ date });
    root.querySelectorAll('[data-editfail]').forEach((b) => { b.onclick = () => openFailureModal({ date, failure: d0.failures.find((f) => f.id === b.dataset.editfail) }); });
    root.querySelectorAll('[data-delfail]').forEach((b) => { b.onclick = () => removeRow('failures', b.dataset.delfail, 'cette panne'); });

    const costs = d0.cost_events.filter((c) => c.event_date === date);
    root.querySelector('#cos').innerHTML = `<div class="ch"><div><h3>Surcoûts du jour</h3><div class="sub">${costs.length ? `${esc(money(costs.reduce((s, c) => s + Number(c.amount), 0), st.project.currency))} au total` : 'Aucun surcoût enregistré'}</div></div>${canCost ? `<div class="r"><button class="btn sm" id="addcost" type="button">${ic('plus', 15)}Ajouter</button></div>` : ''}</div>
      ${costs.length ? `<div class="stack" style="gap:0">${costs.map((c) => `<div class="li"><div style="min-width:0"><b>${esc(c.label)}</b><div class="muted" style="font-size:12.5px">${esc(COST_CATEGORIES[c.category] || c.category)}${c.task_code ? ` · ${esc(c.task_code)}` : ''} · ${esc(money(c.amount, st.project.currency))}</div></div>
        ${canCost ? `<div class="hstack" style="gap:4px"><button class="iconbtn sm" data-editcost="${c.id}" aria-label="Modifier">${ic('edit', 15)}</button><button class="iconbtn sm" data-delcost="${c.id}" aria-label="Supprimer">${ic('trash', 15)}</button></div>` : ''}</div>`).join('')}</div>` : ''}
      ${canCost ? '' : '<div class="muted" style="font-size:12.5px">Les surcoûts sont saisis par le conducteur de travaux ou la direction.</div>'}`;
    const ac = root.querySelector('#addcost'); if (ac) ac.onclick = () => openCostModal({ date });
    root.querySelectorAll('[data-editcost]').forEach((b) => { b.onclick = () => openCostModal({ cost: d0.cost_events.find((c) => c.id === b.dataset.editcost) }); });
    root.querySelectorAll('[data-delcost]').forEach((b) => { b.onclick = () => removeRow('cost_events', b.dataset.delcost, 'ce surcoût'); });

    paintHistory();
  }
  async function removeRow(table, id, what) {
    if (!(await confirmDialog(`Supprimer ${what} ? Cette action est définitive.`, { title: 'Supprimer', ok: 'Supprimer', danger: true }))) return;
    try { await store.remove(table, id); toast('Supprimé.', 'ok'); } catch (e) { errorToast(e); }
  }

  function statusChip(e) {
    if (e.excluded) return chip('neutral', 'x', 'Écartée');
    if (isPending(e)) return chip('warn', 'alert', 'À valider');
    if (e.flagged) return chip('info', 'check', 'Atypique confirmée');
    return chip('good', 'check', 'Retenue');
  }
  function paintHistory() {
    const rows = d0.productivity_entries.slice().sort((a, b) => (a.entry_date === b.entry_date ? (a.activity_id < b.activity_id ? -1 : 1) : a.entry_date < b.entry_date ? 1 : -1)).slice(0, 14);
    const pend = d0.productivity_entries.filter(isPending).length;
    root.querySelector('#hist').innerHTML = `<div class="ch"><div><h3>Dernières saisies</h3><div class="sub">${pend ? `${pend} valeur${pend > 1 ? 's' : ''} atypique${pend > 1 ? 's' : ''} en attente de validation` : 'Toutes les valeurs sont validées'}</div></div></div>
      <div class="tw"><table><thead><tr><th>Date</th><th>Activité</th><th class="num">Rendement</th><th class="num">Écart / prévu</th><th>Statut</th><th>Saisi par</th><th></th></tr></thead><tbody>
      ${rows.map((e) => { const a = actOf(e.activity_id) || { name: '?', unit: '', planned_rate: 0 }; const gap = a.planned_rate ? (Number(e.value) - a.planned_rate) / a.planned_rate : null;
        return `<tr><td>${esc(dateShort(e.entry_date))}</td><td>${esc(a.name)}</td><td class="num"><b>${nf(e.value, 1)}</b> <span class="muted">${esc(a.unit)}</span></td><td class="num ${gap !== null && gap < -0.05 ? '' : 'm'}" style="${gap !== null && gap < -0.05 ? 'color:var(--crittxt)' : ''}">${signedPct(gap, 0)}</td><td>${statusChip(e)}</td><td class="m">${esc(nameOf(e.created_by) || '—')}</td>
        <td><div class="hstack" style="gap:2px;justify-content:flex-end;flex-wrap:nowrap">${store.canEditRow(e) ? `${isPending(e) ? `<button class="btn sm" data-ok="${e.id}" type="button" title="Conserver cette valeur dans les statistiques">Valider</button>` : ''}
          <button class="iconbtn sm" data-edit="${e.id}" aria-label="Modifier cette saisie" title="Modifier">${ic('edit', 15)}</button>
          <button class="iconbtn sm" data-excl="${e.id}" aria-label="${e.excluded ? 'Réintégrer' : 'Écarter des statistiques'}" title="${e.excluded ? 'Réintégrer dans les statistiques' : 'Écarter des statistiques'}">${ic(e.excluded ? 'refresh' : 'x', 15)}</button>
          <button class="iconbtn sm" data-del="${e.id}" aria-label="Supprimer" title="Supprimer">${ic('trash', 15)}</button>` : ''}</div></td></tr>`; }).join('') || '<tr><td colspan="7" class="muted">Aucune saisie pour le moment.</td></tr>'}</tbody></table></div>`;
    root.querySelectorAll('[data-ok]').forEach((b) => { b.onclick = async () => { try { const e = d0.productivity_entries.find((x) => x.id === b.dataset.ok); await store.save('productivity_entries', { ...e, reviewed: true }); toast('Valeur validée : elle compte désormais dans les statistiques.', 'ok'); } catch (er) { errorToast(er); } }; });
    root.querySelectorAll('[data-excl]').forEach((b) => { b.onclick = async () => { try { const e = d0.productivity_entries.find((x) => x.id === b.dataset.excl); await store.save('productivity_entries', { ...e, excluded: !e.excluded }); toast(e.excluded ? 'Valeur réintégrée.' : 'Valeur écartée des statistiques.', 'ok'); } catch (er) { errorToast(er); } }; });
    root.querySelectorAll('[data-del]').forEach((b) => { b.onclick = () => removeRow('productivity_entries', b.dataset.del, 'cette saisie'); });
    root.querySelectorAll('[data-edit]').forEach((b) => { b.onclick = () => { const e = d0.productivity_entries.find((x) => x.id === b.dataset.edit); go(`/saisie?d=${e.entry_date}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }; });
  }

  /* ───────────── récapitulatif (étape 4) et indications ───────────── */
  function paintRecap() {
    const c = S.ctx, vals = acts.map((a) => [a, valueOf(a.id), verdictOf(a)]).filter(([, v]) => v !== null);
    const fails = d0.failures.filter((f) => f.occurred_at.slice(0, 10) === date).length;
    root.querySelector('#recap').innerHTML = `<div class="ch"><div><h3>Récapitulatif</h3><div class="sub">${esc(dateLong(date))}</div></div></div>
      <div class="stack" style="gap:8px;font-size:14px"><div class="li"><span class="ink2">Effectif présent</span><b>${c.workers || '—'}${c.workers_declared ? ` / ${esc(c.workers_declared)} déclarés` : ''}</b></div>
      <div class="li"><span class="ink2">Météo</span><b>${esc(WEATHER[c.weather]?.label || '')}${c.rain_mm && c.rain_mm !== '0' ? ` · ${esc(c.rain_mm)} mm` : ''}</b></div>
      <div class="li"><span class="ink2">Heures de poste / perdues</span><b>${esc(c.shift_hours || '—')} h / ${esc(c.lost_hours || '0')} h</b></div>
      ${vals.map(([a, v, vd]) => `<div class="li"><span>${esc(a.name)}</span><span><b>${Number.isNaN(v) ? '—' : nf(v, 1)}</b> <span class="muted">${esc(a.unit)}</span> ${vd.kind === 'out' ? chip('warn', 'alert', vd.confirmed ? 'Confirmée' : 'À valider') : vd.kind === 'ok' ? chip('good', 'check', 'OK') : ''}</span></div>`).join('') || '<div class="muted">Aucune valeur de productivité saisie.</div>'}
      <div class="li"><span class="ink2">Pannes déclarées</span><b>${fails}</b></div></div>`;
  }
  function paintHint() {
    const el = root.querySelector('#savehint'); if (!el) return;
    const out = acts.filter((a) => verdictOf(a).kind === 'out' && !S.rows[a.id].confirm).length;
    el.innerHTML = out ? `${ic('alert', 15)} ${out} valeur${out > 1 ? 's' : ''} atypique${out > 1 ? 's' : ''} non confirmée${out > 1 ? 's' : ''} : ${out > 1 ? 'elles seront enregistrées « à valider »' : 'elle sera enregistrée « à valider »'} et ne compteront pas dans les statistiques avant validation.`
      : 'Les valeurs conformes à l’historique sont enregistrées directement.';
    if (store.state.pending) el.innerHTML += `<br><span class="muted">${store.state.pending} saisie(s) en attente d’envoi (hors connexion).</span>`;
  }

  /* ───────────── brouillon ───────────── */
  function saveDraft() {
    try {
      localStorage.setItem(draftKey(st.projectId, date), JSON.stringify({ ctx: S.ctx, rows: S.rows, ts: Date.now() }));
      const m = root.querySelector('#draftmsg'); if (m) m.textContent = `Brouillon enregistré à ${timeFmt(Date.now())}`;
    } catch { /* stockage indisponible : la saisie reste à l'écran */ }
  }
  const touched = () => { S.dirty = true; clearTimeout(draftTimer); draftTimer = setTimeout(saveDraft, 500); paintHint(); };

  /* ───────────── événements du formulaire ───────────── */
  function syncValueFromQH(aid) {
    const r = S.rows[aid], q = numOrNull(r.quantity), h = numOrNull(r.hours);
    if (q !== null && h !== null && q >= 0 && h > 0) { r.value = show(q / h); const el = root.querySelector(`#v-${aid}`); if (el) el.value = r.value; }
  }
  root.addEventListener('input', (ev) => {
    const t = ev.target;
    if (t.dataset.k) { S.ctx[t.dataset.k] = t.value; touched(); paintSide(); return; }
    if (t.dataset.a && t.dataset.f) {
      const f = t.dataset.f, aid = t.dataset.a;
      if (f === 'confirm') { S.rows[aid].confirm = t.checked; paintChecks(); paintSide(); touched(); return; }
      S.rows[aid][f] = t.value; S.focus = aid;
      if (f === 'quantity' || f === 'hours') syncValueFromQH(aid);
      if (f === 'value') { /* saisie directe du rendement */ }
      S.rows[aid].confirm = false; touched(); paintChecks(); scheduleChecks();
    }
  });
  root.addEventListener('change', (ev) => { if (ev.target.dataset.f === 'confirm') { S.rows[ev.target.dataset.a].confirm = ev.target.checked; paintChecks(); paintSide(); touched(); } });
  root.addEventListener('focusin', (ev) => { const aid = ev.target.dataset?.a; if (aid && aid !== S.focus) { S.focus = aid; paintSide(); } });
  root.querySelector('#weather').addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-w]'); if (!b || reportLocked()) return;
    S.ctx.weather = b.dataset.w; root.querySelectorAll('#weather .pill').forEach((p) => { p.classList.toggle('on', p === b); p.setAttribute('aria-pressed', String(p === b)); });
    touched(); paintSide();
  });
  const moveDate = (n) => go(`/saisie?d=${isoDate(addDays(date, n))}`);
  root.querySelector('#dprev').onclick = () => moveDate(-1);
  root.querySelector('#dnext').onclick = () => moveDate(1);
  root.querySelector('#dsel').onchange = (e) => { if (e.target.value) go(`/saisie?d=${e.target.value}`); };
  root.querySelector('#resetbtn').onclick = async () => {
    if (!(await confirmDialog('Abandonner les modifications non enregistrées de cette journée ?', { title: 'Revenir aux valeurs enregistrées', ok: 'Revenir' }))) return;
    try { localStorage.removeItem(draftKey(st.projectId, date)); } catch { /* ignoré */ }
    ctx.rerender();
  };
  root.querySelector('#savebtn').onclick = () => submit();

  /* ───────────── enregistrement ───────────── */
  async function submit() {
    if (S.saving) return;
    S.saving = true; const btns = root.querySelectorAll('#savebtn, #snext'); btns.forEach((b) => { b.disabled = true; });
    try {
      const c = S.ctx, pick = (k, int = false) => { const v = numOrNull(c[k]); if (Number.isNaN(v) || (v !== null && (v < 0 || (int && !Number.isInteger(v))))) throw new Error(`Valeur invalide : ${({ workers: 'effectif présent', workers_declared: 'effectif déclaré', shift_hours: 'heures de poste', rain_mm: 'pluie', lost_hours: 'heures perdues', delivery_delay_hours: 'retard de livraison', trucks_received: 'camions reçus' })[k]}.`); return v; };
      const rep = { workers: pick('workers', true), workers_declared: pick('workers_declared', true), shift_hours: pick('shift_hours'), rain_mm: pick('rain_mm') ?? 0, lost_hours: pick('lost_hours') ?? 0, delivery_delay_hours: pick('delivery_delay_hours') ?? 0, trucks_received: pick('trucks_received', true) };
      if (rep.shift_hours !== null && (rep.shift_hours <= 0 || rep.shift_hours > 24)) throw new Error('Les heures de poste doivent être comprises entre 0 et 24.');
      if (rep.lost_hours > 24 || (rep.shift_hours !== null && rep.lost_hours > rep.shift_hours)) throw new Error('Les heures perdues dépassent la durée du poste.');
      const entries = [];
      for (const a of acts) {
        if (locked(a.id)) continue;
        const r = S.rows[a.id], v = valueOf(a.id);
        if (v === null) continue;
        if (Number.isNaN(v) || v < 0) throw new Error(`Rendement invalide pour « ${a.name} ».`);
        const q = numOrNull(r.quantity), h = numOrNull(r.hours);
        if (Number.isNaN(q) || Number.isNaN(h) || (q !== null && q < 0) || (h !== null && h <= 0)) throw new Error(`Quantité ou temps invalide pour « ${a.name} ».`);
        await refreshChecksFor(a);
        const vd = verdictOf(a), ex = existingEntry(a.id);
        let flagged = vd.kind === 'out', reviewed = flagged && !!r.confirm;
        if (ex && Number(ex.value) === v) { flagged = flagged || ex.flagged; reviewed = flagged ? (ex.reviewed || reviewed) : false; }
        entries.push({ a, row: { ...(ex ? { id: ex.id } : {}), activity_id: a.id, entry_date: date, value: Math.round(v * 1000) / 1000, quantity: q, hours: h, crew: ex?.crew ?? rep.workers ?? null, note: r.note || '', flagged, reviewed, excluded: ex ? !!ex.excluded : false } });
      }
      if (!entries.length && rep.workers === null && !existingReport()) throw new Error('Rien à enregistrer : saisissez au moins un rendement ou l’effectif du jour.');
      const pending = entries.filter((e) => e.row.flagged && !e.row.reviewed);
      if (pending.length) {
        const ok = await confirmDialog(`${pending.length > 1 ? 'Ces valeurs semblent atypiques' : 'Cette valeur semble atypique'} : <b>${pending.map((p) => `${esc(p.a.name)} (${nf(p.row.value, 1)} ${esc(p.a.unit)})`).join(', ')}</b>.<br><br>Elle${pending.length > 1 ? 's seront enregistrées' : ' sera enregistrée'} « à valider » et ne ${pending.length > 1 ? 'compteront' : 'comptera'} dans les statistiques qu’après validation. Pour la${pending.length > 1 ? 's' : ''} conserver tout de suite, cochez « Je confirme cette valeur ».`, { title: 'Valeur atypique', ok: 'Enregistrer quand même' });
        if (!ok) { S.saving = false; btns.forEach((b) => { b.disabled = false; }); return; }
      }
      let queued = 0;
      if (!reportLocked()) { const ex = existingReport(); const s = await store.save('daily_reports', { ...(ex ? { id: ex.id } : {}), report_date: date, weather: c.weather, ...rep, notes: c.notes.trim() }); if (s._queued) queued++; }
      for (const e of entries) { const s = await store.save('productivity_entries', e.row); if (s._queued) queued++; }
      try { localStorage.removeItem(draftKey(st.projectId, date)); } catch { /* ignoré */ }
      S.dirty = false; S.chk = {};
      const m = root.querySelector('#draftmsg'); if (m) m.textContent = `Enregistré à ${timeFmt(Date.now())}`;
      toast(queued ? 'Hors connexion : la saisie est conservée sur cet appareil et sera envoyée au retour du réseau.' : pending.length ? 'Saisie enregistrée. Des valeurs atypiques attendent votre validation.' : 'Saisie enregistrée.', queued || pending.length ? '' : 'ok');
      S.step = 1; paintSteps(); paintLists(); refreshChecks().catch(() => {}); window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (e) { errorToast(e); } finally { S.saving = false; btns.forEach((b) => { b.disabled = false; }); }
  }
  async function refreshChecksFor(a) {          // garantit un verdict à jour avant d'enregistrer
    const v = valueOf(a.id);
    if (v === null || !(v >= 0)) return;
    const { result } = await cached('outlier', { history: histFor(a), value: v, level: settings.outlier_level });
    S.chk[a.id] = { value: v, res: result };
  }

  /* ───────────── premier affichage ───────────── */
  applyMode(); paintLists(); paintChecks(); paintSide(); paintHint();
  refreshChecks().catch(errorToast);
  live(ctx, () => { if (!root.isConnected) return; paintLists(); paintHint(); }, 80);
  const onUnload = () => { if (S.dirty) saveDraft(); };
  window.addEventListener('beforeunload', onUnload); ctx.onLeave(() => { window.removeEventListener('beforeunload', onUnload); if (S.dirty) saveDraft(); });
}
