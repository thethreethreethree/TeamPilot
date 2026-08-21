-- 0236 — persist WHY each transcript turn was labeled agent/customer (2026-08-21 speaker-labeling diagnosability).
--
-- The live attribution decides each turn's speaker via one of: "video-mic" (video call → mic is agent-only),
-- "manual" (the rep's "I'm speaking" earbud lock is ON → hard-locked to agent), "content" (an obvious textual
-- tell), "pitch" (trusted acoustic pitch cluster), or "loudness" (proximity fallback). This SOURCE was computed
-- and then only console.logged — so after the fact, a session collapsed to all-"agent" because the earbud lock
-- was left ON is INDISTINGUISHABLE from a genuine one-sided call or a video session. That is why the "all-agent"
-- mislabeling could never be separated from a true capture failure (capture-health can only bucket by the final
-- `speaker`, never by why). Persisting the source per segment makes the collapse diagnosable.
--
-- Additive + nullable: existing rows and any writer that doesn't send a source keep working (NULL = unknown,
-- the reading code treats it as "no reason recorded"). Append-only table — this only adds a column.

alter table coaching_transcript_segments
  add column if not exists source text
    check (source is null or source in ('video-mic', 'manual', 'content', 'pitch', 'loudness'));

comment on column coaching_transcript_segments.source is
  'Why the speaker was assigned: video-mic | manual (earbud lock) | content | pitch | loudness. NULL = unknown. (0236)';
