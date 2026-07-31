# CLOSURE — verify:live SECURITY DEFINER search_path guard

## What shipped

`verify:live` now asserts every `public` SECURITY DEFINER function pins its own `search_path` — so a new
definer function added without `set search_path` fails CI instead of quietly introducing a search_path
privilege-escalation vector. Verified live: 115 definer fns, 0 unpinned. 22/22 invariants hold;
detection-tested.

Together with INVARIANT 4 (no client-callable DEFINER tenant-param function), both definer-risk axes are now
guarded: **reachability** (who can call it) and **injection** (what it resolves once called).

## What I relied on that is NOT self-evident (the un-named-reliance half)

- **`proconfig` is where a function's `SET search_path` lives.** The check reads it directly; a function that
  pins via `ALTER FUNCTION … SET search_path` or an inline `SET search_path` in the body both land in
  `proconfig`, so both are recognised.
- **Scope is `public` schema functions.** Functions in other schemas (e.g. `auth`, `extensions`) are outside
  the app's control and out of scope — the check is deliberately scoped to what the migrations own.

## Residual (A36)

```json
[
  {
    "id": "RES-01",
    "item": "The check asserts a search_path is PINNED, not that its VALUE is safe (e.g. 'public, pg_temp' vs a weird value). A pinned-but-odd search_path is theoretically still checkable, but every one of the 115 uses a standard safe value.",
    "why_skipped": "The dominant vector is the UNPINNED case (default mutable search_path); a pinned path removes caller control, which is the escalation lever. Asserting a specific value would be brittle across legitimate variations.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-31T14:43:00Z",
    "outcome": "OPENED + accepted: pinned-vs-unpinned is the security-relevant distinction; the value-check is a lower-value refinement, named so the boundary is explicit."
  }
]
```

## Verification

verify:live 22/22 + detection test (see check.md), exit 0. Full `npm run check` is the CI gate.
