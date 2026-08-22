---
started_at: 2026-08-22T14:45:00+08:00
---

# THINK — Pitch worker: a lost derived-table write must never dress a pitch as "complete" (audit H3)

Reliability-audit finding **H3** (`docs/RELIABILITY-AUDIT-2026-08-22.md`), the third of Bundle A (H1 ✅, H2 ✅).
It is the same *honesty* class as the founder's trust-crisis complaint — a failure shown to the rep as a normal
or perpetual state.

## Diagnosis (§0, §1.2 — from the code)

`writePitchTranscript`, `writePitchAnalysis`, and `setPitchStatus` each did `await sb.from(...).upsert/update(...)`
and **never inspected the Supabase `error`**. So if `writePitchAnalysis` failed transiently but the following
`setPitchStatus("complete")` succeeded, the pitch was `complete` with **no analysis row**. `PitchDetail`
special-cases only `failed`, so a `complete`-with-no-analysis rendered **"Still processing — the analysis will
appear here shortly." forever** — a spinner that never resolves. Textbook *error-dressed-as-no-data*
(the INV22 lens: a data-layer path that swallows a failure into a value).

## Fix (§1.7 altitude — honesty at the source, contract preserved)

1. **Data layer throws.** The three writes now throw on `error` (`assertNoWriteError`). Ordering already writes
   `complete` only AFTER `writePitchAnalysis` returns, so a throwing analysis write can no longer be outrun by the
   status flip. A throw routes into the worker's catch → retry → honest terminal `failed`. Idempotent upserts make
   the retry safe (re-analyze overwrites).
2. **Worker keeps "never throws."** `setPitchStatus` now throws too, but the worker calls it on its FAILURE paths
   (the H2 poison gate + the catch) through a new best-effort `recordFailureStatus` that swallows + reports to
   Sentry — if we can't even persist the failure, the lease expires and the cron re-claims it. The happy-path
   status writes stay inside the `try`, so their throws are caught and retried.
3. **UI honesty (§3.4, layer-2/4).** `PitchDetail` now shows a truthful "Analysis unavailable — this pitch
   finished, but its analysis didn't save" for a `complete`-with-no-analysis row (legacy/edge), and still shows
   the transcript — NEVER the forever-spinner. The root fix prevents NEW such rows; this covers any that exist.

## Ripple (§1.5)
The three helpers are used ONLY by the worker (grepped). No schema change, no migration. Deployable now.

## Class sweep (A26)
Root shape: *"a derived/data write whose error is discarded, so a downstream success (status flip) presents the
missing data as complete/empty."* The audit's three independent auditors already swept the pipeline; the
data-layer catch-swallow class is guarded elsewhere by INV22 (invariant:audit). These three helpers had no catch
at all (just an unchecked `error`), so INV22 didn't flag them — now closed. H4/M4 (meeting Dissect caches a
transient failure) is a DIFFERENT shape (a backoff marker written for any non-success) — next bundle.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Understand before solving — traced the exact swallow → complete-without-analysis path in the code.",
    "how_this_build_will_embody_it": "Fix targets the unchecked `error`, the named root, not the UI symptom alone." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-read §3.4 + A30 (and the other cited assets) via Read this session before writing." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Retrospective identification — the defect was read off the code + the audit record, backward.",
    "how_this_build_will_embody_it": "The swallow → complete-without-analysis path was traced in the helpers, not theorised." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-74", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Holistic + organic — trace ripple before acting.",
    "how_this_build_will_embody_it": "Traced the three helpers → worker (contract) → PitchDetail seam; worker-only callers confirmed." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Layer-2 (a pitch must reach a truthful terminal state) AND layer-4 (the surface must not show a falsehood).",
    "how_this_build_will_embody_it": "No hollow 'complete'; PitchDetail shows honest 'analysis unavailable', not a forever spinner." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Proactive THINK + search — checked the callers and the UI symptom, not just the helper.",
    "how_this_build_will_embody_it": "Traced the write helpers → worker → PitchDetail seam and closed it end-to-end." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-266", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Fix at the foundation — data-layer honesty at the source, not a UI patch alone.",
    "how_this_build_will_embody_it": "The helpers throw at the source; the UI branch is defense-in-depth for legacy rows." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-386", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Honesty is the moat — never show a fabricated 'complete' or an unresolvable 'processing'.",
    "how_this_build_will_embody_it": "Lost write → honest terminal failed; complete-without-analysis → honest 'unavailable' copy." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from code, traced ripple (single caller + UI), swept the class, encoded gates." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this session, not cached labels." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-710", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "A reported bug is one instance of a class; sweep the boundary.",
    "how_this_build_will_embody_it": "Named the swallow-error root shape; noted INV22 covers the catch-swallow variant, these had no catch." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Tests lock: each helper throws on error + resolves on success; worker never writes 'complete' on a failed analysis write; PitchDetail shows honest copy." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md carries the full `npm run check` exit-0 output + the exact test count." }
]
```
