import { NextResponse } from "next/server";
import { requireVendorAdmin } from "@/lib/crm/vendorAuth";
import { MANUAL_PDF_BASE64 } from "./manual-data";

export const runtime = "nodejs";

/**
 * GET /founder/files/buildmanual — download the "Build a SaaS From Scratch" manual.
 *
 * FOUNDER-ONLY. Gated by requireVendorAdmin() — the audited single-source-of-truth for
 * vendor/home-company access (fails CLOSED; returns an identical 401/403 to a non-admin OR a
 * wrong-company admin, so a customer cannot even confirm this file exists). A customer or the
 * public hitting this URL gets 403, never the PDF.
 *
 * The PDF is embedded as base64 (manual-data.ts) rather than read from disk, so the download is
 * byte-identical in dev and on Vercel — `output: "standalone"` does not trace a static repo file
 * into this route's bundle, and a disk read that works locally could 500 in production.
 */
export async function GET() {
  const gate = await requireVendorAdmin();
  if (gate instanceof NextResponse) return gate; // 401 / 403 — denied

  const bytes = Buffer.from(MANUAL_PDF_BASE64, "base64");
  return new NextResponse(bytes, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="Build-a-SaaS-Manual.pdf"',
      "Content-Length": String(bytes.length),
      // Private, founder-only — never let a shared cache or CDN hold it.
      "Cache-Control": "private, no-store",
    },
  });
}
