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

## Post-ship proactive audit (§1.5.2, same session) — 8 fixes + added coverage
Applied the four-layer framework to the just-shipped feature AND adjacent surfaces;
found and fixed (each real, thought-through, not grep-noise):
1. **§3.3 [L2] Ask Coach looped** — stateless route derived "user shared thinking"
   only from the hypothesis box, so it re-asked "what do you think?" forever. Gave it
   conversation memory (client sends thread history; route builds a transcript +
   infers the flag from any prior user turn). Extracted `userHasSharedThinking` +
   `buildCoachUserMessage` as pure helpers, regression-locked.
2. **§3.4/§A16 [L2] control-gate suppression** — `generateCareReply` stays gated by
   the month-1 control unless `controlExempt`; the route didn't set it, so Ask Coach
   was silently suppressed for month-1 teams while the dissect engine (exempt) ran.
   Set `controlExempt:true` (external pasted data is orthogonal to the §3.4 baseline).
   Class-checked all LLM callers (§1.2): the split is consistent; no siblings.
3. **[L4] a11y** — labeled the icon-only Ask Coach send button.
4. **AMD-006 L3 / spec fidelity** — Ask Coach renders after ANY analyzed paste, not
   only when a problem is diagnosed (founder decision — "any questions pertaining to
   the context" is broader than a diagnosed problem). No-problem state → the coach,
   not a dead end.
5. **§A13 [L1] source-limit drift** — accept (20k) / analyze (16k) / ground (12k)
   were three different limits authored ad-hoc. Unified to one `MAX_SOURCE_CHARS`
   constant in a framework-agnostic module (client + server reference it). Now
   accept = analyze = ground = store.
6. **A21 [L3] Learning Mode parity** — the new surface had zero LearningHint wrappers
   while 54 peer pages integrate Learning Mode. Added 3 hints (header / problem /
   Ask Coach); provider coverage verified.
7. **§3.4 [L2] silent Save failure** — a failed save returned silently (button
   re-enabled, no error) — indistinguishable from "not saved yet". Added a visible,
   retryable error.
8. **§3.4 [L2] fabricated-suffix grounding hole** — evidence grounding used a 60-char
   PREFIX match, so a real opening + fabricated tail would render as a quote. Tightened
   to a whitespace-normalized FULL-substring match. Class-checked the sales-coach
   engines (§1.2): the hole was unique to this engine; siblings use sound grounding
   (segment-index ref, word-boundary regex).

**Added coverage:** engine tests (parser grounding, §3.3 branches, helpers) + a
data-layer DB-mock test (query shape, transform, and the server-derived owner/tenant
security property). **24 dissect tests total** (18 engine + 6 data-layer).

Final gate (whole session): tsc 0, lint 0, **407 tests**, `next build` 0. All pushed.

## Note on the constitutional-fidelity + self-audit passes
The Dissect prompts were audited from the source (§1.3 outside-view) and confirmed
§3.3/A11-faithful (diagnose the problem with evidence §3.2; hand the *solution* to the
user; angles are "directions to weigh, not instructions"). My own migration 0097 was
self-audited: A23-compliant (owner-private, append-only, tenant-key pinned) and it
follows the auto-grant convention (no missing table GRANT). The 0090/0091 guard's
fail-mode (block-list vs fail-closed allow-list) is surfaced for the founder's decision.
Still UNTESTED: migration 0097 application, live LLM quality, browser render.

Session-Reads timestamps: CLAUDE.md, ThinkerThinker.md (A1-A22), AMD-006 — all
re-read in the build session of 2026-07-07 immediately preceding this build.

## Post-build concurrency-class sweep (§1.2 pattern-detection, 2026-07-07)
Dissect's proactive audit surfaced a real bug the type-checker can't see: async
handlers applied fetch results with no staleness guard, so a Close / new-run / load
mid-flight let a stale response repopulate the reset workspace (dissection after
Close; coach reply into a cleared thread). Fixed with a `requestSeq` ref that Close +
each new request bump; every handler drops its result if superseded (98266db).

Per §1.2 ("detect patterns across incidents, not just the symptom"), swept the sibling
client surfaces that share the exact shape (async load whose result populates state a
switch/close/select action also resets):

| Surface | Verdict |
|---|---|
| `dashboard/dissect/page.tsx` | **Had the bug** — fixed, `requestSeq` guard (98266db) |
| `care/ConversationsApp.tsx` | Guarded (`latestDetailReqRef` + poll `cancelled`) but re-checked staleness only BEFORE the `json()` await, not after — **narrow residual parse-window** tightened (9d52c0c) |
| `sales-coach/[id]`, `chats/[id]`, `operations/[id]` | **Immune** — route-param detail pages; a switch is a route change → unmount → state cleared. No stale-write-into-live-view exists. |
| `dashboard/search/page.tsx` | **Already correct** — `cancelled` checked AFTER `json()`, before setState, with a 250 ms debounce + cancel-in-cleanup. Reference-quality. |

Boundary honesty: I did NOT sweep all 142 client components — the remaining ones are
forms, modals, and route-param pages without the switch-mid-load shape, so a blind
grep-sweep would be the mechanical pattern-matching §1.5.2 warns against, not genuine
audit. The class is closed across the surfaces that actually exhibit it. This table is
the concurrency baseline for the next §1.7 ground-up audit to compare against.

## Accessibility pass (WCAG 4.1.3) + one flagged sibling proposal (2026-07-07)
The Dissect page rendered its async result and its save/analyze errors with no
screen-reader announcement — a real barrier for SR users (WCAG 4.1.3 Status
Messages). Fixed on my own surface (536d9a3): a short sr-only `role="status"`
aria-live region announces the result STATE (not the whole result — that would
re-read summary+evidence+angles on every change); analyzeErr + saveErr are now
`role="alert"`. Matches the existing `LiveCoachingPanel.tsx:469` sr-only pattern.

**§1.2 sibling check → FLAGGED, not fixed (founder proposal):**
The C.A.R.E agent console message stream (`ConversationsApp.tsx:1678`, the
`ref={scrollRef}` div) has the SAME class of gap: new customer messages arrive via
polling with an audio chime but NO SR announcement (audio conveys arrival, not
content, and requires soundOn). An SR agent is under-served.

Recommended patch (NOT applied — see why below):
```
<div ref={scrollRef} role="log" aria-live="polite" aria-relevant="additions"
     aria-label="Conversation messages" className="...">
```
`aria-relevant="additions"` is load-bearing: without it, aria-live re-reads the
ENTIRE log on every 5 s poll update — worse than silence.

Why flagged, not fixed unprompted: (1) it's a complex production agent tool, not my
feature; (2) correct SR behavior (announce only NEW messages, no over-announcement)
is **not verifiable headless** — it needs a real screen reader; (3) per §1.5.2 the
audit surfaces adjacent concerns as proposals with a recommended path while the
founder retains authority, and per §3.3 the agent guides rather than overtakes. The
disciplined output for an unverifiable change to a non-owned production component is
a documented proposal, not a blind edit (the middleware-migration lesson applied to
UX). Apply the patch + test with a screen reader (NVDA/VoiceOver): open a
conversation, have a second browser send a customer message, confirm ONLY the new
message is announced.

## Migration-coupling resilience (§1.2 retrospective, ff25e44)
The Team Chat outage (2026-07-03) taught: migration-coupled code must distinguish
live-error from live-empty and never fail silently. The dissect store is coupled to
migration **0097, which is not yet applied** — so this code runs against a missing
table on every page load right now. Verified the feature already degrades (list → [],
analyze unaffected, save → visible error), then closed the diagnosability gap:
`listDissectTopics` was swallowing every error as `[]` (a real DB failure looked
identical to "no saved topics"). Now all three data functions log a real error with
its cause and name the "migration 0097 not applied" case specifically, while an
expected empty stays silent. **Founder-visible effect:** if you open Dissect before
applying 0097, the server log now tells you exactly that — no cryptic 500, no silent
empty. Locked by 2 tests (8 dissect-data total).
