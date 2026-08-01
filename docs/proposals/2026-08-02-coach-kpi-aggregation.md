# Proposal — Fix the coach-KPI silent-truncation-at-1000 (server-side aggregation)

> Status: **PROPOSAL — not applied.** Founder trigger: `"fix the coach KPI aggregation"`.
> Author: autonomous session 2026-08-02. Respects §3.3 (propose, don't overtake) — this DESIGNS the
> fix for your approval; nothing here is shipped, because the corrected §3.5 metrics can't be verified
> against live data from here (staging run required — see section 6).

## 1. The problem (verified, not theoretical)

`supabase/config.toml:18 max_rows = 1000` — PostgREST caps every unbounded `.select()` at 1000 rows. The
coach KPI read routes compute cross-session aggregates **client-side** by bulk-loading child rows:

- `GET /api/coach/kpi/me` (`route.ts:126-128`) loads **all** `coaching_cues` + `coaching_cue_outcomes` +
  `coaching_transcript_segments` for the rep, via `.in("session_id", sessionIds)`, no limit.
- `GET /api/coach/kpi/team` (`route.ts:103`) — same, summed across the whole team.
- `GET /api/coach/sales-session/dashboard` — loads all sessions to count them + a cue count.

`coaching_transcript_segments` grows ~1 row per spoken utterance (~80/call). At ~5 calls/day the 1000-row
cap is hit in **~2-3 days of active use per rep** (faster for the team rollup). Past that, the loaded rows
are a **silently truncated subset**, so `coachedSessions` (the `Set` of session_ids with ≥1 segment),
`relianceReduction`, `cueAcceptanceRate`, and `cueToOutcome` are computed over partial data → **the §3.5
"training-wheels-come-off" numbers become quietly wrong, and `/me` vs `/team` diverge** (breaking the
cross-view consistency the code itself calls "the whole honesty thesis").

**Why a `.limit()` is NOT the fix:** the child tables are keyed by `session_id`, not `agent_id`. To
aggregate them you must first enumerate the rep's session_ids, then group the children by session. A
`.limit(1000)` on the segments select returns 1000 *arbitrary* segment rows → an **incomplete**
coached-sessions `Set` → the metric gets *more* wrong, not less. The fix must aggregate **server-side**.

## 2. What each metric actually needs, per session

Tracing `me/route.ts` + `lib/coach/kpi/compute.ts`, the only per-session facts the metrics need are three
integers (never the raw child rows):

| Fact | Source table | Used by |
|---|---|---|
| `segment_count` (or `has_segments`) | `coaching_transcript_segments` | `coachedSessions` (a session with ≥1 segment is "coach-active") |
| `cue_count` | `coaching_cues` | `relianceReduction` (cues-per-session over the timeline), `cueToOutcome` denominator |
| `acted_cue_count` | `coaching_cue_outcomes` where `determination in ('followed','partial')` | `cueAcceptanceRate`, `cueToOutcome` numerator |

If each `coaching_sessions` row carried these three counts, **every KPI read drops its child-table selects
entirely** and reads only the session rows (which `me`/`dashboard` already load).

## 3. Two options

### Option A (RECOMMENDED) — denormalized counters on `coaching_sessions`, trigger-maintained

Add three integer columns to `coaching_sessions` (`segment_count`, `cue_count`, `acted_cue_count`, default
0), maintained by `AFTER INSERT` (and for outcomes, `AFTER INSERT OR UPDATE`, since `determination` can
change) triggers on the three child tables, plus a one-time backfill for existing rows.

- **Read path becomes O(sessions), cap-immune for the child data:** the routes read `coaching_sessions`
  (already loaded in `me`/`dashboard`) and use `session.cue_count` etc. directly. No `.in("session_id", …)`
  child selects at all. `team` reads sessions for `memberIds` the same way.
- **Trigger cost:** each segment insert (~80/call) fires one `UPDATE coaching_sessions SET segment_count =
  segment_count + 1 WHERE id = NEW.session_id` — a single indexed-PK update, cheap. This is the standard
  denormalized-counter tradeoff: a small write cost to make the hot read correct + O(1).
- **Consistency:** counters are exact if every child insert goes through the DB (it does — appends are
  server-side). The backfill + a periodic reconcile (optional) covers any drift.

### Option B — an aggregate RPC (`coach_kpi_session_aggregates(p_session_ids uuid[])`)

A `SECURITY INVOKER` function doing `SELECT session_id, count(*) FILTER (…) … GROUP BY session_id` across
the three child tables for the passed session_ids, returning one row per session. No columns/triggers/backfill.

- **Downside:** still needs the session_ids enumerated client-side, and the `.in(array)` grows with session
  count; and the **sessions load itself** (`.eq("agent_id")`, no limit) still caps at 1000 (see section 4). Adds a
  round-trip per read. Simpler to ship, but it doesn't make the read path O(1) and leaves the sessions cap.

**Recommendation: Option A.** It's the pattern that scales, it fixes both `me`/`team`/`dashboard` and the
KPI cron (which shares the compute), and it removes the child-table selects rather than merely bounding them.

## 4. The secondary cap — >1000 SESSIONS per rep

Even with Option A, `me/route.ts:46` loads the rep's sessions with no limit → caps at 1000 sessions. A rep
with >1000 coached calls is far-future, but `relianceReduction` compares the *first* cue-bearing session to
recent ones, so we can't just take "recent 1000" without corrupting it. Options, in order of effort:
- (i) **Disclosed bound** now: detect `sessions.length === 1000` and surface a §3.4 `capped` flag (the
  existing `assetReadout` pattern) — honest until it matters.
- (ii) **Full DB-side metric** later: a function that computes the final metric numbers in SQL (not rows),
  so nothing is capped. Bigger — it reimplements parts of `compute.ts` in SQL — and belongs to a later phase.

Recommend (i) alongside Option A; (ii) is a future upgrade, not needed at pilot scale.

## 5. Migration + route sketch (Option A)

```sql
-- 02NN_coach_kpi_counters.sql  (number at apply time)
alter table coaching_sessions
  add column if not exists segment_count   integer not null default 0,
  add column if not exists cue_count       integer not null default 0,
  add column if not exists acted_cue_count integer not null default 0;

-- segment insert -> bump segment_count
create or replace function bump_session_segment_count() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update coaching_sessions set segment_count = segment_count + 1 where id = new.session_id;
  return new;
end $$;
create trigger trg_bump_segment_count after insert on coaching_transcript_segments
  for each row execute function bump_session_segment_count();

-- cue insert -> bump cue_count   (analogous fn/trigger on coaching_cues)
-- cue_outcome insert/update -> recompute acted_cue_count for the session
--   (count distinct cue_id where determination in ('followed','partial'); handle determination CHANGE)

-- one-time backfill
update coaching_sessions s set
  segment_count   = coalesce((select count(*) from coaching_transcript_segments t where t.session_id = s.id), 0),
  cue_count       = coalesce((select count(*) from coaching_cues c where c.session_id = s.id), 0),
  acted_cue_count = coalesce((select count(distinct o.cue_id) from coaching_cue_outcomes o
                              where o.session_id = s.id and o.determination in ('followed','partial')), 0);
```

Route change (`me`/`team`/`dashboard`): select the new columns with the session rows; delete the three
`.in("session_id", sessionIds)` child selects; derive `coachedSessions` from `segment_count > 0`,
`countBySession` from `cue_count`, `cueAcceptanceRate`/`cueToOutcome` from `acted_cue_count`. `compute.ts`
stays unchanged (it already takes plain counts).

## 6. Test + rollout plan (honesty gate)

1. Unit-test the three trigger functions on a fresh row (insert child → count increments; outcome
   determination change → acted_count adjusts; backfill matches a hand-counted fixture).
2. Add a route test per KPI route asserting the metric equals the pre-change client-side result **on a
   <1000-row fixture** (proves the refactor is behaviour-preserving) AND on a **>1000-child fixture** (proves
   the cap is gone — the exact regression this fixes).
3. **Staging run required before prod** — this recomputes the §3.5 honesty metrics; verify a real rep's
   `me` numbers are unchanged for a small account and correct for a large one. Per §3.4 (no instant results — honesty) I won't ship this
   blind. On approval I apply the migration via `npm run db:apply`, wire the routes, and run the full gate.

## 7. Blast radius

Read-path + additive schema only. New columns default 0 and are backfilled in the same migration; the
triggers are additive; `compute.ts` and the metric semantics are untouched. The KPI cron benefits for free
(same compute). No user-facing surface changes except more-correct numbers (and, with section 4(i), an honest
`capped` disclosure for >1000-session reps).
