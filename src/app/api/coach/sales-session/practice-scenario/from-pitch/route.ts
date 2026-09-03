import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { callerScopedDb } from "@/lib/api/callerScopedDb";
import { CONVERSATION_IS_DATA } from "@/lib/care/toolPrompts";
import { getCurrentSalesCorpus } from "@/lib/data/salesCoach";
import { dissectCoachV5 } from "@/lib/claude";
import { readBody } from "@/lib/api/validate";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  buildPitchReplaySystemPrompt,
  buildPitchReplayUserMessage,
  parsePracticeScenario,
} from "@/lib/coach/v5/practiceScenario";

/**
 * POST /api/coach/sales-session/practice-scenario/from-pitch — reconstruct a roleplay from a REAL recorded pitch
 * (founder 2026-08-28: "Role Play" on the Pitch Performance page replays that exact pitch for repetition).
 *
 * Reads the rep's own recorded pitch (RLS-scoped: a non-null `pitches` row proves owner-or-manager access, same
 * gate as the report-card detail), reconstructs the CUSTOMER (persona + the objections they actually raised) from
 * the transcript via the same LLM path as the roleplay/review, and returns the rep's top growth area as `focus`
 * so the roleplay's end review is SCORED on the weak spot from this exact pitch.
 *
 * §3.4: on a missing transcript or a malformed generation we return {scenario:null} (an honest fallback, not an
 * error) so the client uses the plain seed; a not-accessible pitch is a 404, never a leak of another rep's call.
 */

const Body = z.object({ pitchId: z.string().uuid() });

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { id: "coach-practice-from-pitch", windowMs: 60_000, max: 20 });
  if (limited) return limited;

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const sb = callerScopedDb(req) ?? (await createClient());
  const { data: auth } = await sb.auth.getUser();
  if (!auth?.user) return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  const { data: profile } = await sb.from("profiles").select("company_id").eq("id", auth.user.id).maybeSingle();
  const companyId = (profile?.company_id as string | null) ?? null;
  if (!companyId) return NextResponse.json({ error: "No company context." }, { status: 403 });

  // RLS gates the pitch read to owner-or-manager; a non-null row proves access (mirrors the report-card detail —
  // no separate ownership check needed). A pitch the caller can't see returns 404, never another rep's transcript.
  const { data: pitch } = await sb
    .from("pitches")
    .select("id, door_knocks!inner(outcome)")
    .eq("id", body.pitchId)
    .maybeSingle();
  if (!pitch) return NextResponse.json({ error: "Pitch not found or not accessible." }, { status: 404 });

  const [{ data: tr }, { data: an }] = await Promise.all([
    sb.from("pitch_transcripts").select("text").eq("pitch_id", body.pitchId).maybeSingle(),
    sb.from("pitch_analyses").select("improvements").eq("pitch_id", body.pitchId).maybeSingle(),
  ]);

  const transcript = ((tr?.text as string | undefined) ?? "").trim();
  // No transcript → nothing to reconstruct. Honest null (not an error): the client falls back to a plain roleplay.
  if (!transcript) return NextResponse.json({ scenario: null, focus: null });

  const knock = pitch.door_knocks as unknown as { outcome: string } | { outcome: string }[];
  const outcome = (Array.isArray(knock) ? knock[0]?.outcome : knock?.outcome) ?? null;
  // The weak spot from THIS pitch = the top growth opportunity — becomes the roleplay's scored focus.
  const improvements = (an?.improvements as string[] | undefined) ?? [];
  const focus = improvements.find((s) => typeof s === "string" && s.trim())?.trim().slice(0, 600) ?? null;

  const corpus = await getCurrentSalesCorpus(companyId).catch(() => null);
  const r = await dissectCoachV5({
    companyId,
    systemPrompt: buildPitchReplaySystemPrompt(corpus?.content) + CONVERSATION_IS_DATA,
    userMessage: buildPitchReplayUserMessage(transcript, outcome),
  });

  return NextResponse.json({ scenario: parsePracticeScenario(r.text), focus });
}
