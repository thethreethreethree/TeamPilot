# CLOSURE — schedule audit fixes

## What shipped
The founder-directed fixes from the outside-view schedule audit (4 agents + my foundation/client passes). Foundation
confirmed solid; every finding checked against the code before acting (one refuted). The founder chose: enforce the
absolutes, show both split shifts, and fix A + C + the honesty LOWs. Delivered: (A) the colour export shows both
shifts of a split instead of silently dropping the earlier; (B) the import rejects an oversized grid with a graceful
413 instead of OOMing; (C+D) the write route enforces the authority verdict (422 on an absolute conflict, 409 on a
phantom id) while keeping the manager's overridable overrides; (F4) the manager log GET 403s honestly; the assistant
reports an honest system problem on an empty model reply; and the latent staff-self-service binding is documented as a
⚠ precondition exactly where it must be added.

## Verification (A38)
`npm run check` → EXIT 0 (see check.md). Every fix carries a test that fails without it; typecheck + lint clean;
590 files / 3858 tests.

## The un-named reliance
- **Canvas pixels aren't unit-tested** (jsdom has no real 2D context). The split-shift MODEL fix (`buildWeekGrid` keeps
  both segments) is gated; that the print/PNG actually shows both stacked chips is founder visual-verify.
- **Authority enforcement is gated over a MOCKED derived state.** The authority math is separately unit-tested; that a
  real double-booking POST returns 422 in production is founder visual-verify.
- **The events GET/assignment writes now replay the full log per call.** Bounded by `maxDuration=30` + `fetchAllPaged`;
  for a very large company the replay cost grows — acceptable for a manager action, worth watching if a company's log
  grows into six figures (a snapshot/projection would be the next step, not built).

## Residual (A36 — explicit)
```json
[
  {
    "id": "R1",
    "item": "Deferred LOW findings, surfaced not silently skipped (§3.3): xlsx sparse-column amplification (a crafted .xlsx row allocating 16k-element arrays); base64 body cap misstates the Vercel limit (~3.3MB real vs 4.5 claimed); PDF-data export garbles non-Latin names (WinAnsi truncation); printed colour omits the on-screen unassigned-shift warning; the expensive replay GETs aren't rate-limited.",
    "why_skipped": "The founder chose 'A + C + honesty LOWs'; these are lower-impact polish/robustness (all manager-gated, no cross-tenant or data-loss). Recorded here for a later pass, not silently dropped.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-08-27T11:46:00+08:00",
    "outcome": "OPENED — deferred by founder scope choice; each is a bounded follow-up."
  },
  {
    "id": "R2",
    "item": "Agent 3 F2 (employee-open event types don't bind employeeId to the caller) is DOCUMENTED as a precondition, not enforced — because enforcing it now would break the manager-entered model (a manager must set any employee's data).",
    "why_skipped": "Latent until staff self-service ships (which the founder said don't build). A ⚠ comment marks exactly where the caller-binding must be added when it does.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-27T11:46:00+08:00",
    "outcome": "OPENED + documented in code at the enforcement point."
  }
]
```
