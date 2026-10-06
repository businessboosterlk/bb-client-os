import { Enquiry, Deal, Customer, Task, Activity } from './models';

/* THE DEMO BOOK IS NEVER EMPTY. A prospect opening the demo for the first time used to see LKR 0 on
   every tile and five empty columns, which sells nothing. The demo cast alone, in local mode, on a
   browser that has never held the book, starts with a working month of a fictional cinnamon trader:
   twelve rows a person can tap. Dates are counted back from today, so the book never goes stale.
   No phone numbers anywhere: a demo row with a number that looks real is a row somebody will call. */
const ago = (d: number) => new Date(Date.now() - d * 864e5).toISOString();
const day = (d: number) => ago(d).slice(0, 10);
export const DEMO_SEEDED_FLAG = 'hub_demo_seeded';
export function demoSeed(): { enquiries: Enquiry[]; deals: Deal[]; customers: Customer[]; tasks: Task[]; activities: Activity[] } {
  const r = (d: number) => ({ createdAt: ago(d), updatedAt: ago(d) });
  return {
    enquiries: [
      { id: 'demo-e1', name: 'Galle Fort Bakery', wants: 'Ground cinnamon, five kilos a month', source: 'WhatsApp', status: 'new', ...r(1) },
      { id: 'demo-e2', name: 'Mount Lavinia guest house', wants: 'Welcome packs for forty rooms', source: 'Instagram', status: 'new', ...r(2) },
      { id: 'demo-e3', name: 'Nimal Perera', wants: 'Gift packs for the office', source: 'Referral', status: 'contacted', ...r(4) },
      { id: 'demo-e4', name: 'Colombo Coffee Collective', wants: 'A tasting flight for the counter', source: 'Walk in', status: 'converted', dealId: 'demo-d2', ...r(9) }
    ],
    deals: [
      { id: 'demo-d1', name: 'Cinnamon Grand spa shop', wants: 'Retail quills, two shelves', stage: 'talking', value: 180000, nextStep: 'Send the wholesale price list', nextAt: day(-2), stageAt: ago(6), lastContactAt: ago(6), ...r(8) },
      { id: 'demo-d2', name: 'Colombo Coffee Collective', wants: 'A tasting flight for the counter', stage: 'quoted', value: 64000, nextStep: 'Call about the quote', nextAt: day(0), enquiryId: 'demo-e4', stageAt: ago(3), lastContactAt: ago(3), ...r(9) },
      { id: 'demo-d3', name: 'Tea Trails hampers', wants: 'Christmas hampers, three hundred units', stage: 'closing', value: 540000, nextStep: 'Confirm the delivery date', nextAt: day(-1), stageAt: ago(2), lastContactAt: ago(1), ...r(21) },
      { id: 'demo-d4', name: 'Pettah Spice Traders', wants: 'Monthly bulk order', stage: 'won', value: 420000, customerId: 'demo-c1', stageAt: ago(5), lastContactAt: ago(5), createdAt: ago(30), updatedAt: ago(5) },
      { id: 'demo-d5', name: 'Airport duty free', wants: 'Trial listing', stage: 'lost', value: 95000, lostReason: 'Went with a bigger supplier', stageAt: ago(12), lastContactAt: ago(12), ...r(26) }
    ],
    customers: [
      { id: 'demo-c1', name: 'Pettah Spice Traders', bought: 'Monthly bulk order', value: 420000, since: day(5), dealId: 'demo-d4', notes: 'Collects on the first Monday', ...r(5) },
      { id: 'demo-c2', name: 'Barefoot Cafe', bought: 'Quills and powder for the kitchen', value: 310000, since: day(140), notes: 'Pays by transfer, likes a reminder', ...r(140) }
    ],
    tasks: [
      { id: 'demo-t1', text: 'Send the wholesale price list to Cinnamon Grand', due: day(1), done: false, dealId: 'demo-d1', who: 'Amara', ...r(2) },
      { id: 'demo-t2', text: 'Call Colombo Coffee Collective about the quote', due: day(0), done: false, dealId: 'demo-d2', who: 'Dilan', ...r(1) },
      { id: 'demo-t3', text: 'Thank Pettah Spice Traders for the order', due: day(4), done: true, customerId: 'demo-c1', ...r(5) }
    ],
    activities: [
      { id: 'demo-a1', dealId: 'demo-d1', type: 'call', summary: 'Spoke to the buyer, wants prices by Friday', ...r(6) },
      { id: 'demo-a2', dealId: 'demo-d2', type: 'note', summary: 'Started from an enquiry via Walk in', ...r(9) },
      { id: 'demo-a3', dealId: 'demo-d2', type: 'quote', summary: 'Quote sent, LKR 64,000', ...r(3) },
      { id: 'demo-a4', dealId: 'demo-d3', type: 'meeting', summary: 'Tasted the hamper samples at their office', ...r(2) },
      { id: 'demo-a5', dealId: 'demo-d4', type: 'note', summary: 'Won', ...r(5) }
    ]
  };
}
