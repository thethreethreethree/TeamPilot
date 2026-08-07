# CHECK — INVARIANT 24: fence the extension engines against LLM prompt injection

## Verification (A38 — canonical command, by name, coverage + exit)
Ran `npm run check` (typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test).

```
invariant:audit — Files scanned: 762 · Violations: 0 · "every coach transcript engine fences the transcript" (INV23) + extension engines (INV24)
tbc — docs ✓ · manifest ✓ · artifacts ✓ · residual ✓ · freshness ✓
test — Tests 2437 passed | 15 skipped
=== check exit code: 0 ===
```
The audit's built-in `st(...)` self-tests (which run inside `invariant:audit`) include 6 new INV24 cases; the
suite prints no `SELF-TEST FAILED` and exits 0.

## Detection proof (§1.5.2 — the guard detects a real hole)
```
# strip the fence from one engine:
$ sed 's/CONVERSATION_IS_DATA/FENCE_REMOVED_FOR_TEST/g' salesSummary.ts → (temp)
$ node scripts/invariant-audit.mjs
  Violations: 1
  ✗ A coach extension engine must fence external text against LLM prompt injection
      src/lib/coach/extension/salesSummary.ts
# restore:
  Violations: 0
```
The strip-test proves INV24 flags an actually-unfenced engine (not merely asserts intent), and that all 5
current engines pass because the fence is present.

## Reachability (A31 — both directions of the guard)
```json
[
  {
    "feature": "INV24 — extension-engine injection-fence enforcement",
    "files": ["scripts/invariant-audit.mjs"],
    "write_path": { "exists": true, "where": "the scan loop pushes a finding for a coach/extension LLM engine lacking CONVERSATION_IS_DATA", "human_can_set": true },
    "read_path": { "exists": true, "where": "npm run invariant:audit (inside npm run check) reports the finding + fails the push; proven by the strip-test", "human_can_see": true }
  }
]
```
Both directions exist: a real omission is detected (strip-test) and surfaced as a failing gate a human sees on
push.

## Findings
no findings — a precise structural trigger (flat coach/extension path + an LLM-caller reference) reusing
INV23's fence primitive; no product code changed (the 5 engines already comply); the guard is detection-
proven, not intent-asserted. The empty EXT_FENCE_ALLOWLIST is the documented escape hatch for a future
no-external-text engine.
