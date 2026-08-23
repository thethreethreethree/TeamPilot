---
started_at: 2026-08-23T08:25:00+08:00
---

# THINK — Meeting Coach UI audit fixes (founder: "make sure there are no UI bugs")

Founder directive: audit the Team-Sync / Meeting Coach system + fix UI + backend bugs. A parallel 4-agent audit
(backend, security, UI/UX, integration) + my behavioral probes ran; this build fixes the confirmed **UI** findings.
Per §1.5.4 the founder NAMED "no UI bugs" as the deliverable, so a broken surface is a layer-2 failure, not
waivable polish. Each fix below was VERIFIED against the code (A26: a finding is a suspect) before fixing.

## HIGH
- **H1 (MeetingCoachingPanel):** after a pre-capture error (mic denied / connect fail / instant stop) `endSession`
  unconditionally set `endedSessionId`, so the ENDED screen showed the optimistic "recording saving… review will
  be ready" + a Review link that 409-loops forever (nothing was recorded). `recordingSaved===null` conflated
  "uploading" with "never started." Fix: track `wasLiveRef` (set when `status==="live"`); only offer the review +
  stamp `/end` when the session ACTUALLY recorded — otherwise return straight to setup. (Honesty §3.4 +
  layer-3 dead-end.)
- **H2 (MeetingPrepUp):** goal/topics autosave on a 700ms debounce; "Start Meeting" handed off + unmounted, and
  the cleanup dropped the pending PATCH → the session bound an EMPTY prep and the whole agenda feature silently did
  nothing. Fix: `flushSave()` cancels the debounce + awaits a final PATCH before `onStart`; Start disabled while
  saving; a save FAILURE blocks Start (don't start an unsaved prep).

## MED
- **M1 (MeetingPrepUp):** autosave `.catch` swallowed failures despite the comment "surfaced, never dropped." Fix:
  a `saveError` state, surfaced.
- **M2 (Panel/Review/TrendTile):** accents were fixed dark-palette (`text-emerald-300`/`amber-300`/`red-300/400`)
  → ~1.3–3.3:1 on the white light surface (WCAG fail; selecting an option made its label LESS readable). Fix: the
  codebase's own idiom `text-{c}-700 dark:text-{c}-300` (light gets the dark shade, dark the light) — `dark:` is
  wired (`darkMode: ["class",'[data-theme="dark"]']`).
- **M3 (MeetingPrepUp):** topic/doc rows + the upload dropzone used `bg-white/… border-white/…` → invisible on the
  light surface. Fix: theme tokens (`bg-surface-raised`/`bg-surface`/`border-default`).
- **M4 (MeetingPrepUp):** the file `<input>` was `hidden` (display:none) → not keyboard-reachable. Fix: `sr-only`
  (focusable) + a focus-within ring on the label.
- **M5:** `MeetingTrendTile` + `MeetingHistoryList` both rendered an identical "Your meetings" heading on setup.
  Fix: rename the trend tile's to "Meeting trend."

## LOW (done here, cheap + real continuity)
- **L3 (Review):** Retry was offered on permanent 4xx (404/403/400). Fix: gate Retry on `res.status>=500`
  (5xx/network retryable; the 503 transient-dissect still retries).
- **L4 (Review):** no back affordance from the error/pending states. Fix: a "← Back to Meeting Coach" link.
- **L5 (MeetingPrepUp):** the remove-topic ✕ was a bare 16px target. Fix: padding for a comfortable hit area.

## Deferred (flagged, not in this UI commit)
The backend/integration/security findings (INT-1 clean-Stop audio-loss HIGH; the UUID-coverage no-op; the prep-link
silent no-op; huddle-ignores-agenda; the meetingPrep error-as-no-data honesty gaps; the doc-upload chokepoint
bypass) ship as the **backend/wiring** remediation next — kept separate so a UI regression and a backend regression
never share a commit. Lower UI LOWs (L1 draft-per-visit, L2 Start-always-enabled, L6 raw-status copy, L7
pending-loop tail) folded into the residual.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-23T08:29:12+08:00",
    "why_it_governs": "Understand before solving — every fix was verified against the code, not applied on the agent's word.",
    "how_this_build_will_embody_it": "Read the exact lines behind H1/H2/M1-M5 before editing; suspects confirmed." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-42", "read_at": "2026-08-23T08:29:12+08:00",
    "why_it_governs": "Methodology in the working tree, read this session before acting.",
    "how_this_build_will_embody_it": "Re-opened the cited CLAUDE §§ + axioms via Read this session before fixing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-23T08:29:12+08:00",
    "why_it_governs": "Layer-3 workflow continuity + layer-4 surface — dead-ends + illegible surfaces are the bug class.",
    "how_this_build_will_embody_it": "H1/L4 remove dead-ends; M2/M3 make the surface legible; M4 keyboard-reachable." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-23T08:29:12+08:00",
    "why_it_governs": "Proactive audit — the founder-requested sweep across the whole UI surface, not one screen.",
    "how_this_build_will_embody_it": "Fixed Prep-up + Panel + Review + TrendTile together; found the shared light-theme class." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-220", "read_at": "2026-08-23T08:29:12+08:00",
    "why_it_governs": "The founder NAMED 'no UI bugs' as the result — so UI soundness is layer-2, not waivable polish.",
    "how_this_build_will_embody_it": "Treated the UI findings as must-fix, not deferred as layer-4." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-388", "read_at": "2026-08-23T08:29:12+08:00",
    "why_it_governs": "Honesty — H1's false 'review ready' + M1's swallowed save error are failures shown as success.",
    "how_this_build_will_embody_it": "H1 no longer promises a review for a never-recorded session; M1 surfaces save failures." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-455", "read_at": "2026-08-23T08:29:12+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: verified each finding, traced ripple, kept UI + backend fixes in separate commits, added regression tests." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-23T08:29:12+08:00",
    "why_it_governs": "Methodology in the working tree, read this session.",
    "how_this_build_will_embody_it": "Re-opened the cited axioms via Read this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-23T08:29:12+08:00",
    "why_it_governs": "Citations need an in-session read.",
    "how_this_build_will_embody_it": "Each cited asset carries a current in-session read_at." },
  { "id": "A26", "source_file": "ThinkerThinker.md", "line_range": "691-710", "read_at": "2026-08-23T08:29:12+08:00",
    "why_it_governs": "A reported bug is one instance of a class; the audit findings are suspects to verify.",
    "how_this_build_will_embody_it": "Verified each agent finding against the code before fixing; M2/M3 fixed the shared light-theme class across all UI files." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-23T08:29:12+08:00",
    "why_it_governs": "Encode the lesson in a gate.",
    "how_this_build_will_embody_it": "+2 MeetingPrepUp tests: the H2 flush-before-Start (goal persisted) + M4 (file input sr-only, not hidden)." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-23T08:29:12+08:00",
    "why_it_governs": "'Verified' names the command you ran.",
    "how_this_build_will_embody_it": "check.md carries the full `npm run check` exit-0 output + the exact test count." }
]
```
