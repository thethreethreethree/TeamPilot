---
started_at: 2026-08-22T02:50:00+08:00
---

# THINK — Meeting Dissect review-fix pass (5 findings from an adversarial review)

An independent review of the fast-built Dissect found 5 real bugs (the payload-shape mismatch I flagged was
CLEAN — confirmed). Fixing them:

1. **HIGH — no-signal meetings re-charge STT+LLM on every view (cost loop).** The `meeting.dissect_attempted`
   backoff marker was a DEAD WRITE — nothing read it — so a thin/social/empty meeting (and a zero-segment
   transcription) re-ran batch STT + a ~20s LLM on every review. Fix: (a) `generateAndStoreMeetingDissect` emits
   the attempted marker on EVERY no-signal run (including zero segments, was gated on `>0`); (b) the dissect
   route's cache read now consults BOTH kinds — an attempted marker returns the empty state WITHOUT
   re-transcribing. This is the exact 2026-08-14 cost-loop class; the marker is now actually read (A30 — the
   lesson is only encoded once a gate consumes it).
2. **MEDIUM — the trend counted EVENTS, not distinct meetings.** A `?force` regen or a two-tab race inserts
   multiple `dissect_generated` events per meeting, inflating the "did we improve?" numbers. Fix:
   `aggregateMeetingDissects` dedups by subject (keep newest per subject); the trend route selects `subject`.
3. **MEDIUM-LOW — the history list hid meetings behind the 30-row pre-filter.** `listAgentSessions(30)` then a JS
   kind-filter pushed meetings out of the window for a mostly-sales facilitator. Fix: `listAgentMeetingSessions`
   filters by kind IN THE QUERY (A34-safe: pre-0237 the column is absent → [] not a throw).
4. **LOW — `MeetingReview` lacked the unmount guard its siblings have.** Added `mountedRef` + guards.
5. **LOW — the literal string "null" owner counted as owned.** Added `null` (+ someone/the team/everyone) to the
   `NO_OWNER` regex so an owner-less action is honestly owner-less (§3.4 — the exact signal the dissect surfaces).

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Understanding precedes solving — each fix was matched to the review's traced failure, not patched blindly.",
    "how_this_build_will_embody_it": "The cost-loop fix wires the attempted marker's reader; the dedup fixes the population, not a symptom." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Methodology in the tree, read this session.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session (02:57) before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Layer-2/3 — a review that re-charges forever, or a list that hides real meetings, is the feature not working as invoked.",
    "how_this_build_will_embody_it": "The cache honors the marker; the history query filters by kind so meetings aren't hidden." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "An independent adversarial review is proactive think-and-search applied to untestable code.",
    "how_this_build_will_embody_it": "Ran the review specifically for the fast-built Dissect; fixed all 5 findings with tests." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-415", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Honesty is the moat — an owner-less action must read as owner-less, not owned.",
    "how_this_build_will_embody_it": "The NO_OWNER regex now catches the string 'null' + vague non-owners." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "364-415", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "The trend must measure honestly — counting duplicate events misreports the team's improvement.",
    "how_this_build_will_embody_it": "The aggregate dedups by subject so it counts distinct meetings, not events." },
  { "id": "§3.6", "source_file": "CLAUDE.md", "line_range": "364-415", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Make learning visible — but a curve inflated by duplicates is a false signal.",
    "how_this_build_will_embody_it": "Dedup keeps the trend's 'did we improve?' numbers a true per-meeting count." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood each finding, traced ripple, stated the why; full gate green." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Methodology read in-session, not cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session (02:57) before this manifest." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "A lesson is only encoded once a GATE consumes it — the attempted marker was a dead write.",
    "how_this_build_will_embody_it": "The dissect route now READS the attempted marker, so the backoff actually fires (+ tests both branches)." },
  { "id": "A34", "source_file": "ThinkerThinker.md", "line_range": "872-895", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "Code that hard-requires an unapplied migration must degrade — reads that name the column, not throw.",
    "how_this_build_will_embody_it": "listAgentMeetingSessions returns [] on a missing session_kind column (pre-0237), naming the column." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T02:57:39+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3602 tests, exit 0), pasted in check.md." }
]
```
