---
started_at: 2026-09-21T19:30:00+08:00
trigger: The dispute loop shipped with no way to act on a dispute. A manager who agrees with a rep could only say so in words; the score did not move. The founder chose "element-level override, logged" from the picker, and the rubric PDF (p.7) independently specifies it.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — a dispute nobody can act on teaches the rep to stop disputing

## Why (the record)

The Pitch Score dispute loop was built earlier today. A rep can flag an item they think was scored
wrongly; a manager sees a queue and can answer. That is where it stopped.

The gap was not subtle once stated: **the most common real dispute is one the manager agrees
with.** The rep says "I did mention the trucks, listen at 3:12", the manager listens, and the rep
is right. The only thing the system could do with that was type a reply. The score stayed wrong.

Two consequences, and the second is the expensive one:

1. The leaderboard keeps a number everyone involved now knows is wrong. Since the founder settled
   on 2026-09-11 that presentations are counted from `doors_knocked − no_answer`, these totals feed
   a competition — a known-wrong score is not cosmetic.
2. **"You're right" followed by a score that does not move teaches a rep that disputing is
   theatre.** A rep who stops disputing takes the scorer's only correction signal with them. The
   dispute queue is the one place this system hears that its own model was wrong, and it would go
   quiet for the most avoidable reason possible.

This is §3.6 inverted. Making learning visible is a product requirement; a correction channel that
visibly changes nothing is worse than not having one, because it demonstrates the opposite.

## What the record already decided, so I do not re-decide it

Checked before designing, because the last four defects in this feature were all decisions that
already had an authority (§2.2):

| Question | Already decided by | Verdict |
|---|---|---|
| Can managers override? | rubric PDF p.7 | "Manager override: managers can adjust any bonus or violation, with the change logged." |
| Element grades too? | founder, picker, 2026-09-21 | "Element-level override, logged" — a superset of the PDF |
| Who is a manager? | `isSalesCoachManager` via `requireSalesCoachManager` | consume the verdict; do not re-express the predicate |
| What band is a total? | `gamification/bands.ts` | the local copy shipped this morning and disagreed with the rep's own Arena |
| How is a score computed? | `scorePitch` | including Delivery 27→35, the +30 cap, the zero floor, the 40-base test |

## The decision that matters: where the arithmetic lives

The obvious build is a SQL function that takes the corrected item and recomputes the totals. I
wrote that version first, and it is wrong.

It would restate, in a second language, six decisions that already have authorities:

```
the element → section mapping          rubric.ts
the Delivery 27→35 scaling rule        scorePitch.ts
the +30 bonus pool cap                 scorePitch.ts / rubric.ts
the formula and its zero floor         scorePitch.ts
the 40-base qualifying test            scorePitch.ts / rubric.ts
the band boundaries                    gamification/bands.ts
```

All six would agree **on the day they were written**, which is precisely what makes this class
invisible (§2.2 / A40). A later rubric change lands in TypeScript and silently does not land in
SQL, and the pitch a manager corrected becomes the one pitch in the system scored under the old
rules — the hardest possible defect to notice, because it only affects pitches somebody already
believed were wrong.

This session has now found that exact shape four times (the manager predicate, `lowestSectionId`,
`bandFor`, the `pitches` table name). Writing it a fifth time knowingly would be indefensible.

**So: the caller reads the evidence, applies the correction in memory, recomputes through
`scorePitch` — the same function that produced the original score — and passes the finished verdict
to SQL. The function writes. It does no arithmetic.**

## Workflow continuity (§1.5.1 layer 3)

Before: a manager is in the dispute queue looking at a rep's claim, with the pitch's evidence in
front of them.

After: they must be able to *act* without leaving that context, and the rep must be able to *see*
that it happened. An override the rep cannot see is a silent correction — which is the thing
"with the change logged" exists to prevent, so the read path is not a nicety, it is the
requirement. That makes the rep-visible override list part of layer 2, not layer 4 (§1.5.4).

## Session-read manifest

```json
[
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-338", "read_at": "2026-09-21T19:35:00Z",
    "why_it_governs": "An authority returns a verdict; consumers branch on it and never re-derive the decision from the raw inputs it already judged. Duplicated conditions drift.",
    "how_this_build_will_embody_it": "This is the clause that killed the SQL recompute. The plpgsql version would have re-derived six decisions that already have authorities — the section mapping, the Delivery scaling, the bonus cap, the formula, the qualifying test, the band boundaries. All six agree today, which is exactly what makes the class invisible. The RPC now does no arithmetic and takes the verdict as parameters." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-21T19:36:00Z",
    "why_it_governs": "Everything is an event; append-only; never update or delete.",
    "how_this_build_will_embody_it": "pitch_score_overrides has no update or delete policy, and a removed bonus is DEMOTED to rejected_bonus rather than deleted. 'The change is logged' is only true if the log cannot be rewritten, and a deleted event erases the judgement rather than reversing it." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T19:31:00Z",
    "why_it_governs": "Four layers, foundation up; a feature that works in itself but breaks workflow continuity is incomplete and must not ship.",
    "how_this_build_will_embody_it": "The trigger IS a layer-3 failure: the dispute queue was complete in itself and left the manager unable to act. Honesty requires recording that this build closes half of it — layer 2 is done, layer 3 has no surface — which is R2 in the residual rather than a claim of completion." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T19:32:00Z",
    "why_it_governs": "A user-specified experience binds at layer 2 and cannot be deferred as layer-4 polish.",
    "how_this_build_will_embody_it": "The rubric specifies 'with the change logged'. The rep-visible log is therefore the specified RESULT, not presentation, so the read path was built rather than deferred — and its absence from PitchDetail is recorded as a layer-2 gap (R4), not filed as polish." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-21T19:33:00Z",
    "why_it_governs": "THINK first about what could be wrong, then search to confirm; audit adjacent surfaces proactively.",
    "how_this_build_will_embody_it": "Six failure hypotheses were written in think.md BEFORE the code was read, and they drove the tests rather than the other way round. Two became findings: the unreachable read path (F1) and the mock that swallowed its arguments (F2)." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-362", "read_at": "2026-09-21T19:34:00Z",
    "why_it_governs": "Guide, don't overtake; the human's call stays the human's.",
    "how_this_build_will_embody_it": "Whether managers may override element grades as well as bonuses was NOT decided here — the PDF says bonuses and violations, and the widening came from the founder's picker answer. The widening is recorded in both migrations so a future reader comparing code to spec finds the reason rather than an unexplained excess." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-395", "read_at": "2026-09-21T19:37:00Z",
    "why_it_governs": "Adaptation the user cannot perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "The whole argument for the rep-visible log. A correction the rep cannot see demonstrates the opposite of learning — it teaches that disputing changes nothing, which silences the one channel where this system hears that its model was wrong." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-21T19:38:00Z",
    "why_it_governs": "Distrust the confident answer that arrived too quickly; the biggest risk is the builder under pressure.",
    "how_this_build_will_embody_it": "Applied to the two surviving mutants. 'They survived because zod strips unknown keys' arrived fast and was convenient, so it was tested with a control rather than believed — passthrough alone had to SURVIVE for the other two results to mean anything." },
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-21T19:30:00Z",
    "why_it_governs": "Understanding precedes solving; if you cannot articulate why the problem exists you may not solve it yet.",
    "how_this_build_will_embody_it": "The problem is not 'managers want an edit button'. It is that a correction channel which visibly changes nothing trains the rep to stop using it, taking the scorer's only correction signal with them. That diagnosis is what makes the rep-visible log non-optional, rather than a nice addition." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-21T20:36:00Z",
    "why_it_governs": "A lesson recorded only in PROSE will return. A fix is not complete until the class is encoded in a gate that fails WITHOUT the author's cooperation — the 19 security_invoker views were re-broken while rls:audit reported green, because the hole was in the lens, not the data.",
    "how_this_build_will_embody_it": "Both findings were answered against this standard rather than by fixing the instance. F1 is closed by a gate that already exists and that caught it unaided (invariant:audit's reachable-table rule) — which is why the tempting RPC_ONLY_TABLES entry was refused: allowlisting would have blinded the lens exactly as A30 describes. F2 is an explicit DECLINE under A33, with the hole named in remediate.md, because no mechanical check for mock fidelity exists and pretending otherwise would be the prose-lesson failure in gate's clothing." },
  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-820", "read_at": "2026-09-21T19:55:00Z",
    "why_it_governs": "Schema-complete is not built; the seam between the database and the surface is where a correct system silently becomes a nonexistent feature.",
    "how_this_build_will_embody_it": "F1 is a textbook instance, caught by the invariant audit rather than by me: the table, the RPC and the RLS policy all existed and nothing in src/ named it. The fix was to build the read path, NOT to allowlist the table — the allowlist entry would have been true about the write path and would have silenced a correct complaint about the read path." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1030", "read_at": "2026-09-21T20:00:00Z",
    "why_it_governs": "'Verified' is a claim about a command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the actual outputs with exit codes, and states plainly that migration:audit reported SKIPPED in this session rather than borrowing the earlier run's result." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T20:26:00Z",
    "why_it_governs": "The precondition gate: the methodology defining understanding must be in the working tree at the moment of action, and citing labels from a document not in the tree is forbidden.",
    "how_this_build_will_embody_it": "The rubric PDF that specifies the override is in docs/SYSTEM UPDATES AND REVISION/ and was read; the implementation guide is NOT in the tree and this build does not lean on it. That distinction is stated rather than blurred — the gate is about which source each claim rests on." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-21T20:27:00Z",
    "why_it_governs": "Retrospective Identification — identify the problem from the actual record, and detect patterns across incidents rather than the symptom in front of you.",
    "how_this_build_will_embody_it": "The record is what set this build's shape. Four earlier defects in this same feature were all one pattern (a decision duplicated away from its authority), and that pattern — not the dispute-queue symptom — is what dictated a SQL function that does no arithmetic." },
  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-21T20:28:00Z",
    "why_it_governs": "Outside-Perspective Identification — read the problem as someone with no stake in the existing assumptions or sunk cost.",
    "how_this_build_will_embody_it": "Applied to my own first draft. The plpgsql recompute was already written and working; the outside reading is that it CANNOT be right for long, not that it was written carelessly. That reading is what made throwing it away the only option rather than a preference." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-75", "read_at": "2026-09-21T20:29:00Z",
    "why_it_governs": "Holistic and organic — trace ripple effects before acting; never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "Traced before writing: the override updates pitch_scores totals, which the leaderboard sums and the aggregator reads. Storing the verdict rather than replaying overrides on every read was the holistic call — a board that replayed would be slow AND would become a second home for the arithmetic." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-21T20:30:00Z",
    "why_it_governs": "A feature depending on config outside the repository is not operationally complete until that precondition is verified end-to-end or documented as a blocking setup step.",
    "how_this_build_will_embody_it": "Checked and it does not bind: the override path depends on no dashboard setting, allowlist, DNS or webhook — only on the service-role key already required by every other RPC in this feature. Recorded as not-applicable rather than left unexamined." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-260", "read_at": "2026-09-21T20:31:00Z",
    "why_it_governs": "Ground-up auditing — walk the foundation upward; a problem at layer N propagates to every layer above it.",
    "how_this_build_will_embody_it": "The order this build was verified in: migration applies, RLS covers, invariants hold, the pure recompute, the route's gates, then the read path. F1 (nothing in src/ reads the log) was found at the seam between the data layer and the surface, which is exactly where a ground-up walk arrives last and where this feature had already failed once today." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-290", "read_at": "2026-09-21T20:32:00Z",
    "why_it_governs": "Diagnose before patching; no error loops — a repeated failure means the identification was wrong, not the implementation.",
    "how_this_build_will_embody_it": "Invoked once, on the mutation runner: the first attempt reported R1 as caught when the anchor had matched the wrong occurrence. The response was to re-diagnose the harness (exact anchors, uniqueness assertion) rather than re-run the same mutation harder — and the corrected run exposed a real gap in the test." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T20:33:00Z",
    "why_it_governs": "Measure downstream consequence, never agreement; grading your own homework is forbidden.",
    "how_this_build_will_embody_it": "Bears on the override directly. An override is the manager DISAGREEING with the model, and the honest instrument is the override rate and what it corrects — not whether reps accept scores. The log stores item_type and item_id precisely so the corrections can be counted by kind later; nothing yet reads them that way, which is future work rather than a claim." },
  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-413", "read_at": "2026-09-21T20:34:00Z",
    "why_it_governs": "A method counts as learned only when measured against the alternative; the System must refuse to believe its own evolution until results prove it.",
    "how_this_build_will_embody_it": "Applied to the test suite rather than the product: 22 mutations were run because a passing suite is a persuasive artifact, not a validated one. The two survivors were then run down with a control, which is the same rule applied to my own explanation of why they survived." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-21T20:20:00Z",
    "why_it_governs": "The pre-action checklist, item 0 of which requires every founder decision to go through a picker with a recommendation.",
    "how_this_build_will_embody_it": "The decision this build rests on — element-level override vs. re-score vs. answer-only — was taken through the picker before any code was written, and its answer is quoted in both migrations. Item 1a is why the manifest below exists: the assets were re-opened this session rather than cited from cached labels." },
  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-305", "read_at": "2026-09-21T20:21:00Z",
    "why_it_governs": "Migrations are safe-to-re-run BY CONSTRUCTION; every DROP needs IF EXISTS, every CREATE referencing a name needs IF NOT EXISTS or CREATE OR REPLACE. The next author is post-context-loss me, replaying against a partially-applied database.",
    "how_this_build_will_embody_it": "0255 and 0256 were authored to it: create table if not exists, create index if not exists, drop trigger/policy if exists before create, create or replace function. Both are re-runnable, and migration:audit confirmed that earlier today — they did not join the 18-migration baseline. A12's own warning that `create table if not exists` does not propagate to inline constraints is also why 0255's CHECKs are inline on a table that is genuinely new rather than added by a later ALTER." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-470", "read_at": "2026-09-21T20:22:00Z",
    "why_it_governs": "Methodology that governs the build must be IN the working tree and read this session — labels propagate through commits faster than content propagates through reading.",
    "how_this_build_will_embody_it": "Honoured, with one standing exception recorded as R5: the Pitch Score implementation guide is still not in the tree, and the 2026-09-19 instruction image has never been displayed. This build is specified by the rubric PDF (in the tree) and the founder's picker answer, so it does not depend on either — but the exception is named rather than glossed." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-545", "read_at": "2026-09-21T20:23:00Z",
    "why_it_governs": "Audits that look WITHIN modules but not ACROSS them miss same-name-different-feature composition failures. The user experiences a feature concept, not a module boundary.",
    "how_this_build_will_embody_it": "Read because it is the sharpest description of the collision this workstream already has: 'score', 'band' and 'leaderboard' each now mean one thing in gamification and another in Pitch Score. TWO-SCORING-SYSTEMS.md is that cross-module inventory. This build's contribution is negative and deliberate — it added NO new vocabulary, and took its band from gamification/bands.ts rather than minting a second meaning for the word." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-612", "read_at": "2026-09-21T20:24:00Z",
    "why_it_governs": "Citing a constitutional asset without having read it in-session is A19 operating undetected; the session-read manifest is the artifact that closes the gap between citation speed and reading speed.",
    "how_this_build_will_embody_it": "The manifest this entry sits in. It was not written from memory: §6, A12, A19, A21 and A22 were each opened during closure because the gate named them as cited-but-unmanifested, which is the forcing function A22 asks for working exactly as designed — the gate caught the gap, not the author's diligence." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1075", "read_at": "2026-09-21T19:35:00Z",
    "why_it_governs": "The operational lesson behind §2.2 — the account-based empty-AI outage, where a wrapper re-derived a gate and dropped an exemption term.",
    "how_this_build_will_embody_it": "The same shape was one keystroke away here: the route could have re-checked 'is this user a manager' from a role string instead of consuming requireSalesCoachManager's verdict. It consumes the verdict." }
]
```

## What could go wrong, before I look

Hypotheses first, per §1.5.2:

1. **The write bypasses RLS.** A SECURITY DEFINER RPC run with the service role has no policy
   protecting it. If the manager check is missing or misplaced, a rep can edit their own score and
   there is no second line of defence. → the route must gate before the call, and a test must
   assert the RPC is *not reached*, not merely that a 403 came back.
2. **Cross-tenant by uuid.** The pitch is read with the service role, which has no RLS, so nothing
   but an explicit comparison stops a manager correcting a score in another company.
3. **The log is worthless if it can be rewritten.** Append-only, or "logged" is a word.
4. **An override with no reason** is indistinguishable from a manager editing a number they
   disliked.
5. **Overriding an element the scorer never graded** — the commonest real correction on a short
   pitch — must be an insert, not a failed update.
6. **Removing a bonus must not delete the row.** A rejected bonus is stored precisely so the rep
   can see it was considered; deleting it erases the judgement rather than reversing it.
