# Session-Read Manifest: file-mention-decision-resolution

**Date:** 2026-06-19
**Session:** continuous
**Commits in scope:** this commit
**Builder:** Agent

## 1. What this build does

Phase 1B + 1C of the @file citation feature: wires `@file` autocomplete into
Decision Dialogue (situation + ElicitField for diagnosis/proposal) and the
Resolution Review modal's observed-outcome textarea. Emits
`asset.file.cited` events on phase advance (Decision Dialogue) and on
resolution save.

Completes the citation feeder set for the §A6 Reuse pillar. The §4 readout's
citation rate metric will now move off zero from THREE feeder surfaces (chat
messages, decision dialogue phase advances, resolution reviews). Per §1.6
(close the loop) — citation from RESOLUTIONS is the highest-value signal
because resolutions are the canonical close-the-loop moment.

## 2. Constitutional assets cited

| Asset | Cited in | Re-read in session at | Intent | Behavior |
|---|---|---|---|---|
| §3.1 | decisions PATCH + resolutions PATCH comments | 2026-06-19T16:23Z (CLAUDE.md re-read this session) | Events immutable; entity state derived from event replay. | Embodies — citation emission writes append-only events. |
| §A6 | this manifest section 1 | 2026-06-19T~14:30Z (TT.md full re-read this session) | Triad ship-none-alone; complete the pillar. | Embodies — three feeder surfaces (chat, decision, resolution) now feed the citation metric; the Reuse pillar's citation half is functionally complete for v1. |
| §1.6 | resolutions PATCH comment | 2026-06-19T16:23Z | Close the loop — resolutions feed back as data assets. | Embodies — citation events from resolution review are explicitly framed as "this file informed how I evaluated the outcome." Strongest asset-value signal in the §4 readout. |
| §4 | this manifest | 2026-06-19T16:23Z | Method evolution gated by outcome. | Embodies — citation rate metric is what makes the asset system's method evolution measurable. |

## 3. Findings + remediations

### Resolved this commit
- Phase 1B (@file in Decision Dialogue) and Phase 1C (@file in Resolutions) shipped together.
- **Real bug caught during the outside-perspective audit:** initial implementation emitted `asset.file.cited` on EVERY decision PATCH (every keystroke), not just on phase advance. Existing route comment ("Pure draft saves shouldn't flood the chain") would have been violated. Fixed by gating emission inside the existing `if (body.phase && body.phase !== row.phase)` block. **The audit caught this before commit — that's the friction-against-forgetfulness paying off.**
- Citation emission reads the LATEST state (post-patch `updated` row) so the just-saved mention is included.

### Deferred with recommended remediation order (per A20)

1. **Phase 2 — Rule trace storage + auto-classify toast.** Bundle. Migration to add `rule_trace text[]` to file_classification_suggestions; surface rule distribution in the readout; toast on silent uploads.

2. The 7+ low/medium findings from prior audits (PDF safer-by-default, jargon copy rewrite, EXIF stripping, per-user upload quota, hardcoded support-dept regex, hardcoded keyword dictionary, FolderTree empty-department hiding).

## 4. Outside-perspective audit

### Persona 1 — New user opening a Decision Dialogue
- Situation phase: types `@file customer-pain.pdf` — autocomplete appears, inserts marker. ✓
- Advances to Your read: textarea (via ElicitField) supports @file too. Same UX. ✓
- Advances to System response: read-only AI output, no @file needed. ✓
- Advances to Decide: chosen-path radio + (for hybrid/defer) a small note textarea. The note textarea is NOT wired — it's a 2-row label note, low value for @file. **Conscious deferral.**
- **Concern (LOW):** the placeholder for the situation textarea now says "Type @file to cite a file" — this is jargon for a new user who hasn't met @file yet. Acceptable; the autocomplete is discoverable on typing.

### Persona 2 — New engineer reading the wiring
- ElicitField (the reusable phase sub-field) wired once, benefits all callers. Future surfaces using ElicitField get @file for free. ✓
- Situation textarea wired inline (not via ElicitField) because it's a different DOM placement in the dialogue. Slight duplication of the wrapper-div pattern. Could be refactored if a third inline textarea appears.
- **Real concern caught & fixed:** the emission gate. See section 3.

### Persona 3 — Adversary
- Same as Phase 1A. UUID strictness + RLS + parameterized search. ✓
- New surface area: decision PATCH and resolution PATCH both now extract @file mentions from user-supplied text. The extractor is pure (regex match + Set) and doesn't make any DB queries with user-controlled fragments. No injection surface. ✓

### Persona 4 — CFO/operator
- After the fix to gate emission on phase advance: citation events from a single decision are roughly N (mentions) × M (phase advances). Bounded. Trivial cost.
- Resolution review fires once per save (already a single user action). ✓
- Zero LLM cost. ✓

## 5. Cross-module check (per A21) + render-branch walkthrough (per A14)

### A21 — Cross-module consistency

| Surface | Component used | Citation event source |
|---|---|---|
| Chat composer textarea | FileMentionAutocomplete | postMessage in chats.ts (client-side direct events insert) |
| Decision Dialogue situation | FileMentionAutocomplete | decision PATCH (server-side, gated to phase advance) |
| Decision Dialogue ElicitField | FileMentionAutocomplete | same as above |
| Resolution Review outcome | FileMentionAutocomplete | resolutions PATCH (server-side, fires once on save) |

**Single component reused across all four textareas. ✓**

### A14 — Render-branch walkthrough

Citation events come from FOUR surfaces. Each is fed by a textarea wired to the same FileMentionAutocomplete. The rendering of @file chips in MESSAGES still goes through `renderMessageBody` in `src/lib/chat/markdown.tsx` from Phase 1A. Decision Dialogue and Resolution review surfaces show their text in different render paths:

| Where text is displayed | Render path | @file chips render? |
|---|---|---|
| Chat thread messages | MessageRow → renderMessageBody | ✓ |
| Decision Dialogue "system response" preview | Different component (CoachPanelV5 or read-only) | NO — but this is the SYSTEM's text, not user-authored; no @file mentions to render |
| Decision Dialogue archived/persisted view | TopicDecisionDialogueView in /dashboard/decisions | UNKNOWN — checked, this view doesn't currently use renderMessageBody. **MEDIUM finding — surfaced below.** |
| Resolution detail view | /dashboard/resolutions page list view | Probably plain text. UNKNOWN. |

### Finding from the A14 walkthrough (MEDIUM)

The Decision Dialogue archived view and Resolutions list view show the user's authored text (situation, diagnosis, proposal, observed outcome) WITHOUT passing them through renderMessageBody. So a saved decision with `@file[Foo](uuid)` in the situation will display as raw text in the persisted view.

**Recommendation:** add the @file marker rendering to these display surfaces in a follow-up commit. For this commit, the **citation events still fire correctly** (the data path is complete); only the **render path of historical views is incomplete**. Honest acknowledgment per §A14.

## 6. Verification checklist

- [x] `npx tsc --noEmit` green
- [x] `npm run build` green
- [x] All 4 cited assets have session-read timestamps
- [x] All 4 outside-view personas walked
- [x] A21 + A14 audits documented
- [x] Bug caught + fixed during audit (citation emission gate) documented in section 3
- [x] A14 gap acknowledged (decision/resolution display surfaces don't yet render chips)

## 7. Recommended next steps (per A20)

1. **Phase 2** — Rule trace storage + auto-classify toast. Bundle. Small.
2. **Decision/Resolution archived view chip rendering** — small commit that swaps raw text for renderMessageBody calls (or extracts a similar inline chip parser if the views don't want full markdown). Surfaced in this audit; should ship before any §4 readout reads citation rate >0.
3. Then the 7 medium/low findings from prior audits.
