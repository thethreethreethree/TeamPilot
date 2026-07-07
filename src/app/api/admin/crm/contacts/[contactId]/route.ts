import { NextRequest, NextResponse } from "next/server";
import { deleteContact } from "@/lib/crm/data";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ contactId: string }> }
) {
  // Vendor-admin only (audit 2026-07-07, CRITICAL) — admin AND vendor company.
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;
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
