# Understanding Gate — design rationale

> Encodes [CLAUDE.md §3.2](../CLAUDE.md) in the schema. The gate is structural, not
> discretionary. Application code may try to surface a problem; the database refuses
> if the threshold is not met.

## Why this exists

CLAUDE.md §3.2: *"A `problem` may NOT be surfaced to users until it links to a minimum
threshold of supporting `signals`. The schema itself must prevent half-understood problems
from reaching a human. The bottleneck is encoded, not left to discretion."*

The audit on 2026-05-16 found multiple existing surfaces in ELOSTATE that violate this
rule — pre-filled diagnoses on Operations/Finance/Marketing pages, instant `healthScore`
values, AI calls that return confident judgments after one prompt. Migration 0002 builds
the structural enforcement that closes that hole going forward. Migration 0001's tables
(`tasks`, `team_members`, `decisions`) remain as the demo surface; the new product
behavior is built on `signals` and `problems`.

## The chain (from CLAUDE.md §3.1)

```
events → signals → problems → resolutions → (new events)
```

Migration 0002 implements **signals → problems**. The `events` layer comes in a later
migration (it requires deciding how to retrofit the existing mutable tables, which is its
own diagnosis). The `resolutions` layer comes after that.

## What 0002 creates

| Table | Purpose | Mutability |
|---|---|---|
| `signals` | Append-only observation log. Each row is one observable thing: "task X marked Blocked at T", "meeting M overran by 23 min", "comment C went 4 days unanswered". | Append-only (UPDATE/DELETE blocked by rules) |
| `problems` | Diagnostic hypotheses about the company. Begin as `draft`. Cannot leave draft until the gate passes. | Mutable (status, diagnosis), but transitions are gated |
| `problem_signals` | Many-to-many linkage. The signals that support a problem. | Append-only |
| `problem_thresholds` | Per-`kind` configuration of the gate. Strict defaults; row keyed `'*'` is the global fallback. | Mutable by operators, **not** by application |

## The gate trigger

`check_understanding_gate()` fires before INSERT or UPDATE on `problems`. It refuses any
transition out of `draft` unless:

1. **≥ `min_signals` linked signals** (default: 3)
2. **≥ `min_distinct_sources` distinct `source` values among those signals** (default: 2)
3. **`diagnosis` length ≥ `min_diagnosis_chars`** (default: 80)

A problem may always be **dismissed** without meeting the gate — explicitly rejecting an
underdetermined draft is correct behavior, not a violation. Per Rule 1.1, dismissals are
assets and become part of the retrospective record.

## Default thresholds — and why

| Setting | Default | Reasoning |
|---|---|---|
| `min_signals` | **3** | One signal is anecdote. Two is coincidence. Three is the smallest count that can suggest a pattern without ambiguity. Loosening to 2 silently re-enables the "instant diagnosis" failure mode. |
| `min_distinct_sources` | **2** | Three signals from the same source can be noise from one process. Requiring two distinct sources forces *correlation*, which is what a real bottleneck shows. |
| `min_diagnosis_chars` | **80** | Long enough to force a full sentence stating the *why* (Rule 2). Short enough not to penalize concision. Catches one-word labels masquerading as diagnoses. |

These are tunable per `kind` by inserting a row into `problem_thresholds`. **Loosening
the global `'*'` default requires an amendment** to this document and a corresponding
incident in the record showing the strict default produced wrong behavior. (Rule 5: a
threshold weakened for builder convenience is a constitution violation.)

## What it does NOT do

- **Does not measure consequence.** That belongs to a later layer (§3.5). The gate ensures
  problems are *evidenced*, not that resolutions *worked*. Both are needed; this is the
  first half.
- **Does not derive signals from events.** Signals are inserted directly by the
  application for now. Once the events layer lands, signal derivation will be a
  triggered function over the event log.
- **Does not implement guide-don't-overtake.** The gate stops the System from asserting
  prematurely. It does not yet enforce that the System asks the user first (§3.3). That
  rewrite of the Decision Engine is a separate piece of work.

## Verifying the gate works (after applying)

After running the migration, this should fail:

```sql
-- Insert an empty draft, then try to surface it immediately.
insert into problems (company_id, kind, title, status)
  values ('<your-company-id>', 'demo', 'Test', 'surfaceable');
-- ERROR: Understanding Gate: problem ... needs >=3 signals, has 0
```

And this should succeed:

```sql
-- Create a draft with three signals from two distinct sources and a real diagnosis.
with p as (
  insert into problems (company_id, kind, title, diagnosis)
    values ('<your-company-id>', 'demo',
            'Payments cluster is degrading',
            'Three independent signals from two services indicate sustained latency on the checkout path; correlation with the post-deploy window suggests a regression introduced on 2026-05-12.')
    returning id
), s1 as (
  insert into signals (company_id, kind, source, payload)
    values ('<your-company-id>', 'latency_spike', 'service:checkout', '{}'::jsonb) returning id
), s2 as (
  insert into signals (company_id, kind, source, payload)
    values ('<your-company-id>', 'latency_spike', 'service:checkout', '{}'::jsonb) returning id
), s3 as (
  insert into signals (company_id, kind, source, payload)
    values ('<your-company-id>', 'error_burst', 'service:payments', '{}'::jsonb) returning id
)
insert into problem_signals (problem_id, signal_id)
  select p.id, sid from p, (select id as sid from s1 union all select id from s2 union all select id from s3) x;

-- Now this should pass:
update problems set status = 'surfaceable' where kind = 'demo';
```

## Applying the migration

Run [`supabase/migrations/0002_understanding_gate.sql`](../supabase/migrations/0002_understanding_gate.sql)
in the Supabase SQL Editor on the same project that ran 0001. Idempotent: re-running
overwrites the trigger function and recreates the default-threshold row only if absent.
