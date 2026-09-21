# BUILD

## Files

**`src/components/sales-coach/PitchDetail.tsx`** (new) — pure presentation over `StoredPitch`.

Built to page 3 of the rep dashboard: score card, base by section, expandable per-section element
detail (grade badge · evidence · play chip · points), bonuses, violations, dispute.

Five decisions worth naming:

- **Section totals are read, never summed.** The single way this screen could undo migration 0254.
- **Grade badges carry the WORD as well as the colour.** Colour is the founder's specification and
  is information, not decoration — but it cannot be the only channel.
- **A play chip with no timestamp is not rendered.** With no `onSeek`, the time renders as plain
  text rather than a button that does nothing.
- **A retired element is counted for in a footnote.** Its points are inside `base`; a hidden row
  leaves points on screen that nothing explains.
- **`deliveryScaled` gets a sentence.** Without it, a rep adds the Delivery rows, gets less than
  the section shows, and concludes the score is broken. It is not — it is scaled in their favour.

**`src/components/sales-coach/PitchScorePanel.tsx`** (new) — the state machine and the fetches.

Five states, deliberately not one error box: `loading`, `unscored`, `scoring`, `failed` (carrying
the route's own reason and whether a retry could help), `scored`. A failed READ is `failed`, never
`unscored` — showing "Not scored yet" there invites the rep to spend an LLM call re-scoring a
pitch that is already scored and merely unreadable.

Contains `DisputeSheet`, which says in as many words that filing does not change the score, and
reports "Sent" only on a confirmed 200.

**`src/app/api/coach/sales-session/pitch-score/dispute/route.ts`** (new) — appends
`coach.pitch_score_disputed` and writes no points. The pitch read through the caller's client IS
the access gate (RLS scopes it to the rep or a manager), so no ownership rule is copied here to
drift from the policy. A failed read is a 500, not a 404: telling a rep their pitch does not exist
because the database was unreachable is a different and worse lie.

**`src/app/dashboard/sales-coach/[id]/page.tsx`** (modified) — three lines: an import, an optional
`sessionKind` on the local `Session` type, and a conditional render. The API already returned
`sessionKind`; only the local type omitted it. Gated on a finished, `sales` session so a huddle
never shows a button that 409s the person who presses it.

**Tests:** 21 detail render + 12 panel render + 15 dispute route.

## Caught during the build

`bg-brand-fill` — a token I invented. Tailwind does not define it, so the primary "Score this
pitch" button would have rendered with **no background at all**: yellow-on-white text on an
invisible button. Found by counting real usages rather than by it looking plausible —
`bg-ember-400` has 110 across the codebase, `bg-brand-fill` had 2 and both were mine. It is A19 in
a class name: it reads like this codebase's vocabulary and is not in it, and nothing but a human
eye or a usage count would have caught it.

## Not built

- **No manager-side dispute queue.** Disputes append events nobody reads yet. R1.
- **No audio player.** `onSeek` is threaded through but nothing passes it, so play chips render as
  plain timestamps. R2.
