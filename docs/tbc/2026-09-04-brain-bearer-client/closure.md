# CLOSURE - brain reads the company's own config with the service client

## What shipped
Every AI feature in the mobile app failed with a 502 while the same account worked in a browser.
`loadBrain()` and `loadControlGate()` resolved their Supabase client from COOKIES; a Bearer caller
sends none, so the client was anonymous, RLS returned nothing, and both threw. `extension/suggest`
caught it as a non-LLM failure and answered 502 - so a healthy account with healthy data
(`company_brain` at version 4, `ai_guidance_enabled` true) presented as a broken model. Both loaders
now use the service client to read the company's own config, ripple-traced across all three callers.

Separately, `sales-session/roleplay` ran everything after `readBody` outside a try and returned a bare
500 with an empty body. It now answers through the shared `llmErrorResponse` taxonomy.

## Verification (A38)
The CANONICAL gate, run whole rather than a self-chosen subset:

```
$ TBC_BUILD=2026-09-04-brain-bearer-client npm run check
  typecheck . lint . theme:audit . rls:audit . invariant:audit . tbc . test
  invariant audit: 997 files scanned, 0 violations
  tbc: docs, manifest, artifacts, residual, freshness -- five of five clean
  Test Files  621 passed | 1 skipped (622)
       Tests  4099 passed | 15 skipped (4114)
EXIT_CHECK=0
```

The SS3.4 control gate was mutation-tested
after the mock change and still fails correctly when suppression is disabled (transcript in check.md).

## The un-named reliance
- Relies on every current caller resolving `companyId` server-side. True of all three today, checked
  one by one; the assumption is documented at the read site rather than left implicit.
- Relies on `SUPABASE_SERVICE_ROLE_KEY` being present wherever brain runs. It already gates all Bearer
  authentication, so its absence would break far more than this and is not a new dependency.
- The mobile app cannot be confirmed fixed until this is deployed. Stated plainly rather than implied.

## Residual (A36 - explicit)
```json
[
  {
    "id": "BRAIN-R1",
    "item": "Twelve other files under src/lib read data with the cookie client (v5/debrief, v5/memory, data/doorlog, data/dissect, brain/learn and others). Any of them reached by a Bearer caller fails the same way.",
    "why_skipped": "Only the brain path was proven broken by reproduction. Changing twelve files on suspicion would be a large unverified auth change during a live outage.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-04T15:40:00+08:00",
    "outcome": "OPEN - sweep each for reachability from a Bearer-authenticated route and fix the reachable ones."
  },
  {
    "id": "BRAIN-R2",
    "item": "sales-session/roleplay's underlying exception is still unidentified; this build makes it report rather than removes it.",
    "why_skipped": "The cause is invisible from the repo. The wrap surfaces the real error on the next request, which identifies it without guessing.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-09-04T15:40:00+08:00",
    "outcome": "RESOLVED 2026-09-04T16:10+08:00 - and this build's HYPOTHESIS WAS WRONG. The probe was re-run after deploy and roleplay returned 200 with a real prospect turn. It was never an Anthropic fault: src/lib/claude.ts line 4 imports runBrainCall, so dissectCoachV5 -> call() -> runBrainCall -> loadBrain reached the SAME cookie client this build fixed. The earlier trace read only the route file and missed the indirection through claude.ts - the exact across-modules blind spot A21 names, missed in the audit that cited A21. The real blast radius was the 35 routes importing @/lib/claude, not one. Verified individually after deploy: extension/suggest, roleplay, coaching-material and practice-scenario/from-pitch all return 200."
  }
]
```
