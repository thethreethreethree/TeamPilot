import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { analyzeCoachV5 } from "@/lib/claude";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";
import { buildSystemPrompt, buildUserMessage } from "@/lib/coach/v5/prompt";
import { loadCoachMemory, renderMemoryForPrompt } from "@/lib/coach/v5/memory";
import { createClient } from "@/lib/supabase/server";
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
  // Per TT.md A21 — C.A.R.E support_reply parity. Same Coach v5
  // backend; just adds the support surface's context fields.
  supportCustomerLastMessage: z
    .object({
      author: z.string().max(200),
      body: z.string().max(4000),
    })
    .optional(),
  supportProductContext: z.string().max(8000).optional(),
  supportCustomerName: z.string().max(200).optional(),
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
    "support_reply",
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

// LLM route: longer serverless budget than Vercel's short default (this route awaits a blocking LLM call).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "coach-v5-analyze",
    windowMs: 60_000,
    max: 10,
  });
  if (limited) return limited;

  const body = await readBody(req, AnalyzeSchema);
  if (body instanceof NextResponse) return body;

  // Auth gate (audit 2026-07-09): require an authenticated user BEFORE the ~9k-token
  // LLM call. getCurrentCompanyId() returns null (not an error) for an anon caller,
  // and middleware doesn't cover /api/*, so without this an unauthenticated caller
  // could drive the model on our bill. Matches every sibling coach route's contract.
  const authClient = await createClient();
  const { data: authData } = await authClient.auth.getUser();
  if (!authData?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const companyId = (await getCurrentCompanyId()) ?? undefined;

    // Cross-conversation memory — the Coach reads its own prior
    // coachings on THIS user across topics (§1.6 close-the-loop
    // applied to itself). renderMemoryForPrompt returns null when
    // history is too thin to be useful; the prompt builder omits
    // the section in that case. Always safe — falls back to the
    // empty snapshot on auth/network failure so the analyze flow
    // never blocks on memory unavailability.
    const memory = await loadCoachMemory();
    const memoryBlock = renderMemoryForPrompt(memory);

    const systemPrompt = buildSystemPrompt({
      mode: body.mode,
      contextType: body.contextType,
      memoryBlock,
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

    // Emit the analyze event so future cross-conversation memory
    // calls have data to read. Best-effort — never blocks the
    // response. Captures the principle cited (when needsImprovement
    // is true) so the memory loader can recognize recurring
    // patterns by name. Subject convention matches emit.ts:
    // chat_topic | task | decision | feedback | smoke_test_result.
    try {
      const supabase = await createClient();
      const { data: auth } = await supabase.auth.getUser();
      if (auth.user && companyId) {
        await supabase.from("events").insert({
          company_id: companyId,
          actor: auth.user.id,
          kind: "coach.analyze_returned",
          subject: subjectFor(body.contextType),
          payload: {
            mode: body.mode,
            context_type: body.contextType,
            classification: validated.classification,
            needs_improvement: validated.needsImprovement,
            principle: validated.improvement?.principleCited.name ?? null,
            book: validated.improvement?.principleCited.book ?? null,
            section_ref: validated.improvement?.principleCited.sectionRef ?? null,
            secondary_principle:
              validated.improvement?.secondaryPrinciple?.name ?? null,
            had_memory_block: !!memoryBlock,
            memory_pattern_count: memory.patterns.length,
            coach_version: "v5.0",
          },
        });
      }
    } catch (emitErr) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[coach/v5/analyze] event emit failed (non-fatal)", emitErr);
      }
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
    console.error("[coach/v5/analyze] non-LLM failure:", err);
    return NextResponse.json({ error: "Analysis failed." }, { status: 500 });
  }
}

/**
 * Map the analyze context type to a chain subject prefix matching
 * the existing emit.ts convention. The analyze route doesn't know
 * the concrete topic/task id (the prompt body doesn't carry them),
 * so we use the surface prefix with ':analyze' as the suffix. The
 * §4 readout buckets by prefix so this still attributes cleanly,
 * and the actor+payload+timestamp identify the specific call.
 */
function subjectFor(contextType: string): string {
  switch (contextType) {
    case "chat_message":
    case "chat_reply":
      return "chat_topic:analyze";
    case "decision_dialogue":
      return "decision:analyze";
    case "task_field":
      return "task:analyze";
    case "feedback":
      return "feedback:analyze";
    case "smoke_test_note":
      return "smoke_test_result:analyze";
    case "support_reply":
      // C.A.R.E surface — bucket alongside support_conversation
      // events so §4 readouts roll up the agent's Coach activity
      // into the customer's conversation history per A21.
      return "support_conversation:analyze";
    default:
      return `${contextType}:analyze`;
  }
}
