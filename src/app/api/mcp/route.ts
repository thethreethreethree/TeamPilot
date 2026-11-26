import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { authenticateApiKey, recordApiUsage } from "@/lib/api/publicApi";
import { MCP_TOOLS, runTool, ToolError } from "@/lib/api/mcpTools";

export const maxDuration = 60;

/**
 * POST /api/mcp — EloState's MCP server (Engage plan E4; Gong M32 F32.1–F32.4), Streamable HTTP with JSON replies.
 * Claude, ChatGPT or Copilot connect with a company key that has the MCP scope (Protection → API keys), sent as
 * `Authorization: Bearer els_…`. Methods: initialize, notifications/initialized, ping, tools/list, tools/call.
 * Every request is recorded against the key (the usage report, F31.9). Read-only: no tool writes anything.
 */
const PROTOCOL = "2025-03-26";
type Rpc = { jsonrpc?: string; id?: string | number | null; method?: string; params?: Record<string, unknown> };
const reply = (id: Rpc["id"], result: unknown) => NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });
const fail = (id: Rpc["id"], code: number, message: string) => NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

export async function POST(req: Request) {
  const caller = await authenticateApiKey(req, "mcp", "/api/mcp");
  if (caller instanceof NextResponse) return caller;
  let msg: Rpc;
  try {
    msg = (await req.json()) as Rpc;
  } catch {
    await recordApiUsage(caller, "/api/mcp", 400);
    return fail(null, -32700, "Parse error");
  }
  if (Array.isArray(msg)) {
    await recordApiUsage(caller, "/api/mcp", 400);
    return fail(null, -32600, "Send one request at a time.");
  }
  const method = msg.method ?? "";
  await recordApiUsage(caller, `/api/mcp ${method}`.slice(0, 80), 200);
  if (method === "notifications/initialized" || method.startsWith("notifications/")) return new NextResponse(null, { status: 202 });
  if (method === "initialize") {
    return reply(msg.id, {
      protocolVersion: PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "elostate", version: "1.0.0" },
      instructions: "EloState sales data: deals, accounts, contacts, AI deal briefs, and answers from call transcripts. Read-only.",
    });
  }
  if (method === "ping") return reply(msg.id, {});
  if (method === "tools/list") return reply(msg.id, { tools: MCP_TOOLS });
  if (method === "tools/call") {
    const name = String(msg.params?.name ?? "");
    const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
    try {
      const text = await runTool(createAdminClient(), caller.companyId, name, args);
      return reply(msg.id, { content: [{ type: "text", text }] });
    } catch (e) {
      if (e instanceof ToolError) return reply(msg.id, { content: [{ type: "text", text: e.message }], isError: true });
      console.error(`[mcp] tool ${name} failed key=${caller.keyId}: ${e instanceof Error ? e.message : String(e)}`);
      return reply(msg.id, { content: [{ type: "text", text: "EloState couldn't read that just now. Try again." }], isError: true });
    }
  }
  return fail(msg.id, -32601, `Method not found: ${method}`);
}

/** GET: this server doesn't open a server-to-client stream (plain JSON replies only). */
export async function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: "POST" } });
}
