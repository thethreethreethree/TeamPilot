import { NextRequest, NextResponse } from "next/server";
import { generateOutsideViews } from "@/lib/diagnosis/outsideView";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";

export async function POST(req: NextRequest) {
  try {
    const { currentRead, evidenceSummary, count } = await req.json();

    if (typeof currentRead !== "string" || !currentRead.trim()) {
      return NextResponse.json(
        {
          error:
            "Your current read is required. An outside view challenges an existing framing.",
        },
        { status: 400 }
      );
    }
    if (typeof evidenceSummary !== "string") {
      return NextResponse.json(
        { error: "Evidence summary is required." },
        { status: 400 }
      );
    }

    const companyId = (await getCurrentCompanyId()) ?? undefined;
    const readings = await generateOutsideViews({
      currentRead,
      evidenceSummary,
      count: typeof count === "number" ? count : 3,
      companyId,
    });
    return NextResponse.json({ readings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
