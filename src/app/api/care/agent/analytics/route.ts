import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/care/agent/analytics
 *
 * Honest measurement (§3.5) — distributions, not vanity averages.
 * 30-day window.
 */
export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isAgent =
    profile?.is_support_agent ||
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isAgent) {
    return NextResponse.json({ error: "Care is agent-only." }, { status: 403 });
  }

  const windowDays = 30;
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  const { data: convs } = await sb
    .from("support_conversations")
    .select("status, first_message_at, first_response_at")
    .gte("created_at", since)
    .limit(5000);

  const all = convs ?? [];
  const resolved = all.filter((c) => c.status === "resolved").length;

  // First-response minutes for each conversation where we have it
  const frtMinutes: number[] = [];
  for (const c of all) {
    if (c.first_message_at && c.first_response_at) {
      const elapsed =
        (new Date(c.first_response_at as string).getTime() -
          new Date(c.first_message_at as string).getTime()) /
        60_000;
      if (elapsed >= 0) frtMinutes.push(elapsed);
    }
  }
  frtMinutes.sort((a, b) => a - b);

  function medianOf(arr: number[]): number | null {
    if (arr.length === 0) return null;
    const mid = Math.floor(arr.length / 2);
    if (arr.length % 2 === 1) return Math.round(arr[mid] ?? 0);
    const a = arr[mid - 1] ?? 0;
    const b = arr[mid] ?? 0;
    return Math.round((a + b) / 2);
  }
  const median = medianOf(frtMinutes);
  const avg =
    frtMinutes.length > 0
      ? Math.round(frtMinutes.reduce((a, b) => a + b, 0) / frtMinutes.length)
      : null;

  // Distribution buckets
  const buckets = [
    { bucket: "< 1 min", lo: 0, hi: 1 },
    { bucket: "1-5 min", lo: 1, hi: 5 },
    { bucket: "5-15 min", lo: 5, hi: 15 },
    { bucket: "15-30 min", lo: 15, hi: 30 },
    { bucket: "30-60 min", lo: 30, hi: 60 },
    { bucket: "1-4 hr", lo: 60, hi: 240 },
    { bucket: "> 4 hr", lo: 240, hi: Infinity },
  ];
  const dist = buckets.map((b) => ({
    bucket: b.bucket,
    count: frtMinutes.filter((m) => m >= b.lo && m < b.hi).length,
  }));

  const byStatus: Record<string, number> = {
    open: 0,
    in_conversation: 0,
    awaiting_customer: 0,
    resolved: 0,
    closed: 0,
  };
  for (const c of all) {
    const k = c.status as string;
    if (k in byStatus) byStatus[k] = (byStatus[k] ?? 0) + 1;
  }

  return NextResponse.json({
    windowDays,
    totalConversations: all.length,
    resolvedConversations: resolved,
    avgFirstResponseMinutes: avg,
    medianFirstResponseMinutes: median,
    firstResponseDistribution: dist,
    resolutionRate: all.length > 0 ? resolved / all.length : null,
    byStatus,
  });
}
