/**
 * The public status page's reading of /api/health (2026-11-25; Gong ledger F36.34; founder picker "Simple public
 * page"). Four parts a customer relies on — and nothing internal: no commit, storage use, provider names or error text.
 *
 * HONEST ABOUT WHAT WAS CHECKED (review 2026-11-25): /api/health reaches the database live, but for AI, email and
 * webhooks it only knows whether they are SWITCHED ON (a key is set) — it doesn't call the provider. So only "Sign-in
 * and your data" can say "Working"; the others say "Switched on" or "Not switched on" (AI: "Not available"), and the
 * headline says "No problems detected", never "All systems working". A part that isn't set up is configuration, not an
 * outage. Pure.
 */
export type PartState = "working" | "on" | "down" | "off";
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
    { name: "AI coaching", state: ai ? "on" : "down", note: ai ? "Switched on" : "Not available right now" },
    { name: "Email notices", state: h.capabilities.email ? "on" : "off", note: h.capabilities.email ? "Switched on" : "Not switched on" },
    { name: "Webhooks and CRM sends", state: h.capabilities.webhooks ? "on" : "off", note: h.capabilities.webhooks ? "Switched on" : "Not switched on" },
  ];
  return { overall: parts.some((p) => p.state === "down") ? "degraded" : "ok", parts };
}
