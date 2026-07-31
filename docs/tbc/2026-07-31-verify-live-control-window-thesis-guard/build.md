# BUILD — verify:live §3.4 control-window trigger-wired guard

### §3.4 control-window trigger-wired check

A new `verify:live` check in `scripts/verify-invariants-live.mjs`.

- **write-path:** it queries the LIVE catalog for a non-internal trigger on `companies` running
  `enforce_coach_control_window` firing BEFORE UPDATE (`(tgtype & 2)=2 and (tgtype & 16)=16`). If absent →
  `pass:false` → verify:live exits non-zero with "MISSING — §3.4 honesty moat can be silently bypassed".
- **read-path:** `npm run verify:live` prints `✓ PASS §3.4 no-instant-results — the coach-control-window
  trigger is WIRED …` when healthy; a failure names §3.4 so the operator sees the honesty moat lapsed.

The LIVE complement for a thesis mechanism: rls:audit/text can't see a dropped trigger; this does.

Files:
- `scripts/verify-invariants-live.mjs` — the new §3.4 check (now 20 invariants total).
