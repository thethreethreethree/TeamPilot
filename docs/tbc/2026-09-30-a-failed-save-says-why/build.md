# BUILD — a failed save says why, and stops paying

### The two causes of a failed save are told apart

- **write-path:** `storePitchScore` returns `StorePitchScoreResult`: `{ ok: true, pitchId }` or
  `{ ok: false, cause: "no_evidence" | "database" }`. `scoreSession` maps `no_evidence` to the new refusal
  `no_evidence`, and `database` to `store_failed`. The database's own message is still only logged (CWE-209).
- **read-path:** `storePitchScore.test.ts` asserts each cause (RPC error, an RPC reply with no id, no element
  honoured, success); `scoreSession.test.ts` "a failed save says which kind it was" (3).

### A drain stops on two database refusals in a row

- **write-path:** `backfill/route.ts`: `storeFailedRun` counts consecutive `store_failed`, and any other outcome
  resets it. At `STORE_FAILED_HALT = 2`, set `haltedBy = "store_failed"`, `more: false`, and its own note:
  "2 recordings in a row were graded but could not be saved, so the run stopped rather than keep paying to
  grade scores it cannot keep. This is a fault on our side, not your recordings — please report it."
- **read-path:** backfill `route.test.ts`: "database refusals in a row stop the run and say so" (2): stops
  after 2 of 5; with the sequence fail, scored, fail, no-speech, all 4 run and there is no halt.

### Every refusal reads as a sentence with the count first

- **write-path:** `UnscoredBacklog.tsx` `REFUSAL_LABEL` is now `Record<ScoreRefusal, string>` and exported. The
  four dangling labels (llm_empty, parse_failed, errored, provider_out_of_credit) are rewritten, and store_failed
  and no_evidence are added. The route status map gains `no_evidence: 502`.
- **read-path:** `UnscoredBacklog.render.test.tsx`: no label ends on a preposition or starts with "the"; a run
  with `store_failed: 2` renders "2 were graded but could not be saved (a fault on our side)".

### Who consumes the reason codes

- **write-path:** `finalize/route.ts` only logs `reason` and `humanMessage`. The app repo has no reference to
  these codes (grep `store_failed|parse_failed` in `IOS-APP/Elostate-Sales-coach/src`: none).
- **read-path:** `npx tsc --noEmit` exit 0 is what proves every `Record<ScoreRefusal, …>` carries the new key.
