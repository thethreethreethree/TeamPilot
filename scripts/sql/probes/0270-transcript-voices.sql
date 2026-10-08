-- scripts/sql/probes/0270-transcript-voices.sql
--
-- 0270 on a fresh database: a repair keeps which voice said each line, assigning one voice as the rep makes it
-- 'agent' and every other voice 'customer' in a new version (the old one kept), the view carries the voice, a
-- relabel keeps it, and assign refuses a voice the call does not have, a call a person already answered, and
-- a call whose lines do not all know their voice.
--
-- CI runs this automatically: scripts/migration-apply-audit.mjs PASS 3.
\set ON_ERROR_STOP 1
\pset tuples_only on

insert into companies(id, name) values ('c1c1c1c1-0000-0000-0000-000000000001', 'Probe Co');
insert into auth.users(id) values ('00000000-0000-0000-0000-0000000000aa');
insert into profiles(id, company_id) values ('00000000-0000-0000-0000-0000000000aa', 'c1c1c1c1-0000-0000-0000-000000000001')
on conflict (id) do update set company_id = excluded.company_id;
insert into coaching_sessions(id, company_id, agent_id, context, status) values
  ('5e5e5e5e-0000-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'in_person', 'ended'),
  ('5e5e5e5e-0000-0000-0000-000000000002', 'c1c1c1c1-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000aa', 'in_person', 'ended');

-- Session 1: an undecided recovery, two voices, all 'unknown' (version 1).
select 'replace returned ' || replace_session_transcript('5e5e5e5e-0000-0000-0000-000000000001',
  '[{"speaker":"unknown","text":"hi, I am with Elostate","seq":0,"speakerId":"speaker_0"},
    {"speaker":"unknown","text":"what does it cost","seq":1,"speakerId":"speaker_1"},
    {"speaker":"unknown","text":"fifty a month","seq":2,"speakerId":"speaker_0"}]'::jsonb);

-- Refusals first: a voice the call does not have; a null voice.
select 'assign unknown voice returned ' || assign_session_voices('5e5e5e5e-0000-0000-0000-000000000001', 'speaker_9');
select 'assign null voice returned ' || assign_session_voices('5e5e5e5e-0000-0000-0000-000000000001', null);

-- The answer: speaker_0 is the rep -> version 2.
select 'assign returned ' || assign_session_voices('5e5e5e5e-0000-0000-0000-000000000001', 'speaker_0');
-- A second answer is refused: the current version is now a person's answer.
select 'second assign returned ' || assign_session_voices('5e5e5e5e-0000-0000-0000-000000000001', 'speaker_1');

-- Session 2: a transcript whose lines do not know their voice (live capture / pre-0270) -> refused.
insert into coaching_transcript_segments(session_id, speaker, text, seq) values
  ('5e5e5e5e-0000-0000-0000-000000000002', 'unknown', 'hello', 0);
select 'assign on voiceless lines returned ' || assign_session_voices('5e5e5e5e-0000-0000-0000-000000000002', 'speaker_0');
-- A relabel there still works and keeps the (null) voice column.
select 'relabel returned ' || relabel_session_transcript('5e5e5e5e-0000-0000-0000-000000000002', 'unknown', 'agent');

do $assert$
declare
  v1 int; v2 int; v3 int; agent int; cust int; manual int; cur_ver int; kept int; s2v int; s2agent int;
begin
  select count(*) into v1 from coaching_transcript_segments where session_id = '5e5e5e5e-0000-0000-0000-000000000001' and version = 1;
  select count(*) into v2 from coaching_transcript_segments where session_id = '5e5e5e5e-0000-0000-0000-000000000001' and version = 2;
  select count(*) into v3 from coaching_transcript_segments where session_id = '5e5e5e5e-0000-0000-0000-000000000001' and version = 3;
  select count(*) filter (where speaker = 'agent'), count(*) filter (where speaker = 'customer'),
         count(*) filter (where source = 'manual'), max(version)
    into agent, cust, manual, cur_ver
  from coaching_transcript_segments_current where session_id = '5e5e5e5e-0000-0000-0000-000000000001';
  select count(*) into kept from coaching_transcript_segments_current
    where session_id = '5e5e5e5e-0000-0000-0000-000000000001' and speaker_cluster is not null;
  select max(version), count(*) filter (where speaker = 'agent') into s2v, s2agent
  from coaching_transcript_segments_current where session_id = '5e5e5e5e-0000-0000-0000-000000000002';

  if v1 <> 3 then raise exception 'the undecided repair should keep 3 lines in version 1, found %', v1; end if;
  if v2 <> 3 then raise exception 'the answer should write version 2 with all 3 lines, found %', v2; end if;
  if v3 <> 0 then raise exception 'a refused assign (unknown voice, null voice, or a second answer) wrote version 3 (% rows)', v3; end if;
  if cur_ver <> 2 then raise exception 'the view should show version 2, shows %', cur_ver; end if;
  if agent <> 2 or cust <> 1 then raise exception 'speaker_0''s 2 lines should be agent and speaker_1''s 1 customer; got agent=% customer=%', agent, cust; end if;
  if manual <> 3 then raise exception 'the answered version should be marked manual on every line, found %', manual; end if;
  if kept <> 3 then raise exception 'the view should carry each line''s voice, found % with a voice', kept; end if;
  if s2v <> 2 or s2agent <> 1 then raise exception 'voiceless lines: assign must refuse and relabel must still work (version % agent %)', s2v, s2agent; end if;
  raise notice 'probe 0270: all assertions hold';
end
$assert$;
