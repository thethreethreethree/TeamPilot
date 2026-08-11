import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * generateSessionArtifacts — the shared post-call generation for a Sales Coach session (finalize + the
 * uploaded-recording label path both call it). Its LOAD-BEARING property is RESILIENCE: each of the five
 * engines is wrapped in `.catch(fallback)`, so one engine failing or hanging degrades to its fallback WITHOUT
 * dropping the others. Without that, a single rejection would reject the `Promise.all` and lose EVERY artifact
 * (the finalize comment states exactly this). The route tests MOCK this helper (they only assert it is called),
 * so this resilience contract is untested there — hence this direct unit test.
 *
 * withEngineTimeout is stubbed to pass the promise through: the timeout race is orthogonal to the .catch
 * fallback logic under test, and stubbing it avoids leaving a real timer pending in the test env.
 */
vi.mock("@/lib/coach/v5/engineTimeout", () => ({
  withEngineTimeout: (p: Promise<unknown>) => p,
}));
vi.mock("@/lib/coach/v5/salesDissect", () => ({ runAndStoreDissect: vi.fn() }));
vi.mock("@/lib/coach/v5/salesSummary", () => ({ runAndStoreSummary: vi.fn() }));
vi.mock("@/lib/coach/v5/salesPivot", () => ({ runAndStorePivot: vi.fn() }));
vi.mock("@/lib/coach/v5/salesMoments", () => ({ runAndStoreMoments: vi.fn() }));
vi.mock("@/lib/coach/v5/salesIntel", () => ({ runAndStoreIntel: vi.fn() }));

import { runAndStoreDissect } from "@/lib/coach/v5/salesDissect";
import { runAndStoreSummary } from "@/lib/coach/v5/salesSummary";
import { runAndStorePivot } from "@/lib/coach/v5/salesPivot";
import { runAndStoreMoments } from "@/lib/coach/v5/salesMoments";
import { runAndStoreIntel } from "@/lib/coach/v5/salesIntel";
import { generateSessionArtifacts } from "../generateSessionArtifacts";

const mock = (fn: unknown) => fn as unknown as ReturnType<typeof vi.fn>;
const session = { clientLabel: "Acme", context: "in_person" as const, outcome: null };
const segments = [{ speaker: "agent", text: "Hi", seq: 0 }] as never;
const args = { companyId: "co1", actorId: "rep1", sessionId: "sess1", session, segments };

beforeEach(() => vi.clearAllMocks());

describe("generateSessionArtifacts", () => {
  it("runs all five engines with the session-scoped args and returns their results", async () => {
    mock(runAndStoreDissect).mockResolvedValue({ hasSignal: true });
    mock(runAndStoreSummary).mockResolvedValue("summary text");
    mock(runAndStoreMoments).mockResolvedValue([{ m: 1 }]);
    mock(runAndStorePivot).mockResolvedValue({ p: 1 });
    mock(runAndStoreIntel).mockResolvedValue({ i: 1 });

    const out = await generateSessionArtifacts(args);
    expect(out).toEqual({
      dissect: { hasSignal: true },
      summary: "summary text",
      moments: [{ m: 1 }],
      pivot: { p: 1 },
      intel: { i: 1 },
    });
    // Arg wiring: dissect gets the session title + context; moments/pivot get the outcome; every engine gets
    // the tenant/actor/session/segments. A silent arg drop (e.g. losing `outcome`) would change the result.
    expect(mock(runAndStoreDissect)).toHaveBeenCalledWith(
      expect.objectContaining({
        companyId: "co1",
        actorId: "rep1",
        sessionId: "sess1",
        sessionTitle: "Acme",
        context: "in_person",
        segments,
      })
    );
    expect(mock(runAndStoreMoments)).toHaveBeenCalledWith(
      expect.objectContaining({ context: "in_person", outcome: null })
    );
    expect(mock(runAndStorePivot)).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: null })
    );
  });

  it("is resilient — one engine THROWING does not drop the others (the .catch contract)", async () => {
    // The reason each engine is wrapped in .catch(fallback): without it, this rejection would reject the
    // Promise.all and lose EVERY artifact. Summary throws; the other four must still come through.
    mock(runAndStoreDissect).mockResolvedValue({ hasSignal: true });
    mock(runAndStoreSummary).mockRejectedValue(new Error("LLM 500"));
    mock(runAndStoreMoments).mockResolvedValue([{ m: 1 }]);
    mock(runAndStorePivot).mockResolvedValue({ p: 1 });
    mock(runAndStoreIntel).mockResolvedValue({ i: 1 });

    const out = await generateSessionArtifacts(args); // must NOT reject
    expect(out.summary).toBeNull(); // the failed engine degrades to its fallback
    expect(out.dissect).toEqual({ hasSignal: true }); // the others are intact
    expect(out.moments).toEqual([{ m: 1 }]);
    expect(out.pivot).toEqual({ p: 1 });
    expect(out.intel).toEqual({ i: 1 });
  });

  it("moments falls back to [] (not null) when ITS engine throws — the one distinct fallback", async () => {
    mock(runAndStoreDissect).mockResolvedValue(null);
    mock(runAndStoreSummary).mockResolvedValue(null);
    mock(runAndStoreMoments).mockRejectedValue(new Error("boom"));
    mock(runAndStorePivot).mockResolvedValue(null);
    mock(runAndStoreIntel).mockResolvedValue(null);

    const out = await generateSessionArtifacts(args);
    expect(out.moments).toEqual([]); // moments' fallback is [], distinct from the others' null
    expect(out.dissect).toBeNull();
  });

  it("survives EVERY engine throwing — returns all fallbacks, never rejects", async () => {
    mock(runAndStoreDissect).mockRejectedValue(new Error("x"));
    mock(runAndStoreSummary).mockRejectedValue(new Error("x"));
    mock(runAndStoreMoments).mockRejectedValue(new Error("x"));
    mock(runAndStorePivot).mockRejectedValue(new Error("x"));
    mock(runAndStoreIntel).mockRejectedValue(new Error("x"));

    const out = await generateSessionArtifacts(args);
    expect(out).toEqual({ dissect: null, summary: null, moments: [], pivot: null, intel: null });
  });
});
