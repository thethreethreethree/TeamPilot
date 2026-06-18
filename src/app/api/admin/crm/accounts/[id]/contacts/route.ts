import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { addContact, listContacts } from "@/lib/crm/data";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";

const NewContactSchema = z
  .object({
    fullName: z.string().min(1).max(200),
    email: z.string().email().nullable().optional(),
    role: z.string().max(120).nullable().optional(),
    isPrimary: z.boolean().optional(),
    isDecisionMaker: z.boolean().optional(),
    notes: z.string().max(4000).nullable().optional(),
  })
  .strict();

async function gate() {
  const ctx = await getCurrentAuthContext();
  if (!ctx) {
    return NextResponse.json(
      { error: "Not authenticated." },
      { status: 401 }
    );
  }
  if (!ctx.isAdmin) {
    return NextResponse.json(
      { error: "CRM is vendor admin only." },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const g = await gate();
  if (g) return g;
  const { id } = await context.params;
  const contacts = await listContacts(id);
  return NextResponse.json({ contacts });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const g = await gate();
  if (g) return g;
  const body = await readBody(req, NewContactSchema);
  if (body instanceof NextResponse) return body;
  const { id } = await context.params;
  const contact = await addContact({
    accountId: id,
    fullName: body.fullName,
    email: body.email ?? null,
    role: body.role ?? null,
    isPrimary: body.isPrimary,
    isDecisionMaker: body.isDecisionMaker,
    notes: body.notes ?? null,
  });
  if (!contact) {
    return NextResponse.json(
      { error: "Couldn't add contact." },
      { status: 500 }
    );
  }
  return NextResponse.json({ contact });
}
