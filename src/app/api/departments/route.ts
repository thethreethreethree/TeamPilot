import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  archiveDepartment,
  createDepartment,
  listDepartments,
  renameDepartment,
  unarchiveDepartment,
} from "@/lib/data/departments";

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "departments-list",
    windowMs: 60_000,
    max: 120,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const includeArchived =
    req.nextUrl.searchParams.get("include_archived") === "1";
  const departments = await listDepartments({ includeArchived });
  return NextResponse.json({ departments });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "departments-create",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  let body: { name?: string; description?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const name = (body.name ?? "").trim();
  if (name.length === 0 || name.length > 80) {
    return NextResponse.json(
      { error: "Name must be 1-80 chars." },
      { status: 400 }
    );
  }
  const dep = await createDepartment({
    name,
    description: body.description?.trim(),
  });
  if (!dep) {
    return NextResponse.json({ error: "Create failed." }, { status: 500 });
  }
  return NextResponse.json({ department: dep });
}

export async function PATCH(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "departments-patch",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth || !auth.isAdmin) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  let body: {
    id?: string;
    name?: string;
    description?: string;
    action?: "rename" | "archive" | "unarchive";
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (!body.id) {
    return NextResponse.json({ error: "Missing id." }, { status: 400 });
  }
  if (body.action === "archive") {
    const ok = await archiveDepartment(body.id);
    return NextResponse.json({ ok });
  }
  if (body.action === "unarchive") {
    const ok = await unarchiveDepartment(body.id);
    return NextResponse.json({ ok });
  }
  // default: rename
  if (!body.name || body.name.trim().length === 0) {
    return NextResponse.json({ error: "Name required." }, { status: 400 });
  }
  const dep = await renameDepartment(body.id, body.name, body.description);
  if (!dep) {
    return NextResponse.json({ error: "Rename failed." }, { status: 500 });
  }
  return NextResponse.json({ department: dep });
}
