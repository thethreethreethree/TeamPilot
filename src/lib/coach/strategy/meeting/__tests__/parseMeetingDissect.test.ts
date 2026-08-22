import { describe, it, expect } from "vitest";
import { parseMeetingDissect, EMPTY_MEETING_DISSECT } from "../parseMeetingDissect";

/**
 * The meeting dissect measures a meeting's CONSEQUENCES (§3.5), so the parse must be honest about the two
 * failure modes it exists to surface: an action with NO owner (null, not a guess) and a topic left unresolved.
 * Total + silent-safe: malformed/empty → EMPTY (never a fabricated review, §3.4).
 */
describe("parseMeetingDissect", () => {
  it("parses a full dissect with decisions, owned actions, open items, effectiveness", () => {
    const d = parseMeetingDissect(
      JSON.stringify({
        decisions: [{ decision: "Ship the beta Friday", context: "after weighing QA risk" }],
        actions: [{ action: "Write the release notes", owner: "Dana" }],
        openItems: [{ item: "Pricing tier names", why: "raised but deferred to next week" }],
        effectiveness: { focused: true, note: "stayed on agenda, closed the launch question" },
        overall: "Decided the launch date and assigned the release notes.",
      })
    );
    expect(d.hasSignal).toBe(true);
    expect(d.decisions[0]?.decision).toBe("Ship the beta Friday");
    expect(d.actions[0]?.owner).toBe("Dana");
    expect(d.openItems[0]?.item).toBe("Pricing tier names");
    expect(d.effectiveness?.focused).toBe(true);
    expect(d.overall).toContain("launch date");
  });

  it("normalizes an unnamed owner to null (the owner-less-action failure, honest not guessed)", () => {
    const d = parseMeetingDissect(
      JSON.stringify({ actions: [{ action: "Follow up with legal", owner: "unassigned" }] })
    );
    expect(d.actions[0]).toEqual({ action: "Follow up with legal", owner: null });
    // and a literally-null owner stays null
    const d2 = parseMeetingDissect(JSON.stringify({ actions: [{ action: "X", owner: null }] }));
    expect(d2.actions[0]?.owner).toBeNull();
  });

  it("drops empty-string decisions/actions/items rather than emitting blanks", () => {
    const d = parseMeetingDissect(
      JSON.stringify({ decisions: [{ decision: "", context: "x" }], actions: [{ action: "", owner: "Al" }] })
    );
    expect(d.decisions).toHaveLength(0);
    expect(d.actions).toHaveLength(0);
    expect(d.hasSignal).toBe(false);
  });

  it("tolerates a fenced JSON block / surrounding prose", () => {
    const d = parseMeetingDissect('here is the review:\n```json\n{"decisions":[{"decision":"Adopt X","context":"y"}]}\n```');
    expect(d.decisions[0]?.decision).toBe("Adopt X");
  });

  it("returns no-signal (not a fabricated review) on malformed / non-object / non-JSON", () => {
    for (const bad of ["not json", "[1,2,3]", ""]) {
      const d = parseMeetingDissect(bad);
      expect(d.hasSignal).toBe(false);
      expect({ ...d, outcome: undefined }).toEqual({ ...EMPTY_MEETING_DISSECT, outcome: undefined });
    }
    expect(parseMeetingDissect("{}").hasSignal).toBe(false);
  });

  it("hasSignal is true if ANY consequence is present (effectiveness alone counts)", () => {
    const d = parseMeetingDissect(JSON.stringify({ effectiveness: { focused: false, note: "circled, never decided" } }));
    expect(d.hasSignal).toBe(true);
    expect(d.effectiveness?.focused).toBe(false);
  });

  it("outcome distinguishes TRANSIENT (unparseable) from EMPTY (parsed thin meeting) from SIGNAL (audit H4)", () => {
    // Unparseable / non-object → transient: a token-starved truncated response, must NOT permanently back off.
    expect(parseMeetingDissect("not json").outcome).toBe("transient");
    expect(parseMeetingDissect("[1,2,3]").outcome).toBe("transient");
    expect(parseMeetingDissect("").outcome).toBe("transient");
    // Valid JSON that parsed but carried no consequence → a GENUINE thin meeting → empty (legitimate backoff).
    expect(parseMeetingDissect("{}").outcome).toBe("empty");
    expect(parseMeetingDissect(JSON.stringify({ decisions: [], actions: [], openItems: [] })).outcome).toBe("empty");
    // A real dissect → signal.
    expect(parseMeetingDissect(JSON.stringify({ decisions: [{ decision: "Ship", context: "" }] })).outcome).toBe("signal");
  });
});
