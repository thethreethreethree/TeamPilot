import { describe, it, expect } from "vitest";
import { buildMeetingReviewHtml } from "../meetingReviewPdf";

/**
 * buildMeetingReviewHtml is the pure, shareable-PDF document builder. These lock the things the founder asked for:
 * the content is present + broken into clear sections, the owner-less-action alarm is surfaced (the #1 meeting
 * failure), and — critically — all model/transcript text is HTML-ESCAPED (it is untrusted output that can contain
 * < & ").
 */
describe("buildMeetingReviewHtml", () => {
  const base = {
    overall: "We aligned on the launch.",
    decisions: [{ decision: "Ship Friday", context: "everyone agreed" }],
    actions: [
      { action: "Write the release notes", owner: "Dana" },
      { action: "Book the venue", owner: null },
    ],
    open_items: [{ item: "Budget sign-off", why: "finance was absent" }],
    effectiveness: { focused: true, note: "stayed on agenda" },
  };

  it("renders the title, summary, and every section with its content", () => {
    const html = buildMeetingReviewHtml(base, { title: "Q3 Planning", dateISO: "2026-09-01T10:00:00Z" });
    expect(html).toContain("Q3 Planning");
    expect(html).toContain("We aligned on the launch.");
    expect(html).toContain("Decisions reached");
    expect(html).toContain("Ship Friday");
    expect(html).toContain("Action items");
    expect(html).toContain("Write the release notes");
    expect(html).toContain("Left open");
    expect(html).toContain("Budget sign-off");
  });

  it("surfaces the owner on an owned action AND flags an owner-less one (the #1 failure indicator)", () => {
    const html = buildMeetingReviewHtml(base);
    expect(html).toContain("Dana");
    expect(html).toContain("No owner");
    // The top-of-doc quick chip counts the owner-less action, not a false "all owned".
    expect(html).toContain("1 action with no owner");
    expect(html).not.toContain("Every action owned");
  });

  it("shows 'Every action owned' when all actions have owners", () => {
    const html = buildMeetingReviewHtml({ actions: [{ action: "x", owner: "Al" }] });
    expect(html).toContain("Every action owned");
    expect(html).not.toContain("No owner");
  });

  it("HTML-escapes untrusted model text (no injection / no broken markup)", () => {
    const html = buildMeetingReviewHtml({ decisions: [{ decision: "<script>alert(1)</script> & \"go\"", context: "" }] });
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;go&quot;");
    expect(html).not.toContain("<script>alert(1)</script>");
  });

  it("shows the honest empty state when the meeting produced nothing", () => {
    const html = buildMeetingReviewHtml({});
    expect(html).toContain("didn't produce clear decisions");
  });

  it("renders agenda coverage with covered vs missed topics", () => {
    const html = buildMeetingReviewHtml({
      agenda: {
        goal: "Lock the date",
        goalAttained: "partial",
        note: "date set",
        topics: [
          { text: "launch date", covered: true },
          { text: "budget", covered: false },
        ],
      },
    });
    expect(html).toContain("Agenda coverage");
    expect(html).toContain("Goal partially met");
    expect(html).toContain("launch date");
    expect(html).toContain("budget");
    expect(html).toContain("missed");
  });
});
