import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getCurrentSalesCorpus,
  listAgentSessions,
} from "@/lib/data/salesCoach";
import { getSalesKnowledgeBase } from "@/lib/coach/v5/salesKnowledgeBase";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * Sales Coach → Strategy Library (founder 2026-07-05, decision 2026-07-06).
 *
 * Rep-facing, read-only. Returns the "sales strategies" (the company's
 * admin-authored methodology + product corpus, migrations 0074/0078) and the
 * rep's OWN "correct lines" — the ideal lines the coach surfaced on their past
 * breakdown moments, aggregated from their after_pitch_summaries (0080).
 *
 * PRIVACY (A18): correct lines come ONLY from the caller's own summaries. The
 * after_pitch_summaries RLS is owner-only, so this user-client query can never
 * read another rep's lines — the founder's chosen "own only" scope is enforced
 * structurally, not just here. A team-wide board would need a separate
 * anonymized, scores-stripped path (deferred).
 *
 * The corpus is read via getCurrentSalesCorpus (service role) — it's shared
 * company methodology, not private, and the sales-coach layout already gates
 * access to members. §3.4: booksGrounded reflects whether the KB is actually
 * present, never an aspiration.
 */

type CorrectLine = {
  correctLine: string;
  whyItWorks: string;
  context: string | null;
  sessionLabel: string | null;
  outcome: string | null;
  at: string;
};

export async function GET(req: NextRequest) {
  // Consistency with the sibling coach routes (audit F1, A13) — a cheap read,
  // so a lenient cap.
  const limited = rateLimit(req, {
    id: "coach-strategy-library",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const companyId = (profile?.company_id as string | null) ?? null;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  const [methodology, product] = await Promise.all([
    getCurrentSalesCorpus(companyId, "methodology").catch(() => null),
    getCurrentSalesCorpus(companyId, "product").catch(() => null),
  ]);
  const booksGrounded = getSalesKnowledgeBase().length > 0;

  // The rep's own correct lines. RLS on after_pitch_summaries is owner-only;
  // the explicit agent_id filter is defense-in-depth + clarity.
  const { data: rows } = await sb
    .from("after_pitch_summaries")
    .select("payload, session_id, created_at")
    .eq("agent_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(200);

  // Session labels/outcomes for context, fetched once (avoid N+1). Window
  // matched to the summaries query so a correct line's label isn't dropped
  // for a rep with many sessions (audit F7).
  const sessions = await listAgentSessions(auth.user.id, 200).catch(() => []);
  const bySession = new Map(sessions.map((s) => [s.id, s]));

  const seenSession = new Set<string>();
  const correctLines: CorrectLine[] = [];
  for (const row of rows ?? []) {
    const sid = row.session_id as string;
    // Append-only: multiple summaries per session on regeneration. Rows are
    // newest-first, so the first one we see per session IS the latest.
    if (seenSession.has(sid)) continue;
    seenSession.add(sid);

    const payload = row.payload as {
      moments?: Array<{
        label?: string;
        kind?: string;
        correction?: { correctLine?: string; whyItWorks?: string } | null;
      }>;
    } | null;
    const moments = Array.isArray(payload?.moments) ? payload.moments : [];
    const sess = bySession.get(sid);
    for (const m of moments) {
      const c = m?.correction;
      const line = typeof c?.correctLine === "string" ? c.correctLine.trim() : "";
      const why = typeof c?.whyItWorks === "string" ? c.whyItWorks.trim() : "";
      if (!line || !why) continue;
      const ctx =
        m.label && m.label.trim()
          ? m.label.trim()
          : m.kind && m.kind.trim()
            ? m.kind.trim()
            : null;
      correctLines.push({
        correctLine: line,
        whyItWorks: why,
        context: ctx,
        sessionLabel: sess?.clientLabel ?? null,
        outcome: sess?.outcome ?? null,
        at: row.created_at as string,
      });
    }
  }

  return NextResponse.json({
    methodology: methodology?.content ?? null,
    product: product?.content ?? null,
    booksGrounded,
    correctLines: correctLines.slice(0, 30),
  });
}
