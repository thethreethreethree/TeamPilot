---
started_at: 2026-09-30T02:20:00Z
trigger: Residual from 2026-09-29-the-rubric-row-no-migration-created (remediate.md, "promise") — the founder's folder showed "Score them all" reporting "10 could not be saved" while production logged 164 identical foreign-key refusals, each one a paid grading thrown away.
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — a failed save says why, and stops paying

## The problem, from the record

Production logs 2026-09-26 05:40 .. 09-28 03:57, de-duplicated by request id: **164** `[storePitchScore] rpc
failed` lines, every one `pitch_scores_rubric_version_fkey` [OBSERVED, check.md of the 09-29 build]. The drain
kept going through all of them. A save fails **after** the grading, so every one of those 164 was a paid
LLM call whose result was discarded. The manager's panel said "10 could not be saved": true, but it named
neither the cause (ours), nor that the recording had in fact been graded, nor that every further press would
do the same.

## Why it happened

`storePitchScore` returns a bare `null` for two different things [OBSERVED, storePitchScore.ts]:

- the scorer honoured no element grade (a property of **this grading**; a retry asks the model again), and
- the database refused the write (on the record, 164 of 164 were **the system**: one missing config row).

`scoreSession` maps both to `store_failed`, so nothing downstream can tell them apart, and the drain treats it
as an ordinary per-recording refusal: count it, step the cursor past it, keep grading.

## Where it can go wrong

- **Halting on the first database refusal** would let one recording the database refuses for its own reason
  block the whole backlog: every press restarts at offset 0 and stops on it again. So the halt needs
  **two in a row**, reset by any other outcome.
- **Adding a refusal reason** has to reach every map keyed by it. The route's status map is
  `Record<ScoreRefusal, …>`, so the compiler forces it. The panel's label map is `Record<string, …>`, so it
  would silently fall back to the raw code.
- **CWE-209**: the database message must stay server-side. Only the category may cross.

## Adjacent (found while reading the panel)

Labels render as `{n} {label}`. Four were written as if the count came after them, so the panel printed
**"194 failed unexpectedly for"** through the out-of-credit outage [OBSERVED, UnscoredBacklog.tsx:262].

## Session-read manifest

```json
[
  {
    "id": "§0",
    "source_file": "CLAUDE.md",
    "line_range": "10-21",
    "read_at": "2026-09-30T02:29:21Z",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The cause came from the record first: the 164 logged refusals and the bare null that merged two causes. The halt rule (two, not one) came from asking how a single-recording failure would behave under it, before writing it."
  },
  {
    "id": "§0.1",
    "source_file": "CLAUDE.md",
    "line_range": "22-45",
    "read_at": "2026-09-30T02:29:21Z",
    "why_it_governs": "Methodology in the working tree at the moment of action.",
    "how_this_build_will_embody_it": "CLAUDE.md and ThinkerThinker.md are in the tree, hashed in the front matter, and opened at the times recorded here."
  },
  {
    "id": "§1.5.1",
    "source_file": "CLAUDE.md",
    "line_range": "78-138",
    "read_at": "2026-09-30T02:29:21Z",
    "why_it_governs": "Four layers in order; layer 3 is whether the user is left able to continue.",
    "how_this_build_will_embody_it": "L1: a typed result replaces a bare null. L2: a systemic failure now stops after 2 paid gradings instead of 196. L3: a single bad recording is stepped over, so the run still continues past it. L4: the panel reads as sentences, and the halt note is written for a manager, not a rep."
  },
  {
    "id": "§1.5.2",
    "source_file": "CLAUDE.md",
    "line_range": "139-173",
    "read_at": "2026-09-30T02:29:21Z",
    "why_it_governs": "Audit as you work; surface adjacent problems.",
    "how_this_build_will_embody_it": "Found and fixed the four dangling labels ('194 failed unexpectedly for'), and typed the label map so the next new refusal cannot render as a raw code."
  },
  {
    "id": "§1.5.3",
    "source_file": "CLAUDE.md",
    "line_range": "174-197",
    "read_at": "2026-09-30T02:29:21Z",
    "why_it_governs": "An unmet precondition must fail LOUD, not silently.",
    "how_this_build_will_embody_it": "The 09-26 failure was exactly this: a precondition (a config row) unmet, surfacing only as a count. The halt note now says, out loud, that the run stopped, why it stopped, and that the fault is ours."
  },
  {
    "id": "§6",
    "source_file": "CLAUDE.md",
    "line_range": "434-457",
    "read_at": "2026-09-30T02:29:21Z",
    "why_it_governs": "The checklist, item 0 first.",
    "how_this_build_will_embody_it": "No founder decision is taken here: this is the residual the 09-29 build recorded as a promise, and the halt threshold is an implementation choice stated with its reason. Item 3: this does not repeat a failed approach."
  },
  {
    "id": "A19",
    "source_file": "ThinkerThinker.md",
    "line_range": "455-479",
    "read_at": "2026-09-30T02:29:26Z",
    "why_it_governs": "Methodology must be read in session, not cited from labels.",
    "how_this_build_will_embody_it": "Every clause cited in this manifest was opened between 02:29:19Z and 02:29:26Z, before this file was written."
  },
  {
    "id": "A22",
    "source_file": "ThinkerThinker.md",
    "line_range": "594-644",
    "read_at": "2026-09-30T02:29:26Z",
    "why_it_governs": "A citation without an in-session read is a violation operating undetected.",
    "how_this_build_will_embody_it": "The read_at times are the clock at the reads (date -u printed before and after), not the commit time; the 09-29 slips were exactly that substitution."
  },
  {
    "id": "A30",
    "source_file": "ThinkerThinker.md",
    "line_range": "770-792",
    "read_at": "2026-09-30T02:29:26Z",
    "why_it_governs": "A fix is not complete until the class is a gate.",
    "how_this_build_will_embody_it": "The halt, the cause split and the label shape are each pinned by a test that five mutations turned red; the label map is typed so a new refusal cannot compile without a label."
  },
  {
    "id": "A38",
    "source_file": "ThinkerThinker.md",
    "line_range": "1001-1025",
    "read_at": "2026-09-30T02:29:26Z",
    "why_it_governs": "'Verified' is a claim about a named command.",
    "how_this_build_will_embody_it": "npm run check by name, with its exit code, in check.md; what was not run (production, a real drain) is stated."
  }
]
```
