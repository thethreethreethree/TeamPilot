import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, findAuthUsersByEmails } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/api/rateLimit";
import { isAdminRole, isInvitableRole } from "@/lib/roles";
import { isSalesCoachManager } from "@/lib/coach/v5/skillAccess";
import { assertValidManager, TreeError, type Person as TreePerson } from "@/lib/coach/remote/access";
import { createInvitation } from "@/lib/team/createInvitation";
import { setMemberRole } from "@/lib/team/setMemberRole";
import { parseTeamCsv, planImport, type RowPlan } from "@/lib/team/teamCsv";

/**
 * POST /api/team/import — add a team from a CSV (RSS Phase 9; Gong F2.8). Company admins only.
 * Body: { csv, apply }. apply=false returns what WOULD happen, row by row; apply=true does it.
 *   · new emails → createInvitation, the same function (and escalation / duplicate gates) as inviting one person,
 *     on the caller's own client so the team_invitations RLS still applies;
 *   · managers → set now only when both people are already on the team, through assertValidManager over the whole
 *     company tree (the rule /api/team/set-manager uses; the 0272 trigger is the database backstop), checked row by
 *     row against the tree as earlier rows change it.
 * A file with any row error imports nothing: the admin fixes the file, so no one is half-imported by accident.
 */
export const maxDuration = 120;

type Outcome = { line: number; email: string; result: string; ok: boolean; inviteCode?: string };

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "team-import", windowMs: 60_000, max: 10 });
  if (limited) return limited;
  const ctx = await getCurrentAuthContext();
  if (!ctx) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  if (!ctx.isAdmin) return NextResponse.json({ error: "Only a team admin can import a team." }, { status: 403 });
  let b: { csv?: unknown; apply?: unknown };
  try {
    b = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected a JSON body." }, { status: 400 });
  }
  const csv = typeof b.csv === "string" ? b.csv : "";
  if (!csv.trim()) return NextResponse.json({ error: "Choose a CSV file." }, { status: 400 });
  if (csv.length > 200_000) return NextResponse.json({ error: "That file is too large." }, { status: 400 });

  const parsed = parseTeamCsv(csv, isInvitableRole);
  if (parsed.errors.length) {
    return NextResponse.json({ errors: parsed.errors, warnings: parsed.warnings, plan: null }, { status: b.apply ? 400 : 200 });
  }

  const sb = createAdminClient();
  let accounts: Map<string, string[]>;
  try {
    accounts = await findAuthUsersByEmails(parsed.rows.flatMap((r) => [r.email, ...(r.managerEmail ? [r.managerEmail] : [])]));
  } catch (err) {
    console.error("[team/import] account lookup failed:", err);
    return NextResponse.json({ error: "Couldn't check which of these people already have accounts. Nothing was imported." }, { status: 503 });
  }
  const { data: profs, error: pErr } = await sb
    .from("profiles")
    .select("id, company_id, manager_id, role, sales_coach_role, status")
    .eq("company_id", ctx.companyId);
  const { data: invs, error: iErr } = await sb
    .from("team_invitations")
    .select("email")
    .eq("company_id", ctx.companyId)
    .is("accepted_at", null)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString());
  if (pErr || iErr) {
    console.error(`[team/import] team read failed company=${ctx.companyId}: ${(pErr ?? iErr)?.message}`);
    return NextResponse.json({ error: "Couldn't load your team. Nothing was imported." }, { status: 500 });
  }
  const rows = (profs ?? []) as Array<Record<string, unknown>>;
  const members = new Map(rows.map((r) => [String(r.id), { id: String(r.id), status: String(r.status), role: (r.role as string | null) ?? null }]));
  const pending = new Set(((invs ?? []) as Array<{ email: string }>).map((i) => i.email.toLowerCase()));
  const plan = planImport(parsed.rows, accounts, members, pending);

  // The tree as it is, then as each "set" row would leave it: a later row is checked against the earlier ones.
  const people: TreePerson[] = rows.map((r) => ({
    id: String(r.id),
    companyId: String(r.company_id),
    managerId: (r.manager_id as string | null) ?? null,
    isCompanyAdmin: isAdminRole(r.role as string | null),
    isSalesCoachManager: isSalesCoachManager({
      role: (r.role as string | null) ?? null,
      sales_coach_role: (r.sales_coach_role as string | null) ?? null,
      company_id: String(r.company_id),
    }),
  }));
  const loops = new Set<number>();
  for (const p of plan) {
    if (p.manager !== "set" || !p.personId || !p.managerId) continue;
    try {
      assertValidManager(p.personId, p.managerId, people);
      const me = people.find((x) => x.id === p.personId);
      if (me) me.managerId = p.managerId;
    } catch (e) {
      if (!(e instanceof TreeError)) throw e;
      loops.add(p.line);
    }
  }

  const describe = (p: RowPlan) => ({
    line: p.line,
    email: p.email,
    person: p.person,
    role: p.role ?? "Member",
    // F2.8: an existing member whose role changes ("Member → Manager"); null when it doesn't.
    roleChange: p.roleChanges && p.role ? { from: p.roleFrom, to: p.role } : null,
    manager: loops.has(p.line) ? "loop" : p.manager,
    managerEmail: p.managerEmail,
  });
  if (!b.apply) return NextResponse.json({ errors: [], warnings: parsed.warnings, plan: plan.map(describe) });

  const caller = { supabase: await createClient(), companyId: ctx.companyId, userId: ctx.userId };
  const out: Outcome[] = [];
  for (const p of plan) {
    if (p.person === "invite") {
      const r = await createInvitation(caller, p.email, p.role ?? "Member", {
        managerId: p.manager === "on_join" ? p.managerId : null,
        knownAccountIds: accounts.get(p.email) ?? [], // already looked up in one pass (review #3)
      });
      const said =
        p.manager !== "on_join" ? "invited"
        : r.ok && r.managerCarried ? `invited; will report to ${p.managerEmail} when they join`
        : `invited; set their manager (${p.managerEmail}) after they join`;
      out.push(r.ok ? { line: p.line, email: p.email, ok: true, result: said, inviteCode: r.code } : { line: p.line, email: p.email, ok: false, result: r.error });
    } else if (p.roleChanges && p.personId && p.role) {
      // The Team page's own rules (setMemberRole), one row at a time — so "never the last admin" is re-checked after
      // each earlier row's change.
      const r = await setMemberRole(sb, ctx.companyId, p.personId, p.role);
      out.push(r.ok ? { line: p.line, email: p.email, ok: true, result: `role: ${p.roleFrom ?? "none"} → ${p.role}` } : { line: p.line, email: p.email, ok: false, result: r.error });
    } else if (p.person === "ambiguous") {
      out.push({ line: p.line, email: p.email, ok: false, result: "More than one account uses this email; add them on the Team page." });
    }
    if (p.manager === "set" && p.personId && p.managerId && !loops.has(p.line)) {
      const { error } = await sb.from("profiles").update({ manager_id: p.managerId }).eq("id", p.personId).eq("company_id", ctx.companyId);
      out.push(error ? { line: p.line, email: p.email, ok: false, result: "Couldn't set their manager." } : { line: p.line, email: p.email, ok: true, result: `now reports to ${p.managerEmail}` });
      if (error) console.error(`[team/import] manager update failed member=${p.personId}: ${error.message}`);
    }
  }
  return NextResponse.json({ errors: [], warnings: parsed.warnings, plan: plan.map(describe), results: out });
}
