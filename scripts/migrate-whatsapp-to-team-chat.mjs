#!/usr/bin/env node
//
// scripts/migrate-whatsapp-to-team-chat.mjs
//
// One-time migration: brings the team's WhatsApp chat history into a
// real chat_topic in ELOSTATE. The user explicitly opted for verbatim
// import (per §3.1 data-as-asset — the record is the source of truth;
// redacting the chat at import time would alter the historical record).
//
// Idempotency
// ───────────
// Inserts a SYSTEM marker message at the start of the migration. On
// re-run, if the marker is found in the target topic, the script
// aborts cleanly. chat_messages are NO_DELETE per §3.1, so a re-run
// that double-inserted would be impossible to undo from application
// code. The marker is the structural defense.
//
// What it does
// ────────────
//   1. Parses CHAT MIGRATION DATA.txt — WhatsApp format:
//      `[HH:MM, M/D/YYYY] Author: message body`
//      Continuation lines (no timestamp prefix) are folded into the
//      previous message's body.
//
//   2. Maps display names to ELOSTATE auth user IDs:
//      - "Moses Maniquiz"  → MOSES   (7da30c76-…)
//      - "Myke" / "Mike"   → MICHAEL (aede2a44-…)
//      - "John"            → JOHNS   (940ef40b-…)
//
//   3. Parses timestamps as Pacific Time (the user has been operating
//      from California per the chat content). 4/25 – 6/12/2026 is all
//      PDT (UTC-7).
//
//   4. Looks up or creates the "Development LAB" chat_topic in the
//      ELOSTATE company. Adds the three authors as participants if
//      they aren't already.
//
//   5. Posts a kind='system' marker:
//      "WhatsApp chat migrated — N messages from M/D/YYYY through M/D/YYYY"
//
//   6. Inserts every parsed message verbatim with the original
//      created_at preserved. The chat_messages_emit_events trigger
//      (0012) automatically fires chat.message_posted on each insert.
//
// Usage
// ─────
//   node scripts/migrate-whatsapp-to-team-chat.mjs
//
// Exits non-zero on any error; logs the count of inserted messages
// and the topic id on success.

import { readFileSync } from "node:fs";

// ─── Env ─────────────────────────────────────────────────────────

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
  console.error("✗ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

// ─── Constants ───────────────────────────────────────────────────

const SOURCE_PATH = "C:\\Users\\johns\\OneDrive\\Desktop\\CHAT MIGRATION DATA.txt";
const COMPANY_ID = "c3e7f389-3df6-48c8-876b-0cd4baf5c2a7"; // ELOSTATE
const TOPIC_TITLE = "Development LAB";
const TOPIC_DESCRIPTION =
  "Migrated WhatsApp business-discussion thread (Moses, Mike, John). " +
  "Verbatim import; original WhatsApp export remains the source of record.";

const JOHNS = "940ef40b-aae6-495d-9d66-93d037c41b7b";
const MOSES = "7da30c76-6e9f-4cb1-9d55-7b20cbd5bb14";
const MICHAEL = "aede2a44-2439-49c2-841c-91e58bc33f22";

const AUTHOR_MAP = new Map([
  ["moses maniquiz", MOSES],
  ["moses", MOSES],
  ["myke", MICHAEL],
  ["mike", MICHAEL],
  ["michael", MICHAEL],
  ["john", JOHNS],
  ["johns", JOHNS],
]);

// Pacific Daylight Time offset for the chat date range (4/25 – 6/12/2026).
// All dates are between DST start (March 8 2026) and DST end (Nov 1 2026),
// so PDT = UTC-7 applies uniformly.
const PT_OFFSET_HOURS = -7;

// ─── HTTP helper ────────────────────────────────────────────────

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

// ─── Parser ──────────────────────────────────────────────────────

const TIMESTAMP_RE = /^\[(\d{1,2}):(\d{2}), (\d+)\/(\d+)\/(\d{4})\] ([^:]+?): (.*)$/;

function parseTimestamp(h, mi, mo, d, y) {
  // WhatsApp export is local device time; we interpret as PDT (UTC-7).
  // Construct as if UTC, then subtract the PT offset to get the right
  // UTC moment.
  //
  // Example: "18:24, 4/25/2026" PDT = 2026-04-26T01:24Z.
  const base = Date.UTC(
    Number(y),
    Number(mo) - 1,
    Number(d),
    Number(h),
    Number(mi),
    0
  );
  return new Date(base - PT_OFFSET_HOURS * 60 * 60 * 1000).toISOString();
}

function resolveAuthor(name) {
  const key = name.trim().toLowerCase();
  const id = AUTHOR_MAP.get(key);
  if (!id) {
    throw new Error(`Unknown author "${name}" — extend AUTHOR_MAP.`);
  }
  return id;
}

function parseChat(text) {
  const lines = text.split(/\r?\n/);
  const messages = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(TIMESTAMP_RE);
    if (m) {
      if (current) messages.push(current);
      const [, h, mi, mo, d, y, author, body] = m;
      current = {
        author_id: resolveAuthor(author),
        author_display: author.trim(),
        body: body,
        created_at: parseTimestamp(h, mi, mo, d, y),
        original_date: `${mo}/${d}/${y}`,
      };
    } else {
      // Continuation line — append to the previous message's body,
      // preserving the newline so multi-paragraph messages keep shape.
      if (current) {
        current.body = current.body + "\n" + line;
      }
      // Lines before the first timestamp (rare) are dropped silently.
    }
  }
  if (current) messages.push(current);
  // Strip trailing blank-only lines from each body.
  for (const m of messages) m.body = m.body.replace(/\s+$/, "");
  return messages;
}

// ─── Main ────────────────────────────────────────────────────────

(async () => {
  console.log("▸ Reading source file…");
  const text = readFileSync(SOURCE_PATH, "utf8");
  const messages = parseChat(text);
  console.log(`  parsed ${messages.length} messages`);
  if (messages.length === 0) {
    console.error("✗ No messages parsed. Check timestamp regex.");
    process.exit(1);
  }
  const firstDate = messages[0].original_date;
  const lastDate = messages[messages.length - 1].original_date;
  const authorsSeen = Array.from(
    new Set(messages.map((m) => m.author_display))
  ).join(", ");
  console.log(`  range: ${firstDate} – ${lastDate}`);
  console.log(`  authors seen: ${authorsSeen}`);

  console.log("▸ Looking up Development LAB topic…");
  const existing = await rest(
    `/rest/v1/chat_topics?company_id=eq.${COMPANY_ID}&title=eq.${encodeURIComponent(
      TOPIC_TITLE
    )}&select=id,status`
  );

  let topicId;
  if (existing.length > 0) {
    topicId = existing[0].id;
    console.log(`  found existing topic ${topicId} (status: ${existing[0].status})`);
    // Idempotency guard — refuse to re-migrate if the marker exists.
    const markers = await rest(
      `/rest/v1/chat_messages?topic_id=eq.${topicId}&kind=eq.system&body=ilike.%25WhatsApp%20chat%20migrated%25&select=id`
    );
    if (markers.length > 0) {
      console.error(
        "✗ Migration marker already present — refusing to double-insert."
      );
      console.error(
        "  If you need to re-migrate, manually delete the marker + migrated"
      );
      console.error(
        "  rows in Supabase (chat_messages append-only rules require"
      );
      console.error(
        "  service-role override). Then re-run."
      );
      process.exit(1);
    }
  } else {
    console.log("  not found — creating…");
    const created = await rest("/rest/v1/chat_topics", {
      method: "POST",
      body: JSON.stringify({
        company_id: COMPANY_ID,
        title: TOPIC_TITLE,
        description: TOPIC_DESCRIPTION,
        status: "open",
        tags: ["migration", "whatsapp", "business"],
        created_by: JOHNS,
        coach_enabled: false,
      }),
    });
    topicId = created[0].id;
    console.log(`  created topic ${topicId}`);
  }

  console.log("▸ Ensuring participants…");
  await rest("/rest/v1/chat_participants", {
    method: "POST",
    headers: { Prefer: "resolution=ignore-duplicates" },
    body: JSON.stringify([
      { topic_id: topicId, user_id: JOHNS, role: "admin" },
      { topic_id: topicId, user_id: MOSES, role: "member" },
      { topic_id: topicId, user_id: MICHAEL, role: "member" },
    ]),
  });

  console.log("▸ Posting migration marker (system message)…");
  await rest("/rest/v1/chat_messages", {
    method: "POST",
    body: JSON.stringify({
      topic_id: topicId,
      company_id: COMPANY_ID,
      author_id: JOHNS,
      kind: "system",
      body:
        `WhatsApp chat migrated — ${messages.length} messages from ` +
        `${firstDate} through ${lastDate}. Timestamps interpreted as Pacific Time. ` +
        `Verbatim import; the original WhatsApp export remains the source of record.`,
      // Timestamp the marker slightly BEFORE the earliest migrated
      // message so it visually anchors the top of the thread.
      created_at: new Date(
        new Date(messages[0].created_at).getTime() - 60_000
      ).toISOString(),
    }),
  });

  console.log("▸ Inserting messages…");
  // Batch inserts in chunks of 50 to stay friendly with PostgREST.
  const CHUNK = 50;
  let inserted = 0;
  for (let i = 0; i < messages.length; i += CHUNK) {
    const slice = messages.slice(i, i + CHUNK);
    const rows = slice.map((m) => ({
      topic_id: topicId,
      company_id: COMPANY_ID,
      author_id: m.author_id,
      kind: "message",
      body: m.body,
      created_at: m.created_at,
    }));
    await rest("/rest/v1/chat_messages", {
      method: "POST",
      body: JSON.stringify(rows),
    });
    inserted += slice.length;
    process.stdout.write(`  ${inserted}/${messages.length}\r`);
  }
  process.stdout.write("\n");

  console.log("\n✓ Migration complete.");
  console.log(`  Topic id: ${topicId}`);
  console.log(`  Messages inserted: ${inserted}`);
  console.log(`  Open: /dashboard/chats/${topicId}`);
})().catch((err) => {
  console.error("\n✗ Failed:", err.message);
  if (err.stack) console.error(err.stack);
  process.exit(1);
});
