/* Paramètres › Données : sauvegarde, file d'attente hors connexion, brouillons, réinitialisation de la démo. */
import { store, PROJECT_TABLES } from '../../store.js';
import { ic, toast, errorToast, confirmDialog, downloadBlob, slug } from '../../ui.js';
import { esc, nf } from '../../format.js';
import { clearAnalysisCache } from '../../analysis.js';

const draftKeys = () => Object.keys(localStorage).filter((k) => k.startsWith('Chantierpulse.draft.'));

export async function render(box) {
  const st = store.state, d = st.data, demo = store.mode === 'demo';
  let nDrafts = 0; try { nDrafts = draftKeys().length; } catch { /* stockage indisponible */ }
  box.innerHTML = `<div class="grid g12" style="align-items:start"><div class="c7 stack" style="gap:20px">
    <div class="card"><div class="ch"><div><h3>Contenu du chantier</h3><div class="sub">${esc(st.project.name)}</div></div></div>
      <div class="grid" style="grid-template-columns:repeat(4,minmax(0,1fr));gap:10px">${[['Tâches', d.tasks.length], ['Relevés de productivité', d.productivity_entries.length], ['Rapports journaliers', d.daily_reports.length], ['Pannes', d.failures.length], ['Engins', d.equipment.length], ['Activités', d.activities.length], ['Surcoûts', d.cost_events.length], ['Scénarios de file', d.queue_scenarios.length]]
        .map(([l, n]) => `<div style="border:1px solid var(--border);border-radius:12px;padding:10px 12px"><div class="muted" style="font-size:12px">${l}</div><b class="big" style="font-size:22px">${nf(n, 0)}</b></div>`).join('')}</div></div>
    <div class="card"><div class="ch"><div><h3>Sauvegarde et export</h3><div class="sub">Gardez une copie de vos données, indépendante de la base en ligne.</div></div></div>
      <div class="hstack"><button class="btn pri" id="json" type="button">${ic('download', 16)}Sauvegarde complète (JSON)</button><a class="btn" href="#/rapports">${ic('file', 16)}Exports CSV et rapport</a></div>
      <div class="muted" style="font-size:12.5px;margin-top:8px">Le fichier JSON contient le chantier, ses réglages et toutes les tables ci-dessus.</div></div>
    </div><div class="c5 stack" style="gap:20px">
    <div class="card"><div class="ch"><div><h3>Saisies hors connexion</h3></div></div>
      <div class="stack" style="gap:10px"><div>${st.pending ? `${chip2('warn', `${st.pending} en attente d’envoi`)}` : chip2('good', 'Tout est synchronisé')}</div>
        <div class="muted" style="font-size:13px">Sans réseau, les saisies de terrain (rendements, rapports du jour, pannes) sont gardées sur l’appareil puis envoyées automatiquement.</div>
        ${store.mode === 'supabase' ? `<button class="btn sm" id="flush" type="button" style="align-self:flex-start" ${st.pending ? '' : 'disabled'}>${ic('refresh', 15)}Envoyer maintenant</button>` : '<div class="muted" style="font-size:12.5px">Non utilisé dans l’exemplaire de démonstration (tout est local).</div>'}</div></div>
    <div class="card"><div class="ch"><div><h3>Brouillons de saisie</h3></div></div>
      <div class="stack" style="gap:10px"><div class="muted" style="font-size:13px">${nDrafts ? `${nDrafts} brouillon${nDrafts > 1 ? 's' : ''} enregistré${nDrafts > 1 ? 's' : ''} sur cet appareil.` : 'Aucun brouillon.'}</div>
        <button class="btn sm" id="drafts" type="button" style="align-self:flex-start" ${nDrafts ? '' : 'disabled'}>${ic('trash', 15)}Effacer les brouillons</button></div></div>
    ${demo ? `<div class="card"><div class="ch"><div><h3>Données de démonstration</h3></div></div><div class="stack" style="gap:10px"><div class="muted" style="font-size:13px">Remet les données d’exemple d’origine ; vos modifications sont perdues.</div><button class="btn danger sm" id="reset" type="button" style="align-self:flex-start">${ic('refresh', 15)}Réinitialiser la démonstration</button></div></div>` : ''}
    </div></div>`;
  box.querySelector('#json').onclick = () => {
    const out = { application: 'ChantierPulse', export_version: 1, exported_at: new Date().toISOString(), project: st.project, tables: Object.fromEntries(PROJECT_TABLES.map((t) => [t, d[t]])) };
    downloadBlob(`${slug(st.project.name)}-sauvegarde-${store.today}.json`, new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' })); toast('Sauvegarde téléchargée.', 'ok');
  };
  const fl = box.querySelector('#flush'); if (fl) fl.onclick = () => store.flush().then(() => toast('Synchronisation terminée.', 'ok')).catch(errorToast);
  const dr = box.querySelector('#drafts'); if (dr) dr.onclick = async () => { if (!(await confirmDialog('Effacer tous les brouillons de saisie enregistrés sur cet appareil ?', { title: 'Effacer les brouillons', ok: 'Effacer', danger: true }))) return; draftKeys().forEach((k) => localStorage.removeItem(k)); toast('Brouillons effacés.', 'ok'); store.emit(); };
  const rs = box.querySelector('#reset');
  if (rs) rs.onclick = async () => { if (!(await confirmDialog('Remettre les données d’exemple d’origine ? Vos modifications seront perdues.', { title: 'Réinitialiser la démonstration', ok: 'Réinitialiser', danger: true }))) return; clearAnalysisCache(); await store.resetDemo(); toast('Données d’exemple rétablies.', 'ok'); };
}
function chip2(kind, text) { return `<span class="chip ${kind}">${text}</span>`; }
