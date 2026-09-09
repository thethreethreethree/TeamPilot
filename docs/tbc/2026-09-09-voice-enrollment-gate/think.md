---
started_at: 2026-09-09T15:02:45+08:00
doc_integrity:
  CLAUDE.md: 9dc4807cb778
  ThinkerThinker.md: e5226c44665f
---

# THINK — the voice-recognition gate: enrollment as an acoustic reference

## Why (the record)
The 9/2 partner meeting decided a mandatory voice-recognition gate. It was first reserved for the founder's
own team; on 2026-09-09 the founder annotated the build-status report on item #4 — "I am the founder, we need
to build this now" — reversing that and directing the app team to build it now.

## Understanding (earned)
The live coach already separates speakers on a single mic with FOUR composed signals (manual toggle > content
tell > in-session pitch cluster > loudness) plus an LLM refine (speakerAttribution.ts, pitchSeparation.ts).
What it LACKS is a persistent, cross-session voice identity: the pitch clusterer bootstraps by ASSUMING the
first speaker is the rep, which is fragile. Enrollment supplies the missing anchor.

Two founder decisions shaped the build (both via picker):
1. **Approach = acoustic reference**, not ML voiceprint biometrics. The rep reads a short prompt; the client
   runs the SAME detectF0 (McLeod method) the live coach uses, derives the MEDIAN fundamental frequency, and
   stores that one NUMBER. No new vendor, no GPU model, and — by construction — no biometric audio stored, so
   enrollment stays off the biometric-data surface. The number seeds the pitch clusterer's agent centroid so
   the rep's turns are grounded to their KNOWN pitch from turn 1.
2. **Rollout = prompt now, hard-enforce after verified.** The mic-capture flow hasn't run against a real
   microphone yet and the migration must land first, so a hard block risks locking every rep out (the
   migration-ordering race AND a rep whose enrollment fails). This slice ships enrollment + attribution + a
   NON-BLOCKING prompt; the hard session-start gate is a one-line follow-up once the flow is verified in prod.

## What this slice builds
- **0246** — `profiles.voice_f0_hz` + `voice_enrolled_at` (self-settable feature columns like macro_mode, not
  authz — 0090 unaffected). Guarded fallback (isMissingColumnError) so the route degrades honestly pre-migration.
- **voiceEnrollment.ts** (pure) — `deriveEnrollmentF0` (median of in-range voiced frames, null when too thin),
  `isValidEnrollmentF0`, `isVoiceEnrolled`. Reuses MIN_F0/MAX_F0 from pitchSeparation (single source, §2.2).
- **/api/coach/voice-enrollment** — GET status / POST store (caller-scoped, RLS own-row; re-validates the number).
- **VoiceEnrollment.tsx** — Web Audio capture reusing detectF0; sends only the derived number. On the settings
  Account tab.
- **PitchSeparator.seedAgentCentroid** + useLiveCoaching wiring — fetch the enrolled F0 once, seed the agent
  cluster at each session start (best-effort; no enrollment → existing bootstrap, so nothing regresses).
- **StartSessionPanel** — a non-blocking "enroll your voice" prompt when not enrolled (links to Settings).

## Ripple (§1.5)
- Attribution seeding is ADDITIVE: `seedAgentCentroid` only sets the agent centroid + anchored; with no
  enrollment the clusterer behaves exactly as before. No existing attribution path changes behavior.
- The gate is NOT enforced this slice — session start is unchanged, so no rep can be locked out. Enforcement
  is a deliberate follow-up gated on prod verification (§1.5.3 external-precondition discipline).
- No biometric storage; a stored F0 number is not re-identifying audio.
- Jeff's product knowledge (elostateProductKnowledge.ts) updated same-commit (standing rule).

## Session-Reads (A22)
```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-20", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "Understanding precedes solving.",
    "how_this_build_will_embody_it": "The existing attribution pipeline (4 signals + LLM) and detectF0/PitchSeparator were read before choosing enrollment-as-acoustic-seed — the reuse is grounded in the code, not assumed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-44", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Both governing docs are in-tree; hashes pinned above." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "288-296", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "Trace ripple before committing.",
    "how_this_build_will_embody_it": "Seeding is additive; the gate is deliberately not enforced; both traced above." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-137", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "Layer-2 effectivity + not shipping a broken workflow.",
    "how_this_build_will_embody_it": "A hard gate with no verified way past it is a broken workflow, so enforcement waits; enrollment→attribution is the verifiable value shipped now." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "THINK first about what could fail, then search to confirm.",
    "how_this_build_will_embody_it": "Searching before building revealed the existing attribution pipeline + detectF0/PitchSeparator to reuse, and surfaced the biometric-storage and lockout risks handled here." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-196", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "A feature depending on out-of-repo config (a migration) isn't complete until that precondition is verified.",
    "how_this_build_will_embody_it": "The migration is a blocking precondition for enforcement; the guarded fallback fails honest pre-migration, and enforcement is deferred until the migration is confirmed live." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-325", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "Single source for a decision/value.",
    "how_this_build_will_embody_it": "The human-voice F0 band lives once in pitchSeparation and is imported by enrollment — no second copy to drift." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-380", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "No fabrication; honest empty over garbage.",
    "how_this_build_will_embody_it": "Too little voiced signal → deriveEnrollmentF0 returns null and the UI asks for another take, never storing a noise-derived reference." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-448", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "Founder decisions via picker.",
    "how_this_build_will_embody_it": "Approach (acoustic vs ML) and rollout (prompt vs hard-block) each went to the founder as a picker." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-476", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "Methodology in the working tree.",
    "how_this_build_will_embody_it": "Docs in-tree; cited ranges opened this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-604", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "Cited clauses must be read in-session.",
    "how_this_build_will_embody_it": "Each entry has an in-session read_at." },
  { "id": "A34", "source_file": "ThinkerThinker.md", "line_range": "872-890", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "Migration-coupled code keeps a guarded fallback, never asserts the migration applied.",
    "how_this_build_will_embody_it": "The route uses isMissingColumnError to degrade honestly until 0246 lands, and enforcement is deferred past that." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-780", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "A prose lesson returns; encode it in a gate.",
    "how_this_build_will_embody_it": "The derive/validate core, the seed, and the API contract are pinned by tests (33) that fail if the behavior regresses — not left as prose." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1008", "read_at": "2026-09-09T15:03:00+08:00",
    "why_it_governs": "'Verified' names the command actually run.",
    "how_this_build_will_embody_it": "check.md pastes the whole npm run check output + exit code, plus the LAW-1 render of the three states." }
]
```
