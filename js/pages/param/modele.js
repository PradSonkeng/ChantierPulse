/* Paramètres › Modèle : réglages de la simulation, aléas, seuils statistiques et moteur de calcul. */
import { store, CONFIG } from '../../store.js';
import { ic, toast, errorToast, chip } from '../../ui.js';
import { esc, nf, parseNum } from '../../format.js';
import { settingsOf, DEFAULT_SETTINGS, estimateBreakdownRate, estimateRainRate, meanRepairHours } from '../../model.js';
import { engineSettings, saveEngineSettings, health } from '../../engine.js';
import { clearAnalysisCache } from '../../analysis.js';
import { readOnlyNote } from '../parametres.js';

const fmt = (v, d = 3) => String(Math.round(v * 10 ** d) / 10 ** d).replace('.', ',');
const ALPHAS = [0.01, 0.05, 0.1], LEVELS = [0.9, 0.95, 0.99], WINDOWS = [7, 14, 30, 60, 90];

export async function render(box) {
  const st = store.state, can = store.can('plan'), s = settingsOf(st.project), eng = engineSettings();
  const dis = can ? '' : 'disabled';
  const sm = (id, label, v, unit, hint = '') => `<div class="field"><label for="${id}">${label}</label><div class="inp${can ? '' : ' ro'}"><input id="${id}" inputmode="decimal" value="${fmt(v)}" ${dis}><span class="u">${unit}</span></div>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  const sel = (id, label, items, cur, hint = '') => `<div class="field"><label for="${id}">${label}</label><select id="${id}" ${dis}>${items.map(([v, l]) => `<option value="${v}"${Number(v) === Number(cur) ? ' selected' : ''}>${l}</option>`).join('')}</select>${hint ? `<span class="hint">${hint}</span>` : ''}</div>`;
  box.innerHTML = `${readOnlyNote()}
    <div class="grid g12" style="align-items:start">
      <div class="c6 stack" style="gap:20px">
        <div class="card"><div class="ch"><div><h3>Simulation et tests statistiques</h3><div class="sub">Réglages utilisés par défaut sur toutes les pages d’analyse.</div></div></div>
          <div class="row r2">${sel('s-n', 'Nombre de simulations', [1000, 5000, 10000, 20000, 50000].map((n) => [n, nf(n, 0)]), s.n_sim, 'Plus il est grand, plus le résultat est stable (et plus le calcul est long).')}
            ${sel('s-a', 'Seuil de signification α', ALPHAS.map((a) => [a, `${nf(a * 100, 0)} %`]), s.alpha, 'Risque accepté de conclure à tort à un écart (test de Student).')}
            ${sel('s-o', 'Niveau de détection d’une valeur atypique', LEVELS.map((a) => [a, `${nf(a * 100, 0)} %`]), s.outlier_level, 'Intervalle de prédiction utilisé à la saisie.')}
            ${sel('s-w', 'Fenêtre d’analyse de la productivité', WINDOWS.map((w) => [w, `${w} jours`]), s.window_days, 'Seuls les relevés récents comptent dans la moyenne.')}</div></div>
        <div class="card"><div class="ch"><div><h3>Pannes d’engins dans la simulation</h3><div class="sub">Chaque tâche subit des pannes aléatoires (loi de Poisson) suivies d’une réparation.</div></div></div>
          <div class="stack"><label class="switch"><input type="checkbox" id="b-on" ${s.breakdowns.on ? 'checked' : ''} ${dis}><i></i><span>Tenir compte des pannes</span></label>
            <div class="row r2 keep">${sm('b-l', 'Taux de pannes', s.breakdowns.lambda_per_day, 'par jour')}${sm('b-m', 'Durée de réparation', s.breakdowns.mttr_days, 'jour')}</div>
            ${can ? `<div><button class="btn sm" id="est-b" type="button">${ic('refresh', 15)}Estimer d’après l’historique de pannes</button></div>` : ''}</div></div>
        <div class="card"><div class="ch"><div><h3>Pluie dans la simulation</h3><div class="sub">Les tâches marquées « exposées » perdent du temps lors des jours de pluie.</div></div></div>
          <div class="stack"><label class="switch"><input type="checkbox" id="r-on" ${s.rain.on ? 'checked' : ''} ${dis}><i></i><span>Tenir compte de la pluie</span></label>
            <div class="row r3 keep">${sm('r-r', 'Taux', s.rain.rate_per_day, '/ jour')}${sm('r-l', 'Perte', s.rain.loss_days, 'jour')}${sm('r-t', 'Seuil bloquant', s.rain.threshold_mm, 'mm')}</div>
            ${can ? `<div><button class="btn sm" id="est-r" type="button">${ic('refresh', 15)}Estimer d’après les rapports journaliers</button></div>` : ''}</div></div>
        ${can ? `<div class="hstack"><button class="btn pri" id="save" type="button">${ic('save', 16)}Enregistrer les réglages</button><button class="btn" id="defaults" type="button">Valeurs par défaut</button></div>` : ''}
      </div>
      <div class="c6 stack" style="gap:20px">
        <div class="card"><div class="ch"><div><h3>Moteur de calcul</h3><div class="sub">Réglage propre à cet appareil. Les résultats sont identiques dans les trois modes.</div></div></div>
          <div class="stack" style="gap:14px">
            <div class="stack" style="gap:8px" role="radiogroup" aria-label="Moteur de calcul">${[['local', 'Dans le navigateur', 'Aucun serveur nécessaire ; fonctionne hors connexion.'], ['auto', 'Automatique (recommandé avec serveur)', 'Serveur Python en priorité, navigateur si le serveur ne répond pas.'], ['remote', 'Serveur Python uniquement', 'Tout passe par le serveur (Hugging Face Space).']].map(([k, t, h]) => `<label class="check" style="align-items:flex-start;gap:10px"><input type="radio" name="eng" value="${k}" ${eng.mode === k ? 'checked' : ''} style="margin-top:3px"><span><b style="font-weight:600">${t}</b><br><span class="muted" style="font-size:12.5px">${h}</span></span></label>`).join('')}</div>
            <div class="field"><label for="e-url">Adresse du serveur de calcul</label><input id="e-url" value="${esc(eng.api_url)}" placeholder="https://votre-compte-ChantierPulse.hf.space" autocomplete="off" inputmode="url"><span class="hint">Voir le guide de déploiement (étape Hugging Face). Sans barre oblique finale.</span></div>
            <div class="hstack"><button class="btn" id="e-save" type="button">${ic('save', 16)}Enregistrer</button><button class="btn" id="e-test" type="button">${ic('server', 16)}Tester la connexion</button></div>
            <div id="e-res" class="muted" style="font-size:13px"></div></div></div>
        <div class="card"><div class="ch"><div><h3>Comment ces réglages agissent</h3></div></div>
          <div class="stack" style="gap:8px;font-size:13.5px"><div><b>α</b> : plus il est petit, plus il faut un écart marqué pour déclencher une alerte de productivité.</div>
            <div><b>Fenêtre</b> : une fenêtre courte réagit vite mais manque de relevés ; 30 jours est un bon compromis.</div>
            <div><b>Niveau atypique</b> : à 95 %, environ une valeur normale sur vingt est signalée à tort et doit simplement être confirmée.</div>
            <div><b>Aléas</b> : les taux estimés d’après l’historique remplacent les valeurs saisies à la main.</div>
            <a href="#/parametres/manuel?s=page-parametres">Lire le manuel : réglages du modèle</a></div></div>
      </div>
    </div>`;
  const q = (x) => box.querySelector(x), num = (id, d) => { const v = parseNum(q(id).value); return Number.isFinite(v) && v >= 0 ? v : d; };
  const cap = (v, hi) => Math.min(v, hi);

  /* moteur (tout rôle) */
  q('#e-save').onclick = () => {
    saveEngineSettings({ mode: box.querySelector('input[name=eng]:checked').value, api_url: q('#e-url').value }); clearAnalysisCache(); store.emit();
    toast('Moteur de calcul enregistré sur cet appareil.', 'ok');
  };
  q('#e-test').onclick = async () => {
    const out = q('#e-res'), url = q('#e-url').value.trim().replace(/\/+$/, '');
    saveEngineSettings({ mode: box.querySelector('input[name=eng]:checked').value, api_url: url });
    out.innerHTML = '<span class="spin" style="width:14px;height:14px;border-width:2px"></span> Connexion… (un serveur en veille peut mettre une minute à se réveiller)';
    try { const h = await health(); out.innerHTML = `${chip('good', 'check', 'Serveur joignable')} ${esc(h.service || 'ChantierPulse')}${h.version ? ` v${esc(h.version)}` : ''} · ${h.ms} ms${h.auth !== undefined ? ` · authentification ${h.auth ? 'activée' : 'désactivée'}` : ''}`; }
    catch (e) { out.innerHTML = `${chip('crit', 'alert', 'Échec')} ${esc(e.message)}`; }
  };
  if (!can) return;

  /* estimations depuis l'historique */
  q('#est-b').onclick = () => {
    const lam = estimateBreakdownRate(st.data.failures, st.data.equipment, st.project.start_date, store.today);
    if (lam === null) { toast('Historique insuffisant : il faut au moins 2 semaines de données et un engin.', 'err'); return; }
    q('#b-l').value = fmt(lam); q('#b-m').value = fmt(meanRepairHours(st.data.failures, st.data.equipment) / 8, 2);
    toast('Valeurs estimées : vérifiez puis enregistrez.', 'ok');
  };
  q('#est-r').onclick = () => {
    const thr = num('#r-t', s.rain.threshold_mm), r = estimateRainRate(st.data.daily_reports, thr);
    if (r === null) { toast('Historique insuffisant : il faut au moins 10 rapports journaliers.', 'err'); return; }
    q('#r-r').value = fmt(r); toast(`Taux estimé : ${nf(r * 100, 0)} % des jours ont au moins ${nf(thr, 0)} mm de pluie.`, 'ok');
  };
  q('#defaults').onclick = () => {
    const d = DEFAULT_SETTINGS;
    q('#s-n').value = d.n_sim; q('#s-a').value = d.alpha; q('#s-o').value = d.outlier_level; q('#s-w').value = d.window_days;
    q('#b-on').checked = d.breakdowns.on; q('#b-l').value = fmt(d.breakdowns.lambda_per_day); q('#b-m').value = fmt(d.breakdowns.mttr_days);
    q('#r-on').checked = d.rain.on; q('#r-r').value = fmt(d.rain.rate_per_day); q('#r-l').value = fmt(d.rain.loss_days); q('#r-t').value = fmt(d.rain.threshold_mm);
  };
  q('#save').onclick = async () => {
    try {
      const bl = num('#b-l', s.breakdowns.lambda_per_day), rr = num('#r-r', s.rain.rate_per_day);
      if (bl > 5) throw new Error('Taux de pannes irréaliste (plus de 5 par jour et par tâche).');
      if (rr > 1) throw new Error('Le taux de pluie est une proportion de jours : il ne peut pas dépasser 1.');
      await store.setSettings({
        n_sim: Number(q('#s-n').value), alpha: Number(q('#s-a').value), outlier_level: Number(q('#s-o').value), window_days: Number(q('#s-w').value),
        breakdowns: { on: q('#b-on').checked, lambda_per_day: bl, mttr_days: cap(num('#b-m', s.breakdowns.mttr_days), 30) },
        rain: { on: q('#r-on').checked, rate_per_day: rr, loss_days: cap(num('#r-l', s.rain.loss_days), 30), threshold_mm: cap(num('#r-t', s.rain.threshold_mm), 500) },
      });
      clearAnalysisCache(); toast('Réglages enregistrés : les analyses les utilisent dès maintenant.', 'ok');
    } catch (e) { errorToast(e); }
  };
}
