import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  classifyFile,
  getFile,
} from "@/lib/data/files";
import { signAssetUrl } from "@/lib/storage/assets";
import { emitAssetEvent } from "@/lib/data/assetEvents";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "files-get",
    windowMs: 60_000,
    max: 300,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { id } = await context.params;
  // SECURITY (§A27 — load-bearing downstream property): this route has NO explicit
  // company/access check of its own before signing a download URL. Its cross-tenant
  // safety depends ENTIRELY on getFile() using the RLS-bound user client (createClient),
  // so a file the caller can't SELECT — another tenant's, or one whose access_role
  // excludes them — returns null → 404 here. RLS enforces the FULL visibility rule
  // (tenant AND access_role AND department membership), which a hand-rolled companyId
  // check could not. If getFile is ever switched to the admin client, this silently
  // becomes a cross-tenant file-bytes leak (any authenticated user GETs any file id and
  // receives a signed URL). Keep getFile RLS-bound, or add an explicit check here first.
  const file = await getFile(id);
  if (!file) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  // Sign a download URL good for 5 minutes — agent UI requests
  // a fresh one each time to avoid sharing stale links.
  const downloadUrl = await signAssetUrl({
    storagePath: file.storagePath,
    expiresInSeconds: 300,
  });
  // §3.1 chain — view + downloaded. v1 treats them as the same
  // event (signed URL issuance = intent to view-or-download); will
  // split if the §4 readout needs the distinction.
  await emitAssetEvent({
    companyId: file.companyId,
    actor: auth.userId,
    kind: "asset.file.viewed",
    fileId: file.id,
  });
  return NextResponse.json({ file, downloadUrl });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "files-patch",
    windowMs: 60_000,
    max: 60,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { id } = await context.params;
  let body: {
    departmentIds?: string[];
    taskIds?: string[];
    tags?: string[];
    title?: string;
    description?: string;
    accessRole?: "everyone" | "admins" | "ceo_admins" | "specific_people";
    userAction?: "accepted_as_is" | "edited_then_saved" | "rejected";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const file = await classifyFile({
    fileId: id,
    departmentIds: body.departmentIds ?? [],
    taskIds: body.taskIds ?? [],
    tags: body.tags ?? [],
    title: body.title,
    description: body.description,
    accessRole: body.accessRole,
  });
  if (!file) {
    return NextResponse.json({ error: "Update failed." }, { status: 500 });
  }

  // If the modal reported a user_action against a routed
  // suggestion, update the most recent pending suggestion row
  // and emit the asset.suggestion.acted_on chain event.
  if (body.userAction) {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminSb = createAdminClient();
    const { data: pending } = await adminSb
      .from("file_classification_suggestions")
      .select("id")
      .eq("file_id", id)
      .eq("user_action", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (pending?.id) {
      await adminSb
        .from("file_classification_suggestions")
        .update({
          user_action: body.userAction,
          user_acted_at: new Date().toISOString(),
        })
        .eq("id", pending.id);
      await emitAssetEvent({
        companyId: file.companyId,
        actor: auth.userId,
        kind: "asset.suggestion.acted_on",
        fileId: id,
        payload: { user_action: body.userAction },
      });
    }
  }

  return NextResponse.json({ file });
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const limited = rateLimit(req, {
    id: "files-delete",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { id } = await context.params;

  // Per the 2026-06-26 file-system audit (Finding A — "delete does
  // not work"): the prior path called deprecateFile(), which did a
  // user-scoped UPDATE and returned `!error` — TRUE even when RLS
  // silently filtered the row to zero affected rows. A failed delete
  // reported success, the route returned 200, and the file persisted
  // with no error surfaced anywhere. Root cause class: silent no-op.
  //
  // Fix mirrors the /api/files/[id]/access GET route (migration
  // 0063): use the admin client with an EXPLICIT authorization check
  // (uploader OR admin-of-same-company), then verify a row was
  // actually affected via .select(). This guarantees the deprecate
  // lands when authorized and returns a real error otherwise —
  // regardless of any RLS subtlety.
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: file } = await admin
    .from("files")
    .select("uploader_id, company_id")
    .eq("id", id)
    .is("deprecated_at", null)
    .maybeSingle();
  if (!file) {
    return NextResponse.json(
      { error: "File not found or already deleted." },
      { status: 404 }
    );
  }
  const isUploader = (file.uploader_id as string | null) === auth.userId;
  const sameCompany = (file.company_id as string) === auth.companyId;
  if (!isUploader && !(auth.isAdmin && sameCompany)) {
    return NextResponse.json(
      { error: "Only the file's uploader or a company admin can delete it." },
      { status: 403 }
    );
  }

  const { data: updated, error } = await admin
    .from("files")
    .update({
      deprecated_at: new Date().toISOString(),
      deprecated_by: auth.userId,
    })
    .eq("id", id)
    .is("deprecated_at", null)
    .select("id")
    .maybeSingle();
  if (error || !updated) {
    return NextResponse.json(
      { error: `Delete failed: ${error?.message ?? "no row affected"}` },
      { status: 500 }
    );
  }

  await emitAssetEvent({
    companyId: file.company_id as string,
    actor: auth.userId,
    kind: "asset.file.deprecated",
    fileId: id,
  });
  return NextResponse.json({ ok: true });
}
