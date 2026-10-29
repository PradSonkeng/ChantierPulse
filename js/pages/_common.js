/* Aides communes aux pages. */
import { esc } from '../format.js';
import { ic } from '../ui.js';

export function pageHead(title, subtitle = '', actions = '') {
  return `<div class="head"><div><h1>${esc(title)}</h1>${subtitle ? `<p>${subtitle}</p>` : ''}</div>${actions ? `<div class="act">${actions}</div>` : ''}</div>`;
}
/** Réaffiche la page (avec un léger délai) quand les données changent. */
export function live(ctx, paint, delay = 120) {
  let t = null;
  ctx.subscribe(() => { clearTimeout(t); t = setTimeout(paint, delay); });
}
export function kpi({ label, icon, value, unit = '', right = '', delta = '', foot = '' }) {
  return `<div class="card kpi"><div class="kl">${ic(icon, 18)}${label}</div>
    <div class="kv"><b>${value}${unit ? `<small>${unit}</small>` : ''}</b>${right}</div>${delta}<div class="kf">${foot}</div></div>`;
}
export const delta = (kind, icon, text) => `<div class="delta ${kind}">${ic(icon, 14)}${text}</div>`;
export function selectBox(id, icon, items, selected) {
  return `<label class="select" for="${id}">${icon ? ic(icon, 16) : ''}<select id="${id}">${items.map(([v, l]) => `<option value="${esc(v)}"${String(v) === String(selected) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>${ic('chevdown', 14)}</label>`;
}
export const verdictChip = (v) => v === 'significant_below' ? `<span class="chip crit">${ic('alert', 14)}Sous la prévision</span>`
  : v === 'significant_above' ? `<span class="chip good">${ic('up', 14)}Au-dessus de la prévision</span>`
    : `<span class="chip neutral">${ic('info', 14)}Fluctuation normale</span>`;
export const sourceTag = (source) => source ? `<span class="tag" title="${source === 'serveur' ? 'Calculé par le serveur Python' : 'Calculé dans votre navigateur'}">${source === 'serveur' ? 'serveur Python' : 'calcul local'}</span>` : '';
