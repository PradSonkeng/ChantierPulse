/* Paramètres › Utilisateurs (direction) : rôles et accès au chantier. */
import { store, CONFIG } from '../../store.js';
import { ic, toast, errorToast, initials, chip } from '../../ui.js';
import { esc } from '../../format.js';
import { ROLE_LABELS } from '../../model.js';

const ROLE_HELP = {
  chef_chantier: 'Saisit les rendements, les rapports journaliers et les pannes. Voit toutes les analyses.',
  conducteur: 'Fait tout ce que fait le chef de chantier, plus : planning, activités, engins, surcoûts, réglages du modèle.',
  direction: 'Fait tout, et gère les utilisateurs, les chantiers et leur suppression.',
};

export async function render(box) {
  const st = store.state, me = st.user.id, members = new Set(st.members);
  const profiles = st.profiles.slice().sort((a, b) => (a.full_name || a.email || '').localeCompare(b.full_name || b.email || '', 'fr'));
  box.innerHTML = `<div class="card"><div class="ch"><div><h3>Équipe du chantier « ${esc(st.project.name)} »</h3><div class="sub">Cochez « Accès » pour qu’une personne voie ce chantier. Le rôle vaut pour tous les chantiers.</div></div></div>
    <div class="tw"><table><thead><tr><th>Personne</th><th>Rôle</th><th>Accès à ce chantier</th></tr></thead><tbody>
    ${profiles.map((u) => `<tr><td><div class="hstack" style="flex-wrap:nowrap;gap:10px"><div class="av" style="width:34px;height:34px;font-size:12px">${esc(initials(u.full_name || u.email))}</div><div style="min-width:0"><b style="font-weight:600">${esc(u.full_name || '—')}${u.id === me ? ' <span class="tag">vous</span>' : ''}</b><div class="muted" style="font-size:12.5px">${esc(u.email || '')}</div></div></div></td>
      <td><select data-role="${u.id}" aria-label="Rôle de ${esc(u.full_name || u.email)}" ${u.id === me ? 'disabled title="Vous ne pouvez pas modifier votre propre rôle (pour ne pas perdre l’accès d’administration)."' : ''} style="border:1px solid var(--inputbd);border-radius:10px;padding:8px 10px;background:var(--field);min-height:38px">${Object.entries(ROLE_LABELS).map(([k, l]) => `<option value="${k}"${u.role === k ? ' selected' : ''}>${l}</option>`).join('')}</select></td>
      <td>${u.role === 'direction' && !members.has(u.id) ? chip('neutral', 'eye', 'Voit tous les chantiers') + ' ' : ''}<label class="check"><input type="checkbox" data-member="${u.id}" ${members.has(u.id) ? 'checked' : ''}> Accès</label></td></tr>`).join('')}</tbody></table></div></div>
    <div class="grid g12"><div class="c6"><div class="card"><div class="ch"><div><h3>Que peut faire chaque rôle ?</h3></div></div><div class="stack" style="gap:10px">${Object.entries(ROLE_LABELS).map(([k, l]) => `<div><b>${l}</b><div class="ink2" style="font-size:13.5px">${ROLE_HELP[k]}</div></div>`).join('')}</div></div></div>
      <div class="c6"><div class="card"><div class="ch"><div><h3>Ajouter quelqu’un</h3></div></div><div class="stack" style="gap:8px;font-size:13.5px">
        ${store.mode === 'demo' ? '<div>Dans l’exemplaire de démonstration, les quatre personnes sont fictives. Utilisez le sélecteur en haut de page pour voir l’application avec chaque rôle.</div>'
          : `<div>1. La personne crée son compte sur la page de connexion${CONFIG.ALLOW_SIGNUP === false ? ' (inscriptions fermées : créez le compte depuis le tableau de bord Supabase › Authentication › Users)' : ''}.</div><div>2. Elle apparaît ici avec le rôle « Chef de chantier » et <b>sans accès</b>.</div><div>3. Cochez « Accès » et ajustez son rôle.</div>`}
        <button class="btn sm" id="reload" type="button" style="align-self:flex-start">${ic('refresh', 15)}Actualiser la liste</button></div></div></div></div>`;
  box.querySelectorAll('[data-role]').forEach((s) => { s.onchange = async () => { try { await store.setRole(s.dataset.role, s.value); toast('Rôle mis à jour.', 'ok'); } catch (e) { errorToast(e); store.emit(); } }; });
  box.querySelectorAll('[data-member]').forEach((c) => { c.onchange = async () => { try { await store.setMember(c.dataset.member, c.checked); toast(c.checked ? 'Accès accordé.' : 'Accès retiré.', 'ok'); } catch (e) { errorToast(e); store.emit(); } }; });
  box.querySelector('#reload').onclick = () => store.loadProjects(true).then(() => store.emit()).catch(errorToast);
}
