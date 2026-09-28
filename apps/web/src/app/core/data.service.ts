import { Injectable, signal, computed, inject } from '@angular/core';
import { CastService } from './cast.service';
import { SessionService } from './session.service';
import { Enquiry, Deal, Customer, Task, Activity, Table, Stage } from './models';
import { DraftService } from './draft.service';
import { copyGet, copyPut, copyClear } from './device-copy';

/* The data layer. One interface, two adapters, chosen by the cast:
     local  keeps everything in this browser (demo and the free tier)
     api    talks to the Node backend in apps/api, which owns the database
   Every method returns a promise so the pages never know which one they got. */
interface Adapter {
  list<T>(t: Table): Promise<T[]>;
  create<T>(t: Table, row: Partial<T>): Promise<T>;
  update<T>(t: Table, id: string, patch: Partial<T>): Promise<T | null>;
  remove(t: Table, id: string): Promise<void>;
}
export const PAGE = 500;
const KINDS: Table[] = ['enquiries', 'deals', 'customers', 'tasks', 'activities'];
const now = () => new Date().toISOString();
const uid = () => 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

class LocalAdapter implements Adapter {
  constructor(private key: string) {}
  private read(): Record<string, any[]> { try { return JSON.parse(localStorage.getItem(this.key) || '{}'); } catch { return {}; } }
  private write(d: Record<string, any[]>) { try { localStorage.setItem(this.key, JSON.stringify(d)); } catch {} }
  async list<T>(t: Table) { return (this.read()[t] || []) as T[]; }
  async create<T>(t: Table, row: Partial<T>) { const d = this.read(); const r = { ...row, id: uid(), createdAt: now(), updatedAt: now() } as T; d[t] = [r, ...(d[t] || [])]; this.write(d); return r; }
  async update<T>(t: Table, id: string, patch: Partial<T>) { const d = this.read(); const rows = d[t] || []; const i = rows.findIndex(r => r.id === id); if (i < 0) return null; rows[i] = { ...rows[i], ...patch, id, updatedAt: now() }; d[t] = rows; this.write(d); return rows[i] as T; }
  async remove(t: Table, id: string) { const d = this.read(); d[t] = (d[t] || []).filter(r => r.id !== id); this.write(d); }
}
/* The Hub adapter: every call carries the seat's token. A write that cannot reach the
   server is kept in an outbox in this browser and replayed the next time one succeeds,
   so a dropped signal loses nothing. A 401 means the seat is gone: back to the door. */
class ApiAdapter implements Adapter {
  onAuthLost?: () => void; onOffline?: (n: number) => void;
  constructor(private base: string, private slug: string, private token: () => string) {}
  private outKey(){ return 'hub_outbox_' + this.slug; }
  private outbox(): any[] { try { return JSON.parse(localStorage.getItem(this.outKey()) || '[]'); } catch { return []; } }
  private setOutbox(q: any[]){ try { localStorage.setItem(this.outKey(), JSON.stringify(q)); } catch {} this.onOffline?.(q.length); }
  private async go<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.base}/api/${this.slug}/${path}`, { ...init, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.token(), ...(init?.headers || {}) } });
    if (res.status === 401) { this.onAuthLost?.(); throw new Error('401'); }
    if (res.status === 204) return null as T;
    if (!res.ok) throw new Error(`${res.status} on ${path}`);
    return res.json();
  }
  /* ONE FLUSH AT A TIME. Five lists are read at once when the connection returns and each one used
     to replay the outbox for itself, so one customer written offline reached the server five times
     (the data run, 28 Sep 2026). Everyone who asks while a flush is running waits on that one. */
  private flushing: Promise<void> | null = null;
  flush(): Promise<void> {
    if (!this.flushing) this.flushing = this.replay().finally(() => { this.flushing = null; });
    return this.flushing;
  }
  private async replay(){
    const q = this.outbox(); if (!q.length) return;
    const left: any[] = [];
    for (let i = 0; i < q.length; i++) {
      const w = q[i];
      try { await this.go(w.path, { method: w.method, body: w.body }); }
      catch (e: any) { if (e.message === '401') { this.setOutbox([...left, ...q.slice(i)]); return; } left.push(w); }
    }
    /* keep whatever was written to the outbox while this replay was running */
    const added = this.outbox().slice(q.length);
    this.setOutbox([...left, ...added]);
  }
  private async write<T>(path: string, method: string, body?: any, fallback?: T): Promise<T> {
    try { const r = await this.go<T>(path, { method, body: body ? JSON.stringify(body) : undefined }); this.flush(); return r; }
    catch (e: any) {
      if (e.message === '401') throw e;
      this.setOutbox([...this.outbox(), { path, method, body: body ? JSON.stringify(body) : undefined }]);
      return fallback as T;
    }
  }
  /* THE DATABASE HANDS OVER 1,000 ROWS AT MOST AND SAYS NOTHING. Every list read names a limit and
     pages with an offset until a short page comes back, so row 1,001 is never silently lost. */
  async list<T>(t: Table) {
    await this.flush();
    const out: T[] = [];
    for (let off = 0; off < 500000; off += PAGE) {
      const page = await this.go<T[]>(`${t}?limit=${PAGE}&offset=${off}`);
      if (!Array.isArray(page)) break;
      out.push(...page);
      if (page.length < PAGE) break;
    }
    return out;
  }
  create<T>(t: Table, row: Partial<T>) { const local = { ...row, id: uid(), createdAt: now(), updatedAt: now() } as T; return this.write<T>(t, 'POST', local, local); }
  update<T>(t: Table, id: string, patch: Partial<T>) { return this.write<T | null>(`${t}/${id}`, 'PATCH', patch, null); }
  async remove(t: Table, id: string) { await this.write(`${t}/${id}`, 'DELETE'); }
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private castSvc = inject(CastService); private session = inject(SessionService); private drafts = inject(DraftService);
  private adapter!: Adapter;
  readonly pending = signal(0);
  readonly authLost = signal(false);
  readonly ready = signal(false);
  /* loading: nothing to show yet and the server has not answered, so screens draw the SHAPE of
     their content. offline: the last read could not reach the server, said in one plain line. */
  readonly loading = signal(false);
  readonly offline = signal(false);
  readonly paintedFrom = signal<'device' | 'server' | 'local' | ''>('');
  readonly mode = signal<'local' | 'api'>('local');
  readonly enquiries = signal<Enquiry[]>([]);
  readonly deals = signal<Deal[]>([]);
  readonly customers = signal<Customer[]>([]);
  readonly tasks = signal<Task[]>([]);
  readonly activities = signal<Activity[]>([]);
  readonly toastMsg = signal<{ text: string; href?: string; label?: string } | null>(null);
  private toastT: any;

  /* derived, so every screen agrees with every other */
  readonly waiting = computed(() => this.enquiries().filter(e => e.status === 'new'));
  readonly openDeals = computed(() => this.deals().filter(d => d.stage !== 'won' && d.stage !== 'lost'));
  readonly pipeValue = computed(() => this.openDeals().reduce((a, d) => a + (Number(d.value) || 0), 0));
  readonly weighted = computed(() => {
    const probs = Object.fromEntries((this.castSvc.cast()?.stages || []).map(s => [s.key, s.prob]));
    return this.openDeals().reduce((a, d) => a + (Number(d.value) || 0) * ((probs[d.stage] ?? 0) / 100), 0);
  });
  readonly wonThisMonth = computed(() => {
    const m = new Date().toISOString().slice(0, 7);
    return this.deals().filter(d => d.stage === 'won' && (d.updatedAt || '').slice(0, 7) === m);
  });
  readonly wonValueThisMonth = computed(() => this.wonThisMonth().reduce((a, d) => a + (Number(d.value) || 0), 0));
  readonly dueTasks = computed(() => { const t = today(); return this.tasks().filter(x => !x.done && x.due && x.due <= t); });
  readonly openTasks = computed(() => this.tasks().filter(x => !x.done));
  /* a deal is going cold after five quiet days, red after ten, like BB Leads */
  readonly stale = computed(() => this.openDeals().filter(d => daysSince(d.lastContactAt || d.stageAt || d.createdAt) >= 5));
  readonly atRisk = computed(() => this.stale().filter(d => (Number(d.value) || 0) > 0).sort((a, b) => b.value - a.value).slice(0, 5));

  /* THE SCREEN OPENS FROM THE LAST SAFE COPY on the device, then checks for news behind it. Nothing
     here waits on the network before the first paint. */
  async init() {
    const c = this.castSvc.cast(); if (!c) return;
    const api = this.castSvc.config().api;
    this.mode.set(api ? 'api' : 'local');
    this.offline.set(false);
    if (!api) {
      this.adapter = new LocalAdapter('bbos_' + c.slug);
      try { await this.reload(); } catch {}
      this.paintedFrom.set('local'); this.ready.set(true); return;
    }
    const a = new ApiAdapter(api, c.slug, () => this.session.token());
    a.onAuthLost = () => this.authLost.set(true);
    a.onOffline = n => this.pending.set(n);
    this.adapter = a;
    if (!this.listening) { this.listening = true; addEventListener('online', () => this.refresh()); }
    const held = await Promise.all(KINDS.map(k => copyGet<any>(c.slug, k)));
    if (held.some(h => h !== null)) { this.put(held.map(h => h || [])); this.paintedFrom.set('device'); this.ready.set(true); }
    else this.loading.set(true);
    /* not awaited: the first paint never waits on the server */
    this.refresh();
  }
  private listening = false;
  /* what the app HOLDS, readable from outside so a capacity run can count it. Counts only, no rows. */
  constructor(){ (window as any).__hub = { held: () => ({ enquiries: this.enquiries().length, deals: this.deals().length, customers: this.customers().length, tasks: this.tasks().length, activities: this.activities().length }), from: () => this.paintedFrom(), offline: () => this.offline(), loading: () => this.loading(), pending: () => this.pending() }; }
  /* ask the server for news. A failure keeps what is on screen and says so. */
  async refresh() {
    try { await this.reload(); this.offline.set(false); this.paintedFrom.set('server'); }
    catch (e: any) { if (e?.message !== '401') this.offline.set(true); }
    finally { this.loading.set(false); this.ready.set(true); }
  }
  async reload() {
    const all = await Promise.all(KINDS.map(k => this.adapter.list<any>(k)));
    this.put(all);
    if (this.mode() === 'api') { const slug = this.castSvc.slug(); KINDS.forEach((k, i) => copyPut(slug, k, all[i])); }
  }
  private put(all: any[][]) { this.enquiries.set(all[0]); this.deals.set(all[1]); this.customers.set(all[2]); this.tasks.set(all[3]); this.activities.set(all[4]); }
  /* after a write, the device copy follows the screen. One kind, written behind the paint. */
  private keepT: Record<string, any> = {};
  private keep(k: Table) {
    if (this.mode() !== 'api') return;
    clearTimeout(this.keepT[k]);
    this.keepT[k] = setTimeout(() => copyPut(this.castSvc.slug(), k, (this as any)[k]()), 400);
  }
  /* ONE DEVICE, ONE CLIENT AT A TIME. A session that ended keeps its copy so the same person comes
     back to what they had. When a DIFFERENT client signs in on the device, everything the last
     one left (rows, drafts, unsent writes) is removed before the new one sees a screen. */
  async arrive(slug: string) {
    let last = ''; try { last = localStorage.getItem('hub_last_slug') || ''; } catch {}
    if (last && last !== slug) { await copyClear(last); this.drafts.clearAll(last); try { localStorage.removeItem('hub_outbox_' + last); } catch {} this.put([[], [], [], [], []]); }
    try { localStorage.setItem('hub_last_slug', slug); } catch {}
  }
  /* SIGNING OUT LEAVES NOTHING BEHIND: the device copy, the drafts and the unsent writes for this
     client all go, and the screen forgets its rows before the next seat signs in. In local mode the
     book itself lives in this browser (that is the whole free tier), so the book stays. */
  async signOut() {
    const slug = this.castSvc.slug();
    Object.values(this.keepT).forEach(t => clearTimeout(t));
    if (slug) { await copyClear(slug); this.drafts.clearAll(slug); try { localStorage.removeItem('hub_outbox_' + slug); } catch {} }
    this.put([[], [], [], [], []]); this.pending.set(0); this.offline.set(false); this.ready.set(false); this.paintedFrom.set('');
    this.session.logout();
  }

  /* enquiries */
  async addEnquiry(row: Partial<Enquiry>) {
    const r = await this.adapter.create<Enquiry>('enquiries', { status: 'new', ...row });
    this.enquiries.update(x => [r, ...x]); this.keep('enquiries'); return r;
  }
  async updateEnquiry(id: string, patch: Partial<Enquiry>) {
    const r = (await this.adapter.update<Enquiry>('enquiries', id, patch)) || this.merge(this.enquiries(), id, patch);
    if (r) this.enquiries.update(x => x.map(e => e.id === id ? r : e)); this.keep('enquiries'); return r;
  }
  private merge<T extends { id: string }>(rows: T[], id: string, patch: Partial<T>): T | null { const cur = rows.find(r => r.id === id); return cur ? { ...cur, ...patch, updatedAt: now() } as T : null; }
  async removeEnquiry(id: string) { await this.adapter.remove('enquiries', id); this.enquiries.update(x => x.filter(e => e.id !== id)); this.keep('enquiries'); }
  /* an enquiry becomes a deal: the deal carries the link back, the enquiry is marked converted */
  async convertEnquiry(e: Enquiry, extra: Partial<Deal> = {}) {
    const deal = await this.addDeal({ name: e.name, phone: e.phone, wants: e.wants, enquiryId: e.id, stage: 'talking', value: 0, ...extra });
    await this.updateEnquiry(e.id, { status: 'converted', dealId: deal.id });
    await this.log(deal.id, 'note', `Started from an enquiry${e.source ? ' via ' + e.source : ''}`);
    return deal;
  }

  /* deals */
  async addDeal(row: Partial<Deal>) {
    const r = await this.adapter.create<Deal>('deals', { stage: 'talking', value: 0, stageAt: now(), lastContactAt: now(), ...row });
    this.deals.update(x => [r, ...x]); this.keep('deals'); return r;
  }
  async updateDeal(id: string, patch: Partial<Deal>) {
    const r = (await this.adapter.update<Deal>('deals', id, patch)) || this.merge(this.deals(), id, patch);
    if (r) this.deals.update(x => x.map(d => d.id === id ? r : d)); this.keep('deals'); return r;
  }
  async removeDeal(id: string) { await this.adapter.remove('deals', id); this.deals.update(x => x.filter(d => d.id !== id)); this.keep('deals'); }
  /* moving stage is the one write every screen shares. Winning creates the customer
     exactly once and keeps the deal, so the board can still show it under Won */
  async moveDeal(id: string, stage: Stage, opts: { lostReason?: string; bought?: string } = {}) {
    const d = this.deals().find(x => x.id === id); if (!d || d.stage === stage) return d || null;
    const patch: Partial<Deal> = { stage, stageAt: now(), lastContactAt: now() };
    if (stage === 'lost') patch.lostReason = opts.lostReason || '';
    if (stage === 'won' && !d.customerId) {
      const c = await this.addCustomer({ name: d.name, phone: d.phone, bought: opts.bought ?? d.wants ?? '', value: d.value || 0, since: today(), dealId: d.id });
      patch.customerId = c.id;
    }
    const r = await this.updateDeal(id, patch);
    await this.log(id, 'note', stage === 'won' ? 'Won' : stage === 'lost' ? `Lost${opts.lostReason ? ': ' + opts.lostReason : ''}` : `Moved to ${stage}`);
    return r;
  }

  /* customers */
  async addCustomer(row: Partial<Customer>) {
    const r = await this.adapter.create<Customer>('customers', { value: 0, since: today(), ...row });
    this.customers.update(x => [r, ...x]); this.keep('customers'); return r;
  }
  async updateCustomer(id: string, patch: Partial<Customer>) {
    const r = (await this.adapter.update<Customer>('customers', id, patch)) || this.merge(this.customers(), id, patch);
    if (r) this.customers.update(x => x.map(c => c.id === id ? r : c)); this.keep('customers'); return r;
  }
  async removeCustomer(id: string) { await this.adapter.remove('customers', id); this.customers.update(x => x.filter(c => c.id !== id)); this.keep('customers'); }

  /* tasks and activity */
  async addTask(row: Partial<Task>) { const r = await this.adapter.create<Task>('tasks', { done: false, ...row }); this.tasks.update(x => [r, ...x]); this.keep('tasks'); return r; }
  async toggleTask(id: string) { const t = this.tasks().find(x => x.id === id); if (!t) return; const r = (await this.adapter.update<Task>('tasks', id, { done: !t.done })) || this.merge(this.tasks(), id, { done: !t.done }); if (r) this.tasks.update(x => x.map(y => y.id === id ? r : y)); this.keep('tasks'); }
  async updateTask(id: string, patch: Partial<Task>) { const r = (await this.adapter.update<Task>('tasks', id, patch)) || this.merge(this.tasks(), id, patch); if (r) this.tasks.update(x => x.map(y => y.id === id ? r : y)); this.keep('tasks'); return r; }
  async removeTask(id: string) { await this.adapter.remove('tasks', id); this.tasks.update(x => x.filter(t => t.id !== id)); this.keep('tasks'); }
  async log(dealId: string, type: Activity['type'], summary: string) {
    const r = await this.adapter.create<Activity>('activities', { dealId, type, summary });
    this.activities.update(x => [r, ...x]); this.keep('activities');
    if (type !== 'note') await this.updateDeal(dealId, { lastContactAt: now() });
    return r;
  }
  activityFor(dealId: string) { return this.activities().filter(a => a.dealId === dealId); }

  toast(text: string, href?: string, label?: string) {
    this.toastMsg.set({ text, href, label });
    clearTimeout(this.toastT); this.toastT = setTimeout(() => this.toastMsg.set(null), 3000);
  }
  /* the harness needs a way to wipe THIS client's demo rows and nothing else */
  async wipe() { for (const t of ['enquiries', 'deals', 'customers', 'tasks', 'activities'] as Table[]) for (const r of await this.adapter.list<any>(t)) await this.adapter.remove(t, r.id); await this.reload(); }
}
export function today() { return new Date().toISOString().slice(0, 10); }
export function daysSince(iso?: string) { if (!iso) return 0; return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)); }
export function waLink(phone?: string, name?: string) {
  let d = String(phone || '').replace(/\D/g, ''); if (!d) return '';
  if (d.length === 9 && d[0] !== '0') d = '94' + d; else if (d[0] === '0') d = '94' + d.slice(1);
  return `https://wa.me/${d}?text=${encodeURIComponent('Hello ' + (name || '') + ', ')}`;
}
export function niceDate(iso?: string) {
  if (!iso) return ''; const d = new Date(iso); if (isNaN(+d)) return '';
  const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${d.getDate()} ${M[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ' ' + d.getFullYear() : ''}`;
}
export function ago(iso?: string) {
  const n = daysSince(iso); if (!iso) return '';
  if (n === 0) return 'today'; if (n === 1) return 'yesterday'; return `${n} days ago`;
}

/* how long since, in words a person would say: never "1 days ago" */
export function since(n: number) { return n <= 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago`; }
/* a long date written the same way in every browser: Monday 28 September 2026, no comma.
   Left to the browser, Safari writes a comma after the weekday and Chrome does not. */
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function longDate(d = new Date(), year = false) { return `${DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}${year ? ' ' + d.getFullYear() : ''}`; }
export function monthName(d = new Date()) { return MONTHS[d.getMonth()]; }
