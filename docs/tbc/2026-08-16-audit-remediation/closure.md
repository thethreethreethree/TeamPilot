# CLOSURE — 2026-08-16 audit remediation

## What shipped
Seven audit findings remediated: the HIGH live-coaching honesty bug (#1), the ask-coach prompt-injection fence +
INV25 (#2), the monitoring audit fail-loud (#3), the monitoring boundary test (#4), the forced-cue honest error
(#5), invite-link origin drift (#6), and the vendor-id drift-guard (#7). #8 (ESLint bump) deferred.

## Verification (A38) — canonical command + exit code
```
$ npm run check
  ✓ No theme-bound leaks.
  ═══ RLS policy audit ═══   Tables without RLS: 0 · Tenant-pin risks: 0 · Missing policies: 0
  ═══ Invariant audit ═══   Files scanned: 793 · Violations: 0   (INV25 now present)
  ✓ tbc:docs · tbc:manifest · tbc:artifacts · tbc:residual · tbc:freshness
  Test Files  429 passed | 1 skipped (430)
  Tests       2944 passed | 15 skipped (2959)
GATE_EXIT=0
```
INV25 detection: removing the fence (import+usage) from ask-coach → `Violations: 1`; restored → `Violations: 0`.

## Residual (A36)
```json
[
  { "id": "R1", "item": "#8 ESLint toolchain bump (eslint-config-next 15 -> 16, off EOL ESLint 8) was selected by the founder but NOT done in this batch.", "why_skipped": "A framework-major lint-config bump changes rules and can surface new lint errors that fail `npm run lint` / the Vercel deploy (the documented 'local pass != Vercel deploy' trap). It needs its own verify cycle, not a batch with behavioral fixes.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-16T12:30:00Z", "outcome": "Deferred + flagged to founder as a dedicated step; no security exposure (EOL lint tooling, not runtime)." },
  { "id": "R2", "item": "INV25 uses token-PRESENCE (CONVERSATION_IS_DATA anywhere in the file), like INV23/24 — an import without usage would pass.", "why_skipped": "Consistency with the sibling invariants; a stronger 'appended to the systemPrompt' check was considered. The behavioral fix is separately unit-covered where possible.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-16T12:30:30Z", "outcome": "Accepted — matches established convention; revisit all three together if the class recurs." },
  { "id": "R3", "item": "Informational audit notes not fixed: care rcd/[id] doc/code comment mismatch (relies on RLS only), monitoring full-session-row read before allowlist check (no leak).", "why_skipped": "Neither is an exploit; both are hardening/clarity items outside the selected fix set.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-16T12:31:00Z", "outcome": "Left on the audit record for a future pass." }
]
```

## Un-named reliance
- #1 relies on the recorder `onstop` firing on every stop path (stop/teardown both call `recorder.stop()`), so
  `audioCapturing` returns to false — verified in the two stop paths.
- #3's fail-loud relies on `logMonitoringAccess` returning false on a real failure (insert error OR throw), both
  now covered; the list endpoints intentionally log-and-continue.
- #5 relies on the client rendering `!res.ok` as "Cue request failed" for on-demand (confirmed at
  useLiveCoaching.ts:526) — the 502 surfaces honestly.
