---
started_at: 2026-11-20T02:00:00Z
trigger: Founder 2026-11-20, "continue building" — RSS plan docs/rss Phase 6 (follow-through).
doc_integrity:
  CLAUDE.md: be387475f73d
  ThinkerThinker.md: 6acf9cf480e5
---

# THINK - RSS Phase 6: follow-through

## The record

- §3.4 control window: Sales Coach engines run day-1 with controlExempt and consume runBrainCall's `suppressed`
  verdict (src/lib/claude.ts call(); AMD-010). Phase 6's engines do the same.
- Ask Coach existed single-turn (/api/coach/sales-session/[id]/ask-coach, generateCareReply, CONVERSATION_IS_DATA,
  honest-empty 502). Plan: extend with chatId and [{at_ms}] citations.
- Tasks: /api/tasks inserts through the caller's client; tasks have an event trigger (0006) and assignee_user_id
  (0032). The task page is /dashboard/operations/[id].
- Plan says Phase 6 needs no migration — but "saved" chats, once-only callback→task links and a stable stored AI
  read (not re-billed per page view) are facts that need tables → 0281.
- §3.3: the System asks the human first. Applied: the AI outcome is withheld by the ROUTE until the rep's own is
  recorded; every callback becomes a task only when a person clicks.

## Decisions taken without the founder (none is a D-item)

- Callback quotes are verified against their line server-side; unverifiable items are dropped.
- Ask Coach chats are owner-only (a rep's questions about their weak moments are not a manager's read; A10).
- Follow-up email draft (D20, PROPOSAL) not built.
