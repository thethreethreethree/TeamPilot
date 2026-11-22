-- 0302 — a transcript line can be labelled by WHERE its audio came from: "call-audio" (founder 2026-11-22).
--
-- "The audio needs to be recorded and monitored for both the agent and the prospect." On a remote live call the
-- device mic hears the rep only. Remote Sales now also captures the call's own audio (the rep shares the call's
-- browser tab with its audio), records it mixed with the mic, and transcribes it on a second realtime socket.
-- Every line from that socket is the prospect BY SOURCE, not by guess — so it is stored with source 'call-audio',
-- keeping 0236's promise that each line says why it got its speaker.
--
-- Additive: widens 0236's CHECK by one value. Existing rows are unchanged. Re-runnable (drop if exists + add).

alter table coaching_transcript_segments
  drop constraint if exists coaching_transcript_segments_source_check;

alter table coaching_transcript_segments
  add constraint coaching_transcript_segments_source_check
    check (source is null or source in ('video-mic', 'manual', 'content', 'pitch', 'loudness', 'call-audio'));

comment on column coaching_transcript_segments.source is
  'Why the speaker was assigned: video-mic | manual (earbud lock) | content | pitch | loudness | call-audio (the call''s own audio = the prospect, 0302). NULL = unknown.';
