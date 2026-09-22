---
started_at: 2026-09-22T12:37:00+08:00
trigger: The last "not built, and the screen says so" line on the Coach Assessment board. `flagsForReview` has been on the rubric item since it was written and is consumed by nothing — the declared-but-unread class the two audits built today gate one level up.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the one violation the rubric will not let a machine decide

## What the board asks for

`Coach Assessment  manager dashboard (web).pdf`, opened at full resolution 2026-09-22, first row
of "Needs your attention · 4 items":

```
● Anthony A. · Rude or dismissive flag                              [ Review ]
  Pitch on Thu 17 Sep, −10 applied. Confirm or remove.
```

## Why this one and not the other four violations

The rubric (p.6) lists five. Four are arithmetic — talk share over ~75%, fewer than three
discovery questions, cutting in, ignoring a question. One is not:

> **Rude, dismissive, or condescending to the customer · −10 · "Any instance; flag for manager
> review"**

It is the **largest single deduction in the rubric** — bigger than any bonus, more than a tenth of
the base — and it rests on an LLM's reading of someone's *manner*. The rubric's answer is not to
soften the penalty. It is to require that a person confirm it. `rubric.ts` already carries the
field: `flagsForReview: true`, with the comment *"Escalates to a human: the rubric says a rude
flag is 'flagged for manager review'."*

**Nothing reads it.** `grep -rn "flagsForReview" src/` returns the declaration and nothing else.
That is the writer-audit class one level down: not a table with no writer, not a value with no
branch, but a **field carrying a real decision that no surface consumes**.

## What already exists, checked before designing

- `pitch_score_events` rows of `type='violation'` carry `item_id`, `points`, `timestamp_s` and
  `evidence` — everything the row needs, including what the scorer actually heard.
- `pitch_score_overrides` (0255) + `apply_pitch_score_override` (0256) take
  `new_value ∈ {'awarded','removed'}` for a violation, require a reason, and recompute through
  `scorePitch`.
- `POST /pitch-score/override` exists, is manager-gated, requires a reason at three levels, and
  notifies the rep.

**So there is nothing to build on the write side.** Both answers a manager can give are already
expressible.

## The design question this turns on

"Confirm" and "Remove" are not symmetrical in the obvious way. Remove changes the score. Confirm
changes nothing — so where does it go?

The tempting answer is a `reviewed_at` column on the event. That would be a **second record of a
decision the override log already holds**, and the two drift the first time one is written without
the other (§3.1, §2.2).

**So confirm is also an override** — `new_value: 'awarded'` at the same points, with a reason. A
no-op to the arithmetic and a real entry in the record. And then "has a human looked at this?"
becomes "does an override row exist for this (pitch, item)?", with no status column to maintain.

That also makes the *rep's* experience right, which is the part worth having: a flag that simply
goes quiet tells them nothing. A confirmation tells them a person listened and agreed — and the
reason is written for them to read.

## What could go wrong, before I look

1. **A failed read rendered as an empty queue.** On this card that reads as reassurance: "nobody
   has been rude this week" when the truth is "nobody looked".
2. **A rubber stamp.** A card that offers Remove without showing what the scorer heard asks a
   manager to judge a person's manner from a category name.
3. **A second write path** to a table that already has one.
4. **A hard-coded list of escalated violations.** A second violation gaining `flagsForReview` must
   appear here without anyone editing a constant.
5. **The wire-boundary crash, for the third time today.** `reviewFlags` is a new field on an
   existing response. `events` and `comparison` each took a surface down through an old response
   shape earlier; I wrote the defence for both and must not now write a third field without it.
6. **Confirm being cheaper than Remove.** If Remove demands a reason and Confirm does not, the path
   of least resistance is to uphold the flag — the wrong bias for the one deduction the rubric
   singles out as needing a human.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T12:38:00+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The board was opened at full resolution before designing, and the rubric page governing this item was read this session. The design question — where a no-op confirmation is recorded — was answered from the existing override log rather than by adding a column." },

  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "78-84", "read_at": "2026-09-22T12:38:28+08:00",
    "why_it_governs": "Trace the ripple.",
    "how_this_build_will_embody_it": "Removing a flag rescores the pitch, which moves the rep's total, their band, the team average, prize eligibility and the leaderboard. That is why it goes through `apply_pitch_score_override` and not through an update." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-334", "read_at": "2026-09-22T12:38:56+08:00",
    "why_it_governs": "Consume the verdict; never re-derive.",
    "how_this_build_will_embody_it": "The escalated set is derived from `VIOLATIONS_BY_ID` by reading `flagsForReview`, never listed. The surface posts to the override route that already exists rather than acquiring a second endpoint for the same table." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T12:39:24+08:00",
    "why_it_governs": "Append-only; state derived by replaying.",
    "how_this_build_will_embody_it": "\"Reviewed\" is the ABSENCE of an override row, not a column. Both answers append; nothing updates. A `reviewed_at` field would be a second record of a fact the log already holds." },

  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-363", "read_at": "2026-09-22T12:39:52+08:00",
    "why_it_governs": "Guide, don't overtake; making the human a participant is what makes an accurate but unwelcome finding survivable.",
    "how_this_build_will_embody_it": "This clause is the whole feature. A −10 for being rude is the most unwelcome finding the product can produce, and the rubric's answer is a human in the loop. The card shows the evidence so the human can judge rather than rubber-stamp." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T12:40:20+08:00",
    "why_it_governs": "The pre-action checklist.",
    "how_this_build_will_embody_it": "Item 5a: a manager's next action after reviewing is to move on, so the row must leave the queue — which it does, because the queue is defined as flags without an override." },

  { "id": "A10", "source_file": "ThinkerThinker.md", "line_range": "260-274", "read_at": "2026-09-22T12:40:48+08:00",
    "why_it_governs": "The user sees what the system sees about them.",
    "how_this_build_will_embody_it": "The reason is written for the rep, and the override route already notifies them. A manager is told so at the point of writing, before they type it." },

  { "id": "A11", "source_file": "ThinkerThinker.md", "line_range": "275-292", "read_at": "2026-09-22T12:41:16+08:00",
    "why_it_governs": "The system mirrors; it does not judge. A verdict from an authority is wrong some fraction of the time.",
    "how_this_build_will_embody_it": "The sharpest instance of A11 in the product: an LLM has called someone rude and docked them ten points for it. This card is the mechanism by which that verdict can be wrong without being final." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-22T12:41:44+08:00",
    "why_it_governs": "Methodology in the tree, read in session, never cited from cached labels.",
    "how_this_build_will_embody_it": "The rubric's wording for this violation was read from the PDF today, not recalled — \"Any instance; flag for manager review\" is quoted from p.6 as opened." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-606", "read_at": "2026-09-22T12:42:12+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "Every id in this manifest was opened today; the gate has caught me twice on this and both times the reading changed the entry." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T12:42:40+08:00",
    "why_it_governs": "Gate the class; a gate must be precise or not exist.",
    "how_this_build_will_embody_it": "The escalated set is derived rather than listed precisely so a future `flagsForReview` cannot be added to the rubric and silently not appear here." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-819", "read_at": "2026-09-22T12:43:08+08:00",
    "why_it_governs": "Schema-complete is not built.",
    "how_this_build_will_embody_it": "`flagsForReview` is the A31 shape at field level: declared, carrying a real decision, read by nothing, for as long as the rubric has existed. The board said so on screen, which is the honest version and not the finished one." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1025", "read_at": "2026-09-22T12:43:36+08:00",
    "why_it_governs": "\"Verified\" names a command you ran.",
    "how_this_build_will_embody_it": "`npm run check` with its exit code on its own line." }
]
```
