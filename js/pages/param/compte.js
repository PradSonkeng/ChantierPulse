/* Paramètres › Compte : nom, rôle, mot de passe, déconnexion. */
import { store } from '../../store.js';
import { ic, toast, errorToast, field, initials, confirmDialog } from '../../ui.js';
import { esc } from '../../format.js';
import { ROLE_LABELS } from '../../model.js';
import { themeSeg } from '../../theme.js';

export const live = false;      // le formulaire ne doit pas être réaffiché pendant la saisie

export async function render(box) {
  const st = store.state, p = st.profile, supa = store.mode === 'supabase';
  box.innerHTML = `<div class="grid g12" style="align-items:start"><div class="c6 stack" style="gap:20px">
    <div class="card"><div class="ch"><div><h3>Mon profil</h3></div></div>
      <div class="hstack" style="gap:14px;margin-bottom:16px"><div class="av" style="width:52px;height:52px;font-size:18px">${esc(initials(p.full_name || p.email))}</div><div><b style="font-size:16px">${esc(p.full_name || '—')}</b><div class="muted">${esc(p.email || st.user.email || '')}</div><span class="tag">${esc(ROLE_LABELS[p.role] || p.role)}</span></div></div>
      <form id="nform" class="stack" autocomplete="off">${field('Nom affiché', `<input id="nm" value="${esc(p.full_name || '')}" maxlength="80">`, { id: 'nm', hint: 'Il apparaît sur les saisies et les rapports.' })}<div><button class="btn pri" type="submit">${ic('save', 16)}Enregistrer</button></div></form></div>
    ${supa ? `<div class="card"><div class="ch"><div><h3>Mot de passe</h3></div></div><form id="pform" class="stack" autocomplete="off">
      ${field('Nouveau mot de passe', '<input id="pw1" type="password" minlength="8" autocomplete="new-password">', { id: 'pw1', hint: '8 caractères minimum.' })}${field('Confirmer', '<input id="pw2" type="password" autocomplete="new-password">', { id: 'pw2' })}
      <div><button class="btn" type="submit">${ic('lock', 16)}Changer le mot de passe</button></div></form></div>` : ''}
    </div><div class="c6 stack" style="gap:20px">
    <div class="card"><div class="ch"><div><h3>Apparence</h3><div class="sub">Thème clair, thème sombre, ou automatique selon le réglage de votre appareil. Le choix est mémorisé dans ce navigateur ; l’impression et les PDF restent toujours en clair.</div></div></div>${themeSeg()}<div class="muted" style="font-size:12.5px;margin-top:10px">Raccourci : le bouton rond en haut de chaque page (lune / soleil / écran) change de thème d’un clic.</div></div>
    <div class="card"><div class="ch"><div><h3>Session</h3></div></div><div class="stack" style="gap:10px;font-size:13.5px">
      ${supa ? `<div>Connecté avec <b>${esc(st.user.email || '')}</b>.</div><div><button class="btn" id="out" type="button">${ic('logout', 16)}Se déconnecter</button></div>`
        : `<div>Exemplaire de démonstration : il n’y a pas de connexion. Le sélecteur « Voir l’application en tant que », en haut de page, change de personne et de rôle.</div>`}</div></div>
    <div class="card"><div class="ch"><div><h3>Mon rôle : ${esc(ROLE_LABELS[p.role] || '')}</h3></div></div><div class="stack" style="gap:6px;font-size:13.5px">
      ${[['Saisir rendements, rapports du jour, pannes', store.can('enter')], ['Modifier le planning, les activités, les engins, les surcoûts', store.can('plan')], ['Gérer utilisateurs et chantiers', store.can('admin')]].map(([t, ok]) => `<div class="hstack" style="gap:8px;flex-wrap:nowrap">${ic(ok ? 'check' : 'x', 17)}<span class="${ok ? '' : 'muted'}">${t}</span></div>`).join('')}</div></div>
    </div></div>`;
  box.querySelector('#nform').onsubmit = async (e) => { e.preventDefault(); try { const n = box.querySelector('#nm').value.trim(); if (!n) throw new Error('Le nom ne peut pas être vide.'); await store.updateMyName(n); toast('Profil enregistré.', 'ok'); } catch (er) { errorToast(er); } };
  const pf = box.querySelector('#pform');
  if (pf) pf.onsubmit = async (e) => {
    e.preventDefault();
    try {
      const a = box.querySelector('#pw1').value, b = box.querySelector('#pw2').value;
      if (a.length < 8) throw new Error('Le mot de passe doit contenir au moins 8 caractères.');
      if (a !== b) throw new Error('Les deux mots de passe sont différents.');
      await store.client.auth.updatePassword(a); pf.reset(); toast('Mot de passe modifié.', 'ok');
    } catch (er) { errorToast(er); }
  };
  const out = box.querySelector('#out'); if (out) out.onclick = async () => { if (await confirmDialog('Se déconnecter de ChantierPulse ?', { title: 'Déconnexion', ok: 'Se déconnecter' })) await store.signOut(); };
}
