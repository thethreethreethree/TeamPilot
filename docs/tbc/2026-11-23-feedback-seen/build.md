# BUILD - Clear a feedback answer once the rep has seen it

Migration 0321 (feedback_answer_views) — applied to production. No env keys.

### The rep sees an answer
write-path: Remote Sales → a call → FeedbackRequest shows "Answered." to the call's own rep → POST
/api/coach/remote/:id/feedback-seen → getSession + agent check → insert feedback_answer_views (caller's client; 0321
insert policy).
read-path: Today → "Your coaching this week" → GET my-coaching → requests → requestAnsweredAt vs the latest view per call
→ "N answers from your manager to read" (or "No new answers to read").
