# CLOSURE — Settings Slice 3 (Timezone foundation)

## 1. Session-read manifest

12 entries in think.md's manifest, each with a this-session read_at (validated by verify-manifest.mjs).
Clauses re-read this session: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md A19, A22, A26,
A28, A31, A30, A38.

## 2. Build inventory (reachability per A31)

| Feature | write path | read path | status |
|---|---|---|---|
| formatInTimeZone / resolveTimeZone | pure module src/lib/datetime/format.ts | Settings "Last saved" renders company.timezone | BUILT |
| First consumer (Settings last-saved) | raw UTC slice → formatInTimeZone(updated_at, company.timezone) | visible on Settings | BUILT |

## 3. Verification record (A38)

```
> npm run check   (typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test)
  invariant:audit — Violations: 0
✓ tbc:docs
✓ tbc:manifest
✓ tbc:artifacts
✓ tbc:residual
✓ tbc:freshness
      Tests  1622 passed | 15 skipped (1637)
CHECK_EXIT=0
```

Dogfood: `npm run tbc:revision` → "2 requested-change item(s) in .../2026-07-29-x3-settings-timezone-
foundation/revision.md" → exit 0.

Targeted before the full run: `npx tsc --noEmit` exit 0; `format` test 8/8.

## 4. Findings ledger

No findings.

## 5. Gates added

None new. The formatter + resolution precedence are unit-pinned (8 assertions), which is the precise,
testable form (A30 satisfied by the test — pure logic, no gate needed).

## 6. Residual queue (A36)

```json
[
  {
    "id": "RES-2026-07-29-TZ-01",
    "item": "Broad adoption: ~12 other timestamp displays still use ad-hoc toLocaleString / .slice(0,19) and do NOT yet route through formatInTimeZone, so most timestamps still ignore the company/user timezone.",
    "why_skipped": "Converting 12+ display sites is a broad refactor with real regression surface; doing it at the tail of a long session risks 'don't break'. The primitive + one consumer ship now; adoption is a focused increment.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-29T07:20:00Z",
    "outcome": "OPENED. Reviewed: the util is the reusable foundation; each display converts by replacing its ad-hoc call with formatInTimeZone(value, effectiveTz). The effective zone needs the resolve chain wired (a useTimeZone hook reading the user override + company default) — which pairs with the per-user profiles.timezone column (TZ-02). Best done as one focused adoption pass, listed for the next increment, not silently dropped."
  },
  {
    "id": "RES-2026-07-29-TZ-02",
    "item": "The per-user profiles.timezone OVERRIDE column is not built yet (only the company timezone is consumed here).",
    "why_skipped": "The founder chose 'consumption first'; adding the override before broad consumption would make it dead surface — the exact class being fixed.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-07-29T07:21:00Z",
    "outcome": "OPENED — it is the rest of S3. resolveTimeZone(userTz, companyTz) already exists + is tested for the precedence, so the override slots in cleanly once (a) profiles.timezone is added (A34-guarded like theme's 0201) and (b) a useTimeZone hook feeds the resolved zone into the adopted displays. Sequenced after broad adoption (TZ-01). Tracked in docs/BUILD-STATE.md S3."
  }
]
```

Top-ranked residual (TZ-01, medium) is opened with an outcome per A36.

## 7. Hypothesis outcomes

- **H1** (formatter honors the zone) — CONFIRMED (per-zone difference asserted; 8/8).
- **H2** (bad zone degrades, no crash) — CONFIRMED (RangeError caught → local format).

## 8. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc`
