# Phase 4 (part 1) — Closure

## Verdict
The deterministic resolution search is **SHIPPABLE**. It reuses the single authority (A40), so a proposed
candidate can never be one the approval gate would reject. Phase 4's LLM half is deferred to a founder
voice decision.

## Acceptance (build plan section 5.1 step 5) — met
- ✅ A coverage gap triggers a SEARCH for eligible/available/under-hours employees, not a bare deny (§2).
- ✅ Candidates validated through evaluateChange (A40 — same condition as approval; no drift).
- ✅ Deterministic + unit-tested (fair-load ranking, exclusion of unavailable, honest empty).

## Changed
- Code only, no migration.

## Residual queue (A36 — read from the TOP)
```json
[
  {
    "id": "R4-1",
    "item": "The resolution search relies on evaluateChange for eligibility — is that reuse real, or does it re-derive?",
    "why_skipped": "Most sure it reuses, so opened per A36.",
    "confidence_it_does_not_matter": "high",
    "opened_at": "2026-08-19T03:00:00Z",
    "outcome": "OPENED + confirmed: findResolutions calls evaluateChange({kind:'assign'}) per candidate and keeps only `approvable` ones — it does NOT re-implement eligibility/limits. Single source (A40) holds through the search."
  },
  {
    "id": "R4-2",
    "item": "The LLM half of Phase 4 (NL parse + proposal generation) is not built.",
    "why_skipped": "Its VOICE (tone/approach of the AI's impact explanation + proposal) is a §3.3 guide-don't-overtake decision the founder owns — surfaced as a picker, not chosen autonomously. The plumbing (llmCall + CONVERSATION_IS_DATA fence + eventSchema validation) is ready.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  },
  {
    "id": "R4-3",
    "item": "Ranking uses fair-load (current hours ascending). Richer soft-preference weighting (continuity, stated availability) is not yet applied.",
    "why_skipped": "fairnessScore + availability exist (Phase 2 / the projector); composing a weighted soft-score into the ranking is a refinement for when the proposal UI (Phase 5) shows trade-offs.",
    "confidence_it_does_not_matter": "low",
    "opened_at": null
  }
]
```

## Checkpoint
Deterministic resolution search proven. **Phase 4's LLM half awaits the founder's voice decision** (the
AI's proposal tone — see the picker). Then: parse (NL → validated event) + propose (impact + options + WHY),
both reusing llmCall + the injection fence, the LLM never overriding the deterministic verdict (§5).

## Verification
See `check.md` — the `npm run check` block (A38).
