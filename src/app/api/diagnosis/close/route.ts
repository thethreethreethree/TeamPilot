import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * §1.6 — Close the Loop.
 *
 * Persists the chosen resolution by calling the SQL close_problem() function.
 * That function is atomic: insert resolution + mark problem resolved + emit
 * problem.resolved event. Either all three happen or none do.
 */
export async function POST(req: NextRequest) {
  if (!supabaseEnabled) {
    return NextResponse.json(
      {
        error:
          "Demo mode — close-the-loop requires a live Supabase project (it writes to resolutions + events).",
      },
      { status: 400 }
    );
  }

  // Auth gate (audit 2026-07-31): close was the lone diagnosis MUTATION route with no
  // app-layer auth — its three siblings (outside-view, ripple-trace, task-overrun-sweep) all
  // gate. It relied entirely on close_problem() being SECURITY INVOKER + problems-RLS to fail
  // closed for anon / cross-tenant callers. That holds today (INVOKER → the `select company_id
  // from problems` is RLS-filtered → null → it raises + writes nothing), but it is the
  // "RLS-only mutation route = latent tenant gap" class: one createAdminClient() refactor — or a
  // close_problem→SECURITY DEFINER change, which its finance-fn siblings already are — from anon
  // injection into the append-only resolutions+events chain (§3.1). The real caller is the
  // authenticated dashboard (dashboard/diagnose), so this gate is a no-op for it.
  const supabase = await createClient();
  const { data: authData } = await supabase.auth.getUser();
  if (!authData?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const { problemId, action, reasoning, expectedOutcome } = await req.json();

    if (typeof problemId !== "string") {
      return NextResponse.json({ error: "problemId is required" }, { status: 400 });
    }
    if (typeof action !== "string" || !action.trim()) {
      return NextResponse.json({ error: "action is required" }, { status: 400 });
    }
    if (typeof reasoning !== "string" || reasoning.trim().length < 40) {
      return NextResponse.json(
        {
          error:
            "Reasoning of ≥40 chars is required. A resolution without a stated WHY is incomplete (Rule 2).",
        },
        { status: 400 }
      );
    }

    const { data, error } = await supabase.rpc("close_problem", {
      p_problem_id: problemId,
      p_action_taken: action,
      p_reasoning: reasoning,
      p_expected_outcome: expectedOutcome ?? null,
    });
    if (error) {
      console.error("[diagnosis/close] failed to close diagnosis:", error);
      return NextResponse.json({ error: "Couldn't close the diagnosis." }, { status: 500 });
    }
    return NextResponse.json({ resolutionId: data });
  } catch (err) {
    // Don't leak a raw exception message to the client (CWE-209) — log server-side, return generic.
    console.error("[diagnosis/close] unexpected error:", err);
    return NextResponse.json({ error: "Couldn't close the diagnosis." }, { status: 500 });
  }
}
