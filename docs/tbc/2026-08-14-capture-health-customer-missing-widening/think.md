---
tbc_version: 1
trigger: feature
started_at: 2026-08-14T02:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 12
hypotheses: 1
---

# THINK — widen capture-health to see the customer-missing class

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (record-check §1.2 — a blind spot the 2026-08-14 incident exposed)
The capture-health metric counts `noFeedback` = sessions with ZERO agent turns (route.ts:146 `continue`s any
session with an agent segment). The founder-reported 6-min session had 10 agent turns + a MISSING customer
side, so it was skipped — invisible to the metric, which is why the incident only showed up in a screenshot.
The metric undercounted the capture cost by only looking at one direction of one-sidedness. Founder approved
widening it (numbered option).

## 3. The change
Track `withCustomerSegment` alongside the existing agent/unknown sets, and count sessions where the agent side
is present but the customer side is absent as a new `customerMissing` bucket (+ rate + per-agent). This is the
same signal the auto-recover trigger uses (the talk_ratio caveat / custW===0). Additive: existing counts
unchanged. Surfaced on the manager-only capture-health card as its own Stat.

## 4. Interconnections traced (§1.5.1)
- `customerMissing` is DISJOINT from `noFeedback` (the latter is 0-agent; the former has agent turns), so no
  double-count. A two-sided session (agent + customer) is neither.
- Name resolution widened to include customerMissing-affected agents (so a rep with only customer-missing
  sessions still resolves to a name).
- The count reflects the CURRENT transcript state: once auto-recover adds the customer side, the session gains a
  customer segment and drops out of `customerMissing` — so this shows the currently-unrecovered backlog (an
  honest, if conservative, read; noted in closure).

## 5. Hypothesis (§1.5.2)
- **H1 — does `withAgentSegment && !withCustomerSegment` exactly capture the customer-missing class?** Yes: it is
  the segment-level equivalent of computeTalkRatio's `custW===0 && repW>0` caveat (no customer-labeled words
  while agent turns exist). CONFIRMED by the test: s2 (agent-only) → customerMissing; s1 (agent+customer) → not.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T02:00:05Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand the metric's blind spot from the record before changing it.", "how_this_build_will_embody_it": "Read the existing capture-health logic; the widening mirrors its documented prior extension." },
  { "id": "§0.1", "read_at": "2026-08-14T02:00:08Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified (Section 1)." },
  { "id": "§1.2", "read_at": "2026-08-14T02:00:11Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Record-check: the blind spot was confirmed in the route code (the agent-segment continue).", "how_this_build_will_embody_it": "Verified capture-health skips agent-present sessions before widening." },
  { "id": "§1.5.1", "read_at": "2026-08-14T02:00:14Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — disjointness from noFeedback, name resolution, the current-state semantics.", "how_this_build_will_embody_it": "Section 4 traces disjointness + name resolution + the recovered-drops-out behavior." },
  { "id": "§1.5.2", "read_at": "2026-08-14T02:00:16Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive THINK-then-verify: state the hypothesis about the derivation (disjointness from noFeedback) FIRST, then confirm it against the test rather than assuming it.", "how_this_build_will_embody_it": "H1 stated + confirmed by the route test's totals (noFeedback 3, customerMissing 1)." },
  { "id": "§3.4", "read_at": "2026-08-14T02:00:19Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "Make the value visible / honest measurement — the metric must not stay blind to a real failure class.", "how_this_build_will_embody_it": "The customer-missing class is now counted, not hidden." },
  { "id": "§3.6", "read_at": "2026-08-14T02:00:22Z", "source_file": "CLAUDE.md", "line_range": "334-345", "why_it_governs": "Make learning/visibility perceivable — surface the capture-failure the founder is worried about.", "how_this_build_will_embody_it": "The card shows the customer-missing count + rate + affected agents." },
  { "id": "§6", "read_at": "2026-08-14T02:00:25Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (disjointness, name lookup).", "how_this_build_will_embody_it": "Confirmed no double-count; name filter widened." },
  { "id": "A19", "read_at": "2026-08-14T02:00:26Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the in-tree route before extending it.", "how_this_build_will_embody_it": "Read the whole capture-health route + its test before adding the bucket." },
  { "id": "A22", "read_at": "2026-08-14T02:00:28Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "This manifest reflects this build's reads; minimum set present." },
  { "id": "A26", "read_at": "2026-08-14T02:00:31Z", "source_file": "ThinkerThinker.md", "line_range": "640-660", "why_it_governs": "Scope — the new bucket is precisely defined, no overlap with existing buckets.", "how_this_build_will_embody_it": "customerMissing is agent-present-customer-absent only; disjoint from noFeedback." },
  { "id": "A30", "read_at": "2026-08-14T02:00:34Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the derivation with a test.", "how_this_build_will_embody_it": "The route test asserts customerMissing=1 (s2) + rate + per-agent." },
  { "id": "A38", "read_at": "2026-08-14T02:00:37Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = command + output.", "how_this_build_will_embody_it": "closure.md pastes the full-gate output + exit code." }
]
```
