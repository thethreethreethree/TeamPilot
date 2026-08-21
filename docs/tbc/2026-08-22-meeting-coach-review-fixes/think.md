---
started_at: 2026-08-22T00:20:00+08:00
---

# THINK — Meeting Coach client: review-fix pass

**Problem.** An independent adversarial correctness review of the untestable meeting client found FOUR real
bugs — precisely the correctness patterns the sales hook (`useLiveCoaching`) had already earned and the fast
port dropped. Fixing them by mirroring the sales hook's proven fixes.

1. **HIGH — cross-session cue bleed (findings #1).** `cueInFlightRef` was never reset on a fresh start, and
   there was no session-epoch guard. A stop→restart (same mount) left the latch stuck true → the new meeting's
   cues were ALL blocked until the old in-flight fetch settled, and that late fetch then displayed + SPOKE a cue
   computed for meeting #1 into meeting #2's earpiece. Fix: reset the latch + bump a `sessionEpochRef` on fresh
   start; `invokeCue` captures the epoch and drops a cue whose epoch no longer matches (mirrors the sales
   `sessionEpochRef` at delivery).
2. **MEDIUM-HIGH — unbounded reconnect (finding #2).** `ws.onopen` refilled the reconnect budget instantly, so
   an open-then-instant-drop provider flap looped forever (minting a token + churning an AudioContext each
   cycle), never surfacing the error. Fix: refill only after the socket stays open `RECONNECT_STABLE_MS`; clear
   the stable timer on close/teardown (mirrors the sales `RECONNECT_STABLE_MS` guard).
3. **MEDIUM — silent dead button (finding #3).** A forced "Coach me now" that failed or was declined gave NO
   feedback. Fix: a `cueStatus` string threaded through invokeCue (Thinking / failed / nothing-pressing) and
   shown in the panel — the §3.4 honesty posture (never a silent failure) the sales hook already has.
4. **LOW-MEDIUM — per-session state bleed (finding #4).** `nearingEndRef`, `lastCueAtRef`, `reconnectAttemptsRef`,
   `currentCue`, `micLevel` weren't reset across sessions in the same mount. Fix: reset them all on fresh start
   (and clear cue/level on stop).

The review confirmed the server/data layer (owner gate, A34 write-safety, CHECK mapping, mode resolution) is
clean — the bugs cluster only in the untestable hook, which is exactly why the independent review was worth
running.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Understanding precedes solving — the fixes mirror the sales hook's earned patterns after tracing WHY each bug reproduces.",
    "how_this_build_will_embody_it": "Each fix was matched to the specific sales-hook guard the port dropped, not patched blindly." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "The governing methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Layer-3 continuity — a dead 'Coach me now' button and a cue spoken into the wrong meeting both break the working reality.",
    "how_this_build_will_embody_it": "Finding #3 gives the button honest feedback; finding #1 stops a stale cue reaching a new session." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Proactively surface what could fail — an independent review is that discipline applied to untestable code.",
    "how_this_build_will_embody_it": "Launched the adversarial review specifically because the hook can't be unit-tested; fixed the four real findings." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-415", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Honesty is the moat — a failure must never present as silence or as a false success.",
    "how_this_build_will_embody_it": "A forced cue failure/decline now sets a visible cueStatus instead of an inert button." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood each bug from the review + the sales record, traced ripple (client-only), stated each why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Operational methodology must be read in-session, not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session before writing this manifest." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations; the manifest is the closing artifact.",
    "how_this_build_will_embody_it": "Every cited asset here carries a current in-session read_at (00:26)." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "A lesson in prose returns unless a gate catches it — these fixes re-apply the sales hook's encoded guards.",
    "how_this_build_will_embody_it": "The fixes ARE the sales hook's earned guards ported over; the reconnect-stable one is time-based, device-confirmed like its sales origin." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3572 tests, exit 0), pasted in check.md." }
]
```
