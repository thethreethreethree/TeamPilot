# CLOSURE — the writers

## What is true now

Pattern Interrupt is a loop rather than a report. The system finds a repeated miss, a manager
coaches it in words the rep reads, the rep answers, and the next five pitches decide whether it
closes. Every step of that leaves a dated row, and every board is derived from those rows.

Concretely, and this is the part that was invisible before: **`coaching`, `improving` and
`stalled` are reachable statuses for the first time.** Three of five. The Stalled rule — coached
7+ days ago with no change — has existed since the detector shipped and could never have fired.

## What I am relying on that nobody named

1. **A coaching note rings no bell.** The rep sees it when they open their Pattern Interrupt
   page, and the banner tells them notes live there — but nothing pushes. This is a deliberate
   omission and the reasoning is worth the space: `manager_notifications` dedupes on
   `(recipient_id, type, session_id)` and a pattern has no session, so with `session_id` null
   Postgres treats every row as distinct and a manager writing three notes in one sitting would
   ring three bells. Shipping that is worse than shipping nothing. **The fix is a migration
   adding a pattern-scoped dedupe key, and it is the top of the next list.**

   The sharp edge this leaves: **AWAITING REP REVIEW counts reps who were never told.** The card
   is honest about what it measures — coached and not acknowledged — but a manager reading it
   will assume the rep was pinged. They were not.

2. **"Mark as coached" pressed twice writes two rows.** `coachedAt` takes the earliest, so the
   status is unaffected and a stalled pattern's clock cannot be reset by adding a note — that
   part is deliberate. But the timeline will draw two Ⓒ on one bar. I decided against
   de-duplicating: a manager coaching the same pattern again a fortnight later is a real event
   and the log should hold it. If the timeline gets crowded, the fix is in the rendering, not in
   the record (§3.1).

3. **No `body` on `drill_assigned`.** The button sends the kind and whatever is in the box, so a
   manager who types an instruction and presses "Assign Role Play drill" gets both. A manager who
   presses it with an empty box gets a marker and no words, which is correct and will look
   sparse.

4. **"Assign Role Play drill" assigns no drill.** It records that one was assigned. There is a
   Role Play surface in this product and this button does not reach it — the event is the claim,
   not the assignment. Named because the label is a verb and a manager will reasonably expect a
   drill to appear in the rep's queue.

5. **`clip_disputed` alerts nobody.** Same shape as (1). A rep flagging a clip as wrong writes a
   row a manager sees next time they open that pattern. The dispute queue for *scores* is a
   different, working path; this is not wired to it.

## Not built, and said on the screen

- **"Schedule check-in"** — disabled, with its reason in the tooltip, on both tabs.
- **Rude-or-dismissive flags** in Coach Assessment's "Needs your attention".
- The five items above, of which (1) and (4) are the ones a user would notice first.

## What this build did NOT do, deliberately

It did not add a notification type. A34 says code hard-requiring an unapplied migration must
degrade, and the cheap version of this — add `pattern_coached` to the CHECK and insert without a
usable dedupe key — would have shipped the noisy-bell problem to make a checklist shorter. The
constitution's line about the builder under pressure is the relevant one: the shortcut here is
*less honest*, not faster.

## The shape worth remembering

0258 shipped a table with six carefully-reasoned event kinds, RLS policies, an index, and a
closure note flagging that nothing wrote to it. Every downstream surface was then built correctly
against it. Three builds later, five screens were rendering an empty log and **three of five
statuses in the product's core lifecycle were dead**, with every test green and every audit
passing.

Nothing caught it. `reachability:audit` checks that exported code is reached, not that tables are
written to. The flag in the 0258 closure was the only record, and a flag in a closure is read
once.

The generalisable version: **a table with no writer is not a schema decision awaiting a feature,
it is a feature that does not exist**, and the cost is paid by every surface built on top of it
in the meantime. Whether that is gateable — "every table referenced by a read has an insert path
or a documented reason" — is a real question and a founder call; a gate that fires on every
lookup table is worse than none (A30). Proposing, not adding.

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed in
this build.

One source was opened and described at full resolution before any code was written:
`Pattern Interrupt  manager Patterns (web).pdf` — 1 page, 1,832,671 B, opened 2026-09-22. Its
banner sentence is quoted in the code it governs.

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real
browser — eighteenth consecutive build shipped from jsdom.
