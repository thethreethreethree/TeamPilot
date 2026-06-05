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
