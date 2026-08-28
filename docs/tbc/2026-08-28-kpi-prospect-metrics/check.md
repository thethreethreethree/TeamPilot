# CHECK — Follow-up rate + Sales cycle

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  591 passed | 1 skipped (592)
        Tests  3891 passed | 15 skipped (3906)
PIPE_EXIT=0
```

## Live probe (the metrics produce real values)
Read-only probe against prod DB (temp script since deleted):
```
client_label: 96% of sessions populated · reused across sessions (45 of 136 labels recur)
  Johns  32 prospects · follow-up 25%    · sales-cycle building (0 sold)
  Moses  37 prospects · follow-up 29.7%  · sales-cycle 0.1 days
  others 25-36% follow-up · sales-cycle building (<5 sold prospects)
```

## What the tests lock (A30)
- prospectKeyOf normalization (trim/case/whitespace; blank/non-string → "").
- followUpRate: distinct prospects, re-contacted = >1 session, unlabeled excluded, gate below MIN_SESSIONS.
- salesCycleLengthDays: avg first→sold days over SOLD prospects, single-session sale = 0, never-sold excluded,
  gate below MIN_SESSIONS sold prospects (never fabricates a cycle).

## Not unit-gated (founder visual-verify)
- The two tiles rendering their values (and the `days` format) on the /kpi page. The compute + gates ARE unit-gated.

## Findings
No findings — derived from existing client_label (no new capture), honest proxy framing, both gate correctly;
follow-up rate live, sales cycle honestly thin (correct §3.4 behavior).
