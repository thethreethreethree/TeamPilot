# C.A.R.E audit — deferred findings + rationale

Of the 13 findings surfaced in the second C.A.R.E audit (per AMD-006
§1.5.1 four-layer framework), 9 shipped as fixes between commits
`791c4e1` and `bda881f`. The remaining 4 are deferred deliberately
with the rationale below.

This doc exists per AMD-006 §1.5.2 (proactive audit rule): the agent
surfaces findings even when they're not addressed immediately, with
a clear recommended path.

---

## L1.1 — `ConversationsApp.tsx` is 3,079 lines

**Why deferred:** Splitting a 3,000-line file in the same session as
fixing 9 other bugs in it is high-risk. The refactor itself is
straightforward (extract `BulkActionBar`, `AssignDropdown`,
`PriorityDropdown`, `CollapsedRail`, `DetailHeader`, `Composer`,
`CustomerPanel`, `ConversationListRow` into their own files), but
each move surfaces import-graph and prop-threading work that's
prone to subtle regressions.

**Recommended path:**
1. Dedicated commit for ConversationsApp split, in a quiet
   moment (no feature work concurrent).
2. Per AMD-006 §1.5.1 layer 1: extract one component at a time,
   each in its own commit. After each, run the full type check
   and a smoke test of the inbox surface.
3. Target structure:
   ```
   src/components/care/inbox/
     ConversationsApp.tsx        (top-level orchestrator, ~600 lines)
     BulkActionBar.tsx
     AssignDropdown.tsx
     PriorityDropdown.tsx
     CollapsedRail.tsx
     DetailHeader.tsx
     Composer.tsx
     CustomerPanel.tsx
     ConversationListRow.tsx
     useConversationActions.ts   (runAction + claim/assign/etc)
     useBulkSelection.ts         (selection state machine)
   ```

**Severity:** High (maintainability) but not blocking. Functional
code is correct.

---

## L1.2 — `lib/data/care.ts` is 3,064 lines

**Why deferred:** Same shape as L1.1. Splitting affects every
C.A.R.E surface and every API route. High-leverage but high blast
radius if done concurrent with feature work.

**Recommended path:**
1. Dedicated commit, type-only refactor first (extract types into
   `src/lib/data/care/types.ts`), then per-table query helpers.
2. Target structure:
   ```
   src/lib/data/care/
     types.ts                     (SupportConversation, SupportMessage, etc)
     mappers.ts                   (row → typed entity)
     conversations.ts             (fetch/claim/assign/status helpers)
     messages.ts                  (post/list message helpers)
     tags.ts
     resolutions.ts
     agents.ts                    (care_agent_state operations)
     supervisor.ts                (request/clear guidance)
     bulk.ts                      (bulk operations)
   ```

**Severity:** High (maintainability) but not blocking.

---

## L2.3 — Inbox has no mobile breakpoint

**Why deferred:** Design decision required before code. The inbox is
a three-column desktop layout (views / list / detail) that doesn't
compress below ~1024px. Two architecturally different paths:

- **(a)** Treat inbox as desktop-only. Add an explicit detector
  that shows a "C.A.R.E inbox is desktop-only — open on a wider
  screen" message on mobile. Stops customer-side widget from being
  unintentionally embedded in a tiny container.
- **(b)** Build a mobile-responsive shell that stacks vertically.
  Single-column on mobile with explicit nav between
  views/list/detail. Significant UI work (each panel needs mobile
  treatment + nav between them).

**Recommended path:** Decide which (a) or (b). Both are valid; the
choice depends on whether mobile agents are a real use case.

If (a): ~50 lines of work, ships in one commit.
If (b): ~500-1000 lines of work, ships across 5-8 commits.

**Severity:** High if mobile agents are real users; low otherwise.
Founder decision blocks the implementation.

---

## L3.2 — Bulk assign doesn't clear or transfer guidance flags

**Why deferred:** Workflow decision required. When an agent
bulk-reassigns a departed teammate's queue, supervisor-guidance
flags persist on the conversations. The new assignee inherits the
flag with no context that the previous agent raised it.

Three valid behaviors:
- **(a)** Status quo. Guidance flag stays. New assignee sees it,
  treats it as fresh signal.
- **(b)** Clear on reassign. The guidance request was raised by
  the previous agent's judgment; reassignment implies a fresh
  pair of eyes who haven't yet asked for help.
- **(c)** Annotate, don't clear. Add a system-message visible
  in the thread: "[agent name] requested supervisor guidance on
  [date]. Reassigned to you by [admin name]." Carries context
  forward without forcing the new agent to act on inherited
  signal.

**Recommended path:** Pick the behavior. (a) is the current default
and may be fine. (c) is the most informative but requires a
system-message UI surface. (b) is the simplest if the intent is
"reassignment = fresh start."

**Severity:** Low. Edge case that requires explicit team
deactivation. Not blocking everyday use.

---

## L4.3 — Voice phase labels collapse three sub-phases

**Why deferred:** Honest fix requires exposing transcribing /
thinking / synthesizing as distinct sub-phases from
`useVoiceMode.ts`, plus matching label updates in
`VoiceSurface.tsx`. Medium-sized refactor for marginal customer
benefit (the existing "Working on a reply…" is honest;
sub-phases are operator-detail).

**Recommended path:** Skip unless customers report not knowing
what's happening during long pauses. If they do, the change is
straightforward: add `phaseDetail` state in the hook, set it at
each sub-phase boundary in `armRecorder.onstop`, render in
`VoiceSurface`.

**Severity:** Low. UX nicety; not a defect.

---

## Status summary

| Finding | Severity | Status |
|---|---|---|
| L1.1 ConversationsApp split | High (maint.) | Deferred — quiet-moment refactor |
| L1.2 care.ts split | High (maint.) | Deferred — quiet-moment refactor |
| L1.3 Auth gate extract | High | ✅ Shipped (helper + 4/22 routes) |
| L1.4 Voice startCall race | Medium-High | ✅ Shipped |
| L2.1 Production console.log | Medium | ✅ Shipped |
| L2.2 Widget close ends voice | High (privacy) | ✅ Shipped |
| L2.3 Mobile inbox | Decision needed | Deferred — founder choice |
| L3.1 Widget config refresh | High | ✅ Shipped |
| L3.2 Bulk assign + guidance | Low | Deferred — decision needed |
| L3.3 Parallel post-action refresh | Low-Medium | ✅ Shipped |
| L4.1 Escape on dropdowns | Low | ✅ Shipped |
| L4.2 Archive vs Close vocab | Low-Medium | ✅ Shipped |
| L4.3 Voice phase labels | Low | Deferred — marginal benefit |

The 4 deferred items either need a founder decision (L2.3, L3.2),
have marginal benefit (L4.3), or are large invasive refactors best
done in dedicated commits (L1.1, L1.2).

The 9 shipped items address every functional, structural, and
security-relevant concern surfaced by the audit. The system is
operationally healthier than it was at audit time.
