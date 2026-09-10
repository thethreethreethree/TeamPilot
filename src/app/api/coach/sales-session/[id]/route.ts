import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { readBody } from "@/lib/api/validate";
import {
  getSession,
  getSessionTranscript,
  setSessionStatus,
  renameSession,
} from "@/lib/data/salesCoach";

/**
 * Live Sales Coach — single session.
 *
 * GET   → the session + its full diarized transcript (RLS-scoped).
 * PATCH → forward-only status change ('ended' | 'reviewed'),
 *         optionally attaching the stored audio asset pointer.
 */

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;

  /*
   * A MALFORMED ID IS NOT-FOUND, NOT A SERVER ERROR. Without this, `/sales-session/anything`
   * reaches Postgres as a uuid comparison, the driver rejects it, `getSession` rethrows
   * (deliberately — it must never collapse a transient error into a silent null), and the
   * caller gets a 500. Verified against production 10 September 2026: `not-a-uuid` and
   * `zzzz` both returned 500 while a well-formed but absent id correctly returned 404.
   *
   * A 500 says "we broke"; a typo in a URL is the caller's, and answering it honestly is a
   * 404. The check is on the SHAPE only — whether the row exists, and whether this caller may
   * see it, stays with RLS below.
   */
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  /*
   * THE CALLER'S OWN CLIENT HAS TO REACH THE READ, and it did not.
   *
   * This route already resolved a Bearer-scoped client for AUTH and then called `getSession`
   * and `getSessionTranscript` with no client at all — so those read through the default
   * cookie client. A phone sends no cookie, so the read ran ANONYMOUSLY, RLS returned
   * nothing, and the route answered 404 "not found or not accessible" for a session the
   * caller owns. Verified against production with a real Bearer token: the founder's own
   * session 404ed.
   *
   * The invariant audit does not catch this shape. It looks for a BARE cookie client in a
   * route that never mentions `callerScopedDb`; this route mentions it, uses it for auth, and
   * still reads anonymously — so the audit reads green while the route is broken for every
   * mobile caller.
   */
  const session = await getSession(id, supabase);
  if (!session) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }
  const transcript = await getSessionTranscript(id, supabase);
  return NextResponse.json({ session, transcript });
}

// A PATCH is EITHER a forward-only status change OR a rename (spec 1b: name the
// session after recording). status is now optional so a pure rename doesn't have
// to fake a transition; the refine guarantees at least one real change.
const PatchSchema = z
  .object({
    status: z.enum(["ended", "reviewed"]).optional(),
    // NOTE: no audioAssetUrl here. The audio pointer is written ONLY by the
    // upload-recording route, in the bucket-relative `${ASSETS_BUCKET}/…` shape
    // the retention cron can purge. This field used to accept a full `z.url()`
    // — the exact shape the recording-purge cron flags `malformed` and never
    // deletes — so a caller setting it would have silently created audio that
    // survives past the 2-day retention promise. It was unused (no caller sent
    // it); removed so the write boundary can only ever store a purgeable shape
    // (§3.4 — don't accept data you can't honor the deletion promise on). If a
    // PATCH-sets-audio flow is ever wanted, it must take the storage PATH, not
    // a URL, so it stays purgeable.
    clientLabel: z.string().trim().min(1).max(120).optional(),
  })
  .refine((b) => b.status !== undefined || b.clientLabel !== undefined, {
    message: "Nothing to update — provide a status or a new label.",
  });

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const body = await readBody(req, PatchSchema);
  if (body instanceof NextResponse) return body;

  const supabase = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  // RLS-scoped read gates access: a user can only see sessions in their
  // own company, so a successful getSession authorizes the transition.
  const existing = await getSession(id);
  if (!existing) {
    return NextResponse.json(
      { error: "Session not found or not accessible." },
      { status: 404 }
    );
  }

  // Rename first (spec 1b), then any status change — so a single PATCH that both
  // renames and ends works, and a pure rename never touches the lifecycle.
  let updated = existing;
  if (body.clientLabel !== undefined) {
    // AUTHZ (audit 2026-07-15): getSession is company-scoped (a member sees any
    // session in their company), which is the right bar for a status transition a
    // manager may make — but NOT for a rename. Renaming is "name YOUR call", so a
    // rename must be OWNER-ONLY, or any company member could relabel a colleague's
    // session via a direct API call (the UI already only offers it to the owner;
    // this closes the same gap at the API, where the UI guard can't reach).
    if (existing.agentId !== auth.user.id) {
      return NextResponse.json(
        { error: "Only the session's owner can rename it." },
        { status: 403 }
      );
    }
    const renamed = await renameSession(id, body.clientLabel);
    if (!renamed) {
      return NextResponse.json({ error: "Couldn't rename the session." }, { status: 500 });
    }
    updated = renamed;
  }
  if (body.status !== undefined) {
    const transitioned = await setSessionStatus({
      sessionId: id,
      status: body.status,
    });
    if (!transitioned) {
      return NextResponse.json(
        { error: "Couldn't update the session." },
        { status: 500 }
      );
    }
    updated = transitioned;
  }
  return NextResponse.json({ session: updated });
}
