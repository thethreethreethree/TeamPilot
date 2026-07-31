# CLOSURE — auth gate on diagnosis/close

## What shipped

`diagnosis/close`, the close-the-loop route that writes to the append-only resolutions + events
chain (Rule 3.1), now requires a signed-in user before reaching `close_problem()` — sibling-parity
with `outside-view` / `ripple-trace`. The change is a no-op for the real (authenticated dashboard)
caller and closes the latent anon / cross-tenant path that had no route-layer defense.

## What I relied on that is NOT self-evident (the un-named-reliance half)

- **Live DB state, not migration text:** the "safe today" claim rests on `close_problem` being
  `prosecdef = false` and on `problems` having company-scoped RLS — both read from the live catalog
  this session, not inferred from files. If either changes (the function is made DEFINER, or the
  RLS is loosened), the route-layer gate this build adds is what keeps it closed. That is the whole
  point of the fix: the safety no longer *depends* on those two DB properties holding.
- **Caller enumeration:** the "no-op for the real caller" claim relies on the grep for
  `diagnosis/close` callers being complete — one non-test caller found (`dashboard/diagnose`). A
  future caller from an unauthenticated surface would (correctly) now get a 401 rather than silently
  writing.

## Residual / not addressed here

- The BROADER RLS-only-route class is only sampled, not swept: this build hardened the one route the
  no-auth sweep surfaced on the sensitive append-only chain. Other INVOKER-function routes that lean
  on RLS were judged out of scope for this fix (they are not on the immutable-event spine). A
  structural guard ("every non-public mutation route asserts auth before a write") would be the A30
  gate form — filed as a follow-up thought, not built here (would need an allowlist for the
  intentionally-public routes: widget, demo, pilot, webhook, refresh).
- The two 🔴 finance findings (definer-revoke, finance-views) remain founder-gated and untouched.

## Verification

Route suite is 6-of-6 with the pasted command output + exit code 0 recorded in check.md. Full
`npm run check` is the CI gate that will run tbc + typecheck + lint + invariants + the whole test
suite on this commit.

## Residual (A36)

```json
[
  {
    "id": "RES-01",
    "item": "The broader 'RLS-only mutation route = latent tenant gap' class is only sampled, not swept. This build hardened the one route the no-auth sweep surfaced on the append-only chain; other INVOKER-function routes that lean on RLS were not individually re-audited this build.",
    "why_skipped": "Scope discipline: the fix targets the one route on the immutable-event spine. A full sweep of every INVOKER-backed route is a separate, larger audit, and every currently-known such route fails closed today via company-scoped RLS (verify:live confirms no permissive read/write policy exists).",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-07-31T10:42:00Z",
    "outcome": "OPENED. Re-checked the live policy surface: verify:live's permissive-read + permissive-write invariants (added this session) already fail the build if ANY company_id table gains a using(true) policy, so the whole class fails closed at the DB layer regardless of route-level defense. The route-level gap is defense-in-depth, not an active hole. The durable fix would be a structural guard (RES-02); filed, not built here."
  },
  {
    "id": "RES-02",
    "item": "No structural guard asserts 'every non-public mutation route checks auth before its first write'. The diagnosis/close gap was caught by a manual sweep + sibling-asymmetry, not a gate.",
    "why_skipped": "A38/A30 gate form would need an allowlist for the intentionally-public routes (widget, demo, pilot, webhook, extension/refresh, the secret-gated sweeps) — a non-trivial, judgment-laden allowlist that should be built deliberately, not bolted onto this fix. The detection test locks THIS route; the class guard is the follow-up.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null,
    "outcome": "Deferred to the founder queue as a proposed invariant (INV18 candidate). Named here so the absence is on the record, not silent."
  },
  {
    "id": "RES-03",
    "item": "The two founder-gated finance findings (definer-revoke, finance-views) are untouched by this build.",
    "why_skipped": "Out of scope + founder-gated (finance migrations). This build is a diagnosis-domain route fix, orthogonal to the finance surface.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-07-31T10:42:00Z",
    "outcome": "OPENED + confirmed orthogonal: diagnosis/close touches problems/resolutions/events, not any fin_* object. No interaction. They remain the highest-value open items, tracked in FOUNDER-ACTION-QUEUE."
  }
]
```
