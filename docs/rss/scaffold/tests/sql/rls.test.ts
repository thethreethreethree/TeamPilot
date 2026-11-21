/**
 * Every RLS policy and DB rule in the RSS migrations, tested as a pair:
 * the allowed case works, the forbidden case is refused.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { PGlite } from '@electric-sql/pglite';
import { freshDb, as, asService, C1, C2, CEO, M1, M2, R1, R2, X1, S1, S2 } from './db';

const RLS = /row-level security/;
let db: PGlite;

describe('P0 reporting tree', () => {
  beforeAll(async () => { db = await freshDb(); });

  it('accepts a valid manager', async () => {
    await expect(asService(db, `update profiles set manager_id = '${M1}' where id = '${R2}'`)).resolves.toBeDefined();
    await asService(db, `update profiles set manager_id = '${M2}' where id = '${R2}'`);
  });
  it('refuses self-management, another company, and a loop', async () => {
    await expect(asService(db, `update profiles set manager_id = '${R1}' where id = '${R1}'`)).rejects.toThrow(/themselves/);
    await expect(asService(db, `update profiles set manager_id = '${X1}' where id = '${R1}'`)).rejects.toThrow(/same company/);
    await expect(asService(db, `update profiles set manager_id = '${R1}' where id = '${CEO}'`)).rejects.toThrow(/loop/);
  });
  it('rss_can_view_rep: manager sees own report, admin sees all of own company', async () => {
    const r = await asService<{ a: boolean; b: boolean; c: boolean }>(db,
      `select rss_can_view_rep('${M1}','${R1}') a, rss_can_view_rep('${CEO}','${R2}') b, rss_can_view_rep('${R1}','${R1}') c`);
    expect(r[0]).toEqual({ a: true, b: true, c: true });
  });
  it('rss_can_view_rep: refuses another team, a peer, and another company', async () => {
    const r = await asService<{ a: boolean; b: boolean; c: boolean }>(db,
      `select rss_can_view_rep('${M1}','${R2}') a, rss_can_view_rep('${R1}','${R2}') b, rss_can_view_rep('${X1}','${R1}') c`);
    expect(r[0]).toEqual({ a: false, b: false, c: false });
  });
});

describe('P0 score provenance and archive', () => {
  beforeAll(async () => {
    db = await freshDb();
    await asService(db, `
      insert into pitch_scores values ('00000000-0000-0000-0000-00000000a001','${C1}','${R1}','${S1}','attfiber-v1',70);
      insert into pitch_score_provenance (pitch_score_id, company_id, rep_id, model, prompt_version, rubric_version, scored_by_kind)
        values ('00000000-0000-0000-0000-00000000a001','${C1}','${R1}','m','p1','attfiber-v1','auto');
      insert into pitch_score_archive (pitch_score_id, company_id, rep_id, archived_payload, archived_by, reason)
        values ('00000000-0000-0000-0000-00000000a001','${C1}','${R1}','{"total":64}','${M1}','audio fixed');`);
  });
  it('the rep and their manager can read the archive', async () => {
    expect(await as(db, R1, 'select id from pitch_score_archive')).toHaveLength(1);
    expect(await as(db, M1, 'select pitch_score_id from pitch_score_provenance')).toHaveLength(1);
  });
  it('another manager cannot, and nobody signed in can write it', async () => {
    expect(await as(db, M2, 'select id from pitch_score_archive')).toHaveLength(0);
    await expect(as(db, M1, `insert into pitch_score_archive (pitch_score_id, company_id, rep_id, archived_payload, archived_by, reason)
      values ('00000000-0000-0000-0000-00000000a001','${C1}','${R1}','{}','${M1}','x y z')`)).rejects.toThrow(RLS);
  });
  it('refuses a manager re-score row that names no manager, and an archive with no reason', async () => {
    await expect(asService(db, `insert into pitch_score_archive (pitch_score_id, company_id, rep_id, archived_payload, archived_by, reason)
      values ('00000000-0000-0000-0000-00000000a001','${C1}','${R1}','{}','${M1}',' ')`)).rejects.toThrow(/check/);
    await expect(asService(db, `update pitch_score_provenance set scored_by_kind = 'manager_rescore'`)).rejects.toThrow(/provenance_manager_named/);
  });
});

describe('P0 login attempts and AI cost ledger', () => {
  beforeAll(async () => {
    db = await freshDb();
    await asService(db, `insert into login_attempts (email, succeeded) values ('a@b.c', false);
      insert into ai_usage (company_id, session_id, engine, provider, model, input_tokens) values ('${C1}','${S1}','pitch_score','p','m',100);`);
  });
  it('the server (service role) reads both', async () => {
    expect(await asService(db, 'select id from login_attempts')).toHaveLength(1);
    expect(await asService(db, 'select id from ai_usage')).toHaveLength(1);
  });
  it('no signed-in user - not even the company admin - reads or writes them', async () => {
    expect(await as(db, CEO, 'select id from login_attempts')).toHaveLength(0);
    expect(await as(db, CEO, 'select id from ai_usage')).toHaveLength(0);
    await expect(as(db, R1, `insert into login_attempts (email, succeeded) values ('x@y.z', true)`)).rejects.toThrow(RLS);
  });
  it('refuses a mixed-case email', async () => {
    await expect(asService(db, `insert into login_attempts (email, succeeded) values ('A@b.c', false)`)).rejects.toThrow(/check/);
  });
});

describe('P1 capture', () => {
  beforeAll(async () => {
    db = await freshDb();
    await asService(db, `insert into session_failures (session_id, company_id, reason_code) values ('${S1}','${C1}','NO_SPEECH')`);
  });
  it('accepts phone as a session context', async () => {
    await expect(asService(db, `insert into coaching_sessions (id, company_id, agent_id, context) values ('00000000-0000-0000-0000-0000000005a9','${C1}','${R1}','phone')`)).resolves.toBeDefined();
  });
  it('refuses an unknown context and an unknown failure reason', async () => {
    await expect(asService(db, `insert into coaching_sessions (id, company_id, agent_id, context) values ('00000000-0000-0000-0000-0000000005a8','${C1}','${R1}','fax')`)).rejects.toThrow(/check/);
    await expect(asService(db, `insert into session_failures (session_id, company_id, reason_code) values ('${S1}','${C1}','BAD_LUCK')`)).rejects.toThrow(/check/);
  });
  it('the rep\'s manager sees why a session failed; another manager does not', async () => {
    expect(await as(db, M1, 'select id from session_failures')).toHaveLength(1);
    expect(await as(db, M2, 'select id from session_failures')).toHaveLength(0);
  });
  it('a rep cannot write a failure row', async () => {
    await expect(as(db, R1, `insert into session_failures (session_id, company_id, reason_code) values ('${S1}','${C1}','NO_AUDIO')`)).rejects.toThrow(RLS);
  });
});

describe('P2 interaction stats', () => {
  beforeAll(async () => {
    db = await freshDb();
    await asService(db, `insert into session_interaction_stats (session_id, company_id, rep_id, transcript_version, talk_ratio_time, longest_rep_monologue_ms, longest_customer_story_ms)
      values ('${S1}','${C1}','${R1}',1,0.6,59000,39000)`);
  });
  it('rep and manager see the stats', async () => {
    expect(await as(db, R1, 'select session_id from session_interaction_stats')).toHaveLength(1);
    expect(await as(db, M1, 'select session_id from session_interaction_stats')).toHaveLength(1);
  });
  it('a peer does not, and a talk ratio above 1 is refused', async () => {
    expect(await as(db, R2, 'select session_id from session_interaction_stats')).toHaveLength(0);
    await expect(asService(db, `update session_interaction_stats set talk_ratio_time = 1.2`)).rejects.toThrow(/check/);
  });
});

describe('P3 rubric per channel and keyword trackers', () => {
  beforeAll(async () => { db = await freshDb(); });
  it('keeps the existing rubric as "any" and allows one active phone rubric beside it', async () => {
    expect(await asService(db, `select channel from rubric_config`)).toEqual([{ channel: 'any' }]);
    await expect(asService(db, `insert into rubric_config (version, company_id, active, channel) values ('phone-v1','${C1}',true,'phone')`)).resolves.toBeDefined();
  });
  it('refuses a second active rubric for the same channel', async () => {
    await expect(asService(db, `insert into rubric_config (version, company_id, active, channel) values ('phone-v2','${C1}',true,'phone')`)).rejects.toThrow(/unique|duplicate/);
  });
  it('a manager creates a tracker; a rep cannot', async () => {
    await expect(as(db, M1, `insert into keyword_trackers (company_id, name, phrases, created_by) values ('${C1}','Competitors',array['spectrum'],'${M1}')`)).resolves.toBeDefined();
    await expect(as(db, R1, `insert into keyword_trackers (company_id, name, phrases, created_by) values ('${C1}','Mine',array['x'],'${R1}')`)).rejects.toThrow(RLS);
  });
  it('trackers are visible in the company and invisible to another company; nobody deletes them', async () => {
    expect(await as(db, R1, 'select id from keyword_trackers')).toHaveLength(1);
    expect(await as(db, X1, 'select id from keyword_trackers')).toHaveLength(0);
    expect(await as(db, M1, 'delete from keyword_trackers returning id')).toHaveLength(0);
  });
  it('refuses a tracker with no phrases', async () => {
    await expect(as(db, M1, `insert into keyword_trackers (company_id, name, phrases, created_by) values ('${C1}','Empty','{}','${M1}')`)).rejects.toThrow(/check/);
  });
  it('tracker hits follow the rep: manager sees, other manager does not', async () => {
    await asService(db, `insert into tracker_hits (tracker_id, session_id, company_id, rep_id, at_ms, speaker, matched, transcript_version)
      select id, '${S1}', '${C1}', '${R1}', 0, 'customer', 'spectrum', 1 from keyword_trackers`);
    expect(await as(db, M1, 'select id from tracker_hits')).toHaveLength(1);
    expect(await as(db, M2, 'select id from tracker_hits')).toHaveLength(0);
  });
});

describe('P4 coaching loop', () => {
  beforeAll(async () => { db = await freshDb(); });
  it('a rep asks their manager, or anyone above them, about their own session', async () => {
    await expect(as(db, R1, `insert into feedback_requests (company_id, session_id, requester_id, recipient_id) values ('${C1}','${S1}','${R1}','${M1}')`)).resolves.toBeDefined();
    await expect(as(db, R1, `insert into feedback_requests (company_id, session_id, requester_id, recipient_id) values ('${C1}','${S1}','${R1}','${CEO}')`)).resolves.toBeDefined();
  });
  it('refuses asking a manager outside their chain, or about someone else\'s session', async () => {
    await expect(as(db, R1, `insert into feedback_requests (company_id, session_id, requester_id, recipient_id) values ('${C1}','${S1}','${R1}','${M2}')`)).rejects.toThrow(RLS);
    await expect(as(db, R1, `insert into feedback_requests (company_id, session_id, requester_id, recipient_id) values ('${C1}','${S2}','${R1}','${M1}')`)).rejects.toThrow(RLS);
  });
  it('the recipient sees the request; another manager does not; nobody edits it', async () => {
    expect(await as(db, M1, 'select id from feedback_requests')).toHaveLength(2);
    expect(await as(db, M2, 'select id from feedback_requests')).toHaveLength(0);
    expect(await as(db, R1, `update feedback_requests set message = 'x' returning id`)).toHaveLength(0);
  });
  it('a manager logs listening on a report\'s session; not on another team\'s', async () => {
    await expect(as(db, M1, `insert into listen_events (company_id, session_id, listener_id, rep_id, from_ms, to_ms) values ('${C1}','${S1}','${M1}','${R1}',0,30000)`)).resolves.toBeDefined();
    await expect(as(db, M2, `insert into listen_events (company_id, session_id, listener_id, rep_id, from_ms, to_ms) values ('${C1}','${S1}','${M2}','${R1}',0,30000)`)).rejects.toThrow(RLS);
  });
  it('refuses logging listening on someone else\'s behalf', async () => {
    await expect(as(db, M1, `insert into listen_events (company_id, session_id, listener_id, rep_id, from_ms, to_ms) values ('${C1}','${S1}','${CEO}','${R1}',0,30000)`)).rejects.toThrow(RLS);
  });
  it('the CEO above the manager sees the manager\'s listening; the rep does not', async () => {
    expect(await as(db, CEO, 'select id from listen_events')).toHaveLength(1);
    expect(await as(db, R1, 'select id from listen_events')).toHaveLength(0);
  });
});

describe('P5 snippets, library, saved searches', () => {
  const SN = '00000000-0000-0000-0000-00000000b001';
  let personal = '', company = '';
  beforeAll(async () => {
    db = await freshDb();
    personal = (await as<{ id: string }>(db, M1, `insert into library_folders (company_id, owner_id, name) values ('${C1}','${M1}','Mine') returning id`))[0]!.id;
    company = (await as<{ id: string }>(db, M1, `insert into library_folders (company_id, owner_id, is_company, name) values ('${C1}','${M1}',true,'Team examples') returning id`))[0]!.id;
  });
  it('a manager clips a report\'s session; another manager cannot', async () => {
    await expect(as(db, M1, `insert into snippets (id, company_id, session_id, rep_id, start_ms, end_ms, title, created_by) values ('${SN}','${C1}','${S1}','${R1}',1000,9000,'Great close','${M1}')`)).resolves.toBeDefined();
    await expect(as(db, M2, `insert into snippets (company_id, session_id, rep_id, start_ms, end_ms, title, created_by) values ('${C1}','${S1}','${R1}',1000,9000,'x','${M2}')`)).rejects.toThrow(RLS);
  });
  it('refuses a snippet under one second', async () => {
    await expect(as(db, M1, `insert into snippets (company_id, session_id, rep_id, start_ms, end_ms, title, created_by) values ('${C1}','${S1}','${R1}',1000,1500,'x','${M1}')`)).rejects.toThrow(/check/);
  });
  it('a rep cannot make a company folder', async () => {
    await expect(as(db, R1, `insert into library_folders (company_id, owner_id, is_company, name) values ('${C1}','${R1}',true,'x')`)).rejects.toThrow(RLS);
  });
  it('adding to a personal folder works', async () => {
    await expect(as(db, M1, `insert into library_items (folder_id, snippet_id, added_by) values ('${personal}','${SN}','${M1}')`)).resolves.toBeDefined();
  });
  it('adding to a company folder fails loudly until consent is wired (placeholder announces itself)', async () => {
    await expect(as(db, M1, `insert into library_items (folder_id, snippet_id, added_by) values ('${company}','${SN}','${M1}')`)).rejects.toThrow(/not wired to recording_share_events/);
  });
  it('once wired: granted goes in, not granted is refused', async () => {
    // Test-only wiring against a stand-in table; the real wiring reads recording_share_events (0260).
    await asService(db, `create table test_grants (session_id uuid primary key);
      create or replace function rss_share_granted(sid uuid) returns boolean language sql stable security definer set search_path = public as $f$ select exists (select 1 from test_grants where session_id = sid) $f$;`);
    await expect(as(db, M1, `insert into library_items (folder_id, snippet_id, added_by) values ('${company}','${SN}','${M1}')`)).rejects.toThrow(RLS);
    await asService(db, `insert into test_grants values ('${S1}')`);
    await expect(as(db, M1, `insert into library_items (folder_id, snippet_id, added_by) values ('${company}','${SN}','${M1}')`)).resolves.toBeDefined();
  });
  it('a peer sees the snippet only through the company folder', async () => {
    expect(await as(db, R2, 'select id from snippets')).toHaveLength(1);
    await asService(db, `delete from library_items where folder_id = '${company}'`);
    expect(await as(db, R2, 'select id from snippets')).toHaveLength(0);
  });
  it('saved searches belong to their owner only', async () => {
    await as(db, R1, `insert into saved_searches (owner_id, name, filters) values ('${R1}','Lost on price','{"outcome":"no_sale"}')`);
    expect(await as(db, R1, 'select id from saved_searches')).toHaveLength(1);
    expect(await as(db, M1, 'select id from saved_searches')).toHaveLength(0);
  });
});

describe('P7 training', () => {
  let scen = '';
  beforeAll(async () => {
    db = await freshDb();
    scen = (await as<{ id: string }>(db, M1, `insert into training_scenarios (company_id, title, persona, situation, channel, difficulty, length_min, created_by)
      values ('${C1}','Price objection','Busy owner','Already has a provider','phone','intermediate',10,'${M1}') returning id`))[0]!.id;
  });
  it('a rep cannot create a scenario', async () => {
    await expect(as(db, R1, `insert into training_scenarios (company_id, title, persona, situation, channel, difficulty, length_min, created_by)
      values ('${C1}','x','y','z','phone','easy',5,'${R1}')`)).rejects.toThrow(RLS);
  });
  it('a manager assigns to their own report; not to another team', async () => {
    await expect(as(db, M1, `insert into training_assignments (company_id, scenario_id, rep_id, assigned_by, due_at) values ('${C1}','${scen}','${R1}','${M1}', now() + interval '7 days')`)).resolves.toBeDefined();
    await expect(as(db, M1, `insert into training_assignments (company_id, scenario_id, rep_id, assigned_by, due_at) values ('${C1}','${scen}','${R2}','${M1}', now() + interval '7 days')`)).rejects.toThrow(RLS);
  });
  it('the rep sees their assignment but cannot move the due date; a peer sees nothing', async () => {
    expect(await as(db, R1, 'select id from training_assignments')).toHaveLength(1);
    expect(await as(db, R1, `update training_assignments set due_at = now() + interval '90 days' returning id`)).toHaveLength(0);
    expect(await as(db, R2, 'select id from training_assignments')).toHaveLength(0);
  });
  it('refuses a scenario length outside 2-30 minutes', async () => {
    await expect(asService(db, `update training_scenarios set length_min = 45`)).rejects.toThrow(/check/);
  });
});

describe('P8 protection', () => {
  beforeAll(async () => {
    db = await freshDb();
    await asService(db, `insert into audit_log (company_id, actor_id, action, object_type, object_id) values ('${C1}','${M1}','score.override','pitch_score','a001')`);
  });
  it('the company admin reads the audit log; a manager does not', async () => {
    expect(await as(db, CEO, 'select id from audit_log')).toHaveLength(1);
    expect(await as(db, M1, 'select id from audit_log')).toHaveLength(0);
  });
  it('nobody can change or delete an audit row, not even the server', async () => {
    await expect(asService(db, `update audit_log set action = 'x'`)).rejects.toThrow(/append-only/);
    await expect(asService(db, `delete from audit_log`)).rejects.toThrow(/append-only/);
  });
  it('the company admin sets retention; a manager cannot', async () => {
    await expect(as(db, CEO, `insert into company_recording_settings (company_id, keep_last_per_rep, set_by) values ('${C1}',50,'${CEO}')`)).resolves.toBeDefined();
    await expect(as(db, M1, `update company_recording_settings set keep_last_per_rep = 5 returning company_id`)).resolves.toHaveLength(0);
  });
  it('the company admin files an erasure request; a manager cannot; nobody files one pre-completed', async () => {
    await expect(as(db, CEO, `insert into erasure_requests (company_id, requested_by, match_kind, match_value) values ('${C1}','${CEO}','phone','+15550100')`)).resolves.toBeDefined();
    await expect(as(db, M1, `insert into erasure_requests (company_id, requested_by, match_kind, match_value) values ('${C1}','${M1}','phone','+15550100')`)).rejects.toThrow(RLS);
    await expect(as(db, CEO, `insert into erasure_requests (company_id, requested_by, match_kind, match_value, completed_at) values ('${C1}','${CEO}','phone','1', now())`)).rejects.toThrow(RLS);
  });
  it('a manager trims a report\'s recording; the rep cannot trim their own', async () => {
    await expect(as(db, M1, `insert into recording_trims (session_id, start_ms, end_ms, trimmed_by) values ('${S1}',0,5000,'${M1}')`)).resolves.toBeDefined();
    await expect(as(db, R1, `insert into recording_trims (session_id, start_ms, end_ms, trimmed_by) values ('${S1}',0,5000,'${R1}')`)).rejects.toThrow(RLS);
  });
});

describe('P9 webhooks', () => {
  beforeAll(async () => { db = await freshDb(); });
  it('the company admin registers an https endpoint', async () => {
    await expect(as(db, CEO, `insert into webhook_endpoints (company_id, url, events, created_by) values ('${C1}','https://client.example/hook',array['session.scored'],'${CEO}')`)).resolves.toBeDefined();
  });
  it('refuses http, an unknown event, and a non-admin', async () => {
    await expect(as(db, CEO, `insert into webhook_endpoints (company_id, url, events, created_by) values ('${C1}','http://client.example/hook',array['session.scored'],'${CEO}')`)).rejects.toThrow(/check/);
    await expect(as(db, CEO, `insert into webhook_endpoints (company_id, url, events, created_by) values ('${C1}','https://a.example',array['everything'],'${CEO}')`)).rejects.toThrow(/check/);
    await expect(as(db, M1, `insert into webhook_endpoints (company_id, url, events, created_by) values ('${C1}','https://a.example',array['deal.closed'],'${M1}')`)).rejects.toThrow(RLS);
  });
  it('another company cannot see the endpoint', async () => {
    expect(await as(db, X1, 'select id from webhook_endpoints')).toHaveLength(0);
  });
});

void C2;
