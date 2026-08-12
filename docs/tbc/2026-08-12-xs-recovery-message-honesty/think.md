---
tbc_version: 1
trigger: fix
started_at: 2026-08-12T12:05:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — the zero-segment recovery message must not blame the recording

## 1. Document integrity (§0.1) — MATCH
CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) present in-tree, hashes verified.

## 2. Why (found in the capture→recover seam audit, §1.5.2)
`SessionRecordingUpload.applyTranscribeResponse` shows, on a 200-with-zero-segments transcription result,
**"No speech was transcribed from that recording."** That is the EXACT reported STT symptom (the service connects
but returns no turns for good audio) — but the copy attributes it to the RECORDING being silent. On a call the rep
knows had talking, that misattribution can make them abandon a perfectly good (and saved) recording, and it
undercuts the founder-authorized capture requirement **#3: indicate WHY it failed**. Right next to it, the
After-Pitch empty state already uses the founder-APPROVED honest framing ("Live transcription didn't connect… your
audio was saved"). The upload component's message is the inconsistent outlier — this aligns it.

## 3. The change (minimal, copy-only)
Reword the zero-segment `throw` message to one honest sentence correct for BOTH cases:
> "The transcription came back empty. If this call had talking, that's usually a brief service issue — your audio
> is saved, so try again in a moment."
- A genuinely-silent upload → "came back empty" is accurate.
- A service miss on good audio → "if this call had talking… brief service issue… audio saved… try again" gives
  the rep the right mental model and points at recovery, never "your recording was empty".
No behaviour/backend change; the shared handler serves both the fresh-upload and the recover-from-saved paths, and
the audio is stamped to storage before transcription in both, so "your audio is saved" holds for both.

## 4. Why copy-only, not distinguishing the two call sites
Splitting the message per call site (upload vs recover) is more code for no gain — a single dual-true sentence is
honest in both and simpler (avoid over-engineering). The root CURE is the STT-scope env fix (founder-gated); this
is honest signage until then, not a substitute for it.

## 5. Hypothesis (§1.5.2)
- **H1 — does the reworded message stay true for a genuinely-silent upload?** Yes: "came back empty" is literally
  what happened; the "if this call had talking" clause is conditional, so it doesn't assert speech existed. It
  neither blames the recording nor fabricates a service fault. CONFIRMED by reading both call paths
  (uploadBlob + retranscribe both route through applyTranscribeResponse; audio_asset_url is stamped before
  transcription in the finalize route, so "saved" is true in both).

## Session-read manifest (A22 / A35)
```json
[
  { "id": "§0", "read_at": "2026-08-12T12:05:20Z", "source_file": "CLAUDE.md", "line_range": "10-21", "why_it_governs": "Understand the surface before changing it.", "how_this_build_will_embody_it": "Read both call paths through applyTranscribeResponse (section 5)." },
  { "id": "§0.1", "read_at": "2026-08-12T12:05:20Z", "source_file": "CLAUDE.md", "line_range": "22-45", "why_it_governs": "Methodology-in-tree precondition.", "how_this_build_will_embody_it": "Doc hashes verified in-tree." },
  { "id": "§1.5.1", "read_at": "2026-08-12T12:05:40Z", "source_file": "CLAUDE.md", "line_range": "78-138", "why_it_governs": "Layer-4 surface must match the substance + its siblings.", "how_this_build_will_embody_it": "Aligns the outlier message to the founder-approved After-Pitch sibling copy." },
  { "id": "§1.5.2", "read_at": "2026-08-12T12:05:50Z", "source_file": "CLAUDE.md", "line_range": "139-173", "why_it_governs": "Proactive audit → follow-up commit.", "how_this_build_will_embody_it": "Found in the seam audit; shipped as the sanctioned follow-up." },
  { "id": "§3.4", "read_at": "2026-08-12T12:06:00Z", "source_file": "CLAUDE.md", "line_range": "282-292", "why_it_governs": "Honesty — a failure surface must name the real cause, not a misattribution.", "how_this_build_will_embody_it": "The reword stops blaming the recording for a service failure." },
  { "id": "§6", "read_at": "2026-08-12T12:06:10Z", "source_file": "CLAUDE.md", "line_range": "352-395", "why_it_governs": "The pre-action checklist forces me to confirm I understand why the current copy is wrong (a misattribution, not a typo) and that I'm guiding not overtaking before editing a founder-sensitive surface.", "how_this_build_will_embody_it": "Sections 2-5 work through the checklist: root cause of the wrong copy, the sibling-consistency default, and the founder's retained wording authority." },
  { "id": "A19", "read_at": "2026-08-12T12:05:30Z", "source_file": "ThinkerThinker.md", "line_range": "453-468", "why_it_governs": "Consult the surface in-tree before changing it.", "how_this_build_will_embody_it": "Read SessionRecordingUpload + the After-Pitch sibling copy in-tree." },
  { "id": "A22", "read_at": "2026-08-12T12:06:20Z", "source_file": "ThinkerThinker.md", "line_range": "585-610", "why_it_governs": "Citations require in-session reads.", "how_this_build_will_embody_it": "Manifest reflects this build's reads." },
  { "id": "A30", "read_at": "2026-08-12T12:06:30Z", "source_file": "ThinkerThinker.md", "line_range": "768-775", "why_it_governs": "A30 pushes me to lock a fixed lesson into a test so it can't silently regress — which here forces the honest admission that a React-component copy string has no node-env unit test, rather than pretending coverage exists.", "how_this_build_will_embody_it": "HONEST LIMIT: this is copy inside a React component; the node-env vitest suite cannot render it, so no unit test is claimed. The gate (typecheck + lint + full suite, all green) + the founder's visual confirmation on the live surface is the check — stated plainly rather than faking a test (see closure)." },
  { "id": "A38", "read_at": "2026-08-12T12:06:40Z", "source_file": "ThinkerThinker.md", "line_range": "999-1018", "why_it_governs": "'Verified' = the command + output.", "how_this_build_will_embody_it": "closure.md pastes the npm run check output + exit code." }
]
```
