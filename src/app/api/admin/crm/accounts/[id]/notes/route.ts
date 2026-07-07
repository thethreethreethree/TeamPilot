import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { addNote, listNotes } from "@/lib/crm/data";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";

const NewNoteSchema = z
  .object({
    body: z.string().min(1).max(4000),
    pinned: z.boolean().optional(),
  })
  .strict();

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Vendor-admin only (audit 2026-07-07, CRITICAL) — admin AND vendor company.
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate;
  const { id } = await context.params;
  const notes = await listNotes(id);
  return NextResponse.json({ notes });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Vendor-admin only (audit 2026-07-07, CRITICAL) — admin AND vendor company.
  const ctx = await requireVendorAdmin();
  if (ctx instanceof NextResponse) return ctx;
  const body = await readBody(req, NewNoteSchema);
  if (body instanceof NextResponse) return body;
  const { id } = await context.params;
  const note = await addNote({
    accountId: id,
    authorUserId: ctx.userId,
    body: body.body,
    pinned: body.pinned,
  });
  if (!note) {
    return NextResponse.json(
      { error: "Couldn't add note." },
      { status: 500 }
    );
  }
  return NextResponse.json({ note });
}
