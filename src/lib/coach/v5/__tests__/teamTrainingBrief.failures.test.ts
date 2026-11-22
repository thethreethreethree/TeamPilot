import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * 2026-11-23: a failed read is not "not enough coaching yet". Before this, a failed profiles or coaching-events read
 * returned `{ reason: "insufficient" }`, which tells a manager to wait for data that already exists.
 */

const answers = vi.hoisted(() => ({ profiles: null as unknown, events: null as unknown }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const answer = table === "profiles" ? answers.profiles : answers.events;
      const chain: Record<string, unknown> = {};
      for (const m of ["select", "eq", "in", "gte", "order", "limit"]) chain[m] = () => chain;
      chain.then = (res: (v: unknown) => unknown) => res(answer);
      return chain;
    },
  }),
}));

import { generateTeamTrainingBrief } from "../teamTrainingBrief";

const boom = { data: null, error: { message: "boom" } };

beforeEach(() => {
  answers.profiles = { data: [{ id: "rep-1", full_name: "Pat" }], error: null };
  answers.events = { data: [], error: null };
});

describe("generateTeamTrainingBrief on a failed read", () => {
  it("still says 'insufficient' for a genuinely quiet period", async () => {
    expect(await generateTeamTrainingBrief("co1", 7)).toMatchObject({ ok: false, reason: "insufficient" });
  });

  it("throws when the team cannot be read", async () => {
    answers.profiles = boom;
    await expect(generateTeamTrainingBrief("co1", 7)).rejects.toThrow(/profiles read failed/);
  });

  it("throws when the coaching events cannot be read", async () => {
    answers.events = boom;
    await expect(generateTeamTrainingBrief("co1", 7)).rejects.toThrow(/coaching events read failed/);
  });
});
