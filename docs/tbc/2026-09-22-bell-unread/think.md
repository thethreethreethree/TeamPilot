---
started_at: 2026-09-22T12:58:10+08:00
trigger: Sweeping for the defect class found in the review queue — a LIMIT applied before the filter that decides what the number means — turned up the notification bell, which does the same thing AND then writes the consequence to the database.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — opening the bell marks things read that were never shown

## How this was found

The review queue (0264, an hour ago) was reading fifty rows and then dropping the reviewed ones,
so reviewed rows spent the budget and an older unanswered flag could never surface. Having fixed
it, the obvious question is whether the shape exists elsewhere: **a `.limit()` followed by a
`.filter()` whose result becomes a number a human reads.**

Three candidates surfaced. Two are the same shape with lower stakes. The third is worse than the
one I fixed, and it is a surface I edited this morning.

## The defect

`GET /api/coach/gamification/notifications`:

```ts
.order("created_at", { ascending: false })
.limit(50);
…
const unread = rows.filter((r) => r.read_at === null).length;
```

The badge counts unread **within the newest fifty**. That undercounts, never over-counts, so the
worst case is a bell that looks calmer than the truth.

Then `NotificationBell.tsx`:

```ts
onClick={() => {
  setOpen((o) => !o);
  if (!open && unread > 0) void markAllRead();   // → POST { all: true }
}}
```

`{ all: true }` is a service-role update with **no limit**: `read_at = now()` for every unread row
belonging to the caller. So opening the bell marks read *everything*, including the notifications
the panel did not and cannot show — they are older than the fifty it fetched, and there is no
pagination.

**The read and the write disagree about what "all" means.** The list is bounded at fifty; the
write is unbounded. A manager who accumulates more than fifty notifications between visits opens
the bell once and the older ones are consumed — never displayed, never counted, and afterwards
indistinguishable from notifications they read and dismissed.

## Why this is worse than the queue defect

The review-queue bug *hid* rows. This one **destroys the only state that says a row still needs
attention**, and it does so as a side effect of a gesture that means "let me look", not "I have
dealt with these".

What the bell carries is not decoration. Today's own work put seven types through it — a clip a
rep disputed, a comment on a recording, a score correction, a share request. `clip_disputed`
exists because A11 says a mirror a rep cannot dispute is a judge; a dispute that reaches a manager's
bell and is silently marked read is the same failure with an extra step.

## What I will not do

**Not "raise the limit".** Same objection as 0264: it moves the cliff and makes the failure rarer
and therefore harder to find.

**Not "stop marking on open".** The auto-mark is good behaviour — a manager who looked at the list
should not have to dismiss it as well. The defect is not that it marks; it is that it marks **more
than it showed**.

## The shape of the fix

1. **"Read" means "was shown."** The auto-mark on open posts the ids actually in the panel
   (`{ ids }`, which the route already accepts), not `{ all: true }`. The explicit **Mark all
   read** button in the panel header keeps `{ all: true }` — a deliberate act, which is the only
   thing that should have unbounded consequences.
2. **An honest badge.** The unread count comes from a count query over the whole table, not from
   counting inside the page.
3. **A bounded list that says so**, the same sentence as the review queue: the panel states when
   it is showing a page rather than the set.

## What could go wrong, before I look

1. **`{ ids: [] }`** when every shown item is already read — the route's zod schema is
   `min(1)`, so that is a 400. Guard it, and prefer sending nothing.
2. **The optimistic update.** `markAllRead` currently zeroes the badge locally before the request.
   If it now marks only what was shown, the badge must drop by the number shown — not to zero —
   or the UI lies until the next poll.
3. **A count query that RLS scopes differently from the list query**, giving a badge that does not
   match its own list.
4. **The wire boundary, for the fourth time today.** `total` is a new field on an existing
   response; a browser holding this morning's bundle must be unaffected.
5. **Marking read as a silent write.** The user should be able to tell the difference between "I
   looked" and "I am done with these" — which is exactly what splitting the two paths gives them.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T13:00:23+08:00",
    "why_it_governs": "Understanding precedes solving; if I cannot articulate why the problem exists I am not permitted to solve it.",
    "how_this_build_will_embody_it": "The why is specific and was traced in the record before any edit: the read is bounded at fifty and the write is unbounded, so a gesture meaning 'let me look' consumes rows the panel never showed. Not 'notifications feel unreliable' — a named disagreement between two lines of code." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T13:00:23+08:00",
    "why_it_governs": "The methodology must be in the working tree at the moment of action, not recalled.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md are both in the tree and both hashed in this document's front matter; every clause below was opened at the line range given, in this session, before the first edit." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-22T13:00:23+08:00",
    "why_it_governs": "Four layers, foundation up; layer 2 is 'does it work when a real user invokes it the way a real user would'.",
    "how_this_build_will_embody_it": "This defect is layer 2 exactly. Every unit of the bell works: the list renders, the badge renders, the mark-read writes. Invoked the way a manager actually invokes it — open the bell to look — it destroys state it never displayed. No amount of layer 4 makes that survivable." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T13:00:23+08:00",
    "why_it_governs": "The pre-action checklist; item 5a asks whether the feature leaves the user in a flowing state.",
    "how_this_build_will_embody_it": "5a is why the fix is not simply 'stop marking on open'. That would leave a manager dismissing a list by hand every time they glance at it. Read-means-shown keeps the glance cheap and keeps the unshown rows waiting." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T13:06:36+08:00",
    "why_it_governs": "Append-only; never update or delete, and the full history must stay intact.",
    "how_this_build_will_embody_it": "It decided what NOT to do. Thirty think.md files are invisible to the gate because of their line endings, and the tempting fix is to rewrite all thirty. §3.1 says the record is not edited for the convenience of whoever reads it next, so the parser was fixed instead and the documents were left exactly as they were written. The same clause is why the six builds that shipped ungated are named in check.md rather than quietly re-validated." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-461", "read_at": "2026-09-22T13:00:38+08:00",
    "why_it_governs": "Labels without content — citing an asset that was never opened.",
    "how_this_build_will_embody_it": "A11 is quoted above from the paragraph as it reads today, not from memory of what it says: 'the System counts, observes, surfaces — the user decides'." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-599", "read_at": "2026-09-22T13:00:38+08:00",
    "why_it_governs": "Citations without session-reading are violations operating undetected.",
    "how_this_build_will_embody_it": "Every id in this manifest was opened at its line range in this session, in the two commands immediately preceding this edit. The gate refused this document once already today for the minimum set, which is the mechanism working." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-776", "read_at": "2026-09-22T13:00:38+08:00",
    "why_it_governs": "A lesson recorded only in prose will return; encode the class in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "Two ways. The test double records which relations the read asks for, so filter-after-the-cut cannot come back silently. And A30's own triggering incident is 19 views missing `security_invoker` — read again before writing 0264's view an hour ago, which is why that line is in the migration and why `rls:audit` matches it statically." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1007", "read_at": "2026-09-22T13:00:38+08:00",
    "why_it_governs": "\"Verified\" is a claim about a command you ran, not a recipe you invented.",
    "how_this_build_will_embody_it": "`npm run check` — the twelve-step canonical gate — with its exit code on its own line, plus the named mutation probes. Not a subset reported in the gate's words." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-150", "read_at": "2026-09-22T12:58:10+08:00",
    "why_it_governs": "THINK first about what could fail, then search; the agent audits as it works rather than when asked.",
    "how_this_build_will_embody_it": "Nobody asked for this. It came from taking the defect just fixed and asking where else the shape lives — a grep for a limit followed by a filter, across src/lib and src/app, which returned seven sites of which three are this class." },

  { "id": "A11", "source_file": "ThinkerThinker.md", "line_range": "275-287", "read_at": "2026-09-22T12:58:10+08:00",
    "why_it_governs": "The System mirrors rather than judges; a verdict from an authority is wrong some fraction of the time, and the dispute channel is what keeps that survivable.",
    "how_this_build_will_embody_it": "The bell is where `clip_disputed` lands. A rep's 'this clip is wrong' silently marked read is the dispute channel failing closed, which is the exact condition A11 exists to prevent — the mirror becomes a judge again as soon as disagreement stops arriving." }
]
```
