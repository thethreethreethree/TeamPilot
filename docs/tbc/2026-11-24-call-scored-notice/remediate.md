# REMEDIATE - Tell the rep their call is scored

### F1 - the "ready" notice fires before the score exists
The score's own notice now follows the store; call_ready's wording is left as is (the review and transcript are ready).
gate-or-promise: gate (scoreSession.test.ts "the rep is told their call is scored")
