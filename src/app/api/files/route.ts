import { NextRequest, NextResponse } from "next/server";
import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  buildStoragePath,
  uploadAssetBytes,
  validateUploadCandidate,
  getAssetObjectInfo,
  deleteAssetBytes,
} from "@/lib/storage/assets";
import {
  CASUAL_DAILY_CAP,
  countPurposelessUploadsToday,
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
  const casualToday = await countPurposelessUploadsToday(auth.userId);
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
  // Two upload paths (§1.5), sharing the routing/validate/cap/record path:
  //  (1) SIGNED-URL (JSON) — the client uploaded bytes DIRECT to storage via a
  //      signed URL (large files / folders) and POSTs metadata + storagePath,
  //      bypassing the ~4.5 MB serverless body limit.
  //  (2) MULTIPART (legacy: task/chat/C.A.R.E small uploads) — file in-body.
  const contentType = req.headers.get("content-type") ?? "";
  let fileName: string;
  let fileSize: number;
  let fileType: string;
  let fileBlob: File | null = null; // multipart path: bytes to upload
  let preUploadedPath: string | null = null; // signed-URL path: already in storage
  let allowArchive = false; // scoped: the UI's own folder-zip
  let getField: (k: string) => string | null;

  if (contentType.includes("application/json")) {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Expected JSON body." }, { status: 400 });
    }
    preUploadedPath =
      typeof body.storagePath === "string" ? body.storagePath : null;
    if (!preUploadedPath) {
      return NextResponse.json(
        { error: "Missing 'storagePath' — upload via the signed URL first." },
        { status: 400 }
      );
    }
    // F1 (tenant isolation) — a record may only reference THIS company's
    // objects. buildStoragePath always prefixes the companyId, so legit
    // uploads pass; anything else is rejected (no cross-tenant references).
    if (!preUploadedPath.startsWith(`${auth.companyId}/`)) {
      return NextResponse.json({ error: "Invalid storage path." }, { status: 403 });
    }
    fileName =
      typeof body.originalFilename === "string" && body.originalFilename.trim()
        ? body.originalFilename
        : "file";
    fileType =
      typeof body.mimeType === "string" && body.mimeType
        ? body.mimeType
        : "application/octet-stream";
    // F2 — PREFER the object's real size from storage, but FALL BACK to the
    // client's claim when the metadata isn't readable yet (Supabase list()
    // metadata is frequently null right after an upload — this was hard-
    // failing legit uploads as "File is empty"). The bucket enforces the real
    // 25MB ceiling regardless, so the real-size read is defense-in-depth, not
    // the primary gate. Best-effort existence check only.
    const claimedSize = typeof body.sizeBytes === "number" ? body.sizeBytes : 0;
    const info = await getAssetObjectInfo(preUploadedPath);
    fileSize = info && info.sizeBytes > 0 ? info.sizeBytes : claimedSize;
    allowArchive = body.archive === true; // scoped folder-zip allowance
    getField = (k) => {
      const val = body[k];
      if (typeof val === "string") return val;
      if (Array.isArray(val)) return val.join(",");
      return null;
    };
  } else {
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
    fileBlob = file;
    fileName = file.name;
    fileSize = file.size;
    fileType = file.type || "application/octet-stream";
    getField = (k) => form.get(k) as string | null;
  }

  const title = (getField("title") ?? fileName).trim();
  const description = getField("description")?.trim() ?? null;
  const accessRole =
    (getField("access_role") as
      | "everyone"
      | "admins"
      | "ceo_admins"
      | "specific_people"
      | null) ?? "everyone";
  const linkedTopicId = getField("linked_topic_id");
  const linkedConversationId = getField("linked_conversation_id");
  const linkedTaskIdRaw = getField("linked_task_id");
  const departmentIdsRaw = getField("department_ids") ?? "";
  const taskIdsRaw = getField("task_ids") ?? "";
  const tagsRaw = getField("tags") ?? "";
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
      fileName,
      mimeType: fileType,
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
    sizeBytes: fileSize,
    mimeType: fileType,
    uploadedVia: "agent_dashboard",
    filename: fileName, // F2 — extension blocklist (claimed MIME isn't trusted)
    allowArchive, // scoped folder-zip (JSON branch only; false otherwise)
  });
  if (!v.ok) {
    // F3 — a signed-URL object is already in storage; don't orphan it.
    if (preUploadedPath) await deleteAssetBytes(preUploadedPath);
    return NextResponse.json({ error: v.detail, reason: v.reason }, { status: 400 });
  }

  // Casual-cap check (audit H1 — the UNIFORM rule across every
  // upload surface). The cap limits PURPOSELESS uploads only. A file
  // has a designated purpose if it is either:
  //   • explicitly classified (department + task + description), OR
  //   • context-linked (topic / conversation / task).
  // Only a file with NEITHER is "purposeless" and counted/blocked.
  // This is what makes chat/C.A.R.E/task uploads (always
  // context-linked) consistent with classified library uploads:
  // none of them ever hit the cap, because all of them have a
  // purpose. Only a raw library drop with no context and no
  // classification is capped.
  const willClassify =
    departmentIds.length > 0 &&
    taskIds.length > 0 &&
    !!description &&
    description.length > 0;
  const hasContextLink =
    !!linkedTopicId || !!linkedConversationId || !!linkedTaskIdRaw;
  const isPurposeless = !willClassify && !hasContextLink;
  if (isPurposeless) {
    const used = await countPurposelessUploadsToday(auth.userId);
    if (used >= CASUAL_DAILY_CAP) {
      // F3 — a signed-URL object is already in storage; don't orphan it.
      if (preUploadedPath) await deleteAssetBytes(preUploadedPath);
      return NextResponse.json(
        {
          error:
            "Uploads without a designated purpose are limited to 3 per day. Give this file a purpose — attach a department + task + short description to classify it, or upload it from a task/chat/conversation — and it won't count against the cap.",
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
  // Signed-URL path: bytes are ALREADY in storage at preUploadedPath — reuse
  // it and skip the through-function upload. Multipart path: upload now.
  const storagePath =
    preUploadedPath ??
    buildStoragePath({
      companyId: auth.companyId,
      fileId,
      originalFilename: fileName,
    });
  if (!preUploadedPath && fileBlob) {
    const bytes = await fileBlob.arrayBuffer();
    const up = await uploadAssetBytes({
      storagePath,
      bytes,
      contentType: fileType,
    });
    if (!up.ok) {
      return NextResponse.json(
        { error: `Storage upload failed: ${up.error}` },
        { status: 500 }
      );
    }
  }

  let row;
  try {
    row = await createFileRecord({
      companyId: auth.companyId,
      uploaderId: auth.userId,
      customerSessionToken: null,
      storagePath,
      mimeType: fileType,
      sizeBytes: fileSize,
      originalFilename: fileName,
      title: routedTitle,
      description: routedDescription,
      accessRole,
      uploadedVia: "agent_dashboard",
      linkedTopicId,
      linkedConversationId,
      linkedTaskId: linkedTaskIdRaw,
    });
  } catch (err) {
    // Surface the actual Supabase error message (e.g. RLS denial,
    // FK violation, column missing) instead of an opaque 500.
    const detail = err instanceof Error ? err.message : String(err);
    // F3 — the object is in storage but has no record; don't orphan it.
    await deleteAssetBytes(storagePath);
    return NextResponse.json(
      { error: `Failed to write file row after upload: ${detail}` },
      { status: 500 }
    );
  }
  if (!row) {
    await deleteAssetBytes(storagePath); // F3 — clean the orphaned object.
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
          // Audit L2 (§A2/§3.5 readout integrity): distinguish a
          // user-provided pre-upload classification from a
          // deterministic auto-route. The §4 rule-acceptance metric
          // only applies to auto_route uploads; tagging the source
          // keeps the readout's denominator honest as pre-upload
          // classification (the new flow) grows.
          source: callerProvidedClassification ? "pre_upload" : "auto_route",
        },
      });
    }
  }

  const used = await countPurposelessUploadsToday(auth.userId);
  return NextResponse.json({
    file: row,
    casual: {
      today: used,
      cap: CASUAL_DAILY_CAP,
      remaining: Math.max(0, CASUAL_DAILY_CAP - used),
    },
  });
}
