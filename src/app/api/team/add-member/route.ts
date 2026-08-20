import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { createAdminClient, findAuthUserByEmail } from "@/lib/supabase/admin";

/**
 * Streamlined "Add agent" (2026-08-21 urgent client build). Adds a team member by email — no manual invite link:
 *
 *   - mode "existing": the email already has an Elostate / Sales Coach account → attach them to THIS company
 *     immediately (no invite, no password). The multi-company complication (a person already on another team) is
 *     a deliberate DEFERRED item per the founder — for now the add is direct.
 *
 *   - mode "new": brand-new person (no account) → the admin creates their login with a picked TEAM PASSWORD as
 *     the initial password, and the app forces them to set their own password on first login
 *     (must_change_password). The admin distributes the team password out-of-band.
 *
 * Admin-only, service-role (privileged profile columns are guarded — 0090/0091 — so only service-role/definer may
 * set company_id / role / sales_coach_role / must_change_password), company-pinned (INV15).
 */
export const maxDuration = 20;

const SalesCoachRole = z.enum(["staff", "admin"]).nullable().optional();
const Body = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("existing"), email: z.string().email().max(200), salesCoachRole: SalesCoachRole }),
  z.object({ mode: z.literal("new"), email: z.string().email().max(200), teamPasswordId: z.string().uuid(), salesCoachRole: SalesCoachRole }),
]);

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "team-add-member", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a team admin can add members." }, { status: 403 });

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const email = body.email.toLowerCase().trim();
  const salesCoachRole = body.salesCoachRole ?? null;
  const sb = createAdminClient();

  if (body.mode === "existing") {
    const existing = await findAuthUserByEmail(email);
    if (!existing) {
      return NextResponse.json(
        { error: "No Elostate account was found for that email. Add them as a new user (with a team password) instead." },
        { status: 404 },
      );
    }
    // Attach to this company. company_id pinned to the caller's session (INV15). role defaults to team Member;
    // service-role bypasses the privileged-column guard. (Deferred: this reassigns a person who is already on
    // another team — the founder's acknowledged future complication.)
    const { error } = await sb
      .from("profiles")
      .upsert({ id: existing.id, company_id: ctx.companyId, role: "Member", sales_coach_role: salesCoachRole, status: "active" }, { onConflict: "id" });
    if (error) {
      console.error("[team/add-member existing] upsert failed:", error.message);
      return NextResponse.json({ error: "Couldn't add that member." }, { status: 500 });
    }
    return NextResponse.json({ ok: true, mode: "existing", userId: existing.id });
  }

  // mode "new": must NOT already have an account.
  const clash = await findAuthUserByEmail(email);
  if (clash) {
    return NextResponse.json(
      { error: "That email already has an account. Add them as an existing user instead (no password needed)." },
      { status: 409 },
    );
  }

  // Resolve the picked team password (company-pinned) → its secret is the new user's initial login password.
  const { data: tp, error: tpErr } = await sb
    .from("team_passwords")
    .select("secret")
    .eq("id", body.teamPasswordId)
    .eq("company_id", ctx.companyId)
    .is("revoked_at", null)
    .single();
  if (tpErr || !tp?.secret) {
    return NextResponse.json({ error: "Pick a valid team password before adding a new user." }, { status: 400 });
  }

  // Create the auth login with the team password as the initial credential (email pre-confirmed — the admin
  // vouches for them; no confirmation email to chase).
  const { data: created, error: createErr } = await sb.auth.admin.createUser({
    email,
    password: tp.secret,
    email_confirm: true,
  });
  if (createErr || !created?.user) {
    console.error("[team/add-member new] createUser failed:", createErr?.message);
    return NextResponse.json({ error: "Couldn't create that user. They may already have an account." }, { status: 500 });
  }

  // Provision the membership + FORCE a password change on first login. handle_new_user creates the profile shell
  // on the auth insert; upsert pins the company + role + must_change_password (service-role bypasses the guards).
  const { error: profErr } = await sb
    .from("profiles")
    .upsert(
      { id: created.user.id, company_id: ctx.companyId, role: "Member", sales_coach_role: salesCoachRole, must_change_password: true, status: "active" },
      { onConflict: "id" },
    );
  if (profErr) {
    console.error("[team/add-member new] profile upsert failed:", profErr.message);
    // The auth user exists but has no membership — remove it so a retry is clean (no orphaned half-added account).
    await sb.auth.admin.deleteUser(created.user.id).catch(() => {});
    return NextResponse.json({ error: "Couldn't finish adding that user. Please try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, mode: "new", userId: created.user.id });
}
