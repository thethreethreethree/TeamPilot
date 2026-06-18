import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readBody } from "@/lib/api/validate";
import { createTag, listTags } from "@/lib/data/care";
import { requireCareAgent } from "@/lib/api/careAgentAuth";

export async function GET() {
  const auth = await requireCareAgent();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  if (!auth.companyId) {
    return NextResponse.json({ error: "Agent only." }, { status: 403 });
  }
  const tags = await listTags();
  return NextResponse.json({ tags });
}

const Body = z.object({
  name: z.string().min(1).max(60),
  color: z.string().min(1).max(20),
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
  const tag = await createTag({
    name: body.name,
    color: body.color,
    companyId: auth.companyId,
  });
  if (!tag) {
    return NextResponse.json(
      { error: "Couldn't create tag." },
      { status: 500 }
    );
  }
  return NextResponse.json({ tag });
}
