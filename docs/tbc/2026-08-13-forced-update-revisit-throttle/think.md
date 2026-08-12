---
tbc_version: 1
trigger: fix
started_at: 2026-08-13T12:00:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — a reopen/revisit must bypass the version-check throttle (forced-update reliability)

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (a gap in my own forced-update, found on re-review)
The forced auto-update (e6f17db3) fires the secondary update on a genuine reopen/revisit (document hidden→visible).
But `check()` is throttled to once per 30s to avoid focus churn — and that throttle ALSO blocked the revisit
check: if a user backgrounds and returns within 30s of the last check, `check(true)` returned early, so
`scheduleReload()` never ran and the update silently did NOT apply on that reopen — the founder's exact goal
("auto-update on reopen/revisit") missed for a quick return. A genuine revisit is a distinct user event, not
churn; it should check fresh.

## 3. The fix
`check(autoReload, bypassThrottle = false)`; the throttle is skipped when `bypassThrottle` is set. The
visibility handler passes it on a real revisit (`check(revisited, revisited)`), so a reopen always checks fresh and
applies the update. The 30s throttle still governs ordinary focus churn (non-revisit). All the safety guards in
`scheduleReload` (recording hold, once-per-commit loop guard) are unchanged, so bypassing the throttle can't cause
a reload loop or interrupt a call.

## 4. Boundary (§1.5.1 / A26)
Only the revisit path bypasses the throttle; mount + ordinary focus are unchanged. The pure `shouldForceReload`
decision (and its 7 tests) is unchanged — this is the check() scheduling around it. The visibility/throttle wiring
is React/DOM (node-untestable, A30 honest).

## 5. Hypothesis (§1.5.2)
- **H1 — does a quick reopen now apply the update, without enabling a reload loop or call interrupt?** Yes: the
  revisit bypasses only the THROTTLE and still routes through `scheduleReload` → `shouldForceReload`, which holds
  on recording and stops after one reload per commit. CONFIRMED — the 7 shouldForceReload guard tests are unchanged
  and pass; typecheck clean.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-13T12:00:20Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand the check()/throttle/visibility flow before changing it, so the fix doesn't weaken the churn throttle or the guards.", "how_this_build_will_embody_it": "Section 3 scopes the bypass to the revisit path only; the guards are untouched." },
  { "id": "§0.1", "read_at": "2026-08-13T12:00:20Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.2", "read_at": "2026-08-13T12:00:40Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective — the gap is in my own just-shipped code (e6f17db3), found by re-reading the actual throttle interaction, not theory.", "how_this_build_will_embody_it": "Section 2 traces the exact throttle-blocks-revisit path." },
  { "id": "§1.5.1", "read_at": "2026-08-13T12:00:55Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — must fix the revisit reliability without breaking the churn throttle or the reload guards.", "how_this_build_will_embody_it": "Bypass is revisit-only; scheduleReload guards unchanged (section 4)." },
  { "id": "§1.5.2", "read_at": "2026-08-13T12:01:05Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive re-review of a just-shipped critical change surfaced a real reliability gap.", "how_this_build_will_embody_it": "A specific, traced gap in the forced-update, fixed narrowly." },
  { "id": "§6", "read_at": "2026-08-13T12:01:15Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — confirm the guards still hold before re-shipping to all clients.", "how_this_build_will_embody_it": "H1 + the unchanged, passing guard tests." },
  { "id": "A19", "read_at": "2026-08-13T12:00:50Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the current VersionWatcher in-tree before amending it.", "how_this_build_will_embody_it": "Re-read check() + the visibility handler before the edit." },
  { "id": "A22", "read_at": "2026-08-13T12:01:25Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads; minimum set present." },
  { "id": "A30", "read_at": "2026-08-13T12:01:35Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Gate the lesson where testable; honest where not.", "how_this_build_will_embody_it": "The safety decision (shouldForceReload) stays covered by its 7 tests; the throttle/visibility wiring is React/DOM (node-untestable), stated honestly." },
  { "id": "A38", "read_at": "2026-08-13T12:01:45Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "check/closure paste the full-gate output with its exit code." }
]
```
