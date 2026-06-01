# Diagnosis Engine — the constitution as runtime

> Implements [CLAUDE.md §1 (Living Diagnosis)](../CLAUDE.md). The discipline that
> governs how this codebase is built also operates *as a tool* on the user's data.
> The product does not merely *enforce* the rules — it *runs* them.

---

## What this is

Up to this point the constitution governed two things:
1. How Claude + the builder operate (the agent's behavior).
2. The schema (events, signals, problems, the Understanding Gate trigger).

This module closes the third piece: the **runtime** that walks through the Living
Diagnosis loop on real data, step by step, refusing to advance until each step's
prerequisite is met.

The chain in §3.1 — `events → signals → problems → resolutions → (new events)` — is
now executable. Migration 0005 added the resolutions table and the SQL
`close_problem()` function that closes the loop atomically.

---

## The seven steps

| Step | Section | What it does | Refuses to advance when |
|---|---|---|---|
| **data** | §1.1 | Assemble the record (signals, events) | Never refuses — empty is a valid state |
| **retrospective** | §1.2 | Find patterns across the record (≥3 occurrences) | Never refuses — empty output is a valid signal in itself |
| **outsideView** | §1.3 | Generate alternative readings via Claude | No current read AND no retrospective patterns — nothing to challenge |
| **gate** | §3.2 | Evaluate the Understanding Gate on a hypothesis | No hypothesis stated — gate cannot evaluate silence |
| **rippleTrace** | §1.5 | Trace what else a candidate action affects | Gate has not passed — ripple-tracing an unearned problem is motion without understanding |
| **decide** | §3.3 | User commits to a candidate (or defers) | No ripple-traced candidate exists |
| **close** | §1.6 | Persist resolution, mark problem resolved, emit new event | No choice committed |

Each refusal is informational, not failure. The right-column "Engine state" panel
in [/dashboard/diagnose](../src/app/dashboard/diagnose/page.tsx) shows the exact
reason the engine holds — so the user can see *what is missing*, not "the system
errored."

---

## Module structure

```
src/lib/diagnosis/
  types.ts              # Step types + DiagnosisRun shape
  retrospective.ts      # Pattern detection (pure function, no Claude)
  outsideView.ts        # Alternative-perspective generation (Claude)
  understandingGate.ts  # Client-side mirror of the DB trigger
  rippleTrace.ts        # Holistic affected-systems analysis (Claude)
  closeLoop.ts          # Resolution recorder (calls SQL close_problem)
  index.ts              # Orchestrator: canAdvance() + re-exports

src/app/api/diagnosis/
  outside-view/route.ts # POST — generate outside views (400 if no currentRead)
  ripple-trace/route.ts # POST — trace ripples (400 if no diagnosis or action)
  close/route.ts        # POST — persist resolution (400 if no reasoning)

src/app/dashboard/diagnose/page.tsx
                        # The runtime surface — walks the loop step by step

supabase/migrations/
  0005_resolutions_and_derivation.sql
                        # resolutions table + signal_sources + derive_signals_for_event
                        # + close_problem (atomic close-the-loop)
```

---

## Truth-source rules

Several rules have both a **client mirror** (TS) and a **server authority** (SQL).
When they disagree, the server wins. The mirror is hint, not law.

| Rule | Client mirror | Server authority |
|---|---|---|
| Understanding Gate | `evaluateUnderstandingGate()` in `understandingGate.ts` | `check_understanding_gate()` trigger on `problems` |
| Close-the-loop atomicity | `closeProblemLoop()` calls `close_problem` RPC | `close_problem()` SQL function in 0005 |
| Append-only semantics | (none — we don't try to mirror these in TS) | UPDATE/DELETE rules on `events`, `signals`, `problem_signals` |

This is Rule 2 — "interrogate locked doors." The DB is the locked door. The mirror
helps the UI show "you need X more signals" *before* the door refuses, but it cannot
*be* the door. If the trigger ever rejects something the mirror said would pass,
that's a mirror bug, not a trigger bug.

---

## Default thresholds (from AMD-002)

The client mirror uses the same defaults the DB trigger uses (`3 / 2 / 80`). Any
change to either must be paired — and any loosening of either requires an
amendment, per AMD-001's process.

```ts
export const DEFAULT_THRESHOLD = {
  minSignals: 3,
  minDistinctSources: 2,
  minDiagnosisChars: 80,
};
```

---

## What the engine does NOT do

These are deliberate omissions, not gaps:

- **No automatic problem creation.** Patterns surface in the UI; problems are
  *stated* by the user with their own framing. The engine refuses to coin a
  problem hypothesis on the user's behalf — that would overtake (§3.3).
- **No "best resolution" ranking.** The engine surfaces *a* candidate (the one
  the user proposed) with its ripples. It does not rank the user's proposal
  against alternatives the System invented. The user is the decider.
- **No automatic close-the-loop.** Persistence is gated behind an explicit
  commit step; the engine never closes a loop on the user's behalf.
- **No retroactive amendment of past resolutions.** Once `decided_at` is set on
  a resolution, it cannot be changed. Outcomes can be added later
  (`observed_outcome`, `durability`) for §3.5 measurement, but the original
  reasoning is frozen the moment it's recorded.

---

## Validation gate (Rule 4)

Per §7.5: the engine refuses to believe its own evolution until results prove it.

Validating this engine means:
1. Run the loop on a real diagnostic situation end-to-end.
2. Record the resolution.
3. After some operational window, fill `observed_outcome` and `durability`.
4. Aggregate: did engine-mediated diagnoses produce more durable resolutions
   than ad-hoc decisions made without it?

Until that aggregate exists, the engine is *operational* but not *validated*. The
distinction is preserved: the UI never claims it's been proven to help; it claims
only that it's running the discipline.

---

## How to extend

Adding a new diagnostic step (e.g. "external benchmark check" between
ripple-trace and decide) requires:

1. **Amendment.** Adding a step is a change to §1. The constitution must be
   amended first, with diagnosis (why is the existing loop missing this?) and
   ripple-trace (what else does it affect?).
2. **Schema.** If the step requires persistent state, a migration.
3. **Module.** A new file in `src/lib/diagnosis/`.
4. **Orchestrator.** Update `DIAGNOSIS_STEPS` order and add a `canAdvance` clause.
5. **UI.** A new step card in the diagnose surface.

The amendment process forces all four to be reasoned about *together* — which is
exactly Rule 1.5 (holistic, ripple-trace before committing).
