import { NextResponse } from "next/server";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

/**
 * GET /api/care/agent/analytics
 *
 * Honest measurement (§3.5) — distributions, not vanity averages.
 * 30-day window.
 */
export async function GET() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json(
      { error: "Complete onboarding first." },
      { status: 403 }
    );
  }

  const windowDays = 30;
  const since = new Date(
    Date.now() - windowDays * 24 * 60 * 60 * 1000
  ).toISOString();

  // Defense-in-depth: explicit company_id filter at the route
  // layer. RLS on support_conversations also enforces it.
  const { data: convs } = await auth.sb
    .from("support_conversations")
    .select("status, resolved_at, first_message_at, first_response_at")
    .eq("company_id", auth.companyId)
    .gte("created_at", since)
    .limit(5000);

  const all = convs ?? [];
  // Resolution rate must count conversations that were EVER resolved, not those
  // whose CURRENT status is 'resolved'. Archiving a resolved conversation sets
  // status='closed' (overwriting 'resolved'), but resolved_at persists (the 0034
  // trigger stamps it on resolve and never clears it, and a never-resolved
  // conversation — e.g. archived spam — keeps resolved_at null). Counting
  // status==='resolved' made the rate DROP as a team archived resolved work — a
  // §3.4/§3.5 perverse signal. resolved_at IS NOT NULL is the honest measure.
  const resolved = all.filter((c) => c.resolved_at !== null).length;

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
