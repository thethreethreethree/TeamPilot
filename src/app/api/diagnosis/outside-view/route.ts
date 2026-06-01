import { NextRequest, NextResponse } from "next/server";
import { generateOutsideViews } from "@/lib/diagnosis/outsideView";

/**
 * §1.3 — Outside-Perspective Identification.
 *
 * Returns N alternative readings of the situation, each challenging a specific
 * assumption in the current read. The user's current read is REQUIRED — without
 * it there is nothing for an outside view to challenge.
 */
export async function POST(req: NextRequest) {
  try {
    const { currentRead, evidenceSummary, count } = await req.json();

    if (typeof currentRead !== "string" || !currentRead.trim()) {
      return NextResponse.json(
        {
          error:
            "Your current read is required. An outside view challenges an existing framing — without one stated, there is nothing to challenge.",
        },
        { status: 400 }
      );
    }
    if (typeof evidenceSummary !== "string") {
      return NextResponse.json(
        { error: "Evidence summary (signals + patterns) is required." },
        { status: 400 }
      );
    }

    const readings = await generateOutsideViews({
      currentRead,
      evidenceSummary,
      count: typeof count === "number" ? count : 3,
    });

    return NextResponse.json({ readings });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
