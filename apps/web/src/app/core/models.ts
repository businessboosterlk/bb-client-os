/* One shape per record. Every record carries the client slug on the server side;
   the browser never sees another client's rows. */
export type EnquiryStatus = 'new' | 'contacted' | 'converted' | 'closed';
export type Stage = 'talking' | 'quoted' | 'closing' | 'won' | 'lost';

export interface Enquiry {
  id: string; name: string; phone?: string; email?: string; source?: string; wants?: string;
  status: EnquiryStatus; dealId?: string; createdAt: string; updatedAt: string;
}
export interface Deal {
  id: string; name: string; phone?: string; wants?: string; stage: Stage; value: number;
  nextStep?: string; nextAt?: string; enquiryId?: string; customerId?: string; lostReason?: string;
  stageAt: string; lastContactAt?: string; createdAt: string; updatedAt: string;
}
export interface Customer {
  id: string; name: string; phone?: string; email?: string; bought?: string; value: number;
  since: string; dealId?: string; notes?: string; createdAt: string; updatedAt: string;
}
export interface Task { id: string; text: string; due?: string; done: boolean; dealId?: string; customerId?: string; who?: string; by?: string; createdAt: string; updatedAt: string; }
export interface Activity { id: string; dealId: string; type: 'call' | 'message' | 'meeting' | 'note' | 'quote'; summary: string; createdAt: string; updatedAt: string; }

export type Table = 'enquiries' | 'deals' | 'customers' | 'tasks' | 'activities';

export interface StageDef { key: Stage; label: string; prob: number; }
export interface LibItem { title: string; note?: string; date?: string; platform?: string; kind?: string; href: string; added?: string; }
export interface LibMonth { id: string; label: string; videos: LibItem[]; posts: LibItem[]; }
export interface Fact { k: string; v: string; g?: string; }

export interface Cast {
  slug: string; aliases?: string[]; name: string; short?: string; wa: string; updated?: string;
  brand: { hex: string; logo?: string };
  words: Record<string, string>;
  stages: StageDef[];
  sources: string[];
  target?: { month: number };
  users: { name: string; role: string }[];
  pin?: string;
  data: { mode: 'local' | 'api'; api?: string };
  library: { hello: string; sub: string; months: LibMonth[]; docs: LibItem[]; facts: Fact[]; factsReviewed?: string };
}
