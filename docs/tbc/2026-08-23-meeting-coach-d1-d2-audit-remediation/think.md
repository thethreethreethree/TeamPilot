---
started_at: 2026-08-23T09:20:00+08:00
---

# THINK — Meeting Coach audit remediation: D1 (huddle agenda-aware) + D2 (doc-upload hardening)

The two deferred items the founder chose ("D1 and D2") from `docs/MEETING-COACH-AUDIT-2026-08-23.md`. Both were
flagged in the prior backend-fixes TBC residual; each was re-verified against the code (A26: a finding is a
suspect) before building.

## D1 — the huddle brain ignores the agenda the route already loads (§1.5.1 layer-2 + layer-3 consistency)

**Why it exists, from the record.** The cue route (`meeting-session/[id]/cue/route.ts:100-105,150-156`) loads the
Prep-up agenda and persists `coveredTopicIds` for ANY prep-linked session — meeting OR huddle. The MeetingStrategy
consumes `context.agenda`; the HuddleStrategy did NOT forward it, and the huddle prompt had no agenda block, no
`uncovered_topic` trigger, and no `covered` output. Meanwhile the Dissect judges agenda coverage for huddles too.
So a prepped huddle had a review that measured coverage the live coach never tracked or worked toward — the
review grades against an agenda the brain was blind to. That is a layer-3 composition break (the route + dissect
speak "agenda"; the brain doesn't) surfacing as a layer-2 effectivity gap (a prepped huddle's agenda does nothing
live).

**Root shape, not symptom.** The route FEEDS an input (agenda) that one consumer (huddle brain) silently drops.
The class boundary is the set of strategies the route passes agenda to: sales (N/A — no prep), meeting (consumes),
huddle (dropped). Fixing huddle closes the class.

**Founder decision (2026-08-23).** "Make the huddle agenda-aware" — i.e. a prepped huddle runs toward its agenda
too, but tuned to the huddle's near-silent character: the agenda adds exactly ONE new reason to speak (a must-cover
point about to be missed as the huddle ends) and otherwise the high silence bar is unchanged. It does NOT turn the
huddle coach into a meeting coach walking the agenda item by item.

## D2 — the doc route re-implemented a weaker allowlist instead of the chokepoint (A27 + A26)

**Why it exists, from the record.** `meeting-prep/[id]/document/route.ts` had its own `classifyKind()` allowlist
(MIME-prefix + extension) that is DEFEATABLE by a spoofed type — `classifyKind` returns "image" for
`image/svg+xml` (a stored-XSS vector) because it only checks `mt.startsWith("image/")`. It had no app-layer size
cap and buffered the whole download unbounded, and the OCR path (`extractImageText`) fed bytes to Tesseract with
no decompressed-size guard — a few-hundred-KB PNG can decode to a multi-GB RGBA bitmap that OOMs the function
BEFORE the `MAX_OCR_MS` timeout can fire (a synchronous decode the timeout can't interrupt).

**A27 shape.** The route PROMISED a safe upload allowlist that the write path enforced more weakly than the rest
of the app — the fix is to enforce the invariant at the layer below the label (the shared `validateUploadCandidate`
chokepoint + `getAssetObjectInfo` real-size re-check), not to keep a parallel weaker copy.

**A26 sweep (done this session, boundary stated honestly).** Class = "an upload sign/confirm route that takes an
untrusted client filename/MIME and validates it more weakly than the shared chokepoint." Swept all
`createSignedUploadTarget` callers:
- **In-class + fixed:** `meeting-prep/[id]/document` (the only real instance).
- **Covered:** `care/.../upload/sign` (validates via `mintCareUploadTarget` → `validateUploadCandidate`);
  `files/upload-url` (chokepoint); `upload-recording/sign` (media-appropriate `EXECUTABLE_EXTENSIONS` + audio/video
  MIME subset — the chokepoint rejects legit `.webm`, documented in assets.ts).
- **Excluded by reachability:** `door-log` sign — its `originalFilename` is the server constant `"pitch.webm"`, so
  there is no untrusted filename/MIME to validate; the object is transcribed (STT), never executed.

**Blast radius, honest.** LOW today — prep docs are owner-scoped and NEVER served (a stored SVG/exe is retrievable
only by the uploader). This is defense-in-depth that becomes load-bearing the moment a "share prep with the team"
feature ships. Fixed now because it is the cheap-to-close A27 class and the founder chose D2.

## What this build does NOT do (bounded residual, §5 honesty)
The coverage whole-JSONB lost-update race (D3) and the multi-company-latent LOWs (D4) remain flagged — single-
company-safe today (memory: multi-company DEFERRED). The live bucket `file_size_limit` (AMD-011 external config)
is now belt-and-suspenders behind the app-layer cap (`validateUploadCandidate` AGENT_MAX_BYTES=25MB +
`getAssetObjectInfo` real-size check), so an unverified bucket setting can no longer silently admit an over-cap
file — the app layer fails it loud with a 413.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T09:24:10+08:00",
    "why_it_governs": "Understanding precedes solving — both items were diagnosed from the route/brain/record before any edit.",
    "how_this_build_will_embody_it": "D1 targets the traced root (route feeds agenda, huddle brain drops it), not the symptom; D2 enforces the invariant below the label." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T09:23:45+08:00",
    "why_it_governs": "Methodology must be in the working tree and read THIS session, not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-opened every cited CLAUDE §§ + ThinkerThinker axiom via Read this session before building; timestamps below." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T09:24:00+08:00",
    "why_it_governs": "Four-layer sieve — D1 is a layer-2 effectivity gap (prepped huddle does nothing live) on a layer-3 break (route/dissect speak agenda, brain doesn't); D2 is layer-1/2 (weaker security primitive).",
    "how_this_build_will_embody_it": "D1 makes the brain actually consume the agenda end-to-end; D2 routes through the shared chokepoint so the security layer is uniform." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-08-23T09:23:30+08:00",
    "why_it_governs": "Proactive audit — THINK then search the class, don't patch the one instance.",
    "how_this_build_will_embody_it": "Swept the chokepoint-bypass class across ALL upload sign routes; stated the reachability exclusions + false positives, not just the fix." },
  { "id": "§1.5.3", "source_file": "CLAUDE.md", "line_range": "174-196", "read_at": "2026-08-23T09:23:35+08:00",
    "why_it_governs": "External-config completeness — the upload size cap partly depended on the live bucket file_size_limit (config the repo can't hold).",
    "how_this_build_will_embody_it": "The app-layer cap (validateUploadCandidate + getAssetObjectInfo real-size) now fails an over-cap file LOUD (413) regardless of the bucket setting; the bucket limit is documented as belt-and-suspenders." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-332", "read_at": "2026-08-23T09:26:30+08:00",
    "why_it_governs": "Single-source verdict — a gate decision is consumed, not re-derived by a consumer.",
    "how_this_build_will_embody_it": "D1's HuddleStrategy still consumes the injected LLM's `suppressed` verdict without re-deriving it; the agenda is forwarded, adding no new decision to duplicate." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T09:24:20+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: verified each finding against code, swept the class boundary, traced ripple, added detection tests for both guards." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T09:25:00+08:00",
    "why_it_governs": "Methodology in the working tree — cited labels without content is the CAT-001 failure.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this session; no citation from cached memory." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T09:25:10+08:00",
    "why_it_governs": "Constitutional citations without a session-read are undetected A19 violations.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at (all ≥ started_at 09:20); the Session-Reads commit trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-720", "read_at": "2026-08-23T09:24:40+08:00",
    "why_it_governs": "A reported bug is one instance of a class; the fix is incomplete until the class is swept to its reachable boundary.",
    "how_this_build_will_embody_it": "Swept the upload-chokepoint-bypass class: 1 in-class fix (D2), 3 covered, 1 reachability-excluded (door-log) — boundary stated, not just the instance." },
  { "id": "A27", "source_file": "ThinkerThinker.md", "line_range": "722-769", "read_at": "2026-08-23T09:24:45+08:00",
    "why_it_governs": "A surface promising an invariant its write path enforces more weakly is a false guarantee — enforce below the label.",
    "how_this_build_will_embody_it": "D2 enforces the upload allowlist at the shared chokepoint (below the label), replacing the route's weaker parallel copy." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T09:25:20+08:00",
    "why_it_governs": "A lesson in prose returns — encode the class in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "+7 detection tests: SVG blocked at the chokepoint though classifyKind passes it, phantom-path 400, real-size-over-cap 413, image-bomb refused pre-decode, and the huddle agenda block present/omitted + uncovered_topic delivery." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-431", "read_at": "2026-08-23T09:27:10+08:00",
    "why_it_governs": "Knowledge ≠ intelligence + the confident-well-formed-failure — a class swept to one instance while reported 'done' is exactly that failure.",
    "how_this_build_will_embody_it": "Stated the A26 boundary honestly (fixes + reachability exclusions + false positives), and the bounded residual, rather than reporting the single fix as the whole class." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T09:27:20+08:00",
    "why_it_governs": "'Verified' names the exact command you ran — the scoped subset reads identically to the full gate.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output with EXIT: 0 + the exact test count — not a hand-picked subset reported in the gate's words." }
]
```
