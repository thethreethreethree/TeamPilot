import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  classifyFile,
  deprecateFile,
  getFile,
} from "@/lib/data/files";
import { signAssetUrl } from "@/lib/storage/assets";

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
  const ok = await deprecateFile(id);
  if (!ok) {
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
