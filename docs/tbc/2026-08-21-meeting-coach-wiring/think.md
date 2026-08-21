---
started_at: 2026-08-21T20:20:00+08:00
---

# THINK — Meeting Coach server-side wiring

**Problem.** The pure strategy core (`src/lib/coach/strategy/`, meeting + huddle brains, the seam, the sales
adapter) exists and is green but is UNWIRED — nothing in production can run it. The founder's three decisions
(2026-08-21) unblock the wiring: attribution = platform-captions(video)+room-mic(in-person); cues run live day-1
(controlExempt, no control-month); represent the coaching kind as a `session_kind` column.

**Understanding (§0).** The Sales Coach is a proven LIVE engine — confirmed this session by reading
`useLiveCoaching.ts`: it runs a live `/cue` loop during the call (line 591), speaks each cue to an earpiece via
`speakCue` → `/api/coach/sales-session/tts` (481, 667), gated on an earpiece acknowledgement. So the build
plan's premise (reuse the live-delivery engine, rewrite the brain) HOLDS. The client cue loop is sales-specific
in exactly one place — the hard-coded endpoint — and its response shape (`shouldCue/cue/phase/importance/
trigger`) is identical to the meeting strategy's `CueDecision`. The 2-party loudness attribution
(`volumeVerdict`) is NOT reusable for N-party meetings, but most meeting monitors (drift/undecided/
unassigned-action/over-run) read transcript TEXT and need no speaker labels — only `imbalance` does, and it
already degrades to silent when unattributed. So a single-stream in-person MVP is viable; diarization is an
enhancement.

**This build = the server-side half only (wiring-spec Steps 1–5).** Migration + resolver + CueLLM binding +
getSession field + the meeting cue route with the persist mode-mapping chokepoint. Client capture + UI (Steps
6–7) are the next build.

**Ripple / holistic.** Touches two shared files: `claude.ts` (add `liveMeetingCue`, additive) and
`salesCoach.ts` (add `SalesSession.sessionKind`, additive + A34-defaulted). Sales Coach must stay byte-identical
— proven by the full `npm run check` staying at exit 0 (3563 tests), including the sales cue route tests.

**Attribution (A39).** The meeting brain consumes speaker-labeled turns; per A39 attribution must be carried at
the source. This build does not yet produce the live meeting transcript (that's the capture layer) — the route
accepts an N-party `liveTranscript` (speaker is a participant string) so attribution rides WITH each turn when
the capture layer supplies it.

**Gate the decision, don't re-derive it (§2.2 / A40).** The cue-mode → coaching_cues CHECK mapping
(directive→guide_response) is a single pure chokepoint (`toCoachingCuesMode`) with a drift-guard test, so a
future CueMode can't produce an out-of-CHECK insert.

**Migration coupling (A34).** `getSession` reads `session_kind`; the column may be absent until `npm run
db:apply` runs 0237. `mapSession` defaults it to 'sales' → reads degrade to the pre-migration world (all sales),
never a crash.

## Session-read manifest (A22)

Every asset cited in this build's diff plus the required minimum set, each re-read THIS session. CLAUDE.md is in
the session's loaded context (system prompt); the ThinkerThinker axioms were opened and re-read at the timestamp
below before writing this manifest.

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "Understanding precedes solving — no wiring may be written until the engine being reused is actually read and confirmed.",
    "how_this_build_will_embody_it": "Read useLiveCoaching's live cue loop + speakCue this session to confirm the reuse premise before writing any wiring." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "The methodology defining 'understanding' for this build must be in the working tree and consulted this session, not cited from cached labels.",
    "how_this_build_will_embody_it": "Verified CLAUDE.md + ThinkerThinker.md present via find, and re-read every cited axiom before wiring." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "A feature passes structure→effectivity→composition→UI in order; this build is the layer-1/2 server foundation the client composes on.",
    "how_this_build_will_embody_it": "Built the schema + route foundation soundly and tested before the client capture that will rest on it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "The agent must think first about adjacent failure/improvement, then search to confirm, on every build action.",
    "how_this_build_will_embody_it": "Proactively traced the two-audio-path collision and the attribution-reuse boundary while wiring, not only the asked change." },
  { "id": "§2", "source_file": "CLAUDE.md", "line_range": "264-290", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "Changes to shared code must be surfaced and reasoned, not silently rewritten; trace interconnections before committing.",
    "how_this_build_will_embody_it": "liveMeetingCue and sessionKind are additive with stated rationale; the sales cue path is left untouched." },
  { "id": "§2.2", "source_file": "CLAUDE.md", "line_range": "307-338", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "A decision computed by an authority is returned as a verdict and consumed, never re-derived by a consumer where copies drift.",
    "how_this_build_will_embody_it": "The cue-mode→CHECK mapping lives in one pure chokepoint (toCoachingCuesMode), not re-derived at each call site." },
  { "id": "§3.1", "source_file": "CLAUDE.md", "line_range": "339-346", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "Everything is an append-only event; entity state is derived by replay, never edited, preserving the retrospective record.",
    "how_this_build_will_embody_it": "Delivered cues are appended via appendCue; session_kind is a creation-time classification, not mutable state." },
  { "id": "§3.2", "source_file": "CLAUDE.md", "line_range": "347-351", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "A problem/cue may not surface without enough grounding; the understanding gate is structural, not discretionary.",
    "how_this_build_will_embody_it": "The strategy stays silent under low confidence; the route persists only a shouldCue cue, never a guess." },
  { "id": "§3.3", "source_file": "CLAUDE.md", "line_range": "352-363", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "The System guides and never overtakes; the human stays a participant and the final decider.",
    "how_this_build_will_embody_it": "Meeting cues are advisory facilitation prompts the wearer chooses to act on, never a forced script." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-415", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "Honesty is the moat: AI behavior derives from a real baseline unless a domain is explicitly exempted by the founder.",
    "how_this_build_will_embody_it": "liveMeetingCue is controlExempt ONLY by the founder's explicit day-1 decision, recorded here — not silently defaulted." },
  { "id": "§5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "Knowledge is not intelligence; a fast confident 'done' that skips the unbuilt half is the failure mode this project defeats.",
    "how_this_build_will_embody_it": "Reported the server-side as done and the capture+UI explicitly as NOT done, not the whole system finished." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action (understand, retrospective, ripple, why-not-what).",
    "how_this_build_will_embody_it": "Ran the checklist: confirmed the engine from the record, traced ripple to two shared files, stated each why." },
  { "id": "A18", "source_file": "ThinkerThinker.md", "line_range": "431-452", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "When a system surfaces human-behavior data upward, the ownership/label is the structural defense against misuse.",
    "how_this_build_will_embody_it": "The route owner-gates so a colleague cannot inject cues into another facilitator's meeting record." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "Operational methodology must live in the tree and be read in-session; cited labels without content are the §5 trap.",
    "how_this_build_will_embody_it": "Confirmed both governing docs in tree and re-read the cited axioms this session before wiring." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations of the read-in-session rule; the manifest is the closing artifact.",
    "how_this_build_will_embody_it": "This manifest pairs every cited asset with an in-session read_at; the ThinkerThinker axioms were opened now." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "A lesson in prose returns; a fix is complete only when a gate fails on recurrence without the author's cooperation.",
    "how_this_build_will_embody_it": "The CHECK-mapping landmine is locked by a drift-guard test that fails if any CueMode escapes the vocabulary." },
  { "id": "A34", "source_file": "ThinkerThinker.md", "line_range": "872-895", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "Code that hard-requires an unapplied migration is an outage with a timer; reads must degrade to pre-migration semantics.",
    "how_this_build_will_embody_it": "mapSession defaults session_kind to 'sales' when the 0237 column is absent, so reads never crash pre-apply." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "'Verified' is a claim about the canonical command you ran, not a self-chosen faster subset that reads the same.",
    "how_this_build_will_embody_it": "Ran the full npm run check (all gates, 3563 tests), not a scoped vitest, before claiming green." },
  { "id": "A39", "source_file": "ThinkerThinker.md", "line_range": "1026-1042", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "Multi-party text feeding an AI must carry per-party attribution at the source or the model mislabels confidently.",
    "how_this_build_will_embody_it": "The route accepts N-party speaker-labeled turns so attribution rides with each turn from the capture source." },
  { "id": "A40", "source_file": "ThinkerThinker.md", "line_range": "1045-1057", "read_at": "2026-08-21T23:19:26+08:00",
    "why_it_governs": "A gate/authorization decision is returned as a verdict and consumed, never re-derived by a downstream consumer.",
    "how_this_build_will_embody_it": "The strategy consumes liveMeetingCue's suppressed verdict; the mode-CHECK decision is one chokepoint function." }
]
```
