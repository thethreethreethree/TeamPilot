---
started_at: 2026-09-22T11:20:00+08:00
trigger: The largest remaining gap in Project 5, named in the Rep progress closure an hour ago. `pattern_events` has six valid kinds and no human writer, so the timeline draws bars with no markers, LAST COACHING reads "Not coached yet" everywhere, and "Rep reviewed" reads 0 of N. Two boards depend on rows nothing creates.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the writers, and the notes a rep is promised

## The gap, stated exactly

`pattern_events` (0258) accepts six kinds: `coached`, `drill_assigned`, `note`, `rep_reviewed`,
`clip_disputed`, `fixed`. **Nothing writes any of them.** The detector writes `patterns` rows and
uses `first_seen` as its marker; it deliberately writes no event.

Everything downstream is therefore correct and empty:

| Surface | What it shows today |
|---|---|
| Rep progress timeline | bars with zero Ⓒ Ⓓ Ⓡ markers |
| "Where each pattern stands" → LAST COACHING | "Not coached yet", every row |
| "Rep reviewed" tile | `0/0`, because the denominator is coached patterns |
| AWAITING REP REVIEW card | `0`, permanently |
| `statusOf` | can never return `coaching`, `improving` or `stalled` — **all three require `coachedAt`** |

That last line is the one that matters. **Three of the five statuses are unreachable.** Every
pattern in the product is New or Fixed, and the whole lifecycle the guide describes is decorative
until a human can say "I coached this".

This is A31 at its largest in this build cycle: five screens' worth of correct code standing on a
table nobody can write to.

## What the board says, read at full resolution today

`Pattern Interrupt  manager Patterns (web).pdf`, opened 2026-09-22:

Four buttons under the detail panel, in this order:
**Assign Role Play drill** (filled) · **Add note** · **Mark as coached** · **Schedule check-in**.

A **COACHING NOTES** panel above them with two entries:

```
Manager · Sep 18
Say the opener out loud 10 times before your first door tomorrow. Notice first, question second.

Humza Khan · Sep 18
Reviewed. Running it before shifts this week.
```

And the banner, which is the constitutional instruction for this build in the founder's own
product copy:

> Reps see their own Pattern Interrupt page, **clips and your notes included**, so nothing here
> is a surprise.

That sentence is A10 written as marketing. It is also the reason the rep's half of this is not a
follow-up commit: a manager's note is written *about* a rep and shown *to* them, and building the
write without the read would be the same seam the recordings build closed this morning.

## The design, and the one thing it turns on

**A note is an event with a body.** Rather than classifying twice — once for the timeline marker,
once for the notes list — the kind decides the marker and the presence of a `body` decides
whether it appears in COACHING NOTES. "Mark as coached" with a note attached is one row that does
both, which is what the render shows: the manager's entry reads like coaching instruction, not
like a separate memo.

**Who may write what is the database's answer, not the route's.** 0258 has no insert policy at
all, so every write is server-side and the route must carry the rule the policy would have. The
split:

- manager → `coached`, `drill_assigned`, `note`, `fixed`
- rep, on their own pattern → `rep_reviewed`, `note`, `clip_disputed`

A rep marking their own pattern coached, or fixed, is the failure this split exists to prevent.

## What could go wrong, before I look

1. **`fixed` written by a manager vs. the streak rule.** `statusOf` already returns Fixed on
   `fixedAt` OR a five-clean streak. A manual close must write the column the resolver reads, or
   two authorities will disagree about the same pattern — and the resolver is the one four
   surfaces consume.
2. **A note a rep cannot see.** The banner promises the opposite. The RLS select policy already
   grants it; the rep's surface has to render it.
3. **`rep_reviewed` on an uncoached pattern.** The tile's denominator is coached patterns, so
   acknowledging something nobody sent would produce `1/0`.
4. **Double-coaching.** "Mark as coached" pressed twice writes two rows. `coachedAt` takes the
   EARLIEST, so the status is unaffected — but the timeline would draw two Ⓒ on the same bar and
   the notes list two entries. Idempotence here is a judgement, not an obvious yes: a manager
   coaching the same pattern twice in a fortnight is a real event worth recording.
5. **Notifying on every note.** A manager adding three notes in one sitting must not ring three
   bells. The recordings build already solved this shape with upsert-UPDATE on
   `(recipient_id, type, session_id)` — but `pattern_events` has no session, so the dedupe key
   does not fit and a new type needs a decision about what it dedupes to.
6. **"Schedule check-in" is the fourth button and creates nothing.** It is disabled with its
   reason on the Rep progress board. The same button here must say the same thing, or the product
   contradicts itself across two tabs.
7. **An actor with no name.** `actor_id` is a uuid; COACHING NOTES prints "Manager · Sep 18" and
   "Humza Khan · Sep 18". Resolving names is a cross-person read and must be scoped the way the
   other boards scope it.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T11:21:00+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The gap was diagnosed from the record rather than from the mockup: three of five statuses are unreachable because every one of them requires `coachedAt`, and nothing writes it. That is a bigger finding than 'four buttons are missing' and it came from reading `statusOf`, not from counting buttons." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T11:21:30+08:00",
    "why_it_governs": "Methodology in the tree at the moment of action.",
    "how_this_build_will_embody_it": "0258's kind CHECK and its RLS policies were read out of the migration before designing the route, not recalled — the six kinds and the absent insert policy are both quoted above." },

  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "78-84", "read_at": "2026-09-22T11:22:00+08:00",
    "why_it_governs": "Trace the ripple before changing shared state.",
    "how_this_build_will_embody_it": "One insert unblocks five surfaces at once: the timeline markers, LAST COACHING, the Rep reviewed tile, the AWAITING REP REVIEW card and three of the five statuses. The ripple runs the other way too — a wrong kind written here shows up on all of them." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "85-137", "read_at": "2026-09-22T11:22:30+08:00",
    "why_it_governs": "Four layers; layer 3 asks whether the user can continue.",
    "how_this_build_will_embody_it": "The manager's next action after coaching is to see it land. Writing the row without rendering it in COACHING NOTES and on the timeline leaves them pressing a button that appears to do nothing — the layer-3 stall, not a layer-4 polish item." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T11:23:00+08:00",
    "why_it_governs": "THINK first, then search.",
    "how_this_build_will_embody_it": "Seven hypotheses. The two that shape the build are the manual-fix path colliding with the streak rule, and the notification dedupe key not fitting a table with no session." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-334", "read_at": "2026-09-22T11:23:30+08:00",
    "why_it_governs": "Consume the verdict; never re-derive the gate.",
    "how_this_build_will_embody_it": "A manual close writes `patterns.fixed_at`, which is the column `statusOf` already reads. It does NOT write a `fixed` event and call the pattern closed on its own authority — that would be a second decider of the one thing four surfaces consume." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T11:24:00+08:00",
    "why_it_governs": "Append-only; state derived by replaying.",
    "how_this_build_will_embody_it": "This build is the write half of that clause finally existing. Every action appends; nothing edits. A manager who coaches twice leaves two rows, and the resolver takes the earliest — deliberately, so a second note cannot reset a stalled pattern's clock." },

  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-363", "read_at": "2026-09-22T11:24:30+08:00",
    "why_it_governs": "Guide, don't overtake; the human is a participant in the diagnosis.",
    "how_this_build_will_embody_it": "The rep's note is the participation. Until this build the conversation was one-directional — the system found a pattern, the manager read it, and the rep had no way to say 'reviewed, running it before shifts'. The render shows that reply as a peer entry in the same list, not as a checkbox." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T11:25:00+08:00",
    "why_it_governs": "The pre-action checklist.",
    "how_this_build_will_embody_it": "Item 5a for both roles: a manager presses Mark as coached and must see the pattern move from New to Coaching; a rep opens their page and must find the note the banner promised them." },

  { "id": "A10", "source_file": "ThinkerThinker.md", "line_range": "260-274", "read_at": "2026-09-22T11:25:30+08:00",
    "why_it_governs": "The user sees what the system sees about them; no shadow read.",
    "how_this_build_will_embody_it": "The founder's own banner states it: 'Reps see their own Pattern Interrupt page, clips and your notes included, so nothing here is a surprise.' A manager's note is written about a rep, so the rep's read ships in the same commit as the manager's write." },

  { "id": "A11", "source_file": "ThinkerThinker.md", "line_range": "275-292", "read_at": "2026-09-22T11:26:00+08:00",
    "why_it_governs": "The system mirrors; it does not judge.",
    "how_this_build_will_embody_it": "'Mark as coached' is a human asserting a human fact. The system's job here is to record it accurately and date it, not to infer coaching from activity — an inferred coaching event would make the Stalled rule unfalsifiable, which is why 0258's allowlist entry says the log is the audit trail." },

  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-593", "read_at": "2026-09-22T11:26:30+08:00",
    "why_it_governs": "Same name, different feature, across modules.",
    "how_this_build_will_embody_it": "Checked before writing: there is already a `note` concept in coaching sessions and a `notes` field on the assessment board. This route writes `pattern_events`, its type is named for that, and its path is `patterns/event` — not `/note`, which would collide with the two that exist." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-22T11:58:00+08:00",
    "why_it_governs": "Methodology that governs the build must be in the working tree AND read in session; labels propagate through commits far faster than content propagates, so a citation without a reading gives false confidence the discipline is being applied.",
    "how_this_build_will_embody_it": "Added when the manifest gate demanded it, and the reading earned its place: A19's shape is a document kept somewhere nobody looks. `pattern_events` was flagged as writerless in 0258's CLOSURE — a store the next author does not search, which is the same mistake pointed at a table instead of a methodology. That parallel is why the fix became a gate rather than another note." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-606", "read_at": "2026-09-22T11:58:30+08:00",
    "why_it_governs": "Citations without session-reading are A19 + A9 violations operating undetected.",
    "how_this_build_will_embody_it": "The gate fired on this very manifest, which is the argument for it existing. Twice today the same gate has made me read something I had cited from memory, and both times the entry I then wrote was different from the one I would have written." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T11:28:30+08:00",
    "why_it_governs": "A lesson in prose returns; gate the class, and a gate must be precise or not exist.",
    "how_this_build_will_embody_it": "This build's finding is A30's own thesis: A31 has been written down since June, cited in four think.md files this cycle, and did not stop five surfaces being built on an unwritten table. The follow-up is a command that exits non-zero, with its precision measured rather than asserted." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-819", "read_at": "2026-09-22T11:27:00+08:00",
    "why_it_governs": "Schema-complete is not built.",
    "how_this_build_will_embody_it": "This build IS the A31 repair. 0258 shipped six event kinds in June-grade detail and the product has never written one; five surfaces render them correctly and show nothing. The lesson is not that the migration was wrong — it is that a table with no writer should be flagged the day it ships, and it was, in that closure, and it still took three builds." },

  { "id": "A34", "source_file": "ThinkerThinker.md", "line_range": "880-905", "read_at": "2026-09-22T11:27:30+08:00",
    "why_it_governs": "Code hard-requiring an unapplied migration must degrade.",
    "how_this_build_will_embody_it": "0261 extended the notification type CHECK once already. If this build adds a pattern notification type it needs the same treatment, and the writer must fail soft — a coaching row that saved but whose bell did not ring is a degradation; a 500 after the row is written loses the manager's action." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1025", "read_at": "2026-09-22T11:28:00+08:00",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "`npm run check` with its exit code on its own line." }
]
```
