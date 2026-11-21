---
started_at: 2026-11-20T00:00:00Z
trigger: Founder 2026-11-20, "our new system needs to be built we are stalling" / "continue building unless its a complete gate" — RSS plan docs/rss Phase 4 (docs/07-BUILD-ORDER.md).
doc_integrity:
  CLAUDE.md: be387475f73d
  ThinkerThinker.md: 6acf9cf480e5
---

# THINK - RSS Phase 4: the coaching loop

## The record

- Plan: apply the scaffold's 0275 (feedback_requests, listen_events); Request feedback button; listen events from
  the player; inbox columns + filters on Coach Assessment; coaching metrics show the D8 line until D8 is decided.
- The scaffold's insert policies call rss_session_rep / rss_company_of — never defined in this schema (0272 has
  rss_is_below, rss_can_view_rep). Every RSS table so far is written by a route after its own checks (0275-0277).
- The scaffold makes recipient_id NOT NULL; before a company's tree is complete most reps have no manager_id.
- What already counts as a manager acting on a call: recording_comments.sent_to_rep (0259), pitch_score_overrides
  (0255, actor_id), coach.pitch_score_answered events (subject pitch:<id>). Disputes derive open/closed by replay.
- manager_notifications.type is a closed CHECK (latest 0263) mirrored by NotificationBell's exhaustive switch;
  a request that rings no bell dead-ends (§1.5.1 layer 3).

## Decisions taken without the founder (none is a D-item)

- Request open/closed uses only events BOTH D8 options count (closesUnderEveryPolicy); a test proves it implies
  both. D8 itself stays NOT DECIDED; metrics answer 409.
- recipient_id nullable = "my managers"; the bell uses the existing fan-out (resolveManagers).
- One open request per call; asking again after an answer is a new row.
- Listen ranges are recorded for everyone; metrics exclude a rep's own replays.
