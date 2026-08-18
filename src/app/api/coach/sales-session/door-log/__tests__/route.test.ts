import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Door Log write-endpoint contract — the GATE for the F1 offline-idempotency fix (audit 2026-08-18) and
 * the F3 storagePath-binding fix. The build prompt's spec 5.3 required this test; it was the missing gate that
 * let F1 (pitch lost on a partial-failure retry) ship.
 *
 * F1: a PITCH write whose knock DEDUPES must STILL create the pitch (the partial-failure repair path) —
 * never short-circuit on the dedupe before the pitch write.
 * F3: a pitch storagePath not prefixed by the caller's company is rejected (the service-role worker
 * downloads it, so an unvalidated path is a client-controlled read).
 */
vi.mock("next/server", async (orig) => ({
  ...(await orig<typeof import("next/server")>()),
  after: (fn: () => void) => fn(), // run the fire-and-forget kick inline so it doesn't dangle
}));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/api/validate", () => ({ readBody: async (req: { json: () => Promise<unknown> }) => req.json() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentCompanyId: vi.fn(async () => "co1") }));
vi.mock("@/lib/storage/assets", () => ({ createSignedUploadTarget: vi.fn() }));
vi.mock("@/lib/coach/doorlog/worker", () => ({ processPitch: vi.fn(async () => {}) }));
vi.mock("@/lib/data/doorlog", () => ({
  createKnock: vi.fn(),
  createPitch: vi.fn(),
  getKpiForDay: vi.fn(async () => []),
}));

import { createClient } from "@/lib/supabase/server";
import { createKnock, createPitch } from "@/lib/data/doorlog";
import { processPitch } from "@/lib/coach/doorlog/worker";
import { POST } from "../route";

const setAuth = () =>
  (createClient as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
    auth: { getUser: async () => ({ data: { user: { id: "rep1" } } }) },
  });
const req = (body: unknown) =>
  ({ json: async () => body, headers: { get: () => null } }) as unknown as Parameters<typeof POST>[0];

const PITCH = {
  kind: "pitch" as const,
  outcome: "sold" as const,
  localDate: "2026-08-18",
  clientKnockId: "ck-1",
  name: "Mon 3:42pm",
  durationMs: 12000,
  storagePath: "co1/rep1/pitch.webm", // correctly company-prefixed
};

beforeEach(() => {
  vi.clearAllMocks();
  setAuth();
  (createPitch as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "p1" });
});

describe("POST /door-log — F1 offline-idempotency", () => {
  it("a DEDUPED knock on the pitch path STILL creates the pitch (no lost pitch)", async () => {
    // The knock already existed (offline retry) — createKnock returns the existing id + deduped.
    (createKnock as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "k1", deduped: true });
    const res = await POST(req(PITCH));
    expect(res.status).toBe(200);
    // THE GATE: the pitch is created even though the knock deduped.
    expect(createPitch).toHaveBeenCalledTimes(1);
    expect(processPitch).toHaveBeenCalledTimes(1);
  });

  it("a fresh knock creates the pitch normally", async () => {
    (createKnock as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "k1" });
    const res = await POST(req(PITCH));
    expect(res.status).toBe(200);
    expect(createPitch).toHaveBeenCalledTimes(1);
  });

  it("a REAL knock failure (null) is a 500, not a dedupe-success", async () => {
    (createKnock as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const res = await POST(req({ ...PITCH, kind: "knock", outcome: "no_answer" }));
    expect(res.status).toBe(500);
    expect(createPitch).not.toHaveBeenCalled();
  });
});

describe("POST /door-log — F3 storagePath binding", () => {
  it("rejects a pitch whose storagePath is not under the caller's company prefix", async () => {
    (createKnock as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "k1" });
    const res = await POST(req({ ...PITCH, storagePath: "OTHER-CO/rep1/pitch.webm" }));
    expect(res.status).toBe(400);
    expect(createKnock).not.toHaveBeenCalled(); // rejected before any write
    expect(createPitch).not.toHaveBeenCalled();
  });
});
