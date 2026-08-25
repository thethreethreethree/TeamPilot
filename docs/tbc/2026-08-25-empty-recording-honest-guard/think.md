---
started_at: 2026-08-25T10:55:00+08:00
---

# THINK — empty/unplayable recording → honest "No audio captured", not a relayed "corrupted"

## How this build was earned (the correction that produced it)

Earlier this turn I diagnosed the founder's "invalid_audio / corrupted" screenshot as an iOS mp4 bad-concat and
shipped a fix for it — WITHOUT inspecting a single real recording (§0 violated: understanding assumed, not earned;
the [[feedback_recurring_failure_instrument_dont_assume]] failure). I then pulled the ACTUAL bytes. Ground truth
refuted the hypothesis: **0 of the real recordings are bad concats.** The 7 "corrupted" pitches are identical
**5-byte webm *Cues* stubs** (`head 1c53bb6b`, no valid container header) on the single-blob fallback path —
empty captures. A 5-byte stub is non-zero, so the worker's `length===0` guard passed it, and it was sent to STT →
ElevenLabs "invalid_audio/corrupted" → surfaced to the rep as a transcription bug when it is really an EMPTY
capture. (Two other failures were a missing brain-config; one was a seq-0 chunk loss — separate classes, flagged.)

## The fix (grounded in the real data, founder-approved this turn)

At the worker's STT chokepoint, after the `length===0` guard: if the recording does NOT begin with a valid
container header (webm EBML / mp4 ftyp — `startsWithNewRecordingHeader`), it is not playable audio. Fail HONESTLY
as "No audio was captured (empty or unplayable)" — the TRUE cause — and do NOT spend an STT call on it. This is a
**§3.4 honesty** fix: the misleading "corrupted" is replaced with the real cause the rep can act on, and the
error-dressed-as-a-different-error is removed ([[reference_error_dressed_as_no_data_class]] mirror).

Why the header check (not a byte-size floor): it is PRINCIPLED and matches the data — a webm always starts with
EBML, an mp4 with ftyp; a file that starts with neither is unplayable by construction. A size floor would be an
arbitrary threshold and risks the founder's "NO minimum length" line ([[project_salescoach_no_minimum_length_2026_08_05]]).
The header check catches the confirmed 5-byte stub with zero risk to a legitimately short (but valid) recording.

## Coexistence with the recovery (b5cdb61d)
The guard fires on INVALID-header input (empty/unplayable) → honest terminal, no STT. The recovery fires on
VALID-header input that STT still rejects (a bad concat) → truncate + retry. Disjoint inputs; they don't overlap.

## A26 class boundary (swept, adversarially)
Class = "an STT consumer that sends a NON-empty but unplayable/headerless blob to STT and surfaces the provider's
'corrupted' as the failure." Consumers of `transcribeSpeech`: (1) the pitch `worker.ts` — the confirmed harm site
(misleading terminal + wasted retries) → FIXED here. (2) `care/stt/route.ts` — same input shape possible, but it
already CATCHES the STT failure and returns a graceful customer-facing "couldn't process, try again" (synchronous,
the customer re-records) → NOT in the harm-class; adding the guard there is a minor STT-cost optimization with no
evidence of harm, so it is FLAGGED, not built (A24 — don't gold-plate without evidence). (3) `elevenlabs.ts` = the
impl. Boundary = the pitch worker.

## Ripple (holistic — §6 item 5)
- One guard added at the existing STT chokepoint; no schema/route/API/migration/external-config change.
- Only affects a recording that would have FAILED at STT anyway — turns a misleading terminal into an honest one
  and saves the STT call. A valid recording is unaffected (it has a header → passes).
- Test-mock ripple: the default `downloadAssetBytes` mock returned a headerless `Buffer.from("x")`; updated to a
  valid-header buffer so the existing STT-path tests still exercise STT (the guard would otherwise short-circuit them).

## A30 gate
Test: a NON-empty headerless recording (the observed 5-byte Cues stub) → terminal "empty or unplayable", STT never
called, never analyzed. Fails if the guard is removed or the message reverts to relaying "corrupted".

## Session-read manifest (A22 — every citation carries a THIS-build read_at ≥ started_at 10:55:00)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-25T10:56:30+08:00",
    "why_it_governs": "Understanding earned before solving — the rule I broke on the mp4 hypothesis.",
    "how_this_build_will_embody_it": "This fix is built ONLY after inspecting the real bytes; the diagnosis is confirmed from data, not assumed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-35", "read_at": "2026-08-25T10:56:32+08:00",
    "why_it_governs": "Methodology in the tree, read this build.",
    "how_this_build_will_embody_it": "ThinkerThinker.md verified in-tree; every cited axiom re-read fresh this build (stale 5h-old reads discarded)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-102", "read_at": "2026-08-25T10:56:10+08:00",
    "why_it_governs": "Layer 2 operational effectivity — a pitch that fails STT on an empty file does not deliver the intended result, and the error must name the real cause.",
    "how_this_build_will_embody_it": "The guard makes the failure honest end-to-end so the rep sees 'no audio', the true state." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-162", "read_at": "2026-08-25T10:57:00+08:00",
    "why_it_governs": "THINK+search the class, not the single instance.",
    "how_this_build_will_embody_it": "Swept the transcribeSpeech consumers; confirmed care/stt already degrades gracefully (out of the harm-class)." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-374", "read_at": "2026-08-25T10:55:50+08:00",
    "why_it_governs": "Honesty is the moat — an error must tell the truth about what happened.",
    "how_this_build_will_embody_it": "Replaces the misleading provider 'corrupted' with the real cause (empty/unplayable capture)." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-437", "read_at": "2026-08-25T10:57:05+08:00",
    "why_it_governs": "Quick-decision checklist (understand-why, sweep, ripple).",
    "how_this_build_will_embody_it": "Ran it: understood the real cause from data, swept the STT-consumer class, traced ripple." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-458", "read_at": "2026-08-25T10:57:10+08:00",
    "why_it_governs": "Methodology in the working tree — no cached labels.",
    "how_this_build_will_embody_it": "Re-opened each cited axiom via Read this build; discarded the 5h-stale reads." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-597", "read_at": "2026-08-25T10:57:12+08:00",
    "why_it_governs": "Citations need session-reads.",
    "how_this_build_will_embody_it": "This manifest pairs every cited § with a fresh read_at ≥ started_at; the trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-702", "read_at": "2026-08-25T10:55:40+08:00",
    "why_it_governs": "Sweep the class to its boundary.",
    "how_this_build_will_embody_it": "Swept transcribeSpeech consumers adversarially; fixed the pitch worker, confirmed care/stt is out of the harm-class." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-773", "read_at": "2026-08-25T10:56:20+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "A test pins the headerless-stub → honest-terminal behavior + STT-not-called." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1005", "read_at": "2026-08-25T10:56:22+08:00",
    "why_it_governs": "'Verified' names the canonical command.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
