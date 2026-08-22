---
started_at: 2026-08-22T15:07:00+08:00
---

# THINK — DoorLog residuals: keepalive the save + reject empty storagePath (audit M2 + M3)

The MED bundle of the reliability audit, in the trust-crisis field-capture domain. (M1 — "upload failure
mislabeled as no-audio" — is already substantially mitigated: the DropReason distinguishes `upload_failed` from
`no_capture`, and the PRIMARY path streams ~15s chunks DURING recording, so a failed final upload doesn't lose the
recording. Noted, not re-opened.)

## M2 — the fire-and-forget save can be abandoned when the rep leaves (§1.5.1 layer-2/3)

DoorLog's "zero waiting" returns to idle the instant the pitch/knock POST is in flight (`void sendPitch(...)`),
blob/record still settling. If the rep walks to the next door or the PWA backgrounds before the POST completes,
the browser abandons the request and the pitch (or knock) RECORD is never created — silently, because the
component is gone so no banner shows. The live coach path solved the same class with `keepalive`/`sendBeacon`;
DoorLog's POST had neither.

**Fix:** `keepalive: true` on the door-log POST. The bodies are tiny (kind/outcome/name/recordingId/clientKnockId)
— far under the 64KB keepalive cap — because the audio itself already streams as live chunks, not through this
POST. keepalive lets the browser finish the request across the page's unload. Retryable behavior is unchanged
(keepalive requests still return a response).

## M3 — an empty storagePath mints a doomed pitch (defense-in-depth)

`PitchBody.storagePath` was `z.string().max(400).optional()` — a present-but-EMPTY string validated. The route's
branch logic already 400s an empty storagePath (falls through to "A pitch requires audio"), but the schema should
reject it at the boundary so it can never reach the pitch-creation path.

**Fix:** `z.string().min(1).max(400).optional()`. Only affects a present storagePath (the chunked path sends
`recordingId`, omitting storagePath), so no regression.

## Ripple (§1.5)
keepalive is a fetch option on the existing `postDoorLog`; the schema change is one predicate. No data/schema
change. The single-blob fallback's multi-MB storage upload is NOT keepalive-eligible (>64KB), but it's the
fallback-of-fallback (chunks failed AND page unloads mid-upload) — the primary chunked path is already durable;
noted as residual.

## Honesty (§3.4)
M2 stops a silent loss (a logged sale vanishing because the rep moved on); M3 stops a doomed pitch record from a
contract violation. Both make the capture path fail-safe rather than silently-lossy.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "Understand before solving — diagnosed the abandon-on-unload + empty-path paths from the code + audit.",
    "how_this_build_will_embody_it": "Both fixes target the named cause (no keepalive; a validating empty string)." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited CLAUDE §§ + axioms via Read this build before writing." },
  { "id": "§1.5", "source_file": "CLAUDE.md", "line_range": "69-77", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "Holistic — trace ripple; don't fix one thing and break another.",
    "how_this_build_will_embody_it": "keepalive is additive on the existing POST; schema min(1) only affects a present storagePath (chunked path omits it)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "Layer-2/3 — the rep's workflow (log → next door) must not lose the record it just created.",
    "how_this_build_will_embody_it": "keepalive lets the save complete across the unload the workflow triggers." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "Proactive audit — confirmed M1 already mitigated; swept the fire-and-forget class to the live-coach guard.",
    "how_this_build_will_embody_it": "M2 mirrors the live path's keepalive/beacon; M3 hardens the boundary over the existing 400." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-388", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "Honesty is the moat — a silently-abandoned save is a hidden loss.",
    "how_this_build_will_embody_it": "keepalive + schema-reject make the capture fail-safe, not silently lossy." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: diagnosed from the audit + code, traced ripple, no new founder decision (authorized sweep)." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this session before writing." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-710", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "A reported bug is one instance of a class; sweep the boundary.",
    "how_this_build_will_embody_it": "M2 mirrors the live-coach keepalive/beacon guard; M1 confirmed already covered by chunked upload." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "A test locks that every door-log POST is keepalive; the schema min(1) is the boundary gate for M3." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T16:42:42+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md carries the full `npm run check` exit-0 output + the exact test count." }
]
```
