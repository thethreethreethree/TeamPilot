# CLOSURE — controlExempt discarded in call()

## What shipped
The empty "Your read" was an account/company-based GATE bug, not starvation. Sales Coach engines set
`controlExempt: true` and `runBrainCall` honored it (it RAN the LLM), but the shared `call()` wrapper re-checked
`!gate.guidanceEnabled` ALONE — the controlExempt term had drifted out — and DISCARDED the real answer for any
company with `ai_guidance_enabled=false`. Prod confirmed it (Deeznuts 13/13 empty, Align 8/8+6/6, Caliber 2/2;
guidance-on companies worked), as did the founder's same-device A/B (Deeznuts empty → Moses admin full). The
one-line chokepoint fix — `if (!r.gate.guidanceEnabled && !args.controlExempt)` — restores the intended
exemption for review, dissect, moments, LIVE cues, decision-dialogue, and ask-coach across every company.

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-controlexempt-discarded-in-call)
typecheck ✓ · lint ✓ · theme-leak audit ✓ · RLS audit ✓ · Invariant audit — Violations: 0 ✓
tbc:docs ✓ · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
exit 0  (see the run pasted at commit time)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "The duplicated gate condition still exists in call() vs runBrainCall (two copies of !guidanceEnabled && !controlExempt).", "why_skipped": "The durable fix (return an explicit `suppressed` flag from runBrainCall/runBrainStream so no consumer re-derives it) touches 6 call sites + the streaming routes; deferred to a separate refactor. The regression test is the interim guard.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T12:08:00Z", "outcome": "Flagged (remediate.md R1)." },
  { "id": "R2", "item": "Persisted after_pitch_summaries with empty narrative (generated while the bug was live) stay empty until re-POSTed.", "why_skipped": "The fix is forward-only; a stored empty fills in on the rep's 'Rebuild'. A proactive regeneration sweep re-spends LLM tokens, so it is founder-gated, not auto-run.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T12:08:30Z", "outcome": "Founder-gated." },
  { "id": "R3", "item": "Separate uncommitted work in the tree: the CRM lifecycle-stage → activate seam (opens the gate for non-exempt AI).", "why_skipped": "Distinct concern from this root fix; ships as its own follow-up commit with its own TBC dir.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T12:09:00Z", "outcome": "Deferred to follow-up commit." },
  { "id": "R4", "item": "Clock-drift artifact: started_at 12:00Z is ahead of the real clock to sort newest for the TBC dir-selector.", "why_skipped": "Ordering is honest; only the absolute value tracks the session's drifted clock. Documented in the reference_tbc_build_dir memory.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T12:09:30Z", "outcome": "Noted." }
]
```

## Un-named reliance
Relies on `runBrainCall` continuing to RUN the LLM (not suppress) when `controlExempt` is set — i.e. the two
copies of the gate condition staying in sync. That reliance IS the drift that caused the bug; it is named in
R1 and guarded for now by `claude.controlExempt.test.ts`.

## Status
Complete at gate exit 0. Sales Coach AI now generates for every company regardless of the §3.4 guidance flag,
while the control window still suppresses non-exempt Elostate diagnostic AI (test 2).
