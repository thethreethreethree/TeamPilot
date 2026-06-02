import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { toCsv } from "@/lib/export/toCsv";

/**
 * GET /api/export/[entity]?format=csv|json
 *
 * Supported entities: tasks, problems, resolutions, signals, events, dialogues
 *
 * Live mode only — we don't export demo fixtures. Customers asking for export
 * want their own data.
 *
 * Returns a downloadable file with Content-Disposition: attachment so the
 * browser saves it directly rather than trying to render it.
 */

const SUPPORTED = new Set([
  "tasks",
  "problems",
  "resolutions",
  "signals",
  "events",
  "dialogues",
]);

type EntityFetcher = (
  supabase: Awaited<ReturnType<typeof createClient>>,
  companyId: string
) => Promise<Array<Record<string, unknown>>>;

const FETCHERS: Record<string, EntityFetcher> = {
  tasks: async (supabase, companyId) => {
    const { data } = await supabase
      .from("tasks")
      .select(
        "id, title, description, department, assignee, status, priority, ai_priority_score, impact_level, blocker_reason, due_date, created_at"
      )
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    return data ?? [];
  },
  problems: async (supabase, companyId) => {
    const { data } = await supabase
      .from("problems")
      .select(
        "id, kind, title, diagnosis, status, surfaced_at, resolved_at, dismissed_at, dismissal_reason, created_at"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    return data ?? [];
  },
  resolutions: async (supabase, companyId) => {
    const { data } = await supabase
      .from("resolutions")
      .select(
        "id, problem_id, action_taken, reasoning, expected_outcome, observed_outcome, durability, decided_at, reviewed_at"
      )
      .eq("company_id", companyId)
      .order("decided_at", { ascending: false });
    return data ?? [];
  },
  signals: async (supabase, companyId) => {
    const { data } = await supabase
      .from("signals")
      .select("id, kind, source, payload, observed_at, created_at")
      .eq("company_id", companyId)
      .order("observed_at", { ascending: false })
      .limit(10_000);
    return data ?? [];
  },
  events: async (supabase, companyId) => {
    const { data } = await supabase
      .from("events")
      .select("id, kind, subject, actor, payload, occurred_at, created_at")
      .eq("company_id", companyId)
      .order("occurred_at", { ascending: false })
      .limit(10_000);
    return data ?? [];
  },
  dialogues: async (supabase, companyId) => {
    const { data } = await supabase
      .from("decision_dialogues")
      .select(
        "id, decision_id, situation, user_diagnosis, user_proposal, system_engagement, system_added_perspective, system_suggestion_action, system_suggestion_why, system_comparison, chosen_path, chosen_note, decided_at, created_at"
      )
      .eq("company_id", companyId)
      .order("created_at", { ascending: false });
    return data ?? [];
  },
};

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ entity: string }> }
) {
  const { entity } = await ctx.params;
  if (!SUPPORTED.has(entity)) {
    return NextResponse.json(
      {
        error: `Unknown entity '${entity}'. Supported: ${[...SUPPORTED].join(", ")}`,
      },
      { status: 400 }
    );
  }

  if (!supabaseEnabled) {
    return NextResponse.json(
      {
        error:
          "Export requires live mode. Demo fixtures are not exported — exports are for your data.",
      },
      { status: 400 }
    );
  }

  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { error: "Not authenticated or no company." },
      { status: 401 }
    );
  }

  const format = (req.nextUrl.searchParams.get("format") ?? "csv").toLowerCase();
  if (format !== "csv" && format !== "json") {
    return NextResponse.json(
      { error: "format must be 'csv' or 'json'" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const fetcher = FETCHERS[entity]!;
  const rows = await fetcher(supabase, companyId);

  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `execos-${entity}-${stamp}.${format}`;

  if (format === "json") {
    const body = JSON.stringify(
      {
        entity,
        exportedAt: new Date().toISOString(),
        count: rows.length,
        rows,
      },
      null,
      2
    );
    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const csv = toCsv(rows);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
