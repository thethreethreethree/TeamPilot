import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { chooseProvider } from "@/lib/llm";
import { LlmError } from "@/lib/llm/errors";
import { rateLimit } from "@/lib/api/rateLimit";

// The provider call has a 45s internal timeout (anthropic.ts / deepseek.ts). This
// route awaits it, so it needs a serverless budget ABOVE 45s — otherwise Vercel's
// short default kills the function first and the caller gets a generic 504 instead
// of the structured LlmError { kind: "timeout" } this route exists to surface. 60s
// matches the app-wide LLM-route convention and clears the 45s provider timeout.
export const maxDuration = 60;

/**
 * POST /api/llm/ping
 *
 * A minimal end-to-end smoke test for the active LLM provider. Sends a
 * five-token prompt ("Reply OK.") and reports back:
 *   - which provider answered
 *   - which model id
 *   - wall-clock latency
 *   - token usage if the provider reported it
 *   - the raw reply (so you can SEE the model spoke)
 *
 * Why this exists separately from /api/health: /api/health is called by
 * monitors and dashboards on a fixed cadence. It must NOT spend tokens
 * per call. Ping, by contrast, is user-initiated from a settings screen
 * and is the one place where actually round-tripping to the provider is
 * the point. Rate-limited at 6/min per IP so a stuck client can't drain
 * the key by clicking the button in a loop.
 *
 * Returns:
 *   200 { ok: true, provider, model, latencyMs, usage, reply }
 *   400 { ok: false, error } — no provider configured (key missing)
 *   429 { error } — rate-limited
 *   502 { ok: false, error, kind } — provider call failed; `kind` carries
 *        the structured LlmError taxonomy (auth, rate_limit, network,
 *        server, timeout, parse) so the UI can render a precise message
 *        instead of "something went wrong."
 */
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, {
    id: "llm-ping",
    windowMs: 60_000,
    max: 6,
  });
  if (limited) return limited;

  let provider;
  try {
    provider = chooseProvider();
  } catch (err) {
    // No key configured at all. This is the "you haven't pasted a key
    // yet" case — surface it cleanly with 400 so the UI can prompt the
    // user, distinct from a 5xx that suggests the key is bad.
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "No LLM provider configured.",
      },
      { status: 400 }
    );
  }

  const t0 = Date.now();
  try {
    const result = await provider.call({
      systemPrompt:
        "You are a connectivity test. Respond with the single word: OK.",
      messages: [{ role: "user", content: "Ping." }],
      maxTokens: 5,
    });
    return NextResponse.json({
      ok: true,
      provider: result.provider,
      model: result.model,
      // Prefer the provider-measured latency (more accurate than our
      // outer wrapper, since it excludes JSON parse / network teardown).
      latencyMs: result.latencyMs ?? Date.now() - t0,
      usage: result.usage ?? null,
      reply: result.text.trim().slice(0, 200),
    });
  } catch (err) {
    if (err instanceof LlmError) {
      return NextResponse.json(
        {
          ok: false,
          error: err.message,
          kind: err.kind,
          status: err.status,
          provider: err.provider,
          retryable: err.retryable,
        },
        { status: 502 }
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Unknown error.",
      },
      { status: 502 }
    );
  }
}
