/* Routeur à base de « # » : chaque page est un module chargé à la demande. */
import { store } from './store.js';
import { ic, spinner, errorToast } from './ui.js';
import { esc } from './format.js';

export const ROUTES = {
  '/': { module: './pages/dashboard.js', nav: 'dashboard' },
  '/saisie': { module: './pages/saisie.js', nav: 'saisie' },
  '/ecarts': { module: './pages/ecarts.js', nav: 'ecarts' },
  '/monte-carlo': { module: './pages/monte.js', nav: 'monte' },
  '/fiabilite': { module: './pages/fiabilite.js', nav: 'fiabilite' },
  '/files': { module: './pages/files.js', nav: 'files' },
  '/rapports': { module: './pages/rapports.js', nav: 'rapports' },
  '/parametres': { module: './pages/parametres.js', nav: 'parametres' },
};

export function parseHash(hash = location.hash) {
  const raw = hash.replace(/^#/, '') || '/';
  const [pathPart, qs = ''] = raw.split('?');
  const segs = pathPart.split('/').filter(Boolean);
  const path = segs.length ? '/' + segs[0] : '/';
  const query = Object.fromEntries(new URLSearchParams(qs));
  return { path, params: segs.slice(1), query, full: raw };
}
export const go = (to) => { if (location.hash === '#' + to) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = to; };

export function startRouter({ root, onRoute }) {
  let token = 0, cleanups = [], current = null;
  const ctxFor = (route) => ({
    store, route, params: route.params, query: route.query, go,
    /** Se réabonne aux changements de données ; désabonnement automatique en quittant la page. */
    subscribe(fn) { const off = store.subscribe(fn); cleanups.push(off); return off; },
    onLeave(fn) { cleanups.push(fn); },
    rerender: () => navigate(true),
  });

  async function navigate(force = false) {
    const route = parseHash();
    const def = store.state.project ? ROUTES[route.path] : { module: './pages/noproject.js', nav: 'dashboard' };
    const my = ++token;
    cleanups.forEach((f) => { try { f(); } catch { /* ignoré */ } }); cleanups = [];
    document.body.classList.remove('has-steps');
    if (!def) { root.innerHTML = `<div class="card"><div class="empty"><b>Page introuvable</b><a href="#/">Retour au tableau de bord</a></div></div>`; onRoute && onRoute(route, null); return; }
    root.innerHTML = spinner();
    try {
      const mod = await import(def.module);
      if (my !== token) return;
      current = mod;
      onRoute && onRoute(route, mod);
      const holder = document.createElement('div'); holder.style.display = 'contents';
      root.replaceChildren(holder);
      await mod.render(holder, ctxFor(route));
    } catch (e) {
      if (my !== token) return;
      console.error(e);
      root.innerHTML = `<div class="card"><div class="empty"><b>Cette page n’a pas pu s’afficher</b>${esc(e.message || e)}<br><br><button class="btn pri" id="retry">${ic('refresh', 16)}Réessayer</button></div></div>`;
      root.querySelector('#retry').onclick = () => navigate(true);
      errorToast(e);
    }
  }
  window.addEventListener('hashchange', () => navigate());
  navigate();
  return { navigate, get current() { return current; } };
}
