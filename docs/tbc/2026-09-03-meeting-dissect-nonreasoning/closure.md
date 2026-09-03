# CLOSURE — meeting dissect non-reasoning model

## What shipped
The long-meeting review returned empty because the DeepSeek REASONING model (deepseek-v4-flash) spends its entire
8000-token completion budget on reasoning for a long transcript and emits zero answer (measured: 41-min meeting →
8000 reasoning tokens, 0 answer → the dissect's "transient" empty). Fix: thread an optional per-call `model`
override through the LLM layers and route the MEETING dissect to the non-reasoning `deepseek-chat`, which answers
the full transcript directly (verified on the real transcript). Sales dissect unchanged; the §3.4 control gate
untouched. The founder's meeting content was also generated + stored via the non-reasoning model so the review
shows now (6 decisions, 1 action, 4 open items).

## Verification (A38)
The failure was reproduced and the fix was confirmed on the founder's real transcript — both command outputs
pasted in check.md. `npm run typecheck` clean; 63/63 vitest across the provider + gate + meeting suites. Founder
content stored (real command output pasted in check.md).

## The un-named reliance
- Relies on `deepseek-chat` remaining a valid non-reasoning DeepSeek model (verified live 2026-09-03).
- Relies on the Anthropic provider IGNORING an unknown `args.model` (it uses ANTHROPIC_MODEL) so a cascade is safe.
- Relies on MeetingReview reading `openItems ?? open_items` (it does, line 171) so the stored event renders.

## Residual (A36 — explicit)
```json
[
  {
    "id": "DISS-R1",
    "item": "No unit/drift-guard test pins that the MEETING dissect passes the non-reasoning model. A future refactor could drop the `model` arg and silently re-starve long meetings (A30 — a fix in code alone can regress).",
    "why_skipped": "The fix + its verification shipped under founder-urgent recovery; the guard is a fast follow.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T08:30:00+08:00",
    "outcome": "OPEN — add a test asserting generateMeetingDissect calls dissectCoachV5 with model=DEEPSEEK_NONREASONING_MODEL."
  },
  {
    "id": "DISS-R2",
    "item": "The sales dissect on a very long (rare) call could hit the same starvation, since it keeps the reasoning model.",
    "why_skipped": "Sales calls are far shorter than meetings; no evidence of the failure there. The same override is now available if needed.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": "2026-09-03T08:30:00+08:00",
    "outcome": "OPEN — watch for sales 'Your read' empties on long calls; apply the same override if they appear."
  }
]
```
