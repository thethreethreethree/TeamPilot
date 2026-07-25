# CARE — Standard Mode Simplification Spec

**For:** Claude Code + VS Code
**Platform:** Elostate SaaS
**Feature:** C.A.R.E — Customer Assistance Response Engine
**Goal:** Reduce complexity of Standard mode to an *optimal, simplified, effective system* — powerful underneath, minimal on the surface.

Governing constitution: `thinkerthinker.md`.

---

## 0. Objective

Standard CARE is currently too complex and overwhelming to use. Simplify it so a support agent can do the 5 things they do 95% of the time with zero friction, while advanced capability remains available but out of the way.

**Design law:** *The interface should expose only what the user needs at the moment they need it.* Depth on demand, never depth by default.

**Success test:** A new agent can resolve a ticket end-to-end within 5 minutes of first opening Standard mode, with no training.

---

## 1. The Simplification Principle

Apply this ordering to every screen, control, and setting:

1. **Default over configure** — pick the best default; don't ask the user to choose what you can decide for them.
2. **Progressive disclosure** — advanced options are hidden behind a single "Advanced" affordance, never on the main surface.
3. **One primary action per screen** — each view has exactly one obvious next step, visually dominant.
4. **Collapse, don't remove** — nothing powerful is deleted; it's moved out of the default path.
5. **Reduce decisions** — every choice removed from the default flow is a win. Count the clicks; cut them.

---

## 2. The 5 Core Actions (the 95% path)

Standard mode is built around exactly these. Everything else is secondary and disclosed on demand.

1. **See my queue** — the tickets I need to handle, prioritized, one clear list.
2. **Open & understand a ticket** — full context on one screen: customer, history, the issue, AI's understanding.
3. **Respond** — reply with AI-suggested draft, edit, send. One action.
4. **Resolve or escalate** — close it, or hand it up, in one click.
5. **Move to the next** — seamless flow to the next ticket without hunting.

If a feature does not directly serve one of these five, it does **not** belong on the default surface.

---

## 3. What to Simplify (concrete changes)

### 3.1 The Queue View
- **One default list**, smart-sorted (priority + SLA risk + age). Remove the multi-filter panel from the default view; collapse it behind a single "Filter" control.
- Each row shows only: customer, subject, priority, time-in-queue, one status indicator. Remove every other column from the default.
- One primary action per row: **Open**.
- Remove queue-switching complexity from the main view — default to "My Tickets." Other queues live behind one dropdown.

### 3.2 The Ticket View
- **Single-screen layout.** Everything to handle the ticket without scrolling between panels: conversation thread (center), customer context (one collapsible side panel), reply box (bottom).
- Collapse advanced metadata (custom fields, tags, linked records) behind one "Details" toggle — hidden by default.
- The AI's understanding of the issue shown as **one short summary line** at top, not a data dump.
- Internal notes: one toggle, not a separate mode.

### 3.3 The Response Flow
- **AI-suggested reply appears pre-drafted** in the reply box. Agent edits or accepts.
- Three actions maximum, clearly ranked: **Send** (primary), **Send & Resolve** (secondary), **Save draft** (tertiary).
- Macros/canned responses behind one "Templates" button, not spread across the toolbar.
- Remove formatting-toolbar clutter to the essentials (bold, list, link, attach); everything else behind a "more" affordance.

### 3.4 Resolve / Escalate
- **Two buttons, unmistakable:** Resolve, Escalate.
- Resolve: one click closes; optional reason is a fast single-select, not a required form.
- Escalate: one click, AI pre-selects the most likely target (skill/tier match); agent confirms or changes. No mandatory routing form.

### 3.5 Settings & Configuration
- Remove all configuration from the agent's daily surface. Agents get **defaults, not settings.**
- Move all setup (routing rules, SLA config, AI tuning, integrations) to a separate **Admin** area, accessed only by admins, never surfaced to agents.

---

## 4. Progressive Disclosure Map

| Always visible (default) | One click away | Admin only (hidden from agents) |
|---|---|---|
| My queue (smart-sorted) | Filters, other queues | Routing rules |
| Ticket thread + reply | Ticket details/metadata, templates | SLA policies |
| AI-suggested response | Internal notes, full customer history | AI configuration |
| Resolve / Escalate | Escalation target override | Integrations, macros management |
| Next ticket | Formatting extras | Team/permission settings |

Rule: if it's used in fewer than ~1 in 5 tickets, it is not on the default surface.

---

## 5. AI's Role in Standard Mode (keep it invisible-but-present)

The AI reduces work; it should not add UI. Per `thinkerthinker.md` (guide, don't overtake):

- **Pre-draft the response** — always ready, agent stays in control (edit/accept).
- **Pre-summarize the issue** — one line, so the agent understands fast.
- **Pre-select escalation target** — agent confirms.
- **Surface the one relevant knowledge article** — inline, not a sidebar of ten.
- Never require the agent to interact with the AI as a separate step. The AI's output is *already in the flow*, not a tool they invoke.

The Understanding Gate still applies: the AI never auto-sends and never auto-resolves without the agent's action. It prepares; the human commits.

---

## 6. What NOT to Change

- Do not remove any capability from the system — **relocate**, don't delete. Advanced users and admins keep everything.
- Do not touch the underlying data model, ticket lifecycle, or AI engine. This is a **surface/UX simplification**, not a re-architecture.
- Do not change Admin or advanced modes. Only **Standard** agent mode is in scope.
- Keep the unified chat+email conversation thread intact.

---

## 7. Build Process

1. **Audit first.** Produce a list of every UI element, control, setting, and action currently on the Standard agent surface. Map each to: keep-default / one-click-away / move-to-admin, using the Section 4 rule. Show me this map before changing code.
2. **Propose the simplified layouts** for the three core screens (Queue, Ticket, Response) — as structure/wireframe description — before implementing.
3. **Implement screen by screen** (Queue → Ticket → Response → Resolve/Escalate), so each can be reviewed.
4. Preserve all existing functionality behind the new disclosure structure; write nothing that deletes capability.
5. **Stack:** Next.js (App Router) / React / TypeScript / Tailwind. Surface lives in
   `src/components/care/ConversationsApp.tsx`; mode via `useExperienceMode()`
   (`isStandard`), persisted in `profiles.experience_mode`.

**Deliver the audit map first. Explain the reasoning for any element you place, then simplify.**

---

## 8. Build Status — 2026-07-25 (honest ledger, §3.4)

Standard mode branches off `isStandard` from `useExperienceMode()`; every change is
gated so **Expert is untouched** (§6). "Done" = built + `tsc`/tests green, **runtime
UNVERIFIED on device** (needs founder — AMD-006 addendum).

| §   | Item | Status | Notes |
|-----|------|--------|-------|
| 3.1 | One default list, smart-sorted | **Done** | Standard defaults to "My Tickets"; other views behind "More views" toggle. Smart-sort now full "priority + SLA risk + age" — the SLA-risk key was added (`a35eea45`); it had been priority+age only. Standard-gated (Expert sort unchanged, §6). |
| 3.1 | Row = customer/subject/priority/time/status only | **Done** | Tag chips + bulk-select checkbox hidden in Standard. Concern (0188) + SLA bar + needs-guidance KEPT — high-signal triage, used on >1-in-5 tickets (§4 rule), so not clutter. |
| 3.2 | Single-screen ticket layout | **Done (pre-existing)** | Thread center / customer panel side / composer bottom already the layout. |
| 3.2 | Customer context collapsed by default | **Done** | `setCustomerCollapsed(true)` when Standard + mode loaded. |
| 3.2 | Advanced metadata behind one toggle | **Done** | Priority dropdown + ticket-header tags hidden in Standard; Details lives in the collapsible customer panel. |
| 3.2 | AI understanding as ONE summary line at top | **Deferred — DECISION** | Would auto-fire the brain-gated Summarize on every ticket open (LLM cost per open; §3.4 control-window makes it silent month-1 anyway). Held rather than silently spend. **Founder: want the one-liner (accept per-open cost), or keep Summarize on-demand in the composer?** |
| 3.3 | Ranked actions: Send · Send & Resolve · Save draft | **Send & Resolve Done** (`9fd89535`); Save draft **not built** | Send & Resolve collapses the reply→resolve two-step into one entry point — but the resolve step opens the REQUIRED capture form (see §3.4 row), so it is NOT "one click." Save draft has no persistence backend — a button that didn't persist would be dishonest (§A24). |
| 3.3 | Tools decluttered to essentials + "more" | **Done** | Composer: Summarize · Co-Pilot · Ask Coach · Spawn Task; Formulate → Expert-only. Analysis tools grouped behind the "Agent Tools" reveal. |
| 3.3 | AI reply pre-drafted in the box | **Reverted — DECISION** | Auto-fired Co-Pilot on every open; reverted during the provider outage (fired failing calls) and because it spends an LLM call per open + inserts the AI unprompted (§3.4 guide-don't-overtake). Now that the provider is fixed it *could* return. **Founder: auto-pre-draft on open (cost + AI-forward), or keep Co-Pilot one-click?** |
| 3.4 | Resolve — one click, optional fast reason | **NOT met — DECISION** | Resolve opens `ResolutionCaptureModal`, which REQUIRES issueSummary + whatWorked (≥5 chars each) — a required two-field form, the opposite of §3.4's "one click, optional reason, not a required form." But that capture is NOT incidental: it feeds the §3.1/§1.1 learning loop (Co-Pilot precedents depend on `whatWorked`). Auto-advance + continuity are intact (§1.5.1). **Founder: (a) keep the full capture (slower resolve, preserves the learning loop — recommended), (b) a lighter Standard resolve that captures less, or (c) pre-fill the capture from the AI's understanding so the agent confirms instead of types (fast AND captured — but costs an LLM call per resolve).** Do not weaken the capture without this call (§2). |
| 3.4 | Escalate — one click, AI pre-selects target | **Not built** | No skill/tier routing model exists to pre-select against; "request supervisor guidance" (`supervisorGuidanceRequestedAt`) is the nearest current primitive. Building real AI-routed escalation is a feature, not a surface tweak — needs its own spec (§3.2 gate: don't half-build). |
| 3.5 | Settings out of the agent surface → Admin | **Done (pre-existing)** | Config lives at `/dashboard/care/settings` (admin-gated); agents get defaults. |

**Open founder decisions (4):** §3.2 one-line AI summary, §3.3 auto-pre-draft, §3.3
Save-draft persistence, and §3.4 resolve-capture-vs-one-click (the learning-loop
trade). Each is a cost/behavior trade the founder owns (§2), not a mechanical build —
surfaced rather than decided unilaterally. The §3.4 one is the sharpest: it pits the
Standard-simplification goal directly against the §3.1/§1.1 learning thesis.

---

*Optimal = the fewest elements that still let the agent do the 5 core actions with zero friction. Simplify the surface; preserve the power.*
