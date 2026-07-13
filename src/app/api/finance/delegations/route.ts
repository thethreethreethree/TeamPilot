import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { supabaseEnabled } from "@/lib/supabase/config";
import { readBody } from "@/lib/api/validate";

/**
 * Approval delegation (migration 0168).
 *
 * GET  /api/finance/delegations — who has lent approval authority to whom, and for how long.
 * POST /api/finance/delegations — delegate (from yourself only) · revoke.
 *
 * THIS ROUTE DELIBERATELY ACCEPTS NO `delegatorId`.
 *
 * That absence is the security model. The delegator is ALWAYS auth.uid(), taken from the session and
 * never from the request body. If this endpoint accepted a delegatorId, a member could post
 * `{ delegatorId: "<the CFO>", delegateId: "<themselves>" }` and become a CFO — with an audit trail that
 * names the CFO as the source of authority and would survive any reconciliation, because nothing in the
 * ledger would ever disagree with itself.
 *
 * RLS enforces the same rule independently (INSERT requires delegator_id = auth.uid()), so a direct
 * PostgREST call cannot route around this route. Both layers say the same thing, which is the point: the
 * API shape makes the attack unrepresentable, and the database makes it impossible.
 *
 * What is delegated: the capability to approve, capped at the delegator's own limit.
 * What is NOT delegated: segregation of duties. A delegate still cannot approve what they created.
 */

export async function GET() {
  if (!supabaseEnabled) return NextResponse.json({ delegations: [] });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const { data, error } = await sb
    .from("fin_approval_delegations")
    .select("id, delegator_id, delegate_id, starts_on, ends_on, reason, revoked_at, created_at")
    .order("starts_on", { ascending: false });

  // "Nobody has delegated anything" and "we could not read the delegations" are different claims — and on
  // an authority table, the second one being mistaken for the first is how a live delegation goes unseen.
  if (error) return NextResponse.json({ error: "Could not load delegations." }, { status: 500 });
  return NextResponse.json({ delegations: data ?? [] });
}

const ActionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("delegate"),
      // NOTE the absence of delegatorId. It is not omitted by oversight — accepting it would be the
      // vulnerability. The delegator is the session, always.
      delegateId: z.string().uuid(),
      startsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      endsOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      reason: z.string().max(200).optional(),
    })
    .strict()
    .refine((v) => v.endsOn >= v.startsOn, {
      message: "The delegation must end on or after it starts.",
    }),
  z.object({ action: z.literal("revoke"), id: z.string().uuid() }).strict(),
]);

export async function POST(req: NextRequest) {
  if (!supabaseEnabled) return NextResponse.json({ error: "Live mode required." }, { status: 400 });
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });

  const b = await readBody(req, ActionSchema);
  if (b instanceof NextResponse) return b;

  if (b.action === "delegate") {
    // The RPC re-checks that the CALLER actually holds approval authority — you cannot delegate what you
    // do not have. Without that, two people with no authority could delegate to each other and
    // manufacture an approver out of nothing. It is not re-implemented here; a second, weaker copy of an
    // authz rule is how the two drift apart.
    const { data, error } = await sb.rpc("fin_delegate_approval", {
      p_delegate_id: b.delegateId,
      p_starts: b.startsOn,
      p_ends: b.endsOn,
      p_reason: b.reason ?? null,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 403 });
    return NextResponse.json({ id: data });
  }

  // Revocation is RPC-only by design: there is no UPDATE policy on the table, because an update path
  // would let someone silently EXTEND a delegation's window — quietly restoring authority that was meant
  // to have lapsed, with an audit trail showing nothing happened.
  const { error } = await sb.rpc("fin_revoke_delegation", { p_id: b.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 403 });
  return NextResponse.json({ ok: true });
}
