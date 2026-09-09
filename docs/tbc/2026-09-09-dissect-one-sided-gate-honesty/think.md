---
started_at: 2026-09-09T13:23:00+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the dissect gate leaves a one-sided session ambiguous forever

## Why (the record — the 9/2 partner meeting, verbatim)
> "Difference between pitch analyzed and session dissected unclear. John Reynolds gave partial
> explanation (speech analyzed vs both prospect and agent), but underlying algorithm for whether a
> session gets dissected remains a known bug to be fixed."

Two complaints in one: a **buggy** half (whether a session gets dissected) and an **unclear** half
(a session can look analyzed but not dissected, with no explanation).

## Understanding (earned from the code, not assumed)
There are two review artifact families that share the transcript but gate on **different speaker
conditions**:

- **Dissect** ("Your read") and the **narrative** gate on **agent turns ≥ 1**
  (`salesDissect.ts:59-60`, `salesReview.ts:67-70`) — no agent speech, no dissect, and no LLM runs.
- **Moments** gate on **any speaker ≥ 1** (`salesMoments.ts:73`), and the After-Pitch composite is
  `narrative.hasSignal || moments.length>0 || scores.length>0 || …` (`afterPitch.ts:199-205`).

So a session whose **agent side failed STT** (0 agent turns — the "agent-missing" capture gap in
`captureGap.ts`) produces an After-Pitch summary via moments on the customer's speech ("analyzed")
while the Dissect and "Your read" are silently blank ("not dissected"). That IS Reynolds' "speech
analyzed vs both prospect and agent."

**The buggy locus** — `runAndStoreDissect` (`salesDissect.ts:132-172`):
- `hasSignal` → emit `coach.dissect_generated`.
- else **if agent turns ≥ MIN** → emit `coach.dissect_attempted` (14-day backfill backoff).
- else (0 agent turns) → **emit NOTHING.**

The 0-agent-turn session therefore carries **neither marker**. `dissectBackfill.ts:132-133` selects
sessions that are `!dissected && !recentlyAttempted` **and have transcript content** — a customer-only
session has content (customer segments), so it is re-selected **every backfill run forever**: it
occupies a capped batch slot (cap=6), starving genuinely-recoverable sessions, and freezes the manual
"Generate missing" count above 0 (a visibly broken-feeling manager surface — the same complaint).

The 2026-08-14 cost-loop fix (`docs/tbc/2026-08-14-dissect-backfill-cost-loop-backoff/`) closed this
exact loop for the `no_signal` case but **guarded the marker on `agent turns ≥ MIN`**, leaving the
identical loop open for the 0-agent-turn case. This is the §5 "confident well-formed fix that stopped
one hop short of its own class."

## The fix (founder chose "Targeted fix + honest status", 2026-09-09)
1. **Logic** — in `runAndStoreDissect`, when `!hasSignal`, ALWAYS emit `coach.dissect_attempted`, with
   a `reason` distinguishing `no_signal` (agent present, LLM ran) from `no_agent_turns` (thin/one-sided,
   no LLM). This backs off the 0-agent-turn session identically, ending the forever-reselect loop, and
   records an honest, manager-visible signal of WHY there is no dissect.
2. **UI** — the sessions list (`list/route.ts` → `sessions/page.tsx`, the manager surface named in the
   meeting) reads the latest `coach.dissect_attempted` reason per session and, when it is
   `no_agent_turns` AND the session has no dissect, renders an honest **"One-sided"** badge so the
   absence of a Dissect badge reads as *"the rep's side wasn't captured"* — not *broken* and not *still
   processing*.

### Why this altitude (not the deeper unification)
The deeper fix (one "capture completeness" verdict consumed by every engine + UI, AMD-010) removes the
split-gate drift permanently but is a high-blast-radius refactor of the most critical pipeline. The
founder chose the targeted fix: it repairs both halves the meeting named (the loop + the unclear UX) at
the marker/UI seam without touching the engines' signal logic. The split-gate remains and is recorded
here as the follow-up if the ambiguity recurs.

## Ripple (§1.5 — what else this touches)
- `coach.dissect_attempted` has ONE functional consumer, `dissectBackfill.ts:122`, which reads it by
  **kind only** (not payload) — so broadening WHEN it is emitted only extends the backoff to the
  0-agent case (intended); the added `reason` payload is new data no existing reader depends on.
- `events.kind` is free text (0004) and `coach.dissect_attempted` is not a `signal_sources` kind
  (0005) — no derivation trigger fires, no schema change.
- Re-labeling / re-transcription (`label-transcript`, `auto-recover`) regenerates via
  `generateSessionArtifacts` **directly**, bypassing the backfill's backoff check — so a
  `no_agent_turns` backoff marker never blocks a genuine recovery. No regression.
- `runAndStoreDissect.emit.test.ts:66-71` pins the OLD (buggy) "0 agent turns → emits NOTHING" behavior
  on a false "cheap re-check" rationale — updated to assert the backoff marker + reason.

## SS1.5.1 layers
- Layer 1 (structure): the marker gap is closed at its source; the UI derives from the marker, one
  source of truth for "why no dissect."
- Layer 2 (effectivity): the backfill stops re-selecting the stuck session; the "Generate missing"
  count can reach 0; the manager sees WHY a session has no dissect. Verified by test + typecheck +
  reading the rendered list state.
- Layer 4 (surface): the badge is an honest amber caveat, distinct from the neutral generated badges.

## Session-Reads (A22)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "Understanding precedes solving; a misdiagnosis fed more force is an error loop.",
    "how_this_build_will_embody_it": "The gate code and the 2026-08-14 backoff record were both read before any change; the root cause (marker guarded one hop short) is named from the code, not assumed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-44", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "The methodology defining 'understanding' for this domain must be in the working tree and read this session.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md are in this tree; each clause below was opened for this build and its hash is pinned in the front-matter." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "52-58", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "Identify the problem by looking backward at the actual record.",
    "how_this_build_will_embody_it": "The prior cost-loop TBC (2026-08-14) was read; this build closes the sibling case that fix left open." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "288-296", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "Trace what else a change touching shared state affects before committing.",
    "how_this_build_will_embody_it": "The one consumer of coach.dissect_attempted (dissectBackfill, kind-only) and the re-transcribe recovery path were both traced; the ripple section records that neither regresses." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "Four-layer evaluation — structure, effectivity, composition, surface — foundation up.",
    "how_this_build_will_embody_it": "Layers named in the SS1.5.1 section: the marker gap (layer 2) is fixed at source; the honest badge (layer 4) derives from it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "THINK first about how the surface and its neighbours could fail, then search to confirm.",
    "how_this_build_will_embody_it": "The hypothesis (two signal thresholds diverging) was formed first, then confirmed against salesDissect/salesReview/salesMoments and the backfill before any edit." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-325", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "Single-source decisions consumed as a verdict, not re-derived.",
    "how_this_build_will_embody_it": "The UI 'One-sided' status is DERIVED from the same dissect_attempted(reason) marker the backfill acts on — not re-computed from raw segments in the client." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-380", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "No fabrication; an honest empty/unavailable state over a fake one.",
    "how_this_build_will_embody_it": "A one-sided session is labeled honestly ('One-sided', the rep's side wasn't captured) rather than shown a fabricated dissect or left silently blank." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-432", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "Distrust the confident well-formed fix; a stated behavior left unmet under a green build is the failure mode.",
    "how_this_build_will_embody_it": "The 2026-08-14 fix was exactly a confident fix that stopped one hop short of its class; this build names that and closes the sibling case, guarded by a test." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-448", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "Item 0: a decision for the founder goes through a picker with a recommendation.",
    "how_this_build_will_embody_it": "The fix scope (targeted vs structural vs measure-first) was put to the founder as a picker; they chose the targeted fix, which this build executes." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "The governing methodology must live in the working tree.",
    "how_this_build_will_embody_it": "Both documents are in this tree and the line ranges cited are the ones actually opened this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-604", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "Citations without session-reading are violations operating undetected.",
    "how_this_build_will_embody_it": "Every clause here was opened for this build; the manifest carries an in-session read_at rather than a cached label." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-697", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "A reported bug is one instance of a class; sweep the class to its boundary.",
    "how_this_build_will_embody_it": "The class is 'a non-signal dissect that emits no backoff marker'; the boundary is the 0-agent-turn case the 2026-08-14 fix left uncovered." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "A lesson recorded only in prose returns; a fix is complete when the class is encoded in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The corrected emission is pinned by runAndStoreDissect.emit.test (both reasons) and the UI derivation by three list-route tests; the gate fails if the marker regresses." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1008", "read_at": "2026-09-09T13:23:20+08:00",
    "why_it_governs": "'Verified' names the canonical command actually run, in the project's own words.",
    "how_this_build_will_embody_it": "Verification is `npm run check` run whole (check.md names it), plus a visual read of the rendered list badge — not a mood." }
]
```
