import { describe, it, expect, vi, beforeEach } from "vitest";

const db = vi.hoisted(() => ({ session: null as Record<string, unknown> | null, inserts: [] as unknown[], insertError: null as unknown }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      for (const m of ["select", "eq"]) b[m] = () => b;
      b.maybeSingle = async () => ({ data: table === "coaching_sessions" ? db.session : null, error: null });
      b.insert = async (row: unknown) => (db.inserts.push(row), { error: db.insertError });
      return b;
    },
  }),
}));
import { notifyCallReady } from "../notify";

const UPLOADED = { agent_id: "rep1", context: "phone", client_label: "Acme", audio_duration_seconds: 312 };

beforeEach(() => {
  db.inserts = [];
  db.insertError = null;
});

describe("notifyCallReady (0289)", () => {
  it("an uploaded phone/video call tells its own rep, linking the session", async () => {
    db.session = UPLOADED;
    expect(await notifyCallReady({ companyId: "co1", sessionId: "s1" })).toBe(true);
    expect(db.inserts).toEqual([{ company_id: "co1", recipient_id: "rep1", agent_id: "rep1", session_id: "s1", type: "call_ready", payload: { client_label: "Acme" } }]);
  });
  it("a live call (no uploaded duration) or a door call rings nothing", async () => {
    db.session = { ...UPLOADED, audio_duration_seconds: null };
    expect(await notifyCallReady({ companyId: "co1", sessionId: "s1" })).toBe(false);
    db.session = { ...UPLOADED, context: "in_person" };
    expect(await notifyCallReady({ companyId: "co1", sessionId: "s1" })).toBe(false);
    expect(db.inserts).toEqual([]);
  });
  it("a second read of the same call (trim, relabel) is the dedupe's quiet no-op, not an error", async () => {
    db.session = UPLOADED;
    db.insertError = { code: "23505", message: "duplicate" };
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await notifyCallReady({ companyId: "co1", sessionId: "s1" })).toBe(false);
    expect(err).not.toHaveBeenCalled();
  });
});
