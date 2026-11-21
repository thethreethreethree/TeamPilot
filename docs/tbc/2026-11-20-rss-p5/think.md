---
started_at: 2026-11-20T01:00:00Z
trigger: Founder 2026-11-20, "continue building unless its a complete gate" — RSS plan docs/rss Phase 5 (find and reuse).
doc_integrity:
  CLAUDE.md: be387475f73d
  ThinkerThinker.md: 6acf9cf480e5
---

# THINK - RSS Phase 5: find and reuse

## The record

- Plan step 1: full-text index on the live transcript table. The live table is coaching_transcript_segments; readers
  go through 0269's coaching_transcript_segments_current view (security_invoker), so a search through the caller's
  client inherits RLS and the 0273 tree.
- Plan step 2: wire the scaffold's rss_share_granted() placeholder to recording_share_events (0260). The consent
  rule already exists as shareState() (src/lib/coach/recordings/shareState.ts — last answer wins; a later request
  does not reopen a grant). A SQL copy would be a second derivation of the same verdict (§2.2) → not built; the
  library route applies shareState's verdict.
- Sales list excludes meetings/huddles via NON_SALES_KINDS; search must too.
- The Sales Coach sidebar's contents are a recorded founder ruling guarded by salesCoachShellNav.test.ts; new nav
  items there would contradict it → entry points are links on Coach Assessment, Sessions, and the save confirmation.

## Decisions taken without the founder (none is a D-item)

- 'simple' text-search config (exact words, no stemming): reps speak more than one language.
- Library and saved searches are append-only; removal is a row (library_item_removals) or removed_at stamped once.
- Peer playback is of the whole recording the rep consented to; a clip bounds playback in the UI only.
