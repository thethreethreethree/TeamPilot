import { NextRequest, NextResponse } from "next/server";
import { generateDailyQuestions } from "@/lib/claude";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const context = JSON.stringify(body, null, 2);
    const companyId = (await getCurrentCompanyId()) ?? undefined;
    const r = await generateDailyQuestions(context, { companyId });
    if (r.suppressed) {
      return NextResponse.json(
        {
          suppressed: true,
          reason: r.reason,
          // Honest empty payload — never a fake "result" while suppressed.
          todaysQuestions: [],
          uncertainties: [],
          thingsWorthNoticing: [],
        },
        { status: 200 }
      );
    }
    const parsed = JSON.parse(r.text);
    return NextResponse.json({ ...parsed, provider: r.provider, model: r.model });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
