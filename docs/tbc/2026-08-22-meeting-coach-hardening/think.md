---
started_at: 2026-08-22T00:00:00+08:00
---

# THINK — Meeting Coach client hardening (post-MVP audit fixes)

**Problem.** The in-person MVP (commit 4f5c4538) shipped an untestable client (mic/WS/AudioContext React glue).
A proactive audit of that code (§1.5.2 — think first about what could fail, then confirm) surfaced two real
correctness defects and one theme defect the full gate caught:

1. **Reconnect resource leak.** On a dropped STT socket, `scheduleReconnect` called `start(true)`, which created
   a NEW AudioContext + socket + ScriptProcessor and overwrote the refs WITHOUT closing the old ones. Browsers
   cap live AudioContexts, so a flaky network would eventually exhaust them and kill capture. Fix: split
   `teardownTransport` (frees socket + audio graph + context, KEEPS the mic stream) and call it before a
   reconnect rebuilds.
2. **Error/stop dead-end (§1.5.1 layer-3).** If `start()` failed (mic denied) or the meeting ended, the panel's
   Stop set status idle but kept the facilitator in the live view with no path back to setup — a workflow
   dead-end. Fix: `endSession` tears down + returns to the setup form (resets the once-latch), so a failure or a
   finished meeting is never a dead-end and another meeting can start.
3. **Theme leak.** The panel hard-coded `text-zinc-100/200` etc. — near-white text invisible in light mode (and
   dark-on-dark if only the text were fixed). Fix: the whole neutral scale uses the app's semantic tokens
   (text-primary/secondary/muted, bg-surface, border-default), legible in both themes. `theme:audit` now green.

**Scope discipline.** Quality over quantity (§1.5.2): the audit also noted minor UX judgment calls
(`markNearingEnd` has no un-set, the mic stays hot on terminal failure) that are NOT defects — left as-is, not
manufactured into fixes. Only the two real bugs + the gate-flagged theme defect are addressed. No sales code
touched; no server change.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "Understanding precedes solving — the fixes came from auditing the actual shipped code, not from theorizing.",
    "how_this_build_will_embody_it": "Traced the reconnect + panel-stop paths in the real files to find the leak and the dead-end before changing them." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "The governing methodology must be in the tree and read this session, not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session (fresh timestamps) before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "A feature must leave the user in a flowing state, not a dead-end — layer-3 workflow continuity.",
    "how_this_build_will_embody_it": "The error/stop dead-end fix returns the facilitator to setup so the workflow always continues." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "Proactively think about what could fail, then search to confirm — quality over quantity.",
    "how_this_build_will_embody_it": "Audited the untestable client for failure modes; fixed the two real ones and declined to manufacture the minor ones." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-220", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "A user-specified experience is layer-2; an unspecified one is the agent's default, kept legible.",
    "how_this_build_will_embody_it": "The panel UX is still the agent's default, now theme-legible in both light and dark via semantic tokens." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action, including a hardening pass.",
    "how_this_build_will_embody_it": "Ran it: understood each defect from the code, traced ripple (client-only, no sales/server), stated each why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "Operational methodology must be read in-session, not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session before writing this manifest." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations; the manifest is the closing artifact.",
    "how_this_build_will_embody_it": "Every cited asset here has a current in-session read_at (the axioms re-read at 00:01)." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "A lesson in prose returns; encode the class in a gate that fails without the author's cooperation.",
    "how_this_build_will_embody_it": "The theme defect is now caught by theme:audit (a gate); the two logic fixes are device-verified since the hook is not unit-testable — flagged, not gated-falsely." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran — a scoped subset reads the same but is weaker.",
    "how_this_build_will_embody_it": "The theme leak was caught precisely because I ran the full npm run check, not the scoped typecheck+lint I ran first; the pasted output is in check.md." }
]
```
