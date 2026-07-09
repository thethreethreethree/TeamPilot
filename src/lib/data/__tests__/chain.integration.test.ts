/**
 * Chain integration test — proves the §3.1 events → signals chain end-to-end.
 *
 * Why this exists
 * ───────────────
 * Until this file, the chain was verified only by ad-hoc curl invocations I
 * ran during the build of 0012/0014/0015. Those checks weren't reproducible:
 * if a future change to `derive_signals_for_event`, the chat-message trigger,
 * or the signal_sources rows broke the chain, nothing in `npm run check`
 * would catch it. The §1.7 audit's O1 finding made this explicit.
 *
 * What it verifies
 * ────────────────
 * Against a real Supabase project (service-role-keyed), this test creates an
 * isolated company with a unique name, walks two paths through the chain,
 * and asserts the downstream rows materialize:
 *
 *   Path A — pin emission:
 *     INSERT chat_pin
 *       → trigger emits `chat.pinned` event into events
 *       → derive_signals_for_event resolves signal_sources for kind=chat.pinned
 *       → INSERT into signals with kind=pinned_evidence
 *
 *   Path B — durability review (§3.5 consequence measurement):
 *     UPDATE chat_topics SET close_durability='held'
 *       → trigger emits `chat.topic_durability_reviewed` event with payload
 *       → derive_signals_for_event matches predicate {close_durability:'held'}
 *       → INSERT into signals with kind=resolution_held
 *
 * Then cleans up by deleting the test company; cascades handle the rest.
 *
 * Discipline
 * ──────────
 * Gated by EXECOS_INTEGRATION_TEST=1 so it does not run in default `npm test`
 * (which should stay hermetic). Set the var in CI or before `npm run check`
 * when you want it. Each run uses a uniquely-named company so concurrent
 * runs don't collide and a crashed run doesn't poison the next.
 *
 * If this test ever fails, the §3.1 chain is broken in production until
 * fixed. Treat as a 🔴 alarm, not a 🟡.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";

const enabled = process.env.EXECOS_INTEGRATION_TEST === "1";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

type Json = Record<string, unknown>;

async function rest(
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  body?: Json
): Promise<{ status: number; data: unknown }> {
  // For DELETE, default to `return=minimal` so PostgREST does NOT add
  // a RETURNING * clause. Several tables in the §3.1 chain (events,
  // signals, chat_messages, brain_evolution_events) reject DELETE
  // RETURNING because of their immutability rules. We never need the
  // returned rows for DELETE anyway.
  const preference =
    method === "DELETE" ? "return=minimal" : "return=representation";
  const res = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: preference,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = JSON.parse(text);
  } catch {
    /* leave as text */
  }
  return { status: res.status, data };
}

// Wait briefly for triggers to run. Triggers fire in-transaction so the row
// is guaranteed-present once the INSERT returns — but we add a tiny delay to
// be defensive against any read-replica lag PostgREST might introduce.
function settle(ms = 50) {
  return new Promise((r) => setTimeout(r, ms));
}

describe.skipIf(!enabled || !SUPABASE_URL || !SERVICE_KEY)(
  "§3.1 chain integration — events → signals end-to-end",
  () => {
    let companyId: string;
    let topicId: string;
    let messageId: string;

    // §3.1 discipline applied to the test itself: events / signals /
    // chat_messages are immutable. A test that creates them MUST NOT
    // try to delete them after — that would violate the very rule the
    // test exists to verify. So we reuse a single persistent test
    // company across runs. Each run creates a fresh topic + message
    // within it, and assertions look up by *its own* IDs rather than
    // counting the table globally.
    const TEST_COMPANY_NAME = "EXECOS Chain Integration Test";
    const runTag = `chain-test-${Date.now()}`;

    beforeAll(async () => {
      // 1) find-or-create the persistent test company
      const lookup = await rest(
        "GET",
        `/rest/v1/companies?name=eq.${encodeURIComponent(TEST_COMPANY_NAME)}&select=id`
      );
      const found = lookup.data as Array<{ id: string }>;
      if (found.length > 0) {
        companyId = found[0]!.id;
      } else {
        const c = await rest("POST", "/rest/v1/companies", {
          name: TEST_COMPANY_NAME,
        });
        expect(c.status, JSON.stringify(c.data)).toBe(201);
        companyId = (c.data as Array<{ id: string }>)[0]!.id;
      }

      // 2) topic — unique per run so tests don't see each other's rows
      const t = await rest("POST", "/rest/v1/chat_topics", {
        company_id: companyId,
        title: `${runTag}:topic`,
        description: "isolated test topic",
        tags: ["integration-test"],
      });
      expect(t.status, JSON.stringify(t.data)).toBe(201);
      topicId = (t.data as Array<{ id: string }>)[0]!.id;

      // 3) message — required because chat_pin references it
      const m = await rest("POST", "/rest/v1/chat_messages", {
        topic_id: topicId,
        company_id: companyId,
        kind: "message",
        body: "chain-test message",
      });
      expect(m.status, JSON.stringify(m.data)).toBe(201);
      messageId = (m.data as Array<{ id: string }>)[0]!.id;
    });

    afterAll(async () => {
      // §3.1 — no cleanup. Events/signals/chat_messages are immutable
      // by SQL rule (see migrations 0002, 0004, 0010). Deleting them
      // would violate the very discipline this test exists to verify.
      //
      // The persistent test company accumulates topic + message rows
      // each run — that's fine, §3.1 says past data IS past data. The
      // only non-immutable artifacts (chat_pins, chat_participants,
      // chat_topics) we leave as well, so the test surface mirrors
      // production behavior exactly.
    });

    it("path A — chat_pin INSERT emits chat.pinned event and derives pinned_evidence signal", async () => {
      const pin = await rest("POST", "/rest/v1/chat_pins", {
        topic_id: topicId,
        message_id: messageId,
        company_id: companyId,
      });
      expect(pin.status, JSON.stringify(pin.data)).toBe(201);
      await settle();

      // Event must exist with the right kind + subject (= message id per 0012)
      const ev = await rest(
        "GET",
        `/rest/v1/events?company_id=eq.${companyId}&kind=eq.chat.pinned&subject=eq.chat_message:${messageId}&select=id,kind,subject,payload`
      );
      const evRows = ev.data as Array<{ kind: string; subject: string }>;
      expect(evRows.length).toBe(1);
      expect(evRows[0]!.kind).toBe("chat.pinned");

      // Signal must exist with correct source per the 0014 substitution fix.
      const sig = await rest(
        "GET",
        `/rest/v1/signals?company_id=eq.${companyId}&kind=eq.pinned_evidence&source=eq.chat_message:${messageId}&select=id,kind,source`
      );
      const sigRows = sig.data as Array<{ kind: string; source: string }>;
      expect(sigRows.length).toBe(1);
      expect(sigRows[0]!.kind).toBe("pinned_evidence");
      expect(sigRows[0]!.source).toBe(`chat_message:${messageId}`);
    });

    it("path B — close_durability='held' emits chat.topic_durability_reviewed and derives resolution_held signal", async () => {
      const upd = await rest(
        "PATCH",
        `/rest/v1/chat_topics?id=eq.${topicId}`,
        { close_durability: "held" }
      );
      expect(upd.status, JSON.stringify(upd.data)).toBe(200);
      await settle();

      const ev = await rest(
        "GET",
        `/rest/v1/events?company_id=eq.${companyId}&kind=eq.chat.topic_durability_reviewed&select=kind,payload`
      );
      const evRows = ev.data as Array<{
        kind: string;
        payload: { close_durability: string };
      }>;
      expect(evRows.length).toBeGreaterThanOrEqual(1);
      // Newest first — pick the most recent durability event.
      const latest = evRows[evRows.length - 1]!;
      expect(latest.payload.close_durability).toBe("held");

      const sig = await rest(
        "GET",
        `/rest/v1/signals?company_id=eq.${companyId}&kind=eq.resolution_held&source=eq.chat_topic:${topicId}&select=kind,source`
      );
      const sigRows = sig.data as Array<{ kind: string; source: string }>;
      expect(sigRows.length).toBe(1);
      expect(sigRows[0]!.source).toBe(`chat_topic:${topicId}`);
    });

    it("path B — durability='unknown' does NOT derive a signal (honest empty)", async () => {
      // Change to 'unknown'. Per 0015 design, unknown earns no signal — it
      // explicitly means "not yet measurable." Verify we don't accidentally
      // start firing signals for it.
      const upd = await rest(
        "PATCH",
        `/rest/v1/chat_topics?id=eq.${topicId}`,
        { close_durability: "unknown" }
      );
      expect(upd.status).toBe(200);
      await settle();

      // Event SHOULD fire (it's still a review action).
      const ev = await rest(
        "GET",
        `/rest/v1/events?company_id=eq.${companyId}&kind=eq.chat.topic_durability_reviewed&select=payload&order=occurred_at.desc&limit=1`
      );
      const evRows = ev.data as Array<{
        payload: { close_durability: string };
      }>;
      expect(evRows[0]?.payload.close_durability).toBe("unknown");

      // But NO new signal should appear from this event. Scope the check
      // to THIS test's topic only — the persistent test company
      // accumulates rows from prior runs, so absolute counts can't be
      // asserted. Per topic, we expect exactly one resolution_held signal
      // (from the prior path-B test); the durability='unknown' change
      // must not have added more signals against this topic.
      const sig = await rest(
        "GET",
        `/rest/v1/signals?source=eq.chat_topic:${topicId}&select=kind`
      );
      const sigRows = sig.data as Array<{ kind: string }>;
      expect(sigRows.length).toBe(1);
      expect(sigRows[0]!.kind).toBe("resolution_held");
    });
  }
);

// ─────────────────────────────────────────────────────────────
// §3.1 chain — RESOLUTION durability review (migration 0100).
//
// Path B (above) proves the CHAT-TOPIC durability review closes the loop
// (migration 0015). 0100 applies the identical pattern to the `resolutions`
// table — the problems-workflow surface, fed by close_problem(), which chat
// closes never touch. Reviewing a resolution's durability (UPDATE
// resolutions SET durability='reopened') must emit a
// `resolution.durability_reviewed` event and derive a `problem_recurrence`
// signal SOURCED AT THE PROBLEM (so §1.2 retrospective analysis sees the
// recurrence). This pins 0100 exactly as Path B pins 0015 — in the only
// harness that exercises the real Postgres trigger. Without it, a future
// change to the trigger / signal_sources / derive fn would silently re-open
// the resolutions half of the §3.1 loop and the default gate would stay green.
// ─────────────────────────────────────────────────────────────
describe.skipIf(!enabled || !SUPABASE_URL || !SERVICE_KEY)(
  "§3.1 chain — resolution durability review → problem_recurrence signal (0100)",
  () => {
    const TEST_COMPANY_NAME = "EXECOS Chain Integration Test";
    const runTag = `res-dur-test-${Date.now()}`;
    const DIAGNOSIS =
      "Integration-test problem for the resolution durability review path, " +
      "comfortably over the eighty-character diagnosis minimum the gate requires.";
    let companyId: string;
    let problemId: string;
    let resolutionId: string;

    beforeAll(async () => {
      const lookup = await rest(
        "GET",
        `/rest/v1/companies?name=eq.${encodeURIComponent(TEST_COMPANY_NAME)}&select=id`
      );
      const found = lookup.data as Array<{ id: string }>;
      if (found.length > 0) {
        companyId = found[0]!.id;
      } else {
        const c = await rest("POST", "/rest/v1/companies", {
          name: TEST_COMPANY_NAME,
        });
        expect(c.status, JSON.stringify(c.data)).toBe(201);
        companyId = (c.data as Array<{ id: string }>)[0]!.id;
      }

      // A problem to hang the resolution off (FK target; draft status is fine —
      // resolutions.problem_id has no status constraint).
      const p = await rest("POST", "/rest/v1/problems", {
        company_id: companyId,
        kind: `${runTag}-kind`,
        title: `${runTag}:problem`,
        diagnosis: DIAGNOSIS,
      });
      expect(p.status, JSON.stringify(p.data)).toBe(201);
      problemId = (p.data as Array<{ id: string }>)[0]!.id;

      // A resolution with durability still NULL — the REVIEW is the UPDATE in
      // the test below. action_taken/reasoning are NOT NULL per 0005.
      const r = await rest("POST", "/rest/v1/resolutions", {
        company_id: companyId,
        problem_id: problemId,
        action_taken: "integration-test action taken",
        reasoning: "integration-test reasoning (required, not optional per 0005)",
      });
      expect(r.status, JSON.stringify(r.data)).toBe(201);
      resolutionId = (r.data as Array<{ id: string }>)[0]!.id;
    });

    afterAll(async () => {
      // §3.1 — no cleanup of events/signals (immutable by SQL rule). Problems
      // and resolutions accumulate in the persistent test company; per §3.1
      // past data IS past data, and each run scopes assertions to its own IDs.
    });

    it("durability='reopened' emits resolution.durability_reviewed and derives a problem_recurrence signal sourced at the problem", async () => {
      const upd = await rest(
        "PATCH",
        `/rest/v1/resolutions?id=eq.${resolutionId}`,
        {
          durability: "reopened",
          observed_outcome: "the problem came back within a week of the fix",
        }
      );
      expect(upd.status, JSON.stringify(upd.data)).toBe(200);
      await settle();

      // Event fired with the review payload (new + previous durability, ids).
      const ev = await rest(
        "GET",
        `/rest/v1/events?company_id=eq.${companyId}&kind=eq.resolution.durability_reviewed&subject=eq.resolution:${resolutionId}&select=kind,payload`
      );
      const evRows = ev.data as Array<{
        kind: string;
        payload: { durability: string; problem_id: string };
      }>;
      expect(evRows.length).toBe(1);
      expect(evRows[0]!.payload.durability).toBe("reopened");
      expect(evRows[0]!.payload.problem_id).toBe(problemId);

      // Signal derived: problem_recurrence, sourced at the PROBLEM (0100 design
      // + the 0014 substitution reading the real payload key, not 'unknown').
      const sig = await rest(
        "GET",
        `/rest/v1/signals?company_id=eq.${companyId}&kind=eq.problem_recurrence&source=eq.problem:${problemId}&select=kind,source`
      );
      const sigRows = sig.data as Array<{ kind: string; source: string }>;
      expect(sigRows.length).toBe(1);
      expect(sigRows[0]!.source).toBe(`problem:${problemId}`);
    });

    it("durability='unknown' fires the review event but derives NO signal (honest empty)", async () => {
      // Own problem + resolution so the assertion is a crisp ZERO rather than a
      // count coupled to the prior test's side effect.
      const p2 = await rest("POST", "/rest/v1/problems", {
        company_id: companyId,
        kind: `${runTag}-kind2`,
        title: `${runTag}:problem2`,
        diagnosis: DIAGNOSIS,
      });
      expect(p2.status, JSON.stringify(p2.data)).toBe(201);
      const problemId2 = (p2.data as Array<{ id: string }>)[0]!.id;

      const r2 = await rest("POST", "/rest/v1/resolutions", {
        company_id: companyId,
        problem_id: problemId2,
        action_taken: "unknown-path action taken",
        reasoning: "unknown-path reasoning (required per 0005)",
      });
      expect(r2.status, JSON.stringify(r2.data)).toBe(201);
      const rid2 = (r2.data as Array<{ id: string }>)[0]!.id;

      const upd = await rest("PATCH", `/rest/v1/resolutions?id=eq.${rid2}`, {
        durability: "unknown",
      });
      expect(upd.status).toBe(200);
      await settle();

      // Review event SHOULD fire — it is still a review action.
      const ev = await rest(
        "GET",
        `/rest/v1/events?company_id=eq.${companyId}&kind=eq.resolution.durability_reviewed&subject=eq.resolution:${rid2}&select=payload`
      );
      const evRows = ev.data as Array<{ payload: { durability: string } }>;
      expect(evRows.length).toBe(1);
      expect(evRows[0]!.payload.durability).toBe("unknown");

      // ...but NO signal is derived — unknown earns nothing (no signal_source
      // predicate matches durability='unknown'). Scoped to this fresh problem,
      // so the honest expectation is exactly zero.
      const sig = await rest(
        "GET",
        `/rest/v1/signals?company_id=eq.${companyId}&source=eq.problem:${problemId2}&select=kind`
      );
      expect((sig.data as Array<unknown>).length).toBe(0);
    });
  }
);

// ─────────────────────────────────────────────────────────────
// §3.2 Understanding Gate — the OTHER core structural guarantee.
//
// Why this exists: §3.2 says a problem "may NOT be surfaced until it links to a
// minimum threshold of signals — the schema itself must prevent half-understood
// problems from reaching a human. The bottleneck is encoded, not left to
// discretion." That guarantee is enforced ENTIRELY by the check_understanding_gate()
// trigger in 0002. Until this block it had ZERO reproducible test — a future
// migration that altered or dropped the trigger would silently open the gate and
// nothing would catch it (the exact shape of the 2026-07-03 outage: a migration
// removed a safeguard on an unverified assumption). This pins both directions:
// blocked without evidence, allowed once the threshold is met.
//
// Default '*' threshold (0002): min_signals=3, min_distinct_sources=2,
// min_diagnosis_chars=80. We give every problem an 80+ char diagnosis so the
// SIGNAL gate is the variable under test, not the diagnosis-length gate.
// ─────────────────────────────────────────────────────────────
describe.skipIf(!enabled || !SUPABASE_URL || !SERVICE_KEY)(
  "§3.2 understanding gate — structural enforcement (DB trigger, not app-level)",
  () => {
    const TEST_COMPANY_NAME = "EXECOS Chain Integration Test";
    const runTag = `gate-test-${Date.now()}`;
    const DIAGNOSIS =
      "Deliberately long diagnosis authored by the understanding-gate integration " +
      "test, comfortably over the eighty-character minimum the default threshold sets.";
    let companyId: string;

    beforeAll(async () => {
      const lookup = await rest(
        "GET",
        `/rest/v1/companies?name=eq.${encodeURIComponent(TEST_COMPANY_NAME)}&select=id`
      );
      const found = lookup.data as Array<{ id: string }>;
      if (found.length > 0) {
        companyId = found[0]!.id;
      } else {
        const c = await rest("POST", "/rest/v1/companies", {
          name: TEST_COMPANY_NAME,
        });
        expect(c.status, JSON.stringify(c.data)).toBe(201);
        companyId = (c.data as Array<{ id: string }>)[0]!.id;
      }
    });

    async function createDraftProblem(kind: string): Promise<string> {
      const p = await rest("POST", "/rest/v1/problems", {
        company_id: companyId,
        kind,
        title: `${runTag}:${kind}`,
        diagnosis: DIAGNOSIS,
      });
      expect(p.status, JSON.stringify(p.data)).toBe(201);
      const row = (p.data as Array<{ id: string; status: string }>)[0]!;
      expect(row.status).toBe("draft"); // default — not yet surfaced
      return row.id;
    }

    it("BLOCKS surfacing a problem with zero supporting signals (the core §3.2 guarantee)", async () => {
      const problemId = await createDraftProblem(`${runTag}-blocked`);
      // draft -> surfaceable with 0 signals: the trigger must RAISE and reject.
      const attempt = await rest("PATCH", `/rest/v1/problems?id=eq.${problemId}`, {
        status: "surfaceable",
      });
      expect(attempt.status).toBeGreaterThanOrEqual(400);
      expect(JSON.stringify(attempt.data)).toContain("Understanding Gate");

      // The row must still be 'draft' — the write was rejected, not partially applied.
      const check = await rest(
        "GET",
        `/rest/v1/problems?id=eq.${problemId}&select=status`
      );
      expect((check.data as Array<{ status: string }>)[0]!.status).toBe("draft");
    });

    it("ALLOWS surfacing once >=3 signals from >=2 distinct sources are linked", async () => {
      const problemId = await createDraftProblem(`${runTag}-allowed`);
      // 3 signals across 3 distinct sources (>= min_signals=3, >= min_distinct_sources=2).
      const signalIds: string[] = [];
      for (let i = 0; i < 3; i++) {
        const s = await rest("POST", "/rest/v1/signals", {
          company_id: companyId,
          kind: "integration_gate_signal",
          source: `${runTag}-src-${i}`,
        });
        expect(s.status, JSON.stringify(s.data)).toBe(201);
        signalIds.push((s.data as Array<{ id: string }>)[0]!.id);
      }
      for (const signalId of signalIds) {
        const link = await rest("POST", "/rest/v1/problem_signals", {
          problem_id: problemId,
          signal_id: signalId,
        });
        expect(link.status, JSON.stringify(link.data)).toBe(201);
      }
      // Gate now satisfied on all three thresholds → transition must succeed.
      const attempt = await rest("PATCH", `/rest/v1/problems?id=eq.${problemId}`, {
        status: "surfaceable",
      });
      expect(attempt.status, JSON.stringify(attempt.data)).toBe(200);
      expect((attempt.data as Array<{ status: string }>)[0]!.status).toBe(
        "surfaceable"
      );
    });
  }
);

// ─────────────────────────────────────────────────────────────
// §3.1 immutability — the append-only FOUNDATION.
//
// §3.1: "Everything is an event. Events are append-only. Never update or delete —
// append. Full history must always be intact, because retrospective analysis and
// data-as-asset depend on it." Enforced by `do instead nothing` rules on the
// events table (0004:36-37) — an UPDATE/DELETE "succeeds" (2xx) but changes
// nothing. The chain test's own afterAll RELIES on this ("events are immutable by
// SQL rule") but never verified it. A migration that dropped events_no_update /
// events_no_delete would silently make the foundation mutable, and every
// retrospective-analysis guarantee built on top would quietly rot. This pins it.
// ─────────────────────────────────────────────────────────────
describe.skipIf(!enabled || !SUPABASE_URL || !SERVICE_KEY)(
  "§3.1 immutability — events are append-only (UPDATE/DELETE are silent no-ops)",
  () => {
    const TEST_COMPANY_NAME = "EXECOS Chain Integration Test";
    const runTag = `immut-test-${Date.now()}`;
    const ORIGINAL_KIND = `${runTag}.original`;
    let companyId: string;
    let eventId: string;
    let signalId: string;
    let problemId: string;

    beforeAll(async () => {
      const lookup = await rest(
        "GET",
        `/rest/v1/companies?name=eq.${encodeURIComponent(TEST_COMPANY_NAME)}&select=id`
      );
      const found = lookup.data as Array<{ id: string }>;
      if (found.length > 0) {
        companyId = found[0]!.id;
      } else {
        const c = await rest("POST", "/rest/v1/companies", {
          name: TEST_COMPANY_NAME,
        });
        expect(c.status, JSON.stringify(c.data)).toBe(201);
        companyId = (c.data as Array<{ id: string }>)[0]!.id;
      }

      const e = await rest("POST", "/rest/v1/events", {
        company_id: companyId,
        kind: ORIGINAL_KIND,
        subject: `${runTag}:subject`,
        payload: { v: 1 },
      });
      expect(e.status, JSON.stringify(e.data)).toBe(201);
      eventId = (e.data as Array<{ id: string }>)[0]!.id;

      // signals is the SECOND core chain table, with its own independent
      // no_update/no_delete rules (0002:36+). A migration could drop signals'
      // rule without touching events' — so it's covered independently, not
      // assumed from the events case.
      const s = await rest("POST", "/rest/v1/signals", {
        company_id: companyId,
        kind: ORIGINAL_KIND,
        source: `${runTag}:signal-source`,
      });
      expect(s.status, JSON.stringify(s.data)).toBe(201);
      signalId = (s.data as Array<{ id: string }>)[0]!.id;

      // problems is the THIRD core chain table (events → signals → problems →
      // resolutions). Unlike events/signals it is legitimately UPDATE-able
      // (status transitions draft→surfaced→resolved), so it has only a
      // no_delete rule (problems_no_delete, migration 0108), NOT a no_update
      // rule. Created here so the delete-blocking case below can prove that rule.
      const p = await rest("POST", "/rest/v1/problems", {
        company_id: companyId,
        kind: `${runTag}.chain_problem`,
        title: `${runTag} immutability probe`,
      });
      expect(p.status, JSON.stringify(p.data)).toBe(201);
      problemId = (p.data as Array<{ id: string }>)[0]!.id;
    });

    it("silently drops an UPDATE to an event (row byte-for-byte unchanged)", async () => {
      // The rule is `do instead nothing` — this "succeeds" but must change nothing.
      await rest("PATCH", `/rest/v1/events?id=eq.${eventId}`, {
        kind: `${runTag}.TAMPERED`,
        payload: { v: 999 },
      });
      const check = await rest(
        "GET",
        `/rest/v1/events?id=eq.${eventId}&select=kind,payload`
      );
      const row = (check.data as Array<{ kind: string; payload: { v: number } }>)[0]!;
      expect(row.kind).toBe(ORIGINAL_KIND);
      expect(row.payload.v).toBe(1);
    });

    it("silently drops a DELETE of an event (row still present)", async () => {
      await rest("DELETE", `/rest/v1/events?id=eq.${eventId}`);
      const check = await rest(
        "GET",
        `/rest/v1/events?id=eq.${eventId}&select=id`
      );
      expect((check.data as Array<{ id: string }>).length).toBe(1);
    });

    it("silently drops an UPDATE to a signal (row unchanged)", async () => {
      await rest("PATCH", `/rest/v1/signals?id=eq.${signalId}`, {
        kind: `${runTag}.TAMPERED`,
      });
      const check = await rest(
        "GET",
        `/rest/v1/signals?id=eq.${signalId}&select=kind`
      );
      expect((check.data as Array<{ kind: string }>)[0]!.kind).toBe(ORIGINAL_KIND);
    });

    it("silently drops a DELETE of a signal (row still present)", async () => {
      await rest("DELETE", `/rest/v1/signals?id=eq.${signalId}`);
      const check = await rest(
        "GET",
        `/rest/v1/signals?id=eq.${signalId}&select=id`
      );
      expect((check.data as Array<{ id: string }>).length).toBe(1);
    });

    it("silently drops a DELETE of a problem (row still present) — validates 0108", async () => {
      // problems is the chain's centre; before 0108 it had NO no_delete rule, so
      // a member could delete a problem and CASCADE-wipe its resolutions (past
      // resolutions_no_delete/0094). This asserts problems_no_delete makes the
      // delete a no-op. Requires 0108 applied; a 🔴 failure here means the §3.1
      // chain's centre is still deletable in this environment. (No UPDATE case:
      // problems are legitimately mutable via status transitions.)
      await rest("DELETE", `/rest/v1/problems?id=eq.${problemId}`);
      const check = await rest(
        "GET",
        `/rest/v1/problems?id=eq.${problemId}&select=id`
      );
      expect((check.data as Array<{ id: string }>).length).toBe(1);
    });

    it("silently drops a DELETE of the company_brain singleton — validates 0108", async () => {
      // company_brain (the per-company learned model) auto-exists — a trigger on
      // company insert seeds it (0007:70). 0108 added company_brain_no_delete so a
      // member can't wipe the whole learned model; record_brain_learning is the
      // only sanctioned mutate path. Assert a direct delete is a no-op. (The rule
      // blocks DIRECT deletes only; the ON DELETE CASCADE from companies at
      // teardown is unaffected, which is correct.)
      await rest("DELETE", `/rest/v1/company_brain?company_id=eq.${companyId}`);
      const check = await rest(
        "GET",
        `/rest/v1/company_brain?company_id=eq.${companyId}&select=company_id`
      );
      expect((check.data as Array<{ company_id: string }>).length).toBe(1);
    });
  }
);
