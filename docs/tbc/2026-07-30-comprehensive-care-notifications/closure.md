# CLOSURE — C.A.R.E Notifications (comprehensive settings, pillar 3)

## 1. Session-read manifest

13 entries in think.md (this-session read_at). Clauses: CLAUDE.md §0, §0.1, §1.5.1, §1.5.2, §6;
ThinkerThinker.md A19, A22, A24, A28, A30, A31, A34, A38.

## 2. Build inventory (reachability per A31)

| Element | write path | read path | status |
|---|---|---|---|
| Customer-reply opt-out | panel → PATCH /api/me/care-notifications → profiles column | careNotify reads pref → skips push on false | BUILT |
| A34 degrade | route 409/degraded if column absent | careNotify sends on any pref-read error | BUILT |

## 3. Verification record (A38)

```
> npx tsc --noEmit -p tsconfig.json                 TSC_EXIT=0
> vitest run careNotify.test.ts                      8 passed
> npm run db:apply                                   DB now at 0204
> npm run verify:live                                ALL 14 invariants hold
```

## 4. Un-named reliance

careNotify uses the ADMIN client to read the assigned agent's pref (RLS-bypassing) — correct, because it is
a server decision about whether to push THAT agent, not the agent acting on their own row. If this read were
ever moved to a user-scoped client it would return null for a different agent and silently notify everyone.

## 5. Residuals (A36)

```json
[
  {
    "id": "RES-2026-07-30-CARE-NOTIF-01",
    "item": "Live end-to-end click-through (toggle off → a real customer reply produces NO push on a device) is not exercised.",
    "why_skipped": "Needs a device with push (VAPID) configured + a live customer reply.",
    "confidence_it_does_not_matter": "low",
    "opened_at": "2026-07-30T14:20:00Z",
    "outcome": "OPENED — the gating is unit-proven (8/8) at the exact send chokepoint; the residual is the physical push delivery, which depends on VAPID env + a subscribed device (separate, pre-existing infra)."
  }
]
```

## 6. Hypothesis outcomes

- **H1** (one toggle wired to the one real event → not a fake toggle) — CONFIRMED (8/8, read-at-send).
- **H2** (A34 + default true → zero change pre-apply / for unset users) — CONFIRMED (tests).
- **H3** (0204 additive/safe → verify:live 14/14) — CONFIRMED.

## 7. Doc hashes

- CLAUDE.md — `e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f`
- ThinkerThinker.md — `0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc`
