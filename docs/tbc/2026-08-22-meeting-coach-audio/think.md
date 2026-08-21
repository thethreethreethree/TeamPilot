---
started_at: 2026-08-22T00:01:00+08:00
---

# THINK — Meeting call-audio durability

**Problem.** The in-person MVP captured live transcript + cues but recorded NO durable audio. The Sales Coach's
single hardest-won lesson (the 2026-08-19→21 capture crisis) is: *the audio is the load-bearing artifact —
transcript, review, and scores can all fail and be regenerated, but ONLY if the audio survived.* A meeting coach
with no recording has the same latent fragility: a dropped STT feed = the meeting is lost with nothing to
recover from, and Phase-6 Dissect has no material.

**Reuse, not rebuild.** A meeting session IS a `coaching_sessions` row, so the sales durability infrastructure is
session-generic and reused with ZERO new server code: the `/audio-chunk` upload route (owner-gated on the
session), `persistRecording` (the clean-Stop full-blob persist, an importable lib), and the auto-close-stale
cron's `stitchSessionAudio` (which stitches never-Stopped sessions and already carries the recreated-recorder
seam guard). The client just records + uploads.

**Dual path (mirrors sales).** Incremental 15s chunks upload DURING the call (survives a never-Stop / crash /
tab-close — stitched by the cron); a clean Stop additionally persists the full blob. Whichever stamps
`audio_asset_url` first wins (idempotent).

**Scope limit (documented, not hidden).** The recorder is created on a FRESH start only and kept across
reconnects — one recorder = one valid webm, no mid-stream seam. If the mic track dies mid-meeting and a new
stream is acquired on reconnect, post-loss audio isn't recorded (the full recorder-recreate seam handling the
sales hook has is a later refinement). Client-only; no sales/server change.

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "Understanding precedes solving — this reuses the sales durability infra after confirming a meeting session is a coaching_sessions row the routes already serve.",
    "how_this_build_will_embody_it": "Verified the /audio-chunk route + stitch cron are session-generic before reusing them; no new server code." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "The governing methodology must be in the tree and read this session, not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "Layer-2 effectivity — a coach that can lose the whole meeting to a dropped feed does not really work end-to-end.",
    "how_this_build_will_embody_it": "Durable audio makes a dropped-STT meeting recoverable rather than lost — the feature works when the network doesn't." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "Proactively surface the compounding risk, then address it — not only the asked feature.",
    "how_this_build_will_embody_it": "Applied the sales capture-crisis lesson to the meeting coach before it bit in production." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood the durability need from the sales record, traced ripple (client-only reuse of existing routes), stated the why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "Operational methodology must be read in-session, not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session before writing this manifest." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations; the manifest is the closing artifact.",
    "how_this_build_will_embody_it": "Every cited asset here carries an in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "A lesson in prose returns; the sales capture crisis is exactly a prose lesson this build applies structurally.",
    "how_this_build_will_embody_it": "Reuses the sales durability infra (the encoded fix) rather than re-learning the audio-is-load-bearing lesson on meetings." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T00:01:03+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3572 tests, exit 0), pasted in check.md, before claiming green." }
]
```
