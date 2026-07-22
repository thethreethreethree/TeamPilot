import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

/**
 * Spawn extension route: gate ordering + the two properties that make it the §3.4-governed tool —
 * (1) a suppressed engine result (month-1 control window) passes through as { suppressed } 200, NOT an error;
 * (2) it returns a validated task DRAFT and never trusts the model's shape (invalid → 502). It does not persist.
 */

vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: vi.fn(() => null) }));
vi.mock("@/lib/api/validate", () => ({ readBody: vi.fn(async () => ({ conversation: "customer thread" })) }));
vi.mock("@/lib/api/extensionAuth", () => ({ requireEntitledExtensionUser: vi.fn() }));
vi.mock("@/lib/taskSpawn/prompt", () => ({
  buildSpawnSystemPrompt: vi.fn(() => "SYS"),
  buildSpawnUserMessage: vi.fn(() => "USER"),
}));
vi.mock("@/lib/claude", () => ({ spawnTask: vi.fn() }));

import { POST } from "@/app/api/care/extension/spawn/route";
import { rateLimit } from "@/lib/api/rateLimit";
import { requireEntitledExtensionUser } from "@/lib/api/extensionAuth";
import { spawnTask } from "@/lib/claude";

const entitled = { ok: true, user: { userId: "u", companyId: "c" } };
const req = {} as never;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(rateLimit).mockReturnValue(null);
});

describe("POST /api/care/extension/spawn", () => {
  it("unentitled (402) turned away before the LLM", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue({
      ok: false,
      response: NextResponse.json({ error: "locked" }, { status: 402 }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(402);
    expect(spawnTask).not.toHaveBeenCalled();
  });

  it("§3.4 control window: a suppressed engine result passes through as { suppressed } 200 (not an error)", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(spawnTask).mockResolvedValue({ suppressed: true, reason: "control_window" } as never);
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.suppressed).toBe(true);
    expect(body.task).toBeUndefined();
  });

  it("routes through the §3.4 control window (companyId passed to spawnTask)", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(spawnTask).mockResolvedValue({
      text: JSON.stringify({ title: "Fix push", description: "d", steps: ["a", "b"] }),
    } as never);
    await POST(req);
    expect(vi.mocked(spawnTask).mock.calls[0]?.[0]).toMatchObject({ companyId: "c" });
  });

  it("valid draft → { task } with trimmed steps", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(spawnTask).mockResolvedValue({
      text: JSON.stringify({ title: " Fix push ", description: "desc", steps: [" step 1 ", "step 2"] }),
    } as never);
    const body = await (await POST(req)).json();
    expect(body.task.title).toBe("Fix push");
    expect(body.task.steps).toEqual(["step 1", "step 2"]);
  });

  it("invalid shape (no steps) → 502 invalid_response_shape", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(spawnTask).mockResolvedValue({
      text: JSON.stringify({ title: "t", description: "d", steps: [] }),
    } as never);
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.code).toBe("invalid_response_shape");
  });

  // Distinct 502 branch from invalid-shape: the model returned text that isn't
  // JSON at all. JSON.parse throws → the malformed_response guard, not the
  // shape validator. Locking that the two 502 modes stay distinct + both handled.
  it("malformed (non-JSON) engine text → 502 malformed_response", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(spawnTask).mockResolvedValue({ text: "not json at all {" } as never);
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(502);
    expect(body.code).toBe("malformed_response");
  });

  // The engine throwing an LlmError must map to the right status: a rate_limit
  // kind → 429 (so the client backs off), any other kind → 502.
  it("LlmError kind=rate_limit → 429; other kinds → 502", async () => {
    const { LlmError } = await import("@/lib/llm/errors");
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);

    vi.mocked(spawnTask).mockRejectedValueOnce(
      new LlmError({ kind: "rate_limit", message: "slow down", provider: "anthropic" })
    );
    expect((await POST(req)).status).toBe(429);

    vi.mocked(spawnTask).mockRejectedValueOnce(
      new LlmError({ kind: "server", message: "upstream boom", provider: "anthropic" })
    );
    expect((await POST(req)).status).toBe(502);
  });
});
