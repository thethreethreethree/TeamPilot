# CHECK — meeting dissect non-reasoning model

## Reproduced failure (the real command, on the real transcript)
`node scripts/diag-fm-dissect-llm.mjs`:
```
transcript: 40805 chars, 353 turns, ~10201 tokens
DeepSeek responded in 0.7s
finish_reason: length
usage: {"completion_tokens":8000,"completion_tokens_details":{"reasoning_tokens":8000}}
reasoning_content: 33098 chars   answer content: 0 chars
```
The reasoning model spends the entire completion budget reasoning → 0 answer → the dissect's "transient" empty.

## Verified fix (same real transcript, non-reasoning model)
`node scripts/diag-fm-dissect-fix.mjs`:
```
[A: deepseek-chat FULL] 0.7s finish=stop reasoning_tokens=0 answer=3220chars parses=true decisions=0 actions=12 openItems=4
```
Non-reasoning model answers the full 41-min transcript directly, valid JSON, real content.

## Typecheck: `npm run typecheck`
```
> tsc --noEmit
(clean — exit 0)
```

## Tests: `npx vitest run deepseek.provider.test.ts claude.controlExempt.test.ts src/lib/coach/strategy/meeting/`
```
 Test Files  9 passed (9)
      Tests  63 passed (63)
```
The deepseek reasoning-headroom regression guard + the controlExempt gate tests pass — the `model` field is
additive and the §3.4 gate is untouched.

## Founder content delivered (recovery, real command)
`node scripts/recover-fm-meeting-dissect.mjs`:
```
✅ stored dissect for "9/2 JOHN RAMOS.": 6 decisions, 1 actions, 4 open items
   overall: The meeting produced concrete feature additions … and a plan to build a native iOS app to solve the drop session issue …
```
Stored as the cached `meeting.dissect_generated` event → the review shows it now (independent of deploy).

## Findings
- No findings. Root cause measured, fix verified on the real transcript, sales path unaffected, gate untouched.

## Not claimed
- Vercel deploy of the code change must still be confirmed post-push (local pass does not equal deployed).
