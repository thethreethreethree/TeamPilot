---
tbc_version: 1
trigger: fix
started_at: 2026-08-14T06:30:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 13
hypotheses: 1
---

# THINK — "Reviewed" always 0: key off the durable event, not a status nothing writes

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) in-tree, hashes verified. Cited amendments read in
ThinkerThinker.md this session; CLAUDE.md §§ in-context.

## 2. Why (record-check §1.2 — CONFIRMED by grepping every writer)
Hole-hunt findings, confirmed against the code:
- **F1 (finding ③, HIGH):** the dashboard counts `reviewedCount = sessions.filter(s => s.status==='reviewed')`
  and `awaitingReview = status==='ended'` (dashboard/route.ts), but **no code path ever writes
  `status='reviewed'`** — grep confirms the only status write is `status:'ended'` (the review route appends a
  `coach.sales_review_generated` EVENT and never advances status). So "Reviewed" is permanently 0, "Awaiting
  review" never drains after a review, and — same root — the Sessions "Reviewed" filter (`list/route.ts`
  `.eq('status','reviewed')`) returns zero rows for everyone.
- **F2 (finding ⑪, MED):** `reviewsGenerated = reviews.length` off a `.limit(50)` events read that counts each
  REGENERATION event — so the count freezes at 50 and a regenerated review can make reviews > sessions (nonsense).

## 3. The fix
A reviewed session is an ENDED one with a `coach.sales_review_generated` event (subject `sales_session:<id>`) —
the SAME signal the list route already uses for its `hasReview` badge.
- **dashboard/route.ts:** page the agent's review events (uncapped, `actor`-filtered so no >1000-subject `.in`),
  build the reviewed-subject set; `reviewedCount` = sessions with a review event, `awaitingReview` = ended and
  NOT reviewed (so a review actually drains it), `reviewsGenerated` = distinct reviewed sessions (can't exceed
  sessions). recentGrowth from the most-recent reviews (sorted, since paged by id). Fail-loud on a reviews read
  error (unchanged shape).
- **list/route.ts:** the "reviewed" filter fetches ENDED sessions, then keeps only rows whose `hasReview` is true
  (the review-event set) — the DB `status='reviewed'` filter is removed.

## 4. Interconnections traced (§1.5)
- The dashboard's §3.4 fail-loud is preserved (reviews read now via fetchAllPaged → throws → null → 500).
- The list route's "active"/"ended" filters are UNCHANGED; only "reviewed" is re-routed. "ended" still means all
  ended (a reviewed session also being ended is acceptable — the pipeline mental model is awaiting→reviewed, and
  the dashboard `awaitingReview` already excludes reviewed).
- `hasReview` (already tested) is the exact set the list filter now uses, so the badge and the filter agree.
- No schema change — the durable event already exists and is already read elsewhere.

## 5. Hypothesis (§1.5.2)
- **H1 — do the reviewed counts now come from the durable event (never `status='reviewed'`), and is
  reviewsGenerated distinct-per-session?** Yes: dashboard tests assert reviewedCount/awaitingReview from review
  EVENTS (a status-based read would give 0), reviewsGenerated=1 for a twice-regenerated session, and ≤ sessions;
  the list test asserts the "reviewed" filter returns the event-backed session, not empty.

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-14T06:30:30Z", "source_file": "CLAUDE.md", "line_range": "1-40", "why_it_governs": "Understand from the record before fixing — grep every status writer to confirm 'reviewed' is never written, rather than trusting the label.", "how_this_build_will_embody_it": "Confirmed the only status write is 'ended'; the review route appends an event, never advances status." },
  { "id": "§0.1", "read_at": "2026-08-14T06:30:45Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified; amendments read in-session." },
  { "id": "§1.2", "read_at": "2026-08-14T06:31:00Z", "source_file": "CLAUDE.md", "line_range": "174-183", "why_it_governs": "Retrospective identification — the durable review EVENT already exists in the record and is the honest signal, versus a mutable status that no writer sets.", "how_this_build_will_embody_it": "Re-keyed the counts + the filter off the coach.sales_review_generated event the list route already consumes." },
  { "id": "§1.5", "read_at": "2026-08-14T06:31:30Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Holistic — the change touches two routes + must not disturb the fail-loud, the active/ended filters, or the badge derivation.", "how_this_build_will_embody_it": "Section 4 preserves each; only reviewed-count derivation + the reviewed filter change." },
  { "id": "§1.5.1", "read_at": "2026-08-14T06:32:00Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-2 effectivity — the pipeline card prescribes 'generate a review to drain Awaiting', but the number never moved; the surface must reflect the real action.", "how_this_build_will_embody_it": "Generating a review now moves the session from awaiting → reviewed on every surface." },
  { "id": "§1.5.2", "read_at": "2026-08-14T06:32:30Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "THINK-then-verify: the never-written status was hypothesised from the agent, CONFIRMED by grepping every writer before fixing.", "how_this_build_will_embody_it": "H1 gated by the dashboard + list regression tests." },
  { "id": "§3.4", "read_at": "2026-08-14T06:32:45Z", "source_file": "CLAUDE.md", "line_range": "244-260", "why_it_governs": "Honesty / no-instant-results — a metric that contradicts what the rep just did is a dishonest surface; and a failed read must not read as zero activity (the fail-loud must survive the rework).", "how_this_build_will_embody_it": "The counts now reflect real review activity; the reviews read fails loud (500) rather than returning a false empty readout." },
  { "id": "§6", "read_at": "2026-08-14T06:33:00Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "Checklist — trace ripple (dashboard counts, list filter, fail-loud, recentGrowth).", "how_this_build_will_embody_it": "All enumerated in Section 4." },
  { "id": "A19", "read_at": "2026-08-14T06:33:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-475", "why_it_governs": "Consult the in-tree code before changing it.", "how_this_build_will_embody_it": "Read the dashboard route, the list route, and the review-event writer before editing." },
  { "id": "A22", "read_at": "2026-08-14T06:34:00Z", "source_file": "ThinkerThinker.md", "line_range": "592-605", "why_it_governs": "Citations require in-session reading.", "how_this_build_will_embody_it": "Amendments read in ThinkerThinker.md this session." },
  { "id": "A26", "read_at": "2026-08-14T06:34:30Z", "source_file": "ThinkerThinker.md", "line_range": "689-694", "why_it_governs": "A finding is one instance of a class — sweep it. The never-written-status has TWO surfaces (dashboard counts + the list filter).", "how_this_build_will_embody_it": "Both the dashboard counts AND the Sessions 'Reviewed' filter re-keyed off the event, not just the one the founder saw." },
  { "id": "A30", "read_at": "2026-08-14T06:35:00Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "Encode the lesson in a gate.", "how_this_build_will_embody_it": "Dashboard tests lock reviewed-from-event + reviewsGenerated ≤ sessions; the list test locks the reviewed filter returns the event-backed session, not empty." },
  { "id": "A38", "read_at": "2026-08-14T06:35:30Z", "source_file": "ThinkerThinker.md", "line_range": "999-1006", "why_it_governs": "'Verified' = the canonical command + output.", "how_this_build_will_embody_it": "closure.md pastes `npm run check` + exit 0." }
]
```
