# BUILD — INVARIANT 24: fence the extension engines against LLM prompt injection

## Doc integrity (§0.1)
```
$ sha256sum CLAUDE.md ThinkerThinker.md
e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f  CLAUDE.md
0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc  ThinkerThinker.md
```
Match DOC_MANIFEST.json; no governing-doc change, no AMD required.

## Change

### INVARIANT 24 — coach extension engines must fence external text
`scripts/invariant-audit.mjs`.

- **write-path:** a new scan block — for each file matching `^src/lib/coach/extension/[^/]+\.ts$` that
  references an LLM caller (`EXT_LLM_CALLER_RE = /(dissectCoachV5|generateCareReply)/`), require
  `TRANSCRIPT_FENCE_RE` (CONVERSATION_IS_DATA); else push a finding. An `EXT_FENCE_ALLOWLIST` (empty today)
  is the documented escape hatch for a future engine that injects no external text. Reuses INV23's fence
  primitive — one definition, not a second.
- **read-path:** `npm run invariant:audit` now reports on the 5 extension engines; all pass (fence present).
  6 self-tests added to the audit's `st(...)` harness (path matcher accept/reject, LLM-caller trigger
  fire/ignore, fence flag/accept).

## Detection proof (not just intent)
Live strip-test: replacing `CONVERSATION_IS_DATA` in `salesSummary.ts` made INV24 flag exactly that file
(Violations: 1); restoring it returned Violations: 0. The guard fails on a real injection hole, not only on a
synthetic self-test.

## Four-layer pre-walk (§1.5.1)
- **L1 structure:** a precise structural trigger (flat path + LLM-caller reference) reusing the shared fence
  regex; the only flat files there that call an LLM are the 5 engines, so no cry-wolf. Sound.
- **L2 effect:** the audit now flags an unfenced extension engine (proven by the strip-test) and passes the
  fenced ones. Works.
- **L3 continuity:** this is a build-time gate; it runs in `npm run check` on every push, so a future
  unfenced engine can't merge.
- **L4 surface:** none (a CI guard).

## Verdict: SHIPPABLE
Closes the third instance of the invariant-scope-gap class as a detection-proven security gate; no product
code changed (the 5 engines already comply).

## Files
- `scripts/invariant-audit.mjs`
