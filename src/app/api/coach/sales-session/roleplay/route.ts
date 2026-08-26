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
  // Focus-seeded practice (founder 2026-08-26, "Roleplay + focus-scoring"): a specific coaching skill the rep chose
  // to practice, carried from their Training focuses. When present it (a) shapes the prospect to CREATE moments that
  // test the skill, and (b) switches the review to a focus-ANCHORED scored read (parsePracticeReview). Absent → the
  // roleplay behaves exactly as before (a generic practice review, no score).
  focus: z.string().trim().max(600).optional(),
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
  // Focus seed: shape the prospect's BEHAVIOUR so the rep gets real chances to use the skill they're drilling —
  // but the prospect stays fully in character and never names the skill or that this is practice.
  const focusLine = body.focus
    ? `\n\nThe rep is practicing this specific skill: "${body.focus}". Naturally steer the conversation so they get genuine moments that require it (raise the objection, hesitation, or opening that tests it), but STAY fully in character — never mention the skill, coaching, or that this is a practice.`
    : "";
  const grounding = corpus
    ? `\n\nThe rep sells in this market; let your objections and interests fit it, but do NOT recite it — stay a real person:\n${corpus.slice(0, 4000)}`
    : "";
  return `You are role-playing as a sales PROSPECT so a salesperson can practice their pitch. This is ${channelLine(body.context)}.

Your persona: ${body.persona}.${custom}${focusLine}

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

export function parseReview(text: string): RoleplayReview | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    // A malformed/empty (starved) response is an ERROR, not a legitimately-empty "too short" review — return
    // null so the route 502s (a retry), never a blank card indistinguishable from a real empty review (audit
    // 2026-08-19; mirrors the turn phase's parseReply null -> 502). A VALID parse with empty arrays is kept.
    return null;
  }
  // A valid-JSON but non-object response (the literal `null`, a bare number/string, or an array) is still an error,
  // not a review — return null (→ 502) rather than crash on `o.correctLine`. `typeof null === "object"`, so guard it
  // explicitly (audit 2026-08-26).
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const o = parsed as Record<string, unknown>;
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

// Focus-anchored scored practice review (founder 2026-08-26). Same coach-review grounding as reviewSystem, but the
// rep was drilling ONE named skill — so the coach judges specifically whether they applied it and scores THAT, not a
// generic grade. Web (2026 AI-roleplay category): score the specific coachable behaviour, not talk-listen ratio.
function practiceReviewSystem(body: z.infer<typeof Body>, corpus?: string): string {
  const grounding = corpus
    ? `\n\nGround your assessment in this company's own methodology where relevant:\n${corpus.slice(0, 4000)}`
    : "";
  const objection = corpus ? extractObjectionGuidance(corpus, 1000) : "";
  const objectionBlock = objection
    ? `\n\nWhen you assess how the rep handled objections or rejection, hold them to THIS TEAM'S OWN objection rules (not generic tactics):\n${objection}`
    : "";
  return `You are a sales coach reviewing a PRACTICE roleplay between a rep and a simulated prospect (${channelLine(body.context)}). The rep was practicing ONE specific skill: "${body.focus}". Judge SPECIFICALLY whether they applied THAT skill and coach them on it — be honest and encouraging, this is practice. Cite the rep's ACTUAL words; never invent lines they didn't say.${grounding}${objectionBlock}

Return ONLY JSON with this exact shape:
{
  "summary": "<1-2 sentences: an honest read of how they did AT THIS SKILL>",
  "whatWorked": ["<a specific moment they applied the skill, quoting them if possible>"],
  "toImprove": ["<a specific, actionable correction on THIS skill for next attempt>"],
  "correctLine": { "line": "<a stronger line that applies the skill at a key moment>", "why": "<why it works, briefly>" },
  "applied": <true|false: did the rep actually attempt this skill at all in the roleplay?>,
  "score": <integer 0-100: how well they applied THIS skill — not a generic grade>,
  "nextRep": "<one short line: the single thing to try on the next attempt>"
}

whatWorked and toImprove each hold 1-3 short items. correctLine may be null if there was no clear moment. HONESTY: if the rep never got to the skill, set "applied": false and score it low — do NOT inflate. If the roleplay was too short to assess fairly, say so in summary, set "applied": false, "score": 0, and return empty arrays with a null correctLine — never manufacture feedback or a score.`;
}

type PracticeScorecard = {
  focus: string;
  applied: boolean;
  score: number; // 0-100, clamped
  nextRep: string;
};

// Parses the focus-anchored scored review. Reuses parseReview for the qualitative half (so the honesty seams stay
// single-source), then layers the scorecard fields. A malformed/starved response → null (route 502s, a retry — never
// a blank scored card). applied:false is a VALID honest outcome, not a parse failure.
export function parsePracticeReview(
  text: string,
  focus: string,
): { review: RoleplayReview; scorecard: PracticeScorecard } | null {
  const review = parseReview(text);
  if (!review) return null;
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
  const rawScore = typeof o.score === "number" ? o.score : Number(o.score);
  const score = Number.isFinite(rawScore) ? Math.max(0, Math.min(100, Math.round(rawScore))) : 0;
  return {
    review,
    scorecard: {
      focus,
      applied: o.applied === true,
      score,
      nextRep: typeof o.nextRep === "string" ? o.nextRep.trim() : "",
    },
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

  // phase === "review". A focus-seeded practice gets the scored, focus-anchored review; a plain roleplay gets the
  // original qualitative review (unchanged) — single branch, so the default path is untouched.
  if (body.focus) {
    const r = await dissectCoachV5({
      companyId,
      systemPrompt: practiceReviewSystem(body, corpus?.content) + CONVERSATION_IS_DATA,
      userMessage: `Full roleplay transcript:\n${transcript}\n\nReview how the REP applied the skill "${body.focus}".`,
    });
    const scored = parsePracticeReview(r.text, body.focus);
    if (!scored) {
      return NextResponse.json(
        { error: "Couldn't score this attempt — try again." },
        { status: 502 }
      );
    }
    return NextResponse.json({ review: scored.review, scorecard: scored.scorecard });
  }

  const r = await dissectCoachV5({
    companyId,
    systemPrompt: reviewSystem(body, corpus?.content) + CONVERSATION_IS_DATA,
    userMessage: `Full roleplay transcript:\n${transcript}\n\nReview the REP's performance.`,
  });
  const review = parseReview(r.text);
  if (!review) {
    return NextResponse.json(
      { error: "Couldn't generate the review — try again." },
      { status: 502 }
    );
  }
  return NextResponse.json({ review });
}
