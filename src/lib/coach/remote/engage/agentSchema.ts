import { z } from "zod";

/**
 * What an agent's trigger and actions may be, as the agents route accepts them (and rss_valid_agent, 0389, checks again
 * in the database). One copy: the route and the templates' test (E8) both use it.
 */
export const TriggerZ = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("deal_stage"), status: z.enum(["open", "won", "lost"]).optional(), label: z.string().trim().min(1).max(60).optional() }),
  // 0380: a tracker first heard on one of a deal's calls. It must be one of the company's trackers.
  z.object({ kind: z.literal("tracker_heard"), tracker_id: z.string().uuid() }),
  // 0382: an open deal's expected close date is this many days away (the nightly job; needs CRON_SECRET).
  z.object({ kind: z.literal("close_date_near"), days: z.number().int().min(1).max(60) }),
  // 0389 (E8): an open deal has gone quiet (dealRisk's rule, checked nightly). Nothing but the kind.
  z.object({ kind: z.literal("deal_gone_quiet") }),
  // 0390 (E11): an open deal's next call is tomorrow (the company's day, checked nightly). Nothing but the kind.
  z.object({ kind: z.literal("next_call_tomorrow") }),
]);
export const ActionZ = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("brief") }),
  z.object({ kind: z.literal("notify"), to: z.enum(["rep", "owner"]) }),
  z.object({ kind: z.literal("todo"), title: z.string().trim().min(1).max(200), due_days: z.number().int().min(0).max(365).optional() }),
  z.object({ kind: z.literal("webhook") }),
]);
