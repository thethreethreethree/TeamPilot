# BUILD — verify:live §3.5 durability-emit trigger-wired guard

### §3.5 durability-emit trigger-wired check

A new `verify:live` check in `scripts/verify-invariants-live.mjs`.

- **write-path:** queries the LIVE catalog for a non-internal trigger on `resolutions` running
  `resolutions_emit_durability_review` firing on UPDATE (`(tgtype & 16)=16`). Absent → `pass:false` →
  verify:live exits non-zero with "MISSING — §3.5 durability signal would silently stop reaching the event
  chain".
- **read-path:** `npm run verify:live` prints `✓ PASS §3.5 durability loop — the durability-review EMIT
  trigger is WIRED …` when healthy; a failure names §3.5.

Completes the §3-thesis trigger-wiring live-coverage (§3.1/§3.2/§3.4/§3.5). Now 21 invariants.

Files:
- `scripts/verify-invariants-live.mjs` — the new §3.5 check.
