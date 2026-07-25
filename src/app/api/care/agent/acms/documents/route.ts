import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { requireCareAgent } from "@/lib/api/careAgentAuth";
import {
  addKnowledgeVersion,
  listKnowledgeVersions,
  getCurrentKnowledgePreview,
  retractKnowledge,
} from "@/lib/care/knowledgeDocs";

/**
 * ACMS (Adaptive Customer Management System) — knowledge document versions.
 *
 * GET    → list versions (metadata) + the current active content preview.
 * POST   → append a new knowledge version from an uploaded .md (admins only).
 * DELETE → retract (turn knowledge off) by appending a retraction (admins only).
 *
 * Founder decision ① (2026-07-25): KNOWLEDGE ONLY. The uploaded content is fenced
 * as untrusted DATA at the prompt layer (src/lib/care/prompt.ts) — this route
 * stores it; it never grants it behavioral authority. Admin-gated at BOTH the
 * route (isAdmin) and RLS (0193 insert policy) — defense-in-depth.
 */

export async function GET() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }
  const [versions, current] = await Promise.all([
    listKnowledgeVersions(),
    getCurrentKnowledgePreview(),
  ]);
  return NextResponse.json({ versions, current });
}

const Body = z.object({
  // Client reads the picked .md file's text and posts it here (that IS the upload
  // — a file-picker on the UI side; JSON transport matches the existing care
  // routes). Bounded to match the DB char_length check in 0193.
  title: z.string().min(1).max(200),
  filename: z.string().max(260).optional().nullable(),
  content: z.string().min(1).max(200000),
});

export async function POST(req: NextRequest) {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json(
      { error: "Only an admin can manage the AI's knowledge." },
      { status: 403 }
    );
  }
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;

  const result = await addKnowledgeVersion({
    companyId: auth.companyId,
    title: body.title,
    filename: body.filename ?? null,
    content: body.content,
    createdBy: auth.agentId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ version: result.version });
}

export async function DELETE() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }
  if (!auth.isAdmin) {
    return NextResponse.json(
      { error: "Only an admin can manage the AI's knowledge." },
      { status: 403 }
    );
  }
  const result = await retractKnowledge({
    companyId: auth.companyId,
    createdBy: auth.agentId,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ version: result.version });
}
