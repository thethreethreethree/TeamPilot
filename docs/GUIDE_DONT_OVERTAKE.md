# Guide, don't overtake — implementation rule

> Implements [CLAUDE.md §3.3](../CLAUDE.md). The product behavior every AI surface must
> follow. The Decision Engine is the pilot; on validation, this rule propagates to the
> analyzers, the briefing, and the conversation summarizer.

## The four phases

Every AI surface that *could* assert a judgment must instead route through this sequence.
The user is structurally present in the diagnosis before the System speaks.

### Phase 1 — Situation
The user (or upstream data) presents the situation. The System is silent. This is
input-only — describe, don't yet ask.

### Phase 2 — Elicit (the structural interrupt)
The System asks the user TWO things, and refuses to proceed until both are filled:

1. **"What do you think is actually going on?"** — the user's diagnosis, in their words.
2. **"What would you do, and why?"** — the user's proposal, including their reasoning.

This is the rule's structural interrupt. The System does not generate Safe/Balanced/
Aggressive options here. The "options" framing presupposes the answer space exists
independent of the user — that's already overtaking. The user's proposal *is* the first
option on the table.

### Phase 3 — Respond
The System replies in a deliberate shape. It must contain, in this order:

1. **Engage the user's diagnosis.** What part of the user's read does the System share?
   Cite the user's words. If the System disagrees, name the disagreement; do not silently
   override.
2. **Add perspective if any.** Anything the System sees that the user didn't surface —
   framed as additional perspective, not replacement.
3. **Offer a suggestion with WHY.** A concrete proposal *and* the explicit reasoning. The
   why is the transferable asset (Rule 2). A proposal without a stated why is incomplete.
4. **Compare to the user's proposal.** Where the System and user align, where they
   diverge, what the divergence suggests.

The System must NEVER:
- Lead with its own diagnosis before engaging the user's
- Frame its suggestion as "the recommendation" or "the right answer"
- Generate canned tiers ("Safe / Balanced / Aggressive") that bypass the user's actual
  proposal

### Phase 4 — Decide and record
The user picks: accept their own, accept the System's, hybrid, or defer. **The dialogue
that produced the decision is recorded**, not just the outcome. The why must survive past
the moment.

## What this means in code

A `claude.ts` function under this rule has a different shape from one that doesn't:

- **Required inputs** include the user's diagnosis and the user's proposal. Calling it
  without them is a type error, not a soft check.
- **The system prompt** explicitly tells Claude to engage with the user's input first.
- **The output structure** mirrors Phase 3 (engagement, perspective, suggestion-with-why,
  comparison).

```ts
// WRONG — function asserts before asking
generateDecisionOptions(situation: string): { options: { safe, balanced, aggressive } }

// RIGHT — function structurally requires user participation first
proposeDecisionDialogue(args: {
  situation: string;
  userDiagnosis: string;     // required by type system
  userProposal: string;      // required by type system
}): {
  engagement: string;        // what System agrees with from user
  addedPerspective: string;  // what System sees that user didn't
  suggestion: { action: string; why: string };
  comparison: string;        // where System and user align/diverge
}
```

## Propagation checklist

The pilot (Decision Dialogue) is built but **not yet validated** per Rule 4. Propagation
of the new pattern to other surfaces is blocked on that validation. In parallel,
*violations of the OLD pattern* can and should be stripped — that is removal, not
propagation, and does not require validation.

### Removed (violating panels stripped — 2026-05-16)
- [x] Operations: pre-filled "Critical bottleneck detected" panel → `AwaitingEvidence`
- [x] Finance: pre-filled "Runway under 8 months" panel → `AwaitingEvidence`
- [x] Marketing: pre-filled "Paid channels underperforming" panel → `AwaitingEvidence`

### Propagated (2026-05-16)
- [x] `analyzeConversation` → `analyzeConversationDialogue` — user's read required
      before the System extracts; refined items each carry an explicit WHY
- [x] `generateDailyBriefing` → `generateDailyQuestions` — surfaces questions and
      uncertainties, never "recommended actions". Command Center retitled "Today's
      Open Questions"

### Pending propagation (blocked on pilot validation)
- [ ] `analyzeOperations` / `analyzeFinance` / `analyzeMarketing` rewritten to elicit
      user's read first, then offer System's perspective
- [ ] All "Run Diagnosis" buttons in the dashboard pages gated behind a Phase-2 form
- [ ] Validation gate: run both flows (old and new) on the same situation, measure
      adoption / modification / reopen rate

## Validation gate (Rule 4)

This pattern is "learned" only when measured against the alternative on a real case:

1. Run both flows (old `generateDecisionOptions` and new `proposeDecisionDialogue`) on the
   same situation.
2. Measure: did the user accept the System's suggestion verbatim, modify it, or reject it?
3. Measure: did the user's *own* proposal change after seeing the System's response (good —
   the dialogue did work) or stay identical (suggesting the System added nothing)?
4. Measure: in retrospect (resolution outcome), which path produced a more durable
   decision?

Until those measurements exist, the new pattern is **proposed**, not **proven**. The
constitution refuses to believe its own evolution until results prove it (§7.5).
