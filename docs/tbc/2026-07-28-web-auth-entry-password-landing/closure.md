# CLOSURE — auth-entry (Task 1 + Task 2)

## 1. Session-read manifest

12 entries in think.md's manifest section, each with a this-session read_at.

## 2. Build inventory (reachability per A31)

| Feature | write-path | read-path | status |
|---|---|---|---|
| Show-password toggle (`PasswordInput` ×6 sites) | eye button `onClick`→`setShow` | input `type` flips to text | BUILT |
| Module-aware landing (`resolveUserLanding` + `/api/me/landing`) | module levers set at provisioning | login/recover/invite navigate to it | BUILT |
| Shared `moduleLanding` (redeem adopts it) | one map | login + redeem read it | BUILT |

## 3. Verification record (A38)

```
> execos@0.1.0 check
> ... typecheck && lint && theme:audit && rls:audit && invariant:audit && tbc && test
  invariant:audit — 690 files, 0 violations
> execos@0.1.0 tbc
✓ tbc:docs
✓ tbc:manifest
✓ tbc:artifacts
✓ tbc:residual
✓ tbc:freshness
> execos@0.1.0 test
      Tests  1602 passed | 15 skipped (1617)
EXIT=0
```

Coverage: all 7 gates (typecheck · lint · theme · rls · invariant · tbc[5] · test), exit 0.


## 4. Findings ledger

No open findings. The Task-2 class sweep surfaced two siblings (`auth/recover`, `invite`) that
were **fixed in this build**, not deferred. One deployment-config item deferred (below).

## 5. Gates added

None — one shared `moduleLanding` chokepoint prevents the A21 landing divergence structurally.

## 6. Residual queue (A36)

```json
[
  {
    "id": "RES-2026-07-28-AE-01",
    "item": "PasswordInput merges the caller's `style` AFTER its paddingRight, so a caller passing its own paddingRight could re-overlap the eye icon.",
    "why_skipped": "Assumed no caller passes an inline style; felt certain it doesn't matter.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-28T14:40:00Z",
    "outcome": "OPENED. Checked all six call sites: every one styles via className only; none passes a `style` prop, so paddingRight is never overridden and the icon never overlaps. The merge order (`{paddingRight, ...style}`) deliberately lets a caller win IF they ever need to — an intentional escape hatch, not a bug. Confirmed harmless. If a future caller needs a different right padding, they can pass style.paddingRight knowingly."
  },
  {
    "id": "RES-2026-07-28-AE-02",
    "item": "Email-confirm links use Supabase's Site URL (no emailRedirectTo set on signup), so a user confirming via email may land on the configured Site URL rather than resolve their module.",
    "why_skipped": "Deployment-config (Supabase project Site URL / NEXT_PUBLIC_SITE_URL), not code — out of this build's scope.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null,
    "outcome": null
  }
]
```

Top residual opened per A36; opening confirmed the style-merge is a deliberate, harmless escape hatch.

## 7. Hypothesis outcomes

- **H1** (login ignores module) — CONFIRMED and FIXED.
- **H2** (redeem already routes by module; close the A21 split) — CONFIRMED; shared map adopted.
- **H3** (module derivable from sales_coach_role + care_tenant_config, no unified column) — CONFIRMED; resolver built on those levers.
- **H4** (toggle flips type without breaking autoComplete) — CONFIRMED; PasswordInput omits type, spreads all else; 0 raw password fields remain.

## 8. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc`
