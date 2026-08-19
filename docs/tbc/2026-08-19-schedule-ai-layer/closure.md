# Phase 4 (part 2) — Closure — PHASE 4 COMPLETE

## Verdict
The AI layer is **SHIPPABLE**. With the deterministic resolution search (part 1), **Phase 4 is complete**:
DeepSeek parses requests (parse-then-confirm) and proposes resolutions (recommend + why, warm + plain),
always advisory — never computing the gate, never overriding the verdict.

## Acceptance (build plan Phase 4) — met
- ✅ NL request parsing → structured event, schema-validated before append (never an unvalidated LLM object).
- ✅ Resolution search (part 1, deterministic) finds candidates.
- ✅ Proposal generation explains impact + options + WHY in the founder's voice.
- ✅ Reduced to the verdict, the AI is advisory only — ai.ts imports no predicate/authority.
- ✅ No-error-loop posture: a bad parse fails loud (unclear), never retried into a guess.

## Changed
- Code only, no migration.

## Residual queue (A36 — read from the TOP)
```json
[
  {
    "id": "R4b-1",
    "item": "Does the LLM layer truly stay advisory (no gate computation, no verdict override)?",
    "why_skipped": "Most sure it does, so opened per A36.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-19T03:30:00Z",
    "outcome": "OPENED + confirmed: ai.ts imports only llmCall, the fence, stripAiDashes, and eventSchema — NOT constraints.ts or authority.ts. It cannot compute coverage/eligibility or override the verdict; it only phrases inputs handed to it. Advisory by construction."
  },
  {
    "id": "R4b-2",
    "item": "parse currently handles time_off only (not assign/swap NL requests).",
    "why_skipped": "The build-plan section 5.1 pipeline is the time-off request; other NL intents are additive (extend PARSE_SYSTEM + parseLlmOutput). Employee-facing swap/assign requests arrive with the Phase-6 employee UI.",
    "confidence_it_does_not_matter": "medium",
    "opened_at": null
  },
  {
    "id": "R4b-3",
    "item": "No live end-to-end LLM test (the tests inject a mock llm).",
    "why_skipped": "The LLM is non-deterministic; unit tests inject it (correct). A live smoke against DeepSeek belongs to the Phase-5 wiring / Phase-8 hardening, where a real request round-trips through the UI.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```

## Checkpoint
**Phase 4 complete.** The deterministic core (Phases 1-3) + the AI layer are done. **Phase 5 (Manager/Admin
Interface) is next** — the first user-facing surface: the schedule builder, the coverage editor, the time-off
review queue (verdict + proposal + candidates), employee CRUD, and the **file upload (PDF/Excel/CSV, S3)**.
That is a large UI phase; ready on your go.

## Verification
See `check.md` — the `npm run check` block (A38).
