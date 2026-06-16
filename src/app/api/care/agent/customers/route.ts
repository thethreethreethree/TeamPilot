import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role, company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isAgent =
    profile?.is_support_agent ||
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isAgent) {
    return NextResponse.json(
      { error: "Care is agent-only." },
      { status: 403 }
    );
  }

  // Aggregate: customers + conversation count.
  const { data } = await sb
    .from("support_customers")
    .select(
      "id, name, email, phone, lifetime_value, signup_date, last_seen_at, support_conversations(count)"
    )
    .order("last_seen_at", { ascending: false, nullsFirst: false })
    .limit(500);

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
