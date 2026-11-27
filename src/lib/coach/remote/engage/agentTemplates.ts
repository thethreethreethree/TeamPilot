import type { Action, Trigger } from "./agents";
import { NEW_GRACE_DAYS, QUIET_DAYS, RISK_FIX } from "../dealRisk";

/**
 * Agent templates (Engage plan E8; Gong F27.9): ready-made agents a manager starts from. A template only fills the
 * editor — nothing is saved until the manager presses Save, and they can change any part first. Code, not rows: a
 * template is a suggestion, not a company's setting. Every trigger and action here must pass the same checks as one the
 * manager writes (the agents route and rss_valid_agent, 0389); the test holds them to it.
 */
export type AgentTemplate = { key: string; name: string; why: string; trigger: Trigger; actions: Action[] };

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    key: "proposal_prep",
    name: "Proposal prep",
    why: "When a deal reaches “Proposal”, the brief is written and the rep has a to-do to send it.",
    trigger: { kind: "deal_stage", label: "Proposal" },
    actions: [{ kind: "brief" }, { kind: "notify", to: "rep" }, { kind: "todo", title: "Send the proposal", due_days: 2 }],
  },
  {
    key: "won_handoff",
    name: "Won-deal handoff",
    why: "When a deal is won, the brief is written for whoever takes the account over, and you're told.",
    trigger: { kind: "deal_stage", status: "won" },
    actions: [{ kind: "brief" }, { kind: "notify", to: "owner" }, { kind: "todo", title: "Introduce the customer to the person who takes the account over", due_days: 1 }],
  },
  {
    key: "close_in_7",
    name: "Close date in 7 days",
    why: "A week before an open deal's expected close date, the rep is reminded to confirm it.",
    trigger: { kind: "close_date_near", days: 7 },
    actions: [{ kind: "notify", to: "rep" }, { kind: "todo", title: "Confirm the close date with the customer", due_days: 1 }],
  },
  {
    key: "meeting_prep",
    name: "Meeting prep",
    why: "The day before a deal's booked call, the brief is written fresh and the rep is told, so they walk in prepared.",
    trigger: { kind: "next_call_tomorrow" },
    actions: [{ kind: "brief" }, { kind: "notify", to: "rep" }],
  },
  {
    key: "playbook_each_call",
    name: "Fill the playbook from each call",
    why: "When a call is added to a deal, the AI reads the deal's calls for each playbook element (with the lines it rests on) and the rep is told; the rep validates what's right.",
    trigger: { kind: "call_linked" },
    actions: [{ kind: "playbook" }, { kind: "notify", to: "rep" }],
  },
  {
    key: "gone_quiet",
    name: "Gone quiet",
    why: `When an open deal has had no call in ${QUIET_DAYS} days (or none at all after ${NEW_GRACE_DAYS} days in the pipeline), the rep is told and given a to-do to reach out.`,
    trigger: { kind: "deal_gone_quiet" },
    actions: [{ kind: "notify", to: "rep" }, { kind: "todo", title: RISK_FIX.gone_quiet.slice(0, 200), due_days: 1 }],
  },
];
