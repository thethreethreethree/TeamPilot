import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { captureCoPilotEdit, postAgentMessage } from "@/lib/data/care";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/care/agent/conversations/[id]/messages
 *
 * Agent posts a reply to a customer (or an internal note).
 * Internal notes are agent-only — the customer widget never
 * fetches them.
 */

const Body = z.object({
  body: z.string().min(1).max(4000),
  isInternalNote: z.boolean().optional(),
  // When the agent's reply was preceded by an AI Co-Pilot draft,
  // the client passes both the original draft + the reasoning. We
  // capture the (draft, sent) pair into the learning corpus so the
  // Co-Pilot gets sharper for this company over time. Both
  // optional — agents can always type freely.
  aiDraft: z.string().max(8000).optional(),
  aiReasoning: z.string().max(4000).optional(),
});

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const sb = await createClient();
  const { data: auth } = await sb.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }
  const { data: profile } = await sb
    .from("profiles")
    .select("is_support_agent, role")
    .eq("id", auth.user.id)
    .maybeSingle();
  const isAgent =
    profile?.is_support_agent ||
    profile?.role === "CEO" ||
    profile?.role === "COO" ||
    profile?.role === "admin";
  if (!isAgent) {
    return NextResponse.json(
      { error: "Care is agent-only." },
      { status: 403 }
    );
  }

  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const msg = await postAgentMessage({
    conversationId: id,
    body: body.body,
    agentId: auth.user.id,
    isInternalNote: !!body.isInternalNote,
  });
  if (!msg) {
    return NextResponse.json(
      { error: "Couldn't post the message." },
      { status: 500 }
    );
  }

  // Capture the Co-Pilot edit if the client sent it. Best-effort —
  // never block the response on this. The accumulated corpus
  // teaches the Co-Pilot the company's voice over time.
  if (!body.isInternalNote && body.aiDraft) {
    const { data: profile } = await sb
      .from("profiles")
      .select("company_id")
      .eq("id", auth.user.id)
      .maybeSingle();
    if (profile?.company_id) {
      try {
        await captureCoPilotEdit({
          conversationId: id,
          companyId: profile.company_id,
          agentId: auth.user.id,
          aiDraft: body.aiDraft,
          aiReasoning: body.aiReasoning ?? null,
          agentSent: body.body,
        });
      } catch (e) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[care] co-pilot edit capture failed", e);
        }
      }
    }
  }
  return NextResponse.json({ message: msg });
}
