# REMEDIATE — controlExempt discarded in call()

## F1 — restore the controlExempt term at the call() re-check
Remediation: `call()` now mirrors runBrainCall's exact condition — `if (!r.gate.guidanceEnabled &&
!args.controlExempt)`. With controlExempt the real text passes through instead of being discarded; the §3.4
control window is unchanged for non-exempt callers.
gate-or-promise: gate. `claude.controlExempt.test.ts` locks it — guidance-off + controlExempt → suppressed:false
+ real text (test 1), guidance-off + non-exempt → still suppressed (test 2). Dropping the `&& !args.controlExempt`
term reddens CI (test 1 fails). class: duplicated-condition drift. severity: critical. Fixed.

## R1 — collapse the duplicated gate condition (deferred, hole named per A33)
The root class is drift between two copies of one gate condition. The durable gate is to have `runBrainCall` /
`runBrainStream` return an explicit `suppressed` boolean so no consumer re-derives `!guidanceEnabled &&
!controlExempt` (call(), rippleTrace, outsideView, chat-stream routes would read `r.suppressed`).
gate-or-promise: promise (A33 declined-gate). Deferred as a separate refactor touching 6 call sites + the
streaming routes; the named hole is that a NEW exempt consumer re-deriving the condition could re-introduce the
drift. Interim guard: F1's regression test. To be encoded when the refactor lands.

## Backfill — persisted empty narratives (founder-gated)
Summaries generated while the bug was live have `narrative.hasSignal:false` PERSISTED (the row saved on computed
scores). The fix applies to NEW generations; a stored empty fills in when the rep re-POSTs via "Rebuild".
gate-or-promise: promise. A proactive regeneration sweep for affected guidance-off companies is founder-gated
(re-spends LLM tokens per session) — not auto-run. Named so it is not mistaken for auto-healed.
