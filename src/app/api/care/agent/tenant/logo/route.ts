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
    return NextResponse.json(
      { error: `Storage upload failed: ${uploadError.message}` },
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

  const { error: updateError } = await admin
    .from("care_tenant_config")
    .update({ widget_logo_url: versioned })
    .eq("company_id", auth.companyId);
  if (updateError) {
    return NextResponse.json(
      { error: `Config update failed: ${updateError.message}` },
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
