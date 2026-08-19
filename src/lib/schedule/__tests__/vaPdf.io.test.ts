import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * CI coverage for the .pdf IO glue in extractVaGridFromPdf — the unpdf call + the per-page flatten (unpdf
 * returns { items: PdfTextItem[][] } per page). The positional parser is unit-tested with real coordinates
 * in vaPdf.test.ts; here we mock unpdf so a regression in the flatten/wiring (or an unpdf shape change we
 * don't handle) fails CI, and confirm the empty-grid path throws honestly.
 */
vi.mock("unpdf", () => ({ extractTextItems: vi.fn() }));

import { extractTextItems } from "unpdf";
import { extractVaGridFromPdf } from "../vaPdf";
import { EmptyExtractionError } from "@/lib/documents/extractText";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const X = { Time: 180, Alex: 248, Kaye: 297 };
const mk = (str: string, x: number, y: number) => ({ str, x, y });

// A one-page items array in unpdf's real shape: { totalPages, items: [[...]] }.
const PAGE_ITEMS = [
  mk("Time", X.Time, 673), mk("Alex", X.Alex, 673), mk("Kaye", X.Kaye, 673),
  mk("10 AM - 12 PM", X.Time, 655), mk("On Duty", X.Alex, 655),
  mk("1 PM - 2 PM", X.Time, 637), mk("On Duty", X.Alex, 637), mk("On Duty", X.Kaye, 637),
];

beforeEach(() => vi.clearAllMocks());

describe("extractVaGridFromPdf — IO glue (unpdf + per-page flatten)", () => {
  it("flattens per-page items and extracts the grid", async () => {
    asMock(extractTextItems).mockResolvedValue({ totalPages: 1, items: [PAGE_ITEMS] });
    const grid = await extractVaGridFromPdf(new Uint8Array([1]));
    expect(grid.staff).toEqual(["Alex", "Kaye"]);
    expect(grid.rows).toEqual([
      { block: "10 AM - 12 PM", onDuty: ["Alex"] },
      { block: "1 PM - 2 PM", onDuty: ["Alex", "Kaye"] },
    ]);
  });

  it("throws EmptyExtractionError when the pdf has no schedule table", async () => {
    asMock(extractTextItems).mockResolvedValue({ totalPages: 1, items: [[mk("just a memo", 100, 700)]] });
    await expect(extractVaGridFromPdf(new Uint8Array([1]))).rejects.toBeInstanceOf(EmptyExtractionError);
  });
});
