# Session Interaction Flags — build closure + manifest (2026-07-09)

Founder feature: two flags on the Sales-Coach **Sessions** list — **"Needs
Manager/Admin Examination"** (a session whose prospect interaction went negatively)
and **"Outstanding Performance Review"** (a session that closed a deal with a positive
interaction). Each is clickable; clicking reveals the complete detailed explanation.
Determined from the system's current signals, not a new scoring model.

## Session-read manifest (§A19 / §A22)
Re-read IN FULL this session before/while building (not from cached labels):
- `CLAUDE.md` — via the system prompt (verbatim).
- `docs/amendments/AMD-006-system-and-user-flow-tracing.md` — read in full this session.
- `ThinkerThinker.md` — A11 / A16 / A18 / A23 / A24 / A25 + index, read this session.
- Storage/RLS grounding read this session: `summaryTypes.ts` (PivotMoment / SalesMoment
  shapes), `salesPivot.ts`, `salesMoments.ts`, `salesScore.ts` + `salesCoach.ts`
  (after_pitch_summaries is owner-only), `0080/0083/0084` coaching-visibility RLS,
  `list/route.ts`.

## Founder decisions (AskUserQuestion, 2026-07-09)
- **Examination trigger:** a negative interaction (lost pivot OR net-cooling sentiment),
  **any outcome** — a bad-but-closed call is examined anyway; a graceful no-sale isn't.
- **Examination visibility:** **managers/admins only** (a rep never sees it on their own
  session). **Outstanding:** visible to everyone (reinforcement).
- **Explanation:** **composed from existing analysis** (no new LLM).
- Derived (from the spec's own words): **Outstanding = sold AND positive interaction**;
  precedence = negative wins (a sold call that went badly is Examination, not Outstanding).

## The §A18 constraint (a spec-vs-framework tension resolved without asking — flagged)
"Use current system logic" naively points at the 7 after-pitch **scores**. But
`after_pitch_summaries` is **owner-only** (managers get null by RLS, 0080), so a
manager-facing flag derived from scores would **leak owner-private data to a manager**
— the exact misuse §A18 exists to prevent. This is not a genuine choice (the framework
forbids the alternative), so BOTH flags derive from **manager-visible signals only** —
outcome + pivot direction + timeline sentiment — never scores. The detail modal states
this to the reader. **If the founder actually intended scores to drive it, that changes
the privacy contract and needs an explicit decision.**

## §A18 scores-leak class — swept, clean (post-build audit, 2026-07-09)
The build turned on scores being owner-private. I then swept the whole class — every
admin-client (RLS-bypassing) reader of the owner-private tables (`after_pitch_summaries`,
`coaching_cue_outcomes`) and whether any manager-reachable path returns them raw:
- `after-pitch/route.ts` — gates via `forViewer(summary, isOwner)`: a non-owner gets
  `scores: []` (stripped); `isOwner` is true only when `auth.user.id === sessionAgentId`;
  a peer (neither owner nor manager) is denied. **Sound.**
- `summary-scores/route.ts` — owner-only, **403 to any non-owner** (even a company
  admin), generated on-demand so no manager-readable copy exists. **Sound.**
- `getSessionCueOutcomesAdmin` / `getRepWinningLines` — internal to after-pitch
  generation + live-cue grounding, agent-scoped; never returned raw to a manager. **Sound.**
No leak found. The scores-privacy contract holds on every path; this feature's
score-avoidance is consistent with it. Baseline for the next §1.7 audit.

## What was built (file by file)
- **`src/lib/coach/v5/sessionFlag.ts`** (new, pure, client-safe) —
  `classifySession()` (the rules above), `netSentimentFromMoments()` (per-moment tally),
  `extractSessionSignals()` (the storage→classifier seam: parses the pivot + moments
  event payloads defensively). No score field exists in the input type → structurally
  cannot be score-derived (§A18). Composes existing engines (§A16).
- **`src/lib/coach/v5/__tests__/sessionFlag.test.ts`** (new) — **15 tests**: the
  classifier rules incl. the precedence + graceful-no-sale cases; the sentiment tally;
  and the extractor against realistic PivotMoment/SalesMoment payloads (pins field names
  so a stored-shape drift fails here, not silently in prod).
- **`src/app/api/coach/sales-session/list/route.ts`** (edited) — a second bounded events
  query collects the pivot + moments payloads for the visible sessions; each row is
  classified via the tested pure functions; **Examination is manager-gated** in-route.
- **`src/app/dashboard/sales-coach/sessions/page.tsx`** (edited) — a clickable
  `FlagBadge` inside the row `<Link>` (preventDefault/stopPropagation), and a detail
  `Modal` (headline + composed reasons + the honest "not the rep's private scores" note).

## Clause → part mapping
- §0 / AMD-006 Layer 1-2: understood the signals + storage before building; foundation
  (pure classifier) built + tested first.
- §A16: composes pivot/moments engines; no fork of the scoring model.
- §A18: manager-facing flag uses only manager-visible signals; the modal discloses it.
- §3.3: rep never sees "needs examination" on their own call.
- §3.4: defensive parsing (no throw), honest modal note, no fabricated direction.
- §3.5: anchored to outcome + observed interaction, never "the AI's read was adopted."
- Layer 4: clear badge (amber/emerald semantic color), aria-labels, click-to-explain.

## Verified vs UNTESTED (honest)
- **Verified:** tsc 0, lint 0, `next build` 0, full suite **478 tests** (15 for this
  feature). The classifier + the storage→classifier extraction are unit-tested.
- **UNTESTED — needs the founder in a browser:**
  1. The badge actually renders on a real session row.
  2. Clicking it opens the modal with correct composed reasons.
  3. The flags classify real production sessions sensibly (I ran no real data).
  4. Manager-vs-rep visibility behaves live (rep does NOT see Examination on own session).

## Live-verification checklist
1. As a **manager**, open **Sales Coach → Sessions**. Find a session that has a
   generated **pivot + timeline** (Summary tab populated). Expect a badge if its pivot
   was lost / sentiment cooled (amber "Needs Examination") or it sold with a gained
   pivot / warming sentiment (emerald "Outstanding").
2. **Click the badge** → the modal should show the headline + the pivot reason +
   the cooling/warming moment, and the "not the rep's private scores" note.
3. As the **rep** (own sessions), confirm you do NOT see a "Needs Examination" badge on
   your own session; you DO see "Outstanding" on a strong one.
4. If **no badges appear at all**, tell me — likely the sessions lack generated
   pivot/moments, or a field name differs from the pinned shapes; I'll adjust.

## Scope held (not built, per §3.3 — spec as written)
- Flags are on the **Sessions list** only (where the founder pointed). NOT added to the
  session detail / After-Pitch pages — that would be scope beyond the request.
- Thresholds are the natural cut points (lost/cooling = negative; gained/warming =
  positive), not tuned knobs — a one-line change in `sessionFlag.ts` if you want
  stricter/looser.
