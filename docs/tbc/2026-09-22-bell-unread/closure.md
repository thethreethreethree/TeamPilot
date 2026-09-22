# CLOSURE — read means shown

## What is true now

Opening the notification bell no longer marks read anything it did not display.

That sentence is small and the thing behind it is not. `manager_notifications` carries seven
types, four of them added today, and one of them — `pattern_clip_disputed` — exists **because a
rep needs a way to tell a manager the scorer got a specific moment wrong**. The bell was the only
place that message arrives. Until this commit, a manager glancing at the bell consumed every
unread row they had, including the ones older than the fifty the panel can show. A dispute could
be marked read without ever being rendered, and afterwards it was indistinguishable from one that
had been read and dismissed.

A11 says the System mirrors rather than judges, and that a mirror a rep cannot dispute is a judge.
The dispute channel shipped this morning. It was failing closed by lunchtime, through a line
nobody would think to look at.

## How it was found, which is the part worth keeping

Not by a report, and not by looking at notifications. By taking the defect fixed an hour earlier —
a `LIMIT` applied before the `filter` that decides what a number means — and asking **where else
does this shape live**.

```
grep -l '\.limit(' src/lib src/app | awk '/\.limit\(/{l=NR} l && NR<=l+40 && /\.filter\(/'
```

Seven sites. Three are this class. One of them writes the consequence to the database.

The grep is not the method — §1.5.2 is explicit that mechanical pattern-matching does not satisfy
the rule. The method was: *a defect just found is a hypothesis about the codebase, not an incident
to close.* The grep was how the hypothesis got tested.

## What I am relying on that nobody named

- That `read_at` means "the recipient saw this", and that every other reader of the column agrees.
  I checked the writers; nothing else interprets it.
- That fifty is enough that the bounded-list line will rarely appear. If it appears routinely for
  a real manager, the answer is not a bigger page — it is that the bell is the wrong surface for
  that volume, and that is a founder question, not a limit constant.
- That the optimistic subtraction and the server agree. They can disagree for one poll interval if
  a notification arrives between the fetch and the open. The next poll reconciles; nothing
  persists wrong.

## Residual

```json
[
  {
    "id": "R1-two-round-trips-per-poll",
    "item": "The GET now issues a second request — a head count for unread — on every poll and every realtime re-fetch.",
    "why_skipped": "A count with head:true returns no rows, and the predicate is (recipient_id, read_at is null) on a per-recipient table. The list query was already the more expensive of the two.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-22T13:03:24+08:00",
    "outcome": "OPENED AND CONFIRMED, and it produced a fact I did not have. psql's table description of manager_notifications shows `manager_notifications_unread btree (recipient_id, read_at)` — an index that covers the new count exactly, left behind by whoever built the badge originally. The count is an index-only probe. The same read also turned up something the confident summary would have hidden: there is NO index on (recipient_id, created_at), which is what the LIST query orders by. That is not a problem at per-recipient row counts and it is the thing to look at first if this page ever gets slow. Noted rather than fixed — adding an index to chase a slowness nobody has measured is the shortcut for the builder."
  },
  {
    "id": "R2-the-route-has-no-test-of-its-own",
    "item": "The unread count and the new `total` are exercised only through the component's fetch mock. No test runs the route against Postgres.",
    "why_skipped": "This repo has no harness for route-level database tests, and building one is a larger piece of work than the fix it would cover.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T13:03:24+08:00",
    "outcome": "OPEN, and honestly stated rather than closed. A change to `.is(\"read_at\", null)` would fail nothing in the suite. The same gap covers 0264's view: the TypeScript tests exercise a double of it, not the view. Both are the same missing capability and should be answered together."
  },
  {
    "id": "R3-the-same-shape-in-two-other-places",
    "item": "`src/lib/data/files.ts:308` filters by department/task/tag after the page is fetched; `src/app/api/coach/sales-session/dashboard/route.ts:88` counts reviewed sessions inside a fetched set.",
    "why_skipped": "files.ts carries a comment admitting the design ('For v1 this is fine; if we hit scale we'll move to a denormalized search column'), and it is the Files module, not Sales Coach. The dashboard one reads through a paged range helper rather than a flat limit, so the set it counts over may well be complete.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T13:03:24+08:00",
    "outcome": "PARTIALLY OPENED. The dashboard site was read: it uses a `range(from,to)` pagination helper and the comment says 'uncapped; can never exceed sessions', so it is probably not this class — but 'probably' is doing work there and I did not trace the helper to the bottom. files.ts is this class, is documented as a known v1 compromise, and silently shortens a page when a filter is applied. Neither is in this build's scope. Both are named here so the next sweep starts from a list rather than from a grep."
  },
  {
    "id": "R5-older-than-a-page-is-still-unreachable",
    "item": "A recipient with more than fifty notifications can now SEE that older ones exist, and they are no longer consumed by a glance — but there is still no way to read them. The list is newest-first with no pagination, so after marking the shown fifty read, the same fifty are what loads next time.",
    "why_skipped": "Pagination is a feature, not a fix, and this build's scope was the silent write. Shipping a cursor would have put an unrequested surface in the same commit as a correctness fix.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-22T13:08:17+08:00",
    "outcome": "OPEN, and it is the honest limit of this build. What changed is that the loss is now VISIBLE (the count says 137) and DELIBERATE (only \"Mark all read\" clears what was never shown) instead of silent. That is strictly better and it is not finished. The next step is either a cursor on the list or — more likely the right answer — the recognition that a bell is the wrong surface for a three-figure backlog, which is a founder question about where notifications live, not a limit constant. Named here so it is asked rather than absorbed."
  },
  {
    "id": "R4-no-browser",
    "item": "Every surface changed today was verified in jsdom.",
    "why_skipped": "No browser has been available in this session.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-22T13:03:24+08:00",
    "outcome": "OPEN. Twenty-first consecutive build shipped without a real render. The bell's new line is a one-line paragraph inside a scrolling panel with a border — the kind of thing jsdom asserts the text of and says nothing about."
  }
]
```

## Not opened

No image, icon, logo, favicon or graphic asset was created, edited, moved, restyled or removed in
this build. The correction dot in this component is a token-coloured `<span>`, not an asset, and
was not touched.

Still unopened: the 16 images in `public/`, the 11 in
`docs/sales-coach/webstore-promo-kit/assets`, and every surface in this project in a real browser.
