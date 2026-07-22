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

  it("invalid shape (no steps) → 502", async () => {
    vi.mocked(requireEntitledExtensionUser).mockResolvedValue(entitled as never);
    vi.mocked(spawnTask).mockResolvedValue({
      text: JSON.stringify({ title: "t", description: "d", steps: [] }),
    } as never);
    const res = await POST(req);
    expect(res.status).toBe(502);
  });
});
