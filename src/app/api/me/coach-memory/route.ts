import { NextResponse } from "next/server";
import { loadCoachMemory } from "@/lib/coach/v5/memory";

/**
 * GET /api/me/coach-memory
 *
 * Returns the calling user's cross-conversation Coach memory
 * snapshot — top recurring patterns, grade mix, total counts.
 *
 * §3.6 make-learning-visible: the System's accumulated read on a
 * user IS something the user can see about themselves. This
 * endpoint serves the /dashboard/my-growth page (the user-facing
 * view) so the same data the Coach uses internally is symmetric
 * with what the user sees — A10 in code.
 *
 * The loader (src/lib/coach/v5/memory.ts) already enforces:
 *   - actor = auth.uid() scoping (you only see YOUR memory)
 *   - 30-day window
 *   - sparse-data silence (returns empty snapshot if N too small)
 *
 * So this route is a thin HTTP wrapper — no extra auth or scoping
 * logic needed.
 */

export async function GET() {
  const snapshot = await loadCoachMemory();
  return NextResponse.json({ snapshot });
}
