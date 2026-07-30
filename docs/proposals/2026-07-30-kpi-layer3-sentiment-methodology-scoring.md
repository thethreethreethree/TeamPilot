# Proposal — KPI Layer-3 AI scoring: Sentiment trajectory + Methodology adherence

**Date:** 2026-07-30 · **Status:** PROPOSAL (awaiting founder confirmation) · **Author:** build agent
**Spec:** `SalesCoach-KPI-System.md` §2 Layer 3, §5 Technical Notes, §6 Phase 3
**Why this doc exists:** the spec's build process (§6) requires that Layer-3 AI scoring be *proposed* — data
model + approach + reasoning — and **confirmed before implementation**. This is also an AI-cost surface, so the
guide-don't-overtake rule (constitution §3.3) says propose the design and the cost controls first, not switch
it on silently.

---

## 1. What this unlocks

Two named Layer-3 metrics currently reading "building" for lack of a scoring pass (not lack of data):

- **Sentiment trajectory** — customer sentiment at the start of the call vs. the end. Answers "did the rep
  move the customer's mood in the right direction?" — a leading signal that predicts outcome.
- **Methodology adherence** — did the call follow *this company's* defined sales framework (the methodology
  the manager already writes/uploads in Coaching settings)? This is the one Layer-3 metric that is
  **per-tenant by definition** — there is no generic right answer, which is exactly the constitution's
  "each company has its own personality" (§5).

Both are already listed in the spec (§2 Layer 3, lines 54–55). Neither exists today.

## 2. The honest problem first (understand before building)

The current after-pitch scores (opener, objection, tone, close, question_rate, next_step) are produced **once
per session** from the transcript, and Layer 3 of the KPI system *reuses* them. Sentiment trajectory and
methodology adherence are **not** in that set, so they need a scoring pass. Three real constraints:

1. **Cost.** Every new scored dimension is another LLM call (or more tokens on an existing call) per session.
   Across many tenants and sessions this compounds. There is an existing per-tenant AI-cost concern on record
   (`docs/feature-specs/AI-COST-CAP.md`) — this proposal must not bypass it.
2. **Trust.** Per the Understanding Gate (spec §1.3, §5): a score must cite the transcript evidence that
   justifies it and return **"insufficient evidence"** rather than guess. A sentiment number with no cited
   turn behind it is exactly the confident-guess failure the whole system exists to prevent.
3. **Diarization dependency.** Sentiment start-vs-end needs the transcript reliably attributed to
   *customer* turns. Transcript quality bounds this metric (spec §5). Where diarization confidence is low, the
   metric must degrade honestly, not fabricate.

## 3. Proposed approach (reuse, don't reinvent)

**3a. Fold into the existing after-pitch scoring call — do NOT add a second pass.**
The after-pitch summary already runs one LLM call over the transcript and returns `payload.scores` (a
`ScoreCategory[]` of `{key, score, citation, caveat}`). Add two dimensions to *that same call's* output
schema — `sentiment_trajectory` and `methodology_adherence` — so the marginal cost is a few extra output
tokens on a call that already happens, not a whole new request. This keeps Layer-3 KPI ingestion unchanged:
the KPI `/me` route already maps `payload.scores` by key, so both appear automatically once the keys exist.

- `sentiment_trajectory`: score 0–10 where the model estimates customer sentiment in the **first** third vs
  the **last** third of the customer's turns and reports the *delta* direction+magnitude, with a cited pair of
  turns (one early, one late). `caveat: true` when diarization/segment coverage is thin → renders "building".
- `methodology_adherence`: score 0–10 against the tenant's **own** methodology text (already stored, already
  fed to the live coach). The prompt injects that methodology as the rubric. No methodology set → the
  dimension is **omitted** (not scored 0) so the metric honestly reads "building" until a manager defines the
  framework. This preserves §3.4 (no fabricated day-one behavior).

**3b. Editable templates, not hardcoded prompts** (spec §5). The two new rubric fragments live in the same
editable scoring-template location as the current after-pitch prompt, so a manager/founder can tune them.

**3c. Understanding Gate at the query layer** (spec §5, §1.3). Sentiment trajectory and methodology adherence
flow through the *same* `layer3Dimension` aggregator that already enforces MIN_SESSIONS and skips caveated
scores — so no new gate code, and a thin history reads "building" for free.

**3d. Cost control.** Because we fold into the existing call, there is **no new per-session request**. The
only added cost is output tokens. Still: (i) respect the existing AI-cost-cap surface, (ii) the scoring stays
on the current provider abstraction (`chooseProvider`), and (iii) it runs only where an after-pitch summary is
already produced — never a new trigger.

## 4. Data model — no new table needed (with a noted alternative)

The spec §3 sketches a dedicated `quality_score` table with `evidence_segs[]` + `confidence`. We **do not need
it for v1**: the after-pitch `payload.scores[]` already carries `{score, citation, caveat}` per dimension,
which satisfies "cited evidence + insufficient-evidence state." Adding the two keys reuses that shape.

- **v1 (proposed):** two new keys in `payload.scores`. Zero schema change. Ships behind the existing pipeline.
- **v2 (if/when needed):** promote to a first-class `quality_score` table when we want per-*segment* evidence
  linkage and a numeric confidence separate from the caveat flag. Deferred — YAGNI until a consumer needs it.

## 5. What I need from you (the decision)

1. **Go / no-go on folding these two dimensions into the after-pitch scoring call.** (Recommended: go — it's
   the lowest-cost, highest-reuse path and changes no schema.)
2. **Confirm the cost posture:** fold-into-existing-call only, no second pass, respect the AI-cost cap. (This
   is the honesty-preserving default; I will not add a standalone scoring cron without your explicit yes.)
3. **Methodology-adherence framing:** score only against the tenant's *own* uploaded methodology, and omit the
   dimension entirely when none is set (no generic fallback). (Recommended: yes — it's the §3.4/§5 honest form.)

On your go, implementation is: extend the after-pitch scoring template with the two rubric fragments + output
keys, add the keys to `LAYER3_KEYS` in the KPI `/me` route, add a page row for each, and test the aggregation
+ the "omitted when no methodology" path. No migration. Estimated small.

## 6. What this proposal deliberately does NOT do

- It does not switch on any LLM scoring — that waits for your confirmation (spec §6, §3.3).
- It does not add a new per-session request or a new cron (cost discipline).
- It does not fabricate a sentiment/methodology number where evidence is thin — those read "building."
