import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCueRelianceSeries } from "@/lib/data/salesCoach";

/**
 * Live Sales Coach — progress signal (§3.6 make-learning-visible, §3.5).
 *
 * Returns the current agent's cue-reliance series (cues per ended
 * session, oldest → newest). The founder's "training wheels come off"
 * intent: a downward trend = needing fewer live cues over time, measured
 * against the agent's OWN past (not a ranking against others, §A18).
 *
 * Honest about sparsity: a single session is not a trend. The endpoint
 * returns the raw series + the count; the UI is responsible for not
 * claiming a trend from one or two points.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const series = await getCueRelianceSeries(auth.user.id);
  return NextResponse.json({ series, sessions: series.length });
}
