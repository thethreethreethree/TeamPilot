# REMEDIATE — 2026-08-16 audit remediation

## During-build corrections
- **#1 needed a real signal, not a copy tweak.** The naive fix (reword the error string) would still lie in the
  mic-denied case (where capture genuinely stopped). Traced the two error paths: the OUTER catch (mic/setup) calls
  `stop()` → nothing captured; the STT websocket handlers set error but leave the recorder running. So the honest
  discriminator is "is the recorder capturing", which drove the `audioCapturing` state rather than string edits.
- **INV25 detection tamper (first attempt false-negative).** Stripping only the `+ CONVERSATION_IS_DATA` usage left
  the import line's token, so the presence-check still passed. Re-tested by removing BOTH import and usage → INV25
  correctly flagged (Violations: 1). This mirrors INV23/24's token-presence convention (a stronger "appended to the
  prompt" check was considered but kept consistent with the sibling invariants).

## Adjacent surfaces checked (§1.5.2)
- extension/suggest — the other coach API route calling an LLM directly — fences via the INV24-guarded builders; safe,
  correctly NOT matched by INV25 (it has no getSessionTranscript).
- The list monitoring endpoints (companies/sessions) — audit failure is logged but not fail-loud; deliberate, they
  serve navigation metadata, not the sensitive transcript. Only session-detail fails loud.

## Residual / follow-ups
- #8 ESLint bump deferred (real Vercel-deploy risk) — see closure residual.
- care `rcd/[id]` doc/code mismatch + monitoring full-row-read-before-check: informational, no leak (audit notes),
  not fixed this build.
