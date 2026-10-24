#!/usr/bin/env node
// W1 CHECK, written by Claude before any builder ran. Proves core/work.ts against fixtures.
//   TZ=Asia/Colombo node --experimental-strip-types --no-warnings mould/workspace/checks/w1-rules.mjs [file.ts]
import path from 'node:path'; import { pathToFileURL } from 'node:url';
const file = path.resolve(process.argv[2] || new URL('../../../apps/web/src/app/core/work.ts', import.meta.url).pathname);
const W = await import(pathToFileURL(file).href);
let n = 0; const bad = [];
const eq = (name, got, want) => { n++; const g = JSON.stringify(got), w = JSON.stringify(want); if (g !== w) bad.push(`${name}\n      got  ${g}\n      want ${w}`); };
const ok = (name, v) => eq(name, !!v, true);

const NOW = '2026-10-22T10:00:00+05:30';     // a Thursday morning in Colombo
const T = (o) => ({ id: 't', title: 'x', for: 'client', stage: 'todo', files: [], by: 'Amara', createdAt: NOW, updatedAt: NOW, ...o });
const P = (o) => ({ id: 'p', platform: 'Instagram', kind: 'Post', slot: '2026-10-23T18:00:00+05:30', status: 'waiting', versions: [{ v: 1, caption: 'c', head: 'h', tone: 'brand', at: NOW }], changes: [], createdAt: NOW, updatedAt: NOW, ...o });
const M = (o) => ({ id: 'm', at: NOW, side: 'client', by: 'Amara', role: 'Owner', ...o });

// stages
eq('STAGES', W.STAGES, [{ key: 'todo', label: 'To do' }, { key: 'doing', label: 'Doing' }, { key: 'done', label: 'Done' }]);
eq('POST_STAGES', W.POST_STAGES, [{ key: 'waiting', label: 'Waiting for you' }, { key: 'planned', label: 'Planned' }, { key: 'approved', label: 'Approved' }, { key: 'live', label: 'Live' }]);

// due and overdue
eq('dueOf plain', W.dueOf(T({ due: '2026-10-20' })), '2026-10-20');
eq('dueOf with a new date', W.dueOf(T({ due: '2026-10-20', late: { reason: 'r', newDue: '2026-10-26' } })), '2026-10-26');
eq('dueOf none', W.dueOf(T({})), undefined);
eq('isLate past', W.isLate(T({ due: '2026-10-21' }), '2026-10-22'), true);
eq('isLate today is not late', W.isLate(T({ due: '2026-10-22' }), '2026-10-22'), false);
eq('isLate done never', W.isLate(T({ due: '2026-10-01', stage: 'done' }), '2026-10-22'), false);
eq('isLate no date', W.isLate(T({}), '2026-10-22'), false);
eq('isOverdue new date in the future', W.isOverdue(T({ due: '2026-10-20', late: { reason: 'r', newDue: '2026-10-26' } }), '2026-10-22'), false);
eq('isOverdue new date passed too', W.isOverdue(T({ due: '2026-10-10', late: { reason: 'r', newDue: '2026-10-20' } }), '2026-10-22'), true);
eq('needsReason: late For us with no answer', W.needsReason(T({ for: 'bb', due: '2026-10-20' }), '2026-10-22'), true);
eq('needsReason: answered', W.needsReason(T({ for: 'bb', due: '2026-10-20', late: { reason: 'r', newDue: '2026-10-26' } }), '2026-10-22'), false);
eq('needsReason: For you never', W.needsReason(T({ for: 'client', due: '2026-10-20' }), '2026-10-22'), false);

// who may move a task, and what a request is
eq('canMove client For you', W.canMove(T({ for: 'client' }), 'client'), true);
eq('canMove client For us', W.canMove(T({ for: 'bb' }), 'client'), false);
eq('canMove team For us', W.canMove(T({ for: 'bb' }), 'bb'), true);
eq('canMove team asked', W.canMove(T({ for: 'bb', asked: true }), 'bb'), false);
eq('canMove team outside', W.canMove(T({ for: 'bb', outside: 'Not in the package' }), 'bb'), false);
eq('requestState asked', W.requestState(T({ for: 'bb', asked: true })), 'asked');
eq('requestState outside', W.requestState(T({ for: 'bb', outside: 'x' })), 'outside');
eq('requestState accepted', W.requestState(T({ for: 'bb' })), 'accepted');
eq('requestState For you', W.requestState(T({ for: 'client' })), 'none');

// message to task
const fromClient = W.taskFromMsg(M({ id: 'm1', text: 'Can you shoot the new gift boxes before the Christmas rush starts next month please\nThey arrive Monday' }), NOW, 'Amara');
eq('taskFromMsg client: a request For us', [fromClient.for, fromClient.asked, fromClient.stage, fromClient.source, fromClient.by], ['bb', true, 'todo', 'm1', 'Amara']);
eq('taskFromMsg title: first line, cut at a word, at most 80 letters', fromClient.title, 'Can you shoot the new gift boxes before the Christmas rush starts next month');
ok('taskFromMsg title has no ellipsis', !/…|\.\.\./.test(fromClient.title));
eq('taskFromMsg stamps', [fromClient.createdAt, fromClient.updatedAt, fromClient.files.length, 'id' in fromClient], [NOW, NOW, 0, false]);
const fromTeam = W.taskFromMsg(M({ id: 'm2', side: 'bb', by: 'Social media manager', role: 'Business Booster', text: 'Please send the shop opening hours.' }), NOW, 'Amara');
eq('taskFromMsg team: For you, not a request', [fromTeam.for, !!fromTeam.asked, fromTeam.title], ['client', false, 'Please send the shop opening hours.']);
eq('taskFromMsg photos only', W.taskFromMsg(M({ photos: ['a', 'b'] }), NOW, 'Amara').title, 'Photos from Amara');
eq('taskFromMsg photos carried', W.taskFromMsg(M({ photos: ['a', 'b'] }), NOW, 'Amara').files, ['a', 'b']);
eq('taskFromMsg one photo', W.taskFromMsg(M({ photos: ['a'] }), NOW, 'Amara').title, 'Photo from Amara');
eq('taskFromMsg voice', W.taskFromMsg(M({ voice: { media: 'v', secs: 7 } }), NOW, 'Amara').title, 'Voice note from Amara');
eq('taskFromMsg short text kept whole', W.taskFromMsg(M({ text: '  Logo files?  ' }), NOW, 'Amara').title, 'Logo files?');

// the strip
const book = { msgs: [], tasks: [T({ id: 'a', for: 'client' }), T({ id: 'b', for: 'client', stage: 'done' }), T({ id: 'c', for: 'bb' }), T({ id: 'd', for: 'client', stage: 'doing' })],
  posts: [P({ id: 'p1' }), P({ id: 'p2' }), P({ id: 'p3', status: 'planned' })] };
eq('needs', W.needs(book, '2026-10-22'), [
  { key: 'posts', kind: 'post', count: 2, label: '2 posts to approve', link: '/posts', params: { show: 'waiting' } },
  { key: 'tasks', kind: 'task', count: 2, label: '2 tasks for you', link: '/tasks', params: { for: 'client' } }]);
eq('needs singular', W.needs({ msgs: [], tasks: [T({})], posts: [P({})] }, '2026-10-22').map(x => x.label), ['1 post to approve', '1 task for you']);
eq('needs nothing', W.needs({ msgs: [], tasks: [], posts: [] }, '2026-10-22'), []);
eq('needCount', W.needCount(book, '2026-10-22'), 4);
eq('changeAsked on the newest version', W.changeAsked(P({ changes: [{ at: NOW, by: 'Amara', v: 1, text: 'Bigger price' }] })), true);
eq('changeAsked on an older version only', W.changeAsked(P({ versions: [{ v: 1, caption: 'a', head: 'h', tone: 'brand', at: NOW }, { v: 2, caption: 'b', head: 'h', tone: 'brand', at: NOW }], changes: [{ at: NOW, by: 'Amara', v: 1 }] })), false);
eq('needs leaves out a post the team is changing', W.needs({ msgs: [], tasks: [], posts: [P({ changes: [{ at: NOW, by: 'Amara', v: 1 }] })] }, '2026-10-22'), []);

// words for times
eq('clockWord 3pm', W.clockWord('2026-10-22T15:00:00+05:30'), '3pm');
eq('clockWord 9:30am', W.clockWord('2026-10-22T09:30:00+05:30'), '9:30am');
eq('clockWord noon', W.clockWord('2026-10-22T12:00:00+05:30'), '12pm');
eq('clockWord midnight', W.clockWord('2026-10-22T00:05:00+05:30'), '12:05am');
eq('timeOfDay', W.timeOfDay('2026-10-22T09:05:00+05:30'), '09:05');
eq('dayLabel today', W.dayLabel('2026-10-22T08:00:00+05:30', NOW), 'Today');
eq('dayLabel yesterday', W.dayLabel('2026-10-21T23:00:00+05:30', NOW), 'Yesterday');
eq('dayLabel this year', W.dayLabel('2026-10-19T08:00:00+05:30', NOW), 'Monday 19 October');
eq('dayLabel last year', W.dayLabel('2025-12-31T08:00:00+05:30', NOW), 'Wednesday 31 December 2025');
eq('voiceTime 7', W.voiceTime(7), '0:07'); eq('voiceTime 65', W.voiceTime(65), '1:05'); eq('voiceTime rounds', W.voiceTime(7.6), '0:08'); eq('voiceTime 0', W.voiceTime(0), '0:00');

// the slot line: silence is never a yes
eq('slotLine waiting, decide by today', W.slotLine(P({ decideBy: '2026-10-22T15:00:00+05:30' }), NOW), 'Approve by 3pm today to keep the Friday 6pm slot');
eq('slotLine waiting, decide by tomorrow', W.slotLine(P({ decideBy: '2026-10-23T11:00:00+05:30', slot: '2026-10-24T18:30:00+05:30' }), NOW), 'Approve by 11am tomorrow to keep the Saturday 6:30pm slot');
eq('slotLine waiting, decide by a weekday', W.slotLine(P({ decideBy: '2026-10-26T15:00:00+05:30', slot: '2026-10-27T18:00:00+05:30' }), NOW), 'Approve by 3pm Monday to keep the Tuesday 6pm slot');
eq('slotLine waiting, no deadline', W.slotLine(P({}), NOW), 'Planned for Friday 23 October at 6pm, once you say yes');
eq('slotLine waiting, missed', W.slotLine(P({ decideBy: '2026-10-22T09:00:00+05:30' }), NOW), 'The Friday 6pm slot has passed. We never post without your yes, so we will offer a new time.');
eq('slotLine planned', W.slotLine(P({ status: 'planned' }), NOW), 'Planned for Friday 23 October at 6pm');
eq('slotLine approved', W.slotLine(P({ status: 'approved', approvedBy: 'Amara' }), NOW), 'Approved by Amara. Goes out Friday 23 October at 6pm');
eq('slotLine live', W.slotLine(P({ status: 'live', slot: '2026-10-16T18:00:00+05:30' }), NOW), 'Went out Friday 16 October at 6pm');

// grouping the stream by day, oldest first
const msgs = [M({ id: 'c', at: '2026-10-22T09:00:00+05:30' }), M({ id: 'a', at: '2026-10-20T09:00:00+05:30' }), M({ id: 'b', at: '2026-10-20T17:00:00+05:30' }), M({ id: 'd', at: '2026-10-21T22:30:00+05:30' })];
eq('byDay', W.byDay(msgs, NOW).map(g => [g.day, g.label, g.msgs.map(m => m.id)]), [['2026-10-20', 'Tuesday 20 October', ['a', 'b']], ['2026-10-21', 'Yesterday', ['d']], ['2026-10-22', 'Today', ['c']]]);
ok('byDay does not reorder its input', msgs[0].id === 'c');

// posts
eq('latest', W.latest(P({ versions: [{ v: 1, caption: 'a', head: 'h', tone: 'brand', at: NOW }, { v: 2, caption: 'b', head: 'h', tone: 'ink', at: NOW }] })).v, 2);
eq('postCounts', W.postCounts([P({}), P({ status: 'live' }), P({ status: 'live' })]), { waiting: 1, planned: 0, approved: 0, live: 2 });
const deck = [P({ id: 'x', slot: '2026-10-30T18:00:00+05:30' }), P({ id: 'y', slot: '2026-10-24T18:00:00+05:30' }), P({ id: 'z', status: 'planned', slot: '2026-10-23T18:00:00+05:30' }), P({ id: 'w', slot: '2026-10-25T18:00:00+05:30' })];
eq('deckNext: the soonest other waiting post', W.deckNext(deck, 'y')?.id, 'w');
eq('deckNext: from nothing', W.deckNext(deck, '')?.id, 'y');
eq('deckNext: none left', W.deckNext([P({ id: 'only' })], 'only'), null);
eq('deckNext: a post the team is changing is not offered', W.deckNext([P({ id: 'a', changes: [{ at: NOW, by: 'Amara', v: 1 }] }), P({ id: 'b' })], 'b'), null);

// one line that stands for a message (the reply quote)
eq('summary text', W.summary(M({ text: 'First line\nsecond' })), 'First line');
eq('summary photos', W.summary(M({ photos: ['a', 'b', 'c'] })), '3 photos');
eq('summary photo', W.summary(M({ photos: ['a'] })), 'Photo');
eq('summary voice', W.summary(M({ voice: { media: 'v', secs: 12 } })), 'Voice note 0:12');
eq('summary text beats photos', W.summary(M({ text: 'Look', photos: ['a'] })), 'Look');

// house style inside the file: no em or en dash, no Date.now, no new Date() without an argument
const src = (await import('node:fs')).readFileSync(file, 'utf8');
ok('no em or en dash in the file', !/[—–]/.test(src));
ok('no Date.now() or new Date() without an argument', !/Date\.now\(\)|new Date\(\)/.test(src));
ok('imports only types', !/^import (?!type )/m.test(src));
ok('no any', !/:\s*any\b|as any\b|<any>/.test(src));

console.log(bad.length ? `FAIL ${n - bad.length}/${n}\n  ` + bad.join('\n  ') : `PASS ${n}/${n} W1 rules`);
process.exit(bad.length ? 1 : 0);
