import { NextResponse } from "next/server";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

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

  // Aggregate: customers + conversation count. Per defense-in-
  // depth audit: explicit .eq("company_id") at the route layer
  // even though RLS on support_customers (migration 0034) also
  // enforces it. Route-level filter survives future RLS changes
  // and makes the auth boundary auditable at the route surface.
  const { data, error } = await auth.sb
    .from("support_customers")
    .select(
      "id, name, email, phone, lifetime_value, signup_date, last_seen_at, support_conversations(count)"
    )
    .eq("company_id", auth.companyId)
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(500);

  // A DB read error must NOT return 200 + [] — that renders as "No customers yet" and tells the agent
  // the team has no customers (the error-dressed-as-no-data class). Surface it as a 500 so the client's
  // loadError state shows "temporary error, try again" instead of a false-empty. (The client res.ok check
  // is necessary but not sufficient without this — the server must not swallow the error into an empty 200.)
  if (error) {
    return NextResponse.json({ error: "Couldn't load customers." }, { status: 500 });
  }

  const customers = (data ?? []).map((row) => {
    const convCount = Array.isArray(
      (row as Record<string, unknown>).support_conversations
    )
      ? ((row as Record<string, unknown>).support_conversations as Array<{
          count?: number;
        }>)[0]?.count ?? 0
      : 0;
    return {
      id: row.id as string,
      name: (row.name as string | null) ?? null,
      email: (row.email as string | null) ?? null,
      phone: (row.phone as string | null) ?? null,
      lifetimeValue: (row.lifetime_value as number | null) ?? null,
      signupDate: (row.signup_date as string | null) ?? null,
      lastSeenAt: (row.last_seen_at as string | null) ?? null,
      conversationCount: convCount,
    };
  });

  return NextResponse.json({ customers });
}
