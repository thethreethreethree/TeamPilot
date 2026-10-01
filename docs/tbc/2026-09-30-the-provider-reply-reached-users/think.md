---
started_at: 2026-09-30T07:00:00Z
trigger: Found while costing DeepSeek for the founder - 9 September pitches store 'DeepSeek API error 402' in pitches.error and the report card shows it to the rep; the sweep found 26 AI routes sending LlmError.message (the provider's raw reply) to users. Founder, picker 2026-09-30 - "Our own sentence, detail in logs".
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK - the AI provider's raw reply reached users

## The problem, from the record

- `worker.ts:311-313` writes `Processing failed after N attempts: ${message}` into `pitches.error`, where
  `message` is the raw exception. Production: 9 September rows begin `Processing failed after 5 attempts:
  DeepSeek API error 402: {"error":{` [OBSERVED, read-only query].
- `report-card/[pitchId]/route.ts` returned the column; `PitchDetail.tsx:104` renders it. A rep read it.
- `LlmError.message` is `DeepSeek API error ${status}: ${rawBody.slice(0, 200)}` (deepseek.ts:192, 281) or
  "DEEPSEEK_API_KEY not set.". 26 sites sent `{ error: err.message, kind[, provider] }` to users.
- INVARIANT 14 (CWE-209) skipped any window containing `kind:`, calling it "the intentional LlmError curated
  surface". The message was never curated; the gate was green on a false premise.

## Why the two halves differ

The 26 routes were a recorded design (07-25), and the helper's comment said a stricter policy was the
founder's decision. So it went to a picker first. The report card's text was a job's log line that happened
to reach a screen, with no design behind it, so it was fixed directly.

## Session-read manifest

Each clause was read in full at 02:29Z this session and reopened at 07:16:36Z, after this build started.

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-09-30T07:16:36Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The class was established from the record before any edit: production rows in pitches.error hold 'DeepSeek API error 402: {\"error\":...'; the report card returns the column; LlmError.message is built from the raw body in deepseek.ts:192/281; 26 sites sent it."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-09-30T07:16:36Z",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md are in the tree; full text read at 02:29Z this session, reopened at the time recorded after this build started."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "read_at": "2026-09-30T07:16:36Z",
    "why_it_governs": "Four layers in order; layer 2 is whether the failure message actually helps the person reading it.",
    "how_this_build_will_embody_it": "L1: one translator per surface (pitchFailureMessage, llmPublicMessage) instead of 27 inline choices. L2: a failed AI call shows a sentence a user can act on; `kind` still reaches clients so back-off and the Settings hints keep working. L3: no client depended on the raw text (grep of both codebases). L4: every sentence says whose fault it is."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-09-30T07:16:36Z",
    "why_it_governs": "Audit as you work; surface adjacent problems.",
    "how_this_build_will_embody_it": "Found while costing DeepSeek: the pitch error column. Its sweep found the 26 AI routes, and that the CWE-209 gate exempted them on a false premise."
  },
  {
    "id": "§2.2",
    "source_file": "CLAUDE.md",
    "line_range": "307-334",
    "read_at": "2026-09-30T07:16:36Z",
    "why_it_governs": "One source for a decision.",
    "how_this_build_will_embody_it": "What a user may read about an AI failure is now decided in one function per surface; the routes consume it and no longer each choose their own text."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-457",
    "read_at": "2026-09-30T07:16:36Z",
    "why_it_governs": "Checklist item 0: decisions through a picker.",
    "how_this_build_will_embody_it": "The 26 routes were a recorded 07-25 design that its own comment called a founder decision; it was put to the founder in a picker (answer: 'Our own sentence, detail in logs') before any of them changed. The report-card fix did not need one: that text was a job's log line, not a designed surface."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-09-30T07:16:36Z",
    "why_it_governs": "Methodology read in session.",
    "how_this_build_will_embody_it": "Full text at 02:29Z, reopened at the recorded time."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-644",
    "read_at": "2026-09-30T07:16:36Z",
    "why_it_governs": "Citation needs an in-session read.",
    "how_this_build_will_embody_it": "read_at is the reopen time, printed by date -u around the reads; the full reads are stated separately above."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-09-30T07:16:36Z",
    "why_it_governs": "A fix is complete when the class is a gate.",
    "how_this_build_will_embody_it": "INVARIANT 14 lost its `kind:` exemption and now scans every file that builds a NextResponse; mutations in a route and in the lib helper were both caught. The report card has a source guard (mutation caught)."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-09-30T07:16:36Z",
    "why_it_governs": "'Verified' names a command.",
    "how_this_build_will_embody_it": "npm run check by name, with its exit code, in check.md."
  }
]
```
