#!/usr/bin/env node
//
// Smoke test patch: add structural-priority flags + Task Spawn Engine items.
//
// Two jobs in one pass (idempotent):
//   1. Tag a curated set of existing items with `structural: true`.
//      The UI renders the anvil chip on these so testers can scan
//      which failures propagate up the layer stack (§1.7).
//   2. Append the Task Spawn Engine v1 verification items so partners
//      can stress-test the Decision→Task and Chat→Task entry points
//      and the shared refinement panel.
//
// Idempotent — safe to re-run. If an item already exists by id it
// gets its fields merged (structural added; existing fields
// preserved). New items are inserted at the end.

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
const VERSION_ID = "2217a2e4-40d6-43fe-b3b7-02db98dbeff4";

if (!SUPA_URL || !SUPA_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const headers = {
  apikey: SUPA_KEY,
  Authorization: `Bearer ${SUPA_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

// ─── Structural-priority item IDs ──────────────────────────────────
// These verify load-bearing constitutional architecture:
//   - Chain integrity (§3.1 events / signals / problems / resolutions)
//   - Understanding Gate (§3.2 — the structural interrupt)
//   - Guide-don't-overtake (§3.3 — System never asserts before user
//     states their read)
//   - Append-only / immutability invariants
//   - IP / sensitive-doc protection (the moat itself)
//   - Spawn lineage (the §1.6 close-the-loop chain)
const STRUCTURAL_IDS = new Set([
  // Decision Dialogue — the constitutional shape of §3.2 + §3.3
  "decision-dialogue-four-phase",
  "in-thread-decision-elicit-requires-both",
  "in-thread-decision-system-responds",
  "in-thread-decision-decide-records",
  "in-thread-decision-chain-events",

  // Chain integrity — §3.1 events landing append-only
  "coach-events-on-chain",
  "mention-event-on-chain",
  "feedback-submit-emits-event",
  "team-check-nudge-fires-chain-event",

  // Scope enforcement — notifications must NOT leak across topics
  "notif-decision-not-self",
  "notif-decision-not-outside-topic",
  "notif-task-participant-self-add-suppressed",

  // IP / moat protection — the sensitive-docs surface
  "ip-no-claude-md-visible",
  "ip-constitution-badge",

  // Coach priority logic — A18 visibility / sender-vs-leader contract
  "coach-priority-identity-wins",

  // RLS + migration health — the foundation under everything else
  "maint-rls-audit",
  "maint-migrations-applied",
]);

// ─── New Task Spawn Engine v1 items (all structural — close §1.6) ──
const NEW_SPAWN_ITEMS = [
  {
    id: "spawn-decision-button-after-persist",
    title: "Spawn task button appears only after a decision is persisted",
    instructions:
      "Walk a Decision Dialogue end-to-end on /dashboard/decisions. Pick any path EXCEPT 'Defer'. Click 'Persist dialogue'.",
    expected:
      "After the persist toast lands, a new 'Spawn task from this decision' button appears next to 'Start a new dialogue'. It is NOT shown before persist (no decisionId yet) and NOT shown when the chosen path is 'Defer' (defers are honest no-action; spawning would contradict the recorded intent).",
    assignee: "partners",
    structural: true,
  },
  {
    id: "spawn-decision-opens-refinement-panel",
    title: "Spawn from decision opens the refinement panel with pre-loaded context",
    instructions:
      "After persisting, click 'Spawn task from this decision'. Wait for the LLM to return.",
    expected:
      "Modal opens with 'Reading the context and drafting a plan…' state, then shows three editable fields: Title (one-line, action-oriented), Description (1-3 short paragraphs), and 3-7 ordered Steps. The draft matches the decision's intent — it does NOT invent new objectives.",
    assignee: "partners",
    structural: true,
  },
  {
    id: "spawn-chat-button-admin-only",
    title: "'Spawn task' header button is admin-only on chat topics",
    instructions:
      "Open a topic where you are an admin and the topic is OPEN. Then open one where you are NOT an admin or a topic that is CLOSED.",
    expected:
      "Admin/open view: arc-cyan 'Spawn task' button visible in the topic header. Non-admin or closed-topic view: button hidden entirely. The §3.3 room-leadership contract is enforced — only admins can flip the room into spawn-select mode.",
    assignee: "partners",
    structural: true,
  },
  {
    id: "spawn-chat-message-selection",
    title: "Spawn-select mode lets the admin tap messages to include",
    instructions:
      "Click 'Spawn task' as an admin. Tap a few messages in the thread.",
    expected:
      "Each tapped message gets a ring + check-dot indicator on the left. Tapping again deselects. A floating pill at the bottom shows the selection count, a Cancel button, and a 'Spawn task' button (disabled at 0 selections, enabled at ≥1). Tapping Reply/Pin/jump-quote buttons inside a message does NOT toggle selection.",
    assignee: "partners",
    structural: true,
  },
  {
    id: "spawn-chat-context-payload",
    title: "Spawn from chat includes selected messages AND surrounding context",
    instructions:
      "In spawn-select mode, pick 1-2 messages in the middle of a thread that has at least 5 messages before and after. Press 'Spawn task'.",
    expected:
      "The generated task reflects the selected messages as the FOCUS but understands the surrounding conversation reality (e.g. references the person being discussed, the constraint already mentioned a few messages earlier). The §1.5 holistic discipline is intact — selection is the focus, surrounding is the reality.",
    assignee: "partners",
    structural: true,
  },
  {
    id: "spawn-refine-iterates-baseline",
    title: "Refine prompt iterates on the existing draft, not from scratch",
    instructions:
      "In the refinement panel, scroll to 'Adjust the draft'. Type something specific like 'cut the communication step, the team already knows' or 'make the title shorter and focused on the technical work'. Click 'Refine'.",
    expected:
      "The next draft preserves the unaffected fields/steps and applies the adjustment minimally. The title, description, and unaffected steps stay close to the prior baseline. The adjustment prompt clears after a successful refine.",
    assignee: "partners",
    structural: true,
  },
  {
    id: "spawn-save-creates-linked-task",
    title: "Save persists with linked_decision_id OR linked_chat_topic_id",
    instructions:
      "(JOHN) After saving a task from a decision and another from a chat, query Supabase: select id, title, linked_decision_id, linked_chat_topic_id, linked_message_ids, spawn_steps from tasks order by created_at desc limit 5.",
    expected:
      "The decision-sourced task has linked_decision_id set, linked_chat_topic_id null. The chat-sourced task has linked_chat_topic_id set, linked_decision_id null (the tasks_spawn_source_xor constraint guarantees mutual exclusion), linked_message_ids = the array of selected uuids, spawn_steps = jsonb array of the step strings.",
    assignee: "john",
    structural: true,
  },
  {
    id: "spawn-inline-editing-survives-save",
    title: "Inline edits to title / description / steps land in the saved task",
    instructions:
      "Open the refinement panel. Manually edit the title to something distinctive (e.g. 'TEST-EDIT-001'). Add a step at the bottom. Remove a step in the middle. Click 'Save task'. Then go to /dashboard/operations and find the task.",
    expected:
      "The saved task shows the manually edited title (TEST-EDIT-001), and the description ends with a 'Steps:' block reflecting the final ordered set (added step present, removed step absent). The §1.5 graft-in-context discipline holds — the LLM produces structure, the user shapes it.",
    assignee: "partners",
    structural: true,
  },
  {
    id: "spawn-rate-limit-12-per-minute",
    title: "Spawn engine rate-limits at 12/min/user",
    instructions:
      "(JOHN) Hit /api/tasks/spawn 13+ times in under a minute (curl loop or DevTools network).",
    expected:
      "First 12 requests succeed (or return a legitimate engine response). The 13th returns HTTP 429 with an error message about rate limiting. This is the iteration-loop guard so a runaway refinement doesn't chew through tokens.",
    assignee: "john",
    structural: true,
  },

  // ─── Cross-conversation memory for Coach v5 ────────────────────
  {
    id: "coach-memory-event-emitted",
    title: "coach.analyze_returned events land on the §3.1 chain",
    instructions:
      "(JOHN) Trigger several Ask Coach / auto-Coach analyses across different topics. Query Supabase: select kind, subject, payload->>'classification', payload->>'principle', created_at from events where kind = 'coach.analyze_returned' order by created_at desc limit 10.",
    expected:
      "One row per analyze call, actor = the user who ran Coach. Payload includes classification, needs_improvement, principle (when needsImprovement was true), book, section_ref, context_type, had_memory_block, memory_pattern_count. These rows are the new memory substrate.",
    assignee: "john",
    structural: true,
  },
  {
    id: "coach-memory-injected-into-prompt",
    title: "Memory block appears in the prompt once the user has 3+ analyses",
    instructions:
      "(JOHN) After ≥3 coach.analyze_returned events exist for your user in the last 30 days, run a fresh Ask Coach. Tail the dev server logs OR inspect the prompt build by adding a temporary log of systemPrompt.length before-vs-after at the route.",
    expected:
      "The system prompt is longer than baseline by ~300-800 chars when memory exists. The injected block starts with 'USER PATTERN HISTORY (last 30 days …)' and lists recurring patterns + grade mix. With <3 analyses, the block is null and the prompt is unchanged — sparse data correctly stays silent.",
    assignee: "john",
    structural: true,
  },
  {
    id: "coach-memory-references-prior-coachings",
    title: "Coach names recurring patterns when they recur in a new draft",
    instructions:
      "After being coached on the same principle 3+ times (e.g. 'evaluation-not-observation' triggered repeatedly), draft another message that hits the same pattern in a different topic. Click Ask Coach.",
    expected:
      "The Coach's response acknowledges the recurrence — it does NOT pretend this is the first time. Example phrasing: 'This is the third time we've landed here…' or 'I notice this pattern keeps coming up under deadlines.' It does NOT reveal raw counts (no '7 times in 14 days' surveillance language).",
    assignee: "partners",
    structural: true,
  },
];

// ─── Run the patch ────────────────────────────────────────────────
console.log(`Fetching current version ${VERSION_ID}…`);
const cur = await fetch(
  `${SUPA_URL}/rest/v1/smoke_test_versions?id=eq.${VERSION_ID}&select=id,label,items`,
  { headers }
);
if (!cur.ok) {
  console.error("Fetch failed:", cur.status, await cur.text());
  process.exit(1);
}
const [row] = await cur.json();
if (!row) {
  console.error(`No version found with id ${VERSION_ID}`);
  process.exit(1);
}

const existing = row.items ?? [];
const existingIds = new Set(existing.map((i) => i.id));

// Tag structural on existing items
let taggedCount = 0;
const tagged = existing.map((item) => {
  if (STRUCTURAL_IDS.has(item.id) && !item.structural) {
    taggedCount += 1;
    return { ...item, structural: true };
  }
  return item;
});

// Append spawn items that aren't already there
const appended = [...tagged];
let addedCount = 0;
for (const newItem of NEW_SPAWN_ITEMS) {
  if (!existingIds.has(newItem.id)) {
    appended.push(newItem);
    addedCount += 1;
  } else {
    // If somehow already present, merge the structural flag at least
    const idx = appended.findIndex((i) => i.id === newItem.id);
    if (idx >= 0 && !appended[idx].structural) {
      appended[idx] = { ...appended[idx], structural: true };
      taggedCount += 1;
    }
  }
}

const structuralTotal = appended.filter((i) => i.structural).length;

console.log(
  `Tagged ${taggedCount} existing items as structural · appended ${addedCount} new spawn items · ${structuralTotal} structural total / ${appended.length} items total`
);

const patch = await fetch(
  `${SUPA_URL}/rest/v1/smoke_test_versions?id=eq.${VERSION_ID}`,
  {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      label: `Comprehensive verification — Task Spawn Engine v1 + structural anvil`,
      items: appended,
    }),
  }
);

if (!patch.ok) {
  console.error("PATCH failed:", patch.status, await patch.text());
  process.exit(1);
}

const [updated] = await patch.json();
console.log(`✓ Updated version ${VERSION_ID}: ${updated.items.length} items.`);
