# Proposal — C.A.R.E Coach Assessment (support-agent grading, backed by the books)

**Status:** proposal for founder refinement (founder asked 2026-07-22 for "a Coach assessment system
for C.A.R.E … much like our Sales Coach ELO grading (Expert/Standard) … heavily backed by the
books/content we fed C.A.R.E … work with me and create suggestions to optimize"). Nothing built yet.

---

## 1. What C.A.R.E already has (we build ON this, we don't rebuild)

The support side already grades agents — deliberately **count-based and comparison-free**, no composite
score, no letter:

- **Per-reply grader** (`gradeCareAgentReply`, Coach v6, `src/lib/care/grader.ts`): every agent reply is
  scored into `CoachCounts` — 3 positive 0/1 signals (`acknowledged`, `answered`, `next_step`) and 3
  risk counts (`unsupported_absolutes`, `fabricated_specifics`, `empty_filler`). Stored on
  `support_messages.coach_counts`.
- **Per-agent + team aggregates** (`fetchAgentGrowthSnapshot` / `fetchTeamGrowthSnapshot`, `care.ts`):
  roll those counts into `coachAggregate { repliesGraded, acknowledgedCount, answeredCount,
  nextStepCount, risks{…} }`.
- **Surfaces today:** `/dashboard/care/growth` (agent's own), `/dashboard/care/leadership` (team
  aggregate, explicitly **no stack-rank**), `/dashboard/care/leadership/readouts` (§4 method readout).
- **The books:** `docs/COACH_KNOWLEDGE_BASE.md` (Voss, Cialdini, Carnegie, Crucial Conversations, NVC,
  Made to Stick, TED, Zinsser…) feeds the interactive **Ask Coach** (`ask-coach` route), whose output
  cites `improvement.principleCited { name, book, sectionRef }`. **This is the "backed by the books"
  the founder wants — it already exists**, but only in the on-demand draft assistant, not aggregated.

**The gap vs Sales Coach:** there is no single **Coach Assessment** admin page for C.A.R.E, and no
**per-agent grade** (Sales Coach has the ELO → now a Standard letter grade). C.A.R.E has the counts but
nothing rolls them into an at-a-glance grade or a per-agent coaching roster.

---

## 2. The core tension (must be resolved, not ignored)

C.A.R.E's count-based, no-composite design is **deliberate** (§A11 mirror-not-verdict, §A18
label-is-the-defense). Adding a letter grade partially reverses that. It's only safe if the grade
carries the same discipline we just shipped for the Sales Coach letter grade (`salesEloGrade.ts`):

1. **The letter travels with its counts (§A11)** — never a bare "B". Show it beside "acknowledged in 8/10
   replies, answered 9/10, 1 risk flag" so the count is the real basis, the letter just a glance-value.
2. **No "F" (§A18)** — floor is "growth area", a coaching target, never a penalty verdict.
3. **Growth vs a standard, never peers (§A11/§A18)** — same as Sales Coach's 1500. The C.A.R.E "standard"
   is a competent-reply profile (e.g. acknowledged + answered + next-step, zero risks).
4. **The bands are §4 instrumentation, not a preference (§A4)** — a defensible starting point, retuned by
   data, not hand-set.

If we can't hold all four, we should NOT add a letter to C.A.R.E and should instead just build the
roster page on the raw counts. My recommendation: hold all four (they're the same guarantees the Sales
Coach grade already ships with), so the letter is safe.

---

## 3. Proposed build (mirrors Sales Coach's Coach Assessment)

A new **`/dashboard/care/coach-assessment`** (admin/manager), structured like the Sales Coach one:

- **Per-agent roster** (alphabetical, never sorted by grade — §A11), each card showing:
  - **Standard mode → a letter grade**; **Expert mode → the raw counts** (mirrors "ELO is Expert-only").
    The letter derives from a **Care Quality score** (see §4).
  - The count basis beside it (repliesGraded, the 3 positive rates, risk flags).
  - **Doing well / Coaching focus** notes (like Sales Coach's, drawn from the agent's own graded
    replies) — reuse the pattern.
  - **Learning gaps** = which **book principles** the agent most needs, by frequency of
    `principleCited` in their Ask-Coach history (this is the founder's screenshot ask: "which
    communication book principles need reinforcement"). This is the literal "backed by the books" tie-in.
- Reuse `eloToGrade`'s sibling discipline: a new `careQualityToGrade()` helper (bands as instrumentation).

## 4. The one real design question — what does the C.A.R.E grade MEASURE?

The Sales Coach grade came from one number (ELO). C.A.R.E has several count streams. Options for the
composite "Care Quality score" the letter grades:

- **Option A (recommended, simplest honest): a positive-minus-risk rate.**
  `score = mean(acknowledged_rate, answered_rate, next_step_rate) − risk_penalty`. Purely from
  `coachAggregate` we already compute. Ships now, no new instrumentation. Bands map score→letter.
- **Option B: multi-dimension (the founder's screenshot vision).** Communication quality (A) + escalation
  success rate + resolution/durability + (e-commerce) service-to-sales conversion + learning gaps.
  Richer, but **escalation-success and service-to-sales are not instrumented yet** — this needs new
  signals (handoff-outcome tracking, upsell tagging). A real build, not a re-scaling.
- **Option C: no composite letter at all** — just surface the counts + learning-gaps roster (honors the
  no-composite design most strictly; but doesn't give the founder the "letter grade like Sales Coach").

## 5. Decisions I need from you

1. **Composite:** Option A (ship the letter now on existing counts) → B later? Or go straight for B
   (accept new instrumentation work for escalation-success + service-to-sales)?
2. **Letter grade at all, or counts-only (Option C)?** — you asked for a letter like Sales Coach; I want
   to confirm you want to cross the no-composite line (it's defensible with the section-2 guarantees).
3. **Standard/Expert split:** letter in Standard, raw counts in Expert — same as Sales Coach? (recommend
   yes, for consistency.)
4. **Where it lives:** a new `/dashboard/care/coach-assessment` page, or fold the grade into the existing
   `/dashboard/care/leadership` page?

## 6. Optimization suggestions (beyond the ask)

- **Make "learning gaps" the hero, not the grade.** The grade is a glance; the *coachable* output is
  "this agent keeps missing Voss's labeling / Cialdini's reciprocity" — that's what turns assessment into
  growth. It's also the strongest "backed by the books" proof for a prospect.
- **Trajectory over snapshot (§3.6).** A single grade is a flat line; show the grade's 4-week trend so
  the agent sees it move. Needs light periodization of the aggregate (bucket by week).
- **Tie the grade to downstream consequence (§3.5), not to itself.** Anchor "better" to resolution
  durability / fewer clarification cycles — not "the reply looked good." We already have the readouts
  cohort machinery (`fetchCoachRubricReadout`) to do this honestly.
- **Reuse, don't fork.** `eloToGrade` + `skillGrade` already encode the no-F / A11 / A4 discipline;
  `careQualityToGrade` should be their sibling, not a new philosophy.

---

**Recommended path:** Option A + the learning-gaps roster, on a new `/dashboard/care/coach-assessment`
page, Standard=letter / Expert=counts — ships the founder's ask on existing data with the section-2 guarantees,
and sets up Option B's richer metrics as a follow-up once escalation/sales signals are instrumented.
