import { describe, it, expect } from "vitest";
import { rankOf } from "../rank";

/** Title → rank (rank.ts): a known word maps; an unclear title stays unknown, never guessed. */
describe("rankOf", () => {
  it("maps titles to ranks", () => {
    expect(rankOf("Chief Revenue Officer")).toBe("c_level");
    expect(rankOf("Owner")).toBe("c_level");
    expect(rankOf("VP of Sales")).toBe("vp");
    expect(rankOf("Head of Ops")).toBe("director");
    expect(rankOf("Sales Manager")).toBe("manager");
    expect(rankOf("Account Representative")).toBe("individual");
  });
  it("leaves an unclear or empty title unknown", () => {
    expect(rankOf("Wizard")).toBe("unknown");
    expect(rankOf("")).toBe("unknown");
    expect(rankOf(null)).toBe("unknown");
  });
});
