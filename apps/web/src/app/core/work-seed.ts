import { WorkBook, Msg, WorkTask, WorkPost } from './work-models';

/* THE DEMO MONTH BETWEEN CINNAMON & CO AND BUSINESS BOOSTER. A prospect opening the demo sees a living workspace, not
   an empty chat: a request accepted, a change asked and answered with a version 2, an approval, a late task with its
   reason and new date, a request that is outside the package, two posts waiting for a yes. Every time is counted back
   from the first open, so the month never goes stale. The team appears by ROLE: naming real people per client is
   Thulaib's call (bb_pending), and a demo must never put words in a real person's mouth. No numbers a reader could
   mistake for results, no real business named. */
const D = 864e5;
function at(daysAgo: number, hh: number, mm: number, now: number): string {
  const d = new Date(now - daysAgo * D); d.setHours(hh, mm, 0, 0); return d.toISOString();
}
function day(daysFromNow: number, now: number): string {
  const d = new Date(now + daysFromNow * D); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const WORK_SEEDED_FLAG = 'hub_work_seeded';
const SMM = { side: 'bb' as const, by: 'Social media manager', role: 'Business Booster' };
const DESIGN = { side: 'bb' as const, by: 'Design team', role: 'Business Booster' };
const AMARA = { side: 'client' as const, by: 'Amara', role: 'Owner', seen: true };
const DILAN = { side: 'client' as const, by: 'Dilan', role: 'Sales', seen: true };

export function workSeed(now: number): WorkBook {
  const T = (o: Partial<WorkTask> & Pick<WorkTask, 'id' | 'title' | 'for' | 'stage'>, made: string): WorkTask =>
    ({ files: [], by: 'Amara', createdAt: made, updatedAt: made, ...o });
  const tasks: WorkTask[] = [
    T({ id: 'wt1', title: 'Two hamper posts and one reel before the 15th', for: 'bb', stage: 'doing', who: 'Social media manager', due: day(6, now), source: 'wm2' }, at(8, 10, 5, now)),
    T({ id: 'wt2', title: 'Shoot the new gift boxes when they arrive on Monday', for: 'bb', stage: 'todo', asked: true, source: 'wm12' }, at(1, 12, 11, now)),
    T({ id: 'wt3', title: 'Retouch the shop front photos', for: 'bb', stage: 'doing', who: 'Design team', due: day(-2, now), late: { reason: 'The photographer is reshooting in daylight, so the light matches the rest of the feed.', newDue: day(3, now) }, by: 'Social media manager' }, at(9, 11, 0, now)),
    T({ id: 'wt4', title: 'Run our stall at the Christmas fair', for: 'bb', stage: 'todo', outside: 'Events sit outside your package. We can quote it separately.', source: 'wm16' }, at(4, 14, 22, now)),
    { ...T({ id: 'wt5', title: 'Put the new opening hours on the Instagram bio', for: 'bb', stage: 'done', who: 'Social media manager', due: day(-5, now) }, at(7, 9, 0, now)), doneAt: at(5, 16, 40, now), updatedAt: at(5, 16, 40, now) },
    T({ id: 'wt6', title: 'Send us the hamper price list for the second slide', for: 'client', stage: 'todo', who: 'Amara', due: day(1, now), source: 'wm13', by: 'Social media manager' }, at(1, 15, 21, now)),
    T({ id: 'wt7', title: 'Choose one of the two covers for the morning reel', for: 'client', stage: 'todo', who: 'Dilan', due: day(3, now), by: 'Social media manager' }, at(2, 11, 15, now)),
    { ...T({ id: 'wt8', title: 'Send the logo in high quality', for: 'client', stage: 'done', who: 'Dilan', by: 'Social media manager' }, at(9, 10, 0, now)), doneAt: at(6, 10, 31, now), updatedAt: at(6, 10, 31, now) }
  ];
  const V = (v: number, head: string, line: string, tone: 'brand' | 'ink' | 'cream', caption: string, made: string) => ({ v, head, line, tone, caption, at: made });
  const slot = (daysFromNow: number, hh: number) => { const d = new Date(now + daysFromNow * D); d.setHours(hh, 0, 0, 0); return d.toISOString(); };
  const posts: WorkPost[] = [
    { id: 'wp1', platform: 'Instagram', kind: 'Carousel', status: 'waiting', slot: slot(2, 18), decideBy: slot(1, 15),
      versions: [V(1, 'Three hundred hampers. One delivery date.', 'Order by 30 November for Christmas week.', 'brand', 'Christmas hampers, packed by hand in Galle. Order by 30 November and they reach you in Christmas week.', at(7, 11, 20, now)),
                 V(2, 'Three hundred hampers. One delivery date.', 'From LKR 4,500 a hamper. Order by 30 November.', 'brand', 'Christmas hampers, packed by hand in Galle. From LKR 4,500 a hamper. Order by 30 November and they reach you in Christmas week.', at(6, 10, 15, now))],
      changes: [{ at: at(7, 13, 2, now), by: 'Amara', v: 1, text: 'Love it. Can the price go on the first slide?' }], createdAt: at(7, 11, 20, now), updatedAt: at(6, 10, 15, now) },
    { id: 'wp2', platform: 'Instagram', kind: 'Post', status: 'waiting', slot: slot(4, 18), decideBy: slot(3, 15),
      versions: [V(1, 'True Ceylon cinnamon crumbles in your fingers.', 'Ours is cut by hand, quill by quill.', 'cream', 'Real Ceylon cinnamon is soft and paper thin. If yours snaps like wood, it is cassia. Ours is cut by hand, quill by quill.', at(0, 7, 30, now))],
      changes: [], createdAt: at(0, 7, 30, now), updatedAt: at(0, 7, 30, now) },
    { id: 'wp3', platform: 'Facebook', kind: 'Post', status: 'planned', slot: slot(6, 9),
      versions: [V(1, 'Our Pettah shop opens at eight.', 'Monday to Saturday. Fresh grinding every morning.', 'ink', 'New hours from November: our Pettah shop opens at eight, Monday to Saturday.', at(2, 10, 0, now))],
      changes: [], createdAt: at(2, 10, 0, now), updatedAt: at(2, 10, 0, now) },
    { id: 'wp4', platform: 'Instagram', kind: 'Post', status: 'approved', slot: slot(1, 19), approvedBy: 'Amara', approvedAt: at(2, 9, 30, now),
      versions: [V(1, 'Cinnamon tea for cold evenings.', 'One quill, hot water, five minutes.', 'cream', 'For the first cold evening: one quill in a cup of hot water, five minutes, a spoon of honey.', at(3, 15, 0, now))],
      changes: [], createdAt: at(3, 15, 0, now), updatedAt: at(2, 9, 30, now) },
    { id: 'wp5', platform: 'Instagram', kind: 'Reel', status: 'live', slot: at(3, 18, 0, now), approvedBy: 'Amara', approvedAt: at(4, 10, 0, now),
      versions: [V(1, 'The morning grind starts at six.', 'Behind the counter in Pettah.', 'ink', 'Before the shutters go up: the morning grind in Pettah.', at(5, 12, 0, now))],
      changes: [], createdAt: at(5, 12, 0, now), updatedAt: at(3, 18, 0, now) },
    { id: 'wp6', platform: 'Facebook', kind: 'Post', status: 'live', slot: at(6, 18, 0, now), approvedBy: 'Dilan', approvedAt: at(7, 9, 0, now),
      versions: [V(1, 'Five kilos or fifty grams.', 'We pack for kitchens and for cafes.', 'brand', 'Five kilos for your kitchen or fifty grams to try. We pack both, every day.', at(8, 12, 0, now))],
      changes: [], createdAt: at(8, 12, 0, now), updatedAt: at(6, 18, 0, now) }
  ];
  const M = (o: Partial<Msg> & Pick<Msg, 'id' | 'at' | 'side' | 'by' | 'role'>): Msg => o;
  const msgs: Msg[] = [
    M({ id: 'wm1', at: at(8, 9, 12, now), ...SMM, text: 'Hello Amara. Your plan for this month is in the Library under This month. Each post comes here for your yes before it goes out.' }),
    M({ id: 'wm2', at: at(8, 9, 41, now), ...AMARA, reply: 'wm1', text: 'Thank you. Can we push the Christmas hampers harder this month? A hotel group has asked us for three hundred.' }),
    M({ id: 'wm3', at: at(8, 10, 5, now), ...SMM, event: 'task-accepted', ref: { kind: 'task', id: 'wt1' }, text: 'On it. Two hamper posts and a reel, all before the 15th.' }),
    M({ id: 'wm4', at: at(7, 11, 20, now), ...DESIGN, ref: { kind: 'post', id: 'wp1' }, text: 'The hamper carousel is ready for you.' }),
    M({ id: 'wm5', at: at(7, 13, 2, now), ...AMARA, event: 'change', ref: { kind: 'post', id: 'wp1' }, text: 'Love it. Can the price go on the first slide?' }),
    M({ id: 'wm6', at: at(6, 10, 15, now), ...DESIGN, reply: 'wm5', ref: { kind: 'post', id: 'wp1' }, text: 'Done. Version 2 has the price on the first slide.' }),
    M({ id: 'wm7', at: at(6, 10, 30, now), ...DILAN, text: 'I have emailed the logo in high quality.' }),
    M({ id: 'wm8', at: at(6, 10, 31, now), ...DILAN, event: 'task-done', ref: { kind: 'task', id: 'wt8' } }),
    M({ id: 'wm9', at: at(5, 16, 40, now), ...SMM, event: 'task-done', ref: { kind: 'task', id: 'wt5' }, text: 'The new opening hours are on the bio now.' }),
    M({ id: 'wm15', at: at(4, 14, 20, now), ...AMARA, text: 'Could your team run our stall at the Christmas fair?' }),
    M({ id: 'wm16', at: at(4, 14, 22, now), ...AMARA, event: 'task-made', ref: { kind: 'task', id: 'wt4' } }),
    M({ id: 'wm17', at: at(4, 16, 5, now), ...SMM, reply: 'wm15', event: 'task-outside', ref: { kind: 'task', id: 'wt4' }, text: 'Events sit outside your package, so we have not taken this on. We can quote it separately if you would like.' }),
    M({ id: 'wm10', at: at(3, 18, 2, now), ...SMM, ref: { kind: 'post', id: 'wp5' }, text: 'The morning grind reel is live.' }),
    M({ id: 'wm11', at: at(2, 9, 30, now), ...AMARA, event: 'approved', ref: { kind: 'post', id: 'wp4' } }),
    M({ id: 'wm18', at: at(2, 17, 45, now), ...DESIGN, event: 'task-late', ref: { kind: 'task', id: 'wt3' }, text: 'Sorry, the shop front photos are late. The photographer is reshooting in daylight. The new date is in the task.' }),
    M({ id: 'wm12', at: at(1, 12, 10, now), ...AMARA, text: 'The new gift boxes arrive on Monday. Can you shoot them when they come in?' }),
    M({ id: 'wm19', at: at(1, 12, 11, now), ...AMARA, event: 'task-made', ref: { kind: 'task', id: 'wt2' } }),
    M({ id: 'wm13', at: at(1, 15, 20, now), ...SMM, text: 'Please send us the hamper price list when you can. We need it for the second slide.' }),
    M({ id: 'wm20', at: at(1, 15, 21, now), ...SMM, event: 'task-made', ref: { kind: 'task', id: 'wt6' } }),
    M({ id: 'wm14', at: new Date(now - 40 * 60e3).toISOString(), ...SMM, ref: { kind: 'post', id: 'wp2' }, text: 'A new post is waiting for your yes. The hamper carousel needs yours by 3pm tomorrow to keep its slot.' })
  ];
  return { msgs, tasks, posts };
}
