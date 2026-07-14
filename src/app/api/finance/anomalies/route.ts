import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * Spend anomalies (0174).
 *
 * There is no scoring here, and no model. Every row is a definite fact about a document that exists, and
 * it arrives carrying its own explanation in words.
 *
 * That is a deliberate refusal. A statistical outlier detector would have been easier and would demo far
 * better — but an anomaly list that cries wolf is worse than no anomaly list at all. A controller who opens
 * it and finds fourteen "anomalies" that are all just a larger-than-usual electricity bill learns, within
 * about two weeks, to close the tab without reading it. And then the one entry that was a bill split to
 * dodge an approval limit scrolls past unread — in a system that reported it, which is worse than one that
 * never claimed to look.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ anomalies: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb
    .from("fin_anomalies")
    .select("kind, occurred_on, amount, vendor_name, reason")
    .order("amount", { ascending: false })
    .limit(100);

  // "We found nothing" and "we could not look" are different claims, and on a fraud-detection surface the
  // second being rendered as the first is the whole problem: an empty green list is read as an all-clear.
  if (error) {
    return NextResponse.json({ error: "Could not check for anomalies." }, { status: 500 });
  }

  return NextResponse.json({ anomalies: data ?? [] });
}
