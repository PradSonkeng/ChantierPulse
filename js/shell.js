/* Coque de l'application : menu latéral, barre supérieure, bandeaux, recherche, alertes. */
import { store, CONFIG } from './store.js';
import { startRouter, ROUTES, go, parseHash } from './router.js';
import { ic, LOGO, initials, openModal, errorToast, toast, confirmDialog } from './ui.js';
import { esc, dateFull, dateWeekday } from './format.js';
import { ROLE_LABELS } from './model.js';
import { buildAlerts, analyzeActivities, clearAnalysisCache } from './analysis.js';
import { failuresThisWeek, isPending } from './model.js';
import { wakeServer } from './engine.js';
import { themeButton } from './theme.js';

const NAV = [
  ['PILOTAGE', [['dashboard', '/', 'Tableau de bord', 'dashboard']]],
  ['COLLECTE', [['saisie', '/saisie', 'Saisie quotidienne', 'clipboard']]],
  ['ANALYSES PROBABILISTES', [
    ['ecarts', '/ecarts', 'Analyse des écarts', 'activity'], ['monte', '/monte-carlo', 'Simulation Monte Carlo', 'dice'],
    ['fiabilite', '/fiabilite', 'Fiabilité des engins', 'wrench'], ['files', '/files', 'Files d’attente', 'truck'],
  ]],
  ['PROJET', [['rapports', '/rapports', 'Rapports', 'file'], ['parametres', '/parametres', 'Paramètres', 'sliders']]],
];
const TITLES = {
  dashboard: 'Tableau de bord', saisie: 'Saisie quotidienne', ecarts: 'Analyse des écarts', monte: 'Simulation Monte Carlo',
  fiabilite: 'Fiabilité des engins', files: 'Files d’attente', rapports: 'Rapports', parametres: 'Paramètres',
};
const PAGES = [['Tableau de bord', '#/'], ['Saisie quotidienne', '#/saisie'], ['Analyse des écarts', '#/ecarts'], ['Simulation Monte Carlo', '#/monte-carlo'],
  ['Fiabilité des engins', '#/fiabilite'], ['Files d’attente', '#/files'], ['Rapports', '#/rapports'], ['Paramètres', '#/parametres'], ['Manuel d’utilisation', '#/parametres/manuel']];
const BOTTOM = [['dashboard', '/', 'Accueil', 'dashboard'], ['saisie', '/saisie', 'Saisie', 'clipboard'], ['monte', '/monte-carlo', 'Prévisions', 'dice'], ['fiabilite', '/fiabilite', 'Engins', 'wrench']];

export function mountShell(app) {
  app.innerHTML = `
  <div class="app">
    <aside class="side" id="side" aria-label="Navigation principale">
      <a class="brand" href="#/">${LOGO}<div><b>ChantierPulse</b><small>Pilotage par l’aléa</small></div></a>
      <div class="proj" id="projbox"></div>
      <nav id="nav"></nav>
      <div class="spacer"></div>
      <div class="me" id="mebox"></div>
    </aside>
    <div class="scrim" id="scrim"></div>
    <div class="main">
      <div id="banners"></div>
      <header class="top">
        <button class="iconbtn menu-btn" id="menubtn" aria-label="Ouvrir le menu">${ic('menu', 20)}</button>
        <div class="crumb" id="crumb"></div>
        <div class="grow">
          <div class="search" id="searchbox" role="search">${ic('search', 16)}<input id="q" type="search" placeholder="Rechercher une tâche, un engin…" autocomplete="off" aria-label="Rechercher"><span class="kbd">Ctrl K</span></div>
          ${themeButton()}
          <button class="iconbtn" id="bellbtn" aria-label="Alertes">${ic('bell', 18)}<span class="dot" id="belldot" hidden></span></button>
          <div class="av" id="topav" style="width:38px;height:38px"></div>
        </div>
      </header>
      <main class="page" id="view" tabindex="-1"></main>
    </div>
    <nav class="bottomnav" id="bottomnav" aria-label="Navigation mobile"></nav>
  </div>`;
  const $ = (s) => app.querySelector(s);
  const view = $('#view');

  /* ── rendu des éléments qui dépendent de l'état ── */
  let activeNav = 'dashboard', badges = {};
  function renderChrome() {
    const st = store.state;
    $('#projbox').innerHTML = st.project
      ? `${ic('pin', 18)}<div style="min-width:0"><div class="n">${esc(st.project.name)}</div><div class="s">${esc(st.project.location || '')}</div></div>${ic('chevdown', 16)}${st.projects.length > 1 ? `<select id="projsel" aria-label="Changer de chantier">${st.projects.map((p) => `<option value="${p.id}"${p.id === st.projectId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}</select>` : ''}`
      : `${ic('pin', 18)}<div><div class="n">Aucun chantier</div></div>`;
    const ps = $('#projsel'); if (ps) ps.onchange = () => store.selectProject(ps.value).then(() => { clearAnalysisCache(); go('/'); }).catch(errorToast);
    $('#nav').innerHTML = NAV.map(([sec, items]) => `<div class="sec">${sec}</div>${items.map(([key, path, label, icon]) => `<a class="nav ${key === activeNav ? 'on' : ''}" href="#${path}">${ic(icon, 18)}${label}${badges[key] ? `<span class="badge">${badges[key]}</span>` : ''}</a>`).join('')}`).join('');
    const p = st.profile;
    $('#mebox').innerHTML = `<div class="av">${esc(initials(p?.full_name))}</div><div style="min-width:0"><div class="n">${esc(p?.full_name || '')}</div><div class="s">${esc(ROLE_LABELS[p?.role] || '')}</div></div>${store.mode === 'supabase' ? `<button class="iconbtn" id="logout" title="Se déconnecter" aria-label="Se déconnecter" style="margin-left:auto;background:rgba(255,255,255,.08);border-color:transparent;color:#c9c9c4">${ic('logout', 17)}</button>` : ''}`;
    const lo = $('#logout'); if (lo) lo.onclick = async () => { if (await confirmDialog('Se déconnecter de ChantierPulse ?', { title: 'Déconnexion', ok: 'Se déconnecter' })) { await store.signOut(); } };
    $('#topav').textContent = initials(p?.full_name);
    $('#bottomnav').innerHTML = BOTTOM.map(([key, path, label, icon]) => `<a class="${key === activeNav ? 'on' : ''}" href="#${path}">${ic(icon, 22)}${label}</a>`).join('') + `<button id="morebtn" class="${['ecarts', 'files', 'rapports', 'parametres'].includes(activeNav) ? 'on' : ''}">${ic('menu', 22)}Menu</button>`;
    const mb = $('#morebtn'); if (mb) mb.onclick = () => document.body.classList.add('nav-open');
    renderBanners();
  }
  function renderBanners() {
    const st = store.state; let h = '';
    if (store.mode === 'demo') {
      h += `<div class="demo-banner" role="note"><b>Exemplaire de démonstration</b><span>données fictives enregistrées dans ce navigateur · date simulée : ${esc(dateFull(store.today))}</span>
        <span style="margin-left:auto;display:flex;gap:8px;align-items:center;flex-wrap:wrap"><label for="demouser">Voir l’application en tant que</label>
        <select id="demouser">${(store.adapter?.users || []).map((u) => `<option value="${u.id}"${u.id === st.user?.id ? ' selected' : ''}>${esc(u.full_name)} — ${ROLE_LABELS[u.role]}</option>`).join('')}</select>
        <button id="demoreset">Réinitialiser les données</button></span></div>`;
    }
    if (!st.online || st.pending) {
      h += `<div class="net-banner" role="status">${ic('wifi-off', 14)} ${!st.online ? 'Hors connexion.' : 'Synchronisation en cours.'} ${st.pending ? `${st.pending} saisie${st.pending > 1 ? 's' : ''} sera${st.pending > 1 ? 'ont' : ''} envoyée${st.pending > 1 ? 's' : ''} dès le retour du réseau.` : ''}</div>`;
    }
    $('#banners').innerHTML = h;
    const du = $('#demouser'); if (du) du.onchange = () => store.switchDemoUser(du.value).then(() => { clearAnalysisCache(); renderChrome(); store.emit(); navigateAgain(); }).catch(errorToast);
    const dr = $('#demoreset');
    if (dr) dr.onclick = async () => { if (await confirmDialog('Remettre les données d’exemple d’origine ? Vos modifications faites dans cette démonstration seront perdues.', { title: 'Réinitialiser la démonstration', ok: 'Réinitialiser', danger: true })) { clearAnalysisCache(); await store.resetDemo(); toast('Données d’exemple rétablies.', 'ok'); navigateAgain(); } };
    if (st.syncErrors.length) { st.syncErrors.splice(0).forEach((m) => errorToast(new Error(m))); }
  }
  function renderCrumb(key) {
    const name = store.state.project?.name;
    $('#crumb').innerHTML = `${name ? `<span>${esc(name)}</span><span class="sepc">/</span>` : ''}<b>${TITLES[key] || ''}</b>`;
    document.title = `${TITLES[key] || 'ChantierPulse'} · ChantierPulse`;
  }
  let router, shownWithProject = !!store.state.project;
  const navigateAgain = () => router && router.navigate(true);

  /* ── pastilles du menu (calculées en tâche de fond) ── */
  let badgeTimer = null;
  function scheduleBadges() {
    clearTimeout(badgeTimer);
    badgeTimer = setTimeout(async () => {
      const st = store.state; if (!st.project) return;
      try {
        const acts = await analyzeActivities(st);
        const n = acts.filter((a) => a.result?.significant).length + st.data.productivity_entries.filter(isPending).length;
        badges = { ecarts: n || 0, fiabilite: failuresThisWeek(st.data.failures, store.today).length || 0 };
        const alerts = await buildAlerts(st);
        $('#belldot').hidden = !alerts.some((a) => a.kind === 'crit' || a.kind === 'warn');
        const nav = $('#nav'); if (nav) { renderNavOnly(); }
      } catch { /* les pastilles sont facultatives */ }
    }, 250);
  }
  function renderNavOnly() {
    $('#nav').innerHTML = NAV.map(([sec, items]) => `<div class="sec">${sec}</div>${items.map(([key, path, label, icon]) => `<a class="nav ${key === activeNav ? 'on' : ''}" href="#${path}">${ic(icon, 18)}${label}${badges[key] ? `<span class="badge">${badges[key]}</span>` : ''}</a>`).join('')}`).join('');
  }

  /* ── menu mobile ── */
  $('#menubtn').onclick = () => document.body.classList.add('nav-open');
  $('#scrim').onclick = () => document.body.classList.remove('nav-open');
  app.addEventListener('click', (e) => { if (e.target.closest('.side a.nav')) document.body.classList.remove('nav-open'); });

  /* ── alertes (cloche) ── */
  $('#bellbtn').onclick = async () => {
    const m = openModal({ title: 'Alertes et recommandations', sub: 'Générées par les contrôles statistiques sur vos données.', body: '<div class="loading"><span class="spin"></span>Analyse en cours…</div>', actions: [{ label: 'Fermer' }], wide: true });
    try {
      const alerts = await buildAlerts(store.state);
      m.$('.mbody').innerHTML = alerts.length ? `<div class="stack">${alerts.map(alertRow).join('')}</div>` : '<div class="empty"><b>Aucune alerte</b>Tout est dans la norme.</div>';
      m.el.querySelectorAll('a[href]').forEach((a) => a.addEventListener('click', () => m.close()));
    } catch (e) { m.$('.mbody').innerHTML = `<p>${esc(e.message)}</p>`; }
  };

  /* ── recherche rapide ── */
  const q = $('#q'); let box = null;
  const closeSearch = () => { if (box) { box.remove(); box = null; } };
  function results(text) {
    const st = store.state, t = text.trim().toLowerCase(); if (!t) return [];
    const out = [];
    for (const [label, href] of PAGES) if (label.toLowerCase().includes(t)) out.push({ icon: 'chevright', label, sub: 'Page', href });
    for (const tk of st.data.tasks) if (`${tk.code} ${tk.name}`.toLowerCase().includes(t)) out.push({ icon: 'layers', label: tk.name, sub: `Tâche ${tk.code}`, href: '#/parametres/planning' });
    for (const a of st.data.activities) if (a.name.toLowerCase().includes(t)) out.push({ icon: 'activity', label: a.name, sub: 'Activité', href: `#/ecarts?a=${a.id}` });
    for (const e of st.data.equipment) if (e.name.toLowerCase().includes(t)) out.push({ icon: 'wrench', label: e.name, sub: 'Engin', href: `#/fiabilite?e=${e.id}` });
    return out.slice(0, 8);
  }
  q.addEventListener('input', () => {
    closeSearch(); const r = results(q.value); if (!r.length) return;
    box = document.createElement('div');
    box.style.cssText = 'position:absolute;top:44px;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:12px;box-shadow:var(--pop-shadow);z-index:50;padding:6px';
    box.innerHTML = r.map((x) => `<a href="${x.href}" style="display:flex;gap:10px;align-items:center;padding:8px 10px;border-radius:8px;text-decoration:none;color:var(--ink)">${ic(x.icon, 16)}<span>${esc(x.label)}</span><span class="muted" style="margin-left:auto;font-size:12px">${x.sub}</span></a>`).join('');
    $('#searchbox').style.position = 'relative'; $('#searchbox').appendChild(box);
    box.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => { q.value = ''; closeSearch(); }));
  });
  q.addEventListener('blur', () => setTimeout(closeSearch, 150));
  document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); q.focus(); } });

  /* ── démarrage du routeur ── */
  router = startRouter({
    root: view,
    onRoute(route) {
      activeNav = ROUTES[route.path]?.nav || 'dashboard';
      shownWithProject = !!store.state.project;
      renderChrome(); renderCrumb(activeNav);
      document.body.classList.remove('nav-open');
      window.scrollTo(0, 0);
      scheduleBadges();
    },
  });
  /* Le menu et la page suivent les changements de chantier (accès accordé, chantier créé ou renommé) sans rechargement. */
  const chromeKeyOf = (st) => [st.projectId, st.project?.name, st.project?.location, st.projects.length, st.profile?.full_name, st.profile?.role].join('|');
  let chromeKey = chromeKeyOf(store.state);
  store.subscribe((st) => {
    renderBanners(); scheduleBadges();
    const k = chromeKeyOf(st);
    if (k !== chromeKey) { chromeKey = k; renderChrome(); renderCrumb(activeNav); }
    if (!!st.project !== shownWithProject && !st.loading) navigateAgain();
  });
  wakeServer();
  return { router, renderChrome };
}

export function alertRow(a) {
  const col = { crit: ['var(--tint-crit)', 'var(--crittxt)'], warn: ['var(--tint-warn)', 'var(--warntxt)'], info: ['var(--tint-info)', 'var(--blue600)'] }[a.kind];
  return `<a href="${a.href || '#/'}" style="display:flex;gap:12px;text-decoration:none;color:inherit"><div style="width:38px;height:38px;border-radius:10px;background:${col[0]};color:${col[1]};display:flex;align-items:center;justify-content:center;flex:none">${ic(a.icon, 19)}</div>
    <div style="min-width:0"><div style="display:flex;gap:10px;justify-content:space-between"><b style="font-weight:620">${esc(a.title)}</b><span class="muted" style="font-size:12px;white-space:nowrap">${esc(a.when || '')}</span></div><div class="ink2" style="font-size:13px">${esc(a.text)}</div></div></a>`;
}
