import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSupabaseClient } from "./_supabaseMock";

/**
 * §3.4 honest-bound flag on the asset readout (2026-07-09): the file scan is an
 * unbounded select, so PostgREST caps it at ~1000 rows — for a company with more
 * files, every count + retrieval metric undercounts. `bounded` surfaces that so
 * the number reads as "capped" not silently-wrong. (Full fix — pagination /
 * DB-aggregation — is the founder's row-bound decision, closure item 8.)
 */
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { createClient } from "@/lib/supabase/server";
import { fetchAssetReadout } from "../assetReadout";

function mockFiles(n: number) {
  const files = Array.from({ length: n }, (_, i) => ({
    id: `f${i}`,
    uploader_id: "u1",
    classification_lane: i % 2 === 0 ? "classified" : "casual",
    created_at: "2026-01-01T00:00:00Z",
    deprecated_at: null,
  }));
  // files returns n rows; every other table defaults to { data: [] } so the
  // downstream retrieval/citation/suggestion queries return empty and the
  // function completes, exercising the bounded logic on the file scan.
  vi.mocked(createClient).mockResolvedValue(
    makeSupabaseClient({ files: { data: files } }, []) as never
  );
}

describe("fetchAssetReadout — §3.4 bounded flag", () => {
  beforeEach(() => vi.mocked(createClient).mockReset());

  it("bounded=true when the file scan hits the 1000-row cap (metrics undercount)", async () => {
    mockFiles(1000);
    const r = await fetchAssetReadout("all");
    expect(r.bounded).toBe(true);
    // uploads reflects the (capped) page — the flag is what makes it honest.
    expect(r.uploads).toBe(1000);
  });

  it("bounded=false below the cap (metrics are complete)", async () => {
    mockFiles(6);
    const r = await fetchAssetReadout("all");
    expect(r.bounded).toBe(false);
    expect(r.uploads).toBe(6);
  });
});
