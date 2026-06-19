import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import {
  buildStoragePath,
  uploadAssetBytes,
  validateUploadCandidate,
} from "@/lib/storage/assets";
import {
  CASUAL_DAILY_CAP,
  countUserCasualUploadsToday,
  createFileRecord,
  classifyFile,
  listFiles,
} from "@/lib/data/files";
import { randomUUID } from "crypto";

/**
 * Asset System v1 — agent-side file endpoints.
 *
 * GET  /api/files    — list files visible to the caller
 * POST /api/files    — upload + create file row.
 *
 * Body is multipart/form-data (the bytes can't be JSON).
 * Classification fields are optional on upload; if omitted the
 * file lands in casual lane and counts against the user's
 * 3/day cap. Classification can be applied later via
 * PATCH /api/files/[id].
 */

export async function GET(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "files-list",
    windowMs: 60_000,
    max: 120,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const url = req.nextUrl;
  const search = url.searchParams.get("q") ?? undefined;
  const departmentId = url.searchParams.get("department") ?? undefined;
  const taskId = url.searchParams.get("task") ?? undefined;
  const tag = url.searchParams.get("tag") ?? undefined;
  const lane =
    (url.searchParams.get("lane") as "classified" | "casual" | null) ?? undefined;
  const linkedTopicId = url.searchParams.get("topic") ?? undefined;
  const linkedConversationId = url.searchParams.get("conversation") ?? undefined;
  const files = await listFiles({
    search,
    departmentId,
    taskId,
    tag,
    lane: lane ?? undefined,
    linkedTopicId,
    linkedConversationId,
    limit: 200,
  });
  const casualToday = await countUserCasualUploadsToday(auth.userId);
  return NextResponse.json({
    files,
    casual: {
      today: casualToday,
      cap: CASUAL_DAILY_CAP,
      remaining: Math.max(0, CASUAL_DAILY_CAP - casualToday),
    },
  });
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "files-upload",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;
  const auth = await getCurrentAuthContext();
  if (!auth) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart/form-data." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file' part." }, { status: 400 });
  }
  const title = ((form.get("title") as string | null) ?? file.name).trim();
  const description = (form.get("description") as string | null)?.trim() ?? null;
  const accessRole =
    ((form.get("access_role") as string | null) as
      | "everyone"
      | "admins"
      | "ceo_admins"
      | "specific_people"
      | null) ?? "everyone";
  const linkedTopicId = (form.get("linked_topic_id") as string | null) ?? null;
  const linkedConversationId =
    (form.get("linked_conversation_id") as string | null) ?? null;
  const departmentIdsRaw = (form.get("department_ids") as string | null) ?? "";
  const taskIdsRaw = (form.get("task_ids") as string | null) ?? "";
  const tagsRaw = (form.get("tags") as string | null) ?? "";
  const departmentIds = departmentIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const taskIds = taskIdsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const tags = tagsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  // Validate size + type
  const v = validateUploadCandidate({
    sizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
    uploadedVia: "agent_dashboard",
  });
  if (!v.ok) {
    return NextResponse.json({ error: v.detail, reason: v.reason }, { status: 400 });
  }

  // Casual-cap check: if this upload would land casual (missing
  // classification fields) AND the user is already at the cap,
  // reject. Per the founder red-pen: explainer copy, not just
  // "limit reached".
  const willBeCasual =
    departmentIds.length === 0 ||
    taskIds.length === 0 ||
    !description ||
    description.length === 0;
  if (willBeCasual) {
    const used = await countUserCasualUploadsToday(auth.userId);
    if (used >= CASUAL_DAILY_CAP) {
      return NextResponse.json(
        {
          error:
            "File upload without a designated purpose is limited to 3 per day. To upload more, attach a department, task, and a short description so this file becomes part of the team's asset base.",
          reason: "casual_cap_reached",
          casual: { today: used, cap: CASUAL_DAILY_CAP },
        },
        { status: 429 }
      );
    }
  }

  // Reserve a file id so we can use it as both the storage
  // object name and the row PK.
  const fileId = randomUUID();
  const storagePath = buildStoragePath({
    companyId: auth.companyId,
    fileId,
    originalFilename: file.name,
  });
  const bytes = await file.arrayBuffer();
  const up = await uploadAssetBytes({
    storagePath,
    bytes,
    contentType: file.type || "application/octet-stream",
  });
  if (!up.ok) {
    return NextResponse.json(
      { error: `Storage upload failed: ${up.error}` },
      { status: 500 }
    );
  }

  const row = await createFileRecord({
    companyId: auth.companyId,
    uploaderId: auth.userId,
    customerSessionToken: null,
    storagePath,
    mimeType: file.type || "application/octet-stream",
    sizeBytes: file.size,
    originalFilename: file.name,
    title,
    description,
    accessRole,
    uploadedVia: "agent_dashboard",
    linkedTopicId,
    linkedConversationId,
  });
  if (!row) {
    return NextResponse.json(
      { error: "Failed to write file row after upload." },
      { status: 500 }
    );
  }

  // Attach classification join rows if any were provided in
  // the upload form. Triggers re-derive classification_lane.
  if (departmentIds.length > 0 || taskIds.length > 0 || tags.length > 0) {
    await classifyFile({
      fileId: row.id,
      departmentIds,
      taskIds,
      tags,
    });
  }

  const used = await countUserCasualUploadsToday(auth.userId);
  return NextResponse.json({
    file: row,
    casual: {
      today: used,
      cap: CASUAL_DAILY_CAP,
      remaining: Math.max(0, CASUAL_DAILY_CAP - used),
    },
  });
}
