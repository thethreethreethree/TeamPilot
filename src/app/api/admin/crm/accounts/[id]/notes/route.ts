import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { addNote, listNotes } from "@/lib/crm/data";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";

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
  const { id } = await context.params;
  const notes = await listNotes(id);
  return NextResponse.json({ notes });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
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
