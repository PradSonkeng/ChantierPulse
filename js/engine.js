/* Passerelle vers les moteurs de calcul.
 *
 *   « local »  : tout est calculé dans le navigateur (exemplaire démo, hors-ligne) ;
 *   « remote » : tout passe par le serveur Python (Hugging Face Space) ;
 *   « auto »   : serveur Python en priorité, calcul local si le serveur ne répond pas.
 * Les deux moteurs renvoient exactement les mêmes champs (voir backend/engine et js/engine-local.js).
 */
import { localEngine, ModelError } from './engine-local.js';
import { CONFIG, store } from './store.js';

export { ModelError };
const KEY = 'Chantierpulse.engine.v1';
const COLD_START_MS = 60000;      // un Space en veille met jusqu'à ~1 min à se réveiller
const AUTO_TIMEOUT_MS = 9000;

export function engineSettings() {
  let o = {}; try { o = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { /* ignoré */ }
  return { mode: o.mode || CONFIG.ENGINE || 'local', api_url: (o.api_url ?? CONFIG.API_URL ?? '').replace(/\/+$/, '') };
}
export function saveEngineSettings(s) {
  try { localStorage.setItem(KEY, JSON.stringify({ mode: s.mode, api_url: (s.api_url || '').trim().replace(/\/+$/, '') })); } catch { /* ignoré */ }
}

export const engineStatus = { lastSource: null, lastError: null };

async function remote(name, payload, timeout) {
  const { api_url } = engineSettings();
  if (!api_url) throw new Error('Adresse du serveur de calcul non renseignée.');
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeout);
  const headers = { 'Content-Type': 'application/json' };
  if (store.accessToken) headers.Authorization = `Bearer ${store.accessToken}`;
  let res;
  try { res = await fetch(`${api_url}/api/${name}`, { method: 'POST', headers, body: JSON.stringify(payload), signal: ctl.signal }); }
  catch (e) { throw Object.assign(new Error(e.name === 'AbortError' ? 'Le serveur de calcul ne répond pas (il est peut-être en veille).' : 'Serveur de calcul injoignable.'), { transport: true }); }
  finally { clearTimeout(timer); }
  let body = null; try { body = await res.json(); } catch { /* corps vide */ }
  if (res.status === 422 || res.status === 400) throw new ModelError(body?.error || 'Requête refusée par le serveur de calcul.');
  if (res.status === 401) throw Object.assign(new Error('Session expirée : reconnectez-vous.'), { auth: true });
  if (!res.ok) throw Object.assign(new Error(`Erreur du serveur de calcul (${res.status}).`), { transport: true });
  return body;
}

/** Exécute un calcul. Renvoie { result, source } avec source = « serveur » ou « navigateur ». */
export async function compute(name, payload) {
  const { mode } = engineSettings();
  if (mode !== 'local') {
    try {
      const result = await remote(name, payload, mode === 'remote' ? COLD_START_MS : AUTO_TIMEOUT_MS);
      engineStatus.lastSource = 'serveur'; engineStatus.lastError = null;
      return { result, source: 'serveur' };
    } catch (e) {
      if (!(e.transport && mode === 'auto')) throw e;          // erreur métier / droits : on ne masque pas
      engineStatus.lastError = e.message;
    }
  }
  const result = localEngine[name](payload);
  engineStatus.lastSource = 'navigateur';
  return { result, source: 'navigateur' };
}

export async function health() {
  const { api_url } = engineSettings();
  if (!api_url) throw new Error('Adresse du serveur de calcul non renseignée.');
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), COLD_START_MS);
  try {
    const t0 = performance.now();
    const res = await fetch(`${api_url}/health`, { signal: ctl.signal });
    if (!res.ok) throw new Error(`Réponse ${res.status}`);
    const body = await res.json();
    return { ...body, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    throw new Error(e.name === 'AbortError' ? 'Aucune réponse en 60 s.' : (e.message || 'Serveur injoignable.'));
  } finally { clearTimeout(timer); }
}

/** Réveille le Space en tâche de fond (sans bloquer l'interface). */
export function wakeServer() {
  const { mode, api_url } = engineSettings();
  if (mode !== 'local' && api_url) fetch(`${api_url}/health`).catch(() => {});
}
