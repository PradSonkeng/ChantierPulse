/* Simulation de Monte Carlo : probabilité de finir avant l'échéance, scénarios « et si », criticité des tâches. */
import { store } from '../store.js';
import { cached, MC_SEED } from '../analysis.js';
import { histChart, ecdfChart } from '../charts.js';
import { ic, spinner, toast, errorToast, chip } from '../ui.js';
import { pageHead, sourceTag, live } from './_common.js';
import { nf, pct, esc, dateLong, dateShort, parseNum, daysBetween, isoDate, addDays } from '../format.js';
import { settingsOf, mcInput, simTasks, dayToDate, validateTasks } from '../model.js';

const N_CHOICES = [1000, 5000, 10000, 20000, 50000];
const LEVELS = [50, 60, 70, 75, 80, 85, 90, 95];

export async function render(root, ctx) {
  const st = store.state, today = store.today, saved = settingsOf(st.project);
  const P = {
    n: saved.n_sim, target: st.project.target_date, level: 85, seed: String(MC_SEED),
    bd: { ...saved.breakdowns }, rain: { ...saved.rain },
  };
  let run = null, token = 0, busy = false;

  const tasksLeft = () => simTasks(st.data.tasks);
  const body = (over = {}) => {
    const b = mcInput(st.project, st.data.tasks, today, {
      n: P.n, breakdowns: over.noHazards ? { on: false } : P.bd, rain: over.noHazards ? { on: false } : P.rain,
      seed: over.seed !== undefined ? over.seed : (P.seed.trim() === '' ? Math.floor(Math.random() * 1e9) : Math.floor(Number(P.seed))),
    });
    b.target_day = Math.max(0, daysBetween(today, P.target));
    return b;
  };
  const differs = () => P.n !== saved.n_sim || P.target !== st.project.target_date || JSON.stringify(P.bd) !== JSON.stringify(saved.breakdowns) || JSON.stringify(P.rain) !== JSON.stringify(saved.rain);

  async function simulate() {
    const my = ++token; busy = true; paintBusy();
    try {
      const msg = validateTasks(st.data.tasks); if (msg) throw new Error(msg);
      if (!tasksLeft().length) { run = { empty: true }; return; }
      const main = body(), seedUsed = main.seed;
      const [a, b] = await Promise.all([cached('montecarlo', main), cached('montecarlo', body({ noHazards: true, seed: seedUsed }))]);
      if (my !== token) return;
      run = { mc: a.result, source: a.source, calm: b.result, input: main };
    } catch (e) { if (my === token) run = { error: e.message }; }
    finally { if (my === token) { busy = false; if (root.isConnected) paint(); } }
  }

  function paintBusy() {
    const el = root.querySelector('#results'); if (el && busy) el.style.opacity = '.5';
    const b = root.querySelector('#runbtn'); if (b) { b.disabled = busy; b.innerHTML = busy ? `<span class="spin" style="width:15px;height:15px;border-width:2px"></span>Calcul…` : `${ic('play', 16)}Lancer la simulation`; }
  }

  const num = (id, def) => { const v = parseNum(root.querySelector(id).value); return Number.isFinite(v) ? v : def; };
  function readParams() {
    P.n = Number(root.querySelector('#p-n').value);
    P.target = root.querySelector('#p-target').value || P.target;
    P.level = Number(root.querySelector('#p-level').value);
    P.seed = root.querySelector('#p-seed').value;
    P.bd = { on: root.querySelector('#p-bd').checked, lambda_per_day: Math.max(0, num('#p-bdl', P.bd.lambda_per_day)), mttr_days: Math.max(0, num('#p-bdm', P.bd.mttr_days)) };
    P.rain = { ...P.rain, on: root.querySelector('#p-rain').checked, rate_per_day: Math.min(1, Math.max(0, num('#p-rr', P.rain.rate_per_day))), loss_days: Math.max(0, num('#p-rl', P.rain.loss_days)) };
  }

  function paramCard() {
    const sw = (id, on, label) => `<label class="switch"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><i></i><span>${label}</span></label>`;
    const sm = (id, label, v, unit, hint = '') => `<div class="field"><label for="${id}">${label}</label><div class="inp"><input id="${id}" inputmode="decimal" value="${String(v).replace('.', ',')}"><span class="u">${unit}</span></div>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
    return `<div class="card"><div class="ch"><div><h3>Paramètres de la simulation</h3><div class="sub">Modifiez, relancez, comparez : rien n’est enregistré sans votre accord.</div></div></div>
      <div class="stack" style="gap:16px">
        <div class="field"><label for="p-n">Nombre de simulations</label><select id="p-n">${N_CHOICES.map((n) => `<option value="${n}"${n === P.n ? ' selected' : ''}>${nf(n, 0)}</option>`).join('')}</select></div>
        <div class="field"><label for="p-target">Échéance à tenir</label><input id="p-target" type="date" value="${P.target}"></div>
        <div class="field"><label for="p-level">Niveau de confiance annoncé</label><select id="p-level">${LEVELS.map((l) => `<option value="${l}"${l === P.level ? ' selected' : ''}>${l} %</option>`).join('')}</select><span class="hint">« Sûr à 85 % » : date que 85 % des simulations respectent.</span></div>
        <div class="field"><label>Loi des durées de tâches</label><div class="inp ro"><input value="Beta-PERT (min, probable, max)" disabled style="color:var(--ink2)"></div></div>
        <div class="field"><label for="p-seed">Graine aléatoire</label><input id="p-seed" inputmode="numeric" value="${esc(P.seed)}" placeholder="vide = tirage différent à chaque lancement"><span class="hint">Une même graine redonne exactement le même résultat.</span></div>
        <div style="border-top:1px solid var(--grid);padding-top:14px" class="stack">${sw('p-bd', P.bd.on, 'Pannes d’engins')}
          <div class="row r2 keep">${sm('p-bdl', 'Taux λ', P.bd.lambda_per_day, '/ jour')}${sm('p-bdm', 'Réparation', P.bd.mttr_days, 'j')}</div></div>
        <div style="border-top:1px solid var(--grid);padding-top:14px" class="stack">${sw('p-rain', P.rain.on, 'Pluie (tâches exposées)')}
          <div class="row r2 keep">${sm('p-rr', 'Taux', P.rain.rate_per_day, '/ jour')}${sm('p-rl', 'Perte par épisode', P.rain.loss_days, 'j')}</div></div>
        <div class="hstack" style="gap:10px"><button class="btn pri block" id="runbtn" type="button">${ic('play', 16)}Lancer la simulation</button></div>
        <div class="hstack" style="gap:8px">${store.can('plan') ? `<button class="btn sm" id="savebtn" type="button" ${differs() ? '' : 'disabled'}>${ic('save', 15)}Enregistrer pour le chantier</button>` : ''}<button class="btn sm" id="revbtn" type="button" ${differs() ? '' : 'disabled'}>${ic('refresh', 15)}Valeurs du chantier</button></div>
      </div></div>`;
  }

  function resultsHtml() {
    if (!run) return `<div class="card">${spinner('Simulation en cours…')}</div>`;
    if (run.error) return `<div class="card"><div class="empty"><b>Simulation impossible</b>${esc(run.error)}<br><br><a class="btn pri" href="#/parametres/planning">${ic('layers', 16)}Corriger le planning</a></div></div>`;
    if (run.empty) return `<div class="card"><div class="empty"><b>Aucune tâche restante</b>Toutes les tâches du planning sont terminées, ou le planning est vide.<br><br><a class="btn pri" href="#/parametres/planning">${ic('layers', 16)}Ouvrir le planning</a></div></div>`;
    const mc = run.mc, calm = run.calm, td = run.input.target_day, lv = String(P.level), dl = mc.percentiles[lv];
    const pt = mc.p_target, margin = td - Math.ceil(dl), lost = calm.p_target !== null ? (calm.p_target - pt) * 100 : null;
    const tone = pt >= 0.8 ? 'good' : pt >= 0.5 ? 'warn' : 'crit';
    const tiles = [['P50', mc.p50], ['P85', mc.p85], ['P95', mc.p95]].map(([k, v]) => `<div style="border:1px solid var(--border);border-radius:12px;padding:12px 14px"><div class="lbl">${k}</div><div class="big" style="font-size:22px">${esc(dateShort(dayToDate(today, v)))}</div><div class="muted mono" style="font-size:12.5px">J+${Math.ceil(v)}</div></div>`).join('');
    const hero = `<div class="card"><div class="grid" style="grid-template-columns:minmax(200px,280px) minmax(0,1fr);gap:26px;align-items:center" id="herogrid">
      <div class="stack" style="gap:8px"><div class="hstack ink2">${ic('calendar', 17)}<span>Avant le ${esc(dateLong(P.target))}</span></div><div class="hero">${nf(pt * 100, 0)}<small>&nbsp;%</small></div>
        <div class="ink2" style="font-size:13.5px">de chance d’y arriver · ${nf(mc.n, 0)} simulations · ${sourceTag(run.source)}</div>${chip(tone, tone === 'good' ? 'check' : 'alert', tone === 'good' ? 'Échéance confortable' : tone === 'warn' ? 'Marge faible' : 'Échéance menacée')}</div>
      <div class="stack" style="gap:12px"><div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:12px">${tiles}</div>
        <div class="note ${margin >= 0 ? 'good' : 'warn'}">${ic(margin >= 0 ? 'check' : 'alert', 17)}<div>Pour être <b>sûr à ${P.level} %</b>, annoncez le <b>${esc(dateLong(dayToDate(today, dl)))}</b>. ${margin >= 0 ? `Vous avez ${margin} jour${margin > 1 ? 's' : ''} de marge sur l’échéance.` : `C’est ${-margin} jour${-margin > 1 ? 's' : ''} après l’échéance : il faut gagner un peu de temps sur les tâches critiques.`}</div></div>
        ${lost !== null && (P.bd.on || P.rain.on) ? `<div class="note info">${ic('info', 17)}<div>Sans aléas (pannes ni pluie), la probabilité serait de <b>${nf(calm.p_target * 100, 0)} %</b> : les aléas coûtent <b>${nf(lost, 0)} point${Math.abs(lost) >= 2 ? 's' : ''}</b> et repoussent la date médiane de <b>${nf(mc.p50 - calm.p50, 1)} jour${Math.abs(mc.p50 - calm.p50) >= 2 ? 's' : ''}</b>.</div></div>` : ''}</div></div></div>`;
    const hist = `<div class="card"><div class="ch"><div><h3>Distribution de la date de fin</h3><div class="sub">Part des simulations qui se terminent chaque jour</div></div><div class="r"><div class="legend"><span><i style="background:var(--blue)"></i>Avant l’échéance</span><span><i style="background:var(--grey)"></i>Après</span></div></div></div><div class="chartbox">${histChart(mc, { today, targetDay: td, w: 620, h: 340 })}</div></div>`;
    const ecdf = `<div class="card"><div class="ch"><div><h3>Probabilité cumulée</h3><div class="sub">Chance de finir au plus tard à chaque date</div></div></div><div class="chartbox">${ecdfChart(mc, { today, targetDay: td, marks: true, w: 620, h: 340 })}</div></div>`;
    const sim = new Map(simTasks(st.data.tasks).map((t) => [t.id, t]));
    const rows = [...mc.tasks].sort((a, b) => b.criticality - a.criticality);
    const tasks = `<div class="card"><div class="ch"><div><h3>Lois de durée et criticité des tâches</h3><div class="sub">Durées restantes (jours). La criticité est la part des simulations où la tâche est sur le chemin critique.</div></div></div>
      <div class="tw"><table><thead><tr><th>Tâche</th><th class="num">Min</th><th class="num">Probable</th><th class="num">Max</th><th class="num">Durée simulée</th><th style="min-width:180px">Criticité</th><th></th></tr></thead><tbody>
      ${rows.map((t) => { const s = sim.get(t.id) || {}; return `<tr><td><b style="font-weight:600">${esc(t.name)}</b></td><td class="num">${nf(s.a, 1)}</td><td class="num">${nf(s.m, 1)}</td><td class="num">${nf(s.b, 1)}</td><td class="num">${nf(t.mean, 1)} ± ${nf(t.sd, 1)}</td>
        <td><div style="display:flex;align-items:center;gap:10px"><div class="meter" style="flex:1;height:10px;background:var(--blue100)"><i style="width:${t.criticality * 100}%;background:${t.criticality > 0.9 ? 'var(--blue)' : 'var(--blue250)'}"></i></div><b class="mono" style="width:44px;text-align:right">${nf(t.criticality * 100, 0)} %</b></div></td>
        <td>${s.exposed ? `<span title="Exposée aux intempéries" style="color:var(--blue600)">${ic('rain', 16)}</span>` : ''}</td></tr>`; }).join('')}</tbody></table></div></div>`;
    return `${hero}<div class="grid g12" style="align-items:start"><div class="c7">${hist}</div><div class="c5">${ecdf}</div></div>${tasks}`;
  }

  function paint() {
    root.innerHTML = pageHead('Simulation de Monte Carlo', `Quelle est la probabilité de finir à temps ? · ${nf(tasksLeft().length, 0)} tâche${tasksLeft().length > 1 ? 's' : ''} restante${tasksLeft().length > 1 ? 's' : ''}`,
      `<a class="btn" href="#/rapports">${ic('download', 16)}Exporter le rapport</a>`) +
      `<div class="grid g12" style="align-items:start"><div class="c4" id="params">${paramCard()}</div><div class="c8"><div id="results" style="display:flex;flex-direction:column;gap:20px">${resultsHtml()}</div></div></div>`;
    const hg = root.querySelector('#herogrid'); if (hg && window.matchMedia('(max-width:1180px)').matches) hg.style.gridTemplateColumns = 'minmax(0,1fr)';
    wire();
  }
  function wire() {
    const q = (s) => root.querySelector(s);
    root.querySelectorAll('#params input, #params select').forEach((el) => el.addEventListener('change', () => {
      readParams(); const sb = q('#savebtn'), rb = q('#revbtn'); if (sb) sb.disabled = !differs(); rb.disabled = !differs();
      if (el.id === 'p-level') { paintResultsOnly(); }
    }));
    q('#runbtn').onclick = () => { readParams(); simulate().catch(errorToast); };
    q('#revbtn').onclick = () => { Object.assign(P, { n: saved.n_sim, target: st.project.target_date, bd: { ...saved.breakdowns }, rain: { ...saved.rain } }); q('#params').innerHTML = paramCard(); wire(); simulate().catch(errorToast); };
    const sb = q('#savebtn');
    if (sb) sb.onclick = async () => {
      readParams();
      try {
        if (P.target !== st.project.target_date) await store.saveProject({ target_date: P.target });
        await store.setSettings({ n_sim: P.n, breakdowns: P.bd, rain: P.rain });
        toast('Paramètres enregistrés pour le chantier. Le tableau de bord utilisera ces valeurs.', 'ok');
      } catch (e) { errorToast(e); }
    };
    paintBusy();
  }
  function paintResultsOnly() { const r = root.querySelector('#results'); if (r) { r.innerHTML = resultsHtml(); r.style.opacity = ''; } }

  paint(); await simulate();
  live(ctx, () => { /* les changements de planning sont pris en compte au prochain lancement */ }, 400);
  const off = ctx.subscribe(() => { if (!busy) { const m = root.querySelector('#results'); if (m && run && run.input) { const fresh = JSON.stringify(simTasks(st.data.tasks)); if (fresh !== JSON.stringify(run.input.tasks)) { simulate().catch(() => {}); } } } });
}
