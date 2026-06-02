import { NextResponse } from "next/server";
import { runLearningCycle } from "@/lib/brain/learn";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";

export async function POST() {
  const companyId = await getCurrentCompanyId();
  if (!companyId) {
    return NextResponse.json(
      { error: "Not authenticated or no company." },
      { status: 401 }
    );
  }
  const result = await runLearningCycle(companyId);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
