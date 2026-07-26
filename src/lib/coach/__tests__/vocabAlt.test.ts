import { describe, it, expect } from "vitest";
import { vocabAlt, EMOTIONAL_STATES } from "@/lib/coach/vocabulary";

/**
 * Contract lock for vocabAlt (vocabulary.ts) — it builds the regex alternation that composes ALL SEVEN
 * negative-language detectors in heuristics.ts. It was previously untested by name (coverage survey
 * 2026-07-26), so a regression in its three load-bearing behaviors — (1) descending-length ordering,
 * (2) metacharacter escaping, (3) space→\s+ — would silently degrade the Coach's core detection with no
 * failing test. These assertions pin the contract, several of them functionally (compile the regex and
 * assert what it matches), which is the behavior that actually matters.
 */
describe("vocabAlt — regex alternation builder for the Coach's negative-language detectors", () => {
  it("sorts by DESCENDING length so a multi-word phrase precedes its single-word prefix", () => {
    // If "burnt" came first, the engine would match the shorter prefix and never capture the full phrase.
    expect(vocabAlt(["burnt", "burnt out"])).toBe("burnt\\s+out|burnt");
  });

  it("FUNCTIONAL: the compiled alternation captures the full phrase, not just the prefix", () => {
    const re = new RegExp("(" + vocabAlt(["burnt", "burnt out"]) + ")");
    expect("I am burnt out today".match(re)?.[1]).toBe("burnt out"); // the phrase wins, not "burnt"
  });

  it("escapes regex metacharacters so vocabulary punctuation matches literally", () => {
    expect(vocabAlt(["a.b"])).toBe("a\\.b");
    expect(vocabAlt(["c+d"])).toBe("c\\+d");
    expect(vocabAlt(["(x)"])).toBe("\\(x\\)");
    expect(vocabAlt(["a|b"])).toBe("a\\|b"); // a LITERAL pipe, not an alternation operator
  });

  it("FUNCTIONAL: an escaped metacharacter matches its literal char and nothing else", () => {
    const re = new RegExp("^(" + vocabAlt(["a.b"]) + ")$");
    expect(re.test("a.b")).toBe(true);
    expect(re.test("axb")).toBe(false); // the '.' is literal, so it must NOT match any-char
  });

  it("converts spaces to \\s+ so multi-space / newline gaps still match", () => {
    expect(vocabAlt(["burnt out"])).toBe("burnt\\s+out");
    const re = new RegExp(vocabAlt(["burnt out"]));
    expect(re.test("burnt  out")).toBe(true); // double space
    expect(re.test("burnt\nout")).toBe(true); // newline
  });

  it("returns an empty string for an empty list (caller must guard — an empty alternation matches everything)", () => {
    expect(vocabAlt([])).toBe("");
  });

  it("produces a compilable regex from a REAL vocabulary list (no syntax error slips through)", () => {
    const src = vocabAlt(EMOTIONAL_STATES);
    expect(src.length).toBeGreaterThan(0);
    expect(() => new RegExp(src, "i")).not.toThrow();
  });
});
