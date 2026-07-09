import { NextRequest, NextResponse } from "next/server";
import { llmStream } from "@/lib/llm";
import { runBrainStream, type ControlGate } from "@/lib/brain";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";
import { detectAll } from "@/lib/coach/heuristics";

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

ABSOLUTE RULES when Coach has flagged the draft:

1. INFERRING THE SUBJECT FROM CONTEXT IS GOOD. If the user wrote "don't act stupid" and the recent thread is about a PDF reference dispute, you SHOULD identify that the user is frustrated about the PDF — that's reading the situation correctly. The user wants the rewrite to be about the real concern. What you must NOT do is invent a NEW concern that isn't in the conversation. Read the context; do not invent context.

2. THE ATTACK / ACCUSATION SHAPE MUST BE STRIPPED. This is the core transformation. The original draft uses attack shape ("don't act stupid"); a rewrite that uses accusation shape ("please don't pretend you don't know what I'm referring to") has FAILED — it's the same attack, just articulated. The accusation IS the pattern Coach flagged. Replace it with the underlying concern.

   Test: would the Coach layer fire the SAME heuristic on the rewrite? If yes, the rewrite has failed. Attack-shaped, accusation-shaped, judgment-shaped rewrites all fail this test regardless of how grammatical or polite they sound.

3. LENGTH IS FREE — when the extra words serve de-escalation. Welcome: labeling the other side's position ("it sounds like X"), naming the speaker's feeling ("I'm getting frustrated"), inviting a slower exchange ("can we slow down?"), or restating the underlying observation. Failure: extra words that articulate the attack at higher resolution.

4. NO VERBATIM TRIGGER. The flagged trigger excerpt must NOT appear in the rewrite at all.

Transformation shapes:
- nvc-evaluation: replace the evaluation with the observation. Pull the observation from the conversation context if available. ("this is stupid" in a thread about a PDF mix-up → "we already covered this in the earlier message — I'm hitting a wall here")
- voss-bare-assertion: open with a short label of the other side before stating the user's position.
- stone-identity-collision: critique the behavior and impact, not the person. The behavior may come from context; the identity attack must go.
- coach-blame-projection: lead with "I'm getting X" instead of "you're making me X". Same emotional substance, no projection.
- coach-emotional-escalation: replace catastrophizing language with the underlying concern, drawn from context if needed.
- coach-hot-state: do not rewrite — return the draft unchanged. The user's job is to pause, not rephrase.
- coach-aggressive-language: convert attack to feeling-plus-concern. Pulling the concern from conversation context is good ("we already covered this — I'm getting frustrated"); preserving the attack shape with new words is failure ("please don't pretend you don't know" — same attack, more words).

CONCRETE EXAMPLE applying these rules:
- Draft: "please don't act stupid"
- Recent thread: someone asked "which PDF are you referring to?" after a PDF was discussed earlier
- BAD rewrite (FAILS rule 2 — still accusation): "Please don't pretend you don't know what I'm referring to."
- GOOD rewrite (passes all four rules): "I'm getting frustrated — I thought we already covered this PDF in the earlier message. Could you take another look?"
  - Pulled subject from context ✓ (rule 1)
  - Stripped accusation: "I'm getting frustrated" instead of "you're acting stupid / pretending" ✓ (rule 2)
  - Longer because de-escalation needed the extra framing ✓ (rule 3)
  - No verbatim "stupid" ✓ (rule 4)

If you cannot produce a rewrite that strips the attack-shape, return the draft unchanged. Honesty beats articulated aggression.`;

function sse(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "chat-guide", windowMs: 60_000, max: 12 });
  if (limited) return limited;

  // Auth gate (audit 2026-07-09): require a signed-in user before the LLM call — an
  // anon caller otherwise drives the model on our bill (middleware doesn't cover
  // /api/*; getCurrentCompanyId returns null, not an error, for anon).
  const _authClient = await createClient();
  const { data: _authData } = await _authClient.auth.getUser();
  if (!_authData?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

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

  // v3.10 (2026-06-12): server-side rewrite verification via Coach.
  // The LLM ignored "do not invent" and produced a 140-char rewrite
  // that pulled a "PDF" reference from recent thread context and was
  // STILL passive-aggressive ("please don't pretend you don't know
  // what I'm referring to"). Prompt rules alone are not enforcement;
  // the server must verify the rewrite actually stripped the pattern.
  //
  // Composition contract (A16): Coach detects → Sharpen rewrites →
  // Coach verifies the rewrite. If the rewrite STILL fires any of the
  // same heuristics that fired on the original, the rewrite has
  // failed its contract — strip the suggestion and emit a gate
  // suppression telling the user the System refused to ship a rewrite
  // that didn't actually pass its own check. Honest > polished.
  //
  // Length is intentionally NOT capped: a longer rewrite is welcome
  // when the extra words serve de-escalation (e.g., labeling the
  // other position before stating disagreement). Length-as-failure
  // was the wrong axis to enforce on — content is what matters.
  const originalHitIds = new Set(
    citations.length > 0
      ? citations.map((c) => c.id)
      : detectAll(draft).map((c) => c.id)
  );

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sse(event, data)));

      let accumulated = "";

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
            accumulated += next.value;
            send("delta", { text: next.value });
            next = await gen.next();
          }
          if (next.done) {
            const gate: ControlGate = next.value.gate;
            if (!gate.guidanceEnabled) {
              send("gate", { suppressed: true, reason: gate.reason });
            }
          }
        } else {
          // Demo mode (no Supabase): bypass brain and call provider directly.
          for await (const delta of llmStream({
            systemPrompt: systemPrompt,
            messages: [{ role: "user", content: context }],
            maxTokens: 400,
          })) {
            accumulated += delta;
            send("delta", { text: delta });
          }
        }

        // ─── A16 composition: verify the rewrite via Coach ──
        // Strip surrounding quotes the same way the client does so the
        // verification reads the actual content the user would see.
        let cleaned = accumulated.trim();
        if (
          (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
          (cleaned.startsWith("“") && cleaned.endsWith("”"))
        ) {
          cleaned = cleaned.slice(1, -1).trim();
        }
        if (originalHitIds.size > 0 && cleaned.length > 0) {
          const rewriteHits = detectAll(cleaned).map((c) => c.id);
          const carriedForward = rewriteHits.filter((id) =>
            originalHitIds.has(id)
          );
          if (carriedForward.length > 0) {
            send("gate", {
              suppressed: true,
              reason: `Rewrite still fires the same Coach pattern${
                carriedForward.length > 1 ? "s" : ""
              } (${carriedForward.join(", ")}) — the System refused to ship a rewrite that didn't actually strip what Coach flagged. Your original draft is preserved.`,
            });
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
