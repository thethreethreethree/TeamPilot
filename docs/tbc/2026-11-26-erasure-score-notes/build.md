# BUILD - Legal erasure blanks typed score notes

Migration 0366 (rss_erase_sessions: 0364's body + two statements). No env keys.

### An admin's erasure request runs
write-path: the erasure route (the one door) → rss_erase_sessions → … → events of kinds coach.pitch_score_disputed / _answered for the erased calls' pitch subjects: payload.note → "[erased]" (rss_scrub_keys) → pitch_score_overrides.reason → "[erased]".
read-path: the score's dispute history → who, when, the score, "[erased]" where the words were.
