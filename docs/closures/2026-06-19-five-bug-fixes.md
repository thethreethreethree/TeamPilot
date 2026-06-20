# Session-Read Manifest: five-bug-fixes

**Date:** 2026-06-19
**Session:** continuous from Asset System v1 + constitutional self-audit
**Commits in scope:** this commit
**Builder:** Agent

## 1. What this build does

Resolves 5 findings the founder approved from the 2026-06-19 honest
outside-perspective audit:

1. **Bug #1 (HIGH)** — Enter-to-select in @file autocomplete also
   triggered chat send. Added `e.stopImmediatePropagation()` in the
   capture-phase native handler so React's delegated `onKeyDown`
   never receives the event when dropdown is open and a navigation
   key is intercepted.

2. **Bug #2 (MEDIUM)** — `@filename` in plain text wrongly triggered
   autocomplete. Added boundary check in `detectFileMentionContext`:
   if the char after `@file` is non-space, return null.

3. **Bug #4 (MEDIUM)** — Citation count pollution. Adversaries could
   inflate the §4 readout citation rate by pasting markers for files
   they didn't have access to. Added RLS-aware access check before
   each `asset.file.cited` emission across all three sites (chats,
   decisions, resolutions).

4. **Bug #10 (HIGH on reflection)** — Asset readout failed to load
   entirely if migration 0061 hadn't been applied (column not
   found → query error → 500). Wrapped the rule_trace query in
   try/catch with graceful degrade to empty ruleTraceCounts.

5. **Bug #3 (MEDIUM)** — A14 visible-product gap: archived decision
   FoldedDecided note + resolutions list display fields rendered
   raw `@file[Title](UUID)` markers instead of chips. Exported
   `renderInline` from `src/lib/chat/markdown.tsx` and wired it
   into FoldedDecided's note snippet + resolutions list's action /
   why / expected / observed outcome fields + the Review modal's
   action display.

## 2. Constitutional assets cited

| Asset | Cited in | Re-read in session at | Intent | Behavior |
|---|---|---|---|---|
| §A11 | chats.ts access check comment + autocomplete comments | 2026-06-19T~14:30Z (TT.md re-read this session) | System counts; user decides. Counts must be derived from facts the user can see. | Embodies — the citation count integrity check ensures users can only inflate counts on files THEY have legitimate access to. The metric stays anchored to facts the user actually sees, not to UUIDs they obtained out-of-band. |
| §A14 | this manifest section 5 | 2026-06-19T~10:00Z (start of session) | Data path complete ≠ render path complete; verify every render branch. | Embodies — Bug #3 fix walks every place archived decision + resolution text is displayed (FoldedDecided note, resolutions list action / why / expected / observed, ReviewModal action). All wired with renderInline. |
| §3.1 | citation emission comments | 2026-06-19T16:23Z (CLAUDE.md re-read this session) | Events immutable; derived state from event replay. | Embodies — events still append-only; access check is a write-time integrity guard, not a retroactive mutation. |
| §1.5 | this manifest section 5 cross-module check | 2026-06-19T16:23Z | Holistic — never fix one thing in a way that silently breaks another. | Embodies — access check applied to ALL THREE emission sites (chat, decision, resolution), not just one. renderInline export reused across three display callers, not duplicated. |

## 3. Findings + remediations

### Resolved this commit
- 5 bugs from the prior audit, all the HIGH and MEDIUM ones the founder approved.

### Deferred (per A20)

1. **The remaining low-severity findings from prior audits** — toast-named-destination, hardcoded support-dept regex, hardcoded keyword dictionary, marker verbosity in textarea, FolderTree empty-department hiding, etc.
2. **Runtime verification of Bug #1 fix** — I cannot click in a browser; the fix depends on my understanding of React's delegated event handling. Founder verification of "Enter inside @file dropdown does NOT send the message" is the last step that closes Bug #1 honestly.

## 4. Outside-perspective audit (rigorous per feedback_outside_perspective_post_build)

### Persona 1 — User in chat composer

Walking the bug fixes from a user's seat:

- Types `@file budget`, dropdown appears, ↓ to navigate, Enter to select.
  - **Before:** marker inserted AND message sent (Bug #1 — what I shipped previously).
  - **After fix:** marker inserted, focus stays in textarea, message does NOT send.
  - **Cannot verify from sandbox** — relies on my understanding of how `stopImmediatePropagation` interacts with React 18+ event delegation. Founder verification needed.
- Types `I want @filename.pdf to be uploaded`.
  - **Before:** dropdown appears with query "name.pdf" (Bug #2).
  - **After fix:** no dropdown, plain typing.
  - **Verifiable from static logic** — the boundary check is a simple string check.

### Persona 2 — Founder browsing /dashboard/resolutions

Walking the A14 fix:

- A resolution from yesterday has `actionTaken = "Refactored per @file[Q3 architecture review](abc-...)"`.
  - **Before:** raw text `@file[Q3 architecture review](abc-...)` visible.
  - **After fix:** "Refactored per" + clickable chip showing "Q3 architecture review".
- Open the Review modal for the same resolution.
  - **Before:** raw text in the "action" preview.
  - **After fix:** chip rendered.
- Observed outcome field with `@file` markers — chips render. ✓

### Persona 3 — Adversary trying to pollute citation rate

- Obtains a file UUID from a previous message they had access to. Access is later revoked.
- Pastes `@file[Whatever](valid-uuid)` into a NEW chat message.
- Marker renders as a clickable chip (click → 404 from /api/files/[id] RLS).
- **Before fix:** event still fires for that file_id; citation count inflated.
- **After fix:** access check (`select id from files where id = ?`) returns null because RLS denies; emission skipped.
- **Honest concern (LOW):** the file might be deprecated AFTER the legitimate citing user wrote the message but BEFORE the (async) emit runs. The access check uses `is("deprecated_at", null)` so deprecation kills future emits. Race window narrow; acceptable v1.

### Persona 4 — Admin opening the asset readout page

- Migration 0061 not yet applied on prod.
- **Before fix:** readout query fails with "column rule_trace does not exist" → API returns 500 → entire dashboard page broken.
- **After fix:** rule_trace section silently shows empty list; rest of the readout loads normally.
- **Honest concern (LOW):** the silent degrade gives no admin signal "migration needed." Admin might wonder why rule distribution stays empty after uploads. A future enhancement could surface "Apply migration 0061 to enable this section" but that requires server-side migration-state introspection. Defer.

## 5. Cross-module check (per A21) + render-branch walkthrough (per A14)

### Access check applied to all 3 citation emission sites

| Emission site | Path | Access check applied? |
|---|---|---|
| chats.ts postMessage | client-side, user-scoped supabase | ✓ |
| /api/chat/topic-decisions/[id] PATCH | server-side, request-scoped supabase | ✓ |
| /api/resolutions PATCH | server-side, request-scoped supabase | ✓ |

**Consistent shape across all three.** Same pattern: extract → check → emit-or-skip.

### `renderInline` exported and used across surfaces

| Caller | Use case |
|---|---|
| `renderMessageBody` in markdown.tsx | Chat thread message rendering (unchanged) |
| `FoldedDecided` in InThreadDecisionDialogue | Note snippet for decided dialogues |
| Resolutions list — action / why / expected / observed | Persisted resolution display |
| Resolutions ReviewModal — action | Review modal's action preview |

**Single source of truth.** Future surfaces that need @file chip rendering inline (without full markdown block parsing) use the same exported function.

### A14 — Render paths for user-authored text containing @file markers

| Surface | Renders chips? |
|---|---|
| Chat thread message body | ✓ (renderMessageBody → renderInline) |
| Decision Dialogue active textareas | N/A — editor surface; raw text is what user is editing |
| FoldedDecided note snippet | ✓ (NEW) |
| Resolutions list action | ✓ (NEW) |
| Resolutions list reasoning | ✓ (NEW) |
| Resolutions list expected outcome | ✓ (NEW) |
| Resolutions list observed outcome | ✓ (NEW) |
| ReviewModal action preview | ✓ (NEW) |
| Search page snippets | NO — raw text in snippets (intentional; user clicks to see rendered) |
| Notification surfaces | NO — none render user-text bodies |

**A14 gap from prior closure now closed for the visible product surfaces.** Search page remains intentionally raw (per prior closure decision); notifications don't render text bodies.

## 6. Verification checklist

- [x] `npx tsc --noEmit` green
- [x] `npm run build` green
- [x] All 4 cited assets have session-read timestamps
- [x] All 4 outside-view personas walked (with explicit honesty about what I CAN'T verify from sandbox)
- [x] A21 + A14 audits documented
- [x] Each fix has a code-comment naming the audit Finding # it closes
- [x] Honest acknowledgment in section 3 of what requires founder verification (Bug #1 runtime check)

## 7. Honest gaps I'm naming explicitly

- **I have not opened a browser to test Bug #1's fix.** The fix depends on React's event delegation behavior. If React's delegation reads the event from a different phase than I assume, the fix may not work. **Founder runtime verification on Bug #1 specifically is the gate that closes it honestly.**
- **renderInline operates on a single line.** If a user's resolution text has multiline content with @file markers spanning lines, the cross-line markers won't render. Edge case. Same as the prior behavior (renderInline already had this constraint).
- **The graceful degrade for migration 0061 is silent.** Admin gets no UI signal "migration needed." If you forget to apply, the rule section stays empty without explanation.

## 8. Recommended next steps (per A20)

1. **Founder runtime verification of Bug #1 fix** — open a chat, type @file, select via Enter, confirm the message does NOT send. This is the only way to honestly close that bug.
2. **Apply migration 0061 on prod** if not already done. Rule distribution stays empty until then; the page no longer breaks but the data is missing.
3. The remaining low-severity findings from earlier audits.
