import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import {
  createCannedResponse,
  listCannedResponses,
} from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

export async function GET() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }
  const shortcuts = await listCannedResponses();
  return NextResponse.json({ shortcuts });
}

const Body = z.object({
  shortcut: z.string().min(1).max(40),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(4000),
});

export async function POST(req: NextRequest) {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }
  const body = await readBody(req, Body);
  if (body instanceof NextResponse) return body;
  const created = await createCannedResponse({
    shortcut: body.shortcut,
    title: body.title,
    body: body.body,
    companyId: auth.companyId,
    createdBy: auth.agentId,
  });
  if (!created) {
    return NextResponse.json(
      { error: "Couldn't create shortcut (duplicate shortcut?)." },
      { status: 500 }
    );
  }
  return NextResponse.json({ shortcut: created });
}
