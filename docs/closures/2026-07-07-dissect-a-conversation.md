# Dissect a Conversation — build closure + session-read manifest (2026-07-07)

Founder feature request: a new main-dashboard surface where a user pastes any
conversation; the System summarizes it, dissects the PROBLEM inside it (problem-
solving lens, not sales), and offers Ask Coach to work the problem out. Per-chat /
ephemeral; Save the topic persists it; Close discards an unsaved one.

## Session-read manifest (§A19/§A22)
Re-read IN FULL this session, before building (not from cached labels):
- `CLAUDE.md` — via system prompt + mirrored in `ThinkerThinker.md:1-203`.
- `ThinkerThinker.md` — full asset library A1-A22 (lines 1-762) read this session.
- `docs/amendments/AMD-006-...md` — read in full this session.

## Founder decisions (AskUserQuestion, this session)
- Close: **delete unsaved, keep saved** — unsaved thread is client-only (no DB
  row → discarding it is not a §3.1 delete); a saved topic persists.
- Save target: **standalone saved dissection** — its own owner-private list, NOT
  the §3.1 problem chain.

## Built, file by file (which clause each part satisfies)
- `supabase/migrations/0097_dissect_topics.sql` — owner-private saved-topics table.
  RLS: select `user_id=auth.uid()`; insert WITH CHECK `user_id=auth.uid() AND
  company_id=auth_company_id()` (the 0090-0095 tenant-key hardening). No
  update/delete policy — a saved dissection is append-only (§3.1); standalone,
  not the problem chain (founder decision). **UNTESTED against a live DB — founder
  must apply; the feature's save/list/load path is non-functional until applied.**
- `src/lib/dissect/engine.ts` — summarize + dissect engine (§1.2 retrospective,
  §1.3 outside-view, §0 root-cause, §3.2 evidence). Diagnostic, NOT prescriptive
  (§3.3/A11 — angles-to-consider + a guiding question, never "do X"). Composes on
  the existing `dissectCoachV5` LLM path (§A16). `parseConversationDissect` drops
  any evidence excerpt not present in the pasted text (§1.2/§3.4 — no fabricated
  quotes) and returns EMPTY on thin input (§3.4 honest degrade). `askCoachSystemPrompt`
  encodes §3.3: asks the user's view first when they haven't shared it, builds on
  it when they have.
- `src/lib/data/dissect.ts` — save/list/get; user client (RLS), company_id/user_id
  server-derived (never body-supplied). Append-only (no update/delete).
- `src/app/api/dissect/analyze/route.ts` — POST, ephemeral summarize+dissect.
  Auth + rate-limited + zod-validated.
- `src/app/api/dissect/ask-coach/route.ts` — POST, §3.3 coach reply via
  `generateCareReply` (§A16, same path Sales Coach ask-coach uses).
- `src/app/api/dissect/topics/route.ts` — GET list / POST save (owner-private).
- `src/app/api/dissect/topics/[id]/route.ts` — GET one (RLS → 404 cross-user).
- `src/app/dashboard/dissect/page.tsx` — the surface. Workflow continuity (AMD-006
  L3): paste → Dissect → obvious next actions (Ask Coach + Save) present; Close
  returns a clean slate; saved list reloads. Honest §3.4 empty state when no
  problem is found. §3.3 UI: invites "how would YOU solve it?" before the coach
  asserts. Brand tokens (ember/emerald, surface/default) — L4.
- `src/components/layout/Sidebar.tsx` + `CommandPalette.tsx` — nav entry (A21
  cross-surface parity; discoverable in sidebar AND ⌘K).
- `src/lib/dissect/__tests__/engine.test.ts` — 8 tests: parser grounding (drops
  hallucinated excerpts), no-problem⇒no-signal, caps, and the §3.3 prompt branches.

## Verification (honest)
- **Verified:** typecheck 0, lint 0, full suite 397 pass (8 new), `next build`
  exit 0 with all 5 routes registered. Parser grounding + §3.3 prompt logic unit-
  tested and passing.
- **UNTESTED:** (1) migration 0097 not applied to any DB — save/list/load is
  non-functional until the founder applies it. (2) The LLM output quality of the
  dissect + coach prompts (whether the model returns the JSON shape and useful
  diagnoses) is untested — no live model call was made. (3) The rendered UI has
  NOT been eyeball-verified in a browser (§A14 — data path typechecks, render path
  unconfirmed by a human). (4) End-to-end flow (paste→dissect→ask→save→load) is
  untested live.

## Deviations from request (surfaced, per protocol)
- None in substance. Two defaults I stated and held (not silent): Ask Coach is a
  §3.3-correct Q&A thread on THIS surface, not the full CoachPanelV5 component
  reused verbatim (A21 — flagged as a possible follow-up, not claimed as parity);
  saved dissections are owner-private. Founder can override either.

## Post-ship proactive audit (§1.5.2, same session) — 4 fixes
Applied the four-layer framework to the just-shipped feature AND adjacent surfaces;
found and fixed:
1. **§3.3 [layer 2] Ask Coach looped** — the route was stateless and derived
   "user shared their thinking" only from the hypothesis box, so it re-asked "what
   do you think?" forever. Gave it conversation memory (client sends thread
   history; route builds a transcript + infers the flag from any prior user turn).
   Extracted `userHasSharedThinking` as a pure helper + 4 regression tests (12 total).
2. **§3.4/§A16 [layer 2] control-gate suppression** — `generateCareReply` stays
   gated by the month-1 control unless `controlExempt`; the route didn't set it, so
   Ask Coach was silently suppressed for month-1 teams while the dissect engine
   (exempt) ran. Set `controlExempt:true` — Dissect works on external pasted data,
   orthogonal to the §3.4 baseline. Class-checked all LLM callers (§1.2): the split
   is consistent (team's-own-work gated; user-initiated tools day-1); no siblings.
3. **[layer 4] a11y** — labeled the icon-only Ask Coach send button.
4. **AMD-006 L3 / spec fidelity** — Ask Coach now renders after ANY analyzed paste,
   not only when a problem is diagnosed (founder decision — the spec's "any questions
   pertaining to the context" is broader than a diagnosed problem). No-problem state
   points to the coach instead of a dead end.

Gate after all fixes: tsc 0, lint 0, 401 tests (12 dissect), `next build` 0.
Still UNTESTED: migration 0097 application, live LLM quality, browser render.

Session-Reads timestamps: CLAUDE.md, ThinkerThinker.md (A1-A22), AMD-006 — all
re-read in the build session of 2026-07-07 immediately preceding this build.
