/* État de l'application, accès aux données et droits.
 *
 * Deux « adaptateurs » exposent la même interface :
 *   - LocalAdapter    (exemplaire démo)  : données dans le navigateur (localStorage), jeu de données d'exemple ;
 *   - SupabaseAdapter (exemplaire avec connexion) : base Supabase, droits imposés par les règles RLS.
 * Les pages ne connaissent que `store`.
 */
import { createClient, NetworkError, ApiError } from './supabase-lite.js';
import { localTodayIso } from './format.js';
import { settingsOf, uuid } from './model.js';

export const CONFIG = Object.assign({
  MODE: 'demo', SUPABASE_URL: '', SUPABASE_ANON_KEY: '', API_URL: '', ENGINE: 'local', ALLOW_SIGNUP: true, DEMO_TODAY: null,
}, globalThis.CHANTIERPULSE || {});

export const PROJECT_TABLES = ['tasks', 'activities', 'productivity_entries', 'daily_reports', 'equipment', 'failures', 'cost_events', 'queue_scenarios'];
const ORDER = {
  tasks: 'sort_order.asc', activities: 'sort_order.asc', productivity_entries: 'entry_date.asc', daily_reports: 'report_date.asc',
  equipment: 'created_at.asc', failures: 'occurred_at.asc', cost_events: 'event_date.asc', queue_scenarios: 'created_at.asc',
};
const UNIQUE = { productivity_entries: ['activity_id', 'entry_date'], daily_reports: ['project_id', 'report_date'], tasks: ['project_id', 'code'] };
const QUEUEABLE = new Set(['productivity_entries', 'daily_reports', 'failures']);
const PERMS = { enter: ['chef_chantier', 'conducteur', 'direction'], plan: ['conducteur', 'direction'], admin: ['direction'] };

export const can = (role, action) => (PERMS[action] || []).includes(role);

/* ═════════════════════════ adaptateur local (démo) ═════════════════════════ */
const DEMO_KEY = 'Chantierpulse.demo.v1';

class LocalAdapter {
  constructor() { this.db = null; }
  async init() {
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(DEMO_KEY) || 'null'); } catch { /* ignoré */ }
    if (raw && raw.version === 1) { this.db = raw; return; }
    await this.reset();
  }
  async reset() {
    const { DEMO } = await import('./demo-data.js');
    this.db = {
      version: 1, today: DEMO.today, currentUserId: DEMO.users[0].id,
      users: JSON.parse(JSON.stringify(DEMO.users)), projects: [JSON.parse(JSON.stringify(DEMO.project))],
      members: JSON.parse(JSON.stringify(DEMO.members)), tables: JSON.parse(JSON.stringify(DEMO.tables)),
    };
    this.save();
  }
  save() { try { localStorage.setItem(DEMO_KEY, JSON.stringify(this.db)); } catch { /* quota / navigation privée : les données restent en mémoire */ } }
  get users() { return this.db.users; }
  get currentUserId() { return this.db.currentUserId; }
  set currentUserId(id) { this.db.currentUserId = id; this.save(); }
  async listProjects() { return this.db.projects; }
  async loadProject(pid) {
    const tables = {};
    for (const t of PROJECT_TABLES) tables[t] = this.db.tables[t].filter((r) => r.project_id === pid);
    return { tables, members: this.db.members.filter((m) => m.project_id === pid).map((m) => m.user_id) };
  }
  async listProfiles() { return this.db.users; }
  async upsert(table, row) {
    const list = this.db.tables[table]; const i = list.findIndex((r) => r.id === row.id);
    const saved = { ...(i >= 0 ? list[i] : {}), ...row };
    if (i >= 0) list[i] = saved; else list.push(saved);
    this.save(); return saved;
  }
  async remove(table, id) { this.db.tables[table] = this.db.tables[table].filter((r) => r.id !== id); this.save(); }
  async saveProject(row) {
    const i = this.db.projects.findIndex((p) => p.id === row.id);
    const saved = { ...(i >= 0 ? this.db.projects[i] : {}), ...row };
    if (i >= 0) this.db.projects[i] = saved; else this.db.projects.push(saved);
    this.save(); return saved;
  }
  async deleteProject(id) {
    this.db.projects = this.db.projects.filter((p) => p.id !== id);
    this.db.members = this.db.members.filter((m) => m.project_id !== id);
    for (const t of PROJECT_TABLES) this.db.tables[t] = this.db.tables[t].filter((r) => r.project_id !== id);
    this.save();
  }
  async updateProfile(id, patch) { const u = this.db.users.find((x) => x.id === id); Object.assign(u, patch); this.save(); return u; }
  async addMember(pid, uid) { if (!this.db.members.some((m) => m.project_id === pid && m.user_id === uid)) this.db.members.push({ project_id: pid, user_id: uid }); this.save(); }
  async removeMember(pid, uid) { this.db.members = this.db.members.filter((m) => !(m.project_id === pid && m.user_id === uid)); this.save(); }
}

/* ═════════════════════════ adaptateur Supabase ═════════════════════════ */
class SupabaseAdapter {
  constructor(client) { this.c = client; }
  async selectAll(table, query) {            // pagination : PostgREST plafonne à 1000 lignes par requête
    const out = []; const page = 1000;
    for (let off = 0; ; off += page) {
      const rows = await this.c.select(table, `${query}&limit=${page}&offset=${off}`);
      out.push(...rows); if (rows.length < page) break;
    }
    return out;
  }
  async profile(uid) { const r = await this.c.select('profiles', `select=*&id=eq.${uid}`); return r[0] || null; }
  async listProjects() { return this.selectAll('projects', 'select=*&order=created_at.asc'); }
  async loadProject(pid) {
    const entries = await Promise.all(PROJECT_TABLES.map((t) => this.selectAll(t, `select=*&project_id=eq.${pid}&order=${ORDER[t]}`)));
    const members = await this.c.select('project_members', `select=user_id&project_id=eq.${pid}`);
    return { tables: Object.fromEntries(PROJECT_TABLES.map((t, i) => [t, entries[i]])), members: members.map((m) => m.user_id) };
  }
  async listProfiles() { return this.selectAll('profiles', 'select=*&order=created_at.asc'); }
  async upsert(table, row, isNew) {
    let out;
    if (isNew) out = UNIQUE[table] ? await this.c.upsert(table, [row], UNIQUE[table].join(',')) : await this.c.insert(table, [row]);
    else { const { id, project_id, created_by, created_at, ...patch } = row; out = await this.c.update(table, id, patch); }
    return out[0] ?? row;
  }
  async remove(table, id) { await this.c.remove(table, `id=eq.${encodeURIComponent(id)}`); }
  async saveProject(row) {
    if (!row.created_at) return (await this.c.insert('projects', [row]))[0];          // nouveau chantier
    const { id, created_at, created_by, ...patch } = row; return (await this.c.update('projects', id, patch))[0];
  }
  async deleteProject(id) { await this.c.remove('projects', `id=eq.${encodeURIComponent(id)}`); }
  async updateProfile(id, patch) { return (await this.c.update('profiles', id, patch))[0]; }
  async addMember(pid, uid) { await this.c.insert('project_members', [{ project_id: pid, user_id: uid }]); }
  async removeMember(pid, uid) { await this.c.remove('project_members', `project_id=eq.${pid}&user_id=eq.${uid}`); }
}

/* ═════════════════════════ store ═════════════════════════ */
const QUEUE_KEY = 'Chantierpulse.queue.v1';

class Store {
  constructor() {
    this.mode = CONFIG.MODE === 'supabase' ? 'supabase' : 'demo';
    this.listeners = new Set();
    this.state = {
      ready: false, user: null, profile: null, profiles: [], projects: [], projectId: null, project: null, members: [],
      data: Object.fromEntries(PROJECT_TABLES.map((t) => [t, []])), pending: 0, online: true, loading: false, syncErrors: [],
    };
    Object.defineProperty(this.state, 'today', { get: () => this.today, enumerable: false });   // st.today pour les analyses
    this.adapter = null; this.client = null; this.queue = [];
  }
  get s() { return this.state; }
  get today() { return this.mode === 'demo' ? (this.adapter?.db?.today || CONFIG.DEMO_TODAY || localTodayIso()) : localTodayIso(); }
  get role() { return this.state.profile?.role || null; }
  can(action) { return can(this.role, action); }
  /** Modifier ou supprimer une ligne : conducteur/direction, ou son auteur. */
  canEditRow(row) { return this.can('plan') || (this.can('enter') && row && row.created_by === this.state.user?.id); }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  emit() { for (const fn of this.listeners) { try { fn(this.state); } catch (e) { console.error(e); } } }

  /* ── démarrage ── */
  async init() {
    this.loadQueue();
    window.addEventListener('online', () => { this.state.online = true; this.flush(); this.emit(); });
    window.addEventListener('offline', () => { this.state.online = false; this.emit(); });
    this.state.online = navigator.onLine !== false;
    if (this.mode === 'demo') {
      this.adapter = new LocalAdapter(); await this.adapter.init();
      this.applyDemoUser(this.adapter.currentUserId);
      await this.afterLogin();
    } else {
      if (!CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_ANON_KEY) throw new Error('config');
      this.client = createClient({ url: CONFIG.SUPABASE_URL, anonKey: CONFIG.SUPABASE_ANON_KEY });
      this.adapter = new SupabaseAdapter(this.client);
      this.client.auth.onChange((ev) => { if (ev === 'SIGNED_OUT') { this.resetState(); this.emit(); } });
      try {
        const s = await this.client.auth.init();
        if (s) await this.afterLogin();
      } catch (e) { if (!(e instanceof NetworkError)) throw e; this.state.offlineBoot = true; }
    }
    this.state.ready = true; this.emit();
    if (this.queue.length) this.flush();
  }
  resetState() {
    Object.assign(this.state, { user: null, profile: null, profiles: [], projects: [], projectId: null, project: null, members: [] });
    for (const t of PROJECT_TABLES) this.state.data[t] = [];
  }
  applyDemoUser(id) {
    const u = this.adapter.users.find((x) => x.id === id) || this.adapter.users[0];
    this.adapter.currentUserId = u.id;
    this.state.user = { id: u.id, email: u.email }; this.state.profile = u;
  }
  async switchDemoUser(id) { this.applyDemoUser(id); await this.afterLogin(true); this.emit(); }
  async resetDemo() { await this.adapter.reset(); this.applyDemoUser(this.adapter.users[0].id); this.state.projectId = null; await this.afterLogin(); this.emit(); }

  async afterLogin(keepProject = false) {
    if (this.mode === 'supabase') {
      const uid = this.client.userId;
      const profile = await this.adapter.profile(uid);
      if (!profile) throw new ApiError('Profil introuvable : la base n’est pas initialisée (supabase/schema.sql).', 404);
      this.state.user = { id: uid, email: this.client.session.user?.email || profile.email }; this.state.profile = profile;
    }
    await this.loadProjects(keepProject);
  }
  async loadProjects(keepProject = false) {
    let projects = await this.adapter.listProjects();
    if (this.mode === 'demo' && !this.can('admin')) {
      const mine = new Set(this.adapter.db.members.filter((m) => m.user_id === this.state.user.id).map((m) => m.project_id));
      projects = projects.filter((p) => mine.has(p.id));
    }
    this.state.projects = projects;
    this.state.profiles = await this.adapter.listProfiles().catch(() => []);
    let pid = keepProject && projects.some((p) => p.id === this.state.projectId) ? this.state.projectId : null;
    if (!pid) { const saved = localStorage.getItem('Chantierpulse.project'); pid = projects.find((p) => p.id === saved)?.id || projects[0]?.id || null; }
    await this.selectProject(pid, false);
  }
  async selectProject(pid, emit = true) {
    this.state.projectId = pid;
    if (!pid) { this.state.project = null; for (const t of PROJECT_TABLES) this.state.data[t] = []; this.state.members = []; if (emit) this.emit(); return; }
    try { localStorage.setItem('Chantierpulse.project', pid); } catch { /* ignoré */ }
    this.state.loading = true; if (emit) this.emit();
    try {
      const { tables, members } = await this.adapter.loadProject(pid);
      this.state.project = this.state.projects.find((p) => p.id === pid);
      Object.assign(this.state.data, tables); this.state.members = members;
      this.applyQueueToState();
    } finally { this.state.loading = false; if (emit) this.emit(); }
  }
  async refresh() { await this.selectProject(this.state.projectId); }

  /* ── authentification (exemplaire avec connexion) ── */
  async signIn(email, password) { await this.client.auth.signIn(email, password); await this.afterLogin(); this.emit(); }
  async signUp(email, password, fullName) {
    const r = await this.client.auth.signUp(email, password, fullName);
    if (r.session) { await this.afterLogin(); this.emit(); }
    return r;
  }
  async signOut() { await this.client.auth.signOut(); }
  get accessToken() { return this.client?.session?.access_token || null; }

  /* ── écriture des données du chantier ── */
  async save(table, row) {
    const st = this.state, list = st.data[table];
    let isNew = !row.id || !list.some((r) => r.id === row.id);
    let full = { ...row };
    const uk = UNIQUE[table];
    if (isNew && uk) {                                         // « une valeur par jour » : on met à jour l'existante
      const same = list.find((r) => uk.every((k) => r[k] === (k === 'project_id' ? st.projectId : full[k])));
      if (same) { full.id = same.id; isNew = false; }
    }
    if (!full.id) full.id = uuid();
    full.project_id = st.projectId;
    if (isNew && this.mode === 'demo') full.created_by = st.user.id;
    const before = list.find((r) => r.id === full.id);
    const optimistic = { ...(before || {}), ...full };
    this.putLocal(table, optimistic);
    try {
      if (this.mode === 'supabase' && (!st.online || this.queue.length && QUEUEABLE.has(table))) throw new NetworkError('Réseau indisponible.');
      const saved = await this.adapter.upsert(table, full, isNew);
      this.putLocal(table, { ...optimistic, ...saved });
      this.emit(); return { ...optimistic, ...saved };
    } catch (e) {
      if (e instanceof NetworkError && QUEUEABLE.has(table)) {
        this.enqueue({ op: 'upsert', table, row: full, isNew }); this.emit(); return { ...optimistic, _queued: true };
      }
      if (before) this.putLocal(table, before); else this.dropLocal(table, full.id);
      this.emit(); throw e;
    }
  }
  async remove(table, id) {
    const before = this.state.data[table].find((r) => r.id === id);
    this.dropLocal(table, id);
    try {
      if (this.mode === 'supabase' && !this.state.online) throw new NetworkError('Réseau indisponible.');
      await this.adapter.remove(table, id); this.emit();
    } catch (e) {
      if (e instanceof NetworkError && QUEUEABLE.has(table)) { this.enqueue({ op: 'delete', table, id }); this.emit(); return; }
      if (before) this.putLocal(table, before); this.emit(); throw e;
    }
  }
  putLocal(table, row) {
    const list = this.state.data[table]; const i = list.findIndex((r) => r.id === row.id);
    if (i >= 0) list[i] = row; else list.push(row);
  }
  dropLocal(table, id) { this.state.data[table] = this.state.data[table].filter((r) => r.id !== id); }

  /* ── paramètres du chantier ── */
  async saveProject(patch) {
    const merged = { ...this.state.project, ...patch };
    const saved = await this.adapter.saveProject(merged);
    const i = this.state.projects.findIndex((p) => p.id === saved.id);
    if (i >= 0) this.state.projects[i] = saved; else this.state.projects.push(saved);
    if (saved.id === this.state.projectId) this.state.project = saved;
    this.emit(); return saved;
  }
  async setSettings(partial) {
    const cur = settingsOf(this.state.project);
    const next = { ...cur, ...partial };
    for (const k of ['breakdowns', 'rain', 'queue']) if (partial[k]) next[k] = { ...cur[k], ...partial[k] };
    return this.saveProject({ settings: next });
  }
  async createProject(fields) {
    const row = { id: uuid(), currency: 'FCFA', settings: {}, ...fields };
    const saved = await this.adapter.saveProject(row);
    this.state.projects.push(saved); await this.selectProject(saved.id); return saved;
  }
  async deleteProject(id) {
    await this.adapter.deleteProject(id);
    this.state.projects = this.state.projects.filter((p) => p.id !== id);
    await this.selectProject(this.state.projects[0]?.id || null);
  }

  /* ── utilisateurs ── */
  async setRole(userId, role) {
    const u = await this.adapter.updateProfile(userId, { role });
    this.state.profiles = this.state.profiles.map((p) => (p.id === userId ? { ...p, ...u } : p));
    if (userId === this.state.user.id) this.state.profile = { ...this.state.profile, ...u };
    this.emit();
  }
  async setMember(userId, on) {
    if (on) await this.adapter.addMember(this.state.projectId, userId); else await this.adapter.removeMember(this.state.projectId, userId);
    this.state.members = on ? [...new Set([...this.state.members, userId])] : this.state.members.filter((u) => u !== userId);
    this.emit();
  }
  async updateMyName(name) {
    const u = await this.adapter.updateProfile(this.state.user.id, { full_name: name });
    this.state.profile = { ...this.state.profile, ...u };
    this.state.profiles = this.state.profiles.map((p) => (p.id === u.id ? { ...p, ...u } : p)); this.emit();
  }

  /* ── file d'attente hors ligne (saisies de terrain) ── */
  loadQueue() { try { this.queue = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]'); } catch { this.queue = []; } this.state.pending = this.queue.length; }
  saveQueue() { try { localStorage.setItem(QUEUE_KEY, JSON.stringify(this.queue)); } catch { /* ignoré */ } this.state.pending = this.queue.length; }
  enqueue(item) { this.queue.push({ ...item, project_id: this.state.projectId, ts: Date.now() }); this.saveQueue(); this.state.online = false; }
  /** Réapplique les saisies en attente par-dessus les données rechargées. */
  applyQueueToState() {
    for (const q of this.queue) {
      if (q.project_id !== this.state.projectId) continue;
      if (q.op === 'upsert') this.putLocal(q.table, { ...(this.state.data[q.table].find((r) => r.id === q.row.id) || {}), ...q.row });
      else this.dropLocal(q.table, q.id);
    }
  }
  async flush() {
    if (this.flushing || !this.queue.length || this.mode !== 'supabase' || !this.client?.session) return;
    this.flushing = true;
    try {
      while (this.queue.length) {
        const q = this.queue[0];
        try {
          if (q.op === 'upsert') {
            const exists = await this.client.select(q.table, `select=id&id=eq.${q.row.id}`);
            await this.adapter.upsert(q.table, q.row, q.isNew && !exists.length);
          } else await this.adapter.remove(q.table, q.id);
        } catch (e) {
          if (e instanceof NetworkError) { this.state.online = false; break; }
          this.state.syncErrors.push(`Une saisie en attente n’a pas pu être envoyée : ${e.message}`);
        }
        this.queue.shift(); this.saveQueue();
        if (!this.queue.length) this.state.online = navigator.onLine !== false;
      }
    } finally { this.flushing = false; this.emit(); }
    if (!this.queue.length && this.state.projectId) { try { await this.selectProject(this.state.projectId); } catch { /* ignoré */ } }
  }
}

export const store = new Store();
export { NetworkError, ApiError };
