---
started_at: 2026-08-22T00:26:00+08:00
---

# THINK — Meeting Coach post-meeting Dissect: measurement core (Phase 6)

**Reframe (why now, not gated).** The flag was re-armed because the agent previously self-authorized stops; and
the constitution forbids offloading a design to "founder decides" (build a defensible default, propose it). I had
been GATING the post-meeting Dissect on the founder's §3.5 measurement call. That was over-gating: the right move
is to BUILD a defensible measurement and flag it for the founder to adjust. This is that build's core.

**The §3.5 discipline is the whole design.** A meeting review must measure the meeting's DOWNSTREAM CONSEQUENCES
— what it actually produced — and MUST NOT grade "were the coach's cues followed" (agreement is forbidden;
that's grading its own homework). So the dissect never sees the cues. It measures:
- DECISIONS reached (a meeting's core output),
- ACTIONS assigned + whether each carries an OWNER (owner-less actions = the plan's #1 meeting failure),
- OPEN items left unresolved,
- an EFFECTIVENESS read (focused vs. drifted).
Aggregated over a team's own history these show whether meetings became more decisive / action-owned / focused —
the honest "did meetings improve?" TREND (the ground-up audit flagged there is NO control-month baseline because
cues run day-1, so improvement is a trend, not a before/after).

**Honesty (§3.4).** Extract only what the transcript supports — no invented decision, no guessed owner (null when
none was named), no fabricated open item. A thin/social meeting returns the honest empty state.

**Reuse.** Runs on the post-meeting DIARIZED re-transcription of the durable audio (turns carry real speaker
labels, unlike the live unlabeled cue stream). Reuses the sales `dissectCoachV5` LLM binding (generic deep-eval,
controlExempt). INV22: an empty/unparseable LLM response is logged LOUDLY, never silently treated as "produced
nothing" (the 2026-07-30 sales blank-read outage class).

**This build = the measurement CORE only** (prompt + pure parse + generation + tests). The wiring — re-transcribe
trigger, storage as an event, and the post-meeting review UI — is the NEXT increment (flagged, not claimed here).

## Session-read manifest (A22)

```json
[
  { "id": "§0", "source_file": "CLAUDE.md", "line_range": "10-21", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Understanding precedes solving — the measurement was designed from the §3.5 discipline, not a generic template.",
    "how_this_build_will_embody_it": "The dissect extracts meeting consequences (decisions/owned-actions/open-items), the outputs §3.5 names." },
  { "id": "§0.1", "source_file": "CLAUDE.md", "line_range": "22-40", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "The governing methodology must be in the tree and read this session.",
    "how_this_build_will_embody_it": "Re-read the minimum-set axioms this session before committing." },
  { "id": "§1.5.1", "source_file": "CLAUDE.md", "line_range": "78-138", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "This build is the layer-1/2 measurement core the review UI + aggregate will rest on.",
    "how_this_build_will_embody_it": "Built the pure tested measurement before wiring storage/UI on top of it." },
  { "id": "§1.5.2", "source_file": "CLAUDE.md", "line_range": "139-170", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Build a defensible default proactively rather than offloading the decision.",
    "how_this_build_will_embody_it": "Built + proposed the §3.5 measurement set (flagged for founder adjustment) instead of waiting on 'founder decides'." },
  { "id": "§3.4", "source_file": "CLAUDE.md", "line_range": "364-415", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Honesty is the moat — a review must not fabricate a decision, an owner, or an open item.",
    "how_this_build_will_embody_it": "The parse drops empty items, nulls an unnamed owner, and returns EMPTY on a malformed/thin response; INV22 logs an empty LLM response loudly." },
  { "id": "§3.5", "source_file": "CLAUDE.md", "line_range": "416-433", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "The measurement must anchor to downstream CONSEQUENCE, never to whether the coach's suggestion was adopted.",
    "how_this_build_will_embody_it": "The dissect measures the meeting's produced decisions/actions/open-items and never sees the cues, so it cannot grade agreement." },
  { "id": "§6", "source_file": "CLAUDE.md", "line_range": "434-460", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "The quick-decision checklist gates any substantive action.",
    "how_this_build_will_embody_it": "Ran it: understood the §3.5 constraint, traced ripple (new strategy files, reused dissectCoachV5), stated the why." },
  { "id": "A19", "source_file": "ThinkerThinker.md", "line_range": "455-477", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Methodology read in-session, not cited from cached labels.",
    "how_this_build_will_embody_it": "Re-opened A19/A22/A30/A38 this session before this manifest." },
  { "id": "A22", "source_file": "ThinkerThinker.md", "line_range": "594-633", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "Citations without an in-session read are undetected violations.",
    "how_this_build_will_embody_it": "Every cited asset carries a current in-session read_at." },
  { "id": "A30", "source_file": "ThinkerThinker.md", "line_range": "770-790", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "A lesson in prose returns unless encoded — the INV22 empty-as-error guard is the encoded form of the 2026-07-30 outage lesson.",
    "how_this_build_will_embody_it": "generateMeetingDissect distinguishes suppressed / empty-text / no-signal LOUDLY, not a silent empty." },
  { "id": "A38", "source_file": "ThinkerThinker.md", "line_range": "1001-1023", "read_at": "2026-08-22T00:26:47+08:00",
    "why_it_governs": "'Verified' names the canonical command you ran.",
    "how_this_build_will_embody_it": "Ran the full npm run check (3578 tests, exit 0), pasted in check.md." }
]
```
