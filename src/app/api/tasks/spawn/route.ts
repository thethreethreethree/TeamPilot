import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { spawnTask } from "@/lib/claude";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";
import {
  buildSpawnSystemPrompt,
  buildSpawnUserMessage,
} from "@/lib/taskSpawn/prompt";
import type { SpawnedTaskDraft } from "@/lib/taskSpawn/types";

/**
 * POST /api/tasks/spawn
 *
 * Task Spawn Engine — Sprint 1.
 *
 * Takes a context payload (decision OR chat-message selection) plus
 * an optional adjustment_prompt + previousTaskDraft for iteration.
 * Returns a structured task draft (title, description, ordered steps)
 * the user can review in the refinement panel before saving.
 *
 * Does NOT persist the task — saving is a separate `/api/tasks` POST
 * that the refinement panel triggers when the user accepts the draft.
 * This separation matches the §3.3 guide-don't-overtake discipline:
 * the engine produces structure; the user decides whether to commit.
 *
 * Rate limit: 12/min/user — iterating on a draft a few times is
 * normal, but a runaway loop would chew through tokens fast.
 */

const ContextPayloadSchema = z.object({
  decisionId: z.string().uuid().optional(),
  decisionSituation: z.string().max(4000).optional(),
  decisionDiagnosis: z.string().max(4000).optional(),
  decisionProposal: z.string().max(4000).optional(),
  decisionSystemResponse: z.record(z.string(), z.unknown()).optional(),
  decisionChosenPath: z.enum(["user", "system", "hybrid", "defer"]).optional(),
  decisionChosenNote: z.string().max(4000).optional(),
  chatTopicId: z.string().uuid().optional(),
  chatTopicTitle: z.string().max(400).optional(),
  chatTopicDescription: z.string().max(4000).optional(),
  selectedMessageIds: z.array(z.string().uuid()).max(50).optional(),
  selectedMessages: z
    .array(
      z.object({
        author: z.string().max(200),
        body: z.string().max(4000),
      })
    )
    .max(50)
    .optional(),
  surroundingThread: z
    .array(
      z.object({
        author: z.string().max(200),
        body: z.string().max(4000),
      })
    )
    .max(30)
    .optional(),
});

const PreviousTaskDraftSchema = z.object({
  title: z.string().min(1).max(400),
  description: z.string().min(1).max(8000),
  steps: z.array(z.string().min(1).max(800)).min(1).max(20),
});

const SpawnSchema = z.object({
  contextType: z.enum(["decision", "chat_messages"]),
  contextPayload: ContextPayloadSchema,
  adjustmentPrompt: z.string().max(2000).optional(),
  previousTaskDraft: PreviousTaskDraftSchema.optional(),
});

function validateTaskDraft(parsed: unknown): SpawnedTaskDraft | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;
  if (
    typeof r.title !== "string" ||
    r.title.trim().length === 0 ||
    r.title.length > 400
  ) {
    return null;
  }
  if (
    typeof r.description !== "string" ||
    r.description.trim().length === 0 ||
    r.description.length > 8000
  ) {
    return null;
  }
  if (!Array.isArray(r.steps) || r.steps.length === 0 || r.steps.length > 20) {
    return null;
  }
  const steps: string[] = [];
  for (const s of r.steps) {
    if (typeof s !== "string" || s.trim().length === 0 || s.length > 800) {
      return null;
    }
    steps.push(s.trim());
  }
  return {
    title: r.title.trim(),
    description: r.description.trim(),
    steps,
  };
}

// LLM route: longer serverless budget than Vercel's short default (this route awaits a blocking LLM call).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "tasks-spawn",
    windowMs: 60_000,
    max: 12,
  });
  if (limited) return limited;

  // Auth gate (audit 2026-07-09): require a signed-in user before the LLM call — an
  // anon caller otherwise drives the model on our bill (middleware doesn't cover
  // /api/*; getCurrentCompanyId returns null, not an error, for anon).
  const _authClient = await createClient();
  const { data: _authData } = await _authClient.auth.getUser();
  if (!_authData?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  const body = await readBody(req, SpawnSchema);
  if (body instanceof NextResponse) return body;

  // Refinement requires a previous draft. If the caller sent an
  // adjustmentPrompt without one, treat as a malformed request — the
  // user shouldn't be iterating on nothing.
  if (body.adjustmentPrompt && !body.previousTaskDraft) {
    return NextResponse.json(
      {
        error:
          "adjustmentPrompt requires previousTaskDraft. Either send both (refine) or neither (initial spawn).",
      },
      { status: 400 }
    );
  }

  try {
    const companyId = (await getCurrentCompanyId()) ?? undefined;

    const systemPrompt = buildSpawnSystemPrompt({
      contextType: body.contextType,
      isRefinement: !!body.adjustmentPrompt,
    });
    const userMessage = buildSpawnUserMessage({
      contextType: body.contextType,
      contextPayload: body.contextPayload,
      previousTaskDraft: body.previousTaskDraft,
      adjustmentPrompt: body.adjustmentPrompt,
    });

    const r = await spawnTask({
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
        console.warn("[tasks/spawn] LLM returned non-JSON", {
          sample: r.text.slice(0, 300),
          error: String(parseErr),
        });
      }
      return NextResponse.json(
        {
          error: "Spawn engine returned malformed response. Please try again.",
          code: "malformed_response",
        },
        { status: 502 }
      );
    }

    const validated = validateTaskDraft(parsed);
    if (!validated) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[tasks/spawn] response failed validation", parsed);
      }
      return NextResponse.json(
        {
          error: "Spawn engine returned an invalid task shape. Please try again.",
          code: "invalid_response_shape",
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      task: validated,
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
