import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { resolveApiAuth } from "@/lib/api/resolveApiAuth";
import { currentlyMuted, MUTABLE_NOTIFICATION_TYPES } from "@/lib/notifications/mutes";

/**
 * /api/me/notification-mutes (0334; Gong F30.1). GET: the caller's muted FYI types. PUT { type, muted }: switch one.
 * Only the four FYI types exist here (the enum and the DB CHECK); action notices can't be muted. The user and company
 * come from the session, never the body; each change is a new row.
 */
const Put = z.object({ type: z.enum(MUTABLE_NOTIFICATION_TYPES), muted: z.boolean() });

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { id: "notification-mutes-read", windowMs: 60_000, max: 60 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const db = callerScopedDb(req) ?? (await createClient());
  const { data, error } = await db.from("notification_mutes").select("id, type, muted").eq("user_id", ctx.userId);
  if (error) {
    console.error(`[notification-mutes] read failed user=${ctx.userId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't load your notification settings." }, { status: 500 });
  }
  return NextResponse.json({ muted: currentlyMuted((data ?? []) as Array<{ id: number; type: string; muted: boolean }>) });
}

export async function PUT(req: NextRequest) {
  const limited = rateLimit(req, { id: "notification-mutes-write", windowMs: 60_000, max: 30 });
  if (limited) return limited;
  const ctx = await resolveApiAuth(req);
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const body = await readBody(req, Put);
  if (body instanceof NextResponse) return body;
  const { error } = await createAdminClient()
    .from("notification_mutes")
    .insert({ company_id: ctx.companyId, user_id: ctx.userId, type: body.type, muted: body.muted });
  if (error) {
    console.error(`[notification-mutes] write failed user=${ctx.userId}: ${error.message}`);
    return NextResponse.json({ error: "Couldn't save that." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, type: body.type, muted: body.muted });
}
