# CHECK — CARE readout unbounded-select paging

## Verification run (A38 — canonical command + exit code)
```
$ npx vitest run "src/lib/data/__tests__/care" "src/app/api/care"
 Test Files  64 passed (64)
      Tests  309 passed (309)
VITEST_EXIT=0
$ npm run check
  Violations: 0
 Test Files  392 passed | 1 skipped (393)
      Tests  2711 passed | 15 skipped (2726)
CHECK_EXIT=0
```
The `fetchCoachRubricReadout` DB-mock test (4 conversations) is unchanged — a short first page ends
fetchAllPaged after one page, so small datasets are byte-identical; only >1000-row accounts change (from a
truncated, wrong cohort split to a complete one).

## Findings

### F1 — four CARE §3.5 readouts silently truncated their cross-conversation aggregation at 1000 rows
file+line: `src/lib/data/care.ts` — `fetchCoachRubricReadout` (~1886), `fetchVoiceValueReadout` (~2059), the co-pilot-usage readout (~2183), the durability readout (~2637), all pre-fix.
class: unbounded `.select()` silently capped at PostgREST max_rows=1000 → wrong derived classification on high-growth tables (the recorded `unbounded_select_silent_truncation_1000cap` class).
severity: medium — analytics correctness on active accounts; not user data loss, but a §3.5 measure-wrong on the readouts that grade the method. Two also swallowed the read error into an empty result (§3.4).
sweep-command: `grep -nE "\.in\(.conversation_id" src/lib/data/care.ts` — found four cross-conversation aggregations; all four fixed. (Insert/single-conversation selects are out of this class — see the residual.)

## Audit-clean (non-defect) — the single-conversation thread loads
The thread-load selects (`getCareConversationByToken` thread ~297, `fetchAgentConversation` thread ~726) are
ALSO unbounded, but they load ONE conversation ordered by created_at. A single support thread rarely exceeds
1000 messages, and the correct fix is a UX pagination design (load latest N + "load older"), not fetchAllPaged
(pulling a 5000-message thread into memory is its own problem). Carried to the residual as a separate,
lower-priority item — not fixed here to avoid a half-measure.
