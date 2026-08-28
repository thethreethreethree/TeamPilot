# CHECK — Role Play from a recorded pitch

## Gate — the canonical command (A38)
```
$ npm run check     # tsc --noEmit && eslint && theme:audit && rls:audit && invariant:audit && tbc && test
> typecheck / lint / theme:audit / rls:audit / invariant:audit (0 violations) — pass
> tbc:docs / tbc:manifest / tbc:artifacts / tbc:residual / tbc:freshness — pass
> test   Test Files  591 passed | 1 skipped (592)
        Tests  3894 passed | 15 skipped (3909)
PIPE_EXIT=0
```

## What the tests lock (A30)
- `practiceScenario.test.ts` — the pitch-replay SYSTEM prompt enforces: reconstruct from what the CUSTOMER actually
  said (no invented objections), never name a skill / break character, and infer speakers from the unlabeled
  transcript (the non-diarized reality). The USER message embeds the transcript + outcome and CLAMPS a very long
  transcript (token budget). `parsePracticeScenario` (reused) still returns null on empty → plain-roleplay fallback.

## What the invariant audit covers (reused contracts)
- The new LLM route exports `maxDuration`, appends the CONVERSATION_IS_DATA injection fence, is auth+company gated,
  and returns generic errors (no raw .message leak) — same posture as the sibling practice-scenario route.

## Not unit-gated (founder visual-verify)
- The model's reconstruction quality over a REAL non-diarized pitch (an LLM judgement). The client `?pitchId=` seed
  and the "Role play" CTA render (client pages have no jsdom harness here). The prompt rules + null fallback + the
  route contract ARE gated (unit + typecheck + invariant audit).

## Findings
No findings — the feature reuses the roleplay engine unchanged, gates the honesty seam (faithful reconstruction +
null fallback), and preserves RLS (a pitch you can't see is a 404) and the ephemeral-roleplay contract.
