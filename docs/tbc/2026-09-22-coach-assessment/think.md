---
started_at: 2026-09-22T09:05:00+08:00
trigger: The founder sent a higher-resolution capture of the Coach Assessment manager dashboard and asked whether the PDF build plan had been followed. It had not — Project 3 was never built, and the page is still the old Sales ELO layout. Instruction: "build true to the build plan."
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the project I skipped

## What was actually asked, and what I had been reporting

The guide has five projects. I built 1, 2 and most of 5, and reported percentages that averaged
over the gap instead of naming it. Projects **3 (Coach Assessment) and 4 (Recordings tab) are not
built at all** — `/dashboard/sales-coach/coach-assessment` is still 680 lines of the old layout
("Sales ELO Rating", "How the team is growing", "Coaching notes + your ELO rating").

The founder found that by sending a screenshot of the board and asking. A percentage that hides a
missing project is the §5 confident-well-formed-failure in reporting rather than in code, and it
is worse than a wrong number because it was *averaged* — every individual layer figure was
defensible.

This build is Project 3, true to the plan.

## The plan, quoted, because "true to" means its list and not my reading of it

Guide Step 3, seven items:

1. Team score cards — team average Pitch Score with base/bonus/violations, team total points with
   today's gain, pitches counted, prize-eligible reps (5+ counted).
2. Team activity — doors, presentations, sold, door→presentation %, close rate, each with today's
   count.
3. Team rubric averages — six section bars, lowest section flagged.
4. Needs your attention — rude/dismissive flags to confirm, open score disputes, reps not yet
   prize eligible, dissects that didn't auto-generate (keep the existing Generate missing action).
5. What the team needs to work on — the existing training brief, reshaped into three priority
   cards. Map each priority to a rubric section and show the team average and points per pitch
   left. The drill collapses to one line. Keep Rebuild.
6. Reps table — rank by total points, avg Pitch Score and band, trend, total points, doors,
   presentations, sold, close %, lowest section, coaching grade, the rep's one focus from the
   brief. **No Counted column.** Clicking a row opens rep detail.
7. Rep detail, Overview tab — the rep's five activity KPIs vs team average, score cards, six
   sections vs a team-average marker, one focus, doing well, coaching focus, skill scores.

And the constraint that decides what happens to the old page: *"The existing coaching grade and
notes stay unranked; only the Pitch Score and KPIs are compared across reps."*

## Two founder rulings, and one of them overrules me

**Activity source: build `rep_activity` as the guide specifies.** I recommended reusing the
existing `door_knocks` table (Macro Mode's door log, which already holds rep_id / outcome /
local_date) and was overruled. Building it as instructed.

The risk I flagged and am recording rather than re-arguing: the product will then have **two
tables that can answer "how many doors did this rep knock today"**, and they will disagree the
first time one is written and the other is not. That is the duplicate-decision class
`TWO-SCORING-SYSTEMS.md` exists to catalogue — the bands, the manager predicate and the
lowest-section helper were all found this way, and all three agreed with their authority on the
day they were written. The mitigation available without re-litigating the decision: make
`rep_activity` the *declared* authority for the dashboard in its own migration header, name
`door_knocks` there, and state which one a future reader should trust.

**The old page: rebuild it, keep ELO inside rep detail.** The new board becomes the page; the
existing coaching grade, skill scores, doing-well and coaching-focus move into the rep detail
Overview tab, which is exactly where the board draws them. Nothing is deleted — the ELO rating
stops being the headline and becomes one rep's attribute.

## The part of the plan that has no data behind it

Item 5 says *"Map each priority to a rubric section."* The existing brief
(`teamTrainingBriefPrompt.ts`) produces `themes: {title, why}[]`, `drill: {title, steps[]}` and
`repFocus: {rep, focus}[]`. **There is no section on a theme.** The themes come from pooled v5
growth areas, which are a different vocabulary from the AT&T rubric's six sections.

So the mapping has to be computed, and the honest options differ in what they claim:

- *Match the theme's words against section and element labels.* Real, checkable, and silent when
  the wording does not line up.
- *Rank sections by points-left and pair them with themes in order.* Produces a filled card every
  time and asserts a correspondence that does not exist.

Built as: match first; where a theme matches no section, attach the largest-gap section not
already used, deterministically, and mark that card as unmatched in the data so the surface can
be honest about which is which. The NUMBERS on every card come from the rubric aggregate either
way — team average and points-per-pitch left are facts about a section, never about a theme.

## What could go wrong, before I look

1. **Two door counts.** Named above; the decision is the founder's and the mitigation is
   documentation, not code.
2. **A second "lowest section" implementation.** `rubric.ts` already exports `lowestSection`, and
   it is by PERCENTAGE of max, not absolute points (C1). A hand-rolled `Math.min` over the six
   averages would disagree with the rep's own Breakdown board.
3. **Ranking the coaching grade.** The guide forbids it explicitly. The reps table ranks by total
   points; the grade is a column, not an order.
4. **A Counted column.** Named as absent in the plan and present in the mockup as a *card*. B5
   settled it: card yes, column no.
5. **Trend (▲ Improving / – Steady / ▼ Slipping) invented.** It needs a previous period, which is
   a second read — the same shape as the Breakdown board's baseline, which was removed for being
   unwired. Only build it if it is wired.
6. **Team averages that do not reconcile.** The launch checklist requires sections to sum to base
   and base + bonus − violations to equal the average score. The aggregate already guarantees this
   per rep; the team roll-up must not break it by averaging averages over different denominators.
7. **Every rep's grades read at once** — a team of forty pulling every scored element is the read
   that gets slow silently.

## Session-read manifest

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-09-22T09:06:00+08:00",
    "why_it_governs": "Understanding precedes solving; if you cannot articulate why the problem exists you may not solve it yet.",
    "how_this_build_will_embody_it": "The problem is not 'the dashboard is missing' — it is that I reported a percentage across layers while a whole project inside one of them was absent, so the number stayed plausible while the gap grew." },

  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-34", "read_at": "2026-09-22T09:06:30+08:00",
    "why_it_governs": "The methodology must be in the tree and consulted at the moment of action.",
    "how_this_build_will_embody_it": "Step 3's seven items are quoted above from the guide, not recalled. Yesterday's lesson was that four rules reconstructed from adjacent sources were all wrong." },

  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-09-22T09:07:00+08:00",
    "why_it_governs": "Holistic — trace the ripple; never fix one thing in a way that silently breaks another.",
    "how_this_build_will_embody_it": "This replaces a 680-line live page. Traced: the ELO rating, skill scores, strategy tags and the Generate-missing action all have to land somewhere, and the ruling says where." },

  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-22T09:07:30+08:00",
    "why_it_governs": "Four layers, foundation up; layer 2 is whether the feature delivers the intended result when a real caller invokes it.",
    "how_this_build_will_embody_it": "A manager's intended result is deciding who to coach next. That needs the reps table ranked and the rep detail beneath it, which is why those two come before Needs-your-attention in build order." },

  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-173", "read_at": "2026-09-22T09:08:00+08:00",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Seven hypotheses before writing. The two that shaped the design are the duplicate door count and the missing theme→section mapping." },

  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-229", "read_at": "2026-09-22T09:08:30+08:00",
    "why_it_governs": "A user-specified experience binds at layer 2 and cannot be deferred as layer-4 polish.",
    "how_this_build_will_embody_it": "The founder sent the board and said 'build true to' it. The layout IS the requirement here, not a presentation of it — so a correct data layer under a different screen would not be done." },

  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-334", "read_at": "2026-09-22T09:09:00+08:00",
    "why_it_governs": "Consume the verdict, never re-derive it; duplicated conditions drift.",
    "how_this_build_will_embody_it": "`lowestSection` and `bandFor` are consumed from their authorities. A hand-rolled lowest-section here would disagree with the rep's Breakdown board the first time a section was low in points but high as a percentage of its max." },

  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-09-22T09:09:30+08:00",
    "why_it_governs": "Append-only; state is derived by replaying rather than edited.",
    "how_this_build_will_embody_it": "`rep_activity` is a per-rep-per-day count, which is a rollup and not an event log — so it is written idempotently on a unique (rep, date) key rather than accumulated, and the underlying knocks stay in door_knocks." },

  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-389", "read_at": "2026-09-22T09:10:00+08:00",
    "why_it_governs": "Measure downstream consequence, never agreement; be honest when a gain is partly circumstantial.",
    "how_this_build_will_embody_it": "Door→presentation and close rate are ratios over small denominators. A rep with 3 doors and 1 sale is at 33%, which beats everyone and means nothing; the surface has to carry the denominator next to the rate." },

  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-457", "read_at": "2026-09-22T09:10:30+08:00",
    "why_it_governs": "The pre-action checklist, including item 0 on founder decisions.",
    "how_this_build_will_embody_it": "Both decisions went to a picker before any code: the activity source (where I was overruled) and what happens to the old page." },

  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-593", "read_at": "2026-09-22T09:11:00+08:00",
    "why_it_governs": "Audits within modules miss same-name-different-feature across them; one definition per concept.",
    "how_this_build_will_embody_it": "Load-bearing twice. `rep_activity` vs `door_knocks` is A21 arriving by instruction rather than by accident, which is why it is documented rather than silently reconciled. And 'pitches' already means two different tables in this repo — 0215's door-log pitches and 0252's pitch_scores." },

  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-644", "read_at": "2026-09-22T09:11:30+08:00",
    "why_it_governs": "Citations without session-reading operate undetected.",
    "how_this_build_will_embody_it": "Step 3's seven items and the brief's actual TypeScript shape were both opened this session; the brief turned out to already have themes/drill/repFocus, which is why item 5 is a reshape and not a new generator." },

  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-792", "read_at": "2026-09-22T09:12:00+08:00",
    "why_it_governs": "A lesson in prose returns; encode the class in a gate, and keep the gate quiet.",
    "how_this_build_will_embody_it": "The two-door-counts risk cannot be gated without overruling the founder's ruling, so it gets the honest treatment A33 allows: named in the migration header, in the contradictions record, and declined as a gate with the hole stated." },

  { "id": "A31", "source_file": "ThinkerThinker.md", "line_range": "793-819", "read_at": "2026-09-22T09:12:30+08:00",
    "why_it_governs": "Schema-complete is not built; the seam between the database and the surface is where a correct system becomes a nonexistent feature.",
    "how_this_build_will_embody_it": "The literal subject of this build. Projects 1 and 2 are complete and a manager still has the old page, which is A31 at project scale rather than at module scale." },

  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1025", "read_at": "2026-09-22T09:13:00+08:00",
    "why_it_governs": "\"Verified\" names a command you ran; report coverage, not a verdict.",
    "how_this_build_will_embody_it": "`npm run check` by name, and `npm run db:dry` before any claim that a migration is live — today's deploy proved the difference between 'the migration exists' and 'the migration is applied'." },

  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-09-22T09:13:30+08:00",
    "why_it_governs": "Knowledge is not intelligence; distrust the confident answer that arrived too quickly; treat objections as data; the biggest risk is the builder under pressure making the method less honest for a faster result.",
    "how_this_build_will_embody_it": "Cited in the THINK for the reporting failure that started it — a percentage averaging over a missing project is the confident, well-formed, plausible answer §5 names, and it survived several updates because every layer figure under it was defensible. The clause earned its citation twice more during the build: a duplicate written beneath a docblock warning against duplicates, and a gate verdict read from the wrong command." },

  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-479", "read_at": "2026-09-22T09:14:00+08:00",
    "why_it_governs": "Methodology that governs the build must live in the working tree and be read in session; the failure mode is citing labels without consulting content, which provides false confidence that the discipline is being applied.",
    "how_this_build_will_embody_it": "A19's own closing test is whether the next structural failure is caught before the build or after. This one was caught by the founder sending a screenshot — post-hoc again. What the build did do is quote Step 3's seven items from the guide rather than from memory, which is how the theme-to-section gap was found before it was implemented rather than after." },

  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-375", "read_at": "2026-09-22T09:56:00+08:00",
    "why_it_governs": "No instant results; behaviour is derived from a team's accumulated data, and a system that behaved identically on install would be claiming understanding it cannot have.",
    "how_this_build_will_embody_it": "Carried in the extracted RepSkillGrades, whose own comment invokes it: a failed read SAYS so, and not-enough-sessions is an honest empty rather than a zero score. The dashboard follows the same rule at team scale — a failed read renders as a failed read, never as a team that did nothing." },

  { "id": "A10", "source_file": "ThinkerThinker.md", "line_range": "260-274", "read_at": "2026-09-22T09:56:30+08:00",
    "why_it_governs": "The user sees what the System sees about them; there is no read the System makes about a person that the person cannot read.",
    "how_this_build_will_embody_it": "Read because the code I moved cites it, and it bears on this page more than on the component: every figure a manager sees about a rep here — Pitch Score, sections, doors, the coaching grade — the rep can see about themselves on their own boards. The one thing that is manager-only is the COMPARISON, which is the guide's own line about what may be ranked." },

  { "id": "A11", "source_file": "ThinkerThinker.md", "line_range": "275-292", "read_at": "2026-09-22T09:57:00+08:00",
    "why_it_governs": "The System mirrors, it does not judge; a verdict rendered by an authority is wrong some fraction of the time and wrong-by-an-authority destroys trust exactly when trust is the point.",
    "how_this_build_will_embody_it": "Why the coaching notes sit in rep detail as that rep's own strengths and growth areas rather than as a column to sort on, and why the guide's ban on ranking the coaching grade is followed rather than treated as a preference. A grade in a sortable column is a verdict; the same grade beside one rep's own numbers is a mirror." },

  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-454", "read_at": "2026-09-22T09:57:30+08:00",
    "why_it_governs": "When a system surfaces human-behaviour data to a leader, the LABEL is the structural defense against misuse — the same data invites coaching or penalising depending on what it is called.",
    "how_this_build_will_embody_it": "Directly load-bearing on a page whose entire purpose is showing one manager five people's numbers. The headings are the defense: 'Needs your attention' rather than 'problems', 'Coaching focus' rather than 'weaknesses', 'Not prize eligible yet' rather than 'failing', and a priority card that says its section was matched by gap rather than presenting an assignment as a finding." }
]
```
