import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { ZodSchema, z } from "zod";
import {
  TASK_CANONICAL_STATUSES,
  TASK_PRIORITIES,
} from "@/lib/tasks/statusLabels";

/**
 * Shared request-body validator (audit Tier 2 #11).
 *
 * Usage in a route:
 *   const body = await readBody(req, MySchema);
 *   if (body instanceof NextResponse) return body; // 400 with errors
 *   // ...body is now typed.
 */
export async function readBody<T>(
  req: NextRequest,
  schema: ZodSchema<T>
): Promise<T | NextResponse> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 }
    );
  }
  return parsed.data;
}

// ─────────────────────────────────────────────────────────────
// Reusable schemas — pulled into routes that share field shapes
// ─────────────────────────────────────────────────────────────

export const TitleSchema = z.string().min(1).max(200);
export const NonEmptyText = z.string().min(1).max(20_000);
export const OptionalText = z.string().max(20_000).optional().or(z.literal(""));
export const EmailSchema = z.string().email().max(320);
export const RoleSchema = z.enum(["CEO", "COO", "Lead", "Member"]);

export const TaskCreateSchema = z.object({
  title: TitleSchema,
  description: OptionalText,
  department: z.string().max(120).optional().or(z.literal("")),
  assignee: z.string().max(200).optional().or(z.literal("")),
  // Enums derived from the single source of truth (statusLabels) so the API's
  // accepted values can't drift from the board dropdown / status labels.
  status: z.enum(TASK_CANONICAL_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  aiPriorityScore: z.number().int().min(0).max(100).optional(),
  impactLevel: z.string().max(40).optional(),
  blockerReason: z.string().max(1000).optional().or(z.literal("")),
  dueDate: z.string().date().optional().or(z.literal("")),
});

export const TaskPatchSchema = TaskCreateSchema.partial().extend({
  id: z.string().uuid(),
});

export const DialogueDecisionSchema = z.object({
  situation: z.string().min(20).max(20_000),
  userDiagnosis: z.string().min(20).max(20_000),
  userProposal: z.string().min(20).max(20_000),
});

// DialogueConversationSchema removed 2026-06-04 (Pass-3 audit) — the
// Conversation Dialogue surface was dropped after the §1.7 audit caught
// it as dead (table dropped in 0013, UI never reached DB). See
// supabase/migrations/0013_drop_conversations.sql for the WHY.

export const RippleTraceSchema = z.object({
  problemTitle: z.string().min(1).max(200),
  diagnosis: z.string().min(40).max(20_000),
  candidateAction: z.string().min(1).max(20_000),
  contextSummary: z.string().max(20_000).optional().or(z.literal("")),
});

export const OutsideViewSchema = z.object({
  currentRead: z.string().min(20).max(20_000),
  evidenceSummary: z.string().max(20_000),
  count: z.number().int().min(1).max(5).optional(),
});

export const InviteSchema = z.object({
  email: EmailSchema,
  role: RoleSchema.optional(),
});

export const AcceptInviteSchema = z.object({
  code: z.string().min(8).max(64),
  fullName: z.string().max(200).optional().or(z.literal("")).nullable(),
});

export const ProblemCreateSchema = z.object({
  kind: z.string().min(1).max(120),
  title: TitleSchema,
  diagnosis: z.string().max(20_000).optional().or(z.literal("")).nullable(),
  signalIds: z.array(z.string().uuid()).max(200).optional(),
});

// PUT /api/problems — link signals to an existing problem. Same bound as
// ProblemCreateSchema.signalIds so the two link paths can't diverge (an
// unbounded array here would sidestep the create-path cap).
export const ProblemLinkSchema = z.object({
  id: z.string().uuid(),
  signalIds: z.array(z.string().uuid()).max(200),
});

export const ProblemPatchSchema = z.object({
  id: z.string().uuid(),
  title: TitleSchema.optional(),
  diagnosis: z.string().max(20_000).optional().or(z.literal("")),
  status: z
    .enum(["draft", "surfaceable", "surfaced", "resolved", "dismissed"])
    .optional(),
  dismissalReason: z.string().max(2000).optional().or(z.literal("")),
});

export const ResolutionPatchSchema = z.object({
  id: z.string().uuid(),
  observedOutcome: z.string().min(20).max(20_000),
  durability: z.enum(["held", "reopened", "partial", "unknown"]),
});

// POST /api/decisions create payload. Bounds every free-text field so a crafted
// request can't push oversized text / jsonb into the immutable decision + dialogue
// rows (the finding: these inserts were entirely unvalidated). Deliberately carries
// NO min lengths — the defer/hybrid paths legitimately send an EMPTY userProposal,
// and real decisions are often terse ("Renewal at risk"), so a min(20) would 400
// valid submissions (which is exactly why the earlier min-bearing DecisionPersistSchema
// was written but never wired). chosenPath is the one hard requirement: a persisted
// decision must record which path was taken.
export const DecisionCreateSchema = z.object({
  situation: z.string().max(20_000).optional().nullable(),
  userDiagnosis: z.string().max(20_000).optional().nullable(),
  userProposal: z.string().max(20_000).optional().nullable(),
  systemResponse: z.record(z.string(), z.unknown()).optional().nullable(),
  chosenPath: z.enum(["user", "system", "hybrid", "defer"]),
  chosenNote: z.string().max(20_000).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  outcome: z.string().max(20_000).optional().nullable(),
});

export const BrainUnlockSchema = z.object({
  reason: z.string().min(20).max(2000),
});

export const SettingsPatchSchema = z.object({
  name: z.string().max(200).optional().nullable(),
  industry: z.string().max(120).optional().nullable(),
  size: z.string().max(40).optional().nullable(),
  stage: z.string().max(80).optional().nullable(),
  goals: z.array(z.string()).max(40).optional().nullable(),
  timezone: z.string().max(120).optional(),
  llm_provider_preference: z
    .enum(["deepseek", "anthropic"])
    .optional()
    .nullable(),
});

// ─── Feedback + smoke test schemas (0018) ─────────────────────────

export const FEEDBACK_KINDS = [
  "bug",
  "idea",
  "question",
  "friction",
  "praise",
  "smoke_test_result",
] as const;

export const FEEDBACK_STATUSES = [
  "open",
  "triaged",
  "in_progress",
  "resolved",
  "declined",
  "duplicate",
] as const;

export const FeedbackCreateSchema = z.object({
  kind: z.enum(FEEDBACK_KINDS),
  title: z.string().min(1).max(200),
  body: z.string().max(20_000).optional().default(""),
  page_path: z.string().max(500),
  viewport: z.record(z.string(), z.unknown()).optional().default({}),
  payload: z.record(z.string(), z.unknown()).optional().default({}),
  parent_id: z.string().uuid().optional().nullable(),
});

export const FeedbackStatusPatchSchema = z.object({
  status: z.enum(FEEDBACK_STATUSES),
  resolution_note: z.string().max(20_000).optional().nullable(),
  duplicate_of: z.string().uuid().optional().nullable(),
});

export const SmokeTestResultSchema = z.object({
  version_id: z.string().uuid(),
  item_id: z.string().min(1).max(120),
  status: z.enum(["pass", "fail", "unable"]),
  notes: z.string().max(20_000).optional().default(""),
  feedback_id: z.string().uuid().optional().nullable(),
});

// Smoke-test item assignment.
//   "john"     — backend/infra surface (Supabase, Vercel, chain inspection,
//                LLM config). Partners can see + comment but the owner
//                personally handles the verification.
//   "partners" — UI / functional / observable behavior partners can
//                verify end-to-end without backend access.
// Defaults to "partners" since that's the common case; only call out
// John-assigned items explicitly.
export const SMOKE_TEST_ASSIGNEES = ["john", "partners"] as const;

export const SmokeTestVersionSchema = z.object({
  label: z.string().min(1).max(200),
  items: z
    .array(
      z.object({
        id: z.string().min(1).max(120),
        title: z.string().min(1).max(200),
        instructions: z.string().max(20_000),
        expected: z.string().max(20_000),
        reference_image_url: z.string().url().optional(),
        assignee: z.enum(SMOKE_TEST_ASSIGNEES).optional().default("partners"),
      })
    )
    .min(1)
    .max(200),
  is_active: z.boolean().optional().default(true),
});
