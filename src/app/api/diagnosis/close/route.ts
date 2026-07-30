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

    const supabase = await createClient();
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
