---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T06:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — After-Pitch recovery: first-visit miss + transient-failure marker burn

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) in-tree, hashes verified. Cited amendments read in
ThinkerThinker.md this session; CLAUDE.md §§ in-context.

## 2. Why (record-check §1.2 — CONFIRMED against the code, from the hole-hunt)
Two confirmed gaps in the customer-missing After-Pitch recovery (the exact founder-reported incident class):
- **F1 (finding ②, HIGH):** `afterPitchNeedsAutoRecover(existing, …)` (captureGap.ts:46-51) requires `!!existing`.
  On a customer-missing session's FIRST visit the stored After-Pitch summary is null → the auto-recover branch
  in `load()` (after-pitch/page.tsx) is false, and control falls to the heal branch, which just `generate()`s a
  BLANK read. Auto-recover only fires on a LATER mount (once a blank summary is stored) — which a Standard rep
  never gets, because only the ExperienceMode reconcile re-runs `load()`. So the Standard door-to-door rep (the
  exact user this recovery exists for) is stranded on a blank read on first view.
- **F2 (finding ⑦, MED):** the auto-recover route's own doctrine (route.ts:129-132) is "release the marker on a
  TRANSIENT failure, keep it on a DEFINITIVE outcome." It correctly releases on download 502 (:156) and STT 502
  (:175), but the `replaceSessionTranscript` failure path (:216-221) returned 500 WITHOUT releasing — even
  though the atomic replace rolled back (transcript intact), which is exactly as transient as an STT 502. One DB
  blip then permanently burns automatic recovery.

## 3. The fix
- **F1:** `generate()` now RETURNS the freshly-built summary. In `load()`'s heal branch (which handles
  `existing === null`), after generating we check the FRESH summary: if it's the recoverable customer-missing
  gap (with saved audio, non-video), engage auto-recover from it — no second mount required. Uses the SAME
  `afterPitchNeedsAutoRecover` predicate (already tested: customer-missing + audio → true), just fed the fresh
  summary instead of only a previously-stored one. The shared marker latch still prevents a double auto-recover.
- **F2:** add `await releaseMarker()` before the replace-failure 500, matching the route's transient-vs-definitive
  rule and the download/STT paths.

## 4. Interconnections traced (§1.5)
- F1 does not change the STARVED-read heal (scores>0, blank narrative, NO caveat) — that still just regenerates;
  only a customer-missing FRESH summary now additionally triggers auto-recover. The video-session skip and the
  once-per-id latch are preserved.
- The `generate()` return value is additive — its existing callers (the manual button, the auto-recover
  "recovered" path) ignore the return, so their behavior is unchanged.
- F2 only adds a marker release on a failure path; the success path + the definitive-decline paths
  (single-cluster / ambiguous, which keep the marker) are untouched.

## 5. Hypothesis (§1.5.2)
- **H1 — on a customer-missing first visit, does auto-recover now engage from the FRESH summary (not only a
  stored one)?** Yes: `generate()` returns the customer-missing summary and `afterPitchNeedsAutoRecover(fresh,
  true)` is true (captureGap.test.ts:52), so `autoRecover()` fires in the same `load()`. F2 is gated by the
  route test asserting the marker is released on a replace failure (`markerWasReleased()`).

## Out of scope (deferred follow-up — findings ⑥ + ⑧)
Two MED findings in the SAME recovery flow are deliberately NOT bundled here — they require persisting new
server-side state in the trust-critical path and deserve focused attention, not a bloated-session change:
- **finding ⑥:** if the client `generate()` after a server "recovered" is lost, the stored blank After-Pitch is
  never refreshed (the server after() regenerates dissect/summary/etc. but not the After-Pitch summary).
- **finding ⑧:** a genuine single-voice decline isn't persisted with its reason, so on reload it reads as generic
  "already-attempted" and offers a re-transcribe card that re-charges STT and dead-ends at label-transcript.
Both flagged in check.md residual for a dedicated build.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T06:00:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the recovery flow from the record before changing it — read load()/generate()/autoRecover() + the route, not just the agent label.", "how_this_build_will_embody_it": "Traced the first-visit null-summary path + the route's marker-release branches before editing." },
  { "id": "§0.1", "read_at": "2026-08-14T06:00:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified; amendments read in-session." },
  { "id": "§1.2", "read_at": "2026-08-14T06:01:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — both gaps read FROM the code (the null-summary predicate + the missing release branch).", "how_this_build_will_embody_it": "Confirmed afterPitchNeedsAutoRecover requires !!summary + the replace-fail path skips releaseMarker before touching anything." },
  { "id": "§1.5", "read_at": "2026-08-14T06:01:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the change touches the client load flow + the server route; must not disturb the starved-heal, the video skip, the latch, or the definitive-decline marker semantics.", "how_this_build_will_embody_it": "Section 4 preserves each; only the customer-missing-fresh path + the replace-fail release change." },
  { "id": "§1.5.1", "read_at": "2026-08-14T06:02:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-3 continuity — a blank read with no recovery is a dead end for the rep; the fix must leave them flowing toward a recovered read.", "how_this_build_will_embody_it": "First-visit auto-recover now engages, so the Standard rep reaches a two-sided read instead of a stranded blank." },
  { "id": "§1.5.2", "read_at": "2026-08-14T06:02:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-verify: the first-visit miss was hypothesised from the agent, CONFIRMED by reading the predicate + the load branch before fixing.", "how_this_build_will_embody_it": "H1 gated by captureGap.test.ts + the route test." },
  { "id": "§6", "read_at": "2026-08-14T06:03:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (heal path, video skip, latch, generate() callers, route decline paths).", "how_this_build_will_embody_it": "All enumerated in Section 4." },
  { "id": "A19", "read_at": "2026-08-14T06:03:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read the page + the route + the predicates before editing." },
  { "id": "A22", "read_at": "2026-08-14T06:04:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Amendments read in ThinkerThinker.md this session." },
  { "id": "A26", "read_at": "2026-08-14T06:04:30Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "A finding is one instance of a class — but also: don't over-bundle; sweep what's tractable + safe, flag the rest.", "how_this_build_will_embody_it": "Fixed the two tractable gaps (2, 7); flagged 6 + 8 as a focused follow-up with reasons rather than rushing subtle server-state into a bloated session." },
  { "id": "A30", "read_at": "2026-08-14T06:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "The route test asserts the marker is released on a replace failure (markerWasReleased) — removing the release reddens CI." },
  { "id": "A38", "read_at": "2026-08-14T06:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit 0." }
]
```
