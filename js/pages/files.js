/* Files d'attente M/M/c : rotation des camions-toupies au poste de déchargement (formule d'Erlang C). */
import { store } from '../store.js';
import { cached, MC_SEED } from '../analysis.js';
import { waitChart, pnChart, ganttChart } from '../charts.js';
import { ic, spinner, toast, errorToast, chip, openModal, field, confirmDialog } from '../ui.js';
import { pageHead, kpi, sourceTag, live } from './_common.js';
import { nf, pct, esc, parseNum } from '../format.js';
import { settingsOf } from '../model.js';

const hhmm = (t) => `${Math.floor(t + 1e-9)} h${String(Math.round((t % 1) * 60)).padStart(2, '0')}`;

export async function render(root, ctx) {
  const st = store.state, saved = settingsOf(st.project).queue;
  const Q = { lam: saved.lam, mu: saved.mu, c: saved.c, t0: saved.t0, t1: saved.t1, seed: MC_SEED };
  let res = null, source = null, token = 0, timer = null;

  async function compute() {
    const my = ++token;
    try {
      const { result, source: src } = await cached('queue', { lam: Q.lam, mu: Q.mu, c: Q.c, seed: Q.seed, t0: Q.t0, t1: Q.t1 });
      if (my !== token) return;
      res = result; source = src; paintResults();
    } catch (e) { if (my === token) { res = { error: e.message }; paintResults(); } }
  }
  const schedule = () => { clearTimeout(timer); timer = setTimeout(() => compute().catch(errorToast), 120); };
  ctx.onLeave(() => clearTimeout(timer));
  const dirty = () => Q.lam !== saved.lam || Q.mu !== saved.mu || Q.c !== saved.c || Q.t0 !== saved.t0 || Q.t1 !== saved.t1;

  const slider = (id, label, min, max, step, v, unit, hint = '') => `<div class="field"><div class="sliderline"><label for="${id}">${label}</label><b id="${id}-v">${nf(v, step < 1 ? 1 : 0)} ${unit}</b></div><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${v}">${hint ? `<span class="hint" id="${id}-h">${hint}</span>` : ''}</div>`;

  function paintParams() {
    const scen = st.data.queue_scenarios;
    const tv = (t) => `${String(Math.floor(t + 1e-9)).padStart(2, '0')}:${String(Math.round((t % 1) * 60)).padStart(2, '0')}`;
    root.querySelector('#params').innerHTML = `<div class="card"><div class="ch"><div><h3>Paramètres de la rotation</h3><div class="sub">Faites glisser les curseurs : tout se recalcule instantanément.</div></div>
      <div class="r"><button class="btn sm" id="again" type="button">${ic('dice', 15)}Tirer une autre matinée</button>${store.can('plan') ? `<button class="btn sm" id="saveq" type="button" ${dirty() ? '' : 'disabled'}>${ic('save', 15)}Enregistrer pour le chantier</button>` : ''}</div></div>
      <div class="row r4" style="gap:22px">
        ${slider('q-lam', 'Arrivées de camions λ', 1, 20, 0.5, Q.lam, 'camions/h', `Un camion toutes les ${nf(60 / Q.lam, 0)} min en moyenne`)}
        ${slider('q-mu', 'Déchargement μ (par poste)', 1, 20, 0.5, Q.mu, 'camions/h', `Un camion déchargé en ${nf(60 / Q.mu, 0)} min en moyenne`)}
        ${slider('q-c', 'Postes de déchargement c', 1, 6, 1, Q.c, Q.c > 1 ? 'postes' : 'poste', `Capacité totale : ${nf(Q.c * Q.mu, 1)} camions/h`)}
        <div class="row r2 keep" style="align-content:start"><div class="field"><label for="q-t0">Début du coulage</label><input id="q-t0" type="time" value="${tv(Q.t0)}"></div><div class="field"><label for="q-t1">Fin des livraisons</label><input id="q-t1" type="time" value="${tv(Q.t1)}"></div></div>
      </div>
      <div class="hstack" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--grid);gap:8px"><b style="font-size:13px">Scénarios :</b>
        ${scen.map((s) => `<span class="pill" style="padding:0 0 0 12px;min-height:34px;gap:2px"><button type="button" data-scen="${s.id}" style="font-weight:540;font-size:13px;color:inherit;padding:6px 8px 6px 0" title="λ ${nf(s.lam, 1)} · μ ${nf(s.mu, 1)} · ${s.c} poste(s)">${esc(s.name)}</button>${store.can('plan') ? `<button type="button" class="iconbtn sm" data-delscen="${s.id}" aria-label="Supprimer le scénario" style="border:none;width:28px;height:28px;background:none">${ic('x', 13)}</button>` : ''}</span>`).join('') || '<span class="muted" style="font-size:12.5px">aucun enregistré</span>'}
        ${store.can('plan') ? `<button class="btn sm link" id="newscen" type="button">${ic('plus', 14)}Enregistrer le réglage actuel</button>` : ''}</div></div>`;
    const q = (s) => root.querySelector(s);
    const upd = (id, key, unit) => q(id).addEventListener('input', (e) => {
      Q[key] = Number(e.target.value);
      q(`${id}-v`).textContent = `${nf(Q[key], key === 'c' ? 0 : 1)} ${key === 'c' ? (Q.c > 1 ? 'postes' : 'poste') : unit}`;
      const h = q(`${id}-h`);
      if (h) h.textContent = key === 'lam' ? `Un camion toutes les ${nf(60 / Q.lam, 0)} min en moyenne` : key === 'mu' ? `Un camion déchargé en ${nf(60 / Q.mu, 0)} min en moyenne` : `Capacité totale : ${nf(Q.c * Q.mu, 1)} camions/h`;
      const cap = q('#q-c-h'); if (cap) cap.textContent = `Capacité totale : ${nf(Q.c * Q.mu, 1)} camions/h`;
      const sv = q('#saveq'); if (sv) sv.disabled = !dirty();
      schedule();
    });
    upd('#q-lam', 'lam', 'camions/h'); upd('#q-mu', 'mu', 'camions/h par poste'); upd('#q-c', 'c', '');
    const tm = (id, key) => q(id).addEventListener('change', (e) => { const [h, m] = e.target.value.split(':').map(Number); if (Number.isFinite(h)) { Q[key] = h + (m || 0) / 60; if (Q.t1 <= Q.t0) Q.t1 = Q.t0 + 0.5; const sv = q('#saveq'); if (sv) sv.disabled = !dirty(); schedule(); } });
    tm('#q-t0', 't0'); tm('#q-t1', 't1');
    q('#again').onclick = () => { Q.seed = Math.floor(Math.random() * 1e9); schedule(); };
    const sv = q('#saveq');
    if (sv) sv.onclick = async () => { try { await store.setSettings({ queue: { lam: Q.lam, mu: Q.mu, c: Q.c, t0: Q.t0, t1: Q.t1 } }); toast('Paramètres de rotation enregistrés pour le chantier.', 'ok'); } catch (e) { errorToast(e); } };
    const ns = q('#newscen');
    if (ns) ns.onclick = () => openModal({ title: 'Enregistrer un scénario', sub: `λ = ${nf(Q.lam, 1)} camions/h · μ = ${nf(Q.mu, 1)} par poste · ${Q.c} poste${Q.c > 1 ? 's' : ''}`,
      body: field('Nom du scénario', '<input id="sn" maxlength="80" placeholder="ex. Coulage dalle R+1 — 3 postes">', { id: 'sn' }),
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'pri', onClick: async (api) => { const name = api.$('#sn').value.trim(); if (!name) throw new Error('Donnez un nom au scénario.'); await store.save('queue_scenarios', { name, lam: Q.lam, mu: Q.mu, c: Q.c }); toast('Scénario enregistré.', 'ok'); } }] });
    root.querySelectorAll('[data-scen]').forEach((b) => { b.onclick = () => { const s = st.data.queue_scenarios.find((x) => x.id === b.dataset.scen); Object.assign(Q, { lam: Number(s.lam), mu: Number(s.mu), c: Number(s.c) }); paintParams(); schedule(); }; });
    root.querySelectorAll('[data-delscen]').forEach((b) => { b.onclick = async () => { if (await confirmDialog('Supprimer ce scénario ?', { title: 'Supprimer', ok: 'Supprimer', danger: true })) store.remove('queue_scenarios', b.dataset.delscen).catch(errorToast); }; });
  }

  function paintResults() {
    const el = root.querySelector('#results'); if (!el) return;
    if (!res) { el.innerHTML = `<div class="card">${spinner('Calcul…')}</div>`; return; }
    if (res.error) { el.innerHTML = `<div class="card"><div class="empty"><b>Calcul impossible</b>${esc(res.error)}</div></div>`; return; }
    const r = res, stable = r.stable, day = r.day;
    const waits = day.waits_min, nT = day.trucks.length, maxWait = waits.length ? Math.max(...waits) : 0, mean = waits.length ? waits.reduce((a, b) => a + b, 0) / waits.length : 0;
    const tone = !stable ? 'crit' : r.rho > 0.85 ? 'warn' : 'good';
    const k = [
      kpi({ label: 'Taux d’occupation des postes', icon: 'gauge', value: nf(r.rho * 100, 0), unit: '%', right: `<div class="meter" style="flex:1 1 80px"><i style="width:${Math.min(100, r.rho * 100)}%;background:${tone === 'crit' ? 'var(--crit)' : tone === 'warn' ? 'var(--warn)' : 'var(--blue)'}"></i></div>`, foot: stable ? 'ρ = λ / (c × μ)' : 'Saturé : la file ne se résorbe jamais', delta: '' }),
      kpi({ label: 'Camion qui doit attendre', icon: 'truck', value: nf(r.pw * 100, 0), unit: '%', foot: 'Formule d’Erlang C', delta: '' }),
      kpi({ label: 'Attente moyenne en file', icon: 'clock', value: stable ? nf(r.wq_min, 1) : '∞', unit: stable ? 'min' : '', foot: stable ? `Temps sur site : ${nf(r.w_min, 0)} min` : 'Ajoutez un poste ou réduisez la cadence', delta: '' }),
      kpi({ label: 'Camions en file (moyenne)', icon: 'layers', value: stable ? nf(r.lq, 1) : '∞', unit: '', foot: stable ? 'Longueur moyenne de la file' : '', delta: '' }),
    ];
    const cur = r.options[0], pace = r.options[1], srv = r.options[2];
    const f = (o) => (o.stable ? `${nf(o.wq_min, 1)} min` : 'saturé');
    const best = r.options.filter((o) => o.stable).sort((a, b) => a.wq_min - b.wq_min)[0];
    let reco;
    if (!stable) reco = `<div class="note crit">${ic('alert', 17)}<div><b>La file n’est pas stable.</b> Les camions arrivent plus vite que les postes ne peuvent les décharger (${nf(Q.lam, 1)} > ${nf(Q.c * Q.mu, 1)} par heure) : l’attente ne cesse de grandir. Ajoutez un poste (${f(srv)} d’attente) ou demandez à la centrale de cadencer (${f(pace)}).</div></div>`;
    else if (r.wq_min <= 5) reco = `<div class="note good">${ic('check', 17)}<div><b>Rotation fluide.</b> L’attente moyenne (${nf(r.wq_min, 1)} min) reste raisonnable : le béton reste maniable et les camions ne s’accumulent pas.</div></div>`;
    else reco = `<div class="note warn">${ic('alert', 17)}<div><b>Attente à réduire.</b> ${nf(r.wq_min, 1)} min en moyenne, et ${nf(r.pw * 100, 0)} % des camions attendent. Cadencer à ${nf(pace.lam, 1)} camions/h ramènerait l’attente à ${f(pace)} (sans coût) ; ajouter un poste à ${f(srv)}. Commencez par négocier la cadence avec la centrale à béton.</div></div>`;
    el.innerHTML = `<div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:16px" id="kg">${k.map((x) => `<div>${x}</div>`).join('')}</div>${reco}
      <div class="grid g12" style="align-items:start"><div class="c7"><div class="card"><div class="ch"><div><h3>Attente selon la cadence d’arrivée</h3><div class="sub">Temps moyen en file (minutes) pour ${Q.c}, ${Q.c + 1} et ${Q.c + 2} postes</div></div><div class="r">${sourceTag(source)}</div></div><div class="chartbox">${waitChart(r.curves, { lam: Q.lam, wq: r.wq_min, c: Q.c, w: 640, h: 340 })}</div></div></div>
        <div class="c5"><div class="card"><div class="ch"><div><h3>Camions présents sur le site</h3><div class="sub">Probabilité d’en avoir n à un instant donné</div></div></div><div class="chartbox">${stable ? pnChart(r.pn, Q.c, { w: 460, h: 340 }) : '<div class="empty">Non défini : le système est saturé.</div>'}</div><div class="legend" style="margin-top:6px"><span><i style="background:var(--blue)"></i>Un poste libre ou en service</span><span><i style="background:var(--orange)"></i>Il y a une file</span></div></div></div></div>
      <div class="card"><div class="ch"><div><h3>Simulation d’une matinée de coulage</h3><div class="sub">${hhmm(day.t0)} – ${hhmm(day.t1)} · ${nT} camion${nT > 1 ? 's' : ''} · attente moyenne ${nf(mean, 1)} min · attente maximale ${nf(maxWait, 0)} min</div></div></div>
        <div class="legend" style="margin-bottom:6px"><span><i style="background:var(--wait)"></i>Attente en file</span><span><i style="background:var(--blue)"></i>Déchargement (une couleur par poste)</span></div>
        <div class="chartbox" style="overflow-x:auto">${ganttChart(day, { w: 1040 })}</div></div>
      <div class="card"><div class="ch"><div><h3>Que faire pour réduire l’attente ?</h3><div class="sub">Comparaison des options, avec le même nombre de livraisons</div></div></div>
        <div class="tw"><table><thead><tr><th>Option</th><th class="num">Postes</th><th class="num">Cadence</th><th class="num">Occupation</th><th class="num">Camions qui attendent</th><th class="num">Attente moyenne</th><th class="num">File moyenne</th></tr></thead><tbody>
        ${r.options.map((o) => `<tr class="${best && o.key === best.key && o.key !== 'current' ? 'hl' : ''}"><td><b style="font-weight:600">${esc(o.label)}</b>${best && o.key === best.key ? ` ${chip('good', 'check', 'La plus fluide')}` : ''}</td><td class="num">${o.c}</td><td class="num">${nf(o.lam, 1)} /h</td><td class="num">${nf(o.rho * 100, 0)} %</td><td class="num">${nf(o.pw * 100, 0)} %</td><td class="num"><b>${f(o)}</b></td><td class="num">${o.stable ? nf(o.lq, 1) : '—'}</td></tr>`).join('')}</tbody></table></div></div>`;
    const kg = el.querySelector('#kg'); if (kg && window.matchMedia('(max-width:1180px)').matches) kg.style.gridTemplateColumns = window.matchMedia('(max-width:860px)').matches ? 'minmax(0,1fr)' : 'repeat(2,minmax(0,1fr))';
  }

  root.innerHTML = pageHead('Files d’attente — livraisons de béton', 'Combien de temps les camions-toupies attendent-ils au poste de déchargement ?',
    `<a class="btn" href="#/parametres/manuel?s=m-files">${ic('book', 16)}Comprendre ce modèle</a>`) +
    `<div style="display:flex;flex-direction:column;gap:20px"><div id="params"></div><div id="results" style="display:flex;flex-direction:column;gap:20px"></div></div>`;
  paintParams(); paintResults(); await compute();
  live(ctx, () => { if (root.isConnected) { const a = root.querySelector('#params'); if (a && !a.contains(document.activeElement)) paintParams(); } }, 150);
}
