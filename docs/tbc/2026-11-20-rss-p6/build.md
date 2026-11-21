# BUILD - RSS Phase 6

## Migration
- 0281_rss_p6_follow_through.sql — session_follow_through (one read per transcript version), callback_tasks,
  ask_coach_chats (owner-only), ask_coach_turns (citations). Select-only RLS, append-only rules.

## Engine / library
- src/lib/claude.ts — followThroughCoach, askCoachTurn (controlExempt, cost-ledger engine labels).
- src/lib/coach/remote/followThrough.ts — prompt, numberedTranscript, parseFollowThrough (quote/date/seq guards),
  loadLines, runFollowThrough (pipeline + on demand; never throws).
- src/lib/coach/remote/askCoach.ts — numberAcross, resolveCitations, askCoach (1-10 calls, caller's client,
  saved turns), listChats.
- generateSessionArtifacts — runs runFollowThrough beside the five engines under the same time bound.

## Routes
- POST /api/coach/sales-session/[id]/ask-coach — now multi-turn (chatId) with citations, via askCoach.
- GET/POST /api/coach/remote/ask — saved chats for a call; ask across up to 10 calls.
- GET/POST /api/coach/remote/[id]/follow-through — read (AI outcome withheld until the rep's own); read now.
- POST /api/coach/remote/[id]/callbacks — callback → task (caller's client), once-only link.

## Screens
- FollowThroughPanel (session page, phone/video): callbacks with quote, time, "Add to Tasks" / "In Tasks"; the
  AI's outcome beside the rep's, after theirs.
- CitedAnswer — [n] → time chip (plays on the call page, links elsewhere).
- SessionCoachTools Ask Coach — thread, follow-ups, earlier chats.
- Search page — "Ask about these calls" (newest 10 results).

## Tests
- followThrough.test.ts, askCoach.test.ts, follow-through and callbacks route tests; ask-coach route test rewritten
  for the new engine; pipeline test mocks runFollowThrough.
