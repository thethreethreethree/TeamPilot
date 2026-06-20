import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Deterministic file classification router (no AI / no LLM).
 *
 * Per the founder direction 2026-06-19: instead of an LLM-based
 * classification suggester, route files by deterministic rules
 * derived from upload context. Cost: $0. Latency: sub-ms.
 * Reliability: 100% reproducible. Per §A11 (System counts; user
 * decides) — rules surface counts/derivations from facts (org
 * chart, task/topic context, uploader memberships, filename),
 * not from inferred judgment.
 *
 * Six rules, applied in order:
 *
 *   Rule 1 — Surface context wins.
 *     Upload from a Task → file_tasks gets (file, task) auto.
 *     Upload from a Chat topic → linked_topic_id set; if topic has a
 *     linked problem/task → also auto-add.
 *     Upload from a C.A.R.E conversation → linked_conversation_id set.
 *
 *   Rule 2 — Task → Department inheritance.
 *     If a task is linked, inherit its `department` value (the
 *     text department field that's lived on tasks since 0034).
 *     Match it against departments table by case-insensitive name;
 *     if match, add that department.
 *
 *   Rule 3 — Uploader department fallback.
 *     If no task-derived department, use the uploader's
 *     profile_departments (m2m). Per migration 0055.
 *
 *   Rule 4 — Filename → Title.
 *     Strip extension, normalize separators, title-case first letter.
 *     "Q3-budget-report-final.xlsx" → "Q3 budget report final"
 *
 *   Rule 5 — Filename → Tags.
 *     Conservative pattern match against a curated keyword list.
 *     Only fires on confident matches (whole-word or extension).
 *
 *   Rule 6 — C.A.R.E auto-routing.
 *     C.A.R.E conversation uploads get "customer-support" tag and
 *     route to a company-configured support department (first
 *     department matching /customer|support/i in name, case-
 *     insensitive). If no match, no department.
 *
 * The function is server-side (needs DB reads) but pure-in-output:
 * called twice with the same inputs and the same DB state, returns
 * the same result. Per §A12 — idempotent.
 *
 * Per §A14 — this is the data path; the render path (the modal
 * pre-fills with routed values) is in components/files/.
 */

export type AutoRouteSource =
  | "library"
  | "task"
  | "chat"
  | "care_agent"
  | "customer_widget";

export type AutoRouteContext = {
  uploaderId: string | null;
  companyId: string;
  fileName: string;
  mimeType: string;
  linkedTaskId?: string | null;
  linkedTopicId?: string | null;
  linkedConversationId?: string | null;
  source: AutoRouteSource;
};

export type AutoRouteResult = {
  departmentIds: string[];
  taskIds: string[];
  tags: string[];
  title: string;
  description: string | null;
  /** Human-readable trace of which rules fired. Stored in
   *  classification suggestions audit so we can measure rule
   *  accuracy over time (per §3.5). */
  ruleTrace: string[];
};

/** Filename keywords that map confidently to tag suggestions.
 *  Whole-word match (lower-cased) against tokens in the filename. */
const KEYWORD_TAGS: Record<string, string> = {
  draft: "draft",
  wip: "draft",
  final: "final",
  approved: "final",
  shipped: "shipped",
  notes: "notes",
  minutes: "notes",
  agenda: "notes",
  budget: "budget",
  forecast: "budget",
  invoice: "invoice",
  receipt: "invoice",
  contract: "contract",
  agreement: "contract",
  proposal: "proposal",
  brief: "proposal",
  spec: "spec",
  specification: "spec",
  design: "design",
  mockup: "design",
  wireframe: "design",
  screenshot: "screenshot",
  screen: "screenshot",
  report: "report",
  summary: "report",
  retro: "retro",
  retrospective: "retro",
};

/** Extension → format tag mapping. Conservative. */
const EXT_TAGS: Record<string, string> = {
  pdf: "pdf",
  xlsx: "spreadsheet",
  xls: "spreadsheet",
  csv: "spreadsheet",
  docx: "document",
  doc: "document",
  pptx: "presentation",
  ppt: "presentation",
  md: "notes",
  txt: "notes",
};

/** Title-case a filename token by capitalizing the first
 *  alphabetic character, preserving other casing. */
function normalizeFilenameToTitle(fileName: string): string {
  // Drop the extension
  const lastDot = fileName.lastIndexOf(".");
  const noExt = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  // Replace dashes / underscores / multiple-dots with spaces
  const spaced = noExt.replace(/[-_.]+/g, " ").trim();
  if (spaced.length === 0) return fileName;
  // Capitalize first letter only; preserve internal casing (so
  // "Q3 budget" stays "Q3 budget", "iPhone screenshot" stays
  // "iPhone screenshot")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function extractExtension(fileName: string): string {
  const lastDot = fileName.lastIndexOf(".");
  if (lastDot < 0 || lastDot >= fileName.length - 1) return "";
  return fileName.slice(lastDot + 1).toLowerCase();
}

/** Token-split a filename (lower-cased), used for keyword matching. */
function tokenizeFilename(fileName: string): string[] {
  const lastDot = fileName.lastIndexOf(".");
  const noExt = lastDot > 0 ? fileName.slice(0, lastDot) : fileName;
  return noExt
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/**
 * Find a department in this company by case-insensitive name
 * match. Returns the id or null.
 */
async function findDepartmentByName(
  companyId: string,
  name: string
): Promise<string | null> {
  if (!name.trim()) return null;
  const sb = createAdminClient();
  const { data } = await sb
    .from("departments")
    .select("id, name")
    .eq("company_id", companyId)
    .is("archived_at", null);
  if (!data) return null;
  const target = name.trim().toLowerCase();
  const match = data.find(
    (d) => (d.name as string).trim().toLowerCase() === target
  );
  return (match?.id as string) ?? null;
}

/**
 * Find the company's designated C.A.R.E / support department.
 * First match against /customer|support/i in name.
 */
async function findSupportDepartment(
  companyId: string
): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("departments")
    .select("id, name")
    .eq("company_id", companyId)
    .is("archived_at", null);
  if (!data) return null;
  const match = data.find((d) =>
    /customer|support|c\.?a\.?r\.?e\.?/i.test(d.name as string)
  );
  return (match?.id as string) ?? null;
}

/** Get the task's department text field (since migration 0034). */
async function getTaskDepartment(taskId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("tasks")
    .select("department, title")
    .eq("id", taskId)
    .maybeSingle();
  return ((data?.department as string | null) ?? null);
}

async function getTaskTitle(taskId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("tasks")
    .select("title")
    .eq("id", taskId)
    .maybeSingle();
  return ((data?.title as string | null) ?? null);
}

async function getTopicLinkedTaskId(_topicId: string): Promise<string | null> {
  // chat_topics has a problem_id which links to the problems
  // table; the problem in turn may link to a task. v1 returns
  // null for task linkage — we don't auto-link to inferred tasks
  // to avoid wrong inferences. Per §A11 — surface what we know;
  // don't infer what we don't.
  return null;
}

async function getTopicTitle(topicId: string): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("chat_topics")
    .select("title")
    .eq("id", topicId)
    .maybeSingle();
  return ((data?.title as string | null) ?? null);
}

async function getUploaderDepartments(uploaderId: string): Promise<string[]> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("profile_departments")
    .select("department_id")
    .eq("profile_id", uploaderId);
  return (data ?? []).map((r) => r.department_id as string);
}

async function getConversationCustomerName(
  conversationId: string
): Promise<string | null> {
  const sb = createAdminClient();
  const { data } = await sb
    .from("support_conversations")
    .select("customer_id")
    .eq("id", conversationId)
    .maybeSingle();
  const customerId = (data?.customer_id as string | null) ?? null;
  if (!customerId) return null;
  const { data: customer } = await sb
    .from("support_customers")
    .select("name, email")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return null;
  return (
    (customer.name as string | null) ??
    (customer.email as string | null) ??
    null
  );
}

/**
 * The router itself.
 */
export async function autoRouteFile(
  ctx: AutoRouteContext
): Promise<AutoRouteResult> {
  const departmentIds = new Set<string>();
  const taskIds = new Set<string>();
  const tags = new Set<string>();
  const ruleTrace: string[] = [];
  let description: string | null = null;

  // Rule 1 — Surface context wins.
  if (ctx.linkedTaskId) {
    taskIds.add(ctx.linkedTaskId);
    ruleTrace.push(`R1:task=${ctx.linkedTaskId}`);
  } else if (ctx.linkedTopicId) {
    // Chat topic context. May have a linked task (currently
    // returns null per the helper — we don't infer linkages).
    const linkedTask = await getTopicLinkedTaskId(ctx.linkedTopicId);
    if (linkedTask) {
      taskIds.add(linkedTask);
      ruleTrace.push(`R1:topic-linked-task=${linkedTask}`);
    }
    const topicTitle = await getTopicTitle(ctx.linkedTopicId);
    if (topicTitle) {
      description = `Shared in chat topic: ${topicTitle}`;
      ruleTrace.push(`R1:topic-description`);
    }
  }

  // Rule 2 — Task → Department inheritance.
  const firstTaskId = Array.from(taskIds)[0];
  if (firstTaskId) {
    const taskDept = await getTaskDepartment(firstTaskId);
    if (taskDept) {
      const deptId = await findDepartmentByName(ctx.companyId, taskDept);
      if (deptId) {
        departmentIds.add(deptId);
        ruleTrace.push(`R2:task-dept-inherit=${deptId}`);
      } else {
        ruleTrace.push(`R2:task-dept-no-match=${taskDept}`);
      }
    }
    // Augment description with task title if not set.
    if (!description) {
      const taskTitle = await getTaskTitle(firstTaskId);
      if (taskTitle) {
        description = `Attached to task: ${taskTitle}`;
        ruleTrace.push(`R2:task-description`);
      }
    }
  }

  // Rule 3 — Uploader department fallback.
  if (departmentIds.size === 0 && ctx.uploaderId) {
    const uploaderDepts = await getUploaderDepartments(ctx.uploaderId);
    for (const id of uploaderDepts) departmentIds.add(id);
    if (uploaderDepts.length > 0) {
      ruleTrace.push(`R3:uploader-dept-fallback=${uploaderDepts.length}`);
    }
  }

  // Rule 4 — Filename → Title.
  const title = normalizeFilenameToTitle(ctx.fileName);
  ruleTrace.push(`R4:title-from-filename`);

  // Rule 5 — Filename → Tags.
  const tokens = tokenizeFilename(ctx.fileName);
  for (const t of tokens) {
    const tagged = KEYWORD_TAGS[t];
    if (tagged) {
      tags.add(tagged);
      ruleTrace.push(`R5:keyword=${t}->${tagged}`);
    }
  }
  const ext = extractExtension(ctx.fileName);
  const extTag = EXT_TAGS[ext];
  if (extTag) {
    tags.add(extTag);
    ruleTrace.push(`R5:ext=${ext}->${extTag}`);
  }
  // Also: department-name token match
  if (departmentIds.size === 0) {
    const sb = createAdminClient();
    const { data } = await sb
      .from("departments")
      .select("id, name")
      .eq("company_id", ctx.companyId)
      .is("archived_at", null);
    if (data) {
      for (const d of data) {
        const dname = (d.name as string).toLowerCase();
        if (tokens.includes(dname)) {
          departmentIds.add(d.id as string);
          ruleTrace.push(`R5:filename-dept-match=${d.name}`);
        }
      }
    }
  }

  // Rule 6 — C.A.R.E auto-routing.
  if (ctx.source === "care_agent" || ctx.linkedConversationId) {
    tags.add("customer-support");
    ruleTrace.push(`R6:care-tag`);
    if (departmentIds.size === 0) {
      const supportDept = await findSupportDepartment(ctx.companyId);
      if (supportDept) {
        departmentIds.add(supportDept);
        ruleTrace.push(`R6:support-dept=${supportDept}`);
      }
    }
    if (!description && ctx.linkedConversationId) {
      const customerName = await getConversationCustomerName(
        ctx.linkedConversationId
      );
      description = customerName
        ? `Attached to support conversation with ${customerName}`
        : `Attached to support conversation`;
      ruleTrace.push(`R6:care-description`);
    }
  }

  return {
    departmentIds: Array.from(departmentIds),
    taskIds: Array.from(taskIds),
    tags: Array.from(tags),
    title,
    description,
    ruleTrace,
  };
}
