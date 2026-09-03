import { describe, it, expect } from "vitest";
import { summarizeTeamWeek, renderManagerDigestEmail } from "../weeklyDigest";

const row = (agent_id: string, points: number, agent_name: string | null = null) => ({ agent_id, agent_name, points });

describe("summarizeTeamWeek", () => {
  it("aggregates points / sessions / strong per agent and team totals", () => {
    const s = summarizeTeamWeek(
      [row("a", 90, "Ann"), row("a", 50, "Ann"), row("b", 82, "Bob")],
      [],
    );
    expect(s.teamPoints).toBe(222);
    expect(s.teamStrong).toBe(2); // 90 and 82 are >=80; 50 is not
    expect(s.activeReps).toBe(2);
    const ann = s.top.find((t) => t.agentId === "a")!;
    expect(ann).toMatchObject({ name: "Ann", points: 140, sessions: 2, strong: 1 });
  });

  it("folds deals in — a rep with a deal but no scored pitch this week still appears", () => {
    const s = summarizeTeamWeek([row("a", 70, "Ann")], ["b", "b", "c"]);
    expect(s.teamDeals).toBe(3);
    expect(s.top.find((t) => t.agentId === "b")!.deals).toBe(2);
    expect(s.activeReps).toBe(3); // Ann (pitch) + b + c (deals)
  });

  it("ranks top performers by points then strong, capped at topN", () => {
    const s = summarizeTeamWeek([row("a", 30, "A"), row("b", 95, "B"), row("c", 60, "C")], [], 2);
    expect(s.top.map((t) => t.name)).toEqual(["B", "C"]); // top 2 by points
  });

  it("empty week → zeros, no top", () => {
    const s = summarizeTeamWeek([], []);
    expect(s).toMatchObject({ activeReps: 0, teamPoints: 0, teamStrong: 0, teamDeals: 0, top: [] });
  });
});

describe("renderManagerDigestEmail", () => {
  const summary = summarizeTeamWeek([row("a", 90, "Ann"), row("b", 82, "Bob")], ["a"]);
  const email = renderManagerDigestEmail(summary, {
    companyName: "Acme",
    weekLabel: "Sep 4",
    boardUrl: "https://elostate.com/dashboard/sales-coach/scoreboard",
  });

  it("subject names the company + week", () => {
    expect(email.subject).toBe("Acme — your team this week (Sep 4)");
  });

  it("html carries the top performers, the stats, and the board link", () => {
    expect(email.htmlBody).toContain("Ann");
    expect(email.htmlBody).toContain("Bob");
    expect(email.htmlBody).toContain("Top performers");
    expect(email.htmlBody).toContain("https://elostate.com/dashboard/sales-coach/scoreboard");
    expect(email.htmlBody).toContain("Strong sessions");
  });

  it("text version is a readable plain fallback", () => {
    expect(email.textBody).toContain("Acme — your team this week");
    expect(email.textBody).toMatch(/Ann — 90 pts/);
    expect(email.textBody).toContain("Open the Scoreboard: https://elostate.com");
  });

  it("escapes HTML in a rep name (no injection into the email body)", () => {
    const e = renderManagerDigestEmail(summarizeTeamWeek([row("x", 88, '<b>Eve</b>')], []), {
      companyName: "Acme",
      weekLabel: "Sep 4",
      boardUrl: "https://e.com/b",
    });
    expect(e.htmlBody).toContain("&lt;b&gt;Eve&lt;/b&gt;");
    expect(e.htmlBody).not.toContain("<b>Eve</b>");
  });
});
