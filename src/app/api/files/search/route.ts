import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/files/search?q=<query>&limit=10
 *
 * Lightweight file search for the @file mention autocomplete.
 * Returns just enough for the picker (id, title, mime_type,
 * classification_lane). RLS applies — user only sees files they
 * could see in the library.
 */
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "files-search",
    windowMs: 60_000,
    max: 120,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  const limit = Math.min(
    parseInt(req.nextUrl.searchParams.get("limit") ?? "10", 10) || 10,
    25
  );
  const sb = await createClient();
  let query = sb
    .from("files")
    .select("id, title, mime_type, classification_lane, created_at")
    .is("deprecated_at", null)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (q.length > 0) {
    query = query.ilike("title", `%${q}%`);
  }
  const { data, error } = await query;
  if (error) {
    console.error("[files/search] failed to search files:", error);
    return NextResponse.json({ error: "Couldn't search files." }, { status: 500 });
  }
  return NextResponse.json({ files: data ?? [] });
}
