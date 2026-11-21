import { describe, it, expect } from "vitest";
import { canPlay, shareBySession, SnippetError, validateSnippet } from "../library";

describe("validateSnippet", () => {
  it("accepts a ≥1 s whole-ms stretch inside the recording", () => {
    expect(() => validateSnippet(1000, 2000, 10_000)).not.toThrow();
    expect(() => validateSnippet(1000, 2000, null)).not.toThrow();
  });
  it("refuses short, negative, fractional or past-the-end clips", () => {
    for (const [a, b] of [[0, 999], [-1, 2000], [0.5, 2000], [0, 11_000]] as const) {
      expect(() => validateSnippet(a, b, 10_000)).toThrow(SnippetError);
    }
  });
});

describe("canPlay", () => {
  it("rep and their managers always; peers only from a company folder with consent", () => {
    expect(canPlay({ viewerIsRep: true, viewerCanViewRep: false, inCompanyFolder: false, shareable: false })).toBe(true);
    expect(canPlay({ viewerIsRep: false, viewerCanViewRep: true, inCompanyFolder: true, shareable: false })).toBe(true);
    expect(canPlay({ viewerIsRep: false, viewerCanViewRep: false, inCompanyFolder: true, shareable: false })).toBe(false);
    expect(canPlay({ viewerIsRep: false, viewerCanViewRep: false, inCompanyFolder: false, shareable: true })).toBe(false);
    expect(canPlay({ viewerIsRep: false, viewerCanViewRep: false, inCompanyFolder: true, shareable: true })).toBe(true);
  });
});

describe("shareBySession — shareState's verdict per call", () => {
  const admin = (pitches: unknown[], events: unknown[]) =>
    ({
      from: (t: string) => {
        const b: Record<string, unknown> = {};
        for (const m of ["select", "eq", "in"]) b[m] = () => b;
        b.then = (res: (v: unknown) => unknown) => res({ data: t === "pitch_scores" ? pitches : events, error: null });
        return b;
      },
    }) as never;
  it("granted then revoked → not shareable; granted → shareable; never asked → not shareable", async () => {
    const m = await shareBySession(
      admin(
        [{ id: "p1", session_id: "s1" }, { id: "p2", session_id: "s2" }],
        [
          { pitch_id: "p1", kind: "granted", actor_id: "r", note: null, created_at: "2026-11-01T00:00:00Z" },
          { pitch_id: "p1", kind: "revoked", actor_id: "r", note: null, created_at: "2026-11-02T00:00:00Z" },
          { pitch_id: "p2", kind: "granted", actor_id: "r", note: null, created_at: "2026-11-01T00:00:00Z" },
        ],
      ),
      "co1",
      ["s1", "s2", "s3"],
    );
    expect(m.get("s1")?.share.shareable).toBe(false);
    expect(m.get("s2")?.share.shareable).toBe(true);
    expect(m.get("s3")).toMatchObject({ pitchId: null, share: { shareable: false } });
  });
});
