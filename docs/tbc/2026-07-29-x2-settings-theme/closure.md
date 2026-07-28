# CLOSURE — Settings Slice 1 (Theme)

## 1. Session-read manifest

12 entries in think.md's manifest, each with a this-session read_at (validated by verify-manifest.mjs).
Clauses re-read this session: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6; ThinkerThinker.md A19, A22, A28,
A31, A34, A30, A38.

## 2. Build inventory (reachability per A31)

| Feature | write path | read path | status |
|---|---|---|---|
| Per-user theme override | ThemePanel → PATCH /api/me/theme → profiles.theme_preference | reconcileTheme → applyToDom on a new device | BUILT |
| Company default theme | admin ThemePanel → PATCH (isAdmin, company-scoped) → companies.default_theme | member with no pref inherits it | BUILT |
| Migration + A34 guard | 0201 adds both columns | isMissingColumnError degrades to localStorage-only | BUILT |

## 3. Verification record (A38)

```
> npm run check   (typecheck · lint · theme:audit · rls:audit · invariant:audit · tbc · test)
  invariant:audit — Violations: 0
✓ tbc:docs
✓ tbc:manifest
✓ tbc:artifacts
✓ tbc:residual
✓ tbc:freshness
      Tests  1608 passed | 15 skipped (1623)
CHECK_EXIT=0
```

Dogfood: `npm run tbc:revision` → "4 requested-change item(s) in .../2026-07-29-x2-settings-theme/
revision.md" → exit 0 (the new gate validates this build's own manifest).

Targeted before the full run: `npx tsc --noEmit` exit 0; `reconcileTheme` test 6/6 passed.

## 4. Findings ledger

No findings.

## 5. Gates added

None new. The resolution rule is unit-pinned (reconcileTheme.test.ts, 6 assertions) rather than gated —
it is pure logic, precisely testable (A30 satisfied by the test).

## 6. Residual queue (A36)

```json
[
  {
    "id": "RES-2026-07-29-THEME-01",
    "item": "The one-frame reconcile flash: a user relying on the COMPANY DEFAULT (no personal pref, not cached) sees the pre-paint default for one frame before the DB fetch applies the company theme on each fresh load.",
    "why_skipped": "Company-default is deliberately not cached to localStorage so it keeps tracking later changes; making it flash-free would need the value server-side in the pre-paint script (a cookie/SSR read), which is a larger change than this slice.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-29T06:45:00Z",
    "outcome": "OPENED. Reviewed: the flash only affects users who have NEVER picked a theme on that device AND whose company default differs from the 'system'-resolved default; once they pick any theme (or their personal pref caches), it is flash-free. Personal prefs ARE cached, so the common returning-user path has no flash. Acceptable for this slice; a cookie-backed pre-paint read is the follow-up if the founder wants zero flash for default-inheriting users."
  },
  {
    "id": "RES-2026-07-29-THEME-02",
    "item": "Live behavior against an APPLIED 0201 is unverified — the migration was written but not applied by me.",
    "why_skipped": "Applying a migration needs the DB URL / founder; the code is guarded to degrade to localStorage-only until then (A34), so shipping the code ahead of the apply is safe.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-07-29T06:46:00Z",
    "outcome": "OPENED — it matters for full effectivity. Mitigation: every DB touch is guarded with isMissingColumnError for the exact column, so pre-apply the surface is localStorage-only (today's behavior), never broken. Post-apply verification (pick a theme on device A, confirm it follows to device B; admin sets a company default, confirm a fresh member inherits it) is the founder/live step. Tracked in docs/BUILD-STATE.md."
  }
]
```

Top-ranked residual (THEME-01, medium) is opened with an outcome per A36.

## 7. Hypothesis outcomes

- **H1** (non-breaking even if 0201 never applied) — CONFIRMED (localStorage path untouched; reconcile
  additive + guarded; tsc 0; test 6/6).
- **H2** (no 0090 guard change needed) — CONFIRMED (0090 is a blocklist; theme_preference not on it).

## 8. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc`
