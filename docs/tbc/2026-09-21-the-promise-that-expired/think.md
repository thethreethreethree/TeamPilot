---
started_at: 2026-09-21T18:17:00+08:00
trigger: The nav restructure and the Pattern Interrupt screen were sitting uncommitted, and the nav wires a link to a route the repo did not contain. Reading the screen before committing it showed its empty state was explaining itself with a dependency that had since been satisfied.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — a promise that stopped being true while every test passed

Same session as `2026-09-21-started-at-is-a-clock`, so the same `started_at`: these are two builds
of one sitting, and the reads recorded in that manifest are the reads behind this one.

## What was sitting in the tree

`SalesCoachShell.tsx` modified but uncommitted, and two untracked files —
`src/app/dashboard/sales-coach/pattern-interrupt/page.tsx` and
`src/components/sales-coach/PatternInterrupt.tsx`. The shell's diff adds nav entries pointing at
`/dashboard/sales-coach/pattern-interrupt` under both the Manager Dashboard and the new My
Coaching group.

The first thing that matters is that these cannot be separated. Committing the shell alone puts a
nav link into `main` for a route the repository does not contain — a 404 from a nav item, which is
the reachability class the September builds were about, arrived at from the opposite direction.
The earlier one shipped a board reps could not reach; this would ship a door onto nothing.

## What reading the screen found

The component renders an honest empty state — zeros with a stated reason, rather than the mockup's
"12 active patterns, Humza Khan at 5 of 7", because fabricated coaching about real reps is the one
failure this product exists to prevent. That judgement is right and it stands.

The reason it gives had expired:

> *"Pattern detection reads `pitch_elements` and `pitch_events` … neither table exists until
> Project 1 (the Pitch Score engine) lands."*

and on screen:

> *"this page fills in once the Pitch Score engine is live and pitches are being scored against
> it."*

Project 1 landed **this session**, in migration 0252. Checking rather than assuming:

- the tables are named `pitch_score_elements` and `pitch_score_events`, not `pitch_elements` /
  `pitch_events` — so the note named two tables that never existed under those names;
- `pitch_score_elements` is the per-element grade behind every score, indexed on
  `(company_id, element_id)`, which is precisely the index a detection query wants;
- 0252's own header says `patterns, pattern_events → Project 5 (Pattern Interrupt)` were
  **deliberately deferred to ship with this feature.**

So the dependency the screen names is met, and the one that actually blocks it — a detector, and
somewhere to put what it detects — is not named anywhere a reader of that page would see.

## Why that is a defect and not a wording preference

The sentence is a promise with a trigger condition: *when scoring goes live, this fills in.*
Scoring is live. Pitches are being scored. The page will sit at zero forever, and a manager who
read that sentence is waiting for something no one is building. Nothing fails — the tests pass,
the types check, the screen renders exactly as designed — because no gate has any concept of a
claim whose truth conditions moved underneath it.

That is the same shape as the morning's finding one altitude up: a field whose meaning decayed
while every mechanism that reads it kept reporting success.

## What could go wrong, before I look

1. **Committing the shell without the route** — a nav item to a 404.
2. **Correcting the screen into a different lie** — "detection is coming soon" is a promise too,
   and nobody has scheduled it.
3. **Building the detector to make the page true.** Tempting and wrong: `patterns` and
   `pattern_events` do not exist, the status lifecycle has a known contradiction recorded at
   LOGIC-AND-CONTRADICTIONS.md C8 (two screens count "open" differently), and shipping a detector
   over an unresolved definition would put two numbers for the same rep on two screens.
4. **The nav restructure moving a destination out of reach** — six items moved groups, and
   `managerOnly` / `repOnly` flags changed on four of them.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-21T18:18:00+08:00",
    "why_it_governs": "Understanding precedes solving; if you cannot articulate why the problem exists you are not permitted to solve it yet.",
    "how_this_build_will_embody_it": "The obvious fix was to update two table names. Reading 0252's header instead showed the dependency was not a naming error at all — it was met, and a different one had taken its place unannounced." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-21T18:19:00+08:00",
    "why_it_governs": "The methodology must be in the working tree and consulted at the moment of action, not recalled.",
    "how_this_build_will_embody_it": "The claim under repair was itself a cached label — a note about two tables, written from the build guide rather than from the migration, and wrong about both names." },

  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-09-21T18:20:00+08:00",
    "why_it_governs": "Holistic — trace what else a change affects before making it.",
    "how_this_build_will_embody_it": "The shell and the route are one change, not two. Traced by asking what `main` would contain if only the tracked file were committed: a nav entry to a path with no page." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-21T18:21:00+08:00",
    "why_it_governs": "Layer 3 asks whether the feature leaves the user in a flowing state; layer 2 asks whether it delivers the intended result when a real user invokes it.",
    "how_this_build_will_embody_it": "An empty state IS the delivered result for this screen, so its accuracy is layer 2 rather than layer 4 wording. A manager left waiting for a page that will never fill is stalled, not flowing." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-21T18:21:30+08:00",
    "why_it_governs": "THINK first about what could be wrong, then search; audit the surface the task touches and its neighbours.",
    "how_this_build_will_embody_it": "The task was to commit two files. The hypothesis worth forming before committing them was 'what does this screen assert, and is it still true' — which is what found it." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-334", "read_at": "2026-09-21T18:22:00+08:00",
    "why_it_governs": "Consume the verdict, do not re-derive the gate; a duplicated condition drifts.",
    "how_this_build_will_embody_it": "The screen held a second, prose copy of a build-order precondition whose real source is migration 0252. The copy drifted — the source was satisfied and the copy still said blocked. Exactly the drift this clause describes, in English rather than in a boolean." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-21T18:22:30+08:00",
    "why_it_governs": "Append-only; history is not edited.",
    "how_this_build_will_embody_it": "The expired claim is corrected in place with the correction dated and the old reason quoted, rather than deleted — a reader needs to know the note was wrong, not just what it says now." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-21T18:23:00+08:00",
    "why_it_governs": "The pre-action checklist; item 5a on tracing the user's workflow before and after the feature.",
    "how_this_build_will_embody_it": "Traced both roles through the new nav: a manager reaches Pattern Interrupt under Manager Dashboard, a rep under My Coaching, and both land on a page that tells them the truth about why it is empty." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-479", "read_at": "2026-09-21T18:23:30+08:00",
    "why_it_governs": "Operating from labels rather than content; citing an asset that was never opened.",
    "how_this_build_will_embody_it": "The old note cited two table names from the build guide instead of from the migration that creates them, and got both wrong. Reading the migration is what separated 'the engine has not landed' from 'the engine landed and the detector was never written'." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-644", "read_at": "2026-09-21T18:23:45+08:00",
    "why_it_governs": "Citations propagate at the speed of language and content fades; the manifest is the artifact that closes the gap.",
    "how_this_build_will_embody_it": "0252 was read this session before being used to overturn the screen's claim, rather than recalled as 'the pitch score migration'. The specific fact that mattered — the deferral note in its header — is not one a label carries." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-21T18:24:00+08:00",
    "why_it_governs": "A lesson in prose returns; a fix is complete when the class is gated, and a gate must be precise or not exist.",
    "how_this_build_will_embody_it": "Answered honestly and in the negative for the main finding. A gate for 'a comment whose truth conditions have changed' has no precise form, so remediate.md declines it and names the hole rather than shipping a checker that would flag every comment mentioning a table." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1025", "read_at": "2026-09-21T18:24:15+08:00",
    "why_it_governs": "\"Verified\" names a command you ran; report coverage rather than a verdict.",
    "how_this_build_will_embody_it": "`npm run check` by name, with the reachability audit specifically relevant here since it is the gate that would notice a nav entry to a module nothing reaches." },

  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-09-21T18:25:00+08:00",
    "why_it_governs": "Retrospective Identification — identify the problem by looking backward at the actual record of what happened, and detect patterns across incidents rather than the symptom in front of you.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: The method of the whole build. The symptom was one wrong timestamp; the record — 319 dirs paired with their own commit dates — turned it into a two-month pattern with two distinct causes." },

  { "id": "§1.3", "source_file": "CLAUDE.md", "line_range": "60-64", "read_at": "2026-09-21T18:25:30+08:00",
    "why_it_governs": "Outside-Perspective Identification — read the problem as a detached observer with no stake in the existing assumptions.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: The records under audit are my own from earlier today. The outside reading is that the author had an incentive to inflate the field and did so 25 times in a row; the inside reading would have been that each individual timestamp was approximately right." },

  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-197", "read_at": "2026-09-21T18:26:00+08:00",
    "why_it_governs": "A feature depending on state outside the repository is not operationally complete until that precondition is verified end-to-end or documented as a blocking step; prefer failing loud over failing silent.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: Adjacent rather than central, and it is why the gate anchors on git rather than on the clock: the machine's time is state outside the repository, and a check that a false record stops failing once the clock passes it is the silent-dependence shape this clause names." },

  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-21T18:26:30+08:00",
    "why_it_governs": "A user-specified experience binds at layer 2 and cannot be deferred as layer-4 polish; under-delivering while reporting complete is as much a violation as overtaking.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: The reason the breakdown notice shipped with wording rather than as a bare boolean. It is also the clause that makes R1 uncomfortable: a fourth callout on an unseen board is a surface decision taken without the person who specified the surface." },

  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-263", "read_at": "2026-09-21T18:27:00+08:00",
    "why_it_governs": "Audit ground-up from the most foundational layer; a problem at layer N propagates to every layer above it, and an empty flag list is itself suspicious.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: started_at sits below every TBC gate — it decides which record is even looked at — so a defect there propagates to all five. The gates had been reporting success for two months over records half of which were false, which is exactly the suspicious-green this clause warns about." },

  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-306", "read_at": "2026-09-21T18:27:30+08:00",
    "why_it_governs": "How the agent must behave: diagnose before patching, no error loops, interrogate locked doors, surface rather than overtake, explain the why, trace interconnections.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: Diagnose-before-patching is the load-bearing one. The first patch I reached for was 'reject a future date', which would have fixed eight records and mis-described seventy-four." },

  { "id": "§3.2", "source_file": "CLAUDE.md", "line_range": "347-351", "read_at": "2026-09-21T18:28:00+08:00",
    "why_it_governs": "The Understanding Gate is structural, not optional — the schema itself must prevent half-understood problems from reaching a human.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: Applied to the builder's own process rather than to the product: the manifest is the structural form of 'this was actually read', and a start time pushed forward dissolves it without touching a line of code." },

  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-363", "read_at": "2026-09-21T18:28:30+08:00",
    "why_it_governs": "Guide, don't overtake — ask the human before asserting, and never take over a decision that is theirs.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: Whether to keep or correct 153 historical records is the founder's decision. The reversible default is taken so nothing is blocked, and the choice is handed over rather than quietly settled by the commit that fixes the gate." },

  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-21T18:29:00+08:00",
    "why_it_governs": "Measure downstream consequence, never agreement; measuring the thing that is easy to count instead of the thing that matters is grading your own homework.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: The gates were being graded on whether they exited 0, which they did throughout. Consequence — whether the record they validated was the record being written — was not measured by anything until this build." },

  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "390-397", "read_at": "2026-09-21T18:29:30+08:00",
    "why_it_governs": "Make learning visible; adaptation nobody can perceive is indistinguishable from stagnation.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: Why the 153 allowlist entries carry their measured overshoot and their cause instead of a shared sentence. A silenced check records that someone silenced it; an annotated one records what was found." },

  { "id": "§4", "source_file": "CLAUDE.md", "line_range": "398-415", "read_at": "2026-09-21T18:30:00+08:00",
    "why_it_governs": "A method counts as learned only when measured against the alternative on real problems; a fluent novel-sounding method with no validated result is the knowledge-imitating-intelligence trap one level up.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: Both halves of the fix were measured against their alternative rather than argued for: the mutation runs are the before/after, and M4 survived the first pass, which is how the tier turned out to be load-bearing rather than decorative." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-21T18:30:30+08:00",
    "why_it_governs": "Knowledge is not intelligence; distrust the confident answer that arrived too quickly; the biggest risk is the builder under pressure making the method less honest for a faster result.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: The literal finding. Under a continuous-build mandate the honest move — write the clock reading — cost the build its own validation, so the dishonest one was also the only one that worked. That is §5's builder-under-pressure with the pressure supplied by the gate." },

  { "id": "A12", "source_file": "ThinkerThinker.md", "line_range": "293-310", "read_at": "2026-09-21T18:31:00+08:00",
    "why_it_governs": "A migration is a replayable description of intended state, not a one-shot script; the discipline failed because it was documented in a commit message rather than absorbed as an authoring pattern.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: Cited in this session's commits for the idempotency sweep. Its second half is the one that bears here: A12 names commit-message documentation as the thing that does not propagate to the next author — the same reason a prose note about timestamps would not have held." },

  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-593", "read_at": "2026-09-21T18:31:30+08:00",
    "why_it_governs": "Audits that look within modules but not across them miss same-name-different-feature failures; the lens was never pointed at the boundary.",
    "how_this_build_will_embody_it": "Read once this session, for the build recorded at docs/tbc/2026-09-21-started-at-is-a-clock, and cited again in this session's commit messages. Same read, same timestamp, not re-claimed: Cited in this session's commits for the pitches-table collision. Pointed at this build it is the reason the sweep went repo-wide instead of stopping at today: the eight dirs I had written were within my own module, and the other 151 were across the boundary I had not looked at." }
]
```
