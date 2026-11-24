/**
 * The public status page's reading of /api/health (2026-11-25; Gong ledger F36.34; founder picker "Simple public
 * page"). Four parts a customer relies on, each working / down / not switched on — and nothing internal: no commit,
 * storage use, provider names or error text. A part that isn't set up (email, webhooks) is "not switched on", never
 * "down": that is configuration, not an outage. Pure.
 */
export type PartState = "working" | "down" | "off";
export type StatusPart = { name: string; state: PartState; note: string };
export type PublicStatus = { overall: "ok" | "degraded" | "unknown"; parts: StatusPart[] };

type Health = {
  backend?: { supabase?: { reachable?: boolean } };
  capabilities?: { llmReady?: boolean; email?: boolean; webhooks?: boolean };
} | null;

export function publicStatus(h: Health): PublicStatus {
  if (!h || !h.backend || !h.capabilities) {
    return { overall: "unknown", parts: [] };
  }
  const data = h.backend.supabase?.reachable === true;
  const ai = h.capabilities.llmReady === true;
  const parts: StatusPart[] = [
    { name: "Sign-in and your data", state: data ? "working" : "down", note: data ? "Working" : "Not reachable right now" },
    { name: "AI coaching", state: ai ? "working" : "down", note: ai ? "Working" : "Not available right now" },
    { name: "Email notices", state: h.capabilities.email ? "working" : "off", note: h.capabilities.email ? "Working" : "Not switched on" },
    { name: "Webhooks and CRM sends", state: h.capabilities.webhooks ? "working" : "off", note: h.capabilities.webhooks ? "Working" : "Not switched on" },
  ];
  return { overall: parts.some((p) => p.state === "down") ? "degraded" : "ok", parts };
}
