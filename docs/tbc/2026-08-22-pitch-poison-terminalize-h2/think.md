---
started_at: 2026-08-22T14:20:00+08:00
---

# THINK — Pitch worker: a crash/timeout loop must terminalise, not "process forever" (audit H2)

The reliability audit (`docs/RELIABILITY-AUDIT-2026-08-22.md`, finding **H2**) found a real hole in the Macro
Mode pitch pipeline: a pitch can stay **non-terminal forever**. The founder had picked this fix in the audit
picker before the Next Door focus / backfill work diverted us; it is genuine unbuilt, founder-authorised scope.

## Diagnosis (from the record + the live code — §0, §1.2)

`processPitch` (worker.ts) advances the retry counter `attempts` **only inside its `catch`** (was worker.ts:170,
`pitch.attempts + 1`). A failure that does **not throw a catchable JS error** — a serverless **timeout / OOM /
hard-kill** mid-STT or mid-LLM — never runs the catch. So:

1. `attempts` never advances.
2. The 5-min lease (`claimPitchForProcessing`) expires.
3. The per-minute cron re-claims the **same** pitch (all non-terminal statuses are claimable) and repeats — **forever**.

The rep sees **"processing…"** indefinitely (PitchPerformance / PitchDetail); the pitch never reaches the honest
terminal `failed`. This is the same *dishonesty class* as the founder's trust-crisis complaint: a failure that
never surfaces as a failure. §3.4 wants this to **fail LOUD** (a visible terminal `failed` card), not hang silent.

## The fix, at the right altitude (§1.7 / A16-A26)

The audit offered two directions: (a) a separate stale-pitch sweep cron, or (b) advance `attempts` at **lease**
time so a crash still consumes an attempt. **(b) is the deeper fix and subsumes (a):**

- Move the increment into `claimPitchForProcessing` — the SAME atomic conditional lease — so **every** attempt
  (throw, success, or crash) consumes one. No new cron, no new migration, no new moving part.
- Because **all** non-terminal statuses are re-claimable, the existing cron+lease loop now naturally drives a
  poison pitch to the ceiling. A separate sweep would be a second mechanism doing what the counter should have.
- Add a **poison-pitch backstop** in `processPitch`: once the lease shows `attempts > MAX_PITCH_ATTEMPTS`, a prior
  run must have hard-crashed — terminalise honestly instead of re-processing (which would just re-crash).

Boundary chosen carefully so the **ordinary throw path is byte-unchanged**: the catch keeps failing at
`>= MAX` (5 real tries), and the pre-work poison gate only fires at `> MAX` (the 6th claim, reached ONLY when a
crash skipped the catch). The catch no longer re-increments (the lease already did) — else a throw would
double-count and terminalise a try early.

## Class sweep (A26 — a bug is one instance of a class)

Root shape: *"a re-claimable work item whose terminalisation depends on a code path a crash can skip."* Swept the
sibling workers: the **sales/meeting live sessions** already terminate stuck rows via `auto-close-stale-cron` +
`stitchSessionAudio` (the audit lists this under "already solid"), so they carry the backstop the pitch worker
lacked. The pitch worker was the outlier. H4 (meeting Dissect caches a transient failure permanently) is a
DIFFERENT root shape (backoff-marker-on-any-failure) — separate audit finding, not this class; left for its own
bundle. Boundary recorded so the next §1.7 audit can compare.

## Honesty (§3.4)
No fabricated success anywhere: the poison terminal writes a truthful message ("a timeout or crash prevented
completion"), reports to Sentry, and shows the red "processing failed" card — never a hollow "complete".

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "Understanding precedes solving — diagnosed the crash-skips-catch mechanism from the code before fixing.",
    "how_this_build_will_embody_it": "The fix targets the named root cause (counter coupled to a catchable throw), not the symptom." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-read A26/A30/A38 + the cited CLAUDE §§ via Read this turn (14:29)." },
  { "id": "§1.2", "source_file": "CLAUDE.md", "line_range": "54-59", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "Retrospective identification — the bug was diagnosed from the actual code + the audit record, looking backward at what happened.",
    "how_this_build_will_embody_it": "The crash-skips-catch mechanism was read off the code path, not theorised forward." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-74", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "Holistic + organic — trace ripple before acting; iterate.",
    "how_this_build_will_embody_it": "Traced the single caller + the route kick + the test; the ordinary throw path stays byte-unchanged." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "Layer-2 operational effectivity — the feature must actually WORK end-to-end (a pitch must reach a terminal state), not merely typecheck.",
    "how_this_build_will_embody_it": "A crashed pitch now reaches a real terminal `failed`; the rep is never left on an eternal spinner." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "Proactive THINK + search — checked adjacent workers for the same shape.",
    "how_this_build_will_embody_it": "Swept the class boundary (sessions carry the stale-close backstop; pitch worker was the gap)." },
  { "id": "§1.7", "source_file": "CLAUDE.md", "line_range": "230-266", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "This fix comes from a ground-up reliability audit finding, fixed at the foundation (the lease/counter).",
    "how_this_build_will_embody_it": "Chose the mechanism fix that subsumes the backstop, not a bolt-on sweep cron." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-386", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "Honesty is the moat — a silent forever-processing state is a hidden failure; make it fail loud.",
    "how_this_build_will_embody_it": "A poison pitch becomes a truthful terminal `failed` card + Sentry, never a hollow complete or an eternal spinner." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from the record, traced ripple (single caller + route + test), swept the class, encoded a gate." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "Methodology that governs the build must live in the working tree and be read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms + CLAUDE §§ via Read this turn; not cached labels." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "Citations without an in-session read are silent violations.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at (14:29)." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-710", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "A reported bug is one instance of a class; sweep the boundary.",
    "how_this_build_will_embody_it": "Named the root shape + swept the sibling workers; recorded the boundary in closure." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "A lesson in prose returns; encode it in a gate.",
    "how_this_build_will_embody_it": "+2 tests lock BOTH new branches: the poison pre-work terminal, and no-double-increment on a throw at the ceiling." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T14:29:27+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md carries the full `npm run check` exit-0 output + the exact test count." }
]
```
