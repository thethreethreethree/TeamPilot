# Phase 3 — Closure

## Verdict
Phase 3 (The Decision Authority) is **SHIPPABLE as a foundation**. ONE `evaluateChange → Verdict`, proven
single-source (grep + test), drift-guarded on both branches of every term incl. the manager-override.

## Acceptance (build plan Phase 3) — met
- ✅ A single authority returns the verdict (`evaluateChange`).
- ✅ No re-derivation anywhere — proven by search (predicates called only in authority.ts) + test.
- ✅ Drift-guard test passes BOTH branches of every term, especially the override (overridable coverage vs
  absolute conflict) — the A40 defect site.

## Changed
- Code only (no migration). No founder approval needed beyond the authorized build + the locked picker decisions.

## Residual queue (A36 — read from the TOP)
```json
[
  {
    "id": "P3-1",
    "item": "Is evaluateChange TRULY the single source (no consumer re-derives coverage/eligibility)?",
    "why_skipped": "Most sure this holds, so opened per A36 — A40's whole point is that a second copy drifts.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-19T02:30:00Z",
    "outcome": "OPENED + confirmed: grep of meetsCoverage/isEligible/withinLimits across src/ shows they are called ONLY inside authority.ts (the sole other hit is a comment in types.ts). No re-derivation. The verdict is consumed, not recomputed."
  },
  {
    "id": "P3-2",
    "item": "The 'required rest between shifts' hard constraint (plan section 4) is not yet implemented — only max-hours, double-booking (same date), time-off overlap, eligibility, coverage.",
    "why_skipped": "A genuine additional hard check (a minimum gap between an employee's consecutive shifts across days) needing cross-shift time math. Recommend adding it to evaluateChange as another absolute violation. Flagged, not silently skipped.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  },
  {
    "id": "P3-3",
    "item": "No API endpoint exposes the verdict yet.",
    "why_skipped": "The authority is a pure library function; its consumers (Phase 4 proposal, Phase 5 review UI) wire it to a surface. Endpoint is Phase 4/5.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  },
  {
    "id": "P3-4",
    "item": "Eligibility infers the required role from a single-role requiredByRole map (a heuristic).",
    "why_skipped": "A richer per-slot role/skill requirement model arrives with the Phase-5 shift builder that defines slots; the heuristic is correct for the common single-role case and never falsely blocks a no-role shift.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```

## Checkpoint (build plan Phase 3)
> "Verdict is single-source before UI or AI consume it."

Confirmed. **Phase 4 (AI Reasoning Layer — DeepSeek parses requests + proposes resolutions on top of the
verdict) is next**, and needs the DeepSeek + per-env config precondition (A41). Ready on your go.

## Verification
See `check.md` — the `npm run check` block (A38).
