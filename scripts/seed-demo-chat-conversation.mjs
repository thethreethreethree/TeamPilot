#!/usr/bin/env node
//
// scripts/seed-demo-chat-conversation.mjs
//
// One-off: insert a realistic team-chat conversation so the user can
// demo Coach (mirror chips), "Guide my response," and "Help me
// formulate" against a thread that has actual context.
//
// What lands:
//   - One new chat_topic titled "DEMO — payments outage postmortem"
//     in the ELOSTATE company.
//   - chat_participants rows for Johns, Moses, Michael (all admins).
//   - 9 chat_messages — Johns kicking off, Moses + Michael in a real
//     disagreement, Johns mediating. The thread is left OPEN so the
//     demo user can post a follow-up to demo the composer tools.
//   - 4 `coach.pattern_observed` events on the chain matching the
//     patterns planted in messages 5–8, attributed to the right
//     actor (so the §4 readout aggregates correctly even though
//     these messages were inserted server-side rather than through
//     the client observePatterns helper).
//
// Idempotent: re-running first deletes the demo topic (and its
// cascade) so the seed is fresh. The `_no_delete` rule applies to
// chat_messages but NOT to chat_topics, so deleting the topic
// triggers a clean cascade through participants + messages. Coach
// pattern_observed events stay on the chain — they're §3.1 record
// and append-only; the new run inserts fresh ones.

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPA_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SUPA_KEY) {
  console.error("Missing SUPABASE env vars.");
  process.exit(1);
}

const COMPANY_ID = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7"; // ELOSTATE
const JOHNS = "940ef40b-aae6-495d-9d66-93d037c41b7b";
const MOSES = "7da30c76-6e9f-4cb1-9d55-7b20cbd5bb14";
const MICHAEL = "aede2a44-2439-49c2-841c-91e58bc33f22";

const headers = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function rest(path, init = {}) {
  const res = await fetch(`${SUPA_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init.headers ?? {}) },
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  if (!res.ok) {
    throw new Error(
      `${init.method ?? "GET"} ${path} → ${res.status} ${JSON.stringify(body)}`
    );
  }
  return body;
}

// Time spread — start "1 hour ago," messages every 1–3 minutes.
const start = new Date(Date.now() - 60 * 60 * 1000);
const at = (minutes) => new Date(start.getTime() + minutes * 60 * 1000).toISOString();

const messages = [
  {
    author: JOHNS,
    at: at(0),
    body:
      "Last night the payment service had a 47-minute outage starting at 11:32pm. The retry storm started right after the 11:15 deploy. I want to walk through what happened and align on a response before standup tomorrow.",
  },
  {
    author: MOSES,
    at: at(2),
    body:
      "I caught the pager. The new client doesn't handle the connection timeout the way the old one did — it retries too aggressively when the gateway is slow.",
  },
  {
    author: MICHAEL,
    at: at(3),
    body:
      "Yeah, I pushed that change. Integration tests passed but staging doesn't see the same retry load profile as prod, so the timeout behavior didn't fail under test.",
  },
  {
    author: JOHNS,
    at: at(5),
    body:
      "Got it. So we have three signals: the deploy as the trigger, the timeout behavior as the proximate cause, and the staging/prod fidelity gap as the missing safeguard. What's the right response shape?",
  },
  {
    author: MOSES,
    at: at(7),
    body:
      "We should add a load-test gate to every payment-service deploy. This would have caught the retry behavior before it went out.",
    // Coach pattern: Voss bare-assertion ("We should" at start)
    patterns: [
      {
        heuristic_id: "voss-bare-assertion",
        trigger_excerpt: "We should add",
      },
    ],
  },
  {
    author: MICHAEL,
    at: at(8),
    body:
      "I want to push back on that. Load testing every deploy adds 15+ minutes of cycle time. This is broken thinking — we'd be slowing down every release for a rare event.",
    // Coach pattern: NVC evaluation ("This is broken")
    patterns: [
      {
        heuristic_id: "nvc-evaluation",
        trigger_excerpt: "This is broken",
      },
    ],
  },
  {
    author: MOSES,
    at: at(10),
    body:
      "It's not rare. We've had three production issues this quarter from staging-prod gaps. They always treat it like a one-off and never invest in the structural fix.",
    // Coach pattern: NVC evaluation (absolutes "always" + "never")
    patterns: [
      {
        heuristic_id: "nvc-evaluation",
        trigger_excerpt: "always",
      },
    ],
  },
  {
    author: MICHAEL,
    at: at(11),
    body:
      "They don't get it — three issues out of forty deploys is well within acceptable. The cost of slowing down every release is bigger than the cost of the rare miss.",
    // Coach pattern: NVC evaluation (mind-reading "they don't get it")
    patterns: [
      {
        heuristic_id: "nvc-evaluation",
        trigger_excerpt: "They don't get it",
      },
    ],
  },
  {
    author: JOHNS,
    at: at(13),
    body:
      "Let me see if I can name the disagreement. Moses, your read is that the staging/prod gap is a recurring root cause that justifies a structural fix. Michael, your read is that the incident rate is acceptable and adding gate-friction is the wrong tradeoff. Am I capturing the actual disagreement?",
  },
];

(async () => {
  console.log("▸ Cleaning any prior demo topic…");
  const existing = await rest(
    `/rest/v1/chat_topics?company_id=eq.${COMPANY_ID}&title=eq.${encodeURIComponent(
      "DEMO — payments outage postmortem"
    )}&select=id`
  );
  if (existing.length > 0) {
    for (const row of existing) {
      // chat_topics doesn't carry the §3.1 no_delete rule; delete cascades
      // chat_participants and chat_messages. Coach pattern_observed events
      // are append-only and stay on the chain — that's fine, they remain
      // attributed to the now-deleted topic id (cosmetic only).
      await rest(`/rest/v1/chat_topics?id=eq.${row.id}`, { method: "DELETE" });
      console.log(`  removed prior demo topic ${row.id}`);
    }
  }

  console.log("▸ Creating the demo topic…");
  const created = await rest("/rest/v1/chat_topics", {
    method: "POST",
    body: JSON.stringify({
      company_id: COMPANY_ID,
      title: "DEMO — payments outage postmortem",
      description:
        "Throwaway thread for demoing Coach mirror chips, Guide my response, and Help me formulate. Real-feeling disagreement between Moses and Michael with Johns mediating; open for a follow-up.",
      status: "open",
      tags: ["demo", "incident", "payments"],
      created_by: JOHNS,
      coach_enabled: true,
    }),
  });
  const topic = created[0];
  console.log(`  topic id: ${topic.id}`);

  console.log("▸ Adding participants…");
  await rest("/rest/v1/chat_participants", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify([
      { topic_id: topic.id, user_id: JOHNS, role: "admin" },
      { topic_id: topic.id, user_id: MOSES, role: "member" },
      { topic_id: topic.id, user_id: MICHAEL, role: "member" },
    ]),
  });

  console.log("▸ Posting messages…");
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    await rest("/rest/v1/chat_messages", {
      method: "POST",
      body: JSON.stringify({
        topic_id: topic.id,
        company_id: COMPANY_ID,
        author_id: m.author,
        kind: "message",
        body: m.body,
        created_at: m.at,
      }),
    });
    process.stdout.write(`  ${i + 1}/${messages.length}\r`);
  }
  process.stdout.write("\n");

  console.log("▸ Recording coach.pattern_observed events for §4 readout…");
  const patternEvents = messages
    .filter((m) => m.patterns)
    .flatMap((m) =>
      m.patterns.map((p) => ({
        company_id: COMPANY_ID,
        actor: m.author,
        kind: "coach.pattern_observed",
        subject: `chat_topic:${topic.id}`,
        payload: {
          heuristic_id: p.heuristic_id,
          trigger_excerpt: p.trigger_excerpt,
          body_excerpt: m.body.slice(0, 280),
        },
        occurred_at: m.at,
      }))
    );
  if (patternEvents.length > 0) {
    await rest("/rest/v1/events", {
      method: "POST",
      body: JSON.stringify(patternEvents),
    });
    console.log(`  inserted ${patternEvents.length} pattern_observed events`);
  }

  console.log("\n✓ Demo conversation seeded.");
  console.log(`  Open: /dashboard/chats/${topic.id}`);
})().catch((err) => {
  console.error("\n✗ Failed:", err.message);
  process.exit(1);
});
