-- scripts/sql/probes/0269-transcript-versions.sql
--
-- 0269 on a fresh database: a repair and a relabel each write a NEW version, the old one stays, the
-- `_current` view shows only the newest, a write with no version joins the current one, deletes still do
-- nothing (the 0070 append-only rule), and the view keeps the base table's RLS (security_invoker, A30).
--
-- CI runs this automatically: scripts/migration-apply-audit.mjs PASS 3 applies every migration to a fresh
-- postgres:16-alpine, runs each probe on its own copy, and fails on the assertion block at the end.
\set ON_ERROR_STOP 1
\pset tuples_only on

-- Fixtures, as superuser: company C1 with rep A and a call; company C2 with rep B.
insert into companies(id, name) values
  ('c1c1c1c1-0000-0000-0000-000000000001', 'Probe Co'),
  ('c2c2c2c2-0000-0000-0000-000000000002', 'Other Co');
insert into auth.users(id) values
  ('00000000-0000-0000-0000-0000000000aa'), ('00000000-0000-0000-0000-0000000000bb');
insert into profiles(id, company_id) values
  ('00000000-0000-0000-0000-0000000000aa', 'c1c1c1c1-0000-0000-0000-000000000001'),
  ('00000000-0000-0000-0000-0000000000bb', 'c2c2c2c2-0000-0000-0000-000000000002')
on conflict (id) do update set company_id = excluded.company_id;
insert into coaching_sessions(id, company_id, agent_id, context, status) values
  ('5e5e5e5e-0000-0000-0000-000000000001', 'c1c1c1c1-0000-0000-0000-000000000001',
   '00000000-0000-0000-0000-0000000000aa', 'in_person', 'ended');

-- The broken transcript, as the upload left it: two 'unknown' turns (version 1, via the trigger).
insert into coaching_transcript_segments(session_id, speaker, text, seq) values
  ('5e5e5e5e-0000-0000-0000-000000000001', 'unknown', 'hi there', 0),
  ('5e5e5e5e-0000-0000-0000-000000000001', 'unknown', 'not interested', 1);

-- 1. A repair: version 2 with real speakers.
select 'replace returned ' || replace_session_transcript('5e5e5e5e-0000-0000-0000-000000000001',
  '[{"speaker":"agent","text":"hi there","seq":0,"spokenAt":"2026-10-03T10:00:00Z"},
    {"speaker":"customer","text":"not interested","seq":1}]'::jsonb);

-- 2. A late write with no version (a replayed finalize) joins the CURRENT version.
insert into coaching_transcript_segments(session_id, speaker, text, seq) values
  ('5e5e5e5e-0000-0000-0000-000000000001', 'agent', 'can I leave a card', 2);

-- 3. A relabel: customer -> agent writes version 3; a second identical relabel changes nothing.
select 'relabel returned ' || relabel_session_transcript('5e5e5e5e-0000-0000-0000-000000000001', 'customer', 'agent');
select 'second relabel returned ' || relabel_session_transcript('5e5e5e5e-0000-0000-0000-000000000001', 'customer', 'agent');

-- 4. An empty repair adds nothing; a delete still deletes nothing.
select 'empty replace returned ' || replace_session_transcript('5e5e5e5e-0000-0000-0000-000000000001', '[]'::jsonb);
delete from coaching_transcript_segments where session_id = '5e5e5e5e-0000-0000-0000-000000000001';

-- 5. Through the view, under RLS: rep A sees the current version; rep B (another company) sees nothing.
grant usage on schema public to authenticated;
grant select on coaching_transcript_segments, coaching_transcript_segments_current, coaching_sessions, profiles to authenticated;
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000aa';
create temp table seen_a as select * from coaching_transcript_segments_current;
set request.jwt.claim.sub = '00000000-0000-0000-0000-0000000000bb';
create temp table seen_b as select * from coaching_transcript_segments_current;
reset role;

do $assert$
declare
  total int; v1 int; v2 int; v3 int; v4 int; cur int; cur_ver int; manual int; late int; a int; b int; a_ver int;
begin
  select count(*) into total from coaching_transcript_segments;
  select count(*) into v1 from coaching_transcript_segments where version = 1;
  select count(*) into v2 from coaching_transcript_segments where version = 2;
  select count(*) into v3 from coaching_transcript_segments where version = 3;
  select count(*) into v4 from coaching_transcript_segments where version = 4;
  select count(*), max(version) into cur, cur_ver from coaching_transcript_segments_current;
  select count(*) into manual from coaching_transcript_segments_current where source = 'manual';
  select count(*) into late from coaching_transcript_segments where seq = 2 and version = 2;
  select count(*), max(version) into a, a_ver from seen_a;
  select count(*) into b from seen_b;

  if v1 <> 2 then raise exception 'history: version 1 should keep its 2 rows (append-only), found %', v1; end if;
  if v2 <> 3 then raise exception 'repair + late write: version 2 should hold 2 repaired rows + 1 late row, found %', v2; end if;
  if late <> 1 then raise exception 'a write with no version did not join the current version (2)'; end if;
  if v3 <> 3 then raise exception 'relabel: version 3 should copy all 3 rows of version 2, found %', v3; end if;
  if v4 <> 0 then raise exception 'a relabel with nothing to change, or an empty repair, wrote version 4 (% rows)', v4; end if;
  if total <> 8 then raise exception 'expected 8 rows in all (2 + 3 + 3; the delete must do nothing), found %', total; end if;
  if cur <> 3 or cur_ver <> 3 then raise exception 'the current view should show version 3 only (3 rows), shows % rows of version %', cur, cur_ver; end if;
  if manual <> 1 then raise exception 'relabel should mark exactly the 1 changed row manual, found %', manual; end if;
  if a <> 3 or a_ver <> 3 then raise exception 'RLS: the call''s rep should see 3 rows of version 3 through the view, saw % of %', a, a_ver; end if;
  if b <> 0 then raise exception 'RLS: a rep of ANOTHER company saw % transcript rows through the view', b; end if;
  raise notice 'probe 0269: all assertions hold';
end
$assert$;
