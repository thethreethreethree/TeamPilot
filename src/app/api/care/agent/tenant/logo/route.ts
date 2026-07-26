import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * POST /api/care/agent/tenant/logo
 *
 * Multipart upload of a brand logo / icon to the public
 * widget-logos bucket. Per migration 0064 the bucket is public-
 * read because the customer-facing widget runs on the tenant's
 * customer site (unauthenticated visitor) and the logo URL must
 * work without a signed token.
 *
 * Constraints (enforced in addition to bucket-level
 * allowed_mime_types from migration 0064):
 *   - 2 MB max
 *   - image/png, image/jpeg, image/svg+xml, image/webp,
 *     image/x-icon, image/vnd.microsoft.icon
 *   - Path: {companyId}/widget-logo.{ext}
 *
 * On success: writes the bucket object AND updates
 * care_tenant_config.widget_logo_url with the public URL. Single
 * round-trip from the settings UI.
 *
 * DELETE — clears the logo: removes the bucket object AND nulls
 * the widget_logo_url column.
 */

const MAX_BYTES = 2 * 1024 * 1024; // 2 MB
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/svg+xml",
  "image/webp",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

function extensionFor(mime: string): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/jpeg":
    case "image/jpg":
      return "jpg";
    case "image/svg+xml":
      return "svg";
    case "image/webp":
      return "webp";
    case "image/x-icon":
    case "image/vnd.microsoft.icon":
      return "ico";
    default:
      return "bin";
  }
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "care-tenant-logo-upload",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.isAdmin || !auth.companyId) {
    return NextResponse.json(
      { error: "Company admin only." },
      { status: 403 }
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json(
      { error: "Expected multipart/form-data." },
      { status: 400 }
    );
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' part." }, { status: 400 });
  }
  const mime = (file.type || "").toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return NextResponse.json(
      {
        error: `Unsupported image type: ${mime}. Allowed: PNG, JPG, SVG, WebP, ICO.`,
      },
      { status: 400 }
    );
  }
  if (file.size <= 0 || file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "Image must be 1 byte to 2 MB." },
      { status: 400 }
    );
  }

  const ext = extensionFor(mime);
  const objectPath = `${auth.companyId}/widget-logo.${ext}`;
  const admin = createAdminClient();
  const bytes = await file.arrayBuffer();
  // upsert so re-uploading replaces the previous logo in place.
  const { error: uploadError } = await admin.storage
    .from("widget-logos")
    .upload(objectPath, bytes as ArrayBuffer, {
      contentType: mime,
      upsert: true,
    });
  if (uploadError) {
    // Per audit L2 (2026-06-24): detect the "bucket not found" case
    // and return an actionable instruction instead of the opaque
    // Supabase message — mirrors the helper in src/lib/storage/assets.ts.
    // Newer Supabase Cloud may block `insert into storage.buckets`
    // from the SQL editor (migration 0064), so the bucket can be
    // missing even after the migration ran.
    const msg = uploadError.message || "Unknown storage error.";
    if (/bucket not found|bucket does not exist/i.test(msg)) {
      return NextResponse.json(
        {
          error:
            "Storage bucket 'widget-logos' does not exist on this Supabase project. Create it via Supabase Dashboard → Storage → New bucket → Name: 'widget-logos' → Public: ON → File size limit: 2 MB. (Migration 0064 tries to create it via SQL, but newer Supabase Cloud instances may block that; the Dashboard always works.)",
        },
        { status: 500 }
      );
    }
    return NextResponse.json(
      { error: `Storage upload failed: ${msg}` },
      { status: 500 }
    );
  }

  // Public bucket → getPublicUrl returns the canonical URL with
  // no signing. The URL persists for the lifetime of the object;
  // re-uploads to the same path replace the bytes without changing
  // the URL.
  const {
    data: { publicUrl },
  } = admin.storage.from("widget-logos").getPublicUrl(objectPath);

  // Append a cache-busting query string so the customer site
  // refetches the new logo on next load even if their CDN cached
  // the old image.
  const versioned = `${publicUrl}?v=${Date.now()}`;

  // Per audit M2 (2026-06-24): UPSERT, not UPDATE. A plain
  // update().eq() is a silent no-op if the tenant has no
  // care_tenant_config row (legacy companies created before the
  // 0045 bootstrap trigger, or any anomaly). The bytes would land
  // in storage, widget_logo_url would never get set, and the
  // widget would never show the logo — with no error surfaced.
  // onConflict company_id makes this safe either way.
  const { error: updateError } = await admin
    .from("care_tenant_config")
    .upsert(
      { company_id: auth.companyId, widget_logo_url: versioned },
      { onConflict: "company_id" }
    );
  if (updateError) {
    // Sibling of the agent/tenant route (908d0897): log the raw cause, return a generic message — no client
    // gets a raw DB error, even an authed agent (CWE-209 defense in depth). Audit 2026-07-27.
    // eslint-disable-next-line no-console
    console.error(`[care.tenant.logo] config update failed companyId=${auth.companyId}: ${updateError.message}`);
    return NextResponse.json(
      { error: "Couldn't save the logo. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ logoUrl: versioned });
}

export async function DELETE(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "care-tenant-logo-delete",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.isAdmin || !auth.companyId) {
    return NextResponse.json(
      { error: "Company admin only." },
      { status: 403 }
    );
  }
  const admin = createAdminClient();
  // Remove whatever extension is currently stored. We try the
  // common set; missing objects are silently ignored by Supabase
  // (no error).
  const exts = ["png", "jpg", "jpeg", "svg", "webp", "ico"];
  await admin.storage
    .from("widget-logos")
    .remove(exts.map((e) => `${auth.companyId}/widget-logo.${e}`));
  await admin
    .from("care_tenant_config")
    .update({ widget_logo_url: null })
    .eq("company_id", auth.companyId);
  return NextResponse.json({ ok: true });
}
