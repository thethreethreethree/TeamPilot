# Closure — Pivot Moment + private scores on the summary surfaces (2026-07-07)

Founder request (two messages): add, **at the end of** the **Summarize** panel and
the **Conversation summary** card, (A) a **Pivot Moment** — "when the agent gained
OR lost the prospect's interest/trust/potential sale" — and (B) **scoring mechanics
similar to After Pitch**. Same logic and structure for both surfaces. Built under
the founder's explicit ordered process (quote clauses → state understanding →
surface ambiguities + ask → build). Decisions taken by the founder via AskUser
Question: **(1)** bidirectional single pivot (new focused engine), **(2)** scores
stay **owner-private** (stripped for managers, §A18), **(3)** compose inline.

## Session-read manifest (§A22)

All read from the working tree this session (2026-07-07), not cached labels:

- `CLAUDE.md` — in session context via project-instructions (governs §0, §1.5, §3.3, §3.4, §3.5, §3.6).
- `ThinkerThinker.md` — re-read IN FULL this session, A1–A22 (esp. A11, A13, A16, A18, A20, A21, A22).
- `docs/amendments/AMD-006-system-and-user-flow-tracing.md` — re-read IN FULL (parent + all three addenda: four-layer framework, §1.5.2 proactive rule).
- `src/lib/coach/v5/salesSummary.ts`, `salesScore.ts`, `salesMoments.ts`, `salesMomentsPrompt.ts`, `afterPitch.ts`, `salesReviewPrompt.ts` — the existing engines (understood before reusing/composing, §A21).
- `src/app/api/coach/sales-session/[id]/summarize/route.ts`, `finalize/route.ts`, `attribute/route.ts` — the routes wired.
- `src/app/dashboard/sales-coach/[id]/page.tsx`, `src/components/sales-coach/SessionCoachTools.tsx` — the two surfaces.
- `supabase/migrations/0084_coaching_select_include_manager.sql` — confirmed the session page is manager-visible (the §A18 constraint's source).

## What was built (file by file)

**New engine (bidirectional pivot):**
- `src/lib/coach/v5/salesPivotPrompt.ts` — system+user prompt. Asks for THE single
  turning point + a DIRECTION (gained/lost). Reuses the shared `methodologyBlock`.
  §3.4 honesty rules (no fabricated stats; grounded quotes; empty on thin/unclear).
- `src/lib/coach/v5/salesPivot.ts` — `generateSalesPivot` + `parsePivot` (grounding
  invariants: atSeq must be a real segment; direction ∈ {gained,lost}; explanation
  required or dropped, §A11; timestamp only from real spoken_at). `runAndStorePivot`
  persists an append-only `coach.session_pivot_generated` event (§3.1), mirroring
  `runAndStoreSummary`.
- `src/lib/coach/v5/__tests__/salesPivot.test.ts` — 8 tests pinning the invariants.

**Scores (reused engine, owner-private endpoint):**
- `src/app/api/coach/sales-session/[id]/summary-scores/route.ts` — NEW owner-only
  endpoint. Reuses `generateSalesScores` (the exact 5 After-Pitch categories, §A21).
  **§A18 gate:** returns 403 unless `session.agentId === caller` — a manager who can
  VIEW the session (0084 RLS) still cannot read its scores. Generated on demand, not
  persisted anywhere manager-readable.

**Wiring:**
- `.../summarize/route.ts` — POST now composes summary + pivot concurrently
  (returns `{summary, pivot}`); GET reads back both from `events`.
- `.../finalize/route.ts` — added `runAndStorePivot` to the parallel post-call
  generation so the pivot appears on the Conversation summary the moment a call
  ends (§1.5.1 continuity), not only after a manual re-summarize.

**UI (one shared component, §A13/§A21):**
- `src/components/sales-coach/PivotAndScores.tsx` — NEW. Renders the pivot card
  (green=gained / amber=lost) + the owner-private scores strip with an expandable
  "Score assessment review". Fetches scores via the owner-only endpoint through a
  module-level per-session cache (both on-page instances share ONE fetch). On 403
  (manager) the scores section renders nothing.
- `SessionCoachTools.tsx` (Summarize panel) + `sales-coach/[id]/page.tsx`
  (Conversation summary card) — both render `<PivotAndScores>` at the end.

## Framework mapping

- **§0 / §0.1** — understanding earned first: mapped all existing engines before
  writing; framework docs verified in-tree and re-read this session.
- **AMD-006 four layers** — L1 (structure): reused engines, one small new engine,
  no schema migration. L2 (effectivity): bidirectional pivot delivers the "gained
  or lost" spec the existing negative-only breakdown could not. L3 (composition):
  composes with the existing After-Pitch engines (§A16, does not fork); pivot on
  both surfaces + finalize for continuity. L4 (UI): matches the existing amber/score
  visual language + "private to you" label.
- **§A11** — the factual summary generator is UNCHANGED (still facts-only). The
  pivot is a grounded observation (not a grade); scores carry the "a mirror of this
  call, not a ranking" framing. No naked verdicts (parse drops unexplained pivots).
- **§A18** — scores owner-only at the endpoint (403 for managers) AND the component
  renders nothing for non-owners. The label is "Your scores · Private to you".
- **§A13/§A21** — one sanitized/shared component + reused score engine; the pivot is
  a distinct NEW concept (different name/shape), not a same-name fork.

## Verified

- `npm run check` (typecheck + lint + theme:audit + rls:audit + tests): **350 passed
  / 9 skipped**, including the 8 new pivot tests.
- `npm run build`: **clean**.
- §A14 render branches (read-verified): pivot gained/lost/null; scores
  loading/forbidden/error/empty/present; rationale expand/collapse; both placements.
- §A18 owner gate (read-verified from source): `getSession` (RLS) returns the
  session to a manager, then the `agentId !== caller` check 403s them; a different
  company → 404.

## UNTESTED (honest, per the founder's terms)

- **LLM output quality** — no live model call was run. Whether the pivot engine
  picks the right single moment + correct direction, and whether the scores read
  well, is UNTESTED. The parse/grounding logic is unit-tested; the model's judgment
  is not.
- **End-to-end UI render in the browser** — not run; I verified compile + types +
  read the JSX branches, but did not view the rendered surfaces. UNTESTED.
- **A18 live behavior** — the owner/manager gate is verified by reading the code and
  the RLS policy; it was not exercised with two real accounts. UNTESTED live.
- **finalize producing the pivot on a real Stop** — UNTESTED live.

## Notes / recommendations (§A20 — surfaced, not silently decided)

- Both surfaces are on the SAME session page, so the pivot + scores now appear
  **twice** on that page (once in the Conversation summary card, once in the
  Summarize panel after it's run) — exactly as requested for both, but visually
  redundant on one screen. Recommend: if you'd rather show them once, keep them in
  the Conversation summary card and drop from the Summarize panel. Your call.
- **Cost/latency ripple:** POST /summarize now makes 2 LLM calls (summary + pivot);
  finalize makes 3 (dissect + summary + pivot); the owner viewing a summary surface
  triggers 1 score-generation call (cached per session). Consistent with the
  After-Pitch page's auto-generate profile, but worth knowing.
- **Pivot vs breakdown** — the summary "Pivot Moment" (bidirectional) and the
  After-Pitch "breakdown" (negative-only, part of the timeline) are related but
  distinct by design. If they ever read as the same feature to users, consider
  unifying (§A21); for now they are deliberately different per your spec.
