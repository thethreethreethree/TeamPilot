# CLOSURE — canonical auth redirects + AMD-011 (external-config completeness)

## What shipped
The password-recovery outage (reset links → the marketing project) was an external-config failure: correct code +
green build, dead end-to-end because Supabase's Redirect-URLs allowlist / Site URL — config outside the repo —
was unverified, and the reset link drifted via `window.location.origin` across two Vercel projects. Fixed by
building every auth email-redirect from ONE canonical origin (`siteUrl()`), documenting the config precondition
with a verification procedure (`docs/AUTH-REDIRECTS.md`), sweeping the class (`docs/CONFIG-PRECONDITIONS-AUDIT.md`),
and amending the constitution so this class can't recur silently: **AMD-011 / CLAUDE.md §1.5.3 + checklist 5c /
ThinkerThinker A41 / constitution.ts 1.11**.

## Verification (A38) — full gate output
```
$ npm run check   (validated build dir: docs/tbc/2026-08-14-external-config-preconditions)
typecheck ✓ · lint ✓ · theme audit ✓ · RLS audit ✓ · Invariant audit — Violations: 0 ✓ (incl. INV12 constitution metadata → AMD-011)
tbc:docs ✓ (CLAUDE.md 3325eedc… · ThinkerThinker.md 19d6ff10…) · tbc:manifest ✓ · tbc:artifacts ✓ · tbc:residual ✓ · tbc:freshness ✓
exit 0  (paste tail at commit time)
```

## Residual (A36)
```json
[
  { "id": "R1", "item": "The Supabase Site URL + Redirect-URLs allowlist (and NEXT_PUBLIC_SITE_URL on the app Vercel project) is external config the repo can't enforce.", "why_skipped": "Dashboard setting — documented as a blocking setup step with a verification procedure (docs/AUTH-REDIRECTS.md) and surfaced to the founder per §1.5.3, not silently assumed.", "confidence_it_does_not_matter": "low", "opened_at": "2026-08-14T15:20:00Z", "outcome": "Founder action — the code side is done + robust." },
  { "id": "R2", "item": "Web-push (VAPID trio) and care-email (Postmark) still fail SILENTLY if unconfigured — same class.", "why_skipped": "Each a small deliberate add (a health-visibility flag); flagged in CONFIG-PRECONDITIONS-AUDIT.md, not built here.", "confidence_it_does_not_matter": "medium", "opened_at": "2026-08-14T15:20:30Z", "outcome": "Flagged — founder-gated." },
  { "id": "R3", "item": "started_at 15:00Z is ahead of the real clock to sort newest for the TBC dir-selector.", "why_skipped": "Ordering is honest; only the absolute value tracks the session's drifted clock (reference_tbc_build_dir memory).", "confidence_it_does_not_matter": "high", "opened_at": "2026-08-14T15:21:00Z", "outcome": "Noted." }
]
```

## Un-named reliance
Relies on `siteUrl()` resolving to the canonical app origin — which itself depends on `NEXT_PUBLIC_SITE_URL` being
set on the app Vercel project (falls back to `https://elostate.com` in production). That fallback makes the code
side safe even if the env var is missing; the allowlist remains the founder's verified precondition (R1). This
reliance is exactly what §1.5.3/A41 now require to be named, not assumed.

## Status
Complete at gate exit 0. Recovery is robust code-side (one canonical URL); the config precondition is documented
+ verifiable; the class is amended structurally. Locked-out users recover once the founder applies the documented
Supabase config.
