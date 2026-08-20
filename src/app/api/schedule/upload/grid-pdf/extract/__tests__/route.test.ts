import { describe, it, expect, vi } from "vitest";

/**
 * Staff x date grid PDF extract route. Pins: manager-only, PDF-only filename guard, and the happy path
 * returns the CSV + distinct codes (the extractor is mocked; the parser itself is tested in staffDatePdf.test).
 */
vi.mock("@/lib/supabase/auth-helpers", () => ({ getCurrentAuthContext: vi.fn() }));
vi.mock("@/lib/api/rateLimit", () => ({ rateLimit: () => null }));
vi.mock("@/lib/schedule/staffDatePdf", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, extractStaffDateGridFromPdf: vi.fn() }; // gridToCsv + docxCellsToCsv stay real
});
vi.mock("@/lib/schedule/vaDocx", () => ({ parseDocxTableCells: vi.fn() }));
vi.mock("@/lib/schedule/staffDateXlsx", () => ({ xlsxToCsv: vi.fn() }));
vi.mock("@/lib/documents/extractText", async (orig) => {
  const actual = await (orig() as Promise<Record<string, unknown>>);
  return { ...actual, unzipEntry: vi.fn() }; // EmptyExtractionError stays real
});

import { getCurrentAuthContext } from "@/lib/supabase/auth-helpers";
import { extractStaffDateGridFromPdf } from "@/lib/schedule/staffDatePdf";
import { parseDocxTableCells } from "@/lib/schedule/vaDocx";
import { xlsxToCsv } from "@/lib/schedule/staffDateXlsx";
import { unzipEntry } from "@/lib/documents/extractText";
import { POST } from "../route";

const asMock = (fn: unknown) => fn as ReturnType<typeof vi.fn>;
const req = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as unknown as Parameters<typeof POST>[0];
const b64 = Buffer.from("dummy").toString("base64");

describe("schedule grid-pdf extract API", () => {
  it("a manager gets CSV + distinct codes from the extracted grid", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(extractStaffDateGridFromPdf).mockResolvedValue({
      staff: ["ALICE", "BOB"],
      headerDates: ["2026-09-01", "2026-09-02"],
      rows: [{ name: "ALICE", cells: ["6-3", "OFF"] }, { name: "BOB", cells: ["GY", "6-3"] }],
    });
    const res = await POST(req({ fileBase64: b64, filename: "frendz.pdf" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.staff).toEqual(["ALICE", "BOB"]);
    expect(j.headerDates).toEqual(["2026-09-01", "2026-09-02"]);
    expect(j.codes).toEqual(["6-3", "GY", "OFF"]); // distinct, normalized, sorted
    expect(j.csv.split("\n")[0]).toBe("NAME,2026-09-01,2026-09-02");
  });

  it("a non-manager is refused (403)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u2", companyId: "c1", role: "Member", isAdmin: false });
    expect((await POST(req({ fileBase64: b64, filename: "frendz.pdf" }))).status).toBe(403);
  });

  it("a .docx returns raw CSV with headerDates empty (client runs Analyze to resolve dates)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(unzipEntry).mockResolvedValue("<w:tbl/>");
    asMock(parseDocxTableCells).mockReturnValue([["NAME", "AUG 16"], ["ALICE", "6-3"]]);
    const res = await POST(req({ fileBase64: b64, filename: "sched.docx" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.headerDates).toEqual([]); // docx → raw labels, not resolved
    expect(j.csv).toBe("NAME,AUG 16\nALICE,6-3");
  });

  it("a .docx with no table is 422", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(unzipEntry).mockResolvedValue("<w:body/>");
    asMock(parseDocxTableCells).mockReturnValue([]);
    expect((await POST(req({ fileBase64: b64, filename: "sched.docx" }))).status).toBe(422);
  });

  it("a .xlsx returns raw CSV with headerDates empty (dependency-free read)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    asMock(xlsxToCsv).mockResolvedValue("NAME,AUG 16\nALICE,6-3");
    const res = await POST(req({ fileBase64: b64, filename: "roster.xlsx" }));
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.headerDates).toEqual([]);
    expect(j.csv).toBe("NAME,AUG 16\nALICE,6-3");
  });

  it("an unsupported filename is rejected (415)", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue({ userId: "u1", companyId: "c1", role: "admin", isAdmin: true });
    expect((await POST(req({ fileBase64: b64, filename: "roster.txt" }))).status).toBe(415);
  });

  it("401 unauthenticated", async () => {
    asMock(getCurrentAuthContext).mockResolvedValue(null);
    expect((await POST(req({ fileBase64: b64, filename: "frendz.pdf" }))).status).toBe(401);
  });
});
