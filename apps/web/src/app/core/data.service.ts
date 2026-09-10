import { Injectable, signal, computed, inject } from '@angular/core';
import { CastService } from './cast.service';
import { SessionService } from './session.service';
import { Enquiry, Deal, Customer, Task, Activity, Table, Stage } from './models';

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
  async flush(){
    const q = this.outbox(); if (!q.length) return;
    const left: any[] = [];
    for (const w of q) { try { await this.go(w.path, { method: w.method, body: w.body }); } catch (e: any) { if (e.message === '401') return; left.push(w); } }
    this.setOutbox(left);
  }
  private async write<T>(path: string, method: string, body?: any, fallback?: T): Promise<T> {
    try { const r = await this.go<T>(path, { method, body: body ? JSON.stringify(body) : undefined }); this.flush(); return r; }
    catch (e: any) {
      if (e.message === '401') throw e;
      this.setOutbox([...this.outbox(), { path, method, body: body ? JSON.stringify(body) : undefined }]);
      return fallback as T;
    }
  }
  async list<T>(t: Table) { await this.flush(); return this.go<T[]>(t); }
  create<T>(t: Table, row: Partial<T>) { const local = { ...row, id: uid(), createdAt: now(), updatedAt: now() } as T; return this.write<T>(t, 'POST', local, local); }
  update<T>(t: Table, id: string, patch: Partial<T>) { return this.write<T | null>(`${t}/${id}`, 'PATCH', patch, null); }
  async remove(t: Table, id: string) { await this.write(`${t}/${id}`, 'DELETE'); }
}

@Injectable({ providedIn: 'root' })
export class DataService {
  private castSvc = inject(CastService); private session = inject(SessionService);
  private adapter!: Adapter;
  readonly pending = signal(0);
  readonly authLost = signal(false);
  readonly ready = signal(false);
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

  async init() {
    const c = this.castSvc.cast(); if (!c) return;
    const api = this.castSvc.config().api;
    this.mode.set(api ? 'api' : 'local');
    if (api) {
      const a = new ApiAdapter(api, c.slug, () => this.session.token());
      a.onAuthLost = () => this.authLost.set(true);
      a.onOffline = n => this.pending.set(n);
      this.adapter = a;
      addEventListener('online', () => a.flush().then(() => this.reload()));
    } else this.adapter = new LocalAdapter('bbos_' + c.slug);
    try { await this.reload(); } catch {}
    this.ready.set(true);
  }
  async reload() {
    const [e, d, cu, t, a] = await Promise.all([
      this.adapter.list<Enquiry>('enquiries'), this.adapter.list<Deal>('deals'), this.adapter.list<Customer>('customers'),
      this.adapter.list<Task>('tasks'), this.adapter.list<Activity>('activities')]);
    this.enquiries.set(e); this.deals.set(d); this.customers.set(cu); this.tasks.set(t); this.activities.set(a);
  }

  /* enquiries */
  async addEnquiry(row: Partial<Enquiry>) {
    const r = await this.adapter.create<Enquiry>('enquiries', { status: 'new', ...row });
    this.enquiries.update(x => [r, ...x]); return r;
  }
  async updateEnquiry(id: string, patch: Partial<Enquiry>) {
    const r = (await this.adapter.update<Enquiry>('enquiries', id, patch)) || this.merge(this.enquiries(), id, patch);
    if (r) this.enquiries.update(x => x.map(e => e.id === id ? r : e)); return r;
  }
  private merge<T extends { id: string }>(rows: T[], id: string, patch: Partial<T>): T | null { const cur = rows.find(r => r.id === id); return cur ? { ...cur, ...patch, updatedAt: now() } as T : null; }
  async removeEnquiry(id: string) { await this.adapter.remove('enquiries', id); this.enquiries.update(x => x.filter(e => e.id !== id)); }
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
    this.deals.update(x => [r, ...x]); return r;
  }
  async updateDeal(id: string, patch: Partial<Deal>) {
    const r = (await this.adapter.update<Deal>('deals', id, patch)) || this.merge(this.deals(), id, patch);
    if (r) this.deals.update(x => x.map(d => d.id === id ? r : d)); return r;
  }
  async removeDeal(id: string) { await this.adapter.remove('deals', id); this.deals.update(x => x.filter(d => d.id !== id)); }
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
    this.customers.update(x => [r, ...x]); return r;
  }
  async updateCustomer(id: string, patch: Partial<Customer>) {
    const r = (await this.adapter.update<Customer>('customers', id, patch)) || this.merge(this.customers(), id, patch);
    if (r) this.customers.update(x => x.map(c => c.id === id ? r : c)); return r;
  }
  async removeCustomer(id: string) { await this.adapter.remove('customers', id); this.customers.update(x => x.filter(c => c.id !== id)); }

  /* tasks and activity */
  async addTask(row: Partial<Task>) { const r = await this.adapter.create<Task>('tasks', { done: false, ...row }); this.tasks.update(x => [r, ...x]); return r; }
  async toggleTask(id: string) { const t = this.tasks().find(x => x.id === id); if (!t) return; const r = (await this.adapter.update<Task>('tasks', id, { done: !t.done })) || this.merge(this.tasks(), id, { done: !t.done }); if (r) this.tasks.update(x => x.map(y => y.id === id ? r : y)); }
  async updateTask(id: string, patch: Partial<Task>) { const r = (await this.adapter.update<Task>('tasks', id, patch)) || this.merge(this.tasks(), id, patch); if (r) this.tasks.update(x => x.map(y => y.id === id ? r : y)); return r; }
  async removeTask(id: string) { await this.adapter.remove('tasks', id); this.tasks.update(x => x.filter(t => t.id !== id)); }
  async log(dealId: string, type: Activity['type'], summary: string) {
    const r = await this.adapter.create<Activity>('activities', { dealId, type, summary });
    this.activities.update(x => [r, ...x]);
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
