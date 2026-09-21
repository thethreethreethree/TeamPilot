import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Telling the rep their score moved.
 *
 * Two things here are easy to get wrong and impossible to see afterwards. The first is the upsert
 * mode: 0242's unique index is (recipient_id, type, session_id), and the existing writer ignores
 * duplicates — correct for a strong session, silently wrong here, because a manager can correct two
 * items on one pitch and the rep must be told twice. The second is that this must never fail the
 * caller: the score has already moved by the time it runs.
 */

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyPitchCorrected } from "../notifyCorrection";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;

let upsert: ReturnType<typeof vi.fn>;
const mockDb = (result: { error?: { message: string } } = {}) => {
  upsert = vi.fn().mockResolvedValue({ error: result.error ?? null });
  asMock(createAdminClient).mockReturnValue({ from: () => ({ upsert }) });
};

const NOTICE = {
  companyId: "co1",
  repId: "rep1",
  sessionId: "sess1",
  itemLabel: "Options close",
  total: 72.5,
  qualifying: true,
};

const row = () => upsert.mock.calls[0]![0] as Record<string, unknown>;
const opts = () => upsert.mock.calls[0]![1] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  mockDb();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("the rep is the recipient, which is new for this table", () => {
  it("addresses the notification to the rep, not to their managers", async () => {
    await notifyPitchCorrected(NOTICE);
    // Recipient AND subject are the same person. Every other alert in this table is a manager
    // reading about somebody else.
    expect(row()).toMatchObject({ recipient_id: "rep1", agent_id: "rep1", company_id: "co1" });
  });

  it("uses the type the migration added", async () => {
    await notifyPitchCorrected(NOTICE);
    expect(row().type).toBe("pitch_score_corrected");
  });

  it("carries what changed and what the score became", async () => {
    await notifyPitchCorrected(NOTICE);
    expect(row().payload).toEqual({
      item_label: "Options close",
      total: 72.5,
      qualifying: true,
    });
  });

  it("carries a lost qualification, because that is the worst way to find out from a leaderboard", async () => {
    await notifyPitchCorrected({ ...NOTICE, qualifying: false });
    expect((row().payload as { qualifying: boolean }).qualifying).toBe(false);
  });
});

describe("a second correction must not be swallowed by the dedupe index", () => {
  it("upserts as an UPDATE, not ignore-on-conflict", async () => {
    await notifyPitchCorrected(NOTICE);
    expect(opts()).toMatchObject({ onConflict: "recipient_id,type,session_id" });
    // The existing gamification writer passes ignoreDuplicates: true. Here that would mean the
    // second correction on one pitch never reaches the rep.
    expect(opts().ignoreDuplicates).toBeFalsy();
  });

  it("sets created_at explicitly so the refreshed row does not sort as old news", async () => {
    // created_at has a column default, which only applies on INSERT. On the conflict path the row
    // would keep the FIRST correction's timestamp and the alert would sink down the list.
    const before = Date.now();
    await notifyPitchCorrected(NOTICE);
    const at = new Date(row().created_at as string).getTime();
    expect(at).toBeGreaterThanOrEqual(before - 1000);
    expect(Number.isNaN(at)).toBe(false);
  });

  it("clears read_at so a corrected-again pitch becomes unread again", async () => {
    await notifyPitchCorrected(NOTICE);
    expect(row().read_at).toBeNull();
  });
});

describe("it never fails the caller", () => {
  it("returns false and logs when the write errors", async () => {
    mockDb({ error: { message: 'insert violates check constraint "manager_notifications_type_check"' } });
    // The correction is already written and the score has already moved. Throwing here would undo
    // nothing and only lose the caller's HTTP result.
    await expect(notifyPitchCorrected(NOTICE)).resolves.toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("returns false rather than throwing when the client itself blows up", async () => {
    asMock(createAdminClient).mockImplementation(() => {
      throw new Error("no service role key");
    });
    await expect(notifyPitchCorrected(NOTICE)).resolves.toBe(false);
    expect(console.error).toHaveBeenCalled();
  });

  it("reports success as success", async () => {
    await expect(notifyPitchCorrected(NOTICE)).resolves.toBe(true);
  });
});
