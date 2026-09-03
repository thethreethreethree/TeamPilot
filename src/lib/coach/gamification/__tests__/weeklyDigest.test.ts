import { describe, it, expect } from "vitest";
import { summarizeTeamWeek, renderManagerDigestEmail, summarizeRepWeek, renderRepDigestEmail } from "../weeklyDigest";

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

  it("gives two reps on identical points the SAME medal, in the html and the text", () => {
    // The digest lands in the manager's inbox, about people they know. Telling them Ann came first and Bob
    // second when both banked 200 is a false statement about their own team, and it would have disagreed with
    // the Scoreboard those two reps open.
    const tied = summarizeTeamWeek([row("a", 100, "Ann"), row("a", 100, "Ann"), row("b", 200, "Bob")], []);
    const e = renderManagerDigestEmail(tied, { companyName: "Acme", weekLabel: "Sep 4", boardUrl: "https://e.com/b" });
    expect(tied.top.map((t) => t.points)).toEqual([200, 200]);
    expect(e.htmlBody.match(/\u{1F947}/gu) ?? []).toHaveLength(2); // two golds
    expect(e.htmlBody).not.toContain("\u{1F948}"); // and no silver
    expect(e.textBody).toMatch(/ 1\. Ann /);
    expect(e.textBody).toMatch(/ 1\. Bob /);
  });

  it("skips the place a tie consumed, so the third rep is third", () => {
    // 1, 1, 3 — not 1, 1, 2. The skip is what stops the rep below a tie from appearing to have beaten
    // more people than they did.
    const s = summarizeTeamWeek([row("a", 200, "Ann"), row("b", 200, "Bob"), row("c", 50, "Cal")], []);
    const e = renderManagerDigestEmail(s, { companyName: "Acme", weekLabel: "Sep 4", boardUrl: "https://e.com/b" });
    expect(e.textBody).toMatch(/ 3\. Cal /);
    expect(e.textBody).not.toMatch(/ 2\. Cal /);
    // Third place is still third place: Cal keeps the bronze, and no silver is awarded because nobody came
    // second. Two golds, no silver, one bronze is the honest shape of this week.
    expect(e.htmlBody).toContain("\u{1F949}&nbsp;Cal");
    expect(e.htmlBody).not.toContain("\u{1F948}");
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

const rrow = (points: number, session_id: string | null = null) => ({ points, session_id });

describe("summarizeRepWeek", () => {
  it("folds the rep's own week: points, strong, avg→band, best pitch", () => {
    const s = summarizeRepWeek([rrow(90, "s1"), rrow(60, "s2"), rrow(72, "s3")], 1);
    expect(s.points).toBe(222);
    expect(s.sessions).toBe(3);
    expect(s.strong).toBe(1); // only 90 is >=80
    expect(s.deals).toBe(1);
    expect(s.avg).toBe(74); // 222/3
    expect(s.bandLabel).toBe("Solid"); // band for 74
    expect(s.best).toEqual({ points: 90, sessionId: "s1" }); // highest-scored pitch
  });

  it("a deal-only week (no scored pitch) → zeros + no best, but the deal counts", () => {
    const s = summarizeRepWeek([], 2);
    expect(s).toMatchObject({ points: 0, sessions: 0, strong: 0, deals: 2, best: null });
  });
});

describe("renderRepDigestEmail", () => {
  const summary = summarizeRepWeek([rrow(88, "s1"), rrow(70, "s2")], 1);
  const e = renderRepDigestEmail(summary, {
    repName: "Ann Lee",
    weekLabel: "Sep 4",
    arenaUrl: "https://elostate.com/dashboard/sales-coach/my-progress",
    sessionBaseUrl: "https://elostate.com/dashboard/sales-coach",
  });

  it("greets by first name, states the band, and links the best pitch + the Arena", () => {
    expect(e.htmlBody).toContain("Nice work this week, Ann");
    expect(e.htmlBody).toContain(summary.bandLabel); // the rep's weekly band (avg 79 → Solid) appears in the header
    expect(e.htmlBody).toContain("/dashboard/sales-coach/s1/after-pitch"); // best-pitch breakdown link
    expect(e.htmlBody).toContain("https://elostate.com/dashboard/sales-coach/my-progress"); // Arena CTA
    expect(e.subject).toMatch(/Your week — \d+ point/);
  });

  it("escapes the rep name in the greeting", () => {
    const bad = renderRepDigestEmail(summarizeRepWeek([rrow(80, "s")], 0), {
      repName: "<script>x</script>",
      weekLabel: "Sep 4",
      arenaUrl: "https://e.com/a",
      sessionBaseUrl: "https://e.com/s",
    });
    expect(bad.htmlBody).not.toContain("<script>x</script>");
  });
});
