# Pitch Score + Pattern Interrupt — Go-Live Checklist

The 2026-09-19 coaching upgrade (Projects 1, 2 and 5) is **built and gate-verified**, and as of the
2026-09-22 deploy the code is on `main`. This doc is the §1.5.3 record of the **external
preconditions the repo cannot hold**.

Unlike Meeting Coach, this feature is **not gated off by a flag**. It is gated by the database:
until the migrations below are applied, the tables do not exist and every Pitch Score surface shows
its failure state. That is deliberate and A34-safe — see "What happens before the migrations" — but
it means the deploy is only half done until step 1 is run.

## Preconditions (blocking — founder)

### 1. Apply migrations 0250–0258

```
npm run db:dry      # list what is pending — pure read, writes nothing
npm run db:apply    # apply each in its own transaction, recording the ledger
npm run db:verify
```

⚠ Use `npm run db:apply` — never hand-apply. A hand-applied migration is off-ledger drift, and the
next apply fails on it (this happened with 0238 and had to be reconciled by hand).

Nine pending as of 2026-09-22, all additive or policy-only:

| migration | what it does |
|---|---|
| `0250_rep_daily_sales_goal_rep_company_check` | **RLS tightening.** The manager insert/update policies gain a check that the target `rep_id` belongs to the writer's company. Closes a cross-tenant write. |
| `0251_care_agent_state_agent_company_check` | **RLS tightening**, same shape, for `care_agent_state.agent_id`. |
| `0252_pitch_score_system` | `rubric_config`, `pitch_scores`, `pitch_score_elements`, `pitch_score_events` + the `is_sales_coach_manager()` predicate and RLS. |
| `0253_store_pitch_score_rpc` | `store_pitch_score` — the service-role write path. Scores are never written by a client. |
| `0254_pitch_score_verdicts` | `section_points` on `pitch_scores`, so section totals are a stored verdict rather than recomputed on read. |
| `0255_pitch_score_overrides` | `pitch_score_overrides` — the append-only manager-correction log. |
| `0256_apply_pitch_score_override` | `apply_pitch_score_override`, which does no arithmetic of its own. |
| `0257_notify_pitch_score_corrected` | the `pitch_score_corrected` notification type. |
| `0258_pattern_interrupt` | `patterns` + `pattern_events` (Pattern Interrupt storage). |

**On 0250 / 0251.** These are the only two that change behaviour on an existing surface. They are
RLS *policies*, not table CHECK constraints, so they do **not** validate existing rows and cannot
fail on live data — but any future write that violates them starts failing, loudly, with a policy
error. That is the intent: the old policies allowed setting a goal for, or state on, someone in
another company. Founder decision 2026-09-22: apply them.

### 2. Score a pitch, so the boards have something to show

Nothing backfills. `pitch_score_elements` starts empty, which means:

- **Pitch Score boards** show a period with no counted pitches.
- **Pattern Interrupt** shows *"Nothing has been scored yet"* — not *"no patterns"*. The two are
  different facts and the board says which one it means.

Detection runs automatically from the first pitch scored after the migrations land (it is hooked
into `/api/coach/sales-session/pitch-score` after the score is stored). A pattern opens at **3
misses in the last 10 applicable pitches**, so a rep needs at least three scored pitches where the
same element was graded before anything appears. This is not a bug to chase on day one.

## What happens BEFORE the migrations are applied

Recorded because "it looks broken" and "it is broken" need telling apart, and because this is the
A34 window the code was written for:

| surface | behaviour pre-migration |
|---|---|
| Scoring a pitch | **Works, then fails to store.** `store_pitch_score` does not exist, so the route returns "The score could not be saved." |
| Pattern detection | **Silent and harmless.** `runDetection` catches the missing-table error, logs it with the rep and company id, and returns. Scoring is never failed because of it. |
| Pattern Interrupt board | *"Patterns could not be loaded — this is a failure to read them, not a finding that there are none."* With a retry button. It never renders as an empty board, because on this screen an empty board reads as praise. |
| Breakdown / leaderboard / milestones | 500 from their routes; the surfaces show their own failure states, not zeros. |

Nothing shows a confident zero. That was the design constraint.

## Verify after applying

```sql
-- the five tables exist
select table_name from information_schema.tables
 where table_schema = 'public'
   and table_name in ('pitch_scores','pitch_score_elements','pitch_score_events','patterns','pattern_events');

-- the six pattern_events kinds, verbatim from the build guide
select pg_get_constraintdef(oid) from pg_constraint where conname like 'pattern_events_kind%';
-- expect: coached, drill_assigned, note, rep_reviewed, clip_disputed, fixed

-- one OPEN pattern per rep per item (the partial index detection relies on for idempotency)
select indexdef from pg_indexes where indexname = 'patterns_open_unique';
-- expect: ... WHERE (fixed_at IS NULL)
```

Then, in the product: open **Pattern Interrupt** as a manager. Before any pitch is scored it should
read "Nothing has been scored yet". If it reads "Patterns could not be loaded", the migrations did
not apply.

## Still open (not blocking)

- ~~**Rep progress tab**~~ — **built 2026-09-22.** Five team cards, the needs-attention rep list,
  the pattern timeline with its Ⓒ Ⓓ Ⓡ markers, the "Where each pattern stands" table and the
  check-in agenda.
- **No `pattern_events` row is written by a human yet.** `coached`, `drill_assigned` and `fixed`
  are valid kinds with no writer, so the manager actions on the Patterns mockup — Mark as coached,
  Assign Role Play drill, Add note — do not exist. Consequence, and it is visible rather than
  hidden: the Rep progress timeline draws bars with **no markers**, LAST COACHING reads "Not
  coached yet" everywhere, and "Rep reviewed" reads 0 of N. Every derivation handles it; the board
  simply looks emptier than the mockup until those three actions ship. **This is the largest
  remaining gap in Project 5.**
- ~~**Clips**~~ — the recording player shipped 2026-09-22 (Project 4). "Open clips" on the agenda
  reaches the Recordings tab, where every pattern moment is already a marker.
- **Training, Team, One Liners** have no nav entry after the 2026-09-22 "follow the boards
  literally" ruling. Training is the live team-brief generator; its guide-sanctioned replacement,
  Coach Assessment's "What the team needs to work on" card, **is now built**, so the brief is
  reachable through it. Team and One Liners are still URL-only.
- **No surface has been rendered in a browser** by the agent that built it. Every UI claim in the
  build record is from jsdom tests and from reading the 2026-09-19 boards.
