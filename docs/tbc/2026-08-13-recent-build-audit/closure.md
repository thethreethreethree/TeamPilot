# CLOSURE — full-build audit fixes

## What shipped
Founder asked to audit the recent build fully. I ran two independent adversarial review subagents (one on the
auto-update, one on the extension changes) on top of my own pass, verified every finding against the code, and
fixed the real ones. Headline: TWO genuine high-value bugs the builder's-eye missed —
- **A1 (HIGH):** an auto-update reload aborted for a recording-in-the-beat permanently spent the once-per-commit
  budget → stranded the stale client. Fixed by writing the budget only on an actual reload.
- **A2 (HIGH):** the extension single-flight left a fast/slow reuse-detection race open (the founder's own
  "kicked out" bug, narrowed not closed). Fixed by re-reading the refresh token at refresh time (both extensions).
Plus A3 (manual-reload recording confirm), A4 (unmount leak), A5 (visibilitychange→document), A6 (restart
busy-guard). Four findings accepted-as-not-bugs with reasons.

## Verification (A38) — full gate output
`npm run check` — full gate, exit 0:
```
typecheck ✓ · lint ✓ · theme:audit ✓ · rls:audit ✓
invariant:audit ✓ — Violations 0
tbc ✓ — docs · manifest · artifacts · residual · freshness — all ✓
Test Files 404 passed | 1 skipped (405); Tests 2792 passed | 15 skipped (2807)
```
Extensions additionally `node --check`-clean (all 3 files); VersionWatcher suite 20 passed.

## Residual (A36)
```json
[
  { "id": "R1", "item": "The extension code + the React timers/DOM in VersionWatcher are not node-testable; only shouldForceReload + the storage/threshold helpers are unit-tested. The A1/A2 fixes' RUNTIME behavior is confirmed by trace + the founder's live check, not a browser test.", "why_skipped": "No browser/chrome-API harness in the sandbox (standing posture). The reload DECISION chokepoint is tested; the fixes are thin changes over it + the traced reasoning in remediate.md.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-13T22:20:00Z", "outcome": "Opened + assessed: traced + syntax-checked; live-confirm on the next deploy/refresh cycle." },
  { "id": "R2", "item": "A6-adjacent: sales-login round-trip drops ?ext= (LOW) — deferred, recovers via the guidance card.", "why_skipped": "Graceful degradation (one extra hop); threading ext into state adds surface for little gain.", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-13T22:21:00Z", "outcome": "Flagged to founder; fix on request." }
]
```

## Un-named reliance
- A1 relies on `markTriedCommit` still writing BEFORE `location.reload()` so the loop guard persists across the
  reload — it now does, just inside the timer. A2 relies on the fast call having PERSISTED the rotated token to
  storage before the slow call re-reads it; an active fetch keeps the SW alive across the set, so this holds in
  practice (the pre-existing SW-killed-mid-set edge is unchanged, noted in the extension audit as low-risk).

## Status
Complete once the gate output above shows exit 0. The audit earned its keep — two real HIGH bugs found + fixed.
