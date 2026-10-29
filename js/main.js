/* Point d'entrée : démarre le store, affiche la connexion ou l'application. */
import { store, CONFIG } from './store.js';
import { mountShell } from './shell.js';
import { renderLogin } from './pages/login.js';
import { ic, LOGO, toast } from './ui.js';
import { initTheme } from './theme.js';
import { esc } from './format.js';

initTheme(toast);
const app = document.getElementById('app');
let shell = null, lastKey = '';

function fatal(title, text) {
  app.innerHTML = `<div style="max-width:560px;margin:12vh auto;padding:0 20px"><div class="card"><div style="display:flex;gap:12px;align-items:center;margin-bottom:10px">${LOGO}<b style="font-size:18px">ChantierPulse</b></div>
  <div class="note crit">${ic('alert', 18)}<div><b>${esc(title)}</b><br>${text}</div></div></div></div>`;
}

/** Liens reçus par e-mail (confirmation d'inscription, réinitialisation) : le jeton est dans le « # » de l'adresse. */
async function consumeEmailLink() {
  const h = location.hash.replace(/^#\/?/, '');
  if (!h.includes('access_token=')) return null;
  const p = new URLSearchParams(h);
  history.replaceState(null, '', location.pathname + location.search + '#/');
  if (store.mode !== 'supabase') return null;
  await store.client.auth.setFromTokens({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in') });
  return p.get('type');
}

function render() {
  const st = store.state;
  const key = store.mode === 'supabase' && !st.user ? 'login' : 'app';
  if (key === lastKey) return;
  lastKey = key;
  if (key === 'login') { shell = null; document.body.classList.remove('has-steps'); renderLogin(app); }
  else { shell = mountShell(app); }
}

async function boot() {
  try {
    if (store.mode === 'supabase' && (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY)) throw new Error('config');
    await store.init();
    const linkType = await consumeEmailLink().catch((e) => { console.warn(e); return null; });
    if (linkType === 'recovery') { lastKey = 'recovery'; renderLogin(app, { recovery: true }); }
    else if (linkType) await store.afterLogin().catch(() => {});
  } catch (e) {
    if (e.message === 'config') return fatal('Configuration incomplète', 'Renseignez <code>SUPABASE_URL</code> et <code>SUPABASE_ANON_KEY</code> dans le fichier <code>config.js</code> (voir le guide de déploiement).');
    console.error(e);
    return fatal('Impossible de démarrer l’application', `${esc(e.message || e)}<br><small>Vérifiez la configuration (<code>config.js</code>) et que le script <code>supabase/schema.sql</code> a bien été exécuté.</small>`);
  }
  store.subscribe(() => { if (lastKey !== 'recovery') render(); });
  if (lastKey !== 'recovery') render();
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('./sw.js').catch(() => {});
}
boot();
