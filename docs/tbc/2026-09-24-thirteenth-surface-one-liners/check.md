# CHECK

## Commands

```
$ npm run visual -- oneLiners
      Tests  3 passed (3)
  6 image(s) in artifacts/visual/
exit 0
```

## It was looked at — six images, one at a time

**`one-liners.light`** — two white bordered cards, each an ember quote glyph beside a bold line in
near-black, the "why it works" sentence below it in grey, and a row of "Discovery" / "Objection"
pills with visible borders beside "Maple Ct · Sep 20 · Follow-up". Then "YOUR TEAM'S PLAYBOOK" and
"PRODUCT KNOWLEDGE", each a bordered card of body text, and a centred "Grounded in proven sales
books." with an ember bulb.

**`one-liners.dark`** — the same structure, the same borders, white text on near-black, ember
section icons. The pair is the point: nothing about the light one is weaker than the dark one.

**`one-liners-empty.light`** — two bordered cards, one sentence each, "Sales Coach settings" as a
bronze link in the second.

**`one-liners-empty.dark`** — the same two cards, the link in bright ember.

**`one-liners-error.light`** — "Couldn't load (HTTP 500)" centred, in a strong orange on cream,
alone on the page.

**`one-liners-error.dark`** — the same sentence in pale amber on near-black.

## Findings

### Hypothesis 1 CONFIRMED — the kit fix reached this file untouched

class: a file that is a member of a defect class while containing no instance of it
sweep: `grep -E "(border|bg|text|stroke|fill|divide|ring)-white/" src/app/dashboard/sales-coach/strategy/page.tsx` → 0
severity: n/a — this is the verification, not a defect

**[OBSERVED]** Four `<DeckCard>` and one `<DeckPill>` render with borders and fills on cream, and
this file was not changed to achieve it.

**[OBSERVED]** The same grep returned 0 before the kit was fixed, when the page would have rendered
as borderless text.

This is the strongest single piece of evidence for the producer-over-instances argument made in the
previous build: the fix and the verification are in different files, and the grep is blind to both.

### `text-amber-300` on the error line

class: a raw dark-mode tint used for text on a theme-following surface
sweep: `grep -nE "text-(amber|emerald|rose)-(200|300|400)" src/app/dashboard/sales-coach/strategy/page.tsx` → 1, now 0
severity: low

**[OBSERVED]** Fixed and rendered in both themes.

Low because of what the state is — a 500 on one page — but it is the fifth file today to carry the
same value, and the fifth time the fix is `-600 dark:-300`.

### Hypothesis 3 CONFIRMED — `outcomeLabel` is doing its job

**[OBSERVED]** The capture shows "Follow-up" and "Sold", from fixture values `follow_up` and
`sold`. PitchPerformance rendered the raw tokens this morning because it was fed the wrong
`outcome` vocabulary; this page passes the v5 vocabulary through the shared labeller and reads
correctly.

### The error state is a dead end — NOT FIXED

class: a failure state with no way forward (§1.5.1 layer 3)
severity: medium
**[OBSERVED]** The error renders one sentence and nothing else. No retry, no link, no next action.

**[OBSERVED]** `TodaysMetrics.tsx:83` and PitchPerformance both offer "Retry" in the same
situation, so the pattern exists in this codebase.

**[OBSERVED]** This very file cites the governing clause thirty lines below, at its playbook empty
state: *"§1.5.1 L3 — link the fix, don't just name it."* The page applies the principle to its
empty state and not to its error state.

**Not fixed, deliberately.** Adding a retry is a behaviour change, not a colour fix, and it is
outside "render every screen and look" on the eve of an investor demo. It is in the residual as a
proposal.

## What this does not prove

**The populated state's data came from a fixture, not from the route.** Whether
`/api/coach/sales-session/strategy-library` actually returns `context`, `sessionLabel` and
`outcome` populated for a real rep is not established here.
