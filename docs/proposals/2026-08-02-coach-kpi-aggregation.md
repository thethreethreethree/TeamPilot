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

-- segment insert -> bump segment_count.
-- NOTE (verified 2026-08-02): segment_count is consumed ONLY as `segment_count > 0` (coachedSessions =
-- "session produced ≥1 segment"). It is a PRESENCE signal, not a quantity anyone reads. Two consequences:
--   (a) You could equally use a `has_segments boolean` and set it true on first insert — arguably the more
--       honest primitive for what's consumed, and immune to the drift below. Either is fine; count is kept
--       here only because the backfill query already computes it.
--   (b) DEDUP INTERACTION — apply-order matters. The sibling proposal 2026-08-01-transcript-dedup-cleanup
--       DROPS the segments no-delete rule and DELETEs 128 duplicate rows. This trigger is AFTER INSERT only
--       (no DELETE trigger, since the table normally forbids delete), so a dedup run AFTER counters exist
--       would leave segment_count inflated by the removed dups. Harmless for the `> 0` consumer, but to keep
--       the number honest: run the transcript-dedup migration FIRST, then this one's backfill (which counts
--       the post-dedup rows). If you pick `has_segments boolean`, ordering is irrelevant.
create or replace function bump_session_segment_count() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  update coaching_sessions set segment_count = segment_count + 1 where id = new.session_id;
  return new;
end $$;
create trigger trg_bump_segment_count after insert on coaching_transcript_segments
  for each row execute function bump_session_segment_count();

-- cue insert -> bump cue_count. SAFE as an incremental +1: coaching_cues is append-only
--   (0070/0073 no-update + no-delete rules), and cue_count is a plain total (no DISTINCT), so
--   the +1-per-insert counter can never drift. Same shape as bump_session_segment_count above.

-- acted_cue_count -> MUST RECOMPUTE, NOT increment. CRITICAL (verified 2026-08-02):
--   coaching_cue_outcomes has an index on (cue_id, created_at desc), NOT a unique(cue_id) — a cue can have
--   MULTIPLE outcome rows — and determination is mutable (this proposal's own Option-A note). The metric is
--   count(DISTINCT cue_id ... in ('followed','partial')). A +1-per-insert counter would DOUBLE-COUNT a cue
--   with two 'followed' outcomes and mishandle a determination flip (followed->ignored should decrement) —
--   i.e. it would re-introduce the exact metric corruption this whole migration exists to remove. So the
--   trigger recomputes the session's distinct count from scratch (cheap — outcomes-per-session is small):
create or replace function recompute_session_acted_cue_count() returns trigger
  language plpgsql security definer set search_path = public as $$
declare v_session uuid := coalesce(new.session_id, old.session_id);
begin
  update coaching_sessions s
     set acted_cue_count = (
       select count(distinct o.cue_id) from coaching_cue_outcomes o
        where o.session_id = v_session and o.determination in ('followed','partial'))
   where s.id = v_session;
  return null; -- AFTER trigger
end $$;
create trigger trg_recompute_acted_cue_count
  after insert or update or delete on coaching_cue_outcomes
  for each row execute function recompute_session_acted_cue_count();

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

1. Unit-test the three trigger functions on a fresh row (insert child → count increments; backfill matches a
   hand-counted fixture). **Must-have case for `acted_cue_count` (the recompute trigger, where the subtle bug
   lives):** one cue with TWO 'followed' outcome rows must count as 1, not 2 (proves DISTINCT holds); a
   determination flip 'followed'→'ignored' must DECREMENT; a flip back must re-increment; deleting an outcome
   recomputes. A naive +1 counter passes the single-insert test and FAILS all four — so these are the tests
   that actually protect the metric.
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
