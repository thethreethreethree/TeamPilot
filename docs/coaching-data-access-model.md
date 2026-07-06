# Coaching data access model (Live Sales Coach)

Consolidated reference for who can read/write the coaching tables and *how* —
because the rules are spread across migrations `0070` (foundation), `0082`
(write hardening), `0083` (read hardening). Written 2026-07-06 during the RLS
hardening; keep in sync if the policies change.

Tables: `coaching_sessions`, `coaching_transcript_segments`, `coaching_cues`
(append-only; segments/cues have `no_update`/`no_delete` rules, §3.1).

## The one load-bearing fact

**Every APP write and every MANAGER read goes through the service-role client**
(`createServiceRoleClient` / `createAdminClient`), which **bypasses RLS**. RLS is
therefore NOT the app's access control — it is the **backstop against direct
PostgREST** (a browser using the public anon key + a logged-in user's JWT).
App-layer authorization lives in the routes; RLS stops the direct-API end-run.

## Writes

- App path: `createSession`, `appendTranscriptSegment`, `appendCue` — all
  **service-role** (bypass RLS). The realtime pipeline writes this way too.
- RLS (`0082`, direct-PostgREST backstop): **owner-scoped** — you may only
  create your OWN session (`agent_id = auth.uid()`) and only append
  segments/cues to a session you own. Closes the cross-agent write/pollution
  vector.

## Reads

- Rep self-view (dashboard, session list, own session detail): **user client**,
  scoped by `agent_id = auth.uid()` or by session id → RLS lets them see their
  own.
- Manager AGGREGATES (team-analytics): **service-role** + in-route manager gate;
  no individual raw data (counts only). After-pitch summaries for managers:
  `getLatestAfterPitchSummaryAdmin` — service-role, **strips private scores**.
- Individual session ops (dissect / review / ask-coach / after-pitch): **user
  client** via `getSession` / `getSessionTranscript`; rely on RLS for scoping and
  handle a null (blocked) read gracefully.
- RLS (`0083`, direct-PostgREST backstop + the user-client scoping above):
  **owner OR company-admin** — a rep reads only their own; a company admin
  (`role in ('CEO','COO','admin')`) reads any rep's, for oversight.

## The manager-set question (OPEN — founder deciding 2026-07-06)

`0083` uses the **literal** company-admin set: `role in ('CEO','COO','admin')`.
But `team-analytics` defines a "manager" more broadly as **company-admin OR
`sales_coach_role = 'admin'`**. Consequence of the literal choice:

> A Sales-Coach lead with `sales_coach_role='admin'` who is NOT a company admin
> can see team AGGREGATES (team-analytics is service-role) but **cannot** read an
> individual rep's session/transcript.

- **Keep literal** (CEO/COO/admin only see individuals) — tightest; a pure
  Sales-Coach lead is aggregate-only.
- **Widen to the product's manager set** — add `or p.sales_coach_role = 'admin'`
  to each admin subquery in `0083`, so "who sees aggregates" == "who can drill
  into an individual." More consistent with the product's existing manager
  concept; slightly broader read of personal data.

Recommendation: **widen** if Sales-Coach leads are expected to coach from
individual sessions (the aggregate-but-not-individual split is an odd manager
experience); **keep literal** if individual review is strictly a company-officer
function.

## Not personal → intentionally company-wide (not a gap)

The methodology **corpus** (`0074`) is company-scoped read on purpose — it's the
shared playbook the whole team is coached against, not personal data. Contrast
with per-agent data (sessions, after-pitch summaries, cue outcomes), which is
owner-scoped.
