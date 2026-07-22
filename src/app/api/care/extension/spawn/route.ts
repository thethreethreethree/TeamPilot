import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { guardExtensionRequest } from "@/lib/api/extensionGuard";
import { spawnTask } from "@/lib/claude";
import { buildSpawnSystemPrompt, buildSpawnUserMessage } from "@/lib/taskSpawn/prompt";
import { validateTaskDraft } from "@/lib/taskSpawn/validate";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/care/extension/spawn — Spawn task ("turn this into a C.A.R.E task"), for the browser extension.
 *
 * Text-in ({ conversation }) → { task: {title, description, steps} }: structures the scanned customer
 * conversation into a task DRAFT via the SAME engine the in-app Task Spawn uses (buildSpawn* + spawnTask). Like
 * the in-app engine, this returns a DRAFT and does NOT persist it (§3.3 guide-don't-overtake — the engine
 * produces structure; the human decides whether to commit it in their workspace).
 *
 * WHY THIS ONE IS DIFFERENT (§3.4 / A3): Summarize/Dissect/Coach/Co-Pilot/Formulate all act on the user's
 * EXTERNAL conversation and never touch the team's own record — so they are not control-gated. Spawn is the
 * tool that reaches INTO the team's internal work (a task is internal-chain material). So — matching the in-app
 * spawn route — this DOES route through the §3.4 control window (companyId passed to spawnTask): during a team's
 * month-1 baseline the AI does not spawn work for them; `{ suppressed }` is returned and the agent works as
 * themselves. This is the honest posture, not a bug.
 *
 * BOUNDARY (surfaced for the founder): this produces the draft only. One-click CREATE-and-persist from the
 * extension would write into the internal event chain from a surface operating on external conversations — the
 * governed write the A3 decision names. That step is intentionally left to an explicit follow-up; for now the
 * agent finalizes the task in their C.A.R.E workspace (the draft gives them the structure).
 *
 * GATES: requireEntitledExtensionUser → per-user rate limit (matches in-app spawn 12/min).
 * DATA GOVERNANCE (D1 — ephemeral): the conversation is processed to draft the task, then DISCARDED.
 */

export const runtime = "nodejs";
export const maxDuration = 60;

const Schema = z
  .object({
    conversation: z.string().min(1).max(20_000),
  })
  .strict();

export async function POST(req: NextRequest) {
  const guard = await guardExtensionRequest(req, { tool: "spawn", perUserMax: 12, schema: Schema });
  if (!guard.ok) return guard.response;
  const { user, body } = guard;

  try {
    const systemPrompt = buildSpawnSystemPrompt({
      contextType: "chat_messages",
      isRefinement: false,
    });
    const userMessage = buildSpawnUserMessage({
      contextType: "chat_messages",
      contextPayload: {
        selectedMessages: [{ author: "Customer conversation", body: body.conversation }],
      },
    });

    // §3.4 control window applies (this reaches into internal work — see header): pass companyId.
    const r = await spawnTask({
      companyId: user.companyId,
      systemPrompt,
      userMessage,
    });

    if (r.suppressed) {
      return NextResponse.json(
        {
          suppressed: true,
          reason: r.reason,
          message:
            "Spawn is paused while the System learns your team's first-month baseline — capture the task yourself for now.",
        },
        { status: 200 }
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(r.text);
    } catch {
      return NextResponse.json(
        { error: "The spawn engine returned a malformed response. Please try again.", code: "malformed_response" },
        { status: 502 }
      );
    }

    const task = validateTaskDraft(parsed);
    if (!task) {
      return NextResponse.json(
        { error: "The spawn engine returned an invalid task shape. Please try again.", code: "invalid_response_shape" },
        { status: 502 }
      );
    }

    return NextResponse.json({ task });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        { error: err.message, kind: err.kind },
        { status: err.kind === "rate_limit" ? 429 : (err.status ?? 502) }
      );
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Couldn't spawn a task right now." },
      { status: 502 }
    );
  }
}
