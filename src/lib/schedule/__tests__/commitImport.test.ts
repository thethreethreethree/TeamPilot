import { describe, it, expect } from "vitest";
import { commitImport } from "../commitImport";
import type { ImportPlan } from "../importPlanner";

/**
 * The shared import applier (replace-the-week). Pins the SAFETY behavior that isn't visible from the routes:
 *  - the supersede set is computed from live shifts (SHIFT_DEFINED in the imported span → cancelled);
 *  - FAIL-LOUD when the 0223 param is missing AND there's something to supersede (MIGRATION_REQUIRED), never
 *    a silent append of the duplicates the founder chose to avoid;
 *  - a missing param with NOTHING to supersede falls back to the legacy 3-arg call (first import unblocked);
 *  - an event-read failure is READ_FAILED, not a crash.
 */

const evRow = (seq: number, payload: Record<string, unknown>) =>
  ({ id: `e${seq}`, company_id: "c1", type: "SHIFT_DEFINED", actor_id: null, payload, occurred_at: "2026-08-01T00:00:00Z", seq });

const SHIFT_IN_SPAN = "11111111-1111-4111-8111-111111111111";
// An import that lands on 2026-08-17 (so an existing 08-17 shift is in the span).
const PLAN: ImportPlan = {
  newStaff: [],
  shifts: [{ key: "2026-08-17|09:00|17:00", date: "2026-08-17", start: "09:00", end: "17:00" }],
  assignments: [],
};

type RpcFn = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
function sb(events: unknown[], rpc: RpcFn, throwOnRead = false) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => ({ range: async () => (throwOnRead ? Promise.reject(new Error("read boom")) : { data: events, error: null }) }),
        }),
      }),
    }),
    rpc: (fn: string, args: Record<string, unknown>) => rpc(fn, args),
  } as unknown as Parameters<typeof commitImport>[0];
}

describe("commitImport — replace-the-week + fail-loud", () => {
  it("supersedes an existing shift in the imported span and passes its id to the RPC", async () => {
    let seen: Record<string, unknown> | null = null;
    const client = sb(
      [evRow(1, { shiftId: SHIFT_IN_SPAN, date: "2026-08-17", start: "09:00", end: "17:00", requiredHeadcount: 1 })],
      async (_fn, args) => { seen = args; return { data: { shiftsCreated: 1, shiftsSuperseded: (args.p_cancel_shift_ids as unknown[]).length }, error: null }; },
    );
    const res = await commitImport(client, "c1", PLAN);
    expect(res).toMatchObject({ ok: true, shiftsSuperseded: 1 });
    expect(seen!.p_cancel_shift_ids).toEqual([SHIFT_IN_SPAN]);
  });

  it("FAILS LOUD (MIGRATION_REQUIRED) when there is something to supersede but the RPC lacks the param", async () => {
    const client = sb(
      [evRow(1, { shiftId: SHIFT_IN_SPAN, date: "2026-08-17", start: "09:00", end: "17:00", requiredHeadcount: 1 })],
      async () => ({ data: null, error: { code: "PGRST202", message: "could not find function apply_schedule_import(p_cancel_shift_ids, ...)" } }),
    );
    expect(await commitImport(client, "c1", PLAN)).toEqual({ ok: false, code: "MIGRATION_REQUIRED" });
  });

  it("falls back to the legacy 3-arg call when nothing needs superseding (first import unblocked)", async () => {
    let calls = 0;
    const client = sb(
      [], // no existing shifts → cancelIds empty
      async (_fn, args) => {
        calls += 1;
        if ("p_cancel_shift_ids" in args) return { data: null, error: { code: "PGRST202", message: "could not find function" } };
        return { data: { shiftsCreated: 1 }, error: null };
      },
    );
    const res = await commitImport(client, "c1", PLAN);
    expect(res).toMatchObject({ ok: true, shiftsSuperseded: 0 });
    expect(calls).toBe(2); // tried 4-arg, fell back to 3-arg
  });

  it("returns READ_FAILED (not a crash) when the event read throws", async () => {
    const client = sb([], async () => ({ data: {}, error: null }), true);
    expect(await commitImport(client, "c1", PLAN)).toEqual({ ok: false, code: "READ_FAILED" });
  });
});
