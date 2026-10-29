/* Analyse des écarts de productivité : test de Student de chaque activité contre le rendement prévu. */
import { store } from '../store.js';
import { analyzeActivities } from '../analysis.js';
import { trendChart, studentChart } from '../charts.js';
import { ic, spinner, errorToast, chip } from '../ui.js';
import { pageHead, selectBox, verdictChip, sourceTag, live } from './_common.js';
import { nf, pct, signedPct, pval, esc, dateShort, dateWeekday } from '../format.js';
import { settingsOf, isPending } from '../model.js';
import { go } from '../router.js';

const WINDOWS = [[7, '7 derniers jours'], [14, '14 derniers jours'], [30, '30 derniers jours'], [60, '60 derniers jours'], [0, 'Tout l’historique']];
const ALPHAS = [[0.01, 'α = 1 %'], [0.05, 'α = 5 %'], [0.1, 'α = 10 %']];

export async function render(root, ctx) {
  const st = store.state, settings = settingsOf(st.project), today = store.today;
  let sel = ctx.query.a || null;
  let windowDays = ctx.query.w !== undefined ? Number(ctx.query.w) : settings.window_days;
  let alpha = ctx.query.al ? Number(ctx.query.al) : settings.alpha;
  let token = 0;

  async function paint() {
    const my = ++token;
    if (!st.data.activities.length) {
      root.innerHTML = pageHead('Analyse des écarts', 'Test de Student sur le rendement de chaque activité') + `<div class="card"><div class="empty"><b>Aucune activité</b>Définissez les activités suivies dans Paramètres › Activités.</div></div>`;
      return;
    }
    const rows = await analyzeActivities(st, { windowDays, alpha });
    if (my !== token || !root.isConnected) return;
    const row = rows.find((r) => r.activity.id === sel) || rows.find((r) => r.result && r.result.significant) || rows.find((r) => r.result) || rows[0];
    sel = row.activity.id;
    const a = row.activity, r = row.result, cur = st.project.currency;
    const win = WINDOWS.find((w) => w[0] === windowDays)?.[1] || `${windowDays} jours`;

    const tabs = `<div class="tabs" role="tablist" style="max-width:100%">${rows.map((x) => `<button type="button" role="tab" data-sel="${x.activity.id}" class="${x.activity.id === sel ? 'on' : ''}">${esc(x.activity.name.replace(/\s*\(.*\)/, ''))}${x.result && x.result.significant ? ` <span style="color:${x.result.verdict === 'significant_below' ? 'var(--crittxt)' : 'var(--goodtxt)'}">●</span>` : ''}</button>`).join('')}</div>`;

    const hidden = st.data.productivity_entries.filter((e) => e.activity_id === a.id && e.entry_date <= today && (windowDays ? e.entry_date >= new Date(Date.parse(today) - windowDays * 86400000).toISOString().slice(0, 10) : true));
    const nPend = hidden.filter(isPending).length, nExcl = hidden.filter((e) => e.excluded).length;

    let kpis = '', main = '', side = '';
    if (!r) {
      main = `<div class="card"><div class="empty"><b>Pas assez de relevés</b>${row.error ? esc(row.error) : `Il faut au moins 2 relevés de « ${esc(a.name)} » sur la période pour comparer au rendement prévu (${row.entries.length} trouvé${row.entries.length > 1 ? 's' : ''}).`}<br><br><a class="btn pri" href="#/saisie">${ic('plus', 16)}Saisir un rendement</a></div></div>`;
    } else {
      const gapCls = r.significant ? (r.verdict === 'significant_below' ? 'bad' : 'ok') : 'flat';
      kpis = `<div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:12px" id="kp">
        ${[['Rendement moyen', `${nf(r.mean, 1)}`, a.unit, `${r.n} relevés`], ['Rendement prévu', `${nf(r.mu0, 1)}`, a.unit, 'valeur de référence μ₀'],
          ['Écart', signedPct(r.gap), '', `<span class="delta ${gapCls}">${r.significant ? (r.verdict === 'significant_below' ? 'significatif' : 'significatif, favorable') : 'non significatif'}</span>`],
          ['Variabilité', `σ = ${nf(r.sd, 1)}`, '', `CV = ${r.cv === null ? '—' : nf(r.cv * 100, 0)} %`]]
          .map(([l, v, u, f]) => `<div style="border:1px solid var(--border);border-radius:12px;padding:12px 14px;background:var(--surface)"><div class="lbl">${l}</div><div class="big" style="font-size:24px;margin-top:2px">${v}${u ? `<small style="font-size:13px;color:var(--ink2);font-weight:540"> ${esc(u)}</small>` : ''}</div><div class="muted" style="font-size:12.5px;margin-top:2px">${f}</div></div>`).join('')}</div>`;
      const pts = row.entries.map((e) => ({ v: Number(e.value), date: e.entry_date }));
      main = `<div class="card"><div class="ch"><div><h3>Rendement journalier · ${esc(a.name)}</h3><div class="sub">${esc(win)} · intervalle de confiance à ${nf((1 - alpha) * 100, 0)} % de la moyenne</div></div><div class="r">${sourceTag(row.source)}</div></div>
        <div class="legend" style="margin-bottom:8px"><span><i class="ln" style="background:var(--blue)"></i>Relevés</span><span><i class="ln" style="background:var(--ink2)"></i>Rendement prévu</span><span><i style="background:var(--tint-info)"></i>IC de la moyenne</span></div>
        <div class="chartbox">${trendChart(pts, { mu0: r.mu0, ci: r.ci, unit: a.unit, today, w: 760, h: 330 })}</div>
        ${nPend || nExcl ? `<div class="muted" style="font-size:12.5px;margin-top:8px">${nPend ? `${nPend} valeur${nPend > 1 ? 's' : ''} atypique${nPend > 1 ? 's' : ''} en attente de validation` : ''}${nPend && nExcl ? ' · ' : ''}${nExcl ? `${nExcl} valeur${nExcl > 1 ? 's' : ''} écartée${nExcl > 1 ? 's' : ''}` : ''} : non comptée${nPend + nExcl > 1 ? 's' : ''} dans le test. <a href="#/saisie">Voir les saisies</a></div>` : ''}</div>`;

      const verdictText = r.verdict === 'significant_below'
        ? `On <b>rejette H₀</b> : le rendement moyen (${nf(r.mean, 1)} ${esc(a.unit)}) est <b>significativement inférieur</b> au rendement prévu (${nf(r.mu0, 1)}). L’écart de ${signedPct(r.gap)} a une probabilité de ${pval(r.p)} de survenir par simple hasard si le rendement prévu était exact.`
        : r.verdict === 'significant_above'
          ? `On <b>rejette H₀</b> : le rendement moyen (${nf(r.mean, 1)} ${esc(a.unit)}) est <b>significativement supérieur</b> au rendement prévu (${nf(r.mu0, 1)}), de ${signedPct(r.gap)}. Il y a une marge à exploiter dans le planning.`
          : `On <b>ne rejette pas H₀</b> : l’écart observé (${signedPct(r.gap)}) reste compatible avec les fluctuations normales d’un chantier (p = ${pval(r.p)}). Aucune action corrective n’est justifiée par ces données.`;
      const reco = r.verdict === 'significant_below'
        ? `<div class="note warn">${ic('alert', 17)}<div><b>À faire</b> : chercher la cause (effectif, engins en panne, livraisons, météo) puis relancer la <a href="#/monte-carlo">simulation de Monte Carlo</a> pour mesurer l’effet sur la date de fin.</div></div>` : '';
      side = `<div class="card"><div class="ch"><div><h3>Test de Student</h3><div class="sub">Comparaison de la moyenne observée au rendement prévu</div></div></div>
        <div class="stack" style="gap:12px"><div class="hstack" style="gap:8px">${verdictChip(r.verdict)}<span class="tag">α = ${nf(alpha * 100, 0)} %</span></div>
        <div style="background:var(--wash);border-radius:12px;padding:12px 14px;font-size:13.5px;line-height:1.7"><span class="eq">H₀ : μ = μ₀</span> <span class="muted">(le rendement réel est conforme à la prévision)</span><br><span class="eq">H₁ : μ ≠ μ₀</span> <span class="muted">(il s’en écarte, dans un sens ou l’autre)</span></div>
        <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;font-size:13.5px"><span class="ink2">Statistique t</span><b class="num">${nf(r.t, 2)}</b><span class="ink2">Degrés de liberté</span><b class="num">${r.df}</b><span class="ink2">Valeur critique</span><b class="num">± ${nf(r.tcrit, 2)}</b><span class="ink2">Valeur de p</span><b class="num">${pval(r.p)}</b></div>
        <div class="chartbox">${studentChart({ t: r.t, df: r.df, tcrit: r.tcrit, alpha: r.alpha, w: 440, h: 270 })}</div>
        <div style="font-size:13.5px;line-height:1.5">${verdictText}</div>
        ${r.warning ? `<div class="note warn">${ic('info', 17)}<div>${esc(r.warning)}</div></div>` : ''}${reco}</div></div>`;
    }

    const table = `<div class="card"><div class="ch"><div><h3>Toutes les activités</h3><div class="sub">${esc(win)} · test bilatéral à ${nf(alpha * 100, 0)} %</div></div></div>
      <div class="tw"><table><thead><tr><th>Activité</th><th class="num">Relevés</th><th class="num">Moyenne</th><th class="num">Prévu</th><th class="num">Écart</th><th class="num">p</th><th>Conclusion</th><th></th></tr></thead><tbody>
      ${rows.map((x) => { const q = x.result; return `<tr class="click${x.activity.id === sel ? ' hl' : ''}" data-sel="${x.activity.id}"><td><b style="font-weight:600">${esc(x.activity.name)}</b></td><td class="num">${x.entries.length}</td><td class="num">${q ? `${nf(q.mean, 1)} <span class="muted">${esc(x.activity.unit)}</span>` : '—'}</td><td class="num">${nf(x.activity.planned_rate, 1)}</td>
        <td class="num" style="${q && q.verdict === 'significant_below' ? 'color:var(--crittxt);font-weight:600' : ''}">${q ? signedPct(q.gap) : '—'}</td><td class="num">${q ? pval(q.p) : '—'}</td><td>${q ? verdictChip(q.verdict) : chip('neutral', 'info', 'Relevés insuffisants')}</td><td class="num">${ic('chevright', 16)}</td></tr>`; }).join('')}</tbody></table></div></div>`;

    root.innerHTML = pageHead('Analyse des écarts', `Le rendement observé s’écarte-t-il vraiment de la prévision ? · ${esc(dateWeekday(today))}`,
      `${selectBox('wsel', 'calendar', WINDOWS, windowDays)}${selectBox('asel', 'sliders', ALPHAS, alpha)}`) +
      `<div style="display:flex;flex-direction:column;gap:20px">${tabs}${kpis}<div class="grid g12" style="align-items:start"><div class="c8">${main}</div><div class="c4">${side}</div></div>${table}</div>`;
    const kp = root.querySelector('#kp'); if (kp && window.matchMedia('(max-width:860px)').matches) kp.style.gridTemplateColumns = 'repeat(2,minmax(0,1fr))';
    root.querySelectorAll('[data-sel]').forEach((b) => { b.onclick = () => { sel = b.dataset.sel; paint().catch(errorToast); if (b.tagName === 'TR') window.scrollTo({ top: 0, behavior: 'smooth' }); }; });
    root.querySelector('#wsel').onchange = (e) => { windowDays = Number(e.target.value); paint().catch(errorToast); };
    root.querySelector('#asel').onchange = (e) => { alpha = Number(e.target.value); paint().catch(errorToast); };
  }
  root.innerHTML = spinner('Calcul des tests statistiques…');
  await paint();
  live(ctx, () => paint().catch(errorToast), 200);
}
