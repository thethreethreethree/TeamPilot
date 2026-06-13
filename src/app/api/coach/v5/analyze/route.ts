import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeCoachV5 } from "@/lib/claude";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";
import { buildSystemPrompt, buildUserMessage } from "@/lib/coach/v5/prompt";
import type {
  CoachAnalysisResponse,
  CoachClassification,
} from "@/lib/coach/v5/types";

/**
 * POST /api/coach/v5/analyze
 *
 * Coach v5.0 — the LLM-primary conversational communication coach.
 * Replaces the v3.x regex-primary detection layer with full LLM reading
 * against the verified Knowledge Base (docs/COACH_KNOWLEDGE_BASE.md).
 *
 * Spec: docs/COACH_PROMPT_DESIGN.md
 *
 * Modes:
 *   - "auto" — passive pre-send (Coach speaks only when draft needs work)
 *   - "ask" — active pre-send (user clicked Ask Coach; Coach speaks either way)
 *   - "review_sent" — retrospective on an already-sent message (teaching only;
 *     no accept/refine possible)
 *
 * Rate limit: tight (10/min/user) because each call is heavyweight (~9k
 * input tokens). Auto-Coach should debounce client-side so steady-state
 * usage stays well under the limit.
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
});

const AnalyzeSchema = z.object({
  mode: z.enum(["auto", "ask", "review_sent"]),
  draft: z.string().min(1).max(8000),
  contextType: z.enum([
    "chat_message",
    "decision_dialogue",
    "chat_reply",
    "task_field",
    "feedback",
    "smoke_test_note",
  ]),
  contextPayload: ContextPayloadSchema,
});

const VALID_CLASSIFICATIONS = new Set<CoachClassification>([
  "correct",
  "unclear",
  "unproductive",
  "negative",
]);

/**
 * Validate the parsed LLM output against the response shape. Returns
 * either a clean response or null if the response was structurally
 * invalid. Defense-in-depth — the LLM is instructed to return strict
 * JSON, but we never trust that on the server side.
 */
function validateResponse(parsed: unknown): CoachAnalysisResponse | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;

  const classification = r.classification;
  if (typeof classification !== "string" || !VALID_CLASSIFICATIONS.has(classification as CoachClassification)) {
    return null;
  }
  const needsImprovement = r.needsImprovement;
  if (typeof needsImprovement !== "boolean") return null;

  const conversationStarters = r.conversationStarters;
  if (
    !Array.isArray(conversationStarters) ||
    conversationStarters.some((s) => typeof s !== "string" || s.length > 400)
  ) {
    return null;
  }

  const response: CoachAnalysisResponse = {
    classification: classification as CoachClassification,
    needsImprovement,
    conversationStarters: conversationStarters.slice(0, 3) as string[],
  };

  // Optional affirmation.
  if (typeof r.affirmation === "string" && r.affirmation.length > 0 && r.affirmation.length <= 600) {
    response.affirmation = r.affirmation;
  }

  // Optional improvement block — required when needsImprovement is true.
  if (needsImprovement) {
    const imp = r.improvement;
    if (typeof imp !== "object" || imp === null) return null;
    const i = imp as Record<string, unknown>;
    if (
      typeof i.suggestedRevision !== "string" ||
      i.suggestedRevision.length === 0 ||
      i.suggestedRevision.length > 4000 ||
      typeof i.whyContext !== "string" ||
      i.whyContext.length === 0 ||
      i.whyContext.length > 800 ||
      typeof i.whySentence !== "string" ||
      i.whySentence.length === 0 ||
      i.whySentence.length > 800
    ) {
      return null;
    }
    const principle = i.principleCited;
    if (typeof principle !== "object" || principle === null) return null;
    const p = principle as Record<string, unknown>;
    if (
      typeof p.name !== "string" ||
      typeof p.book !== "string" ||
      typeof p.sectionRef !== "string"
    ) {
      return null;
    }
    response.improvement = {
      suggestedRevision: i.suggestedRevision,
      whyContext: i.whyContext,
      whySentence: i.whySentence,
      principleCited: {
        name: p.name,
        book: p.book,
        sectionRef: p.sectionRef,
      },
    };
    // Optional secondary principle.
    if (typeof i.secondaryPrinciple === "object" && i.secondaryPrinciple !== null) {
      const sp = i.secondaryPrinciple as Record<string, unknown>;
      if (
        typeof sp.name === "string" &&
        typeof sp.book === "string" &&
        typeof sp.sectionRef === "string"
      ) {
        response.improvement.secondaryPrinciple = {
          name: sp.name,
          book: sp.book,
          sectionRef: sp.sectionRef,
        };
      }
    }
  }

  return response;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "coach-v5-analyze",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;

  const body = await readBody(req, AnalyzeSchema);
  if (body instanceof NextResponse) return body;

  try {
    const companyId = (await getCurrentCompanyId()) ?? undefined;

    const systemPrompt = buildSystemPrompt({
      mode: body.mode,
      contextType: body.contextType,
    });
    const userMessage = buildUserMessage({
      draft: body.draft,
      contextType: body.contextType,
      contextPayload: body.contextPayload,
    });

    const r = await analyzeCoachV5({
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

    // Parse the LLM's JSON response.
    let parsed: unknown;
    try {
      parsed = JSON.parse(r.text);
    } catch (parseErr) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[coach/v5/analyze] LLM returned non-JSON", {
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

    const validated = validateResponse(parsed);
    if (!validated) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[coach/v5/analyze] LLM response failed validation", parsed);
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
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
