# CHECK — Meeting Coach go-live: nav entry + module entitlement

## Gate — the canonical command (A38)

```
$ npm run check
 Test Files  564 passed | 1 skipped (565)
      Tests  3701 passed | 15 skipped (3716)
EXIT: 0
```

(Targeted: moduleAccess 18 pass — includes the new entitlement matrix. The INV9 NEXT_PUBLIC allowlist + the
.env.example doc-completeness guard both pass with the new flag added.)

## What the tests prove
- **Entitlement (moduleAccess):** `moduleForPath` maps the meeting-coach root + subtree to `sales_coach`;
  `isPathAllowed` → sales_coach reaches it, care is denied, hub always allowed; a lookalike prefix
  (`/meeting-coach-x`) is NOT the subtree. So the 0207 lock no longer bounces a sales_coach account away, and the
  entitlement can't silently drift (A30).

## Honest limit
The nav entries are build-time-flag-gated (`NEXT_PUBLIC_MEETING_COACH_ENABLED`) — a build with the flag off (this
one) renders no entry, so their VISIBLE appearance is confirmed at go-live once the founder sets the flag +
redeploys (the §1.5.3 step, documented in docs/MEETING-COACH-GO-LIVE.md). The pure entitlement change is fully
unit-tested here.

## Findings
**No findings.** The only live-auth change (moduleForPath) is pure + unit-tested + only expands sales_coach access
to the flag-off, A34-safe meeting-coach subtree; nav additions are additive + gated; the external precondition is
documented + surfaced, not buried.
