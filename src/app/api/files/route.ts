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
import { emitAssetEvent } from "@/lib/data/assetEvents";
import { autoRouteFile } from "@/lib/files/autoRoute";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const linkedTaskIdRaw = (form.get("linked_task_id") as string | null) ?? null;
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

  // Deterministic auto-routing (no AI / LLM).
  // If the form did not supply classification fields, fall back
  // to the rule-based router (§A11 — System counts derived from
  // facts; user decides). The router reads context (linked task /
  // topic / conversation, uploader's departments, filename
  // keywords, file extension) and proposes classification. The
  // user can override in the ClassificationModal.
  const callerProvidedClassification =
    departmentIds.length > 0 ||
    taskIds.length > 0 ||
    tags.length > 0 ||
    !!description;
  let routedTitle = title;
  let routedDescription: string | null = description;
  let routeTrace: string[] = [];
  if (!callerProvidedClassification) {
    const routed = await autoRouteFile({
      uploaderId: auth.userId,
      companyId: auth.companyId,
      fileName: file.name,
      mimeType: file.type || "application/octet-stream",
      linkedTaskId: linkedTaskIdRaw,
      linkedTopicId,
      linkedConversationId,
      source: linkedTaskIdRaw
        ? "task"
        : linkedTopicId
          ? "chat"
          : linkedConversationId
            ? "care_agent"
            : "library",
    });
    departmentIds.push(...routed.departmentIds);
    taskIds.push(...routed.taskIds);
    tags.push(...routed.tags);
    routedTitle = routed.title || title;
    routedDescription = routed.description ?? description;
    routeTrace = routed.ruleTrace;
  }

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

  let row;
  try {
    row = await createFileRecord({
      companyId: auth.companyId,
      uploaderId: auth.userId,
      customerSessionToken: null,
      storagePath,
      mimeType: file.type || "application/octet-stream",
      sizeBytes: file.size,
      originalFilename: file.name,
      title: routedTitle,
      description: routedDescription,
      accessRole,
      uploadedVia: "agent_dashboard",
      linkedTopicId,
      linkedConversationId,
    });
  } catch (err) {
    // Surface the actual Supabase error message (e.g. RLS denial,
    // FK violation, column missing) instead of an opaque 500.
    const detail = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Failed to write file row after upload: ${detail}` },
      { status: 500 }
    );
  }
  if (!row) {
    return NextResponse.json(
      { error: "Failed to write file row after upload." },
      { status: 500 }
    );
  }

  // §3.1 chain event — file uploaded.
  await emitAssetEvent({
    companyId: auth.companyId,
    actor: auth.userId,
    kind: "asset.file.uploaded",
    fileId: row.id,
    payload: {
      uploaded_via: "agent_dashboard",
      size_bytes: row.sizeBytes,
      mime_type: row.mimeType,
      classification_lane: row.classificationLane,
    },
  });

  // Log the routing audit row if the deterministic router fired.
  // This records WHAT THE ROUTER PROPOSED so a later §4 readout
  // can measure rule accuracy (did the user accept-as-is, edit, or
  // reject?). Per §A11 — the System counts (deterministic rules
  // here, not LLM judgment); the user decides.
  if (routeTrace.length > 0) {
    const adminSb = createAdminClient();
    await adminSb.from("file_classification_suggestions").insert({
      file_id: row.id,
      suggested_department_ids: departmentIds,
      suggested_task_ids: taskIds,
      suggested_title: routedTitle,
      suggested_description: routedDescription,
      suggested_tags: tags,
      rule_trace: routeTrace,
      user_action: "pending",
    });
  }

  // Attach classification join rows if any were provided in
  // the upload form. Triggers re-derive classification_lane.
  if (departmentIds.length > 0 || taskIds.length > 0 || tags.length > 0) {
    const classified = await classifyFile({
      fileId: row.id,
      departmentIds,
      taskIds,
      tags,
    });
    // Emit asset.file.classified if the lane transitioned to
    // 'classified'. Reading after classifyFile to get post-trigger
    // lane state.
    if (classified?.classificationLane === "classified") {
      await emitAssetEvent({
        companyId: auth.companyId,
        actor: auth.userId,
        kind: "asset.file.classified",
        fileId: row.id,
        payload: {
          department_ids: departmentIds,
          task_ids: taskIds,
          tags,
        },
      });
    }
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
