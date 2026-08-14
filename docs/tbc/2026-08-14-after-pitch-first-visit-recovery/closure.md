# CLOSURE — After-Pitch first-visit recovery + transient-failure marker release

## What shipped
Two confirmed gaps in the customer-missing After-Pitch recovery (the founder-reported incident class):
- **First-visit miss (finding ②, HIGH):** auto-recover keyed on a stored summary, so a customer-missing
  session's first view generated a blank read and never recovered — stranding the Standard door-to-door rep the
  feature exists for. `generate()` now returns the fresh summary and the load() heal branch engages auto-recover
  from it, so recovery runs on first view without a second mount.
- **Transient marker burn (finding ⑦, MED):** a rolled-back `replaceSessionTranscript` write kept the
  at-most-once marker set, permanently disabling recovery from one DB blip. Now it releases the marker (matching
  the route's own transient-vs-definitive doctrine), so a later open retries.

Deferred (same flow, needs new server-side state — flagged for a focused build): finding ⑥ (server-side
After-Pitch refresh after a lost client generate) and finding ⑧ (persist a single-voice decline reason to stop
the reload re-transcribe loop).

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-after-pitch-first-visit-recovery)
typecheck ✓ · lint ✓
theme-leak audit — Theme-bound leaks: 0 ✓
RLS policy audit ✓ · Invariant audit — Violations: 0 ✓
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
Test Files  415 passed | 1 skipped (416)
     Tests  2866 passed | 15 skipped (2881)
exit 0
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "Browser repro of the first-visit recovery: a customer-missing session, Standard rep, first navigation → confirm auto-recover engages (not a blank read).", "why_skipped": "The wiring is a client page effect; the repo has 0 *.test.tsx. The predicate it feeds is gated; the end-to-end engage is a promise verified in a browser.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T06:12:00Z", "outcome": "Flagged; verify on staging." },
  { "id": "R2", "item": "Findings ⑥ (lost-refresh stale blank read) + ⑧ (single-voice reload re-transcribe loop) remain open.", "why_skipped": "Both need new persisted server state in the trust-critical path; deliberately not rushed into a long session. Founder selected the cluster — these are the honest remainder for a dedicated build.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-14T06:12:30Z", "outcome": "Flagged to the founder as the next After-Pitch build." },
  { "id": "R3", "item": "Clock-drift artifact: started_at 06:00Z is ahead of the real clock (~02:00Z) to sort newest for the TBC dir-selector, following the prior committed dirs.", "why_skipped": "Ordering is honest; only the absolute value tracks the session's drifted clock. Documented in the reference_tbc_build_dir memory.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T06:13:00Z", "outcome": "Noted." }
]
```

## Un-named reliance
- Relies on `afterPitchNeedsAutoRecover` continuing to key customer-missing on the talk_ratio caveat (unchanged),
  and on `generate()` returning the same summary shape the `/after-pitch` route stores (it returns `d.summary`).

## Status
Complete once the gate shows exit 0. First-visit recovery now engages for Standard reps; a transient replace
failure no longer burns the automatic path. Findings ⑥ + ⑧ remain flagged for the next After-Pitch build.
