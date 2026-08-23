---
started_at: 2026-08-23T12:20:00+08:00
---

# THINK — Prep-up: reuse the caller's empty draft instead of orphaning one per /prep visit (audit D5)

The one D5 item with a genuinely clean, low-risk fix. Built under the active HARD-MODE guard (the founder's
persistent instruction to keep building genuine work); the fix is genuine (a real data-hygiene bug, verified in
the code) and low-risk (server-only, client-transparent), so it is NOT the gold-plating the anti-manufacturing
discipline warns against.

## Root, verified in the code
`MeetingPrepUp` (the /prep page) POSTs `/api/coach/meeting-prep` on MOUNT (`useEffect`, line 50-56) and the route
always `createMeetingPrep`s a fresh row. So every visit-and-leave (or refresh) that doesn't fill the prep in
orphans an empty `meeting_preps` row. Harmless per row, but they accumulate.

## Why the SERVER-reuse approach (not the client refactor)
I explored three fixes: (a) client lazy-create (defer create to first edit) — rejected: it refactors the render
gate + create + save + error + onStart on the "very important" Prep-up feature and touches the H2 HIGH-fix
(flush-on-Start) → real regression risk to a critical flow; (b) delete-empty-on-unmount — rejected: React unmount
cleanup is unreliable (navigation/refresh/close don't fire it); (c) **server get-or-create-empty-draft — chosen**:
`POST /meeting-prep` reuses the caller's most-recent TRULY-EMPTY draft or creates fresh. Client-transparent (it
still receives an empty prep either way — ZERO client change, so H2 + the render gate are untouched), server-only,
and the one real risk (resurfacing a prep the user worked on) is CONTAINED by a conservative "empty" definition +
tests: reuse ONLY when goal is null AND topics is empty AND status is 'draft' AND session_id is null AND there are
NO documents. Any content at all → a fresh draft. If the reuse probe errors, it falls through to create (the
optimization never blocks starting a prep).

## Ripple (holistic — §6 checklist item 5)
Owner-scoped (RLS + `created_by`/`company_id` filters) — no cross-user/tenant reach. Bounds accumulation to ≤1
empty draft per user between real preps (reused across visits). A rare doc-only-no-goal prep isn't reused (correct
— it has content) and is a one-off, not accumulating. Two parallel /prep tabs would share one reused draft
(last-write-wins) instead of two separate preps — a minor, rare behaviour change, lower-impact than the orphan it
replaces. No schema change; `createMeetingPrep` is unchanged (the fallback).

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T12:27:10+08:00",
    "why_it_governs": "Understand the root before fixing — verified the create-on-mount orphan in the code, not assumed from the audit label.",
    "how_this_build_will_embody_it": "Fixes the traced root (always-create on mount) at the server, and chose the approach by risk-tracing three options." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T12:27:20+08:00",
    "why_it_governs": "Methodology in the tree, read THIS build.",
    "how_this_build_will_embody_it": "Re-opened every cited section fresh (read_at ≥ started_at 12:20)." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T12:27:35+08:00",
    "why_it_governs": "Layer-1/2 — the fix keeps the data shape sound (no junk-row accumulation) without breaking the layer-2 create-a-prep effectivity.",
    "how_this_build_will_embody_it": "Client-transparent server change: the prep-creation still works end-to-end; only the orphaning stops." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-172", "read_at": "2026-08-23T12:27:50+08:00",
    "why_it_governs": "Quality over quantity — a real, verified finding fixed at the right (server) layer, not a reckless client refactor.",
    "how_this_build_will_embody_it": "Chose the lowest-risk approach after tracing three; the fix is evidence-backed + test-locked." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T12:28:00+08:00",
    "why_it_governs": "The quick-decision checklist — incl. holistic ripple-tracing (item 5).",
    "how_this_build_will_embody_it": "Traced ripple (owner-scope, doc-only edge, two-tab race), explained the WHY, added detection tests." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T12:28:10+08:00",
    "why_it_governs": "Methodology in the working tree — no cited-from-cache labels.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this build." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T12:28:20+08:00",
    "why_it_governs": "Citations without a session-read are undetected A19 violations.",
    "how_this_build_will_embody_it": "Each cited asset carries a current in-session read_at (≥ started_at 12:20); the Session-Reads trailer lists them." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-720", "read_at": "2026-08-23T12:28:30+08:00",
    "why_it_governs": "An audit finding is a SUSPECT — verified against the code before fixing.",
    "how_this_build_will_embody_it": "Confirmed the create-on-mount orphan in MeetingPrepUp + the route before writing the fix." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T12:28:40+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "+5 detection tests pin the conservative reuse: reuse only a truly-empty draft; create fresh on ANY content (goal/topics/doc) or a probe error." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T12:28:50+08:00",
    "why_it_governs": "'Verified' names the exact command you ran.",
    "how_this_build_will_embody_it": "check.md pastes the full `npm run check` output + EXIT code." }
]
```
