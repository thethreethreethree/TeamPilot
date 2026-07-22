import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteAssetBytes } from "@/lib/storage/assets";

/**
 * POST /api/admin/files/storage-sweep?days=90&confirm=true
 *
 * Audit 2026-06-26 finding C1: deprecated files keep their storage
 * bytes forever — `deleteAssetBytes` existed but was never called, so
 * soft-deleted files orphan their objects and storage grows unbounded.
 * This admin-only sweep reclaims bytes for files deprecated longer than
 * `days` ago.
 *
 * Per §3.1 (append-only): the files ROW is NEVER deleted — it is the
 * immutable record. Only the storage OBJECT (the freeable resource) is
 * purged. The row keeps storage_path for the chain; the bytes are gone.
 *
 * Per §2 (confirm hard-to-reverse actions): this is DRY-RUN by default.
 * Without ?confirm=true it only REPORTS what would be purged. The
 * operator must pass ?confirm=true to actually delete bytes. Idempotent:
 * re-running re-attempts deletes of already-purged objects, which
 * Supabase treats as a no-op.
 *
 * Retention default: 90 days. Operator overrides via ?days=N (min 7 —
 * a guard against accidentally purging recently-deleted files).
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "admin-storage-sweep",
    windowMs: 60_000,
    max: 5,
  });
  if (limited) return limited;

  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }

  const daysRaw = Number(req.nextUrl.searchParams.get("days") ?? "90");
  const days = Number.isFinite(daysRaw) ? Math.max(7, Math.floor(daysRaw)) : 90;
  const confirm = req.nextUrl.searchParams.get("confirm") === "true";

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // Scope to the admin's own company. Admin client (RLS bypass) is
  // safe here because we explicitly filter company_id = auth.companyId.
  const admin = createAdminClient();
  const { data: rows, error } = await admin
    .from("files")
    .select("id, storage_path, deprecated_at")
    .eq("company_id", auth.companyId)
    .not("deprecated_at", "is", null)
    .lt("deprecated_at", cutoff)
    .limit(1000);
  if (error) {
    return NextResponse.json(
      { error: `Sweep query failed: ${error.message}` },
      { status: 500 }
    );
  }

  const candidates = (rows ?? []) as Array<{
    id: string;
    storage_path: string;
    deprecated_at: string;
  }>;

  if (!confirm) {
    return NextResponse.json({
      dryRun: true,
      retentionDays: days,
      candidateCount: candidates.length,
      note: "Dry run — no bytes deleted. Re-call with ?confirm=true to purge.",
      sample: candidates.slice(0, 20).map((c) => ({
        id: c.id,
        deprecatedAt: c.deprecated_at,
      })),
    });
  }

  let purged = 0;
  let failed = 0;
  for (const c of candidates) {
    const ok = await deleteAssetBytes(c.storage_path);
    if (ok) purged += 1;
    else failed += 1;
  }

  return NextResponse.json({
    dryRun: false,
    retentionDays: days,
    candidateCount: candidates.length,
    purged,
    failed,
    note: "Storage bytes purged; file rows preserved (append-only).",
  });
}
