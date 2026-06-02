import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";

/**
 * POST /api/team/accept — accept an invitation as the currently signed-in user.
 * Body: { code: string, fullName?: string }
 *
 * Calls the SQL accept_invitation() function which is security-definer (the
 * accepting user is not yet a member of the company they're being invited to).
 */
export async function POST(req: NextRequest) {
  if (!supabaseEnabled) {
    return NextResponse.json(
      { error: "Live mode required." },
      { status: 400 }
    );
  }
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json(
      { error: "Sign in first to accept an invitation." },
      { status: 401 }
    );
  }

  const { code, fullName } = await req.json().catch(() => ({}));
  if (typeof code !== "string" || code.length === 0) {
    return NextResponse.json(
      { error: "Invitation code required." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("accept_invitation", {
    p_code: code,
    p_full_name: typeof fullName === "string" ? fullName : null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 422 });
  }
  return NextResponse.json({ companyId: data });
}
