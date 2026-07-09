import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSupabaseClient } from "../../data/__tests__/_supabaseMock";

/**
 * sweepTaskOverruns is the EMITTER for the previously-dead `task_slipped` signal
 * (closure-doc item 9): it calls run_task_overrun_sweep (0109), which emits
 * `task.overran_due_date` for overdue-and-open tasks WITHOUT an existing slip
 * event. These pin:
 *   - it calls the batch RPC with the scan cap and returns the emitted count;
 *   - bounded=true when the run emits a full page (§3.4 honest-bound — a backlog);
 *   - a read/RPC error THROWS (not a silent empty sweep — the live-error-vs-empty
 *     discipline);
 *   - a null/absent count degrades to 0, not NaN.
 */
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { sweepTaskOverruns } from "../taskOverrunSweep";

type Call = [string, unknown[]];

describe("sweepTaskOverruns — deadline-slip emitter (item 9)", () => {
  let calls: Call[];
  beforeEach(() => {
    calls = [];
  });

  it("calls run_task_overrun_sweep with the cap and returns the emitted count", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ "rpc:run_task_overrun_sweep": { data: 3, error: null } }, calls) as never
    );

    const res = await sweepTaskOverruns();

    expect(res).toMatchObject({ ok: true, emitted: 3, bounded: false });
    const rpc = calls.find(([m]) => m === "rpc");
    expect(rpc![1][0]).toBe("run_task_overrun_sweep");
    expect(rpc![1][1]).toEqual({ p_limit: 500 });
  });

  it("sets bounded=true when a full page is emitted (§3.4 honest-bound — backlog)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ "rpc:run_task_overrun_sweep": { data: 500, error: null } }, calls) as never
    );
    const res = await sweepTaskOverruns();
    expect(res.emitted).toBe(500);
    expect(res.bounded).toBe(true);
  });

  it("THROWS on an RPC error (not a silent empty sweep)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient(
        { "rpc:run_task_overrun_sweep": { data: null, error: { message: "db down" } } },
        calls
      ) as never
    );
    await expect(sweepTaskOverruns()).rejects.toThrow("db down");
  });

  it("degrades a null count to 0 (not NaN)", async () => {
    vi.mocked(createAdminClient).mockReturnValue(
      makeSupabaseClient({ "rpc:run_task_overrun_sweep": { data: null, error: null } }, calls) as never
    );
    const res = await sweepTaskOverruns();
    expect(res.emitted).toBe(0);
    expect(res.bounded).toBe(false);
  });
});
