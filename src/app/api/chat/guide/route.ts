import { NextRequest } from "next/server";
import { llmStream } from "@/lib/llm";
import { runBrainStream, type ControlGate } from "@/lib/brain";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/chat/guide
 *
 * "Guide my response." The user has a draft. We stream back a sharper
 * version they can adopt, tweak, or discard. The System never decides
 * for them — it offers a refinement (§3.3 guide-don't-overtake).
 *
 * Request body:
 *   { draft: string, topic: { title, description }, recent: ChatMessage[] }
 *
 * SSE events:
 *   - delta: { text }
 *   - gate:  { suppressed: true, reason }   (§3.4 control window)
 *   - done:  {}
 *   - error: { error, kind?, provider? }
 */

const BASE_SYSTEM_PROMPT = `You are ELOSTATE, helping a team member sharpen their draft chat message.

Your task: produce a clearer, more specific, less hedged version of their draft — IN THEIR VOICE. You are not writing a new message; you are surfacing what they were trying to say more precisely.

Discipline:
- Keep their meaning, intent, and tone. Do not invent new claims, soften their disagreement, or add diplomatic padding they didn't write.
- Cut filler ("just", "really", "kind of", "I think maybe") only when removing it does not change meaning.
- Make vague pronouns specific where the conversation context makes the referent clear.
- If their draft contains a question, keep it a question. If it states a position, keep the position.
- If the draft is already clear and direct AND nothing has been flagged, return it nearly unchanged. Honesty beats interference.

Output rules:
- Reply with the sharpened version ONLY. No preamble, no "here's a sharper version", no quotation marks anywhere, no markdown formatting. Just the message text, as the user could paste it directly.
- Do NOT wrap your response in quotation marks. The message body itself is the entire response.
- Hard ceiling: never longer than the original draft + 25%.

The user remains in charge: this is a suggestion they will accept, edit, or discard.`;

const COACH_AWARE_ADDENDUM = `

The Coach layer (the team's communication-discipline mirror) has flagged the following patterns in the user's draft. When producing the sharpened version, apply each principle so the rewrite preserves the user's intent and concern WITHOUT carrying the flagged shape forward. This is not "softening their disagreement" — the disagreement is preserved; the framing changes.

Patterns to address:
{{COACH_PATTERNS}}

For each flagged pattern, the rewrite should:
- nvc-evaluation → strip the evaluation, name the observable thing the user reacted to. ("this is stupid" → "this didn't account for X")
- voss-bare-assertion → label the other side's position briefly before the user's own. ("we should X" → "It sounds like the constraint is Y — that's why I'm pushing for X")
- stone-identity-collision → critique the behavior and its impact, not the person. ("you're lazy" → "the deploy missed the migrate step — that cost us four hours")
- coach-blame-projection → lead with the speaker's feeling and the specific behavior. ("you're making me mad" → "I'm getting frustrated when standups go long")
- coach-emotional-escalation → calibrate intensity to the action the user wants. ("this is a disaster" → "this is the third time this week — can we figure out why?")
- coach-hot-state → keep the substance; flag that this is a hot-state message in tone (the rewrite is still on the user; they choose to send or pause).
- coach-aggressive-language → remove the direct attack; keep the substance. ("could you not act stupid" → "could you walk through the reasoning for that move — I'm not following")

Hard rule: the rewrite must NOT contain the flagged trigger excerpt verbatim. If the flagged excerpt appears in the rewrite, you have failed the task.`;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "chat-guide", windowMs: 60_000, max: 12 });
  if (limited) return limited;

  const body = (await req.json().catch(() => ({}))) as {
    draft?: string;
    topic?: { title?: string; description?: string };
    recent?: Array<{ author?: string; content: string }>;
    coachCitations?: Array<{
      id?: string;
      label?: string;
      principle?: string;
      trigger_excerpt?: string;
    }>;
  };

  const draft = (body.draft ?? "").trim();
  if (draft.length < 1) {
    return new Response(
      JSON.stringify({ error: "draft is required" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  // v3.9 (2026-06-12): if the Coach layer flagged patterns on this
  // draft (passed by GuideMyResponseModal which ran detectAll on the
  // current draft before opening), inject them into the system prompt
  // so Sharpen rewrites with Coach awareness instead of optimizing
  // for clarity alone. The previous prompt would happily return
  // "could you not act stupid" essentially unchanged because it's
  // already direct — but Coach had flagged it as identity attack and
  // the user expected the rewrite to handle that.
  const citations = (body.coachCitations ?? []).filter(
    (c): c is { id: string; label: string; principle: string; trigger_excerpt: string } =>
      !!c &&
      typeof c.id === "string" &&
      typeof c.label === "string" &&
      typeof c.principle === "string" &&
      typeof c.trigger_excerpt === "string"
  );
  const systemPrompt =
    citations.length > 0
      ? BASE_SYSTEM_PROMPT +
        COACH_AWARE_ADDENDUM.replace(
          "{{COACH_PATTERNS}}",
          citations
            .map(
              (c, i) =>
                `${i + 1}. [${c.id}] "${c.trigger_excerpt}" — ${c.label}. Principle: ${c.principle}`
            )
            .join("\n")
        )
      : BASE_SYSTEM_PROMPT;

  // Build the user-turn payload so the model has just enough context:
  // the topic header and the last few messages, then the draft itself.
  const context = [
    body.topic?.title && `Topic: ${body.topic.title}`,
    body.topic?.description && `Description: ${body.topic.description}`,
    body.recent?.length
      ? "Recent messages (oldest first):\n" +
        body.recent
          .slice(-6)
          .map((m) => `  ${m.author ?? "?"}: ${m.content}`)
          .join("\n")
      : null,
    `\nUser's draft (sharpen this):\n${draft}`,
  ]
    .filter(Boolean)
    .join("\n");

  const companyId = (await getCurrentCompanyId()) ?? undefined;
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      try {
        if (companyId) {
          const gen = runBrainStream({
            companyId,
            basePrompt: systemPrompt,
            messages: [{ role: "user", content: context }],
            maxTokens: 400,
          });
          let next = await gen.next();
          while (!next.done) {
            send("delta", { text: next.value });
            next = await gen.next();
          }
          const gate: ControlGate = next.value.gate;
          if (!gate.guidanceEnabled) {
            send("gate", { suppressed: true, reason: gate.reason });
          }
        } else {
          // Demo mode (no Supabase): bypass brain and call provider directly.
          for await (const delta of llmStream({
            systemPrompt: systemPrompt,
            messages: [{ role: "user", content: context }],
            maxTokens: 400,
          })) {
            send("delta", { text: delta });
          }
        }
        send("done", {});
        controller.close();
      } catch (err) {
        if (err instanceof LlmError) {
          send("error", { error: err.message, kind: err.kind, provider: err.provider });
        } else {
          send("error", { error: err instanceof Error ? err.message : "Unknown error" });
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
