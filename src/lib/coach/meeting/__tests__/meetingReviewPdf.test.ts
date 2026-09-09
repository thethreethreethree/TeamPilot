// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { buildMeetingReviewPdf, exportMeetingReviewPdf } from "../meetingReviewPdf";

const asText = (b: Uint8Array) => new TextDecoder("latin1").decode(b);

const sample = {
  overall: "We aligned on the launch.",
  decisions: [{ decision: "Ship Friday", context: "everyone agreed" }],
  actions: [
    { action: "Write the release notes", owner: "Dana" },
    { action: "Book the venue", owner: null },
  ],
  open_items: [{ item: "Budget sign-off", why: "finance was absent" }],
  effectiveness: { focused: true, note: "stayed on agenda" },
  balance: { balanced: false, note: "one voice led", dominantSharePct: 70 },
  agenda: {
    goal: "Lock the date",
    goalAttained: "partial" as const,
    note: "date set",
    topics: [
      { text: "launch date", covered: true },
      { text: "budget", covered: false },
    ],
  },
};

describe("buildMeetingReviewPdf (real dependency-free PDF)", () => {
  it("produces a valid PDF byte stream (header, xref/trailer, EOF)", () => {
    const pdf = buildMeetingReviewPdf(sample, { title: "Q3 sync", dateISO: "2026-09-03T18:00:00Z" });
    expect(pdf).toBeInstanceOf(Uint8Array);
    const s = asText(pdf);
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s).toContain("/Type /Catalog");
    expect(s).toContain("trailer");
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("embeds the content — decisions, action owners, the owner-less alarm, agenda, and the title", () => {
    const s = asText(buildMeetingReviewPdf(sample, { title: "Q3 sync" }));
    expect(s).toContain("Q3 sync"); // header title
    expect(s).toContain("Ship Friday"); // decision
    expect(s).toContain("Dana"); // action owner
    expect(s).toContain("No owner"); // the owner-less alarm pill (#1 meeting failure)
    expect(s).toContain("Agenda coverage");
    expect(s).toContain("Decisions reached");
    expect(s).toContain("Action items");
    expect(s).toContain("missed"); // the uncovered agenda topic
  });

  it("declares both Helvetica + Helvetica-Bold fonts (headers/labels are bold)", () => {
    const s = asText(buildMeetingReviewPdf(sample));
    expect(s).toContain("/BaseFont /Helvetica");
    expect(s).toContain("/BaseFont /Helvetica-Bold");
  });

  it("escapes PDF metacharacters so the stream can't be corrupted", () => {
    const s = asText(buildMeetingReviewPdf({ decisions: [{ decision: "Ship (v2) \\ soon" }] }));
    expect(s).toContain("Ship \\(v2\\) \\\\ soon"); // ( ) \ escaped by pdfText
  });

  it("paginates a long review into multiple /Page objects", () => {
    const many = { decisions: Array.from({ length: 60 }, (_, i) => ({ decision: `Decision number ${i} that we reached together in the meeting today` })) };
    const s = asText(buildMeetingReviewPdf(many, { title: "Big meeting" }));
    const pageCount = (s.match(/\/Type \/Page\b(?! )/g) ?? s.match(/\/Type \/Page /g) ?? []).length;
    expect(pageCount).toBeGreaterThan(1);
  });
});

describe("exportMeetingReviewPdf (browser download)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("builds a PDF blob and downloads it as a .pdf — no popup, no print dialog", () => {
    const clicks: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this.download);
    });
    const origCreate = URL.createObjectURL;
    URL.createObjectURL = vi.fn(() => "blob:mock");
    URL.revokeObjectURL = vi.fn();

    const ok = exportMeetingReviewPdf(sample, { title: "Q3 Planning Sync" });
    expect(ok).toBe(true);
    expect(clicks).toEqual(["q3-planning-sync.pdf"]); // downloaded, filename slugged from the title
    URL.createObjectURL = origCreate;
  });

  it("returns false (honest) if generation throws — the caller shows an error, not a lie", () => {
    vi.spyOn(document, "createElement").mockImplementation(() => {
      throw new Error("dom gone");
    });
    expect(exportMeetingReviewPdf(sample)).toBe(false);
  });
});
