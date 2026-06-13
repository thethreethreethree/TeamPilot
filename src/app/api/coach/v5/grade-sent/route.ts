import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gradeCoachV5 } from "@/lib/claude";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";
import {
  buildGraderSystemPrompt,
  buildGraderUserMessage,
} from "@/lib/coach/v5/graderPrompt";
import type { EncouragementGrade, GradeResponse } from "@/lib/coach/v5/types";

/**
 * POST /api/coach/v5/grade-sent
 *
 * Coach v5.0 Encouragement System — post-send grader.
 * Spec: docs/COACH_PROMPT_DESIGN.md §10.
 *
 * Called by the client AFTER a message lands (so it doesn't block
 * sending). Returns a grade that drives the asymmetric visibility
 * layer:
 *   - "productive" → 🙌 (sender only)
 *   - "neutral" → no indicator
 *   - "needs_guidance" → "Review with Coach" CTA (sender) +
 *     "Needs Guidance" label (admins/execs)
 *   - "withheld" → fallback for grader unavailable (no indicator)
 *
 * Also writes a `coach.message_graded` event into the §3.1 chain so
 * the leader view + the user's history can query the grades.
 *
 * Rate limit: 30/min/user — every sent message gets graded, but
 * client-side debounce + caching should keep steady-state usage low.
 */

const GradeSchema = z.object({
  sentMessage: z.string().min(1).max(8000),
  contextType: z.enum([
    "chat_message",
    "decision_dialogue",
    "chat_reply",
    "task_field",
    "feedback",
    "smoke_test_note",
  ]),
  /** The subject string used to scope the chain event — same
   *  convention as v3 emit: "chat_topic:UUID", "task:UUID", etc. */
  subject: z.string().min(1).max(200),
  /** Optional ID of the message being graded — when known, included
   *  in the chain event payload so the leader's view can map labels
   *  to specific messages. */
  messageId: z.string().uuid().optional(),
  recentThread: z
    .array(
      z.object({
        author: z.string().max(200),
        body: z.string().max(4000),
        timestamp: z.string().max(40),
      })
    )
    .max(10)
    .optional(),
  parentMessage: z
    .object({
      author: z.string().max(200),
      body: z.string().max(4000),
    })
    .optional(),
});

const VALID_GRADES = new Set<EncouragementGrade>([
  "productive",
  "neutral",
  "needs_guidance",
  "withheld",
]);

function validateGraderResponse(parsed: unknown): GradeResponse | null {
  if (typeof parsed !== "object" || parsed === null) return null;
  const r = parsed as Record<string, unknown>;
  const grade = r.grade;
  if (typeof grade !== "string" || !VALID_GRADES.has(grade as EncouragementGrade)) {
    return null;
  }
  if (grade === "withheld") {
    // The grader is told not to use "withheld" — only the system uses
    // it as a fallback. Treat the LLM returning it as a soft error.
    return null;
  }
  const response: GradeResponse = { grade: grade as EncouragementGrade };
  if (
    typeof r.reasonInternal === "string" &&
    r.reasonInternal.length > 0 &&
    r.reasonInternal.length <= 800
  ) {
    response.reasonInternal = r.reasonInternal;
  }
  return response;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "coach-v5-grade-sent",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const body = await readBody(req, GradeSchema);
  if (body instanceof NextResponse) return body;

  try {
    const companyId = (await getCurrentCompanyId()) ?? undefined;
    if (!companyId) {
      // Without company context we can't write the chain event; return
      // a withheld grade so the UI knows not to display anything.
      return NextResponse.json({
        response: { grade: "withheld" as EncouragementGrade },
      });
    }

    const systemPrompt = buildGraderSystemPrompt({
      contextType: body.contextType,
    });
    const userMessage = buildGraderUserMessage({
      sentMessage: body.sentMessage,
      recentThread: body.recentThread,
      parentMessage: body.parentMessage,
    });

    const r = await gradeCoachV5({
      companyId,
      systemPrompt,
      userMessage,
    });

    if (r.suppressed) {
      return NextResponse.json({
        response: { grade: "withheld" as EncouragementGrade },
        suppressed: true,
        reason: r.reason,
      });
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(r.text);
    } catch {
      return NextResponse.json({
        response: { grade: "withheld" as EncouragementGrade },
      });
    }

    const validated = validateGraderResponse(parsed);
    if (!validated) {
      return NextResponse.json({
        response: { grade: "withheld" as EncouragementGrade },
      });
    }

    // Write the grade to the §3.1 chain so:
    //   - The leader view can query "Needs Guidance" labels
    //   - The user can review their own grade history
    //   - The §4 readout can measure communication-grade trends
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      await supabase.from("events").insert({
        company_id: companyId,
        actor: auth.user.id,
        kind: "coach.message_graded",
        subject: body.subject,
        payload: {
          grade: validated.grade,
          context_type: body.contextType,
          message_id: body.messageId,
          // reasonInternal is stored in the chain — the user's Review-
          // with-Coach call later reads it back. Leader-visible queries
          // must NOT surface this field (it's the internal hook for
          // the Coach, not the leader-side label).
          reason_internal: validated.reasonInternal,
          grader_version: "v5.0",
        },
      });
    }

    return NextResponse.json({
      response: validated,
      provider: r.provider,
      model: r.model,
    });
  } catch (err) {
    // Encouragement System failures must NOT block sending — the
    // message already landed. We swallow errors and return withheld.
    if (process.env.NODE_ENV !== "production") {
      console.warn("[coach/v5/grade-sent] grader failed", err);
    }
    if (err instanceof LlmError) {
      return NextResponse.json({
        response: { grade: "withheld" as EncouragementGrade },
        error: err.message,
        kind: err.kind,
      });
    }
    return NextResponse.json({
      response: { grade: "withheld" as EncouragementGrade },
    });
  }
}
