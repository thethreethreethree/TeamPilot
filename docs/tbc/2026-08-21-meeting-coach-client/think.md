---
started_at: 2026-08-21T23:30:00+08:00
---

# THINK — Meeting Coach client (in-person MVP: create + live capture + panel)

**Problem.** The server-side (commit 129e3c01) made the meeting brain callable, but nothing PRODUCES a live
meeting transcript or lets a facilitator run a session. This build is the client half (wiring-spec Steps 6–7):
create a meeting session, capture the room live, feed the brain, speak cues to the earpiece.

**The architecture decision (grounded this session).** The reuse map assumed the sales live engine was reusable.
Reading `useLiveCoaching.ts` this session showed its transport (mic + Scribe WS + audio graph + reconnect) is
INLINE and intertwined with its 2-party loudness attribution (`volumeVerdict`, `pitchSeparation`) — there is no
clean pre-factored transport to reuse, exactly the "no clean seam → flag it, it changes effort" the plan's Phase
2 anticipates. Two paths: parameterize the load-bearing sales hook in place (real regression risk to the live
sales business), or write a NEW self-contained meeting hook (zero sales risk, some duplicated WS boilerplate).
Chosen: the NEW hook — the live sales business is untouched (don't damage what works). The DRY cost is a
~10-line PCM encoder + the WS const; a later refactor shares them once both are stable.

**Attribution (A39).** A single room mic gives no reliable per-speaker split, so every turn is UNLABELED
(speaker "participant") rather than a guessed 2-party label. The meeting brain's text monitors work on the words;
its imbalance monitor degrades to silent without labels (never a confident-wrong dominance read). Diarization is
the later enhancement half of Decision #1.

**Migration coupling (A34).** `createSession` must NOT write `session_kind` on the sales path — on a pre-0237 DB
the column is absent and an insert naming it would 500, breaking SALES session creation. So sales omits it
(byte-identical to today); meeting/huddle writes it and fails honestly pre-migration (correct — a meeting can't
exist before 0237). Locked by a drift-guard test on the insert payload.

**UX (§1.5.4).** The founder did not specify the panel's design, so it is the agent's default (mirrors the sales
LiveCoachingPanel — earpiece-gated Start, a prominent cue, Stop). If the founder specifies the experience, that
becomes the layer-2 requirement, not deferrable polish.

**Not unit-testable.** The hook + panel are mic/WS/AudioContext React glue — device-confirmed, like
`useLiveCoaching`. The create route + `createSession` payload ARE tested (they're server logic).

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-21T23:46:16+08:00",
    "why_it_governs": "Understanding precedes solving — the client architecture was chosen after reading the actual sales transport, not assumed.",
    "how_this_build_will_embody_it": "Read useLiveCoaching's transport this session and found no clean seam, which drove the new-hook decision." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-21T23:46:16+08:00",
    "why_it_governs": "The governing methodology must be in the tree and read this session, not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-read the cited axioms (A34/A39 + the minimum set) this session before writing the client." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-21T23:46:16+08:00",
    "why_it_governs": "A feature must work end-to-end the way a real user invokes it, not just pass units; the create-path alone is a half-feature.",
    "how_this_build_will_embody_it": "Shipped the create-path WITH the capture + panel as one working vertical slice, not the create-path alone." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-21T23:46:16+08:00",
    "why_it_governs": "Think first about adjacent failure/improvement, then confirm — on every build action.",
    "how_this_build_will_embody_it": "Caught the start-after-sessionId closure bug in the panel by tracing the render timing, not by grep." },
  { "id": "§1.5.4", "source_file": "CLAUDE.md", "line_range": "198-220", "read_at": "2026-08-21T23:46:16+08:00",
    "why_it_governs": "A user-specified experience is the layer-2 result, not waivable polish; an unspecified one is the agent's default.",
    "how_this_build_will_embody_it": "The founder did not specify the panel UX, so it mirrors the sales panel and is flagged as refineable — not shipped as 'the' required design." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-21T23:46:16+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood the transport from the record, traced the create-path ripple to shared createSession, stated each why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-21T23:46:16+08:00",
    "why_it_governs": "Operational methodology must live in the tree and be read in-session; cited labels without content are the confident-answer trap.",
    "how_this_build_will_embody_it": "Confirmed both governing docs in tree and re-read the cited axioms this session." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-21T23:46:16+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations; the manifest is the closing artifact.",
    "how_this_build_will_embody_it": "This manifest pairs every cited asset with an in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-21T23:46:16+08:00",
    "why_it_governs": "A lesson in prose returns; the fix is complete only when a gate fails on recurrence without the author's cooperation.",
    "how_this_build_will_embody_it": "The A34 write-safety is locked by a drift-guard test asserting the sales insert payload never names session_kind." },
  { "id": "A34", "source_file": "ThinkerThinker.md", "line_range": "872-895", "read_at": "2026-08-21T23:46:16+08:00",
    "why_it_governs": "Code that hard-requires an unapplied migration is an outage with a timer; reads degrade, writes fail honestly.",
    "how_this_build_will_embody_it": "createSession omits session_kind on the sales path (safe pre-0237); the meeting create route fails honestly if 0237 is unapplied." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-21T23:46:16+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran, not a self-chosen subset.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3572 tests, exit 0), pasted in check.md, before claiming green." },
  { "id": "A39", "source_file": "ThinkerThinker.md", "line_range": "1026-1042", "read_at": "2026-08-21T23:46:16+08:00",
    "why_it_governs": "Multi-party text feeding an AI must carry per-party attribution at the source or the model mislabels confidently.",
    "how_this_build_will_embody_it": "Single-mic turns are UNLABELED ('participant'), never a guessed 2-party label; the imbalance monitor degrades to silent." }
]
```
