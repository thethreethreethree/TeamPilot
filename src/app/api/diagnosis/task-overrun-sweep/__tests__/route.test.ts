import { describe, it, expect, vi, afterEach } from "vitest";

/**
 * POST /api/diagnosis/task-overrun-sweep — the external (non-Vercel) sibling of the task-overrun cron.
 * Previously untested. Pins its shared-secret gate: 503 when TASK_OVERRUN_SWEEP_SECRET is unset, and 401
 * on a wrong or absent X-Task-Sweep-Secret header — a public URL that must not be triggerable by anyone.
 * constantTimeEqual is the real primitive; the sweep is mocked so the gate is tested in isolation.
 */
vi.mock("@/lib/diagnosis/taskOverrunSweep", () => ({ sweepTaskOverruns: vi.fn(async () => ({ swept: 0 })) }));

import { POST } from "../route";

const req = (secret?: string) =>
  ({
    headers: { get: (k: string) => (k.toLowerCase() === "x-task-sweep-secret" ? (secret ?? null) : null) },
  }) as unknown as Parameters<typeof POST>[0];

const OLD = process.env.TASK_OVERRUN_SWEEP_SECRET;
afterEach(() => {
  if (OLD === undefined) delete process.env.TASK_OVERRUN_SWEEP_SECRET;
  else process.env.TASK_OVERRUN_SWEEP_SECRET = OLD;
  vi.clearAllMocks();
});

describe("POST /api/diagnosis/task-overrun-sweep — shared-secret gate", () => {
  it("503 when TASK_OVERRUN_SWEEP_SECRET is unset — disabled until configured", async () => {
    delete process.env.TASK_OVERRUN_SWEEP_SECRET;
    expect((await POST(req("anything"))).status).toBe(503);
  });

  it("401 on a wrong or absent secret header — not triggerable by anyone", async () => {
    process.env.TASK_OVERRUN_SWEEP_SECRET = "s3cret";
    expect((await POST(req("wrong"))).status).toBe(401);
    expect((await POST(req(undefined))).status).toBe(401);
  });

  it("200 on the correct secret — the sweep runs", async () => {
    process.env.TASK_OVERRUN_SWEEP_SECRET = "s3cret";
    expect((await POST(req("s3cret"))).status).toBe(200);
  });
});
