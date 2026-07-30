import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { followUpCoachV5 } from "@/lib/claude";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";
import {
  buildFollowUpSystemPrompt,
  buildFollowUpUserMessage,
} from "@/lib/coach/v5/prompt";
import type { CoachFollowUpResponse } from "@/lib/coach/v5/types";

/**
 * POST /api/coach/v5/followup
 *
 * Coach v5.0 multi-turn conversational follow-up.
 *
 * Spec: docs/COACH_PROMPT_DESIGN.md §1.3
 *
 * Sibling to /api/coach/v5/analyze. The analyze route produces the
 * initial structured response (classification + improvement + why);
 * this route handles every turn after that, where the user is asking
 * a question and the Coach responds conversationally.
 *
 * Same context payload schema as analyze, plus priorTurns + userQuestion.
 */

const ContextPayloadSchema = z.object({
  recentThread: z
    .array(
      z.object({
        author: z.string().max(200),
        body: z.string().max(4000),
        timestamp: z.string().max(40),
      })
    )
    .max(20)
    .optional(),
  topic: z
    .object({
      title: z.string().max(400).optional(),
      description: z.string().max(4000).optional(),
    })
    .optional(),
  decisionSituation: z.string().max(4000).optional(),
  decisionPriorPhases: z
    .object({
      situation: z.string().max(4000).optional(),
      userRead: z.string().max(4000).optional(),
      userProposal: z.string().max(4000).optional(),
    })
    .optional(),
  parentMessage: z
    .object({
      author: z.string().max(200),
      body: z.string().max(4000),
    })
    .optional(),
  taskTitle: z.string().max(400).optional(),
  taskDescription: z.string().max(4000).optional(),
  feedbackKind: z.string().max(100).optional(),
  smokeTestItemTitle: z.string().max(400).optional(),
  supportCustomerLastMessage: z
    .object({
      author: z.string().max(200),
      body: z.string().max(4000),
    })
    .optional(),
  supportProductContext: z.string().max(8000).optional(),
  supportCustomerName: z.string().max(200).optional(),
});

const FollowUpSchema = z.object({
  draft: z.string().min(1).max(8000),
  contextType: z.enum([
    "chat_message",
    "decision_dialogue",
    "chat_reply",
    "task_field",
    "feedback",
    "smoke_test_note",
    "support_reply",
  ]),
  contextPayload: ContextPayloadSchema,
  priorTurns: z
    .array(
      z.object({
        role: z.enum(["user", "coach"]),
        content: z.string().min(1).max(4000),
      })
    )
    .max(20),
  userQuestion: z.string().min(1).max(2000),
});

function validateFollowUpResponse(parsed: unknown): CoachFollowUpResponse | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;
  if (typeof r.reply !== "string" || r.reply.length === 0 || r.reply.length > 4000) {
    return null;
  }
  const starters = r.conversationStarters;
  if (
    !Array.isArray(starters) ||
    starters.some((s) => typeof s !== "string" || s.length > 400)
  ) {
    return null;
  }
  const out: CoachFollowUpResponse = {
    reply: r.reply,
    conversationStarters: starters.slice(0, 3) as string[],
  };
  if (
    typeof r.alternativeRevision === "string" &&
    r.alternativeRevision.length > 0 &&
    r.alternativeRevision.length <= 4000
  ) {
    out.alternativeRevision = r.alternativeRevision;
  }
  return out;
}

// LLM route: longer serverless budget than Vercel's short default (this route awaits a blocking LLM call).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Slightly higher rate limit than analyze because follow-ups are the
  // expected mode of use — a single analyze call can produce 3-5
  // follow-ups in a conversation.
  const limited = rateLimit(req, {
    id: "coach-v5-followup",
    windowMs: 60_000,
    max: 20,
  });
  if (limited) return limited;

  const body = await readBody(req, FollowUpSchema);
  if (body instanceof NextResponse) return body;

  // Auth gate (audit 2026-07-09): require an authenticated user before the LLM call
  // (anon callers otherwise drive the model on our bill — middleware doesn't cover
  // /api/*, and getCurrentCompanyId returns null, not an error, for anon).
  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getUser();
  if (!authData?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const companyId = (await getCurrentCompanyId()) ?? undefined;

    const systemPrompt = buildFollowUpSystemPrompt({
      contextType: body.contextType,
    });
    const userMessage = buildFollowUpUserMessage({
      draft: body.draft,
      contextType: body.contextType,
      contextPayload: body.contextPayload,
      priorTurns: body.priorTurns,
      userQuestion: body.userQuestion,
    });

    const r = await followUpCoachV5({
      companyId,
      systemPrompt,
      userMessage,
    });

    if (r.suppressed) {
      return NextResponse.json(
        { suppressed: true, reason: r.reason },
        { status: 200 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(r.text);
    } catch (parseErr) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[coach/v5/followup] LLM returned non-JSON", {
          sample: r.text.slice(0, 300),
          error: String(parseErr),
        });
      }
      return NextResponse.json(
        {
          error: "Coach returned malformed response. Please try again.",
          code: "malformed_response",
        },
        { status: 502 }
      );
    }

    const validated = validateFollowUpResponse(parsed);
    if (!validated) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[coach/v5/followup] LLM response failed validation", parsed);
      }
      return NextResponse.json(
        {
          error: "Coach returned an invalid response shape. Please try again.",
          code: "invalid_response_shape",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      response: validated,
      provider: r.provider,
      model: r.model,
    });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind },
        { status: err.kind === "rate_limit" ? 429 : err.status ?? 502 }
      );
    }
    console.error("[coach/v5/followup] non-LLM failure:", err);
    return NextResponse.json({ error: "Follow-up generation failed." }, { status: 500 });
  }
}
