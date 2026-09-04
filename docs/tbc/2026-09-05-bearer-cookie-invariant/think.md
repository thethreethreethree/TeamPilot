---
started_at: 2026-09-05T03:20:31+08:00
---

# THINK - gate the class that has cost four outages in two days

## Why (the record)
Four defects in two days, one mechanism:

  lib/brain              every AI feature in the mobile app answered 502
  lib/data/doorlog       the door tracker answered 200 with a confident zero for a
                         day holding 8 knocks and 6 sales
  sales-session/roleplay a bare 500 with an empty body
  lib/coach/v5/memory    the C.A.R.E extension coach ran with no user memory at all

`createClient()` resolves a session from COOKIES. A caller authenticating with a
BEARER token - the mobile app, the browser extensions - sends none, so the client is
ANONYMOUS: RLS returns nothing, writes are refused, reads come back empty.

Every one was found by hand, and three of the four only after a person noticed.

## Understanding (SS0 - why the class kept surviving)
Not because nobody looked. Because every look was ONE HOP DEEP.

- The roleplay outage was recorded as a separate defect with an Anthropic
  configuration named as the leading candidate. It was the same bug: the path ran
  route -> src/lib/claude.ts -> brain. The trace read the route file and stopped.
- The residual after that build said the remaining cookie-client modules were
  unreachable from the app. Same method, same confident wrong answer - and it hid
  the C.A.R.E memory defect for a further day.
- INVARIANT 16 in this very audit records the identical blind spot in its own note:
  "a route that hides the call behind a helper isn't matched."

So the fix is not another sweep. A26 is explicit that a reported bug is one instance
of a class and the fix is incomplete until the class is swept to its boundary; A30
is blunter - "a lesson recorded only in PROSE will return", and is not complete
"until the class is encoded in a GATE that fails without the author's cooperation".
Three builds have now closed instances of this class in prose. The fourth encodes it.

## What the gate must do that a person cannot
Walk the import graph. A route is at risk when it accepts a Bearer token AND
TRANSITIVELY reaches a library that resolves its own cookie client. One hop is what
failed twice; the guard therefore does what the eye kept not doing.

## The error this build already caught in itself
The first hand-run of this analysis counted `careAgentAuth` as a Bearer mechanism.
`requireCareAgent()` is cookie-only with no Bearer path at all, so that made the
sweep circular and marked 37 web routes at-risk. Caught before anything was reported
or changed, and now encoded as a self-test so it cannot be made again.

## SS1.5.1 layers
- Layer 1: the codebase had no structural memory of a class it had paid for 4 times.
- Layer 2: the guard must FIRE, not merely exist - proven by mutation below.
- Layer 3: it runs inside the canonical gate, so nobody has to remember to run it.

## Session-Reads (A22 / SS3.1.2)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "12-20", "read_at": "2026-09-05T03:21:55+08:00",
    "why_it_governs": "Understanding must be earned; a misdiagnosis fed more force is an error loop.",
    "how_this_build_will_embody_it": "The question asked was not 'how do I fix these files' but 'why did four sweeps miss this' - and the answer, one-hop analysis, is what the guard corrects." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "26-42", "read_at": "2026-09-05T03:22:01+08:00",
    "why_it_governs": "The methodology must be in the tree and read this session, not cited from cache.",
    "how_this_build_will_embody_it": "Every clause here was opened for THIS build; an earlier draft of this manifest asserted eleven clauses were 're-read now' when they had not been, and that draft was discarded rather than shipped." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-72", "read_at": "2026-09-05T03:21:55+08:00",
    "why_it_governs": "Never fix one thing in a way that silently breaks another; trace ripple before acting.",
    "how_this_build_will_embody_it": "The guard ships with an allowlist carrying a REASON per entry, so a legitimate cookie use is documented rather than silently excluded, and the audit still reports 0 violations on the current tree." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "80-88", "read_at": "2026-09-05T03:22:01+08:00",
    "why_it_governs": "Layer 1 - will the system this lives in remain maintainable.",
    "how_this_build_will_embody_it": "Added to the EXISTING invariant audit in its own idiom (rule + allowlist + self-test), not as a new script - the codebase gets one more invariant, not another tool." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "145-152", "read_at": "2026-09-05T03:21:55+08:00",
    "why_it_governs": "THINK first about how the surface and its neighbours could fail, then search.",
    "how_this_build_will_embody_it": "The hypothesis - 'the sweeps kept failing because they were one hop deep' - was formed first and then confirmed against three separate records, including INVARIANT 16's own note." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "266-272", "read_at": "2026-09-05T03:21:55+08:00",
    "why_it_governs": "A repeated failure means the IDENTIFICATION was wrong, not the implementation.",
    "how_this_build_will_embody_it": "Four instances of one class is a repeated failure. The response is not a fifth manual sweep but a change to how the question is asked." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "436-440", "read_at": "2026-09-05T03:22:01+08:00",
    "why_it_governs": "Item 0: a decision for the founder goes through a picker with a recommendation.",
    "how_this_build_will_embody_it": "Building audit machinery is otherwise forbidden without an explicit ask, so it was put to the founder as a picker and they chose it. This build exists BECAUSE of that answer, not around it." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-466", "read_at": "2026-09-05T03:22:01+08:00",
    "why_it_governs": "Governing methodology lives in the working tree.",
    "how_this_build_will_embody_it": "Both documents are in this tree and the line ranges above are the ones actually opened." },
  { "id": "A21", "source_file": "ThinkerThinker.md", "line_range": "530-536", "read_at": "2026-09-05T03:22:01+08:00",
    "why_it_governs": "Audits that look WITHIN modules but not ACROSS them miss composition failures.",
    "how_this_build_will_embody_it": "This is the asset the whole build is about: the guard walks ACROSS modules, because every within-module look missed the class." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-604", "read_at": "2026-09-05T03:22:01+08:00",
    "why_it_governs": "Citations without session-reading are violations operating undetected.",
    "how_this_build_will_embody_it": "Caught myself committing exactly this while writing this manifest - eleven clauses asserted as read that were not - and read them before citing." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-697", "read_at": "2026-09-05T03:21:47+08:00",
    "why_it_governs": "A reported bug is one instance of a class; the fix is incomplete until the class is swept to its boundary.",
    "how_this_build_will_embody_it": "The boundary is now computed rather than eyeballed: 331 routes walked transitively, every survivor allowlisted with a reason." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-05T03:21:47+08:00",
    "why_it_governs": "A lesson recorded only in PROSE will return; a fix is complete when the class is encoded in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "Three builds closed instances of this class in prose and it returned each time. This one is the gate, and it fails without my cooperation because it runs inside npm run check." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1008", "read_at": "2026-09-05T03:22:01+08:00",
    "why_it_governs": "'Verified' names the canonical command, and a guard that stops detecting is worse than none.",
    "how_this_build_will_embody_it": "npm run check is run whole, and the guard is mutation-proven: removing one allowlist entry makes it name the exact route that carried the bug." }
]
```
