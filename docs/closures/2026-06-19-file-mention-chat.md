# Session-Read Manifest: file-mention-chat

**Date:** 2026-06-19
**Session:** continuous
**Commits in scope:** this commit
**Builder:** Agent

## 1. What this build does

Adds `@file<query>` autocomplete to the chat composer, renders
`@file[Title](UUID)` markers as inline chips in chat threads, and
emits `asset.file.cited` events on every cited file when a chat
message is sent. Completes the citation half of the §A6 Reuse
pillar for chat surfaces.

The citation event is what makes the §4 readout's "citation rate"
metric move off zero — until this commit, the asset-readout page
honestly surfaced 0% because no code emitted the event. Now it does
for chats. Decision Dialogue + Resolution surfaces still emit 0
(deferred to Phase 1B/1C — recommended order surfaced below).

## 2. Constitutional assets cited

| Asset | Cited in | Re-read in session at | Intent | Behavior |
|---|---|---|---|---|
| §A11 | FileMentionChip header, FileMentionAutocomplete header | 2026-06-19T~14:30Z (TT.md full re-read this session) | System counts; user decides. | Embodies — autocomplete surfaces matching files (a count drawn from the library) and the user picks. No auto-insert. |
| §3.1 | chats.ts postMessage emission comment, fileMention.ts shape | 2026-06-19T16:23Z (CLAUDE.md re-read this session) | Events immutable; entity state derived from event replay. | Embodies — every @file cited writes an `asset.file.cited` event with file_id, citing chat_topic, and citing message. Append-only. |
| §A6 | this manifest | 2026-06-19T~14:30Z | Triad — Classification + Retrieval + Reuse — ship none alone. | PARTIALLY — Reuse pillar gains a new sub-feature (citations in chat). Decision + Resolution surfaces still pending; documented in next steps. |
| §A14 | this manifest section 5 | 2026-06-19T~10:00Z (start of session) | Data path complete ≠ render path complete. | Embodies — the data path (event emit on send) and the render path (chip in MessageRow via renderMessageBody) are wired in the same commit. Audited section 5 walks every render branch. |

## 3. Findings + remediations

### Resolved this commit
- Citation rate metric now has a feeder. The §4 readout dashboard will start showing > 0% citation rate once chat messages with @file mentions are sent.
- @file picker uses keyboard nav (↑↓ Enter Esc) matching the existing MentionInput UX from the people-mention surface.
- Chip rendering is loaded-on-demand: clicking the chip fetches /api/files/[id] for a signed URL. Per §A11 — the System shows that the file exists; the user decides to open.

### Deferred with recommended remediation order (per A20)

1. **Phase 1B — @file in Decision Dialogue.** Same FileMentionAutocomplete component, wire into the dialogue's response textarea. ~15 lines of integration. Emit asset.file.cited from the decision-recording route. Recommend doing next so Decision Dialogue surfaces start feeding the citation rate.

2. **Phase 1C — @file in Resolutions.** Same shape. Resolution review surfaces author reasoning in the §1.6 close-the-loop moment — citing the file that informed the resolution is high-value.

3. **Rule trace storage + auto-classify toast (Phase 2).** Bundle: small migration to add a `rule_trace text[]` column to file_classification_suggestions; surface rule distribution in the readout. Plus a small toast on silent uploads. Small.

## 4. Outside-perspective audit (rigorous per feedback_outside_perspective_post_build)

### Persona 1 — New user typing @file in chat
- Types `@file budget` — dropdown appears after ~150ms with files matching "budget" from the library. ✓
- Arrow keys + Enter inserts the marker. ✓
- Marker text in textarea is verbose (`@file[Q3 budget](abc-...)`) but rendered as a small clean chip. Acceptable trade-off — Slack does the same with their `<@USERID>` markers.
- **Concern (LOW):** If user copies the message text and pastes elsewhere, the marker shows as text. Acceptable for v1.
- **Concern (LOW):** Empty query (just `@file`) shows recent files. Reasonable UX.

### Persona 2 — New engineer reading FileMentionAutocomplete
- The component uses TWO keydown interceptors: a React onKeyDown for normal flow AND a native `addEventListener` for ArrowUp/Down/Enter/Tab/Escape when dropdown is open. The native one is needed because the textarea's React onKeyDown also has a "Enter → send" handler that would fire before the dropdown's selection logic. The dual-handler approach is documented in the comment but is slightly awkward.
- The `globalThis.KeyboardEvent → synthetic React event` cast is questionable typing. Works at runtime; type-safe enough for the keys we actually use (`key`, `preventDefault`).
- **Concern (LOW):** A future refactor could merge these into a single handler. Not blocking.

### Persona 3 — Adversary
- @file marker requires a strict UUID match in the regex. Typos render as plain text, not chips. ✓
- The search API uses ILIKE with parameterized query — no SQL injection. ✓
- RLS on the files table gates whose files appear in autocomplete. A user only sees files they can SELECT. ✓
- **Real concern (MEDIUM):** If a user gets a file's UUID from an old message they had access to, then access changes, they could MANUALLY paste the marker and the chip would render. Clicking would fail at /api/files/[id] (404). The chip's existence doesn't leak file metadata — only the title that was in the original message. Acceptable — mirrors how email forwarding works with revoked links.

### Persona 4 — CFO/operator
- Autocomplete fires ~5–10 search API calls per @file session (debounced 150ms). At 100 users sending 10 @file messages/day = 5,000–10,000 API calls/day for search. Trivial DB load.
- Each message with N @file mentions writes N events rows. Negligible.
- Zero LLM cost. ✓

## 5. Cross-module check (per A21) + render-branch walkthrough (per A14)

### A21 — Same-concept-different-feature check

Concept: "inline reference to a thing in a chat message"
- `@person` mentions — `@[Name](id)` format, implemented in MentionInput (used elsewhere; chat composer here uses a plain textarea so no @person yet in chat).
- `@file` mentions — `@file[Title](UUID)` format, this commit.

**Both use the same `[Title-or-Name](Id-or-UUID)` shape**, distinguished by an optional `file` prefix on the `@`. Consistent design — a future engineer adding `@task` or `@topic` mentions would follow the same pattern. ✓

### A14 — Render-branch walkthrough

Every render path that displays chat message bodies:

| Render path | Calls renderMessageBody? | @file chip renders? |
|---|---|---|
| MessageRow normal message | YES (line 113) | ✓ |
| MessageRow with coachGrade | YES (line 228) | ✓ |
| MessageRow attachment-kind | NO (renders InlineAttachment instead) | n/a — the whole body IS the file |
| MessageRow system message | NO (italic body text only, no markdown) | Acceptable — system messages don't @file |
| MessageRow summary kind | YES via the same path | ✓ — System-authored summaries can @file |
| `/dashboard/search` page | NO (renders raw `m.body` as text) | Raw marker visible as text. Acceptable — search snippets show literal content; user clicks to see rendered version |
| Notification surfaces | None render message bodies | n/a |

**No render-branch leaks** — every path either renders chips correctly or shows the raw marker (intentional for search). ✓

## 6. Verification checklist

- [x] `npx tsc --noEmit` green
- [x] `npm run build` green (passed after fixing the server-only import — extracted from chats.ts so the client bundle stays clean)
- [x] All 4 cited assets have session-read timestamps
- [x] All 4 outside-view personas have findings
- [x] A21 + A14 audits documented in section 5
- [x] Empty-state UX: dropdown only opens when there are results; closes when query yields nothing. No "0 results found" dead-end.
- [x] Honest finding surfaced: marker text in textarea is verbose; rendered chip is clean.

## 7. Recommended next steps (per A20)

In order of leverage:

1. **Phase 1B — @file in Decision Dialogue.** Component already exists; wire into InThreadDecisionDialogue's textarea. Emit asset.file.cited from the decision-recording route. ~30 LoC. Recommend doing immediately so the second feeder for citation rate is live.

2. **Phase 1C — @file in Resolutions.** Same shape, same component, wire into the resolution review surface. Decision + Resolution citations are higher-value than chat citations for the §4 readout (these are the reasoning-bearing surfaces where citing a file says "this file informed the reasoning" — citation rate from these surfaces is a stronger signal than from chats).

3. **Phase 2 — Rule trace storage + auto-classify toast.** Bundle. Small.

4. Then the remaining LOW/MEDIUM findings from prior audits (PDF safer-by-default, jargon copy rewrite, EXIF stripping).
