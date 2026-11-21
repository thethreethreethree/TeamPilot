# 07 — Build order

Phases are ordered by dependency and by how early each shows something real. **No day estimates.**
Each phase ends in something you can open and look at. Every phase runs under BUILD-STARTER V6,
ELOSTATE's CLAUDE.md and the TBC protocol. Each phase gets its own `docs/tbc/<date>-rss-pN/` record,
and `npm run check` must be green before the next phase starts.

## Phase 0 — Foundations

1. Copy `src/lib/coach/remote/*` and `tests/*` into the repo (README-PLACEMENT). `npm run check` is green.
2. Apply `0271` via `npm run db:apply`.
3. `POST /api/team/set-manager` + a manager picker on the Team page.
4. **Looked at:** an admin sets managers for a real team, and the Team page shows the tree.
5. Re-score fix in `pitch-score/route.ts` + provenance + archive + audit row.
   **Looked at:** a rep's API re-score is refused with a 403 and a dispute hint; a manager re-score
   asks for a reason; the old version appears in the archive.
6. `ai_usage` writes in the `llmCall` chokepoint + vendor cost view.
   **Looked at:** the vendor cost view shows cost per session for yesterday, with "price missing"
   until prices are entered.
7. Sign-in route with `login_attempts` (lockout waits for D4).
8. **Switch existing policies to the tree, per company, once that company's managers are set**
   (`0252:239`, `0084:40`, 0259). Alert fan-out moves to `managerChain()`.
   **Looked at:** a manager sees only their team; the CEO still sees everyone (D2).

## Phase 1 — Remote capture

1. Before applying 0272, search the repo for every `context` comparison (`'in_person'`, `'video'`)
   and make sure each handles `'phone'`.
2. Apply `0272`. Phone as a channel in the start-session UI.
3. Required outcome sheet on close (`closeWithOutcome()`), phone/video only.
4. Stage chips. Closed failure reasons written by the pipeline and shown in words.
5. Upload limit from D16; `TOO_LARGE` shown; completion notice.
   **Looked at:** a phone call recorded, closed with "Follow up", then watched through every stage
   to Ready. A deliberately silent file shows "No speech heard".

## Phase 2 — Remote session page

1. Apply `0273`. Pipeline computes `session_interaction_stats` per transcript version. Backfill
   existing remote sessions through the existing backfill drain.
2. Player on the session page; talk-time lanes; speaker isolation.
3. Stat strip with the rep's own averages; transcript search + click-to-seek; comment mentions and
   visibility.
   **Looked at:** a real 20-minute call shows lanes that match what you hear.

## Phase 3 — Remote scoring

1. Apply `0274`. Scorer reads `rubric_config` through `rubricFor(channel)` instead of the
   hard-coded import. The door channel keeps today's rubric byte for byte (regression test: same
   score on the same transcript).
2. D6 caveat on remote score panels. N/A per element. Scoring floor (D5).
3. Keyword trackers: manager screen, hits computed on transcript land, chips on the session page.
   **Looked at:** a manager adds "Competitors: spectrum, xfinity"; the next call shows the hit at
   the right second.

## Phase 4 — Coaching loop

1. Apply `0275`. *Request feedback* button; listen events from the player.
2. Inbox columns and filters on Coach Assessment.
3. Coaching metrics page, which shows the D8 line until D8 is decided.
   **Looked at:** a rep requests feedback; the manager sees it in the inbox; the manager comments;
   the request shows closed.

## Phase 5 — Find and reuse

1. Read the live transcript table (0269) and add a full-text index on it in its own migration.
2. Apply `0276`. **Wire `rss_share_granted()` to `recording_share_events` (0260)**, then delete the
   raise.
3. Filters, saved searches, global search, snippets, library, CSV export, downloads.
   **Looked at:** search "contract" across the team; clip the best answer; add it to *Team
   examples*; a peer plays it only after the rep approved it.

## Phase 6 — Follow-through

Callback to-dos into Tasks · AI-suggested outcome beside the rep's · Ask Coach multi-turn with
citations · questions across sessions.
**Looked at:** a call where the customer says "call me Thursday" produces a Thursday task.

## Phase 7 — Training

Apply `0277`. Scenarios, assignments, due dates, practice follow-up chat. New
`manager_notifications` type in its own migration, after reading `0242:78`. Voice role-play only if D9 says so.
**Looked at:** a manager turns a real call into a scenario and assigns it; the rep sees it with a
due date.

## Phase 8 — Protection

Apply `0278`. Audit rows from every sensitive route · retention setting read by the purge cron ·
erasure job · trim with reprocess · redaction only if D15 says on.
**Looked at:** an erasure request for a phone number removes that customer's sessions, and the
audit log shows who asked.

## Phase 9 — Reach

Apply `0279`. Webhook sender · Google and Microsoft sign-in · CSV team import.
**Looked at:** a test endpoint receives a signed `session.scored`, and `verify()` accepts it.

## Gate between phases

- `npm run check` green (typecheck → lint → theme:audit → rls:audit → invariant:audit → tbc → test).
- Every new policy has its allowed and refused test, ported from `tests/sql/rls.test.ts` into the
  repo's own RLS audit or Vitest suite.
- The "Looked at" item done on a real device, at phone width.
