/* Écran de connexion / création de compte / nouveau mot de passe (exemplaire avec connexion). */
import { store, CONFIG } from '../store.js';
import { ic, LOGO, errorToast } from '../ui.js';
import { esc } from '../format.js';
import { themeButton } from '../theme.js';

export function renderLogin(app, { mode = 'signin', recovery = false } = {}) {
  let m = recovery ? 'newpass' : mode, info = '', error = '';
  const wave = '<svg class="wave" width="520" height="220" viewBox="0 0 520 220" fill="none" aria-hidden="true"><path d="M0 190C80 190 110 150 170 80 205 40 235 10 260 10s55 30 90 70c60 70 90 110 170 110" stroke="#86b6ef" stroke-width="3" stroke-linecap="round"/><path d="M0 190h520" stroke="#2a78d6" stroke-width="2" opacity=".6"/></svg>';

  function paint() {
    const signup = m === 'signup', reset = m === 'reset', newpass = m === 'newpass';
    app.innerHTML = `<div class="login">
      <section class="art">
        <div style="display:flex;align-items:center;gap:12px">${LOGO}<b style="font-size:19px;letter-spacing:-.01em">ChantierPulse</b></div>
        <div><h1>Donnez à votre planning sa vraie <em>marge d’incertitude</em>.</h1>
          <p>Suivez la productivité, la fiabilité des engins et les livraisons de béton, et sachez quelle est la probabilité de tenir votre échéance.</p>
          <ul><li>${ic('dice', 18)} Simulation de Monte Carlo du délai de fin</li><li>${ic('activity', 18)} Écarts de productivité testés statistiquement</li><li>${ic('wrench', 18)} Pannes d’engins : loi de Poisson et MTBF</li><li>${ic('truck', 18)} Files d’attente des camions-toupies</li></ul></div>
        <small style="color:#8da3c4">Pilotage par l’aléa</small>${wave}
      </section>
      <section class="formcol"><div class="theme-float">${themeButton()}</div><form class="box" id="lf" novalidate>
        <h2>${newpass ? 'Nouveau mot de passe' : reset ? 'Mot de passe oublié' : signup ? 'Créer un compte' : 'Connexion'}</h2>
        <p>${newpass ? 'Choisissez un nouveau mot de passe (8 caractères minimum).' : reset ? 'Saisissez votre adresse e-mail : vous recevrez un lien pour choisir un nouveau mot de passe.' : signup ? 'Votre compte sera actif après votre ajout à un chantier par la direction.' : 'Accédez à vos chantiers.'}</p>
        ${info ? `<div class="note good" role="status">${ic('check', 18)}<div>${esc(info)}</div></div>` : ''}
        ${error ? `<div class="note crit" role="alert">${ic('alert', 18)}<div>${esc(error)}</div></div>` : ''}
        ${signup ? `<div class="field"><label for="fn">Nom complet</label><input id="fn" autocomplete="name" required></div>` : ''}
        ${newpass ? '' : `<div class="field"><label for="em">Adresse e-mail</label><input id="em" type="email" autocomplete="email" inputmode="email" required></div>`}
        ${reset ? '' : `<div class="field"><label for="pw">${newpass ? 'Nouveau mot de passe' : 'Mot de passe'}</label><input id="pw" type="password" autocomplete="${signin() ? 'current-password' : 'new-password'}" required minlength="8"></div>`}
        <button class="btn pri lg block" id="go" type="submit">${newpass ? 'Enregistrer le mot de passe' : reset ? 'Envoyer le lien' : signup ? 'Créer mon compte' : 'Se connecter'}</button>
        <div class="alt">
          ${m === 'signin' ? `<a href="#" data-m="reset">Mot de passe oublié ?</a>${CONFIG.ALLOW_SIGNUP ? ` · <a href="#" data-m="signup">Créer un compte</a>` : ''}` : newpass ? '' : `<a href="#" data-m="signin">Retour à la connexion</a>`}
        </div></form></section></div>`;
    app.querySelectorAll('[data-m]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); m = a.dataset.m; info = error = ''; paint(); }));
    app.querySelector('#lf').addEventListener('submit', submit);
    (app.querySelector('#em') || app.querySelector('#pw'))?.focus();
  }
  const signin = () => m === 'signin';

  async function submit(e) {
    e.preventDefault();
    const val = (id) => app.querySelector(id)?.value.trim() ?? '';
    const btn = app.querySelector('#go'); error = ''; info = '';
    const email = val('#em'), pw = app.querySelector('#pw')?.value || '';
    try {
      if (m !== 'newpass' && !/^\S+@\S+\.\S+$/.test(email)) throw new Error('Saisissez une adresse e-mail valide.');
      if ((m === 'signin' || m === 'signup' || m === 'newpass') && pw.length < (m === 'signin' ? 1 : 8)) throw new Error(m === 'signin' ? 'Saisissez votre mot de passe.' : 'Le mot de passe doit contenir au moins 8 caractères.');
      if (m === 'signup' && !val('#fn')) throw new Error('Saisissez votre nom.');
      btn.disabled = true; btn.textContent = 'Un instant…';
      if (m === 'signin') await store.signIn(email, pw);
      else if (m === 'signup') {
        const r = await store.signUp(email, pw, val('#fn'));
        if (r.needsConfirmation) { m = 'signin'; info = 'Compte créé. Ouvrez le lien de confirmation envoyé par e-mail, puis connectez-vous.'; paint(); }
      } else if (m === 'reset') { await store.client.auth.resetPassword(email); m = 'signin'; info = 'Si un compte existe pour cette adresse, un e-mail vient d’être envoyé.'; paint(); }
      else if (m === 'newpass') { await store.client.auth.updatePassword(pw); await store.afterLogin(); store.emit(); }
    } catch (err) { error = err.message || String(err); paint(); }
  }
  paint();
}
