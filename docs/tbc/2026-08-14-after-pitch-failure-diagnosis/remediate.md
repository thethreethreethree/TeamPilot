# REMEDIATE — After-Pitch failure diagnosis

## F1 — name the generation-failure cause (incl. the 504)
Remediation: `explainAfterPitchError(status, raw)` maps a generation HTTP failure to a rep-facing cause;
`generate()` sets a `genError` and the render shows it (title + detail + Try again) instead of a raw HTTP code.
A 504/408/timeout reads as "That took too long to build — your recording is safe, tap Try again."
gate-or-promise: gate. `afterPitchDiagnosis.test.ts` locks the mapping (504/408/timeout → took-too-long; 502/503,
403, 429 each; 500/unknown → a friendly generic, never a raw code). Regressing the mapping reddens CI.
class: honesty / diagnostic-visibility. severity: medium. Fixed (logic gated; the render is client wiring).

## F2 — name the empty (two-sided) read
Remediation: `diagnoseAfterPitchRead(summary)` returns the empty-read cause (blank narrative, scores, no gap);
`EmptyReadBanner` renders it at the top of the read. Returns NULL for a one-sided gap (owned by BlankReadRecovery)
so there's no duplicate cause text.
gate-or-promise: gate. `afterPitchDiagnosis.test.ts` locks: empty-read named; one-sided gap → null (no
duplication); healthy read → null.
class: honesty / error-dressed-as-no-data. severity: low-medium. Fixed.

## F3 — raise maxDuration on the rep-blocking generation routes (the recurring 504)
Remediation: `/after-pitch`, `/review`, `/finalize` now export `maxDuration = 300` (was 60), so an LLM
generation over a long call's transcript is no longer killed at the 60s ceiling → the 504 the founder hit
repeatedly. 300s is the Pro plan max, already used by the STT routes.
gate-or-promise: promise. This is a deployment-config value; the invariant audit already gates that these routes
EXPORT a maxDuration (no missing budget), but not its magnitude. Verified by the sweep-command in check.md +
observing prod. A follow-up (flagged) adds an LLM-call timeout so a genuine HANG fails fast instead of consuming
the whole 300s — that half is a promise, honestly.
class: deployment-config / timeout. severity: high. Fixed (ceiling raised; hang-guard flagged).
