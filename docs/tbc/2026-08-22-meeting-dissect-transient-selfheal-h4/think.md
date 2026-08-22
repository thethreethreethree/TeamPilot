---
started_at: 2026-08-22T15:06:00+08:00
---

# THINK — Meeting Dissect: a transient failure must self-heal, not cache a permanent empty (audit H4)

Reliability-audit finding **H4** — the last HIGH, and the audit calls it *worse* than the pitch bug because the
pitch path has a cron backstop and this did not. Prep-up (now feature-complete) depends on this Dissect, so its
reliability is load-bearing.

## Diagnosis (§0, §1.2 — from the code)

`generateMeetingDissect` collapsed **five** distinct outcomes into one `EMPTY_MEETING_DISSECT` (hasSignal:false):
segments==0, control-`suppressed`, empty LLM text (token starvation), parse failure, and a thrown exception. Then
`generateAndStoreMeetingDissect` wrote a durable `meeting.dissect_attempted` backoff marker for **every**
hasSignal:false case, and the route returns the empty state for that marker **without re-running**. So a TRANSIENT
failure (a one-off token-starvation blip on a meeting that HAD decisions/actions) was cached as a **permanent
empty** — the captured content silently lost; recovery only via a hidden `?force=1`. This is the INV22
error-dressed-as-no-data class, at the meeting seam.

## Fix (§1.7 altitude — distinguish the outcome at the source)

Introduce a `DissectOutcome = "signal" | "empty" | "transient"` and set it on every return branch:
- **signal** — a real dissect → store `dissect_generated` (the durable cache). Unchanged.
- **empty** — the LLM ran, parsed, and found nothing (a genuinely thin meeting), OR the audio transcribed to zero
  segments → store the `dissect_attempted` backoff marker. This is the ONLY no-signal case that should back off
  (a re-run won't differ), and it preserves the cost-loop protection the marker was built for.
- **transient** — empty LLM text / unparseable-or-array JSON / a throw / control-suppressed → **write NO marker**.
  With no marker cached, the route re-transcribes + retries on the next view and self-heals; a success then writes
  the durable generated event. The route returns an honest **503 `{ retryable: true }`** so the UI shows
  "didn't generate — try again" (the existing error+Retry state) instead of a silent empty.

Parse layer distinguishes a genuine thin meeting (valid JSON, empty arrays → "empty") from a token-starved
truncated / malformed response (unparseable, or a bare array — `typeof [] === "object"`, guarded explicitly →
"transient").

## Honesty (§3.4 / §3.5)
No fabricated content anywhere; the dissect still measures the meeting's CONSEQUENCES only (§3.5), never the cues.
A transient failure now tells the truth ("didn't generate, retry") rather than the honest-LOOKING but false "this
meeting produced nothing."

## Class sweep (A26 / §1.5.2)
Root shape: *"a transient processing failure cached as a permanent terminal-empty with no self-heal."* The audit
notes the SALES dissect already self-heals (idempotency keyed off the SUCCESS marker + a backfill cron); the
meeting path was the outlier. INV22 guards data-layer catch-swallows; this was a *classification* gap (all
no-signal treated alike), now closed. Cost-loop protection is retained for the genuine-empty case.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Understand before solving — traced the five-outcomes-into-one collapse in the code.",
    "how_this_build_will_embody_it": "The fix classifies the outcome at the source, not a UI patch." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-read §3.4/§3.5 + A30 (and A26 at 14:29) via Read this session." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Retrospective — the defect was read off the code + the audit record.",
    "how_this_build_will_embody_it": "Traced the store's mark-on-any-no-signal, not theorised." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-74", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Holistic — trace ripple across the parse → generate → store → route → UI seam.",
    "how_this_build_will_embody_it": "Followed the outcome through all five files; the UI already had the error+Retry seam." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Layer-2 — the review must actually deliver the meeting's content, not a false empty.",
    "how_this_build_will_embody_it": "A real meeting's content is no longer lost to a one-off blip; retry recovers it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Proactive audit — checked the sales dissect for the same shape (it self-heals; meeting was the outlier).",
    "how_this_build_will_embody_it": "Class swept; cost-loop protection retained for the genuine-empty case." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-266", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Fix at the foundation — classify the outcome at the source, not a UI patch alone.",
    "how_this_build_will_embody_it": "The outcome discriminator lives in the parse/generate source; the UI reused its existing seam." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-386", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Honesty is the moat — never cache a recoverable failure as 'this meeting produced nothing'.",
    "how_this_build_will_embody_it": "Transient → honest 'didn't generate, retry'; only a genuine thin meeting shows empty." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "376-387", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Measure consequence, not agreement — the dissect still measures what the meeting produced.",
    "how_this_build_will_embody_it": "The outcome classification is orthogonal to the §3.5 measurement; the dissect never sees the cues." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from code, traced ripple across 5 files, swept the class, encoded gates." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-710", "read_at": "2026-08-22T16:01:15+08:00",
    "why_it_governs": "A reported bug is one instance of a class; sweep the boundary.",
    "how_this_build_will_embody_it": "Named the transient-cached-as-permanent-empty shape; confirmed sales self-heals, meeting was the outlier." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Tests lock: parse outcome (transient vs empty vs signal); store writes NO marker on transient (empty-text / throw / unparseable), marker on genuine empty." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T15:06:29+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md carries the full `npm run check` exit-0 output + the exact test count." }
]
```
