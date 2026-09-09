# CLOSURE — voice-recognition gate, slice 1 (enrollment + attribution + prompt)

The 9/2 voice-recognition gate is now real as an ACOUSTIC-REFERENCE feature (founder's chosen approach): a
one-time voice enrollment stores the rep's median fundamental frequency — a number, never audio — which seeds
live speaker attribution against their known pitch. Shipped this slice: the migration, the pure derive/validate
core, the enrollment API, the capture UI (on Settings), the attribution seeding, and a non-blocking enroll
prompt. Enforcement (hard session-start block) is deferred per the founder's "prompt now, hard-enforce after
verified" rollout.

## What this slice does NOT do (un-named-reliance half)
- The mandatory HARD gate is not enforced yet — session start is unchanged. Enforcement is the next slice, gated
  on: (a) the 0246 migration confirmed applied in prod, and (b) the mic-capture flow verified working with a
  real microphone. Enforcing before both risks a coach-wide lockout.
- The mic capture has NOT been exercised against a real microphone in this environment — only the pure logic,
  the API, and the rendered UI states are verified here. The founder/reps must confirm live capture.
- `spoken_at`-style word-level timing isn't used; enrollment is a per-rep pitch scalar, deliberately simple.
- The acoustic seed helps most when the two voices differ in pitch; same-pitch pairs still degrade to the
  honest low-confidence path (unchanged §3.4 behavior).

## Residual (A36 — read from the TOP of the confidence ranking)
```json
[
  { "id": "R1-migration-apply-path",
    "item": "Whether 0246 actually applies cleanly via the ledger, or whether adding two nullable columns to profiles needs anything special.",
    "why_skipped": "Assumed a plain nullable ALTER TABLE ADD COLUMN just works — the thing I was most sure didn't need checking.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-09-09T15:04:00+08:00",
    "outcome": "OPENED. Confirmed the migration mirrors the exact idempotent pattern of 0219 (macro_mode_enabled) and 0235 (must_change_password) — `alter table profiles add column if not exists ...`, two NULLABLE columns with no default backfill, no RLS/policy change (self-updatable via the existing 0001 own-profile policy; not authz so 0090/0091 untouched). No trigger, no data migration, no lock risk on a large table (nullable add is metadata-only in Postgres). The guarded fallback (isMissingColumnError) also means code shipped before apply degrades honestly rather than erroring. Low-risk apply; nothing special needed." },
  { "id": "R2-real-mic-capture",
    "item": "The Web Audio capture path (getUserMedia → ScriptProcessor → detectF0) hasn't run against a real mic.",
    "why_skipped": "No microphone/browser in this environment; the pure logic + API + rendered states are verified, the live capture is not.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null },
  { "id": "R3-enforcement-follow-up",
    "item": "The mandatory hard gate isn't enforced — the feature is prompt-only until the enforcement slice.",
    "why_skipped": "Founder rollout choice (prompt now, hard-enforce after verified); enforcing now risks a lockout.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null }
]
```

## Verification
See check.md — `npm run check` run whole with pasted output + exit code, and the render (LAW 1) of the three
enrollment states.
