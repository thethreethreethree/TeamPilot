# AMD-002 — Ratify Understanding Gate default thresholds

- **Status:** ratified
- **Date:** 2026-05-16
- **Proposed by:** founder directive ("Ratify as written")
- **Affects:** `supabase/migrations/0002_understanding_gate.sql` (default row in `problem_thresholds`); [docs/UNDERSTANDING_GATE.md](../UNDERSTANDING_GATE.md)

---

## Trigger

Structural-gap amendment. The Understanding Gate schema (CLAUDE.md §3.2) requires a
minimum signal threshold, but the constitution leaves the specific values open. Setting
the default is a one-time decision that must be made before the gate becomes operational
on any production data; making it informally would violate §7.4 (no edits to operative
configuration without an amendment).

## Diagnosis

The Gate is enforced by `problem_thresholds`. Without explicit defaults, the System has
no operational rule, and the gate is structurally present but semantically empty.
Operational law without a value is not law — it is a placeholder that the next builder
under pressure will fill arbitrarily. Per Rule 5, that is the failure mode this amendment
exists to close.

## Ripple-trace

- **CLAUDE.md §3.2 (Understanding Gate is structural, not optional).** Defaults make the
  schema-level enforcement concrete. No contradiction.
- **CLAUDE.md §5 ("biggest risk is the builder under pressure").** Strict-by-default
  satisfies §5: looser defaults are easy to ratchet *into* but hard to ratchet *out of*.
- **CLAUDE.md §7.5 (distrust of evolution).** This amendment is itself eligible for a
  counter-amendment once operational data shows the defaults produce worse outcomes than
  an alternative. Defaults are not permanent.
- **No other section is affected.**

## Alternative-test

Three defended values:

| Setting | Default | Tested against |
|---|---|---|
| `min_signals` | **3** | 2 (re-enables instant-diagnosis failure); 5 (gate becomes the bottleneck during bootstrap) |
| `min_distinct_sources` | **2** | 1 (single-source noise reads as pattern); 3 (cross-source friction never surfaces in small teams) |
| `min_diagnosis_chars` | **80** | 0 (one-word labels surface as diagnoses); 120 (pads fluent vagueness rather than catching it) |

Structural-gap caveat: no operational record yet exists in this project to test against.
The defended values are reasoned, not observed. AMD-002 self-flags as eligible for
revision via counter-amendment once real signal volume and surface-attempt data has
accumulated.

## Outside-view check

Read with no stake in adopting it:

- Does it loosen anything under builder pressure? **No** — these are the strictest values
  short of refusing all surfaces.
- Does it create a back-door? **No** — looser per-`kind` overrides require inserting a
  row, which is an explicit operator action and (per §5) should itself trigger an
  amendment review when applied to a production project.
- Is `min_diagnosis_chars = 80` a soft check that an adversarial agent can defeat? **Yes**
  — explicitly acknowledged in the rationale doc. It is a floor, not a guarantee. A
  future amendment may replace it with a semantic check.

Passes with a known weakness flagged.

## Proposed change

No CLAUDE.md text changes. `supabase/migrations/0002_understanding_gate.sql` is the
artifact of this amendment; its `problem_thresholds` default row encodes the ratified
values.

## Decision

**Ratified** — founder directive + soundness gate passed.

## Status Update — 2026-05-16

Ratified. Migration 0002 is marked ready to apply. Apply on Supabase after running 0001.
