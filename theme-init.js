// Thème : appliqué AVANT le premier affichage (pas de flash blanc en thème sombre).
(function () {
  var el = document.documentElement, host = el.getAttribute('data-theme'), pref = null;
  window.__cpHostTheme = host;   // thème imposé par la page qui nous héberge, s'il y en a un (aperçu intégré)
  try { pref = localStorage.getItem('Chantierpulse.theme'); } catch (e) { /* stockage indisponible */ }
  var t = pref === 'light' || pref === 'dark' ? pref
    : (host === 'light' || host === 'dark' ? host : (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
  el.setAttribute('data-theme', t);
})();
