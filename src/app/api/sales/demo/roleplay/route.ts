import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/api/rateLimit";
import { readBody } from "@/lib/api/validate";
import { generateCareReply } from "@/lib/claude";
import { parseRoleplayReply, prospectOnlyFallback } from "@/lib/sales/parseRoleplayReply";

/**
 * POST /api/sales/demo/roleplay — the REAL engine behind the /sales/demo "Practice on a live prospect"
 * panel (founder 2026-07-22, mirrors /api/care/demo/ask).
 *
 * One live LLM call does two jobs at once — which IS the Sales Coach's differentiator (real-time
 * coaching while you sell): it (1) plays a specific, realistically-skeptical PROSPECT in character, and
 * (2) returns a single short COACH CUE on the rep's last line, the same shape the live-cue engine
 * delivers in-product. Stateless/no-persistence + public → HARD rate-limited, input length-bounded,
 * history capped. Soft-fails to a graceful line on any LLM error instead of 500ing.
 *
 * generateCareReply is used here purely as the shared systemPrompt+userMessage LLM text helper (it is
 * not Care-specific in behaviour — it wraps the provider call and returns { text }).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RoleplaySchema = z
  .object({
    message: z.string().min(1).max(1000),
    history: z
      .array(
        z.object({
          role: z.enum(["rep", "prospect"]),
          content: z.string().min(1).max(2000),
        })
      )
      .max(12)
      .optional(),
  })
  .strict();

// The prospect persona + coach instruction. Fixed for the demo so the experience is consistent.
const SYSTEM_PROMPT = `You are running a SALES-COACHING ROLEPLAY for a live product demo. You do TWO things in one turn.

1) PLAY THE PROSPECT. You are "Dana Cole", VP of Operations at a ~40-person logistics company, evaluating a team-coordination + coaching SaaS. You are busy, a little skeptical, and price-sensitive, but fair and winnable by a good rep. Stay fully in character. React to what the salesperson actually said. Keep it to 1-3 natural sentences. Never break character, never mention that you are an AI or a roleplay, never coach the salesperson yourself.

2) BE THE SALES COACH. Separately, give the SALESPERSON exactly ONE short cue (max ~20 words) about their LAST message — name what worked, or the single highest-leverage thing to sharpen next turn. Ground it in the methodology the product coaches from: SPIN-style discovery before pitching, a Challenger-style reframe that teaches the buyer something, and Voss's tactical empathy — label the concern, use a calibrated question, tie value to their stated problem, ask instead of assert. Do not restate their message; give the move.

Return ONLY compact JSON, no code fences, no prose around it:
{"prospect": "<the prospect's in-character reply>", "cue": "<the one coach cue>"}`;

export async function POST(req: NextRequest) {
  const perMin = rateLimit(req, { id: "sales-demo-roleplay", windowMs: 60_000, max: 8 });
  if (perMin) return perMin;
  const perTenMin = rateLimit(req, { id: "sales-demo-roleplay-10m", windowMs: 600_000, max: 40 });
  if (perTenMin) return perTenMin;

  const body = await readBody(req, RoleplaySchema);
  if (body instanceof NextResponse) return body;

  const historyText = (body.history ?? [])
    .map((t) => `${t.role === "rep" ? "Salesperson" : "Dana (prospect)"}: ${t.content}`)
    .join("\n");
  const userMessage = [
    historyText ? `Conversation so far:\n${historyText}` : "This is the opening line of the call.",
    `Salesperson's latest line:\n${body.message}`,
    `Now return the JSON with the prospect's reply and the one coach cue.`,
  ].join("\n\n");

  try {
    const r = await generateCareReply({ systemPrompt: SYSTEM_PROMPT, userMessage });
    const parsed = parseRoleplayReply(r.text);
    if (!parsed) {
      // The model answered but not as clean JSON. Keep the prospect line, strip any cue/coach section
      // so the coaching can never leak into the prospect's mouth (audit F2, unit-tested in the lib).
      return NextResponse.json({ prospect: prospectOnlyFallback(r.text), cue: "" });
    }
    return NextResponse.json(parsed);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(
      "[sales.demo.roleplay] failed:",
      err instanceof Error ? `${err.name}: ${err.message}` : err
    );
    return NextResponse.json({
      prospect:
        "Sorry — I need to jump to another meeting. Send me the one-line version of why this is worth 20 minutes and I'll book time.",
      cue: "Practice picks back up in a moment — the live coach hit a hiccup, not your pitch.",
    });
  }
}
