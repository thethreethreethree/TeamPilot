---
started_at: 2026-08-25T05:33:00+08:00
---

# THINK — bad-concat recovery: salvage the first segment when STT rejects a two-init file

## Why this build exists (the honest correction)

The mp4-reseam fix (`63bf09d8`, shipped + live) PREVENTS new bad concats. When I reported it I told the founder
"the already-failed pitches can't recover — the stitch is idempotent, its bad file is cached, and the good chunks
were purged." Under the continuation guard I re-scrutinised that claim and it was **wrong** — an A20 quality-bar
substitution (I unilaterally declared a recovery impossible), not a founder deferral. A recovery IS possible and
SAFE, and the founder's reported problem includes the *existing* broken pitches, so recovering them is genuine
unbuilt scope (§1.5.1 layer 2), not gold-plating a verified fix (A24).

## The insight that makes it safe

A bad concat is `[valid recording 1][init of recording 2 …]`. Truncating at the second init header keeps a
COMPLETE first recording — playable + transcribable. The risk in truncating on `findSecondInitSegment` is that
it's a HEURISTIC (a byte run could coincide in audio payload), so truncating a GOOD file could corrupt it.

That risk is eliminated by WHERE the truncation runs: **only after STT has already REJECTED the full buffer.**
- A good recording passes STT → never reaches the recovery path → is never truncated. (Zero risk to good audio.)
- A rejected buffer with no second init → `truncateAtSecondInitSegment` returns null → no retry, no behavior change.
- A rejected buffer WITH a second init → truncate to segment 1 → retry STT once → recovered (or, if segment 1 is
  also bad / the offset was a false positive, STT rejects again → falls through to the original throw). Worst case
  is ONE wasted STT call on audio that was already failing. No path harms a good recording.

So the recovery is a strict improvement: it can only turn a would-be failure into a success or leave it a failure.

## What it recovers (honest scope)

- **The non-terminal transitional cohort** — iOS pitches stitched (bad) before the reseam deploy, still mid-retry:
  on their next attempt the recovery salvages segment 1. Present value the reseam CANNOT give (their chunks are
  purged, so a re-stitch can't help — but the cached bad file can be split here).
- **Defense-in-depth** for any container the reseam doesn't yet recognise (the aac/mpeg deep fallbacks; a future
  format) — a bad concat that slips the reseam still gets salvaged at STT time.
- **NOT** the terminal-`failed` pitches (the founder's screenshotted one included) — they don't reprocess. Those
  need an explicit re-queue, which has reprocessing COST → a founder decision (surfaced separately, not auto-run;
  the mass-backfill cost gate is the founder's per prior record).

## A26 class boundary (swept)

Class = "a stitched-audio buffer that STT rejects, with a recoverable first segment, given no recovery attempt."
The only LIVE stitched-audio → `transcribeSpeech` consumer is the pitch worker (grep of `transcribeSpeech`:
`worker.ts` = pitch; `care/stt/route.ts` = a single customer voice blob, NOT stitched → no bad-concat shape;
`elevenlabs.ts` = the impl). The live/meeting `stitchSessionAudio` output has no live STT consumer (meeting-coach
not live-wired). So the boundary is the pitch worker alone — recovery placed there; helper shared/pure for reuse
if a second consumer ever appears.

## Ripple (holistic — §6 item 5)

- One pure helper (`truncateAtSecondInitSegment`) + a retry branch inside the EXISTING STT catch; no schema/route/
  API/migration/external-config change. The retry-machinery, terminal logic, and idempotent stitch are untouched.
- Only the FAILURE path gains work (a good recording never enters the catch). No added cost on success.

## A30 gate

Tests: `truncateAtSecondInitSegment` returns the first segment for a webm+webm and mp4+mp4 concat and null for a
clean file (never truncates a good file); the worker retries STT with the shorter salvaged buffer and does NOT
mark the pitch failed; and does NOT retry (no wasted call) when the rejected audio has no second init.

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 05:33:00)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-25T05:35:00+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "Earned WHY the recovery is safe (failure-path-only eliminates the heuristic's false-positive risk) before writing it." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-25T05:35:05+08:00",
    "why_it_governs": "Methodology in the working tree, read this build.",
    "how_this_build_will_embody_it": "Verified ThinkerThinker.md in-tree and re-read every cited axiom fresh today (read_ats below)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-102", "read_at": "2026-08-25T05:35:10+08:00",
    "why_it_governs": "Layer 2 (operational effectivity) — the founder's reported problem includes existing broken pitches; a fix that leaves them broken hasn't delivered the intended result.",
    "how_this_build_will_embody_it": "The recovery salvages the recoverable cohort end-to-end (STT succeeds on segment 1)." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-148", "read_at": "2026-08-25T05:35:15+08:00",
    "why_it_governs": "THINK+search — audit the surface the task touches and its neighbors.",
    "how_this_build_will_embody_it": "Searched the STT-consumer class before building; confirmed the pitch worker is the only live one." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-430", "read_at": "2026-08-25T05:35:20+08:00",
    "why_it_governs": "Builder under pressure — the guard's inverted pressure toward manufacturing.",
    "how_this_build_will_embody_it": "Checked this is genuine unbuilt scope, not make-work: it corrects a wrong 'can't recover' claim I made, and is safe-by-construction." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-437", "read_at": "2026-08-25T05:35:25+08:00",
    "why_it_governs": "Quick-decision checklist (understand-why, sweep the class, trace ripple).",
    "how_this_build_will_embody_it": "Understood WHY the recovery is safe before building; swept the STT-consumer class; traced ripple (failure-path only)." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-458", "read_at": "2026-08-25T05:37:00+08:00",
    "why_it_governs": "Methodology in the working tree — no cached labels.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build rather than citing from memory." },
  { "id": "A20", "source_file": "ThinkerThinker.md", "line_range": "480-527", "read_at": "2026-08-25T05:36:10+08:00",
    "why_it_governs": "'Founder decision needed' / 'can't be done' as the agent's quality bar substituting for the founder's.",
    "how_this_build_will_embody_it": "My 'no clean recovery' was a unilateral quality-bar call; on re-scrutiny it was wrong, so I built the defensible default instead of parking it." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-640", "read_at": "2026-08-25T05:36:40+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "Re-read each cited axiom fresh THIS build; this manifest + the Session-Reads trailer pair every § with a read_at ≥ started_at." },
  { "id": "A24", "source_file": "ThinkerThinker.md", "line_range": "663-676", "read_at": "2026-08-25T05:36:20+08:00",
    "why_it_governs": "Don't manufacture output under a continuation mandate.",
    "how_this_build_will_embody_it": "Applied the floor test: this is a GENUINE find (safe, present value, corrects a wrong claim), not a marginal make-work commit — so build, not hold." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-702", "read_at": "2026-08-25T05:36:30+08:00",
    "why_it_governs": "Sweep the class to its boundary.",
    "how_this_build_will_embody_it": "Grepped `transcribeSpeech`; confirmed the pitch worker is the sole LIVE stitched-audio STT consumer; helper kept pure/shared for any future one." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-775", "read_at": "2026-08-25T05:36:50+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "Tests pin the truncation helper (both containers + clean-file null) AND the worker's retry/no-retry branches." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1006", "read_at": "2026-08-25T05:36:55+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
