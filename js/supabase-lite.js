/* Client Supabase minimal (sans dépendance) : authentification (GoTrue) + lecture/écriture (PostgREST).
 *
 * Il n'utilise que les API HTTP publiques et documentées de Supabase :
 *   POST /auth/v1/token?grant_type=password | refresh_token , /auth/v1/signup , /auth/v1/logout , /auth/v1/recover
 *   GET|POST|PATCH|DELETE /rest/v1/<table>?<filtres PostgREST>
 * La sécurité repose entièrement sur les règles RLS de supabase/schema.sql : la clé « anon »
 * placée dans config.js est publique par conception et ne donne accès à rien sans connexion.
 */

export class NetworkError extends Error {}
export class ApiError extends Error {
  constructor(message, status, code, raw) { super(message); this.status = status; this.code = code; this.raw = raw; }
}

const SESSION_KEY = 'Chantierpulse.session.v1';

const AUTH_MESSAGES = {
  invalid_credentials: 'E-mail ou mot de passe incorrect.',
  invalid_grant: 'E-mail ou mot de passe incorrect.',
  email_not_confirmed: 'Adresse e-mail non confirmée : ouvrez le lien reçu par e-mail, puis reconnectez-vous.',
  user_already_exists: 'Un compte existe déjà avec cette adresse e-mail.',
  weak_password: 'Mot de passe trop faible : utilisez au moins 8 caractères.',
  over_request_rate_limit: 'Trop de tentatives. Réessayez dans quelques minutes.',
  over_email_send_rate_limit: 'Trop d’e-mails envoyés. Réessayez dans quelques minutes.',
  signup_disabled: 'La création de compte est désactivée : demandez un accès à la direction.',
  validation_failed: 'Adresse e-mail ou mot de passe invalide.',
};

function frenchAuthError(status, body) {
  const code = body?.error_code || body?.code || body?.error;
  const raw = body?.msg || body?.message || body?.error_description || '';
  if (AUTH_MESSAGES[code]) return AUTH_MESSAGES[code];
  if (/invalid login credentials/i.test(raw)) return AUTH_MESSAGES.invalid_credentials;
  if (/already registered/i.test(raw)) return AUTH_MESSAGES.user_already_exists;
  if (/email not confirmed/i.test(raw)) return AUTH_MESSAGES.email_not_confirmed;
  if (/password should be at least/i.test(raw)) return AUTH_MESSAGES.weak_password;
  if (status === 429) return AUTH_MESSAGES.over_request_rate_limit;
  return raw ? `Erreur d’authentification : ${raw}` : `Erreur d’authentification (${status}).`;
}

function frenchDbError(status, body) {
  const code = body?.code;
  if (status === 401 || code === 'PGRST301' || /jwt/i.test(body?.message || '')) return 'Session expirée : reconnectez-vous.';
  if (code === '42501' || status === 403) return 'Action non autorisée pour votre rôle.';
  if (code === '23505') return 'Cette valeur existe déjà (doublon).';
  if (code === '23503') return 'Cet élément est référencé par d’autres données.';
  if (code === '23514') return body?.message?.includes('direction') ? body.message : 'Valeur refusée : vérifiez les champs saisis.';
  if (code === '23502') return 'Un champ obligatoire est manquant.';
  if (code === 'PGRST205' || code === '42P01') return 'La base n’est pas initialisée : exécutez supabase/schema.sql.';
  return body?.message ? `Erreur base de données : ${body.message}` : `Erreur base de données (${status}).`;
}

export function createClient({ url, anonKey, storage = globalThis.localStorage }) {
  const base = String(url || '').replace(/\/+$/, '');
  const listeners = new Set();
  let session = null;
  let refreshTimer = null;
  let refreshing = null;

  const readStore = () => { try { return JSON.parse(storage.getItem(SESSION_KEY) || 'null'); } catch { return null; } };
  const writeStore = (s) => { try { if (s) storage.setItem(SESSION_KEY, JSON.stringify(s)); else storage.removeItem(SESSION_KEY); } catch { /* stockage indisponible */ } };

  function emit(event) { for (const fn of listeners) { try { fn(event, session); } catch { /* écouteur défaillant */ } } }

  function setSession(s, event) {
    session = s ? { ...s, expires_at: s.expires_at || Math.floor(Date.now() / 1000) + (s.expires_in || 3600) } : null;
    writeStore(session);
    clearTimeout(refreshTimer);
    if (session) {
      const ms = Math.max(5000, (session.expires_at - 60) * 1000 - Date.now());
      refreshTimer = setTimeout(() => { client.auth.refresh().catch(() => {}); }, Math.min(ms, 2 ** 31 - 1));
    }
    emit(event);
  }

  async function http(path, { method = 'GET', body, headers = {}, token } = {}) {
    let res;
    try {
      res = await fetch(base + path, {
        method, body: body === undefined ? undefined : JSON.stringify(body),
        headers: { apikey: anonKey, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
      });
    } catch (e) {
      throw new NetworkError('Réseau indisponible.');
    }
    const text = await res.text();
    let data = null;
    if (text) { try { data = JSON.parse(text); } catch { data = { message: text }; } }
    return { status: res.status, ok: res.ok, data };
  }

  const client = {
    get session() { return session; },
    get userId() { return session?.user?.id ?? null; },
    auth: {
      /** Restaure la session mémorisée (et la renouvelle si elle a expiré). */
      async init() {
        const s = readStore();
        if (!s) return null;
        session = s;
        if (s.expires_at * 1000 - Date.now() < 30000) {
          try { await client.auth.refresh(); } catch (e) { if (!(e instanceof NetworkError)) { setSession(null, 'SIGNED_OUT'); return null; } }
        } else setSession(s, 'INITIAL_SESSION');
        return session;
      },
      async signIn(email, password) {
        const r = await http('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } });
        if (!r.ok) throw new ApiError(frenchAuthError(r.status, r.data), r.status, r.data?.error_code, r.data);
        setSession(r.data, 'SIGNED_IN');
        return session;
      },
      /** Crée un compte. Renvoie { session } si connecté tout de suite, sinon { needsConfirmation: true }. */
      async signUp(email, password, fullName) {
        const r = await http('/auth/v1/signup', { method: 'POST', body: { email, password, data: { full_name: fullName } } });
        if (!r.ok) throw new ApiError(frenchAuthError(r.status, r.data), r.status, r.data?.error_code, r.data);
        if (r.data?.access_token) { setSession(r.data, 'SIGNED_IN'); return { session }; }
        return { needsConfirmation: true };
      },
      async refresh() {
        if (refreshing) return refreshing;
        const rt = session?.refresh_token;
        if (!rt) throw new ApiError('Session expirée : reconnectez-vous.', 401);
        refreshing = (async () => {
          try {
            const r = await http('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: rt } });
            if (!r.ok) { setSession(null, 'SIGNED_OUT'); throw new ApiError('Session expirée : reconnectez-vous.', r.status); }
            setSession(r.data, 'TOKEN_REFRESHED');
            return session;
          } finally { refreshing = null; }
        })();
        return refreshing;
      },
      async signOut() {
        const token = session?.access_token;
        setSession(null, 'SIGNED_OUT');
        if (token) { try { await http('/auth/v1/logout', { method: 'POST', token }); } catch { /* déjà déconnecté localement */ } }
      },
      async resetPassword(email) {
        const r = await http('/auth/v1/recover', { method: 'POST', body: { email } });
        if (!r.ok) throw new ApiError(frenchAuthError(r.status, r.data), r.status, r.data?.error_code, r.data);
      },
      /** Ouvre une session à partir des jetons d'un lien reçu par e-mail (confirmation, réinitialisation). */
      async setFromTokens({ access_token, refresh_token, expires_in }) {
        const r = await http('/auth/v1/user', { token: access_token });
        if (!r.ok) throw new ApiError('Lien invalide ou expiré : demandez-en un nouveau.', r.status);
        setSession({ access_token, refresh_token, expires_in: Number(expires_in) || 3600, token_type: 'bearer', user: r.data }, 'SIGNED_IN');
        return session;
      },
      async updatePassword(password) {
        const r = await http('/auth/v1/user', { method: 'PUT', body: { password }, token: session?.access_token });
        if (!r.ok) throw new ApiError(frenchAuthError(r.status, r.data), r.status, r.data?.error_code, r.data);
      },
      onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    },

    /** Appel PostgREST avec jeton, renouvelé et rejoué une fois en cas de 401. */
    async rest(method, table, { query = '', body, prefer, single = false } = {}) {
      const call = () => http(`/rest/v1/${table}${query ? '?' + query : ''}`, {
        method, body, token: session?.access_token,
        headers: { ...(prefer ? { Prefer: prefer } : {}), ...(single ? { Accept: 'application/vnd.pgrst.object+json' } : {}) },
      });
      let r = await call();
      if (r.status === 401 && session?.refresh_token) { await client.auth.refresh(); r = await call(); }
      if (!r.ok) throw new ApiError(frenchDbError(r.status, r.data), r.status, r.data?.code, r.data);
      return r.data;
    },
    select: (table, query = 'select=*') => client.rest('GET', table, { query }),
    insert: (table, rows, query = '') => client.rest('POST', table, { query, body: rows, prefer: 'return=representation' }),
    upsert: (table, rows, onConflict) => client.rest('POST', table, { query: `on_conflict=${onConflict}`, body: rows, prefer: 'resolution=merge-duplicates,return=representation' }),
    update: (table, id, patch) => client.rest('PATCH', table, { query: `id=eq.${encodeURIComponent(id)}`, body: patch, prefer: 'return=representation' }),
    remove: (table, query) => client.rest('DELETE', table, { query, prefer: 'return=minimal' }),
  };
  return client;
}
