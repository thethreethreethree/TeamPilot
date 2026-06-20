import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  fetchAssetReadout,
  type AssetReadoutWindow,
} from "@/lib/data/assetReadout";

/**
 * GET /api/admin/asset-readout?window=30d
 *
 * Admin-only. Returns the Asset System v1 §4 readout metrics
 * over the requested window (7d / 30d / 60d / all).
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "asset-readout",
    windowMs: 60_000,
    max: 60,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  const windowParam = (req.nextUrl.searchParams.get("window") ?? "30d") as AssetReadoutWindow;
  const readout = await fetchAssetReadout(windowParam);
  return NextResponse.json({ readout });
}
