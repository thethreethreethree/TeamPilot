# ELOSTATE — Productivity tools inventory

> The thesis: every productivity tool in ELOSTATE exists to **solve
> problems**, not just to **organize the work of pretending you're
> solving them**. The list below is the actual native surface — what
> a customer gets without integrating a single third-party tool.
>
> You don't need Slack for chat. You don't need Asana for tasks. You
> don't need Zendesk for support. You don't need Notion for
> institutional memory. You don't need a CRM to manage your customer
> base. You don't need a meeting platform for decisions.
>
> They're all in here, designed differently — centered on the
> question "did the team's reasoning produce a durable outcome?"
> rather than "did the team move tickets?"

Written 2026-06-18.

---

## 1. Internal communication

The team talks here. Same shape as Slack on the surface, completely
different underneath: every message becomes part of the reasoning
chain.

| Tool | What it is | Where it lives |
|---|---|---|
| **Team Chat** | Topic-threaded conversations with participants, reactions, @mentions, and persistent context. Each topic is a self-contained reasoning space. | `/dashboard/chats` |
| **Decision Dialogue (in-thread)** | When a topic surfaces an actual decision, the team can open a structured Dialogue right in the thread — without leaving the conversation. | inside any chat topic |
| **Coach (per-draft communication coaching)** | Reads every draft before you send. Suggests sharper versions with explicit source citations (Voss, Carnegie, Heath, Zinsser, Rosenberg). Refuses to lecture. | inline on every composer in the app |
| **@mentions** | Tagged teammates get an immediate notification. Mentions are first-class events in the chain so "who needed to know about what, when" is queryable forever. | anywhere you can type |
| **Voice channel** | ElevenLabs-powered voice replies and transcription for high-velocity customer-facing conversations. | inside C.A.R.E |
| **Feedback panel** | Bug reports, ideas, and suggestions captured from anywhere in the app — with annotated screenshots, kind classification, and a closeable feedback loop. | floating panel + `/dashboard/feedback` |
| **Notifications inbox** | Every chain event that touches you surfaces here: mentions, task assignments, decisions in your topics, C.A.R.E customer replies, supervisor guidance requests, durability checks. | `/dashboard/notifications` |

**Why this composes differently:** No message is just a message.
Every utterance becomes evidence in the reasoning chain. Decisions
made in chat don't evaporate — they're reachable, attributable, and
measurable months later.

---

## 2. Team management

Roster, roles, capacity, presence — all the ops infrastructure a team
needs to run itself.

| Tool | What it is | Where it lives |
|---|---|---|
| **Team roster** | The full team with roles (CEO, COO, admin, support agent, member), invitations, and revocations. | `/dashboard/team` |
| **Invite flow** | Invitation link generator with expiration, role assignment at invite time, and acceptance flow with profile setup. | `/dashboard/team` + `/invite/[code]` |
| **Onboarding wizard** | Multi-step new-tenant setup: company info, AI product context, team invites. Failed invites surface honestly (no silent drops). | `/onboarding` |
| **Agent presence (C.A.R.E)** | Online / away / offline status per agent, capacity ceilings, channel coverage, heartbeat. Agents can update their own status; admins set capacity + channels. | inside C.A.R.E sidebar |
| **Team check (admin)** | Periodic pattern reads on team behavior — surfaces drift before it becomes incident. Admin-only per §A18 (team-level only, not per-agent for stack-ranking). | `/dashboard/admin/team-check` |
| **Coach readout (admin)** | Per-heuristic acceptance rates, outcome distributions, growth signal. Leadership readout instrument. Admin role-gated. | `/dashboard/admin/coach-readout` |
| **Settings** | Per-company config: name, industry, size, stage, goals, timezone, LLM provider preference. Plus the AI guidance unlock status (§3.4 control window). | `/dashboard/settings` |
| **My Growth** | Each individual sees their own development — Coach grades over time, durability of their resolutions, communication trajectory. Personal, not surveillance. | `/dashboard/my-growth` |

**Why this composes differently:** Team management here measures
**consequence**, not activity. Capacity numbers reflect actual
sustainable throughput, not aspirational time-budget math. Presence
states are real, not status icons agents toggle to look busy.

---

## 3. Task management

Tasks, blockers, ownership, due dates, the whole project-tracking
surface — but with one critical addition: every task is gated by
whether the team understands what it's supposed to solve.

| Tool | What it is | Where it lives |
|---|---|---|
| **Task board** | Full task management: assignee, priority (Critical / High / Medium / Low), status (To Do / In Progress / Blocked / Needs Review / Completed), due date, AI priority score, impact level. | `/dashboard/operations` |
| **Task detail** | Per-task drill-in with description, history, participants, comments, and the Understanding Gate state (whether the task has earned the right to be worked on). | `/dashboard/operations/[id]` |
| **Blocker tracking** | "Blocked" is not just a status — it requires a `blocker_reason`. The system refuses to leave a task blocked with no stated reason because that's the failure mode that produces invisible bottlenecks. | inline in task detail |
| **Status transition validation** | Server-side: tasks can't skip states (To Do can't go straight to Completed). The state machine is enforced, not advisory. | API layer |
| **Task spawning** | New tasks can be created from any other surface: a Decision Dialogue, a customer support conversation, a chat thread. The spawn carries the reasoning context with it. | "Spawn task" button on multiple surfaces |
| **Task notifications** | When you're added as a participant, when a task you own becomes blocked, when its status changes — you're notified through the same chain. | `/dashboard/notifications` |
| **Understanding Gate (structural)** | Tasks tied to problems can only be promoted when the problem has crossed the §3.2 evidence threshold. Half-understood work cannot reach the team. Schema-enforced, not policy-enforced. | the trigger layer; visible in task detail |

**Why this composes differently:** Most task systems optimize for
"how many tickets did we close." This one asks "did the work resolve
the underlying problem, and did the resolution hold?" A closed
ticket whose underlying problem reopens within 7 days is failure,
not success.

---

## 4. C.A.R.E (Customer Assistance and Response Engine)

A complete support module. Standard support tools call this "ticket
management" — we call it institutional reasoning applied to customer
relationships.

### Inbox + workflow
| Tool | What it is |
|---|---|
| **Multi-channel inbox** | Customer conversations from the web widget, the embedded widget, inbound email, and voice — all in one queue. |
| **Assignment + claim** | Agents claim or get assigned conversations; admins reassign; on-call presence shapes routing. |
| **Priority + status** | Open / In conversation / Awaiting customer / Resolved / Closed. Status names are invitation-shaped per §A18 — they tell the agent what to do, not what the row is. |
| **Tags + shortcuts** | Per-tenant taxonomies for triage + canned responses for high-frequency replies. |
| **Bulk actions** | Multi-select conversations for mass close / reopen / reassign / supervisor-guidance flag / tag. |
| **Customer profiles** | Per-customer view: lifetime value, prior conversations, metadata, history across channels. |

### Reasoning before reply (the Read Phase)
| Tool | What it is |
|---|---|
| **The Read Phase** | Before an agent can mark "ready to draft," the System surfaces: customer's prior conversations, the 3-5 most similar past resolutions, and the conversation's recent tail. §0 Understanding Gate applied to support. |
| **Similar past resolutions** | Keyword-matched lookup against the resolution corpus. Surfaces "this customer asking about X — here's what worked for the other three customers who asked the same thing." |
| **Customer history** | Has this customer been here before? When? What was the issue? Did it hold? |

### AI augmentation in the composer
| Tool | What it is |
|---|---|
| **AI Co-Pilot** | Drafts a reply for the agent, drawing on the company's institutional precedents. Surfaces WHICH precedents it used so the agent can verify. Brain-gated per §3.4 (silent during the month-1 control window). |
| **Formulate C.A.R.E** | Agent tells the System what they want to say; the System shapes it into a clear, warm reply in the C.A.R.E voice. |
| **Ask Coach** | Pre-send analysis using Coach v5: classification, suggested revision with source citation (Voss / Heath / Zinsser etc.), follow-up question chips, and conversational depth. |
| **Summarize** | The System's read of a long conversation so an agent stepping in catches up in 30 seconds. Surfaces prior similar resolutions alongside the summary (§3.6 make-learning-visible). |

### Post-send + outcome capture
| Tool | What it is |
|---|---|
| **Coach grading (post-send)** | Every sent reply gets a Coach v6 grade with counts (acknowledged ✓ / answered ✓ / next-step ✓ / risks flagged). Counts, not verdicts (§A11). |
| **Resolution capture** | When a conversation resolves, the agent captures the issue summary + what worked + category. This becomes the next agent's institutional memory. |
| **Durability check** | 7 days after resolution, the System asks the agent to confirm the fix held (or reopen). The §3.5 constitutional loop. |
| **Spawn task from conversation** | Turn a support thread into a structured task in the operations board, with the reasoning context preserved. |
| **Open as Decision Dialogue** | Escalate a complex customer issue into a team Decision Dialogue — full diagnostic flow, not just a Slack ping. |
| **Supervisor guidance request** | Agent flags a conversation as "needs supervisor read." Notification fires to admins — the path the founder specifically named. |

### Knowledge + learning surfaces
| Tool | What it is |
|---|---|
| **Knowledge base** | Browse the resolution corpus by category, by who captured it, by outcome (held / reopened / inconclusive). The team's actual playbook, derived from what worked. |
| **Patterns** | The System surfaces recurring customer issues (issue patterns) and team-level coaching risk patterns (reply-shape patterns). Both with sample evidence so the agent can verify the pattern is real. |
| **My Growth (per-agent)** | The agent's own 30-day record: resolutions held, durability outcomes, Co-Pilot edit magnitudes. Personal development surface, not stack-ranking. |
| **Leadership readouts** | Aggregate team-level analytics for leaders. Per §A18 there is no per-agent breakdown — patterns surface at team level because pattern problems usually point to product/process gaps, not bad agents. |

### Voice channel
| Tool | What it is |
|---|---|
| **Voice mode** | ElevenLabs Scribe (speech-to-text) + Flash TTS (low-latency synthesis) for voice-first customer interactions. Echo-cancelled, latency-aware, cost-capped. |

### Configuration
| Tool | What it is |
|---|---|
| **Tenant config** | Widget appearance, AI personality (warm / formal / casual / direct), response length, voice selection, reply signature, allowed origins. Per-tenant. |
| **Agent settings** | Per-agent: status, capacity, channel coverage, growth surface visibility. |
| **Shortcuts (canned responses)** | Authored once per company, reusable everywhere. |

**Why this composes differently:** C.A.R.E is shaped around the
question "did we actually solve what the customer was actually
trying to solve, and did it hold seven days out?" — not "did we
close the ticket within SLA." Standard support tools optimize for
the latter and produce solved-then-reopened cycles forever. This
one doesn't.

---

## 5. Decision-making infrastructure (the constitutional core)

The thing that makes everything else work. This is the layer no
other productivity tool has.

| Tool | What it is | Where it lives |
|---|---|---|
| **Decision Dialogue** | Structured four-phase flow: Situation (state the situation) → Your Read (your diagnosis) → System Response (the System engages, adds perspective, offers a suggestion with explicit WHY) → Decide (adopt yours / adopt System's / hybrid / defer). The System NEVER asserts before you've spoken. | `/dashboard/decisions` + inline in chats |
| **Problem board** | Every problem the team is aware of, with diagnosis, supporting signals, status (draft / surfaced / dismissed / resolved). Problems cannot be promoted to "surfaced" until they cross the evidence threshold (Understanding Gate). | `/dashboard/problems` |
| **Resolutions** | Every closed problem with: action taken, reasoning (≥40 chars required), expected outcome, observed outcome, durability state. Reasoning is mandatory — a resolution without a stated WHY is incomplete. | `/dashboard/resolutions` |
| **Durability tracking** | Each resolution is reviewed: held / reopened / partial / inconclusive. The metric the System optimizes for. | `/dashboard/resolutions` |
| **Diagnose flow** | End-to-end Living Diagnosis: from a question to evidence collection to problem identification to resolution capture to durability review. | `/dashboard/diagnose` |
| **Close-the-loop** | Once a resolution is captured, it feeds back into the chain as new events. Future similar situations get the prior reasoning surfaced. | automatic, at resolution time |

**Why this composes differently:** No other product on the market
forces the team to state diagnosis before acting and reasoning
before closing. ELOSTATE refuses to advance the chain otherwise.
That refusal is the moat.

---

## 6. The Living Diagnosis chain (the infrastructure underneath)

What every tool above actually writes to. Append-only, immutable,
queryable forever.

| Layer | What it is |
|---|---|
| **Events** | Every meaningful input — chat message, task transition, decision, customer reply, mention, signup, lifecycle change — is captured as an immutable event row. |
| **Signals** | Derived automatically from events by SQL triggers. Patterns the System notices: a task slipped, a meeting overran, a customer reopened, a deadline shifted. |
| **Problems** | Patterns that crossed the §3.2 evidence threshold. Promoted to team awareness. Linked to supporting signals. |
| **Resolutions** | Recorded answers with reasoning, outcome expectation, and durability review. |
| **Per-team brain** | Each tenant's accumulated patterns + durable resolutions + characteristic failure modes feed back into the System. After month 1, every AI output is shaped by THIS team's record, not generic templates. |

**Why this composes differently:** The chain is the reason every
other tool above is more than what it looks like. A task is
connected to the signal that triggered it. A decision is connected
to the problem it addressed. A customer resolution is connected to
the future patterns it will inform.

---

## 7. AI augmentation (cross-system)

The intelligence layer that's available everywhere — coaching,
drafting, surfacing — and refuses to overtake.

| Tool | What it is |
|---|---|
| **The Brain** | Per-tenant composition layer. Reads the team's record + active control-gate state + brain version. Every AI call routes through it. Refuses to speak during the §3.4 month-1 control window. |
| **Coach (v5)** | Conversational LLM-primary coaching against the verified Knowledge Base (10 books of operational communication principles). Used on chat messages, decision dialogues, task fields, feedback notes, smoke-test notes, AND C.A.R.E replies. Single backend across all surfaces. |
| **Co-Pilot** | AI drafting assistant in C.A.R.E. Surfaces precedents. Brain-gated. |
| **Formulate (chat)** | Three-question reflection that composes a draft from the user's own answers. |
| **Formulate C.A.R.E** | One-question intent-shaping for support replies. |
| **Guide (chat)** | Sharpens a draft the user already wrote — same intent, sharper prose. |
| **Similar topics (chat)** | Surfaces prior team conversations with held resolutions when starting a new topic. §3.6 make-learning-visible. |
| **Similar past resolutions (C.A.R.E)** | Same lens, applied to support: "we've handled this kind of issue before." |
| **Summarize (chat + C.A.R.E)** | System's read of a thread; confirm-or-correct, never authoritative. |
| **Daily briefing** | Command Center surfaces "today's open questions" + uncertainties + things-worth-noticing. Never recommendations. §3.3 surface-don't-overtake. |

**Why this composes differently:** Every AI surface is gated by the
same control window. None of them assert authority over the human.
All of them refuse to speak when they haven't earned the right.

---

## 8. Knowledge management

The team's institutional memory, built automatically from the work
the team is already doing.

| Tool | What it is |
|---|---|
| **Resolution corpus** | Every captured resolution across the team becomes part of the corpus. Searchable, filterable, browseable. The team's playbook, in its own voice. |
| **Pattern surface** | Recurring patterns the System has noticed across the corpus. |
| **Customer prior conversations** | Per-customer history reachable from any C.A.R.E conversation. |
| **Smoke tests** | Manual verification checklist for ensuring the System still does what it's supposed to do. Failures emit chain events. | `/dashboard/smoke-test` |
| **Coach Knowledge Base** | 10 books of operational communication principles, distilled into actionable rewrites the Coach can teach from. Source-cited, not opinion-driven. |

**Why this composes differently:** Notion is where you put what you
remember. ELOSTATE is where what you needed-to-remember-and-didn't
gets surfaced when you need it again.

---

## 9. Operational hub (the daily landing)

The view that tells you what to focus on today, derived from real
state — not aspirational dashboards.

| Tool | What it is | Where it lives |
|---|---|---|
| **Command Center** | Stat row: open tasks, signals (30d), open problems (draft + surfaced split), resolutions (with reviewed count), held rate (with denominator). Plus: open conversations, awaiting first reply, needs guidance, due durability checks. Quickstart hints for empty states. Daily briefing on demand. | `/dashboard` |
| **Loader-failure honesty** | Failed queries surface as a banner ("Couldn't load: tasks, problems") with a Retry button — never as silent zeros that look identical to "fresh tenant." | top of Command Center |

**Why this composes differently:** The hub doesn't tell you what to
do. It shows you the state of the team's reasoning chain so you can
decide.

---

## 10. Vendor-side back office (CRM for the SaaS operator)

For ELOSTATE (or any company running this stack as a multi-tenant
product) to manage its own customer base.

| Tool | What it is | Where it lives |
|---|---|---|
| **Customer accounts** | One row per company signed up to use ELOSTATE. Lifecycle stage (trial / control month / activated / paying / at risk / churned), source, owner, health score + reason. | `/dashboard/admin/crm` |
| **Test/production filter** | Distinguishes founder/QA signups from real customers so the metrics aren't polluted. | top of accounts list |
| **Contacts** | People at each account with roles, primary contact flag, decision-maker flag. | account detail tab |
| **Subscriptions** | Plan tier, status, seat count, MRR — schema fully in place; billing collection deliberately OFF until live billing is flipped. | account detail tab |
| **Stub invoices** | Generated for bookkeeping with status "not_collecting." Ready when collection turns on. | account detail tab |
| **Activity feed** | Every meaningful state change (lifecycle, owner, health, invoice, contact, note) is an append-only event. | account detail tab |
| **Notes** | Internal notes per account, pinnable. | account detail tab |

**Why this composes differently:** Salesforce manages relationships
as a CRM. This one manages relationships as a chain of events with
the same discipline applied to vendor-customer interactions that
the rest of the System applies to internal reasoning.

---

## 11. Integration surfaces

How the system connects to the outside world.

| Surface | What it is |
|---|---|
| **Web widget** | Embeddable JS snippet for customer support on any site. |
| **Embedded widget** | iframe variant for full-page or modal embedding. |
| **Inbound email** | Postmark webhook → C.A.R.E inbox. Threading by Message-ID, dedup by external_message_id. |
| **Outbound email** | Replies dispatched as outbound email when the conversation source is email. Threading preserved. |
| **Voice (ElevenLabs)** | Flash TTS for replies, Scribe STT for customer queries. Cost-capped, latency-aware. |
| **Multi-provider LLM** | Anthropic + DeepSeek. Auth-failure cascade between them so a single provider outage doesn't black out guidance. |
| **PWA** | Install banner, manifest, service worker. Installable on mobile. |

---

## 12. What we deliberately don't have (and won't)

Honesty section. Per §3.4 + §A11, these are absences-by-design, not
gaps:

- **"AI strategy advisor."** We refuse to make strategic decisions for you. The System guides; you decide. Always.
- **Stack-ranked employee leaderboards.** Per §A18, individual-level surveillance is forbidden. Patterns surface at team level.
- **A "send for me" button.** Coach surfaces sharper drafts; you send. Never the other way around.
- **An "AI did the work" mode.** Every output is auditable, attributable to a human decision, and recorded with reasoning.
- **Instant-result claims.** Month one is structural baseline measurement. The discipline is the feature; the wait is honest.

---

## The customer-facing summary

To a prospect asking "wait, do you have chat? do you have tasks? do
you have a CRM?" the answer is:

> **Yes — all of them. Designed differently. Centered on whether
> your team's reasoning produces durable outcomes, not on whether
> your team is producing more output. The productivity surface you
> already know is in here; the discipline underneath is what makes
> it actually solve problems instead of organizing them.**

The categories on a marketing page (using the founder's framing):

- **Internal communication** — Team Chat, Coach, Notifications, Feedback
- **Team management** — Roster, Invites, Presence, Settings, My Growth
- **Task management** — Operations board, Spawning, Status validation, Understanding Gate
- **Customer assistance + response engine (C.A.R.E)** — full multi-channel support with the discipline applied
- **Decision-making** — Decision Dialogue, Problems, Resolutions, Durability
- **Knowledge management** — Resolution corpus, Patterns, Smoke tests
- **Operational hub** — Command Center
- **Vendor back office** — CRM for whoever runs the company on top of this stack

Everything composes on the Living Diagnosis chain. The chain is the
moat. Every productivity tool above is a different surface on the
same evidence base.

---

*Inventory source-of-truth as of 2026-06-18. Constitutional version:
CLAUDE.md + ratified amendments AMD-001 through AMD-006. Update this
file when new tools land or existing tools change shape.*
