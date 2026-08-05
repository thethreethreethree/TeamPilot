import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * runAndStoreSummary — the "Summarize" deliverable's length behaviour.
 *
 * Summarize is the founder's fourth named deliverable ("<My read> <Summarize> <Dissect>"). Unlike the
 * read/score/dissect engines it never had a length floor — only a 0-segment guard — so it already satisfies
 * the founder 2026-08-05 "every session, however short, gets all content" contract. This locks that: a short
 * (1-2 segment) session DOES summarize (LLM called, text returned), and ONLY a genuinely empty (0-segment)
 * transcript short-circuits before the LLM. Suppressed / empty-text degrade to null (honest, no fabrication).
 */
vi.mock("@/lib/claude", () => ({ generateCareReply: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ insert: async () => ({}) }) }) }));
vi.mock("@/lib/care/toolPrompts", () => ({ CONVERSATION_IS_DATA: "" }));

import { generateCareReply } from "@/lib/claude";
import { runAndStoreSummary } from "../salesSummary";

const asMock = (x: unknown) => x as ReturnType<typeof vi.fn>;
const seg = (speaker: "agent" | "customer", i: number) => ({ id: `s${i}`, speaker, text: `line ${i}`, seq: i });
const run = (segments: ReturnType<typeof seg>[]) =>
  runAndStoreSummary({ companyId: "co1", actorId: "u1", sessionId: "sess1", segments } as Parameters<typeof runAndStoreSummary>[0]);

beforeEach(() => vi.clearAllMocks());

describe("runAndStoreSummary — Summarize has no minimum length", () => {
  it("ZERO segments → null, WITHOUT calling the LLM (the only short-circuit)", async () => {
    const out = await run([]);
    expect(out).toBeNull();
    expect(generateCareReply).not.toHaveBeenCalled();
  });

  it("a SHORT call (1 segment) → summarizes (founder 2026-08-05: no minimum length)", async () => {
    asMock(generateCareReply).mockResolvedValue({ suppressed: false, text: "Discussed pricing; open on timing." });
    const out = await run([seg("agent", 0)]);
    expect(out).toBe("Discussed pricing; open on timing.");
    expect(generateCareReply).toHaveBeenCalledTimes(1);
  });

  it("a suppressed response → null (never surfaces suppressed content)", async () => {
    asMock(generateCareReply).mockResolvedValue({ suppressed: true, text: "" });
    expect(await run([seg("agent", 0), seg("customer", 1)])).toBeNull();
  });

  it("empty / whitespace text → null (honest — nothing to summarize, not fabricated)", async () => {
    asMock(generateCareReply).mockResolvedValue({ suppressed: false, text: "   " });
    expect(await run([seg("agent", 0), seg("customer", 1)])).toBeNull();
  });
});
