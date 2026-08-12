---
tbc_version: 1
trigger: fix
started_at: 2026-08-13T10:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 11
hypotheses: 2
---

# THINK — two §3.4 display-honesty fixes (finance count-failure disclosure + after-pitch conversation label)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why — both are surfaces that CLAIM something that isn't true (§3.4)
**F1 — finance register (my own xx change).** The register's truncation disclosure head-counts the total only
when the page is full, and computed `truncated = total > rows.length`. If the head-count read FAILS, the old code
left `total = rows.length` → `truncated = false` → the notice vanished → the register showed 1,000 rows as if
complete. A rare (two consecutive same-table reads) but real silent-truncation on an error edge.

**F2 — after-pitch subtitle (founder screenshot 2026-08-13).** The header shows "· {dur} conversation" whenever a
duration exists. For a session with no audio, `conversationDurationSeconds` falls back to the started..ended
WALL-CLOCK (how long the session sat OPEN) — so an empty session that captured nothing still reads "9m 9s
conversation", directly contradicting the "No conversation was captured" body right below it. The founder saw
exactly this ("First sale · 9m 9s conversation" over "No conversation was captured").

## 3. The fixes
- **F1:** route returns `total: number | null` (null = count unavailable); `truncated = pageFull && (total ===
  null || total > rows.length)`. A full page discloses truncation even when the count is unknown; exactly-1000
  (count === PAGE_MAX) is correctly NOT truncated. UI renders "of N" when known, "there may be older lines" when
  null. Tests: +2 edges (count-failure discloses / exactly-1000 not truncated), mutation-checked.
- **F2:** only render "· {dur} conversation" when a conversation was actually CAPTURED — real audio
  (`session.audioDurationSeconds`, an upload) OR a transcript with signal (`summary?.hasSignal`). Otherwise `dur`
  is idle wall-clock; fall through to the context label, so the header never claims a conversation the body denies.

## 4. Boundary (§1.5.1 / A26)
F1 changes only the count-failure + exactly-1000 edges (common cases unchanged). F2 changes only the empty/
not-yet-captured header (a captured live/upload session still shows "· Xm Ys conversation"). F2 is a React display
component (node-untestable, A30) — the change is a display-gate on an existing derived value, low-risk; F1's
load-bearing route logic IS tested.

## 5. Hypotheses (§1.5.2)
- **H1 (F1) — does the count-failure branch disclose without falsely flagging exactly-1000?** Yes — `pageFull &&
  (total === null || total > rows.length)`. CONFIRMED (6 route tests incl. both edges; count-failure mutation
  fails then reverted).
- **H2 (F2) — does a genuinely-captured session still show "conversation"?** Yes — an upload has
  audioDurationSeconds; a live call with a transcript has summary.hasSignal; only the empty/no-capture case loses
  the label. CONFIRMED by reading conversationDuration.ts (wall-clock fallback) + the summary/hasSignal state.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-13T10:00:20Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Trace each surface's claim to its data before changing the copy/logic.", "how_this_build_will_embody_it": "Section 2 traces the finance count-failure branch + the wall-clock fallback feeding the subtitle." },
  { "id": "§0.1", "read_at": "2026-08-13T10:00:20Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-13T10:00:40Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Both were found by looking at the actual record — my own xx count-path (F1) and the founder's screenshot (F2), not theory.", "how_this_build_will_embody_it": "Section 2 grounds each in its concrete trigger." },
  { "id": "§1.5.1", "read_at": "2026-08-13T10:00:55Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — F1 ripples route→UI→test; F2 must not strip the label from genuinely-captured sessions.", "how_this_build_will_embody_it": "F1 updates all three; F2 gates on audio-or-signal so captured sessions keep the label (section 4)." },
  { "id": "§1.5.2", "read_at": "2026-08-13T10:01:05Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Specific, evidence-backed fixes (one from my own change, one from the founder's screenshot) — not fishing.", "how_this_build_will_embody_it": "Two concrete surfaces, each with a named trigger + a bounded change." },
  { "id": "§3.4", "read_at": "2026-08-13T10:01:15Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "THE rule for both — a surface must not claim completeness (F1) or a conversation (F2) that isn't real.", "how_this_build_will_embody_it": "F1 discloses truncation even on a count-failure; F2 drops the 'conversation' claim when nothing was captured." },
  { "id": "§6", "read_at": "2026-08-13T10:01:20Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — confirm the common cases hold before shipping to live finance + the founder's incident surface.", "how_this_build_will_embody_it": "H1/H2 + the finance route tests." },
  { "id": "A19", "read_at": "2026-08-13T10:00:50Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult each surface + its data source in-tree before changing it.", "how_this_build_will_embody_it": "Read the finance route/UI/test + conversationDuration.ts + the after-pitch subtitle/summary state in-tree." },
  { "id": "A22", "read_at": "2026-08-13T10:01:30Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads; minimum set present." },
  { "id": "A30", "read_at": "2026-08-13T10:01:40Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the lesson where testable; be honest where not.", "how_this_build_will_embody_it": "F1: +2 route tests, mutation-checked. F2: React display — node-untestable (honest), a display-gate on an existing value." },
  { "id": "A38", "read_at": "2026-08-13T10:01:50Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output with its exit code." }
]
```
