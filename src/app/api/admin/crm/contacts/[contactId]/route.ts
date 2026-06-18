import { NextRequest, NextResponse } from "next/server";
import { deleteContact } from "@/lib/crm/data";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ contactId: string }> }
) {
  const ctx = await getCurrentAuthContext();
  if (!ctx)
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
  if (!ctx.isAdmin)
    return NextResponse.json(
      { error: "CRM is vendor admin only." },
      { status: 403 }
    );
  const { contactId } = await context.params;
  const ok = await deleteContact(contactId);
  if (!ok) {
    return NextResponse.json(
      { error: "Couldn't delete contact." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
