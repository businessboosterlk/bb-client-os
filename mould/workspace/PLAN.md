# THE HUB CLIENT WORKSPACE: THE MOULD (24 Oct 2026)

Thulaib said "do it" on 24 Oct 2026. Brief: `~/Downloads/THE-HUB-CLIENT-WORKSPACE/03-PROMPT-FOR-A-FRESH-CLAUDE-CHAT.md`.
Agreed design and rejected ideas: `04-TRIAGE-OF-BOTH-ANSWERS.md` in the same folder. Rule: Claude writes this mould,
the crew on DeepInfra builds each part (`~/bb-systems/bb-crew/crew/run.mjs`), Claude judges every part against its
check before it is merged. A part that fails twice comes back to Claude.

**Stage 1 only: the DEMO in local mode.** The browser keeps the data. No server, no schema change, no sign in change.
In api mode (a real client) the three new screens say plainly that the chat arrives soon and point at the WhatsApp
group, and write nothing. Stage 2 (live) needs Thulaib's yes on schema and a file store, named people per seat,
the API hosted (bb_pending 31) and 689 to 693. Live chat must be TOLD when something arrives, never poll.

## PRIOR ART, IN WRITING (the four questions)

**Has BB built this before?** Parts of it, never the whole. BB has never built a live chat.
| Module | Best existing build | What it does that the new one needs | Taken | Not taken, and why |
|---|---|---|---|---|
| Task list | Hub `pages/sales/tasks.component.ts` (now Follow ups) | filter bar, window of thirty, sheet with Edit, drafts, overdue first, tick | the sheet anatomy, filter bar, window, Edit, drafts | it is the client's own sales book: renamed Follow ups, stays in Sales |
| Board and list | Hub `pages/sales/pipeline.component.ts`; best cast Workshop `enquiries.component.ts` | one remembered switch, CDK drag with a 220ms touch delay, stage rules on drop, column window of fifteen | all of it | Won and Lost columns, money per column |
| The sheet | Hub `ui/drawer.component.ts` | one page lock, one history entry, focus in and back, one action bar, closed sheet draws nothing | used as is | nothing |
| Approval card | Workshop OS `pages/workshop/job.component.ts` (extra work approval) | a card the customer answers, nothing starts until Approve, the answer stamped with who and when, logged | the rule and the stamp | money on the card |
| Photos | Workshop OS phase photo (shrunk to 1200px, who and when) | shrink before keeping | the shrink | photos inside rows (base64 landmine): kept as files in IndexedDB instead |
| Alerts | `~/bb-systems/push/` | serves STAFF only | nothing in Stage 1 | client alerts need the hosted API: Stage 2 |

**What am I deliberately not taking?** Typing indicator, transcripts, "seen by" list, chat search, draw on image,
WhatsApp bot nudges (all PARKED in the triage). Client edits the caption, year long magic links, "usually replies in
15 mins" (REJECTED). Subtasks, priority, internal agency stages (not a ClickUp clone). The reply promise, the silence
ladder and tiers are Thulaib's calls (689 to 693), so the demo shows none of them as a promise.

## THE DESIGN (from the triage, CONFIRMED rows only)
- **One bar, five places:** Chat (opens first), Posts, Tasks, Sales, Library. Sales and Library open a panel of their
  screens from the bar. The launcher with two doors goes: the bar is the door now.
- **Chat:** header, the "needs your hand" strip (posts waiting for your yes, tasks for you), the stream by day,
  composer. Bubbles carry name and role; photos in a grid; voice notes with 1x, 1.5x, 2x; swipe or tap Reply.
  Two ticks only on what the client sent: Sent, then Seen by the team. Never show the team when the client read.
- **One record:** a comment on a task or a post goes INTO the chat as a card. Approvals and changes post a card too.
- **Message to task in two taps:** tap a bubble, tap Make a task. A client's message becomes a request For us; the
  team's message becomes a task For you. The task links back to the message (source).
- **Tasks:** six fields (title, who has it, due, stage, files, source). Three stages: To do, Doing, Done. For you /
  For us switch, board and list switch. The client moves only For you tasks. A request For us is ASKED until the team
  accepts it with an owner and a date, or says it is outside the package. Overdue: a red date, and from the team a
  reason and a new date.
- **Posts:** Waiting for you, Planned, Approved, Live; board and list. A post sheet: the artwork, a version pill,
  the caption, the slot line ("Approve by 3pm Thursday to keep the Friday 6pm slot"), Approve or Ask for a change
  (words or a voice note). After an answer the next waiting post opens (the deck). Silence is not approval: a missed
  slot says so. A live post points at the Library.

## THE PARTS
Claude (contract and integration): `core/work-models.ts` (shapes), `core/work-seed.ts` (the demo month, every word),
`core/work.service.ts` (the store), the shell, routes, bar, icons, the rename, every check script.
Crew (each one file, one brief, one check):
| Part | File | Check |
|---|---|---|
| W1 rules | `core/work.ts` | `mould/workspace/checks/w1-rules.mjs`, fixtures written first |
| W2 media | `core/media.ts` | ui-static (no any, no Date.now) + build + `scripts/work-run.mjs` probes |
| W3 voice note | `ui/voice-note.component.ts` | ui-static + work-run |
| W4 photo grid | `ui/photo-grid.component.ts` | ui-static + work-run |
| W5 post art | `ui/post-art.component.ts` | ui-static + work-run + optical |
| W6 bubble | `pages/work/bubble.component.ts` | ui-static + work-run |
| W7 composer | `pages/work/composer.component.ts` | ui-static + work-run |
| W8 chat | `pages/work/chat.component.ts` | build + work-run + click path |
| W9 tasks | `pages/work/tasks.component.ts` | build + work-run + click path |
| W10 posts | `pages/work/posts.component.ts` | build + work-run + click path |

Then the Hub gate, all 20 green; the click path presses every new action with Back once and twice; install on the
iOS simulator and LOOK; republish the demo only when green.
