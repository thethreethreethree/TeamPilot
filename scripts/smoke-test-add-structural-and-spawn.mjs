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

  // ─── §3.4 month-cycle automation (migration 0031) ──────────────
  {
    id: "cycle-banner-shows-phase",
    title: "Settings shows the §3.4 cycle phase + day count",
    instructions:
      "As admin, open /dashboard/settings and find the Conversational Coach panel.",
    expected:
      "A phase banner is present with Hourglass icon: 'Month 1 — Control' (arc-cyan) OR 'Month 2 — Single-variable intervention' (emerald) OR 'Post-checkpoint — Compounding'. Banner shows day N of 30/60 and days remaining. Copy explains WHY (honest baseline, single-variable intervention).",
    assignee: "partners",
    structural: true,
  },
  {
    id: "cycle-coach-locked-in-control",
    title: "Coach toggle is locked OFF during Month 1 control",
    instructions:
      "On a company whose cycle_started_at is within the last 30 days AND cycle_control_skipped_at is null, view the Coach toggle.",
    expected:
      "The 'Turn on' button is disabled (opacity 40%) with a tooltip 'Locked during §3.4 control — N days remaining'. Clicking it does NOT round-trip; a toast surfaces immediately explaining §3.4. Even if a service-role caller tries directly, the DB trigger raises P0001 with the §3.4 message.",
    assignee: "partners",
    structural: true,
  },
  {
    id: "cycle-db-trigger-blocks-update",
    title: "DB trigger blocks coach_enabled=true during control",
    instructions:
      "(JOHN) In Supabase SQL editor, run: update companies set coach_enabled = true where id = '<company-in-control>';",
    expected:
      "Returns a P0001 error with the §3.4 control window message. The row stays coach_enabled = false. The trigger is the structural defense — §5 'builder under pressure' can't compromise the measurement even with direct DB access.",
    assignee: "john",
    structural: true,
  },
  {
    id: "cycle-skip-override-records",
    title: "Skip-control override leaves a permanent on-record mark",
    instructions:
      "On a company in control, click 'Override (records a permanent skip mark)' in the cycle banner. Enter a ≥20-char reason. Click 'Record skip'.",
    expected:
      "Toast 'Control window skipped'. The banner re-renders showing the new 'intervention' phase with a 'skipped control' chip. cycle_control_skipped_at, cycle_control_skipped_by, cycle_control_skip_reason all populated on the row. A coach.control_skipped event lands on the §3.1 chain with the reason in the payload. The skip is NEVER cleared on the row (§3.1 immutability).",
    assignee: "partners",
    structural: true,
  },
  {
    id: "cycle-phase-attribution-on-toggles",
    title: "coach.enabled / coach.disabled events carry the current cycle phase",
    instructions:
      "(JOHN) After flipping the coach company-wide toggle (intervention phase or post-skip), query: select kind, payload from events where kind in ('coach.enabled', 'coach.disabled') order by created_at desc limit 3.",
    expected:
      "Payload includes cycle_phase: 'intervention' (or 'ongoing'). This is what the §4 readout reads to attribute every Coach-on/off window to the right phase honestly.",
    assignee: "john",
    structural: true,
  },

  // ─── §3.5 consolidated readout extension ──────────────────────
  {
    id: "readout-cycle-banner-frames-page",
    title: "Coach readout opens with the §3.4 cycle banner",
    instructions:
      "As admin, open /dashboard/admin/coach-readout.",
    expected:
      "The cycle banner is the FIRST block under the discipline preamble. It names the phase (Month 1/2/post-checkpoint), day count, and either 'Coach is locked OFF' messaging or 'single-variable intervention' or 'compounding'. If the company has skipped control, a 'skipped control' chip + the reason on record appears below.",
    assignee: "partners",
    structural: true,
  },
  {
    id: "readout-spawn-lineage-table",
    title: "Readout shows tasks split by spawn source",
    instructions:
      "On the readout, scroll to 'Task Spawn lineage'. After spawning a few tasks from decisions, chats, and creating one directly, refresh.",
    expected:
      "Table shows three rows — 'From Decision Dialogue', 'From chat messages', 'Direct-created' — each with total, completed, completion rate. The §1.6 mechanism question (does structured upstream produce better action?) is now readable.",
    assignee: "partners",
    structural: true,
  },
  {
    id: "readout-grade-baseline-mix",
    title: "Communication baseline shows productive / neutral / needs-guidance",
    instructions:
      "On the readout, scroll to 'Communication baseline (last 30 days)'.",
    expected:
      "Three colored cards (emerald productive / muted neutral / amber needs-guidance) each showing percentage + raw count. The n = X graded messages caption is present. If n = 0, an honest empty state explains why (chain hasn't accumulated yet, or cycle in control).",
    assignee: "partners",
    structural: true,
  },
  {
    id: "readout-top-principles-from-analyze",
    title: "Top principles table reads coach.analyze_returned events",
    instructions:
      "After several Ask Coach / auto-Coach analyses across surfaces, open the readout and scroll to 'Top principles cited'.",
    expected:
      "Table lists up to 8 principles by frequency (e.g. 'OFNR Model — Nonviolent Communication', 'Contrasting Statement — Crucial Conversations'). Each row shows total cited count and the 'of which: needs-improvement' subcount. The n = X caption is present.",
    assignee: "partners",
    structural: true,
  },
  {
    id: "readout-no-verdict-anywhere",
    title: "Readout deliberately presents NO verdict — only raw counts",
    instructions:
      "Read every section of /dashboard/admin/coach-readout. Look for any UI element that asserts 'Coach is working' or 'this feature is succeeding' or a green checkmark next to an outcome.",
    expected:
      "Zero verdicts surfaced. The page shows raw counts, side-by-side comparisons, low-N caveats, and cycle context — but never claims the Coach is working. §3.5 + asset A3: measuring agreement vs measuring consequence requires the reader to interpret.",
    assignee: "partners",
    structural: true,
  },

  // ─── Multi-tenant isolation (State A pilot-readiness) ────────
  {
    id: "tenant-topics-cross-company-block",
    title: "Topics from another company are unreachable",
    instructions:
      "(JOHN) On a test setup with two companies (A and B), sign in as a member of A. Try to fetch /api/chats/list and inspect for any topic_id belonging to company B. Also try GET /dashboard/chats/<id-of-B-topic> directly via URL.",
    expected:
      "Company A's listing contains zero rows from company B. Direct navigation to B's topic id returns 'Topic not found' (RLS filters the row from chat_topics SELECT). No row leakage; the company isolation is enforced at the database, not the UI.",
    assignee: "john",
    structural: true,
  },
  {
    id: "tenant-tasks-cross-company-block",
    title: "Tasks from another company are unreachable",
    instructions:
      "(JOHN) Same two-company setup. From company A's session, query SELECT * FROM tasks via the Supabase SQL editor (with the user's JWT, NOT service role). Verify only company A's tasks return.",
    expected:
      "Query returns 0 rows from company B. RLS on tasks scopes by company_id via auth_company_id(). Same for task_steps, task_messages, task_participants — every table tied to tasks should isolate cleanly.",
    assignee: "john",
    structural: true,
  },
  {
    id: "tenant-rls-helper-is-topic-admin",
    title: "is_topic_admin() correctly scopes to company",
    instructions:
      "(JOHN) After migration 0033 is applied: as a CEO of company A, call SELECT is_topic_admin('<topic-id-of-company-B>'). Should return false. Then call with a topic id from company A where you're NOT a participant. Should still return true (CEO of the company gives admin parity).",
    expected:
      "is_topic_admin returns FALSE for cross-company topics regardless of caller role. Returns TRUE for any same-company topic when the caller has profile.role in (CEO/COO/admin). Returns TRUE for any topic where caller has chat_participants.role='admin'.",
    assignee: "john",
    structural: true,
  },
  {
    id: "tenant-events-chain-scoped",
    title: "Chain events are company-scoped",
    instructions:
      "(JOHN) Verify the events table SELECT policy. From company A's session: SELECT count(*) FROM events. Should return only events with company_id matching A. Service-role calls bypass this — that's correct, only user-level calls should be scoped.",
    expected:
      "User-level SELECT returns 0 events from any other company. The §3.1 chain isolation is a hard requirement — cross-tenant event leakage would undermine every measurement claim.",
    assignee: "john",
    structural: true,
  },
  {
    id: "tenant-rls-update-blocked-direct",
    title: "Direct curl can't bypass RLS admin gates",
    instructions:
      "(JOHN) As a regular Member (not CEO/COO/admin, not topic admin), try to PATCH /rest/v1/chat_topics?id=eq.<topic-id> with body {\"title\":\"hacked\"} using the user's anon-key + JWT.",
    expected:
      "Supabase returns 0 affected rows or a permission error. Post-0033, only is_topic_admin() callers can UPDATE chat_topics. The UI's iAmAdmin check is no longer the only defense — the database enforces it too.",
    assignee: "john",
    structural: true,
  },

  // ─── Pilot-readiness scaffolding ─────────────────────────────
  {
    id: "pilot-terms-page-renders",
    title: "/terms page exists and reads constitutionally",
    instructions:
      "Open /terms (no auth required). Read top to bottom.",
    expected:
      "Page renders. Names §3.4 as 'the honesty window' and explains the 60-day cycle in plain English. Does NOT read as boilerplate ToS. Footer is marked v0.1 — pilot ready, not yet attorney-reviewed for commercial sale. Linked from landing footer and /login.",
    assignee: "partners",
    structural: true,
  },
  {
    id: "pilot-privacy-page-a10",
    title: "/privacy page foregrounds §A10 — no shadow read",
    instructions:
      "Open /privacy. Read the top section.",
    expected:
      "The 'core promise' section opens with 'Whatever ELOSTATE records about you, you can see.' Explains who-sees-what concretely. Names the third-party services (Supabase, Vercel, Anthropic). Retention section explains §3.1 append-only honestly — redaction not deletion. v0.1 flag at the bottom.",
    assignee: "partners",
    structural: true,
  },
  {
    id: "pilot-sentry-dsn-gating",
    title: "Sentry is a no-op without NEXT_PUBLIC_SENTRY_DSN",
    instructions:
      "(JOHN) On local dev without NEXT_PUBLIC_SENTRY_DSN set, throw an error in the browser console. Then check Sentry.io to confirm nothing was sent.",
    expected:
      "Sentry SDK initializes but doesn't send (DSN guard in sentry.*.config.ts). No 'Sentry not configured' warnings in console; no network requests to ingest.sentry.io. Production build with DSN set DOES capture (verify after Vercel env is configured).",
    assignee: "john",
    structural: true,
  },
  {
    id: "pilot-sidebar-cycle-badge",
    title: "Sidebar shows §3.4 cycle phase badge",
    instructions:
      "Sign in. Look at the Company pill at the top of the sidebar.",
    expected:
      "Under the company name, a small badge with Hourglass icon: 'M1 · Day N' (arc-cyan during control), 'M2 · Day N' (emerald during intervention), or 'Day N · compounding' (emerald after). Hover tooltip explains what the phase invites. If the company skipped control, '· skipped' chip stays forever per §3.1.",
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
