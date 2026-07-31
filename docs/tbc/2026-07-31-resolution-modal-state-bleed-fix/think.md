---
tbc_version: 1
trigger: fix
started_at: 2026-07-31T15:05:00Z
doc_hashes:
  CLAUDE.md: e08874ebce63f41eacdfbadcd46b0a6fa8f15fcb79edafde9a7af52e8ebe261f
  ThinkerThinker.md: 0428b0bb286433cc6d9925db2286127994b9d11d1c4df80de1256f0d3f53e8bc
manifest_entries: 10
hypotheses: 1
---

# THINK — ResolutionCaptureModal state-bleed (a conversation's resolution draft bleeds into another)

## 1. Document integrity (§0.1) — MATCH

CLAUDE.md (e08874…) + ThinkerThinker.md (0428…) MATCH docs/tbc/DOC_MANIFEST.json.

## 2. Why (found via the recurring-class sweep, §1.2)

Swept for the `reference_context_switch_state_bleed_class` (per-item component state not reset on
selection-change — found 3× before). `ResolutionCaptureModal` is a new instance:

- It holds 5 form-state hooks (`issueSummary`, `whatWorked`, `category`, `submitting`, `error`).
- `if (!open) return null` renders null when closed but does NOT reset state — the React instance persists.
- It clears the form only on a SUCCESSFUL submit, never on a cancel/close.
- The parent (`ConversationsApp`) renders it `conversationId={selected.id}` with NO `key`, inside a
  `{selected && …}` guard that stays truthy across conversation switches. So switching conversations reuses
  the same modal instance: `conversationId` changes, the form state does NOT.

**Consequence:** an agent who opens the resolve modal for conversation A, types an issue summary, then closes
without submitting and selects conversation B, sees A's text in B's modal. If they submit, A's summary posts
as B's resolution (via `conversationId={selected.id}` = B's id) — WRONG content in the append-only resolution
record (§3.1). Not merely cosmetic: it corrupts the resolution asset.

## 3. Design (the established fix)

`key={selected.id}` on the modal. React remounts on conversation change → the form state resets to initial;
within one conversation (close+reopen) the instance persists, so a legitimate draft survives. Same fix the
prior 3 instances used (the memory records `key={id}` / an id-effect reset).

Class sweep of the siblings that also bind to `selected` in ConversationsApp: `TaskRefinementPanel` is SAFE —
it has an explicit `useEffect([open])` that resets `draft`/`error`/`adjustmentPrompt` + regenerates on each
open. So ResolutionCaptureModal is the one un-reset instance.

## 4. Hypothesis

- **H1:** Adding `key={selected.id}` makes the modal remount on conversation change, resetting the form — no
  bleed — with no other behavior change (the same-conversation draft still persists across close/reopen).

## 5. Session-read manifest (A22, A35)

```json
[
  { "id": "§0",     "read_at": "2026-07-31T15:05:00Z", "source_file": "CLAUDE.md", "line_range": "10-20",   "why_it_governs": "Understanding earned — I confirmed the bleed by reading the modal (no reset-on-close) AND the parent (no key, selected stays truthy), and cleared the sibling (TaskRefinementPanel resets), before fixing.", "how_this_build_will_embody_it": "Section 2 traces the exact path; section 3 records the sibling sweep." },
  { "id": "§0.1",   "read_at": "2026-07-31T15:05:00Z", "source_file": "CLAUDE.md", "line_range": "22-40",   "why_it_governs": "Methodology in the tree, read this session.", "how_this_build_will_embody_it": "Doc integrity MATCH; this-session read_at." },
  { "id": "§1.2",   "read_at": "2026-07-31T15:05:00Z", "source_file": "CLAUDE.md", "line_range": "44-52",   "why_it_governs": "Retrospective identification — the fix comes from sweeping a KNOWN recurring class (found 3× before), not theorizing forward.", "how_this_build_will_embody_it": "The sweep found the 4th instance; the fix matches the class's established remedy." },
  { "id": "§1.5.1", "read_at": "2026-07-31T15:05:00Z", "source_file": "CLAUDE.md", "line_range": "78-96",   "why_it_governs": "Four layers — a technically-working modal (layer 2) that breaks the resolution-capture workflow (layer 3, wrong content submitted) is incomplete; the fix restores continuity.", "how_this_build_will_embody_it": "The fix makes each conversation's resolve modal a fresh surface." },
  { "id": "§3.1",   "read_at": "2026-07-31T15:05:00Z", "source_file": "CLAUDE.md", "line_range": "257-266", "why_it_governs": "Events/resolutions are the immutable record — posting A's summary as B's resolution corrupts an append-only asset that later analysis depends on.", "how_this_build_will_embody_it": "The fix prevents the wrong-content submission at its source (fresh form per conversation)." },
  { "id": "§6",     "read_at": "2026-07-31T15:05:00Z", "source_file": "CLAUDE.md", "line_range": "352-372", "why_it_governs": "Checklist — traced what the change affects (only the modal's remount lifecycle) + swept the sibling class.", "how_this_build_will_embody_it": "closure notes the sibling sweep + the bounded blast radius." },
  { "id": "A19",    "read_at": "2026-07-31T15:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "57-58", "why_it_governs": "Methodology read from the tree this session.", "how_this_build_will_embody_it": "This-session read_at across all entries." },
  { "id": "A22",    "read_at": "2026-07-31T15:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "58-74", "why_it_governs": "Citations without session-reading are undetected violations.", "how_this_build_will_embody_it": "This manifest + the commit's Session-Reads trailer." },
  { "id": "A26",    "read_at": "2026-07-31T15:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "78-90", "why_it_governs": "A reported bug is one instance of a CLASS — I swept the sibling selected-bound components, not just the one flagged.", "how_this_build_will_embody_it": "check.md records ResolutionCaptureModal (buggy, fixed) + TaskRefinementPanel (safe)." },
  { "id": "A38",    "read_at": "2026-07-31T15:05:00Z", "source_file": "ThinkerThinker.md", "line_range": "95-96", "why_it_governs": "'Verified' is a claim about a command run.", "how_this_build_will_embody_it": "check.md pastes the typecheck/test result + exit." }
]
```
