# CHECK — post-build self-audit of the session's shipped code

Audited from the outside-view stance: the theme slice (ThemeProvider, /api/me/theme route, ThemePanel,
migration 0201), the timezone util, and the revision gate — looking for defects before building more
(a ground-up pass over the session's output).

## Findings

### F1 — reconcile race clobbers a mid-flight theme choice

class: an async callback applies state computed from a value CAPTURED BEFORE its `await`, overwriting a
synchronous change made during the await (a capture-before-await staleness — sibling of the
context-switch state-bleed class).

sweep: `grep -n "localRaw\|await fetch\|getItem" src/components/theme/ThemeProvider.tsx` — the ONLY
capture-before-await-then-apply site is the reconcile effect (fixed). `setPreference` and
`persistThemePreference` read no captured pre-await state. The ThemePanel's company-default fetch only
sets isAdmin/companyDefault display state (no user-choice clobber). No other instance.

severity: low — a fresh-device user who picks a theme within the fetch window (~100–500ms) sees it
revert once; self-correcting (pick again), no data loss. Fixed regardless.

## Other surfaces audited — no findings

- **/api/me/theme scoping:** GET reads self (`eq id=userId`) + own company (`eq id=companyId`); PATCH
  company-default is `!isAdmin → 403` then `eq id=companyId`. No cross-tenant path. Sound.
- **format.ts:** guards empty/NaN → ""; invalid IANA zone → caught RangeError → local format. Pure, no
  leak. Sound.
- **migration 0201:** additive columns, `if not exists`, safe defaults, theme_preference correctly NOT in
  the 0090 guard (self-editable). Sound.
- **revision gate:** REV-1 (ledger exists) + declared-set completeness; malformed json fails REV-2. Sound.

## Inspected / not-inspected

- **Inspected:** ThemeProvider effect + setPreference; the theme route (all three writes' scoping); the
  format util; migration 0201; the revision gate.
- **NOT inspected (→ residual):** live behavior of the reconcile under real network latency (needs a
  browser + applied 0201); a full multi-tab theme-sync audit.
