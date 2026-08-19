# Phase 4 (part 2) — Build

## Built
| path | what | clause |
|------|------|--------|
| `src/lib/schedule/ai.ts` | The LLM layer. `parseRequest` (NL → structured DRAFT, fenced, parse-then-confirm) + `parseLlmOutput` (deterministic, fail-loud) + `buildTimeOffEvent` (schema-validated before write) + `generateProposal` (recommend + why, warm + plain, dashes stripped). Reuses llmCall + CONVERSATION_IS_DATA + stripAiDashes + eventSchema. The LLM never computes the gate or overrides the verdict. | §5, §3.3, §3.4, A40 |
| `src/lib/schedule/__tests__/ai.test.ts` | 8 tests (LLM injected): fail-loud parse, schema-validated build rejects a bad type, the fence is in the prompt + expectJson set, the proposal strips em/en dashes + carries the top candidate as the recommendation. | A30 |

## Founder voice (picker 2026-08-19)
Recommend + why · parse-then-confirm · warm + plain (no em/en dashes).

## Features (reachability inventory)

### natural-language request parse
`parseRequest` → a structured DRAFT a human confirms before any write.
- write-path: EXISTS — a staff member types a request; the fenced LLM parse returns a draft; buildTimeOffEvent validates it; the CONFIRMED event is appended via the Phase-1 append API. human_can_set: true.
- read-path: EXISTS at the library altitude (tested with an injected llm); the runtime consumer is the Phase-5 request-entry UI (shows the interpretation to confirm). human_can_see: true (via that UI).

### AI proposal
`generateProposal` → the manager-facing recommend-with-why for a coverage gap.
- write-path: EXISTS — built from the deterministic impact + findResolutions candidates (a human's change produced the gap). human_can_set: true.
- read-path: EXISTS at the library altitude (tested); the runtime consumer is the Phase-5 review queue (shows the proposal + verdict to the manager). human_can_see: true (via that UI).

## Step 7 — Reachability (A31) honest note
Advisory layer, proven at the library altitude with an injected llm. Its runtime surface (Phase-5 request-entry
+ review UI) is the next phase. Not claimed as an end-user surface here.
