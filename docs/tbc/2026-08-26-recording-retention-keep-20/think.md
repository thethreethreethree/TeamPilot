---
started_at: 2026-08-26T09:57:00+08:00
---

# THINK — recording retention: keep each rep's last 20 (not delete-after-2-days)

## The ask + understanding (from the code)
Founder: "save last 20 recordings rather than deleted after days (in case a rep doesn't pitch for more than 2 days.
There will be recording to pull from)." Read the purge: `recording-purge-cron` deleted the audio bytes for any
coaching_session older than RETENTION_DAYS=2 with recording_saved=false. So a rep who didn't pitch for >2 days had
NOTHING for a manager to pull from — the exact gap the founder names.

## The change (§1.5.1 layer 2 — the retention actually serves the manager)
Replace the AGE rule with a per-rep COUNT rule: keep each rep's KEEP_PER_REP=20 most-recent recordings; purge only
the ones OLDER than that window. So there's always a rolling window of recent recordings regardless of how long ago
the rep pitched. Everything ELSE about the cron is preserved: the malformed-pointer guard (never false-ok null a
pointer whose object it can't verify — the retention-integrity property this cron exists to hold), the chunk cleanup,
the transcript/scores are KEPT (only the audio bytes drop), saved recordings (rep/manager) are exempt (never candidates).

## How (cap-safe)
Fetch ALL purge-eligible recordings (audio not null, recording_saved=false), NEWEST-first, via `fetchAllPaged`
(cap-immune — not a raw `.select()` that truncates at 1000). Group by agent_id: the first 20 stay; the rest are
"beyond window". Purge oldest-first (reverse), capped at BATCH=500, with an honest `bounded` flag when more remain.

## Ripple (holistic — §6 item 5)
- Same cron, same auth, same storage-removal + chunk-cleanup + malformed-guard; only the SELECTION changed (age → count).
- The candidate set is bounded (only sessions that still HAVE audio) — and shrinks as the rule reaches steady state.
- No schema change (recording_saved already exists). Response swaps `retentionDays` for `keepPerRep` + a beyondWindow count.

## §3.4 honesty preserved
The malformed-pointer guard stays: a pointer whose object can't be verified gone is flagged `malformed`, never
nulled-and-counted-purged. The `bounded` flag is honest (true = more beyond-window recordings remain).

## A30 gate
Tests: purges ONLY the recordings beyond a rep's 20-window (21 → exactly the oldest, s1..s20 untouched); the malformed
guard still refuses a beyond-window unrecognized pointer. Both purge-cron test files updated to the count model.

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 09:57:00)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-26T10:02:20+08:00",
    "why_it_governs": "Understand the current purge + the founder's gap before changing retention.",
    "how_this_build_will_embody_it": "Read the age-based cron + named the exact gap (>2-day-idle rep loses everything) before switching to count." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-26T10:02:22+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "Cited axioms re-read fresh this build." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "88-92", "read_at": "2026-08-26T10:02:24+08:00",
    "why_it_governs": "Layer 2 — retention must actually leave recordings for the manager to pull, which the age rule failed to do.",
    "how_this_build_will_embody_it": "Count rule keeps a rolling per-rep window regardless of idle time." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-149", "read_at": "2026-08-26T10:02:26+08:00",
    "why_it_governs": "Preserve the surrounding invariants, not just swap the rule.",
    "how_this_build_will_embody_it": "Kept the malformed-pointer guard, chunk cleanup, saved-exempt, transcript-kept; only the selection changed." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-367", "read_at": "2026-08-26T10:02:28+08:00",
    "why_it_governs": "Honesty — never a false-ok purge; honest bounded flag.",
    "how_this_build_will_embody_it": "Malformed guard + bounded flag retained; a pointer that can't be verified gone is flagged, not silently nulled." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-436", "read_at": "2026-08-26T10:02:30+08:00",
    "why_it_governs": "Quick-decision checklist.",
    "how_this_build_will_embody_it": "Ran it: understood the gap, traced ripple (invariants preserved), cap-safe query, gated with tests." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-457", "read_at": "2026-08-26T10:02:32+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-596", "read_at": "2026-08-26T10:02:34+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every § with a fresh read_at; the trailer lists them." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-772", "read_at": "2026-08-26T10:02:36+08:00",
    "why_it_governs": "Gate the retention behavior.",
    "how_this_build_will_embody_it": "Both purge-cron test files updated: purges only beyond-window recordings; malformed guard intact." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1003", "read_at": "2026-08-26T10:02:38+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
