import { NextRequest, NextResponse } from "next/server";
import { sweepDurabilityChecks } from "@/lib/care/durabilitySweep";

/**
 * GET /api/care/durability-sweep-cron
 *
 * Vercel Cron entry point. Configured in vercel.json:
 *
 *   {
 *     "crons": [
 *       { "path": "/api/care/durability-sweep-cron", "schedule": "0 * * * *" }
 *     ]
 *   }
 *
 * Vercel automatically attaches `Authorization: Bearer ${CRON_SECRET}`
 * to scheduled invocations when CRON_SECRET is set in env. We verify
 * it. Manual GETs (developer hits the URL in a browser) bounce off
 * the same gate.
 *
 * Per Vercel docs (https://vercel.com/docs/cron-jobs/manage-cron-jobs):
 *   - Cron jobs always GET.
 *   - The bearer secret is the same env var you'd use for any other
 *     internal route protection.
 *
 * External / non-Vercel cron consumers use the sibling POST route
 * /api/care/durability-sweep with its own shared secret header.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      {
        error:
          "CRON_SECRET is not set. The Vercel Cron entry point is disabled until you configure it in env.",
      },
      { status: 503 }
    );
  }
  const header = req.headers.get("authorization") ?? "";
  if (header !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: "Cron authentication failed." },
      { status: 401 }
    );
  }

  try {
    const result = await sweepDurabilityChecks();
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Sweep failed." },
      { status: 500 }
    );
  }
}
