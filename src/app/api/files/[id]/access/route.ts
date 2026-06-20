import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/files/[id]/access    — list current specific-people grants
 * POST /api/files/[id]/access   — add a grant: { profileId }
 * DELETE /api/files/[id]/access — remove a grant: { profileId }
 *
 * Per §A11: uploader and admins manage the whitelist. Per §A10:
 * the uploader always sees their own file regardless, so the
 * whitelist only matters for OTHERS to gain access.
 */
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "files-access-list",
    windowMs: 60_000,
    max: 120,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { id } = await context.params;

  // Per migration 0063: file_access_grants_select RLS is tightened
  // to grantee-only to break the cycle with files_select. The file
  // OWNER viewing their own file's grants now routes through this
  // endpoint, which uses the admin client and verifies the caller
  // is the uploader OR a company admin. This is a STRONGER
  // authorization than the RLS allowed before — RLS only checked
  // membership; here we check ownership-or-admin explicitly.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: file } = await admin
    .from("files")
    .select("uploader_id, company_id")
    .eq("id", id)
    .is("deprecated_at", null)
    .maybeSingle();
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const isUploader = (file.uploader_id as string | null) === auth.userId;
  const sameCompany = (file.company_id as string) === auth.companyId;
  if (!isUploader && !(auth.isAdmin && sameCompany)) {
    return NextResponse.json(
      { error: "Only the file's uploader or a company admin can list grants." },
      { status: 403 }
    );
  }

  const { data, error } = await admin
    .from("file_access_grants")
    .select("profile_id, granted_by, granted_at")
    .eq("file_id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ grants: data ?? [] });
}

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "files-access-add",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { id } = await context.params;
  let body: { profileId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.profileId) {
    return NextResponse.json({ error: "Missing profileId." }, { status: 400 });
  }
  const sb = await createClient();
  const { error } = await sb.from("file_access_grants").insert({
    file_id: id,
    profile_id: body.profileId,
    granted_by: auth.userId,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "files-access-remove",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { id } = await context.params;
  const profileId = req.nextUrl.searchParams.get("profileId");
  if (!profileId) {
    return NextResponse.json({ error: "Missing profileId." }, { status: 400 });
  }
  const sb = await createClient();
  const { error } = await sb
    .from("file_access_grants")
    .delete()
    .eq("file_id", id)
    .eq("profile_id", profileId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
