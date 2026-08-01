import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
// Prompt-injection fence — the roleplay transcript is conversation text; the AI
// must stay in the prospect role and never obey commands embedded in it.
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { getCurrentSalesCorpus } from "@/lib/data/salesCoach";
import { extractObjectionGuidance } from "@/lib/coach/v5/objectionGuidance";
import { dissectCoachV5 } from "@/lib/claude";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";

/**
 * Sales Coach → Roleplay Practice (founder 2026-07-05; text-first per the
 * 2026-07-06 decision — voice is a later phase on the existing voice infra).
 *
 * Turn-based text roleplay: an LLM plays the PROSPECT so the rep can practice
 * a pitch, then a coaching REVIEW at the end. Stateless — the client holds the
 * conversation and posts it each turn; nothing is persisted (a roleplay is
 * practice, not a real recorded call, so it must NOT pollute the rep's session
 * history or metrics — deliberate MVP scope, persistence deferred).
 *
 * Composition (A21, not a fork): reuses dissectCoachV5 (the same LLM path the
 * real review engine uses) and the company methodology corpus (0074) to ground
 * both the prospect's objections and the review — so practice speaks the same
 * language as real reviews. It is NOT the stored after-pitch engine (that needs
 * a real diarized, persisted call); this is a lightweight ephemeral sibling.
 */

const Message = z.object({
  role: z.enum(["rep", "prospect"]),
  text: z.string().trim().min(1).max(4000),
});
const Body = z.object({
  phase: z.enum(["turn", "review"]),
  context: z.enum(["in_person", "video"]),
  persona: z.string().trim().min(1).max(200),
  customPrompt: z.string().trim().max(600).optional(),
  messages: z.array(Message).max(80),
});

function channelLine(context: "in_person" | "video"): string {
  return context === "in_person"
    ? "an in-person, at-the-door / field conversation (body language, doorstep timing matter)"
    : "a remote video call (framing, pacing, screen presence matter)";
}

function transcriptOf(messages: z.infer<typeof Body>["messages"]): string {
  return messages
    .map((m) => `${m.role === "rep" ? "REP" : "PROSPECT"}: ${m.text}`)
    .join("\n");
}

function prospectSystem(body: z.infer<typeof Body>, corpus?: string): string {
  const custom = body.customPrompt
    ? `\nExtra context about who you are / the situation: ${body.customPrompt}`
    : "";
  const grounding = corpus
    ? `\n\nThe rep sells in this market; let your objections and interests fit it, but do NOT recite it — stay a real person:\n${corpus.slice(0, 4000)}`
    : "";
  return `You are role-playing as a sales PROSPECT so a salesperson can practice their pitch. This is ${channelLine(body.context)}.

Your persona: ${body.persona}.${custom}

Stay fully in character. Reply in 1-3 natural sentences as the prospect would actually speak. Raise the realistic objections, hesitations, and questions this persona has. Don't be a pushover, but be fair — if the rep genuinely earns trust or answers well, you can warm up; if they're pushy or vague, react like a real person would. NEVER coach, evaluate, narrate, or break character, and NEVER say you are an AI.${grounding}

Return ONLY JSON: {"reply": "<your next line as the prospect>"}.`;
}

function reviewSystem(body: z.infer<typeof Body>, corpus?: string): string {
  const grounding = corpus
    ? `\n\nGround your assessment in this company's own methodology where relevant:\n${corpus.slice(0, 4000)}`
    : "";
  // The team's OWN objection rules, pulled from the FULL methodology (founder 2026-07-30) so they are
  // never lost to the 4000-char slice above. When judging how the rep handled objections/rejection, hold
  // them to THESE rules — the same rules the live coach uses, so both modes coach objections identically.
  const objection = corpus ? extractObjectionGuidance(corpus, 1000) : "";
  const objectionBlock = objection
    ? `\n\nWhen you assess how the rep handled objections or rejection, hold them to THIS TEAM'S OWN objection rules (not generic tactics):\n${objection}`
    : "";
  return `You are a sales coach reviewing a PRACTICE roleplay between a rep and a simulated prospect (${channelLine(body.context)}). Be specific, honest, and encouraging — this is practice, so the point is to help the rep improve, not to grade them down. Cite the rep's ACTUAL words from the transcript; never invent lines they didn't say.${grounding}${objectionBlock}

Return ONLY JSON with this exact shape:
{
  "summary": "<1-2 sentences: an honest, plain read of how the rep did>",
  "whatWorked": ["<a specific thing the rep did well, quoting them if possible>"],
  "toImprove": ["<a specific, actionable thing to work on next time>"],
  "correctLine": { "line": "<a stronger line the rep could have used at a key moment>", "why": "<why that line works, briefly>" }
}

whatWorked and toImprove each hold 1-3 short items. correctLine may be null if there was no clear moment to improve. If the roleplay was too short to assess fairly, say so honestly in summary and return empty arrays with a null correctLine — do not manufacture feedback.`;
}

function parseReply(text: string): string | null {
  try {
    const o = JSON.parse(text) as { reply?: unknown };
    if (typeof o.reply === "string" && o.reply.trim()) return o.reply.trim();
  } catch {
    /* fall through */
  }
  return null;
}

type RoleplayReview = {
  summary: string;
  whatWorked: string[];
  toImprove: string[];
  correctLine: { line: string; why: string } | null;
};

function parseReview(text: string): RoleplayReview {
  const empty: RoleplayReview = {
    summary: "",
    whatWorked: [],
    toImprove: [],
    correctLine: null,
  };
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return empty;
  }
  const strArr = (v: unknown): string[] =>
    Array.isArray(v)
      ? v.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((s) => s.trim()).slice(0, 3)
      : [];
  let correctLine: RoleplayReview["correctLine"] = null;
  const c = o.correctLine;
  if (c && typeof c === "object") {
    const cc = c as Record<string, unknown>;
    if (typeof cc.line === "string" && cc.line.trim() && typeof cc.why === "string" && cc.why.trim()) {
      correctLine = { line: cc.line.trim(), why: cc.why.trim() };
    }
  }
  return {
    summary: typeof o.summary === "string" ? o.summary.trim() : "",
    whatWorked: strArr(o.whatWorked),
    toImprove: strArr(o.toImprove),
    correctLine,
  };
}

// LLM route: longer serverless budget than Vercel's short default (this route awaits a blocking LLM call).
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  // Each turn + the review is an LLM call; cap per-user so a held Enter can't
  // spin unbounded cost. Mirrors the 27 sibling coach routes (audit F1, A13).
  // 30/min is far above a real typed conversation, so it only blocks abuse.
  const limited = rateLimit(req, {
    id: "coach-sales-roleplay",
    windowMs: 60_000,
    max: 30,
  });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("company_id")
    .eq("id", auth.user.id)
    .maybeSingle();
  const companyId = (profile?.company_id as string | null) ?? null;
  if (!companyId) {
    return NextResponse.json({ error: "No company context." }, { status: 403 });
  }

  const corpus = await getCurrentSalesCorpus(companyId).catch(() => null);
  const transcript = transcriptOf(body.messages);

  if (body.phase === "turn") {
    const r = await dissectCoachV5({
      companyId,
      systemPrompt: prospectSystem(body, corpus?.content) + CONVERSATION_IS_DATA,
      userMessage: `Conversation so far:\n${transcript || "(the rep is about to open)"}\n\nRespond as the PROSPECT with your next line only.`,
    });
    const reply = parseReply(r.text);
    if (!reply) {
      return NextResponse.json(
        { error: "The prospect didn't respond — try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ reply });
  }

  // phase === "review"
  const r = await dissectCoachV5({
    companyId,
    systemPrompt: reviewSystem(body, corpus?.content) + CONVERSATION_IS_DATA,
    userMessage: `Full roleplay transcript:\n${transcript}\n\nReview the REP's performance.`,
  });
  return NextResponse.json({ review: parseReview(r.text) });
}
