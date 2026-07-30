import { NextRequest, NextResponse } from "next/server";
import { llmCall } from "@/lib/llm";
import { runBrainCall } from "@/lib/brain";
import { getCurrentCompanyId } from "@/lib/supabase/auth-helpers";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/api/rateLimit";
import { LlmError } from "@/lib/llm/errors";

/**
 * POST /api/chat/similar
 *
 * "We solved something like this before."
 *
 * Given a new topic the user is composing, plus a catalog of prior topics
 * whose resolution HELD (§3.5 durability=held), surface any prior topic
 * that is ≥70% semantically similar to the new one. This is the §3.6
 * "make learning visible" surface — the System gets to demonstrate it
 * remembers what the team has already worked through.
 *
 * Discipline (§3.3): we surface, we do not assert. The model returns
 * matches with reasoning; the user decides whether to read them, treat
 * the new topic as a duplicate, or proceed as a genuinely new thing.
 *
 * Why non-streaming: the response is small (≤ 5 matches) and we need the
 * structured JSON to render filtered/ranked results. A streamed JSON
 * partial-parse adds complexity for no UX win here.
 *
 * Why ≥70%: a deliberate threshold. <70% picks up surface keyword
 * collisions ("growth" matching every revenue topic). ≥70% requires real
 * structural overlap. The threshold is encoded in the prompt — the model
 * never returns lower-confidence matches.
 *
 * Request body:
 *   { newTopic: { title, description },
 *     candidates: Array<{ id, title, description, closeSummary }> }
 *
 * Response:
 *   { matches: Array<{ id, similarity, reason }> }  (sorted desc, ≤ 5)
 *   { error, kind? } on failure
 */

const SYSTEM_PROMPT = `You are ELOSTATE, surfacing prior team conversations whose resolution HELD that resemble a new topic a team member is starting.

You will receive:
  - A new topic the user is composing (title + description).
  - A catalog of past topics that were closed with durability="held" (the resolution stuck).

Your job: identify which past topics, if any, are ≥70% semantically similar to the new one — same underlying problem, same stakes, same kind of decision. Surface-level keyword overlap is NOT similarity. A new "marketing budget allocation" topic is not similar to a past "marketing campaign launch" topic just because both contain "marketing".

Return strict JSON:
{
  "matches": [
    { "id": "<id from the catalog>", "similarity": 0.85, "reason": "Both address X with stakes Y. The prior resolution would inform this." }
  ]
}

Rules:
- Only include matches with similarity ≥ 0.70. If nothing meets the bar, return { "matches": [] } — honestly, no padding.
- Maximum 5 matches. Sort descending by similarity.
- The "reason" field is one sentence stating WHAT is similar, not WHY the user should care.
- Do NOT recommend an action. Do NOT say "you should reuse" or "consider applying". Surfacing is the entire job.
- IDs in "matches" MUST exactly match an ID from the supplied catalog. Never invent IDs.`;

type Candidate = {
  id: string;
  title: string;
  description?: string | null;
  closeSummary?: string | null;
};

type Match = { id: string; similarity: number; reason: string };

// LLM route: allow a longer LLM/stream budget than Vercel's short default (class-swept
// 2026-07-09 — 50e4ba1 declared maxDuration on finalize/summarize only; this closes the class).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "chat-similar", windowMs: 60_000, max: 30 });
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
    newTopic?: { title?: string; description?: string };
    candidates?: Candidate[];
  };

  const title = (body.newTopic?.title ?? "").trim();
  if (title.length < 4) {
    return new Response(
      JSON.stringify({ matches: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const candidates = (body.candidates ?? []).slice(0, 30);
  if (candidates.length === 0) {
    // No held topics to compare against. Honest empty response — the
    // System hasn't earned a memory yet (§3.4 spirit).
    return new Response(
      JSON.stringify({ matches: [] }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }

  const userTurn = [
    "NEW TOPIC the user is composing:",
    `  Title: ${title}`,
    body.newTopic?.description?.trim()
      ? `  Description: ${body.newTopic.description.trim()}`
      : null,
    "",
    "CATALOG of past topics whose resolutions held:",
    ...candidates.map((c, i) =>
      [
        `  [${i + 1}] id=${c.id}`,
        `      Title: ${c.title}`,
        c.description ? `      Description: ${c.description}` : null,
        c.closeSummary ? `      What held: ${c.closeSummary}` : null,
      ]
        .filter(Boolean)
        .join("\n")
    ),
  ]
    .filter(Boolean)
    .join("\n");

  const companyId = (await getCurrentCompanyId()) ?? undefined;
  const validIds = new Set(candidates.map((c) => c.id));

  try {
    const result = companyId
      ? await runBrainCall({
          companyId,
          basePrompt: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userTurn }],
          maxTokens: 600,
          expectJson: true,
        })
      : await llmCall({
          systemPrompt: SYSTEM_PROMPT,
          messages: [{ role: "user", content: userTurn }],
          maxTokens: 600,
          expectJson: true,
        });

    // Per TT.md A21 audit (2026-06-18) MED finding — until this fix,
    // similar / summarize / topic-decisions each used a different
    // suppression shape (empty matches array / { suppressed:true,reason } /
    // SSE gate event), so clients had to handle three patterns. Now
    // similar matches the standard non-stream shape:
    //   { suppressed: true, reason: string, matches: [] }
    // The matches:[] preserves backward-compat with callers that only
    // check matches; new callers can switch on `suppressed` for an
    // honest "Coach is in §3.4 control window" message.
    if (!result.text) {
      return new Response(
        JSON.stringify({
          suppressed: true,
          reason:
            "Similar-topics analysis is in §3.4 control window — surfaces after the team's baseline is captured.",
          matches: [],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    let parsed: { matches?: unknown };
    try {
      parsed = JSON.parse(result.text) as { matches?: unknown };
    } catch {
      return new Response(
        JSON.stringify({ matches: [], error: "Model returned non-JSON." }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Validate hard: drop anything below the threshold or pointing at an
    // ID not in the catalog. We refuse to surface invented IDs.
    const matches: Match[] = Array.isArray(parsed.matches)
      ? (parsed.matches as unknown[])
          .filter((m): m is Match => {
            if (!m || typeof m !== "object") return false;
            const x = m as Record<string, unknown>;
            return (
              typeof x.id === "string" &&
              typeof x.similarity === "number" &&
              typeof x.reason === "string" &&
              x.similarity >= 0.7 &&
              x.similarity <= 1 &&
              validIds.has(x.id)
            );
          })
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, 5)
      : [];

    return new Response(
      JSON.stringify({
        matches,
        provider: result.provider,
        model: result.model,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    if (err instanceof LlmError) {
      return new Response(
        JSON.stringify({
          matches: [],
          error: err.message,
          kind: err.kind,
          provider: err.provider,
        }),
        { status: 502, headers: { "Content-Type": "application/json" } }
      );
    }
    console.error("[chat/similar] non-LLM failure:", err);
    return new Response(
      JSON.stringify({
        matches: [],
        error: "Couldn't find similar items.",
      }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }
}
